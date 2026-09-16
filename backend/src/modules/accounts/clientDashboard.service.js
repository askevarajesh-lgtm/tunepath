const Task = require('../tasks/task.model');
const Project = require('../projects/project.model');
const Invoice = require('../invoices/invoice.model');

exports.getClientExecutiveDashboard = async (clientId, companyId, queryMonth, queryYear) => {
  const hasMonthYear = queryMonth !== undefined && queryMonth !== null && queryMonth !== '' && queryYear !== undefined && queryYear !== null && queryYear !== '';
  const now = hasMonthYear ? new Date(parseInt(queryYear), parseInt(queryMonth), 15) : new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Projects
  const allProjects = await Project.find({ clientId: clientId });
  const activeProjectsCount = allProjects.filter(p => p.status !== 'completed').length;
  const completedProjectsCount = allProjects.filter(p => p.status === 'completed').length;
  
  // Invoices (Spend/ROI tracking up to selected month)
  const invoices = await Invoice.find({ clientId: clientId, isDeleted: false });
  const sentInvoices = invoices
    .filter(i => i.invoiceStatus !== 'Draft' && new Date(i.createdAt) <= endOfMonth)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const pendingInvoices = sentInvoices.filter(i => i.paymentStatus !== 'Paid');
  const latestPendingInvoice = pendingInvoices[0] || null;

  let outstandingAmount = 0;
  let paidAmountThisMonth = 0;
  let totalSpend = 0;

  sentInvoices.forEach(inv => {
    const pending = inv.pendingAmount || inv.grandTotal || 0;
    const paid = inv.totalPaid || 0;
    totalSpend += paid;

    if (inv.paymentStatus !== 'Paid') {
      outstandingAmount += pending;
    }
    
    if (inv.createdAt) {
      const d = new Date(inv.createdAt);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
         paidAmountThisMonth += paid;
      }
    }
  });

  // Approvals (Tasks waiting for review created on or before selected month)
  const pendingApprovalTasks = await Task.find({ 
    $or: [{ companyId: clientId }, { tenantCompanyId: clientId }, { companyId }], 
    status: { $in: ['sent_for_client_review', 'review', 'in_review'] },
    clientReviewStatus: { $nin: ['approved', 'client_approved'] },
    clientApproved: { $ne: true },
    createdAt: { $lte: endOfMonth }
  }).limit(5);

  return {
    stats: {
      activeProjects: activeProjectsCount,
      completedProjects: completedProjectsCount,
      totalInvoicesCount: sentInvoices.length,
      pendingInvoicesCount: pendingInvoices.length,
      outstandingAmount,
      paidAmountThisMonth,
      totalSpend
    },
    upcomingInvoice: latestPendingInvoice,
    pendingApprovals: pendingApprovalTasks,
    recentInvoices: sentInvoices.slice(0, 5)
  };
};

exports.getClientOperationsDashboard = async (clientId, companyId, queryMonth, queryYear, reqUser = null) => {
  const hasMonthYear = queryMonth !== undefined && queryMonth !== null && queryMonth !== '' && queryYear !== undefined && queryYear !== null && queryYear !== '';
  const now = hasMonthYear ? new Date(parseInt(queryYear), parseInt(queryMonth), 15) : new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const companyIdSet = new Set(
    [clientId, companyId, reqUser?.clientId, reqUser?.companyId, reqUser?.brandId, reqUser?.tenantCompanyId, reqUser?._id]
      .filter(Boolean)
      .map(id => id.toString())
  );
  const companyIdList = Array.from(companyIdSet);

  // Tasks
  const allTasks = await Task.find({ 
    $or: [
      { companyId: { $in: companyIdList } },
      { tenantCompanyId: { $in: companyIdList } }
    ]
  });

  const completedStatuses = ['done', 'complete', 'completed', 'validated', 'approved', 'approved_by_client', 'client_approved', 'closed'];

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
