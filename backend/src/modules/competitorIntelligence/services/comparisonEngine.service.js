/**
 * Comparison Engine — AI SEO Platform v2 §0/§1.
 *
 * The v2 architecture doc treats this layer as an already-approved,
 * pre-existing foundation ("Nothing there changes"). A direct read of this
 * codebase found no `comparisonEngine.service.js`, `competitorProviderChain.js`,
 * or `ComparisonResult` envelope anywhere — so this file *is* that
 * foundation, built now, following the exact same shape the doc's later
 * sections (§2 AI Recommendation, §4 Execution History, §7 Execution Queue)
 * already assume it has.
 *
 * Mirrors `seoWorkspace/services/keywordIntelligence.service.js`'s role
 * exactly: the one orchestration layer every comparison feature calls into.
 * Must NEVER `require('../../seoIntelligence/dataForSeo.service')` or
 * `require('../../semrush/semrush.service')` directly — only
 * `competitorProviderChain.js`.
 *
 * Every provider-chain call goes through `keywordCache.service.js` (reused
 * as-is, per §5 — the new `keyword_gap`/`content_gap`/`backlink_gap`/
 * `page_gap`/`overview` operation values were registered on the existing
 * `WorkspaceKeywordCache` model rather than a parallel cache), and every
 * call writes exactly one `ComparisonExecutionLog`, updated through its
 * lifecycle (§4).
 */
const crypto = require('crypto');
const providerChain = require('../providers/competitorProviderChain');
const cache = require('../../seoWorkspace/services/keywordCache.service');
const ComparisonExecutionLog = require('../models/comparisonExecutionLog.model');
const logger = require('../../aiCore/logger.service');

const TAG = 'ComparisonEngine';

const CHAIN_METHOD_BY_TYPE = {
  keyword_gap:  'getKeywordGap',
  content_gap:  'getContentGap',
  backlink_gap: 'getBacklinkGap',
  page_gap:     'getPageGap',
  top_pages:    'getTopPages'  // new: per-domain top pages by traffic
};

