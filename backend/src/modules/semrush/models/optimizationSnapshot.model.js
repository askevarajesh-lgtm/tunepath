const mongoose = require('mongoose');

const MetricSchema = new mongoose.Schema({
  value: { type: Number, default: null },
  source: { type: String, default: null },
  measuredAt: { type: Date, default: null },
  available: { type: Boolean, default: false },
  weight: { type: Number, default: 0 },
  status: { type: String, enum: ['available', 'not_configured', 'unavailable', 'failed', 'stale'], default: 'unavailable' }
}, { _id: false });

const OptimizationSnapshotSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'SemrushProject', required: true, index: true },
  domain: { type: String, required: true },
  
  runId: { type: mongoose.Schema.Types.ObjectId, ref: 'IntelligenceRefreshJob', default: null },
  
  sourceStatus: {
    semrush: { type: String, enum: ['available', 'not_configured', 'unavailable', 'failed', 'stale'], default: 'unavailable' },
    dataForSeo: { type: String, enum: ['available', 'not_configured', 'unavailable', 'failed', 'stale'], default: 'unavailable' },
    pageSpeed: { type: String, enum: ['available', 'not_configured', 'unavailable', 'failed', 'stale'], default: 'unavailable' },
    aiProvider: { type: String, enum: ['available', 'not_configured', 'unavailable', 'failed', 'stale'], default: 'unavailable' },
    crawler: { type: String, enum: ['available', 'not_configured', 'unavailable', 'failed', 'stale'], default: 'unavailable' }
  },
  
  seo: {
    authorityScore: { type: MetricSchema, default: () => ({}) },
    technicalScore: { type: MetricSchema, default: () => ({}) },
    organicTraffic: { type: MetricSchema, default: () => ({}) },
    organicKeywords: { type: MetricSchema, default: () => ({}) },
    paidTraffic: { type: MetricSchema, default: () => ({}) },
    organicCost: { type: MetricSchema, default: () => ({}) },
    backlinks: { type: MetricSchema, default: () => ({}) },
    coreWebVitals: { type: MetricSchema, default: () => ({}) },
    competitors: [{ type: mongoose.Schema.Types.Mixed }],
    trend: [{ type: mongoose.Schema.Types.Mixed }],
    topKeywords: [{ type: mongoose.Schema.Types.Mixed }],
    positionDistribution: { type: mongoose.Schema.Types.Mixed, default: null },
    intentDistribution: [{ type: mongoose.Schema.Types.Mixed }],
    organicKeywordsData: [{ type: mongoose.Schema.Types.Mixed }],
    backlinksDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    siteHealthDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    trafficAnalytics: { type: mongoose.Schema.Types.Mixed, default: null },
    positionTracking: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  
  geo: {
    eeatSignals: { type: MetricSchema, default: () => ({}) },
    aiReadability: { type: MetricSchema, default: () => ({}) },
    llmFormatting: { type: MetricSchema, default: () => ({}) },
    semanticCoverage: { type: MetricSchema, default: () => ({}) },
  },
  
  aeo: {
    faqSchema: { type: MetricSchema, default: () => ({}) },
    answerIntent: { type: MetricSchema, default: () => ({}) },
    voiceSearchScore: { type: MetricSchema, default: () => ({}) },
    conversationalContent: { type: MetricSchema, default: () => ({}) },
  },
  
  scores: {
    overall: { type: Number, default: null },
    seo: { type: Number, default: null },
    geo: { type: Number, default: null },
    aeo: { type: Number, default: null },
    recommendations: [{ type: mongoose.Schema.Types.Mixed }]
  },
  
  scoreBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
  
  dataCompleteness: { type: Number, default: 0 },
  confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'low' },
  
  status: { type: String, enum: ['COMPLETED', 'PARTIAL', 'FAILED'], required: true },
  promotionReason: { type: String, default: null },
  
  issues: [{ type: mongoose.Schema.Types.Mixed }],
  recommendations: [{ type: mongoose.Schema.Types.Mixed }],
  
  scoringVersion: { type: String, default: '1.0.0' },
  
  collectedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('OptimizationSnapshot', OptimizationSnapshotSchema);
