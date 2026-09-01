const mongoose = require("mongoose");
const { recordTimerStop } = require('./task.timeHelper');
const Task = require("./task.model");
const { TaskActivity, TaskComment } = require("./taskInteraction.model");
const ScheduledNote = require("./scheduledNote.model");
const WorkflowConfig = require("./workflowConfig.model");
const Notification = require("./notification.model");
const NotificationSettings = require("./notificationSettings.model");
const CompanyNotificationSettings = require("./companyNotificationSettings.model");
const ClientCompany = require("../auth/user.model");
const Company = require("../auth/user.model");
const User = require("../auth/user.model");
const EventConfig = require("../integrations/eventConfig.model");
const whatsappService = require("../../utils/whatsapp.service");
const eventConfigService = { 
  getEventConfigByType: async (eventType, companyId) => {
    return await EventConfig.findOne({ eventType, companyId });
  },
  sendEventNotification: async (eventType, eventData, options) => {
    const { phone, channels, tenantCompanyId } = options;
    const result = {};
    try {
      if (channels.includes('whatsapp') && phone) {
        const config = await EventConfig.findOne({ eventType, companyId: tenantCompanyId });
        const whatsappIntegration = await Integration.findOne({ type: 'whatsapp', companyId: tenantCompanyId, isActive: true });
        
        const backendUrl = whatsappIntegration?.config?.backendUrl || process.env.WHATSAPP_API_URL || 'https://api.whatsapp.com/send'; // fallback or placeholder
        const apiToken = whatsappIntegration?.config?.apiToken || process.env.WHATSAPP_API_KEY || 'default-token';
        
        if (config?.whatsappTemplate?.enabled && backendUrl) {
          const variables = {};
          const mapping = config.whatsappTemplate.variableMapping || config.whatsappTemplate.variables;
          if (mapping) {
             Object.entries(mapping).forEach(([key, val]) => {
                variables[key] = eventData[val] || val;
             });
          }
          
          let templateName = config.whatsappTemplate.name || config.whatsappTemplate.templateId;
          const templateObj = whatsappIntegration?.config?.templates?.find(t => t.id === templateName || t.name === templateName);
          if (templateObj) {
            templateName = templateObj.name;
          }
          
          const fs = require('fs');
          fs.appendFileSync('whatsapp_debug.log', `[${new Date().toISOString()}] Sending WhatsApp to ${phone}. Template: ${templateName}, Variables: ${JSON.stringify(variables)}\n`);
          try {
            const res = await whatsappService.sendMessage(
              backendUrl,
              apiToken,
              phone,
              templateName,
              variables,
              { templateName }
            );
            fs.appendFileSync('whatsapp_debug.log', `[${new Date().toISOString()}] Success: ${JSON.stringify(res)}\n`);
            result.whatsapp = { success: true };
          } catch(e) {
            fs.appendFileSync('whatsapp_debug.log', `[${new Date().toISOString()}] Error: ${e.message}\n`);
            result.whatsapp = { success: false, error: e.message };
          }
        } else {
          result.whatsapp = { success: false, error: 'WhatsApp not configured properly' };
        }
      }
    } catch (err) {
      result.whatsapp = { success: false, error: err.message };
    }
    return result;
  }
};
const Integration = require("../integrations/integration.model");
const logger = require('./dummyLogger');
const config = require('./dummyConfig');
const { createTimelineEvent } = require('./dummyTimeline');
const {
  formatDateToIST,
  normalizeTaskDateFields,
} = require('./shimDateHelper');
const {
  buildQuery,
  executePaginatedQuery,
  formatPaginatedResponse,
} = require('./shimPagination');
const {
  buildDropdownQuery,
  executeDropdownQuery,
} = require('./shimDropdown');
const {
  resolveCompanyIntegrations,
} = require('./shimCompanyIntegrations');
const Department = require('./shimDepartmentModel');

const WEBSITE_COORDINATOR_DEPARTMENTS = [
  "website-designing",
  "web-application-development",
  "tech_team",
  "tech-team",
];

const ROLES_WITH_FULL_TASK_ACCESS = [
  "super_admin",
  "admin",
  "operations_head",
  "digital_marketing_manager",
  "digital_marketing_coordinator",
  "website_coordinator",
  "coordinator",
  "supreme_super_admin",
  "commander_admin",
  "agency_super_admin",
  "agency_manager",
  "agency_client",
  "client",
  "brand_super_admin",
  "brand_manager",
];

const toHyphenatedSlug = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getUserDepartmentSlug = async (user) => {
  if (!user) return null;

  // 1. Check if departmentId is populated and has a slug
  if (user.departmentId) {
    if (user.departmentId.slug) {
      return user.departmentId.slug;
    }
    const dept = await Department.findById(user.departmentId).select("slug");
    if (dept?.slug) return dept.slug;
  }

  // 2. Fallback to legacy team field
  if (user.team) {
    return toHyphenatedSlug(user.team);
  }

  return null;
};

const getDepartmentFilterValues = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "web-application-development" ||
    normalized === "tech_team" ||
    normalized === "tech-team" ||
    normalized === "web-app" ||
    normalized === "application" ||
    normalized === "development"
  ) {
    return [
      "web-application-development",
      "tech_team",
      "tech-team",
      "web-app",
      "application",
      "development",
    ];
  }

  return [value];
};

const buildDepartmentFilter = (value, userRole) => {
  const matchingValues = getDepartmentFilterValues(value).filter(Boolean);

  if (userRole === "website_coordinator") {
    const coordinatorValues = matchingValues.filter((entry) =>
      WEBSITE_COORDINATOR_DEPARTMENTS.includes(entry),
    );
    if (coordinatorValues.length === 0) return "__no_matching_department__";
    return coordinatorValues.length === 1
      ? coordinatorValues[0]
      : { $in: coordinatorValues };
  }

  if (matchingValues.length === 0) return value;
  return matchingValues.length === 1
    ? matchingValues[0]
    : { $in: matchingValues };
};

const enforceTaskNotificationChannelsByIntegration = (
  settingsDocLike,
  integrationConfig,
) => {
  if (!settingsDocLike || !integrationConfig) return settingsDocLike;

  const emailEnabled = Boolean(integrationConfig.email);
  const whatsappEnabled = Boolean(integrationConfig.whatsapp);
  const taskEvents = [
    "taskAssigned",
    "taskStatusChanged",
    "taskPriorityChanged",
    "taskDueDateReminder",
    "taskCommentAdded",
    "taskMentioned",
    "taskAttachmentAdded",
    "taskCompleted",
  ];

  taskEvents.forEach((key) => {
    if (!settingsDocLike[key]) return;
    if (!emailEnabled) {
      settingsDocLike[key].email = false;
    }
    if (!whatsappEnabled) {
      settingsDocLike[key].whatsapp = false;
    }
  });

  return settingsDocLike;
};

// Helper function to create and emit notification
const createAndEmitNotification = async (notificationData) => {
  const notification = await Notification.create(notificationData);

  // Populate and emit via Socket.IO
  try {
    const populatedNotification = await Notification.findById(
      notification._id,
    ).populate("taskId", "title status");
    const socketIO = require('./shimSocket');
    socketIO.emitNotification(
      notificationData.userId.toString(),
      populatedNotification,
    );
    logger.info(
      `In-app notification sent: ${notificationData.type} to user ${notificationData.userId}`,
    );
  } catch (error) {
    logger.error("Error emitting notification via Socket.IO:", error);
    // Don't fail if Socket.IO emission fails
  }

  return notification;
};

// Helper function to get client company IDs for a tenant
const getClientCompanyIds = async (tenantCompanyId) => {
  const clientCompanies = await ClientCompany.find({
    $or: [
      { agencyId: tenantCompanyId },
      { adminId: tenantCompanyId },
      { brandId: tenantCompanyId },
      { _id: tenantCompanyId }
    ]
  }).select("_id");
  const ids = clientCompanies.map((cc) => cc._id);
  ids.push(null); // Include null to match Own Brand tasks naturally in all $in queries
  return ids;
};

const parseScheduledNoteDate = (value) => {
  if (!value) return null;

  if (typeof value === "string" && value.length <= 10) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeKanbanRangeValue = (value, isEnd = false) => {
  if (!value) return null;

  let normalized = new Date(value);
  if (Number.isNaN(normalized.getTime())) {
    return null;
  }

  if (typeof value === "string" && value.length <= 10) {
    normalized.setUTCHours(
      isEnd ? 23 : 0,
      isEnd ? 59 : 0,
      isEnd ? 59 : 0,
      isEnd ? 999 : 0,
    );
  }

  return Number.isNaN(normalized.getTime()) ? null : normalized;
};

const buildInProgressScopeQuery = (scope = {}) => {
  const {
    boardStartDate = null,
    boardEndDate = null,
    boardDateField = null,
  } = scope;

  if (
    !boardStartDate ||
    !boardEndDate ||
    boardDateField !== "assignedOrStartDate"
  ) {
    return null;
  }

  const start = normalizeKanbanRangeValue(boardStartDate, false);
  const end = normalizeKanbanRangeValue(boardEndDate, true);
  if (!start || !end) return null;

  return {
    $or: [
      { startDate: { $gte: start, $lte: end } },
      { dueDate: { $gte: start, $lte: end } },
    ],
  };
};

const buildInProgressConflictMessage = (blockingTask) => {
  if (!blockingTask) {
    return (
      "You already have another task in In Progress. Move it out of In " +
      "Progress before starting a new one."
    );
  }

  const title = blockingTask.title
    ? `"${blockingTask.title}"`
    : "another task";
  const projectName = blockingTask.projectId?.name
    ? ` in project "${blockingTask.projectId.name}"`
    : "";

  return (
    `${title} is already in In Progress${projectName}. ` +
    "Move it to Review, Done, or Hold before moving another task to In Progress."
  );
};

const ensureNoOtherInProgressTask = async (
  assignedUserId,
  excludedTaskId,
  tenantCompanyId,
  scope = {},
  targetTask = null,
  targetStatus = "in_progress"
) => {
  if (!assignedUserId) return;

  const query = {
    assignedTo: assignedUserId,
    status: { $in: ["in_progress", targetStatus] },
  };

  if (excludedTaskId) {
    query._id = { $ne: excludedTaskId };
  }

  let dateFilter = buildInProgressScopeQuery(scope);
  if (!dateFilter && targetTask) {
    const taskDate = targetTask.startDate || targetTask.dueDate || new Date();
    dateFilter = buildInProgressScopeQuery({
      boardStartDate: taskDate,
      boardEndDate: taskDate,
      boardDateField: "assignedOrStartDate"
    });
  }

  if (dateFilter && dateFilter.$or) {
    query.$or = dateFilter.$or;
  }

  // Find all in-progress tasks for this user
  const blockingTasks = await Task.find(query)
    .select("title projectId startDate dueDate")
    .populate("projectId", "name");

  if (!blockingTasks || blockingTasks.length === 0) {
    return;
  }

  // If there is ANY task currently in progress for this user, block them
  // from starting a new one, regardless of dates.
  throw new Error(buildInProgressConflictMessage(blockingTasks[0]));
};

const getScheduledNotes = async (tenantCompanyId, reqQuery = {}) => {
  const query = { companyId: tenantCompanyId };

  if (reqQuery.startDate || reqQuery.endDate) {
    query.scheduledDate = {};

    if (reqQuery.startDate) {
      const start = parseScheduledNoteDate(reqQuery.startDate);
      if (start) {
        start.setUTCHours(0, 0, 0, 0);
        query.scheduledDate.$gte = start;
      }
    }

    if (reqQuery.endDate) {
      const end = parseScheduledNoteDate(reqQuery.endDate);
      if (end) {
        end.setUTCHours(23, 59, 59, 999);
        query.scheduledDate.$lte = end;
      }
    }

    if (Object.keys(query.scheduledDate).length === 0) {
      delete query.scheduledDate;
    }
  }

  return ScheduledNote.find(query)
    .populate("createdBy", "name email role")
    .sort({ scheduledDate: 1, createdAt: -1 })
    .lean();
};

const createScheduledNote = async (noteData, tenantCompanyId, userId) => {
  const { scheduledDate, notes } = noteData;

  if (!scheduledDate) {
    throw new Error("Scheduled date is required");
  }

  if (!notes || !String(notes).trim()) {
    throw new Error("Notes are required");
  }

  const normalizedDate = parseScheduledNoteDate(scheduledDate);
  if (!normalizedDate) {
    throw new Error("Valid scheduled date is required");
  }
  normalizedDate.setUTCHours(0, 0, 0, 0);

  const scheduledNote = await ScheduledNote.create({
    companyId: tenantCompanyId,
    scheduledDate: normalizedDate,
    notes: String(notes).trim(),
    createdBy: userId,
  });

  return ScheduledNote.findById(scheduledNote._id)
    .populate("createdBy", "name email role")
    .lean();
};

const getAllTasks = async (
  tenantCompanyId,
  reqQuery = {},
  userRole = null,
  userId = null,
) => {
  // Get all client companies for this tenant
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);
  const isGlobalAdmin = ["supreme_super_admin"].includes(userRole);

  // Role-based filtering: Only super_admin and admin can see all tasks.
  // All other roles (including coordinators, managers) only see tasks
  // where they are assignedTo or listed in the watchers array.
  const additionalFilters = {};
  if (!isGlobalAdmin) {
    additionalFilters.tenantCompanyId = { $in: [tenantCompanyId, ...clientCompanyIds] };
  }
  const userObjId =
    userId && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;
  const restrictToOwnAssignedTasks = !ROLES_WITH_FULL_TASK_ACCESS.includes(userRole);

  // ----------------------------------------------------
  // CREATOR-BASED TASK ISOLATION
  // ----------------------------------------------------
  if (userId && userRole && !restrictToOwnAssignedTasks && !['client', 'agency_client', 'brand_super_admin', 'brand_manager'].includes(userRole)) {
    const currentUser = await User.findById(userId);
    let allowedCreatorRoles = [];

    if (userRole === 'commander_admin') {
      allowedCreatorRoles = ['commander_admin'];
    } else if (userRole === 'agency_manager') {
      allowedCreatorRoles = ['agency_manager', 'agency_client', 'client', 'coordinator', 'website_coordinator', 'digital_marketing_coordinator', 'digital_marketing_manager', 'operations_head', 'admin', 'user'];
    } else if (userRole === 'agency_client' || userRole === 'client') {
      allowedCreatorRoles = ['agency_manager', 'agency_super_admin', 'client', 'agency_client'];
    } else if (userRole === 'agency_super_admin') {
      allowedCreatorRoles = ['agency_super_admin', 'agency_manager', 'agency_client', 'client', 'coordinator', 'website_coordinator', 'digital_marketing_coordinator', 'digital_marketing_manager', 'operations_head', 'admin', 'user'];
    } else if (userRole === 'brand_manager' || userRole === 'brand_super_admin') {
      allowedCreatorRoles = [userRole, 'brand_manager', 'brand_super_admin'];
    } else {
      allowedCreatorRoles = [userRole];
    }

    const creatorMatchQuery = { role: { $in: allowedCreatorRoles } };
    if (currentUser?.agencyId) {
      creatorMatchQuery.agencyId = currentUser.agencyId;
    }
    if (currentUser?.brandId) {
      creatorMatchQuery.brandId = currentUser.brandId;
    }

    const allowedCreatorIds = await User.find(creatorMatchQuery).distinct('_id');
    additionalFilters.createdBy = { $in: allowedCreatorIds };
  }
  // ----------------------------------------------------
  if (userRole === "website_coordinator") {
    additionalFilters.$or = [
      { department: { $in: WEBSITE_COORDINATOR_DEPARTMENTS } },
      { assignedTo: userObjId },
      { watchers: userObjId },
    ];
  } else if (['client', 'agency_client', 'brand_super_admin', 'brand_manager'].includes(userRole) && userId) {
    // Strict isolation for clients: only their own company data
    const user = await User.findById(userId).select("clientId");
    if (user && user.clientId) {
      additionalFilters.companyId = user.clientId;
    } else {
      // If no clientId linked, fallback to user ID as they are likely the client company itself
      additionalFilters.companyId = userObjId;
    }
  } else if (restrictToOwnAssignedTasks) {
    // Regular assignee roles should only see tasks explicitly assigned to them, created by them, or watched by them.
    console.log(`[taskService.getAllTasks] Visibility DEBUG:`, {
      userId: userId,
      userRole: userRole,
      assignedTo: userObjId?.toString?.() || userObjId,
    });
    additionalFilters.$or = [
      { assignedTo: userObjId },
      { createdBy: userObjId },
      { watchers: userObjId },
    ];
  }

  if (reqQuery.status) additionalFilters.status = reqQuery.status;

  if (reqQuery.status) additionalFilters.status = reqQuery.status;
  if (reqQuery.companyId) additionalFilters.companyId = reqQuery.companyId;
  if (reqQuery.department) {
    let deptValue = reqQuery.department;
    if (mongoose.Types.ObjectId.isValid(deptValue)) {
      const dept = await Department.findById(deptValue).select("slug");
      if (dept) deptValue = dept.slug;
    }
    additionalFilters.department = buildDepartmentFilter(deptValue, userRole);
  }
  if (reqQuery.projectId) additionalFilters.projectId = reqQuery.projectId;
  if (reqQuery.priority) additionalFilters.priority = reqQuery.priority;
  if (reqQuery.taskCategory)
    additionalFilters.taskCategory = reqQuery.taskCategory;
  if (reqQuery.validationStatus)
    additionalFilters.validationStatus = reqQuery.validationStatus;

  // Handle Assigned To filter (including unassigned)
  // IMPORTANT: If assignedTo filter is applied, it overrides the role-based $or to avoid conflicts
  if (!restrictToOwnAssignedTasks) {
    if (reqQuery.assignedTo === "unassigned") {
      // Apply unassigned filter without deleting $or visibility constraints.
      additionalFilters.assignedTo = { $in: [null, undefined] };
    } else if (reqQuery.assignedTo) {
      // Apply assignedTo filter. We do NOT delete $or here because $or contains
      // essential visibility constraints (watchers, department visibility) for non-admin users.
      // Mongoose will naturally AND this filter with the existing $or constraints.
      additionalFilters.assignedTo = mongoose.Types.ObjectId.isValid(
        reqQuery.assignedTo,
      )
        ? new mongoose.Types.ObjectId(reqQuery.assignedTo)
        : reqQuery.assignedTo;
    }
  }

  // Handle Date Range Filters
  if (reqQuery.startDate || reqQuery.endDate || reqQuery.dueDate) {
    const dateField = reqQuery.dateField || "dueDate";
    const dateQuery = {};

    let startDateVal = reqQuery.startDate || reqQuery.dueDate;
    let endDateVal = reqQuery.endDate || reqQuery.dueDate;

    const start = new Date(startDateVal);
    const end = new Date(endDateVal);

    console.log("[taskService.getAllTasks] Params:", {
      startDateVal,
      endDateVal,
      dateField,
      start,
      end,
    });

    if (startDateVal && !isNaN(start.getTime())) {
      if (typeof startDateVal === "string" && startDateVal.length <= 10) {
        start.setUTCHours(0, 0, 0, 0);
      }
      dateQuery.$gte = start;
    }

    if (endDateVal && !isNaN(end.getTime())) {
      if (typeof endDateVal === "string" && endDateVal.length <= 10) {
        end.setUTCHours(23, 59, 59, 999);
      } else if (start.getTime() === end.getTime()) {
        // If start and end are exactly the same millisecond (e.g., from a single date picker), 
        // expand the end date to cover the next 24 hours to capture all events for that local day.
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      }
      dateQuery.$lte = end;
    }
    if (Object.keys(dateQuery).length > 0) {
      const dateOrFilter = [
        {
          $or: [
            // Option A: Task has a defined range (startDate to dueDate)
            {
              $and: [
                { startDate: { $ne: null, $exists: true } },
                { startDate: { $lte: end } },
                { dueDate: { $gte: start } },
                // If completed early, don't show on days after completion
                {
                  $or: [
                    { actualCompletionDate: { $exists: false } },
                    { actualCompletionDate: { $eq: null } },
                    { actualCompletionDate: { $gte: start } },
                  ],
                },
              ],
            },
            // Option B: Task only has dueDate (show from createdAt to dueDate)
            {
              $and: [
                {
                  $or: [
                    { startDate: { $eq: null } },
                    { startDate: { $exists: false } },
                  ],
                },
                { createdAt: { $lte: end } },
                { dueDate: { $gte: start } },
                // If completed early, don't show on days after completion
                {
                  $or: [
                    { actualCompletionDate: { $exists: false } },
                    { actualCompletionDate: { $eq: null } },
                    { actualCompletionDate: { $gte: start } },
                  ],
                },
              ],
            },
            // Option C: Task was actually completed/validated in this range
            { actualCompletionDate: { $gte: start, $lte: end } },
            { validatedAt: { $gte: start, $lte: end } },
            // Option D: Task was created in this range and has no dueDate (newly created tasks)
            {
              $and: [
                { createdAt: { $gte: start, $lte: end } },
                {
                  $or: [
                    { dueDate: { $exists: false } },
                    { dueDate: { $eq: null } },
                  ],
                },
              ],
            },
          ],
        },
      ];

      // If role-based $or already exists, combine with $and to preserve both constraints
      if (additionalFilters.$or) {
        additionalFilters.$and = [
          { $or: additionalFilters.$or },
          { $or: dateOrFilter[0].$or },
        ];
        delete additionalFilters.$or;
      } else {
        additionalFilters.$or = dateOrFilter[0].$or;
      }
    }
  }

  // Handle search query separately to avoid $or conflicts
  // If we have $or in additionalFilters (for watchers), we need to combine it with search properly
  const hasSearch = reqQuery.search || reqQuery.q;
  const searchFields = ["title", "description"];

  console.log(
    `[taskService.getAllTasks] Final Filters DEBUG:`,
    JSON.stringify(additionalFilters, null, 2),
  );

  // Build query with pagination, search, and sort
  const queryOptions = buildQuery(reqQuery, {
    searchFields: hasSearch && additionalFilters.$or ? [] : searchFields, // Skip search in buildQuery if we have $or
    defaultSortField: "createdAt",
    defaultSortOrder: "desc",
    additionalFilters,
  });

  // If we have both $or (for watchers) and search, combine them with $and
  if (hasSearch && additionalFilters.$or && searchFields.length > 1) {
    const search = reqQuery.search || reqQuery.q || "";
    const searchRegex = { $regex: search, $options: "i" };
    const searchOr = {
      $or: searchFields.map((field) => ({
        [field]: searchRegex,
      })),
    };

    // Combine $or conditions with $and
    queryOptions.filters = {
      ...queryOptions.filters,
      $and: [{ $or: additionalFilters.$or }, searchOr],
    };
    // Remove the standalone $or since we're using $and now
    delete queryOptions.filters.$or;
  } else if (hasSearch && additionalFilters.$or && searchFields.length === 1) {
    // Single search field - no $or needed, just add it directly
    const search = reqQuery.search || reqQuery.q || "";
    const searchRegex = { $regex: search, $options: "i" };
    queryOptions.filters[searchFields[0]] = searchRegex;
  }

  // Execute paginated query with populate
  return await executePaginatedQuery(Task, queryOptions, [
    { path: "companyId", select: "name email phone address" },
    {
      path: "projectId",
      select:
        "name status numberOfPosters remainingPosters completedPosters numberOfVideos remainingVideos completedVideos numberOfShoots remainingShoots completedShoots selectedCategories",
    },
    { path: "assignedTo", select: "name email role" },
    { path: "assignedBy", select: "name email" },
    { path: "validatedBy", select: "name email" },
    { path: "createdBy", select: "name email profileImage" },
    { path: "updatedBy", select: "name email profileImage" },
    { path: "watchers", select: "name email avatar" },
  ]);
};

