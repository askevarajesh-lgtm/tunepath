const { Meeting, MeetingAttachment, MeetingFollowUp, MeetingNote } = require('./models/meetingAsset.model');
const User = require('../auth/user.model');
const Task = require('../tasks/task.model');
const taskService = require('../tasks/task.service');
const Notification = require('../tasks/notification.model');
const sendpulseService = require('../../utils/sendpulse.service');
const mongoose = require('mongoose');

// Helper to create notifications
const createMeetingNotification = async (userId, type, title, message, meetingId) => {
  try {
    await Notification.create({
      userId,
      type,
      title,
      message,
      metadata: { meetingId: meetingId.toString() },
      channels: { inApp: true, email: false }
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
};

/**
 * Build Mongoose query filter based on user role and companyId scoping
 */
const buildScopingFilter = (userRole, userId, companyId) => {
  const filter = {};
  
  if (['supreme_super_admin', 'commander_admin'].includes(userRole)) {
    // Super Admin/Commander can view all, or filtered by companyId if provided
    if (companyId) {
      filter.companyId = companyId;
    }
  } else if (['agency_super_admin', 'agency_manager'].includes(userRole)) {
    // Agency Admin/Manager views all agency meetings
    filter.companyId = companyId;
  } else if (['brand_super_admin', 'brand_manager'].includes(userRole)) {
    // Brand Admin/Manager views meetings related to their brand/company
    filter.$or = [
      { companyId: companyId },
      { clientId: companyId },
      { host: userId },
      { participants: userId }
    ];
  } else if (['agency_client', 'client'].includes(userRole)) {
    // Clients only see meetings they are invited to or their company meetings
    filter.$or = [
      { participants: userId },
      { host: userId },
      { clientId: companyId }
    ];
  } else {
    // Regular employee / user views assigned/hosted meetings
    filter.$or = [
      { host: userId },
      { participants: userId }
    ];
    filter.companyId = companyId;
  }
  
  return filter;
};

/**
 * Create a new meeting
 */
const createMeeting = async (meetingData, companyId, creatorId) => {
  const { participants = [], clientId, leadId, projectId, date, time } = meetingData;

  const meeting = new Meeting({
    ...meetingData,
    companyId,
    host: creatorId,
    history: [{
      action: 'created',
      performedBy: creatorId,
      details: 'Meeting created'
    }]
  });

  const savedMeeting = await meeting.save();

  // Create notifications and send emails for participants
  if (participants && participants.length > 0) {
    const formattedDate = new Date(date).toLocaleDateString();
    const notificationTitle = 'New Meeting Scheduled';
    const notificationMessage = `You have been invited to a meeting: "${savedMeeting.title}" on ${formattedDate} at ${time}. Agenda: ${savedMeeting.agenda || 'N/A'}`;

    for (const participantId of participants) {
      if (participantId.toString() === creatorId.toString()) continue;

      // 1. CRM Messaging System (In-App Notification)
      await createMeetingNotification(
        participantId,
        'meeting_created',
        notificationTitle,
        notificationMessage,
        savedMeeting._id
      );

      // 2. Email Notification via SendPulse
      try {
        const user = await User.findById(participantId);
        if (user && user.email) {
          await sendpulseService.sendEmail(
            user.email,
            `Meeting Invitation: ${savedMeeting.title}`,
            `<div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
              <h2 style="color: #333;">Meeting Invitation</h2>
              <p>You have been invited to a meeting: <strong>${savedMeeting.title}</strong></p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${time}</p>
              <p><strong>Duration:</strong> ${savedMeeting.duration || 30} minutes</p>
              <p><strong>Agenda:</strong> ${savedMeeting.agenda || 'None'}</p>
              ${savedMeeting.meetingLink ? `<p><strong>Join Link:</strong> <a href="${savedMeeting.meetingLink}" target="_blank">${savedMeeting.meetingLink}</a></p>` : ''}
            </div>`
          );
        }
      } catch (err) {
        console.error("Failed to send email invite to participant:", err);
      }
    }
  }

  return await getMeetingById(savedMeeting._id, companyId, 'supreme_super_admin', creatorId);
};

/**
 * Get all meetings with filters and pagination
 */
const getAllMeetings = async (companyId, query, userRole, userId) => {
  const { status, meetingType, search, host, clientId, leadId, projectId, startDate, endDate, limit = 100, skip = 0 } = query;

  // Base scope filter
  const baseFilter = buildScopingFilter(userRole, userId, companyId);
  const filters = { ...baseFilter };

  if (status) filters.status = status;
  if (meetingType) filters.meetingType = meetingType;
  if (host) filters.host = host;
  if (clientId) filters.clientId = clientId;
  if (leadId) filters.leadId = leadId;
  if (projectId) filters.projectId = projectId;

  // Date range filter
  if (startDate || endDate) {
    filters.date = {};
    if (startDate) filters.date.$gte = new Date(startDate);
    if (endDate) filters.date.$lte = new Date(endDate);
  }

  // Search filter (title, agenda, or search string)
  if (search) {
    filters.$and = filters.$and || [];
    filters.$and.push({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { agenda: { $regex: search, $options: 'i' } }
      ]
    });
  }

  // Projection: list view doesn't need the embedded notes/attachments/followUps payload
  const meetings = await Meeting.find(filters)
    .select('-notes -attachments -followUps')
    .populate('host', 'name email role logo')
    .populate('participants', 'name email role logo')
    .populate('clientId', 'name companyName email')
    .populate('projectId', 'name status')
    .sort({ date: 1, time: 1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  const total = await Meeting.countDocuments(filters);

  return {
    meetings,
    total,
    limit: parseInt(limit),
    skip: parseInt(skip)
  };
};

/**
 * Get a single meeting by ID
 */
const getMeetingById = async (meetingId, companyId, userRole, userId) => {
  const baseFilter = buildScopingFilter(userRole, userId, companyId);
  const filters = { _id: meetingId, ...baseFilter };

  const meeting = await Meeting.findOne(filters)
    .populate('host', 'name email role logo')
    .populate('participants', 'name email role logo')
    .populate('clientId', 'name companyName email')
    .populate('projectId', 'name status')
    .populate('leadId', 'fullName companyName email')
    .populate('notes.createdBy', 'name email role')
    .populate('followUps.assignedTo', 'name email role')
    .populate('followUps.taskId', 'title status dueDate')
    .populate('attachments.uploadedBy', 'name email role');

  if (!meeting) {
    throw new Error('Meeting not found or you do not have permission to view it');
  }

  // Preserve prior response shape: notes newest-first, attachments/followUps as embedded
  const notes = [...(meeting.notes || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const followUps = meeting.followUps || [];
  const attachments = meeting.attachments || [];

  return {
    meeting,
    notes,
    followUps,
    attachments
  };
};

/**
 * Update meeting
 */
const updateMeeting = async (meetingId, updateData, companyId, userId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, companyId });

  if (!meeting) {
    throw new Error('Meeting not found');
  }

  const oldParticipants = meeting.participants.map(p => p.toString());
  const oldDate = meeting.date;
  const oldTime = meeting.time;

  // Update fields
  const allowedFields = ['title', 'agenda', 'meetingType', 'status', 'date', 'time', 'duration', 'meetingLink', 'participants', 'clientId', 'leadId', 'projectId'];
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      meeting[field] = updateData[field];
    }
  });

  // Track reschedule changes
  const isRescheduled = oldDate.toISOString() !== new Date(meeting.date).toISOString() || oldTime !== meeting.time;
  if (isRescheduled) {
    meeting.status = 'rescheduled';
    meeting.history.push({
      action: 'rescheduled',
      performedBy: userId,
      details: `Meeting rescheduled from ${oldDate.toLocaleDateString()} at ${oldTime} to ${new Date(meeting.date).toLocaleDateString()} at ${meeting.time}`
    });
  } else {
    meeting.history.push({
      action: 'updated',
      performedBy: userId,
      details: 'Meeting details updated'
    });
  }

  const savedMeeting = await meeting.save();

  // Notify participants of reschedule or changes
  const newParticipants = meeting.participants.map(p => p.toString());
  const allParticipants = [...new Set([...oldParticipants, ...newParticipants])];

  for (const participantId of allParticipants) {
    if (participantId.toString() === userId.toString()) continue;
    
    let title = 'Meeting Updated';
    let message = `Meeting "${savedMeeting.title}" has been updated.`;

    if (isRescheduled) {
      title = 'Meeting Rescheduled';
      message = `Meeting "${savedMeeting.title}" has been rescheduled to ${new Date(savedMeeting.date).toLocaleDateString()} at ${savedMeeting.time}.`;
    }

    await createMeetingNotification(participantId, 'meeting_rescheduled', title, message, savedMeeting._id);
  }

  return await getMeetingById(savedMeeting._id, companyId, 'supreme_super_admin', userId);
};

/**
 * Delete meeting
 * Notes, attachments, and follow-ups are embedded in the meeting document,
 * so deleting the meeting removes them too — no separate cleanup needed.
 */
const deleteMeeting = async (meetingId, companyId) => {
  const meeting = await Meeting.findOneAndDelete({ _id: meetingId, companyId });
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  return meeting;
};

/**
 * Update Meeting Status
 */
const updateMeetingStatus = async (meetingId, status, companyId, userId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, companyId });
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  meeting.status = status;
  meeting.history.push({
    action: `status_changed_${status}`,
    performedBy: userId,
    details: `Meeting status changed to: ${status}`
  });

  const savedMeeting = await meeting.save();

  // Notify participants of status change
  if (['cancelled', 'completed'].includes(status)) {
    const notifyType = status === 'cancelled' ? 'meeting_cancelled' : 'meeting_reminder';
    const notifyTitle = status === 'cancelled' ? 'Meeting Cancelled' : 'Meeting Completed';
    const notifyMsg = status === 'cancelled' 
      ? `Meeting "${savedMeeting.title}" has been cancelled.`
      : `Meeting "${savedMeeting.title}" is now completed. Notes and follow-ups are available.`;

    for (const participantId of savedMeeting.participants) {
      if (participantId.toString() === userId.toString()) continue;
      await createMeetingNotification(participantId, notifyType, notifyTitle, notifyMsg, savedMeeting._id);
    }
  }

  return savedMeeting;
};

