const mongoose = require('mongoose');

const workspaceAuditQueueSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceAuditJob', required: true, index: true },
  url: { type: String, required: true },
  depth: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'skipped', 'failed', 'timed_out'], default: 'pending', index: true },
  skipReason: { type: String }, // e.g., "robots_disallowed", "unmodified", "canonical_mismatch", "budget_reached"
  retryCount: { type: Number, default: 0 },
  error: { type: String },
  errorType: { type: String }, // e.g., REQUEST_TIMEOUT, DNS_ERROR, HTTP_404
  durationMs: { type: Number }
});

workspaceAuditQueueSchema.index({ jobId: 1, url: 1 }, { unique: true });

module.exports = mongoose.model('WorkspaceAuditQueue', workspaceAuditQueueSchema);
