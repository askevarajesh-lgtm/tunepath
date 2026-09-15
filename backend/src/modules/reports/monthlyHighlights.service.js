const MonthlyHighlights = require('./monthlyHighlights.model');
const mongoose = require('mongoose');

/**
 * Auto-aggregates metrics for a given client and month/year
 */
const checkSocialMediaModuleEnabled = async (clientId, digitalInsights, deliverables) => {
    try {
        if (!clientId) return false;
        const User = mongoose.models.User || require('../auth/user.model');
        const user = await User.findById(clientId).catch(() => null);

        if (user) {
            if (user.modules && (user.modules.social_media || user.modules.socialMedia)) {
                return true;
            }
            if (user.features && Array.isArray(user.features)) {
                const hasFeat = user.features.some(f => ['social_media', 'social-media', 'digital_insights', 'meta', 'facebook', 'instagram'].includes(String(f).toLowerCase()));
                if (hasFeat) return true;
            }
            if (user.integrations && Array.isArray(user.integrations)) {
                const hasInteg = user.integrations.some(i => ['social_media', 'social-media', 'meta', 'facebook', 'instagram'].includes(String(i).toLowerCase()));
                if (hasInteg) return true;
            }
            if (user.additionalIntegrations && Array.isArray(user.additionalIntegrations)) {
                const hasAdd = user.additionalIntegrations.some(i => ['social_media', 'social-media', 'meta', 'facebook', 'instagram'].includes(String(i).toLowerCase()));
                if (hasAdd) return true;
            }
        }

        if (mongoose.models.Integration) {
            const Integration = mongoose.models.Integration;
            const activeIntegration = await Integration.findOne({
                $or: [{ clientId: clientId }, { companyId: clientId }],
                type: { $in: ['meta', 'facebook', 'instagram', 'social_media'] },
                isActive: true
            }).catch(() => null);
            if (activeIntegration) return true;
        }

        if (digitalInsights) {
            const hasData = Object.values(digitalInsights).some(val => typeof val === 'number' && val > 0);
            if (hasData) return true;
        }

        return false;
    } catch (err) {
        console.warn('Social media module check note:', err.message);
        return false;
    }
};

