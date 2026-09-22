const express = require("express");
const router = express.Router();
const seoController = require("./seo.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const tenantMiddleware = (req, res, next) => next();
const rbacMiddleware = (...roles) => (req, res, next) => next();
const upload = require("../../middlewares/upload");

const permissionMiddleware = (...permissions) => (req, res, next) => next();
const autoPermissionMiddleware = (req, res, next) => next();

// Apply authentication and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Validation middleware
const validateSEO = (req, res, next) => {
  const { websiteLink } = req.body;

  if (!websiteLink || !websiteLink.trim()) {
    return res.status(400).json({
      success: false,
      message: "Website link is required",
    });
  }

  next();
};

// Routes
router.get(
  "/",
  permissionMiddleware("view-seo-panel"),
  seoController.getAllSEO,
);
router.get(
  "/websites",
  permissionMiddleware("view-seo-panel"),
  seoController.getSEOUniqueWebsites,
);
router.get(
  "/:id",
  permissionMiddleware("view-seo-panel"),
  seoController.getSEOById,
);

router.get(
  "/:id/timeline",
  permissionMiddleware("view-seo-panel"),
  seoController.getSEOTimeline,
);

router.post(
  "/",
  permissionMiddleware("create-seo-panel"),
  upload.fields([
    { name: "websiteAuditScreenshot", maxCount: 1 },
    { name: "credentialsFile", maxCount: 1 },
  ]),
  validateSEO,
  seoController.createSEO,
);

router.put(
  "/:id",
  permissionMiddleware("edit-seo-panel"),
  upload.fields([
    { name: "websiteAuditScreenshot", maxCount: 1 },
    { name: "credentialsFile", maxCount: 1 },
  ]),
  validateSEO,
  seoController.updateSEO,
);

router.delete(
  "/:id",
  permissionMiddleware("delete-seo-panel"),
  seoController.deleteSEO,
);

// Get SEO Dashboard Statistics
router.get(
  "/dashboard/stats",
  permissionMiddleware("view-seo-panel"),
  seoController.getSEODashboardStats,
);

// Add work update to SEO entry
router.post(
  "/:id/work-updates",
  permissionMiddleware("edit-seo-panel"),
  upload.fields([{ name: "screenshots", maxCount: 10 }]),
  seoController.addWorkUpdate,
);

// Get Client-wise and User-wise SEO Work Report
router.get(
  "/reports/client-user",
  permissionMiddleware("view-seo-panel"),
  seoController.getSEOClientUserReport,
);

module.exports = router;
