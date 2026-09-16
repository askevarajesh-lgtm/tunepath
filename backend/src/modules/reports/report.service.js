const ReportSchedule = require('./reportSchedule.model');
const SentReport = require('./sentReport.model');
const User = require('../auth/user.model'); 

// Import other services to gather data if needed in future (e.g. mosService, analyticsService)

exports.createSchedule = async (scheduleData) => {
    const schedule = new ReportSchedule(scheduleData);
    await schedule.save();
    return schedule;
};

exports.getSchedules = async (agencyId) => {
    return await ReportSchedule.find({ agencyId })
        .populate('clientId', 'name companyName')
        .sort({ createdAt: -1 });
};

exports.updateScheduleStatus = async (scheduleId, status) => {
    return await ReportSchedule.findByIdAndUpdate(scheduleId, { status }, { returnDocument: 'after' });
};

exports.deleteSchedule = async (scheduleId) => {
    return await ReportSchedule.findByIdAndDelete(scheduleId);
};

exports.getRecentSentReports = async (agencyId) => {
    const MonthlyHighlights = require('./monthlyHighlights.model');

    const sentReports = await SentReport.find({})
        .populate('clientId', 'name companyName email')
        .sort({ sentAt: -1 })
        .limit(50)
        .lean();

    const monthlyReports = await MonthlyHighlights.find({ status: 'Published' })
        .populate('clientId', 'name companyName email')
        .sort({ publishedAt: -1, updatedAt: -1 })
        .limit(50)
        .lean();

    const existingKeys = new Set(sentReports.map(r => `${r.clientId?._id || r.clientId}_${r.name}`));

    monthlyReports.forEach(m => {
        const clientObj = m.clientId;
        const clientName = clientObj?.companyName || clientObj?.name || 'Client';
        const name = `${clientName} - Monthly Highlights (${m.month}/${m.year})`;
        const key = `${clientObj?._id || m.clientId}_${name}`;

        if (!existingKeys.has(key)) {
            sentReports.push({
                _id: m._id,
                agencyId: m.agencyId || agencyId,
                clientId: clientObj,
                name: name,
                template: 'Monthly Highlights',
                sentAt: m.publishedAt || m.updatedAt || m.createdAt,
                deliveredTo: clientObj?.email ? [clientObj.email] : ['Client Portal'],
                deliveryMethod: 'Email & Portal',
                status: 'Delivered',
                pages: 2,
                generatedBy: m.createdBy
            });
        }
    });

    sentReports.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));

    return sentReports.slice(0, 50);
};

exports.getReportAnalytics = async (agencyId) => {
    const reports = await SentReport.find({ agencyId });
    
    const totalReports = reports.length;
    let totalPages = 0;
    let openedReports = 0;
    
    reports.forEach(report => {
        totalPages += (report.pages || 0);
        if (report.status === 'Opened') openedReports++;
    });

    const avgOpenRate = totalReports > 0 ? Math.round((openedReports / totalReports) * 100) : 0;
    // Calculate a mock engagement score based on open rate and pages
    const engagementScore = totalReports > 0 ? Math.min(100, avgOpenRate + Math.floor(totalPages / totalReports)) : 0;

    return {
        totalReports,
        avgOpenRate,
        engagementScore,
        pagesGenerated: totalPages
    };
};

