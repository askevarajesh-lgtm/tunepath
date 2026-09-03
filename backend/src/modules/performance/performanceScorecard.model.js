const mongoose = require("mongoose");

// Custom validator for performance category grades that allows null
const gradeValidator = {
  validator: function (value) {
    // Allow null, undefined, or valid enum values
    if (value === null || value === undefined) {
      return true;
    }
    return ["A", "B", "C", "D"].includes(value);
  },
  message: "Grade must be A, B, C, D, or null/undefined",
};

const performanceScorecardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    // Employee Details
    name: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    team: {
      type: String,
      trim: true,
      default: null,
    },
    evaluationDate: {
      type: Date,
      required: true,
    },
    // Status tracking
    status: {
      type: String,
      enum: ["draft", "self_submitted", "review_completed"],
      default: "draft",
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    // Performance Categories with SELF, OH, HR grades
    // Self grades are optional initially (for self-assessment), OH and HR are required only when admin reviews
    performanceCategories: {
      officeTimeLogIn: {
        self: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        oh: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        hr: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
      },
      attendance: {
        self: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        oh: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        hr: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
      },
      commitmentTowardsWork: {
        self: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        oh: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        hr: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
      },
      discipline: {
        self: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        oh: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        hr: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
      },
      teamWork: {
        self: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        oh: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        hr: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
      },
      innovation: {
        self: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        oh: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        hr: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
      },
      dailyReportSubmission: {
        self: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        oh: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        hr: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
      },
      workConsistency: {
        self: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        oh: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        hr: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
      },
      workEvaluation: {
        self: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        oh: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
        hr: {
          type: String,
          required: false,
          default: null,
          validate: gradeValidator,
        },
      },
    },
    // Appraisal Scores (calculated automatically)
    appraisalScores: {
      self: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      oh: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      hr: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      overall: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    },
    roomForImprovement: {
      type: String,
      trim: true,
      default: null,
    },
    remarks: {
      tl: {
        type: String,
        trim: true,
        default: null,
      },
      oh: {
        type: String,
        trim: true,
        default: null,
      },
      hr: {
        type: String,
        trim: true,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save hook to clean up null/undefined values in performance categories
// This ensures that null values are removed before validation
performanceScorecardSchema.pre("save", function () {
  if (this.performanceCategories && this.isModified("performanceCategories")) {
    const categoryKeys = Object.keys(this.performanceCategories);
    categoryKeys.forEach((key) => {
      const category = this.performanceCategories[key];
      if (category && typeof category === "object") {
        // Remove null/undefined values to avoid validation errors
        // Only keep fields with valid values ('A', 'B', 'C', 'D')
        if (
          category.oh === null ||
          category.oh === undefined ||
          !["A", "B", "C", "D"].includes(category.oh)
        ) {
          delete category.oh;
        }
        if (
          category.hr === null ||
          category.hr === undefined ||
          !["A", "B", "C", "D"].includes(category.hr)
        ) {
          delete category.hr;
        }
        if (
          category.self === null ||
          category.self === undefined ||
          !["A", "B", "C", "D"].includes(category.self)
        ) {
          delete category.self;
        }
      }
    });
  }
});

// Index to ensure one entry per user per month
performanceScorecardSchema.index(
  { userId: 1, month: 1, year: 1 },
  { unique: true },
);
performanceScorecardSchema.index({ companyId: 1 });
performanceScorecardSchema.index({ userId: 1 });

module.exports = mongoose.model(
  "PerformanceScorecard",
  performanceScorecardSchema,
);
