const mongoose = require('mongoose');

const ecommerceStoreSchema = new mongoose.Schema({
  // Keeping templateId for backward compatibility in the DB schema,
  // but conceptually it's the storeId now.
  templateId: { type: String, required: true, unique: true },
  workspaceId: { type: String, required: true },
  websiteId: { type: String, required: true },
  name: { type: String, required: true },
  
  // New fields for the catalog reference
  sourceTemplateId: { type: String },
  sourceTemplateVersion: { type: Number },
  status: { type: String, default: 'active' },

  pages: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  assets: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true, collection: 'ecommercetemplates' });

// We expose it as EcommerceStore in code
module.exports = mongoose.model('EcommerceStore', ecommerceStoreSchema);
