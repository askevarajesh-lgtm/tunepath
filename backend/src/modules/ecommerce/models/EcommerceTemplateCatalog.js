const mongoose = require('mongoose');

const ecommerceTemplateCatalogSchema = new mongoose.Schema({
  templateId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  thumbnail: { type: String, default: '' },
  pages: { type: mongoose.Schema.Types.Mixed, default: {} },
  assets: { type: mongoose.Schema.Types.Mixed, default: {} },
  version: { type: Number, default: 1 },
  active: { type: Boolean, default: true },
  commerceBindings: { type: mongoose.Schema.Types.Mixed, default: {} },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('EcommerceTemplateCatalog', ecommerceTemplateCatalogSchema);