/**
 * Add note to meeting
 */
const addMeetingNote = async (meetingId, noteData, companyId, userId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, companyId });
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  meeting.notes.push({
    content: noteData.content,
    createdBy: userId
  });

  meeting.history.push({
    action: 'note_added',
    performedBy: userId,
    details: `Added note: "${noteData.content.substring(0, 30)}..."`
  });

  await meeting.save();

  const note = meeting.notes[meeting.notes.length - 1];
  await meeting.populate('notes.createdBy', 'name email role');
  return meeting.notes.id(note._id);
};

/**
 * Edit an existing note on a meeting
 */
const updateMeetingNote = async (meetingId, noteId, noteData, companyId, userId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, companyId });
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  const note = meeting.notes.id(noteId);
  if (!note) {
    throw new Error('Note not found');
  }

  note.content = noteData.content;

  meeting.history.push({
    action: 'note_updated',
    performedBy: userId,
    details: `Edited note: "${noteData.content.substring(0, 30)}..."`
  });

  await meeting.save();
  await meeting.populate('notes.createdBy', 'name email role');
  return meeting.notes.id(noteId);
};

/**
 * Delete a note from a meeting
 */
const deleteMeetingNote = async (meetingId, noteId, companyId, userId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, companyId });
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  const note = meeting.notes.id(noteId);
  if (!note) {
    throw new Error('Note not found');
  }

  note.deleteOne();

  meeting.history.push({
    action: 'note_deleted',
    performedBy: userId,
    details: 'Deleted a meeting note'
  });

  await meeting.save();
  return meeting;
};

