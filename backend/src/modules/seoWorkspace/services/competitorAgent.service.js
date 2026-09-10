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
const AiSettings = require('../../aiStudio/models/aiSettings.model');
const cryptoUtils = require('../../../utils/crypto');

const AGENT_KEY = 'competitor-agent';
const TAG = 'CompetitorAgent';

const VALID_THREAT_LEVELS = ['minimal', 'low', 'medium', 'high', 'critical'];
const MAX_CANDIDATES = 10;
const MAX_SUGGESTIONS = 3;
const BACKLINK_ENRICHMENT_LIMIT = 5;

/**
 * @param {Object} project - a WorkspaceProject document
 * @param {string} agencyId
 * @returns {Promise<Array>} candidate objects: { domain, commonKeywords, organicKeywords, organicTraffic, organicCost, referringDomains, backlinks, domainRank, dataSource }
 */
async function collectCompetitorCandidates(project, agencyId) {
  const domain = project.domain.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  const locationCode = project.targetLocations?.[0]?.location_code || 2840;
  const languageCode = project.languages?.[0] || 'en';
  let candidates = [];

  if (dataForSeoService.isConfigured) {
    try {
      const items = await retry.withRetry(
        () => dataForSeoService.getCompetitors(domain, locationCode, languageCode),
        {
          retries: 2,
          retryIf: (error) => !/invalid|not found/i.test(error.message || ''),
          onRetry: (error, attempt) => logger.warn(TAG, `getCompetitors retry ${attempt + 1} for ${domain}: ${error.message}`)
        }
      );

      candidates = (items || []).slice(0, MAX_CANDIDATES).map((item) => ({
        domain: item.domain || item.target,
        commonKeywords: item.intersections || 0,
        organicKeywords: item.full_domain_metrics?.organic?.count || item.metrics?.organic?.count || 0,
        organicTraffic: item.full_domain_metrics?.organic?.etv || item.metrics?.organic?.etv || 0,
        organicCost: item.full_domain_metrics?.organic?.estimated_paid_traffic_cost || 0,
        referringDomains: 0,
        backlinks: 0,
        domainRank: item.avg_position || item.rank_group || 0,
        dataSource: 'dataforseo'
      })).filter((c) => c.domain);

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
      logger.warn(TAG, `DataForSEO competitor lookup failed for ${domain}, falling back to AI competitor seed generation: ${error.message}`, { projectId: project._id });
    }
  }

  if (candidates.length === 0) {
    candidates = await generateAiCompetitorSeeds(project, agencyId, domain);
  }

  return candidates;
}



async function generateAiCompetitorSeeds(project, workspaceId, domain) {
  const agentConfig = await agentLoader.resolve(AGENT_KEY);
  const skillsBlock = agentLoader.loadSkillsForAgent(agentConfig);
  const memoryBlock = await sharedMemory.recallAsPromptContext({ agencyId: workspaceId, projectId: project._id });

  const prompt = `You are the Competitor Agent. Based on general knowledge of the market, name up to 8 real, plausible organic-search competitor domains for "${project.name}" (${domain}).
${skillsBlock}
${memoryBlock}
Respond ONLY with a JSON array of objects, with each object containing exactly these fields: "domain" (lowercase string, no protocol, no paths), "reason" (short phrase justifying why they are a competitor), and "confidence" (number between 0 and 100). No commentary, no markdown.`;

  logger.info(TAG, `Prompt Generated, Claude Request Sent for ${domain}`, { projectId: project._id });

  const raw = await aiEngine.complete({
    workspaceId,
    agentKey: AGENT_KEY,
    projectId: project._id,
    messages: [{ role: 'user', content: prompt }],
    model: agentConfig.modelName,
    temperature: 0.5,
    maxTokens: 800,
    jsonMode: true,
    retryOptions: { retries: 2, minTimeout: 1000 }
  });

  logger.info(TAG, `Claude Response Received for ${domain}`, { projectId: project._id });

  let parsedDomains = [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Expected JSON array");
    if (parsed.length === 0) throw new Error("Claude returned empty array");
    
    for (const item of parsed) {
      if (!item || typeof item.domain !== 'string' || !item.domain.trim()) continue;
      
      const normalized = domainNormalizationEngine.normalizeDomain(item.domain);
      if (!normalized) continue;
      
      const confidence = typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 100 ? item.confidence : 50;
      
      let threatLevel = 'medium';
      if (confidence >= 95) threatLevel = 'critical';
      else if (confidence >= 80) threatLevel = 'high';
      else if (confidence >= 60) threatLevel = 'medium';
      else if (confidence >= 40) threatLevel = 'low';
      else threatLevel = 'minimal';

      parsedDomains.push({
        domain: normalized,
        reason: typeof item.reason === 'string' ? item.reason.trim() : '',
        confidence,
        threatLevel
      });
    }
  } catch (error) {
    logger.error(TAG, `Failed to parse AI competitor-seed JSON: ${error.message}`, { projectId: project._id });
    throw new Error(`Claude returned invalid response: ${error.message}`);
  }

  return parsedDomains.map((d) => ({
    domain: d.domain,
    commonKeywords: 0,
    organicKeywords: 0,
    organicTraffic: 0,
    organicCost: 0,
    referringDomains: 0,
    backlinks: 0,
    domainRank: 0,
    dataSource: 'ai-estimate',
    threatLevel: d.threatLevel,
    rationale: d.reason,
    confidence: d.confidence
  }));
}

