const { Deliverable, DeliverableFile, DeliverableComment } = require('./models/deliverableAsset.model');
const Task = require('../tasks/task.model');
const User = require('../auth/user.model');
const Notification = require('../tasks/notification.model');
const mongoose = require('mongoose');

// Helper to create notifications
const createDeliverableNotification = async (userId, type, title, message, deliverableId) => {
  try {
    await Notification.create({
      userId,
      type,
      title,
      message,
      metadata: { deliverableId: deliverableId.toString() },
      channels: { inApp: true, email: false }
    });
  } catch (err) {
    console.error("Failed to create deliverable notification:", err);
  }
};

// Sync deliverable status with task progress when linked
const syncLinkedTask = async (taskId, deliverableStatus, userId) => {
  if (!taskId) return;
  try {
    const task = await Task.findById(taskId);
    if (!task) return;

    if (deliverableStatus === 'approved') {
      task.status = 'done';
      task.progress = 100;
    } else if (deliverableStatus === 'in_progress') {
      task.status = 'in_progress';
      if (task.progress < 20) task.progress = 20;
    } else if (deliverableStatus === 'in_review') {
      task.status = 'under_review';
      if (task.progress < 80) task.progress = 80;
    }

    await task.save();
  } catch (err) {
    console.error("Failed to sync linked task status:", err);
  }
};

// Scoping query builder based on user role
const buildScopingFilter = (userRole, userId, companyId, reqUser = null) => {
  const filter = {};

  const isAgencyClient = userRole === 'agency_client' || userRole === 'client' || (reqUser && (reqUser.brandId || reqUser.isDirect === false));
  const effectiveClientId = reqUser?.role === 'agency_client' 
    ? (reqUser?._id || userId) 
    : (reqUser?.brandId || reqUser?.clientId || (userRole === 'client' ? userId : null));

  if (['supreme_super_admin', 'commander_admin'].includes(userRole)) {
    if (companyId) filter.companyId = companyId;
  } else if (['agency_super_admin', 'agency_manager'].includes(userRole)) {
    filter.companyId = companyId;
  } else if (['brand_super_admin', 'brand_manager'].includes(userRole)) {
    const brandTarget = effectiveClientId || companyId;
    filter.$or = [{ companyId: brandTarget }, { clientId: brandTarget }];
  } else if (isAgencyClient && effectiveClientId) {
    filter.clientId = effectiveClientId;
  } else {
    // Employee/Staff
    filter.companyId = companyId;
    filter.assignee = userId;
  }

  return filter;
};

