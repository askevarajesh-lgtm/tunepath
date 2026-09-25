const User = require('../auth/user.model');
const SlaRecord = require('../sla/sla.model');
const Task = require('../tasks/task.model');
const Department = require('../departments/department.model');

exports.getCommandCenterData = async (req, res, next) => {
  try {
    // 1. Build scoping filters
    let clientQuery = { 
      role: { $in: ['agency_super_admin', 'brand_super_admin'] }, 
      status: 'active' 
    };
    let allRelatedUserIds = [];

    if (req.user && req.user.role === 'commander_admin') {
      clientQuery.createdBy = req.user._id;
      
      // First, get all clients created by this commander
      const relatedClients = await User.find({ createdBy: req.user._id }, '_id');
      const clientIds = relatedClients.map(c => c._id);
      
      // Then, get all users that belong to those clients (agencies and brands)
      const relatedUsers = await User.find({ 
        $or: [
          { agencyId: { $in: clientIds } }, 
          { brandId: { $in: clientIds } },
          { _id: { $in: clientIds } }
        ] 
      }, '_id');
      
      allRelatedUserIds = relatedUsers.map(u => u._id);
      allRelatedUserIds.push(req.user._id);
    }

    // Active Clients (Agencies and direct Brands)
    const activeClientsDocs = await User.find(clientQuery);
    const activeClientsCount = activeClientsDocs.length;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // SLAs
    let slaQuery = {};
    if (req.user && req.user.role === 'commander_admin') {
      slaQuery = {
        $or: [
          { clientId: { $in: allRelatedUserIds } },
          { agencyId: { $in: allRelatedUserIds } },
          { assignedTo: { $in: allRelatedUserIds } }
        ]
      };
    }
    const slas = await SlaRecord.find(slaQuery).populate('clientId', 'name companyName');
    
    // SLA Compliance
    const totalSlas = slas.length;
    const resolvedSlas = slas.filter(s => s.status === 'Resolved').length;
    const slaCompliance = totalSlas > 0 ? Math.round((resolvedSlas / totalSlas) * 100) : 100;
    
    // Open Escalations
    const openEscalations = slas.filter(s => 
      ['Critical', 'Urgent'].includes(s.priority) && s.status !== 'Resolved'
    ).length;

    // Alerts & Escalations List
    const alertsData = slas
      .filter(s => s.status !== 'Resolved')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(s => {
        let type = 'warning';
        if (s.priority === 'Critical' || s.priority === 'Urgent') type = 'critical';
        return {
          id: s._id,
          type,
          client: s.clientId?.companyName || s.clientId?.name || 'Unknown',
          time: new Date(s.createdAt).toLocaleDateString(),
          desc: s.title || s.description,
          action: 'Resolve'
        };
      });

    // Execution Activity (Tasks last 30 days) - Move this up so we can use it for MOS calculation
    let taskQuery = { createdAt: { $gte: thirtyDaysAgo } };
    if (req.user && req.user.role === 'commander_admin') {
      taskQuery.tenantCompanyId = { $in: allRelatedUserIds };
    }
    
    // Phase 9: Optimize Commander Dashboard Task Data by pushing calculations to MongoDB
    const recentTasksAgg = await Task.aggregate([
      { $match: taskQuery },
      {
        $group: {
          _id: "$tenantCompanyId",
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: {
              $cond: [
                { $in: [{ $toLower: "$status" }, ['done', 'completed', 'complete']] }, 
                1, 
                0
              ]
            }
          }
        }
      }
    ]);
    
    const totalRecentTasks = recentTasksAgg.reduce((acc, curr) => acc + curr.totalTasks, 0);

    // Client MOS Leaderboard
    const topClients = activeClientsDocs.map(c => {
      const clientIdStr = c._id.toString();
      
      // SLA compliance for this client
      const clientSlas = slas.filter(s => 
        s.clientId?._id?.toString() === clientIdStr || 
        s.clientId?.toString() === clientIdStr ||
        s.agencyId?.toString() === clientIdStr
      );
      let slaScore = 100;
      if (clientSlas.length > 0) {
        const resolved = clientSlas.filter(s => s.status === 'Resolved').length;
        slaScore = Math.round((resolved / clientSlas.length) * 100);
      }

      // Task completion for this client
      const clientTaskStats = recentTasksAgg.find(t => t._id?.toString() === clientIdStr) || { totalTasks: 0, completedTasks: 0 };
      let taskScore = 100;
      if (clientTaskStats.totalTasks > 0) {
        taskScore = Math.round((clientTaskStats.completedTasks / clientTaskStats.totalTasks) * 100);
      }

      // Real MOS is average of SLA and Task completion
      const hasSla = clientSlas.length > 0;
      const hasTask = clientTaskStats.totalTasks > 0;
      
      let realMos = null; // Default to null if no data
      if (hasSla && hasTask) {
        realMos = Math.round((slaScore + taskScore) / 2);
      } else if (hasSla) {
        realMos = slaScore;
      } else if (hasTask) {
        realMos = taskScore;
      }

      let status = 'no data';
      if (realMos !== null) {
        status = realMos >= 80 ? 'healthy' : (realMos >= 70 ? 'renewal' : 'at risk');
      }

      return {
        id: (c.companyName || c.name || 'C').substring(0, 2).toUpperCase(),
        name: c.companyName || c.name || 'Client',
        industry: c.industry || 'Digital',
        mos: realMos,
        status
      };
    }).sort((a, b) => b.mos - a.mos).slice(0, 7);

    // Avg MOS Score
    const avgMosScore = topClients.length > 0 
      ? Math.round(topClients.reduce((acc, curr) => acc + curr.mos, 0) / topClients.length)
      : 100; // Fallback default

    // At-Risk Agencies (MOS < 70)
    const atRiskAgencies = topClients.filter(c => c.mos !== null && c.mos < 70).length;

    // Pipeline & Onboarding
    const pendingOnboarding = await User.countDocuments({ 
      role: { $in: ['commander_admin', 'agency_super_admin'] }, 
      status: 'trial'
    });

    const pipelineData = [
      { name: 'Active', value: activeClientsCount, fill: 'var(--accent-secondary)' },
      { name: 'Onboarding', value: pendingOnboarding, fill: '#f59e0b' },
      { name: 'Churned', value: await User.countDocuments({ role: { $in: ['commander_admin', 'agency_super_admin'] }, status: 'churned' }), fill: 'var(--accent-danger)' }
    ];

    // Activity counts (instead of misleading capacity)
    const agencyActivity = [
      { name: 'Tasks Logged', count: totalRecentTasks, icon: 'tasks' },
      { name: 'SLAs Created', count: slas.filter(s => s.createdAt >= thirtyDaysAgo).length, icon: 'slas' },
      { name: 'Agencies Active', count: activeClientsCount, icon: 'users' }
    ];

    const executionActivityData = [];

    res.status(200).json({
      success: true,
      data: {
        activeClients: activeClientsCount,
        newAgencies: activeClientsDocs.filter(c => c.createdAt >= thirtyDaysAgo).length,
        atRiskAgencies,
        avgMosScore: avgMosScore === 100 ? null : avgMosScore, // Don't default to 100 if no data
        slaCompliance,
        openEscalations,
        topClients,
        alertsData,
        executionActivityData,
        pipelineData,
        agencyActivity,
        pendingOnboarding
      }
    });

  } catch (error) {
    next(error);
  }
};