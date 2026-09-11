const mongoose = require('mongoose');

const WorkspaceCompetitorSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceProject', required: true, index: true },
  agencyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  domain: { type: String, required: true, trim: true },
  logo:   { type: String, default: null }, // favicon/logo URL, fetched lazily

  // ── Enriched profile ───────────────────────────────────────────────
  country:      { type: String, default: null },   // primary target country (ISO-2)
  industry:     { type: String, default: null },   // e.g. 'e-commerce', 'saas'
  category:     { type: String, default: null },   // sub-category
  topCategories:[{ type: String }],                // top content categories detected

  // ── Existing core metrics (preserved exactly) ───────────────────────
  metrics: {
    commonKeywords:  { type: Number, default: 0 },
    organicKeywords: { type: Number, default: 0 },
    organicTraffic:  { type: Number, default: 0 },
    organicCost:     { type: Number, default: 0 },
    referringDomains:{ type: Number, default: 0 },
    backlinks:       { type: Number, default: 0 },
    domainRank:      { type: Number, default: 0 },

    // ── New enriched metrics (additive, default 0) ──────────────────
    paidTraffic:      { type: Number, default: 0 },   // estimated paid search traffic
    authority:        { type: Number, default: 0 },   // 0–100 DR/DA equivalent
    estimatedRevenue: { type: Number, default: 0 },   // organicCost × revenue multiplier
    indexedPages:     { type: Number, default: 0 },   // estimated indexed page count
    visibility:       { type: Number, default: 0 },   // 0–100 composite visibility score
  },

  // ── Intelligence scores (computed by services, never fabricated) ─────
  threatScore:     { type: Number, default: 0, min: 0, max: 100 }, // from threatIntelligence.service
  opportunityScore:{ type: Number, default: 0, min: 0, max: 100 }, // from opportunityEngine.service
  aiScore:         { type: Number, default: 0, min: 0, max: 100 }, // AI visibility / GEO coverage score

  lastCrawl: { type: Date, default: null }, // last time this competitor's data was refreshed

  dataSource: { type: String, enum: ['dataforseo', 'ai-estimate', 'legacy-ai-estimate'], default: 'dataforseo' },
  source:     { type: String, enum: ['manual', 'competitor-agent'], default: 'competitor-agent' },
  status:     { type: String, enum: ['Suggested', 'Approved', 'Rejected'], default: 'Suggested' },
  
  competitiveScore: { type: Number, default: 0, min: 0, max: 100 }, // deterministic relevance score
  rankingEvidence: [{ type: Object }], // stores real SERP overlap evidence


  agent: {
    agentKey:   { type: String, default: null },
    threatLevel:{ type: String, enum: ['minimal', 'low', 'medium', 'high', 'critical'], default: 'medium' },
    confidence: { type: Number, default: 50 },
    strengths:  [{ type: String }],
    weaknesses: [{ type: String }],
    contentGaps:[{ type: String }],
    rationale:  { type: String, default: null }
  },

  approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:      { type: Date, default: null },
  rejectionReason: { type: String, default: null },

  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// ── Existing indexes (preserved) ────────────────────────────────────────
WorkspaceCompetitorSchema.index({ projectId: 1, domain: 1 }, { unique: true });
WorkspaceCompetitorSchema.index({ projectId: 1, 'metrics.organicTraffic': -1 });

// ── New indexes ──────────────────────────────────────────────────────────
WorkspaceCompetitorSchema.index({ projectId: 1, 'agent.threatLevel': 1 });
WorkspaceCompetitorSchema.index({ projectId: 1, threatScore: -1 });
WorkspaceCompetitorSchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.model('WorkspaceCompetitor', WorkspaceCompetitorSchema, 'workspace_competitors');
