const WorkspaceProject = require('../models/workspaceProject.model');
const WorkspaceKeyword = require('../models/workspaceKeyword.model');
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
const hybridKeywordExtractor = require('./hybridKeywordExtractor.service');

const AGENT_KEY = 'keyword-research';
const TAG = 'KeywordResearchAgent';

const MAX_CANDIDATES = 40;
const MAX_SUGGESTIONS = 15;
const DEFAULT_LOCATION_CODE = 2840; // US, matches WorkspaceKeyword's own default
const DEFAULT_LANGUAGE_CODE = 'en';

/**
 * @param {Object} project - a WorkspaceProject document
 * @param {string} agencyId
 * @param {string} [seedKeyword] - explicit seed; defaults to the project's name
 * @returns {Promise<Array>} candidate objects: { keyword, searchVolume, cpc, competition, intent, keywordDifficulty }
 */
async function collectKeywordCandidates(project, agencyId, seedKeyword) {
  const seed = (seedKeyword || project.name || project.domain || '').trim();

  // 1. First, try to fetch existing keywords discovered by the background crawler in the database
  const dbKeywords = await WorkspaceKeyword.find({
    projectId: project._id,
    source: 'discovery_crawler'
  })
    .sort({ 'agent.opportunityScore': -1 })
    .limit(MAX_CANDIDATES)
    .lean();

  if (dbKeywords && dbKeywords.length > 0) {
    logger.info(TAG, `Found ${dbKeywords.length} deterministic crawler keywords in DB for "${seed}"`);
    return dbKeywords.map((k) => ({
      keyword: k.keyword,
      searchVolume: k.metrics?.searchVolume || 0,
      cpc: k.metrics?.cpc || 0,
      competition: k.metrics?.competition || 0,
      intent: k.metrics?.intent || 'unknown',
      keywordDifficulty: k.metrics?.keywordDifficulty || 0
    }));
  }

  // 2. Fetch Ranked Keywords & Extract HTML Themes to use as Seeds
  let rankedKeywords = [];
  let htmlThemes = [];
  const siteUrl = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`;
  const cleanDomain = (project.domain || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '').trim();

  const providerConfigured = providerChain.hasAnyConfiguredProvider();
  const opts = {
    projectId: project._id,
    locationCode: DEFAULT_LOCATION_CODE,
    languageCode: DEFAULT_LANGUAGE_CODE,
    limit: MAX_CANDIDATES,
    bypassCache: false
  };

  if (providerConfigured) {
    try {
      const ranked = await keywordIntelligence.getDomainRankedKeywords(cleanDomain, opts);
      if (ranked && ranked.length > 0) {
        rankedKeywords = ranked.map(k => ({ ...k, intent: 'unknown', keywordDifficulty: 0 }));
        logger.info(TAG, `Found ${rankedKeywords.length} existing ranked keywords for ${cleanDomain}`);
      }
    } catch (e) {
      logger.warn(TAG, `Failed to fetch ranked keywords for ${cleanDomain}: ${e.message}`);
    }
  }

  try {
    logger.info(TAG, `Synchronously scraping homepage to find business themes for seeds: ${siteUrl}`);
    const response = await axios.get(siteUrl, { timeout: 10000, maxRedirects: 3 });
    const rawHtmlKeywords = hybridKeywordExtractor.extractFromHtml(response.data, siteUrl);
    const keywordQuality = require('./keywordQuality.service');

    // Get top 3 high-quality multi-word phrases to use as DataForSEO seeds
    htmlThemes = rawHtmlKeywords
      .filter((k) => {
        if (keywordQuality.assessQuality(k.keyword, { searchVolume: 0 }).isRejected) return false;
        return (k.keyword || '').trim().split(/\s+/).length >= 2;
      })
      .slice(0, 3)
      .map(k => k.keyword);
  } catch (e) {
    logger.warn(TAG, `Homepage scrape failed: ${e.message}`);
  }

  // 3. Query DataForSEO using the discovered themes (and the brand as fallback)
  let allCandidates = [...rankedKeywords];

  if (providerConfigured) {
    // If we didn't find any HTML themes, fall back to the brand name / domain
    const seedsToQuery = htmlThemes.length > 0 ? htmlThemes : [...new Set([cleanDomain, seed].filter(Boolean))];
    logger.info(TAG, `Querying DataForSEO with seeds: ${seedsToQuery.join(', ')}`);

    for (const s of seedsToQuery) {
      if (!s) continue;
      try {
        const discovered = await keywordIntelligence.discoverKeywords(s, opts);
        if (discovered && discovered.length > 0) {
          allCandidates.push(...discovered);
        }
      } catch (error) {
        logger.warn(TAG, `DataForSEO discovery failed for seed "${s}": ${error.message}`);
      }
    }
  }

  if (allCandidates.length > 0) {
    // Deduplicate, sort by search volume descending, cap at MAX_CANDIDATES
    const seen = new Set();
    const deduped = allCandidates.filter((c) => {
      const key = (c.keyword || '').toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deduped.sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0));
    return deduped.slice(0, MAX_CANDIDATES).map((c) => ({
      keyword: c.keyword,
      searchVolume: c.searchVolume || 0,
      cpc: c.cpc || 0,
      competition: c.competition || 0,
      intent: c.intent || 'unknown',
      keywordDifficulty: c.keywordDifficulty || 0,
      rank: c.rank || null
    }));
  }

  logger.warn(TAG, 'No keyword candidates could be found from DB, HTML, or DataForSEO.');
  return [];
}

/**
 * @param {Object} project
 * @param {Array} candidates - from collectKeywordCandidates
 * @param {string} workspaceId
 * @returns {Promise<{ summary: string, selected: Array }>}
 */
async function analyzeAndSuggest(project, candidates, workspaceId) {
  if (candidates.length === 0) {
    return { summary: 'No keyword candidates were available to analyze.', selected: [] };
  }

  const agentConfig = await agentLoader.resolve(AGENT_KEY);
  const skillsBlock = agentLoader.loadSkillsForAgent(agentConfig);
  const memoryBlock = await sharedMemory.recallAsPromptContext({ agencyId: workspaceId, projectId: project._id });
  const recommendationHistoryBlock = await recommendationMemory.recallAsPromptContext(project._id);
  const targetCount = Math.min(MAX_SUGGESTIONS, candidates.length);

  const prompt = `You are the Keyword Research Agent for ${project.name} (${project.domain}).

Candidate Keywords (metrics of 0/"unknown" mean no measured data was available — treat these conservatively, do not assume they're bad or good):
${JSON.stringify(candidates, null, 2)}
${skillsBlock}
${memoryBlock}
${recommendationHistoryBlock}

Select the best ${targetCount} keywords from the candidate list above to actively pursue. Do not invent keywords that aren't in the list.

Respond with a JSON object of this exact shape:
{
  "summary": "2-4 sentence summary of the overall opportunity",
  "keywords": [
    { "keyword": "must exactly match one candidate above", "opportunityScore": 0-100, "rationale": "...", "theme": "short grouping label" }
  ]
}
Respond ONLY with valid JSON, no markdown formatting or commentary.`;

  const raw = await aiEngine.complete({
    workspaceId,
    agentKey: AGENT_KEY,
    projectId: project._id,
    messages: [{ role: 'user', content: prompt }],
    model: agentConfig.modelName,
    temperature: 0.4,
    maxTokens: 1800,
    jsonMode: true,
    retryOptions: { retries: 2 }
  });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    logger.error(TAG, `Failed to parse AI keyword-selection JSON: ${error.message}`, { projectId: project._id });
    parsed = { summary: 'Automated analysis did not return structured output; manual review recommended.', keywords: [] };
  }

  const candidateMap = new Map(candidates.map((c) => [c.keyword.toLowerCase(), c]));
  const selected = (Array.isArray(parsed.keywords) ? parsed.keywords : [])
    .filter((k) => k.keyword && candidateMap.has(k.keyword.toLowerCase()))
    .slice(0, MAX_SUGGESTIONS)
    .map((k) => {
      const candidate = candidateMap.get(k.keyword.toLowerCase());
      const score = Number(k.opportunityScore);
      return {
        ...candidate,
        keyword: candidate.keyword, // preserve original casing from the candidate, not the AI's echo
        opportunityScore: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 50,
        rationale: k.rationale || '',
        theme: k.theme || 'general'
      };
    });

  return { summary: parsed.summary || '', selected };
}

const WorkspaceCrawlJob = require('../models/workspaceCrawlJob.model');
const WorkspaceCrawlQueue = require('../models/workspaceCrawlQueue.model');

async function run(projectId, workspaceId, options = {}) {
  const project = await WorkspaceProject.findById(projectId);
  if (!project) throw new Error('Project not found');

  const agencyId = workspaceId || project.createdBy || project.companyId;

  // Clear stale discovery_crawler keywords (HTML-scraped words) so DataForSEO runs fresh.
  // Keywords that have been approved/rejected by users are preserved (they have non-Suggested status).
  await WorkspaceKeyword.deleteMany({
    projectId: project._id,
    source: 'discovery_crawler',
    status: { $in: ['Suggested', 'Discovered'] }
  });

  // 1. Kick off the background crawl (fire and forget)
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
      await WorkspaceCrawlQueue.create({
        jobId: job._id,
        url: siteUrl,
        status: 'pending'
      });

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

  // 2. Synchronously fetch initial candidates so the UI can display them immediately
  const candidates = await collectKeywordCandidates(project, agencyId, options.seedKeyword);

  if (candidates.length > 0) {
    let suggestedKeywords = [];
    let summaryText = `Found ${candidates.length} keyword candidates immediately. A deeper crawl is also running in the background.`;

    try {
      // 3. If AI is configured, call the existing AI analysis/prioritization flow.
      const aiAnalysis = await analyzeAndSuggest(project, candidates, agencyId);
      if (aiAnalysis && aiAnalysis.selected && aiAnalysis.selected.length > 0) {
        suggestedKeywords = aiAnalysis.selected;
        if (aiAnalysis.summary) summaryText = `Found ${candidates.length} keyword candidates immediately. ${aiAnalysis.summary} A deeper crawl is also running in the background.`;
      } else {
        throw new Error('AI analysis returned empty selection');
      }
    } catch (err) {
      logger.warn(TAG, `AI analysis failed or unavailable, falling back to deterministic values: ${err.message}`);
      suggestedKeywords = candidates.slice(0, MAX_SUGGESTIONS).map(c => ({
        keyword: c.keyword,
        opportunityScore: c.opportunityScore || (c.keywordDifficulty ? Math.max(0, 100 - c.keywordDifficulty) : 50),
        rationale: 'Discovered instantly via deterministic metrics',
        theme: 'General',
        ...c
      }));
    }

    // Save them to DB immediately so they appear in the UI table
    const bulkOps = suggestedKeywords.map(k => {
      const isVerified = k.rank != null;
      const op = {
        updateOne: {
          filter: { projectId, keyword: k.keyword },
          update: {
            $set: {
              agencyId,
              source: isVerified ? 'SERP' : 'NLP_CANDIDATE',
              verificationStatus: isVerified ? 'VERIFIED_RANKING' : 'CANDIDATE',
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

      if (k.rank) {
        op.updateOne.update.$set['ranking.currentRank'] = k.rank;
        op.updateOne.update.$set['ranking.rankingSource'] = 'SERP';
        op.updateOne.update.$set['ranking.status'] = 'FOUND';
      }

      return op;
    });

    if (bulkOps.length > 0) {
      await WorkspaceKeyword.bulkWrite(bulkOps);
    }

    return {
      candidateCount: candidates.length,
      suggestedKeywords,
      summary: summaryText
    };
  }

  return { candidateCount: 0, suggestedKeywords: [], summary: 'Keyword discovery crawl has been queued and is processing in the background. Keywords will appear shortly.' };
}

/**
 * @param {string} projectId
 * @param {string[]} keywordIds
 * @param {string} userId
 */
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

/**
 * @param {string} projectId
 * @param {number} [limit=20]
 */
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