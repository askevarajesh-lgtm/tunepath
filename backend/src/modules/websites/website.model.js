const mongoose = require('mongoose');

const WebsiteSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: "" },
  status: { type: String, enum: ['Draft', 'Published', 'Creating', 'Failed'], default: 'Draft', required: true },
  failReason: { type: String, default: null },
  faviconUrl: { type: String, default: "" },
  trackingPixels: {
    metaPixelId: { type: String, default: "" },
    ga4Id: { type: String, default: "" },
    gtmId: { type: String, default: "" },
    tiktokPixelId: { type: String, default: "" }
  },
  chatWidgetId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatWidget', default: null },
  theme: {
    fontFamily: { type: String, default: 'Inter' },
    primaryColor: { type: String, default: '#3b82f6' },
    tagline: { type: String, default: "" }
  },
  domainId: { type: mongoose.Schema.Types.ObjectId, ref: 'Domain' },
  isDeleted: { type: Boolean, default: false, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId },
  updatedBy: { type: mongoose.Schema.Types.ObjectId },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' }
}, { timestamps: true });

WebsiteSchema.index({ workspaceId: 1, name: 1 });
// WebsiteSchema.index({ domainId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Website', WebsiteSchema);