const autoAggregateMetrics = async (clientId, month, year) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    let blogCount = 0;
    const deliverablesMap = {};

    const getKeyAndDisplayName = (rawName) => {
        const lower = (rawName || '').trim().toLowerCase();
        if (lower === 'poster' || lower === 'posters' || lower.includes('social media post')) {
            return { key: 'poster', displayName: 'Posters' };
        }
        if (lower === 'video' || lower === 'videos' || lower.includes('number of video')) {
            return { key: 'video', displayName: 'Videos' };
        }
        if (lower === 'shoot' || lower === 'shoots') {
            return { key: 'shoot', displayName: 'Shoots' };
        }
        return { key: lower, displayName: rawName };
    };

    try {
        const Project = mongoose.models.Project || require('../projects/project.model');
        const projects = await Project.find({ clientId: clientId }).catch(() => []);

        projects.forEach(p => {
            const numPosters = p.numberOfPosters || 0;
            if (numPosters > 0) {
                const remP = p.remainingPosters ?? numPosters;
                const compP = (p.completedPosters !== undefined && p.completedPosters !== null)
                    ? Math.max(p.completedPosters || 0, p.approvedPosters || 0)
                    : ((p.approvedPosters > 0) ? p.approvedPosters : Math.max(0, numPosters - remP));
                if (!deliverablesMap['poster']) {
                    deliverablesMap['poster'] = { name: 'Posters', completed: 0, total: 0, unit: 'Completed' };
                }
                deliverablesMap['poster'].total += numPosters;
                deliverablesMap['poster'].completed += compP;
            }

            const numVideos = p.numberOfVideos || 0;
            if (numVideos > 0) {
                const remV = p.remainingVideos ?? numVideos;
                const compV = (p.completedVideos !== undefined && p.completedVideos !== null)
                    ? Math.max(p.completedVideos || 0, p.approvedVideos || 0)
                    : ((p.approvedVideos > 0) ? p.approvedVideos : Math.max(0, numVideos - remV));
                if (!deliverablesMap['video']) {
                    deliverablesMap['video'] = { name: 'Videos', completed: 0, total: 0, unit: 'Completed' };
                }
                deliverablesMap['video'].total += numVideos;
                deliverablesMap['video'].completed += compV;
            }

            const numShoots = p.numberOfShoots || 0;
            if (numShoots > 0) {
                const remS = p.remainingShoots ?? numShoots;
                const compS = (p.completedShoots !== undefined && p.completedShoots !== null)
                    ? Math.max(p.completedShoots || 0, p.approvedShoots || 0)
                    : ((p.approvedShoots > 0) ? p.approvedShoots : Math.max(0, numShoots - remS));
                if (!deliverablesMap['shoot']) {
                    deliverablesMap['shoot'] = { name: 'Shoots', completed: 0, total: 0, unit: 'Completed' };
                }
                deliverablesMap['shoot'].total += numShoots;
                deliverablesMap['shoot'].completed += compS;
            }

            if (p.selectedCategories && Array.isArray(p.selectedCategories)) {
                p.selectedCategories.forEach(cat => {
                    const rawName = cat.name || cat.categoryName;
                    const cTotal = cat.quantity ?? cat.count ?? 0;
                    if (!rawName || cTotal <= 0) return;

                    const { key, displayName } = getKeyAndDisplayName(rawName);

                    if (!deliverablesMap[key]) {
                        const cRem = cat.remaining ?? cTotal;
                        const cComp = (cat.approved > 0) ? cat.approved : ((cat.completed > 0) ? cat.completed : Math.max(0, cTotal - cRem));
                        deliverablesMap[key] = {
                            name: displayName,
                            completed: cComp,
                            total: cTotal,
                            unit: 'Completed'
                        };
                    }
                });
            }
        });

        Object.keys(deliverablesMap).forEach(key => {
            if (key.includes('blog')) {
                blogCount = Math.max(blogCount, deliverablesMap[key].completed);
            }
        });

        if (mongoose.models.BlogAsset && clientId) {
            const BlogPost = mongoose.models.BlogAsset;
            const clientBlogAssets = await BlogPost.countDocuments({
                $or: [
                    { clientId: clientId },
                    { createdBy: clientId },
                    { authorId: clientId }
                ],
                assetType: 'post',
                status: 'published',
                createdAt: { $gte: startDate, $lte: endDate }
            }).catch(() => 0);
            blogCount = Math.max(blogCount, clientBlogAssets);
        }
    } catch (err) {
        console.warn('Auto-aggregate deliverables note:', err.message);
    }

    const deliverables = Object.values(deliverablesMap).filter(d => d.total > 0);

    const postDesignsCount = deliverablesMap['poster'] ? deliverablesMap['poster'].completed : 0;
    const videosCount = deliverablesMap['video'] ? deliverablesMap['video'].completed : 0;

    const digitalInsights = {
        facebookFollowersIncreased: 0,
        facebookTotalFollowers: 0,
        facebookReach: 0,
        instagramFollowersIncreased: 0,
        instagramTotalFollowers: 0,
        instagramReach: 0
    };

    const hasSocialMediaModule = await checkSocialMediaModuleEnabled(clientId, digitalInsights, deliverables);

    const monthName = startDate.toLocaleString('default', { month: 'long' });
    const notesSummary = deliverables.length > 0
        ? deliverables.map(d => `${d.name} — ${d.completed} / ${d.total} Completed`).join('; ')
        : 'No deliverables assigned for this project.';

    return {
        hasSocialMediaModule,
        digitalInsights,
        blogs: {
            count: blogCount,
            notes: `${blogCount} blog update(s) completed in ${monthName} ${year}`
        },
        brandCommunicationDesign: {
            socialMediaPostDesignsCount: postDesignsCount,
            videosCount: videosCount,
            notes: notesSummary,
            deliverables: deliverables
        },
        offlineCollaterals: '',
        specialInitiatives: ''
    };
};

