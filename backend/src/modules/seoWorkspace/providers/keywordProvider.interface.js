/**
 * Keyword Provider — Interface
 *
 * This is the contract every keyword data source must satisfy to plug into
 * `keywordProviderChain.js`. It exists so `keywordIntelligence.service.js`
 * (the layer every keyword feature calls into) never imports
 * `dataForSeo.service.js` directly:
 *
 *   Keyword Intelligence
 *     → Keyword Provider Chain
 *                                                            → Future providers
 *
 * Adding a new vendor (e.g. Ahrefs, Moz, GSC-derived data) means writing one
 * adapter file that implements these methods and registering it in the
 * chain — nothing above the provider layer changes.
 *
 * Every method must:
 *   - Never throw for "no data" — return an empty array/null, so the chain
 *     can fall through to the next provider without try/catch at every call site.
 *   - Only throw for genuine failures (auth, network, rate-limit) that the
 *     chain should log and fall through on anyway.
 *   - Return data already normalized to the shapes documented below —
 *     provider-specific field names (DataForSEO's `keyword_info`)
 *
 * Normalized shapes:
 *
 *   KeywordCandidate = {
 *     keyword: string,
 *     searchVolume: number,
 *     cpc: number,
 *     competition: number,        // 0–1
 *     intent: 'informational'|'navigational'|'commercial'|'transactional'|'unknown',
 *     keywordDifficulty: number,  // 0–100
 *     monthlySearches: [{ month: number, year: number, searchVolume: number }]
 *   }
 *
 *   SerpResult = {
 *     keyword: string,
 *     topResults: [{ domain, title, url, rank }],
 *     featuredSnippet: { domain, url, text } | null,
 *     paaQuestions: string[],
 *     relatedSearches: string[]
 *   }
 *
 *   RankedKeyword = {
 *     keyword: string,
 *     rank: number,
 *     searchVolume: number,
 *     url: string | null
 *   }
 */

class KeywordProviderInterface {
  /** @returns {string} short id used in cache keys / logs, e.g. 'dataforseo' */
  get id() { throw new Error('Provider must implement id'); }

  /** @returns {boolean} whether this provider has usable credentials right now */
  get isConfigured() { throw new Error('Provider must implement isConfigured'); }

  /** @returns {Promise<KeywordCandidate[]>} */
  async getSuggestions(_seed, _opts) { throw new Error('Not implemented'); }

  /** @returns {Promise<KeywordCandidate[]>} broader/related terms for a seed */
  async getIdeas(_seed, _opts) { throw new Error('Not implemented'); }

  /** @returns {Promise<{ keyword: string, keywordDifficulty: number }[]>} */
  async getDifficulty(_keywords, _opts) { throw new Error('Not implemented'); }

  /** @returns {Promise<KeywordCandidate[]>} volume + monthlySearches for exact keywords */
  async getSearchVolume(_keywords, _opts) { throw new Error('Not implemented'); }

  /** @returns {Promise<SerpResult[]>} */
  async getSerpResults(_tasks, _opts) { throw new Error('Not implemented'); }

  /** @returns {Promise<RankedKeyword[]>} keywords a domain currently ranks for */
  async getRankedKeywords(_domain, _opts) { throw new Error('Not implemented'); }
}

module.exports = KeywordProviderInterface;
