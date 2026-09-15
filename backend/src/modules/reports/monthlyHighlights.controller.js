const monthlyHighlightsService = require('./monthlyHighlights.service');

exports.getMonthlyHighlights = async (req, res, next) => {
    try {
        const { clientId, month, year, refresh } = req.query;
        const targetClientId = clientId || req.user._id;
        const selectedMonth = parseInt(month, 10) || (new Date().getMonth() + 1);
        const selectedYear = parseInt(year, 10) || new Date().getFullYear();
        const isClientUser = req.user.role === 'client' || req.user.role === 'client_user';
        const forceRefresh = refresh === 'true' || refresh === true;

        const data = await monthlyHighlightsService.getMonthlyHighlights(
            targetClientId,
            selectedMonth,
            selectedYear,
            isClientUser,
            forceRefresh
        );

        res.status(200).json({ status: 'success', data });
    } catch (error) {
        next(error);
    }
};

exports.upsertMonthlyHighlights = async (req, res, next) => {
    try {
        const agencyId = req.user.agencyId || req.user._id;
        const userId = req.user._id;
        const report = await monthlyHighlightsService.upsertMonthlyHighlights(agencyId, userId, req.body);
        
        res.status(200).json({ status: 'success', data: report });
    } catch (error) {
        next(error);
    }
};

exports.getClientReportsList = async (req, res, next) => {
    try {
        const { clientId } = req.query;
        const targetClientId = clientId || req.user._id;
        const reports = await monthlyHighlightsService.getClientReportsList(targetClientId);

        res.status(200).json({ status: 'success', data: reports });
    } catch (error) {
        next(error);
    }
};
