const mongoose = require('mongoose');
const Task = require('../tasks/task.model');
const Project = require('../projects/project.model');
const Invoice = require('../invoices/invoice.model');
const User = require('../auth/user.model');

const resolveClientScope = async (reqUser, clientId, companyId) => {
  const isAgencyClient = reqUser?.role === 'agency_client' || (reqUser?.isDirect === false && Boolean(reqUser?.agencyId));
  
  let effectiveClientId = null;
  if (reqUser?.role === 'agency_client') {
    effectiveClientId = reqUser._id;
  } else if (reqUser?.brandId) {
    effectiveClientId = reqUser.brandId;
  } else if (reqUser?.clientId) {
    effectiveClientId = reqUser.clientId;
  } else if (clientId) {
    effectiveClientId = clientId;
  } else if (companyId) {
    effectiveClientId = companyId;
  } else if (reqUser?._id) {
    effectiveClientId = reqUser._id;
  }

  // Find all team members belonging to this client/brand
  const relatedUsers = await User.find({
    $or: [
      { brandId: effectiveClientId },
      { clientId: effectiveClientId },
      { _id: effectiveClientId }
    ]
  }).select('_id name email role status isActive avatar').catch(() => []);

  const relatedUserIds = relatedUsers.map(u => u._id);

  const allClientIds = Array.from(new Set([
    effectiveClientId?.toString(),
    reqUser?._id?.toString(),
    ...relatedUserIds.map(id => id.toString())
  ].filter(Boolean))).map(id => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id));

  let taskFilter;
  let projectFilter;

  if (isAgencyClient) {
    // Agency Client flow: Strictly isolate to tasks associated with this specific client
    taskFilter = {
      $or: [
        { companyId: { $in: allClientIds } },
        { createdBy: { $in: allClientIds } },
        { assignedTo: { $in: allClientIds } },
        { watchers: { $in: allClientIds } }
      ]
    };

    projectFilter = {
      $or: [
        { clientId: { $in: allClientIds } },
        { companyId: { $in: allClientIds } }
      ]
    };
  } else {
    // Direct Brand flow: May match tenantCompanyId or companyId
    taskFilter = {
      $or: [
        { tenantCompanyId: { $in: allClientIds } },
        { companyId: { $in: allClientIds } },
        { createdBy: { $in: allClientIds } },
        { assignedTo: { $in: allClientIds } },
        { watchers: { $in: allClientIds } }
      ]
    };

    projectFilter = {
      $or: [
        { tenantCompanyId: { $in: allClientIds } },
        { clientId: { $in: allClientIds } },
        { companyId: { $in: allClientIds } }
      ]
    };
  }

  return {
    effectiveClientId,
    allClientIds,
    relatedUsers,
    taskFilter,
    projectFilter,
    isAgencyClient
  };
};

