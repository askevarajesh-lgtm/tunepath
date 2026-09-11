const { CalendarEvent, EventNote, EventAttachment } = require('./models/calendarEventAsset.model');
const { Meeting } = require('../meetings/models/meetingAsset.model');
const Task = require('../tasks/task.model');
const Lead = require('../leads/lead.model');
const User = require('../auth/user.model');
const Proposal = require('../proposals/proposal.model');
const Invoice = require('../invoices/invoice.model');
const Project = require('../projects/project.model');
const Transaction = require('../transactions/transaction.model');
const WorkspaceProject = require('../seoWorkspace/models/workspaceProject.model');
const { Campaign } = require('../campaigns/campaign.model');
const Deal = require('../salesPipeline/deal.model');
const mongoose = require('mongoose');

const CLIENT_ROLES = ['brand_super_admin', 'brand_manager', 'agency_client', 'client', 'brand_team_user', 'client_user'];

// Helper to determine scoping query based on user role
const getScopingFilters = (userRole, userId, companyId) => {
  const eventFilter = {};
  const meetingFilter = {};
  const taskFilter = {};
  const leadFilter = {};

  // For Super Admins, Commander Admins
  if (['supreme_super_admin', 'commander_admin'].includes(userRole)) {
    if (companyId) {
      eventFilter.companyId = companyId;
      meetingFilter.companyId = companyId;
      taskFilter.tenantCompanyId = companyId;
      leadFilter.companyId = companyId;
    }
    return { eventFilter, meetingFilter, taskFilter, leadFilter };
  }

  // For Agency Admins / Managers
  if (['agency_super_admin', 'agency_manager'].includes(userRole)) {
    eventFilter.companyId = companyId;
    meetingFilter.companyId = companyId;
    taskFilter.tenantCompanyId = companyId;
    leadFilter.companyId = companyId;
    return { eventFilter, meetingFilter, taskFilter, leadFilter };
  }

  // For Brand Admins / Managers & Clients (Client side)
  if (CLIENT_ROLES.includes(userRole)) {
    eventFilter.$or = [{ clientId: companyId }, { companyId }, { attendees: userId }];
    meetingFilter.$or = [{ clientId: companyId }, { companyId }, { participants: userId }];
    taskFilter.companyId = companyId;
    leadFilter.clientId = companyId;
    return { eventFilter, meetingFilter, taskFilter, leadFilter };
  }

  // For regular employee / team member
  eventFilter.companyId = companyId;
  eventFilter.$or = [{ host: userId }, { attendees: userId }];

  meetingFilter.companyId = companyId;
  meetingFilter.$or = [{ host: userId }, { participants: userId }];

  taskFilter.tenantCompanyId = companyId;
  taskFilter.assignedTo = userId;

  leadFilter.companyId = companyId;
  leadFilter.assignedTo = userId;

  return { eventFilter, meetingFilter, taskFilter, leadFilter };
};

// Helper: build a date range filter on a given field
const applyDateRange = (filter, field, startDate, endDate) => {
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    filter[field] = { $gte: start, $lte: end };
  }
};

