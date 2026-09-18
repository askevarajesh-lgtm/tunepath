const WorkspaceProject = require('../models/workspaceProject.model');
const WorkspaceCompetitor = require('../models/workspaceCompetitor.model');
const dataForSeoService = require('../../seoIntelligence/dataForSeo.service');
const auditLogService = require('./auditLog.service');
const domainNormalizationEngine = require('./domainNormalization.utils');

const aiEngine = require('../../aiCore/aiEngine.service');
const executionQueue = require('../../aiCore/executionQueue.service');
const retry = require('../../aiCore/retry.service');
const logger = require('../../aiCore/logger.service');
const sharedMemory = require('../../aiCore/sharedMemory.service');
const agentLoader = require('../../aiCore/agentLoader.service');

const AGENT_KEY = 'competitor-agent';
const TAG = 'CompetitorAgent';

const VALID_THREAT_LEVELS = ['minimal', 'low', 'medium', 'high', 'critical'];
const MAX_CANDIDATES = 100;
const MAX_SUGGESTIONS = 8;
const BACKLINK_ENRICHMENT_LIMIT = 5;

// Global Platform domains that MUST unconditionally be excluded
const GLOBAL_PLATFORM_DOMAINS = new Set([
  'youtube.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com',
  'wikipedia.org', 'reddit.com', 'amazon.com', 'ebay.com', 'pinterest.com',
  'tiktok.com', 'quora.com', 'medium.com', 'vimeo.com', 'github.com',
  'apple.com', 'microsoft.com', 'google.com', 'yelp.com', 'etsy.com', 'walmart.com',
  'tripadvisor.com', 'trustpilot.com', 'indeed.com', 'glassdoor.com',
  'play.google.com', 'apps.apple.com'
]);

function calculateCompetitiveScore(c, totalTargetKeywords) {
  if (totalTargetKeywords === 0) return 0;
  
  // 1. Keyword Overlap (Adaptive)
  const overlapPct = c.commonKeywords / totalTargetKeywords;
  const overlapScore = Math.min(40, (overlapPct * 100) * 1.5); // e.g. 20% overlap -> 30 points

  // 2. Search Volume Overlap
  const svScore = Math.min(30, Math.log10(c.searchVolumeOverlap + 1) * 6);

  // 3. Outranking Signal
  let outrankScore = 0;
  if (c.commonKeywords > 0) {
    const outrankPct = c.competitorBetterRankCount / c.commonKeywords;
    outrankScore = Math.min(20, (outrankPct * 100) * 0.5); 
  }

  // 4. Ranking Proximity / Avg Rank
  let rankBonus = 0;
  if (c.averageCompetitorPosition > 0 && c.averageCompetitorPosition <= 10) rankBonus = 10;
  else if (c.averageCompetitorPosition > 10 && c.averageCompetitorPosition <= 30) rankBonus = 5;

  const score = Math.round(overlapScore + svScore + outrankScore + rankBonus);
  return Math.min(100, Math.max(0, score));
}

/**
 * @param {Object} project - a WorkspaceProject document
 * @param {string} agencyId
 * @returns {Promise<Array>} candidate objects
 */
