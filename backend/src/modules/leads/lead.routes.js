const express = require("express");
const multer = require("multer");
const leadController = require("./lead.controller");
const authMiddleware = require("../../middlewares/authMiddleware");
const tenantMiddleware = (req, res, next) => next();
const rbacMiddleware = (...roles) => (req, res, next) => next();
const permissionMiddleware = (...permissions) => (req, res, next) => next();

const router = express.Router();

const leadCsvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const mime = file.mimetype || "";
    const allowedMime =
      mime === "text/csv" ||
      mime === "application/csv" ||
      mime === "text/plain" ||
      mime === "application/vnd.ms-excel";
    if (allowedMime || name.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed for import"));
    }
  },
});

const leadNotesUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedPrefixes = ["image/", "video/", "audio/"];
    const allowedDocMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
      "application/zip",
      "application/x-zip-compressed",
    ];
    if (
      allowedPrefixes.some((p) => file.mimetype.startsWith(p)) ||
      allowedDocMimes.includes(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported note file type"));
    }
  },
});

router.use(authMiddleware);
router.use(tenantMiddleware);

router.get(
  "/export",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("view-lead"),
  leadController.exportLeadsCsv,
);
router.post(
  "/import",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("create-lead"),
  leadCsvUpload.single("file"),
  leadController.importLeadsCsv,
);
router.get(
  "/assignable-bde",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("create-lead", "edit-lead"),
  leadController.getAssignableBdeUsers,
);
router.get(
  "/stats",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("view-lead"),
  leadController.getLeadStats,
);
router.get(
  "/dropdown",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("view-lead"),
  leadController.getLeadsDropdown,
);
router.get(
  "/",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("view-lead"),
  leadController.getLeads,
);
router.get(
  "/:id",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("view-lead"),
  leadController.getLeadById,
);
router.post(
  "/",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("create-lead"),
  leadController.createLead,
);
router.put(
  "/:id",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("edit-lead"),
  leadController.updateLead,
);
router.delete(
  "/:id",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("delete-lead"),
  leadController.deleteLead,
);
router.post(
  "/assign",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("edit-lead"),
  leadController.assignLeads,
);
router.post(
  "/bulk-delete",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("delete-lead"),
  leadController.bulkDeleteLeads,
);
router.get(
  "/:id/notes",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("view-lead"),
  leadController.getLeadNotes,
);
router.post(
  "/:id/notes",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("edit-lead"),
  leadNotesUpload.single("file"),
  leadController.addLeadNote,
);
router.delete(
  "/:id/notes/:noteId",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("edit-lead"),
  leadController.deleteLeadNote,
);
router.post(
  "/:id/reminders",
  rbacMiddleware("admin", "bde", "client"),
  permissionMiddleware("edit-lead"),
  leadController.addLeadReminder,
);

module.exports = router;
