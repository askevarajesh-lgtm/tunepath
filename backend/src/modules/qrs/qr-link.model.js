const mongoose = require('mongoose');

const QRLinkSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  brandId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  name: { type: String, required: true, trim: true },

  slug: { type: String, required: true, trim: true },
  type: { type: String, required: true }, // Website, Call, SMS, WhatsApp, payment etc
  scans: { type: Number, default: 0, required: true },
  scanLink: { type: String, required: true }, // Destination URL
  foreground: { type: String, default: "var(--accent-primary)", required: true },
  background: { type: String, default: "#ffffff", required: true },
  shape: { type: String, enum: ['Square', 'Rounded'], default: 'Square', required: true },
  isDeleted: { type: Boolean, default: false, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId },
  updatedBy: { type: mongoose.Schema.Types.ObjectId }
}, { timestamps: true });

QRLinkSchema.index({ workspaceId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('QRLink', QRLinkSchema);
