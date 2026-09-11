const crypto = require('crypto');
const KeywordCache = require('../models/keywordCache.model');
const logger = require('../../aiCore/logger.service');

const TAG = 'KeywordCache';

const DEFAULT_TTL_SECONDS = {
  keyword_suggestions: 60 * 60 * 24 * 7,  // 7 days — suggestion lists barely change week to week
  search_volume: 60 * 60 * 24 * 14,        // 14 days — Google Ads volume is a monthly figure
  keyword_difficulty: 60 * 60 * 24 * 14,   // 14 days
  serp: 60 * 60 * 12,                      // 12 hours — SERPs move often, keep this short
  trend: 60 * 60 * 24 * 14,                // 14 days — same monthly_searches series as volume
  related_keywords: 60 * 60 * 24 * 7,      // 7 days
  question_keywords: 60 * 60 * 24 * 7,     // 7 days
  keyword_gap: 60 * 60 * 24,               // 24h expiry
  content_gap: 60 * 60 * 24,               // 24h
  backlink_gap: 60 * 60 * 24 * 2,          // 48h — referring domains churn slower than SERPs
  page_gap: 60 * 60 * 24,                  // 24h
  overview: 60 * 60 * 24                   // 24h
};

function ttlSecondsFor(operation) {
  const envKey = `KEYWORD_CACHE_TTL_${operation.toUpperCase()}`;
  const envVal = parseInt(process.env[envKey], 10);
  if (Number.isFinite(envVal) && envVal > 0) return envVal;
  return DEFAULT_TTL_SECONDS[operation] || 60 * 60 * 24; // 1 day fallback
}

function buildCacheKey(operation, params) {
  const normalized = JSON.stringify(params, Object.keys(params || {}).sort());
  const hash = crypto.createHash('sha1').update(normalized).digest('hex');
  return `${operation}:${hash}`;
}

/**
 * @param {string} operation - one of the enum values in keywordCache.model.js
 * @param {Object} params - anything identifying this request (seed, keywords[], locationCode, projectId...)
 * @param {Function} fetchFn - async () => data
 * @param {Object} [options]
 * @param {string} [options.projectId]
 * @param {number} [options.ttlSeconds] - overrides the operation default
 * @param {boolean} [options.bypassCache] - force a fresh fetch (still writes the new result to cache)
 * @returns {Promise<{ data: any, fromCache: boolean, providerId: string|null }>}
 */
async function getOrFetch(operation, params, fetchFn, options = {}) {
  const cacheKey = buildCacheKey(operation, params);

  if (!options.bypassCache) {
    try {
      const hit = await KeywordCache.findOne({ cacheKey }).lean();
      if (hit) {
        logger.debug(TAG, `HIT ${operation}`, { cacheKey });
        return { data: hit.data, fromCache: true, providerId: hit.providerId };
      }
    } catch (error) {
      logger.warn(TAG, `Cache read failed for ${operation}, falling through to live fetch: ${error.message}`);
    }
  }

  logger.debug(TAG, `MISS ${operation}`, { cacheKey });
  const result = await fetchFn(); // expected shape: { data, providerId } or a raw value
  const data = result && typeof result === 'object' && 'data' in result ? result.data : result;
  const providerId = result && typeof result === 'object' && 'providerId' in result ? result.providerId : null;

  const ttlSeconds = options.ttlSeconds || ttlSecondsFor(operation);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  try {
    await KeywordCache.findOneAndUpdate(
      { cacheKey },
      { operation, cacheKey, providerId, projectId: options.projectId || null, data, expiresAt },
      { upsert: true }
    );
  } catch (error) {
    logger.warn(TAG, `Cache write failed for ${operation}: ${error.message}`);
  }

  return { data, fromCache: false, providerId };
}

async function invalidate(operation, params) {
  const cacheKey = buildCacheKey(operation, params);
  await KeywordCache.deleteOne({ cacheKey });
}

module.exports = { getOrFetch, invalidate, ttlSecondsFor };