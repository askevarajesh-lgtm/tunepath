const mongoose = require("mongoose");
const SEO = require("./seo.model");
const Task = require("../tasks/task.model");
const TimelineEvent = require("../projects/timeline.model");
const { createTimelineEvent } = require("../projects/shimTimelineHelper");

// Get all SEO entries
// When user.role is 'seo', filter to only entries created by that user; admin/coordinators see all
const getAllSEO = async (tenantCompanyId, reqQuery = {}, user = null) => {
  const {
    buildQuery,
    executePaginatedQuery,
  } = require("../../utils/pagination.helper");

  const additionalFilters = {
    companyId: tenantCompanyId,
  };

  const isAdminOrCoordinator =
    user &&
    [
      "admin",
      "super_admin",
      "digital_marketing_coordinator",
      "website_coordinator",
    ].includes(user.role);
  if (user && user._id && !isAdminOrCoordinator && user.role === "seo") {
    additionalFilters.createdBy = user._id;
  }

  const queryOptions = buildQuery(reqQuery, {
    searchFields: ["websiteLink", "keywords"],
    defaultSortField: "createdAt",
    defaultSortOrder: "desc",
    additionalFilters,
  });

  return await executePaginatedQuery(SEO, queryOptions, [
    {
      path: "clientCompanyId",
      select: "name email phone",
      strictPopulate: false,
    },
    { path: "createdBy", select: "name email" },
    { path: "updatedBy", select: "name email" },
  ]);
};

// Get SEO by ID
const getSEOById = async (seoId, tenantCompanyId) => {
  const seo = await SEO.findOne({
    _id: seoId,
    companyId: tenantCompanyId,
  })
    .populate({
      path: "clientCompanyId",
      select: "name email phone address",
      strictPopulate: false,
    })
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .populate({ path: "taskId", select: "title status", strictPopulate: false })
    .populate({ path: "workUpdates.updatedBy", select: "name email" });

  if (!seo) {
    throw new Error("SEO entry not found");
  }

  return seo;
};

// Get SEO Timeline
const getSEOTimeline = async (seoId, tenantCompanyId) => {
  const seo = await SEO.findOne({
    _id: seoId,
    companyId: tenantCompanyId,
  });

  if (!seo) {
    throw new Error("SEO entry not found");
  }

  const timelineEvents = await TimelineEvent.find({
    companyId: tenantCompanyId,
    entityType: "seo",
    entityId: seoId,
  })
    .populate("performedByUserId", "name email")
    .sort({ createdAt: -1 });

  return timelineEvents;
};