exports.getMetaLeadCampaigns = async (targetId) => {
    const PerformanceAd = require('../performanceAds/performanceAds.model');
    const mongoose = require('mongoose');

    let queryId = targetId;
    if (!queryId || !mongoose.Types.ObjectId.isValid(queryId)) {
        queryId = null;
    }

    let dashboard = null;
    if (queryId) {
        dashboard = await PerformanceAd.findOne({ agency: queryId }).lean();
        if (!dashboard) {
            dashboard = await PerformanceAd.findOne({ clientId: queryId }).lean();
        }
    }
    if (!dashboard) {
        dashboard = await PerformanceAd.findOne({}).sort({ updatedAt: -1 }).lean();
    }

    const rawCampaigns = dashboard?.activeCampaigns || [];

    const leadCampaigns = rawCampaigns
        .filter(c => {
            const isMeta = !c.platform || String(c.platform).toLowerCase().includes('meta') || String(c.platform).toLowerCase().includes('facebook');
            return isMeta;
        })
        .map(c => {
            const rawSpendNum = typeof c.spend === 'number' 
                ? c.spend 
                : parseFloat(String(c.spend || '0').replace(/[^0-9.]/g, '')) || 0;
            const leadsNum = parseInt(c.leads || 0, 10) || 0;
            let cplNum = 0;
            if (leadsNum > 0) {
                cplNum = parseFloat((rawSpendNum / leadsNum).toFixed(2));
            } else if (c.cpl) {
                cplNum = parseFloat(String(c.cpl).replace(/[^0-9.]/g, '')) || 0;
            }

            return {
                id: c.id || c._id,
                campaignName: c.campaign || c.name || 'Meta Lead Campaign',
                typeOfCampaign: 'Lead',
                amountSpent: `₹${rawSpendNum.toLocaleString('en-IN')}`,
                rawSpend: rawSpendNum,
                noOfLeads: leadsNum,
                cpl: `₹${cplNum.toLocaleString('en-IN')}`,
                rawCpl: cplNum,
                status: c.status || 'Active',
                adAccount: c.adAccount || 'Connected Meta Account'
            };
        });

    const totalSpent = leadCampaigns.reduce((acc, c) => acc + c.rawSpend, 0);
    const totalLeads = leadCampaigns.reduce((acc, c) => acc + c.noOfLeads, 0);
    const avgCpl = totalLeads > 0 ? (totalSpent / totalLeads).toFixed(2) : 0;

    return {
        campaigns: leadCampaigns,
        summary: {
            totalCampaigns: leadCampaigns.length,
            totalAmountSpent: `₹${totalSpent.toLocaleString('en-IN')}`,
            rawTotalAmountSpent: totalSpent,
            totalLeads: totalLeads,
            avgCpl: `₹${parseFloat(avgCpl).toLocaleString('en-IN')}`,
            rawAvgCpl: parseFloat(avgCpl)
        }
    };
};

exports.getMetaReachCampaigns = async (targetId) => {
    const PerformanceAd = require('../performanceAds/performanceAds.model');
    const mongoose = require('mongoose');

    let queryId = targetId;
    if (!queryId || !mongoose.Types.ObjectId.isValid(queryId)) {
        queryId = null;
    }

    let dashboard = null;
    if (queryId) {
        dashboard = await PerformanceAd.findOne({ agency: queryId }).lean();
        if (!dashboard) {
            dashboard = await PerformanceAd.findOne({ clientId: queryId }).lean();
        }
    }
    if (!dashboard) {
        dashboard = await PerformanceAd.findOne({}).sort({ updatedAt: -1 }).lean();
    }

    const rawCampaigns = dashboard?.activeCampaigns || [];

    const reachCampaigns = rawCampaigns
        .filter(c => {
            const isMeta = !c.platform || String(c.platform).toLowerCase().includes('meta') || String(c.platform).toLowerCase().includes('facebook');
            return isMeta;
        })
        .map(c => {
            const rawSpendNum = typeof c.spend === 'number' 
                ? c.spend 
                : parseFloat(String(c.spend || '0').replace(/[^0-9.]/g, '')) || 0;

            const insights = c.insights || {};
            const actions = Array.isArray(insights.actions) ? insights.actions : [];

            // Extract Views (Video views or play actions or impressions fallback)
            let viewsNum = parseInt(c.views || 0, 10) || 0;
            if (viewsNum === 0 && insights) {
                const videoAction = actions.find(a => 
                    a.action_type === 'video_view' || 
                    a.action_type === 'video_play' ||
                    a.action_type === 'video_p30_watched_actions'
                );
                if (videoAction) viewsNum = parseInt(videoAction.value || 0, 10);
                else if (insights.clicks) viewsNum = parseInt(insights.clicks || 0, 10);
                else if (insights.impressions) viewsNum = parseInt(insights.impressions || 0, 10);
            }

            // Extract Reach
            let reachNum = parseInt(c.reach || 0, 10) || 0;
            if (reachNum === 0 && insights.reach) {
                reachNum = parseInt(insights.reach || 0, 10);
            }

            // Extract Followers Gained (Page likes, page engagement, follows)
            let followersNum = parseInt(c.followersGained || c.followers || 0, 10) || 0;
            if (followersNum === 0 && actions.length > 0) {
                const followAction = actions.find(a => 
                    a.action_type === 'like' || 
                    a.action_type === 'page_like' || 
                    a.action_type === 'follow' || 
                    a.action_type === 'page_engagement'
                );
                if (followAction) followersNum = parseInt(followAction.value || 0, 10);
            }

            return {
                id: c.id || c._id,
                campaignName: c.campaign || c.name || 'Meta Reach Campaign',
                typeOfCampaign: 'Reach',
                amountSpent: `₹${rawSpendNum.toLocaleString('en-IN')}`,
                rawSpend: rawSpendNum,
                views: viewsNum,
                reach: reachNum,
                followersGained: followersNum,
                status: c.status || 'Active',
                adAccount: c.adAccount || 'Connected Meta Account'
            };
        });

    const totalSpentExclGst = reachCampaigns.reduce((acc, c) => acc + c.rawSpend, 0);
    const totalSpentInclGst = Math.round(totalSpentExclGst * 1.18 * 100) / 100;
    const totalViews = reachCampaigns.reduce((acc, c) => acc + c.views, 0);
    const totalReach = reachCampaigns.reduce((acc, c) => acc + c.reach, 0);
    const totalFollowersGained = reachCampaigns.reduce((acc, c) => acc + c.followersGained, 0);

    return {
        campaigns: reachCampaigns,
        summary: {
            totalCampaigns: reachCampaigns.length,
            totalAmountSpent: `₹${totalSpentExclGst.toLocaleString('en-IN')}`,
            rawTotalAmountSpent: totalSpentExclGst,
            totalAmountSpentInclGst: `₹${totalSpentInclGst.toLocaleString('en-IN')}`,
            rawTotalAmountSpentInclGst: totalSpentInclGst,
            totalViews: totalViews,
            totalReach: totalReach,
            totalFollowersGained: totalFollowersGained
        }
    };
};

