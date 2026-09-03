const User = require('../auth/user.model');
const Lead = require('../leads/lead.model');
const PerformanceAd = require('../performanceAds/performanceAds.model');
const SlaRecord = require('../sla/sla.model');
const Task = require('../tasks/task.model');
const Invoice = require('../invoices/invoice.model');
const Expense = require('../expenses/expense.model');
const Project = require('../projects/project.model');
const { MosScoreHistory } = require('../mos/mos.model');

// Optional chaining helper to safely parse numbers
const parseNum = (val) => isNaN(parseFloat(val)) ? 0 : parseFloat(val);

exports.getAgencyPerformance = async (req, res, next) => {
  try {
    const agencyId = req.user.role === 'agency_super_admin' ? req.user._id : req.user.agencyId;

    if (!agencyId) {
      return res.status(400).json({ success: false, message: 'Agency context not found' });
    }

    const queryMonth = req.query.month;
    const queryYear = req.query.year;

    const now = (queryMonth && queryYear) ? new Date(parseInt(queryYear), parseInt(queryMonth), 15) : new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 1. Fetch all clients under this agency
    const clientsData = await User.find({ agencyId, role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client'] } }).select('_id companyName name isDirect createdAt');
    const clientIds = clientsData.map(c => c._id);
    const clientsOnboardedThisMonth = clientsData.filter(c => c.createdAt >= startOfMonth && c.createdAt <= endOfMonth).length;

    // 2. Fetch Team Members
    const teamData = await User.find({
      $or: [
        { agencyId },
        { companyId: agencyId },
        { adminId: agencyId }
      ],
      role: { $in: ['agency_manager', 'user', 'agency_super_admin'] }
    }).select('_id name role');

    // 3. Overall Stats
    // Leads
    const totalLeads = await Lead.countDocuments({ clientId: { $in: clientIds } });

    // ROAS
    const ads = await PerformanceAd.find({ clientId: { $in: clientIds } });
    let totalSpend = 0;
    let totalRevenue = 0;
    ads.forEach(ad => {
      totalSpend += parseNum(ad.spend);
      totalRevenue += parseNum(ad.revenue);
    });
    const blendedRoas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(1) : '0.0';

    // SLA Compliance
    const slas = await SlaRecord.find({ agencyId });
    const totalSlas = slas.length;
    const breachedSlas = slas.filter(s => s.status === 'Breached').length;
    const slaCompliance = totalSlas > 0 ? Math.round(((totalSlas - breachedSlas) / totalSlas) * 100) : 100;

    // Task Analytics
    const completedStatuses = ['completed', 'complete', 'validated', 'done', 'review'];
    const allTasks = await Task.find({
      $or: [
        { agencyId },
        { tenantCompanyId: agencyId },
        { companyId: agencyId }
      ]
    });
    const totalTasksThisMonth = allTasks.filter(t => t.createdAt >= startOfMonth && t.createdAt <= endOfMonth).length;
    const completedTasksThisMonth = allTasks.filter(t => completedStatuses.includes(t.status) && t.updatedAt >= startOfMonth && t.updatedAt <= endOfMonth).length;
    const pendingTasks = allTasks.filter(t => !completedStatuses.includes(t.status)).length;
    const overdueTasks = allTasks.filter(t => !completedStatuses.includes(t.status) && t.dueDate && new Date(t.dueDate) < now).length;
    const taskCompletionRate = totalTasksThisMonth > 0 ? Math.round((completedTasksThisMonth / totalTasksThisMonth) * 100) : 100;

    // Projects Analytics
    const allProjects = await Project.find({ agencyId });
    const completedProjects = allProjects.filter(p => p.status === 'completed').length;

    // Profit & Loss and Chart Data
    const invoices = await Invoice.find({ agencyId, isDeleted: false });
    // Expenses uses companyId. For agencies, companyId is typically the agencyId
    const expenses = await Expense.find({ companyId: agencyId });

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chartDataMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      chartDataMap[key] = {
        name: monthNames[d.getMonth()],
        revenue: 0,
        expenses: 0,
        clients: 0,
        sortOrder: d.getTime()
      };
    }

    invoices.forEach(inv => {
      if (inv.createdAt) {
        const d = new Date(inv.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (chartDataMap[key]) {
          chartDataMap[key].revenue += inv.totalPaid || 0;
        }
      }
    });

    expenses.forEach(exp => {
      if (exp.date) {
        const d = new Date(exp.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (chartDataMap[key]) {
          chartDataMap[key].expenses += exp.amount || 0;
        }
      }
    });

    clientsData.forEach(client => {
      if (client.createdAt) {
        const d = new Date(client.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (chartDataMap[key]) {
          chartDataMap[key].clients += 1;
        }
      }
    });

    let currentMonthRevenue = 0;
    let currentMonthExpenses = 0;
    let lastMonthRevenue = 0;
    let lastMonthExpenses = 0;

    const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${lastMonthDate.getMonth()}`;

    if (chartDataMap[currentKey]) {
      currentMonthRevenue = chartDataMap[currentKey].revenue;
      currentMonthExpenses = chartDataMap[currentKey].expenses;
    }
    if (chartDataMap[lastMonthKey]) {
      lastMonthRevenue = chartDataMap[lastMonthKey].revenue;
      lastMonthExpenses = chartDataMap[lastMonthKey].expenses;
    }

    const currentProfit = currentMonthRevenue - currentMonthExpenses;
    const lastProfit = lastMonthRevenue - lastMonthExpenses;
    const profitGrowth = lastProfit !== 0 ? (((currentProfit - lastProfit) / Math.abs(lastProfit)) * 100).toFixed(1) : (currentProfit > 0 ? 100 : 0);

    // Format profit text
    const profitFormatted = `₹${currentProfit.toLocaleString('en-IN')}`;

    const chartData = Object.values(chartDataMap).sort((a, b) => a.sortOrder - b.sortOrder);

    // Accumulate clients for growth chart
    let cumulativeClients = 0;
    chartData.forEach(point => {
      cumulativeClients += point.clients;
      point.totalClients = cumulativeClients;
    });

    // MOS Aggregation (Real data from MosScoreHistory)
    const mosHistories = await MosScoreHistory.find({ agencyId, clientId: { $in: clientIds } }).sort({ createdAt: -1 });

    // Group by clientId to get the latest score
    const latestMosByClient = {};
    mosHistories.forEach(hist => {
      const cid = hist.clientId.toString();
      if (!latestMosByClient[cid]) {
        latestMosByClient[cid] = hist;
      }
    });

    let totalMos = 0;
    const clients = clientsData.map(c => {
      const hist = latestMosByClient[c._id.toString()];
      const mos = hist && hist.overallMos ? hist.overallMos : 0;
      const signals = hist && hist.signals ? hist.signals : {
        website: 0, seo: 0, aeo: 0, geo: 0, social: 0, ads: 0, leads: 0, revenue: 0, cx: 0
      };

      totalMos += mos;
      const code = (c.companyName || c.name || 'Un').substring(0, 2).toUpperCase();
      return {
        id: c._id,
        code,
        name: c.companyName || c.name || 'Unnamed Client',
        mos: Math.round(mos),
        seo: Math.round(signals.seo || 0),
        aeo: Math.round(signals.aeo || 0),
        ads: Math.round(signals.ads || 0),
        leads: Math.round(signals.leads || 0),
        social: Math.round(signals.social || 0),
        web: Math.round(signals.website || 0),
        geo: Math.round(signals.geo || 0),
        rev: Math.round(signals.revenue || 0),
        cx: Math.round(signals.cx || 0),
      };
    }).sort((a, b) => b.mos - a.mos);

    const avgClientMos = clients.length > 0 ? Math.round(totalMos / clients.length) : 0;

    // 4. Team Performance
    const teamIds = teamData.map(t => t._id);

    const teamTasks = await Task.aggregate([
      { 
        $match: { 
          $or: [
            { assignedTo: { $in: teamIds } },
            { createdBy: { $in: teamIds } }
          ] 
        } 
      },
      { 
        $group: { 
          _id: '$assignedTo', 
          total: { $sum: 1 }, 
          completed: { 
            $sum: { 
              $cond: [{ $in: ['$status', completedStatuses] }, 1, 0] 
            } 
          } 
        } 
      }
    ]);

    const teamSlas = await SlaRecord.aggregate([
      { 
        $match: { 
          $or: [
            { assignedTo: { $in: teamIds } },
            { agencyId: { $in: teamIds } }
          ] 
        } 
      },
      { 
        $group: { 
          _id: '$assignedTo', 
          total: { $sum: 1 }, 
          breached: { $sum: { $cond: [{ $eq: ['$status', 'Breached'] }, 1, 0] } } 
        } 
      }
    ]);

    const team = teamData.map(t => {
      const taskObj = teamTasks.find(tk => tk._id && tk._id.toString() === t._id.toString());
      const tasksAssigned = taskObj ? taskObj.total : 0;
      const tasksCompleted = taskObj ? taskObj.completed : 0;

      const slaObj = teamSlas.find(sl => sl._id && sl._id.toString() === t._id.toString());
      let slaPerc = 0;
      if (slaObj && slaObj.total > 0) {
        slaPerc = Math.round(((slaObj.total - slaObj.breached) / slaObj.total) * 100);
      } else if (tasksAssigned > 0) {
        slaPerc = Math.round((tasksCompleted / tasksAssigned) * 100);
      } else {
        slaPerc = 0;
      }

      const initials = (t.name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

      return {
        id: t._id,
        name: t.name,
        initials,
        clients: 0,
        mos: avgClientMos,
        sla: `${slaPerc}%`,
        tasksAssigned,
        tasksCompleted,
        status: slaPerc >= 95 ? 'good' : (slaPerc >= 85 ? 'warning' : 'danger')
      };
    }).sort((a, b) => b.tasksCompleted - a.tasksCompleted);

    res.status(200).json({
      success: true,
      data: {
        stats: [
          { label: 'MONTHLY NET PROFIT', value: profitFormatted, sub: `${profitGrowth > 0 ? '+' : ''}${profitGrowth}% MoM`, color: profitGrowth >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)', trend: profitGrowth >= 0 ? 'up' : 'down' },
          { label: 'CLIENTS ONBOARDED', value: clientsOnboardedThisMonth.toString(), sub: 'This Month', color: 'var(--accent-primary)', trend: 'neutral' },
          { label: 'TASK COMPLETION', value: `${taskCompletionRate}%`, sub: `${completedTasksThisMonth}/${totalTasksThisMonth} Tasks`, color: taskCompletionRate >= 80 ? 'var(--accent-primary)' : 'var(--accent-warning)', trend: 'neutral' },
          { label: 'OVERDUE TASKS', value: overdueTasks.toString(), sub: `Of ${pendingTasks} Pending`, color: overdueTasks === 0 ? 'var(--accent-primary)' : 'var(--accent-danger)', trend: overdueTasks === 0 ? 'up' : 'down' },
        ],
        clients,
        team,
        chartData,
        projectStats: {
          total: allProjects.length,
          completed: completedProjects
        }
      }
    });

  } catch (error) {
    console.error('Error fetching agency performance:', error);
    next(error);
  }
};
