const User = require('../auth/user.model');
const Task = require('../tasks/task.model');
const Project = require('../projects/project.model');
const SlaRecord = require('../sla/sla.model');
const Invoice = require('../invoices/invoice.model');
const { MosScoreHistory } = require('../mos/mos.model');
const Proposal = require('../proposals/proposal.model');

exports.getAgencyExecutiveDashboard = async (agencyId, queryMonth, queryYear, queryClientId) => {
  const now = (queryMonth && queryYear) ? new Date(parseInt(queryYear), parseInt(queryMonth), 15) : new Date();
  
  // 1. Clients
  let clientQuery = { agencyId, role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client'] } };
  if (queryClientId) clientQuery._id = queryClientId;
  const clientsData = await User.find(clientQuery).select('_id companyName name mrr');
  const clientIds = clientsData.map(c => c._id);

  // 2. Team Members
  const teamData = await User.find({ agencyId, role: { $in: ['agency_manager', 'user'] } }).select('_id name');

  // 3. Projects
  let projectQuery = { companyId: { $in: [agencyId, ...clientIds] } };
  if (queryClientId) projectQuery.clientId = queryClientId;
  const allProjects = await Project.find(projectQuery);
  const activeProjectsCount = allProjects.filter(p => p.status !== 'completed').length;

  // 4. Invoices (Collected Revenue & Outstanding)
  let invoiceQuery = { agencyId, isDeleted: false };
  if (queryClientId) invoiceQuery.clientId = queryClientId;
  const invoices = await Invoice.find(invoiceQuery);
  
  let currentMonthRevenue = 0;
  let outstandingInvoicesAmount = 0;
  let outstandingInvoicesCount = 0;
  
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const chartDataMap = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    chartDataMap[key] = {
      name: monthNames[d.getMonth()],
      revenue: 0,
      sortOrder: d.getTime()
    };
  }

  invoices.forEach(inv => {
    const amount = inv.grandTotal || 0;
    const paid = inv.totalPaid || 0;
    const pending = inv.pendingAmount || amount;

    if (inv.createdAt) {
      const d = new Date(inv.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (chartDataMap[key]) {
        chartDataMap[key].revenue += paid;
      }
      
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
         currentMonthRevenue += paid;
      }
    }
    
    if (inv.paymentStatus !== 'Paid') {
        outstandingInvoicesAmount += pending;
        outstandingInvoicesCount++;
    }
  });

  const revenueChartData = Object.values(chartDataMap).sort((a, b) => a.sortOrder - b.sortOrder);

  // 5. Client Health (MOS) & Client MRR (from Proposals)
  const mosHistories = await MosScoreHistory.find({ agencyId, clientId: { $in: clientIds } }).sort({ createdAt: -1 });
  const latestMosByClient = {};
  mosHistories.forEach(hist => {
    const cid = hist.clientId.toString();
    if (!latestMosByClient[cid]) {
      latestMosByClient[cid] = hist;
    }
  });

  const proposals = await Proposal.find({ clientId: { $in: clientIds }, isDeleted: false });
  const proposalMrrByClient = {};
  proposals.forEach(prop => {
    const cid = prop.clientId.toString();
    if (!proposalMrrByClient[cid]) proposalMrrByClient[cid] = 0;
    proposalMrrByClient[cid] += prop.grandTotal || 0;
  });

  const clients = clientsData.map(c => {
    const cidStr = c._id.toString();
    const hist = latestMosByClient[cidStr];
    const mos = hist && hist.overallMos ? hist.overallMos : null;
    
    // Client MRR from Proposals
    let mrr = proposalMrrByClient[cidStr] || 0;
    
    const clientProjects = allProjects.filter(p => p.clientId && p.clientId.toString() === cidStr && p.status !== 'completed');

    return {
      id: c._id,
      name: c.companyName || c.name || 'Unnamed Client',
      code: (c.companyName || c.name || 'Un').substring(0, 2).toUpperCase(),
      mos,
      mrr,
      activeProjects: clientProjects.length,
      status: mos === null ? 'no data' : (mos >= 80 ? 'healthy' : (mos >= 70 ? 'renewal' : 'at risk'))
    };
  }).sort((a, b) => (b.mos || 0) - (a.mos || 0));

  const atRiskClients = clients.filter(c => c.mos !== null && c.mos < 70).length;

  // 6. Team Performance (Task Completion Rate)
  let teamTaskMatch = { assignedTo: { $in: teamData.map(t => t._id) }, tenantCompanyId: { $in: [agencyId, ...clientIds] } };
  if (queryClientId) {
    const allTasks = await Task.find({ tenantCompanyId: { $in: [agencyId, ...clientIds] }, companyId: queryClientId }, '_id');
    teamTaskMatch._id = { $in: allTasks.map(t => t._id) };
  }
  
  const teamTasks = await Task.aggregate([
    { $match: teamTaskMatch },
    { $group: { 
        _id: '$assignedTo', 
        total: { $sum: 1 }, 
        completed: { $sum: { $cond: [{ $in: [{ $toLower: '$status' }, ['done', 'complete', 'completed']] }, 1, 0] } } 
    } }
  ]);

  const team = teamData.map(t => {
    const taskObj = teamTasks.find(tk => tk._id.toString() === t._id.toString());
    const tasksAssigned = taskObj ? taskObj.total : 0;
    const tasksCompleted = taskObj ? taskObj.completed : 0;
    const completionRate = tasksAssigned > 0 ? Math.round((tasksCompleted / tasksAssigned) * 100) : 0;
    const initials = (t.name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    return {
      id: t._id,
      name: t.name,
      initials,
      tasksAssigned,
      tasksCompleted,
      completionRate,
      status: completionRate >= 80 ? 'good' : (completionRate >= 50 ? 'warning' : 'danger')
    };
  }).sort((a, b) => b.completionRate - a.completionRate);

  return {
    stats: {
      activeClients: clientsData.length,
      activeProjects: activeProjectsCount,
      atRiskClients,
      outstandingInvoicesAmount,
      outstandingInvoicesCount,
      currentMonthRevenue,
    },
    revenueChartData,
    clients,
    team
  };
};

exports.getAgencyOperationsDashboard = async (agencyId, queryMonth, queryYear, queryClientId) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  // Get all client IDs under this agency to query their tasks and projects
  const clientsData = await User.find({ agencyId, role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client', 'client'] } }).select('_id companyName name');
  const clientIds = clientsData.map(c => c._id);
  const clients = clientsData.map(c => ({
    id: c._id,
    name: c.companyName || c.name || 'Unnamed Client'
  }));
  
  // Tasks Due Today & Overdue
  let taskQuery = { tenantCompanyId: { $in: [agencyId, ...clientIds] }, status: { $nin: ['done', 'complete', 'completed'] } };
  if (queryClientId) taskQuery.companyId = queryClientId;
  
  const activeTasks = await Task.find(taskQuery).populate('assignedTo', 'name').populate('companyId', 'companyName');
  
  const tasksDueToday = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) >= startOfDay && new Date(t.dueDate) <= endOfDay);
  const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < startOfDay);
  const pendingApprovals = activeTasks.filter(t => ['review', 'in_review', 'sent_for_client_review'].includes(t.status?.toLowerCase()));

  // SLAs
  let slaQuery = { agencyId, status: { $ne: 'Resolved' } };
  if (queryClientId) slaQuery.clientId = queryClientId;
  const openSlas = await SlaRecord.find(slaQuery).populate('clientId', 'companyName');
  const atRiskSlas = openSlas.filter(s => s.status === 'Breached' || s.priority === 'Critical' || s.priority === 'Urgent');

  // Active Projects
  let projectQuery = { companyId: { $in: [agencyId, ...clientIds] }, status: { $ne: 'completed' } };
  if (queryClientId) projectQuery.clientId = queryClientId;
  const activeProjects = await Project.find(projectQuery).populate('clientId', 'companyName').sort({ endDate: 1 });

  return {
    stats: {
      tasksDueTodayCount: tasksDueToday.length,
      overdueTasksCount: overdueTasks.length,
      atRiskSlasCount: atRiskSlas.length,
      pendingApprovalsCount: pendingApprovals.length,
      activeProjectsCount: activeProjects.length
    },
    actionItems: {
      tasksDueToday: tasksDueToday.slice(0, 5),
      overdueTasks: overdueTasks.slice(0, 5),
      atRiskSlas: atRiskSlas.slice(0, 5),
      pendingApprovals: pendingApprovals.slice(0, 5)
    },
    upcomingDeadlines: activeProjects.filter(p => p.endDate).slice(0, 5),
    clients
  };
};
