
const mongoose = require('mongoose');
const semrushService = require('./semrush.service');
const trackingService = require('./semrush.tracking');
const SemrushProject = require('./models/semrushProject.model');
const SemrushProjectData = require('./models/semrushProjectData.model');
const providerNormalization = require('./providerNormalization.service');

const OptimizationSnapshot = require('./models/optimizationSnapshot.model');
const intelligenceComparisonService = require('./intelligenceComparison.service');

exports.getProjects = async (req, res) => {
    try {
        const filter = { companyId: req.companyId, isActive: true };
        const isClient = ['client', 'agency_client', 'brand_team_user', 'client_user', 'brand_manager'].includes(req.user.role);
        if (isClient) {
            const myClientId = req.user.brandId || req.user._id;
            filter.$or = [{ clientId: myClientId }, { createdBy: req.user._id }];
        } else if (req.query.clientId) {
            filter.clientId = req.query.clientId;
        }

        const projects = await SemrushProject.find(filter)
            .populate('latestSnapshot')
            .lean()
            .sort({ createdAt: -1 });

        const enrichedProjects = await Promise.all(projects.map(async (project) => {
            let snap = project.latestSnapshot;
            if (!snap) {
                snap = await OptimizationSnapshot.findOne({ projectId: project._id }).sort({ createdAt: -1 }).lean();
            }
            const lastRefresh = project.lastRefresh || snap?.collectedAt || snap?.createdAt || snap?.updatedAt || project.updatedAt || project.createdAt;
            return {
                ...project,
                lastRefresh,
                latestSnapshot: snap || project.latestSnapshot,
                optimizationScore: snap?.scores ? {
                    overallScore: snap.scores.overall,
                    seoScore: snap.scores.seo,
                    geoScore: snap.scores.geo,
                    aeoScore: snap.scores.aeo
                } : null,
                stats: {
                    siteHealth: snap?.seo?.technicalScore?.value ?? null,
                    visibility: snap?.seo?.authorityScore?.value ?? null,
                    organicTraffic: snap?.seo?.organicTraffic?.value ?? null,
                    organicKeywords: snap?.seo?.organicKeywords?.value ?? null,
                    backlinks: snap?.seo?.backlinks?.value ?? null
                }
            };
        }));

        res.status(200).json({ success: true, data: enrichedProjects });
    } catch (error) {
        console.error('[Semrush Controller - getProjects]', error);
        res.status(500).json({ success: false, message: error.stack });
    }
};