async function collectCompetitorCandidates(project, agencyId) {
  const domain = domainNormalizationEngine.normalizeDomain(project.domain);
  const locationCode = project.targetLocations?.[0]?.location_code;
  const languageCode = project.languages?.[0] || 'en';
  
  if (!locationCode) {
    logger.warn(TAG, `No target location configured for project ${project._id}. Cannot perform reliable local SERP competitor discovery.`);
    const err = new Error('No location configured.');
    err.code = 'NO_LOCATION';
    throw err;
  }

  let candidatesMap = new Map();

  if (dataForSeoService.isConfigured) {
    try {
      // Step 1: Get Target Keywords
      const rankedKws = await retry.withRetry(
        () => dataForSeoService.getRankedKeywords(domain, 50, locationCode, languageCode),
        { retries: 2, onRetry: (err, attempt) => logger.warn(TAG, `getRankedKeywords retry ${attempt + 1}: ${err.message}`) }
      );

      const targetKeywords = [];
      for (const item of (rankedKws || [])) {
        const kw = item.keyword_data?.keyword;
        const rank = item.ranked_serp_element?.serp_item?.rank_absolute || item.ranked_serp_element?.serp_item?.rank_group || null;
        const sv = item.keyword_data?.keyword_info?.search_volume || 0;
        const url = item.ranked_serp_element?.serp_item?.url || null;
        if (kw) {
          targetKeywords.push({ keyword: kw, searchVolume: sv, rank, url, location_code: locationCode, language_code: languageCode });
        }
      }

      if (targetKeywords.length === 0) {
        logger.info(TAG, `No ranked keywords found for ${domain}. Cannot perform SERP-based competitor discovery.`);
        return [];
      }

      // Step 2: Fetch SERP Data for those keywords
      const serpResults = await dataForSeoService.getSerpResults(targetKeywords);
      
      // Step 3: Aggregate Competitors
      for (const serpTask of serpResults) {
        const kw = serpTask.data?.keyword;
        const targetKwData = targetKeywords.find(k => k.keyword === kw);
        if (!targetKwData) continue;

        const items = serpTask.result?.[0]?.items || [];
        for (const item of items) {
          if (item.type !== 'organic') continue;
          
          const cDomainRaw = item.domain;
          if (!cDomainRaw) continue;
          
          const cDomain = domainNormalizationEngine.normalizeDomain(cDomainRaw);
          if (!cDomain || cDomain === domain) continue;

          const cRank = item.rank_absolute || item.rank_group || null;
          if (!cRank) continue;

          if (!candidatesMap.has(cDomain)) {
            candidatesMap.set(cDomain, {
              domain: cDomain,
              commonKeywords: 0,
              searchVolumeOverlap: 0,
              competitorBetterRankCount: 0,
              targetBetterRankCount: 0,
              sumCompetitorPosition: 0,
              rankingEvidence: [],
              organicKeywords: 0,
              organicTraffic: 0,
              organicCost: 0,
              referringDomains: 0,
              backlinks: 0,
              domainRank: 0,
              dataSource: 'dataforseo'
            });
          }

          const c = candidatesMap.get(cDomain);
          c.commonKeywords++;
          c.searchVolumeOverlap += targetKwData.searchVolume;
          c.sumCompetitorPosition += cRank;

          if (targetKwData.rank) {
            if (cRank < targetKwData.rank) c.competitorBetterRankCount++;
            else if (cRank > targetKwData.rank) c.targetBetterRankCount++;
          }

          if (c.rankingEvidence.length < 5) {
            c.rankingEvidence.push({
              keyword: kw,
              searchVolume: targetKwData.searchVolume,
              targetPosition: targetKwData.rank,
              competitorPosition: cRank,
              targetUrl: targetKwData.url,
              competitorUrl: item.url
            });
          }
        }
      }

      let candidates = Array.from(candidatesMap.values());
      const totalTargetKeywords = targetKeywords.length;

      // Calculate averages and score
      candidates.forEach(c => {
        c.averageCompetitorPosition = c.sumCompetitorPosition / c.commonKeywords;
        c.competitiveScore = calculateCompetitiveScore(c, totalTargetKeywords);
        c.serviceOverlap = c.commonKeywords;
        c.serviceRelevanceScore = c.competitiveScore; // Deterministic metric based on evidence
      });

      // Filter
      candidates = candidates.filter(c => {
        let normalized = c.domain.replace(/^www\./, '');
        const parts = normalized.split('.');
        // Check for subdomains like m.youtube.com by taking the last two parts if length > 2
        const baseDomain = parts.length >= 2 ? parts.slice(-2).join('.') : normalized;
        
        // STRICT GLOBAL PLATFORM EXCLUSION
        if (GLOBAL_PLATFORM_DOMAINS.has(baseDomain) || GLOBAL_PLATFORM_DOMAINS.has(normalized)) {
           return false; 
        }

        // Must have at least SOME overlap
        if (c.commonKeywords < 2 && totalTargetKeywords >= 5) return false;
        if (c.competitiveScore < 10) return false; // Reject very low relevance

        return true;
      });

      // Sort by score
      candidates.sort((a, b) => b.competitiveScore - a.competitiveScore);
      candidates = candidates.slice(0, MAX_SUGGESTIONS);

      // Backlink & Overview Enrichment
      if (candidates.length > 0) {
        await Promise.all(candidates.map(async (candidate) => {
          try {
            const overview = await retry.withRetry(() => dataForSeoService.getDomainOverview(candidate.domain, locationCode, languageCode), { retries: 1 });
            if (overview) {
               candidate.organicKeywords = overview.metrics?.organic?.count || 0;
               candidate.organicTraffic = overview.metrics?.organic?.etv || 0;
               candidate.organicCost = overview.metrics?.organic?.estimated_paid_traffic_cost || 0;
               candidate.domainRank = overview.metrics?.organic?.pos_1 ? overview.metrics.organic.pos_1 : (overview.avg_position || 0);
            }

            const summary = await retry.withRetry(() => dataForSeoService.getBacklinkSummary(candidate.domain), { retries: 1 });
            if (summary) {
              candidate.referringDomains = summary.referring_domains || 0;
              candidate.backlinks = summary.backlinks || 0;
              if (!candidate.domainRank) candidate.domainRank = summary.rank || 0;
            }
          } catch (enrichError) {
            logger.warn(TAG, `Enrichment failed for ${candidate.domain}: ${enrichError.message}`);
          }
        }));
      }
      
      return candidates;

    } catch (error) {
      logger.warn(TAG, `DataForSEO true competitor lookup failed for ${domain}: ${error.message}`, { projectId: project._id });
    }
  }

  return [];
}


