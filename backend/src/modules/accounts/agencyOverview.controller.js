const agencyDashboardService = require('./agencyDashboard.service');

exports.getOverviewData = async (req, res, next) => {
  try {
    const agencyId = req.user.role === 'agency_super_admin' ? req.user._id : req.user.agencyId;
    if (!agencyId && !req.user.subAgencyId) {
      return res.status(400).json({ success: false, message: 'Agency context not found' });
    }

    const { month, year, clientId } = req.query;

    let data = {};
    if (['sub_agency_super_admin', 'sub_agency_user'].includes(req.user.role)) {
      // Create a specific dashboard for Sub Agency or reuse ops dashboard restricted by subAgencyId
      // For now, get operations dashboard but it needs to be filtered by subAgencyId inside the service.
      // Wait, let's just pass subAgencyId to getAgencyOperationsDashboard.
      data = await agencyDashboardService.getAgencyOperationsDashboard(agencyId, month, year, clientId, req.user.subAgencyId);
    } else if (req.user.role === 'agency_super_admin') {
      data = await agencyDashboardService.getAgencyExecutiveDashboard(agencyId, month, year, clientId);
    } else {
      data = await agencyDashboardService.getAgencyOperationsDashboard(agencyId, month, year, clientId);
    }

    res.status(200).json({
      success: true,
      data: {
        ...data,
        filters: {
          month: month ? parseInt(month) : new Date().getMonth(),
          year: year ? parseInt(year) : new Date().getFullYear(),
          clientId: clientId || null
        }
      }
    });
  } catch (error) {
    console.error('Error fetching agency overview:', error);
    next(error);
  }
};
