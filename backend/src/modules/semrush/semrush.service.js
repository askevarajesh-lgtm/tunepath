const axios = require('axios');
const SemrushCache = require('./semrushCache.model');
const SemrushSyncLog = require('./models/semrushSyncLog.model');

class SemrushService {
  constructor() {
    this.baseUrl = 'https://api.semrush.com';
  }

  /**
   * Helper to fetch data with caching
   * @param {string} queryKey Unique key for the cache
   * @param {Object} params Query parameters for the Semrush API
   * @param {boolean} [force=false] Force bypassing the cache
   * @returns {Promise<Object>} The JSON data
   */
  async fetchWithCache(baseQueryKey, companyId, domain, params, overrideBaseUrl = null, force = false) {
    const apiKey = process.env.SEMRUSH_API_KEY;
    if (!apiKey) {
      throw new Error('SEMRUSH_API_KEY is not defined in environment variables');
    }

    const queryKey = `${baseQueryKey}_${companyId.toString()}`;

    try {
      const cached = await SemrushCache.findOne({ queryKey, companyId });
      
      // If force is false, try to use cache
      if (!force && cached) {
        const timestamp = cached.updatedAt || cached.createdAt;
        const cacheDurationHours = parseInt(process.env.SEMRUSH_CACHE_TTL_HOURS || '24', 10);
        const isExpired = !timestamp || (new Date() > new Date(new Date(timestamp).getTime() + (cacheDurationHours * 60 * 60 * 1000)));
        if (!isExpired) {
          // Silenced Cache HIT log to prevent terminal spam when tracking many keywords
          return cached.data;
        }
      }

      // Silenced Cache MISS / FORCED log to prevent terminal spam
      
      // If cache missed, expired, or force refresh, fetch from API
      const requestUrl = overrideBaseUrl || this.baseUrl;
      const response = await axios.get(requestUrl, {
        params: {
          key: apiKey,
          ...params
        },
        timeout: 10000 // Add timeout
      });

      // 3. Parse Semrush CSV response to JSON
      const parsedData = this.parseCSVToJSON(response.data);

      // 4. Save to cache
      try {
        await SemrushCache.findOneAndUpdate(
          { queryKey, companyId },
          { data: parsedData, domain, provider: 'semrush', createdAt: new Date() },
          { upsert: true, returnDocument: 'after' }
        );
      } catch (cacheErr) {
        if (cacheErr.code === 11000 || cacheErr.message?.includes('E11000')) {
          await SemrushCache.updateOne(
            { queryKey, companyId },
            { data: parsedData, domain, provider: 'semrush', createdAt: new Date() }
          ).catch((e) => console.warn('[Semrush] Cache fallback update error:', e.message));
        } else {
          console.warn('[Semrush] Cache save error:', cacheErr.message);
        }
      }

      // 5. Log sync success
      await SemrushSyncLog.create({
        endpoint: requestUrl,
        queryKey: queryKey,
        status: 'success',
        creditsUsed: 1 // Approximate, depends on endpoint
      });

      return parsedData;
    } catch (error) {
      const errorMessage = error.response?.data ? error.response.data.toString() : error.message;
      
      // Only log true unexpected errors, silence known subscription blocks so they don't spam the terminal
      if (!errorMessage.includes('ERROR 130 :: API DISABLED')) {
        console.error(`[Semrush] API Error for ${queryKey}:`, errorMessage);
      }
      
      const requestUrl = overrideBaseUrl || this.baseUrl;
      // Log sync error
      await SemrushSyncLog.create({
        endpoint: requestUrl,
        queryKey: queryKey,
        status: 'error',
        errorMessage: errorMessage
      });

      throw new Error(`Semrush API Error: ${errorMessage}`);
    }
  }