/**
 * Fetch monthly highlights report for a client and month/year
 */
exports.getMonthlyHighlights = async (clientId, month, year, isClientUser = false, forceRefresh = false) => {
    let report = await MonthlyHighlights.findOne({ clientId, month, year })
        .populate('clientId', 'name companyName email')
        .populate('createdBy', 'name email');

    if (report && !forceRefresh) {
        if (isClientUser && report.status !== 'Published') {
            return { status: 'NotPublished', message: 'Report for this month has not been published yet.' };
        }
        return report;
    }

    if (isClientUser && !report) {
        return { status: 'NotPublished', message: 'No report found for this month.' };
    }

    const aggregated = await autoAggregateMetrics(clientId, month, year);

    if (report && forceRefresh) {
        report.hasSocialMediaModule = aggregated.hasSocialMediaModule;
        report.blogs = aggregated.blogs;
        report.brandCommunicationDesign = aggregated.brandCommunicationDesign;
        await report.save();
        return report;
    }

    return {
        clientId,
        month,
        year,
        status: 'Draft',
        ...aggregated,
        isNew: true
    };
};

/**
 * Save or update monthly highlights report
 */
exports.upsertMonthlyHighlights = async (agencyId, userId, payload) => {
    const { clientId, month, year, status, hasSocialMediaModule, digitalInsights, blogs, brandCommunicationDesign, offlineCollaterals, specialInitiatives } = payload;

    const query = { clientId, month, year };
    const update = {
        agencyId,
        clientId,
        month,
        year,
        status: status || 'Draft',
        hasSocialMediaModule: hasSocialMediaModule ?? false,
        digitalInsights: digitalInsights || {},
        blogs: blogs || {},
        brandCommunicationDesign: brandCommunicationDesign || {},
        offlineCollaterals: offlineCollaterals || '',
        specialInitiatives: specialInitiatives || '',
        createdBy: userId,
    };

    if (status === 'Published') {
        update.publishedAt = new Date();
    }

    const report = await MonthlyHighlights.findOneAndUpdate(
        query,
        update,
        { new: true, upsert: true, runValidators: true }
    ).populate('clientId', 'name companyName email');

    if (status === 'Published') {
        try {
            const SentReport = mongoose.models.SentReport || require('./sentReport.model');
            const clientName = report.clientId?.companyName || report.clientId?.name || 'Client';
            const clientEmail = report.clientId?.email ? [report.clientId.email] : ['Client Portal'];
            const reportName = `${clientName} - Monthly Highlights (${month}/${year})`;

            await SentReport.findOneAndUpdate(
                { clientId, template: 'Monthly Highlights', name: reportName },
                {
                    agencyId: agencyId || report.clientId?.agencyId || userId,
                    clientId,
                    name: reportName,
                    template: 'Monthly Highlights',
                    sentAt: new Date(),
                    deliveredTo: clientEmail,
                    deliveryMethod: 'Email & Portal',
                    status: 'Delivered',
                    pages: 2,
                    generatedBy: userId
                },
                { upsert: true, new: true }
            );
        } catch (sentErr) {
            console.error('Error logging SentReport history for Monthly Highlights:', sentErr);
        }
    }

    return report;
};

/**
 * Get list of available published monthly reports for a client
 */
exports.getClientReportsList = async (clientId) => {
    return await MonthlyHighlights.find({ clientId, status: 'Published' })
        .sort({ year: -1, month: -1 })
        .select('month year publishedAt updatedAt status digitalInsights blogs brandCommunicationDesign offlineCollaterals specialInitiatives');
};