// Dropdown query for tasks
const getTasksDropdown = async (
  tenantCompanyId,
  reqQuery = {},
  userRole = null,
  userId = null,
) => {
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);
  const isGlobalAdmin = ["supreme_super_admin"].includes(userRole);

  const additionalFilters = {};
  if (!isGlobalAdmin) {
    additionalFilters.tenantCompanyId = { $in: [tenantCompanyId, ...clientCompanyIds] };
    additionalFilters.companyId = { $in: clientCompanyIds };
  }
  const userObjId =
    userId && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;
  const restrictToOwnAssignedTasks = false;

  if (userRole === "website_coordinator") {
    additionalFilters.department = { $in: WEBSITE_COORDINATOR_DEPARTMENTS };
  } else if (restrictToOwnAssignedTasks) {
    additionalFilters.assignedTo = userObjId;
  }

  if (reqQuery.status) additionalFilters.status = reqQuery.status;
  if (reqQuery.projectId) additionalFilters.projectId = reqQuery.projectId;
  if (reqQuery.department) {
    additionalFilters.department =
      userRole === "website_coordinator"
        ? WEBSITE_COORDINATOR_DEPARTMENTS.includes(reqQuery.department)
          ? reqQuery.department
          : "__no_matching_department__"
        : reqQuery.department;
  }

  const queryOptions = buildDropdownQuery(reqQuery, {
    searchFields: ["title"],
    defaultSortField: "title",
    defaultSortOrder: "asc",
    additionalFilters,
  });

  return await executeDropdownQuery(
    Task,
    queryOptions,
    { path: "projectId", select: "name" },
    "title status projectId",
  );
};

const getTaskById = async (
  taskId,
  tenantCompanyId,
  userRole = null,
  userId = null,
) => {
  const isGlobalAdmin = ["supreme_super_admin"].includes(userRole);

  // Get all client companies for this tenant
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  let taskQuery;
  if (isGlobalAdmin) {
    taskQuery = Task.findById(taskId);
  } else {
    taskQuery = Task.findOne({
      _id: taskId,
      tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
      companyId: { $in: clientCompanyIds },
    });
  }

  const task = await taskQuery
    .populate("companyId", "name email phone address")
    .populate("projectId", "name status description")
    .populate("assignedTo", "name email role avatar")
    .populate("assignedBy", "name email")
    .populate("validatedBy", "name email")
    .populate("createdBy", "name email profileImage")
    .populate("updatedBy", "name email profileImage")
    .populate("watchers", "name email avatar");

  if (!task) {
    throw new Error("Task not found");
  }

  // Apply role-based data filtering: Strict isolation for clients
  if (['client', 'agency_client', 'brand_super_admin', 'brand_manager'].includes(userRole) && userId) {
    const user = await User.findById(userId).select("clientId");
    
    // The user's company is either their linked clientId, or their own userId (if they are the client company)
    const userCompanyId = user?.clientId ? user.clientId.toString() : userId.toString();

    // Use both clientId (legacy) and companyId (ClientCompany ref) for check
    const taskClientRef = task.companyId?._id || task.companyId;
    const taskClientIdLegacy = task.clientId?._id || task.clientId;

    const isAuthorized =
      (taskClientRef && taskClientRef.toString() === userCompanyId) ||
      (taskClientIdLegacy && taskClientIdLegacy.toString() === userCompanyId);

    if (!isAuthorized) {
      throw new Error(
        "Access denied: You can only view tasks for your own company",
      );
    }
  }

  return task;
};

// Create Notification
const createNotification = async (type, userId, message, link) => {
  try {
    const Notification = require("./notification.model");
    await Notification.create({
      user: userId,
      type,
      message,
      link,
    });
  } catch (error) {
    logger.error("Error creating notification:", error);
  }
};

const updateProjectCompletedCount = async (projectId, taskServiceType, increment) => {
  if (!projectId || !taskServiceType) return;
  try {
    const Project = require('./shimProjectModel');
    const project = await Project.findById(projectId);
    if (!project) return;

    const standardTypes = ["poster", "video", "shoot"];

    if (standardTypes.includes(taskServiceType)) {
      if (taskServiceType === "poster") {
        project.completedPosters = Math.max(0, (project.completedPosters || 0) + increment);
      } else if (taskServiceType === "video") {
        project.completedVideos = Math.max(0, (project.completedVideos || 0) + increment);
      } else if (taskServiceType === "shoot") {
        project.completedShoots = Math.max(0, (project.completedShoots || 0) + increment);
      }
    } else {
      const catIndex = (project.selectedCategories || []).findIndex(
        (c) => c.name === taskServiceType || c.categoryName === taskServiceType,
      );
      if (catIndex > -1) {
        project.selectedCategories[catIndex].completed = Math.max(0, (project.selectedCategories[catIndex].completed || 0) + increment);
        project.markModified("selectedCategories");
      }
    }
    await project.save();
  } catch (err) {
    logger.error("Error updating project completed count:", err);
  }
};

const createTask = async (taskData, tenantCompanyId, createdByUserId) => {
  const agencyCompanyId = tenantCompanyId;
  const User = require("../auth/user.model");
  const creator = await User.findById(createdByUserId).select("role clientId brandId");
  const isGlobalAdmin = creator && ["supreme_super_admin"].includes(creator.role);

  // Auto-assign companyId if missing and the creator is a client/brand user
  if (!taskData.companyId && creator && ['client', 'agency_client', 'brand_super_admin', 'brand_manager'].includes(creator.role)) {
    taskData.companyId = creator.clientId || creator.brandId || createdByUserId;
  }

  // Verify that the client company belongs to the tenant company if provided
  let clientCompany = null;
  if (taskData.companyId) {
    if (isGlobalAdmin) {
      clientCompany = await ClientCompany.findById(taskData.companyId);
    } else {
      clientCompany = await ClientCompany.findOne({
        _id: taskData.companyId,
        $or: [
          { agencyId: tenantCompanyId },
          { adminId: tenantCompanyId },
          { brandId: tenantCompanyId },
          { _id: tenantCompanyId }
        ]
      });
    }

    if (!clientCompany) {
      throw new Error(
        "Client company not found or does not belong to your organization",
      );
    }
    
    // Override tenantCompanyId so tasks created for a sub-company by an admin are scoped to the sub-company
    if (
      isGlobalAdmin ||
      ['commander_admin', 'agency_super_admin', 'agency_manager'].includes(creator?.role)
    ) {
      tenantCompanyId = taskData.companyId;
    }
  }

  // If task is linked to a project, verify project is approved before allowing assignment
  if (taskData.projectId) {
    const Project = require('./shimProjectModel');
    const project = await Project.findById(taskData.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    // Allow task assignment if project is created or workflow is approved
    const allowedStatuses = [
      "created",
      "workflow_approved",
      "in_progress",
      "completed",
      "project_near_due_date",
    ];
    if (taskData.assignedTo && !allowedStatuses.includes(project.status)) {
      throw new Error(
        `Cannot assign tasks until project workflow is approved. Current project status: ${project.status}`,
      );
    }

    // Validate service availability against the project's actual assigned tasks.
    // We reconcile counts after the task is saved to keep legacy and dynamic
    // deliverable trackers in sync.
    if (taskData.serviceType) {
      const {
        getProjectServiceCapacity,
        projectSupportsServiceType,
      } = require('./shimProjectService');
      const serviceCapacity = await getProjectServiceCapacity(
        taskData.projectId,
        tenantCompanyId,
        taskData.serviceType,
      );

      const capacityProject = serviceCapacity.project || project;
      if (!projectSupportsServiceType(capacityProject, taskData.serviceType)) {
        throw new Error(
          `Service "${taskData.serviceType}" is not configured for project "${project.name}".`,
        );
      }

      if (serviceCapacity.remaining <= 0) {
        throw new Error(
          `No ${taskData.serviceType} remaining in project "${project.name}". Total: ${serviceCapacity.total || 0}`,
        );
      }

      taskData.serviceSequenceNumber = (serviceCapacity.assigned || 0) + 1;

      logger.info(
        `Prepared ${taskData.serviceType} assignment for project ${project._id}. Sequence: ${taskData.serviceSequenceNumber}`,
      );
    }
  }

  // Set initial status based on resolved workflow config if available, fallback to 'to_do'
  let initialStatus = taskData.status || "to_do";

  // Tasks should not start on 'created', 'backlog' (Hold), or 'hold' status
  if (
    initialStatus === "created" ||
    initialStatus === "backlog" ||
    initialStatus === "hold"
  ) {
    initialStatus = "to_do";
  }

  try {
    let workflowConfig = null;
    if (taskData.projectId) {
      const projectId = taskData.projectId._id || taskData.projectId;
      workflowConfig = await getWorkflowConfig(
        projectId ? projectId.toString() : null,
        tenantCompanyId,
        null,
      );
    } else if (taskData.department) {
      workflowConfig = await getWorkflowConfig(
        null,
        tenantCompanyId,
        taskData.department,
      );
    }

    if (
      workflowConfig &&
      workflowConfig.statuses &&
      workflowConfig.statuses.length > 0
    ) {
      const statuses = workflowConfig.statuses;

      // If client requested a specific status, verify it exists in the workflow config
      const requestedStatusExists = statuses.some((s) => s.id === taskData.status);

      if (
        taskData.status &&
        requestedStatusExists &&
        taskData.status !== "backlog" &&
        taskData.status !== "hold"
      ) {
        initialStatus = taskData.status;
      } else {
        // Find status with lowest order that is not backlog/hold
        const sortedStatuses = [...statuses].sort((a, b) => a.order - b.order);
        const activeStartStatus = sortedStatuses.find(
          (s) => s.id !== "backlog" && s.id !== "hold"
        );
        if (activeStartStatus && activeStartStatus.id) {
          initialStatus = activeStartStatus.id;
        } else if (sortedStatuses[0] && sortedStatuses[0].id) {
          initialStatus = sortedStatuses[0].id;
        }
      }
    }
  } catch (err) {
    logger.error("Error determining initial status from workflow config:", err);
  }

  // Clean task data - remove null/undefined/empty string values for optional enum fields
  const cleanedTaskData = { ...taskData };
  if (
    cleanedTaskData.type === null ||
    cleanedTaskData.type === undefined ||
    cleanedTaskData.type === ""
  ) {
    delete cleanedTaskData.type;
  }
  if (
    cleanedTaskData.postingPlatform === null ||
    cleanedTaskData.postingPlatform === undefined ||
    cleanedTaskData.postingPlatform === ""
  ) {
    delete cleanedTaskData.postingPlatform;
  }
  if (
    cleanedTaskData.clientReviewStatus === null ||
    cleanedTaskData.clientReviewStatus === undefined ||
    cleanedTaskData.clientReviewStatus === ""
  ) {
    delete cleanedTaskData.clientReviewStatus;
  }
  if (
    cleanedTaskData.serviceType === null ||
    cleanedTaskData.serviceType === undefined ||
    cleanedTaskData.serviceType === ""
  ) {
    delete cleanedTaskData.serviceType;
  }

  normalizeTaskDateFields(cleanedTaskData);

  // Fetch assigned user's phone number if a user is assigned
  if (cleanedTaskData.assignedTo) {
    const assignedUser = await User.findById(cleanedTaskData.assignedTo).select('phone');
    if (assignedUser && assignedUser.phone) {
      cleanedTaskData.assignedUserPhone = assignedUser.phone;
    }
  }

  const task = await Task.create({
    ...cleanedTaskData,
    tenantCompanyId,
    status: initialStatus,
    assignedBy: createdByUserId || taskData.assignedBy,
    createdBy: createdByUserId,
  });

  if (task.projectId && task.serviceType) {
    const {
      reconcileProjectTaskCounts,
      checkAndMarkProjectCompleted,
    } = require('./shimProjectService');
    const projectId = task.projectId._id || task.projectId;
    await reconcileProjectTaskCounts(projectId, tenantCompanyId);
    await checkAndMarkProjectCompleted(
      projectId,
      createdByUserId,
      tenantCompanyId,
    );

    logger.info(
      `Reconciled deliverable counts for project ${projectId} after creating task ${task._id}.`,
    );
  }

  // Dispatch system notification for task creation
  const { dispatchSystemNotification } = require('./notification.service');
  if (tenantCompanyId) {
    let creatorName = 'System';
    if (createdByUserId) {
      const creator = await User.findById(createdByUserId).select('name');
      if (creator) {
        creatorName = creator.name;
      }
    }
    await dispatchSystemNotification(
      tenantCompanyId,
      'taskCreated',
      'task_created',
      'New Task Created',
      `Task "${task.title}" has been created by ${creatorName}.`,
      { taskId: task._id }
    );
  }

  // Log activity
  if (createdByUserId) {
    await logTaskActivity(task._id, createdByUserId, "created", {
      description: "Task created",
    });
  }

  // Create assignment notification if assigned
  if (taskData.assignedTo && createdByUserId) {
    const Notification = require("./notification.model");
    const NotificationSettings = require("./notificationSettings.model");

    logger.info(
      `Task assigned: Task "${taskData.title}" (${task._id}) assigned to user ${taskData.assignedTo} by ${createdByUserId}`,
    );

    const assignedUser = await User.findById(taskData.assignedTo);
    if (!assignedUser) {
      logger.warn(
        `Assigned user ${taskData.assignedTo} not found, skipping notifications`,
      );
    } else {
      const assignedByUser = await User.findById(createdByUserId);
      const company = await ClientCompany.findById(taskData.companyId);

      // Get company-level notification settings (primary source)
      let companySettings = await CompanyNotificationSettings.findOne({
        companyId: agencyCompanyId,
      });

      // If company settings don't exist, create default ones
      if (!companySettings) {
        companySettings = await CompanyNotificationSettings.create({
          companyId: agencyCompanyId,
        });
        logger.info(
          `Created default company notification settings for company ${agencyCompanyId}`,
        );
      }

      // Get user-level settings (optional overrides - currently not used, but kept for future)
      // For now, we use company settings only
      // const userSettings = await NotificationSettings.findOne({
      //   userId: taskData.assignedTo,
      //   tenantCompanyId,
      // });

      // Check event configuration to see if WhatsApp/Email are configured at system level
      const eventConfig =
        await eventConfigService.getEventConfigByType("task_assigned", agencyCompanyId);

      // Check WhatsApp integration availability
      const whatsappIntegration = await Integration.findOne({
        type: "whatsapp",
        companyId: agencyCompanyId,
        isActive: true,
      });
      const whatsappIntegrationConfigured = !!(
        whatsappIntegration?.config?.backendUrl &&
        whatsappIntegration?.config?.apiToken
      );

      const hasEnvConfig = !!(
        config.WHATSAPP_API_URL && config.WHATSAPP_API_KEY
      );
      const isWhatsappConfigured =
        whatsappIntegrationConfigured || hasEnvConfig;

      const whatsappEventEnabled =
        eventConfig?.isActive &&
        eventConfig?.whatsappTemplate?.enabled &&
        isWhatsappConfigured;
      const emailIntegration = await Integration.findOne({
        type: "email",
        companyId: agencyCompanyId,
        isActive: true,
      });
      const emailIntegrationConfigured = !!(
        emailIntegration?.config?.clientId &&
        emailIntegration?.config?.clientSecret
      );

      const emailEventEnabled =
        eventConfig?.isActive &&
        eventConfig?.emailTemplate?.enabled &&
        emailIntegrationConfigured;

      logger.info(
        `Event configuration check for task_assigned: isActive=${eventConfig?.isActive}, whatsappTemplate.enabled=${eventConfig?.whatsappTemplate?.enabled}, whatsappIntegration.configured=${whatsappIntegrationConfigured}, emailTemplate.enabled=${eventConfig?.emailTemplate?.enabled}, emailIntegration.configured=${emailIntegrationConfigured}`,
      );

      // Use company settings (not user settings)
      const inAppEnabled =
        companySettings?.taskAssigned?.inApp !== undefined
          ? companySettings.taskAssigned.inApp
          : true; // Default to true
      const emailEnabled =
        (companySettings?.taskAssigned?.email || false) && emailEventEnabled;
      const whatsappEnabled =
        (companySettings?.taskAssigned?.whatsapp || false) &&
        whatsappEventEnabled;

      logger.info(
        `Company notification settings for company ${agencyCompanyId} (user ${assignedUser.email}): inApp=${inAppEnabled}, email=${emailEnabled} (company=${companySettings?.taskAssigned?.email || false}, event=${emailEventEnabled}), whatsapp=${whatsappEnabled} (company=${companySettings?.taskAssigned?.whatsapp || false}, event=${whatsappEventEnabled})`,
      );

      // Create in-app notification (based on company settings)
      if (inAppEnabled) {
        try {
          await createAndEmitNotification({
            userId: taskData.assignedTo,
            taskId: task._id,
            type: "task_assigned",
            title: "Task Assigned",
            message: `You have been assigned to task "${taskData.title}"`,
          });
          logger.info(
            `In-app notification created for task assignment: Task "${taskData.title}" to user ${assignedUser.email}`,
          );
        } catch (error) {
          logger.error(
            "Failed to create in-app notification for task assignment:",
            error,
          );
        }
      }

      // Send event notifications (email/WhatsApp) if enabled in both user settings AND event configuration
      const channels = [];
      if (emailEnabled) channels.push("email");
      if (whatsappEnabled) channels.push("whatsapp");

      if (channels.length > 0) {
        const eventData = {
          taskTitle: taskData.title,
          taskId: task._id.toString(),
          assignedToName: assignedUser.name || assignedUser.email,
          assignedByName:
            assignedByUser?.name || assignedByUser?.email || "System",
          dueDate: task.dueDate ? formatDateToIST(task.dueDate) : "Not set",
          priority: taskData.priority || "medium",
          companyName: company?.name || "Unknown Company",
        };

        logger.info(
          `Sending ${channels.join(", ")} notification(s) for task_assigned event to ${assignedUser.email} (phone: ${assignedUser.phone || "N/A"})`,
        );

        try {
          const result = await eventConfigService.sendEventNotification(
            "task_assigned",
            eventData,
            {
              to: assignedUser.email,
              phone: assignedUser.phone,
              channels: channels,
              tenantCompanyId: agencyCompanyId,
            },
          );

          if (result.whatsapp?.success) {
            logger.info(
              `✅ WhatsApp notification sent successfully for task_assigned: Task "${taskData.title}" to ${assignedUser.email} (phone: ${assignedUser.phone})`,
            );
          } else if (channels.includes("whatsapp")) {
            logger.warn(
              `⚠️ WhatsApp notification failed for task_assigned: ${result.whatsapp?.error || result.whatsapp?.message || "Unknown error"} - Task "${taskData.title}" to ${assignedUser.email}`,
            );
          }

          if (result.email?.success) {
            logger.info(
              `✅ Email notification sent successfully for task_assigned: Task "${taskData.title}" to ${assignedUser.email}`,
            );
          } else if (channels.includes("email")) {
            logger.warn(
              `⚠️ Email notification failed for task_assigned: ${result.email?.message || "Unknown error"} - Task "${taskData.title}" to ${assignedUser.email}`,
            );
          }
        } catch (error) {
          // Log error but don't fail task creation
          logger.error(
            `Failed to send task_assigned event notification to ${assignedUser.email}:`,
            error,
          );
        }
      } else {
        // Provide detailed reason why notifications aren't being sent
        const reasons = [];
        if (!companySettings?.taskAssigned?.whatsapp && whatsappEventEnabled) {
          reasons.push("WhatsApp disabled in company notification settings");
        }
        if (!whatsappEventEnabled && companySettings?.taskAssigned?.whatsapp) {
          reasons.push(
            "WhatsApp not configured in event configuration (task_assigned) or integration not set up",
          );
        }
        if (!companySettings?.taskAssigned?.email && emailEventEnabled) {
          reasons.push("Email disabled in company notification settings");
        }
        if (!emailEventEnabled && companySettings?.taskAssigned?.email) {
          reasons.push(
            "Email not configured in event configuration (task_assigned) or integration not set up",
          );
        }
        if (!whatsappEventEnabled && !emailEventEnabled) {
          reasons.push(
            "No event configuration found or enabled for task_assigned, or integrations not configured",
          );
        }

        logger.info(
          `No email/WhatsApp notifications sent for user ${assignedUser.email} (task_assigned). Reasons: ${reasons.length > 0 ? reasons.join(", ") : "All notifications disabled in company settings"}`,
        );
      }
    }
  }

  // NEW: Update project status to in_progress if it was 'created'
  if (task.projectId) {
    const Project = require('./shimProjectModel');
    const project = await Project.findById(task.projectId);
    if (project && project.status === "created") {
      project.status = "in_progress";
      await project.save();
      logger.info(
        `Automated: Project ${project._id} status changed to in_progress due to task creation.`,
      );

      // Log timeline event for project started
      try {
        await createTimelineEvent({
          eventType: "project_started",
          entityType: "Project",
          entityId: project._id,
          performedByUserId: createdByUserId,
          description: `Project "${project.name}" started automatically as first task was created`,
          metadata: {
            projectId: project._id.toString(),
            projectName: project.name,
            previousStatus: "created",
            currentStatus: "in_progress",
            taskId: task._id.toString(),
          },
          companyId: tenantCompanyId,
        });
      } catch (timelineError) {
        logger.error(
          `[Task Service] Failed to create timeline event for automated project start:`,
          timelineError,
        );
      }
    }
  }

  return await getTaskById(task._id, tenantCompanyId, isGlobalAdmin ? creator.role : null);
};

/**
 * Reopen a completed Website Designing task by creating a new correction task.
 * The new task is cloned from the original but with:
 * - A "Correction: " prefix on the title
 * - The provided taskCategory (Internal Correction / Client Correction / Hosting)
 * - The provided correctionDetails as its description
 * - Status set to 'assigned' (To Do in Kanban)
 */
const reopenTask = async (
  taskId,
  reopenData,
  tenantCompanyId,
  reopenedByUserId,
) => {
  const { reopenCategory, correctionDetails, dueDate } = reopenData;

  if (!reopenCategory) throw new Error("Correction category is required");
  if (!correctionDetails || !String(correctionDetails).trim()) {
    throw new Error("Correction details are required");
  }
  if (!dueDate) throw new Error("Due date is required");

  const validCategories = [
    "Correction",
    "Redesign",
  ];
  if (!validCategories.includes(reopenCategory)) {
    throw new Error(
      `Invalid category. Must be one of: ${validCategories.join(", ")}`,
    );
  }

  // Load the original task
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);
  const original = await Task.findOne({
    _id: taskId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    companyId: { $in: clientCompanyIds },
  });
  if (!original) throw new Error("Task not found");



  const completedStatuses = ["review", "in_review", "in review", "reviewing", "completed", "validated", "done", "complete"];
  if (!completedStatuses.includes(original.status)) {
    throw new Error("Only completed, validated, or review tasks can be reopened");
  }

  // Build new task data from original
  const newTaskTitle = `${reopenCategory}: ${original.title}`;

  const newTask = await Task.create({
    tenantCompanyId,
    companyId: original.companyId,
    projectId: original.projectId || undefined,
    title: newTaskTitle,
    description: String(correctionDetails).trim(),
    department: original.department,
    priority: original.priority || "medium",
    assignedTo: original.assignedTo || undefined,
    assignedBy: reopenedByUserId,
    createdBy: reopenedByUserId,
    watchers: original.watchers || [],
    labels: original.labels || [],
    taskCategory: reopenCategory, // Use specific correction type (Internal/Client/Hosting)
    status: original.assignedTo ? "assigned" : "created",
    startDate: new Date(),
    dueDate: new Date(dueDate),
    // Do NOT copy timing fields — fresh task
    parentTaskId: original._id,
  });

  // Log activity on new task
  await logTaskActivity(newTask._id, reopenedByUserId, "created", {
    description: `Correction task created from original task "${original.title}"`,
  });

  // Add a comment on the original task noting it was reopened
  await TaskComment.create({
    taskId: original._id,
    userId: reopenedByUserId,
    content: `🔁 Task reopened as a correction. Category: **${reopenCategory}**. Details: ${String(correctionDetails).trim()}`,
  });

  return await getTaskById(newTask._id, tenantCompanyId);
};

