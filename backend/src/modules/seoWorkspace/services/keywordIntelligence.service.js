/**
 * Keyword Intelligence Service
 *
 * The shared orchestration layer every keyword feature (Discovery,
 * Clustering, Intent, SERP Analysis, Competitor Keywords, Trend Analysis,
 * Question/Related/Long-tail Keywords, Opportunities, AI Recommendations)
 * calls into. Per the approved architecture:
 *
 *   Keyword Intelligence → Keyword Provider → DataForSEO
 *                                            → Future providers
 *
 * This file must NEVER `require('../../seoIntelligence/dataForSeo.service')`
 * directly — only
 * `keywordProviderChain.js`. That's what keeps the platform
 * provider-independent: swapping/adding a vendor never touches this file.
 *
 * Every provider-chain call here is wrapped by `keywordCache.service.js`
 * (configurable TTL per operation) and, where it represents a meaningful
 * state change, emits a domain event via `keywordEvents.js` so other
 * modules (Blog AI, Website Builder, Reporting, Automation, Monitoring) can
 * react later without this file knowing about them.
 *
 * `collectKeywordCandidates`/etc. here intentionally mirror the function
 * candidates already used by `keywordResearchAgent.service.js` so that
 * agent can be refactored to call this layer with no behavior change, per
 * the implementation plan.
 */
const providerChain = require('../providers/keywordProviderChain');
const cache = require('./keywordCache.service');
const { keywordEvents, EVENTS } = require('../events/keywordEvents');
const logger = require('../../aiCore/logger.service');

const TAG = 'KeywordIntelligence';
const QUESTION_REGEX = /^(who|what|when|where|why|how|can|does|do|is|are|will|should)\b/i;

function dedupeByKeyword(candidates) {
  const merged = new Map();
  candidates.forEach((c) => {
    if (!c?.keyword) return;
    const key = c.keyword.toLowerCase();
    if (!merged.has(key)) merged.set(key, c);
  });
  return Array.from(merged.values());
}

/**
 * Suggestions + Ideas, merged and deduped — the candidate pool Discovery,
 * Related Keywords, Long-tail, and the regex-only Question Keywords filter
 * are all views over.
 *
 * @param {string} seed
 * @param {Object} [opts] - { locationCode, languageCode, limit, projectId, bypassCache }
 */
async function getCandidatePool(seed, opts = {}) {
  const params = { seed, locationCode: opts.locationCode, languageCode: opts.languageCode, limit: opts.limit };

  const [suggestions, ideas] = await Promise.all([
    cache.getOrFetch('keyword_suggestions', params, () => providerChain.getSuggestions(seed, opts),
      { projectId: opts.projectId, bypassCache: opts.bypassCache }),
    cache.getOrFetch('related_keywords', { ...params, kind: 'ideas' }, () => providerChain.getIdeas(seed, opts),
      { projectId: opts.projectId, bypassCache: opts.bypassCache })
  ]);

  return dedupeByKeyword([...(suggestions.data || []), ...(ideas.data || [])]);
}

/**
 * Enriches a candidate list with keyword difficulty (candidates from
 * getCandidatePool default difficulty to 0 since suggestions/ideas
 * endpoints don't return it).
 */
async function enrichWithDifficulty(candidates, opts = {}) {
  if (candidates.length === 0) return candidates;
  const keywords = candidates.map((c) => c.keyword);
  const { data } = await cache.getOrFetch('keyword_difficulty', { keywords, locationCode: opts.locationCode },
    () => providerChain.getDifficulty(keywords, opts), { projectId: opts.projectId, bypassCache: opts.bypassCache });

  const difficultyMap = new Map((data || []).map((d) => [(d.keyword || '').toLowerCase(), d.keywordDifficulty || 0]));
  return candidates.map((c) => ({ ...c, keywordDifficulty: difficultyMap.get(c.keyword.toLowerCase()) ?? c.keywordDifficulty ?? 0 }));
}

/**
 * Full discovery pass: candidate pool + difficulty enrichment. This is what
 * `keywordResearchAgent.collectKeywordCandidates` now delegates its
 * DataForSEO-facing work to.
 */
