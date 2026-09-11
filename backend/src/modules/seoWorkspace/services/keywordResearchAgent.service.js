const WorkspaceProject = require('../models/workspaceProject.model');
const WorkspaceKeyword = require('../models/workspaceKeyword.model');
const WorkspaceAuditPage = require('../models/workspaceAuditPage.model');
const WorkspaceCrawlJob = require('../models/workspaceCrawlJob.model');
const WorkspaceCrawlQueue = require('../models/workspaceCrawlQueue.model');
const GoogleService = require('../../seoIntelligence/services/google.service');
const keywordIntelligence = require('./keywordIntelligence.service');
const providerChain = require('../providers/keywordProviderChain');
const auditLogService = require('./auditLog.service');
const recommendationMemory = require('./recommendationMemory.service');
const { keywordEvents, EVENTS } = require('../events/keywordEvents');

const aiEngine = require('../../aiCore/aiEngine.service');
const executionQueue = require('../../aiCore/executionQueue.service');
const retry = require('../../aiCore/retry.service');
const logger = require('../../aiCore/logger.service');
const sharedMemory = require('../../aiCore/sharedMemory.service');
const agentLoader = require('../../aiCore/agentLoader.service');
const axios = require('axios');
const cheerio = require('cheerio');
const hybridKeywordExtractor = require('./hybridKeywordExtractor.service');
const rankTrackingService = require('./rankTracking.service');

const AGENT_KEY = 'keyword-research';
const TAG = 'KeywordResearchAgent';

const MAX_CANDIDATES = 40;
const MAX_SUGGESTIONS = 15;
const DEFAULT_LOCATION_CODE = 2840;
const DEFAULT_LANGUAGE_CODE = 'en';

async function fetchGscQueries(project) {
  let gscQueries = [];
  try {
    const gscPath = process.env.GSC_CREDENTIALS || process.env.GA4_CREDENTIALS;
    if (gscPath) {
       const googleService = new GoogleService(gscPath);
       const domain = project.domain.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '').trim();
       const siteUrl = project.siteUrl || `sc-domain:${domain}`;
       const endDate = new Date().toISOString().split('T')[0];
       const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
       const gscData = await googleService.getSearchConsoleData(siteUrl, startDate, endDate);
       if (gscData && gscData.rows) {
          gscQueries = gscData.rows.map(r => ({
             keyword: r.keys[0],
             clicks: r.clicks,
             impressions: r.impressions,
             ctr: r.ctr,
             position: r.position,
             source: 'GSC'
          }));
          logger.info(TAG, `Fetched ${gscQueries.length} queries from GSC for ${siteUrl}`);
       }
    }
  } catch (error) {
    logger.warn(TAG, `GSC fetch failed for ${project.domain}: ${error.message}`);
  }
  return gscQueries;
}

