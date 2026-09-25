const { validationResult } = require("express-validator");
const projectService = require("./project.service");
const projectReviewService = require("./project-review.service");
const {
  sendSuccess,
  sendError,
  sendValidationError,
} = require("./shimResponse");

const getAllProjects = async (req, res) => {
  try {
    const result = await projectService.getAllProjects(
      req.companyId,
      req.query,
      req.user?.role,
      req.user?.clientUserId || req.user?._id,
    );
    // If pagination exists, return paginated response, otherwise return legacy format
    if (result.pagination) {
      return sendSuccess(res, "Projects retrieved successfully", result);
    }
    // Legacy format for backward compatibility
    return sendSuccess(res, "Projects retrieved successfully", {
      projects: result.data || result,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getProjectListSummaryStats = async (req, res) => {
  try {
    const summary = await projectService.getProjectListSummaryStats(
      req.companyId,
      req.query,
      req.user?.role,
      req.user?.clientUserId || req.user?._id,
    );
    return sendSuccess(res, "Project summary retrieved successfully", {
      summary,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getUnassignedDeliverablesSummary = async (req, res) => {
  try {
    const summary = await projectService.getUnassignedDeliverablesSummary(
      req.companyId,
      req.query,
      req.user?.role,
      req.user?.clientUserId || req.user?._id,
    );
    return sendSuccess(
      res,
      "Project unassigned deliverables summary retrieved successfully",
      { summary },
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getDeliverablesClientSummary = async (req, res) => {
  try {
    const summary = await projectService.getDeliverablesClientSummary(
      req.companyId,
      req.query,
      req.user?.role,
      req.user?.clientUserId || req.user?._id,
    );
    return sendSuccess(
      res,
      "Deliverables client summary retrieved successfully",
      { summary },
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getProjectReport = async (req, res) => {
  try {
    const report = await projectService.getProjectReport(
      req.companyId,
      req.query,
      req.user?.role,
      req.user?.clientUserId || req.user?._id,
    );
    return sendSuccess(res, "Project report retrieved successfully", {
      report,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getProjectsDropdown = async (req, res) => {
  try {
    const projects = await projectService.getProjectsDropdown(req.companyId, {
      ...req.query,
      userRole: req.user?.role,
      userId: req.user?.clientUserId || req.user?._id,
    });
    return sendSuccess(res, "Projects retrieved successfully", { projects });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getProjectById = async (req, res) => {
  try {
    const project = await projectService.getProjectById(
      req.params.id,
      req.companyId,
      req.user?.role,
      req.user?.clientUserId || req.user?._id,
    );
    return sendSuccess(res, "Project retrieved successfully", { project });
  } catch (error) {
    return sendError(res, 404, error.message);
  }
};

const createProject = async (req, res) => {
  try {
    const Task = require('../tasks/task.model');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }

    console.log("[Project Controller] Creating project with data:", req.body);

    const invoice = await Invoice.findOne({ _id: req.body.invoiceId, isDeleted: false });
    if (!invoice) return sendError(res, 404, "Invoice not found");

    const proposal = await Proposal.findOne({ _id: invoice.proposalId, isDeleted: false }).populate("masterItems");
    if (!proposal) return sendError(res, 404, "Associated proposal not found");

    const companyId = req.companyId || invoice.agencyId || invoice.adminId || req.user.brandId || req.user.agencyId;

    const projectData = {
      ...req.body,
      clientId: invoice.clientId,
      companyId: companyId,
      createdBy: req.user._id,
      proposalId: invoice.proposalId,
      masterItemIds: proposal.masterItems.map(item => item._id),
      billingType: "one-time",
      invoiceType: "final",
      invoiceDate: invoice.createdAt
    };

    const project = await Project.create(projectData);

    // DISABLED: Automatic task creation when creating a project.
    // Tasks should only be created manually by coordinators/admins when needed.
    console.log("[Project Controller] Project created successfully:", project._id);
    return sendSuccess(res, "Project created successfully", { project });
  } catch (error) {
    console.error("[Project Controller] Error creating project:", error);
    return sendError(res, 500, error.message);
  }
};

const updateProject = async (req, res) => {
  try {
    const project = await projectService.updateProject(
      req.params.id,
      req.body,
      req.companyId,
    );
    return sendSuccess(res, "Project updated successfully", { project });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const deleteProject = async (req, res) => {
  try {
    await projectService.deleteProject(req.params.id, req.companyId);
    return sendSuccess(res, "Project deleted successfully");
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const submitForClientReview = async (req, res) => {
  try {
    const project = await projectReviewService.submitForClientReview(
      req.params.id,
      req.user._id,
    );
    return sendSuccess(
      res,
      "Project submitted for client review successfully",
      { project },
    );
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const clientApprove = async (req, res) => {
  try {
    const project = await projectReviewService.clientApprove(
      req.params.id,
      req.user._id,
      req.body.reviewNotes || "",
    );
    return sendSuccess(res, "Project approved by client successfully", {
      project,
    });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const approveWorkflow = async (req, res) => {
  try {
    const project = await projectService.approveWorkflow(
      req.params.id,
      req.companyId,
      req.user._id,
    );
    return sendSuccess(
      res,
      "Project workflow approved and tasks created successfully",
      { project },
    );
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const uploadPostingProof = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }

    // Include Cloudinary URL if file was uploaded
    const postingData = {
      ...req.body,
      screenshot: req.file?.path || req.cloudinaryResult?.url || req.body.screenshot || null,
    };

    const project = await projectReviewService.uploadPostingProof(
      req.params.id,
      postingData,
      req.user._id,
    );
    return sendSuccess(res, "Posting proof uploaded successfully", { project });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const addBulkPostingProofs = async (req, res) => {
  try {
    const bulkData = {
      ...req.body,
      screenshot: req.file?.path || req.cloudinaryResult?.url || null, // Cloudinary URL from middleware
    };

    const project = await projectReviewService.addBulkPostingProofs(
      req.params.id,
      bulkData,
      req.user._id,
    );
    return sendSuccess(res, "Posting proofs added successfully", { project });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const updatePostingProof = async (req, res) => {
  try {
    const updateData = {
      ...req.body,
    };

    if (req.file) {
      updateData.screenshot = req.file.path;
    } else if (req.cloudinaryResult) {
      updateData.screenshot = req.cloudinaryResult.url;
    }

    const project = await projectReviewService.updatePostingProof(
      req.params.id,
      req.params.proofId,
      updateData,
      req.user._id,
    );
    return sendSuccess(res, "Posting proof updated successfully", { project });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const deletePostingProof = async (req, res) => {
  try {
    const project = await projectReviewService.deletePostingProof(
      req.params.id,
      req.params.proofId,
      req.user._id,
    );
    return sendSuccess(res, "Posting proof deleted successfully", { project });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

// sendWorkflowToClient - REMOVED: Send workflow to client functionality has been disabled

const requestWorkflowRevision = async (req, res) => {
  try {
    const { revisionRequested, requestedByType } = req.body;
    if (!revisionRequested) {
      return sendError(res, 400, "Revision request details are required");
    }
    const project = await projectReviewService.requestWorkflowRevision(
      req.params.id,
      revisionRequested,
      req.user._id,
      requestedByType || "client",
    );
    return sendSuccess(res, "Workflow revision requested successfully", {
      project,
    });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const completeProject = async (req, res) => {
  try {
    const project = await projectReviewService.completeProject(
      req.params.id,
      req.user._id,
    );
    return sendSuccess(res, "Project marked as completed successfully", {
      project,
    });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const reopenProject = async (req, res) => {
  try {
    const reopenData = {
      status: req.body.status,
      additionalPayment: req.body.additionalPayment,
      updateTaskStatus: req.body.updateTaskStatus,
      taskStatus: req.body.taskStatus,
    };
    const project = await projectReviewService.reopenProject(
      req.params.id,
      reopenData,
      req.user._id,
    );
    return sendSuccess(res, "Project reopened successfully", { project });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const activateProject = async (req, res) => {
  try {
    const project = await projectService.activateProject(
      req.params.id,
      req.companyId,
    );
    return sendSuccess(res, "Project activated successfully", { project });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const deactivateProject = async (req, res) => {
  try {
    const project = await projectService.deactivateProject(
      req.params.id,
      req.companyId,
    );
    return sendSuccess(res, "Project deactivated successfully", { project });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const updateProjectMilestones = async (req, res) => {
  try {
    const project = await projectService.updateProjectMilestones(
      req.params.id,
      req.body,
      req.companyId,
      req.user._id,
    );
    return sendSuccess(res, "Project milestones updated successfully", {
      project,
    });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const bulkDeleteProjects = async (req, res) => {
  try {
    const { projectIds } = req.body;
    if (!projectIds || !Array.isArray(projectIds)) {
      return sendError(res, 400, "Project IDs array is required");
    }
    const result = await projectService.bulkDeleteProjects(
      projectIds,
      req.companyId,
    );
    return sendSuccess(res, "Bulk deletion completed", result);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const renewProject = async (req, res) => {
  try {
    const project = await projectReviewService.renewProject(
      req.params.id,
      req.user._id,
    );
    return sendSuccess(res, "Project renewed successfully", { project });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const Invoice = require('../invoices/invoice.model');
const Proposal = require('../proposals/proposal.model');
const Project = require('./project.model');

const createProjectFromInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    // Find Invoice
    const invoice = await Invoice.findOne({ _id: invoiceId, isDeleted: false });
    if (!invoice) return sendError(res, 404, "Invoice not found");
    if (invoice.paymentStatus !== "Paid") return sendError(res, 400, "Invoice must be paid to create a project");

    // Check if project already exists for this invoice
    const existingProject = await Project.findOne({ invoiceId });
    if (existingProject) return sendError(res, 400, "Project already created for this invoice");

    // Get Proposal to get masterItems
    const proposal = await Proposal.findOne({ _id: invoice.proposalId, isDeleted: false }).populate("masterItems");
    if (!proposal) return sendError(res, 404, "Associated proposal not found");

    // Extract departments from masterItems (basic mapping)
    // Assume all masterItems belong to the same project
    const departments = [];
    proposal.masterItems.forEach(item => {
      // Basic mock mapping for departments since MasterItem schema has 'category'
      // Project enum: ["digital-marketing", "seo", "graphic_designing", "tech_team"]
      if (item.category && item.category.toLowerCase().includes("seo")) departments.push("seo");
      else if (item.category && item.category.toLowerCase().includes("tech")) departments.push("tech_team");
      else if (item.category && item.category.toLowerCase().includes("design")) departments.push("graphic_designing");
      else departments.push("digital-marketing");
    });

    const projectData = {
      name: `${proposal.name} - Project`,
      clientId: invoice.clientId,
      companyId: invoice.agencyId || invoice.adminId || req.user.brandId || req.user.agencyId, // Fallback companyId
      createdBy: req.user._id,
      status: "created",
      proposalId: invoice.proposalId,
      invoiceId: invoice._id,
      masterItemIds: proposal.masterItems.map(item => item._id),
      departments: [...new Set(departments)],
      startDate: new Date(),
      billingType: "one-time", // default
      invoiceType: "final",
      invoiceDate: invoice.createdAt
    };

    const project = await Project.create(projectData);

    return sendSuccess(res, "Project created successfully from invoice", { project });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

module.exports = {
  getAllProjects,
  getProjectListSummaryStats,
  getUnassignedDeliverablesSummary,
  getDeliverablesClientSummary,
  getProjectReport,
  getProjectsDropdown,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  bulkDeleteProjects,
  activateProject,
  deactivateProject,
  submitForClientReview,
  clientApprove,
  approveWorkflow,
  // sendWorkflowToClient - REMOVED: Send workflow to client functionality has been disabled
  requestWorkflowRevision,
  uploadPostingProof,
  addBulkPostingProofs,
  updatePostingProof,
  deletePostingProof,
  completeProject,
  reopenProject,
  updateProjectMilestones,
  renewProject,
  createProjectFromInvoice,
};