exports.createProject = async (req, res) => {
    try {
        const { domain, name } = req.body;
        if (!domain || !name) {
            return res.status(400).json({ success: false, message: 'Domain and name are required' });
        }

        const isClient = ['client', 'agency_client', 'brand_team_user', 'client_user', 'brand_manager'].includes(req.user.role);
        const myClientId = req.user.brandId || req.user._id;
        const finalClientId = isClient ? myClientId : (req.body.clientId || null);

        const existing = await SemrushProject.findOne({ companyId: req.companyId, domain });
        if (existing) {
            if (existing.isActive) {
                return res.status(400).json({ success: false, message: 'Project for this domain already exists' });
            } else {
                existing.isActive = true;
                existing.name = name;
                existing.clientId = finalClientId;
                await existing.save();
                return res.status(201).json({ success: true, data: existing, message: 'Project reactivated' });
            }
        }

        const project = new SemrushProject({
            companyId: req.companyId,
            createdBy: req.user._id,
            domain,
            name,
            clientId: finalClientId
        });

        await project.save();

        // We don't block on initial data fetch to keep UI responsive. We can trigger a background refresh or just return empty.
        res.status(201).json({ success: true, data: project });
    } catch (error) {
        console.error('[Semrush Controller - createProject]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};



const IntelligenceRefreshJob = require('./models/intelligenceRefreshJob.model');

const mapSnapshotData = (snap, activeJob) => {
    return snap?.seo ? {
        overview: {
            'Organic Traffic': snap.seo.organicTraffic?.value,
            'Organic Keywords': snap.seo.organicKeywords?.value,
            'Adwords Traffic': snap.seo.paidTraffic?.value ?? 0,
            Rank: snap.seo.authorityScore?.value,
            visibility_index: snap.seo.semrushRank?.value,
            competitors: snap.seo.competitors || [],
            trend: snap.seo.trend || [],
            topKeywords: snap.seo.topKeywords || [],
            positionDistribution: snap.seo.positionDistribution || null,
            intentDistribution: snap.seo.intentDistribution || null
        },
        backlinksOverview: {
            total: snap.seo.backlinks?.value,
            score: snap.seo.authorityScore?.value,
            ...(snap.seo.backlinksDetails || {})
        },
        siteHealth: {
            overallScore: snap.seo.technicalScore?.value ?? null,
            rawData: snap.seo.siteHealthDetails || null
        },
        organicKeywords: snap.seo.organicKeywordsData || [],
        trafficAnalytics: snap.seo.trafficAnalytics || null,
        positionTracking: snap.seo.positionTracking || null,
        snapshot: snap,
        activeJob: activeJob ? {
            status: activeJob.status,
            startedAt: activeJob.startedAt,
            id: activeJob._id
        } : null
    } : {
        overview: {},
        backlinksOverview: {},
        siteHealth: {},
        organicKeywords: [],
        trafficAnalytics: null,
        positionTracking: null,
        snapshot: snap,
        activeJob: activeJob ? {
            status: activeJob.status,
            startedAt: activeJob.startedAt,
            id: activeJob._id
        } : null
    };
};

exports.getProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ success: false, message: 'Invalid project ID format' });
        }

        const project = await SemrushProject.findOne({ _id: id, companyId: req.companyId, isActive: true })
            .populate('latestSnapshot')
            .lean();

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        let snap = project.latestSnapshot;
        if (!snap) {
            snap = await OptimizationSnapshot.findOne({ projectId: id }).sort({ createdAt: -1 }).lean();
        }

        const lastRefreshDate = project.lastRefresh || snap?.collectedAt || snap?.createdAt || snap?.updatedAt || project.updatedAt || project.createdAt;
        project.lastRefresh = lastRefreshDate;
        if (snap && !project.latestSnapshot) {
            project.latestSnapshot = snap;
        }

        // Check if there is an active job running for this project
        const activeJob = await IntelligenceRefreshJob.findOne({
            companyId: req.companyId,
            projectId: id,
            status: { $in: ['QUEUED', 'RUNNING'] }
        });

        const mappedData = mapSnapshotData(snap || {}, activeJob);

        res.status(200).json({ success: true, project, data: mappedData });
    } catch (error) {
        console.error('[Semrush Controller - getProjectById]', error);
        res.status(500).json({ success: false, message: error.stack });
    }
};