// Create SEO entry
const createSEO = async (seoData, tenantCompanyId, userId) => {
  const User = require("../auth/user.model");
  const user = await User.findById(userId);

  const agencyAdminRoles = ["agency_super_admin", "agency_manager", "agency"];
  const commanderAdminRoles = ["supreme_super_admin", "superadmin", "commander_admin", "admin", "digital_marketing_coordinator", "website_coordinator"];
  
  if (user && !agencyAdminRoles.includes(user.role) && !commanderAdminRoles.includes(user.role)) {
    const existingSeoCount = await SEO.countDocuments({ companyId: tenantCompanyId });
    if (existingSeoCount >= 1) {
      throw new Error("Clients are allowed to create only one SEO/AEO/GEO project.");
    }
  }

  const seo = await SEO.create({
    ...seoData,
    companyId: tenantCompanyId,
    createdBy: userId,
    updatedBy: userId,
  });

  // Collect services for task description and timeline event
  const services = [];
  if (seo.contentWork) services.push("Content Work");
  if (seo.onpageSeo) services.push("On-page SEO");
  if (seo.technicalSeo) services.push("Technical SEO");
  if (seo.localSeo) services.push("Local SEO");
  if (seo.keywordResearch) services.push("Keyword Research");
  if (seo.offPageSeo) services.push("Off-page SEO");

  // Create a task for this SEO work
  try {
    const Task = require("../tasks/task.model");
    const User = require("../auth/user.model");
    const user = await User.findById(userId);

    const taskTitle = `SEO Work: ${seo.websiteLink}`;
    const taskDescription = `SEO work for ${seo.websiteLink}${seo.keywords ? `\nKeywords: ${seo.keywords}` : ""}${services.length > 0 ? `\nServices: ${services.join(", ")}` : ""}`;

    // Create task - if clientCompanyId exists, use it; otherwise create without client
    const taskData = {
      title: taskTitle,
      description: taskDescription,
      department: "seo",
      tenantCompanyId: tenantCompanyId,
      assignedTo: userId, // Assign to creator by default
      assignedBy: userId,
      createdBy: userId,
      status: "assigned",
    };

    // Only add companyId if it exists
    if (seo.clientCompanyId) {
      taskData.companyId = seo.clientCompanyId;
    } else {
      // If no client, we need to get a default client or skip task creation
      // For now, we'll skip task creation if no client
      // You can modify this logic based on your requirements
    }

    // Create task only if we have a clientCompanyId
    if (seo.clientCompanyId) {
      const taskService = require("../tasks/task.service");
      const task = await taskService.createTask(
        taskData,
        tenantCompanyId,
        userId,
      );

      // Link task to SEO entry
      seo.taskId = task._id;
      await seo.save();
    }
  } catch (error) {
    // Log error but don't fail SEO creation if task creation fails
    console.error("Error creating task for SEO entry:", error);
  }

  // Populate before returning
  await seo.populate([
    {
      path: "clientCompanyId",
      select: "name email phone",
      strictPopulate: false,
    },
    { path: "createdBy", select: "name email" },
    { path: "updatedBy", select: "name email" },
    { path: "taskId", select: "title status", strictPopulate: false },
  ]);

  // Create timeline event (reuse services array from above)
  await createTimelineEvent({
    eventType: "seo_created",
    entityType: "seo",
    entityId: seo._id,
    performedByUserId: userId,
    description: `SEO entry created for ${seo.websiteLink}`,
    metadata: {
      websiteLink: seo.websiteLink,
      keywords: seo.keywords || null,
      services: services.length > 0 ? services : null,
      offPageSeoCount: seo.offPageSeoCount || 0,
      taskId: seo.taskId ? seo.taskId.toString() : null,
    },
    companyId: tenantCompanyId,
  });

  return seo;
};

// Update SEO entry
const updateSEO = async (seoId, seoData, tenantCompanyId, userId) => {
  const seo = await SEO.findOne({
    _id: seoId,
    companyId: tenantCompanyId,
  });

  if (!seo) {
    throw new Error("SEO entry not found");
  }

  // Track which fields changed
  const fieldsChanged = [];
  const oldValues = {};

  // Update fields and track changes
  Object.keys(seoData).forEach((key) => {
    if (seoData[key] !== undefined) {
      // Store old value for comparison
      if (seo[key] !== seoData[key]) {
        oldValues[key] = seo[key];
        fieldsChanged.push(key);
      }
      // Only update if value is not null (unless explicitly set to null)
      // For file fields, if they're undefined, don't update (preserve existing)
      if (key === "websiteAuditScreenshot" || key === "credentialsFile") {
        // Only update file fields if they have a value (URL string)
        if (seoData[key] !== null && seoData[key] !== undefined) {
          seo[key] = seoData[key];
        }
        // If null or undefined, don't update (preserve existing file)
      } else {
        seo[key] = seoData[key];
      }
    }
  });

  // Handle credentialsFileName - only set if credentialsFile exists
  // If credentialsFile is being set, update credentialsFileName
  // If credentialsFile is null/undefined and credentialsFileName is not provided, keep existing filename
  if (seoData.credentialsFile !== undefined) {
    if (seoData.credentialsFile) {
      // New file uploaded, update filename if provided
      if (seoData.credentialsFileName !== undefined) {
        seo.credentialsFileName = seoData.credentialsFileName;
      }
    } else {
      // File is being removed (set to null), also remove filename
      seo.credentialsFileName = null;
    }
  }

  seo.updatedBy = userId;

  await seo.save();

  // Populate before returning
  await seo.populate([
    {
      path: "clientCompanyId",
      select: "name email phone",
      strictPopulate: false,
    },
    { path: "createdBy", select: "name email" },
    { path: "updatedBy", select: "name email" },
  ]);

  // Collect services for metadata
  const services = [];
  if (seo.contentWork) services.push("Content Work");
  if (seo.onpageSeo) services.push("On-page SEO");
  if (seo.technicalSeo) services.push("Technical SEO");
  if (seo.localSeo) services.push("Local SEO");
  if (seo.keywordResearch) services.push("Keyword Research");

  // Create timeline event
  await createTimelineEvent({
    eventType: "seo_updated",
    entityType: "seo",
    entityId: seo._id,
    performedByUserId: userId,
    description: `SEO entry updated for ${seo.websiteLink}`,
    metadata: {
      websiteLink: seo.websiteLink,
      keywords: seo.keywords || null,
      services: services.length > 0 ? services : null,
      offPageSeoCount: seo.offPageSeoCount || 0,
      fieldsChanged: fieldsChanged.length > 0 ? fieldsChanged : null,
    },
    companyId: tenantCompanyId,
  });

  return seo;
};

