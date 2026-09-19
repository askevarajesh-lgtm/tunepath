const mongoose = require("mongoose");

// Department enum - fixed list
const DEPARTMENTS = {
  DIGITAL_MARKETING: "digital-marketing",
  WEBSITE_DESIGNING: "website-designing",
  SEO: "seo",
  WEB_APPLICATION_DEVELOPMENT: "web-application-development",
};

// Task status workflow: Created → Assigned → In Progress → Submitted → Validated/Rejected → Completed
const TASK_STATUS = {
  CREATED: "created",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  HOLD: "hold",
  SUBMITTED: "submitted",
  VALIDATED: "validated",
  REJECTED: "rejected",
  COMPLETED: "completed",
  COMPLETE: "complete",
  // Kanban-specific statuses
  BACKLOG: "backlog",
  TO_DO: "to_do",
  REVIEW: "review",
  DONE: "done",
  REJECTED_K: "Rejected",
};

const taskSchema = new mongoose.Schema(
  {
    // Basic Information
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    holdReason: {
      type: String,
      trim: true,
      default: null,
    },

    // Department - accepts any string to support dynamic departments
    department: {
      type: String,
      required: true,
    },

    // Project Reference (optional - tasks can exist without projects)
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },

    // Company References
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    taskType: {
      type: String,
      enum: ['client', 'own_brand'],
      default: 'client',
    },
    tenantCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // Allow unassigned tasks
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedUserPhone: {
      type: String,
      default: null,
    },

    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Priority
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    // Task Category (displayed as Task Type in UI) - any string accepted
    taskCategory: {
      type: String,
      default: "New",
    },

    // Labels/Tags
    labels: [
      {
        type: String,
        trim: true,
      },
    ],

    // Watchers (users who should receive notifications)
    watchers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Reminder tracking
    lastReminderSentAt: {
      type: Date,
      default: null,
    },

    // Order/Position for drag & drop within columns
    order: {
      type: Number,
      default: 0,
    },

    // Status Workflow
    status: {
      type: String,
      default: TASK_STATUS.CREATED,
    },

    // Dates
    startDate: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    actualCompletionDate: {
      type: Date,
    },

    // Validation (Critical for operations team)
    validationStatus: {
      type: String,
      enum: ["pending", "validated", "rejected"],
      default: "pending",
    },
    validationRemarks: {
      type: String,
      trim: true,
    },
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    validatedAt: {
      type: Date,
    },

    // Work Proof / Attachments
    attachments: [
      {
        url: {
          type: String,
          required: true,
        },
        fileName: {
          type: String,
          required: true,
        },
        fileType: {
          type: String,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        isScreenshot: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Time Tracking
    timeSpent: {
      type: Number, // in hours
      default: 0,
    },

    // Actual work timestamps (set automatically during status transitions)
    workStartedAt: {
      type: Date,
      default: null,
    },
    workCompletedAt: {
      type: Date,
      default: null,
    },
    workDurationMinutes: {
      type: Number, // minutes between workStartedAt and workCompletedAt
      default: null,
    },

    // Rework tracking
    reworkCount: {
      type: Number,
      default: 0,
    },

    // Legacy fields (for backward compatibility during migration)
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    plannerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Planner",
      default: null,
    },
    type: {
      type: String,
      default: null,
      required: false,
      validate: {
        validator: function (value) {
          // Allow null, undefined, empty string, or valid enum values
          if (value === null || value === undefined || value === "") {
            return true;
          }
          return ["image", "video", "web_page", "other"].includes(value);
        },
        message: "Type must be one of: image, video, web_page, other",
      },
    },
    deliverables: [
      {
        url: String,
        type: String,
        uploadedAt: Date,
      },
    ],
    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comments: String,
      submittedAt: Date,
    },
    completedAt: {
      type: Date,
    },
    // NEW: Task Type (from Master Item template)
    taskType: {
      type: String,
      enum: [
        "client",
        "own",
        "own_brand",
        "content_upload",
        "creative_design",
        "internal_review",
        "client_review",
        "posting",
        "other",
      ],
      default: "other",
    },
    // NEW: Posting Platform (if taskType is 'posting')
    postingPlatform: {
      type: String,
      default: null,
      required: false,
      validate: {
        validator: function (value) {
          // Allow null, undefined, empty string, or valid enum values
          if (value === null || value === undefined || value === "") {
            return true;
          }
          return [
            "facebook",
            "instagram",
            "twitter",
            "linkedin",
            "youtube",
            "other",
          ].includes(value);
        },
        message:
          "Posting platform must be one of: facebook, instagram, twitter, linkedin, youtube, other",
      },
    },
    // NEW: Task Dependencies
    dependsOn: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
    // NEW: Client Review Fields
    requiresClientReview: {
      type: Boolean,
      default: false,
    },
    clientReviewStatus: {
      type: String,
      default: null,
      required: false,
      validate: {
        validator: function (value) {
          // Allow null, undefined, empty string, or valid enum values
          if (value === null || value === undefined || value === "") {
            return true;
          }
          return ["pending", "approved", "correction_requested"].includes(
            value,
          );
        },
        message:
          "Client review status must be one of: pending, approved, correction_requested",
      },
    },
    // NEW: Posting Proof
    postingProof: {
      url: String,
      screenshot: String,
      postedAt: Date,
    },
    serviceType: {
      type: String,
      // Removed strict enum to allow dynamic categories like "brochure"
    },
    serviceSequenceNumber: {
      type: Number,
    },
    parentTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    reopenedToTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    isReopened: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient queries
taskSchema.index({ tenantCompanyId: 1 });
taskSchema.index({ companyId: 1 });
taskSchema.index({ projectId: 1 });
taskSchema.index({ department: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ validationStatus: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ parentTaskId: 1 });
taskSchema.index({ isReopened: 1 });
taskSchema.index({ projectId: 1, status: 1, order: 1 }); // For Kanban queries
taskSchema.index({ watchers: 1 }); // For notification queries

// Pre-save hook to set dates based on status and clean null enum values
taskSchema.pre("save", function (next) {
  // ── Department Slugification ────────────────────────────────────────────────
  if (this.department) {
    this.department = this.department
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // ── Work-time tracking ──────────────────────────────────────────────────────
  // We now track timing for all departments.
  // Logic is primarily handled in task.service.js for cumulative tracking,
  // but we keep basic start/end date setting here as a fallback.
  if (this.status === TASK_STATUS.IN_PROGRESS && !this.workStartedAt) {
    this.workStartedAt = new Date();
  }

  const isFinished = [
    TASK_STATUS.COMPLETED,
    TASK_STATUS.VALIDATED,
    TASK_STATUS.DONE,
    TASK_STATUS.COMPLETE,
    "review",
    "in_review",
    "sent_for_client_review"
  ].includes(this.status);

  if (isFinished && !this.workCompletedAt) {
    this.workCompletedAt = new Date();
  }

  // If we have both, ensure workDurationMinutes is at least the difference
  // (Note: Service will handle cumulative addition)
  if (this.workStartedAt && this.workCompletedAt && !this.workDurationMinutes) {
    this.workDurationMinutes = Math.round(
      (this.workCompletedAt - this.workStartedAt) / 60000,
    );
  }

  // ── actualCompletionDate ───────────────────────────────────────────────────
  // Handle actualCompletionDate based on status
  if (isFinished) {
    if (!this.actualCompletionDate) {
      this.actualCompletionDate = new Date();
    }
  } else {
    // Clear completion date if reopened
    this.actualCompletionDate = undefined;
  }

  // Set validatedAt when validated
  if (this.validationStatus === "validated" && !this.validatedAt) {
    this.validatedAt = new Date();
  }

  // Remove null/empty string values for optional enum fields to avoid validation errors
  if (this.type === null || this.type === undefined || this.type === "") {
    this.type = undefined;
  }
  if (
    this.postingPlatform === null ||
    this.postingPlatform === undefined ||
    this.postingPlatform === ""
  ) {
    this.postingPlatform = undefined;
  }
  if (
    this.clientReviewStatus === null ||
    this.clientReviewStatus === undefined ||
    this.clientReviewStatus === ""
  ) {
    this.clientReviewStatus = undefined;
  }
  if (
    this.serviceType === null ||
    this.serviceType === undefined ||
    this.serviceType === ""
  ) {
    this.serviceType = undefined;
  }

  if (typeof next === 'function') {
    next();
  }
});

module.exports = mongoose.model("Task", taskSchema);
module.exports.DEPARTMENTS = DEPARTMENTS;
module.exports.TASK_STATUS = TASK_STATUS; // trigger nodemon reload
