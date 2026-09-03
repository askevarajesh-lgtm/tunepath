const express = require("express");
const { body } = require("express-validator");
const projectController = require("./project.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const tenantMiddleware = (req, res, next) => next();
const rbacMiddleware = require("../../middlewares/rbac.middleware");
const permissionMiddleware = (action) => (req, res, next) => next();
const upload = require('../../middlewares/upload');
// Stub uploadToCloudinary if missing
const uploadToCloudinary = (req, res, next) => next();

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

const createProjectValidation = [
  body("invoiceId")
    .notEmpty()
    .withMessage(
      "Invoice ID is required. Projects can only be created from invoices.",
    ),
  body("invoiceItemId")
    .notEmpty()
    .withMessage("Invoice item index is required."),
];

router.get(
  "/",
  permissionMiddleware("view-project"),
  projectController.getAllProjects,
);
router.get(
  "/dropdown",
  permissionMiddleware("view-project"),
  projectController.getProjectsDropdown,
);
router.get(
  "/summary-stats",
  permissionMiddleware("view-project"),
  projectController.getProjectListSummaryStats,
);
router.get(
  "/report",
  permissionMiddleware("view-project"),
  projectController.getProjectReport,
);
router.get(
  "/unassigned-deliverables-summary",
  permissionMiddleware("view-project"),
  projectController.getUnassignedDeliverablesSummary,
);
router.post(
  "/from-invoice/:invoiceId",
  permissionMiddleware("create-project"),
  projectController.createProjectFromInvoice,
);

router.get(
  "/:id",
  permissionMiddleware("view-project"),
  projectController.getProjectById,
);
router.post(
  "/",
  permissionMiddleware("create-project"),
  createProjectValidation,
  projectController.createProject,
);
router.put(
  "/:id",
  permissionMiddleware("edit-project"),
  projectController.updateProject,
);
router.delete(
  "/bulk",
  permissionMiddleware("delete-project"),
  projectController.bulkDeleteProjects,
);
router.delete(
  "/:id",
  permissionMiddleware("delete-project"),
  projectController.deleteProject,
);

// Activate/Deactivate project
router.post(
  "/:id/activate",
  permissionMiddleware("edit-project"),
  projectController.activateProject,
);
router.post(
  "/:id/deactivate",
  permissionMiddleware("edit-project"),
  projectController.deactivateProject,
);

// Project review endpoints
router.post(
  "/:id/submit-for-review",
  permissionMiddleware("edit-project"),
  projectController.submitForClientReview,
);

router.post(
  "/:id/approve",
  permissionMiddleware("edit-project"),
  projectController.clientApprove,
);

// Workflow approval - creates tasks after approval
// Note: Send workflow to client functionality has been removed
router.post(
  "/:id/approve-workflow",
  permissionMiddleware("edit-project"),
  projectController.approveWorkflow,
);

// Request workflow revision
router.post(
  "/:id/request-workflow-revision",
  permissionMiddleware("edit-project"),
  projectController.requestWorkflowRevision,
);

const uploadPostingProofValidation = [
  body("platform")
    .notEmpty()
    .withMessage("Platform is required")
    .isIn(["facebook", "instagram", "twitter", "linkedin", "youtube", "other"])
    .withMessage("Invalid platform"),
  body("url")
    .notEmpty()
    .withMessage("Posting URL is required")
    .isURL()
    .withMessage("Invalid URL"),
  // screenshot is now optional and will come from file upload
];

router.post(
  "/:id/posting-proof",
  permissionMiddleware("edit-project"),
  upload.single("postingProofFile"),
  uploadToCloudinary,
  uploadPostingProofValidation,
  projectController.uploadPostingProof,
);

router.post(
  "/:id/bulk-posting-proof",
  permissionMiddleware("edit-project"),
  upload.single("postingProofFile"),
  uploadToCloudinary,
  projectController.addBulkPostingProofs,
);

router.put(
  "/:id/posting-proof/:proofId",
  permissionMiddleware("edit-project"),
  upload.single("postingProofFile"),
  uploadToCloudinary,
  projectController.updatePostingProof,
);

router.delete(
  "/:id/posting-proof/:proofId",
  permissionMiddleware("edit-project"),
  projectController.deletePostingProof,
);

// Complete project (Admin and authorized users)
router.post(
  "/:id/complete",
  permissionMiddleware("edit-project"),
  projectController.completeProject,
);

// Reopen project (Admin and authorized users)
router.post(
  "/:id/reopen",
  permissionMiddleware("edit-project"),
  projectController.reopenProject,
);

// Update project milestones
router.put(
  "/:id/milestones",
  permissionMiddleware("edit-project"),
  projectController.updateProjectMilestones,
);
router.post(
  "/:id/milestones",
  permissionMiddleware("edit-project"),
  projectController.updateProjectMilestones,
);

// Renew project (Admin and authorized users)
router.post(
  "/:id/renew",
  permissionMiddleware("edit-project"),
  projectController.renewProject,
);

module.exports = router;
