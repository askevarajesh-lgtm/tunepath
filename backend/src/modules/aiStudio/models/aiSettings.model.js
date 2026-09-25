const mongoose = require('mongoose');
const { DEFAULT_AI_PROVIDER, DEFAULT_AI_MODEL } = require('../../aiCore/config/aiDefaults');

const AiSettingsSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  module: {
    type: String,
    enum: ['marketplace', 'claude', 'chatgpt', 'ai_studio'],
    default: 'marketplace',
    required: true,
    index: true
  },
  openaiApiKey: {
    type: String,
    default: null
  },
  anthropicApiKey: {
    type: String,
    default: null
  },
  contentAnthropicApiKey: {
    type: String,
    default: null
  },
  aiProvider: {
    type: String,
    enum: ["openai", "anthropic"],
    default: DEFAULT_AI_PROVIDER
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  model: {
    type: String,
    default: DEFAULT_AI_MODEL
  }
}, { timestamps: true });

// Compound unique index per workspace and module
AiSettingsSchema.index({ workspaceId: 1, module: 1 }, { unique: true });

const AiSettings = mongoose.model('AiSettings', AiSettingsSchema, 'ai_settings');

// Safe runtime migration: Drop legacy unique index on workspaceId_1 if it exists so compound index can work
(async () => {
  try {
    const indexes = await AiSettings.collection.indexes();
    const legacyIdx = indexes.find(idx => idx.name === 'workspaceId_1' && idx.unique);
    if (legacyIdx) {
      await AiSettings.collection.dropIndex('workspaceId_1');
      console.log('[AiSettings] Successfully dropped legacy workspaceId_1 unique index.');
    }
  } catch (err) {
    // Collection or index might not be created yet; safe to ignore
  }
})();

module.exports = AiSettings;