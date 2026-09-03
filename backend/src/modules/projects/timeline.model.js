const mongoose = require('mongoose');

const timelineSchema = new mongoose.Schema({
  eventType: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  performedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: { type: String },
  metadata: { type: Object, default: {} },
  companyId: { type: mongoose.Schema.Types.ObjectId }
}, { timestamps: true });

module.exports = mongoose.models.TimelineEvent || mongoose.model('TimelineEvent', timelineSchema);