async function fetchCrawlEvidence(project) {
  let pages = await WorkspaceAuditPage.find({ projectId: project._id }).limit(5).lean();
  let partial = false;
  
  if (pages.length === 0) {
     logger.info(TAG, `No crawl data found for ${project.domain}. Attempting synchronous partial crawl.`);
     try {
       const siteUrl = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`;
       const response = await axios.get(siteUrl, { timeout: 10000, maxRedirects: 3 });
       const $ = cheerio.load(response.data);
       pages = [{
          url: siteUrl,
          title: $('title').text().trim(),
          metaDescription: $('meta[name="description"]').attr('content') || '',
          h1: $('h1').map((_, el) => $(el).text().trim()).get(),
          textSnippet: $('p').map((_, el) => $(el).text().trim()).get().join(' ').substring(0, 1000)
       }];
       partial = true;
     } catch (err) {
       logger.warn(TAG, `Synchronous partial crawl failed: ${err.message}`);
     }
  } else {
     pages = pages.map(p => ({
        url: p.url,
        title: p.title,
        metaDescription: p.metaDescription,
        h1: p.h1,
        h2: p.h2
     }));
  }
  return { pages, partial };
}

async function collectKeywordCandidates() {
  return []; // Deprecated, unused but kept for backwards compatibility if called elsewhere
}

async function analyzeAndSuggest() {
  return { summary: '', selected: [] }; // Deprecated, unused but kept for backwards compatibility
}

async function run(projectId, workspaceId, options = {}) {
  const project = await WorkspaceProject.findById(projectId);
  if (!project) throw new Error('Project not found');
  const agencyId = workspaceId || project.createdBy || project.companyId;

  // Clear stale discovery_crawler keywords
  await WorkspaceKeyword.deleteMany({
    projectId: project._id,
    source: 'discovery_crawler',
    status: { $in: ['Suggested', 'Discovered'] }
  });

  try {
    const existingJob = await WorkspaceCrawlJob.findOne({ projectId: project._id, status: 'running' });
    if (!existingJob) {
      const job = await WorkspaceCrawlJob.create({
        projectId: project._id,
        agencyId,
        status: 'running',
        startedAt: new Date(),
        progress: { pagesCrawled: 0, keywordsExtracted: 0, duplicatesRemoved: 0, keywordsSaved: 0 }
      });
      const siteUrl = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`;
      await WorkspaceCrawlQueue.create({ jobId: job._id, url: siteUrl, status: 'pending' });
      const crawlWorker = require('./crawler.worker.js');
      if (!crawlWorker.isRunning) crawlWorker.start();
    }
  } catch (e) {
    logger.error(TAG, `Failed to launch crawl worker: ${e.message}`);
  }

  logger.logExecution({
    executionId: `keywordResearchAgent:${projectId}:${Date.now()}`,
    source: 'keywordResearchAgent',
    agentKey: AGENT_KEY,
    projectId,
    status: 'started'
  });

  const [{ pages, partial }, gscQueries] = await Promise.all([
     fetchCrawlEvidence(project),
     fetchGscQueries(project)
  ]);

  if (pages.length === 0 && gscQueries.length === 0) {
     return { candidateCount: 0, suggestedKeywords: [], summary: 'Keyword discovery crawl has been queued. No existing data found. Keywords will appear shortly.' };
  }

  const agentConfig = await agentLoader.resolve(AGENT_KEY);
  const skillsBlock = agentLoader.loadSkillsForAgent(agentConfig);
  const targetCount = 5;
  
  let claudeCandidates = [];
  let aiSummary = "";
  if (pages.length > 0) {
      const prompt = `You are the Keyword Research Agent for ${project.name} (${project.domain}).
      
      Here is the actual crawled evidence from the website:
      ${JSON.stringify(pages, null, 2)}
      ${skillsBlock}
      
      Based STRICTLY on the content provided above, extract ${targetCount} high-intent B2B or relevant keywords.
      For each keyword, you MUST provide the exact URL and HTML element (e.g. Title, H1) that supports it.
      DO NOT invent generic keywords that are not directly supported by this evidence.
      
      Respond with a JSON object of this exact shape:
      {
        "summary": "2-4 sentence summary of the SEO themes found on the site.",
        "keywords": [
          { 
            "keyword": "example keyword",
            "opportunityScore": 80, 
            "rationale": "Why this is a good target", 
            "theme": "short label",
            "sourceUrls": ["https://..."],
            "supportingElements": ["H1: ..."]
          }
        ]
      }
      Respond ONLY with valid JSON, no markdown formatting.`;

      try {
          const raw = await aiEngine.complete({
            workspaceId: agencyId,
            agentKey: AGENT_KEY,
            projectId: project._id,
            messages: [{ role: 'user', content: prompt }],
            model: agentConfig.modelName,
            temperature: 0.2,
            maxTokens: 4000,
            jsonMode: true,
            retryOptions: { retries: 2 }
          });
          const parsed = JSON.parse(raw);
          claudeCandidates = parsed.keywords || [];
          aiSummary = parsed.summary || '';
      } catch (error) {
          logger.error(TAG, `Failed to parse AI keyword extraction JSON: ${error.message}`);
      }
  }

  const mergedMap = new Map();
  for (const q of gscQueries) {
      mergedMap.set(q.keyword.toLowerCase(), {
          keyword: q.keyword,
          gscPosition: q.position,
          clicks: q.clicks,
          impressions: q.impressions,
          isGsc: true,
          opportunityScore: 80,
          rationale: 'Identified via Search Console',
          theme: 'GSC Query'
      });
  }
  for (const c of claudeCandidates) {
      const key = c.keyword.toLowerCase();
      if (mergedMap.has(key)) {
         const existing = mergedMap.get(key);
         existing.rationale = c.rationale;
         existing.theme = c.theme;
         existing.sourceUrls = c.sourceUrls;
         existing.supportingElements = c.supportingElements;
      } else {
         mergedMap.set(key, {
            keyword: c.keyword,
            isGsc: false,
            opportunityScore: c.opportunityScore || 50,
            rationale: c.rationale,
            theme: c.theme,
            sourceUrls: c.sourceUrls,
            supportingElements: c.supportingElements
         });
      }
  }

  const allCandidates = Array.from(mergedMap.values());
  const finalCandidates = allCandidates.slice(0, 40); 

  if (finalCandidates.length === 0) {
      return { candidateCount: 0, suggestedKeywords: [], summary: 'No keywords could be extracted from evidence.' };
  }

  try {
     const kwsToFetch = finalCandidates.map(c => c.keyword);
     const providerConfigured = providerChain.hasAnyConfiguredProvider();
     if (providerConfigured) {
        let volumes = [];
        try {
           volumes = await keywordIntelligence.getSearchVolumeAndTrend(kwsToFetch, { projectId: project._id, locationCode: DEFAULT_LOCATION_CODE, languageCode: DEFAULT_LANGUAGE_CODE });
        } catch(err) {
           volumes = await keywordIntelligence.discoverKeywords(kwsToFetch[0], { projectId: project._id, limit: 100 });
        }
        
        if (volumes && volumes.length > 0) {
           const volMap = new Map(volumes.map(v => [v.keyword.toLowerCase(), v]));
           for (const c of finalCandidates) {
              const vData = volMap.get(c.keyword.toLowerCase());
              if (vData) {
                 c.searchVolume = vData.searchVolume;
                 c.cpc = vData.cpc;
                 c.keywordDifficulty = vData.keywordDifficulty;
                 let comp = parseFloat(vData.competition);
                 c.competition = isNaN(comp) ? (vData.competition === 'LOW' ? 0.3 : vData.competition === 'MEDIUM' ? 0.6 : vData.competition === 'HIGH' ? 0.9 : 0) : comp;
              }
           }
        }
     }
  } catch (error) {
     logger.warn(TAG, `Failed to fetch search volumes: ${error.message}`);
  }

  const bulkOps = finalCandidates.map(k => {
      return {
        updateOne: {
          filter: { projectId, keyword: k.keyword },
          update: {
            $set: {
              agencyId,
              source: k.isGsc ? 'GSC' : 'NLP_CANDIDATE',
              verificationStatus: k.isGsc ? 'VERIFIED_RANKING' : 'CANDIDATE',
              'agent.rationale': k.rationale,
              'agent.theme': k.theme
            },
            $setOnInsert: {
              status: 'Approved',
              lifecycle: 'Discovered',
              'metrics.searchVolume': k.searchVolume || 0,
              'metrics.cpc': k.cpc || 0,
              'metrics.keywordDifficulty': k.keywordDifficulty || 0,
              'metrics.competition': k.competition || 0,
              'metrics.intent': k.intent || 'unknown',
              isQuestion: false
            },
            $max: { 'agent.opportunityScore': k.opportunityScore || 50 }
          },
          upsert: true
        }
      };
  });
  
  const gscUpdates = finalCandidates.filter(k => k.isGsc).map(k => {
      return {
          updateOne: {
             filter: { projectId, keyword: k.keyword },
             update: {
                $set: {
                   'gsc.averagePosition': k.gscPosition,
                   'gsc.clicks': k.clicks,
                   'gsc.impressions': k.impressions,
                   'gsc.ctr': k.ctr,
                   verificationStatus: 'VERIFIED_RANKING'
                }
             }
          }
      }
  });

  await WorkspaceKeyword.bulkWrite(bulkOps);
  if (gscUpdates.length > 0) {
      await WorkspaceKeyword.bulkWrite(gscUpdates);
  }

  try {
      const newlyInsertedKeywords = await WorkspaceKeyword.find({
        projectId,
        keyword: { $in: finalCandidates.map(k => k.keyword) }
      });
      
      if (newlyInsertedKeywords.length > 0) {
        logger.info(TAG, `Synchronously running SERP track for ${newlyInsertedKeywords.length} extracted candidates.`);
        await rankTrackingService.trackKeywords(project, newlyInsertedKeywords);
      }
  } catch (err) {
      logger.error(TAG, `Failed to synchronously track ranks: ${err.message}`);
  }

  let summaryText = `Found ${finalCandidates.length} evidence-based candidates. ${aiSummary} ${partial ? '(Based on partial homepage crawl while deep crawl runs)' : ''}`;

  return {
    candidateCount: finalCandidates.length,
    suggestedKeywords: finalCandidates,
    summary: summaryText
  };
}

