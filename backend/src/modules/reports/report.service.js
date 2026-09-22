const ReportSchedule = require('./reportSchedule.model');
const SentReport = require('./sentReport.model');
const User = require('../auth/user.model'); 

// Import other services to gather data if needed in future (e.g. mosService, analyticsService)

exports.createSchedule = async (scheduleData) => {
    const schedule = new ReportSchedule(scheduleData);
    await schedule.save();
    return schedule;
};

exports.getSchedules = async (agencyId, user = null) => {
    const isClient = user && ['agency_client', 'brand_super_admin', 'brand_manager', 'client', 'client_user'].includes(user.role);
    if (isClient) {
        return await ReportSchedule.find({ clientId: user._id })
            .populate('clientId', 'name companyName')
            .sort({ createdAt: -1 });
    }
    return await ReportSchedule.find({ agencyId })
        .populate('clientId', 'name companyName')
        .sort({ createdAt: -1 });
};

exports.updateScheduleStatus = async (scheduleId, status, agencyId = null) => {
    const filter = { _id: scheduleId };
    if (agencyId) filter.agencyId = agencyId;
    return await ReportSchedule.findOneAndUpdate(filter, { status }, { returnDocument: 'after' });
};

exports.deleteSchedule = async (scheduleId, agencyId = null) => {
    const filter = { _id: scheduleId };
    if (agencyId) filter.agencyId = agencyId;
    return await ReportSchedule.findOneAndDelete(filter);
};

exports.getRecentSentReports = async (agencyId, user = null) => {
    const MonthlyHighlights = require('./monthlyHighlights.model');
    const User = require('../auth/user.model');

    const isClient = user && ['agency_client', 'brand_super_admin', 'brand_manager', 'client', 'client_user'].includes(user.role);
    const isSuperAdmin = user && ['supreme_super_admin', 'commander_admin'].includes(user.role);

    let sentFilter = {};
    let monthlyFilter = { status: 'Published' };

    if (isClient) {
        sentFilter = { clientId: user._id };
        monthlyFilter.clientId = user._id;
    } else if (agencyId && !isSuperAdmin) {
        // Fetch all client IDs belonging to this agency
        const clientDocs = await User.find({
            $or: [
                { agencyId: agencyId },
                { adminId: agencyId },
                { companyId: agencyId }
            ],
            role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client', 'client', 'client_user', 'user'] }
        }).select('_id').lean();

        const clientIds = clientDocs.map(c => c._id);
        const agencyAndClientIds = [...clientIds, agencyId];

        sentFilter = {
            $or: [
                { agencyId: agencyId },
                { clientId: { $in: agencyAndClientIds } }
            ]
        };

        monthlyFilter.$or = [
            { agencyId: agencyId },
            { clientId: { $in: clientIds } }
        ];
    }

    const sentReports = await SentReport.find(sentFilter)
        .populate('clientId', 'name companyName email')
        .sort({ sentAt: -1 })
        .limit(50)
        .lean();

    const monthlyReports = await MonthlyHighlights.find(monthlyFilter)
        .populate('clientId', 'name companyName email')
        .sort({ publishedAt: -1, updatedAt: -1 })
        .limit(50)
        .lean();

    const existingKeys = new Set(sentReports.map(r => `${r.clientId?._id || r.clientId}_${r.name}`));

    monthlyReports.forEach(m => {
        const clientObj = m.clientId;
        const clientName = clientObj?.companyName || clientObj?.name || 'Client';
        let dateLabel = `(${m.month}/${m.year})`;
        if (m.fromDate && m.toDate) {
            const fd = new Date(m.fromDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const td = new Date(m.toDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            dateLabel = `(${fd} - ${td})`;
        }
        const reportType = m.reportType || 'Monthly Highlights';
        const name = `${clientName} - ${reportType} ${dateLabel}`;
        const key = `${clientObj?._id || m.clientId}_${name}`;

        if (!existingKeys.has(key)) {
            sentReports.push({
                _id: m._id,
                agencyId: m.agencyId || agencyId,
                clientId: clientObj,
                name: name,
                template: reportType,
                sentAt: m.publishedAt || m.updatedAt || m.createdAt,
                deliveredTo: clientObj?.email ? [clientObj.email] : ['Client Portal'],
                deliveryMethod: 'Email & Portal',
                status: 'Delivered',
                pages: 2,
                generatedBy: m.createdBy,
                month: m.month,
                year: m.year,
                fromDate: m.fromDate,
                toDate: m.toDate
            });
        }
    });

    sentReports.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));

    return sentReports.slice(0, 50);
};