function normalizeDomain(domain) {
  return (domain || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

function newComparisonId() {
  return `cmp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Runs one comparison (single competitor domain, one gap type OR the
 * 'overview' aggregate) and returns a normalized `ComparisonResult`.
 * Writes/updates a `ComparisonExecutionLog` across the call.
 *
 * @param {Object} params
 * @param {string} params.projectId
 * @param {string} params.agencyId
 * @param {string} params.yourDomain
 * @param {string[]} params.competitorDomains
 * @param {'keyword_gap'|'content_gap'|'backlink_gap'|'page_gap'|'top_pages'|'overview'} params.type
 * @param {Object} [params.opts] - { locationCode, languageCode, limit, forceRefresh, comparisonId }
 * @returns {Promise<ComparisonResult>}
 */
async function compare(params) {
  const { projectId, agencyId, yourDomain, competitorDomains, type, opts = {} } = params;
  
  if (!competitorDomains || competitorDomains.length === 0) {
    throw new Error('At least one competitor domain must be provided');
  }

  const WorkspaceCompetitor = require('../../seoWorkspace/models/workspaceCompetitor.model');
  const normalizedTargets = competitorDomains.map(normalizeDomain);
  
  // Security Check: the competitor domains MUST exist and be Approved for this specific project.
  const approvedCompetitors = await WorkspaceCompetitor.find({
    projectId,
    domain: { $in: normalizedTargets },
    status: 'Approved',
    isDeleted: false
  }).lean();

  if (approvedCompetitors.length !== normalizedTargets.length) {
    throw new Error('Unauthorized or invalid competitor domain. All competitors must be Approved in this project.');
  }

  const comparisonId = opts.comparisonId || newComparisonId();
  const domains = [normalizeDomain(yourDomain), ...normalizedTargets];

  const log = await ComparisonExecutionLog.create({
    comparisonId, projectId, agencyId, domains, type, status: 'running'
  });
  const startedAt = Date.now();

  try {
    let result;
    if (type === 'overview') {
      result = await runOverview(yourDomain, competitorDomains, opts);
    } else if (type === 'top_pages') {
      result = await runTopPages(yourDomain, competitorDomains, opts);
    } else {
      result = await runGap(type, yourDomain, competitorDomains, opts);
    }

    await ComparisonExecutionLog.findByIdAndUpdate(log._id, {
      status: 'completed',
      providerId: result.providerId || null,
      durationMs: Date.now() - startedAt,
      resultSummary: result.summary
    });

    return { ...result, comparisonId };
  } catch (error) {
    logger.warn(TAG, `compare() failed for ${type} on ${domains.join(',')}: ${error.message}`);
    await ComparisonExecutionLog.findByIdAndUpdate(log._id, {
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: error.message
    });
    throw error;
  }
}

async function runOverview(yourDomain, competitorDomains, opts) {
  const allDomains = [yourDomain, ...competitorDomains];
  const overviews = await Promise.all(
    allDomains.map(async (domain) => {
      const cacheParams = { domain: normalizeDomain(domain), locationCode: opts.locationCode, languageCode: opts.languageCode };
      const { data } = await cache.getOrFetch(
        'overview', cacheParams,
        () => providerChain.getOverview(domain, opts),
        { projectId: opts.projectId, bypassCache: opts.forceRefresh }
      );
      return data;
    })
  );

  const byType = { overview: overviews.filter(Boolean).length };
  return {
    domains: allDomains.map(normalizeDomain),
    type: 'overview',
    rows: [],
    overview: overviews.filter(Boolean),
    summary: { totalGaps: 0, byType },
    providerId: null
  };
}

async function runTopPages(yourDomain, competitorDomains, opts) {
  const allDomains = [yourDomain, ...competitorDomains];
  let providerIdUsed = null;
  const pagesByDomain = {};

  await Promise.all(allDomains.map(async (domain) => {
    const normalized = normalizeDomain(domain);
    const cacheParams = { domain: normalized, locationCode: opts.locationCode, languageCode: opts.languageCode, op: 'top_pages' };
    const { data, providerId } = await cache.getOrFetch(
      'top_pages', cacheParams,
      () => providerChain.getTopPages(domain, opts),
      { projectId: opts.projectId, bypassCache: opts.forceRefresh }
    );
    if (providerId) providerIdUsed = providerId;
    pagesByDomain[normalized] = data || [];
  }));

  return {
    domains: allDomains.map(normalizeDomain),
    type: 'top_pages',
    rows: [],
    pagesByDomain,
    overview: null,
    summary: { totalGaps: 0, byType: { top_pages: Object.values(pagesByDomain).reduce((s, a) => s + a.length, 0) } },
    providerId: providerIdUsed
  };
}

async function runGap(type, yourDomain, competitorDomains, opts) {
  const methodName = CHAIN_METHOD_BY_TYPE[type];
  if (!methodName) throw new Error(`Comparison Engine: unknown comparison type "${type}"`);

  // Cache invalidation rule (§5): a cached comparison whose competitorDomains
  // don't exactly match the request is not reused — set-equality check.
  const sortedCompetitors = [...competitorDomains].map(normalizeDomain).sort();
  let providerIdUsed = null;
  let allRows = [];

  for (const competitorDomain of sortedCompetitors) {
    const cacheParams = {
      yourDomain: normalizeDomain(yourDomain),
      competitorDomain,
      locationCode: opts.locationCode,
      languageCode: opts.languageCode
    };

    const { data: rows, providerId } = await cache.getOrFetch(
      type, cacheParams,
      async () => {
        const chainResult = await providerChain[methodName](yourDomain, competitorDomain, opts);
        return chainResult; // { data, providerId } — keywordCache.service.js already understands this shape
      },
      { projectId: opts.projectId, bypassCache: opts.forceRefresh }
    );

    if (providerId) providerIdUsed = providerId;
    allRows = allRows.concat(rows || []);
  }

  return {
    domains: [normalizeDomain(yourDomain), ...sortedCompetitors],
    type,
    rows: allRows,
    overview: null,
    summary: { totalGaps: allRows.length, byType: { [type]: allRows.length } },
    providerId: providerIdUsed
  };
}

/** Manual cache invalidation for a project — reuses keywordCache.service.js's delete-by-key path (§5). */
async function invalidateCache(type, yourDomain, competitorDomain, opts = {}) {
  await cache.invalidate(type, {
    yourDomain: normalizeDomain(yourDomain),
    competitorDomain: normalizeDomain(competitorDomain),
    locationCode: opts.locationCode,
    languageCode: opts.languageCode
  });
}

/**
 * Returns an executive summary of comparison data across all competitor domains.
 * Used by the dashboard summary endpoint. Fetches from cache only (no new API calls).
 *
 * @param {string} yourDomain
 * @param {string[]} competitorDomains
 * @param {{ projectId?: string }} [opts]
 * @returns {Promise<Object>}
 */
async function getCompetitorSummary(yourDomain, competitorDomains, opts = {}) {
  // Run overview to get domain metrics
  const overviewResult = await compare({
    projectId: opts.projectId || 'summary',
    agencyId: opts.agencyId || 'summary',
    yourDomain,
    competitorDomains,
    type: 'overview',
    opts
  }).catch(() => ({ overview: [] }));

  const overviews = overviewResult.overview || [];
  const yours = overviews.find((o) => normalizeDomain(o?.domain) === normalizeDomain(yourDomain)) || {};
  const competitors = overviews.filter((o) => normalizeDomain(o?.domain) !== normalizeDomain(yourDomain));

  const avgTraffic = competitors.length
    ? Math.round(competitors.reduce((s, c) => s + (c.organicTraffic || 0), 0) / competitors.length)
    : 0;

  return {
    yourDomain: normalizeDomain(yourDomain),
    yourMetrics: yours,
    competitorCount: competitors.length,
    avgCompetitorTraffic: avgTraffic,
    trafficDifference: avgTraffic - (yours.organicTraffic || 0),
    avgCompetitorKeywords: competitors.length
      ? Math.round(competitors.reduce((s, c) => s + (c.organicKeywords || 0), 0) / competitors.length)
      : 0,
    competitors
  };
}

module.exports = { compare, invalidateCache, getCompetitorSummary };

