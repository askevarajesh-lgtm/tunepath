const SlaRecord = require('../sla/sla.model');
const User = require('../auth/user.model');

const getRoleAllowedAssignees = (userRole) => {
  if (['agency_super_admin'].includes(userRole)) {
    // Agency Admin panel: Tickets can ONLY be raised to Commander Admin
    return ['commander_admin'];
  }
  if (['agency_manager', 'agency'].includes(userRole)) {
    // Agency Manager panel: Tickets can be raised to Agency Admin or Commander Admin
    return ['agency_super_admin', 'commander_admin'];
  }
  if (['agency_client', 'client', 'user', 'brand_manager', 'brand_super_admin', 'brand_team_user'].includes(userRole)) {
    // Client panel: Tickets can ONLY be assigned to Agency Manager or Agency Admin
    return ['agency_super_admin', 'agency_manager'];
  }
  return ['agency_super_admin', 'agency_manager'];
};

exports.createSupportTicket = async (req, res, next) => {
  try {
    const { subject, details, typeOfRequest, priority, assignedToUserId } = req.body;
    const effectiveRole = req.user ? (req.user.originalRole || req.user.role) : null;

    // Find assignee
    const assignee = await User.findById(assignedToUserId);
    if (!assignee) {
      return res.status(404).json({ success: false, message: 'Assignee not found' });
    }

    // Role validation based on user role
    const isClientRole = ['agency_client', 'client', 'user', 'brand_manager', 'brand_team_user', 'brand_super_admin'].includes(effectiveRole) || Boolean(req.user?.agencyId) || Boolean(req.user?.brandId);
    
    let allowedRoles;
    if (isClientRole && !['agency_super_admin', 'agency_manager', 'commander_admin', 'supreme_super_admin'].includes(effectiveRole)) {
      allowedRoles = ['agency_super_admin', 'agency_manager'];
    } else {
      allowedRoles = getRoleAllowedAssignees(effectiveRole);
    }

    if (!allowedRoles.includes(assignee.role)) {
      return res.status(403).json({ success: false, message: 'Support ticket can only be assigned to Agency Manager or Agency Admin' });
    }

    // Create a support ticket in SLA module directly since Support acts as the SLA trigger.
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const slaId = `SUP-TKT-${Date.now().toString().slice(-4)}${randomStr}`;

    const dueDate = new Date();
    // Simple logic: Critical = 1 hour, High = 8 hours, Medium = 24 hours
    if (priority === 'Critical') dueDate.setHours(dueDate.getHours() + 1);
    else if (priority === 'High') dueDate.setHours(dueDate.getHours() + 8);
    else dueDate.setHours(dueDate.getHours() + 24);

    const clientBrandId = req.user?.brandId || req.user?.companyId || req.user?._id;
    const effectiveAgencyId = assignee.agencyId || assignee.companyId || req.user?.agencyId || (assignee.role === 'agency_super_admin' ? assignee._id : assignee._id);

    const newSla = new SlaRecord({
      slaId,
      clientId: clientBrandId,
      agencyId: effectiveAgencyId,
      assignedTo: assignee._id,
      clientType: 'Direct User Client',
      triggerType: 'Client Issue',
      entityType: 'SupportTicket',
      title: subject,
      description: `[${typeOfRequest}] ${details}`,
      dueDate,
      priority: priority || 'Medium',
      status: 'Normal',
      activityTimeline: [{
        action: 'Ticket Assigned',
        details: `Support ticket assigned from ${req.user ? req.user.name : 'User'} to ${assignee.name} (${assignee.role === 'agency_super_admin' ? 'Agency Admin' : 'Agency Manager'})`,
        createdBy: req.user ? req.user._id : null
      }]
    });

    await newSla.save();

    // Notify the assignee
    const { notifySlaEvent } = require('../sla/sla.controller');
    if (notifySlaEvent) {
      await notifySlaEvent(newSla, 'sla_triggered', 'New Support Ticket', `Ticket ${newSla.slaId} has been assigned to you: ${newSla.title}`, req.user?._id);
    }

    res.status(201).json({ success: true, data: newSla });
  } catch (error) {
    next(error);
  }
};

exports.getAssignableUsers = async (req, res, next) => {
  try {
    const effectiveRole = req.user ? (req.user.originalRole || req.user.role) : null;
    const isClientRole = ['agency_client', 'client', 'user', 'brand_manager', 'brand_team_user', 'brand_super_admin'].includes(effectiveRole) || Boolean(req.user?.agencyId) || Boolean(req.user?.brandId);
    
    let matchQuery = {};

    if (isClientRole && !['agency_super_admin', 'agency_manager', 'commander_admin', 'supreme_super_admin'].includes(effectiveRole)) {
      // Client panel: strictly assignable ONLY to Agency Manager or Agency Admin
      let agencyId = req.user?.agencyId;
      if (!agencyId && req.user?.brandId) {
        const parent = await User.findById(req.user.brandId).select('agencyId');
        if (parent && parent.agencyId) {
          agencyId = parent.agencyId;
        }
      }

      if (agencyId) {
        matchQuery = {
          $and: [
            { _id: { $ne: req.user._id } },
            {
              $or: [
                { _id: agencyId, role: { $in: ['agency_super_admin', 'agency_manager'] } },
                { agencyId: agencyId, role: { $in: ['agency_super_admin', 'agency_manager'] } }
              ]
            }
          ]
        };
      } else {
        matchQuery = {
          _id: { $ne: req.user._id },
          role: { $in: ['agency_super_admin', 'agency_manager'] }
        };
      }
    } else if (['agency_super_admin', 'brand_super_admin'].includes(effectiveRole)) {
      matchQuery = {
        _id: { $ne: req.user._id },
        role: 'commander_admin'
      };
    } else if (['agency_manager', 'agency'].includes(effectiveRole)) {
      if (req.user?.agencyId) {
        matchQuery = {
          _id: { $ne: req.user._id },
          $or: [
            { _id: req.user.agencyId, role: 'agency_super_admin' },
            { role: 'commander_admin' }
          ]
        };
      } else {
        matchQuery = {
          _id: { $ne: req.user._id },
          role: { $in: ['agency_super_admin', 'commander_admin'] }
        };
      }
    } else {
      matchQuery = {
        _id: { $ne: req.user._id },
        role: { $in: ['agency_super_admin', 'agency_manager'] }
      };
    }

    const users = await User.find(matchQuery).select('name role roleName email brandId agencyId companyId');
    
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};
