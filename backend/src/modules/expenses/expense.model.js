const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    // Expense Type: Fixed or Variable
    expenseType: {
      type: String,
      enum: ["fixed", "variable"],
      required: true,
      comment:
        "Fixed: predefined categories like Rent, EB, etc. Variable: primarily employee salaries",
    },
    // Category - Required for Fixed expenses, optional for Variable
    category: {
      type: String,
      required: function () {
        return this.expenseType === "fixed";
      },
      enum: [
        // Fixed Expense Categories
        "rent",
        "eb", // Electricity Bill
        "internet",
        "water",
        "maintenance",
        "tea_coffee",
        "maid",
        "transport",
        "ceo_salary",
        "bde_salary",
        "oh_salary",
        "oh_incentive",
        "om_salary",
        "hr_account",
        "campaign_ads",
        "hosting",
        "domain_purchase",
        "domain_renewal",
        "mobile_recharge",
        "event",
        "purchase_gymbal",
        "purchase_camera",
        "other_trip",
        "other_miscellaneous",
        // Legacy categories for backward compatibility
        "electricity",
        "utilities",
        "salaries",
        "sales_team_salaries",
        "maid_services",
        "other_operational",
        "marketing",
        "software",
        "hardware",
        "travel",
        "other",
      ],
      comment:
        "Category for fixed expenses. For variable expenses (salaries), this is optional",
    },
    // Department-wise categorization (uses teams from user management)
    department: {
      type: String,
      default: null,
      required: false,
      validate: {
        validator: function (value) {
          // Allow null, undefined, or empty string
          if (value === null || value === undefined || value === "") {
            return true;
          }
          // Accept any string value (teams are dynamic from user management)
          // Just ensure it's a non-empty string
          return typeof value === "string" && value.trim().length > 0;
        },
        message: "Department must be a valid string value",
      },
      comment:
        "Department/Team this expense belongs to (optional, uses teams from user management)",
    },
    // Expense type/subcategory (optional)
    type: {
      type: String,
      trim: true,
      default: null,
      comment: "Subcategory or type of expense (optional)",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      default: null,
      comment: "Description of the expense (optional)",
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Staff/Employee reference (REQUIRED for Variable expenses - salaries)
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
      comment:
        "Employee/Staff member this expense is for (REQUIRED for variable expenses/salaries)",
    },
    // Referral-related fields (only where applicable)
    referral: {
      isReferral: {
        type: Boolean,
        default: false,
        comment: "Whether this expense is related to a referral",
      },
      referralId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        comment: "Referrer user ID (if applicable)",
      },
      referralAmount: {
        type: Number,
        default: 0,
        min: 0,
        comment: "Referral amount/commission (if applicable)",
      },
      referralNotes: {
        type: String,
        trim: true,
        default: null,
        comment: "Referral-related notes (if applicable)",
      },
    },
    receipt: {
      url: {
        type: String,
        default: null,
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
    },
    // Additional optional fields
    vendor: {
      type: String,
      trim: true,
      default: null,
      comment: "Vendor/supplier name (optional)",
    },
    paymentMethod: {
      type: String,
      default: null,
      required: false,
      validate: {
        validator: function (value) {
          // Allow null, undefined, or empty string
          if (value === null || value === undefined || value === "") {
            return true;
          }
          // Validate against enum values
          return ["cash", "bank_transfer", "upi", "cheque", "other"].includes(
            value,
          );
        },
        message:
          "Payment method must be one of: cash, bank_transfer, upi, cheque, other",
      },
      comment: "Payment method used (optional)",
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      comment: "Additional notes (optional)",
    },
    remarks: {
      type: String,
      trim: true,
      default: null,
      comment: "Remarks/notes for the expense",
    },
    paymentScreenshot: {
      type: String,
      default: null,
      comment: "Base64 or URL of the payment screenshot",
    },
    // Tool Expenses specific fields (used when type = 'tool_expenses')
    toolName: {
      type: String,
      trim: true,
      default: null,
      comment: "Name of the tool/software (for tool expenses)",
    },
    websiteUrl: {
      type: String,
      trim: true,
      default: null,
      comment: "Website URL of the tool (for tool expenses)",
    },
    startDate: {
      type: Date,
      default: null,
      comment: "Subscription start date (for tool expenses)",
    },
    expiryDate: {
      type: Date,
      default: null,
      comment: "Subscription expiry date (for tool expenses)",
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save hook to handle null values for enum fields
expenseSchema.pre("save", function () {
  // Remove null/empty string values for enum fields to avoid validation errors
  if (
    this.department === null ||
    this.department === undefined ||
    this.department === ""
  ) {
    this.department = undefined;
  }
  if (
    this.paymentMethod === null ||
    this.paymentMethod === undefined ||
    this.paymentMethod === ""
  ) {
    this.paymentMethod = undefined;
  }
});

// Pre-update hook for findOneAndUpdate operations
expenseSchema.pre(["findOneAndUpdate", "updateOne"], function () {
  const update = this.getUpdate();
  if (update && typeof update === "object") {
    if (
      update.department === null ||
      update.department === undefined ||
      update.department === ""
    ) {
      update.department = undefined;
    }
    if (
      update.paymentMethod === null ||
      update.paymentMethod === undefined ||
      update.paymentMethod === ""
    ) {
      update.paymentMethod = undefined;
    }
  }
});

expenseSchema.index({ companyId: 1 });
expenseSchema.index({ date: 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ expenseType: 1 });
expenseSchema.index({ staffId: 1 });
expenseSchema.index({ companyId: 1, expenseType: 1 });
expenseSchema.index({ companyId: 1, date: 1 });

module.exports = mongoose.model("Expense", expenseSchema);