/**
 * @param {Object} project
 * @param {Array} candidates - from collectCompetitorCandidates
 * @param {string} workspaceId
 * @returns {Promise<{ summary: string, selected: Array }>}
 */
async function analyzeCompetitors(project, candidates, workspaceId) {
  if (candidates.length === 0) {
    return { summary: 'No reliable organic competitors were found from the available data.', selected: [] };
  }

  const agentConfig = await agentLoader.resolve(AGENT_KEY);
  const skillsBlock = agentLoader.loadSkillsForAgent(agentConfig);
  const memoryBlock = await sharedMemory.recallAsPromptContext({ agencyId: workspaceId, projectId: project._id });

  const prompt = `You are the Competitor Agent for ${project.name} (${project.domain}).

Verified Organic Competitors (deterministically filtered and scored):
${JSON.stringify(candidates, null, 2)}
${skillsBlock}
${memoryBlock}

Provide a qualitative strategic summary of these verified competitors. 
You MUST NOT invent new domains. You MUST NOT invent any quantitative numbers.
Only analyze the exact domains provided above based on their ranking evidence and service overlap.

Respond with a JSON object of this exact shape:
{
  "summary": "2-4 sentence strategic summary of the competitive landscape",
  "competitors": [
    {
      "domain": "must exactly match one candidate above",
      "competitorType": "hospital | clinic | directory | social | marketplace | publisher | aggregator | business | unknown",
      "exclusionReason": "If this domain is a directory, aggregator, or non-direct competitor, provide a brief reason why it should be excluded. Otherwise null.",
      "strengths": ["short phrase", "..."],
      "weaknesses": ["short phrase", "..."],
      "contentGaps": ["short phrase", "..."],
      "rationale": "1-2 sentence strategic rationale based on the provided metrics"
    }
  ]
}
Respond ONLY with valid JSON, no markdown formatting or commentary.`;

  const raw = await aiEngine.complete({
    workspaceId,
    agentKey: AGENT_KEY,
    projectId: project._id,
    messages: [{ role: 'user', content: prompt }],
    model: agentConfig.modelName,
    temperature: 0.2,
    maxTokens: 4000,
    jsonMode: true,
    retryOptions: { retries: 2, minTimeout: 1000 }
  });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    logger.error(TAG, `Failed to parse AI competitor-analysis JSON: ${error.message}`, { projectId: project._id });
    parsed = { summary: 'Automated analysis completed.', competitors: [] };
  }

  const selected = [];
  
  for (const c of candidates) {
    const aiInsight = (Array.isArray(parsed.competitors) ? parsed.competitors : []).find(
      x => x.domain && domainNormalizationEngine.normalizeDomain(x.domain) === c.domain
    );
    
    let threatLevel = 'medium';
    if (c.competitiveScore >= 80) threatLevel = 'critical';
    else if (c.competitiveScore >= 60) threatLevel = 'high';
    else if (c.competitiveScore >= 40) threatLevel = 'medium';
    else if (c.competitiveScore >= 20) threatLevel = 'low';
    else threatLevel = 'minimal';

    const compType = aiInsight ? aiInsight.competitorType : 'unknown';
    const exclReason = aiInsight ? aiInsight.exclusionReason : null;

    selected.push({
      ...c,
      threatLevel,
      confidence: c.competitiveScore, 
      competitorType: compType,
      exclusionReason: exclReason,
      strengths: aiInsight && Array.isArray(aiInsight.strengths) ? aiInsight.strengths.slice(0, 5).map(String) : [],
      weaknesses: aiInsight && Array.isArray(aiInsight.weaknesses) ? aiInsight.weaknesses.slice(0, 5).map(String) : [],
      contentGaps: aiInsight && Array.isArray(aiInsight.contentGaps) ? aiInsight.contentGaps.slice(0, 5).map(String) : [],
      rationale: aiInsight ? aiInsight.rationale : ''
    });
  }

  return { summary: parsed.summary || 'Analysis completed.', selected };
}