/**
 * @param {Object} project
 * @param {Array} candidates - from collectCompetitorCandidates
 * @param {string} workspaceId
 * @returns {Promise<{ summary: string, selected: Array }>}
 */
async function analyzeCompetitors(project, candidates, workspaceId) {
  if (candidates.length === 0) {
    return { summary: 'No competitor candidates were available to analyze.', selected: [] };
  }

  const agentConfig = await agentLoader.resolve(AGENT_KEY);
  const skillsBlock = agentLoader.loadSkillsForAgent(agentConfig);
  const memoryBlock = await sharedMemory.recallAsPromptContext({ agencyId: workspaceId, projectId: project._id });
  const targetCount = Math.min(MAX_SUGGESTIONS, candidates.length);

  const prompt = `You are the Competitor Agent for ${project.name} (${project.domain}).

Competitor Candidates (metrics of 0 mean no measured data was available for that field — treat conservatively, do not assume strength or weakness from missing data):
${JSON.stringify(candidates, null, 2)}
${skillsBlock}
${memoryBlock}

Analyze the top ${targetCount} most relevant competitors from the list above. Do not invent competitors that aren't in the list.

Respond with a JSON object of this exact shape:
{
  "summary": "2-4 sentence summary of the overall competitive landscape",
  "competitors": [
    {
      "domain": "must exactly match one candidate above",
      "confidence": 96,
      "strengths": ["short phrase", "..."],
      "weaknesses": ["short phrase", "..."],
      "contentGaps": ["short phrase", "..."],
      "rationale": "1-2 sentence justification grounded in the metrics given"
    }
  ]
}
Note: 'confidence' must be a number between 0 and 100 indicating how strong of a competitor they are.
Respond ONLY with valid JSON, no markdown formatting or commentary.`;

  const raw = await aiEngine.complete({
    workspaceId,
    agentKey: AGENT_KEY,
    projectId: project._id,
    messages: [{ role: 'user', content: prompt }],
    model: agentConfig.modelName,
    temperature: 0.4,
    maxTokens: 4000,
    jsonMode: true,
    retryOptions: { retries: 2, minTimeout: 1000 }
  });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    logger.error(TAG, `Failed to parse AI competitor-analysis JSON: ${error.message}`, { projectId: project._id });
    parsed = { summary: 'Automated analysis did not return structured output; manual review recommended.', competitors: [] };
  }

  const candidateMap = new Map(candidates.map((c) => [domainNormalizationEngine.normalizeDomain(c.domain), c]));
  const selected = (Array.isArray(parsed.competitors) ? parsed.competitors : [])
    .filter((c) => {
      if (!c.domain) return false;
      return candidateMap.has(domainNormalizationEngine.normalizeDomain(c.domain));
    })
    .slice(0, MAX_SUGGESTIONS)
    .map((c) => {
      const norm = domainNormalizationEngine.normalizeDomain(c.domain);
      const candidate = candidateMap.get(norm);
      const confidence = typeof c.confidence === 'number' && c.confidence >= 0 && c.confidence <= 100 ? c.confidence : 50;
      let threatLevel = 'medium';
      if (confidence >= 95) threatLevel = 'critical';
      else if (confidence >= 80) threatLevel = 'high';
      else if (confidence >= 60) threatLevel = 'medium';
      else if (confidence >= 40) threatLevel = 'low';
      else threatLevel = 'minimal';

      return {
        ...candidate,
        domain: candidate.domain, // preserve original casing from the candidate, not the AI's echo
        threatLevel,
        confidence,
        strengths: Array.isArray(c.strengths) ? c.strengths.slice(0, 5).map(String) : [],
        weaknesses: Array.isArray(c.weaknesses) ? c.weaknesses.slice(0, 5).map(String) : [],
        contentGaps: Array.isArray(c.contentGaps) ? c.contentGaps.slice(0, 5).map(String) : [],
        rationale: c.rationale || ''
      };
    });

  return { summary: parsed.summary || '', selected };
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

  // The AI Engine automatically resolves workspaceId -> AiSettings -> configured provider.
  // We do not decrypt or require Anthropic specifically here.
  
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
        const uniqueSelected = new Map();
        for (const c of selected) {
          const norm = domainNormalizationEngine.normalizeDomain(c.domain);
          if (norm && !uniqueSelected.has(norm)) {
             c.domain = norm;
             uniqueSelected.set(norm, c);
          }
        }
        const deduplicatedSelected = Array.from(uniqueSelected.values());
        
        logger.info(TAG, `Parsed Competitors: ${selected.length}, Normalized & Deduplicated: ${deduplicatedSelected.length}`);

        const bulkOps = deduplicatedSelected.map((c) => ({
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
                dataSource: c.dataSource,
                source: 'competitor-agent',
                'agent.agentKey': AGENT_KEY,
                'agent.threatLevel': c.threatLevel,
                'agent.strengths': c.strengths,
                'agent.weaknesses': c.weaknesses,
                'agent.contentGaps': c.contentGaps,
                'agent.rationale': c.rationale,
                'agent.confidence': c.confidence
              },
              $setOnInsert: { status: 'Suggested' }
            },
            upsert: true
          }
        }));
        const bulkResult = await WorkspaceCompetitor.bulkWrite(bulkOps);
        logger.info(TAG, `Saved Competitors: Inserted ${bulkResult.upsertedCount || 0}, Updated ${bulkResult.modifiedCount || 0}`);

        suggestedCompetitors = await WorkspaceCompetitor.find({
          projectId: project._id,
          domain: { $in: deduplicatedSelected.map((c) => c.domain) }
        }).lean();
      }

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