  cleanDomain(domain) {
    if (!domain) return '';
    let cleaned = domain.trim();
    cleaned = cleaned.replace(/^https?:\/\//, '');
    cleaned = cleaned.replace(/^www\./, '');
    cleaned = cleaned.split('/')[0];
    return cleaned;
  }

  /**
   * Semrush typically returns semicolon-separated values.
   * This parses the first row as headers, and subsequent rows as data.
   */
  parseCSVToJSON(csvString) {
    if (typeof csvString !== 'string') return csvString;
    
    // Semrush often returns an error message starting with "ERROR" if something goes wrong
    if (csvString.startsWith('ERROR')) {
        if (csvString.includes('ERROR 50 :: NOTHING FOUND')) {
            return [];
        }
        throw new Error(csvString);
    }

    const lines = [];
    let currentLine = [];
    let currentField = '';
    let inQuotes = false;

    // Robust CSV parser matching Semrush format (semicolon delimited by default, but values can be quoted)
    for (let i = 0; i < csvString.length; i++) {
        const char = csvString[i];
        
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < csvString.length && csvString[i + 1] === '"') {
                    currentField += '"';
                    i++; // skip escaped quote
                } else {
                    inQuotes = false;
                }
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ';') {
                currentLine.push(currentField);
                currentField = '';
            } else if (char === '\n' || (char === '\r' && csvString[i+1] === '\n')) {
                if (char === '\r') i++; // Skip \n
                currentLine.push(currentField);
                if (currentLine.length > 0 && currentLine.some(c => c !== '')) {
                   lines.push(currentLine);
                }
                currentLine = [];
                currentField = '';
            } else if (char !== '\r') {
                currentField += char;
            }
        }
    }
    
    if (currentField !== '' || currentLine.length > 0) {
        currentLine.push(currentField);
        lines.push(currentLine);
    }

    if (lines.length < 2) return [];

    const headers = lines[0].map(h => h.replace(/["\r\n]/g, '').trim());
    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const obj = {};
      const row = lines[i];
      headers.forEach((header, index) => {
        obj[header] = row[index] ? row[index].trim() : '';
      });
      results.push(obj);
    }

    return results;
  }

  async getDomainOverview(domain, companyId, database = 'us', force = false) {
    const cleanDomain = this.cleanDomain(domain);
    let targetDb = database;
    if (database === 'us' && cleanDomain.endsWith('.in')) {
      targetDb = 'in';
    }

    const queryKey = `domain_overview_${cleanDomain}_${targetDb}`;
    const params = {
      type: 'domain_ranks',
      domain: cleanDomain,
      database: targetDb,
      export_columns: 'Dn,Rk,Or,Ot,Oc,Ad,At,Ac'
    };
    let overviewData = await this.fetchWithCache(queryKey, companyId, domain, params, null, force);

    // If 'us' database returned 0 organic traffic or very low keywords, check 'in' (India) database
    if (targetDb === 'us' && overviewData && overviewData.length > 0) {
      const otVal = Number(overviewData[0]['Organic Traffic'] || overviewData[0].Ot || 0);
      const orVal = Number(overviewData[0]['Organic Keywords'] || overviewData[0].Or || 0);
      if (otVal === 0) {
        const inQueryKey = `domain_overview_${cleanDomain}_in`;
        const inParams = { ...params, database: 'in' };
        const inOverview = await this.fetchWithCache(inQueryKey, companyId, domain, inParams, null, force).catch(() => null);
        if (inOverview && inOverview.length > 0) {
          const inOtVal = Number(inOverview[0]['Organic Traffic'] || inOverview[0].Ot || 0);
          const inOrVal = Number(inOverview[0]['Organic Keywords'] || inOverview[0].Or || 0);
          if (inOtVal > otVal || inOrVal > orVal) {
            overviewData = inOverview;
            targetDb = 'in';
          }
        }
      }
    }
    
    // Fetch historical trend, top keywords, and competitors in parallel
    if (overviewData && overviewData.length > 0) {
        const trendParams = {
            type: 'domain_rank_history', domain: cleanDomain, database: targetDb, export_columns: 'Dt,Ot', display_limit: 12
        };
        const keywordsParams = {
            type: 'domain_organic', domain: cleanDomain, database: targetDb, export_columns: 'Ph,Po,Nq,Cp,Ur,Tr,Tc,Co,Kd,In,Fp', display_limit: 100
        };
        const competitorsParams = {
            type: 'domain_organic_organic', domain: cleanDomain, database: targetDb, export_columns: 'Dn,Cr,Np,Or,Ot,Oc,Ad', display_limit: 10
        };

        try {
            const [trendData, keywordsData, competitorsData] = await Promise.all([
                this.fetchWithCache(`domain_rank_history_${cleanDomain}_${targetDb}`, companyId, domain, trendParams, null, force).catch(() => []),
                this.fetchWithCache(`domain_organic_${cleanDomain}_${targetDb}`, companyId, domain, keywordsParams, null, force).catch(() => []),
                this.fetchWithCache(`domain_organic_organic_${cleanDomain}_${targetDb}`, companyId, domain, competitorsParams, null, force).catch(() => [])
            ]);
            
            if (trendData && trendData.length > 0) {
                // Semrush returns history from newest to oldest. Reverse for chart.
                const formattedTrend = trendData.reverse().map(item => {
                    const dateStr = String(item.Date || item.Dt || '');
                    let monthStr = '';
                    if (dateStr.length >= 6) {
                        const year = dateStr.substring(0, 4);
                        const month = dateStr.substring(4, 6);
                        const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
                        monthStr = dateObj.toLocaleString('default', { month: 'short' });
                    }
                    return { month: monthStr, traffic: Number(item['Organic Traffic'] || item.Ot || 0) };
                });
                overviewData[0].trend = formattedTrend;
            }

            if (keywordsData && keywordsData.length > 0) {
                // Do NOT overwrite Organic Keywords total count with keywordsData.length because display_limit truncates items.

                // We fetched up to 100 keywords for distribution calculation, but only store top 10 for the table
                const mapKeyword = k => {
                    let intentsRaw = k.Intents || k.In || '';
                    
                    const intentList = [];
                    if (intentsRaw.includes('0')) intentList.push('C');
                    if (intentsRaw.includes('1')) intentList.push('I');
                    if (intentsRaw.includes('2')) intentList.push('N');
                    if (intentsRaw.includes('3')) intentList.push('T');
                    if (intentList.length === 0) intentList.push('I');

                    return {
                        keyword: k.Keyword || k.Ph,
                        position: k.Position || k.Po,
                        searchVolume: k['Search Volume'] || k.Nq,
                        cpc: k.CPC || k.Cp,
                        url: k.Url || k.Ur,
                        trafficPercent: k['Traffic (%)'] || k.Tr,
                        difficulty: k['Keyword Difficulty'] || k.Kd,
                        intents: intentList
                    };
                };
                
                overviewData[0].topKeywords = keywordsData.slice(0, 10).map(mapKeyword);
                overviewData[0].organicKeywordsData = keywordsData.slice(0, 100).map(mapKeyword);
                
                // Calculate Real Distributions based on up to 100 keywords
                let intentCounts = { I: 0, N: 0, C: 0, T: 0 };
                let posCounts = { '1-3': 0, '4-10': 0, '11-20': 0, '21-50': 0, '51-100': 0 };
                let serpFeatureCount = 0;
                let aiOverviewCount = 0;
                
                keywordsData.forEach(k => {
                    const pos = Number(k.Position || k.Po || 0);
                    if (pos >= 1 && pos <= 3) posCounts['1-3']++;
                    else if (pos >= 4 && pos <= 10) posCounts['4-10']++;
                    else if (pos >= 11 && pos <= 20) posCounts['11-20']++;
                    else if (pos >= 21 && pos <= 50) posCounts['21-50']++;
                    else if (pos >= 51 && pos <= 100) posCounts['51-100']++;
                    
                    const intentsRaw = k.Intents || k.In || '';
                    if (intentsRaw.includes('0')) { intentCounts.C++; }
                    else if (intentsRaw.includes('1')) { intentCounts.I++; }
                    else if (intentsRaw.includes('2')) { intentCounts.N++; }
                    else if (intentsRaw.includes('3')) { intentCounts.T++; }
                    else { intentCounts.I++; } // Default fallback
                    
                    const features = k['SERP Features by Position'] || k.Fp || '';
                    if (features) {
                        serpFeatureCount++;
                        if (features.toLowerCase().includes('ai') || features.toLowerCase().includes('overview')) aiOverviewCount++;
                    }
                });
                
                overviewData[0].positionDistribution = posCounts;
                
                const totalIntents = intentCounts.I + intentCounts.N + intentCounts.C + intentCounts.T;
                const intentNames = ['Informational', 'Navigational', 'Commercial', 'Transactional'];
                const intentColors = ['#1890ff', '#722ed1', '#faad14', '#52c41a'];
                const intentLetters = ['I', 'N', 'C', 'T'];
                const baseTraffic = Number(overviewData[0]['Organic Traffic'] || overviewData[0].Ot || 0);
                const baseKeywords = Number(overviewData[0]['Organic Keywords'] || overviewData[0].Or || 0);
                
                if (totalIntents > 0) {
                    overviewData[0].intentDistribution = [intentCounts.I, intentCounts.N, intentCounts.C, intentCounts.T].map((count, i) => {
                        const ratio = count / totalIntents;
                        return {
                            intent: intentNames[i],
                            letter: intentLetters[i],
                            color: intentColors[i],
                            ratio: (ratio * 100).toFixed(1),
                            keywords: Math.round(baseKeywords * ratio),
                            traffic: Math.round(baseTraffic * ratio)
                        };
                    }).filter(item => Number(item.ratio) > 0);
                } else {
                     overviewData[0].intentDistribution = [];
                }
                
                // Real SERP Features based on our sample
                const organicPercent = Math.max(0, 100 - ((serpFeatureCount / keywordsData.length) * 100));
                const aiPercent = (aiOverviewCount / keywordsData.length) * 100;
                const otherPercent = Math.max(0, 100 - organicPercent - aiPercent);
                
                overviewData[0].serpFeatures = {
                    organic: organicPercent.toFixed(1),
                    aiOverviews: aiPercent.toFixed(1),
                    otherFeatures: otherPercent.toFixed(1)
                };
            }

            if (competitorsData && competitorsData.length > 0) {
                overviewData[0].competitors = competitorsData.map(c => ({
                    domain: c.Domain || c.Dn,
                    competitorRelevance: c['Competitor Relevance'] ?? c.Cr ?? 0,
                    commonKeywords: c['Common Keywords'] ?? c.Np ?? 0,
                    organicKeywords: c['Organic Keywords'] ?? c.Or ?? 0,
                    organicTraffic: c['Organic Traffic'] ?? c.Ot ?? 0,
                    organicCost: c['Organic Cost'] ?? c.Oc ?? 0,
                    adwordsKeywords: c['Adwords Keywords'] ?? c.Ad ?? 0,
                    seKeywords: c['Adwords Keywords'] ?? c.Ad ?? 0, // Keeping seKeywords for backward compatibility if needed
                    comLevel: Math.min(100, Math.round(Number(c['Competitor Relevance'] ?? c.Cr ?? 0) * 100))
                }));
            }
        } catch (err) {
            console.error(`[Semrush] Failed to fetch additional overview data:`, err.message);
        }
    }
    
    return overviewData;
  }

  async getCompetitorAnalysis(domain, companyId, database = 'us', limit = 20, force = false) {
    const cleanDomain = this.cleanDomain(domain);
    const queryKey = `competitor_analysis_${cleanDomain}_${database}_${limit}`;
    const params = {
      type: 'domain_organic_organic',
      domain: cleanDomain,
      database: database,
      export_columns: 'Dn,Cr,Np,Or,Ot,Oc,Ad',
      display_limit: limit
    };
    try {
      const data = await this.fetchWithCache(queryKey, companyId, domain, params, null, force);
      return data.map(c => ({
        domain: c.Domain || c.Dn,
        competitorRelevance: c['Competitor Relevance'] ?? c.Cr ?? 0,
        commonKeywords: c['Common Keywords'] ?? c.Np ?? 0,
        organicKeywords: c['Organic Keywords'] ?? c.Or ?? 0,
        organicTraffic: c['Organic Traffic'] ?? c.Ot ?? 0,
        organicCost: c['Organic Cost'] ?? c.Oc ?? 0,
        adwordsKeywords: c['Adwords Keywords'] ?? c.Ad ?? 0,
        comLevel: Math.min(100, Math.round(Number(c['Competitor Relevance'] ?? c.Cr ?? 0) * 100))
      }));
    } catch (error) {
      console.error(`[Semrush] Failed to fetch competitor analysis for ${domain}`, error);
      return [];
    }
  }

  async getTrafficAnalytics(domain, companyId, force = false) {
    const cleanDomain = this.cleanDomain(domain);
    const queryKey = `traffic_analytics_${cleanDomain}`;
    // Requires Traffic Analytics API add-on
    const params = {
      targets: cleanDomain,
      export_columns: 'visits,unique_visitors,page_views,bounce_rate,avg_visit_duration,mobile_share'
    };
    try {
      const result = await this.fetchWithCache(queryKey, companyId, domain, params, 'https://api.semrush.com/analytics/ta/api/v3/summary', force);
      if (result && result.length > 0) return result;
      throw new Error('Empty result from traffic_summary');
    } catch (error) {
      // Intentionally suppressing console.error here so the terminal doesn't get spammed when falling back
      // console.log(`[Semrush] Traffic Analytics API falling back to domain_ranks due to missing subscription.`);
      
      // Fallback to standard domain_ranks (Organic/Paid Traffic) since TA add-on is missing
      const fallbackParams = {
        type: 'domain_ranks',
        domain: cleanDomain,
        database: 'us',
        export_columns: 'Dn,Rk,Or,Ot,Oc,Ad,At,Ac'
      };
      
      try {
        const fallbackData = await this.fetchWithCache(`traffic_analytics_fallback_${cleanDomain}`, companyId, domain, fallbackParams, null, force);
        if (fallbackData && fallbackData.length > 0) {
           const d = fallbackData[0];
           const ot = Number(d.Ot || d['Organic Traffic'] || 0);
           const at = Number(d.At || d['Adwords Traffic'] || 0);
           return [{
             visits: ot + at, // Total Search Traffic (Organic + Paid)
             organic_traffic: ot,
             paid_traffic: at,
             isFallback: true
           }];
        }
      } catch (fallbackError) {
        console.error(`[Semrush] Fallback to domain_ranks also failed:`, fallbackError.message);
      }
      return [];
    }
  }

  async getKeywordMagicTool(keyword, companyId, database = 'us', matchType = 'phrase', force = false) {
    const queryKey = `keyword_magic_${keyword}_${database}_${matchType}`;
    
    let type = 'phrase_related'; // Default to phrase match
    if (matchType === 'exact') type = 'phrase_this';
    else if (matchType === 'broad') type = 'phrase_all'; // Broad match
    
    const params = {
      type: type,
      phrase: keyword,
      database: database,
      export_columns: 'Ph,Nq,Cp,Co,Kd,In',
      display_limit: 100
    };
    try {
      return await this.fetchWithCache(queryKey, companyId, keyword, params, null, force);
    } catch (error) {
      console.error(`[Semrush] Failed to fetch keyword magic tool for ${keyword}`, error);
      return [];
    }
  }

  async getKeywordResearch(keyword, companyId, database = 'us', force = false) {
    const isDomainLike = keyword.includes('.') && !keyword.includes(' ');
    
    if (isDomainLike) {
        const cleanDomain = this.cleanDomain(keyword);
        const queryKey = `keyword_research_domain_${cleanDomain}_${database}`;
        const params = {
          type: 'domain_organic',
          domain: cleanDomain,
          database: database,
          export_columns: 'Ph,Po,Nq,Cp,Ur,Tr,Tc,Co,Kd',
          display_limit: 100
        };
        try {
            const data = await this.fetchWithCache(queryKey, companyId, cleanDomain, params, null, force);
            return data.map(item => ({
                'Keyword': item.Keyword || item.Ph,
                'Search Volume': item['Search Volume'] || item.Nq,
                'CPC': item.CPC || item.Cp,
                'Keyword Difficulty Index': item['Keyword Difficulty'] || item.Kd,
                'Intent': '', 
                'Position': item.Position || item.Po,
                'isDomainResult': true
            }));
        } catch (e) {
            return [];
        }
    }

    const queryKey = `keyword_research_${keyword}_${database}`;
    const params = {
      type: 'phrase_this',
      phrase: keyword,
      database: database,
      export_columns: 'Ph,Nq,Cp,Co,Kd,In,Td',
      display_limit: 100
    };
    try {
      return await this.fetchWithCache(queryKey, companyId, keyword, params, null, force);
    } catch (error) {
      console.error(`[Semrush] Failed to fetch keyword research for ${keyword}`, error);
      return [];
    }
  }

  async getDomainKeywordsDrilldown(domain, companyId, database = 'us', limit = 100, force = false) {
    const cleanDomain = this.cleanDomain(domain);
    const queryKey = `domain_keywords_drilldown_${cleanDomain}_${database}_${limit}`;
    const params = {
      type: 'domain_organic',
      domain: cleanDomain,
      database: database,
      export_columns: 'Ph,Po,Pp,Nq,Kd,Cp,Ur,Tr,Tc,Fp,In',
      display_limit: limit
    };
    
    try {
        const data = await this.fetchWithCache(queryKey, companyId, domain, params, null, force);
        // Map to standard clean structure
        return data.map(item => ({
            keyword: item.Keyword || item.Ph,
            position: item.Position || item.Po,
            previousPosition: item['Previous Position'] || item.Pp,
            searchVolume: item['Search Volume'] || item.Nq,
            difficulty: item['Keyword Difficulty'] || item.Kd,
            cpc: item.CPC || item.Cp,
            url: item.Url || item.Ur,
            trafficPercent: item['Traffic (%)'] || item.Tr,
            trafficCostPercent: item['Traffic Cost (%)'] || item.Tc,
            serpFeatures: item['SERP Features by Position'] || item.Fp,
            intent: item.Intents || item.In
        }));
    } catch (e) {
        throw new Error('Failed to fetch domain keywords drill-down: ' + e.message);
    }
  }

  async getBacklinksOverview(domain, companyId, force = false) {
    const cleanDomain = this.cleanDomain(domain);
    const overviewParams = {
      type: 'backlinks_overview',
      target: cleanDomain,
      target_type: 'root_domain',
      export_columns: 'total,domains_num,ips_num,follows_num,nofollows_num,sponsored_num,ugc_num,texts_num,images_num,forms_num,frames_num,score'
    };
    const anchorsParams = {
      type: 'backlinks_anchors',
      target: cleanDomain,
      target_type: 'root_domain',
      export_columns: 'anchor,backlinks_num,domains_num',
      display_limit: 100
    };
    const refDomainsParams = {
      type: 'backlinks_refdomains',
      target: cleanDomain,
      target_type: 'root_domain',
      export_columns: 'domain,backlinks_num,domain_score',
      display_limit: 100
    };
    const tldParams = {
      type: 'backlinks_tld',
      target: cleanDomain,
      target_type: 'root_domain',
      export_columns: 'zone,backlinks_num,domains_num',
      display_limit: 50
    };
    const geoParams = {
      type: 'backlinks_geo',
      target: cleanDomain,
      target_type: 'root_domain',
      export_columns: 'country,backlinks_num,domains_num',
      display_limit: 50
    };
    const pagesParams = {
      type: 'backlinks_pages',
      target: cleanDomain,
      target_type: 'root_domain',
      export_columns: 'source_url,backlinks_num,domains_num,external_num,internal_num,last_seen',
      display_limit: 80
    };
    const rawBacklinksParams = {
      type: 'backlinks',
      target: cleanDomain,
      target_type: 'root_domain',
      export_columns: 'page_score,source_title,source_url,external_num,internal_num,target_url,anchor,first_seen,last_seen',
      display_limit: 100
    };
    
    const baseUrl = 'https://api.semrush.com/analytics/v1';
    
    try {
        const [overview, anchors, refDomains, tlds, geo, pages, rawBacklinks] = await Promise.all([
          this.fetchWithCache(`backlinks_overview_${cleanDomain}`, companyId, domain, overviewParams, baseUrl, force),
          this.fetchWithCache(`backlinks_anchors_${cleanDomain}`, companyId, domain, anchorsParams, baseUrl, force),
          this.fetchWithCache(`backlinks_refdomains_${cleanDomain}`, companyId, domain, refDomainsParams, baseUrl, force),
          this.fetchWithCache(`backlinks_tld_${cleanDomain}`, companyId, domain, tldParams, baseUrl, force),
          this.fetchWithCache(`backlinks_geo_${cleanDomain}`, companyId, domain, geoParams, baseUrl, force),
          this.fetchWithCache(`backlinks_pages_${cleanDomain}`, companyId, domain, pagesParams, baseUrl, force),
          this.fetchWithCache(`backlinks_raw_${cleanDomain}`, companyId, domain, rawBacklinksParams, baseUrl, force)
        ]);
        
        if (overview && overview.length > 0) {
          overview[0].anchors = (anchors || []).map(a => ({
            anchor: a.anchor,
            links: a.backlinks_num,
            domains: a.domains_num
          }));
          
          overview[0].refDomains = (refDomains || []).map(r => ({
            domain: r.domain,
            links: r.backlinks_num,
            authority: r.domain_score
          }));
          
          // Calculate Referring Domains by Authority Score
          const asBuckets = { '91-100':0, '81-90':0, '71-80':0, '61-70':0, '51-60':0, '41-50':0, '31-40':0, '21-30':0, '11-20':0, '0-10':0 };
          let totalBucketed = 0;
          (refDomains || []).forEach(r => {
              const score = Number(r.domain_score || 0);
              totalBucketed++;
              if (score >= 91) asBuckets['91-100']++;
              else if (score >= 81) asBuckets['81-90']++;
              else if (score >= 71) asBuckets['71-80']++;
              else if (score >= 61) asBuckets['61-70']++;
              else if (score >= 51) asBuckets['51-60']++;
              else if (score >= 41) asBuckets['41-50']++;
              else if (score >= 31) asBuckets['31-40']++;
              else if (score >= 21) asBuckets['21-30']++;
              else if (score >= 11) asBuckets['11-20']++;
              else asBuckets['0-10']++;
          });
          
          overview[0].asDistribution = Object.entries(asBuckets).map(([range, count]) => ({
              range,
              count,
              percent: totalBucketed > 0 ? (count / totalBucketed * 100) : 0
          }));
    
          overview[0].tlds = (tlds || []).map(t => ({
              tld: t.zone,
              links: t.backlinks_num,
              domains: t.domains_num
          }));
    
          overview[0].geo = (geo || []).map(g => ({
              country: g.country,
              links: g.backlinks_num,
              domains: g.domains_num
          }));
    
          overview[0].pages = (pages || []).map(p => ({
              url: p.source_url,
              links: p.backlinks_num,
              domains: p.domains_num,
              external: p.external_num,
              internal: p.internal_num,
              last_seen: p.last_seen
          }));
          
          overview[0].rawBacklinks = (rawBacklinks || []).map(b => ({
              page_as: b.page_score,
              source_title: b.source_title,
              source_url: b.source_url,
              external: b.external_num,
              internal: b.internal_num,
              target_url: b.target_url,
              anchor: b.anchor,
              first_seen: b.first_seen,
              last_seen: b.last_seen
          }));
        }
        
        return overview;
    } catch(err) {
        console.error('Failed to get backlinks overview', err);
        return [];
    }
  }

  async getSiteHealth(domain, companyId, database = 'us', force = false) {
      const cleanDomain = this.cleanDomain(domain);
      
      try {
          // 1. Fetch Management API to get the Project ID
          let projectId = null;
          try {
              const projResponse = await axios.get('https://api.semrush.com/management/v1/projects', {
                  params: { key: process.env.SEMRUSH_API_KEY }
              });
              const projects = projResponse.data;
              const project = projects.find(p => p.domain_unicode === cleanDomain || p.url === cleanDomain);
              if (project) {
                  projectId = project.project_id;
              } else {
                  // Auto-create Semrush project and enable Site Audit
                  const newProj = await this.createProject(cleanDomain);
                  if (newProj && newProj.project_id) {
                      projectId = newProj.project_id;
                      await axios.post(`https://api.semrush.com/reports/v1/projects/${projectId}/siteaudit/enable`, {
                          domain: cleanDomain,
                          pageLimit: 100
                      }, { params: { key: process.env.SEMRUSH_API_KEY } }).catch(e => console.error('Auto enable Site Audit failed', e.message));
                  }
              }
          } catch (e) {
              console.error('Failed to fetch Semrush projects:', e.message);
          }

          if (projectId) {
              // 2. Fetch Site Audit Data
              try {
                  const auditUrl = `https://api.semrush.com/reports/v1/projects/${projectId}/siteaudit/info`;
                  const pagesUrl = `https://api.semrush.com/reports/v1/projects/${projectId}/siteaudit/pages`;
                  const issuesUrl = `https://api.semrush.com/reports/v1/projects/${projectId}/siteaudit/issues`;
                  
                  const [response, pagesResponse, issuesResponse] = await Promise.all([
                      axios.get(auditUrl, { params: { key: process.env.SEMRUSH_API_KEY } }),
                      axios.get(pagesUrl, { params: { key: process.env.SEMRUSH_API_KEY, limit: 100 } }).catch(() => ({ data: [] })),
                      axios.get(issuesUrl, { params: { key: process.env.SEMRUSH_API_KEY } }).catch(() => ({ data: null }))
                  ]);
                  const auditDataRaw = response.data;
                  const auditData = Array.isArray(auditDataRaw) ? auditDataRaw[0] : auditDataRaw;
                  let pagesList = [];
                  
                  if (issuesResponse.data) {
                      // Attach issues breakdown directly to auditData so normalizeSemrushSiteHealth can extract them
                      const issuesList = Array.isArray(issuesResponse.data) ? issuesResponse.data : [];
                      
                      const errorsObj = {};
                      const warningsObj = {};
                      const noticesObj = {};
                      
                      issuesList.forEach(issue => {
                          if (issue.severity === 'error') errorsObj[issue.check_id || issue.id] = issue.pages_count || issue.count;
                          else if (issue.severity === 'warning') warningsObj[issue.check_id || issue.id] = issue.pages_count || issue.count;
                          else if (issue.severity === 'notice') noticesObj[issue.check_id || issue.id] = issue.pages_count || issue.count;
                      });
                      
                      if (Object.keys(errorsObj).length > 0) auditData.errorsObj = errorsObj;
                      if (Object.keys(warningsObj).length > 0) auditData.warningsObj = warningsObj;
                      if (Object.keys(noticesObj).length > 0) auditData.noticesObj = noticesObj;
                  }

                  if (Array.isArray(pagesResponse.data)) {
                      pagesList = pagesResponse.data;
                  } else if (pagesResponse.data && Array.isArray(pagesResponse.data.data)) {
                      pagesList = pagesResponse.data.data;
                  } else if (pagesResponse.data && Array.isArray(pagesResponse.data.items)) {
                      pagesList = pagesResponse.data.items;
                  } else if (typeof pagesResponse.data === 'string' && pagesResponse.data.includes('\n')) {
                      pagesList = this.parseCSVToJSON(pagesResponse.data);
                  }
                  
                  if (pagesList.length > 0) {
                      pagesList = pagesList.map((p, idx) => ({
                          id: p.id || idx,
                          url: p.url || p.pageUrl || p.page_url || `https://${cleanDomain}/page-${idx}`,
                          title: p.title || p.page_title || 'Untitled Page',
                          statusCode: parseInt(p.statusCode || p.status_code || p.http_code || 200),
                          depth: parseInt(p.depth || p.crawl_depth || 1),
                          errors: parseInt(p.errors || p.error_count || 0),
                          warnings: parseInt(p.warnings || p.warning_count || 0),
                          notices: parseInt(p.notices || p.notice_count || 0)
                      }));
                  }
                  
                  if (pagesList.length === 0) {
                      // API returned no crawled pages.
                      pagesList = [];
                  }
                  
                  auditData.crawledPagesList = pagesList;
                  
                  const snapshot = auditData.current_snapshot || {};
                  let score = snapshot.quality?.value ?? auditData.quality?.value ?? auditData.health_score ?? auditData.score ?? null;
                  
                  // Map to the format DashboardTab expects
                  const weaknesses = Object.entries(auditData.defects || snapshot.new || {}).map(([id, count]) => ({ 
                      title: `Error #${id}`, 
                      desc: `${count} issues found` 
                  }));
                  const strengths = [];
                  if (score && score >= 70) strengths.push({ title: 'Good Overall Health', desc: `Site Health is ${score}%` });
                  else if (score && score >= 90) strengths.push({ title: 'Excellent Health', desc: `Site Health is ${score}%` });
                  
                  if (!auditData.errors || auditData.errors.length === 0) {
                      strengths.push({ title: 'No Critical Errors', desc: '0 critical errors found during crawl.' });
                  }
                  
                  return {
                      isBasicHealth: false,
                      overallScore: score,
                      insights: { strengths, weaknesses },
                      rawData: auditData 
                  };
              } catch (e) {
                  console.error('Failed to fetch Semrush Site Audit:', e.message);
                  // Fallthrough to proxy if audit API fails
              }
          }

          // FALLBACK LOGIC (If no project exists or API fails)
          return {
              isBasicHealth: false,
              overallScore: null,
              insights: { strengths: [], weaknesses: [] },
              rawData: null,
              status: 'unavailable',
              error: 'Site Audit data not available from Semrush API.'
          };
      } catch (err) {
          throw new Error('Failed to fetch Site Health. ' + err.message);
      }
  }
  // ---------------------------------------------------------
  // Position Tracking Management API Wrappers
  // ---------------------------------------------------------

  async getProjects() {
    try {
      const response = await axios.get('https://api.semrush.com/management/v1/projects', {
        params: { key: process.env.SEMRUSH_API_KEY }
      });
      return response.data;
    } catch (error) {
      console.error('[SemrushService - getProjects]', error.message);
      return [];
    }
  }

  async createProject(domain) {
    try {
      const response = await axios.post('https://api.semrush.com/management/v1/projects', {
        project_name: domain,
        url: domain
      }, {
        params: { key: process.env.SEMRUSH_API_KEY }
      });
      return response.data;
    } catch (error) {
      console.error('[SemrushService - createProject]', error.response ? error.response.data : error.message);
      return null;
    }
  }

  async getTrackingCampaigns(projectId) {
    try {
      const response = await axios.get(`https://api.semrush.com/management/v1/projects/${projectId}/tracking/campaigns`, {
        params: { key: process.env.SEMRUSH_API_KEY }
      });
      return response.data.campaigns || [];
    } catch (error) {
      console.error('[SemrushService - getTrackingCampaigns]', error.message);
      return [];
    }
  }

  async enableTrackingCampaign(projectId, domain, locationId = 2356) {
    try {
      const response = await axios.post(`https://api.semrush.com/management/v1/projects/${projectId}/tracking/enable`, {
        tracking_url: domain,
        tracking_url_type: 'rootdomain',
        location_id: locationId
      }, {
        params: { key: process.env.SEMRUSH_API_KEY }
      });
      return response.data;
    } catch (error) {
      console.error('[SemrushService - enableTrackingCampaign]', error.response ? error.response.data : error.message);
      return null;
    }
  }

  /**
   * Syncs a set of keywords to a Semrush Position Tracking campaign.
   * Uses PUT /management/v1/projects/{campaignId}/keywords
   * This endpoint REPLACES all keywords in the campaign with the new list.
   */
  async syncKeywordsToCampaign(campaignId, keywords) {
    if (!campaignId || !keywords || keywords.length === 0) return null;
    try {
      const keywordsPayload = keywords.map(kw => ({ keyword: kw.trim() }));
      const response = await axios.put(
        `https://api.semrush.com/management/v1/projects/${campaignId}/keywords`,
        { keywords: keywordsPayload },
        { params: { key: process.env.SEMRUSH_API_KEY } }
      );
      console.log(`[SemrushService] Synced ${keywords.length} keywords to campaign ${campaignId}`);
      return response.data;
    } catch (error) {
      console.error('[SemrushService - syncKeywordsToCampaign]', error.response ? error.response.data : error.message);
      return null;
    }
  }
}

module.exports = new SemrushService();
