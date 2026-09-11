const mongoose = require('mongoose');

const CRAWL_PROFILES = {
  quick: {
    maxPages: 100,
    maxDepth: 3,
    maxDuration: 5 * 60 * 1000, // 5 min
    maxConcurrentRequests: 5,
    requestsPerSecond: 2
  },
  standard: {
    maxPages: 1000,
    maxDepth: 10,
    maxDuration: 30 * 60 * 1000, // 30 min
    maxConcurrentRequests: 10,
    requestsPerSecond: 5
  },
  deep: {
    maxPages: 10000,
    maxDepth: 50,
    maxDuration: 4 * 60 * 60 * 1000, // 4 hours
    maxConcurrentRequests: 20,
    requestsPerSecond: 10
  }
};

const workspaceAuditJobSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceProject', required: true, index: true },
  agencyId: { type: String, required: true },
  status: { type: String, enum: ['queued', 'running', 'paused', 'synthesizing', 'completed', 'completed_with_warnings', 'budget_reached', 'failed'], default: 'queued' },
  profile: { type: String, enum: ['quick', 'standard', 'deep', 'custom'], default: 'standard' },
  budgets: {
    maxPages: { type: Number },
    maxDepth: { type: Number },
    maxDuration: { type: Number },
    maxConcurrentRequests: { type: Number },
    requestsPerSecond: { type: Number }
  },
  progress: {
    urlsDiscovered: { type: Number, default: 0 },
    urlsCrawled: { type: Number, default: 0 },
    urlsRemaining: { type: Number, default: 0 },
    urlsSkipped: { type: Number, default: 0 },
    failedUrls: { type: Number, default: 0 },
    timedOutUrls: { type: Number, default: 0 },
    currentUrl: { type: String, default: '' },
    currentStage: { type: String, default: 'Initializing' },
    currentAnalyzer: { type: String, default: 'None' },
    pagesPerSecond: { type: Number, default: 0 },
    estimatedTimeRemainingMs: { type: Number, default: 0 }
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
  error: { type: String }
}, { timestamps: true });

workspaceAuditJobSchema.pre('save', function() {
  if (this.isNew && this.profile !== 'custom') {
    this.budgets = CRAWL_PROFILES[this.profile] || CRAWL_PROFILES.standard;
  }
});

module.exports = mongoose.model('WorkspaceAuditJob', workspaceAuditJobSchema);
