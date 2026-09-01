const SlaRecord = require('./sla.model');
const mongoose = require('mongoose');
const Notification = require('../tasks/notification.model');
const User = require('../auth/user.model');

// Helper to notify relevant users about SLA events
const notifySlaEvent = async (sla, type, title, message, excludeUserId = null) => {
  try {
    const notifyUserIds = new Set();
    
    // Notify assignee
    if (sla.assignedTo) notifyUserIds.add(sla.assignedTo.toString());
    
    // Don't notify the person who triggered the event
    if (excludeUserId) {
      notifyUserIds.delete(excludeUserId.toString());
    }

    if (notifyUserIds.size === 0) return;

    const notifications = Array.from(notifyUserIds).map(userId => ({
      userId,
      type,
      title,
      message,
      slaRecordId: sla._id,
      channels: { inApp: true, email: false }
    }));

    await Notification.insertMany(notifications);
  } catch (err) {
    console.error("Failed to send SLA notification", err);
  }
};

exports.notifySlaEvent = notifySlaEvent;

// Utility to generate dynamic SLA dashboard stats
exports.getSlaDashboardStats = async (req, res, next) => {
  try {
    const role = req.user ? req.user.role : null;
    const userId = req.user ? req.user._id : null;
    
    // Base match filter
    const match = {};
    if (role === 'commander_admin') {
      match.$or = [
        { triggerType: 'Payment' }, // In a real app we'd filter by clientType here if schema supported it
        { triggerType: 'Client Issue' }
      ];
      match.entityType = { $nin: ['Project', 'Invoice'] };
    } else if (role === 'agency_super_admin') {
      match.triggerType = { $in: ['Payment', 'Client Issue'] };
      match.agencyId = req.user.agencyId || userId;
    } else if (role === 'agency_manager' || role === 'agency') {
      match.agencyId = req.user.agencyId || userId;
    } else if (role === 'client' || role === 'agency_client' || role === 'brand_manager' || role === 'brand_super_admin') {
      match.clientId = req.user.brandId || userId;
    }

    if (req.selectedClientId) {
      match.clientId = req.selectedClientId;
    }

    const slas = await SlaRecord.find(match);

    const stats = {
      total: slas.length,
      normal: 0,
      atRisk: 0,
      breached: 0,
      paymentIssues: 0,
      dueToday: 0,
      upcomingDue: 0,
      resolved: 0
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    slas.forEach(sla => {
      if (sla.status === 'Normal') stats.normal++;
      if (sla.status === 'At Risk') stats.atRisk++;
      if (sla.status === 'Breached') stats.breached++;
      if (sla.status === 'Resolved') stats.resolved++;
      
      if (sla.triggerType === 'Payment' && sla.status !== 'Resolved') stats.paymentIssues++;

      const slaDueDate = new Date(sla.dueDate);
      slaDueDate.setHours(0, 0, 0, 0);

      if (slaDueDate.getTime() === today.getTime() && sla.status !== 'Resolved') {
        stats.dueToday++;
      } else if (slaDueDate.getTime() > today.getTime() && sla.status !== 'Resolved') {
        stats.upcomingDue++;
      }
    });

    // Dummy overall compliance calculation for UI
    const compliance = slas.length > 0 
      ? Math.round(((stats.normal + stats.resolved) / slas.length) * 100) 
      : 100;

    res.status(200).json({
      success: true,
      data: {
        stats,
        compliance,
        activeBreaches: stats.breached,
        atRiskCount: stats.atRisk
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getSlas = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, triggerType, priority, search } = req.query;
    const role = req.user ? req.user.role : null;
    const userId = req.user ? req.user._id : null;

    const query = {};

    // Role-based filtering
    if (role === 'commander_admin') {
      query.$or = [
        { triggerType: 'Payment' },
        { triggerType: 'Client Issue' }
      ];
      query.entityType = { $nin: ['Project', 'Invoice'] };
    } else if (role === 'agency_super_admin') {
      query.triggerType = { $in: ['Payment', 'Client Issue'] };
      query.$or = [
        { agencyId: req.user.agencyId || userId },
        { clientId: userId }
      ];
    } else if (role === 'agency_manager' || role === 'agency') {
      const tenantId = req.user.agencyId || userId;
      const User = require('../auth/user.model');
      const clients = await User.find({
        $or: [
          { agencyId: tenantId },
          { adminId: tenantId },
          { brandId: tenantId }
        ]
      }).select('_id');
      const clientIds = clients.map(c => c._id);
      
      query.$or = [
        { agencyId: { $in: [tenantId, ...clientIds] } },
        { clientId: { $in: [tenantId, ...clientIds] } }
      ];
    } else if (role === 'client' || role === 'agency_client' || role === 'brand_manager' || role === 'brand_super_admin') {
      query.clientId = req.user.brandId || userId;
    }

    if (req.selectedClientId) {
      query.clientId = req.selectedClientId;
      if (query.$or) {
        // Remove agencyId/clientId $or condition if it exists, since we are overriding with clientId
        query.$or = query.$or.filter(c => !c.agencyId && !c.clientId);
        if (query.$or.length === 0) delete query.$or;
      }
    }

    if (status && status !== 'All') query.status = status;
    if (triggerType && triggerType !== 'All') query.triggerType = triggerType;
    if (priority && priority !== 'All') query.priority = priority;

    if (search) {
      const searchCondition = [
        { title: { $regex: search, $options: 'i' } },
        { slaId: { $regex: search, $options: 'i' } }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchCondition }];
        delete query.$or;
      } else {
        query.$or = searchCondition;
      }
    }

    const slas = await SlaRecord.find(query)
      .populate('clientId', 'name companyName email')
      .populate('agencyId', 'name companyName email')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await SlaRecord.countDocuments(query);

    res.status(200).json({
      success: true,
      data: slas,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getSlaById = async (req, res, next) => {
  try {
    const sla = await SlaRecord.findById(req.params.id)
      .populate('clientId', 'name companyName email')
      .populate('agencyId', 'name companyName email')
      .populate('assignedTo', 'name email')
      .populate('notes.createdBy', 'name email')
      .populate('activityTimeline.createdBy', 'name email');

    if (!sla) {
      return res.status(404).json({ success: false, message: 'SLA Record not found' });
    }

    res.status(200).json({ success: true, data: sla });
  } catch (error) {
    next(error);
  }
};

exports.updateSla = async (req, res, next) => {
  try {
    const { status, priority, assignedTo } = req.body;
    
    const sla = await SlaRecord.findById(req.params.id);
    if (!sla) {
      return res.status(404).json({ success: false, message: 'SLA Record not found' });
    }

    let statusChanged = false;
    let assigneeChanged = false;

    if (status && status !== sla.status) {
      statusChanged = true;
      sla.activityTimeline.push({
        action: 'Status Changed',
        details: `Status changed from ${sla.status} to ${status}`,
        createdBy: req.user ? req.user._id : null
      });
      sla.status = status;
      if (status === 'Resolved') sla.resolvedAt = new Date();
    }

    if (priority && priority !== sla.priority) {
      sla.activityTimeline.push({
        action: 'Priority Changed',
        details: `Priority changed from ${sla.priority} to ${priority}`,
        createdBy: req.user ? req.user._id : null
      });
      sla.priority = priority;
    }

    if (assignedTo && String(assignedTo) !== String(sla.assignedTo)) {
      assigneeChanged = true;
      sla.activityTimeline.push({
        action: 'Assigned User Changed',
        details: `SLA assigned to new user`,
        createdBy: req.user ? req.user._id : null
      });
      sla.assignedTo = assignedTo;
    }

    await sla.save();

    // Dispatch notifications
    if (statusChanged) {
      await notifySlaEvent(sla, 'sla_status_changed', 'SLA Status Updated', `SLA ${sla.slaId} status changed to ${status}`, req.user?._id);
    }
    if (assigneeChanged) {
      await notifySlaEvent(sla, 'sla_assigned', 'SLA Assigned', `SLA ${sla.slaId} has been assigned`, req.user?._id);
    }

    res.status(200).json({ success: true, data: sla });
  } catch (error) {
    next(error);
  }
};

exports.addSlaNote = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Note text is required' });

    const sla = await SlaRecord.findById(req.params.id);
    if (!sla) {
      return res.status(404).json({ success: false, message: 'SLA Record not found' });
    }

    sla.notes.push({
      text,
      createdBy: req.user ? req.user._id : null
    });
    
    sla.activityTimeline.push({
      action: 'Note Added',
      details: 'A new note was added',
      createdBy: req.user ? req.user._id : null
    });

    await sla.save();
    
    // Repopulate notes array before returning
    await sla.populate('notes.createdBy', 'name email');

    res.status(201).json({ success: true, data: sla });
  } catch (error) {
    next(error);
  }
};

exports.escalateSla = async (req, res, next) => {
  try {
    const sla = await SlaRecord.findById(req.params.id);
    if (!sla) {
      return res.status(404).json({ success: false, message: 'SLA Record not found' });
    }

    sla.priority = 'Critical';
    sla.status = 'Breached';
    sla.activityTimeline.push({
      action: 'Escalated',
      details: 'SLA manually escalated to Critical/Breached',
      createdBy: req.user ? req.user._id : null
    });

    await sla.save();
    
    await notifySlaEvent(sla, 'sla_escalated', 'SLA Escalated', `SLA ${sla.slaId} has been escalated to Critical Priority`, req.user?._id);

    res.status(200).json({ success: true, data: sla });
  } catch (error) {
    next(error);
  }
};

exports.createSla = async (req, res, next) => {
  try {
    const { title, description, dueDate, priority, clientId, triggerType, entityType } = req.body;
    
    // Generate unique ID
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const slaId = `SLA-REQ-${Date.now().toString().slice(-4)}${randomStr}`;

    const role = req.user ? req.user.role : null;
    let agencyId = null;
    let resolvedClientId = clientId || null;
    let clientType = 'Direct User Client';

    // If client is creating, automatically assign their ID
    if (role === 'client' || role === 'brand_manager' || role === 'brand_super_admin') {
      resolvedClientId = req.user.brandId || req.user._id;
    } else {
      agencyId = req.user.agencyId || req.user._id;
    }

    const newSla = new SlaRecord({
      slaId,
      clientId: resolvedClientId,
      agencyId: agencyId,
      clientType,
      triggerType: triggerType || (role && role.includes('brand') ? 'Client Issue' : 'Agency Client Issue'),
      entityType: entityType || 'Complaint',
      title,
      description,
      dueDate,
      priority: priority || 'Medium',
      status: 'Normal',
      activityTimeline: [{
        action: 'SLA Created',
        details: 'Manual SLA ticket raised',
        createdBy: req.user ? req.user._id : null
      }]
    });

    await newSla.save();

    await notifySlaEvent(newSla, 'sla_triggered', 'New SLA Raised', `SLA ${newSla.slaId} has been raised: ${newSla.title}`, req.user?._id);

    res.status(201).json({ success: true, data: newSla });
  } catch (error) {
    next(error);
  }
};