// Delete SEO entry (soft delete)
const deleteSEO = async (seoId, tenantCompanyId, userId) => {
  const seo = await SEO.findOne({
    _id: seoId,
    companyId: tenantCompanyId,
  });

  if (!seo) {
    throw new Error("SEO entry not found");
  }

  // Hard delete
  await SEO.findByIdAndDelete(seoId);

  // Collect services for metadata
  const services = [];
  if (seo.contentWork) services.push("Content Work");
  if (seo.onpageSeo) services.push("On-page SEO");
  if (seo.technicalSeo) services.push("Technical SEO");
  if (seo.localSeo) services.push("Local SEO");
  if (seo.keywordResearch) services.push("Keyword Research");

  // Create timeline event
  await createTimelineEvent({
    eventType: "seo_deleted",
    entityType: "seo",
    entityId: seo._id,
    performedByUserId: userId,
    description: `SEO entry deleted for ${seo.websiteLink}`,
    metadata: {
      websiteLink: seo.websiteLink,
      keywords: seo.keywords || null,
      services: services.length > 0 ? services : null,
    },
    companyId: tenantCompanyId,
  });

  return seo;
};

// Get SEO Dashboard Statistics
const getSEODashboardStats = async (tenantCompanyId, userId = null) => {
  // Build filter - if userId is provided (SEO role), filter by createdBy for user-based dashboard
  const filter = {
    companyId: tenantCompanyId,
  };
  if (userId) {
    filter.createdBy = userId;
  }

  // Get total SEO entries
  const totalSEOEntries = await SEO.countDocuments(filter);

  // Get all SEO entries for calculations
  const seoEntries = await SEO.find(filter)
    .select(
      "websiteLink offPageSeoCount contentWork onpageSeo technicalSeo localSeo keywordResearch offPageSeo createdAt updatedAt workUpdates",
    )
    .populate({ path: "workUpdates.updatedBy", select: "name email" })
    .sort({ createdAt: -1 });

  // Calculate total off-page SEO count
  const totalOffPageSeoCount = seoEntries.reduce((sum, entry) => {
    return sum + (entry.offPageSeoCount || 0);
  }, 0);

  // Calculate service breakdown
  const serviceBreakdown = {
    contentWork: 0,
    onpageSeo: 0,
    technicalSeo: 0,
    localSeo: 0,
    keywordResearch: 0,
    offPageSeo: 0,
  };

  seoEntries.forEach((entry) => {
    if (entry.contentWork) serviceBreakdown.contentWork++;
    if (entry.onpageSeo) serviceBreakdown.onpageSeo++;
    if (entry.technicalSeo) serviceBreakdown.technicalSeo++;
    if (entry.localSeo) serviceBreakdown.localSeo++;
    if (entry.keywordResearch) serviceBreakdown.keywordResearch++;
    if (entry.offPageSeo) serviceBreakdown.offPageSeo++;
  });

  // Collect all work updates from all SEO entries
  const allWorkUpdates = [];
  seoEntries.forEach((entry) => {
    if (entry.workUpdates && entry.workUpdates.length > 0) {
      entry.workUpdates.forEach((update) => {
        allWorkUpdates.push({
          _id: update._id || `${entry._id}-${update.createdAt}`,
          seoId: entry._id,
          websiteLink: entry.websiteLink,
          workType: update.workType,
          completedWork: update.completedWork,
          screenshots: update.screenshots || [],
          updatedBy: update.updatedBy,
          createdAt: update.createdAt,
        });
      });
    }
  });

  // Sort work updates by date (newest first)
  allWorkUpdates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Get recent work updates (last 10)
  const recentWorkUpdates = allWorkUpdates.slice(0, 10);

  // Calculate work update statistics
  const totalWorkUpdates = allWorkUpdates.length;

  // Work updates by type
  const workUpdatesByType = {
    contentWork: 0,
    onpageSeo: 0,
    technicalSeo: 0,
    localSeo: 0,
    keywordResearch: 0,
    offPageSeo: 0,
  };

  allWorkUpdates.forEach((update) => {
    if (workUpdatesByType[update.workType] !== undefined) {
      workUpdatesByType[update.workType]++;
    }
  });

  // Get unique websites count
  const uniqueWebsites = new Set(
    seoEntries
      .map((entry) => entry.websiteLink?.toLowerCase().trim())
      .filter(Boolean),
  );
  const totalWebsites = uniqueWebsites.size;

  // Calculate average off-page SEO count per entry
  const averageOffPageSeoCount =
    totalSEOEntries > 0
      ? Math.round((totalOffPageSeoCount / totalSEOEntries) * 100) / 100
      : 0;

  // Get work updates in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentWorkUpdatesCount = allWorkUpdates.filter(
    (update) => update.createdAt && new Date(update.createdAt) >= thirtyDaysAgo,
  ).length;

  // Calculate total off-page backlink count from work updates
  const totalWorkUpdateBacklinkCount = seoEntries.reduce((sum, entry) => {
    const workUpdates = entry.workUpdates || [];
    const workUpdateSum = workUpdates
      .filter(
        (update) =>
          update.workType === "offPageSeo" &&
          update.offPageBacklinkCount !== undefined &&
          update.offPageBacklinkCount !== null,
      )
      .reduce(
        (updateSum, update) => updateSum + (update.offPageBacklinkCount || 0),
        0,
      );
    return sum + workUpdateSum;
  }, 0);

  // Calculate today's off-page backlink count from work updates
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayWorkUpdateBacklinkCount = seoEntries.reduce((sum, entry) => {
    const workUpdates = entry.workUpdates || [];
    const workUpdateSum = workUpdates
      .filter(
        (update) =>
          update.workType === "offPageSeo" &&
          update.offPageBacklinkCount !== undefined &&
          update.offPageBacklinkCount !== null &&
          update.createdAt &&
          new Date(update.createdAt) >= startOfToday,
      )
      .reduce(
        (updateSum, update) => updateSum + (update.offPageBacklinkCount || 0),
        0,
      );
    return sum + workUpdateSum;
  }, 0);

  // Calculate today's off-page SEO count from entries
  const todayOffPageSeoCount = seoEntries.reduce((sum, entry) => {
    if (entry.createdAt && new Date(entry.createdAt) >= startOfToday) {
      return sum + (entry.offPageSeoCount || 0);
    }
    return sum;
  }, 0);

  // Get task counts
  const taskFilter = {
    tenantCompanyId,
    ...(userId && { assignedTo: userId }),
  };

  const myTasksCount = await Task.countDocuments({
    ...taskFilter,
    status: { $nin: ["completed", "validated"] },
  });

  const completedTasksCount = await Task.countDocuments({
    ...taskFilter,
    status: { $in: ["completed", "validated"] },
  });

  return {
    totalSEOEntries,
    totalWebsites,
    totalOffPageSeoCount,
    totalWorkUpdateBacklinkCount,
    todayWorkUpdateBacklinkCount,
    todayOffPageSeoCount,
    averageOffPageSeoCount,
    serviceBreakdown,
    totalWorkUpdates,
    recentWorkUpdates,
    workUpdatesByType,
    recentWorkUpdatesCount,
    myTasksCount,
    completedTasksCount,
  };
};

