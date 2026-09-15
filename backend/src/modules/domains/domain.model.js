const mongoose = require('mongoose');

const DomainSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  brandId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  domain: { type: String, required: true, lowercase: true, trim: true },

  propertyType: { type: String, enum: ['Website'], required: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['Pending', 'Connected'], default: 'Pending', required: true },
  txtVerificationToken: { type: String, required: true },
  isDeleted: { type: Boolean, default: false, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId },
  updatedBy: { type: mongoose.Schema.Types.ObjectId }
}, { timestamps: true });

DomainSchema.index({ domain: 1 }, { unique: true });
DomainSchema.index({ propertyType: 1, propertyId: 1 });

module.exports = mongoose.model('Domain', DomainSchema);