exports.getClientExecutiveDashboard = async (clientId, companyId, queryMonth, queryYear, reqUser = null) => {
  const hasMonthYear = queryMonth !== undefined && queryMonth !== null && queryMonth !== '' && queryYear !== undefined && queryYear !== null && queryYear !== '';
  const now = hasMonthYear ? new Date(parseInt(queryYear), parseInt(queryMonth), 15) : new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const { effectiveClientId, allClientIds, relatedUsers, taskFilter, projectFilter } = await resolveClientScope(reqUser, clientId, companyId);

  // Projects
  const allProjects = await Project.find(projectFilter).catch(() => []);
  const activeProjectsCount = allProjects.filter(p => p.status !== 'completed').length;
  const completedProjectsCount = allProjects.filter(p => p.status === 'completed').length;

  const pendingApprovalTasks = await Task.find({ 
    ...taskFilter,
    status: { $in: ['sent_for_client_review', 'review', 'in_review'] },
    clientReviewStatus: { $nin: ['approved', 'client_approved'] },
    clientApproved: { $ne: true },
    createdAt: { $lte: endOfMonth }
  })
    .select('title projectId priority dueDate status clientReviewStatus')
    .lean()
    .limit(5)
    .catch(() => []);

  const completedStatuses = ['done', 'complete', 'completed', 'validated', 'approved', 'approved_by_client', 'client_approved', 'closed'];

  const optimizedTaskFilter = {
    ...taskFilter,
    $or: [
      // all open tasks
      { status: { $nin: completedStatuses }, clientApproved: { $ne: true }, clientReviewStatus: { $nin: ['approved', 'client_approved'] }, clientApprovalStatus: { $nin: ['approved', 'client_approved'] }, validationStatus: { $ne: 'validated' } },
      // or tasks touched this month
      { createdAt: { $gte: startOfMonth, $lte: endOfMonth } },
      { dueDate: { $gte: startOfMonth, $lte: endOfMonth } },
      { workCompletedAt: { $gte: startOfMonth, $lte: endOfMonth } },
      { actualCompletionDate: { $gte: startOfMonth, $lte: endOfMonth } },
      { completedAt: { $gte: startOfMonth, $lte: endOfMonth } },
      { updatedAt: { $gte: startOfMonth, $lte: endOfMonth } }
    ]
  };

  // Tasks Execution Stats
  const allTasks = await Task.find(optimizedTaskFilter)
    .select('status clientReviewStatus clientApprovalStatus clientApproved validationStatus createdAt dueDate workCompletedAt actualCompletionDate completedAt updatedAt')
    .lean()
    .catch(() => []);



  const isTaskCompleted = (t) => {
    const status = (t.status || '').toString().trim().toLowerCase();
    const clientStatus = (t.clientReviewStatus || t.clientApprovalStatus || '').toString().trim().toLowerCase();
    const isClientApproved = t.clientApproved === true || clientStatus === 'approved' || clientStatus === 'client_approved';
    const isValidated = (t.validationStatus || '').toString().trim().toLowerCase() === 'validated';
    return completedStatuses.includes(status) || isClientApproved || isValidated;
  };

  const totalTasksThisMonth = allTasks.filter(t => {
    const created = t.createdAt ? new Date(t.createdAt) : null;
    const due = t.dueDate ? new Date(t.dueDate) : null;
    const completedDate = t.workCompletedAt || t.actualCompletionDate || t.completedAt || t.updatedAt;
    const completedInMonth = isTaskCompleted(t) &&
      completedDate && new Date(completedDate) >= startOfMonth && new Date(completedDate) <= endOfMonth;

    return (created && created >= startOfMonth && created <= endOfMonth) ||
           (due && due >= startOfMonth && due <= endOfMonth) ||
           completedInMonth;
  }).length;

  const completedTasksThisMonth = allTasks.filter(t => {
    if (!isTaskCompleted(t)) return false;
    const dateToUse = t.workCompletedAt || t.actualCompletionDate || t.completedAt || t.updatedAt || t.createdAt;
    const d = new Date(dateToUse);
    return d >= startOfMonth && d <= endOfMonth;
  }).length;

  // Workspace Team Members
  const teamMembers = relatedUsers || [];
  const activeTeamMembers = teamMembers.filter(u => u.status === 'active' || u.isActive !== false).length;

  const openTasksCount = allTasks.filter(t => !isTaskCompleted(t)).length;

  return {
    stats: {
      activeProjects: activeProjectsCount,
      completedProjects: completedProjectsCount,
      pendingApprovalsCount: pendingApprovalTasks.length,
      completedTasksThisMonth,
      totalTasksThisMonth,
      totalTeamMembers: teamMembers.length,
      activeTeamMembers,
      openTasksCount
    },
    pendingApprovals: pendingApprovalTasks,
    recentTeamMembers: teamMembers.slice(0, 5)
  };
};