/**
 * Add attachment to meeting
 */
const addMeetingAttachment = async (meetingId, attachmentData, companyId, userId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, companyId });
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  meeting.attachments.push({
    url: attachmentData.url,
    fileName: attachmentData.fileName,
    fileType: attachmentData.fileType,
    uploadedBy: userId
  });

  meeting.history.push({
    action: 'attachment_added',
    performedBy: userId,
    details: `Added attachment: "${attachmentData.fileName}"`
  });

  await meeting.save();

  const attachment = meeting.attachments[meeting.attachments.length - 1];
  await meeting.populate('attachments.uploadedBy', 'name email role');
  return meeting.attachments.id(attachment._id);
};

/**
 * Remove an attachment from a meeting
 */
const removeMeetingAttachment = async (meetingId, attachmentId, companyId, userId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, companyId });
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  const attachment = meeting.attachments.id(attachmentId);
  if (!attachment) {
    throw new Error('Attachment not found');
  }

  const fileName = attachment.fileName;
  attachment.deleteOne();

  meeting.history.push({
    action: 'attachment_removed',
    performedBy: userId,
    details: `Removed attachment: "${fileName}"`
  });

  await meeting.save();
  return meeting;
};

/**
 * Create a follow-up action and optionally generate a task
 */
const createFollowUp = async (meetingId, followUpData, companyId, userId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, companyId });
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  let linkedTaskId = null;

  // Optionally create a task in the Task Management module
  if (followUpData.createTask) {
    const taskPayload = {
      title: `[Follow-Up] ${followUpData.description}`,
      description: `Follow-up from meeting "${meeting.title}"\n\nNotes: ${meeting.agenda || ''}`,
      department: followUpData.department || 'digital-marketing',
      priority: followUpData.priority || 'medium',
      assignedTo: followUpData.assignedTo,
      assignedBy: userId,
      startDate: new Date(),
      dueDate: new Date(followUpData.dueDate),
      projectId: meeting.projectId || undefined,
      companyId: meeting.clientId || undefined,
      tenantCompanyId: companyId
    };

    try {
      const createdTask = await taskService.createTask(taskPayload, companyId, userId);
      if (createdTask && createdTask._id) {
        linkedTaskId = createdTask._id;
      }
    } catch (err) {
      console.error("Failed to automatically create linked task:", err);
    }
  }

  meeting.followUps.push({
    description: followUpData.description,
    assignedTo: followUpData.assignedTo,
    dueDate: new Date(followUpData.dueDate),
    taskId: linkedTaskId
  });

  meeting.history.push({
    action: 'followup_created',
    performedBy: userId,
    details: `Created follow-up item: "${followUpData.description}"`
  });

  await meeting.save();

  const followUp = meeting.followUps[meeting.followUps.length - 1];

  // Notify the assigned follow-up owner
  await createMeetingNotification(
    followUpData.assignedTo,
    'meeting_followup_pending',
    'New Follow-Up Action Item',
    `You have been assigned a follow-up: "${followUpData.description}" due by ${new Date(followUpData.dueDate).toLocaleDateString()}`,
    meeting._id
  );

  await meeting.populate([
    { path: 'followUps.assignedTo', select: 'name email role' },
    { path: 'followUps.taskId', select: 'title status dueDate' }
  ]);

  return meeting.followUps.id(followUp._id);
};