const calendarService = {
  // Create a new custom calendar event
  createEvent: async (eventData, companyId, userId) => {
    const event = new CalendarEvent({
      ...eventData,
      companyId,
      host: eventData.host || userId,
      history: [{
        action: 'create',
        performedBy: userId,
        details: `Event created: "${eventData.title}"`,
        timestamp: new Date()
      }]
    });

    await event.save();
    return event;
  },

  // Get all events from custom events, meetings, tasks, and lead followups
  getAllEvents: async (companyId, query, userRole, userId, userObj) => {
    const { startDate, endDate, eventType, search, clientId, hostId } = query;
    const isClientRole = CLIENT_ROLES.includes(userRole);

    // For agency_client/client roles, their own _id IS the clientId stored on tasks/invoices/etc.
    // companyId for these users is their agencyId, NOT their own client company ID.
    const selfClientId = isClientRole
      ? (userObj?.brandId || userObj?.clientId || userId)
      : null;

    const targetClientId = clientId || selfClientId || null;

    const { eventFilter, meetingFilter, taskFilter, leadFilter } = getScopingFilters(userRole, userId, companyId);

    // Apply date range filters if present
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      
      eventFilter.startDateTime = { $gte: start, $lte: end };
      meetingFilter.date = { $gte: start, $lte: end };
      taskFilter.dueDate = { $gte: start, $lte: end };
      leadFilter.nextFollowUpDate = { $gte: start, $lte: end };
    }

    // Apply Client Filter — overwrite any $or set by getScopingFilters to avoid conflicts
    if (targetClientId) {
      // Reset to a clean direct match so there's no conflict with $or from getScopingFilters
      delete eventFilter.$or;
      delete meetingFilter.$or;
      eventFilter.clientId = targetClientId;
      meetingFilter.clientId = targetClientId;
      taskFilter.companyId = targetClientId;
      leadFilter.clientId = targetClientId;
    }

    // Apply Host / AssignedTo Filter
    if (hostId) {
      eventFilter.host = hostId;
      meetingFilter.host = hostId;
      taskFilter.assignedTo = hostId;
      leadFilter.assignedTo = hostId;
    }

    // 1. Fetch custom events
    const customEvents = await CalendarEvent.find(eventFilter)
      .populate('host', 'name email logo')
      .populate('attendees', 'name email logo')
      .populate('clientId', 'name companyName')
      .populate('projectId', 'name')
      .populate('taskId', 'title status');

    const mappedCustom = customEvents.map(e => {
      const obj = e.toObject();
      obj.source = 'custom';
      return obj;
    });

    // 2. Fetch meetings
    const meetings = await Meeting.find(meetingFilter)
      .populate('host', 'name email logo')
      .populate('participants', 'name email logo')
      .populate('clientId', 'name companyName')
      .populate('projectId', 'name');

    const mappedMeetings = meetings.map(m => {
      const dateStr = m.date.toISOString().split('T')[0];
      const start = new Date(`${dateStr}T${m.time || '09:00'}`);
      const end = new Date(start.getTime() + (m.duration || 30) * 60 * 1000);

      return {
        _id: m._id,
        title: `[Meeting] ${m.title}`,
        eventType: m.meetingType || 'team_meeting',
        startDateTime: start,
        endDateTime: end,
        location: m.meetingLink ? 'Virtual / Meeting Link' : 'Office',
        meetingLink: m.meetingLink,
        host: m.host,
        attendees: m.participants,
        status: m.status,
        companyId: m.companyId,
        clientId: m.clientId,
        leadId: m.leadId,
        projectId: m.projectId,
        meetingId: m._id,
        isInternal: !m.clientId,
        source: 'meeting',
        notes: m.agenda
      };
    });

    // 3. Fetch tasks (due dates act as deliverables/milestones)
    taskFilter.dueDate = taskFilter.dueDate || { $ne: null };
    const tasks = await Task.find(taskFilter)
      .populate('assignedTo', 'name email logo')
      .populate('projectId', 'name')
      .populate('companyId', 'name companyName');

    const mappedTasks = tasks.map(t => {
      const start = t.startDate ? new Date(t.startDate) : new Date(t.dueDate);
      const end = new Date(t.dueDate);

      return {
        _id: t._id,
        title: `[Task] ${t.title}`,
        eventType: 'content_approval', // Maps tasks as deliverable/approvals
        startDateTime: start,
        endDateTime: end,
        location: 'Task Board',
        host: t.assignedTo?.[0] || null,
        attendees: t.assignedTo || [],
        status: t.status === 'done' || t.status === 'completed' || t.status === 'validated' ? 'completed' : 'upcoming',
        companyId: t.tenantCompanyId,
        clientId: t.companyId,
        projectId: t.projectId,
        taskId: t._id,
        isInternal: !t.companyId,
        source: 'task',
        notes: t.description
      };
    });

    // 4. Fetch CRM lead reminders
    leadFilter.nextFollowUpDate = leadFilter.nextFollowUpDate || { $ne: null };
    const leads = await Lead.find(leadFilter)
      .populate('assignedTo', 'name email logo');

    const mappedLeads = leads.map(l => {
      const start = new Date(l.nextFollowUpDate);
      const end = new Date(start.getTime() + 30 * 60 * 1000);

      return {
        _id: l._id,
        title: `[Lead Followup] ${l.fullName}`,
        eventType: 'sales_call',
        startDateTime: start,
        endDateTime: end,
        location: 'CRM Call',
        host: l.assignedTo,
        attendees: l.assignedTo ? [l.assignedTo] : [],
        status: 'upcoming',
        companyId: l.companyId,
        leadId: l._id,
        isInternal: false,
        source: 'lead',
        notes: `CRM lead followup with ${l.companyName || 'Prospect'}`
      };
    });

    // 5. Fetch Client creation events
    const clientCreationFilter = { role: 'agency_client' };
    if (targetClientId) {
      clientCreationFilter._id = targetClientId;
    } else if (companyId) {
      clientCreationFilter.agencyId = companyId;
    }

    applyDateRange(clientCreationFilter, 'createdAt', startDate, endDate);

    const createdClients = await User.find(clientCreationFilter);
    const mappedClients = createdClients.map(c => {
      const start = new Date(c.createdAt);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return {
        _id: c._id,
        title: `[Client Created] ${c.companyName || c.name}`,
        eventType: 'client_creation',
        startDateTime: start,
        endDateTime: end,
        location: 'System',
        host: null,
        attendees: [],
        status: 'completed',
        companyId: c.agencyId,
        clientId: c._id,
        isInternal: false,
        source: 'client_creation',
        notes: `New client account registered for ${c.companyName || c.name || 'Unknown'}`
      };
    });

    // ─── NEW ACTIVITY SOURCES ────────────────────────────────────────────────

    // 6. Proposals Created
    const proposalFilter = {};
    if (targetClientId) {
      proposalFilter.clientId = targetClientId;
    } else if (companyId) {
      proposalFilter.agencyId = companyId;
    }
    applyDateRange(proposalFilter, 'createdAt', startDate, endDate);

    const proposals = await Proposal.find(proposalFilter)
      .populate('clientId', 'name companyName')
      .populate('createdBy', 'name email');

    const mappedProposals = proposals.map(p => {
      const start = new Date(p.createdAt);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return {
        _id: p._id,
        title: `[Proposal Created] ${p.name}`,
        eventType: 'proposal_review',
        startDateTime: start,
        endDateTime: end,
        location: 'System',
        host: p.createdBy || null,
        attendees: [],
        status: 'completed',
        companyId: p.agencyId,
        clientId: p.clientId,
        isInternal: false,
        source: 'proposal_created',
        notes: `Proposal "${p.name}" (${p.proposalNumber}) created for ${p.clientId?.companyName || p.clientId?.name || 'Client'} — Grand Total: ₹${p.grandTotal?.toLocaleString('en-IN') || '0'}`
      };
    });

    // 7. Invoices Created
    const invoiceFilter = {};
    if (targetClientId) {
      invoiceFilter.clientId = targetClientId;
    } else if (companyId) {
      invoiceFilter.agencyId = companyId;
    }
    applyDateRange(invoiceFilter, 'createdAt', startDate, endDate);

    const invoices = await Invoice.find(invoiceFilter)
      .populate('clientId', 'name companyName')
      .populate('createdBy', 'name email');

    const mappedInvoices = invoices.map(inv => {
      const start = new Date(inv.createdAt);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return {
        _id: inv._id,
        title: `[Invoice Created] ${inv.invoiceNumber}`,
        eventType: 'client_creation',
        startDateTime: start,
        endDateTime: end,
        location: 'System',
        host: inv.createdBy || null,
        attendees: [],
        status: 'completed',
        companyId: inv.agencyId,
        clientId: inv.clientId,
        isInternal: false,
        source: 'invoice_created',
        notes: `Invoice ${inv.invoiceNumber} for ${inv.clientId?.companyName || inv.clientId?.name || 'Client'} — ₹${inv.grandTotal?.toLocaleString('en-IN') || '0'} (${inv.invoiceStatus})`
      };
    });

    // 8. Projects Created
    const projectFilter = {};
    if (targetClientId) {
      projectFilter.clientId = targetClientId;
    } else if (companyId) {
      projectFilter.companyId = companyId;
    }
    applyDateRange(projectFilter, 'createdAt', startDate, endDate);

    const projects = await Project.find(projectFilter)
      .populate('clientId', 'name companyName')
      .populate('createdBy', 'name email');

    const mappedProjects = projects.map(proj => {
      const start = new Date(proj.createdAt);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return {
        _id: proj._id,
        title: `[Project Created] ${proj.name}`,
        eventType: 'campaign_launch',
        startDateTime: start,
        endDateTime: end,
        location: 'System',
        host: proj.createdBy || null,
        attendees: [],
        status: 'completed',
        companyId: proj.companyId,
        clientId: proj.clientId,
        projectId: proj._id,
        isInternal: false,
        source: 'project_created',
        notes: `Project "${proj.name}" created for ${proj.clientId?.companyName || proj.clientId?.name || 'Client'} — Status: ${proj.status}`
      };
    });

    // 9. Transactions Recorded
    const transactionFilter = {};
    if (!targetClientId && companyId) {
      transactionFilter.companyId = companyId;
    }
    applyDateRange(transactionFilter, 'paymentDate', startDate, endDate);

    const transactions = await Transaction.find(transactionFilter)
      .populate('invoiceId', 'invoiceNumber clientId')
      .populate({ path: 'invoiceId', populate: { path: 'clientId', select: 'name companyName' } })
      .populate('recordedBy', 'name email');

    const filteredTransactions = targetClientId
      ? transactions.filter(t => {
          const tClientId = t.invoiceId?.clientId?._id?.toString() || t.invoiceId?.clientId?.toString();
          return tClientId === targetClientId.toString();
        })
      : transactions;

    const mappedTransactions = filteredTransactions.map(t => {
      const start = new Date(t.paymentDate);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const clientName = t.invoiceId?.clientId?.companyName || t.invoiceId?.clientId?.name || 'Client';
      return {
        _id: t._id,
        title: `[Transaction] ₹${t.amount?.toLocaleString('en-IN') || '0'} — ${clientName}`,
        eventType: 'retainer_renewal',
        startDateTime: start,
        endDateTime: end,
        location: 'Finance',
        host: t.recordedBy || null,
        attendees: [],
        status: t.status === 'Verified' || t.status === 'Successful' ? 'completed' : 'upcoming',
        companyId: t.agencyId,
        clientId: t.invoiceId?.clientId?._id || null,
        isInternal: false,
        source: 'transaction_recorded',
        notes: `Payment of ₹${t.amount?.toLocaleString('en-IN') || '0'} via ${t.paymentMethod} — Status: ${t.status}${t.referenceNumber ? ` | Ref: ${t.referenceNumber}` : ''}`
      };
    });

    // 10. SEO Projects (Workspace Projects) Created
    const seoProjectFilter = { isDeleted: { $ne: true } };
    if (targetClientId) {
      seoProjectFilter.clientId = targetClientId;
    } else if (companyId) {
      seoProjectFilter.companyId = companyId;
    }
    applyDateRange(seoProjectFilter, 'createdAt', startDate, endDate);

    const seoProjects = await WorkspaceProject.find(seoProjectFilter)
      .populate('clientId', 'name companyName')
      .populate('createdBy', 'name email');

    const mappedSeoProjects = seoProjects.map(sp => {
      const start = new Date(sp.createdAt);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return {
        _id: sp._id,
        title: `[SEO Project Created] ${sp.name}`,
        eventType: 'performance_review',
        startDateTime: start,
        endDateTime: end,
        location: 'SEO Workspace',
        host: sp.createdBy || null,
        attendees: [],
        status: 'completed',
        companyId: sp.companyId,
        clientId: sp.clientId,
        isInternal: false,
        source: 'seo_project_created',
        notes: `SEO project "${sp.name}" created for ${sp.clientId?.companyName || sp.clientId?.name || 'Client'} — Domain: ${sp.domain}`
      };
    });

    // 11. Tasks Created (by createdAt)
    const taskCreatedFilter = {};
    if (targetClientId) {
      taskCreatedFilter.companyId = targetClientId;
    } else if (companyId) {
      taskCreatedFilter.tenantCompanyId = companyId;
    }
    applyDateRange(taskCreatedFilter, 'createdAt', startDate, endDate);

    const createdTasks = await Task.find(taskCreatedFilter)
      .populate('assignedTo', 'name email logo')
      .populate('assignedBy', 'name email')
      .populate('companyId', 'name companyName');

    const mappedCreatedTasks = createdTasks.map(t => {
      const start = new Date(t.createdAt);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return {
        _id: `task_created_${t._id}`,
        title: `[Task Created] ${t.title}`,
        eventType: 'internal_sync',
        startDateTime: start,
        endDateTime: end,
        location: 'Task Board',
        host: t.assignedBy || null,
        attendees: t.assignedTo ? [t.assignedTo] : [],
        status: 'completed',
        companyId: t.tenantCompanyId,
        clientId: t.companyId,
        taskId: t._id,
        isInternal: !t.companyId,
        source: 'task_created',
        notes: `Task "${t.title}" assigned to ${t.assignedTo?.name || 'Team'} — Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN') : 'N/A'}`
      };
    });

    // 12. Campaigns Created
    const campaignFilter = {};
    if (targetClientId) {
      campaignFilter.$or = [{ clientCompanyId: targetClientId }, { clientId: targetClientId }];
    } else if (companyId) {
      campaignFilter.companyId = companyId;
    }
    applyDateRange(campaignFilter, 'createdAt', startDate, endDate);

    const campaigns = await Campaign.find(campaignFilter)
      .populate('clientCompanyId', 'name companyName')
      .populate('clientId', 'name companyName');

    const mappedCampaigns = campaigns.map(c => {
      const start = new Date(c.createdAt);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const clientName = c.clientCompanyId?.companyName || c.clientCompanyId?.name || c.clientId?.companyName || 'Client';
      const resolvedClientId = c.clientCompanyId?._id || c.clientId?._id || c.clientCompanyId || c.clientId;
      return {
        _id: c._id,
        title: `[Campaign Created] ${c.platform?.toUpperCase() || 'Campaign'} — ${clientName}`,
        eventType: 'campaign_launch',
        startDateTime: start,
        endDateTime: end,
        location: 'Marketing',
        host: null,
        attendees: [],
        status: 'completed',
        companyId: c.companyId,
        clientId: resolvedClientId,
        isInternal: false,
        source: 'campaign_created',
        notes: `${c.platform?.toUpperCase() || 'Campaign'} campaign created for ${clientName} — Budget: ₹${c.campaignAmount?.toLocaleString('en-IN') || c.dailyBudget?.toLocaleString('en-IN') || 'N/A'}`
      };
    });

    // 13. Sales Deals Created
    const dealFilter = {};
    if (targetClientId) {
      dealFilter.clientId = targetClientId;
    } else if (companyId) {
      dealFilter.companyId = companyId;
    }
    applyDateRange(dealFilter, 'createdAt', startDate, endDate);

    const deals = await Deal.find(dealFilter);

    const mappedDeals = deals.map(d => {
      const start = new Date(d.createdAt);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return {
        _id: d._id,
        title: `[Deal Created] ${d.name}`,
        eventType: 'sales_call',
        startDateTime: start,
        endDateTime: end,
        location: 'Sales Pipeline',
        host: null,
        attendees: [],
        status: 'completed',
        companyId: d.companyId,
        clientId: d.clientId || null,
        isInternal: false,
        source: 'deal_created',
        notes: `Deal "${d.name}" created — Stage: ${d.stage}, Value: ₹${d.value?.toLocaleString('en-IN') || '0'}, Rep: ${d.rep || 'N/A'}`
      };
    });

    // Combine everything
    let allEvents = [
      ...mappedCustom,
      ...mappedMeetings,
      ...mappedTasks,
      ...mappedLeads,
      ...mappedClients,
      ...mappedProposals,
      ...mappedInvoices,
      ...mappedProjects,
      ...mappedTransactions,
      ...mappedSeoProjects,
      ...mappedCreatedTasks,
      ...mappedCampaigns,
      ...mappedDeals,
    ];

    // Filter by type if specified
    if (eventType) {
      allEvents = allEvents.filter(e => e.eventType === eventType);
    }

    // Filter by search string
    if (search) {
      const searchLower = search.toLowerCase();
      allEvents = allEvents.filter(e => 
        e.title.toLowerCase().includes(searchLower) ||
        (e.notes && e.notes.toLowerCase().includes(searchLower)) ||
        (e.location && e.location.toLowerCase().includes(searchLower))
      );
    }

    // Sort by startDateTime
    allEvents.sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));

    return allEvents;
  },

  // Get single event details (support custom events and inline populates)
  getEventById: async (eventId, companyId, userRole, userId) => {
    // If it's a meeting ID, fetch from meetings
    let event = await CalendarEvent.findById(eventId)
      .populate('host', 'name email logo')
      .populate('attendees', 'name email logo')
      .populate('clientId', 'name companyName')
      .populate('projectId', 'name')
      .populate('taskId', 'title status');

    if (!event) {
      // Try to find in meetings
      const meeting = await Meeting.findById(eventId)
        .populate('host', 'name email logo')
        .populate('participants', 'name email logo')
        .populate('clientId', 'name companyName')
        .populate('projectId', 'name');

      if (meeting) {
        const dateStr = meeting.date.toISOString().split('T')[0];
        const start = new Date(`${dateStr}T${meeting.time || '09:00'}`);
        const end = new Date(start.getTime() + (meeting.duration || 30) * 60 * 1000);

        return {
          event: {
            _id: meeting._id,
            title: `[Meeting] ${meeting.title}`,
            eventType: meeting.meetingType || 'team_meeting',
            startDateTime: start,
            endDateTime: end,
            location: meeting.meetingLink ? 'Virtual / Meeting Link' : 'Office',
            meetingLink: meeting.meetingLink,
            host: meeting.host,
            attendees: meeting.participants,
            status: meeting.status,
            companyId: meeting.companyId,
            clientId: meeting.clientId,
            leadId: meeting.leadId,
            projectId: meeting.projectId,
            meetingId: meeting._id,
            isInternal: !meeting.clientId,
            source: 'meeting',
            notes: meeting.agenda,
            history: meeting.history
          },
          notes: [],
          attachments: []
        };
      }

      // Try to find in tasks
      const task = await Task.findById(eventId)
        .populate('assignedTo', 'name email logo')
        .populate('projectId', 'name')
        .populate('companyId', 'name companyName');

      if (task) {
        const start = task.startDate ? new Date(task.startDate) : new Date(task.dueDate);
        const end = new Date(task.dueDate);

        return {
          event: {
            _id: task._id,
            title: `[Task] ${task.title}`,
            eventType: 'content_approval',
            startDateTime: start,
            endDateTime: end,
            location: 'Task Board',
            host: task.assignedTo?.[0] || null,
            attendees: task.assignedTo || [],
            status: task.status === 'done' || task.status === 'completed' || task.status === 'validated' ? 'completed' : 'upcoming',
            companyId: task.tenantCompanyId,
            clientId: task.companyId,
            projectId: task.projectId,
            taskId: task._id,
            isInternal: !task.companyId,
            source: 'task',
            notes: task.description,
            history: []
          },
          notes: [],
          attachments: []
        };
      }

      throw new Error('Event not found');
    }

    const notes = await EventNote.find({ eventId }).populate('createdBy', 'name email');
    const attachments = await EventAttachment.find({ eventId }).populate('uploadedBy', 'name email');

    return { event, notes, attachments };
  },

  // Edit / Update event
  updateEvent: async (eventId, updateData, companyId, userId) => {
    const event = await CalendarEvent.findOneAndUpdate(
      { _id: eventId, companyId },
      { 
        ...updateData,
        $push: {
          history: {
            action: 'update',
            performedBy: userId,
            details: 'Event details updated',
            timestamp: new Date()
          }
        }
      },
      { returnDocument: 'after' }
    );

    if (!event) throw new Error('Event not found or unauthorized');
    return event;
  },

  // Delete calendar event
  deleteEvent: async (eventId, companyId) => {
    const event = await CalendarEvent.findOneAndDelete({ _id: eventId, companyId });
    if (!event) throw new Error('Event not found');
    
    // Cleanup linked notes/attachments
    await EventNote.deleteMany({ eventId });
    await EventAttachment.deleteMany({ eventId });
    return event;
  },

  // Update event status
  updateEventStatus: async (eventId, status, companyId, userId) => {
    const event = await CalendarEvent.findOneAndUpdate(
      { _id: eventId, companyId },
      { 
        status,
        $push: {
          history: {
            action: `status_${status}`,
            performedBy: userId,
            details: `Status updated to ${status}`,
            timestamp: new Date()
          }
        }
      },
      { returnDocument: 'after' }
    );

    if (!event) throw new Error('Event not found');
    return event;
  },

  // Add note
  addEventNote: async (eventId, noteData, companyId, userId) => {
    const note = new EventNote({
      eventId,
      content: noteData.content,
      createdBy: userId
    });
    await note.save();
    return note;
  },

  // Add attachment
  addEventAttachment: async (eventId, attachmentData, companyId, userId) => {
    const attachment = new EventAttachment({
      eventId,
      url: attachmentData.url,
      fileName: attachmentData.fileName,
      fileType: attachmentData.fileType || 'link',
      uploadedBy: userId
    });
    await attachment.save();
    return attachment;
  },

  // Compute analytics
  getCalendarAnalytics: async (companyId, query = {}, userRole, userId, userObj) => {
    const isClientRole = CLIENT_ROLES.includes(userRole);
    // For agency_client/client: their _id is the clientId on records, not companyId (which is agencyId)
    const selfClientId = isClientRole
      ? (userObj?.brandId || userObj?.clientId || userId)
      : null;
    const targetClientId = query.clientId || selfClientId || null;

    const { eventFilter, meetingFilter, taskFilter } = getScopingFilters(userRole, userId, companyId);
    if (targetClientId) {
      // Remove $or from scoping filter to avoid conflict with direct clientId match
      delete eventFilter.$or;
      delete meetingFilter.$or;
      eventFilter.clientId = targetClientId;
      meetingFilter.clientId = targetClientId;
      taskFilter.companyId = targetClientId;
    }
    
    const customCount = await CalendarEvent.countDocuments(eventFilter);
    const meetingCount = await Meeting.countDocuments(meetingFilter);
    
    taskFilter.dueDate = { $ne: null };
    const taskCount = await Task.countDocuments(taskFilter);

    // Compute status stats for Custom Events
    const customUpcoming = await CalendarEvent.countDocuments({ ...eventFilter, status: 'upcoming' });
    const customCompleted = await CalendarEvent.countDocuments({ ...eventFilter, status: 'completed' });
    const customCancelled = await CalendarEvent.countDocuments({ ...eventFilter, status: 'cancelled' });

    // Compute meeting status stats
    const meetingUpcoming = await Meeting.countDocuments({ ...meetingFilter, status: 'upcoming' });
    const meetingCompleted = await Meeting.countDocuments({ ...meetingFilter, status: 'completed' });
    const meetingCancelled = await Meeting.countDocuments({ ...meetingFilter, status: 'cancelled' });

    // Count activity sources with targetClientId check
    const proposalFilter = targetClientId ? { clientId: targetClientId } : { agencyId: companyId };
    const invoiceFilter = targetClientId ? { clientId: targetClientId } : { agencyId: companyId };
    const projectFilter = targetClientId ? { clientId: targetClientId } : { companyId };
    const seoProjectFilter = targetClientId ? { clientId: targetClientId, isDeleted: { $ne: true } } : { companyId, isDeleted: { $ne: true } };
    const campaignFilter = targetClientId ? { $or: [{ clientCompanyId: targetClientId }, { clientId: targetClientId }] } : { companyId };
    const dealFilter = targetClientId ? { clientId: targetClientId } : { companyId };

    const proposalCount = await Proposal.countDocuments(proposalFilter);
    const invoiceCount = await Invoice.countDocuments(invoiceFilter);
    const projectCount = await Project.countDocuments(projectFilter);
    const seoProjectCount = await WorkspaceProject.countDocuments(seoProjectFilter);
    const campaignCount = await Campaign.countDocuments(campaignFilter);
    const dealCount = await Deal.countDocuments(dealFilter);

    // Group custom events by type
    const matchFilter = targetClientId 
      ? { clientId: new mongoose.Types.ObjectId(targetClientId) }
      : (companyId ? { companyId: new mongoose.Types.ObjectId(companyId) } : {});
      
    const typeAgg = await CalendarEvent.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$eventType', count: { $sum: 1 } } }
    ]);
    const typeStats = {};
    typeAgg.forEach(t => {
      if (t._id) typeStats[t._id] = t.count;
    });

    return {
      totalEvents: customCount + meetingCount + taskCount + proposalCount + invoiceCount + projectCount + seoProjectCount + campaignCount + dealCount,
      customEventsCount: customCount,
      meetingsCount: meetingCount,
      tasksCount: taskCount,
      proposalsCount: proposalCount,
      invoicesCount: invoiceCount,
      projectsCount: projectCount,
      seoProjectsCount: seoProjectCount,
      campaignsCount: campaignCount,
      dealsCount: dealCount,
      statusStats: {
        upcoming: customUpcoming + meetingUpcoming,
        completed: customCompleted + meetingCompleted,
        cancelled: customCancelled + meetingCancelled
      },
      typeStats
    };
  }
};

module.exports = calendarService;