async function discoverKeywords(seed, opts = {}) {
  const pool = await getCandidatePool(seed, opts);
  const enriched = await enrichWithDifficulty(pool, opts);

  if (opts.projectId) {
    enriched.forEach((c) => {
      keywordEvents.emitSafe(EVENTS.KEYWORD_DISCOVERED, { projectId: opts.projectId, keyword: c.keyword, source: 'keywordIntelligence' });
    });
  }

  return enriched;
}

/**
 * Standalone, cheap volume+trend lookup for exact keywords — used by Trend
 * Analysis and by any "refresh metrics" action, without running the full
 * AI-curation pipeline.
 */
async function getSearchVolumeAndTrend(keywords, opts = {}) {
  const { data } = await cache.getOrFetch('search_volume', { keywords, locationCode: opts.locationCode },
    () => providerChain.getSearchVolume(keywords, opts), { projectId: opts.projectId, bypassCache: opts.bypassCache });

  if (opts.projectId) {
    keywordEvents.emitSafe(EVENTS.TREND_UPDATED, { projectId: opts.projectId, keywordCount: (data || []).length });
  }
  return data || [];
}

/**
 * SERP snapshot for one or more keywords — organic top 10, featured
 * snippet, PAA, related searches. Feeds Feature 4 (SERP Analysis) and, via
 * `paaQuestions`, the measured branch of Feature 10 (Question Keywords).
 */
async function getSerpSnapshot(tasks, opts = {}) {
  const { data } = await cache.getOrFetch('serp', { tasks }, () => providerChain.getSerpResults(tasks, opts),
    { projectId: opts.projectId, bypassCache: opts.bypassCache });

  if (opts.projectId) {
    (data || []).forEach((r) => {
      keywordEvents.emitSafe(EVENTS.SERP_UPDATED, { projectId: opts.projectId, keyword: r.keyword });
    });
  }
  return data || [];
}

/**
 * Ranked keywords for a competitor domain — feeds Feature 5 (Competitor
 * Keywords / gap detection). Gap/overlap classification itself stays in
 * `competitorAgent.service.js`, which owns the WorkspaceCompetitor model;
 * this just fetches the raw ranked list through the provider chain.
 */
async function getDomainRankedKeywords(domain, opts = {}) {
  const { data } = await cache.getOrFetch('search_volume', { domain, kind: 'ranked_keywords' },
    () => providerChain.getRankedKeywords(domain, opts), { projectId: opts.projectId, bypassCache: opts.bypassCache });
  return data || [];
}

/** Regex-based question classification — Feature 10's cheap, immediate branch. */
function filterQuestionKeywords(candidates) {
  return candidates.filter((c) => QUESTION_REGEX.test(c.keyword.trim()));
}

/** Word-count filter — Feature 12 (Long-tail). */
function filterLongTailKeywords(candidates, minWordCount = 4) {
  return candidates.filter((c) => c.keyword.trim().split(/\s+/).length >= minWordCount);
}

/**
 * Records a GapDetected event — called by whatever computes the actual gap
 * (Feature 5's competitor-keyword diff, Feature 13's content-gap agent) so
 * this file stays the single place those events are shaped consistently.
 */
function notifyGapDetected(payload) {
  keywordEvents.emitSafe(EVENTS.GAP_DETECTED, payload);
}

/** Records a ClusterCreated event — called by the future clustering agent (Feature 2). */
function notifyClusterCreated(payload) {
  keywordEvents.emitSafe(EVENTS.CLUSTER_CREATED, payload);
}

/**
 * ENTERPRISE EVIDENCE ENGINE: Deterministic Ranking Priority
 * GSC (if available) -> DataForSEO -> UNAVAILABLE
 */
function resolveRankingPriority(gscRank, dataForSeoRank, gscUrl, dfsUrl) {
  if (gscRank && gscRank > 0) {
    return {
      rank: gscRank,
      url: gscUrl,
      source: 'GSC'
    };
  } else if (dataForSeoRank && dataForSeoRank > 0) {
    return {
      rank: dataForSeoRank,
      url: dfsUrl,
      source: 'DataForSEO'
    };
  }
  return { rank: null, url: null, source: 'UNAVAILABLE' };
}

/**
 * ENTERPRISE EVIDENCE ENGINE: Transparent Opportunity Score
 * Exposes the calculation breakdown deterministically without AI.
 */
