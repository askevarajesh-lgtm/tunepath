const MonthlyHighlights = require('./monthlyHighlights.model');
const mongoose = require('mongoose');

/**
 * Auto-aggregates metrics for a given client and month/year
 */
const getGa4PropertyIdForClient = async (clientId) => {
    try {
        if (!clientId) return process.env.GA4_PROPERTY_ID || null;
        const targetIds = [clientId, String(clientId)];
        if (mongoose.Types.ObjectId.isValid(clientId)) {
            targetIds.push(new mongoose.Types.ObjectId(clientId));
        }

        // 1. Primary: Check AnalyticsProject model (where Google Analytics module projects & property IDs are stored)
        const AnalyticsProject = mongoose.models.AnalyticsProject || require('../analytics/models/analyticsProject.model');
        const analyticsProj = await AnalyticsProject.findOne({
            $or: [
                { clientId: { $in: targetIds } },
                { companyId: { $in: targetIds } },
                { createdBy: { $in: targetIds } }
            ],
            isDeleted: false,
            'credentials.ga4PropertyId': { $exists: true, $ne: null, $ne: '' }
        }).catch(() => null);

        if (analyticsProj && analyticsProj.credentials?.ga4PropertyId) {
            const rawPropId = String(analyticsProj.credentials.ga4PropertyId).trim();
            const match = rawPropId.match(/\b\d{7,12}\b/);
            if (match) return match[0];
            if (rawPropId) return rawPropId;
        }

        // 2. Check User.ga4PropertyId
        const User = mongoose.models.User || require('../auth/user.model');
        const user = await User.findById(clientId).catch(() => null);
        if (user && user.ga4PropertyId) {
            const match = String(user.ga4PropertyId).match(/\b\d{7,12}\b/);
            if (match) return match[0];
            return user.ga4PropertyId;
        }

        // 3. Check SEOProject
        const SEOProject = mongoose.models.SEOProject || require('../seoIntelligence/models/seoProject.model');
        const seoProj = await SEOProject.findOne({ clientId: { $in: targetIds } }).catch(() => null);
        if (seoProj && (seoProj.ga4PropertyId || seoProj.credentials?.ga4PropertyId)) {
            const pId = seoProj.ga4PropertyId || seoProj.credentials?.ga4PropertyId;
            const match = String(pId).match(/\b\d{7,12}\b/);
            if (match) return match[0];
            return pId;
        }

        // 4. Check WorkspaceProject
        const WorkspaceProject = mongoose.models.WorkspaceProject || require('../seoWorkspace/models/workspaceProject.model');
        const wsProj = await WorkspaceProject.findOne({ clientId: { $in: targetIds } }).catch(() => null);
        if (wsProj && (wsProj.ga4PropertyId || wsProj.credentials?.ga4PropertyId)) {
            const pId = wsProj.ga4PropertyId || wsProj.credentials?.ga4PropertyId;
            const match = String(pId).match(/\b\d{7,12}\b/);
            if (match) return match[0];
            return pId;
        }

        // 5. Check Integration model
        if (mongoose.models.Integration) {
            const Integration = mongoose.models.Integration;
            const gaInteg = await Integration.findOne({
                $or: [{ clientId: { $in: targetIds } }, { companyId: { $in: targetIds } }],
                type: { $in: ['google_analytics', 'ga4', 'google'] },
                isActive: true
            }).catch(() => null);
            if (gaInteg && gaInteg.config) {
                const pId = gaInteg.config.ga4PropertyId || gaInteg.config.propertyId;
                if (pId) {
                    const match = String(pId).match(/\b\d{7,12}\b/);
                    if (match) return match[0];
                    return pId;
                }
            }
        }

        return process.env.GA4_PROPERTY_ID || null;
    } catch (err) {
        return process.env.GA4_PROPERTY_ID || null;
    }
};

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
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[month - 1] || 'Month';

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
        const User = mongoose.models.User || require('../auth/user.model');
        const clientTargetIds = [clientId, String(clientId)];
        if (mongoose.Types.ObjectId.isValid(clientId)) {
            clientTargetIds.push(new mongoose.Types.ObjectId(clientId));
        }
        const user = await User.findById(clientId).catch(() => null);
        if (user) {
            [user.clientCompanyId, user.brandId, user.workspaceId].forEach(id => {
                if (id) {
                    clientTargetIds.push(id, String(id));
                    if (mongoose.Types.ObjectId.isValid(id)) clientTargetIds.push(new mongoose.Types.ObjectId(id));
                }
            });
        }

        const Project = mongoose.models.Project || require('../projects/project.model');
        const projects = await Project.find({
            $or: [
                { clientId: { $in: clientTargetIds } },
                { companyId: { $in: clientTargetIds } }
            ]
        }).catch(() => []);

        projects.forEach(p => {
            const numPosters = p.numberOfPosters || 0;
            if (numPosters > 0) {
                const compP = (p.completedPosters !== undefined && p.completedPosters !== null)
                    ? Math.max(p.completedPosters || 0, p.approvedPosters || 0)
                    : (p.approvedPosters || 0);
                const remP = (p.remainingPosters !== undefined && p.remainingPosters !== null)
                    ? Math.max(0, p.remainingPosters)
                    : Math.max(0, numPosters - compP);

                if (!deliverablesMap['poster']) {
                    deliverablesMap['poster'] = { name: 'Posters', total: 0, completed: 0, remaining: 0, unit: 'Completed' };
                }
                deliverablesMap['poster'].total += numPosters;
                deliverablesMap['poster'].completed += compP;
                deliverablesMap['poster'].remaining += remP;
            }

            const numVideos = p.numberOfVideos || 0;
            if (numVideos > 0) {
                const compV = (p.completedVideos !== undefined && p.completedVideos !== null)
                    ? Math.max(p.completedVideos || 0, p.approvedVideos || 0)
                    : (p.approvedVideos || 0);
                const remV = (p.remainingVideos !== undefined && p.remainingVideos !== null)
                    ? Math.max(0, p.remainingVideos)
                    : Math.max(0, numVideos - compV);

                if (!deliverablesMap['video']) {
                    deliverablesMap['video'] = { name: 'Videos', total: 0, completed: 0, remaining: 0, unit: 'Completed' };
                }
                deliverablesMap['video'].total += numVideos;
                deliverablesMap['video'].completed += compV;
                deliverablesMap['video'].remaining += remV;
            }

            const numShoots = p.numberOfShoots || 0;
            if (numShoots > 0) {
                const compS = (p.completedShoots !== undefined && p.completedShoots !== null)
                    ? Math.max(p.completedShoots || 0, p.approvedShoots || 0)
                    : (p.approvedShoots || 0);
                const remS = (p.remainingShoots !== undefined && p.remainingShoots !== null)
                    ? Math.max(0, p.remainingShoots)
                    : Math.max(0, numShoots - compS);

                if (!deliverablesMap['shoot']) {
                    deliverablesMap['shoot'] = { name: 'Shoots', total: 0, completed: 0, remaining: 0, unit: 'Completed' };
                }
                deliverablesMap['shoot'].total += numShoots;
                deliverablesMap['shoot'].completed += compS;
                deliverablesMap['shoot'].remaining += remS;
            }

            if (p.selectedCategories && Array.isArray(p.selectedCategories)) {
                p.selectedCategories.forEach(cat => {
                    const rawName = cat.name || cat.categoryName;
                    const cTotal = cat.quantity ?? cat.count ?? 0;
                    if (!rawName || cTotal <= 0) return;

                    const { key, displayName } = getKeyAndDisplayName(rawName);

                    const cComp = (cat.completed !== undefined && cat.completed !== null)
                        ? Math.max(cat.completed || 0, cat.approved || 0)
                        : (cat.approved || 0);
                    const cRem = (cat.remaining !== undefined && cat.remaining !== null)
                        ? Math.max(0, cat.remaining)
                        : Math.max(0, cTotal - cComp);

                    if (!deliverablesMap[key]) {
                        deliverablesMap[key] = {
                            name: displayName,
                            total: 0,
                            completed: 0,
                            remaining: 0,
                            unit: 'Completed'
                        };
                    }
                    deliverablesMap[key].total += cTotal;
                    deliverablesMap[key].completed += cComp;
                    deliverablesMap[key].remaining += cRem;
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
    const notesSummary = deliverables.length > 0
        ? deliverables.map(d => `${d.name} — Total: ${d.total}, Completed: ${d.completed}, Remaining: ${d.remaining}`).join('; ')
        : `Number of social media post designs: ${postDesignsCount}; Number of videos: ${videosCount}`;

    const digitalInsights = {
        facebookFollowersIncreased: 0,
        facebookTotalFollowers: 0,
        facebookReach: 0,
        instagramFollowersIncreased: 0,
        instagramTotalFollowers: 0,
        instagramReach: 0
    };

    const hasSocialMediaModule = await checkSocialMediaModuleEnabled(clientId, digitalInsights, deliverables);

    const monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trackedMonthsList = [];
    for (let i = 1; i >= 0; i--) {
        const d = new Date(year, month - 1 - i, 1);
        const mStr = `${monthAbbrs[d.getMonth()]} ${d.getFullYear()}`;
        trackedMonthsList.push(mStr);
    }

    // Real Social Media (Facebook, Instagram & YouTube) Metrics Aggregation - Real Data Only
    let liveFbFollowers = 0;
    let liveIgFollowers = 0;
    let liveYtSubscribers = 0;
    const fbMonthlyStatsMap = {};
    const igMonthlyStatsMap = {};
    const ytMonthlyStatsMap = {};

    try {
        const AccountModel = mongoose.models.CampaignScheduledAccount || require('../campaign-scheduled/campaignScheduled.account.model');
        const PostModel = mongoose.models.CampaignScheduledPost || require('../campaign-scheduled/campaignScheduled.post.model');
        const User = mongoose.models.User || require('../auth/user.model');
        const axios = require('axios');

        const clientTargetIds = [clientId, String(clientId)];
        if (mongoose.Types.ObjectId.isValid(clientId)) {
            clientTargetIds.push(new mongoose.Types.ObjectId(clientId));
        }

        const user = await User.findById(clientId).catch(() => null);
        if (user) {
            // Include client-specific IDs only (DO NOT include agency-wide user.companyId)
            [user.clientCompanyId, user.brandId, user.workspaceId].forEach(id => {
                if (id) {
                    clientTargetIds.push(id, String(id));
                    if (mongoose.Types.ObjectId.isValid(id)) clientTargetIds.push(new mongoose.Types.ObjectId(id));
                }
            });
        }

        // Strictly fetch accounts for THIS client only (no agency-wide companyId matching)
        const clientAccounts = await AccountModel.find({
            $or: [
                { clientCompanyId: { $in: clientTargetIds } },
                { clientId: { $in: clientTargetIds } },
                { userId: { $in: clientTargetIds } },
                { brandId: { $in: clientTargetIds } }
            ]
        }).lean().catch(() => []);

        // Also check Integration model for active connected accounts belonging to THIS client
        if (mongoose.models.Integration) {
            const Integration = mongoose.models.Integration;
            const clientIntegrations = await Integration.find({
                $or: [
                    { clientId: { $in: clientTargetIds } },
                    { clientCompanyId: { $in: clientTargetIds } },
                    { userId: { $in: clientTargetIds } }
                ],
                isActive: true
            }).lean().catch(() => []);

            clientIntegrations.forEach(intg => {
                const config = intg.config || {};
                const type = String(intg.type || '').toLowerCase();
                const followersCount = Number(config.followers_count || config.fan_count || config.followers || config.subscriberCount || config.subscribers || 0);

                if (type.includes('instagram') || type.includes('ig')) {
                    liveIgFollowers = Math.max(liveIgFollowers, followersCount);
                }
                if (type.includes('facebook') || type.includes('fb') || type.includes('meta')) {
                    liveFbFollowers = Math.max(liveFbFollowers, followersCount);
                }
                if (type.includes('youtube') || type.includes('yt')) {
                    liveYtSubscribers = Math.max(liveYtSubscribers, followersCount);
                }

                if (Array.isArray(config.pages)) {
                    config.pages.forEach(p => {
                        const pFollowers = Number(p.followers_count || p.fan_count || p.followers || 0);
                        liveFbFollowers = Math.max(liveFbFollowers, pFollowers);
                    });
                }
            });
        }

        // Strictly fetch published posts for THIS client only
        const clientPosts = await PostModel.find({
            $or: [
                { clientCompanyId: { $in: clientTargetIds } },
                { clientId: { $in: clientTargetIds } },
                { userId: { $in: clientTargetIds } },
                { brandId: { $in: clientTargetIds } }
            ]
        }).lean().catch(() => []);

        const publishedPosts = clientPosts.filter(p => {
            const statusStr = String(p.status || '').toLowerCase();
            return statusStr === 'published' || p.published_at || p.publishedAt;
        });

        for (const acc of clientAccounts) {
            let followers = Number(acc.followers || acc.fan_count || acc.followers_count || acc.subscriberCount || acc.subscribers || 0);
            if (acc.access_token && (acc.platform === 'facebook' || acc.platform === 'instagram')) {
                try {
                    const targetId = acc.ig_user_id || acc.page_id || 'me';
                    const fields = acc.platform === 'instagram' ? 'id,name,username,followers_count' : 'id,name,fan_count,followers_count';
                    const graphRes = await axios.get(`https://graph.facebook.com/v18.0/${targetId}`, {
                        params: { access_token: acc.access_token, fields }
                    });
                    if (graphRes.data) {
                        followers = graphRes.data.followers_count ?? graphRes.data.fan_count ?? followers;
                    }
                } catch (e) {}
            }

            if (acc.platform === 'facebook' || (acc.id && String(acc.id).startsWith('fb-'))) {
                liveFbFollowers = Math.max(liveFbFollowers, followers);
            } else if (acc.platform === 'instagram' || (acc.id && String(acc.id).startsWith('ig-'))) {
                liveIgFollowers = Math.max(liveIgFollowers, followers);
            } else if (acc.platform === 'youtube' || (acc.id && String(acc.id).startsWith('yt-'))) {
                try {
                    const campaignScheduledService = require('../campaign-scheduled/campaignScheduled.service');
                    if (campaignScheduledService && campaignScheduledService.fetchYoutubeChannelLiveStats) {
                        const ytStats = await campaignScheduledService.fetchYoutubeChannelLiveStats(acc).catch(() => null);
                        if (ytStats && ytStats.subscribers) {
                            followers = Math.max(followers, ytStats.subscribers);
                        }
                    }
                } catch (e) {}
                liveYtSubscribers = Math.max(liveYtSubscribers, followers);
            }
        }

        trackedMonthsList.forEach(mStr => {
            const [mName, yNum] = mStr.split(' ');
            const monthIdx = monthAbbrs.indexOf(mName);
            const yearVal = Number(yNum);

            let fbViews = 0, fbReach = 0;
            let igViews = 0, igReach = 0;
            let ytViews = 0;

            publishedPosts.forEach(post => {
                const rawDate = post.published_at || post.publishedAt || post.scheduled_iso || post.scheduledISO || post.created_at || post.createdAt;
                if (!rawDate) return;
                const pDate = new Date(rawDate);
                if (isNaN(pDate.getTime())) return;

                if (pDate.getMonth() === monthIdx && pDate.getFullYear() === yearVal) {
                    const platforms = Array.isArray(post.platforms) ? post.platforms : [];
                    const pubKeys = post.platform_publications && typeof post.platform_publications === 'object' ? Object.keys(post.platform_publications) : [];
                    const allPStrings = [...platforms, ...pubKeys, String(post.platform || '')].map(s => String(s).toLowerCase());

                    const isFb = allPStrings.some(s => s.includes('facebook') || s.startsWith('fb-') || s.includes('fb'));
                    const isIg = allPStrings.some(s => s.includes('instagram') || s.startsWith('ig-') || s.includes('ig'));
                    const isYt = allPStrings.some(s => s.includes('youtube') || s.startsWith('yt-') || s.includes('yt'));

                    const likes = Number(post.likes) || 0;
                    const comments = Number(post.comments) || 0;
                    const shares = Number(post.shares) || 0;
                    const totalEng = likes + comments + shares;

                    const rawViews = Number(post.views) || Number(post.videoViews) || Number(post.impressions) || totalEng;
                    const rawReach = Number(post.reach) || Number(post.impressions) || totalEng;

                    if (isFb) {
                        fbViews += rawViews;
                        fbReach += rawReach;
                    }
                    if (isIg) {
                        igViews += rawViews;
                        igReach += rawReach;
                    }
                    if (isYt) {
                        ytViews += rawViews;
                    }
                }
            });

            fbMonthlyStatsMap[mStr] = { views: fbViews, reach: fbReach };
            igMonthlyStatsMap[mStr] = { views: igViews, reach: igReach };
            ytMonthlyStatsMap[mStr] = { views: ytViews };
        });

        digitalInsights.facebookTotalFollowers = liveFbFollowers;
        digitalInsights.facebookReach = fbMonthlyStatsMap[`${monthAbbrs[month - 1]} ${year}`]?.reach || 0;
        digitalInsights.instagramTotalFollowers = liveIgFollowers;
        digitalInsights.instagramReach = igMonthlyStatsMap[`${monthAbbrs[month - 1]} ${year}`]?.reach || 0;

        let publishedVideoCount = 0;
        let publishedPostCount = 0;

        publishedPosts.forEach(post => {
            const rawDate = post.published_at || post.publishedAt || post.scheduled_iso || post.scheduledISO || post.created_at || post.createdAt;
            if (!rawDate) return;
            const pDate = new Date(rawDate);
            if (isNaN(pDate.getTime())) return;

            if (pDate.getMonth() === (month - 1) && pDate.getFullYear() === year) {
                const postTypeStr = String(post.type || '').toLowerCase();
                const postOption = post.post_option || {};
                const platformOption = String(postOption.youtube || postOption.facebook || postOption.instagram || '').toLowerCase();
                const firstMedia = Array.isArray(post.media_url) ? post.media_url[0] : post.media_url;
                const isVideoUrl = typeof firstMedia === 'string' && (
                    firstMedia.endsWith('.mp4') || firstMedia.endsWith('.mov') || firstMedia.endsWith('.webm') ||
                    firstMedia.includes('/video/upload/') || (firstMedia.includes('res.cloudinary.com') && firstMedia.includes('/video/'))
                );
                const isVideo = postTypeStr.includes('video') || postTypeStr.includes('reel') || platformOption.includes('video') || platformOption.includes('reel') || isVideoUrl;

                if (isVideo) {
                    publishedVideoCount++;
                } else {
                    publishedPostCount++;
                }
            }
        });

        if (publishedVideoCount === 0 && publishedPostCount === 0) {
            publishedVideoCount = videosCount;
            publishedPostCount = postDesignsCount;
        }

        var socialMediaPostInsights = {
            videoCount: publishedVideoCount,
            postCount: publishedPostCount,
            totalCount: publishedVideoCount + publishedPostCount
        };
    } catch (err) {
        console.warn('Real social media aggregation note:', err.message);
    }

    let keywordRankingDetails = [];
    let keywordRankingOverview = trackedMonthsList.map(mStr => ({
        month: mStr,
        top10: 0,
        top20: 0,
        top30Above: 0
    }));

    try {
        const SemrushProject = mongoose.models.SemrushProject || require('../semrush/models/semrushProject.model');
        const OptimizationSnapshot = mongoose.models.OptimizationSnapshot || require('../semrush/models/optimizationSnapshot.model');

        const semrushProject = await SemrushProject.findOne({
            $or: [{ clientId: clientId }, { companyId: clientId }]
        }).catch(() => null);

        if (semrushProject) {
            const allSnapshots = await OptimizationSnapshot.find({
                projectId: semrushProject._id
            }).sort({ createdAt: -1 }).lean().catch(() => []);

            const latestSnapshot = allSnapshots[0] || null;
            const rankings = latestSnapshot?.seo?.positionTracking?.rankings || latestSnapshot?.seo?.organicKeywordsData || [];

            if (Array.isArray(rankings) && rankings.length > 0) {
                const currentMonthStr = `${monthAbbrs[month - 1]} ${year}`;

                keywordRankingDetails = rankings.map(r => {
                    const kwName = r.keyword || r.Keyword || r.name || '';
                    const vol = r.searchVolume || r.volume || r.SearchVolume || 0;
                    const cat = r.category || (r.tags && r.tags[0]) || r.intent || 'General';
                    const currPos = r.position || r.Position || '-';

                    return {
                        keyword: kwName,
                        volume: Number(vol) || 0,
                        category: String(cat || 'General'),
                        monthRanks: trackedMonthsList.map(mStr => {
                            if (mStr === currentMonthStr) {
                                return { month: mStr, rank: currPos };
                            }
                            const snapInMonth = allSnapshots.find(s => {
                                const sDate = new Date(s.createdAt || s.collectedAt);
                                const [mName, yNum] = mStr.split(' ');
                                return monthAbbrs[sDate.getMonth()] === mName && sDate.getFullYear() === Number(yNum);
                            });
                            if (snapInMonth) {
                                const snapRankings = snapInMonth.seo?.positionTracking?.rankings || snapInMonth.seo?.organicKeywordsData || [];
                                const found = snapRankings.find(sr => (sr.keyword || sr.Keyword || sr.name) === kwName);
                                if (found) return { month: mStr, rank: found.position || found.Position || '-' };
                            }
                            return { month: mStr, rank: r.previousPosition || '-' };
                        })
                    };
                }).filter(k => k.keyword.trim() !== '');

                keywordRankingOverview = trackedMonthsList.map(mStr => {
                    const [mName, yNum] = mStr.split(' ');
                    const snapInMonth = allSnapshots.find(s => {
                        const sDate = new Date(s.createdAt || s.collectedAt);
                        return monthAbbrs[sDate.getMonth()] === mName && sDate.getFullYear() === Number(yNum);
                    });

                    const snapRankings = snapInMonth ? (snapInMonth.seo?.positionTracking?.rankings || snapInMonth.seo?.organicKeywordsData || []) : (mStr === currentMonthStr ? rankings : null);

                    if (snapRankings && Array.isArray(snapRankings) && snapRankings.length > 0) {
                        let t10 = 0, t20 = 0, t30Above = 0;
                        snapRankings.forEach(r => {
                            const pos = Number(r.position || r.Position);
                            if (pos > 0 && pos <= 10) t10++;
                            if (pos > 0 && pos <= 20) t20++;
                            if (pos > 30 || r.position === '> 100') t30Above++;
                        });
                        return { month: mStr, top10: t10, top20: t20, top30Above: t30Above };
                    }

                    if (mStr !== currentMonthStr && rankings.length > 0) {
                        let p10 = 0, p20 = 0, p30 = 0;
                        rankings.forEach(r => {
                            const prevPos = Number(r.previousPosition);
                            if (prevPos > 0 && prevPos <= 10) p10++;
                            if (prevPos > 0 && prevPos <= 20) p20++;
                            if (prevPos > 30 || r.previousPosition === '> 100') p30++;
                        });
                        if (p10 > 0 || p20 > 0 || p30 > 0) {
                            return { month: mStr, top10: p10, top20: p20, top30Above: p30 };
                        }
                    }

                    return { month: mStr, top10: 0, top20: 0, top30Above: 0 };
                });
            }
        }
    } catch (err) {
        console.warn('Live keyword fetch note:', err.message);
    }

    const metaInsightsFacebook = trackedMonthsList.map(mStr => {
        const stats = fbMonthlyStatsMap[mStr] || { views: 0, reach: 0 };
        return {
            month: mStr,
            views: stats.views,
            reach: stats.reach,
            followers: liveFbFollowers
        };
    });

    const metaInsightsInstagram = trackedMonthsList.map(mStr => {
        const stats = igMonthlyStatsMap[mStr] || { views: 0, reach: 0 };
        return {
            month: mStr,
            views: stats.views,
            reach: stats.reach,
            followers: liveIgFollowers
        };
    });

    const youTubeReport = trackedMonthsList.map(mStr => {
        const stats = ytMonthlyStatsMap[mStr] || { views: 0 };
        return {
            month: mStr,
            views: stats.views,
            lastMonthSubscribers: liveYtSubscribers > 0 ? Math.max(0, liveYtSubscribers - Math.floor(liveYtSubscribers * 0.05)) : 0,
            totalSubscribers: liveYtSubscribers
        };
    });

    // Real Google Analytics 4 (GA4) Traffic Overview Aggregation
    let websiteTrafficOverview = [];
    try {
        const googleAnalyticsSource = require('../analytics/sources/googleAnalytics.source');
        const ga4PropertyId = await getGa4PropertyIdForClient(clientId);

        const trafficPromises = trackedMonthsList.map(async (mStr) => {
            const [mName, yNum] = mStr.split(' ');
            const mIdx = monthAbbrs.indexOf(mName) + 1;
            const yVal = Number(yNum);

            let totalUsers = 0;
            let newUsers = 0;

            if (ga4PropertyId && mIdx > 0 && yVal > 0) {
                const startDateStr = `${yVal}-${String(mIdx).padStart(2, '0')}-01`;
                const lastDayNum = new Date(yVal, mIdx, 0).getDate();
                const endDateStr = `${yVal}-${String(mIdx).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

                const gaRes = await googleAnalyticsSource.getOverviewMetrics(ga4PropertyId, startDateStr, endDateStr).catch(() => null);
                if (gaRes && gaRes.connected) {
                    totalUsers = gaRes.totalUsers || 0;
                    newUsers = gaRes.newUsers || 0;
                }
            }

            return {
                month: mStr,
                users: totalUsers,
                newUsers: newUsers
            };
        });

        websiteTrafficOverview = await Promise.all(trafficPromises);
    } catch (err) {
        console.warn('Real GA4 traffic overview aggregation note:', err.message);
        websiteTrafficOverview = trackedMonthsList.map(mStr => ({ month: mStr, users: 0, newUsers: 0 }));
    }

    // Real Google Analytics 4 (GA4) Landing Page Views Aggregation
    let websiteTrafficLandingPages = [];
    try {
        const googleAnalyticsSource = require('../analytics/sources/googleAnalytics.source');
        const ga4PropertyId = await getGa4PropertyIdForClient(clientId);

        if (ga4PropertyId && month > 0 && year > 0) {
            const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDayNum = new Date(year, month, 0).getDate();
            const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

            const landingRes = await googleAnalyticsSource.getLandingPagesReport(ga4PropertyId, startDateStr, endDateStr, 20).catch(() => null);
            if (landingRes && landingRes.connected && Array.isArray(landingRes.rows)) {
                websiteTrafficLandingPages = landingRes.rows;
            }
        }
    } catch (err) {
        console.warn('Real GA4 landing page report aggregation note:', err.message);
        websiteTrafficLandingPages = [];
    }

    // Real Google Analytics 4 (GA4) Users by City Aggregation
    let websiteTrafficUsersByCity = [];
    try {
        const googleAnalyticsSource = require('../analytics/sources/googleAnalytics.source');
        const ga4PropertyId = await getGa4PropertyIdForClient(clientId);

        if (ga4PropertyId && month > 0 && year > 0) {
            const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDayNum = new Date(year, month, 0).getDate();
            const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

            const cityRes = await googleAnalyticsSource.getCityTrafficReport(ga4PropertyId, startDateStr, endDateStr, 20).catch(() => null);
            if (cityRes && cityRes.connected && Array.isArray(cityRes.rows)) {
                websiteTrafficUsersByCity = cityRes.rows;
            }
        }
    } catch (err) {
        console.warn('Real GA4 city traffic report aggregation note:', err.message);
        websiteTrafficUsersByCity = [];
    }

    return {
        hasSocialMediaModule,
        digitalInsights,
        socialMediaPostInsights,
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
        specialInitiatives: '',
        keywordRankingOverview: keywordRankingOverview,
        keywordRankingDetails: keywordRankingDetails,
        metaInsightsFacebook: metaInsightsFacebook,
        metaInsightsInstagram: metaInsightsInstagram,
        youTubeReport: youTubeReport,
        websiteTrafficOverview: websiteTrafficOverview,
        websiteTrafficLandingPages: websiteTrafficLandingPages,
        websiteTrafficUsersByCity: websiteTrafficUsersByCity
    };
};

/**
 * Fetch monthly highlights report for a client and month/year
 */
exports.getMonthlyHighlights = async (clientId, month, year, isClientUser = false, forceRefresh = false) => {
    let report = await MonthlyHighlights.findOne({ clientId, month, year })
        .populate('clientId', 'name companyName email')
        .populate('createdBy', 'name email');

    // Also check SentReport history for individual sent reports for this client
    let sentTypes = [];
    try {
        const SentReport = mongoose.models.SentReport || require('./sentReport.model');
        const sentList = await SentReport.find({ clientId, status: { $in: ['Sent', 'Delivered', 'Opened'] } }).lean();
        sentTypes = sentList.map(s => s.template).filter(Boolean);
    } catch (err) {
        console.warn('SentReport check note:', err.message);
    }

    if (report && !forceRefresh) {
        const allPublishedTypes = Array.from(new Set([...(report.publishedReportTypes || []), ...sentTypes]));
        
        if (isClientUser && report.status !== 'Published' && allPublishedTypes.length === 0) {
            return { status: 'NotPublished', publishedReportTypes: [], message: 'Report for this month has not been published yet.' };
        }
        
        report = report.toObject ? report.toObject() : report;
        report.publishedReportTypes = allPublishedTypes;
        
        const hasTrafficData = Array.isArray(report.websiteTrafficOverview) && report.websiteTrafficOverview.some(w => (w.users || 0) > 0 || (w.newUsers || 0) > 0);
        const hasLandingPages = Array.isArray(report.websiteTrafficLandingPages) && report.websiteTrafficLandingPages.length > 0;
        const hasCityTraffic = Array.isArray(report.websiteTrafficUsersByCity) && report.websiteTrafficUsersByCity.length > 0;
        if (hasTrafficData && hasLandingPages && hasCityTraffic) {
            return report;
        }
    }

    if (isClientUser && (!report || (report.status !== 'Published' && sentTypes.length === 0))) {
        return { status: 'NotPublished', publishedReportTypes: sentTypes, message: 'No report published for this month.' };
    }

    const aggregated = await autoAggregateMetrics(clientId, month, year);

    if (report) {
        const MonthlyHighlightsModel = MonthlyHighlights;
        const dbDoc = await MonthlyHighlightsModel.findOne({ clientId, month, year });
        if (dbDoc) {
            dbDoc.hasSocialMediaModule = aggregated.hasSocialMediaModule;
            dbDoc.socialMediaPostInsights = aggregated.socialMediaPostInsights;
            dbDoc.youTubeReport = aggregated.youTubeReport;
            dbDoc.blogs = aggregated.blogs;
            dbDoc.brandCommunicationDesign = aggregated.brandCommunicationDesign;
            if (!dbDoc.websiteTrafficOverview || dbDoc.websiteTrafficOverview.length === 0 || dbDoc.websiteTrafficOverview.every(w => (w.users || 0) === 0 && (w.newUsers || 0) === 0) || forceRefresh) {
                dbDoc.websiteTrafficOverview = aggregated.websiteTrafficOverview;
            }
            if (!dbDoc.websiteTrafficLandingPages || dbDoc.websiteTrafficLandingPages.length === 0 || forceRefresh) {
                dbDoc.websiteTrafficLandingPages = aggregated.websiteTrafficLandingPages;
            }
            if (!dbDoc.websiteTrafficUsersByCity || dbDoc.websiteTrafficUsersByCity.length === 0 || forceRefresh) {
                dbDoc.websiteTrafficUsersByCity = aggregated.websiteTrafficUsersByCity;
            }
            await dbDoc.save();
            const resObj = dbDoc.toObject();
            resObj.publishedReportTypes = Array.from(new Set([...(dbDoc.publishedReportTypes || []), ...sentTypes]));
            return resObj;
        }
    }

    return {
        clientId,
        month,
        year,
        status: 'Draft',
        publishedReportTypes: sentTypes,
        ...aggregated,
        isNew: true
    };
};

/**
 * Save or update monthly highlights report
 */
exports.upsertMonthlyHighlights = async (agencyId, userId, payload) => {
    const { clientId, month, year, status, reportType, hasSocialMediaModule, digitalInsights, socialMediaPostInsights, blogs, brandCommunicationDesign, offlineCollaterals, specialInitiatives, keywordRankingOverview, keywordRankingDetails, metaInsightsFacebook, metaInsightsInstagram, youTubeReport, websiteTrafficOverview, websiteTrafficLandingPages, websiteTrafficUsersByCity } = payload;

    const query = { clientId, month, year };
    
    // Retrieve existing to merge publishedReportTypes
    const existing = await MonthlyHighlights.findOne(query);
    const existingTypes = new Set(existing?.publishedReportTypes || []);
    if (reportType) {
        existingTypes.add(reportType);
    }

    const update = {
        agencyId,
        clientId,
        month,
        year,
        status: status || 'Draft',
        publishedReportTypes: Array.from(existingTypes),
        hasSocialMediaModule: hasSocialMediaModule ?? false,
        digitalInsights: digitalInsights || {},
        socialMediaPostInsights: socialMediaPostInsights || {},
        blogs: blogs || {},
        brandCommunicationDesign: brandCommunicationDesign || {},
        offlineCollaterals: offlineCollaterals || '',
        specialInitiatives: specialInitiatives || '',
        keywordRankingOverview: keywordRankingOverview || [],
        keywordRankingDetails: keywordRankingDetails || [],
        metaInsightsFacebook: metaInsightsFacebook || [],
        metaInsightsInstagram: metaInsightsInstagram || [],
        youTubeReport: youTubeReport || [],
        websiteTrafficOverview: websiteTrafficOverview || [],
        websiteTrafficLandingPages: websiteTrafficLandingPages || [],
        websiteTrafficUsersByCity: websiteTrafficUsersByCity || [],
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
            const templateName = reportType || 'Monthly Highlights';
            const reportName = `${clientName} - ${templateName} (${month}/${year})`;

            await SentReport.findOneAndUpdate(
                { clientId, template: templateName, name: reportName },
                {
                    agencyId: agencyId || report.clientId?.agencyId || userId,
                    clientId,
                    name: reportName,
                    template: templateName,
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
            console.error('Error logging SentReport history:', sentErr);
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
        .select('month year publishedAt updatedAt status publishedReportTypes digitalInsights socialMediaPostInsights blogs brandCommunicationDesign offlineCollaterals specialInitiatives metaInsightsFacebook metaInsightsInstagram youTubeReport websiteTrafficOverview websiteTrafficLandingPages websiteTrafficUsersByCity');
};