async function approveKeywords(projectId, keywordIds, userId) {
  if (!Array.isArray(keywordIds) || keywordIds.length === 0) {
    throw new Error('At least one keywordId is required');
  }

  const approvedDocs = await WorkspaceKeyword.find({ _id: { $in: keywordIds }, projectId, status: 'Suggested' }, 'keyword').lean();

  const result = await WorkspaceKeyword.updateMany(
    { _id: { $in: keywordIds }, projectId, status: 'Suggested' },
    { $set: { status: 'Approved', approvedBy: userId, approvedAt: new Date(), rejectionReason: null } }
  );

  auditLogService.record({
    targetType: 'Keyword', targetId: projectId, projectId,
    action: 'keywords_approved', fromValue: 'Suggested', toValue: `${result.modifiedCount} approved`, userId
  });

  const keywords = approvedDocs.map((d) => d.keyword);
  await recommendationMemory.markResponded(projectId, keywords, 'accepted', userId);
  keywords.forEach((keyword) => keywordEvents.emitSafe(EVENTS.KEYWORD_APPROVED, { projectId, keyword, userId }));

  return result;
}

async function rejectKeywords(projectId, keywordIds, userId, reason) {
  if (!Array.isArray(keywordIds) || keywordIds.length === 0) {
    throw new Error('At least one keywordId is required');
  }

  const rejectedDocs = await WorkspaceKeyword.find({ _id: { $in: keywordIds }, projectId, status: 'Suggested' }, 'keyword').lean();

  const result = await WorkspaceKeyword.updateMany(
    { _id: { $in: keywordIds }, projectId, status: 'Suggested' },
    { $set: { status: 'Rejected', rejectionReason: reason || null } }
  );

  auditLogService.record({
    targetType: 'Keyword', targetId: projectId, projectId,
    action: 'keywords_rejected', fromValue: 'Suggested', toValue: `${result.modifiedCount} rejected`, userId
  });

  const keywords = rejectedDocs.map((d) => d.keyword);
  await recommendationMemory.markResponded(projectId, keywords, 'rejected', userId, reason);
  keywords.forEach((keyword) => keywordEvents.emitSafe(EVENTS.KEYWORD_REJECTED, { projectId, keyword, userId, reason }));

  await recordExcludedThemesIfRepeated(projectId, keywordIds, userId);

  return result;
}