const updateTask = async (
  taskId,
  taskData,
  tenantCompanyId,
  updatedByUserId = null,
) => {
  const User = require("../auth/user.model");
  const updator = updatedByUserId ? await User.findById(updatedByUserId).select("role") : null;
  const isGlobalAdmin = updator && ["supreme_super_admin"].includes(updator.role);

  // Get all client companies for this tenant
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  let task;
  if (isGlobalAdmin) {
    task = await Task.findById(taskId);
  } else {
    task = await Task.findOne({
      _id: taskId,
      tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
      companyId: { $in: clientCompanyIds },
    });
  }

  if (!task) {
    throw new Error("Task not found");
  }

  // Allowed updates
  const allowedUpdates = [
    "title",
    "description",
    "holdReason",
    "department",
    "projectId",
    "priority",
    "dueDate",
    "startDate",
    "assignedTo",
    "status",
    "attachments",
    "timeSpent",
    "labels",
    "watchers",
    "order",
    "type",
    "postingPlatform",
    "clientReviewStatus",
    "taskType",
    "taskCategory",
    "requiresClientReview",
    "serviceType",
    "assignedUserPhone",
  ];

  // Track old values for notifications BEFORE updating
  const oldPriority = task.priority;
  const oldStatus = task.status;
  const oldAssignedTo = task.assignedTo ? task.assignedTo.toString() : null;

  // Track old values for counts adjustment
  const oldProjectId = task.projectId ? task.projectId.toString() : null;
  const oldDepartment = task.department;
  const oldServiceType = task.serviceType;

  // Clean optional enum fields - convert empty strings to undefined
  const cleanedTaskData = { ...taskData };
  if (
    cleanedTaskData.type === null ||
    cleanedTaskData.type === undefined ||
    cleanedTaskData.type === ""
  ) {
    cleanedTaskData.type = undefined;
  }
  if (
    cleanedTaskData.postingPlatform === null ||
    cleanedTaskData.postingPlatform === undefined ||
    cleanedTaskData.postingPlatform === ""
  ) {
    cleanedTaskData.postingPlatform = undefined;
  }
  if (
    cleanedTaskData.clientReviewStatus === null ||
    cleanedTaskData.clientReviewStatus === undefined ||
    cleanedTaskData.clientReviewStatus === ""
  ) {
    cleanedTaskData.clientReviewStatus = undefined;
  }
  if (
    cleanedTaskData.holdReason === null ||
    cleanedTaskData.holdReason === undefined
  ) {
    cleanedTaskData.holdReason = undefined;
  } else if (typeof cleanedTaskData.holdReason === "string") {
    cleanedTaskData.holdReason = cleanedTaskData.holdReason.trim();
  }
  if (
    cleanedTaskData.serviceType === null ||
    cleanedTaskData.serviceType === undefined ||
    cleanedTaskData.serviceType === ""
  ) {
    cleanedTaskData.serviceType = undefined;
  }

  normalizeTaskDateFields(cleanedTaskData);

  // Fetch new assigned user's phone number if assignment changed
  if (cleanedTaskData.assignedTo !== undefined && cleanedTaskData.assignedTo !== oldAssignedTo) {
    if (cleanedTaskData.assignedTo) {
      const assignedUser = await User.findById(cleanedTaskData.assignedTo).select('phone');
      cleanedTaskData.assignedUserPhone = assignedUser?.phone || null;
    } else {
      cleanedTaskData.assignedUserPhone = null;
    }
  }

  allowedUpdates.forEach((field) => {
    if (cleanedTaskData[field] !== undefined) {
      task[field] = cleanedTaskData[field];
    }
  });

  // Handle Service Type counts adjustment
  const newServiceType = task.serviceType;
  const newProjectId = task.projectId ? task.projectId.toString() : null;

  const countImpactChanged =
    oldProjectId !== newProjectId || oldServiceType !== newServiceType;

  if (countImpactChanged) {
    if (newProjectId && newServiceType) {
      const {
        getProjectServiceCapacity,
        projectSupportsServiceType,
      } = require('./shimProjectService');
      const serviceCapacity = await getProjectServiceCapacity(
        newProjectId,
        tenantCompanyId,
        newServiceType,
      );
      const newProject = serviceCapacity.project;
      if (!newProject) {
        throw new Error("Project not found for count adjustment");
      }

      if (!projectSupportsServiceType(newProject, newServiceType)) {
        throw new Error(
          `Service "${newServiceType}" is not configured for project "${newProject.name}".`,
        );
      }

      if (serviceCapacity.remaining <= 0) {
        throw new Error(
          `No ${newServiceType} remaining in project "${newProject.name}". Total: ${serviceCapacity.total || 0}`,
        );
      }

      task.serviceSequenceNumber = (serviceCapacity.assigned || 0) + 1;
      logger.info(
        `Prepared ${newServiceType} assignment for project ${newProjectId} due to task update. Sequence: ${task.serviceSequenceNumber}`,
      );
    } else if (!newServiceType) {
      // Clear sequence number if service type removed
      task.serviceSequenceNumber = undefined;
    }
  }

  // Set updatedBy
  if (updatedByUserId) {
    task.updatedBy = updatedByUserId;
  }

  // If assigning task, verify project is approved (if task is linked to a project)
  if (cleanedTaskData.assignedTo && task.projectId) {
    const Project = require('./shimProjectModel');
    const project = await Project.findById(task.projectId);

    if (project) {
      // Allow task assignment if project is created or workflow is approved
      const allowedStatuses = [
        "created",
        "workflow_approved",
        "in_progress",
        "completed",
        "project_near_due_date",
      ];
      if (!allowedStatuses.includes(project.status)) {
        throw new Error(
          `Cannot assign tasks until project workflow is approved. Current project status: ${project.status}`,
        );
      }
    }
  }

  // Handle Overdue and Completion Logic
  if (task.dueDate) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const taskDueDateEnd = new Date(task.dueDate);
    taskDueDateEnd.setUTCHours(23, 59, 59, 999);
    const isTaskOverdue = taskDueDateEnd < todayStart;
    const adminRoles = [
      "super_admin",
      "admin",
      "operations_head",
      "website_coordinator",
    ];
    const requesterRole = cleanedTaskData._requesterRole || null;

    // COMPLETION LOCK: Block non-admin users from editing tasks that are already completed
    const isCompleted = ["completed", "validated", "done", "complete"].includes(oldStatus);
    const isClientRole = ["agency_client", "brand_super_admin", "brand_manager", "brand_team_user", "client"].includes(requesterRole);

    if (isCompleted && !adminRoles.includes(requesterRole)) {
      throw new Error(
        "Completed tasks cannot be edited. Please contact an admin if changes are required.",
      );
    }

    // OVERDUE RESTRICTION: Only block non-admin users from marking an overdue task as COMPLETED
    const isMovingToCompleted =
      cleanedTaskData.status === "review" ||
      cleanedTaskData.status === "completed" ||
      cleanedTaskData.status === "done" ||
      cleanedTaskData.status === "validated" ||
      cleanedTaskData.status === "complete";

    if (
      isTaskOverdue &&
      isMovingToCompleted &&
      !adminRoles.includes(requesterRole) &&
      !isClientRole
    ) {
      throw new Error(
        "Overdue tasks cannot be marked as completed by non-admins. Please contact an admin to verify.",
      );
    }
  }

  // Status transition logic
  if (cleanedTaskData.status) {
    // Map Kanban statuses to actual task statuses
    const kanbanToTaskStatus = {
      backlog: "created",
      to_do: "assigned",
      in_progress: "in_progress",
      hold: "hold",
      review: "completed",
      Rejected: "rejected",
      done: "validated",
      // Also support direct task statuses
      created: "created",
      assigned: "assigned",
      hold: "hold",
      submitted: "submitted",
      rejected: "rejected",
      validated: "validated",
      completed: "completed",
    };

    const taskStatus =
      kanbanToTaskStatus[cleanedTaskData.status] || cleanedTaskData.status;

    // [BLOCK MULTIPLE IN PROGRESS TASKS FOR A SINGLE USER]
    if (taskStatus === "in_progress" && oldStatus !== "in_progress") {
      const assignedUserId =
        cleanedTaskData.assignedTo ||
        (task.assignedTo ? task.assignedTo.toString() : null);
      await ensureNoOtherInProgressTask(
        assignedUserId,
        task._id,
        tenantCompanyId,
        {
          boardStartDate: cleanedTaskData.boardStartDate || null,
          boardEndDate: cleanedTaskData.boardEndDate || null,
          boardDateField: cleanedTaskData.boardDateField || null,
        },
        task,
        taskStatus
      );
    }

    // [BLOCK DIGITAL MARKETING & WEBSITE DESIGNING TASKS FROM SKIPPING IN PROGRESS]
    if (
      (task.department === "digital-marketing" ||
        task.department === "website-designing") &&
      (oldStatus === "assigned" || oldStatus === "created") &&
      ["done", "completed", "validated"].includes(taskStatus) &&
      !["super_admin", "admin", "operations_head"].includes(
        cleanedTaskData._requesterRole,
      )
    ) {
      const deptLabel =
        task.department === "digital-marketing"
          ? "Digital Marketing"
          : "Website Designing";
      throw new Error(
        `${deptLabel} tasks must be moved to 'In Progress' before being completed.`,
      );
    }

    // Only coordinator/admin can approve Review -> Done (completed -> validated)
    if (
      task.department === "digital-marketing" &&
      task.status === "completed" &&
      taskStatus === "validated" &&
      ![
        "super_admin",
        "admin",
        "digital_marketing_coordinator",
        "coordinator",
      ].includes(cleanedTaskData._requesterRole)
    ) {
      throw new Error(
        "Only Digital Marketing Coordinator or Admin can move a task from Review to Done.",
      );
    }
    if (
      task.department === "digital-marketing" &&
      taskStatus === "validated" &&
      ![
        "super_admin",
        "admin",
        "digital_marketing_coordinator",
        "coordinator",
      ].includes(cleanedTaskData._requesterRole)
    ) {
      throw new Error(
        "Assigned users cannot move tasks to Done. Move In Progress to Review only.",
      );
    }

    // If assigning task, set status to 'assigned'
    if (cleanedTaskData.assignedTo && task.status === "created") {
      task.status = "assigned";
    } else {
      task.status = taskStatus;
    }

    // Hold requires a reason.
    if (task.status === "hold") {
      const reason = cleanedTaskData.holdReason || task.holdReason;
      if (!reason || !String(reason).trim()) {
        throw new Error("Hold reason is required when moving task to Hold.");
      }
      task.holdReason = String(reason).trim();
    }

    // ── [CUMULATIVE TIMING LOGIC] ──────────────────────────────────────────────
    const now = new Date();
    if (oldStatus === "in_progress" && task.status !== "in_progress") {
      if (task.workStartedAt) {
        const diffMs = now - task.workStartedAt;
        const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
        task.workDurationMinutes = (task.workDurationMinutes || 0) + diffMinutes;
        await recordTimerStop(task, diffMinutes, userId);
        task.workStartedAt = null;
        logger.info(
          `Timing (updateTask): Added ${diffMinutes}m to task ${task._id}. New total: ${task.workDurationMinutes}m`,
        );
      }
    }
    if (task.status === "in_progress" && oldStatus !== "in_progress") {
      task.workStartedAt = now;
      if (!task.startDate) task.startDate = now;
    }

    const wasCompletedStatus = ["completed", "validated", "done", "complete", "review", "in_review", "sent_for_client_review"].includes(oldStatus);
    const isNowCompletedStatus = ["completed", "validated", "done", "complete", "review", "in_review", "sent_for_client_review"].includes(taskStatus);
    
    if (wasCompletedStatus && task.status === "in_progress") {
      task.workStartedAt = new Date();
      task.workCompletedAt = null;
      task.actualCompletionDate = undefined;
      task.workDurationMinutes = null;
    } else if (wasCompletedStatus && (task.status === "assigned" || task.status === "to_do")) {
      task.workStartedAt = null;
      task.workCompletedAt = null;
      task.actualCompletionDate = undefined;
      task.workDurationMinutes = null;
    } else if (isNowCompletedStatus && !wasCompletedStatus) {
      task.workCompletedAt = now;
      task.actualCompletionDate = now;
    }

    // If starting work, set status to 'in_progress'
    if (taskStatus === "in_progress" && !task.startDate) {
      task.startDate = new Date();
    }
  }

  await task.save();

  // ── [UPDATE PROJECT COMPLETED COUNTS & SLAs] ───────────────────────────────────
  if (oldStatus !== task.status) {
    const completedStatuses = ["completed", "validated", "review", "in_review", "in review", "reviewing", "done", "complete"];
    const isNowCompleted = completedStatuses.includes(task.status);
    const wasPreviouslyCompleted = completedStatuses.includes(oldStatus);

    if (isNowCompleted && !wasPreviouslyCompleted) {
      await updateProjectCompletedCount(task.projectId, task.serviceType, 1);
      
      // Mark SLA as Resolved instead of deleting, to trigger Success metrics
      const SlaRecord = require('../sla/sla.model');
      const existingSla = await SlaRecord.findOne({ entityId: task._id, entityType: 'Task' });
      if (existingSla) {
        existingSla.status = 'Resolved';
        await existingSla.save();
      } else {
        // If no SLA existed (e.g., completed same day), create a Success record
        await SlaRecord.create({
          slaId: `SLA-TSK-${task._id.toString().substring(0, 8).toUpperCase()}`,
          clientId: task.companyId,
          agencyId: task.tenantCompanyId,
          clientType: task.taskType === 'own_brand' ? 'Agency' : 'Direct User Client',
          triggerType: 'Due Date',
          entityId: task._id,
          entityType: 'Task',
          title: `Task: ${task.title}`,
          description: `Task completed successfully.`,
          dueDate: task.dueDate || new Date(),
          priority: task.priority || 'Medium',
          status: 'Resolved',
          assignedTo: task.assignedTo
        });
      }
    } else if (!isNowCompleted && wasPreviouslyCompleted) {
      await updateProjectCompletedCount(task.projectId, task.serviceType, -1);
    }
  }

  const projectIdsToReconcile = [
    oldProjectId,
    newProjectId,
    task.projectId ? task.projectId.toString() : null,
  ].filter(Boolean);

  if (projectIdsToReconcile.length > 0) {
    const {
      reconcileProjectTaskCounts,
      checkAndMarkProjectCompleted,
    } = require('./shimProjectService');
    for (const projectId of [...new Set(projectIdsToReconcile)]) {
      await reconcileProjectTaskCounts(projectId, tenantCompanyId);
      await checkAndMarkProjectCompleted(
        projectId,
        updatedByUserId,
        tenantCompanyId,
      );
    }
  }

  // Check if assignment changed and send notifications
  if (cleanedTaskData.assignedTo !== undefined) {
    const newAssignedTo = task.assignedTo ? task.assignedTo.toString() : null;
    if (oldAssignedTo !== newAssignedTo) {
      logger.info(
        `Task assignment changed via updateTask: Task "${task.title}" (${task._id}) assigned from ${oldAssignedTo || "unassigned"} to ${newAssignedTo || "unassigned"}`,
      );

      // Notify new assignee if task was assigned
      if (newAssignedTo) {
        try {
          const assignedUser = await User.findById(newAssignedTo);
          if (assignedUser) {
            // Get company notification settings
            let companySettings = await CompanyNotificationSettings.findOne({
              companyId: tenantCompanyId,
            });

            // If company settings don't exist, create default ones
            if (!companySettings) {
              companySettings = await CompanyNotificationSettings.create({
                companyId: tenantCompanyId,
              });
            }
            const eventConfig =
              await eventConfigService.getEventConfigByType("task_assigned", tenantCompanyId);

            // Check if integrations are configured
            const whatsappIntegration =
              await require('./shimIntegrationService').getIntegrationByType(
                tenantCompanyId,
                "whatsapp",
              );
            const emailIntegration =
              await require('./shimIntegrationService').getIntegrationByType(
                tenantCompanyId,
                "email",
              );
            const whatsappIntegrationConfigured =
              !!whatsappIntegration && whatsappIntegration.isActive;
            const emailIntegrationConfigured =
              !!emailIntegration && emailIntegration.isActive;

            const whatsappEventEnabled =
              eventConfig?.isActive &&
              eventConfig?.whatsappTemplate?.enabled &&
              whatsappIntegrationConfigured;
            const emailEventEnabled =
              eventConfig?.isActive &&
              eventConfig?.emailTemplate?.enabled &&
              emailIntegrationConfigured;

            const inAppEnabled =
              companySettings?.taskAssigned?.inApp !== undefined
                ? companySettings.taskAssigned.inApp
                : true; // Default to true
            const emailEnabled =
              (companySettings?.taskAssigned?.email || false) &&
              emailEventEnabled;
            const whatsappEnabled =
              (companySettings?.taskAssigned?.whatsapp || false) &&
              whatsappEventEnabled;

            // Create in-app notification
            if (inAppEnabled) {
              await Notification.create({
                userId: newAssignedTo,
                taskId: task._id,
                type: "task_assigned",
                title: "Task Assigned",
                message: `Task "${task.title}" has been assigned to you`,
                channels: { inApp: true, email: emailEnabled },
                metadata: {
                  taskId: task._id.toString(),
                  taskTitle: task.title,
                },
              });
              logger.info(
                `In-app notification created for task assignment change: Task "${task.title}" to user ${assignedUser.email}`,
              );
            }

            // Send email/WhatsApp notifications if enabled
            if (emailEnabled || whatsappEnabled) {
              const channels = [];
              if (emailEnabled) channels.push("email");
              if (whatsappEnabled) channels.push("whatsapp");

              const eventData = {
                taskTitle: task.title,
                taskId: task._id.toString(),
                assignedToName: assignedUser.name || assignedUser.email,
                assignedToEmail: assignedUser.email,
                assignedToPhone: assignedUser.phone,
                companyName: task.companyId?.name || "Your Company",
                projectName: task.projectId?.name || null,
              };

              try {
                const result = await eventConfigService.sendEventNotification(
                  "task_assigned",
                  eventData,
                  {
                    to: assignedUser.email,
                    phone: assignedUser.phone,
                    tenantCompanyId,
                  },
                );

                if (
                  result.whatsapp &&
                  !result.whatsapp.success &&
                  channels.includes("whatsapp")
                ) {
                  logger.warn(
                    `⚠️ WhatsApp notification failed for task assignment change: ${result.whatsapp.error || result.whatsapp.message || "Unknown error"} - Task "${task.title}" to ${assignedUser.email}`,
                  );
                }

                if (
                  result.email &&
                  !result.email.success &&
                  channels.includes("email")
                ) {
                  logger.warn(
                    `⚠️ Email notification failed for task assignment change: ${result.email.error || result.email.message || "Unknown error"} - Task "${task.title}" to ${assignedUser.email}`,
                  );
                }

                logger.info(
                  `Successfully processed ${channels.join(", ")} notification(s) for task assignment change: Task "${task.title}" to ${assignedUser.email}`,
                );
              } catch (error) {
                logger.error(
                  `Failed to send task_assigned event notification to ${assignedUser.email}:`,
                  error,
                );
              }
            }
          }
        } catch (error) {
          logger.error(`Error sending assignment change notification:`, error);
        }
      }

      // Notify watchers about assignment change
      if (task.watchers && task.watchers.length > 0) {
        const User = require('../auth/user.model');
        const Notification = require("./notification.model");

        for (const watcherId of task.watchers) {
          if (watcherId.toString() === newAssignedTo) continue; // Skip if watcher is the new assignee

          try {
            const watcherUser = await User.findById(watcherId);
            if (watcherUser) {
              await Notification.create({
                userId: watcherId,
                taskId: task._id,
                type: "task_status_changed",
                title: "Task Assignment Changed",
                message: `Task "${task.title}" assignment has been changed`,
                channels: { inApp: true },
                metadata: {
                  taskId: task._id.toString(),
                  taskTitle: task.title,
                  oldAssignedTo: oldAssignedTo,
                  newAssignedTo: newAssignedTo,
                },
              });
              logger.info(
                `In-app notification created for assignment change: Task "${task.title}" to watcher ${watcherUser.email}`,
              );
            }
          } catch (error) {
            logger.error(
              `Error notifying watcher ${watcherId} about assignment change:`,
              error,
            );
          }
        }
      }
    }
  }

  // Check if status changed and send notifications
  // Only check if status was actually in the update data
  if (cleanedTaskData.status !== undefined) {
    const newStatus = task.status;
    if (
      oldStatus !== newStatus &&
      oldStatus !== undefined &&
      newStatus !== undefined
    ) {
      logger.info(
        `Task status changed via updateTask: Task "${task.title}" (${task._id}) status changed from ${oldStatus} to ${newStatus}`,
      );
      // Use provided userId or fallback to assignedBy or assignedTo
      const userIdForNotification =
        updatedByUserId || task.assignedBy || task.assignedTo;
      await createStatusChangeNotifications(
        task,
        oldStatus,
        newStatus,
        userIdForNotification,
        tenantCompanyId,
      );

      const holdReasonForLog =
        newStatus === "hold"
          ? cleanedTaskData.holdReason || task.holdReason || null
          : null;
      await logTaskActivity(task._id, userIdForNotification, "status_changed", {
        oldValue: oldStatus,
        newValue: newStatus,
        description:
          newStatus === "hold"
            ? holdReasonForLog && String(holdReasonForLog).trim()
              ? `Task "${task.title}" moved to Hold. Hold reason: ${String(holdReasonForLog).trim()}`
              : `Task "${task.title}" moved to Hold.`
            : `Status changed from ${oldStatus} to ${newStatus}`,
        metadata: {
          holdReason:
            holdReasonForLog && String(holdReasonForLog).trim()
              ? String(holdReasonForLog).trim()
              : null,
        },
      });

      // If task is completed, notify watchers and create timeline events
      const isNewStatusCompleted = ["completed", "validated", "done", "complete"].includes(newStatus);
      const isOldStatusCompleted = ["completed", "validated", "done", "complete"].includes(oldStatus);
      if (isNewStatusCompleted && !isOldStatusCompleted) {
        // Get comment/remarks if available
        const comment =
          taskData.comment ||
          taskData.remarks ||
          task.validationRemarks ||
          null;
        await notifyTaskCompleted(
          task,
          userIdForNotification,
          tenantCompanyId,
          comment,
        );

        // Auto-resolve any linked correction
        await resolveRelatedCorrection(task._id, userIdForNotification);

        // Create timeline event for task completion
        try {
          // Populate projectId and assignedTo if not already populated
          if (!task.projectId || typeof task.projectId === "string") {
            await task.populate("projectId", "name companyId");
          }
          if (!task.assignedTo || typeof task.assignedTo === "string") {
            await task.populate("assignedTo", "name email");
          }

          const assignedToName =
            task.assignedTo?.name || task.assignedTo?.email || null;

          // Create timeline event on Task entity
          await createTimelineEvent({
            eventType: "task_completed",
            entityType: "Task",
            entityId: task._id,
            performedByUserId: userIdForNotification,
            description: `Task "${task.title}" completed${assignedToName ? ` by ${assignedToName}` : ""}`,
            metadata: {
              taskId: task._id.toString(),
              taskTitle: task.title,
              projectId:
                task.projectId?._id?.toString() ||
                task.projectId?.toString() ||
                null,
              projectName: task.projectId?.name || null,
              completedAt: new Date(),
              previousStatus: oldStatus,
              currentStatus: "completed",
              assignedTo:
                task.assignedTo?._id?.toString() ||
                task.assignedTo?.toString() ||
                null,
              assignedToName: assignedToName,
              department: task.department || null,
            },
            companyId: tenantCompanyId,
          });

          // Also create timeline event on Project entity if task belongs to a project
          if (task.projectId) {
            const projectId = task.projectId._id || task.projectId;
            await createTimelineEvent({
              eventType: "task_completed",
              entityType: "Project",
              entityId: projectId,
              performedByUserId: userIdForNotification,
              description: `Task "${task.title}" completed${assignedToName ? ` by ${assignedToName}` : ""} for project "${task.projectId?.name || "Unknown"}"`,
              metadata: {
                taskId: task._id.toString(),
                taskTitle: task.title,
                projectId: projectId.toString(),
                projectName: task.projectId?.name || null,
                completedAt: new Date(),
                assignedTo:
                  task.assignedTo?._id?.toString() ||
                  task.assignedTo?.toString() ||
                  null,
                assignedToName: assignedToName,
                department: task.department || null,
              },
              companyId: tenantCompanyId,
            });
          }

          // Redundant auto-completion logic removed in favor of checkAndMarkProjectCompleted
        } catch (timelineError) {
          logger.error(
            "[Task Service] Failed to create timeline event for task completion:",
            timelineError,
          );
          // Don't throw - timeline failure shouldn't break task completion
        }
      }
    }
  }

  // Check if priority changed and send notifications
  // Only check if priority was actually in the update data
  if (cleanedTaskData.priority !== undefined) {
    const newPriority = task.priority;
    if (
      oldPriority !== newPriority &&
      oldPriority !== undefined &&
      newPriority !== undefined
    ) {
      logger.info(
        `Task priority changed: Task "${task.title}" (${task._id}) priority changed from ${oldPriority} to ${newPriority}`,
      );
      await createPriorityChangeNotifications(
        task,
        oldPriority,
        newPriority,
        tenantCompanyId,
      );
    }
  }

  return await getTaskById(task._id, tenantCompanyId, isGlobalAdmin ? updator.role : null);
};