/**
 * Update a follow-up's editable fields
 */
const updateFollowUp = async (meetingId, followUpId, followUpData, companyId, userId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, companyId });
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  const followUp = meeting.followUps.id(followUpId);
  if (!followUp) {
    throw new Error('Follow-up not found');
  }

  const allowedFields = ['description', 'assignedTo', 'dueDate', 'status'];
  allowedFields.forEach(field => {
    if (followUpData[field] !== undefined) {
      followUp[field] = field === 'dueDate' ? new Date(followUpData[field]) : followUpData[field];
    }
  });

  meeting.history.push({
    action: 'followup_updated',
    performedBy: userId,
    details: `Updated follow-up item: "${followUp.description}"`
  });

  await meeting.save();
  await meeting.populate([
    { path: 'followUps.assignedTo', select: 'name email role' },
    { path: 'followUps.taskId', select: 'title status dueDate' }
  ]);

  return meeting.followUps.id(followUpId);
};

/**
 * Mark a follow-up as completed
 */
const completeFollowUp = async (meetingId, followUpId, companyId, userId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, companyId });
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  const followUp = meeting.followUps.id(followUpId);
  if (!followUp) {
    throw new Error('Follow-up not found');
  }

  followUp.status = 'completed';

  meeting.history.push({
    action: 'followup_completed',
    performedBy: userId,
    details: `Completed follow-up item: "${followUp.description}"`
  });

  await meeting.save();
  await meeting.populate([
    { path: 'followUps.assignedTo', select: 'name email role' },
    { path: 'followUps.taskId', select: 'title status dueDate' }
  ]);

  return meeting.followUps.id(followUpId);
};

