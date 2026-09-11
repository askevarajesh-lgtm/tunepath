const mongoose = require('mongoose');

const WorkspaceKeywordSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceProject', required: true, index: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  keyword: { type: String, required: true, trim: true },
  normalizedKeyword: { type: String, trim: true, default: null },
  locationCode: { type: Number, default: 2840 }, // Default US
  languageCode: { type: String, default: 'en' },
  
  // Real Search Data Validation Status
  verificationStatus: { 
    type: String, 
    enum: ['VERIFIED_RANKING', 'CANDIDATE', 'NOT_RANKING', 'UNVERIFIED'], 
    default: 'UNVERIFIED' 
  },
  
  // DataForSEO specific identifiers (to avoid duplicate tracking tasks)
  taskId: { type: String, default: null },

  // Latest Metrics (Cached for fast retrieval)
  metrics: {
    searchVolume: { type: Number, default: 0 },
    searchVolumeSource: { type: String, default: 'UNAVAILABLE' }, // e.g., 'DataForSEO', 'GSC'
    cpc: { type: Number, default: 0 },
    cpcSource: { type: String, default: 'UNAVAILABLE' },
    competition: { type: Number, default: 0 }, // 0 to 1
    competitionSource: { type: String, default: 'UNAVAILABLE' },
    keywordDifficulty: { type: Number, default: 0 }, // 0 to 100
    keywordDifficultySource: { type: String, default: 'UNAVAILABLE' },
    intent: { type: String, enum: ['informational', 'navigational', 'commercial', 'transactional', 'local', 'branded', 'unknown'], default: 'unknown' },
    intents: [{ // Multi-Intent Classification
      intent: { type: String },
      confidence: { type: Number },
      reason: { type: String }
    }],
    trends: [{ type: Number }], // 12 months search volume trend
    trendSource: { type: String, default: 'UNAVAILABLE' },
    serpFeatures: [{ type: String }], // e.g., 'featured_snippet', 'people_also_ask'
    estimatedTraffic: { type: Number, default: 0 },
    trafficSource: { type: String, default: 'UNAVAILABLE' },
  },

  // Enterprise Evidence Engine
  evidence: {
    discoverySource: { type: String, enum: ['GSC', 'DataForSEO', 'Crawler', 'Manual'], default: 'Manual' },
    discoveryUrl: { type: String, default: null },
    discoveryElement: { type: String, default: null }, // e.g., 'H1', 'Title', 'Meta', 'Body'
    discoverySnippet: { type: String, default: null },
    discoveryTimestamp: { type: Date, default: null },
    confidenceScore: { type: Number, default: 0 }, // Deterministic score based on frequency, pages, etc.
    confidenceCalculation: { type: mongoose.Schema.Types.Mixed, default: {} }, // Exposed calculation breakdown
  },

  // Ranking data
  ranking: {
    currentRank: { type: Number, default: null },
    previousRank: { type: Number, default: null },
    bestRank: { type: Number, default: null },
    rankingSource: { type: String, enum: ['GSC', 'SERP', 'GSC_AND_SERP', 'UNAVAILABLE'], default: 'UNAVAILABLE' },
    searchEngine: { type: String, default: 'Google' }, // e.g., 'Google', 'Bing', 'YouTube'
    device: { type: String, enum: ['Desktop', 'Mobile', 'Tablet', 'Unknown'], default: 'Unknown' },
    country: { type: String, default: null },
    region: { type: String, default: null },
    city: { type: String, default: null },
    url: { type: String, default: null }, // URL that is ranking
    isUnexpectedUrl: { type: Boolean, default: false }, // Flagged if ranking URL doesn't match crawled URLs
    isFeaturedSnippet: { type: Boolean, default: false },
    status: { 
      type: String, 
      enum: ['FOUND', 'NOT_FOUND_TOP100', 'PROVIDER_ERROR', 'TIMEOUT', 'RATE_LIMIT', 'CRAWL_ERROR', 'UNKNOWN', 'UNAVAILABLE'], 
      default: 'UNKNOWN' 
    },
    trend: { type: String, enum: ['Improved', 'Declined', 'Stable', 'Lost Visibility', 'New', 'None'], default: 'None' },
    rankChange: { type: Number, default: 0 },
    velocity: { type: Number, default: 0 },
    visibilityScore: { type: Number, default: 0 },
    visibilityTrend: { type: String, default: 'Stable' },
    serpFeatures: [{ type: String }],
    history: [{
      date: { type: Date },
      rank: { type: Number },
      status: { type: String },
      url: { type: String },
      visibilityScore: { type: Number },
      serpFeatures: [{ type: String }],
      source: { type: String }
    }]
  },

  // Google Search Console (GSC) Data
  gsc: {
    averagePosition: { type: Number, default: null },
    clicks: { type: Number, default: null },
    impressions: { type: Number, default: null },
    ctr: { type: Number, default: null },
    checkedAt: { type: Date, default: null }
  },

  // Live SERP Verification Data
  serp: {
    checkedAt: { type: Date, default: null },
    provider: { type: String, default: null }
  },

  // Cannibalization Detection
  cannibalization: {
    isCannibalized: { type: Boolean, default: false },
    conflictUrls: [{ type: String }],
    severity: { type: String, enum: ['high', 'medium', 'low', 'none'], default: 'none' }
  },

  // Clustering and NLP
  cluster: { type: String, default: null },
  parentKeyword: { type: String, default: null },
  clusterConfidence: { type: Number, default: null },
  clusterSource: { type: String, default: 'UNAVAILABLE' },
  topicId: { type: String, default: null },
  entities: [{ type: String }], // NLP extracted entities
  
  intentConfidence: { type: Number, default: null },
  intentReason: { type: String, default: null },

  // Page Level Keyword Mapping (Enterprise Content Coverage)
  pages: [{
    url: { type: String },
    isPrimary: { type: Boolean, default: false },
    occurrences: { type: Number, default: 1 },
    htmlElements: [{ 
      element: { type: String }, // e.g., 'H1', 'Title', 'Anchor', 'Body'
      count: { type: Number, default: 1 },
      weight: { type: Number, default: 1 }
    }],
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now }
  }],

  // Tags for organizing keywords
  tags: [{ type: String }],

  isQuestion: { type: Boolean, default: false },

  isDeleted: { type: Boolean, default: false },

  // Source and Lifecycle
  source: { type: String, enum: ['manual', 'ranked-import', 'keyword-research-agent', 'discovery_crawler'], default: 'manual' },
  status: { type: String, enum: ['Suggested', 'Approved', 'Rejected'], default: 'Approved' },
  lifecycle: { 
    type: String, 
    enum: ['Discovered', 'Suggested', 'Approved', 'Tracked', 'Ranking', 'Improving', 'Declining', 'Recovered', 'Archived'], 
    default: 'Discovered' 
  },

  // Agent, Quality, Authority
  qualityScore: { type: Number, default: null }, // 0-100
  qualityReason: { type: String, default: null },
  authorityScore: { type: Number, default: null }, // 0-100
  
  agent: {
    agentKey: { type: String, default: null },
    opportunityScore: { type: Number, default: null }, // 0-100
    opportunityBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} }, // Why the score is what it is
    rationale: { type: String, default: null },
    theme: { type: String, default: null } 
  },

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },
}, { timestamps: true });

// Ensure unique keywords per project
WorkspaceKeywordSchema.index({ projectId: 1, keyword: 1, locationCode: 1, languageCode: 1 }, { unique: true });

// Fast queries for dashboard
WorkspaceKeywordSchema.index({ projectId: 1, 'ranking.currentRank': 1 });
WorkspaceKeywordSchema.index({ projectId: 1, lifecycle: 1 });
WorkspaceKeywordSchema.index({ projectId: 1, cluster: 1 });

module.exports = mongoose.model('WorkspaceKeyword', WorkspaceKeywordSchema, 'workspace_keywords');