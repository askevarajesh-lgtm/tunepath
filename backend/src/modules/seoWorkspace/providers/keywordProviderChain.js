/**
 * Keyword Provider Chain
 *
 * The single dependency `keywordIntelligence.service.js` (and, going
 * forward, anything else that needs keyword data) is allowed to import.
 * Tries each registered provider in order and falls through to the next on
 * "unconfigured", "threw", or "returned nothing" — mirroring the
 * DataForSEO → AI-estimate fallback pattern `competitorAgent` already uses,
 * but generalized so it isn't reimplemented per-feature.
 *
 * NOTE: Semrush is NOT in this chain. Marketplace SEO uses only DataForSEO.
 *
 *   Keyword Intelligence → Keyword Provider (this file) → DataForSEO
 *                                                        → Future providers
 *
 * Adding a provider = require it here, push it into PROVIDERS. Nothing
 * above this file changes.
 */
const logger = require('../../aiCore/logger.service');

const dataForSeoProvider = require('./dataForSeoKeywordProvider');

const TAG = 'KeywordProviderChain';

// Ordered fallback chain. Future providers (Ahrefs, Moz, ...) get appended here.
const PROVIDERS = [dataForSeoProvider];

function isEmpty(result) {
  if (result == null) return true;
  if (Array.isArray(result)) return result.length === 0;
  return false;
}

/**
 * Runs `methodName(...args)` against each configured provider in order,
 * returning the first non-empty result. Never throws for "no provider had
 * data" — returns an empty array so callers don't need try/catch.
 *
 * @param {string} methodName - one of the KeywordProviderInterface methods
 * @param {Array} args
 * @returns {Promise<{ data: any, providerId: string|null }>}
 */
async function callChain(methodName, args) {
  let lastError = null;
  let lastStatus = null;

  for (const provider of PROVIDERS) {
    if (!provider.isConfigured) continue;
    try {
      const data = await provider[methodName](...args);
      if (!isEmpty(data)) {
        return { data, providerId: provider.id, status: 'SUCCESS' };
      }
      logger.debug(TAG, `${provider.id}.${methodName} returned no data, trying next provider`);
    } catch (error) {
      logger.warn(TAG, `${provider.id}.${methodName} failed: ${error.message}, trying next provider`);
      lastError = error;
      
      const msg = error.message.toLowerCase();
      if (msg.includes('timeout') || error.code === 'ECONNABORTED') {
        lastStatus = 'TIMEOUT';
      } else if (msg.includes('payment required') || msg.includes('balance') || msg.includes('402')) {
        lastStatus = 'RATE_LIMIT';
      } else {
        lastStatus = 'PROVIDER_ERROR';
      }
    }
  }
  
  const emptyData = Array.isArray(await safeEmptyShape(methodName)) ? [] : [];
  return { 
    data: emptyData, 
    providerId: null, 
    error: lastError,
    status: lastStatus || (hasAnyConfiguredProvider() ? 'NOT_FOUND' : 'UNCONFIGURED')
  };
}

async function safeEmptyShape() {
  return [];
}

/** @returns {boolean} true if at least one provider in the chain is usable right now */
function hasAnyConfiguredProvider() {
  return PROVIDERS.some((p) => p.isConfigured);
}

module.exports = {
  getSuggestions: (seed, opts) => callChain('getSuggestions', [seed, opts]),
  getIdeas: (seed, opts) => callChain('getIdeas', [seed, opts]),
  getDifficulty: (keywords, opts) => callChain('getDifficulty', [keywords, opts]),
  getSearchVolume: (keywords, opts) => callChain('getSearchVolume', [keywords, opts]),
  getSerpResults: (tasks, opts) => callChain('getSerpResults', [tasks, opts]),
  getRankedKeywords: (domain, opts) => callChain('getRankedKeywords', [domain, opts]),
  hasAnyConfiguredProvider,
  PROVIDERS // exposed for tests / diagnostics only
};
