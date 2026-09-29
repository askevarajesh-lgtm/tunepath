const express = require("express");
const { 
  createSubAgency, 
  getSubAgencies,
  getSubAgency,
  updateSubAgency,
  deleteSubAgency,
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

// IMPORTANT: Static routes (/users, /users/:id) MUST be defined BEFORE dynamic routes (/:id)
// Otherwise Express matches /users as /:id with id="users"

// Sub Agency User Management (Sub Agency Super Admin Only)
router
  .route("/users")
  .get(requireRole(["sub_agency_super_admin"]), getSubAgencyUsers)
  .post(requireRole(["sub_agency_super_admin"]), createSubAgencyUser);

router
  .route("/users/:id")
  .put(requireRole(["sub_agency_super_admin"]), updateSubAgencyUser);

// Dynamic routes (/:id) AFTER static routes
router
  .route("/:id")
  .get(requireRole(["agency_super_admin", "agency_manager"]), getSubAgency)
  .put(requireRole(["agency_super_admin", "agency_manager"]), updateSubAgency)
  .delete(requireRole(["agency_super_admin", "agency_manager"]), deleteSubAgency);

// Sub Agency User Management (Main Agency View)
router
  .route("/:id/users")
  .get(requireRole(["agency_super_admin", "agency_manager"]), getMainAgencySubAgencyUsers);

router
  .route("/:subAgencyId/users/:userId")
  .put(requireRole(["agency_super_admin", "agency_manager"]), updateMainAgencySubAgencyUser);

module.exports = router;