/**
 * @param {string} projectId
 * @param {string} [workspaceId]
 * @returns {Promise<{ candidateCount: number, suggestedCompetitors: Array, summary: string }>}
 */
async function run(projectId, workspaceId) {
  const project = await WorkspaceProject.findById(projectId);
  if (!project) throw new Error('Project not found');

  const agencyId = workspaceId || project.createdBy || project.companyId;

  return executionQueue.run(`competitor-agent:${projectId}`, async () => {
    const executionId = `competitorAgent:${projectId}:${Date.now()}`;
    const startedAt = Date.now();

    logger.logExecution({ executionId, source: 'competitorAgent', agentKey: AGENT_KEY, projectId, status: 'started' });
    logger.info(TAG, `Competitor Discovery Started (Exec ID: ${executionId})`);

    try {
      let candidates = [];
      try {
        candidates = await collectCompetitorCandidates(project, agencyId);
      } catch (err) {
        if (err.code === 'NO_LOCATION') {
           logger.logExecution({
             executionId, source: 'competitorAgent', agentKey: AGENT_KEY, projectId,
             status: 'succeeded', durationMs: Date.now() - startedAt,
             meta: { candidateCount: 0, suggestedCount: 0 }
           });
           return { candidateCount: 0, suggestedCompetitors: [], summary: 'A target location must be configured for this project to enable reliable competitor discovery.' };
        }
        throw err;
      }

      logger.info(TAG, `Candidates collected: ${candidates.length}`, { projectId });
      const { summary, selected } = await analyzeCompetitors(project, candidates, agencyId);

      // Exclude directories, aggregators, social, and those with an exclusionReason
      const filteredSelected = selected.filter(c => {
        const type = (c.competitorType || '').toLowerCase();
        const nonDirectTypes = ['directory', 'aggregator', 'social', 'marketplace', 'publisher'];
        if (nonDirectTypes.includes(type) || c.exclusionReason) {
          logger.info(TAG, `Excluding non-direct competitor: ${c.domain} (Type: ${c.competitorType}, Reason: ${c.exclusionReason})`);
          return false; // Do not save to DB
        }
        return true;
      });

      let suggestedCompetitors = [];
      if (filteredSelected.length > 0) {
        
        const existing = await WorkspaceCompetitor.find({
          projectId: project._id,
          domain: { $in: filteredSelected.map(c => c.domain) }
        }).lean();
        
        const existingMap = new Map(existing.map(e => [e.domain, e]));

        const bulkOps = filteredSelected.map((c) => {
          const ex = existingMap.get(c.domain);
          const status = ex ? ex.status : 'Suggested';
          return {
            updateOne: {
              filter: { projectId: project._id, domain: c.domain },
              update: {
                $set: {
                  agencyId,
                  'metrics.commonKeywords': c.commonKeywords,
                  'metrics.organicKeywords': c.organicKeywords,
                  'metrics.organicTraffic': c.organicTraffic,
                  'metrics.organicCost': c.organicCost,
                  'metrics.referringDomains': c.referringDomains,
                  'metrics.backlinks': c.backlinks,
                  'metrics.domainRank': c.domainRank,
                  competitiveScore: c.competitiveScore,
                  rankingEvidence: c.rankingEvidence || [],
                  competitorType: c.competitorType,
                  serviceRelevanceScore: c.serviceRelevanceScore,
                  serviceOverlap: c.serviceOverlap,
                  exclusionReason: c.exclusionReason,
                  dataSource: c.dataSource,
                  source: 'competitor-agent',
                  status: status,
                  'agent.agentKey': AGENT_KEY,
                  'agent.threatLevel': c.threatLevel,
                  'agent.strengths': c.strengths,
                  'agent.weaknesses': c.weaknesses,
                  'agent.contentGaps': c.contentGaps,
                  'agent.rationale': c.rationale,
                  'agent.confidence': c.confidence
                }
              },
              upsert: true
            }
          };
        });
        const bulkResult = await WorkspaceCompetitor.bulkWrite(bulkOps);
        logger.info(TAG, `Saved Competitors: Inserted ${bulkResult.upsertedCount || 0}, Updated ${bulkResult.modifiedCount || 0}`);

        suggestedCompetitors = await WorkspaceCompetitor.find({
          projectId: project._id,
          domain: { $in: filteredSelected.map((c) => c.domain) }
        }).lean();
      }

      await WorkspaceCompetitor.updateMany(
        { projectId: project._id, dataSource: 'ai-estimate' },
        { $set: { dataSource: 'legacy-ai-estimate' } }
      );

      logger.info(TAG, `Discovery Completed`, { projectId });
      logger.logExecution({
        executionId, source: 'competitorAgent', agentKey: AGENT_KEY, projectId,
        status: 'succeeded', durationMs: Date.now() - startedAt,
        meta: { candidateCount: candidates.length, suggestedCount: suggestedCompetitors.length }
      });

      return { candidateCount: candidates.length, suggestedCompetitors, summary };
    } catch (error) {
      logger.logExecution({
        executionId, source: 'competitorAgent', agentKey: AGENT_KEY, projectId,
        status: 'failed', durationMs: Date.now() - startedAt, error: error.message
      });
      throw error;
    }
  });
}