// Add work update to SEO entry
const addWorkUpdate = async (
  seoId,
  workUpdateData,
  tenantCompanyId,
  userId,
) => {
  const seo = await SEO.findOne({
    _id: seoId,
    companyId: tenantCompanyId,
  });

  if (!seo) {
    throw new Error("SEO entry not found");
  }

  // Validate workType
  const validWorkTypes = [
    "contentWork",
    "onpageSeo",
    "technicalSeo",
    "localSeo",
    "keywordResearch",
    "offPageSeo",
  ];
  if (
    !workUpdateData.workType ||
    !validWorkTypes.includes(workUpdateData.workType)
  ) {
    throw new Error("Valid work type is required");
  }

  // Verify that the selected work type is enabled for this SEO entry
  if (!seo[workUpdateData.workType]) {
    throw new Error(
      `The selected work type (${workUpdateData.workType}) is not enabled for this SEO entry`,
    );
  }

  // Create work update entry
  const workUpdate = {
    workType: workUpdateData.workType,
    completedWork: workUpdateData.completedWork,
    screenshots: workUpdateData.screenshots || [],
    updatedBy: userId,
    createdAt: new Date(),
    ...(workUpdateData.offPageBacklinkCount !== undefined &&
      workUpdateData.offPageBacklinkCount !== null && {
        offPageBacklinkCount: workUpdateData.offPageBacklinkCount,
      }),
  };

  // Add to workUpdates array
  if (!seo.workUpdates) {
    seo.workUpdates = [];
  }
  seo.workUpdates.push(workUpdate);

  seo.updatedBy = userId;
  await seo.save();

  // Populate before returning
  await seo.populate([
    {
      path: "clientCompanyId",
      select: "name email phone",
      strictPopulate: false,
    },
    { path: "createdBy", select: "name email" },
    { path: "updatedBy", select: "name email" },
    { path: "taskId", select: "title status", strictPopulate: false },
    { path: "workUpdates.updatedBy", select: "name email" },
  ]);

  // Create timeline event for work update
  const workTypeLabels = {
    contentWork: "Content Work",
    onpageSeo: "On-page SEO",
    technicalSeo: "Technical SEO",
    localSeo: "Local SEO",
    keywordResearch: "Keyword Research",
    offPageSeo: "Off-page SEO",
  };

  await createTimelineEvent({
    eventType: "seo_work_update",
    entityType: "seo",
    entityId: seo._id,
    performedByUserId: userId,
    description: `${workTypeLabels[workUpdateData.workType] || workUpdateData.workType} update: ${workUpdateData.completedWork.substring(0, 100)}${workUpdateData.completedWork.length > 100 ? "..." : ""}`,
    metadata: {
      websiteLink: seo.websiteLink,
      workType: workUpdateData.workType,
      completedWork: workUpdateData.completedWork,
      screenshotCount: workUpdateData.screenshots?.length || 0,
    },
    companyId: tenantCompanyId,
  });

  return seo;
};