// ── [NEW: HOLD TASK] ──────────────────────────────────────────────────────────
const holdTask = async (taskId, holdReason, userId, userRole, tenantCompanyId) => {
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);
  const task = await Task.findOne({
    _id: taskId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    companyId: { $in: clientCompanyIds },
  });
  if (!task) throw new Error("Task not found");

  // [RESTRICTIONS REMOVED AS PER USER REQUEST: ALL USERS HAVE FULL ACCESS BY DEFAULT]
  /*
  const isAdmin = ["super_admin", "admin", "operations_head"].includes(userRole);
  const isAssigned = task.assignedTo && String(task.assignedTo) === String(userId);

  if (!isAdmin && !isAssigned) {
    throw new Error("Only admins or the assigned user can place this task on hold");
  }
  */

  if (task.status === "hold") {
    throw new Error("Task is already on hold");
  }

  if (!holdReason || !String(holdReason).trim()) {
    throw new Error("Hold reason is required");
  }

  const oldStatus = task.status;
  task.status = "hold";
  task.holdReason = String(holdReason).trim();
  task.updatedBy = userId;

  // Cumulative Timing Logic
  const now = new Date();
  if (oldStatus === "in_progress") {
    if (task.workStartedAt) {
      const diffMs = now - task.workStartedAt;
      const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
      task.workDurationMinutes = (task.workDurationMinutes || 0) + diffMinutes;
      await recordTimerStop(task, diffMinutes, userId);
      task.workStartedAt = null;
      logger.info(
        `Timing (holdTask): Added ${diffMinutes}m to task ${task._id}. New total: ${task.workDurationMinutes}m`,
      );
    }
  }

  await task.save();

  if (task.projectId) {
    const {
      reconcileProjectTaskCounts,
      checkAndMarkProjectCompleted,
    } = require('./shimProjectService');
    const projectId = task.projectId._id || task.projectId;
    await reconcileProjectTaskCounts(projectId, tenantCompanyId);
    await checkAndMarkProjectCompleted(projectId, userId, tenantCompanyId);
  }

  // Log Activity
  await logTaskActivity(task._id, userId, "updated", {
    description: `Task placed on hold. Reason: ${task.holdReason}`,
    changes: {
      status: { old: oldStatus, new: "hold" },
      holdReason: { old: null, new: task.holdReason },
    },
  });

  return await getTaskById(task._id, tenantCompanyId);
};

