const SlaRecord = require('../sla/sla.model');
const User = require('../auth/user.model');

const getRoleAllowedAssignees = (userRole) => {
  if (['agency_super_admin', 'brand_super_admin'].includes(userRole)) {
    // Agency Admin panel: Tickets can ONLY be raised to Commander Admin
    return ['commander_admin'];
  }
  if (['agency_manager', 'agency'].includes(userRole)) {
    // Agency Manager panel: Tickets can be raised to Agency Admin or Commander Admin
    return ['agency_super_admin', 'commander_admin'];
  }
  if (['agency_client', 'client'].includes(userRole)) {
    // Client panel: Tickets can be raised to Agency Admin or Agency Manager
    return ['agency_super_admin', 'agency_manager'];
  }
  if (userRole === 'brand_manager') {
    return ['brand_super_admin', 'commander_admin'];
  }
  return ['commander_admin', 'agency_super_admin'];
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
    const allowedRoles = getRoleAllowedAssignees(effectiveRole);
    if (!allowedRoles.includes(assignee.role)) {
      return res.status(403).json({ success: false, message: 'Cannot assign ticket to this role' });
    }

    // Create a support ticket in SLA module directly since Support acts as the SLA trigger.
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const slaId = `SUP-TKT-${Date.now().toString().slice(-4)}${randomStr}`;

    const dueDate = new Date();
    // Simple logic: Critical = 1 hour, High = 8 hours, Medium = 24 hours
    if (priority === 'Critical') dueDate.setHours(dueDate.getHours() + 1);
    else if (priority === 'High') dueDate.setHours(dueDate.getHours() + 8);
    else dueDate.setHours(dueDate.getHours() + 24);

    const newSla = new SlaRecord({
      slaId,
      clientId: req.user?.brandId || req.user?.companyId || req.user?._id, 
      agencyId: assignee.agencyId || assignee.companyId || req.user?.agencyId || req.user?.companyId || assignee._id,
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
        details: `Support ticket assigned from ${req.user ? req.user.name : 'User'}`,
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
    let allowedRoles = getRoleAllowedAssignees(effectiveRole);
    let matchQuery = {};

    if (['agency_client', 'client'].includes(effectiveRole)) {
      if (req.user && req.user.agencyId) matchQuery.agencyId = req.user.agencyId;
    } else if (effectiveRole === 'brand_manager') {
      if (req.user && req.user.brandId) matchQuery.brandId = req.user.brandId;
    }

    matchQuery.role = { $in: allowedRoles };
    if (req.user?._id) {
      matchQuery._id = { $ne: req.user._id };
    }
    
    const users = await User.find(matchQuery).select('name role email brandId agencyId companyId');
    
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};
