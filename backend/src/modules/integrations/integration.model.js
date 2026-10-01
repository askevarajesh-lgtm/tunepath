const mongoose = require("mongoose");

const integrationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null, // null for platform-level integrations
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientCompany",
      default: null,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // used for sub-user specific integrations
    },
    type: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return /^[a-z0-9_]+$/.test(v) && v.length > 0 && v.length <= 50;
        },
        message: props => `${props.value} is not a valid stable integration type!`
      }
    },
    name: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    isGloballyEnabled: {
      type: Boolean,
      default: true,
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // For WhatsApp: { backendUrl, apiToken, templates: [{ id, name, variables }] }
      // For SendPulse: { clientId, clientSecret, fromEmail, fromName }
      // For IVR (e.g. Exotel-style): { accountSid, subdomain, accountRegion, apiKey, apiToken, exoPhoneNumber }
      // For Meta Ads: { accessToken, userId, selectedAdAccounts: [{ id, name }], expiresAt }
    },
  },
  {
    timestamps: true,
  },
);

integrationSchema.index({ companyId: 1, type: 1 });

module.exports = mongoose.model("Integration", integrationSchema);
