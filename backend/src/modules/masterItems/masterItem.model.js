const mongoose = require('mongoose');

const masterItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  categories: [{
    name: { type: String, trim: true },
    count: { type: Number, default: 0 }
  }],
  applicableAccess: [{
    name: { type: String, trim: true },
    value: { type: String, trim: true }
  }],
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  handlingDuration: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  isCustom: {
    type: Boolean,
    default: false
  },
  isCampaign: {
    type: Boolean,
    default: false
  },
  campaignDetails: {
    numberOfDays: { type: Number, default: 0 },
    dailyBudget: { type: Number, default: 0 },
    campaignAmount: { type: Number, default: 0 }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Department reference & name
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  department: {
    type: String,
    trim: true,
    default: null
  },
  // Tenant references for RBAC
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  agencyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Indexes for common queries
masterItemSchema.index({ name: 1, adminId: 1, agencyId: 1, brandId: 1 });
masterItemSchema.index({ departmentId: 1 });
masterItemSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('MasterItem', masterItemSchema);