// Generates a report (either manually triggered or via cron)
exports.generateAndSendReport = async (agencyId, clientId, template, scheduleId = null, recipients = [], deliveryMethod = 'Email', generatedBy = null) => {
    
    // 1. Fetch Client Details
    const client = await User.findById(clientId);
    if (!client) throw new Error('Client not found');

    // 2. Gather Data from connected modules
    const dummyPdfUrl = `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`;
    let pages = 1;
    if (template === 'MOS Score Report') pages = 12;
    else if (template === 'SEO & Web Analytics') pages = 7;
    else if (template === 'Lead Generation & Conversion' || template === 'Leads Performance Report') pages = 6;
    else if (template === 'Social Media Engagement') pages = 8;
    else if (template === 'Meta Campaign Insights - Lead Campaign' || template === 'Meta Lead Campaign Report') pages = 2;

    // 4. Send via Email/WhatsApp (Mock tracking)
    // Normally we would invoke the email service here.

    // 5. Store delivery history
    const sentReport = new SentReport({
        agencyId,
        clientId,
        scheduleId,
        name: `${client.companyName || client.name} - ${template}`,
        template,
        deliveredTo: recipients,
        deliveryMethod,
        pages,
        downloadUrl: dummyPdfUrl,
        generatedBy,
        status: 'Sent'
    });

    await sentReport.save();

    return sentReport;
};

// Cron Job helper to process due schedules
exports.processDueSchedules = async () => {
    const now = new Date();
    // Find active schedules where nextSend is in the past
    const dueSchedules = await ReportSchedule.find({
        status: 'Active',
        nextSend: { $lte: now }
    });

    for (const schedule of dueSchedules) {
        try {
            await this.generateAndSendReport(
                schedule.agencyId,
                schedule.clientId,
                schedule.template,
                schedule._id,
                schedule.recipients,
                schedule.deliveryMethod
            );

            // Calculate next send date based on frequency
            const next = new Date(schedule.nextSend);
            switch (schedule.frequency) {
                case 'Daily': next.setDate(next.getDate() + 1); break;
                case 'Weekly': next.setDate(next.getDate() + 7); break;
                case 'Bi-weekly': next.setDate(next.getDate() + 14); break;
                case 'Monthly': next.setMonth(next.getMonth() + 1); break;
                case 'Quarterly': next.setMonth(next.getMonth() + 3); break;
            }
            schedule.nextSend = next;
            await schedule.save();

        } catch (error) {
            console.error(`Failed to process report schedule ${schedule._id}:`, error);
        }
    }
};
