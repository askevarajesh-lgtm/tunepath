const { validationResult } = require("express-validator");
const taskService = require("./task.service");
const {
  sendSuccess,
  sendError,
  sendValidationError,
} = require('./shimResponse');

const getAllTasks = async (req, res) => {
  try {
    // Normalize filters
    const query = { ...req.query };
    if (query.projectId === "null" || query.projectId === "")
      query.projectId = null;
    if (query.assignedTo === "null" || query.assignedTo === "")
      query.assignedTo = null;
    if (query.department === "null" || query.department === "")
      query.department = null;

    const result = await taskService.getAllTasks(
      req.companyId,
      query,
      req.user?.role,
      req.user?.clientUserId || req.user?._id,
    );
    // If pagination exists, return paginated response, otherwise return legacy format
    if (result.pagination) {
      return sendSuccess(res, "Tasks retrieved successfully", result);
    }
    // Legacy format for backward compatibility
    return sendSuccess(res, "Tasks retrieved successfully", {
      tasks: result.data || result,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getTasksDropdown = async (req, res) => {
  try {
    const tasks = await taskService.getTasksDropdown(
      req.companyId,
      req.query,
      req.user?.role,
      req.user?.clientUserId || req.user?._id,
    );
    return sendSuccess(res, "Tasks retrieved successfully", { tasks });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getTaskById = async (req, res) => {
  try {
    const task = await taskService.getTaskById(
      req.params.id,
      req.companyId,
      req.user?.role,
      req.user?.clientUserId || req.user?._id,
    );
    return sendSuccess(res, "Task retrieved successfully", { task });
  } catch (error) {
    return sendError(res, 404, error.message);
  }
};

const createTask = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }
    const task = await taskService.createTask(
      req.body,
      req.companyId,
      req.user._id,
    );
    return sendSuccess(res, "Task created successfully", { task });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await taskService.updateTask(
      req.params.id,
      { ...req.body, _requesterRole: req.user?.role },
      req.companyId,
      req.user._id,
    );
    return sendSuccess(res, "Task updated successfully", { task });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const holdTask = async (req, res) => {
  try {
    const { holdReason } = req.body;
    const task = await taskService.holdTask(
      req.params.id,
      holdReason,
      req.user._id,
      req.user?.role,
      req.companyId
    );
    return sendSuccess(res, "Task placed on hold successfully", { task });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const submitTask = async (req, res) => {
  try {
    const task = await taskService.submitTask(
      req.params.id,
      req.body,
      req.companyId,
      req.user._id,
    );
    return sendSuccess(res, "Task submitted successfully", { task });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

// New validation endpoint
const validateTask = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }
    const { isValid, remarks } = req.body;
    const task = await taskService.validateTask(
      req.params.id,
      { isValid, remarks, _requesterRole: req.user?.role },
      req.user._id,
      req.companyId,
    );
    return sendSuccess(
      res,
      isValid
        ? "Task validated successfully"
        : "Task rejected. Rework requested",
      { task },
    );
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

// Legacy endpoints for backward compatibility
const approveTask = async (req, res) => {
  try {
    const task = await taskService.approveTask(req.params.id, req.companyId);
    return sendSuccess(res, "Task approved successfully", { task });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const clientApproveTask = async (req, res) => {
  try {
    const task = await taskService.clientApproveTask(
      req.params.id,
      req.user?._id,
      req.companyId,
    );
    return sendSuccess(res, "Task approved by client successfully", { task });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const requestRework = async (req, res) => {
  try {
    const { feedback } = req.body;
    const task = await taskService.requestRework(
      req.params.id,
      feedback,
      req.companyId,
    );
    return sendSuccess(res, "Rework requested successfully", { task });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

// Get tasks by project
const getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasks = await taskService.getTasksByProject(projectId, req.companyId);
    return sendSuccess(res, "Tasks retrieved successfully", { tasks });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Get tasks by department
const getTasksByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    const tasks = await taskService.getTasksByDepartment(
      department,
      req.companyId,
      req.query,
    );
    return sendSuccess(res, "Tasks retrieved successfully", { tasks });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getScheduledNotes = async (req, res) => {
  try {
    const notes = await taskService.getScheduledNotes(req.companyId, req.query);
    return sendSuccess(res, "Scheduled notes retrieved successfully", {
      notes,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const createScheduledNote = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }

    const note = await taskService.createScheduledNote(
      req.body,
      req.companyId,
      req.user._id,
    );
    return sendSuccess(res, "Scheduled note created successfully", { note });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

// Get tasks for Kanban board
const getTasksForKanban = async (req, res) => {
  try {
    // Normalize projectId - convert empty string or "null" string to null
    const query = { ...req.query };
    if (
      query.projectId &&
      (query.projectId === "null" || query.projectId === "")
    ) {
      query.projectId = null;
    } else if (!query.projectId) {
      query.projectId = null;
    }

    if (query.assignedTo === "null" || query.assignedTo === "") {
      query.assignedTo = null;
    }

    if (query.department === "null" || query.department === "") {
      query.department = null;
    }

    const tasks = await taskService.getTasksForKanban(
      req.companyId,
      query,
      req.user?.role,
      req.user?.clientUserId || req.user?._id,
    );
    return sendSuccess(res, "Tasks retrieved successfully", { tasks });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Update task status and order (drag & drop)
const updateTaskStatusAndOrder = async (req, res) => {
  try {
    const { id } = req.params;
    // Handle both FormData (with file) and JSON requests
    const status = req.body.status;
    const order = req.body.order ? parseInt(req.body.order) : 0;
    const command = req.body.command || null;
    const taskCategory = req.body.taskCategory || null;
    const statusScope = {
      boardStartDate: req.body.boardStartDate || null,
      boardEndDate: req.body.boardEndDate || null,
      boardDateField: req.body.boardDateField || null,
    };
    const screenshotUrl = req.file?.path || req.cloudinaryResult?.url || null;

    const task = await taskService.updateTaskStatusAndOrder(
      id,
      status,
      order,
      req.user._id,
      req.companyId,
      command,
      screenshotUrl,
      req.user?.role,
      taskCategory,
      statusScope,
    );
    return sendSuccess(res, "Task updated successfully", { task });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const updateScreenshot = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const screenshotUrl = req.file?.path || req.cloudinaryResult?.url || null;

    if (!screenshotUrl) {
      return sendError(res, 400, "Screenshot file is required");
    }

    const task = await taskService.updateTaskScreenshot(
      id,
      attachmentId,
      screenshotUrl,
      req.user._id,
      req.companyId,
    );
    return sendSuccess(res, "Screenshot updated successfully", { task });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

// Update multiple tasks order (drag & drop within column)
const updateTasksOrder = async (req, res) => {
  try {
    const { updates } = req.body;
    const result = await taskService.updateTasksOrder(
      updates,
      req.user._id,
      req.companyId,
    );
    return sendSuccess(res, "Tasks order updated successfully", result);
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

// Add comment to task
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const comment = await taskService.addComment(
      id,
      req.body,
      req.user._id,
      req.companyId,
      req.user?.role,
    );
    return sendSuccess(res, "Comment added successfully", { comment });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

// Get task comments
const getTaskComments = async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await taskService.getTaskComments(
      id,
      req.companyId,
      req.user?.role,
      req.user?.clientUserId || req.user?._id,
    );
    return sendSuccess(res, "Comments retrieved successfully", { comments });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Get task activity
const getTaskActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await taskService.getTaskActivity(
      id,
      req.companyId,
      req.user?.role,
      req.user?.clientUserId || req.user?._id,
    );
    return sendSuccess(res, "Activity retrieved successfully", { activity });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Get workflow configuration
const getWorkflowConfig = async (req, res) => {
  try {
    const { projectId, projectType } = req.query;
    // Convert empty string or "null" string to null
    const normalizedProjectId =
      projectId && projectId !== "null" && projectId !== "" ? projectId : null;
    const normalizedProjectType =
      projectType && projectType !== "null" && projectType !== ""
        ? projectType
        : null;
    const config = await taskService.getWorkflowConfig(
      normalizedProjectId,
      req.companyId,
      normalizedProjectType,
    );
    return sendSuccess(res, "Workflow config retrieved successfully", {
      config,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Create or update workflow configuration
const createOrUpdateWorkflowConfig = async (req, res) => {
  try {
    const config = await taskService.createOrUpdateWorkflowConfig(
      req.body,
      req.companyId,
    );
    return sendSuccess(res, "Workflow config saved successfully", { config });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

// Get all workflow configurations
const getAllWorkflowConfigs = async (req, res) => {
  try {
    const configs = await taskService.getAllWorkflowConfigs(
      req.companyId,
      req.user,
      req.query,
    );
    return sendSuccess(res, "Workflow configs retrieved successfully", {
      configs,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Get notification settings
const getNotificationSettings = async (req, res) => {
  try {
    const settings = await taskService.getNotificationSettings(
      req.user._id,
      req.companyId,
    );
    return sendSuccess(res, "Notification settings retrieved successfully", {
      settings,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Update notification settings
const updateNotificationSettings = async (req, res) => {
  try {
    const settings = await taskService.updateNotificationSettings(
      req.user._id,
      req.companyId,
      req.body,
    );
    return sendSuccess(res, "Notification settings saved successfully", {
      settings,
    });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    await taskService.deleteTask(id, req.companyId);
    return sendSuccess(res, "Task deleted successfully");
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const sendTaskReminder = async (req, res) => {
  try {
    const { id } = req.params;
    await taskService.sendTaskReminder(id, req.user._id, req.companyId);
    return sendSuccess(res, "Reminder sent successfully");
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const getTodayTaskStats = async (req, res) => {
  try {
    const stats = await taskService.getTodayTaskStats(
      req.user._id,
      req.companyId,
      req.query?.companyId || null,
    );
    return sendSuccess(res, "Today's task stats retrieved successfully", stats);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getTodayAssignedTaskBreakdownForDigitalMarketing = async (req, res) => {
  try {
    const summary =
      await taskService.getTodayAssignedTaskBreakdownForDigitalMarketing(
        req.companyId,
        req.query?.companyId || null,
      );
    return sendSuccess(
      res,
      "Today's digital marketing task assignment summary retrieved successfully",
      { summary },
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const reopenTask = async (req, res) => {
  try {
    const task = await taskService.reopenTask(
      req.params.id,
      req.body,
      req.companyId,
      req.user._id,
    );
    return sendSuccess(res, "Correction task created successfully", { task });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

module.exports = {
  getAllTasks,
  getTasksDropdown,
  getTaskById,
  createTask,
  reopenTask,
  updateTask,
  holdTask,
  submitTask,
  validateTask,
  approveTask, // Legacy
  clientApproveTask,
  requestRework, // Legacy
  getTasksByProject,
  getTasksByDepartment,
  getScheduledNotes,
  createScheduledNote,
  getTasksForKanban,
  updateTaskStatusAndOrder,
  updateTasksOrder,
  addComment,
  getTaskComments,
  getTaskActivity,
  getWorkflowConfig,
  getAllWorkflowConfigs,
  createOrUpdateWorkflowConfig,
  getNotificationSettings,
  updateNotificationSettings,
  deleteTask,
  sendTaskReminder,
  updateScreenshot,
  getTodayTaskStats,
  getTodayAssignedTaskBreakdownForDigitalMarketing,
};
