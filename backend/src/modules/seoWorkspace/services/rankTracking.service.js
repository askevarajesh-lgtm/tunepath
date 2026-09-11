const logger = require('../../aiCore/logger.service');
const keywordProviderChain = require('../providers/keywordProviderChain');
const domainNormalizer = require('./domainNormalization.utils');
const WorkspaceKeyword = require('../models/workspaceKeyword.model');

// Typical organic CTR curve by position
const CTR_CURVE = {
  1: 0.317, 2: 0.247, 3: 0.186, 4: 0.136, 5: 0.095,
  6: 0.062, 7: 0.041, 8: 0.031, 9: 0.029, 10: 0.024
};

function getCTR(position) {
  if (position <= 10) return CTR_CURVE[position] || 0.02;
  if (position <= 20) return 0.01;
  return 0.001;
}

class RankTrackingService {
  /**
   * Tracks ranking for a batch of keywords with retries and exponential backoff.
   * @param {Object} project WorkspaceProject
   * @param {Array} keywords Array of WorkspaceKeyword docs
   */
  async trackKeywords(project, keywords) {
    if (!keywords || keywords.length === 0) return;

    logger.info('RankTrackingService', `Starting rank tracking for ${keywords.length} keywords on ${project.domain}`);
    
    // Prepare tasks for the provider
    const tasks = keywords.map(kw => ({
      keyword: kw.keyword,
      location_code: kw.locationCode || 2840,
      language_code: kw.languageCode || 'en'
    }));

    // Retry Engine
    let res = null;
    let attempt = 0;
    const maxRetries = 3;
    while (attempt < maxRetries) {
      res = await keywordProviderChain.getSerpResults(tasks);
      if (['TIMEOUT', 'RATE_LIMIT', 'PROVIDER_ERROR'].includes(res.status)) {
        attempt++;
        logger.warn('RankTrackingService', `Provider failed with ${res.status}. Attempt ${attempt}/${maxRetries}`);
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      } else {
        break; // Success or UNCONFIGURED
      }
    }

    const realSerpData = res.data || [];
    let pipelineStatus = 'UNKNOWN';
    if (res.status === 'TIMEOUT') pipelineStatus = 'TIMEOUT';
    else if (res.status === 'RATE_LIMIT') pipelineStatus = 'RATE_LIMIT';
    else if (res.status === 'PROVIDER_ERROR') pipelineStatus = 'PROVIDER_ERROR';
    else if (res.status === 'SUCCESS' && realSerpData.length > 0) pipelineStatus = 'SUCCESS';
    else pipelineStatus = 'NOT_FOUND_TOP100';

    const updates = [];

    for (const [index, kw] of keywords.entries()) {
      const previousRank = kw.ranking?.currentRank;
      const previousVisibility = kw.ranking?.visibilityScore || 0;
      
      let currentRank = null;
      let currentStatus = 'UNKNOWN';
      let foundUrl = null;
      let serpFeatures = [];
      let confidenceScore = 0;
      let confidenceReason = 'N/A';

      if (pipelineStatus === 'SUCCESS') {
        const taskResult = realSerpData[index] || {};
        const topResults = taskResult.topResults || [];
        
        // SERP Features Extraction
        if (taskResult.featuredSnippet) serpFeatures.push('featured_snippet');
        if (taskResult.paaQuestions && taskResult.paaQuestions.length > 0) serpFeatures.push('people_also_ask');
        if (taskResult.relatedSearches && taskResult.relatedSearches.length > 0) serpFeatures.push('related_searches');

        const foundItems = topResults.filter(item => domainNormalizer.isDomainMatch(item.domain || item.url, project.domain));
        
        if (foundItems.length > 0) {
          currentRank = foundItems[0].rank;
          foundUrl = domainNormalizer.normalizeUrl(foundItems[0].url);
          currentStatus = 'FOUND';
          kw.verificationStatus = 'VERIFIED_RANKING';
          
          // Confidence Engine
          if (foundItems[0].domain && foundItems[0].domain.includes(project.domain)) {
            confidenceScore = 95;
            confidenceReason = 'Exact domain match in organic results';
          } else {
            confidenceScore = 70;
            confidenceReason = 'Fuzzy match or subdomain match';
          }
          if (foundItems.length > 1) {
             confidenceReason += ' (Multiple URLs found - possible cannibalization)';
             confidenceScore -= 10;
             kw.cannibalization = kw.cannibalization || {};
             kw.cannibalization.conflictUrls = foundItems.map(item => domainNormalizer.normalizeUrl(item.url));
             kw.cannibalization.isCannibalized = true;
          } else {
             if (kw.cannibalization) {
                 kw.cannibalization.conflictUrls = [foundUrl];
                 kw.cannibalization.isCannibalized = false;
             }
          }

        } else {
          currentStatus = 'NOT_FOUND_TOP100';
          confidenceScore = 100;
          confidenceReason = 'Absence verified across top 100 results';
          kw.verificationStatus = 'NOT_RANKING';
        }
      } else {
        currentStatus = pipelineStatus;
        confidenceScore = 0;
        confidenceReason = `Tracking failed due to provider error: ${currentStatus}`;
      }

      // Visibility Engine
      let visibilityScore = 0;
      if (currentRank && currentRank <= 100) {
         const searchVolume = kw.metrics?.searchVolume || 0;
         const ctr = getCTR(currentRank);
         visibilityScore = Math.round(searchVolume * ctr);
      }

      // Trend Engine
      let rankChange = 0;
      let velocity = 0;
      let trend = 'None';
      let visibilityTrend = 'Stable';

      if (previousRank && currentRank) {
         rankChange = previousRank - currentRank; // positive means improved (e.g. 10 -> 5 = +5)
         if (rankChange > 0) trend = 'Improved';
         else if (rankChange < 0) trend = 'Declined';
         else trend = 'Stable';
         
         // Velocity: how drastic was the change
         velocity = Math.abs(rankChange);
      } else if (!previousRank && currentRank) {
         trend = 'New';
      } else if (previousRank && !currentRank && currentStatus === 'NOT_FOUND_TOP100') {
         trend = 'Lost Visibility';
      }

      if (visibilityScore > previousVisibility) visibilityTrend = 'Improved';
      else if (visibilityScore < previousVisibility) visibilityTrend = 'Declined';

      // Assemble History Snapshot
      const historySnapshot = {
        date: new Date(),
        rank: currentRank,
        status: currentStatus,
        url: foundUrl,
        visibilityScore,
        serpFeatures
      };

      // Apply to object
      kw.ranking = kw.ranking || {};
      kw.ranking.previousRank = previousRank; // Maintain exactly what the rank was before this check
      if (currentRank !== null || currentStatus === 'NOT_FOUND_TOP100') {
        // Only update current rank if we actually searched for it successfully
        kw.ranking.currentRank = currentRank;
      }
      kw.ranking.status = currentStatus;
      kw.ranking.url = foundUrl;
      kw.ranking.trend = trend;
      kw.ranking.rankChange = rankChange;
      kw.ranking.velocity = velocity;
      kw.ranking.visibilityScore = visibilityScore;
      kw.ranking.visibilityTrend = visibilityTrend;
      kw.ranking.confidenceScore = confidenceScore;
      kw.ranking.confidenceReason = confidenceReason;
      kw.ranking.serpFeatures = serpFeatures;
      
      kw.serp = kw.serp || {};
      kw.serp.checkedAt = new Date();
      kw.serp.provider = 'DataForSEO';
      
      // Update the main source if it was just a CANDIDATE or UNVERIFIED
      if (kw.ranking.rankingSource === 'UNAVAILABLE' || kw.source === 'NLP_CANDIDATE' || kw.source === 'manual') {
         kw.ranking.rankingSource = kw.gsc?.averagePosition ? 'GSC_AND_SERP' : 'SERP';
      }
      
      if (currentRank && (!kw.ranking.bestRank || currentRank < kw.ranking.bestRank)) {
          kw.ranking.bestRank = currentRank;
      }

      kw.ranking.history = kw.ranking.history || [];
      kw.ranking.history.push(historySnapshot);

      updates.push(kw.save());
    }

    await Promise.all(updates);
    logger.info('RankTrackingService', `Completed rank tracking batch for ${keywords.length} keywords.`);
    
    return {
      status: pipelineStatus,
      processed: keywords.length
    };
  }
}

module.exports = new RankTrackingService();
