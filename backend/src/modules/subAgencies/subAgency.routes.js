const express = require("express");
const { 
  createSubAgency, 
  getSubAgencies,
  getSubAgencyUsers,
  createSubAgencyUser,
  updateSubAgencyUser
} = require("./subAgency.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const { requireRole } = require("../../middlewares/rbac.middleware");

// Import the new methods
const {
  getMainAgencySubAgencyUsers,
  createMainAgencySubAgencyUser,
  updateMainAgencySubAgencyUser
} = require("./subAgency.controller");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Sub Agency Creation and Listing (Main Agency Only)
router
  .route("/")
  .post(requireRole(["agency_super_admin", "agency_manager"]), createSubAgency)
  .get(requireRole(["agency_super_admin", "agency_manager"]), getSubAgencies);

// Sub Agency User Management (Main Agency View)
router
  .route("/:id/users")
  .get(requireRole(["agency_super_admin", "agency_manager"]), getMainAgencySubAgencyUsers);

router
  .route("/:subAgencyId/users/:userId")
  .put(requireRole(["agency_super_admin", "agency_manager"]), updateMainAgencySubAgencyUser);

// Sub Agency User Management (Sub Agency Admins/Managers Only)
router
  .route("/users")
  .get(requireRole(["sub_agency_super_admin"]), getSubAgencyUsers)
  .post(requireRole(["sub_agency_super_admin"]), createSubAgencyUser);

router
  .route("/users/:id")
  .put(requireRole(["sub_agency_super_admin"]), updateSubAgencyUser);

module.exports = router;
