const mongoose = require('mongoose');
const monthlyHighlightsService = require('./monthlyHighlights.service');

const isClientUserRole = (role) => ['client', 'client_user', 'agency_client', 'brand_super_admin', 'brand_manager'].includes(role);

const sanitizeObjectId = (val) => {
    if (!val || val === 'all' || val === '[object Object]') return null;
    const strVal = typeof val === 'object' && val._id ? String(val._id) : String(val);
    return mongoose.Types.ObjectId.isValid(strVal) ? strVal : null;
};

exports.getMonthlyHighlights = async (req, res, next) => {
    try {
        const { clientId, month, year, refresh, projectId } = req.query;
        const isClientUser = isClientUserRole(req.user.role);
        const cleanClientId = sanitizeObjectId(clientId);
        const cleanProjectId = sanitizeObjectId(projectId);
        const targetClientId = isClientUser ? req.user._id : (cleanClientId || req.user._id);
        const selectedMonth = parseInt(month, 10) || (new Date().getMonth() + 1);
        const selectedYear = parseInt(year, 10) || new Date().getFullYear();
        const forceRefresh = refresh === 'true' || refresh === true;

        const data = await monthlyHighlightsService.getMonthlyHighlights(
            targetClientId,
            selectedMonth,
            selectedYear,
            isClientUser,
            forceRefresh,
            cleanProjectId
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
        const isClientUser = isClientUserRole(req.user.role);
        const cleanClientId = sanitizeObjectId(clientId);
        const targetClientId = isClientUser ? req.user._id : (cleanClientId || req.user._id);
        const reports = await monthlyHighlightsService.getClientReportsList(targetClientId);

        res.status(200).json({ status: 'success', data: reports });
    } catch (error) {
        next(error);
    }
};
