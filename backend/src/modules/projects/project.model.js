const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      comment: "Client (User) - Clients are the companies you add",
    },
    // Reference to the tenant company (organization)
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "created",
        "workflow_sent",
        "workflow_revision_requested",
        "workflow_approved",
        "in_progress",
        "sent_for_client_review",
        "approved",
        "completed",
        "on_hold",
        "cancelled",
        "project_near_due_date",
      ],
      default: "created",
      comment:
        "Flow: created → workflow_sent → workflow_approved → in_progress → sent_for_client_review → approved → completed",
    },
    isActive: {
      type: Boolean,
      default: true,
      comment:
        "Whether project is active. Only active projects are shown in task creation dropdown.",
    },

    // Workflow (sent to client for approval)
    workflow: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      comment: "Workflow definition sent to client",
    },
    workflowSentAt: {
      type: Date,
      default: null,
    },
    workflowSentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    workflowApprovedAt: {
      type: Date,
      default: null,
    },
    workflowApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      comment: "Client user who approved workflow",
    },
    workflowRevisionRequestedAt: {
      type: Date,
      default: null,
    },
    workflowRevisionRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    workflowRevisionRequestedByType: {
      type: String,
      enum: ["client", "coordinator"],
      required: false,
      default: undefined,
      comment: "Whether revision was requested by client or coordinator",
    },
    workflowRevisionRequested: {
      type: String,
      trim: true,
      comment: "Revision request details/notes",
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    renewalDate: {
      type: Date,
      default: null,
      comment: "Next renewal date (endDate + 1 day) based on handling duration",
    },
    // Project can have multiple departments working on it
    // Department values should match Master Item department enum
    departments: [
      {
        type: String,
        enum: ["digital-marketing", "seo", "graphic_designing", "tech_team"],
        comment:
          "Departments derived from Master Item. Can have multiple departments for multi-department projects.",
      },
    ],
    // Proposal reference (optional - project can be created from invoice directly or from approved proposal)
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: false,
      default: null,
      comment:
        "Proposal ID if project was created from an approved proposal (optional - invoice can be created directly)",
    },

    // Invoice reference (required - project only created after invoice and payment)
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      comment:
        "Project created only after invoice created and payment condition satisfied",
    },
    invoiceItemId: {
      type: Number,
      required: false,
      comment: "Index of the invoice item that generated this project (Legacy)",
    },
    masterItemIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterItem",
      comment: "Service (Master Item) IDs from invoice",
    }],
    masterItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: false,
      comment: "Legacy: Service (Master Item) ID from invoice item",
    },
    packageName: {
      type: String,
      trim: true,
      comment: 'Specific package name (e.g., "Silver", "Gold") if applicable',
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      comment: "Plan ID from invoice item (optional)",
    },
    // Billing information from invoice
    billingType: {
      type: String,
      enum: ["one-time", "subscription"],
      required: true,
    },
    invoiceType: {
      type: String,
      enum: ["proforma", "final"],
      required: true,
    },
    invoiceDate: {
      type: Date,
      required: true,
    },
    // NEW: Client Review Fields
    clientReview: {
      status: {
        type: String,
        enum: ["pending", "approved", "correction_requested"],
        default: "pending",
      },
      reviewedAt: Date,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Client user
      },
      reviewNotes: String,
    },
    // NEW: Correction Tracking
    correctionCount: {
      type: Number,
      default: 0,
      comment: "Total correction count (client + coordinator)",
    },
    clientCorrectionCount: {
      type: Number,
      default: 0,
      comment:
        "Number of corrections requested by client (counts against limit)",
    },
    maxAllowedCorrections: {
      type: Number,
      default: 2,
      comment: "Maximum allowed client corrections",
    },
    correctionExceeded: {
      type: Boolean,
      default: false,
      comment: "Flag when client corrections exceed allowed count",
    },
    // NEW: Posting Proof
    postingProof: [
      {
        platform: {
          type: String,
          enum: [
            "facebook",
            "instagram",
            "twitter",
            "linkedin",
            "youtube",
            "other",
          ],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        screenshot: String, // Cloudinary URL
        postedAt: {
          type: Date,
          default: Date.now,
        },
        postedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    // NEW: Project Completion
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // NEW: Additional Payment Details (for reopened projects)
    additionalPayment: {
      amount: {
        type: Number,
        default: 0,
        min: 0,
        comment: "Additional payment amount when project is reopened",
      },
      reason: {
        type: String,
        trim: true,
        comment: "Reason for additional payment",
      },
      addedAt: {
        type: Date,
        default: null,
      },
      addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      carriedForwardToInvoice: {
        type: Boolean,
        default: false,
        comment: "Whether this amount has been included in an invoice",
      },
      invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Invoice",
        default: null,
        comment: "Invoice ID where this amount was included",
      },
    },
    // NEW: Project Milestones/Workflow Tracking
    milestones: [
      {
        step: {
          type: String,
          required: true,
          trim: true,
          comment:
            'Milestone step name (e.g., "Client Onboarded", "Greeting Sent")',
        },
        completed: {
          type: Boolean,
          default: false,
        },
        completedAt: {
          type: Date,
          default: null,
        },
        completedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
          comment:
            "Additional metadata (e.g., correction rounds, review numbers)",
        },
      },
    ],
    milestoneWorkflowType: {
      type: String,
      enum: [
        "website_team",
        "tech_team",
        "seo",
        "digital-marketing",
        "digital_marketing",
        "website-designing",
        "website_designing",
        "web-application-development",
        "web_application_development",
      ],
      default: null,
      comment: "Type of workflow/milestone checklist based on team/package",
    },
    // Digital Marketing / Content Tracking
    numberOfPosters: {
      type: Number,
      default: 0,
      min: 0,
    },
    numberOfVideos: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingPosters: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedPosters: {
      type: Number,
      default: 0,
      min: 0,
    },
    approvedPosters: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingVideos: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedVideos: {
      type: Number,
      default: 0,
      min: 0,
    },
    approvedVideos: {
      type: Number,
      default: 0,
      min: 0,
    },
    numberOfShoots: { type: Number, default: 0 },
    remainingShoots: { type: Number, default: 0 },
    completedShoots: { type: Number, default: 0 },
    approvedShoots: { type: Number, default: 0 },
    // Dynamic Categories Tracking
    selectedCategories: [
      {
        name: String,
        categoryName: String,
        quantity: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
        approved: { type: Number, default: 0 },
        cost: { type: Number, default: 0 },
      },
    ],
    applicableAccess: [
      {
        name: String,
        value: String,
        completed: { type: Boolean, default: false }
      }
    ],
  },
  {
    timestamps: true,
  },
);

projectSchema.index({ companyId: 1 });
projectSchema.index({ clientId: 1 });
projectSchema.index({ proposalId: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ invoiceId: 1 });
projectSchema.index({ masterItemId: 1 });

module.exports = mongoose.model("Project", projectSchema);
