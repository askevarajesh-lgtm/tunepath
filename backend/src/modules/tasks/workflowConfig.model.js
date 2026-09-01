const mongoose = require("mongoose");

const workflowConfigSchema = new mongoose.Schema(
  {
    // Project-specific workflow (null for default/global workflow)
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
    // Project type/category for workflow template (website_designing, bde, sales, etc.)
    // null means default workflow, specific type means workflow for that project type
    projectType: {
      type: String,
      default: null,
      index: true,
      comment:
        "Project type/category this workflow applies to. null = default workflow, specific type = template for that project type",
    },
    // Tenant company
    tenantCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    // Workflow name
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Template color for visual identification
    color: {
      type: String,
      trim: true,
      default: "#1890ff",
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow null/empty
          // Validate hex color format
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: "Template color must be a valid hex color code",
      },
      comment: "Color code for visual identification of workflow template",
    },
    // Statuses configuration
    statuses: [
      {
        id: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        color: {
          type: String,
          default: "#1890ff",
        },
        order: {
          type: Number,
          required: true,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
    // Default statuses if not configured
    defaultStatuses: {
      type: Boolean,
      default: true,
    },
    // Is active
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save hook to ensure projectType is always slugified
workflowConfigSchema.pre("save", function () {
  if (this.projectType && typeof this.projectType === "string") {
    this.projectType = this.projectType
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
});

// Indexes
workflowConfigSchema.index({ tenantCompanyId: 1, projectId: 1 });
workflowConfigSchema.index({ tenantCompanyId: 1, projectType: 1 });
workflowConfigSchema.index({ tenantCompanyId: 1, isActive: 1 });

module.exports = mongoose.model("WorkflowConfig", workflowConfigSchema);