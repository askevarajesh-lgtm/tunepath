const IntelligenceRefreshJob = require('./models/intelligenceRefreshJob.model');
const SemrushProject = require('./models/semrushProject.model');
const OptimizationSnapshot = require('./models/optimizationSnapshot.model');
const crypto = require('crypto');
const semrushService = require('./semrush.service');
const providerNormalization = require('./providerNormalization.service');
const trackingService = require('./semrush.tracking');

class IntelligenceRefreshWorker {
    constructor() {
        this.leaseTimeoutMs = 5 * 60 * 1000; // 5 minutes
    }

    startCron() {
        const cron = require('node-cron');
        // Run daily at midnight local application time
        cron.schedule('0 0 * * *', async () => {
            console.log('[SemrushRefreshWorker] Running daily midnight refresh...');
            try {
                const projects = await SemrushProject.find({ isActive: true });
                for (const project of projects) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);

                    const existingSnapshot = await OptimizationSnapshot.findOne({
                        projectId: project._id,
                        collectedAt: { $gte: today, $lt: tomorrow }
                    });

                    if (!existingSnapshot) {
                        const db = project.trackingConfig?.location || 'us';
                        await this.queueRefresh(project._id, project.companyId, db);
                        console.log(`[SemrushRefreshWorker] Queued daily refresh for project: ${project.domain}`);
                    }
                }
            } catch (err) {
                console.error('[SemrushRefreshWorker] Error in daily cron:', err);
            }
        });
        console.log('[SemrushRefreshWorker] Daily midnight cron scheduled.');
    }

    async recoverStaleJobs() {
        const staleThreshold = new Date(Date.now() - this.leaseTimeoutMs);
        await IntelligenceRefreshJob.updateMany(
            { status: 'RUNNING', lastHeartbeatAt: { $lt: staleThreshold } },
            { $set: { status: 'QUEUED', lockedBy: null, lockedAt: null } }
        );
    }

    async queueRefresh(projectId, companyId, database = 'us') {
        try {
            const existingJob = await IntelligenceRefreshJob.findOne({
                projectId,
                companyId,
                status: { $in: ['QUEUED', 'RUNNING'] }
            });

            if (existingJob) {
                return { jobId: existingJob._id, status: existingJob.status, alreadyRunning: true };
            }

            const newJob = await IntelligenceRefreshJob.create({
                projectId,
                companyId,
                database,
                status: 'QUEUED'
            });

            // Fire and forget the worker
            this.processJob(newJob._id).catch(console.error);

            return { jobId: newJob._id, status: 'QUEUED', alreadyRunning: false };
        } catch (error) {
            if (error.code === 11000) {
                // Race condition caught by unique partial index
                const existingJob = await IntelligenceRefreshJob.findOne({
                    projectId, companyId, status: { $in: ['QUEUED', 'RUNNING'] }
                });
                return { jobId: existingJob._id, status: existingJob.status, alreadyRunning: true };
            }
            throw error;
        }
    }

    async processJob(jobId) {
        const workerId = `worker-${crypto.randomUUID()}`;

        const job = await IntelligenceRefreshJob.findOneAndUpdate(
            { _id: jobId, status: 'QUEUED' },
            {
                $set: {
                    status: 'RUNNING',
                    lockedBy: workerId,
                    lockedAt: new Date(),
                    startedAt: new Date(),
                    lastHeartbeatAt: new Date()
                },
                $inc: { attempts: 1 }
            },
            { new: true }
        );

        if (!job) return; // Claimed by another worker or not queued

        let heartbeatInterval;
        try {
            heartbeatInterval = setInterval(async () => {
                await IntelligenceRefreshJob.updateOne({ _id: jobId }, { $set: { lastHeartbeatAt: new Date() } });
            }, Math.floor(this.leaseTimeoutMs / 2));

            const project = await SemrushProject.findOne({ _id: job.projectId, companyId: job.companyId });
            if (!project) throw new Error('Project not found or unauthorized for this tenant');

            const domain = project.domain;
            let finalStatus = 'COMPLETED';

            // 1. Fetch from providers
            let semrushOverview = null;
            let semrushBacklinks = null;
            let semrushSiteHealth = null;
            let semrushTrafficAnalytics = null;
            let semrushPositionTracking = null;

            try {
                if (process.env.SEMRUSH_API_KEY) {
                    const db = job.database || 'us';
                    semrushOverview = await semrushService.getDomainOverview(domain, job.companyId, db).catch(e => { console.error(e); return null; });
                    semrushBacklinks = await semrushService.getBacklinksOverview(domain, job.companyId).catch(e => { console.error(e); return null; });
                    semrushSiteHealth = await semrushService.getSiteHealth(domain, job.companyId, db).catch(e => { console.error(e); return null; });

                    semrushTrafficAnalytics = await semrushService.getTrafficAnalytics(domain, job.companyId, true).catch(e => { console.error(e); return null; });

                    if (project.trackingConfig && project.trackingConfig.isActive) {
                        const trackingDb = project.trackingConfig.location || 'us';
                        const keywords = project.trackingConfig.keywords || [];
                        const campaignId = project.semrushCampaignId;
                        semrushPositionTracking = await trackingService.getPositionTrackingData(domain, trackingDb, keywords, campaignId, true).catch(e => { console.error(e); return null; });
                    }
                }
            } catch (e) {
                console.error('Semrush provider error:', e.message);
            }

            if (!semrushOverview && !semrushBacklinks && !semrushSiteHealth && !semrushTrafficAnalytics && !semrushPositionTracking) {
                finalStatus = 'FAILED';
            } else if (!semrushOverview || !semrushBacklinks || !semrushSiteHealth) {
                finalStatus = 'PARTIAL';
            }

            const previousSnapshot = project.latestSnapshot ? await OptimizationSnapshot.findById(project.latestSnapshot) : null;

            // 2. Normalize (Thin mapping of Semrush responses)
            // Initialize with previous valid data to prevent null overwrites
            const normalizedSeo = previousSnapshot?.seo ? JSON.parse(JSON.stringify(previousSnapshot.seo)) : {};

            if (semrushOverview) {
                Object.assign(normalizedSeo, providerNormalization.normalizeSemrushOverview(semrushOverview));
            }
            if (semrushBacklinks) {
                Object.assign(normalizedSeo, providerNormalization.normalizeSemrushBacklinks(semrushBacklinks));
            }

            if (semrushSiteHealth) {
                Object.assign(normalizedSeo, providerNormalization.normalizeSemrushSiteHealth(semrushSiteHealth));
            }

            const GeoAeoIntelligenceService = require('./geoAeoIntelligence.service');
            const geoAeoResult = await new GeoAeoIntelligenceService().evaluateDomain(domain);

            try {
                // Removed PSI and DataForSEO fallback
                // Core Web Vitals will be populated when we have a dedicated CWV source, for now leave it out or null.
            } catch (cwvErr) {
                console.error('Failed to fetch Core Web Vitals:', cwvErr.message);
            }

            const canonicalDataset = {
                seo: normalizedSeo,
                geo: previousSnapshot?.geo ? JSON.parse(JSON.stringify(previousSnapshot.geo)) : {},
                aeo: previousSnapshot?.aeo ? JSON.parse(JSON.stringify(previousSnapshot.aeo)) : {}
            };

            if (geoAeoResult.success) {
                Object.assign(canonicalDataset.geo, geoAeoResult.geo);
                Object.assign(canonicalDataset.aeo, geoAeoResult.aeo);
            } else {
                console.error('[INTELLIGENCE_REFRESH] GEO/AEO Evaluation failed, retaining previous data');
            }

            let completenessScore = 0;
            if (canonicalDataset.seo.organicTraffic !== undefined || canonicalDataset.seo.organicKeywordsData?.length > 0) completenessScore += 25;
            if (canonicalDataset.seo.backlinks !== undefined || canonicalDataset.seo.backlinksDetails) completenessScore += 25;
            if (canonicalDataset.seo.technicalScore !== undefined) completenessScore += 25;
            if (canonicalDataset.geo.eeatSignals?.value !== undefined) completenessScore += 25;

            const issueService = require('./issue.service');
            let { issues, recommendations } = issueService.generateIssuesAndRecommendations(canonicalDataset);

            if (geoAeoResult.success && geoAeoResult.recommendations && geoAeoResult.recommendations.length > 0) {
                recommendations = [...geoAeoResult.recommendations, ...recommendations];
            }

            const calcAverage = (metrics) => {
                const valid = metrics
                    .filter(m => m !== null && m !== undefined && m !== '')
                    .map(m => Number(m))
                    .filter(m => !isNaN(m));
                if (valid.length === 0) return null;
                return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
            };

            const newScores = {
                overall: null,
                seo: calcAverage([
                    canonicalDataset.seo.technicalScore?.value,
                    canonicalDataset.seo.authorityScore?.value,
                    canonicalDataset.seo.coreWebVitals?.value
                ]),
                geo: calcAverage([
                    canonicalDataset.geo.eeatSignals?.value,
                    canonicalDataset.geo.aiReadability?.value,
                    canonicalDataset.geo.llmFormatting?.value,
                    canonicalDataset.geo.semanticCoverage?.value
                ]),
                aeo: calcAverage([
                    canonicalDataset.aeo.faqSchema?.value,
                    canonicalDataset.aeo.answerIntent?.value,
                    canonicalDataset.aeo.voiceSearchScore?.value,
                    canonicalDataset.aeo.conversationalContent?.value
                ]),
                recommendations
            };

            // Calculate overall if any scores exist
            const overallScores = [newScores.seo, newScores.geo, newScores.aeo].filter(s => s !== null);
            if (overallScores.length > 0) {
                newScores.overall = calcAverage(overallScores);
            }
            const newSnapshot = await OptimizationSnapshot.create({
                projectId: job.projectId,
                companyId: job.companyId,
                domain: project.domain,
                runId: job._id,
                status: finalStatus,
                dataCompleteness: completenessScore,
                scores: newScores,
                seo: canonicalDataset.seo,
                geo: canonicalDataset.geo,
                aeo: canonicalDataset.aeo,
                promotionReason: 'First successful run'
            });


            let shouldPromote = false;

            if (newSnapshot.status === 'COMPLETED' || newSnapshot.status === 'PARTIAL') {
                if (!previousSnapshot) {
                    shouldPromote = true;
                    newSnapshot.promotionReason = 'No previous snapshot, promoting PARTIAL';
                } else if (newSnapshot.dataCompleteness >= previousSnapshot.dataCompleteness) {
                    shouldPromote = true;
                    newSnapshot.promotionReason = 'PARTIAL snapshot has better or equal completeness';
                } else {
                    newSnapshot.promotionReason = 'Previous snapshot has better completeness. Retaining old snapshot.';
                }
            } else {
                newSnapshot.promotionReason = 'Insufficient completeness for promotion';
            }

            await newSnapshot.save();

            if (shouldPromote) {
                project.latestSnapshot = newSnapshot._id;
                await project.save();
            }

            await IntelligenceRefreshJob.updateOne(
                { _id: jobId },
                { $set: { status: newSnapshot.status, completedAt: new Date() } }
            );

        } catch (error) {
            await IntelligenceRefreshJob.updateOne(
                { _id: jobId },
                { $set: { status: 'FAILED', error: error.message, completedAt: new Date() } }
            );
        } finally {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
    }
}

module.exports = new IntelligenceRefreshWorker();