/**
 * @param {string} projectId
 * @param {string[]} competitorIds
 * @param {string} userId
 */
async function approveCompetitors(projectId, competitorIds, userId) {
  if (!Array.isArray(competitorIds) || competitorIds.length === 0) {
    throw new Error('At least one competitorId is required');
  }

  const result = await WorkspaceCompetitor.updateMany(
    { _id: { $in: competitorIds }, projectId, status: 'Suggested' },
    { $set: { status: 'Approved', approvedBy: userId, approvedAt: new Date(), rejectionReason: null } }
  );

  auditLogService.record({
    targetType: 'Competitor', targetId: projectId, projectId,
    action: 'competitors_approved', fromValue: 'Suggested', toValue: `${result.modifiedCount} approved`, userId
  });

  return result;
}

async function rejectCompetitors(projectId, competitorIds, userId, reason) {
  if (!Array.isArray(competitorIds) || competitorIds.length === 0) {
    throw new Error('At least one competitorId is required');
  }

  const result = await WorkspaceCompetitor.updateMany(
    { _id: { $in: competitorIds }, projectId, status: 'Suggested' },
    { $set: { status: 'Rejected', rejectionReason: reason || null } }
  );

  auditLogService.record({
    targetType: 'Competitor', targetId: projectId, projectId,
    action: 'competitors_rejected', fromValue: 'Suggested', toValue: `${result.modifiedCount} rejected`, userId
  });

  await recordExcludedCompetitorsIfAny(projectId, competitorIds, userId, reason);

  return result;
}

async function recordExcludedCompetitorsIfAny(projectId, competitorIds, userId, reason) {
  try {
    const rejected = await WorkspaceCompetitor.find({ _id: { $in: competitorIds }, projectId }).lean();
    if (rejected.length === 0) return;

    const project = await WorkspaceProject.findById(projectId);
    const agencyId = project?.createdBy || project?.companyId || userId;

    for (const competitor of rejected.slice(0, 5)) {
      await sharedMemory.remember({
        agencyId,
        projectId,
        title: `Excluded competitor: ${competitor.domain}`,
        description: `${competitor.domain} was rejected as a tracked competitor for this project.`,
        content: reason
          ? `Do not treat ${competitor.domain} as a meaningful competitor going forward. Reason given: ${reason}`
          : `Do not treat ${competitor.domain} as a meaningful competitor going forward.`,
        type: 'excluded_competitor'
      });
    }
  } catch (error) {
    logger.warn(TAG, `Failed to record excluded-competitor memory for project ${projectId}: ${error.message}`, { projectId });
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
    $or: [{ agentKey: AGENT_KEY }, { source: 'competitorAgent' }]
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

module.exports = {
  AGENT_KEY,
  run,
  collectCompetitorCandidates,
  analyzeCompetitors,
  approveCompetitors,
  rejectCompetitors,
  getExecutionHistory
};