exports.getReportAnalytics = async (agencyId, user = null) => {
    const User = require('../auth/user.model');
    const isClient = user && ['agency_client', 'brand_super_admin', 'brand_manager', 'client', 'client_user'].includes(user.role);
    const isSuperAdmin = user && ['supreme_super_admin', 'commander_admin'].includes(user.role);

    let filter = {};
    if (isClient) {
        filter = { clientId: user._id };
    } else if (agencyId && !isSuperAdmin) {
        const clientDocs = await User.find({
            $or: [
                { agencyId: agencyId },
                { adminId: agencyId },
                { companyId: agencyId }
            ],
            role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client', 'client', 'client_user', 'user'] }
        }).select('_id').lean();

        const clientIds = clientDocs.map(c => c._id);
        const agencyAndClientIds = [...clientIds, agencyId];

        filter = {
            $or: [
                { agencyId: agencyId },
                { clientId: { $in: agencyAndClientIds } }
            ]
        };
    }

    const reports = await SentReport.find(filter);
    
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

exports.getMetaLeadCampaigns = async (targetId, fromDate = null, toDate = null) => {
    const PerformanceAd = require('../performanceAds/performanceAds.model');
    const User = require('../auth/user.model');
    const mongoose = require('mongoose');
    
    // Dynamic Date-Filtered Fetch (Meta Graph API)
    if (fromDate && toDate) {
        const Integration = require('../integrations/integration.model');
        const User = require('../auth/user.model');
        const axios = require('axios');
        
        let queryId = targetId;
        if (!queryId || queryId === 'all' || queryId === '[object Object]' || !mongoose.Types.ObjectId.isValid(queryId)) {
            queryId = null;
        }

        let clientCompanyId = queryId;
        if (queryId) {
            const u = await User.findById(queryId).lean();
            if (u && u.agencyId) clientCompanyId = u.agencyId;
        }

        const integration = await Integration.findOne({ 
            $or: [ { companyId: clientCompanyId }, { clientId: queryId } ], 
            type: { $in: ['meta_ads', 'meta', 'facebook'] }, 
            isActive: true 
        }).sort({ createdAt: -1 }).lean();

        if (!integration || !integration.config || !integration.config.accessToken) {
            throw new Error('Meta integration unavailable');
        }

        const { accessToken, selectedAdAccounts } = integration.config;
        if (!selectedAdAccounts || selectedAdAccounts.length === 0) {
            throw new Error('Meta Ad Accounts unavailable');
        }

        const extractLeads = (actions) => {
            if (!actions || !Array.isArray(actions) || actions.length === 0) return 0;
            const directLead = actions.find(a => a.action_type === 'lead');
            if (directLead && parseInt(directLead.value, 10) > 0) return parseInt(directLead.value, 10);
            const groupedLead = actions.find(a => a.action_type === 'onsite_conversion.total_lead' || a.action_type === 'lead_grouped' || a.action_type === 'onsite_conversion.lead_grouped');
            if (groupedLead && parseInt(groupedLead.value, 10) > 0) {
                const pixelLead = actions.find(a => a.action_type === 'offsite_conversion.fb_pixel_lead');
                const pixelVal = pixelLead ? parseInt(pixelLead.value, 10) : 0;
                return parseInt(groupedLead.value, 10) + pixelVal;
            }
            let total = 0;
            actions.forEach(a => {
                const val = parseInt(a.value || 0, 10);
                if (val > 0 && (a.action_type === 'offsite_conversion.fb_pixel_lead' || a.action_type === 'leadgen_grouped' || a.action_type === 'onsite_conversion.lead' || a.action_type === 'onsite_conversion.messaging_conversation_started_7d' || a.action_type === 'contact_total' || a.action_type === 'submit_application_total' || a.action_type === 'omni_complete_registration')) {
                    total += val;
                }
            });
            if (total > 0) return total;
            return 0;
        };

        const timeRange = JSON.stringify({ since: fromDate, until: toDate });
        let liveCampaigns = [];
        let totalSpend = 0;
        let totalLeads = 0;

        for (const adAccount of selectedAdAccounts) {
            try {
                const campaignsRes = await axios.get(`https://graph.facebook.com/v18.0/${adAccount.id}/campaigns`, {
                    params: {
                        access_token: accessToken,
                        time_range: timeRange,
                        fields: 'id,name,status,effective_status,insights{spend,cpc,cpm,ctr,reach,clicks,actions}',
                        limit: 100
                    }
                });
                const campaigns = campaignsRes.data.data || [];
                campaigns.forEach(c => {
                    const cInsights = c.insights && c.insights.data && c.insights.data[0] ? c.insights.data[0] : null;
                    if (!cInsights) return; 
                    
                    const spendVal = parseFloat(cInsights.spend || 0);
                    if (spendVal <= 0) return;

                    const cLeads = extractLeads(cInsights.actions);
                    const cplVal = cLeads > 0 ? (spendVal / cLeads).toFixed(2) : (cInsights.cpc || '0');

                    liveCampaigns.push({
                        id: c.id,
                        campaignName: c.name,
                        typeOfCampaign: 'Lead',
                        amountSpent: `₹${spendVal.toLocaleString('en-IN')}`,
                        rawSpend: spendVal,
                        noOfLeads: cLeads,
                        cpl: `₹${parseFloat(cplVal).toLocaleString('en-IN')}`,
                        rawCpl: parseFloat(cplVal),
                        status: c.effective_status || c.status || 'Active',
                        adAccount: adAccount.name || adAccount.id || 'Connected Meta Account'
                    });
                    
                    totalSpend += spendVal;
                    totalLeads += cLeads;
                });
            } catch (e) {
                console.warn('Meta API error:', e.message);
            }
        }
        
        const avgCpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : 0;
        return {
            campaigns: liveCampaigns,
            summary: {
                totalCampaigns: liveCampaigns.length,
                totalAmountSpent: `₹${totalSpend.toLocaleString('en-IN')}`,
                rawTotalAmountSpent: totalSpend,
                totalLeads: totalLeads,
                avgCpl: `₹${parseFloat(avgCpl).toLocaleString('en-IN')}`,
                rawAvgCpl: parseFloat(avgCpl)
            }
        };
    }


    let queryId = targetId;
    if (!queryId || queryId === 'all' || queryId === '[object Object]' || !mongoose.Types.ObjectId.isValid(queryId)) {
        queryId = null;
    }

    let dashboards = [];
    if (queryId) {
        let dashboard = await PerformanceAd.findOne({ $or: [{ agency: queryId }, { clientId: queryId }] }).lean();
        if (!dashboard) {
            const clientUser = await User.findById(queryId).lean();
            if (clientUser && clientUser.agencyId) {
                dashboard = await PerformanceAd.findOne({ agency: clientUser.agencyId }).lean();
            }
        }
        if (dashboard) {
            dashboards.push(dashboard);
        }
    } else {
        dashboards = await PerformanceAd.find({}).lean();
    }

    let rawCampaigns = [];
    dashboards.forEach(d => {
        if (Array.isArray(d.activeCampaigns)) {
            rawCampaigns = rawCampaigns.concat(d.activeCampaigns);
        }
    });

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

exports.getMetaReachCampaigns = async (targetId, fromDate = null, toDate = null) => {
    const PerformanceAd = require('../performanceAds/performanceAds.model');
    const User = require('../auth/user.model');
    const mongoose = require('mongoose');

    // Dynamic Date-Filtered Fetch (Meta Graph API)
    if (fromDate && toDate) {
        const Integration = require('../integrations/integration.model');
        const User = require('../auth/user.model');
        const axios = require('axios');
        
        let queryId = targetId;
        if (!queryId || queryId === 'all' || queryId === '[object Object]' || !mongoose.Types.ObjectId.isValid(queryId)) {
            queryId = null;
        }

        let clientCompanyId = queryId;
        if (queryId) {
            const u = await User.findById(queryId).lean();
            if (u && u.agencyId) clientCompanyId = u.agencyId;
        }

        const integration = await Integration.findOne({ 
            $or: [ { companyId: clientCompanyId }, { clientId: queryId } ], 
            type: { $in: ['meta_ads', 'meta', 'facebook'] }, 
            isActive: true 
        }).sort({ createdAt: -1 }).lean();

        if (!integration || !integration.config || !integration.config.accessToken) {
            throw new Error('Meta integration unavailable');
        }

        const { accessToken, selectedAdAccounts } = integration.config;
        if (!selectedAdAccounts || selectedAdAccounts.length === 0) {
            throw new Error('Meta Ad Accounts unavailable');
        }

        const timeRange = JSON.stringify({ since: fromDate, until: toDate });
        let liveCampaigns = [];
        let totalSpend = 0;
        let totalReach = 0;

        for (const adAccount of selectedAdAccounts) {
            try {
                const campaignsRes = await axios.get(`https://graph.facebook.com/v18.0/${adAccount.id}/campaigns`, {
                    params: {
                        access_token: accessToken,
                        time_range: timeRange,
                        fields: 'id,name,status,effective_status,insights{spend,cpc,cpm,ctr,reach,clicks,impressions,actions}',
                        limit: 100
                    }
                });
                const campaigns = campaignsRes.data.data || [];
                campaigns.forEach(c => {
                    const cInsights = c.insights && c.insights.data && c.insights.data[0] ? c.insights.data[0] : null;
                    if (!cInsights) return; 
                    
                    const spendVal = parseFloat(cInsights.spend || 0);
                    if (spendVal <= 0) return;

                    const reachVal = parseInt(cInsights.reach || 0, 10);
                    const impressionsVal = parseInt(cInsights.impressions || 0, 10);
                    const cprVal = reachVal > 0 ? (spendVal / reachVal).toFixed(2) : '0';

                    liveCampaigns.push({
                        id: c.id,
                        campaignName: c.name,
                        typeOfCampaign: 'Reach',
                        amountSpent: `₹${spendVal.toLocaleString('en-IN')}`,
                        rawSpend: spendVal,
                        reach: reachVal,
                        impressions: impressionsVal,
                        cpr: `₹${parseFloat(cprVal).toLocaleString('en-IN')}`,
                        rawCpr: parseFloat(cprVal),
                        status: c.effective_status || c.status || 'Active',
                        adAccount: adAccount.name || adAccount.id || 'Connected Meta Account'
                    });
                    
                    totalSpend += spendVal;
                    totalReach += reachVal;
                });
            } catch (e) {
                console.warn('Meta Reach API error:', e.message);
            }
        }
        
        const avgCpr = totalReach > 0 ? (totalSpend / totalReach).toFixed(2) : 0;
        return {
            campaigns: liveCampaigns,
            summary: {
                totalCampaigns: liveCampaigns.length,
                totalAmountSpent: `₹${totalSpend.toLocaleString('en-IN')}`,
                rawTotalAmountSpent: totalSpend,
                totalReach: totalReach,
                avgCpr: `₹${parseFloat(avgCpr).toLocaleString('en-IN')}`,
                rawAvgCpr: parseFloat(avgCpr)
            }
        };
    }

    let queryId = targetId;
    if (!queryId || queryId === 'all' || queryId === '[object Object]' || !mongoose.Types.ObjectId.isValid(queryId)) {
        queryId = null;
    }

    let dashboards = [];
    if (queryId) {
        let dashboard = await PerformanceAd.findOne({ $or: [{ agency: queryId }, { clientId: queryId }] }).lean();
        if (!dashboard) {
            const clientUser = await User.findById(queryId).lean();
            if (clientUser && clientUser.agencyId) {
                dashboard = await PerformanceAd.findOne({ agency: clientUser.agencyId }).lean();
            }
        }
        if (dashboard) {
            dashboards.push(dashboard);
        }
    } else {
        dashboards = await PerformanceAd.find({}).lean();
    }

    let rawCampaigns = [];
    dashboards.forEach(d => {
        if (Array.isArray(d.activeCampaigns)) {
            rawCampaigns = rawCampaigns.concat(d.activeCampaigns);
        }
    });

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