// Get Client-wise and User-wise SEO Work Report
const getSEOClientUserReport = async (tenantCompanyId, filters = {}) => {
  const {
    clientCompanyId,
    startDate,
    endDate,
    includeNoClient = false,
    projectId,
  } = filters;

  // Build base query
  const query = {
    companyId: tenantCompanyId,
  };

  // Filter by client if provided
  if (clientCompanyId) {
    query.clientCompanyId = clientCompanyId;
  } else if (!includeNoClient) {
    // Exclude entries without clients unless explicitly requested
    query.clientCompanyId = { $ne: null };
  }

  // Filter by date range if provided
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  // Get all SEO entries matching the query
  const seoEntries = await SEO.find(query)
    .populate("clientCompanyId", "name email phone")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .populate({ path: "workUpdates.updatedBy", select: "name email" })
    .populate({
      path: "taskId",
      select: "companyId projectId",
      populate: [
        {
          path: "companyId",
          select: "name email phone",
        },
        {
          path: "projectId",
          select: "name",
        },
      ],
      strictPopulate: false,
    })
    .sort({ createdAt: -1 });

  // Filter by project if provided
  let filteredEntries = seoEntries;
  if (projectId) {
    filteredEntries = seoEntries.filter(
      (entry) =>
        entry.taskId &&
        entry.taskId.projectId &&
        (entry.taskId.projectId._id?.toString() === projectId ||
          entry.taskId.projectId.toString() === projectId),
    );
  }

  // For entries without direct client, try to get from task
  for (const entry of filteredEntries) {
    if (!entry.clientCompanyId && entry.taskId && entry.taskId.companyId) {
      entry.clientCompanyId = entry.taskId.companyId;
    }
  }

  // Group by client
  const clientMap = new Map();

  filteredEntries.forEach((entry) => {
    // Try to get client from multiple sources
    let client = entry.clientCompanyId;

    // If no direct client, try to get from task -> project -> client
    if (!client && entry.taskId) {
      if (entry.taskId.projectId && entry.taskId.projectId.clientId) {
        client = entry.taskId.projectId.clientId;
      } else if (entry.taskId.companyId) {
        // Task has companyId (which is clientCompanyId in task model)
        // We need to fetch the client company
        const ClientCompany = require("../companies/company.model");
        // Note: This is a synchronous check, but we'll handle it in the async context
        // For now, we'll use the task's companyId if available
        // This would require additional query, so we'll skip for now and handle it differently
      }
    }

    const clientId = client?._id?.toString() || "no-client";
    const clientName = client?.name || "No Client";

    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, {
        clientId,
        clientName,
        clientEmail: client?.email || null,
        clientPhone: client?.phone || null,
        seoEntries: [],
        totalBacklinks: 0,
        totalWorkUpdates: 0,
        users: new Map(), // Map of userId -> user data
      });
    }

    const clientData = clientMap.get(clientId);

    // Add SEO entry info
    const entryData = {
      seoId: entry._id,
      websiteLink: entry.websiteLink,
      keywords: entry.keywords,
      projectId:
        entry.taskId?.projectId?._id || entry.taskId?.projectId || null,
      projectName: entry.taskId?.projectId?.name || null,
      workUpdates: [],
    };

    // Process work updates
    if (entry.workUpdates && Array.isArray(entry.workUpdates)) {
      entry.workUpdates.forEach((update) => {
        const updateData = {
          workUpdateId: update._id,
          workType: update.workType,
          completedWork: update.completedWork,
          offPageBacklinkCount: update.offPageBacklinkCount || 0,
          updatedBy: update.updatedBy
            ? {
                _id: update.updatedBy._id,
                name: update.updatedBy.name,
                email: update.updatedBy.email,
              }
            : null,
          createdAt: update.createdAt,
          projectId: entryData.projectId,
          projectName: entryData.projectName,
        };

        entryData.workUpdates.push(updateData);
        clientData.totalWorkUpdates++;
        clientData.totalBacklinks += updateData.offPageBacklinkCount;

        // Track user contributions
        if (update.updatedBy) {
          const userId = update.updatedBy._id.toString();

          if (!clientData.users.has(userId)) {
            clientData.users.set(userId, {
              userId,
              userName: update.updatedBy.name,
              userEmail: update.updatedBy.email,
              workUpdates: [],
              totalBacklinks: 0,
              workUpdateCount: 0,
            });
          }

          const userData = clientData.users.get(userId);
          userData.workUpdates.push({
            seoId: entry._id,
            websiteLink: entry.websiteLink,
            workUpdateId: update._id,
            workType: update.workType,
            completedWork: update.completedWork,
            offPageBacklinkCount: update.offPageBacklinkCount || 0,
            createdAt: update.createdAt,
            projectId: entryData.projectId,
            projectName: entryData.projectName,
          });
          userData.totalBacklinks += updateData.offPageBacklinkCount;
          userData.workUpdateCount++;
        }
      });
    }

    clientData.seoEntries.push(entryData);
  });

  // Convert Map to Array and filter by userId if provided
  let clientReports = Array.from(clientMap.values()).map((clientData) => {
    const usersArray = Array.from(clientData.users.values());

    // Filter by userId if provided
    let filteredUsers = usersArray;
    if (userId) {
      filteredUsers = usersArray.filter((u) => u.userId === userId);
    }

    return {
      clientId: clientData.clientId,
      clientName: clientData.clientName,
      clientEmail: clientData.clientEmail,
      clientPhone: clientData.clientPhone,
      totalBacklinks: clientData.totalBacklinks,
      totalWorkUpdates: clientData.totalWorkUpdates,
      totalSEOEntries: clientData.seoEntries.length,
      users: filteredUsers.map((user) => ({
        userId: user.userId,
        userName: user.userName,
        userEmail: user.userEmail,
        totalBacklinks: user.totalBacklinks,
        workUpdateCount: user.workUpdateCount,
        workUpdates: user.workUpdates,
      })),
      seoEntries: clientData.seoEntries,
    };
  });

  // Sort: actual clients first, then "no-client" entries
  clientReports.sort((a, b) => {
    if (a.clientId === "no-client" && b.clientId !== "no-client") return 1;
    if (a.clientId !== "no-client" && b.clientId === "no-client") return -1;
    return a.clientName.localeCompare(b.clientName);
  });

  // Filter out "no-client" entries unless explicitly requested
  if (!includeNoClient) {
    clientReports = clientReports.filter(
      (report) => report.clientId !== "no-client",
    );
  }

  // Filter out clients with no users if userId filter is applied
  const filteredReports = userId
    ? clientReports.filter((report) => report.users.length > 0)
    : clientReports;

  // Calculate summary statistics (excluding "no-client" unless included)
  const reportsForSummary = includeNoClient
    ? filteredReports
    : filteredReports.filter((r) => r.clientId !== "no-client");

  const summary = {
    totalClients: reportsForSummary.length,
    totalUsers: new Set(
      reportsForSummary.flatMap((r) => r.users.map((u) => u.userId)),
    ).size,
    totalBacklinks: reportsForSummary.reduce(
      (sum, r) => sum + r.totalBacklinks,
      0,
    ),
    totalWorkUpdates: reportsForSummary.reduce(
      (sum, r) => sum + r.totalWorkUpdates,
      0,
    ),
    totalSEOEntries: reportsForSummary.reduce(
      (sum, r) => sum + r.totalSEOEntries,
      0,
    ),
  };

  return {
    summary,
    clientReports: filteredReports,
  };
};

