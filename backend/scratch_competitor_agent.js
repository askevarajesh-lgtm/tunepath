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

// Generic/Platform domains that typically shouldn't be counted as direct competitors
const GENERIC_DOMAINS = new Set([
  'youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com',
  'wikipedia.org', 'reddit.com', 'amazon.com', 'ebay.com', 'pinterest.com',
  'tiktok.com', 'apple.com', 'microsoft.com', 'google.com', 'quora.com',
  'yelp.com', 'medium.com', 'vimeo.com', 'github.com', 'etsy.com', 'walmart.com',
  'tripadvisor.com', 'trustpilot.com', 'indeed.com', 'glassdoor.com', 'quora.com',
  'play.google.com', 'apps.apple.com'
]);

function calculateCompetitiveScore(c) {
  // 1. Keyword overlap is the strongest signal.
  const baseScore = Math.min(60, c.commonKeywords * 2);
  
  // 2. Overlap Percentage (how much of THEIR site is competing with US).
  let overlapPctScore = 0;
  if (c.organicKeywords > 0) {
    const pct = (c.commonKeywords / c.organicKeywords);
    overlapPctScore = Math.min(20, pct * 200); // 10% overlap = max 20 points
  }
  
  // 3. Traffic relevance.
  const trafficBonus = Math.min(10, Math.log10(c.organicTraffic + 1) * 2);

  // 4. Ranking strength.
  let rankBonus = 0;
  if (c.domainRank > 0 && c.domainRank <= 10) rankBonus = 10;
  else if (c.domainRank > 10 && c.domainRank <= 30) rankBonus = 5;

  const score = Math.round(baseScore + overlapPctScore + trafficBonus + rankBonus);
  return Math.min(100, Math.max(0, score));
}

/**
 * @param {Object} project - a WorkspaceProject document
 * @param {string} agencyId
 * @returns {Promise<Array>} candidate objects: { domain, commonKeywords, organicKeywords, organicTraffic, organicCost, referringDomains, backlinks, domainRank, dataSource }
 */
async function collectCompetitorCandidates(project, agencyId) {
  const domain = domainNormalizationEngine.normalizeDomain(project.domain);
  const locationCode = project.targetLocations?.[0]?.location_code || 2840;
  const languageCode = project.languages?.[0] || 'en';
  let candidates = [];

  if (dataForSeoService.isConfigured) {
    try {
      const items = await retry.withRetry(
        () => dataForSeoService.getCompetitors(domain, locationCode, languageCode, MAX_CANDIDATES),
        {
          retries: 2,
          retryIf: (error) => !/invalid|not found/i.test(error.message || ''),
          onRetry: (error, attempt) => logger.warn(TAG, `getCompetitors retry ${attempt + 1} for ${domain}: ${error.message}`)
        }
      );

      // Filtering Pipeline
      candidates = (items || []).map((item) => {
        const cDomain = domainNormalizationEngine.normalizeDomain(item.domain || item.target);
        if (!cDomain) return null;
        return {
          domain: cDomain,
          commonKeywords: item.intersections || 0,
          organicKeywords: item.full_domain_metrics?.organic?.count || item.metrics?.organic?.count || 0,
          organicTraffic: item.full_domain_metrics?.organic?.etv || item.metrics?.organic?.etv || 0,
          organicCost: item.full_domain_metrics?.organic?.estimated_paid_traffic_cost || 0,
          referringDomains: 0,
          backlinks: 0,
          domainRank: item.avg_position || item.rank_group || 0,
          dataSource: 'dataforseo'
        };
      }).filter((c) => {
        if (!c) return false;
        if (c.domain === domain) return false;
        
        const parts = c.domain.split('.');
        const baseDomain = parts.length >= 2 ? parts.slice(-2).join('.') : c.domain;
        if (GENERIC_DOMAINS.has(baseDomain)) return false; 
        
        if (c.commonKeywords < 2) return false; 
        
        return true;
      });

      // Deduplicate
      const uniqueMap = new Map();
      for (const c of candidates) {
        if (!uniqueMap.has(c.domain) || c.commonKeywords > uniqueMap.get(c.domain).commonKeywords) {
          uniqueMap.set(c.domain, c);
        }
      }
      candidates = Array.from(uniqueMap.values());

      // Score
      candidates.forEach(c => {
        c.competitiveScore = calculateCompetitiveScore(c);
      });

      // Sort by score
      candidates.sort((a, b) => b.competitiveScore - a.competitiveScore);
      candidates = candidates.slice(0, MAX_SUGGESTIONS);

      if (candidates.length > 0) {
        const toEnrich = candidates.slice(0, BACKLINK_ENRICHMENT_LIMIT);
        await Promise.all(toEnrich.map(async (candidate) => {
          try {
            const summary = await retry.withRetry(
              () => dataForSeoService.getBacklinkSummary(candidate.domain),
              { retries: 1 }
            );
            if (summary) {
              candidate.referringDomains = summary.referring_domains || 0;
              candidate.backlinks = summary.backlinks || 0;
              if (!candidate.domainRank) candidate.domainRank = summary.rank || 0;
            }
          } catch (enrichError) {
            logger.warn(TAG, `getBacklinkSummary failed for ${candidate.domain}, continuing without it: ${enrichError.message}`, { projectId: project._id });
          }
        }));
      }
    } catch (error) {
      logger.warn(TAG, `DataForSEO competitor lookup failed for ${domain}: ${error.message}`, { projectId: project._id });
    }
  }

  return candidates;
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
You MUST NOT invent new domains. You MUST NOT modify their quantitative metrics.
Only analyze the exact domains provided above.

Respond with a JSON object of this exact shape:
{
  "summary": "2-4 sentence strategic summary of the competitive landscape",
  "competitors": [
    {
      "domain": "must exactly match one candidate above",
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

    selected.push({
      ...c,
      threatLevel,
      confidence: c.competitiveScore, 
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
      const candidates = await collectCompetitorCandidates(project, agencyId);
      logger.info(TAG, `Candidates collected: ${candidates.length}`, { projectId });
      const { summary, selected } = await analyzeCompetitors(project, candidates, agencyId);

      let suggestedCompetitors = [];
      if (selected.length > 0) {
        
        const existing = await WorkspaceCompetitor.find({
          projectId: project._id,
          domain: { $in: selected.map(c => c.domain) }
        }).lean();
        
        const existingMap = new Map(existing.map(e => [e.domain, e]));

        const bulkOps = selected.map((c) => {
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
          domain: { $in: selected.map((c) => c.domain) }
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
