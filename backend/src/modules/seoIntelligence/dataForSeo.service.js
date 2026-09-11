'use strict';

const axios = require('axios');

// ─────────────────────────────────────────────────────────
//  DataForSEO Service  –  Production-Ready Integration
//  Reads credentials from ENV only. Never exposed to client.
// ─────────────────────────────────────────────────────────
class DataForSeoService {
  constructor() {
    this.login    = process.env.DATAFORSEO_LOGIN;
    this.password = process.env.DATAFORSEO_PASSWORD;
    this.baseUrl  = (process.env.DATAFORSEO_BASE_URL || 'https://api.dataforseo.com').replace(/\/$/, '') + '/v3';

    this.isConfigured = Boolean(this.login && this.password);

    if (this.isConfigured) {
      this.client = axios.create({
        baseURL: this.baseUrl,
        auth: { username: this.login, password: this.password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000 // 60 s
      });
      console.info('[DataForSEO] Service initialised with live credentials.');
    } else {
      console.warn('[DataForSEO] Credentials not found in ENV (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD). API calls will return empty results.');
    }
  }

  // ─────────────────────────────────────────────────────
  //  INTERNAL HELPERS
  // ─────────────────────────────────────────────────────

  /**
   * Classify DataForSEO status codes into readable errors.
   * @param {number} code
   */
  _classifyStatusCode(code) {
    const map = {
      20000: null,
      20100: 'Task created – result not yet ready',
      40000: 'Bad request – check your payload',
      40100: 'Authentication failed – check DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD',
      40200: 'Insufficient API credits – top up your DataForSEO balance',
      40400: 'Resource not found on DataForSEO servers',
      40602: 'Empty result (no data found in index)',
      50000: 'DataForSEO internal server error',
    };
    return map[code] || `DataForSEO error code ${code}`;
  }

  /**
   * Generic request wrapper – used by every public method.
   * @param {string} endpoint   e.g. '/serp/google/organic/live/advanced'
   * @param {string} method     'GET' | 'POST'
   * @param {Array}  data       POST body array
   * @returns {Promise<object>} raw DataForSEO response
   */
  async makeRequest(endpoint, method = 'POST', data = []) {
    if (!this.isConfigured) {
      console.warn(`[DataForSEO] Skipping ${endpoint} – no credentials configured.`);
      return { tasks: [] };
    }

    try {
      console.info(`[DataForSEO] ${method} ${endpoint}`);
      const response = await this.client({ method, url: endpoint, data });
      const body = response.data;
      
      // Check root-level API errors (like 40100 Unauthorized)
      if (body.status_code && body.status_code !== 20000 && body.status_code !== 20100) {
         throw new Error(body.status_message || `DataForSEO API error: ${body.status_code}`);
      }

      // Check task-level status codes
      if (body.tasks && body.tasks.length > 0) {
        for (const task of body.tasks) {
          if (task.status_code && task.status_code !== 20000 && task.status_code !== 20100) {
            const msg = this._classifyStatusCode(task.status_code);
            if (task.status_code !== 40602) {
              console.error(`[DataForSEO] Task error on ${endpoint}: ${msg}`);
            } else {
              console.info(`[DataForSEO] ${endpoint}: ${msg}`);
            }
          }
        }
      }

      return body;
    } catch (err) {
      this._handleAxiosError(endpoint, err);
      throw err; // Actually throw so the controller knows it failed
    }
  }

  /**
   * Handle Axios errors without rethrowing (log + degrade gracefully).
   */
  _handleAxiosError(endpoint, err) {
    if (err.code === 'ECONNABORTED') {
      console.error(`[DataForSEO] Timeout on ${endpoint}`);
      return;
    }
    if (err.response) {
      const status = err.response.status;
      const body   = err.response.data;
      if (status === 401) {
        console.error('[DataForSEO] 401 Unauthorised – verify DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in .env');
      } else if (status === 402) {
        console.error('[DataForSEO] 402 Payment Required – insufficient balance on DataForSEO account');
      } else if (status === 400) {
        console.error(`[DataForSEO] 400 Bad Request on ${endpoint}:`, JSON.stringify(body));
      } else {
        console.error(`[DataForSEO] HTTP ${status} on ${endpoint}:`, JSON.stringify(body));
      }
    } else {
      console.error(`[DataForSEO] Network error on ${endpoint}:`, err.message);
    }
  }

  // ─────────────────────────────────────────────────────
  //  1. ACCOUNT / API USAGE
  // ─────────────────────────────────────────────────────

  /**
   * Retrieve account balance and usage statistics.
   * Endpoint: GET /appendix/user_data
   */
  async getAccountBalance() {
    const raw = await this.makeRequest('/appendix/user_data', 'GET');
    const result = raw.tasks?.[0]?.result?.[0] || {};
    return {
      balance:     result.money?.balance     ?? 0,
      spent_today: result.money?.spent_today ?? 0,
      total_spent: result.money?.total_debt  ?? 0,
      currency:    result.money?.currency    ?? 'USD'
    };
  }

  // ─────────────────────────────────────────────────────
  //  2. KEYWORD DATA
  // ─────────────────────────────────────────────────────

  /**
   * Search Volume for a list of keywords.
   * Endpoint: POST /keywords_data/google_ads/search_volume/live
   * @param {string[]} keywords
   * @param {number}   locationCode   DataForSEO location code (default 2840 = US)
   * @param {string}   languageCode   ISO 639-1 code (default 'en')
   */
  async getSearchVolume(keywords, locationCode = 2840, languageCode = 'en') {
    const payload = [{
      keywords,
      location_code:  locationCode,
      language_code:  languageCode,
      date_from:      this._sixMonthsAgo()
    }];
    const raw = await this.makeRequest('/keywords_data/google_ads/search_volume/live', 'POST', payload);
    return raw.tasks?.[0]?.result || [];
  }

  /**
   * Keyword Suggestions / Ideas from a seed keyword.
   * Endpoint: POST /dataforseo_labs/google/keyword_suggestions/live
   */
  async getKeywordSuggestions(keyword, locationCode = 2840, languageCode = 'en', limit = 50) {
    const payload = [{
      keyword,
      location_code:  locationCode,
      language_code:  languageCode,
      limit
    }];
    const raw = await this.makeRequest('/dataforseo_labs/google/keyword_suggestions/live', 'POST', payload);
    return raw.tasks?.[0]?.result?.[0]?.items || [];
  }

  /**
   * Keyword Ideas (broader – includes related terms).
   * Endpoint: POST /dataforseo_labs/google/keyword_ideas/live
   */
  async getKeywordIdeas(keyword, locationCode = 2840, languageCode = 'en', limit = 50) {
    const payload = [{
      keywords: [keyword],
      location_code:  locationCode,
      language_code:  languageCode,
      limit
    }];
    const raw = await this.makeRequest('/dataforseo_labs/google/keyword_ideas/live', 'POST', payload);
    return raw.tasks?.[0]?.result?.[0]?.items || [];
  }

  /**
   * Keyword Difficulty for an array of keywords.
   * Endpoint: POST /dataforseo_labs/google/bulk_keyword_difficulty/live
   */
  async getKeywordDifficulty(keywords, locationCode = 2840, languageCode = 'en') {
    const payload = [{
      keywords,
      location_code: locationCode,
      language_code: languageCode
    }];
    const raw = await this.makeRequest('/dataforseo_labs/google/bulk_keyword_difficulty/live', 'POST', payload);
    return raw.tasks?.[0]?.result?.[0]?.items || [];
  }

  // ─────────────────────────────────────────────────────
  //  3. SERP / ORGANIC RESULTS
  // ─────────────────────────────────────────────────────

  /**
   * Live Google Organic SERP results.
   * Endpoint: POST /serp/google/organic/live/advanced
   * @param {string[]} tasks   Array of { keyword, location_code, language_code }
   */
  async getSerpResults(tasks) {
    const validTasks = tasks.filter(t => t && t.keyword && typeof t.keyword === 'string' && t.keyword.trim().length > 0);
    if (validTasks.length === 0) return [];

    const payload = validTasks.map(t => ({
      keyword:       t.keyword.trim(),
      location_code: parseInt(t.location_code || 2840, 10),
      language_code: t.language_code || 'en',
      depth:         100 // full 10 pages
    }));
    
    const chunks = [];
    for (let i = 0; i < payload.length; i += 100) {
      chunks.push(payload.slice(i, i + 100));
    }
    
    const allTasks = [];
    for (const chunk of chunks) {
      const raw = await this.makeRequest('/serp/google/organic/live/advanced', 'POST', chunk);
      if (raw && raw.tasks) {
        allTasks.push(...raw.tasks);
      }
    }
    return allTasks;
  }

  // ─────────────────────────────────────────────────────
  //  4. COMPETITOR ANALYSIS
  // ─────────────────────────────────────────────────────

  /**
   * Top organic competitors for a domain.
   * Endpoint: POST /dataforseo_labs/google/competitors_domain/live
   */
  async getCompetitors(domain, locationCode = 2840, languageCode = 'en', limit = 100) {
    const payload = [{
      target:        domain,
      location_code: locationCode,
      language_code: languageCode,
      limit:         limit
    }];
    const raw = await this.makeRequest('/dataforseo_labs/google/competitors_domain/live', 'POST', payload);
    return raw.tasks?.[0]?.result?.[0]?.items || [];
  }

  // ─────────────────────────────────────────────────────
  //  5. DOMAIN OVERVIEW / RANK
  // ─────────────────────────────────────────────────────

  /**
   * Ranked keywords for a domain.
   * Endpoint: POST /dataforseo_labs/google/ranked_keywords/live
   */
  async getRankedKeywords(domain, limit = 10, locationCode = 2840, languageCode = 'en') {
    const payload = [{
      target:        domain,
      location_code: locationCode,
      language_code: languageCode,
      limit:         limit
    }];
    const raw = await this.makeRequest('/dataforseo_labs/google/ranked_keywords/live', 'POST', payload);
    return raw.tasks?.[0]?.result?.[0]?.items || [];
  }

  /**
   * Domain organic rank overview (traffic, keyword count, ETV etc.)
   * Endpoint: POST /dataforseo_labs/google/domain_rank_overview/live
   */
  async getDomainOverview(domain, locationCode = 2840, languageCode = 'en') {
    const payload = [{
      target:        domain,
      location_code: locationCode,
      language_code: languageCode
    }];
    const raw = await this.makeRequest('/dataforseo_labs/google/domain_rank_overview/live', 'POST', payload);
    return raw.tasks?.[0]?.result?.[0]?.items?.[0] || null;
  }

  // ─────────────────────────────────────────────────────
  //  6. BACKLINKS
  // ─────────────────────────────────────────────────────

  /**
   * Backlink summary for a domain.
   * Endpoint: POST /backlinks/summary/live
   */
  async getBacklinkSummary(target) {
    const payload = [{
      target,
      internal_list_limit: 0,
      backlinks_status_type: 'live',
      include_subdomains: true
    }];
    const raw = await this.makeRequest('/backlinks/summary/live', 'POST', payload);
    return raw.tasks?.[0]?.result?.[0] || null;
  }

  /**
   * Referring domains for a target.
   * Endpoint: POST /backlinks/referring_domains/live
   */
  async getReferringDomains(target, limit = 25) {
    const payload = [{
      target,
      limit,
      backlinks_status_type: 'live',
      order_by:              ['rank,desc']
    }];
    const raw = await this.makeRequest('/backlinks/referring_domains/live', 'POST', payload);
    return raw.tasks?.[0]?.result?.[0]?.items || [];
  }

  // ─────────────────────────────────────────────────────
  //  7. ON-PAGE / SITE AUDIT
  // ─────────────────────────────────────────────────────

  /**
   * Create an On-Page crawl task and immediately fetch its summary.
   * DataForSEO On-Page is asynchronous. We use the Instant API (task_post + summary).
   * In production you'd poll for task completion; here we return the instant result.
   * Endpoint: POST /on_page/task_post
   */
  async runOnPageAudit(domain, maxCrawlPages = 5) {
    const targetDomain = domain.replace(/^https?:\/\/(www\.)?/, '');

    const payload = [{
      target:          targetDomain,
      max_crawl_pages: maxCrawlPages,
      load_resources:  false,
      enable_javascript: false,
      check_spell:     false
    }];

    const raw = await this.makeRequest('/on_page/task_post', 'POST', payload);
    const task = raw.tasks?.[0];

    if (!task || !task.id) {
      console.warn('[DataForSEO] On-Page task_post returned no task id');
      return null;
    }

    if (task.status_code && task.status_code !== 20000 && task.status_code !== 20100) {
      throw new Error(`DataForSEO Error: ${task.status_message} (Check if your project domain is valid)`);
    }

    const taskId = task.id;

    // Poll the summary endpoint indefinitely until the crawl is finished
    let result = null;
    
    while (true) {
      // Wait 10 seconds between polls to avoid spamming the API
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const summaryRaw = await this.makeRequest(`/on_page/summary/${taskId}`, 'GET');
      const currentResult = summaryRaw.tasks?.[0]?.result?.[0];
      
      if (currentResult && (currentResult.crawl_progress === 'finished' || currentResult.page_metrics)) {
        result = currentResult;
        break;
      }
    }

    if (!result) {
      throw new Error('The website audit is taking longer than expected. Please try again.');
    }

    return { taskId, result };
  }

  // ─────────────────────────────────────────────────────
  //  8. LIGHTHOUSE / CORE WEB VITALS
  // ─────────────────────────────────────────────────────

  /**
   * Lighthouse / Page Speed audit via DataForSEO.
   * Endpoint: POST /on_page/lighthouse/live/json
   */
  async getPageSpeed(url, strategy = 'desktop') {
    const payload = [{
      url,
      for_mobile: strategy === 'mobile'
    }];
    const raw = await this.makeRequest('/on_page/lighthouse/live/json', 'POST', payload);
    return raw.tasks?.[0]?.result?.[0] || null;
  }

  // ─────────────────────────────────────────────────────
  //  9. LOCAL SEO / GOOGLE MAPS
  // ─────────────────────────────────────────────────────

  /**
   * Google Maps / Local pack SERP results.
   * Endpoint: POST /serp/google/maps/live/advanced
   */
  async getLocalSeoResults(keyword, locationCode = 2840, languageCode = 'en') {
    const payload = [{
      keyword,
      location_code: locationCode,
      language_code: languageCode
    }];
    const raw = await this.makeRequest('/serp/google/maps/live/advanced', 'POST', payload);
    return raw.tasks?.[0]?.result?.[0]?.items || [];
  }

  // ─────────────────────────────────────────────────────
  //  10. CONTENT ANALYSIS
  // ─────────────────────────────────────────────────────

  /**
   * Content Analysis summary for a URL.
   * Endpoint: POST /content_analysis/summary/live
   */
  async getContentAnalysis(url) {
    const payload = [{
      url,
      initial_dataset_filters: [['content_info.semantic_location', '=', 'article']]
    }];
    const raw = await this.makeRequest('/content_analysis/summary/live', 'POST', payload);
    return raw.tasks?.[0]?.result?.[0] || null;
  }

  // ─────────────────────────────────────────────────────
  //  UTILITY
  // ─────────────────────────────────────────────────────

  _sixMonthsAgo() {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  }
}

module.exports = new DataForSeoService();