const submitTask = async (
  taskId,
  submissionData,
  tenantCompanyId,
  submittedByUserId = null,
) => {
  // Get all client companies for this tenant
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  const task = await Task.findOne({
    _id: taskId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    companyId: { $in: clientCompanyIds },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  // Only allow submission if task is in progress
  if (task.status !== "in_progress") {
    throw new Error(`Task cannot be submitted. Current status: ${task.status}`);
  }

  task.status = "submitted";
  task.validationStatus = "pending";

  // Set updatedBy if provided
  if (submittedByUserId) {
    task.updatedBy = submittedByUserId;
  }

  // Handle attachments/work proof
  if (submissionData.attachments && Array.isArray(submissionData.attachments)) {
    task.attachments = [
      ...(task.attachments || []),
      ...submissionData.attachments,
    ];
  }

  // Legacy deliverables support
  if (submissionData.deliverables) {
    task.deliverables = submissionData.deliverables;
  }

  await task.save();

  return await getTaskById(task._id, tenantCompanyId);
};

// Validate Task (Operations team validates submitted tasks)
const validateTask = async (
  taskId,
  validationData,
  validatedByUserId,
  tenantCompanyId,
) => {
  // Get all client companies for this tenant
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  const task = await Task.findOne({
    _id: taskId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    companyId: { $in: clientCompanyIds },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  // Only allow validation if task is submitted
  if (task.status !== "submitted") {
    throw new Error(`Task cannot be validated. Current status: ${task.status}`);
  }

  // OVERDUE RESTRICTION: Block non-admin users from validating overdue tasks into completion
  if (task.dueDate) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const taskDueDateEnd = new Date(task.dueDate);
    taskDueDateEnd.setUTCHours(23, 59, 59, 999);
    const isTaskOverdue = taskDueDateEnd < todayStart;
    const adminRoles = [
      "super_admin",
      "admin",
      "operations_head",
      "website_coordinator",
    ];
    const requesterRole = validationData._requesterRole || null;

    if (
      isTaskOverdue &&
      validationData.isValid &&
      !adminRoles.includes(requesterRole)
    ) {
      throw new Error(
        "Overdue tasks cannot be validated or completed. Please contact an admin to update the due date first.",
      );
    }
  }

  const { isValid, remarks } = validationData;
  const oldStatus = task.status;

  // Set updatedBy
  if (validatedByUserId) {
    task.updatedBy = validatedByUserId;
  }

  if (isValid) {
    // Task is validated - mark as validated and completed
    task.status = "validated";
    task.validationStatus = "validated";
    task.validatedBy = validatedByUserId;
    task.validatedAt = new Date();

    // Move to completed status
    task.status = "completed";
    task.actualCompletionDate = new Date();

    // Notify watchers and admin when task is completed (with remarks as comment)
    await notifyTaskCompleted(
      task,
      validatedByUserId,
      tenantCompanyId,
      remarks,
    );

    // Auto-resolve any linked correction
    await resolveRelatedCorrection(task._id, validatedByUserId);

    // Create timeline events for task completion
    try {
      // Populate projectId and assignedTo if not already populated
      if (!task.projectId || typeof task.projectId === "string") {
        await task.populate("projectId", "name companyId");
      }
      if (!task.assignedTo || typeof task.assignedTo === "string") {
        await task.populate("assignedTo", "name email");
      }

      const assignedToName =
        task.assignedTo?.name || task.assignedTo?.email || null;
      const validatedByUser =
        await User.findById(validatedByUserId).select("name email");
      const validatedByName =
        validatedByUser?.name || validatedByUser?.email || null;

      // Create timeline event on Task entity
      await createTimelineEvent({
        eventType: "task_completed",
        entityType: "Task",
        entityId: task._id,
        performedByUserId: validatedByUserId,
        description: `Task "${task.title}" validated and completed${validatedByName ? ` by ${validatedByName}` : ""}`,
        metadata: {
          taskId: task._id.toString(),
          taskTitle: task.title,
          projectId:
            task.projectId?._id?.toString() ||
            task.projectId?.toString() ||
            null,
          projectName: task.projectId?.name || null,
          completedAt: new Date(),
          validatedAt: task.validatedAt,
          validatedBy: validatedByUserId.toString(),
          validatedByName: validatedByName,
          previousStatus: oldStatus,
          currentStatus: "completed",
          assignedTo:
            task.assignedTo?._id?.toString() ||
            task.assignedTo?.toString() ||
            null,
          assignedToName: assignedToName,
          department: task.department || null,
        },
        companyId: tenantCompanyId,
      });

      // Also create timeline event on Project entity if task belongs to a project
      if (task.projectId) {
        const projectId = task.projectId._id || task.projectId;
        await createTimelineEvent({
          eventType: "task_completed",
          entityType: "Project",
          entityId: projectId,
          performedByUserId: validatedByUserId,
          description: `Task "${task.title}" validated and completed${validatedByName ? ` by ${validatedByName}` : ""} for project "${task.projectId?.name || "Unknown"}"`,
          metadata: {
            taskId: task._id.toString(),
            taskTitle: task.title,
            projectId: projectId.toString(),
            projectName: task.projectId?.name || null,
            completedAt: new Date(),
            validatedAt: task.validatedAt,
            validatedBy: validatedByUserId.toString(),
            validatedByName: validatedByName,
            assignedTo:
              task.assignedTo?._id?.toString() ||
              task.assignedTo?.toString() ||
              null,
            assignedToName: assignedToName,
            department: task.department || null,
          },
          companyId: tenantCompanyId,
        });
      }
    } catch (timelineError) {
      logger.error(
        "[Task Service] Failed to create timeline event for task validation/completion:",
        timelineError,
      );
      // Don't throw - timeline failure shouldn't break task validation
    }

    // Redundant auto-completion logic removed in favor of checkAndMarkProjectCompleted
  } else {
    // Task is rejected - send back for rework
    if (!remarks || remarks.trim() === "") {
      throw new Error("Validation remarks are required when rejecting a task");
    }

    task.status = "rejected";
    task.validationStatus = "rejected";
    task.validationRemarks = remarks;
    task.validatedBy = validatedByUserId;
    task.validatedAt = new Date();
    task.reworkCount += 1;

    // Reset to in_progress so user can rework
    task.status = "in_progress";
    task.validationStatus = "pending";
  }

  await task.save();

  if (task.projectId) {
    const {
      reconcileProjectTaskCounts,
      checkAndMarkProjectCompleted,
    } = require('./shimProjectService');
    const projectId = task.projectId._id || task.projectId;
    await reconcileProjectTaskCounts(projectId, tenantCompanyId);
    await checkAndMarkProjectCompleted(
      projectId,
      validatedByUserId,
      tenantCompanyId,
    );
  }

  return await getTaskById(task._id, tenantCompanyId);
};

// Legacy methods for backward compatibility
const approveTask = async (taskId, tenantCompanyId) => {
  return await validateTask(
    taskId,
    { isValid: true, remarks: "Approved" },
    null,
    tenantCompanyId,
  );
};

const clientApproveTask = async (taskId, approvedByUserId, tenantCompanyId) => {
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);
  const task = await Task.findOne({
    _id: taskId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    companyId: { $in: clientCompanyIds },
  });
  if (!task) throw new Error("Task not found");

  task.clientReviewStatus = "approved";
  task.requiresClientReview = true;
  task.status = "completed";
  task.actualCompletionDate = new Date();
  task.updatedBy = approvedByUserId || task.updatedBy;
  await task.save();

  if (task.projectId) {
    const {
      reconcileProjectTaskCounts,
      checkAndMarkProjectCompleted,
    } = require('./shimProjectService');
    const projectId = task.projectId._id || task.projectId;
    await reconcileProjectTaskCounts(projectId, tenantCompanyId);
    await checkAndMarkProjectCompleted(projectId, approvedByUserId, tenantCompanyId);
  }

  return await getTaskById(task._id, tenantCompanyId);
};

const requestRework = async (taskId, feedback, tenantCompanyId) => {
  return await validateTask(
    taskId,
    {
      isValid: false,
      remarks: feedback.comments || feedback.remarks || "Rework required",
    },
    null,
    tenantCompanyId,
  );
};

// Get tasks by project
const getTasksByProject = async (projectId, tenantCompanyId) => {
  // Get all client companies for this tenant
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  return await Task.find({
    projectId,
    tenantCompanyId,
    companyId: { $in: clientCompanyIds },
  })
    .populate("companyId", "name email")
    .populate("assignedTo", "name email role")
    .populate("assignedBy", "name email")
    .populate("createdBy", "name email")
    .sort({ dueDate: 1 });
};

// Get tasks by department
const getTasksByDepartment = async (
  department,
  tenantCompanyId,
  filters = {},
) => {
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);
  const query = {
    department,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    ...filters,
  };

  if (clientCompanyIds.length > 0 && !query.companyId) {
    // If no specific company is requested, we show tasks for all client companies
    // But we don't force it if it might exclude internal tasks
    // Actually, following the project's pattern, we usually want to show everything under tenant
  }

  return await Task.find(query)
    .populate("companyId", "name email")
    .populate("projectId", "name")
    .populate("assignedTo", "name email role")
    .populate("createdBy", "name email")
    .sort({ dueDate: 1 });
};

// Get tasks for Kanban board (grouped by status)
const getTasksForKanban = async (
  tenantCompanyId,
  filters = {},
  userRole = null,
  userId = null,
) => {
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);
  const query = {
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
  };
  const userObjId =
    userId && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;
  const restrictToOwnAssignedTasks = !ROLES_WITH_FULL_TASK_ACCESS.includes(userRole);

  // Role-based filtering: Only super_admin and admin see all tasks.
  // All other roles only see tasks where they are assignedTo or in watchers.
  if (userRole === "website_coordinator") {
    query.$or = [
      { department: { $in: WEBSITE_COORDINATOR_DEPARTMENTS } },
      { assignedTo: userObjId },
      { watchers: userObjId },
    ];
  } else if (['client', 'agency_client', 'brand_super_admin', 'brand_manager'].includes(userRole) && userId) {
    // Strict isolation for clients: only their own company data
    const user = await User.findById(userId).select("clientId");
    if (user && user.clientId) {
      query.companyId = user.clientId;
    } else {
      // If no clientId linked, fallback to user ID as they are likely the client company itself
      query.companyId = userObjId;
    }
  } else if (restrictToOwnAssignedTasks) {
    // Regular assignee roles should only see tasks explicitly assigned to them, created by them, or watched by them.
    console.log(`[taskService.getTasksForKanban] Visibility DEBUG:`, {
      userId: userId,
      userRole: userRole,
      assignedTo: userObjId?.toString?.() || userObjId,
    });
    query.$or = [
      { assignedTo: userObjId },
      { createdBy: userObjId },
      { watchers: userObjId },
    ];
  }

  // Handle Assigned To filter (including unassigned)
  // IMPORTANT: If assignedTo filter is applied, it overrides the role-based $or to avoid conflicts
  if (!restrictToOwnAssignedTasks) {
    if (filters.assignedTo === "unassigned") {
      // Apply unassigned filter without deleting $or visibility constraints.
      query.assignedTo = { $in: [null, undefined] };
    } else if (filters.assignedTo) {
      // Apply assignedTo filter without deleting $or visibility constraints.
      query.assignedTo = mongoose.Types.ObjectId.isValid(filters.assignedTo)
        ? new mongoose.Types.ObjectId(filters.assignedTo)
        : filters.assignedTo;
    }
  }

  // Only add projectId filter if it's a valid value (not null, undefined, or empty string)
  if (
    filters.projectId &&
    filters.projectId !== "null" &&
    filters.projectId !== ""
  ) {
    query.projectId = filters.projectId;
  }
  if (filters.department) {
    let deptValue = filters.department;
    if (mongoose.Types.ObjectId.isValid(deptValue)) {
      const dept = await Department.findById(deptValue).select("slug");
      if (dept) deptValue = dept.slug;
    }
    query.department = buildDepartmentFilter(deptValue, userRole);
  }
  if (filters.priority) query.priority = filters.priority;
  if (filters.companyId) query.companyId = filters.companyId;
  if (filters.createdBy) query.createdBy = filters.createdBy;
  if (filters.taskCategory) query.taskCategory = filters.taskCategory;

  // Handle Date Range Filters for Kanban
  if (filters.startDate || filters.endDate || filters.dueDate) {
    const dateField = filters.dateField || "dueDate";

    let startDateVal = filters.startDate || filters.dueDate;
    let endDateVal = filters.endDate || filters.dueDate;

    let start = new Date(startDateVal);
    let end = new Date(endDateVal);

    if (typeof startDateVal === "string" && startDateVal.length <= 10) {
      start.setUTCHours(0, 0, 0, 0);
    }
    
    if (typeof endDateVal === "string" && endDateVal.length <= 10) {
      end.setUTCHours(23, 59, 59, 999);
    } else if (start.getTime() === end.getTime()) {
      // If start and end are exactly the same millisecond (e.g., from a single date picker), 
      // expand the end date to cover the next 24 hours to capture all events for that local day.
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    }

    console.log("[taskService.getTasksForKanban] Normalized Range:", {
      startDateVal,
      endDateVal,
      start: start.toISOString(),
      end: end.toISOString(),
    });

    if (dateField === "assignedOrStartDate") {
      const exactDayFilter = [
        { startDate: { $gte: start, $lte: end } },
        { dueDate: { $gte: start, $lte: end } },
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: exactDayFilter }];
        delete query.$or;
      } else {
        query.$or = exactDayFilter;
      }
    } else if (dateField === "startDate") {
      // Day-based Kanban view: only include tasks that were scheduled to start
      // on the selected calendar day.
      query.startDate = { $gte: start, $lte: end };
    } else {
      // If we are filtering by a specific date, we should include tasks that:
      // 1. Have the dateField in range (e.g., dueDate)
      // 2. OR were completed/validated in that range
      // 3. OR were created in that date range (for newly created tasks without dueDate)
      const dateOrFilter = [
        {
          $or: [
            // Option A: Task has a defined range (startDate to dueDate)
            {
              $and: [
                { startDate: { $ne: null, $exists: true } },
                { startDate: { $lte: end } },
                { dueDate: { $gte: start } },
                // If completed, don't show on days other than completion day (handled by Option C)
                {
                  $or: [
                    { actualCompletionDate: { $exists: false } },
                    { actualCompletionDate: { $eq: null } },
                  ],
                },
              ],
            },
            // Option B: Task only has dueDate (show from createdAt to dueDate)
            {
              $and: [
                {
                  $or: [
                    { startDate: { $eq: null } },
                    { startDate: { $exists: false } },
                  ],
                },
                { createdAt: { $lte: end } },
                { dueDate: { $gte: start } },
                // If completed, don't show on days other than completion day (handled by Option C)
                {
                  $or: [
                    { actualCompletionDate: { $exists: false } },
                    { actualCompletionDate: { $eq: null } },
                  ],
                },
              ],
            },
            // Option C: Task was actually completed/validated in this range (regardless of scheduled dates)
            { actualCompletionDate: { $gte: start, $lte: end } },
            { validatedAt: { $gte: start, $lte: end } },
            // Option D: Task was created in this range and has no dueDate (newly created tasks)
            {
              $and: [
                { createdAt: { $gte: start, $lte: end } },
                {
                  $or: [
                    { dueDate: { $exists: false } },
                    { dueDate: { $eq: null } },
                  ],
                },
              ],
            },
          ],
        },
      ];

      // If role-based $or already exists, combine with $and to preserve both constraints
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: dateOrFilter[0].$or }];
        delete query.$or;
      } else {
        query.$or = dateOrFilter[0].$or;
      }
    }
  }

  console.log(
    `[taskService.getTasksForKanban] Final Query DEBUG:`,
    JSON.stringify(query, null, 2),
  );

  // Handle Pending Tasks filter (overdue tasks only)
  if (filters.showPendingOnly === true || filters.showPendingOnly === "true") {
    // Tasks are pending if:
    // 1. Due date is in the past
    // 2. Status is not completed, validated, or done
    query.dueDate = { $lt: new Date() };
    query.status = {
      $nin: ["completed", "validated", "done"],
    };
  } else if (!filters.startDate && !filters.endDate && !filters.dueDate) {
    // Default view (Today/No filter): Only show tasks that are:
    // 1. Not completed/validated AND due today or in the future (overdue tasks are hidden)
    // 2. OR completed/validated TODAY
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const statusOrFilter = [
      {
        // Non-completed: only show tasks due today or later (not overdue)
        $and: [
          { status: { $nin: ["completed", "validated", "done"] } },
          {
            $or: [
              { dueDate: { $gte: todayStart } }, // Due today or future
              { dueDate: { $exists: false } }, // No due date set
              { dueDate: null }, // Null due date
            ],
          },
        ],
      },
      {
        // Completed/validated TODAY - always shown regardless of due date
        $and: [
          { status: { $in: ["completed", "validated", "done"] } },
          {
            $or: [
              { actualCompletionDate: { $gte: todayStart } },
              { validatedAt: { $gte: todayStart } },
              { updatedAt: { $gte: todayStart } }, // Fallback for safety
            ],
          },
        ],
      },
    ];

    // If role-based $or already exists, combine with $and to preserve both constraints
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: statusOrFilter }];
      delete query.$or;
    } else {
      query.$or = statusOrFilter;
    }
  }

  const tasks = await Task.find(query)
    .populate("companyId", "name email")
    .populate(
      "projectId",
      "name status color departments packageName numberOfPosters remainingPosters completedPosters numberOfVideos remainingVideos completedVideos numberOfShoots remainingShoots completedShoots selectedCategories",
    )
    .populate("assignedTo", "name email role avatar")
    .populate("assignedBy", "name email")
    .populate("createdBy", "name email profileImage")
    .populate("watchers", "name email avatar")
    .sort({ createdAt: -1 });

  // Get start of today for sorting logic
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Custom sort to prioritize tasks added today, then by order, then by createdAt desc
  tasks.sort((a, b) => {
    const aIsToday = a.createdAt >= todayStart;
    const bIsToday = b.createdAt >= todayStart;

    if (aIsToday && !bIsToday) return -1;
    if (!aIsToday && bIsToday) return 1;

    // Within buckets (Today or Past), respect the manual 'order' if it's different
    if (a.order !== b.order && a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }

    // Default to newest first
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Group by status using workflow configs
  // For each task, get its workflow and group by workflow status ID
  const grouped = {};

  for (const task of tasks) {
    const taskStatus = task.status || "created";

    // Try to get workflow config for this task's project or department
    let workflowConfig = null;
    if (task.projectId) {
      const projectId = task.projectId._id || task.projectId;
      workflowConfig = await getWorkflowConfig(
        projectId ? projectId.toString() : null,
        tenantCompanyId,
        null,
      );
    } else if (task.department) {
      workflowConfig = await getWorkflowConfig(
        null,
        tenantCompanyId,
        task.department,
      );
    }

    // If workflow config exists, use workflow status IDs
    if (
      workflowConfig &&
      workflowConfig.statuses &&
      workflowConfig.statuses.length > 0
    ) {
      // Find the status in workflow that matches task status
      const workflowStatus = workflowConfig.statuses.find(
        (s) => s.id === taskStatus,
      );
      if (workflowStatus) {
        const statusId = workflowStatus.id;
        if (!grouped[statusId]) {
          grouped[statusId] = [];
        }
        grouped[statusId].push(task);
        continue;
      }
    }

    // Fallback: Use legacy status mapping if no workflow config
    const statusMapping = {
      created: "backlog",
      assigned: "to_do",
      in_progress: "in_progress",
      submitted: "review",
      rejected: "Rejected",
      validated: "complete",
      completed: "review",
      backlog: "backlog",
      to_do: "to_do",
      review: "review",
      Rejected: "Rejected",
      done: "complete",
      complete: "complete",
    };

    const kanbanStatus = statusMapping[taskStatus] || "backlog";
    if (!grouped[kanbanStatus]) {
      grouped[kanbanStatus] = [];
    }
    grouped[kanbanStatus].push(task);
  }

  return grouped;
};

// Helper function to validate status transition based on workflow order
const validateStatusTransition = async (task, newStatusId, tenantCompanyId) => {
  // Restrict moving backward before In Progress once the task is in progress or beyond
  const inProgressOrBeyond = [
    "in_progress",
    "review",
    "Rejected",
    "rejected",
    "done",
    "completed",
    "validated",
    "submitted",
    "complete",
  ];
  const beforeInProgress = ["to_do", "backlog", "created", "assigned"];

  if (
    inProgressOrBeyond.includes(task.status) &&
    beforeInProgress.includes(newStatusId)
  ) {
    return {
      valid: false,
      message: "Cannot move task backward before In Progress once it has started.",
      workflowStatus: null,
    };
  }

  // Get workflow config for this task's project or department
  const projectId = task.projectId?._id || task.projectId;
  let workflowConfig = null;
  if (projectId) {
    workflowConfig = await getWorkflowConfig(
      projectId.toString(),
      tenantCompanyId,
      null,
    );
  } else if (task.department) {
    workflowConfig = await getWorkflowConfig(
      null,
      tenantCompanyId,
      task.department,
    );
  }

  if (
    !workflowConfig ||
    !workflowConfig.statuses ||
    workflowConfig.statuses.length === 0
  ) {
    // No workflow config, allow any transition (backward compatibility)
    return { valid: true, workflowStatus: null };
  }

  // Sort statuses by order
  const sortedStatuses = [...workflowConfig.statuses].sort(
    (a, b) => a.order - b.order,
  );

  // Find current status in workflow
  const currentStatusInWorkflow = sortedStatuses.find(
    (s) => s.id === task.status,
  );
  const newStatusInWorkflow = sortedStatuses.find((s) => s.id === newStatusId);

  // Allow transitioning from backlog (Hold) or hold ONLY to in_progress (resuming task)
  const currentStatusId = currentStatusInWorkflow ? currentStatusInWorkflow.id : task.status;
  if (currentStatusId === "backlog" || currentStatusId === "hold") {
    if (newStatusId === "in_progress") {
      return { valid: true, workflowStatus: newStatusInWorkflow };
    }
    if (newStatusId !== "backlog" && newStatusId !== "hold") {
      return {
        valid: false,
        message: "Tasks on Hold can only be moved to In Progress.",
        workflowStatus: null,
      };
    }
  }

  // If statuses are not in workflow, allow transition (backward compatibility)
  if (!currentStatusInWorkflow || !newStatusInWorkflow) {
    return { valid: true, workflowStatus: newStatusInWorkflow };
  }

  // Allow forward movement (next status) or backward movement (previous status)
  // This allows flexibility while maintaining workflow structure
  const currentOrder = currentStatusInWorkflow.order;
  const newOrder = newStatusInWorkflow.order;

  // Allow moving to adjacent statuses (forward or backward by 1)
  // Or allow moving to any previous status (backward)
  // But restrict jumping too far forward
  const orderDiff = newOrder - currentOrder;

  if (orderDiff === 1) {
    // Moving forward by 1 - always allowed
    return { valid: true, workflowStatus: newStatusInWorkflow };
  } else if (orderDiff === -1) {
    // Moving backward by 1 - allowed
    return { valid: true, workflowStatus: newStatusInWorkflow };
  } else if (orderDiff < 0) {
    // Moving backward by more than 1 - allowed (rework scenarios)
    return { valid: true, workflowStatus: newStatusInWorkflow };
  } else if (orderDiff > 1) {
    // Jumping forward by more than 1 - not allowed
    return {
      valid: false,
      message: `Cannot skip workflow steps. Current: ${currentStatusInWorkflow.name} (Order ${currentOrder}), Target: ${newStatusInWorkflow.name} (Order ${newOrder}). Please move through statuses in order.`,
      workflowStatus: null,
    };
  } else {
    // Same order - allowed (reordering within same status)
    return { valid: true, workflowStatus: newStatusInWorkflow };
  }
};

// Update (replace) a screenshot uploaded by the same user
const updateTaskScreenshot = async (
  taskId,
  attachmentId,
  newUrl,
  userId,
  tenantCompanyId,
) => {
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);
  const task = await Task.findOne({
    _id: taskId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    companyId: { $in: clientCompanyIds },
  });
  if (!task) throw new Error("Task not found");

  const attachment = task.attachments.id(attachmentId);
  if (!attachment) throw new Error("Screenshot not found");
  if (!attachment.isScreenshot)
    throw new Error("Attachment is not a screenshot");

  if (String(attachment.uploadedBy) !== String(userId)) {
    throw new Error("You can only edit screenshots you uploaded");
  }

  attachment.url = newUrl;
  attachment.uploadedAt = new Date();
  await task.save();

  return task;
};

