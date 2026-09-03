const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true, 
    index: true,
    validate: {
      validator: function(v) {
        if (!v) return false;
        return /^[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
      },
      message: () => 'Email address cannot start with a special character and must be a valid email'
    }
  },
  phone: { type: String, default: null },
  countryCode: { type: String, default: '91' },
  address: { type: mongoose.Schema.Types.Mixed, default: null },
  googleSheetUrl: { type: String, default: null },
  password: { type: String, required: false }, // Optional for migrated organizations
  role: { 
    type: String, 
    required: true,
    enum: [
      'supreme_super_admin',
      'commander_admin',
      'agency_super_admin',
      'agency_manager',
      'agency_client',
      'brand_super_admin',
      'brand_manager',
      'user'
    ]
  },
  companyName: { type: String, default: null },
  industry: { type: String, default: 'General' },
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ['active', 'suspended', 'trial', 'churned', 'inactive'], default: 'active' },
  
  modules: {
    chatgpt: { type: Boolean, default: false },
    canva: { type: Boolean, default: false }
  },

  subscriptionStartDate: { type: Date, default: null },
  subscriptionEndDate: { type: Date, default: null },
  billingInterval: { type: String, enum: ['Monthly', 'Yearly', 'One Time'], default: null },

  taxSettings: {
    gstPercentage: { type: Number, default: 18 },
    gstEnabled: { type: Boolean, default: false }
  },

  
  // Relationships
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  departmentName: { type: String, default: null },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  customRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
  roleName: { type: String, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Agency Specific Fields
  logo: { type: String, default: null },
  logoDark: { type: String, default: null },
  invoiceSignature: { type: String, default: null },
  avatar: { type: String, default: null },
  domain: { type: String, default: null },
  contactEmail: { type: String, default: null },
  supportPhone: { type: String, default: null },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', default: null },
  allowedUsers: { type: Number, default: 5 },
  mrr: { type: Number, default: 0 },
  
  // Theme Configuration
  theme: {
    primaryColor: { type: String },
    secondaryColor: { type: String }
  },

  // Brand Specific Fields
  isDirect: { type: Boolean, default: false },
  packageName: { type: String, default: null },
  features: [{ type: String }],

  // Package-level integration entitlements (Layer 2 -- see
  // backend/src/utils/integrationAccess.js for the two-layer model). Snapshotted
  // from the assigned Package's `integrations` at agency/brand creation time,
  // same pattern as `features` above. Stable Integration `type` identifiers only
  // (e.g. 'whatsapp'), never Integration document _id values.
  integrations: [{ type: String }],
  additionalIntegrations: [{ type: String }],
  disabledPackageIntegrations: [{ type: String }],
  ga4PropertyId: { type: String, default: null },
  gscSiteUrl: { type: String, default: null }, // Google Search Console verified property (e.g. "sc-domain:example.com")
  
  // Custom Overrides (For Agency and Direct Brand)
  extraUsers: { type: Number, default: 0 },
  extraClients: { type: Number, default: 0 },

  // Password Reset OTP
  resetPasswordOtp: { type: String, default: null },
  resetPasswordOtpExpiry: { type: Date, default: null },

  // Visibility and Assignment
  assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  viewAllClients: { type: Boolean, default: false }
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password helper
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);