/**
 * Delete a follow-up from a meeting
 */
const deleteFollowUp = async (meetingId, followUpId, companyId, userId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, companyId });
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  const followUp = meeting.followUps.id(followUpId);
  if (!followUp) {
    throw new Error('Follow-up not found');
  }

  const description = followUp.description;
  followUp.deleteOne();

  meeting.history.push({
    action: 'followup_deleted',
    performedBy: userId,
    details: `Deleted follow-up item: "${description}"`
  });

  await meeting.save();
  return meeting;
};

/**
 * Get meeting analytics & KPIs
 */
const getMeetingAnalytics = async (companyId, userRole, userId) => {
  const baseFilter = buildScopingFilter(userRole, userId, companyId);
  const total = await Meeting.countDocuments(baseFilter);

  // Group by status
  const statuses = ['upcoming', 'awaiting_confirmation', 'completed', 'cancelled', 'rescheduled', 'missed'];
  const statusStats = {};
  for (const status of statuses) {
    statusStats[status] = await Meeting.countDocuments({ ...baseFilter, status });
  }

  // Group by meeting type
  const types = ['client_review', 'internal_meeting', 'prospect_meeting', 'campaign_planning', 'seo_review', 'content_review', 'sales_call', 'retainer_renewal', 'business_review', 'team_review', 'other'];
  const typeStats = {};
  for (const type of types) {
    typeStats[type] = await Meeting.countDocuments({ ...baseFilter, meetingType: type });
  }

  // Calculate follow-up completion rate from embedded followUps arrays
  const followUpStats = await Meeting.aggregate([
    { $match: baseFilter },
    { $unwind: { path: '$followUps', preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$followUps.status', 'completed'] }, 1, 0] } }
      }
    }
  ]);

  const totalFollowUps = followUpStats[0]?.total || 0;
  const completedFollowUps = followUpStats[0]?.completed || 0;
  const followUpCompletionRate = totalFollowUps > 0 ? Math.round((completedFollowUps / totalFollowUps) * 100) : 100;

  // Client-wise meeting breakdown
  const clientBreakdown = await Meeting.aggregate([
    { $match: baseFilter },
    { $match: { clientId: { $ne: null } } },
    { $group: { _id: '$clientId', count: { $sum: 1 } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'clientInfo' } },
    { $unwind: '$clientInfo' },
    { $project: { clientName: '$clientInfo.companyName', count: 1 } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // Employee-wise meeting breakdown (as hosts)
  const employeeBreakdown = await Meeting.aggregate([
    { $match: baseFilter },
    { $group: { _id: '$host', count: { $sum: 1 } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
    { $unwind: '$userInfo' },
    { $project: { name: '$userInfo.name', email: '$userInfo.email', count: 1 } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  return {
    total,
    statusStats,
    typeStats,
    followUpCompletionRate,
    clientBreakdown,
    employeeBreakdown
  };
};

module.exports = {
  createMeeting,
  getAllMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  updateMeetingStatus,
  addMeetingNote,
  updateMeetingNote,
  deleteMeetingNote,
  addMeetingAttachment,
  removeMeetingAttachment,
  createFollowUp,
  updateFollowUp,
  completeFollowUp,
  deleteFollowUp,
  getMeetingAnalytics
};