const updateTaskStatusAndOrder = async (
  taskId,
  newStatus,
  newOrder,
  userId,
  tenantCompanyId,
  command = null,
  screenshotUrl = null,
  userRole = null,
  taskCategory = null,
  statusScope = {},
) => {
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  const task = await Task.findOne({
    _id: taskId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    companyId: { $in: clientCompanyIds },
  }).populate("projectId", "name status departments");

  if (!task) {
    throw new Error("Task not found");
  }

  const oldStatus = task.status;
  const oldOrder = task.order;

  // Get workflow config for this task's project or department
  const projectId = task.projectId?._id || task.projectId;
  let workflowConfig = null;
  if (projectId) {
    workflowConfig = await getWorkflowConfig(
      projectId.toString(),
      tenantCompanyId,
      null,
    );
  } else if (task.department) {
    workflowConfig = await getWorkflowConfig(
      null,
      tenantCompanyId,
      task.department,
    );
  }

  const hasWorkflowConfig =
    workflowConfig &&
    workflowConfig.statuses &&
    workflowConfig.statuses.length > 0;

  // Map Kanban statuses to actual task statuses (only if no custom workflow configuration is defined)
  const kanbanToTaskStatus = {
    backlog: "created",
    to_do: "assigned",
    in_progress: "in_progress",
    review: "completed",
    Rejected: "rejected",
    complete: "validated",
    done: "validated",
    created: "created",
    assigned: "assigned",
    submitted: "submitted",
    rejected: "rejected",
    validated: "validated",
    completed: "completed",
  };

  const taskStatus = hasWorkflowConfig
    ? newStatus
    : (kanbanToTaskStatus[newStatus] || newStatus);

  // Validate status transition based on workflow order
  const validation = await validateStatusTransition(
    task,
    taskStatus,
    tenantCompanyId,
  );
  if (!validation.valid) {
    throw new Error(validation.message || "Invalid status transition");
  }

  // If workflow status is found, use its ID to ensure consistency
  const finalStatus = validation.workflowStatus
    ? validation.workflowStatus.id
    : taskStatus;

  // ── [RESTRICTIONS & VALIDATIONS] ──────────────────────────────────────────

  const finalStatusName = validation.workflowStatus ? validation.workflowStatus.name.toLowerCase() : "";
  const isTargetingInProgress = 
    finalStatus === "in_progress" || 
    newStatus === "in_progress" || 
    taskStatus === "in_progress" ||
    finalStatusName.includes("in progress");

  if (isTargetingInProgress && oldStatus !== "in_progress") {

    await ensureNoOtherInProgressTask(
      task.assignedTo,
      task._id,
      tenantCompanyId,
      statusScope,
      task,
      finalStatus
    );
  }

  // [RESTRICTIONS REMOVED AS PER USER REQUEST: ALL USERS HAVE FULL ACCESS BY DEFAULT]
  // The following restrictions (skipInProgress, isTerminalMove, isAssignedUser) 
  // have been disabled to remove hardcoded role checks.
  /*
  const isAdmin = ["super_admin", "admin", "operations_head"].includes(
    userRole,
  );

  // 1. Block skipping 'In Progress' for ALL departments
  const skipInProgress =
    (oldStatus === "assigned" || oldStatus === "created") &&
    ["completed", "validated", "review", "done"].includes(finalStatus);
  if (skipInProgress && !isAdmin) {
    throw new Error(
      "Tasks must be moved to 'In Progress' before they can be completed or moved to Review.",
    );
  }

  // 2. Terminal Status Restriction (Only for Digital Marketing)
  const isDigitalMarketing = task.department === "digital-marketing";
  const isTerminalMove = finalStatus === "validated";

  if (isDigitalMarketing && isTerminalMove) {
    const canApprove =
      isAdmin ||
      [
        "digital_marketing_coordinator",
        "coordinator",
        "website_coordinator",
      ].includes(userRole);
    if (!canApprove) {
      throw new Error(
        "For Digital Marketing, only a Coordinator or Admin can mark a task as Done/Approved.",
      );
    }
  }

  // 3. Only assigned user can start the task (move to In Progress)
  if (finalStatus === "in_progress") {
    const isAssignedUser =
      task.assignedTo && task.assignedTo.toString() === userId.toString();
    if (!isAssignedUser && !isAdmin) {
      throw new Error(
        "Only the assigned user can move this task to 'In Progress'.",
      );
    }
  }
  */

  // ── [CUMULATIVE TIMING LOGIC] ──────────────────────────────────────────────
  const now = new Date();

  const wasCompletedStatus = ["completed", "validated", "done", "complete", "review", "in_review", "sent_for_client_review"].includes(oldStatus);
  if (wasCompletedStatus && finalStatus === "in_progress") {
    task.workStartedAt = new Date();
    task.workCompletedAt = null;
    task.workDurationMinutes = null;
  } else if (wasCompletedStatus && (finalStatus === "assigned" || finalStatus === "to_do" || finalStatus === "backlog")) {
    task.workStartedAt = null;
    task.workCompletedAt = null;
    task.workDurationMinutes = null;
  }

  // If moving FROM in_progress TO something else -> Add elapsed time to total
  if (oldStatus === "in_progress" && finalStatus !== "in_progress") {
    if (task.workStartedAt) {
      const diffMs = now - task.workStartedAt;
      const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
      task.workDurationMinutes = (task.workDurationMinutes || 0) + diffMinutes;
      await recordTimerStop(task, diffMinutes, userId);
      task.workStartedAt = null;
      logger.info(
        `Timing: Added ${diffMinutes}m to task ${task._id}. New total: ${task.workDurationMinutes}m`,
      );
    }
  }

  // If moving TO in_progress -> Start/Restart current session timer
  if (finalStatus === "in_progress") {
    task.workStartedAt = now;
    if (!task.startDate) task.startDate = now;
  }

  const isTerminalStatus = ["validated", "completed", "done", "complete", "review", "in_review", "sent_for_client_review"].includes(finalStatus);
  const wasTerminalStatus = ["validated", "completed", "done", "complete", "review", "in_review", "sent_for_client_review"].includes(oldStatus);
  
  // If moving TO terminal status -> Set final completion timestamp
  if (isTerminalStatus && !wasTerminalStatus) {
    task.workCompletedAt = now;
    task.actualCompletionDate = now;
  } else if (!isTerminalStatus && wasTerminalStatus) {
    task.workCompletedAt = null;
    task.actualCompletionDate = undefined;
  }

  // ── [STATUS & CATEGORY UPDATES] ───────────────────────────────────────────
  const wasCompleted = ["validated", "completed", "done", "complete"].includes(oldStatus);

  // Handle Rework categories
  if (
    wasCompleted &&
    (finalStatus === "in_progress" || finalStatus === "assigned")
  ) {
    task.taskCategory = "Correction";
    task.dueDate = now;
  } else if (["New", "Correction", "Redesign"].includes(taskCategory)) {
    task.taskCategory = taskCategory;
  }

  task.status = finalStatus;
  task.order = newOrder || 0;

  // Add screenshot to attachments if provided
  if (screenshotUrl) {
    if (!task.attachments) {
      task.attachments = [];
    }
    task.attachments.push({
      url: screenshotUrl,
      fileName: `status-change-screenshot-${Date.now()}.jpg`,
      fileType: "image/jpeg",
      uploadedAt: new Date(),
      uploadedBy: userId,
      isScreenshot: true,
    });
  }

  await task.save();

  // POST-SAVE DOUBLE CHECK (Race condition prevention)
  if (isTargetingInProgress && oldStatus !== "in_progress") {
    try {
      await ensureNoOtherInProgressTask(
        task.assignedTo,
        task._id,
        tenantCompanyId,
        statusScope,
        task,
        finalStatus
      );
    } catch (error) {
      // Revert the save if a concurrent request already moved another task to In Progress
      task.status = oldStatus;
      await task.save();
      throw error;
    }
  }

  // ── [UPDATE PROJECT COMPLETED COUNTS] ───────────────────────────────────
  const completedStatuses = ["completed", "validated", "done", "complete"];
  const isNowCompleted = completedStatuses.includes(finalStatus);
  const wasPreviouslyCompleted = completedStatuses.includes(oldStatus);
  const taskProjectId = task.projectId?._id || task.projectId || null;

  if (isNowCompleted && !wasPreviouslyCompleted) {
    if (taskProjectId) {
      await updateProjectCompletedCount(taskProjectId, task.serviceType, 1);
    }
  } else if (!isNowCompleted && wasPreviouslyCompleted) {
    if (taskProjectId) {
      await updateProjectCompletedCount(taskProjectId, task.serviceType, -1);
    }
  }

  if (task.projectId) {
    const {
      reconcileProjectTaskCounts,
      checkAndMarkProjectCompleted,
    } = require('./shimProjectService');
    const projectId = task.projectId._id || task.projectId;
    await reconcileProjectTaskCounts(projectId, tenantCompanyId);
    await checkAndMarkProjectCompleted(projectId, userId, tenantCompanyId);
  }

  // Log activity with command in metadata
  await logTaskActivity(taskId, userId, "status_changed", {
    oldValue: oldStatus,
    newValue: newStatus,
    description: command
      ? newStatus === "hold"
        ? `Task "${task.title}" moved to Hold. Hold reason: ${command}`
        : `Status changed from ${oldStatus} to ${newStatus}. Command: ${command}`
      : newStatus === "hold"
        ? `Task "${task.title}" moved to Hold.`
        : `Status changed from ${oldStatus} to ${newStatus}`,
    metadata: {
      command: command || null,
      screenshotUrl: screenshotUrl || null,
    },
  });

  // Create notifications
  await createStatusChangeNotifications(
    task,
    oldStatus,
    newStatus,
    userId,
    tenantCompanyId,
  );

  // If task is completed, notify watchers and create timeline events
  // Note: "review" maps to "completed" in kanbanToTaskStatus
  const isNewStatusCompleted = ["completed", "validated", "done", "complete", "review", "in_review", "reviewing"].includes(taskStatus) || ["completed", "validated", "done", "complete"].includes(finalStatus);
  const isOldStatusCompleted = ["completed", "validated", "done", "complete", "review", "in_review", "reviewing"].includes(oldStatus);
  
  if (isNewStatusCompleted && !isOldStatusCompleted) {
    // Auto-resolve any linked correction
    await resolveRelatedCorrection(taskId, userId);

    // Get comment from command if available
    const comment = command || task.validationRemarks || null;
    await notifyTaskCompleted(task, userId, tenantCompanyId, comment);

    // Mark SLA as Resolved to trigger Success metrics
    try {
      const SlaRecord = require('../sla/sla.model');
      const existingSla = await SlaRecord.findOne({ entityId: task._id, entityType: 'Task' });
      if (existingSla) {
        existingSla.status = 'Resolved';
        await existingSla.save();
      } else {
        await SlaRecord.create({
          slaId: `SLA-TSK-${task._id.toString().substring(0, 8).toUpperCase()}`,
          clientId: task.companyId,
          agencyId: task.tenantCompanyId,
          clientType: task.taskType === 'own_brand' ? 'Agency' : 'Direct User Client',
          triggerType: 'Due Date',
          entityId: task._id,
          entityType: 'Task',
          title: `Task: ${task.title}`,
          description: `Task completed successfully.`,
          dueDate: task.dueDate || new Date(),
          priority: task.priority || 'Medium',
          status: 'Resolved',
          assignedTo: task.assignedTo
        });
      }
    } catch (slaErr) {
      console.error("[Task Service] Failed to sync SLA for task completion in Kanban:", slaErr);
    }

    // Dispatch system notification for task completion
    const { dispatchSystemNotification } = require('./notification.service');
    if (tenantCompanyId) {
      await dispatchSystemNotification(
        tenantCompanyId,
        'taskCompleted',
        'task_completed',
        'Task Completed',
        `Task "${task.title}" has been completed.`,
        { taskId: task._id }
      );
    }

    // Create timeline event for task completion
    try {
      // Populate projectId and assignedTo if not already populated
      if (!task.projectId || typeof task.projectId === "string") {
        await task.populate("projectId", "name companyId");
      }
      if (!task.assignedTo || typeof task.assignedTo === "string") {
        await task.populate("assignedTo", "name email");
      }

      const assignedToName =
        task.assignedTo?.name || task.assignedTo?.email || null;

      // Create timeline event on Task entity
      await createTimelineEvent({
        eventType: "task_completed",
        entityType: "Task",
        entityId: task._id,
        performedByUserId: userId,
        description: `Task "${task.title}" completed${assignedToName ? ` by ${assignedToName}` : ""}`,
        metadata: {
          taskId: task._id.toString(),
          taskTitle: task.title,
          projectId:
            task.projectId?._id?.toString() ||
            task.projectId?.toString() ||
            null,
          projectName: task.projectId?.name || null,
          completedAt: new Date(),
          previousStatus: oldStatus,
          currentStatus: "completed",
          assignedTo:
            task.assignedTo?._id?.toString() ||
            task.assignedTo?.toString() ||
            null,
          assignedToName: assignedToName,
          department: task.department || null,
        },
        companyId: tenantCompanyId,
      });

      // Also create timeline event on Project entity if task belongs to a project
      if (task.projectId) {
        const projectId = task.projectId._id || task.projectId;
        await createTimelineEvent({
          eventType: "task_completed",
          entityType: "Project",
          entityId: projectId,
          performedByUserId: userId,
          description: `Task "${task.title}" completed${assignedToName ? ` by ${assignedToName}` : ""} for project "${task.projectId?.name || "Unknown"}"`,
          metadata: {
            taskId: task._id.toString(),
            taskTitle: task.title,
            projectId: projectId.toString(),
            projectName: task.projectId?.name || null,
            completedAt: new Date(),
            assignedTo:
              task.assignedTo?._id?.toString() ||
              task.assignedTo?.toString() ||
              null,
            assignedToName: assignedToName,
            department: task.department || null,
          },
          companyId: tenantCompanyId,
        });
      }
    } catch (timelineError) {
      logger.error(
        "[Task Service] Failed to create timeline event for task completion:",
        timelineError,
      );
      // Don't throw - timeline failure shouldn't break task completion
    }
  }

  return await getTaskById(taskId, tenantCompanyId);
};

// Update multiple tasks order (for drag & drop within column)
const updateTasksOrder = async (updates, userId, tenantCompanyId) => {
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  const bulkOps = updates.map((update) => ({
    updateOne: {
      filter: {
        _id: update.taskId,
        tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
        companyId: { $in: clientCompanyIds },
      },
      update: { $set: { order: update.order } },
    },
  }));

  await Task.bulkWrite(bulkOps);

  // Log activity for each task
  for (const update of updates) {
    await logTaskActivity(update.taskId, userId, "updated", {
      description: `Task order updated to ${update.order}`,
    });
  }

  return { success: true };
};