exports.getClientOperationsDashboard = async (clientId, companyId, queryMonth, queryYear, reqUser = null) => {
  const hasMonthYear = queryMonth !== undefined && queryMonth !== null && queryMonth !== '' && queryYear !== undefined && queryYear !== null && queryYear !== '';
  const now = hasMonthYear ? new Date(parseInt(queryYear), parseInt(queryMonth), 15) : new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const { effectiveClientId, allClientIds, taskFilter } = await resolveClientScope(reqUser, clientId, companyId);

  const completedStatuses = ['done', 'complete', 'completed', 'validated', 'approved', 'approved_by_client', 'client_approved', 'closed'];

  const optimizedTaskFilter = {
    ...taskFilter,
    $or: [
      // all open tasks
      { status: { $nin: completedStatuses }, clientApproved: { $ne: true }, clientReviewStatus: { $nin: ['approved', 'client_approved'] }, clientApprovalStatus: { $nin: ['approved', 'client_approved'] }, validationStatus: { $ne: 'validated' } },
      // or tasks touched this month
      { createdAt: { $gte: startOfMonth, $lte: endOfMonth } },
      { dueDate: { $gte: startOfMonth, $lte: endOfMonth } },
      { workCompletedAt: { $gte: startOfMonth, $lte: endOfMonth } },
      { actualCompletionDate: { $gte: startOfMonth, $lte: endOfMonth } },
      { completedAt: { $gte: startOfMonth, $lte: endOfMonth } },
      { updatedAt: { $gte: startOfMonth, $lte: endOfMonth } }
    ]
  };

  // Tasks
  const allTasks = await Task.find(optimizedTaskFilter)
    .select('status clientReviewStatus clientApprovalStatus clientApproved validationStatus createdAt dueDate workCompletedAt actualCompletionDate completedAt updatedAt')
    .lean()
    .catch(() => []);


  const isTaskCompleted = (t) => {
    const status = (t.status || '').toString().trim().toLowerCase();
    const clientStatus = (t.clientReviewStatus || t.clientApprovalStatus || '').toString().trim().toLowerCase();
    const isClientApproved = t.clientApproved === true || clientStatus === 'approved' || clientStatus === 'client_approved';
    const isValidated = (t.validationStatus || '').toString().trim().toLowerCase() === 'validated';
    return completedStatuses.includes(status) || isClientApproved || isValidated;
  };

  // Filter tasks created on or before the end of the selected month
  const tasksUpToMonth = allTasks.filter(t => {
    const created = t.createdAt ? new Date(t.createdAt) : new Date();
    return created <= endOfMonth;
  });

  // Total tasks relevant to this month (either created, due, or completed within the month)
  const totalTasksThisMonth = allTasks.filter(t => {
    const created = t.createdAt ? new Date(t.createdAt) : null;
    const due = t.dueDate ? new Date(t.dueDate) : null;
    const completedDate = t.workCompletedAt || t.actualCompletionDate || t.completedAt || t.updatedAt;
    const completedInMonth = isTaskCompleted(t) &&
      completedDate && new Date(completedDate) >= startOfMonth && new Date(completedDate) <= endOfMonth;

    const inMonth = (created && created >= startOfMonth && created <= endOfMonth) ||
                    (due && due >= startOfMonth && due <= endOfMonth) ||
                    completedInMonth;
    return inMonth;
  }).length;

  // Completed tasks completed within this month
  const completedTasksThisMonth = allTasks.filter(t => {
    if (!isTaskCompleted(t)) return false;
    const dateToUse = t.workCompletedAt || t.actualCompletionDate || t.completedAt || t.updatedAt || t.createdAt;
    const d = new Date(dateToUse);
    return d >= startOfMonth && d <= endOfMonth;
  }).length;

  // Deliverables logic
  const actualDeliverables = tasksUpToMonth
    .filter(t => isTaskCompleted(t))
    .sort((a, b) => new Date(b.workCompletedAt || b.actualCompletionDate || b.updatedAt || b.createdAt || 0).getTime() - new Date(a.workCompletedAt || a.actualCompletionDate || a.updatedAt || a.createdAt || 0).getTime());
  
  const recentDeliverables = actualDeliverables.slice(0, 5);
  const deliverableIds = new Set(actualDeliverables.map(t => (t._id || '').toString()));
  
  // Open tasks up to this month (excluding any completed or deliverable tasks)
  const openTasks = tasksUpToMonth.filter(t => !isTaskCompleted(t) && !deliverableIds.has((t._id || '').toString()));
  
  // Overdue tasks cutoff (end of month for past months, or current time if current/future month)
  const cutoffDate = new Date() < endOfMonth ? new Date() : endOfMonth;
  const overdueTasks = openTasks.filter(t => t.dueDate && new Date(t.dueDate) < cutoffDate);
  
  const pendingDeliverableStatuses = ['todo', 'in_progress', 'in_review', 'review', 'sent_for_client_review', 'to_do', 'created', 'assigned'];
  const pendingDeliverables = tasksUpToMonth.filter(t => pendingDeliverableStatuses.includes((t.status || '').toString().trim().toLowerCase())).length;

  return {
    stats: {
      totalTasksThisMonth,
      completedTasksThisMonth,
      openTasksCount: openTasks.length,
      overdueTasksCount: overdueTasks.length,
      pendingDeliverables
    },
    recentDeliverables,
    actionItems: overdueTasks.slice(0, 5)
  };
};

