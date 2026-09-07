const express = require("express");
const { body } = require("express-validator");
const taskController = require("./task.controller");
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = (req, res, next) => next();
const _permMiddleware = (action) => (req, res, next) => next();
const upload = require('../../middlewares/upload');

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);

// Validation rules
const createTaskValidation = [
  body("title").notEmpty().withMessage("Task title is required"),
  body("department").notEmpty().withMessage("Department is required"),
  body("companyId").optional(),
  body("taskType").optional().isIn(['client', 'own_brand']).withMessage("Invalid task type"),
  body("assignedTo").notEmpty().withMessage("Assigned to user is required"),
  body("dueDate").optional(),
  body("projectId").custom((value, { req }) => {
    if (req.body.taskType === 'client' && !value) {
      throw new Error('Project is required when creating a task for a client');
    }
    return true;
  }),
];


const validateTaskValidation = [
  body("isValid").isBoolean().withMessage("isValid must be a boolean"),
  body("remarks").optional().isString().withMessage("Remarks must be a string"),
];

const createScheduledNoteValidation = [
  body("scheduledDate").notEmpty().withMessage("Scheduled date is required"),
  body("notes").notEmpty().withMessage("Notes are required"),
];

// Routes - check permissions for non-admin users
// IMPORTANT: Specific routes must come BEFORE parameterized routes (/:id)
router.get("/", _permMiddleware("view-task"), taskController.getAllTasks);
router.get(
  "/dropdown",
  _permMiddleware("view-task"),
  taskController.getTasksDropdown,
);
router.get(
  "/kanban",
  _permMiddleware("view-task"),
  taskController.getTasksForKanban,
);
router.get(
  "/project/:projectId",
  _permMiddleware("view-task"),
  taskController.getTasksByProject,
);
router.get(
  "/department/:department",
  _permMiddleware("view-task"),
  taskController.getTasksByDepartment,
);
router.get(
  "/scheduled-notes",
  _permMiddleware("view-task"),
  taskController.getScheduledNotes,
);
router.post(
  "/scheduled-notes",
  _permMiddleware("edit-task"),
  createScheduledNoteValidation,
  taskController.createScheduledNote,
);
router.get(
  "/workflow-config",
  _permMiddleware("view-task"),
  taskController.getWorkflowConfig,
);
router.get(
  "/workflow-configs",
  _permMiddleware("view-task"),
  taskController.getAllWorkflowConfigs,
);
router.post(
  "/workflow-config",
  _permMiddleware("edit-task"),
  taskController.createOrUpdateWorkflowConfig,
);
router.get("/notification-settings", taskController.getNotificationSettings);
router.get("/today-stats", taskController.getTodayTaskStats);
router.get(
  "/today-assigned-dm-summary",
  _permMiddleware("view-task"),
  taskController.getTodayAssignedTaskBreakdownForDigitalMarketing,
);
router.put("/notification-settings", taskController.updateNotificationSettings);

// Notification routes - accessible to all authenticated users (no permission check)
// These must come before /:id routes
const notificationController = require("./notification.controller");
router.get("/notifications", notificationController.getNotifications);
router.put("/notifications/read-all", notificationController.markAllAsRead);
router.put("/notifications/:id/read", notificationController.markAsRead);
router.delete(
  "/notifications/bulk",
  notificationController.deleteNotifications,
);
router.delete("/notifications/:id", notificationController.deleteNotification);

// Parameterized routes (/:id) must come AFTER all specific routes
router.get(
  "/:id",
  _permMiddleware("view-task"),
  taskController.getTaskById,
);
router.get(
  "/:id/comments",
  _permMiddleware("view-task"),
  taskController.getTaskComments,
);
router.get(
  "/:id/activity",
  _permMiddleware("view-task"),
  taskController.getTaskActivity,
);
router.post(
  "/bulk",
  _permMiddleware("create-task"),
  taskController.createBulkTasks,
);
router.post(
  "/",
  _permMiddleware("create-task"),
  createTaskValidation,
  taskController.createTask,
);
router.put(
  "/:id",
  _permMiddleware("edit-task"),
  taskController.updateTask,
);
router.put(
  "/:id/hold",
  _permMiddleware("view-task"),
  taskController.holdTask,
);
router.put(
  "/:id/status-order",
  _permMiddleware("view-task"),
  upload.single("screenshot"),
  (req, res, next) => next(),
  taskController.updateTaskStatusAndOrder,
);
router.put(
  "/:id/screenshot/:attachmentId",
  _permMiddleware("edit-task"),
  upload.single("screenshot"),
  (req, res, next) => next(),
  taskController.updateScreenshot,
);
router.put(
  "/order/bulk",
  _permMiddleware("view-task"),
  taskController.updateTasksOrder,
);
router.post(
  "/:id/submit",
  _permMiddleware("edit-task"),
  taskController.submitTask,
);
router.post(
  "/:id/validate",
  _permMiddleware("edit-task"),
  validateTaskValidation,
  taskController.validateTask,
);
router.post(
  "/:id/comments",
  _permMiddleware("view-task"),
  taskController.addComment,
);
router.post(
  "/:id/reminder",
  _permMiddleware("edit-task"),
  taskController.sendTaskReminder,
);
router.post("/:id/client-approve", taskController.clientApproveTask);
router.delete(
  "/:id",
  _permMiddleware("delete-task"),
  taskController.deleteTask,
);

// Legacy routes for backward compatibility
router.post(
  "/:id/approve",
  _permMiddleware("edit-task"),
  taskController.approveTask,
);
router.post(
  "/:id/rework",
  _permMiddleware("edit-task"),
  taskController.requestRework,
);
router.post(
  "/:id/reopen",
  _permMiddleware("edit-task"),
  taskController.reopenTask,
);

module.exports = router;