// Add comment to task
const addComment = async (
  taskId,
  commentData,
  userId,
  tenantCompanyId,
  userRole = null,
) => {
  let clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  // Strict isolation for clients
  if (userRole === "client" && userId) {
    const user = await User.findById(userId).select("clientId");
    if (user && user.clientId) {
      clientCompanyIds = [user.clientId];
    } else {
      clientCompanyIds = [];
    }
  }

  const task = await Task.findOne({
    _id: taskId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    companyId: { $in: clientCompanyIds },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const comment = await TaskComment.create({
    taskId,
    userId,
    content: commentData.content,
    isRichText: commentData.isRichText || false,
    mentions: commentData.mentions || [],
    attachments: commentData.attachments || [],
  });

  // Log activity
  await logTaskActivity(taskId, userId, "comment_added", {
    description: "Comment added",
    metadata: { commentId: comment._id },
  });

  // Create notifications
  await createCommentNotifications(task, comment, userId, tenantCompanyId);

  return await TaskComment.findById(comment._id).populate(
    "userId",
    "name email avatar",
  );
};

// Get task comments
const getTaskComments = async (
  taskId,
  tenantCompanyId,
  userRole = null,
  userId = null,
) => {
  let clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  // Strict isolation for clients
  if (userRole === "client" && userId) {
    const user = await User.findById(userId).select("clientId");
    if (user && user.clientId) {
      clientCompanyIds = [user.clientId];
    } else {
      clientCompanyIds = [];
    }
  }

  const task = await Task.findOne({
    _id: taskId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    companyId: { $in: clientCompanyIds },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  return await TaskComment.find({ taskId })
    .populate("userId", "name email avatar")
    .populate("mentions", "name email")
    .sort({ createdAt: 1 });
};

// Get task activity
const getTaskActivity = async (
  taskId,
  tenantCompanyId,
  userRole = null,
  userId = null,
) => {
  let clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  // Strict isolation for clients
  if (userRole === "client" && userId) {
    const user = await User.findById(userId).select("clientId");
    if (user && user.clientId) {
      clientCompanyIds = [user.clientId];
    } else {
      clientCompanyIds = [];
    }
  }

  const task = await Task.findOne({
    _id: taskId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    companyId: { $in: clientCompanyIds },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  return await TaskActivity.find({ taskId })
    .populate("userId", "name email avatar")
    .sort({ createdAt: -1 });
};

// Helper: Log task activity
const logTaskActivity = async (taskId, userId, action, data = {}) => {
  return await TaskActivity.create({
    taskId,
    userId,
    action,
    oldValue: data.oldValue,
    newValue: data.newValue,
    description: data.description,
    metadata: data.metadata || {},
  });
};

// Helper: Resolve related correction when task is completed
const resolveRelatedCorrection = async (taskId, userId) => {
  try {
    const Correction = require('./shimCorrectionModel');
    const correction = await Correction.findOne({
      taskId,
      status: "pending",
    });

    if (correction) {
      correction.status = "resolved";
      correction.resolvedAt = new Date();
      correction.resolvedBy = userId;
      await correction.save();

      logger.info(
        `Automatically resolved correction ${correction._id} linked to completed task ${taskId}`,
      );
    }
  } catch (error) {
    logger.error(
      `Failed to automatically resolve correction for task ${taskId}:`,
      error,
    );
  }
};

// Helper: Create status change notifications
const createStatusChangeNotifications = async (
  task,
  oldStatus,
  newStatus,
  changedByUserId,
  tenantCompanyId,
) => {
  const ClientCompany = require('../auth/user.model');

  logger.info(
    `Task status changed: Task "${task.title}" (${task._id}) status changed from ${oldStatus} to ${newStatus} by user ${changedByUserId}`,
  );

  // Get company-level notification settings
  let companySettings = await CompanyNotificationSettings.findOne({
    companyId: tenantCompanyId,
  });

  // If company settings don't exist, create default ones
  if (!companySettings) {
    companySettings = await CompanyNotificationSettings.create({
      companyId: tenantCompanyId,
    });
    logger.info(
      `Created default company notification settings for company ${tenantCompanyId}`,
    );
  }

  // Check event configuration
  const eventConfig = await eventConfigService.getEventConfigByType(
    "task_status_changed",
    tenantCompanyId
  );
  const whatsappIntegration = await Integration.findOne({
    type: "whatsapp",
    companyId: tenantCompanyId,
    isActive: true,
  });
  const whatsappIntegrationConfigured = !!(
    whatsappIntegration?.config?.backendUrl &&
    whatsappIntegration?.config?.apiToken
  );

  const hasEnvConfig = !!(config.WHATSAPP_API_URL && config.WHATSAPP_API_KEY);
  const isWhatsappConfigured = whatsappIntegrationConfigured || hasEnvConfig;

  const whatsappEventEnabled =
    eventConfig?.isActive &&
    eventConfig?.whatsappTemplate?.enabled &&
    isWhatsappConfigured;

  const emailIntegration = await Integration.findOne({
    type: "email",
    companyId: tenantCompanyId,
    isActive: true,
  });
  const emailIntegrationConfigured = !!(
    emailIntegration?.config?.clientId && emailIntegration?.config?.clientSecret
  );
  const emailEventEnabled =
    eventConfig?.isActive &&
    eventConfig?.emailTemplate?.enabled &&
    emailIntegrationConfigured;

  logger.info(
    `Event configuration check for task_status_changed: isActive=${eventConfig?.isActive}, whatsappTemplate.enabled=${eventConfig?.whatsappTemplate?.enabled}, whatsappIntegration.configured=${whatsappIntegrationConfigured}, emailTemplate.enabled=${eventConfig?.emailTemplate?.enabled}, emailIntegration.configured=${emailIntegrationConfigured}`,
  );
  logger.info(
    `Company notification settings for task_status_changed: inApp=${companySettings?.taskStatusChanged?.inApp}, email=${companySettings?.taskStatusChanged?.email}, whatsapp=${companySettings?.taskStatusChanged?.whatsapp}`,
  );

  const notificationPromises = [];

  // Get company info for event data
  const company = await ClientCompany.findById(task.companyId);
  const changedByUser = await User.findById(changedByUserId);

  // Track notified users to prevent duplicates
  const notifiedUserIds = new Set();

  // Helper function to send notification to a user
  const sendNotificationToUser = async (userId, isAdmin = false) => {
    // Skip if already notified or if it's the person who changed the status
    if (
      notifiedUserIds.has(userId.toString()) ||
      userId.toString() === changedByUserId.toString()
    ) {
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`User ${userId} not found, skipping notification`);
      return;
    }

    // Use company settings (not user settings)
    const inAppEnabled =
      companySettings?.taskStatusChanged?.inApp !== undefined
        ? companySettings.taskStatusChanged.inApp
        : true;
    const emailEnabled =
      (companySettings?.taskStatusChanged?.email || false) && emailEventEnabled;
    const whatsappEnabled =
      (companySettings?.taskStatusChanged?.whatsapp || false) &&
      whatsappEventEnabled;

    const userType = isAdmin
      ? "admin"
      : task.assignedTo?.toString() === userId.toString()
        ? "assignee"
        : "watcher";
    logger.info(
      `Status change notification settings for ${userType} ${user.email} (using company settings): inApp=${inAppEnabled}, email=${emailEnabled} (company=${companySettings?.taskStatusChanged?.email || false}, event=${emailEventEnabled}), whatsapp=${whatsappEnabled} (company=${companySettings?.taskStatusChanged?.whatsapp || false}, event=${whatsappEventEnabled})`,
    );

    // Create in-app notification
    if (inAppEnabled) {
      notificationPromises.push(
        createAndEmitNotification({
          userId: userId,
          taskId: task._id,
          type: "task_status_changed",
          title: "Task Status Changed",
          message: `Task "${task.title}" status changed from ${oldStatus} to ${newStatus}`,
        }),
      );
      logger.info(
        `In-app notification queued for status change: Task "${task.title}" to ${userType} ${user.email}`,
      );
    }

    // Send event notifications (email/WhatsApp) if enabled
    const channels = [];
    if (emailEnabled) channels.push("email");
    if (whatsappEnabled) channels.push("whatsapp");

    if (channels.length > 0) {
      const eventData = {
        taskTitle: task.title,
        taskId: task._id.toString(),
        assignedToName: user.name || user.email,
        changedByName: changedByUser?.name || changedByUser?.email || "System",
        oldStatus: oldStatus,
        newStatus: newStatus,
        companyName: company?.name || "Unknown Company",
      };

      logger.info(
        `Sending ${channels.join(", ")} notification(s) for task_status_changed to ${userType} ${user.email} (phone: ${user.phone || "N/A"})`,
      );

      try {
        notificationPromises.push(
          eventConfigService.sendEventNotification(
            "task_status_changed",
            eventData,
            {
              to: user.email,
              phone: user.phone,
              channels: channels,
              tenantCompanyId,
            },
          ),
        );
        logger.info(
          `Successfully queued ${channels.join(", ")} notification(s) for task_status_changed: Task "${task.title}" to ${userType} ${user.email}`,
        );
      } catch (error) {
        logger.error(
          `Failed to send task_status_changed event notification to ${userType} ${user.email}:`,
          error,
        );
      }
    } else {
      logger.info(
        `No email/WhatsApp notifications enabled for ${userType} ${user.email} (task_status_changed)`,
      );
    }

    // Mark as notified
    notifiedUserIds.add(userId.toString());
  };

  // Notify assignee (only if assigned)
  if (task.assignedTo) {
    await sendNotificationToUser(task.assignedTo, false);
  }

  // Notify watchers (skip if already notified as assignee)
  if (task.watchers && task.watchers.length > 0) {
    for (const watcherId of task.watchers) {
      await sendNotificationToUser(watcherId, false);
    }
  }

  // Notify admin users ONLY if status is "pending"
  if (newStatus === "pending" || newStatus === "assigned") {
    const adminUsers = await User.find({
      role: { $in: ["admin", "super_admin"] },
      companyId: tenantCompanyId,
      isActive: true,
    }).select("_id name email");

    for (const admin of adminUsers) {
      // Skip if admin is already notified (as assignee or watcher)
      if (!notifiedUserIds.has(admin._id.toString())) {
        await sendNotificationToUser(admin._id, true);
      }
    }
  }

  await Promise.all(notificationPromises);

  if (notificationPromises.length > 0) {
    logger.info(
      `Status change notifications processed: ${notificationPromises.length} notification(s) sent for task "${task.title}" (${oldStatus} → ${newStatus})`,
    );
  } else {
    logger.info(
      `No status change notifications sent (no recipients or all disabled) for task "${task.title}"`,
    );
  }
};

// Helper: Create priority change notifications
const createPriorityChangeNotifications = async (
  task,
  oldPriority,
  newPriority,
  tenantCompanyId,
) => {
  const ClientCompany = require('../auth/user.model');

  logger.info(
    `Task priority changed: Task "${task.title}" (${task._id}) priority changed from ${oldPriority} to ${newPriority}`,
  );

  // Get company-level notification settings
  let companySettings = await CompanyNotificationSettings.findOne({
    companyId: tenantCompanyId,
  });

  // If company settings don't exist, create default ones
  if (!companySettings) {
    companySettings = await CompanyNotificationSettings.create({
      companyId: tenantCompanyId,
    });
    logger.info(
      `Created default company notification settings for company ${tenantCompanyId}`,
    );
  }

  // Check event configuration
  const eventConfig = await eventConfigService.getEventConfigByType(
    "task_priority_changed",
    tenantCompanyId
  );
  const whatsappIntegration = await Integration.findOne({
    type: "whatsapp",
    companyId: tenantCompanyId,
    isActive: true,
  });
  const whatsappIntegrationConfigured = !!(
    whatsappIntegration?.config?.backendUrl &&
    whatsappIntegration?.config?.apiToken
  );

  const hasEnvConfig = !!(config.WHATSAPP_API_URL && config.WHATSAPP_API_KEY);
  const isWhatsappConfigured = whatsappIntegrationConfigured || hasEnvConfig;

  const whatsappEventEnabled =
    eventConfig?.isActive &&
    eventConfig?.whatsappTemplate?.enabled &&
    isWhatsappConfigured;

  const emailIntegration = await Integration.findOne({
    type: "email",
    companyId: tenantCompanyId,
    isActive: true,
  });
  const emailIntegrationConfigured = !!(
    emailIntegration?.config?.clientId && emailIntegration?.config?.clientSecret
  );
  const emailEventEnabled =
    eventConfig?.isActive &&
    eventConfig?.emailTemplate?.enabled &&
    emailIntegrationConfigured;

  logger.info(
    `Event configuration check for task_priority_changed: isActive=${eventConfig?.isActive}, whatsappTemplate.enabled=${eventConfig?.whatsappTemplate?.enabled}, whatsappIntegration.configured=${whatsappIntegrationConfigured}, emailTemplate.enabled=${eventConfig?.emailTemplate?.enabled}, emailIntegration.configured=${emailIntegrationConfigured}`,
  );

  const notificationPromises = [];

  // Get company info for event data
  const company = await ClientCompany.findById(task.companyId);

  // Notify assignee
  if (task.assignedTo) {
    const assigneeUser = await User.findById(task.assignedTo);

    if (!assigneeUser) {
      logger.warn(
        `Assignee user ${task.assignedTo} not found, skipping priority change notifications`,
      );
    } else {
      // Use company settings (not user settings)
      const inAppEnabled =
        companySettings?.taskPriorityChanged?.inApp !== undefined
          ? companySettings.taskPriorityChanged.inApp
          : true;
      const emailEnabled =
        (companySettings?.taskPriorityChanged?.email || false) &&
        emailEventEnabled;
      const whatsappEnabled =
        (companySettings?.taskPriorityChanged?.whatsapp || false) &&
        whatsappEventEnabled;

      logger.info(
        `Priority change notification settings for assignee ${assigneeUser.email} (using company settings): inApp=${inAppEnabled}, email=${emailEnabled} (company=${companySettings?.taskPriorityChanged?.email || false}, event=${emailEventEnabled}), whatsapp=${whatsappEnabled} (company=${companySettings?.taskPriorityChanged?.whatsapp || false}, event=${whatsappEventEnabled})`,
      );

      // Create in-app notification
      if (inAppEnabled) {
        notificationPromises.push(
          createAndEmitNotification({
            userId: task.assignedTo,
            taskId: task._id,
            type: "task_priority_changed",
            title: "Task Priority Changed",
            message: `Task "${task.title}" priority changed from ${oldPriority} to ${newPriority}`,
          }),
        );
        logger.info(
          `In-app notification queued for priority change: Task "${task.title}" to assignee ${assigneeUser.email}`,
        );
      }

      // Send event notifications (email/WhatsApp) if enabled
      const channels = [];
      if (emailEnabled) channels.push("email");
      if (whatsappEnabled) channels.push("whatsapp");

      if (channels.length > 0) {
        const eventData = {
          taskTitle: task.title,
          taskId: task._id.toString(),
          assignedToName: assigneeUser.name || assigneeUser.email,
          changedByName: "System", // Priority changes don't track who changed it in updateTask
          oldPriority: oldPriority,
          newPriority: newPriority,
          dueDate: task.dueDate ? formatDateToIST(task.dueDate) : "Not set",
          companyName: company?.name || "Unknown Company",
        };

        logger.info(
          `Sending ${channels.join(", ")} notification(s) for task_priority_changed to assignee ${assigneeUser.email} (phone: ${assigneeUser.phone || "N/A"})`,
        );

        try {
          notificationPromises.push(
            eventConfigService.sendEventNotification(
              "task_priority_changed",
              eventData,
              {
                to: assigneeUser.email,
                phone: assigneeUser.phone,
                channels: channels,
                tenantCompanyId,
              },
            ),
          );
          logger.info(
            `Successfully queued ${channels.join(", ")} notification(s) for task_priority_changed: Task "${task.title}" to assignee ${assigneeUser.email}`,
          );
        } catch (error) {
          logger.error(
            `Failed to send task_priority_changed event notification to assignee ${assigneeUser.email}:`,
            error,
          );
        }
      } else {
        logger.info(
          `No email/WhatsApp notifications enabled for assignee ${assigneeUser.email} (task_priority_changed)`,
        );
      }
    }
  }

  // Notify watchers
  if (
    task.watchers &&
    Array.isArray(task.watchers) &&
    task.watchers.length > 0
  ) {
    for (const watcherId of task.watchers) {
      const watcherUser = await User.findById(watcherId);

      if (!watcherUser) {
        logger.warn(
          `Watcher user ${watcherId} not found, skipping priority change notification`,
        );
        continue;
      }

      // Use company settings (not user settings)
      const inAppEnabled =
        companySettings?.taskPriorityChanged?.inApp !== undefined
          ? companySettings.taskPriorityChanged.inApp
          : true;
      const emailEnabled =
        (companySettings?.taskPriorityChanged?.email || false) &&
        emailEventEnabled;
      const whatsappEnabled =
        (companySettings?.taskPriorityChanged?.whatsapp || false) &&
        whatsappEventEnabled;

      // Create in-app notification
      if (inAppEnabled) {
        notificationPromises.push(
          createAndEmitNotification({
            userId: watcherId,
            taskId: task._id,
            type: "task_priority_changed",
            title: "Task Priority Changed",
            message: `Task "${task.title}" priority changed from ${oldPriority} to ${newPriority}`,
          }),
        );
        logger.info(
          `In-app notification queued for priority change: Task "${task.title}" to watcher ${watcherUser.email}`,
        );
      }

      // Send event notifications (email/WhatsApp) if enabled
      const channels = [];
      if (emailEnabled) channels.push("email");
      if (whatsappEnabled) channels.push("whatsapp");

      if (channels.length > 0) {
        const assigneeName = task.assignedTo
          ? (await User.findById(task.assignedTo))?.name || "Unassigned"
          : "Unassigned";
        const eventData = {
          taskTitle: task.title,
          taskId: task._id.toString(),
          assignedToName: assigneeName,
          changedByName: "System",
          oldPriority: oldPriority,
          newPriority: newPriority,
          dueDate: task.dueDate ? formatDateToIST(task.dueDate) : "Not set",
          companyName: company?.name || "Unknown Company",
        };

        logger.info(
          `Sending ${channels.join(", ")} notification(s) for task_priority_changed to watcher ${watcherUser.email} (phone: ${watcherUser.phone || "N/A"})`,
        );

        try {
          notificationPromises.push(
            eventConfigService.sendEventNotification(
              "task_priority_changed",
              eventData,
              {
                to: watcherUser.email,
                phone: watcherUser.phone,
                channels: channels,
                tenantCompanyId,
              },
            ),
          );
          logger.info(
            `Successfully queued ${channels.join(", ")} notification(s) for task_priority_changed: Task "${task.title}" to watcher ${watcherUser.email}`,
          );
        } catch (error) {
          logger.error(
            `Failed to send task_priority_changed event notification to watcher ${watcherUser.email}:`,
            error,
          );
        }
      } else {
        logger.info(
          `No email/WhatsApp notifications enabled for watcher ${watcherUser.email} (task_priority_changed)`,
        );
      }
    }
  }

  await Promise.all(notificationPromises);

  if (notificationPromises.length > 0) {
    logger.info(
      `Priority change notifications processed: ${notificationPromises.length} notification(s) sent for task "${task.title}" (${oldPriority} → ${newPriority})`,
    );
  } else {
    logger.info(
      `No priority change notifications sent (no recipients or all disabled) for task "${task.title}"`,
    );
  }
};

// Helper: Create comment notifications
const createCommentNotifications = async (
  task,
  comment,
  commentByUserId,
  tenantCompanyId,
) => {
  const ClientCompany = require('../auth/user.model');

  logger.info(
    `Comment added to task: Task "${task.title}" (${task._id}) comment added by user ${commentByUserId}`,
  );

  // Get company-level notification settings
  let companySettings = await CompanyNotificationSettings.findOne({
    companyId: tenantCompanyId,
  });

  // If company settings don't exist, create default ones
  if (!companySettings) {
    companySettings = await CompanyNotificationSettings.create({
      companyId: tenantCompanyId,
    });
    logger.info(
      `Created default company notification settings for company ${tenantCompanyId}`,
    );
  }

  // Check event configuration for task_comment_added
  const commentEventConfig =
    await eventConfigService.getEventConfigByType("task_comment_added", tenantCompanyId);
  const whatsappIntegration = await Integration.findOne({
    type: "whatsapp",
    companyId: tenantCompanyId,
    isActive: true,
  });
  const whatsappIntegrationConfigured = !!(
    whatsappIntegration?.config?.backendUrl &&
    whatsappIntegration?.config?.apiToken
  );
  const whatsappCommentEventEnabled =
    commentEventConfig?.isActive &&
    commentEventConfig?.whatsappTemplate?.enabled &&
    whatsappIntegrationConfigured;

  const emailIntegration = await Integration.findOne({
    type: "email",
    companyId: tenantCompanyId,
    isActive: true,
  });
  const emailIntegrationConfigured = !!(
    emailIntegration?.config?.clientId && emailIntegration?.config?.clientSecret
  );
  const emailCommentEventEnabled =
    commentEventConfig?.isActive &&
    commentEventConfig?.emailTemplate?.enabled &&
    emailIntegrationConfigured;

  // Check event configuration for task_mentioned
  const mentionedEventConfig =
    await eventConfigService.getEventConfigByType("task_mentioned", tenantCompanyId);
  const whatsappMentionedEventEnabled =
    mentionedEventConfig?.isActive &&
    mentionedEventConfig?.whatsappTemplate?.enabled &&
    whatsappIntegrationConfigured;
  const emailMentionedEventEnabled =
    mentionedEventConfig?.isActive &&
    mentionedEventConfig?.emailTemplate?.enabled &&
    emailIntegrationConfigured;

  logger.info(
    `Event configuration check for task_comment_added: isActive=${commentEventConfig?.isActive}, whatsappTemplate.enabled=${commentEventConfig?.whatsappTemplate?.enabled}, whatsappIntegration.configured=${whatsappIntegrationConfigured}, emailTemplate.enabled=${commentEventConfig?.emailTemplate?.enabled}, emailIntegration.configured=${emailIntegrationConfigured}`,
  );

  const notificationPromises = [];
  const commentByUser = await User.findById(commentByUserId);
  const company = await ClientCompany.findById(task.companyId);

  // Extract plain text from comment (remove HTML tags if rich text)
  let commentText = comment.content || "";
  if (comment.isRichText) {
    // Simple HTML tag removal for plain text extraction
    commentText = commentText.replace(/<[^>]*>/g, "").trim();
  }
  // Limit comment text length for notifications
  const truncatedCommentText =
    commentText.length > 200
      ? commentText.substring(0, 200) + "..."
      : commentText;

  // Notify assignee (using company settings)
  if (
    task.assignedTo &&
    task.assignedTo.toString() !== commentByUserId.toString()
  ) {
    const assigneeUser = await User.findById(task.assignedTo);

    if (!assigneeUser) {
      logger.warn(
        `Assignee user ${task.assignedTo} not found, skipping comment notifications`,
      );
    } else {
      // Use company settings (not user settings)
      const inAppEnabled =
        companySettings?.taskCommentAdded?.inApp !== undefined
          ? companySettings.taskCommentAdded.inApp
          : true;
      const emailEnabled =
        (companySettings?.taskCommentAdded?.email || false) &&
        emailCommentEventEnabled;
      const whatsappEnabled =
        (companySettings?.taskCommentAdded?.whatsapp || false) &&
        whatsappCommentEventEnabled;

      logger.info(
        `Comment notification settings for assignee ${assigneeUser.email} (using company settings): inApp=${inAppEnabled}, email=${emailEnabled} (company=${companySettings?.taskCommentAdded?.email || false}, event=${emailCommentEventEnabled}), whatsapp=${whatsappEnabled} (company=${companySettings?.taskCommentAdded?.whatsapp || false}, event=${whatsappCommentEventEnabled})`,
      );

      // Create in-app notification
      if (inAppEnabled) {
        notificationPromises.push(
          createAndEmitNotification({
            userId: task.assignedTo,
            taskId: task._id,
            type: "task_comment_added",
            title: "New Comment",
            message: `New comment on task "${task.title}"`,
          }),
        );
        logger.info(
          `In-app notification queued for comment: Task "${task.title}" to assignee ${assigneeUser.email}`,
        );
      }

      // Send event notifications (email/WhatsApp) if enabled
      const channels = [];
      if (emailEnabled) channels.push("email");
      if (whatsappEnabled) channels.push("whatsapp");

      if (channels.length > 0) {
        const eventData = {
          taskTitle: task.title,
          taskId: task._id.toString(),
          assignedToName: assigneeUser.name || assigneeUser.email,
          commentAuthorName:
            commentByUser?.name || commentByUser?.email || "Unknown User",
          commentText: truncatedCommentText,
          companyName: company?.name || "Unknown Company",
        };

        logger.info(
          `Sending ${channels.join(", ")} notification(s) for task_comment_added to assignee ${assigneeUser.email} (phone: ${assigneeUser.phone || "N/A"})`,
        );

        try {
          notificationPromises.push(
            eventConfigService.sendEventNotification(
              "task_comment_added",
              eventData,
              {
                to: assigneeUser.email,
                phone: assigneeUser.phone,
                channels: channels,
                tenantCompanyId,
              },
            ),
          );
          logger.info(
            `Successfully queued ${channels.join(", ")} notification(s) for task_comment_added: Task "${task.title}" to assignee ${assigneeUser.email}`,
          );
        } catch (error) {
          logger.error(
            `Failed to send task_comment_added event notification to assignee ${assigneeUser.email}:`,
            error,
          );
        }
      } else {
        logger.info(
          `No email/WhatsApp notifications enabled for assignee ${assigneeUser.email} (task_comment_added)`,
        );
      }
    }
  }

  // Notify mentioned users (using company settings)
  if (comment.mentions && comment.mentions.length > 0) {
    for (const mentionedId of comment.mentions) {
      if (mentionedId.toString() !== commentByUserId.toString()) {
        const mentionedUser = await User.findById(mentionedId);

        if (!mentionedUser) {
          logger.warn(
            `Mentioned user ${mentionedId} not found, skipping mention notification`,
          );
          continue;
        }

        // Use company settings (not user settings)
        const inAppEnabled =
          companySettings?.taskMentioned?.inApp !== undefined
            ? companySettings.taskMentioned.inApp
            : true;
        const emailEnabled =
          (companySettings?.taskMentioned?.email || false) &&
          emailMentionedEventEnabled;
        const whatsappEnabled =
          (companySettings?.taskMentioned?.whatsapp || false) &&
          whatsappMentionedEventEnabled;

        logger.info(
          `Mention notification settings for ${mentionedUser.email} (using company settings): inApp=${inAppEnabled}, email=${emailEnabled} (company=${companySettings?.taskMentioned?.email || false}, event=${emailMentionedEventEnabled}), whatsapp=${whatsappEnabled} (company=${companySettings?.taskMentioned?.whatsapp || false}, event=${whatsappMentionedEventEnabled})`,
        );

        // Create in-app notification
        if (inAppEnabled) {
          notificationPromises.push(
            createAndEmitNotification({
              userId: mentionedId,
              taskId: task._id,
              type: "task_mentioned",
              title: "You were mentioned",
              message: `You were mentioned in a comment on task "${task.title}"`,
            }),
          );
          logger.info(
            `In-app notification queued for mention: Task "${task.title}" to ${mentionedUser.email}`,
          );
        }

        // Send event notifications (email/WhatsApp) if enabled
        const channels = [];
        if (emailEnabled) channels.push("email");
        if (whatsappEnabled) channels.push("whatsapp");

        if (channels.length > 0) {
          const eventData = {
            taskTitle: task.title,
            taskId: task._id.toString(),
            mentionedUserName: mentionedUser.name || mentionedUser.email,
            commentAuthorName:
              commentByUser?.name || commentByUser?.email || "Unknown User",
            commentText: truncatedCommentText,
            companyName: company?.name || "Unknown Company",
          };

          logger.info(
            `Sending ${channels.join(", ")} notification(s) for task_mentioned to ${mentionedUser.email} (phone: ${mentionedUser.phone || "N/A"})`,
          );

          try {
            notificationPromises.push(
              eventConfigService.sendEventNotification(
                "task_mentioned",
                eventData,
                {
                  to: mentionedUser.email,
                  phone: mentionedUser.phone,
                  channels: channels,
                  tenantCompanyId,
                },
              ),
            );
            logger.info(
              `Successfully queued ${channels.join(", ")} notification(s) for task_mentioned: Task "${task.title}" to ${mentionedUser.email}`,
            );
          } catch (error) {
            logger.error(
              `Failed to send task_mentioned event notification to ${mentionedUser.email}:`,
              error,
            );
          }
        } else {
          logger.info(
            `No email/WhatsApp notifications enabled for ${mentionedUser.email} (task_mentioned)`,
          );
        }
      }
    }
  }

  await Promise.all(notificationPromises);

  if (notificationPromises.length > 0) {
    logger.info(
      `Comment notifications processed: ${notificationPromises.length} notification(s) sent for task "${task.title}"`,
    );
  } else {
    logger.info(
      `No comment notifications sent (no recipients or all disabled) for task "${task.title}"`,
    );
  }
};

// Helper: Notify watchers when task is completed
const notifyTaskCompleted = async (
  task,
  completedByUserId,
  tenantCompanyId,
  comment = null,
) => {
  const Notification = require("./notification.model");
  const NotificationSettings = require("./notificationSettings.model");
  const ClientCompany = require('../auth/user.model');

  logger.info(
    `Task completed: Task "${task.title}" (${task._id}) completed by user ${completedByUserId}`,
  );

  // Get company-level notification settings
  let companySettings = await CompanyNotificationSettings.findOne({
    companyId: tenantCompanyId,
  });

  // If company settings don't exist, create default ones
  if (!companySettings) {
    companySettings = await CompanyNotificationSettings.create({
      companyId: tenantCompanyId,
    });
    logger.info(
      `Created default company notification settings for company ${tenantCompanyId}`,
    );
  }

  // Check event configuration
  const eventConfig =
    await eventConfigService.getEventConfigByType("task_completed", tenantCompanyId);
  const whatsappIntegration = await Integration.findOne({
    type: "whatsapp",
    companyId: tenantCompanyId,
    isActive: true,
  });
  const whatsappIntegrationConfigured = !!(
    whatsappIntegration?.config?.backendUrl &&
    whatsappIntegration?.config?.apiToken
  );

  const hasEnvConfig = !!(config.WHATSAPP_API_URL && config.WHATSAPP_API_KEY);
  const isWhatsappConfigured = whatsappIntegrationConfigured || hasEnvConfig;

  const whatsappEventEnabled =
    eventConfig?.isActive &&
    eventConfig?.whatsappTemplate?.enabled &&
    isWhatsappConfigured;

  const emailIntegration = await Integration.findOne({
    type: "email",
    companyId: tenantCompanyId,
    isActive: true,
  });
  const emailIntegrationConfigured = !!(
    emailIntegration?.config?.clientId && emailIntegration?.config?.clientSecret
  );
  const emailEventEnabled =
    eventConfig?.isActive &&
    eventConfig?.emailTemplate?.enabled &&
    emailIntegrationConfigured;

  logger.info(
    `Event configuration check for task_completed: isActive=${eventConfig?.isActive}, whatsappTemplate.enabled=${eventConfig?.whatsappTemplate?.enabled}, whatsappIntegration.configured=${whatsappIntegrationConfigured}, emailTemplate.enabled=${eventConfig?.emailTemplate?.enabled}, emailIntegration.configured=${emailIntegrationConfigured}`,
  );
  logger.info(
    `Company notification settings for task_completed: inApp=${companySettings?.taskCompleted?.inApp}, email=${companySettings?.taskCompleted?.email}, whatsapp=${companySettings?.taskCompleted?.whatsapp}`,
  );

  const completedByUser = await User.findById(completedByUserId);
  const assignedUser = await User.findById(task.assignedTo);
  const assignedByUser = task.assignedBy
    ? await User.findById(task.assignedBy)
    : null;
  const company = await ClientCompany.findById(task.companyId);

  // Notify watchers AND admin users when a task is completed
  const usersToNotifyIds = new Set();

  // Add all watchers
  if (task.watchers && task.watchers.length > 0) {
    task.watchers.forEach((watcher) => {
      const watcherId = watcher._id || watcher;
      if (watcherId) {
        usersToNotifyIds.add(watcherId.toString());
      }
    });
  }

  // ALWAYS notify admin users when task is completed
  const adminUsers = await User.find({
    role: { $in: ["admin", "super_admin"] },
    companyId: tenantCompanyId,
    isActive: true,
  }).select("_id name email role");

  adminUsers.forEach((admin) => {
    usersToNotifyIds.add(admin._id.toString());
  });

  const usersToNotify = Array.from(usersToNotifyIds);

  if (usersToNotify.length === 0) {
    logger.info(
      `No users to notify for task completion "${task.title}" (no watchers or admins found)`,
    );
    return;
  }

  logger.info(
    `Task completion notification recipients: ${usersToNotify.length} unique user(s) to notify (watchers + admins) for task "${task.title}"`,
  );

  logger.info(
    `Task completion notification recipients: ${usersToNotify.length} watcher(s) to notify for task "${task.title}" (total watchers: ${task.watchers?.length || 0}, assignee: ${task.assignedTo}, completer: ${completedByUserId})`,
  );

  const notificationPromises = [];

  for (const userId of usersToNotify) {
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(
        `Could not find user with ID ${userId} for task completion notification`,
      );
      continue;
    }

    // Use company settings (not user settings)
    const inAppEnabled =
      companySettings?.taskCompleted?.inApp !== undefined
        ? companySettings.taskCompleted.inApp
        : true;
    const emailEnabled =
      (companySettings?.taskCompleted?.email || false) && emailEventEnabled;
    const whatsappEnabled =
      (companySettings?.taskCompleted?.whatsapp || false) &&
      whatsappEventEnabled;

    if (whatsappEnabled && !user.phone) {
      logger.warn(
        `WhatsApp notification enabled for user ${user.email} but no phone number found. Recipient will only receive other enabled channels.`,
      );
    }

    logger.info(
      `Task completion notification settings for user ${user.email} (phone: ${user.phone || "N/A"}): inApp=${inAppEnabled}, email=${emailEnabled} (company=${companySettings?.taskCompleted?.email || false}, event=${emailEventEnabled}), whatsapp=${whatsappEnabled && !!user.phone} (company=${companySettings?.taskCompleted?.whatsapp || false}, event=${whatsappEventEnabled})`,
    );

    // Create in-app notification
    if (inAppEnabled) {
      notificationPromises.push(
        createAndEmitNotification({
          userId: userId,
          taskId: task._id,
          type: "task_completed",
          title: "Task Completed",
          message: `Task "${task.title}" has been completed by ${completedByUser?.name || completedByUser?.email || "a user"}${comment ? `. Comment: ${comment}` : ""}`,
        }),
      );
      logger.info(
        `In-app notification queued for task completion: Task "${task.title}" to user ${user.email}`,
      );
    }

    // Send event notifications (email/WhatsApp) if enabled
    const channels = [];
    if (emailEnabled) channels.push("email");
    if (whatsappEnabled) channels.push("whatsapp");

    if (channels.length > 0) {
      const eventData = {
        taskTitle: task.title,
        taskId: task._id.toString(),
        completedByName:
          completedByUser?.name || completedByUser?.email || "Unknown",
        watcherName: user.name || user.email,
        name: user.name || user.email, // Standard 'name' variable
        companyName: company?.name || "Unknown Company",
        comment:
          comment ||
          task.validationRemarks ||
          task.description ||
          "Task completed successfully",
        remarks: comment || task.validationRemarks || "",
        status: "Completed",
        department: task.department || "N/A",
        projectName:
          (typeof task.projectId === "object"
            ? task.projectId?.name
            : task.projectId) || "Standalone Task",
      };

      logger.info(
        `Sending ${channels.join(", ")} notification(s) for task_completed to user ${user.email} (phone: ${user.phone || "N/A"})`,
      );

      try {
        notificationPromises.push(
          eventConfigService.sendEventNotification(
            "task_completed",
            eventData,
            {
              to: user.email,
              phone: user.phone,
              channels: channels,
              tenantCompanyId,
            },
          ),
        );
        logger.info(
          `Successfully queued ${channels.join(", ")} notification(s) for task_completed: Task "${task.title}" to user ${user.email}`,
        );
      } catch (error) {
        logger.error(
          `Failed to send task_completed event notification to user ${user.email}:`,
          error,
        );
      }
    } else {
      logger.info(
        `No email/WhatsApp notifications enabled for user ${user.email} (task_completed)`,
      );
    }
  }

  await Promise.all(notificationPromises);

  logger.info(
    `Task completion notifications processed: ${notificationPromises.length} notification(s) sent for task "${task.title}"`,
  );
};

// Helper function to determine project type from project
const getProjectTypeFromProject = (project) => {
  if (!project) return null;

  // Check departments to determine project type
  if (
    project.departments &&
    Array.isArray(project.departments) &&
    project.departments.length > 0
  ) {
    // Priority: website_designing > seo > digital_marketing > web_application_development
    if (project.departments.includes("website-designing"))
      return "website-designing";
    if (project.departments.includes("seo")) return "seo";
    if (project.departments.includes("digital-marketing"))
      return "digital-marketing";
    if (
      project.departments.includes("web-application-development") ||
      project.departments.includes("tech-team")
    )
      return "web-application-development";
  }

  // Check project name or description for keywords
  const name = (project.name || "").toLowerCase();
  const description = (project.description || "").toLowerCase();

  if (
    name.includes("website") ||
    description.includes("website") ||
    name.includes("design") ||
    description.includes("design")
  ) {
    return "website-designing";
  }
  if (name.includes("seo") || description.includes("seo")) {
    return "seo";
  }
  if (
    name.includes("digital marketing") ||
    description.includes("digital marketing") ||
    name.includes("marketing")
  ) {
    return "digital-marketing";
  }
  if (
    name.includes("web app") ||
    description.includes("web app") ||
    name.includes("development") ||
    description.includes("development") ||
    name.includes("application") ||
    description.includes("application")
  ) {
    return "web-application-development";
  }

  return null;
};

// Workflow configuration methods
const getWorkflowConfig = async (
  projectId,
  tenantCompanyId,
  projectType = null,
) => {
  // Normalize projectType/department name to match the slugified format saved in database
  let normalizedProjectType = projectType;
  if (normalizedProjectType && typeof normalizedProjectType === "string") {
    normalizedProjectType = normalizedProjectType
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Build query - only include projectId if it's a valid ObjectId
  const query = {
    tenantCompanyId,
    isActive: true,
  };

  // Priority: 1. Project-specific workflow, 2. Project type workflow, 3. Default workflow
  let config = null;

  // First, try to find project-specific workflow
  if (projectId && projectId !== "null" && projectId !== "") {
    query.projectId = projectId;
    query.projectType = null; // Project-specific workflows don't have projectType
    config = await WorkflowConfig.findOne(query);
    if (config) {
      return config;
    }
  }

  // Second, try to find project type workflow
  // If projectType not provided, try to get it from project
  if (!normalizedProjectType && projectId && projectId !== "null" && projectId !== "") {
    const Project = require('./shimProjectModel');
    const project = await Project.findById(projectId).lean();
    if (project) {
      normalizedProjectType = getProjectTypeFromProject(project);
    }
  }

  if (normalizedProjectType) {
    query.projectId = null;
    query.projectType = normalizedProjectType;
    config = await WorkflowConfig.findOne(query);
    if (config) {
      return config;
    }
  }

  // Third, try default workflow (no projectId, no projectType)
  query.projectId = null;
  query.projectType = null;
  config = await WorkflowConfig.findOne(query);

  if (config) {
    return config;
  }

  // Return default workflow if no custom config
  return {
    defaultStatuses: true,
    statuses: [
      { id: "backlog", name: "Hold", color: "#8c8c8c", order: 0 },
      { id: "to_do", name: "To Do", color: "#1890ff", order: 1 },
      { id: "in_progress", name: "In Progress", color: "#faad14", order: 2 },
      { id: "review", name: "Review", color: "#722ed1", order: 3 },
      { id: "Rejected", name: "Rejected", color: "#ff4d4f", order: 4 },
      { id: "done", name: "Done", color: "#52c41a", order: 5 },
    ],
  };
};

const createOrUpdateWorkflowConfig = async (configData, tenantCompanyId) => {
  // Build query to find existing config
  const query = {
    tenantCompanyId,
  };

  // If projectId is provided, it's a project-specific workflow
  if (
    configData.projectId &&
    configData.projectId !== "null" &&
    configData.projectId !== ""
  ) {
    query.projectId = configData.projectId;
    query.projectType = null; // Project-specific workflows don't have projectType
  } else if (configData.projectType) {
    // If projectType is provided, it's a project type template
    query.projectId = null;
    query.projectType = configData.projectType;
  } else {
    // Default workflow
    query.projectId = null;
    query.projectType = null;
  }

  const existing = await WorkflowConfig.findOne(query);

  if (existing) {
    existing.name = configData.name;
    existing.statuses = configData.statuses;
    existing.isActive =
      configData.isActive !== undefined ? configData.isActive : true;
    existing.projectType = configData.projectType || null; // Update projectType if changed
    existing.color = configData.color || existing.color || "#1890ff"; // Update color
    await existing.save();
    return existing;
  }

  return await WorkflowConfig.create({
    ...configData,
    projectId: configData.projectId || null,
    projectType: configData.projectType || null,
    color: configData.color || "#1890ff",
    tenantCompanyId,
  });
};

// Get all workflow configurations for a tenant
const getAllWorkflowConfigs = async (tenantCompanyId) => {
  const configs = await WorkflowConfig.find({ tenantCompanyId })
    .populate("projectId", "name color departments")
    .sort({ createdAt: -1 })
    .lean();

  return configs;
};

// Notification settings methods
// These now work with company-level settings instead of user-level
const getNotificationSettings = async (userId, tenantCompanyId) => {
  let settings = await CompanyNotificationSettings.findOne({
    companyId: tenantCompanyId,
  });

  if (!settings) {
    // Create default company settings if not found
    settings = await CompanyNotificationSettings.create({
      companyId: tenantCompanyId,
    });
    logger.info(
      `Created default company notification settings for company ${tenantCompanyId}`,
    );
  }

  const integrationConfig = await resolveCompanyIntegrations(tenantCompanyId);
  enforceTaskNotificationChannelsByIntegration(settings, integrationConfig);
  await settings.save();

  return settings;
};

const updateNotificationSettings = async (
  userId,
  tenantCompanyId,
  settingsData,
) => {
  const integrationConfig = await resolveCompanyIntegrations(tenantCompanyId);
  enforceTaskNotificationChannelsByIntegration(settingsData, integrationConfig);

  const settings = await CompanyNotificationSettings.findOneAndUpdate(
    { companyId: tenantCompanyId },
    { $set: settingsData },
    { new: true, upsert: true },
  );

  logger.info(
    `Updated company notification settings for company ${tenantCompanyId}`,
  );
  return settings;
};

const deleteTask = async (taskId, tenantCompanyId) => {
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);
  const task = await Task.findOne({
    _id: taskId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    companyId: { $in: clientCompanyIds },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const wasCompleted = ["completed", "validated", "done", "complete"].includes(task.status);

  // Restore/reconcile counts if task was linked to a project
  if (task.projectId) {
    const Project = require('./shimProjectModel');
    const project = await Project.findById(task.projectId);
    if (project && task.serviceType) {
      const standardTypes = ["poster", "video", "shoot"];
      if (standardTypes.includes(task.serviceType)) {
        // Always restore the remaining count (task slot opens up again)
        if (task.serviceType === "poster") {
          project.remainingPosters = (project.remainingPosters || 0) + 1;
          // If it was completed, also decrement the completed count
          if (wasCompleted && project.completedPosters > 0) {
            project.completedPosters = (project.completedPosters || 1) - 1;
          }
        } else if (task.serviceType === "video") {
          project.remainingVideos = (project.remainingVideos || 0) + 1;
          if (wasCompleted && project.completedVideos > 0) {
            project.completedVideos = (project.completedVideos || 1) - 1;
          }
        } else if (task.serviceType === "shoot") {
          project.remainingShoots = (project.remainingShoots || 0) + 1;
          if (wasCompleted && project.completedShoots > 0) {
            project.completedShoots = (project.completedShoots || 1) - 1;
          }
        }
        logger.info(
          `Restored ${task.serviceType} count for project ${project._id} due to task deletion (wasCompleted: ${wasCompleted}).`,
        );
      } else {
        // Restore dynamic category remaining count
        const catIndex = (project.selectedCategories || []).findIndex(
          (c) =>
            c.name === task.serviceType || c.categoryName === task.serviceType,
        );
        if (catIndex > -1) {
          const cat = project.selectedCategories[catIndex];
          cat.remaining = (cat.remaining || 0) + 1;
          if (wasCompleted && cat.completed > 0) {
            cat.completed = (cat.completed || 1) - 1;
          }
          project.markModified("selectedCategories");
          logger.info(
            `Restored dynamic category "${task.serviceType}" count for project ${project._id} due to task deletion. New remaining: ${cat.remaining}`,
          );
        }
      }

      await project.save();
    }
  }

  // Hard delete
  await Task.findByIdAndDelete(taskId);

  // Reconcile after deletion so counts are accurate based on remaining tasks
  if (task.projectId) {
    const {
      reconcileProjectTaskCounts,
      checkAndMarkProjectCompleted,
    } = require('./shimProjectService');
    const projectId = task.projectId._id || task.projectId;
    await reconcileProjectTaskCounts(projectId, tenantCompanyId);
    await checkAndMarkProjectCompleted(projectId, null, tenantCompanyId);
  }

  return { success: true };
};

// Send reminder notification for overdue task
const sendTaskReminder = async (taskId, senderUserId, tenantCompanyId) => {
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);
  const task = await Task.findOne({
    _id: taskId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    companyId: { $in: clientCompanyIds },
  })
    .populate("assignedTo", "name email phone")
    .populate("companyId", "name")
    .populate("projectId", "name");

  if (!task) {
    throw new Error("Task not found");
  }

  if (!task.assignedTo) {
    throw new Error("Task has no assignee to send reminder to");
  }

  // Check if reminder was already sent today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (task.lastReminderSentAt && task.lastReminderSentAt >= today) {
    throw new Error("A reminder has already been sent for this task today");
  }

  const assigneeUser = task.assignedTo;
  const senderUser = await User.findById(senderUserId);

  // Get company notification settings
  let companySettings = await CompanyNotificationSettings.findOne({
    companyId: tenantCompanyId,
  });

  if (!companySettings) {
    companySettings = await CompanyNotificationSettings.create({
      companyId: tenantCompanyId,
    });
  }

  // Check event configuration for task_reminder
  const eventConfig =
    await eventConfigService.getEventConfigByType("task_reminder", tenantCompanyId);

  // Check integrations
  const whatsappIntegration = await Integration.findOne({
    type: "whatsapp",
    companyId: tenantCompanyId,
    isActive: true,
  });
  const whatsappIntegrationConfigured = !!(
    whatsappIntegration?.config?.backendUrl &&
    whatsappIntegration?.config?.apiToken
  );

  const emailIntegration = await Integration.findOne({
    type: "email",
    companyId: tenantCompanyId,
    isActive: true,
  });
  const emailIntegrationConfigured = !!(
    emailIntegration?.config?.clientId && emailIntegration?.config?.clientSecret
  );

  const whatsappEventEnabled =
    eventConfig?.isActive &&
    eventConfig?.whatsappTemplate?.enabled &&
    whatsappIntegrationConfigured;
  const emailEventEnabled =
    eventConfig?.isActive &&
    eventConfig?.emailTemplate?.enabled &&
    emailIntegrationConfigured;

  // Use company settings for task reminders (similar to task_assigned)
  const inAppEnabled =
    companySettings?.taskReminder?.inApp !== undefined
      ? companySettings.taskReminder.inApp
      : true; // Default to true
  const emailEnabled =
    (companySettings?.taskReminder?.email || false) && emailEventEnabled;
  const whatsappEnabled =
    (companySettings?.taskReminder?.whatsapp || false) && whatsappEventEnabled;

  logger.info(
    `Sending task reminder for task "${task.title}" (${task._id}) to ${assigneeUser.email}`,
  );

  let reminderSent = false;

  // Create in-app notification
  if (inAppEnabled) {
    try {
      const dueDate = task.dueDate ? formatDateToIST(task.dueDate) : "Not set";
      await createAndEmitNotification({
        userId: assigneeUser._id,
        taskId: task._id,
        type: "task_reminder",
        title: "Task Reminder",
        message: `Reminder: Task "${task.title}" is overdue. Due date was ${dueDate}`,
      });
      logger.info(
        `In-app reminder notification sent for task "${task.title}" to ${assigneeUser.email}`,
      );
      reminderSent = true;
    } catch (error) {
      logger.error("Failed to create in-app reminder notification:", error);
    }
  }

  // Send event notifications (email/WhatsApp) if enabled
  const channels = [];
  if (emailEnabled) channels.push("email");
  if (whatsappEnabled) channels.push("whatsapp");

  if (channels.length > 0) {
    const dueDate = task.dueDate ? formatDateToIST(task.dueDate) : "Not set";
    const eventData = {
      taskTitle: task.title,
      taskId: task._id.toString(),
      assignedToName: assigneeUser.name || assigneeUser.email,
      dueDate: dueDate,
      priority: task.priority || "medium",
      companyName: task.companyId?.name || "Unknown Company",
      projectName: task.projectId?.name || null,
      senderName: senderUser?.name || senderUser?.email || "System",
    };

    logger.info(
      `Sending ${channels.join(", ")} reminder notification(s) to ${assigneeUser.email}`,
    );

    try {
      await eventConfigService.sendEventNotification(
        "task_reminder",
        eventData,
        {
          to: assigneeUser.email,
          phone: assigneeUser.phone,
          channels: channels,
          tenantCompanyId,
        },
      );
      logger.info(
        `Successfully sent ${channels.join(", ")} reminder notification(s) for task "${task.title}" to ${assigneeUser.email}`,
      );
      reminderSent = true;
    } catch (error) {
      logger.error(
        `Failed to send task_reminder event notification to ${assigneeUser.email}:`,
        error,
      );
    }
  }

  // Update lastReminderSentAt if any notification was sent
  if (reminderSent) {
    task.lastReminderSentAt = new Date();
    await task.save({ validateBeforeSave: false }); // Avoid triggering pre-save hooks unnecessarily for just a date update
  }

  // Log activity
  await logTaskActivity(task._id, senderUserId, "reminder_sent", {
    description: `Reminder sent to ${assigneeUser.name || assigneeUser.email}`,
  });

  return { success: true, message: "Reminder sent successfully" };
};

const getTodayTaskStats = async (
  userId,
  tenantCompanyId,
  selectedClientCompanyId = null,
) => {
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const completedStatuses = ["done", "completed", "validated", "complete", "review", "in_review", "in review", "reviewing"];

  // 1. All active (incomplete) tasks assigned to the user that overlap with today
  // Task must have started on or before today, and due on or after today (so it's active today)
  const activeTasksCount = await Task.countDocuments({
    assignedTo: userId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    ...(selectedClientCompanyId ? { companyId: selectedClientCompanyId } : {}),
    status: { $nin: completedStatuses },
    startDate: { $lte: todayEnd },
    dueDate: { $gte: todayStart },
  });

  // 2. All tasks completed by the user TODAY
  const completedTodayCount = await Task.countDocuments({
    assignedTo: userId,
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    ...(selectedClientCompanyId ? { companyId: selectedClientCompanyId } : {}),
    status: { $in: completedStatuses },
    $or: [
      { actualCompletionDate: { $gte: todayStart, $lte: todayEnd } },
      { workCompletedAt: { $gte: todayStart, $lte: todayEnd } }
    ]
  });

  const totalToday = activeTasksCount + completedTodayCount;
  const completedToday = completedTodayCount;

  logger.info(
    `Today Stats for User ${userId}: Completed ${completedToday}, Total ${totalToday}`,
  );
  return { completedToday, totalToday };
};

const getTodayAssignedTaskBreakdownForDigitalMarketing = async (
  tenantCompanyId,
  selectedClientCompanyId = null,
) => {
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const digitalMarketingRoles = [
    "digital_marketing_coordinator",
    "digital_marketing_manager",
    "designer",
    "video_editor",
    "editor",
    "seo",
    "coordinator",
  ];

  const dmUsers = await User.find({
    companyId: tenantCompanyId,
    isActive: true,
    $or: [
      { role: { $in: digitalMarketingRoles } },
      { team: { $regex: "marketing", $options: "i" } },
    ],
  })
    .select("name email role team")
    .lean();

  const dmUserIds = dmUsers.map((u) => u._id);
  const dmTasks = await Task.find({
    tenantCompanyId: { $in: [tenantCompanyId, ...clientCompanyIds] },
    ...(selectedClientCompanyId ? { companyId: selectedClientCompanyId } : {}),
    assignedTo: { $in: dmUserIds },
    department: "digital-marketing",
    // "Assigned today" in task planning is based on dueDate day-bucket.
    // Count all tasks regardless of if they are completed so capacity doesn't go back up.
    status: { $ne: "rejected" },
    dueDate: { $gte: todayStart, $lte: todayEnd },
  })
    .select("assignedTo")
    .lean();

  const assigneeMap = new Map();
  dmUsers.forEach((user) => {
    assigneeMap.set(user._id.toString(), {
      userId: user._id.toString(),
      userName: user.name || user.email || "Unknown User",
      userEmail: user.email || "",
      role: user.role || "",
      team: user.team || "",
      taskCount: 0,
    });
  });

  dmTasks.forEach((task) => {
    const key = task.assignedTo?.toString();
    if (!key || !assigneeMap.has(key)) return;
    assigneeMap.get(key).taskCount += 1;
  });

  const breakdown = Array.from(assigneeMap.values()).sort((a, b) => {
    if (b.taskCount !== a.taskCount) return b.taskCount - a.taskCount;
    return a.userName.localeCompare(b.userName);
  });

  return {
    totalAssignedToday: dmTasks.length,
    breakdown,
    date: todayStart,
  };
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
  createOrUpdateWorkflowConfig,
  getAllWorkflowConfigs,
  getNotificationSettings,
  updateNotificationSettings,
  deleteTask,
  sendTaskReminder,
  updateTaskScreenshot,
  getTodayTaskStats,
  getTodayAssignedTaskBreakdownForDigitalMarketing,
};
