const Keyword = require('../../seoWorkspace/models/workspaceKeyword.model');

class KeywordIntelligenceService {
  /**
   * Fetch a keyword's complete data and format for content AI.
   * If the keyword exists in Workspace Keywords, pull its rich data.
   */
  async getKeywordData(workspaceId, targetKeyword) {
    // Attempt to find in workspace keywords module
    const keywordDoc = await Keyword.findOne({
      workspaceId,
      keyword: targetKeyword ? targetKeyword.toLowerCase() : ''
    }).lean();

    if (keywordDoc) {
      return {
        keyword: keywordDoc.keyword,
        volume: keywordDoc.searchVolume || 0,
        difficulty: keywordDoc.keywordDifficulty || 0,
        intent: keywordDoc.intent || 'Informational',
        cpc: keywordDoc.cpc || 0,
        cluster: keywordDoc.cluster || null,
        status: keywordDoc.status || 'Active'
      };
    }

    // Fallback default
    return {
      keyword: targetKeyword,
      volume: 0,
      difficulty: 0,
      intent: 'Mixed',
      cpc: 0,
      cluster: null,
      status: 'Unknown'
    };
  }

  /**
   * Find related/secondary keywords for a primary keyword
   */
  async getSecondaryKeywords(workspaceId, primaryKeyword) {
    const keywordDoc = await Keyword.findOne({
      workspaceId,
      keyword: primaryKeyword ? primaryKeyword.toLowerCase() : ''
    }).lean();

    if (keywordDoc && keywordDoc.cluster) {
      // Find all other keywords in the same cluster
      const clusterKeywords = await Keyword.find({
        workspaceId,
        cluster: keywordDoc.cluster,
        keyword: { $ne: primaryKeyword ? primaryKeyword.toLowerCase() : '' }
      })
      .limit(10)
      .select('keyword searchVolume')
      .sort({ searchVolume: -1 })
      .lean();
      
      return clusterKeywords.map(k => k.keyword);
    }
    
    return [];
  }
}

module.exports = new KeywordIntelligenceService();