async function recordExcludedThemesIfRepeated(projectId, keywordIds, userId) {
  try {
    const rejected = await WorkspaceKeyword.find({ _id: { $in: keywordIds }, projectId }).lean();
    const themes = [...new Set(rejected.map((k) => k.agent?.theme).filter(Boolean))];
    if (themes.length === 0) return;

    const project = await WorkspaceProject.findById(projectId);
    const agencyId = project?.createdBy || project?.companyId || userId;

    for (const theme of themes.slice(0, 3)) {
      const priorRejectionCount = await WorkspaceKeyword.countDocuments({
        projectId, 'agent.theme': theme, status: 'Rejected'
      });

      if (priorRejectionCount >= 2) {
        await sharedMemory.remember({
          agencyId,
          projectId,
          title: `Excluded keyword theme: ${theme}`,
          description: `Keywords themed "${theme}" have been rejected ${priorRejectionCount} times for this project.`,
          content: `Avoid suggesting further keywords in the "${theme}" theme unless explicitly requested.`,
          type: 'excluded_keyword_theme'
        });
      }
    }
  } catch (error) {
    logger.warn(TAG, `Failed to record excluded-theme memory for project ${projectId}: ${error.message}`, { projectId });
  }
}

async function getExecutionHistory(projectId, limit = 20) {
  const ExecutionLog = require('../../aiCore/executionLog.model');

  return ExecutionLog.find({
    projectId,
    $or: [{ agentKey: AGENT_KEY }, { source: 'keywordResearchAgent' }]
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

module.exports = {
  AGENT_KEY,
  run,
  collectKeywordCandidates,
  analyzeAndSuggest,
  approveKeywords,
  rejectKeywords,
  getExecutionHistory
};