function calculateOpportunityScore({ searchVolume = 0, keywordDifficulty = 0, currentRank = 0, intent = 'informational' }) {
  let score = 0;
  const breakdown = {};

  // Search Volume Weight (Max 40 points)
  let svWeight = 0;
  if (searchVolume > 10000) svWeight = 40;
  else if (searchVolume > 1000) svWeight = 30;
  else if (searchVolume > 100) svWeight = 15;
  else svWeight = 5;
  score += svWeight;
  breakdown.svWeight = svWeight;

  // Difficulty Weight (Max 30 points) - Lower is better
  let kdWeight = 0;
  if (keywordDifficulty < 20) kdWeight = 30;
  else if (keywordDifficulty < 50) kdWeight = 20;
  else if (keywordDifficulty < 75) kdWeight = 10;
  else kdWeight = 0;
  score += kdWeight;
  breakdown.kdWeight = kdWeight;

  // Rank Weight (Max 20 points) - "Low hanging fruit" (Rank 11-20 is best opportunity)
  let rankWeight = 0;
  if (currentRank >= 11 && currentRank <= 20) rankWeight = 20;
  else if (currentRank >= 4 && currentRank <= 10) rankWeight = 15;
  else if (currentRank > 20 && currentRank <= 50) rankWeight = 10;
  else if (currentRank >= 1 && currentRank <= 3) rankWeight = 5; // Already winning
  else rankWeight = 0;
  score += rankWeight;
  breakdown.rankWeight = rankWeight;

  // Intent Weight (Max 10 points) - Transactional/Commercial worth more
  let intentWeight = 0;
  if (['transactional', 'commercial'].includes(intent)) intentWeight = 10;
  else if (intent === 'local') intentWeight = 8;
  else intentWeight = 5; // informational/navigational
  score += intentWeight;
  breakdown.intentWeight = intentWeight;

  return {
    score,
    breakdown,
    rationale: `Scored ${score}/100: SV (${svWeight}), KD (${kdWeight}), Rank (${rankWeight}), Intent (${intentWeight})`
  };
}

/**
 * ENTERPRISE EVIDENCE ENGINE: Multi-Intent Classification
 * Uses a deterministic keyword lookup method to assign confidence.
 */
function classifyIntent(keyword) {
  const kw = keyword.toLowerCase();
  const intents = [];
  
  const transactionalPhrases = ['buy', 'purchase', 'cheap', 'price', 'discount', 'order'];
  const commercialPhrases = ['best', 'top', 'review', 'vs', 'compare', 'alternative'];
  const localPhrases = ['near me', 'location', 'directions', 'city', 'in'];
  const informationalPhrases = ['how', 'what', 'why', 'guide', 'tutorial', 'learn'];
  
  let transConf = transactionalPhrases.some(p => kw.includes(p)) ? 80 : 0;
  let commConf = commercialPhrases.some(p => kw.includes(p)) ? 70 : 0;
  let locConf = localPhrases.some(p => kw.includes(p)) ? 90 : 0;
  let infoConf = informationalPhrases.some(p => kw.includes(p)) ? 85 : 0;
  
  if (transConf) intents.push({ intent: 'transactional', confidence: transConf, reason: 'Contains transactional keywords' });
  if (commConf) intents.push({ intent: 'commercial', confidence: commConf, reason: 'Contains commercial investigation words' });
  if (locConf) intents.push({ intent: 'local', confidence: locConf, reason: 'Contains local intent modifiers' });
  if (infoConf || intents.length === 0) intents.push({ intent: 'informational', confidence: infoConf || 50, reason: infoConf ? 'Contains informational queries' : 'Fallback intent' });
  
  // Sort by confidence
  intents.sort((a, b) => b.confidence - a.confidence);
  
  return {
    primaryIntent: intents[0].intent,
    allIntents: intents
  };
}

logger.debug(TAG, `Initialized. Configured providers: ${providerChain.PROVIDERS.filter((p) => p.isConfigured).map((p) => p.id).join(', ') || 'none'}`);

module.exports = {
  getCandidatePool,
  enrichWithDifficulty,
  discoverKeywords,
  getSearchVolumeAndTrend,
  getSerpSnapshot,
  getDomainRankedKeywords,
  filterQuestionKeywords,
  filterLongTailKeywords,
  notifyGapDetected,
  notifyClusterCreated,
  resolveRankingPriority,
  calculateOpportunityScore,
  classifyIntent,
  QUESTION_REGEX
};
