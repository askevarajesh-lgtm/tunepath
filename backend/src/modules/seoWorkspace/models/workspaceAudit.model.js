const mongoose = require('mongoose');

const WorkspaceAuditSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceProject', required: true, index: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  taskId: { type: String, required: false }, // DataForSEO task ID
  
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed'], default: 'pending' },
  
  // High-level scores
  metrics: {
    // Legacy metrics (kept for backward compatibility)
    onpageScore: { type: Number, default: 0 },
    technicalScore: { type: Number, default: 0 },
    pagesCrawled: { type: Number, default: 0 },
    pagesWithErrors: { type: Number, default: 0 },
    pagesWithWarnings: { type: Number, default: 0 },
    
    // New Evidence-based Category Scores (100-point scale)
    technical: { type: Number, default: null },
    indexability: { type: Number, default: null },
    onpage: { type: Number, default: null },
    content: { type: Number, default: null },
    internalLinking: { type: Number, default: null },
    performance: { type: Number, default: null },
    structuredData: { type: Number, default: null },
    authority: { type: Number, default: null },
    overall: { type: Number, default: 0 },
    
    // New status & confidence metrics
    healthStatus: { type: String, enum: ['Excellent', 'Good', 'Needs Improvement', 'Poor', 'Critical'], default: 'Needs Improvement' },
    scoreConfidence: { type: String, enum: ['High', 'Medium', 'Low', 'Partial'], default: 'High' },
    confidenceReason: { type: String },
    measurementCoverage: { type: Number, default: 0 }, // Percentage of available core metrics mapped

    // Site Inventory metrics
    sitemapUrls: { type: Number, default: 0 },
    discoveredUrls: { type: Number, default: 0 },
    indexableUrls: { type: Number, default: 0 },
    nonIndexableUrls: { type: Number, default: 0 },
    
    // Score Explanations
    scoreBreakdown: [mongoose.Schema.Types.Mixed]
  },

  // Legacy breakdown of issues
  issues: {
    brokenLinks: { type: Number, default: 0 },
    duplicateContent: { type: Number, default: 0 },
    missingMeta: { type: Number, default: 0 },
    slowPages: { type: Number, default: 0 },
    canonicalIssues: { type: Number, default: 0 },
    sslIssues: { type: Number, default: 0 }
  },

  // New Evidence-based grouped issues
  groupedIssues: [{
    id: { type: String, required: true }, // e.g., ONP-001
    category: { type: String, required: true }, // Technical, On-Page, etc.
    severity: { type: String, enum: ['Critical', 'High', 'Medium', 'Low', 'Informational'], required: true },
    impact: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    confidence: { type: String, enum: ['High', 'Medium', 'Low'], default: 'High' },
    scope: { type: String, enum: ['sitewide', 'page-specific', 'template'], default: 'page-specific' },
    affectedUrls: [{ type: String }],
    affectedCount: { type: Number, default: 0 },
    analyzedCount: { type: Number, default: 0 },
    percentageAffected: { type: Number, default: 0 },
    title: { type: String, required: true },
    description: { type: String },
    evidence: [mongoose.Schema.Types.Mixed],
    rootCause: { type: String },
    recommendation: { type: String },
    priority: { type: Number, default: 1 }, // 0=Critical, 1=High, 2=Medium, 3=Low
    status: { type: String, enum: ['open', 'resolved', 'ignored'], default: 'open' }
  }],

  rawResponseUrl: { type: String, default: null }, // S3 link or similar if we cache the full JSON payload
  
  completedAt: { type: Date, default: null },

  agent: {
    agentKey: { type: String, default: null }, // e.g. 'seo-auditor'; data reference only
    summary: { type: String, default: null },
    findings: [{
      issueId: { type: String, required: true },
      category: { type: String, required: true },
      severity: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
      issue: { type: String, required: true },
      affectedUrl: { type: String, default: null },
      evidence: { type: mongoose.Schema.Types.Mixed, default: null },
      rootCause: { type: String, default: null },
      suggestedTechnicalFix: { type: String, default: null },
      expectedSeoImpact: { type: String, default: null },
      estimatedDifficulty: { type: String, default: null },
      aiExplanation: { type: String, default: null }, // Added by AI afterwards
      taskType: { type: String, enum: ['Update Meta Tags', 'Content Edit', 'Schema Injection', 'Create Redirect', 'Internal Linking', 'Technical Fix'], default: 'Content Edit' }
    }],
    approvalStatus: { type: String, enum: ['Not Requested', 'Pending Approval', 'Approved', 'Rejected'], default: 'Not Requested' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    generatedTaskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceTask' }]
  }
}, { timestamps: true });

WorkspaceAuditSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model('WorkspaceAudit', WorkspaceAuditSchema, 'workspace_audits');