const deliverablesService = {
  createDeliverable: async (data, companyId, userId) => {
    const deliverable = new Deliverable({
      ...data,
      companyId,
      activityHistory: [{
        action: 'deliverable_created',
        performedBy: userId,
        details: `Deliverable "${data.title}" was created`,
        timestamp: new Date()
      }]
    });

    const saved = await deliverable.save();

    // Notify assignee
    if (saved.assignee) {
      await createDeliverableNotification(
        saved.assignee,
        'deliverable_assigned',
        'New Deliverable Assigned',
        `You have been assigned the deliverable: "${saved.title}"`,
        saved._id
      );
    }

    return saved;
  },

  getAllDeliverables: async (companyId, query, userRole, userId, reqUser = null) => {
    const { status, deliverableType, priority, search, assignee, clientId, overdue } = query;
    const baseFilter = buildScopingFilter(userRole, userId, companyId, reqUser);
    const filter = { ...baseFilter };

    if (status) filter.status = status;
    if (deliverableType) filter.deliverableType = deliverableType;
    if (priority) filter.priority = priority;
    if (assignee) filter.assignee = assignee;
    if (clientId) filter.clientId = clientId;

    if (overdue === 'true') {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $ne: 'approved' };
    }

    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    const deliverables = await Deliverable.find(filter)
      .populate('clientId', 'name companyName logo')
      .populate('projectId', 'name')
      .populate('taskId', 'title status progress')
      .populate('assignee', 'name email logo')
      .populate('approver', 'name email logo')
      .sort({ dueDate: 1 });

    return deliverables;
  },

  getDeliverableById: async (deliverableId, companyId, userRole, userId, reqUser = null) => {
    const baseFilter = buildScopingFilter(userRole, userId, companyId, reqUser);
    const deliverable = await Deliverable.findOne({ _id: deliverableId, ...baseFilter })
      .populate('clientId', 'name companyName logo')
      .populate('projectId', 'name')
      .populate('taskId', 'title status progress')
      .populate('assignee', 'name email logo')
      .populate('approver', 'name email logo');

    if (!deliverable) throw new Error('Deliverable not found or access denied');

    const files = await DeliverableFile.find({ deliverableId }).populate('uploadedBy', 'name email');
    const comments = await DeliverableComment.find({ deliverableId }).populate('createdBy', 'name email logo').sort({ createdAt: 1 });

    return { deliverable, files, comments };
  },

  updateDeliverable: async (deliverableId, updateData, companyId, userId) => {
    const deliverable = await Deliverable.findOne({ _id: deliverableId, companyId });
    if (!deliverable) throw new Error('Deliverable not found');

    const oldStatus = deliverable.status;
    const oldAssignee = deliverable.assignee?.toString();

    // Map fields
    const allowed = ['title', 'description', 'deliverableType', 'status', 'priority', 'progress', 'dueDate', 'assignee', 'approver', 'projectId', 'taskId'];
    allowed.forEach(f => {
      if (updateData[f] !== undefined) deliverable[f] = updateData[f];
    });

    if (deliverable.status !== oldStatus) {
      deliverable.activityHistory.push({
        action: 'stage_changed',
        performedBy: userId,
        details: `Workflow stage updated from ${oldStatus} to ${deliverable.status}`,
        timestamp: new Date()
      });

      // Automatically sync related task progress
      if (deliverable.taskId) {
        await syncLinkedTask(deliverable.taskId, deliverable.status, userId);
      }
    }

    if (updateData.assignee && updateData.assignee.toString() !== oldAssignee) {
      deliverable.activityHistory.push({
        action: 'assignee_changed',
        performedBy: userId,
        details: `Assignee reassigned`,
        timestamp: new Date()
      });

      await createDeliverableNotification(
        deliverable.assignee,
        'deliverable_assigned',
        'Deliverable Reassigned',
        `You have been assigned: "${deliverable.title}"`,
        deliverable._id
      );
    }

    await deliverable.save();
    return deliverable;
  },

  deleteDeliverable: async (deliverableId, companyId) => {
    const deliverable = await Deliverable.findOneAndDelete({ _id: deliverableId, companyId });
    if (!deliverable) throw new Error('Deliverable not found');

    // Cleanup comments & files
    await DeliverableComment.deleteMany({ deliverableId });
    await DeliverableFile.deleteMany({ deliverableId });
    return deliverable;
  },

  submitForApproval: async (deliverableId, remarks, companyId, userId) => {
    const deliverable = await Deliverable.findOne({ _id: deliverableId, companyId });
    if (!deliverable) throw new Error('Deliverable not found');

    deliverable.status = 'in_review';
    deliverable.progress = 80;
    
    deliverable.approvalHistory.push({
      stage: 'in_review',
      action: 'submitted',
      performedBy: userId,
      remarks,
      timestamp: new Date()
    });

    deliverable.activityHistory.push({
      action: 'approval_requested',
      performedBy: userId,
      details: 'Submitted for client/manager approval review',
      timestamp: new Date()
    });

    await deliverable.save();

    if (deliverable.taskId) {
      await syncLinkedTask(deliverable.taskId, 'in_review', userId);
    }

    // Notify approver (or client/manager contact)
    const notifyId = deliverable.approver || deliverable.clientId;
    if (notifyId) {
      await createDeliverableNotification(
        notifyId,
        'deliverable_approval_requested',
        'Approval Review Requested',
        `A deliverable is waiting for your review: "${deliverable.title}"`,
        deliverable._id
      );
    }

    return deliverable;
  },

  approveDeliverable: async (deliverableId, remarks, companyId, userId) => {
    const deliverable = await Deliverable.findById(deliverableId);
    if (!deliverable) throw new Error('Deliverable not found');

    deliverable.status = 'approved';
    deliverable.progress = 100;

    deliverable.approvalHistory.push({
      stage: 'approved',
      action: 'approved',
      performedBy: userId,
      remarks,
      timestamp: new Date()
    });

    deliverable.activityHistory.push({
      action: 'approved',
      performedBy: userId,
      details: `Deliverable approved with remarks: "${remarks || ''}"`,
      timestamp: new Date()
    });

    await deliverable.save();

    if (deliverable.taskId) {
      await syncLinkedTask(deliverable.taskId, 'approved', userId);
    }

    // Notify assignee
    if (deliverable.assignee) {
      await createDeliverableNotification(
        deliverable.assignee,
        'deliverable_approved',
        'Deliverable Approved',
        `Good news! Your deliverable "${deliverable.title}" was approved.`,
        deliverable._id
      );
    }

    return deliverable;
  },

  requestRevision: async (deliverableId, remarks, companyId, userId) => {
    const deliverable = await Deliverable.findById(deliverableId);
    if (!deliverable) throw new Error('Deliverable not found');

    deliverable.status = 'revisions';
    deliverable.progress = 50;

    deliverable.approvalHistory.push({
      stage: 'revisions',
      action: 'revision_requested',
      performedBy: userId,
      remarks,
      timestamp: new Date()
    });

    deliverable.activityHistory.push({
      action: 'revision_requested',
      performedBy: userId,
      details: `Revision requested: "${remarks || ''}"`,
      timestamp: new Date()
    });

    await deliverable.save();

    // Notify assignee
    if (deliverable.assignee) {
      await createDeliverableNotification(
        deliverable.assignee,
        'deliverable_revision_requested',
        'Revision Required',
        `Revisions were requested for: "${deliverable.title}"`,
        deliverable._id
      );
    }

    return deliverable;
  },

  uploadDeliverableFile: async (deliverableId, fileData, companyId, userId) => {
    const deliverable = await Deliverable.findById(deliverableId);
    if (!deliverable) throw new Error('Deliverable not found');

    // Get current version count for this filename or increment generally
    const fileCount = await DeliverableFile.countDocuments({ deliverableId, fileName: fileData.fileName });
    const version = fileCount + 1;

    const file = new DeliverableFile({
      deliverableId,
      url: fileData.url,
      fileName: fileData.fileName,
      fileSize: fileData.fileSize || 0,
      fileType: fileData.fileType || 'link',
      uploadedBy: userId,
      version
    });

    await file.save();

    deliverable.fileCount = await DeliverableFile.countDocuments({ deliverableId });
    deliverable.activityHistory.push({
      action: 'file_uploaded',
      performedBy: userId,
      details: `Uploaded file: ${fileData.fileName} (v${version})`,
      timestamp: new Date()
    });

    await deliverable.save();

    // Notify appropriate user
    const notifyId = userId.toString() === deliverable.assignee?.toString() 
      ? (deliverable.approver || deliverable.clientId)
      : deliverable.assignee;
    
    if (notifyId) {
      await createDeliverableNotification(
        notifyId,
        'deliverable_file_uploaded',
        'New File Attached',
        `A file was uploaded for "${deliverable.title}": ${fileData.fileName}`,
        deliverable._id
      );
    }

    return file;
  },

  addDeliverableComment: async (deliverableId, content, companyId, userId) => {
    const comment = new DeliverableComment({
      deliverableId,
      content,
      createdBy: userId
    });

    await comment.save();

    // Add activity record
    await Deliverable.findByIdAndUpdate(deliverableId, {
      $push: {
        activityHistory: {
          action: 'comment_added',
          performedBy: userId,
          details: 'Added a feedback comment',
          timestamp: new Date()
        }
      }
    });

    return comment;
  },

  getDeliverableAnalytics: async (companyId, userRole, userId) => {
    const baseFilter = buildScopingFilter(userRole, userId, companyId);
    const filter = { ...baseFilter };

    const total = await Deliverable.countDocuments(filter);
    const backlog = await Deliverable.countDocuments({ ...filter, status: 'backlog' });
    const inProgress = await Deliverable.countDocuments({ ...filter, status: 'in_progress' });
    const inReview = await Deliverable.countDocuments({ ...filter, status: 'in_review' });
    const revisions = await Deliverable.countDocuments({ ...filter, status: 'revisions' });
    const approved = await Deliverable.countDocuments({ ...filter, status: 'approved' });

    const overdue = await Deliverable.countDocuments({ 
      ...filter, 
      dueDate: { $lt: new Date() },
      status: { $ne: 'approved' }
    });

    // Group by Client
    const clientBreakdown = await Deliverable.aggregate([
      { $match: filter },
      { $group: { _id: '$clientId', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'clientInfo' } },
      { $unwind: { path: '$clientInfo', preserveNullAndEmptyArrays: true } },
      { $project: { clientName: { $ifNull: ['$clientInfo.companyName', '$clientInfo.name'] }, count: 1 } }
    ]);

    // Group by Assignee
    const assigneeBreakdown = await Deliverable.aggregate([
      { $match: filter },
      { $group: { _id: '$assignee', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
      { $project: { name: '$userInfo.name', count: 1 } }
    ]);

    return {
      total,
      backlog,
      inProgress,
      inReview,
      revisions,
      approved,
      overdue,
      clientBreakdown,
      assigneeBreakdown
    };
  }
};

module.exports = deliverablesService;