exports.refreshProject = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ success: false, message: 'Invalid project ID format' });
        }
        const project = await SemrushProject.findOne({ _id: id, companyId: req.companyId, isActive: true });
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        const database = req.body.database || 'us';

        let job;
        try {
            const refreshWorker = require('./refresh.job');
            const queueResult = await refreshWorker.queueRefresh(project._id, req.companyId, database);
            job = { _id: queueResult.jobId, status: queueResult.status };
        } catch (err) {
            console.error('[Semrush Controller - Queue Refresh Error]', err);
            job = await IntelligenceRefreshJob.findOne({
                companyId: req.companyId,
                projectId: project._id,
                status: { $in: ['QUEUED', 'RUNNING'] }
            });
        }

        res.status(202).json({ success: true, message: 'Refresh queued', job });
    } catch (error) {
        console.error('[Semrush Controller - refreshProject]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ success: false, message: 'Invalid project ID format' });
        }
        const project = await SemrushProject.findOneAndUpdate(
            { _id: id, companyId: req.companyId },
            { $set: { isActive: false } },
            { new: true }
        );
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }
        res.status(200).json({ success: true, message: 'Project deleted' });
    } catch (error) {
        console.error('[Semrush Controller - deleteProject]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ success: false, message: 'Invalid project ID format' });
        }
        const updates = req.body;

        // Prevent updating critical non-editable fields if any
        delete updates._id;
        delete updates.companyId;

        const project = await SemrushProject.findOneAndUpdate(
            { _id: id, companyId: req.companyId, isActive: true },
            updates,
            { new: true, runValidators: true }
        );
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }
        res.status(200).json({ success: true, data: project });
    } catch (error) {
        console.error('[Semrush Controller - updateProject]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.configureTracking = async (req, res) => {
    try {
        const { id } = req.params;
        const { device, location, keywords } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ success: false, message: 'Invalid project ID format' });
        }

        // limit keywords to 100 max
        const limitedKeywords = (keywords || []).slice(0, 100);

        // Fetch project from DB first to get the domain
        let project = await SemrushProject.findOne({ _id: id, companyId: req.companyId });
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        let semrushProjectId = project.semrushProjectId;
        let semrushCampaignId = project.semrushCampaignId;

        // Connect to Semrush Management API
        try {
            if (!semrushProjectId) {
                const srProjects = await semrushService.getProjects();
                const existing = srProjects.find(p => p.url === project.domain || p.project_name === project.domain);
                if (existing) {
                    semrushProjectId = existing.project_id;
                } else {
                    const newProj = await semrushService.createProject(project.domain);
                    if (newProj && newProj.project_id) {
                        semrushProjectId = newProj.project_id;
                    }
                }
            }

            if (semrushProjectId && !semrushCampaignId) {
                const campaigns = await semrushService.getTrackingCampaigns(semrushProjectId);
                if (campaigns && campaigns.length > 0) {
                    semrushCampaignId = campaigns[0].id; // Just pick the first tracking campaign
                } else {
                    // Default to US (2840) or India (2356) based on location param if possible
                    const locId = location === 'in' ? 2356 : 2840;
                    await semrushService.enableTrackingCampaign(semrushProjectId, project.domain, locId);
                    // Wait a moment and fetch campaigns again to get the generated ID
                    await new Promise(r => setTimeout(r, 2000));
                    const newCampaigns = await semrushService.getTrackingCampaigns(semrushProjectId);
                    if (newCampaigns && newCampaigns.length > 0) {
                        semrushCampaignId = newCampaigns[0].id;
                    }
                }
            }
        } catch (apiErr) {
            console.error('[Semrush Controller - Sync API Error]', apiErr.message);
            // We log but continue, ensuring the local DB is updated at least
        }

        project = await SemrushProject.findOneAndUpdate(
            { _id: id, companyId: req.companyId },
            {
                $set: {
                    semrushProjectId: semrushProjectId,
                    semrushCampaignId: semrushCampaignId,
                    trackingConfig: {
                        isActive: true,
                        searchEngine: 'Google',
                        device: device || 'Desktop',
                        location: location || 'us',
                        businessName: '',
                        keywords: limitedKeywords,
                        lastUpdated: new Date()
                    }
                }
            },
            { new: true }
        );

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        // Sync keywords to Semrush campaign in the background (do not block response)
        if (semrushCampaignId && limitedKeywords.length > 0) {
            semrushService.syncKeywordsToCampaign(semrushCampaignId, limitedKeywords)
                .catch(err => console.error('[configureTracking] Keyword sync failed:', err.message));
        }

        res.status(200).json({ success: true, message: 'Tracking configured. Keywords synced to Semrush — rankings will appear within 24 hours.', data: project });
    } catch (error) {
        console.error('[Semrush Controller - configureTracking]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPositionTracking = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ success: false, message: 'Invalid project ID format' });
        }
        const project = await SemrushProject.findOne({ _id: id, companyId: req.companyId, isActive: true });
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        if (!process.env.SEMRUSH_API_KEY) {
            return res.status(200).json({
                success: true,
                status: 'not_configured',
                source: 'semrush',
                data: null,
                measuredAt: null
            });
        }

        if (!project.trackingConfig || !project.trackingConfig.isActive) {
            return res.status(200).json({ success: true, status: 'campaign_required', data: { isConfigured: false } });
        }

        if (!project.semrushCampaignId) {
            return res.status(200).json({ success: true, status: 'unavailable', errorCode: 'campaign_unavailable', data: null });
        }

        const domain = project.domain;
        const { database = 'in', device = 'Desktop' } = project.trackingConfig;
        const keywords = project.trackingConfig.keywords || [];
        const campaignId = project.semrushCampaignId;
        const force = req.query.force === 'true';

        const trackingData = await trackingService.getPositionTrackingData(domain, database, keywords, campaignId, force, req.companyId);

        if (trackingData.error === 'campaign_unavailable') {
            return res.status(200).json({ success: true, status: 'unavailable', errorCode: 'campaign_unavailable', data: null });
        }

        res.status(200).json({
            success: true,
            status: 'available',
            source: 'semrush',
            data: {
                config: project.trackingConfig,
                ...(trackingData || { rankings: [] })
            },
            measuredAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Semrush Controller - getPositionTracking]', error);
        res.status(200).json({
            success: true,
            status: 'failed',
            source: 'semrush',
            errorCode: error.message,
            data: null,
            measuredAt: null
        });
    }
};

