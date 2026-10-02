const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
  proposalNumber: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  masterItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MasterItem',
    required: true
  }],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  grandTotal: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Approved', 'Rejected', 'Converted to Invoice', 'Invoice Created'],
    default: 'Draft'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Indexes

proposalSchema.index({ clientId: 1, adminId: 1, agencyId: 1, brandId: 1 });
proposalSchema.index({ status: 1 });

// Auto-generate proposal number
proposalSchema.pre('validate', async function() {
  if (!this.proposalNumber) {
    const count = await this.constructor.countDocuments();
    this.proposalNumber = `PROP-${Date.now()}-${count + 1}`;
  }
});

module.exports = mongoose.model('Proposal', proposalSchema);
