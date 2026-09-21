const reportService = require('./report.service');

exports.createSchedule = async (req, res, next) => {
    try {
        const agencyId = req.user.agencyId || req.user._id;
        const scheduleData = { ...req.body, agencyId, createdBy: req.user._id };
        const schedule = await reportService.createSchedule(scheduleData);
        res.status(201).json({ status: 'success', data: schedule });
    } catch (error) {
        next(error);
    }
};

exports.getSchedules = async (req, res, next) => {
    try {
        const agencyId = req.user.agencyId || req.user._id;
        const schedules = await reportService.getSchedules(agencyId, req.user);
        res.status(200).json({ status: 'success', data: schedules });
    } catch (error) {
        next(error);
    }
};

exports.updateScheduleStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const agencyId = req.user.agencyId || req.user._id;
        const schedule = await reportService.updateScheduleStatus(id, status, agencyId);
        res.status(200).json({ status: 'success', data: schedule });
    } catch (error) {
        next(error);
    }
};

exports.deleteSchedule = async (req, res, next) => {
    try {
        const { id } = req.params;
        const agencyId = req.user.agencyId || req.user._id;
        await reportService.deleteSchedule(id, agencyId);
        res.status(200).json({ status: 'success', message: 'Schedule deleted' });
    } catch (error) {
        next(error);
    }
};

exports.getRecentSentReports = async (req, res, next) => {
    try {
        const agencyId = req.user.agencyId || req.user._id;
        const reports = await reportService.getRecentSentReports(agencyId, req.user);
        res.status(200).json({ status: 'success', data: reports });
    } catch (error) {
        next(error);
    }
};

exports.getAnalytics = async (req, res, next) => {
    try {
        const agencyId = req.user.agencyId || req.user._id;
        const analytics = await reportService.getReportAnalytics(agencyId, req.user);
        res.status(200).json({ status: 'success', data: analytics });
    } catch (error) {
        next(error);
    }
};

exports.generateReport = async (req, res, next) => {
    try {
        const agencyId = req.user.agencyId || req.user._id;
        const { clientId, template, recipients, deliveryMethod } = req.body;
        
        const report = await reportService.generateAndSendReport(
            agencyId, 
            clientId, 
            template, 
            null, 
            recipients, 
            deliveryMethod, 
            req.user._id
        );

        // Dispatch system notification
        const { dispatchSystemNotification } = require('../tasks/notification.service');
        if (agencyId) {
            await dispatchSystemNotification(
                agencyId,
                'reportDownloaded',
                'report_downloaded',
                'Report Generated',
                `A new report has been generated and sent via ${deliveryMethod}.`,
                { clientId, template }
            );
        }
        
        res.status(200).json({ status: 'success', data: report });
    } catch (error) {
        next(error);
    }
};

exports.getMetaLeadCampaigns = async (req, res, next) => {
    try {
        const { clientId } = req.query;
        const targetId = clientId || req.user.agencyId || req.user._id;
        const data = await reportService.getMetaLeadCampaigns(targetId);
        res.status(200).json({ status: 'success', data });
    } catch (error) {
        next(error);
    }
};

exports.getMetaReachCampaigns = async (req, res, next) => {
    try {
        const { clientId } = req.query;
        const targetId = clientId || req.user.agencyId || req.user._id;
        const data = await reportService.getMetaReachCampaigns(targetId);
        res.status(200).json({ status: 'success', data });
    } catch (error) {
        next(error);
    }
};

