const mongoose = require('mongoose');

const semrushCacheSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SemrushProject'
  },
  domain: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    default: 'semrush'
  },
  queryKey: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '24h' // Cache expires after 24 hours
  }
});

// Ensure a single tenant cannot have duplicate cache keys
semrushCacheSchema.index({ companyId: 1, queryKey: 1 }, { unique: true });

const SemrushCache = mongoose.model('SemrushCache', semrushCacheSchema);

// Drop legacy single-field unique index 'queryKey_1' if it exists in MongoDB
SemrushCache.on('index', () => {
  SemrushCache.collection.dropIndex('queryKey_1').catch(() => {
    // Ignore if queryKey_1 index does not exist or has already been dropped
  });
});

module.exports = SemrushCache;