// Get unique websites with aggregated stats
const getSEOUniqueWebsites = async (tenantCompanyId) => {
  const result = await SEO.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(tenantCompanyId) } },
    {
      $addFields: {
        backlinksFromUpdates: {
          $sum: {
            $map: {
              input: { $ifNull: ["$workUpdates", []] },
              as: "update",
              in: { $ifNull: ["$$update.offPageBacklinkCount", 0] },
            },
          },
        },
      },
    },
    {
      $group: {
        _id: "$websiteLink",
        entries: { $push: "$$ROOT" },
        totalOffPageCount: { $sum: { $ifNull: ["$offPageSeoCount", 0] } },
        totalBacklinksFromUpdates: { $sum: "$backlinksFromUpdates" },
        entryCount: { $sum: 1 },
      },
    },
    {
      $project: {
        websiteLink: "$_id",
        _id: 0,
        totalOffPageCount: 1,
        totalBacklinksFromUpdates: 1,
        entryCount: 1,
        // Collect all keywords and filter out duplicates
        allKeywordsList: {
          $reduce: {
            input: "$entries.keywords",
            initialValue: [],
            in: {
              $concatArrays: [
                "$$value",
                { $split: [{ $ifNull: ["$$this", ""] }, ","] },
              ],
            },
          },
        },
        entries: {
          $map: {
            input: "$entries",
            as: "e",
            in: {
              _id: "$$e._id",
              websiteLink: "$$e.websiteLink",
              keywords: "$$e.keywords",
              offPageSeoCount: "$$e.offPageSeoCount",
              createdAt: "$$e.createdAt",
              backlinks: "$$e.backlinksFromUpdates",
            },
          },
        },
      },
    },
    {
      $addFields: {
        // Clean up keywords: trim and remove empty/duplicates
        allKeywords: {
          $setUnion: {
            $filter: {
              input: {
                $map: {
                  input: "$allKeywordsList",
                  as: "k",
                  in: { $trim: { input: "$$k" } },
                },
              },
              as: "k",
              cond: { $ne: ["$$k", ""] },
            },
          },
        },
      },
    },
    {
      $addFields: {
        totalKeywordsCount: { $size: "$allKeywords" },
      },
    },
    { $sort: { websiteLink: 1 } },
  ]);

  return result;
};

module.exports = {
  getAllSEO,
  getSEOById,
  getSEOTimeline,
  createSEO,
  updateSEO,
  deleteSEO,
  getSEODashboardStats,
  addWorkUpdate,
  getSEOClientUserReport,
  getSEOUniqueWebsites,
};
