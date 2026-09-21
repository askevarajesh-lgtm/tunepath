const clientDashboardService = require('./clientDashboard.service');

exports.getClientOverviewData = async (req, res, next) => {
  try {
    const isAgencyClient = req.user.role === 'agency_client' || (req.user.isDirect === false && req.user.agencyId);
    const effectiveClientId = req.user.role === 'agency_client' 
      ? req.user._id 
      : (req.user.brandId || req.user.clientId || req.user._id);
    const { month, year } = req.query;

    let data = {};
    if (req.user.role === 'brand_super_admin') {
      data = await clientDashboardService.getClientExecutiveDashboard(effectiveClientId, effectiveClientId, month, year, req.user);
    } else {
      data = await clientDashboardService.getClientOperationsDashboard(effectiveClientId, effectiveClientId, month, year, req.user);
    }

    res.status(200).json({
      success: true,
      data: {
        ...data,
        filters: {
          month: month ? parseInt(month) : new Date().getMonth(),
          year: year ? parseInt(year) : new Date().getFullYear()
        }
      }
    });
  } catch (error) {
    console.error('Error fetching client overview:', error);
    next(error);
  }
};