exports.getDomainOverview = async (req, res) => {
    try {
        const { id } = req.params;
        const force = req.query.force === 'true';
        const project = await SemrushProject.findOne({ _id: id, companyId: req.companyId, isActive: true });

        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        const domain = project.domain;
        const database = project.trackingConfig?.location || 'us';

        const rawData = await semrushService.getDomainOverview(domain, req.companyId, database, force);
        const normalizedData = providerNormalization.normalizeSemrushOverview(rawData);

        const snapshot = await OptimizationSnapshot.findOne({ projectId: id }).sort({ createdAt: -1 });
        if (snapshot) {
            if (!snapshot.seo) snapshot.seo = {};
            Object.assign(snapshot.seo, normalizedData);
            await snapshot.save();
        }

        res.status(200).json({
            success: true,
            status: 'available',
            source: 'semrush',
            data: normalizedData,
            measuredAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(200).json({ success: true, status: 'failed', source: 'semrush', errorCode: error.message, data: null });
    }
};

exports.getOrganicResearch = async (req, res) => {
    try {
        const { id } = req.params;
        const force = req.query.force === 'true';
        const project = await SemrushProject.findOne({ _id: id, companyId: req.companyId, isActive: true });

        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        const domain = project.domain;
        const database = project.trackingConfig?.location || 'us';

        const rawData = await semrushService.getDomainKeywordsDrilldown(domain, req.companyId, database, 100, force);

        // The previous implementation stored organic keywords data directly in snapshot.seo.organicKeywordsData
        const normalizedData = { organicKeywordsData: rawData || [] };

        const snapshot = await OptimizationSnapshot.findOne({ projectId: id }).sort({ createdAt: -1 });
        if (snapshot) {
            if (!snapshot.seo) snapshot.seo = {};
            Object.assign(snapshot.seo, normalizedData);
            await snapshot.save();
        }

        res.status(200).json({
            success: true,
            status: 'available',
            source: 'semrush',
            data: normalizedData,
            measuredAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(200).json({ success: true, status: 'failed', source: 'semrush', errorCode: error.message, data: null });
    }
};

exports.getCompetitorAnalysis = async (req, res) => {
    try {
        const { id } = req.params;
        const force = req.query.force === 'true';
        const project = await SemrushProject.findOne({ _id: id, companyId: req.companyId, isActive: true });

        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        const domain = project.domain;
        const database = project.trackingConfig?.location || 'us';

        const rawData = await semrushService.getCompetitorAnalysis(domain, req.companyId, database, 20, force);
        const normalizedData = { competitors: rawData || [] };

        const snapshot = await OptimizationSnapshot.findOne({ projectId: id }).sort({ createdAt: -1 });
        if (snapshot) {
            if (!snapshot.seo) snapshot.seo = {};
            Object.assign(snapshot.seo, normalizedData);
            await snapshot.save();
        }

        res.status(200).json({
            success: true,
            status: 'available',
            source: 'semrush',
            data: normalizedData,
            measuredAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(200).json({ success: true, status: 'failed', source: 'semrush', errorCode: error.message, data: null });
    }
};

exports.getBacklinks = async (req, res) => {
    try {
        const { id } = req.params;
        const force = req.query.force === 'true';
        const project = await SemrushProject.findOne({ _id: id, companyId: req.companyId, isActive: true });

        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        const domain = project.domain;
        const rawData = await semrushService.getBacklinksOverview(domain, req.companyId, force);
        const normalizedData = providerNormalization.normalizeSemrushBacklinks(rawData);

        const snapshot = await OptimizationSnapshot.findOne({ projectId: id }).sort({ createdAt: -1 });
        if (snapshot) {
            if (!snapshot.seo) snapshot.seo = {};
            Object.assign(snapshot.seo, normalizedData);
            await snapshot.save();
        }

        res.status(200).json({
            success: true,
            status: 'available',
            source: 'semrush',
            data: normalizedData,
            measuredAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(200).json({ success: true, status: 'failed', source: 'semrush', errorCode: error.message, data: null });
    }
};

exports.getSiteAudit = async (req, res) => {
    try {
        const { id } = req.params;
        const force = req.query.force === 'true';
        const project = await SemrushProject.findOne({ _id: id, companyId: req.companyId, isActive: true });

        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        const domain = project.domain;

        const rawData = await semrushService.getSiteHealth(domain, req.companyId, 'us', force);
        if (!rawData || rawData.status === 'unavailable' || rawData.status === 'failed') {
            return res.status(200).json({ success: true, status: rawData?.status || 'unavailable', source: 'semrush', data: null });
        }

        const normalizedData = providerNormalization.normalizeSemrushSiteHealth(rawData);

        const snapshot = await OptimizationSnapshot.findOne({ projectId: id }).sort({ createdAt: -1 });
        if (snapshot) {
            if (!snapshot.seo) snapshot.seo = {};
            Object.assign(snapshot.seo, normalizedData);
            await snapshot.save();
        }

        res.status(200).json({
            success: true,
            status: 'available',
            source: 'semrush',
            data: normalizedData,
            measuredAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(200).json({ success: true, status: 'failed', source: 'semrush', errorCode: error.message, data: null });
    }
};

exports.getGeoAeo = async (req, res) => {
    try {
        const { id } = req.params;
        const force = req.query.force === 'true';
        const project = await SemrushProject.findOne({ _id: id, companyId: req.companyId, isActive: true });

        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        const GeoAeoIntelligenceService = require('./geoAeoIntelligence.service');
        const geoAeoResult = await new GeoAeoIntelligenceService().evaluateDomain(project.domain, { force });

        const snapshot = await OptimizationSnapshot.findOne({ projectId: id }).sort({ createdAt: -1 });
        if (snapshot && geoAeoResult.success) {
            if (!snapshot.geo) snapshot.geo = {};
            if (!snapshot.aeo) snapshot.aeo = {};
            Object.assign(snapshot.geo, geoAeoResult.geo);
            Object.assign(snapshot.aeo, geoAeoResult.aeo);
            await snapshot.save();
        }

        res.status(200).json({
            success: true,
            status: 'available',
            source: 'intelligence-ai',
            data: {
                geo: geoAeoResult.geo,
                aeo: geoAeoResult.aeo
            },
            measuredAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(200).json({ success: true, status: 'failed', source: 'intelligence-ai', errorCode: error.message, data: null });
    }
};

exports.getTrafficAnalytics = async (req, res) => {
    try {
        const { id } = req.params;
        const force = req.query.force === 'true';

        if (!process.env.SEMRUSH_API_KEY) {
            return res.status(200).json({
                success: true,
                status: 'not_configured',
                source: 'semrush',
                data: null,
                measuredAt: null
            });
        }

        const project = await SemrushProject.findOne({ _id: id, companyId: req.companyId, isActive: true });
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        const rawData = await semrushService.getTrafficAnalytics(project.domain, req.companyId, force);
        const normalizedData = providerNormalization.normalizeTrafficAnalytics(rawData);

        const snapshot = await OptimizationSnapshot.findOne({ projectId: id }).sort({ createdAt: -1 });
        if (snapshot && normalizedData) {
            if (!snapshot.seo) snapshot.seo = {};
            Object.assign(snapshot.seo, normalizedData);
            await snapshot.save();
        }

        res.status(200).json({
            success: true,
            status: 'available',
            source: 'semrush',
            data: rawData,
            measuredAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(200).json({ success: true, status: 'failed', source: 'semrush', errorCode: error.message, data: null });
    }
};

exports.getKeywordMagicTool = async (req, res) => {
    try {
        const { keyword, database, matchType, force } = req.query;

        if (!process.env.SEMRUSH_API_KEY) {
            return res.status(200).json({
                success: true,
                status: 'not_configured',
                source: 'semrush',
                data: null,
                measuredAt: null
            });
        }

        if (!keyword) {
            return res.status(400).json({ success: false, message: 'Keyword is required' });
        }

        const data = await semrushService.getKeywordMagicTool(keyword, req.companyId, database || 'us', matchType || 'phrase', force === 'true');

        res.status(200).json({
            success: true,
            status: 'available',
            source: 'semrush',
            data,
            measuredAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Semrush Controller - getKeywordMagicTool]', error);
        res.status(200).json({
            success: true,
            status: 'failed',
            source: 'semrush',
            errorCode: error.message,
            data: null,
            measuredAt: null
        });
    }
};

exports.getHistoricalSnapshots = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ success: false, message: 'Invalid project ID format' });
        }
        const snapshots = await OptimizationSnapshot.find({ projectId: id, companyId: req.companyId })
            .sort({ createdAt: -1 })
            .limit(10);
        res.status(200).json({ success: true, data: snapshots });
    } catch (error) {
        console.error('[Semrush Controller - getHistoricalSnapshots]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getLatestSnapshot = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ success: false, message: 'Invalid project ID format' });
        }
        const snapshot = await OptimizationSnapshot.findOne({ projectId: id, companyId: req.companyId })
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: snapshot });
    } catch (error) {
        console.error('[Semrush Controller - getLatestSnapshot]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSnapshotById = async (req, res) => {
    try {
        const { id, snapshotId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(snapshotId)) {
            return res.status(404).json({ success: false, message: 'Invalid project or snapshot ID format' });
        }

        const snap = await OptimizationSnapshot.findOne({ _id: snapshotId, projectId: id, companyId: req.companyId });
        if (!snap) {
            return res.status(404).json({ success: false, message: 'Snapshot not found' });
        }

        const mappedData = mapSnapshotData(snap, null);
        res.status(200).json({ success: true, data: mappedData });
    } catch (error) {
        console.error('[Semrush Controller - getSnapshotById]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getActivitySnapshots = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ success: false, message: 'Invalid project ID format' });
        }

        const snapshots = await OptimizationSnapshot.find({ projectId: id, companyId: req.companyId })
            .select('_id collectedAt createdAt')
            .sort({ collectedAt: -1 });

        const snapshotsByDate = {};
        for (const snap of snapshots) {
            const date = new Date(snap.collectedAt);
            const dateStr = date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
            if (!snapshotsByDate[dateStr]) {
                snapshotsByDate[dateStr] = [];
            }
            snapshotsByDate[dateStr].push(snap);
        }

        const dailySnapshots = Object.values(snapshotsByDate).map(daySnaps => {
            let closestSnap = daySnaps[0];
            let minDiff = Infinity;
            for (const snap of daySnaps) {
                const date = new Date(snap.collectedAt);
                const msSinceMidnight = date.getHours() * 3600000 + date.getMinutes() * 60000 + date.getSeconds() * 1000;
                if (msSinceMidnight < minDiff) {
                    minDiff = msSinceMidnight;
                    closestSnap = snap;
                }
            }
            return closestSnap;
        });

        dailySnapshots.sort((a, b) => new Date(b.collectedAt) - new Date(a.collectedAt));

        res.status(200).json({ success: true, snapshots: dailySnapshots });
    } catch (error) {
        console.error('[Semrush Controller - getActivitySnapshots]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getActivityComparison = async (req, res) => {
    try {
        const { id } = req.params;
        const { from, to } = req.query;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ success: false, message: 'Invalid project ID format' });
        }

        let current, previous;

        if (from && to) {
            previous = await OptimizationSnapshot.findOne({ _id: from, projectId: id, companyId: req.companyId });
            current = await OptimizationSnapshot.findOne({ _id: to, projectId: id, companyId: req.companyId });

            if (!current || !previous) {
                return res.status(404).json({ success: false, message: 'One or both snapshots not found' });
            }
        } else {
            const snapshots = await OptimizationSnapshot.find({ projectId: id, companyId: req.companyId })
                .sort({ collectedAt: -1 })
                .limit(2);

            if (snapshots.length === 0) {
                return res.status(404).json({ success: false, message: 'No snapshots found' });
            }

            current = snapshots[0];
            previous = snapshots.length > 1 ? snapshots[1] : null;
        }

        const comparison = intelligenceComparisonService.compareSnapshots(previous, current);

        res.status(200).json({ success: true, data: comparison });
    } catch (error) {
        console.error('[Semrush Controller - getActivityComparison]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
