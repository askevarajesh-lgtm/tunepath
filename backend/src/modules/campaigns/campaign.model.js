const mongoose = require("mongoose");

// Daily Campaign Data Schema
const dailyCampaignDataSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    spend: {
      type: Number,
      required: true,
      min: 0,
      comment: "Actual spend (incl GST)",
    },
    leads: {
      type: Number,
      default: 0,
      min: 0,
    },
    reach: {
      type: Number,
      default: 0,
      min: 0,
    },
    impressions: {
      type: Number,
      default: 0,
      min: 0,
    },
    clicks: {
      type: Number,
      default: 0,
      min: 0,
    },
    insights: {
      type: String,
      trim: true,
    },
    reportShared: {
      type: Boolean,
      default: false,
    },
    reportChannel: {
      type: String,
      enum: ["whatsapp", "email", "both", null],
      default: null,
    },
    reportedAt: {
      type: Date,
      default: null,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: false },
);

// Campaign Recharge Schema
const campaignRechargeSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    platform: {
      type: String,
      trim: true,
      comment: "Platform name (manual entry)",
    },
    rechargeDate: {
      type: Date,
      required: true,
      comment: "Date for which recharge is recorded",
    },
    activeCampaignsCount: {
      type: Number,
      min: 0,
      comment: "Number of active campaigns at the time of recharge",
    },
    clientCompanyIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        comment: "List of client companies associated with this recharge",
      },
    ],
    // Detailed breakdown for each client in a batch recharge
    clientRecharges: [
      {
        clientId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        dailyAmountSpent: Number,
        dailyBudget: Number,
        rechargeAmount: Number,
      },
    ],
    // Legacy field
    clientCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      comment: "Legacy - Client company for which recharge is done",
    },
    dailyAmountSpent: {
      type: Number,
      min: 0,
      comment: "Aggregate daily amount spent",
    },
    dailyBudget: {
      type: Number,
      min: 0,
      comment: "Aggregate daily budget",
    },
    rechargeAmount: {
      type: Number,
      required: true,
      min: 0,
      comment: "Total aggregate amount being recharged",
    },
    rechargedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      comment: "User who performed the recharge",
    },
    rechargedAt: {
      type: Date,
      default: Date.now,
      comment: "Date and time when recharge record was created",
    },
    notes: {
      type: String,
      trim: true,
      comment: "Optional notes about the recharge",
    },
  },
  { _id: true, timestamps: true },
);

const campaignSchema = new mongoose.Schema(
  {
    clientCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      comment: "Client (ClientCompany) - Clients are the companies you add",
    },
    // Legacy field for backward compatibility
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      comment: "Legacy field - use clientCompanyId instead",
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      comment: "Linked project (optional)",
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Platform
    platform: {
      type: String,
      enum: [
        "instagram",
        "facebook",
        "facebook_instagram_both",
        "facebook_and_instagram",
        "meta_ads",
        "google_ads",
        "other",
      ],
      required: true,
    },

    // Campaign Period
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    campaignDays: {
      type: Number,
      required: true,
      min: 1,
      comment: "Number of campaign days",
    },

    // Budget - Client Side
    dailyBudget: {
      type: Number,
      required: true,
      min: 0,
      comment: "Daily budget (excl GST)",
    },
    campaignAmount: {
      type: Number,
      required: true,
      min: 0,
      comment: "Total campaign amount from invoice (excl GST)",
    },
    totalCampaignValue: {
      type: Number,
      required: false,
      min: 0,
      comment: "Total campaign value agreed with client (excl GST)",
    },
    amountPaidByClient: {
      type: Number,
      default: 0,
      min: 0,
      comment: "Amount paid by client for this campaign (excl GST)",
    },
    actualSpend: {
      type: Number,
      default: 0,
      min: 0,
      comment: "Total actual spend (incl GST) - sum of daily spends",
    },

    // Payment Management - Admin Side
    paymentStatus: {
      type: String,
      enum: ["pending", "partial", "paid", "overdue", "refunded"],
      default: "pending",
      comment: "Payment status: pending, partial, paid, overdue, refunded",
    },
    gstAmount: {
      type: Number,
      default: 0,
      min: 0,
      comment: "GST amount calculated on campaign amount",
    },
    paidDate: {
      type: Date,
      default: null,
      comment: "Date when payment was received",
    },
    paymentReconciliation: {
      type: {
        type: String,
        enum: ["pending", "reconciled", "discrepancy"],
        default: "pending",
        comment: "Payment reconciliation status",
      },
      reconciledAt: {
        type: Date,
        default: null,
      },
      reconciledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      notes: {
        type: String,
        trim: true,
        comment: "Reconciliation notes",
      },
      discrepancyAmount: {
        type: Number,
        default: 0,
        comment: "Amount of discrepancy if any",
      },
    },

    // Status
    status: {
      type: String,
      enum: ["planned", "active", "paused", "completed", "cancelled"],
      default: "planned",
    },

    // Daily Campaign Data
    dailyData: {
      type: [dailyCampaignDataSchema],
      default: [],
    },

    // Campaign Recharge History
    rechargeHistory: {
      type: [campaignRechargeSchema],
      default: [],
      comment: "History of campaign recharges",
    },

    // Management
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      comment: "Coordinator managing the campaign",
    },

    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
campaignSchema.index({ clientCompanyId: 1 });
campaignSchema.index({ clientId: 1 }); // Legacy index
campaignSchema.index({ projectId: 1 });
campaignSchema.index({ companyId: 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ startDate: 1, endDate: 1 });
campaignSchema.index({ platform: 1 });

// Method to calculate total actual spend from daily data
campaignSchema.methods.calculateActualSpend = function () {
  this.actualSpend = this.dailyData.reduce(
    (sum, day) => sum + (day.spend || 0),
    0,
  );
  return this.actualSpend;
};

// Pre-save hook to update actual spend
campaignSchema.pre("save", function () {
  if (this.dailyData && this.dailyData.length > 0) {
    this.actualSpend = this.dailyData.reduce(
      (sum, day) => sum + (day.spend || 0),
      0,
    );
  }
});

const Campaign = mongoose.model("Campaign", campaignSchema);
const CampaignRecharge = mongoose.model(
  "CampaignRecharge",
  campaignRechargeSchema,
);

module.exports = {
  Campaign,
  CampaignRecharge,
};
