const mongoose = require("mongoose");
const Project = require("./project.model");
const Task = require("../tasks/task.model");
const MasterItem = require("../masterItems/masterItem.model");
const ClientCompany = require("./shimProjectModel");
const Invoice = require("./shimInvoiceModel");
const { Service, Plan } = require("./shimOperationModel");
const { createTimelineEvent } = require("./shimTimelineHelper");
const {
  buildQuery,
  executePaginatedQuery,
} = require("./shimPagination");
const {
  buildDropdownQuery,
  executeDropdownQuery,
} = require("./shimDropdown");
const {
  MASTER_ITEM_NAME_WHITELIST,
} = require("./dummyConfig");

const WEBSITE_COORDINATOR_DEPARTMENTS = [
  "website-designing",
  "web-application-development",
];

const parseHandlingDurationMonths = (duration) => {
  if (!duration) return 0;
  const text = String(duration).trim().toLowerCase();
  const match = text.match(/(\d+)/);
  if (!match) return 0;
  const months = Number(match[1]) || 0;
  return months > 0 ? months : 0;
};

// Helper function to get client company IDs for a tenant
const getClientCompanyIds = async (tenantCompanyId) => {
  const User = require("../auth/user.model");
  const clientCompanies = await User.find({
    $or: [
      { agencyId: tenantCompanyId },
      { adminId: tenantCompanyId },
      { brandId: tenantCompanyId },
      { _id: tenantCompanyId }
    ]
  }).select("_id");
  return clientCompanies.map((cc) => cc._id);
};

const toNonNegativeNumber = (value) => Math.max(0, Number(value) || 0);

const getProjectCountTriple = (totalValue, completedValue, remainingValue) => {
  const overall = toNonNegativeNumber(totalValue);
  const completed =
    completedValue === undefined || completedValue === null
      ? Math.max(overall - toNonNegativeNumber(remainingValue), 0)
      : toNonNegativeNumber(completedValue);
  const remaining = Math.max(overall - completed, 0);

  return { overall, completed, remaining };
};

const getProjectServiceTypeLabel = (project) => {
  const serviceName = project?.masterItemId?.name || "N/A";
  const packageName = project?.packageName ? ` (${project.packageName})` : "";
  return `${serviceName}${packageName}`;
};

const getProjectCategoryLabel = (category = {}, masterCategory = {}, index = 0) =>
  category?.categoryName || category?.name || masterCategory?.categoryName || masterCategory?.name || `Category ${index + 1}`;

const createCountTotals = () => ({
  overall: 0,
  completed: 0,
  remaining: 0,
});

const addCountTotals = (target, source = {}) => {
  target.overall += toNonNegativeNumber(source.overall);
  target.completed += toNonNegativeNumber(source.completed);
  target.remaining += toNonNegativeNumber(source.remaining);
  return target;
};

const getProjectGrandTotals = (...totals) =>
  totals.reduce(
    (accumulator, current) => addCountTotals(accumulator, current),
    createCountTotals(),
  );

const hasProjectReportFilters = (reqQuery = {}) =>
  [
    "search",
    "status",
    "companyId",
    "itemName",
    "masterItemName",
    "masterItemId",
    "startDate",
    "endDate",
  ].some((key) => {
    const value = reqQuery[key];
    return (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== "null" &&
      value !== "undefined"
    );
  });

const buildProjectReportData = (projects = []) => {
  const reportSummary = {
    projectsCount: projects.length,
    clientsCount: 0,
    serviceRowsCount: 0,
    categoryRowsCount: 0,
    posters: createCountTotals(),
    videos: createCountTotals(),
    shoots: createCountTotals(),
    other: createCountTotals(),
    total: createCountTotals(),
  };

  const projectRows = [];
  const serviceBreakdown = [];
  const categoryBreakdown = [];
  const clientSummaryMap = new Map();

  projects.forEach((project) => {
    const clientId =
      project?.clientId?._id?.toString?.() ||
      project?.clientId?.toString?.() ||
      "N/A";
    const clientName = project?.clientId?.name || "N/A";
    const serviceType = getProjectServiceTypeLabel(project);
    const posters = getProjectCountTriple(
      project?.numberOfPosters,
      project?.completedPosters,
      project?.remainingPosters,
    );
    const videos = getProjectCountTriple(
      project?.numberOfVideos,
      project?.completedVideos,
      project?.remainingVideos,
    );
    const shoots = getProjectCountTriple(
      project?.numberOfShoots,
      project?.completedShoots,
      project?.remainingShoots,
    );
    const otherCategories = (Array.isArray(project?.selectedCategories)
      ? project.selectedCategories
      : []
    ).reduce(
      (accumulator, category) => {
        const counts = getProjectCountTriple(
          category?.quantity,
          category?.completed,
          category?.remaining,
        );
        addCountTotals(accumulator, counts);

        return accumulator;
      },
      { overall: 0, completed: 0, remaining: 0 },
    );

    const projectTotal = getProjectGrandTotals(posters, videos, shoots, otherCategories);

    if (posters.overall > 0 || posters.completed > 0 || posters.remaining > 0) {
      serviceBreakdown.push({
        projectId: project?._id?.toString?.() || "N/A",
        clientId,
        clientName,
        projectName: project?.name || "N/A",
        serviceType,
        serviceItem: "Posters",
        overallCount: posters.overall,
        completedCount: posters.completed,
        remainingCount: posters.remaining,
      });
    }

    if (videos.overall > 0 || videos.completed > 0 || videos.remaining > 0) {
      serviceBreakdown.push({
        projectId: project?._id?.toString?.() || "N/A",
        clientId,
        clientName,
        projectName: project?.name || "N/A",
        serviceType,
        serviceItem: "Videos",
        overallCount: videos.overall,
        completedCount: videos.completed,
        remainingCount: videos.remaining,
      });
    }

    if (shoots.overall > 0 || shoots.completed > 0 || shoots.remaining > 0) {
      serviceBreakdown.push({
        projectId: project?._id?.toString?.() || "N/A",
        clientId,
        clientName,
        projectName: project?.name || "N/A",
        serviceType,
        serviceItem: "Shoots",
        overallCount: shoots.overall,
        completedCount: shoots.completed,
        remainingCount: shoots.remaining,
      });
    }

    (Array.isArray(project?.selectedCategories)
      ? project.selectedCategories
      : []
    ).forEach((category, index) => {
      const counts = getProjectCountTriple(
        category?.quantity,
        category?.completed,
        category?.remaining,
      );

      const masterCategories = Array.isArray(project?.masterItemId?.selectedCategories) 
        ? project.masterItemId.selectedCategories 
        : [];
      const masterCategory = masterCategories[index] || {};

      if (counts.overall > 0 || counts.completed > 0 || counts.remaining > 0) {
        categoryBreakdown.push({
          projectId: project?._id?.toString?.() || "N/A",
          clientId,
          clientName,
          projectName: project?.name || "N/A",
          serviceType,
          categoryName: getProjectCategoryLabel(category, masterCategory, index),
          overallCount: counts.overall,
          completedCount: counts.completed,
          remainingCount: counts.remaining,
        });
      }
    });

    reportSummary.posters.overall += posters.overall;
    reportSummary.posters.completed += posters.completed;
    reportSummary.posters.remaining += posters.remaining;
    reportSummary.videos.overall += videos.overall;
    reportSummary.videos.completed += videos.completed;
    reportSummary.videos.remaining += videos.remaining;
    reportSummary.shoots.overall += shoots.overall;
    reportSummary.shoots.completed += shoots.completed;
    reportSummary.shoots.remaining += shoots.remaining;
    reportSummary.other.overall += otherCategories.overall;
    reportSummary.other.completed += otherCategories.completed;
    reportSummary.other.remaining += otherCategories.remaining;
    addCountTotals(reportSummary.total, projectTotal);

    projectRows.push({
      projectId: project?._id?.toString?.() || "N/A",
      clientId,
      projectName: project?.name || "N/A",
      clientName,
      serviceType,
      status: project?.status || "created",
      startDate: project?.startDate || null,
      endDate: project?.endDate || null,
      renewalDate: project?.renewalDate || null,
      postersOverallCount: posters.overall,
      postersCompletedCount: posters.completed,
      postersRemainingCount: posters.remaining,
      videosOverallCount: videos.overall,
      videosCompletedCount: videos.completed,
      videosRemainingCount: videos.remaining,
      shootsOverallCount: shoots.overall,
      shootsCompletedCount: shoots.completed,
      shootsRemainingCount: shoots.remaining,
      otherOverallCount: otherCategories.overall,
      otherCompletedCount: otherCategories.completed,
      otherRemainingCount: otherCategories.remaining,
      totalOverallCount: projectTotal.overall,
      totalCompletedCount: projectTotal.completed,
      totalRemainingCount: projectTotal.remaining,
    });

    if (!clientSummaryMap.has(clientId)) {
      clientSummaryMap.set(clientId, {
        clientId,
        clientName,
        projectsCount: 0,
        projectNames: [],
        posters: createCountTotals(),
        videos: createCountTotals(),
        shoots: createCountTotals(),
        other: createCountTotals(),
        total: createCountTotals(),
      });
    }

    const clientSummary = clientSummaryMap.get(clientId);
    clientSummary.projectsCount += 1;
    clientSummary.projectNames.push(project?.name || "N/A");
    addCountTotals(clientSummary.posters, posters);
    addCountTotals(clientSummary.videos, videos);
    addCountTotals(clientSummary.shoots, shoots);
    addCountTotals(clientSummary.other, otherCategories);
    addCountTotals(clientSummary.total, projectTotal);
  });

  reportSummary.clientsCount = clientSummaryMap.size;
  reportSummary.serviceRowsCount = serviceBreakdown.length;
  reportSummary.categoryRowsCount = categoryBreakdown.length;

  projectRows.sort((a, b) => {
    const clientDiff = String(a.clientName).localeCompare(String(b.clientName));
    if (clientDiff !== 0) return clientDiff;
    const projectDiff = String(a.projectName).localeCompare(String(b.projectName));
    if (projectDiff !== 0) return projectDiff;
    return String(a.serviceType).localeCompare(String(b.serviceType));
  });

  serviceBreakdown.sort((a, b) => {
    const clientDiff = String(a.clientName).localeCompare(String(b.clientName));
    if (clientDiff !== 0) return clientDiff;
    const projectDiff = String(a.projectName).localeCompare(String(b.projectName));
    if (projectDiff !== 0) return projectDiff;
    return String(a.serviceType).localeCompare(String(b.serviceType));
  });

  categoryBreakdown.sort((a, b) => {
    const clientDiff = String(a.clientName).localeCompare(String(b.clientName));
    if (clientDiff !== 0) return clientDiff;
    const projectDiff = String(a.projectName).localeCompare(String(b.projectName));
    if (projectDiff !== 0) return projectDiff;
    const categoryDiff = String(a.categoryName).localeCompare(String(b.categoryName));
    if (categoryDiff !== 0) return categoryDiff;
    return String(a.serviceType).localeCompare(String(b.serviceType));
  });

  const clientSummaries = Array.from(clientSummaryMap.values())
    .map((summary) => ({
      ...summary,
      projectNames: Array.from(new Set(summary.projectNames)).sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    }))
    .sort((a, b) => String(a.clientName).localeCompare(String(b.clientName)));

  return {
    projectRows,
    serviceBreakdown,
    categoryBreakdown,
    clientSummaries,
    summary: reportSummary,
  };
};

const COMPLETED_TASK_STATUSES = new Set([
  "review",
  "submitted",
  "completed",
  "validated",
  "done",
  "complete",
]);

const APPROVED_TASK_STATUSES = new Set([
  "completed",
  "validated",
  "done",
  "complete",
  "approved",
]);

const DELIVERABLE_KEY_ALIASES = new Map([
  ["poster", "poster"],
  ["posters", "poster"],
  ["image", "poster"],
  ["images", "poster"],
  ["video", "video"],
  ["videos", "video"],
  ["shoot", "shoot"],
  ["shoots", "shoot"],
  ["brochure", "brochure"],
  ["brochures", "brochure"],
]);

const normalizeDeliverableKey = (value) => {
  if (value === null || value === undefined) return "";

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");

  return DELIVERABLE_KEY_ALIASES.get(normalized) || normalized;
};

const appendNormalizedKey = (keys, value) => {
  const normalized = normalizeDeliverableKey(value);
  if (normalized && !keys.includes(normalized)) {
    keys.push(normalized);
  }
};

const getProjectCategoryKeys = (category = {}, masterCategory = null) => {
  const keys = [];

  appendNormalizedKey(keys, category.name);
  appendNormalizedKey(keys, category.categoryName);
  appendNormalizedKey(keys, category.type);

  if (masterCategory) {
    appendNormalizedKey(keys, masterCategory.name);
    appendNormalizedKey(keys, masterCategory.categoryName);
    appendNormalizedKey(keys, masterCategory.type);
  }

  return keys;
};

const summarizeProjectTasksByDeliverable = (tasks = []) => {
  const assignedCounts = new Map();
  const completedCounts = new Map();
  const approvedCounts = new Map();

  for (const task of tasks) {
    const key = normalizeDeliverableKey(task?.serviceType);
    if (!key) continue;

    const status = String(task?.status || "")
      .trim()
      .toLowerCase();

    if (status !== "rejected") {
      assignedCounts.set(key, (assignedCounts.get(key) || 0) + 1);
    }

    if (COMPLETED_TASK_STATUSES.has(status)) {
      completedCounts.set(key, (completedCounts.get(key) || 0) + 1);
    }

    // Only count as approved if explicitly approved by client or status is approved directly
    if (task?.clientReviewStatus === "approved" || status === "approved") {
      approvedCounts.set(key, (approvedCounts.get(key) || 0) + 1);
    }
  }

  return { assignedCounts, completedCounts, approvedCounts };
};

const getProjectServiceTarget = (project, serviceType) => {
  const key = normalizeDeliverableKey(serviceType);
  if (!key) {
    return { key: "", standardFields: null, dynamicMatch: null };
  }

  const standardFieldMap = {
    poster: {
      totalField: "numberOfPosters",
      remainingField: "remainingPosters",
      completedField: "completedPosters",
    },
    video: {
      totalField: "numberOfVideos",
      remainingField: "remainingVideos",
      completedField: "completedVideos",
    },
    shoot: {
      totalField: "numberOfShoots",
      remainingField: "remainingShoots",
      completedField: "completedShoots",
    },
  };

  const masterCategories = Array.isArray(project?.masterItemId?.selectedCategories)
    ? project.masterItemId.selectedCategories
    : (Array.isArray(project?.masterItemIds)
      ? project.masterItemIds.reduce((acc, m) => acc.concat(Array.isArray(m?.selectedCategories) ? m.selectedCategories : []), [])
      : []);

  let selectedCategories = Array.isArray(project?.selectedCategories) && project.selectedCategories.length > 0
    ? project.selectedCategories
    : [];

  if (selectedCategories.length === 0 && masterCategories.length > 0) {
    selectedCategories = masterCategories;
  }

  const dynamicIndex = selectedCategories.findIndex((category, index) =>
    getProjectCategoryKeys(category, masterCategories[index]).includes(key),
  );

  console.log(`[DEBUG getProjectServiceTarget] key: "${key}", dynamicIndex: ${dynamicIndex}, selectedCategories:`, JSON.stringify(selectedCategories));

  return {
    key,
    standardFields: standardFieldMap[key] || null,
    dynamicMatch:
      dynamicIndex > -1
        ? {
            index: dynamicIndex,
            category: selectedCategories[dynamicIndex],
          }
        : null,
  };
};

const projectSupportsServiceType = (project, serviceType) => {
  const target = getProjectServiceTarget(project, serviceType);
  if (!target.key) return false;

  if (target.dynamicMatch) return true;

  if (!target.standardFields) return false;

  return (Number(project?.[target.standardFields.totalField]) || 0) > 0;
};

const getProjectServiceCapacity = async (
  projectOrId,
  tenantCompanyId,
  serviceType,
  tasksInput = null,
) => {
  console.log(`[DEBUG getProjectServiceCapacity START] projectOrId:`, projectOrId, `tenantCompanyId:`, tenantCompanyId, `serviceType:`, serviceType);
  let project = projectOrId;
  const projectNeedsReload =
    project &&
    project._id &&
    project.save &&
    project.numberOfPosters === undefined &&
    project.numberOfVideos === undefined &&
    project.numberOfShoots === undefined &&
    project.selectedCategories === undefined;

  if (!project) {
    return {
      supported: false,
      total: 0,
      assigned: 0,
      remaining: 0,
      key: "",
      target: null,
      project: null,
    };
  }

  if (!project.save || !project._id || projectNeedsReload) {
    project = await Project.findOne({
      _id: project?._id || projectOrId,
      $or: [{ companyId: tenantCompanyId }, { clientId: tenantCompanyId }]
    }).populate("masterItemId", "selectedCategories")
      .populate("masterItemIds", "selectedCategories");
  }

  if (!project) {
    return {
      supported: false,
      total: 0,
      assigned: 0,
      remaining: 0,
      key: "",
      target: null,
      project: null,
    };
  }

  const tasks = Array.isArray(tasksInput)
    ? tasksInput
    : await Task.find({
        projectId: project._id,
      }).select("serviceType status clientReviewStatus");

  const { assignedCounts, completedCounts } = summarizeProjectTasksByDeliverable(tasks);
  const target = getProjectServiceTarget(project, serviceType);
  if (!target.key) {
    return {
      supported: false,
      total: 0,
      assigned: 0,
      completed: 0,
      remaining: 0,
      key: "",
      target,
      project,
    };
  }

  let total = 0;
  if (target.standardFields) {
    total = Math.max(
      total,
      Number(project[target.standardFields.totalField]) || 0,
    );
  }

  if (target.dynamicMatch) {
    total = Math.max(
      total,
      Number(target.dynamicMatch.category?.quantity) || 0,
    );
  }

  const assigned = assignedCounts.get(target.key) || 0;
  const completed = completedCounts.get(target.key) || 0;

  const ret = {
    supported: total > 0 || Boolean(target.dynamicMatch),
    total,
    assigned,
    completed,
    remaining: Math.max(0, total - completed),
    key: target.key,
    target,
    project,
  };
  console.log(`[DEBUG getProjectServiceCapacity] returning:`, { supported: ret.supported, total: ret.total, remaining: ret.remaining });
  return ret;
};

const reconcileProjectTaskCounts = async (
  projectOrId,
  tenantCompanyId,
  tasksInput = null,
) => {
  let project = projectOrId;
  const projectNeedsReload =
    project &&
    project._id &&
    project.save &&
    project.numberOfPosters === undefined &&
    project.numberOfVideos === undefined &&
    project.numberOfShoots === undefined &&
    project.selectedCategories === undefined;
  if (!project || !tenantCompanyId) return projectOrId;

  if (!project.save || !project._id || projectNeedsReload) {
    // Find project by _id only — companyId on a project is the client company,
    // while tenantCompanyId is the agency. Filtering by companyId here would miss the project.
    project = await Project.findById(project?._id || projectOrId)
      .populate("masterItemId", "selectedCategories")
      .populate("masterItemIds", "selectedCategories");
  }

  if (!project) return null;

  const tasks = Array.isArray(tasksInput)
    ? tasksInput
    : await Task.find({
        projectId: project._id,
      }).select("serviceType status clientReviewStatus");

  const { assignedCounts, completedCounts, approvedCounts } =
    summarizeProjectTasksByDeliverable(tasks);

  let changed = false;
  let selectedCategoriesChanged = false;

  const syncNumericField = (field, nextValue) => {
    const safeValue = Math.max(0, Number(nextValue) || 0);
    if ((Number(project[field]) || 0) !== safeValue) {
      project[field] = safeValue;
      changed = true;
    }
  };

  const syncStandardCounts = (key, totalField, remainingField, completedField, approvedField) => {
    let currentTotal = Math.max(0, Number(project[totalField]) || 0);
    
    // Recovery logic: Calculate total from categories if the current total is 0 or seems too low
    const masterCats = Array.isArray(project.masterItemIds) && project.masterItemIds.length > 0 
      ? project.masterItemIds[0].categories || [] 
      : [];
    const projCats = Array.isArray(project.selectedCategories) ? project.selectedCategories : [];
    
    let sumFromProj = 0;
    projCats.forEach(cat => {
      const name = (cat.name || cat.categoryName || '').toLowerCase();
      if (name.includes(key) && !name.includes("categories")) {
        sumFromProj += Math.max(0, Number(cat.quantity) || Number(cat.count) || 0);
      }
    });

    let sumFromMaster = 0;
    masterCats.forEach(cat => {
      const name = (cat.name || cat.categoryName || '').toLowerCase();
      if (name.includes(key) && !name.includes("categories")) {
        sumFromMaster += Math.max(0, Number(cat.quantity) || Number(cat.count) || 0);
      }
    });

    // Use the max of all found totals
    const total = Math.max(currentTotal, sumFromProj, sumFromMaster);
    if (total !== currentTotal) {
      project[totalField] = total;
      changed = true;
    }

    const assigned = assignedCounts.get(key) || 0;
    const completed = completedCounts.get(key) || 0;
    const approved = approvedCounts.get(key) || 0;

    const maxAllowedRemaining = Math.max(0, total - assigned);
    const currentRemaining = project[remainingField];
    
    const isUninitialized = (currentRemaining === 0 || currentRemaining === null || currentRemaining === undefined) 
      && total > 0 
      && assigned === 0 
      && completed === 0;
      
    // Strictly recalculate remaining based on total minus assigned
    const nextRemaining = maxAllowedRemaining;

    syncNumericField(remainingField, nextRemaining);
    syncNumericField(completedField, Math.min(total, completed));
    if (approvedField) {
      syncNumericField(approvedField, Math.min(total, approved));
    }
  };

  syncStandardCounts(
    "poster",
    "numberOfPosters",
    "remainingPosters",
    "completedPosters",
    "approvedPosters"
  );
  syncStandardCounts(
    "video",
    "numberOfVideos",
    "remainingVideos",
    "completedVideos",
    "approvedVideos"
  );
  syncStandardCounts(
    "shoot",
    "numberOfShoots",
    "remainingShoots",
    "completedShoots",
    "approvedShoots"
  );

  const masterCategories = Array.isArray(project.masterItemId?.selectedCategories)
    ? project.masterItemId.selectedCategories
    : [];

  if (!Array.isArray(project.selectedCategories)) {
    project.selectedCategories = [];
  }

  project.selectedCategories.forEach((category, index) => {
    const keys = getProjectCategoryKeys(category, masterCategories[index]);
    const matchedKey =
      keys.find(
        (key) => assignedCounts.has(key) || completedCounts.has(key),
      ) || keys[0];

    if (!matchedKey) return;

    // Recovery logic: if quantity is 0 and we lost the 'count' field, check original master item
    let quantity = Math.max(0, Number(category.quantity) || Number(category.count) || 0);
    if (quantity === 0 && Array.isArray(project.masterItemIds) && project.masterItemIds.length > 0) {
      const originalCat = (project.masterItemIds[0].categories || []).find(c => 
        (c.name || '').toLowerCase() === (category.name || category.categoryName || '').toLowerCase()
      );
      if (originalCat) {
        quantity = Math.max(0, Number(originalCat.count) || Number(originalCat.quantity) || 0);
        // Persist the recovered quantity
        category.quantity = quantity;
        selectedCategoriesChanged = true;
      }
    }

    const assigned = assignedCounts.get(matchedKey) || 0;
    const completed = completedCounts.get(matchedKey) || 0;
    const approved = approvedCounts.get(matchedKey) || 0;
    
    const maxAllowedRemaining = Math.max(0, quantity - assigned);
    const currentRemaining = category.remaining;
    
    // Strictly recalculate remaining based on quantity minus assigned
    const nextRemaining = maxAllowedRemaining;
    const nextCompleted = Math.min(quantity, completed);
    const nextApproved = Math.min(quantity, approved);

    if ((Number(category.remaining) || 0) !== nextRemaining) {
      category.remaining = nextRemaining;
      selectedCategoriesChanged = true;
    }

    if ((Number(category.completed) || 0) !== nextCompleted) {
      category.completed = nextCompleted;
      selectedCategoriesChanged = true;
    }

    if ((Number(category.approved) || 0) !== nextApproved) {
      category.approved = nextApproved;
      selectedCategoriesChanged = true;
    }
  });

  if (selectedCategoriesChanged) {
    project.markModified("selectedCategories");
    changed = true;
  }

  if (changed) {
    await project.save();
  }

  // NEW: Real-time update of Project SLA whenever task counts are reconciled
  try {
    const SlaRecord = require('../sla/sla.model');
    
    let totalDeliverables = (project.numberOfPosters || 0) + (project.numberOfVideos || 0) + (project.numberOfShoots || 0);
    let completedDeliverables = (project.completedPosters || 0) + (project.completedVideos || 0) + (project.completedShoots || 0);
    let remainingServices = [];

    if (project.remainingPosters > 0) remainingServices.push(`${project.remainingPosters} Posters`);
    if (project.remainingVideos > 0) remainingServices.push(`${project.remainingVideos} Videos`);
    if (project.remainingShoots > 0) remainingServices.push(`${project.remainingShoots} Shoots`);
    
    if (project.selectedCategories && Array.isArray(project.selectedCategories)) {
      project.selectedCategories.forEach(cat => {
        const rawName = cat.name || cat.categoryName || "";
        const isStandard = ["poster", "video", "shoot"].some(k => rawName.toLowerCase().includes(k));
        if (!isStandard) {
           const qty = Math.max(0, Number(cat.quantity) || Number(cat.count) || 0);
           const completed = Math.max(0, Number(cat.completed) || 0);
           totalDeliverables += qty;
           completedDeliverables += completed;
           
           const pendingCount = cat.remaining !== undefined ? cat.remaining : (qty > completed ? qty - completed : 0);
           if (pendingCount > 0) {
             remainingServices.push(`${pendingCount} ${rawName}`);
           }
        }
      });
    }
    
    let completionPercentage = 0;
    if (totalDeliverables > 0) {
      completionPercentage = Math.round((completedDeliverables / totalDeliverables) * 100);
    } else if (remainingServices.length === 0) {
      completionPercentage = 100;
    }
    let remainingPercentage = 100 - completionPercentage;
    
    let triggerType = 'Completion';
    let description = `Project is ${completionPercentage}% complete. Remaining completion is ${remainingPercentage}%. Pending: ${remainingServices.length > 0 ? remainingServices.join(', ') : 'None'}`;
    let status = completionPercentage === 100 ? 'Resolved' : 'Normal';

    // Check if SLA record already exists to preserve 'At Risk' or 'Breached' status
    const existingSla = await SlaRecord.findOne({ entityId: project._id, entityType: 'Project' });
    if (existingSla) {
      if (completionPercentage < 100 && (existingSla.status === 'At Risk' || existingSla.status === 'Breached')) {
        triggerType = 'Due Date & Completion';
        status = existingSla.status;
        description = `Project Near Due Date. ${completionPercentage}% complete. Remaining: ${remainingPercentage}%. Pending: ${remainingServices.length > 0 ? remainingServices.join(', ') : 'None'}`;
      } else if (completionPercentage === 100) {
        status = 'Resolved';
      }
    }

    await SlaRecord.findOneAndUpdate(
      { entityId: project._id, entityType: 'Project' },
      {
        slaId: existingSla ? existingSla.slaId : `SLA-PRJ-${project._id.toString().substring(0, 8).toUpperCase()}`,
        clientId: project.clientId,
        agencyId: project.companyId,
        clientType: 'Direct User Client',
        triggerType: triggerType,
        entityId: project._id,
        entityType: 'Project',
        title: `Project: ${project.name}`,
        description,
        dueDate: project.endDate || new Date(),
        priority: status === 'Breached' ? 'High' : 'Medium',
        status,
        ...(status === 'Resolved' && { resolvedAt: new Date() })
      },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (slaErr) {
    console.error("[Project Service] Failed to sync SLA for project:", slaErr);
  }

  return project;
};

/**
 * Shared list filters for project grid + summary stats (same visibility rules).
 * Uses a shallow copy of reqQuery so list handlers are not mutated.
 */
const resolveProjectListQueryOptions = async (
  tenantCompanyId,
  reqQuery = {},
  userRole = null,
  userId = null,
) => {
  const q = { ...reqQuery };
  let clientIdFilter = null;
  const isGlobalAdmin = ["supreme_super_admin"].includes(userRole);
  
  if (['client', 'agency_client', 'brand_super_admin', 'brand_manager'].includes(userRole) && userId) {
    clientIdFilter = userId;
  }
  
  if (
    userRole &&
    ["salesperson", "sales_executive"].includes(userRole) &&
    userId
  ) {
    const User = require("../auth/user.model");
    const user = await User.findById(userId).select("assignedClients");
    if (user && user.assignedClients && user.assignedClients.length > 0) {
      clientIdFilter = { $in: user.assignedClients };
    } else {
      return { ok: false };
    }
  }

  if (userRole === "website_coordinator") {
    q.departments = WEBSITE_COORDINATOR_DEPARTMENTS;
  }

  const pickItemNameParam = (v) => {
    if (v == null || v === "") return "";
    const x = Array.isArray(v) ? v[0] : v;
    return String(x).trim();
  };
  const rawItemName =
    pickItemNameParam(q.itemName) || pickItemNameParam(q.masterItemName);

  let masterItemIdFilter = null;
  if (rawItemName) {
    if (!MASTER_ITEM_NAME_WHITELIST.includes(rawItemName)) {
      return { ok: false };
    }
    const masterItems = await Service.find({
      name: rawItemName,
    }).select("_id");

    if (masterItems.length > 0) {
      masterItemIdFilter = { $in: masterItems.map((mi) => mi._id) };
    } else {
      return { ok: false };
    }
  } else if (q.masterItemId) {
    masterItemIdFilter = q.masterItemId;
  }

  const queryOptions = buildQuery(q, {
    searchFields: ["name", "description"],
    defaultSortField: "createdAt",
    defaultSortOrder: "desc",
    additionalFilters: {
      ...(clientIdFilter && { clientId: clientIdFilter }),
      ...(q.status && { status: q.status }),
      ...(q.companyId && !clientIdFilter && { clientId: q.companyId }),
      ...(q.clientId && !clientIdFilter && { clientId: q.clientId }),
      ...(!isGlobalAdmin && tenantCompanyId && { companyId: tenantCompanyId }),
      ...(masterItemIdFilter && { masterItemId: masterItemIdFilter }),
      ...(q.departments?.length && {
        departments: { $in: q.departments },
      }),
    },
  });

  return { ok: true, queryOptions };
};

const getAllProjects = async (
  tenantCompanyId,
  reqQuery = {},
  userRole = null,
  userId = null,
) => {
  const resolved = await resolveProjectListQueryOptions(
    tenantCompanyId,
    reqQuery,
    userRole,
    userId,
  );
  console.log(resolved,"----------------")
  if (!resolved.ok) {
    return {
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    };
  }

  // Execute paginated query with populate
  const result = await executePaginatedQuery(Project, resolved.queryOptions, [
    { path: "clientId", select: "name companyName email phone address status" },
    { path: "companyId", select: "name companyName email phone address status" },
    { path: "createdBy", select: "name email roleName" },
    { path: "invoiceId", select: "invoiceNumber type status" },
    {
      path: "masterItemId",
      select:
        "name description deliverables itemType pricingModel basePrice handlingAmount campaignAmount handlingDuration numberOfPosters completedPosters approvedPosters remainingPosters numberOfVideos completedVideos approvedVideos remainingVideos numberOfShoots completedShoots approvedShoots remainingShoots digitalMarketingPackages campaignPackages seoPackages websitePackages designingPackages selectedCategories isActive",
    },
    {
      path: "masterItemIds",
      select: "name itemCode category price duration description"
    }
  ]);

  if (result && result.data) {
    result.data = result.data.map(project => {
      const projObj = project.toObject ? project.toObject() : project;
      if (!projObj.masterItemId && projObj.masterItemIds && projObj.masterItemIds.length > 0) {
        projObj.masterItemId = projObj.masterItemIds[0];
      }
      return projObj;
    });
  }

  return result;
};

const getProjectReport = async (
  tenantCompanyId,
  reqQuery = {},
  userRole = null,
  userId = null,
) => {
  const resolved = await resolveProjectListQueryOptions(
    tenantCompanyId,
    reqQuery,
    userRole,
    userId,
  );

  if (!resolved.ok) {
    return {
      generatedAt: new Date().toISOString(),
      scopeLabel: hasProjectReportFilters(reqQuery)
        ? "Filtered Project Report"
        : "Overall Project Report",
      projectRows: [],
      serviceBreakdown: [],
      categoryBreakdown: [],
      clientSummaries: [],
      summary: {
        projectsCount: 0,
        clientsCount: 0,
        serviceRowsCount: 0,
        categoryRowsCount: 0,
        posters: createCountTotals(),
        videos: createCountTotals(),
        shoots: createCountTotals(),
        other: createCountTotals(),
        total: createCountTotals(),
      },
    };
  }

  const projects = await Project.find(resolved.queryOptions.filters)
    .select(
      "name status startDate endDate renewalDate packageName clientId masterItemId numberOfPosters completedPosters approvedPosters remainingPosters numberOfVideos completedVideos approvedVideos remainingVideos numberOfShoots completedShoots approvedShoots remainingShoots selectedCategories",
    )
    .populate("clientId", "name")
    .populate("masterItemId", "name")
    .sort(resolved.queryOptions.sort)
    .lean();

  const reportData = buildProjectReportData(projects);

  return {
    generatedAt: new Date().toISOString(),
    scopeLabel: hasProjectReportFilters(reqQuery)
      ? "Filtered Project Report"
      : "Overall Project Report",
    ...reportData,
  };
};

const emptyProjectListSummary = () => ({
  pendingPosters: 0,
  pendingVideos: 0,
  pendingShoots: 0,
  pendingDynamic: 0,
  inProgressProjects: 0,
});

/**
 * Aggregate deliverable / status counts for all projects matching list filters,
 * independent of pagination.
 */
const getProjectListSummaryStats = async (
  tenantCompanyId,
  reqQuery = {},
  userRole = null,
  userId = null,
) => {
  const resolved = await resolveProjectListQueryOptions(
    tenantCompanyId,
    reqQuery,
    userRole,
    userId,
  );
  if (!resolved.ok) {
    return emptyProjectListSummary();
  }

  const { filters } = resolved.queryOptions;
  const nonNeg = (field) => ({
    $max: [{ $ifNull: [`$${field}`, 0] }, 0],
  });

  const [row] = await Project.aggregate([
    { $match: filters },
    {
      $group: {
        _id: null,
        pendingPosters: { $sum: nonNeg("remainingPosters") },
        pendingVideos: { $sum: nonNeg("remainingVideos") },
        pendingShoots: { $sum: nonNeg("remainingShoots") },
        pendingDynamic: {
          $sum: {
            $sum: {
              $map: {
                input: { $ifNull: ["$selectedCategories", []] },
                as: "cat",
                in: { $max: [{ $ifNull: ["$$cat.remaining", 0] }, 0] },
              },
            },
          },
        },
        inProgressProjects: {
          $sum: {
            $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0],
          },
        },
      },
    },
  ]);

  if (!row) {
    return emptyProjectListSummary();
  }

  return {
    pendingPosters: row.pendingPosters || 0,
    pendingVideos: row.pendingVideos || 0,
    pendingShoots: row.pendingShoots || 0,
    pendingDynamic: row.pendingDynamic || 0,
    inProgressProjects: row.inProgressProjects || 0,
  };
};

const getUnassignedDeliverablesSummary = async (
  tenantCompanyId,
  reqQuery = {},
  userRole = null,
  userId = null,
) => {
  const resolved = await resolveProjectListQueryOptions(
    tenantCompanyId,
    reqQuery,
    userRole,
    userId,
  );
  if (!resolved.ok) {
    return {
      overallUnassignedPosters: 0,
      overallUnassignedVideos: 0,
      overallUnassignedShoots: 0,
      overallUnassignedDynamic: 0,
      overallInProgressProjects: 0,
      posterProjects: [],
      videoProjects: [],
      shootProjects: [],
      dynamicProjects: [],
      inProgressProjects: [],
    };
  }

  const { filters } = resolved.queryOptions;
  const projects = await Project.find(filters)
    .select(
      "name remainingPosters remainingVideos remainingShoots selectedCategories clientId status",
    )
    .populate("clientId", "name")
    .sort({ createdAt: -1 })
    .lean();

  const posterProjects = [];
  const videoProjects = [];
  const shootProjects = [];
  const dynamicProjects = [];
  const inProgressProjects = [];
  let overallUnassignedPosters = 0;
  let overallUnassignedVideos = 0;
  let overallUnassignedShoots = 0;
  let overallUnassignedDynamic = 0;
  let overallInProgressProjects = 0;

  projects.forEach((project) => {
    const remainingPosters = Math.max(0, Number(project.remainingPosters) || 0);
    const remainingVideos = Math.max(0, Number(project.remainingVideos) || 0);
    const remainingShoots = Math.max(0, Number(project.remainingShoots) || 0);
    const remainingDynamic = (project.selectedCategories || []).reduce(
      (sum, cat) => sum + Math.max(0, Number(cat.remaining) || 0),
      0,
    );

    overallUnassignedPosters += remainingPosters;
    overallUnassignedVideos += remainingVideos;
    overallUnassignedShoots += remainingShoots;
    overallUnassignedDynamic += remainingDynamic;
    if (project.status === "in_progress") {
      overallInProgressProjects += 1;
      inProgressProjects.push({
        _id: project._id,
        name: project.name,
        clientName: project.clientId?.name || "N/A",
        status: project.status || "created",
      });
    }

    if (remainingPosters > 0) {
      posterProjects.push({
        _id: project._id,
        name: project.name,
        clientName: project.clientId?.name || "N/A",
        status: project.status || "created",
        pendingCount: remainingPosters,
      });
    }
    if (remainingVideos > 0) {
      videoProjects.push({
        _id: project._id,
        name: project.name,
        clientName: project.clientId?.name || "N/A",
        status: project.status || "created",
        pendingCount: remainingVideos,
      });
    }
    if (remainingShoots > 0) {
      shootProjects.push({
        _id: project._id,
        name: project.name,
        clientName: project.clientId?.name || "N/A",
        status: project.status || "created",
        pendingCount: remainingShoots,
      });
    }
    if (remainingDynamic > 0) {
      dynamicProjects.push({
        _id: project._id,
        name: project.name,
        clientName: project.clientId?.name || "N/A",
        status: project.status || "created",
        pendingCount: remainingDynamic,
        categories: project.selectedCategories.filter(
          (c) => (c.remaining || 0) > 0,
        ),
      });
    }
  });

  return {
    overallUnassignedPosters,
    overallUnassignedVideos,
    overallUnassignedShoots,
    overallUnassignedDynamic,
    overallInProgressProjects,
    posterProjects,
    videoProjects,
    shootProjects,
    dynamicProjects,
    inProgressProjects,
  };
};

// Dropdown query for projects
const getProjectsDropdown = async (tenantCompanyId, reqQuery = {}) => {
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);
  const isGlobalAdmin = ["supreme_super_admin"].includes(reqQuery.userRole);

  // Apply role-based data filtering for dropdown
  let clientIdFilter;
  if (reqQuery.userRole === "client" && reqQuery.userId) {
    const User = require("./shimUserModel");
    const clientUser = await User.findById(reqQuery.userId).select("clientId");
    if (clientUser && clientUser.clientId) {
      clientIdFilter = clientUser.clientId;
    } else {
      clientIdFilter = null;
    }
  } else if (reqQuery.companyId) {
    // Filter by specific client company (Admin/Sales view)
    const requestedClientId = reqQuery.companyId;
    if (isGlobalAdmin) {
      clientIdFilter = requestedClientId;
    } else {
      // Verify the requested client belongs to this tenant
      if (
        clientCompanyIds.some(
          (id) => id.toString() === requestedClientId.toString(),
        )
      ) {
        clientIdFilter = requestedClientId;
      } else {
        // Client doesn't belong to tenant, return empty
        return [];
      }
    }
  } else {
    // Show all clients' projects
    if (isGlobalAdmin) {
      clientIdFilter = undefined; // Do not filter by client ID (allows all)
    } else {
      clientIdFilter = { $in: clientCompanyIds };
    }
  }

  // website_coordinator only sees website-designing and web-application-development projects
  let masterItemIdFilter = reqQuery.masterItemId || null;
  const websiteCoordinatorProjectFilter =
    reqQuery.userRole === "website_coordinator"
      ? { departments: { $in: WEBSITE_COORDINATOR_DEPARTMENTS } }
      : {};

  const queryOptions = buildDropdownQuery(reqQuery, {
    searchFields: ["name"],
    defaultSortField: "name",
    defaultSortOrder: "asc",
    additionalFilters: {
      ...(!isGlobalAdmin && { companyId: tenantCompanyId }),
      ...(clientIdFilter && { clientId: clientIdFilter }),
      isActive: { $ne: false }, // Only show active projects in dropdown (handle missing field on old projects)
      // Default to excluding inactive/closed if status is not provided
      ...(reqQuery.status
        ? { status: reqQuery.status }
        : { status: { $nin: ["inactive", "closed"] } }),
      ...(reqQuery.milestoneWorkflowType && {
        milestoneWorkflowType: reqQuery.milestoneWorkflowType,
      }),
      ...(masterItemIdFilter && { masterItemId: masterItemIdFilter }),
      ...websiteCoordinatorProjectFilter,
    },
  });

  return await executeDropdownQuery(
    Project,
    queryOptions,
    { path: "clientId", select: "name status" },
    "name status clientId milestoneWorkflowType departments numberOfPosters numberOfVideos numberOfShoots remainingPosters remainingVideos remainingShoots selectedCategories",
  );
};

const getProjectById = async (
  projectId,
  tenantCompanyId,
  userRole = null,
  userId = null,
) => {
  // Get all client companies for this tenant
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  // Project has: clientId (ClientCompany) and companyId (tenant Company)
  // Filter by companyId (tenant) and ensure clientId belongs to the tenant
  const project = await Project.findOne({
    _id: projectId,
    companyId: tenantCompanyId, // Project belongs to the tenant company
    clientId: { $in: clientCompanyIds }, // Client belongs to the tenant
  })
    .populate("clientId", "name email phone address status")
    .populate("companyId", "name email phone address status")
    .populate("createdBy", "name email")
    .populate("invoiceId", "invoiceNumber type status paymentStatus grandTotal createdAt")
    .populate("proposalId", "proposalNumber name status grandTotal")
    .populate("workflowSentBy", "name email")
    .populate("workflowApprovedBy", "name email")
    .populate("workflowRevisionRequestedBy", "name email")
    .populate(
      "masterItemId",
      "name description deliverables itemType pricingModel basePrice handlingAmount campaignAmount handlingDuration numberOfPosters numberOfVideos numberOfShoots digitalMarketingPackages campaignPackages seoPackages websitePackages designingPackages selectedCategories categories applicableAccess isActive",
    )
    .populate("masterItemIds", "name itemCode category categories applicableAccess price duration description isCampaign campaignDetails")
    .populate("planId", "name")
    .populate("milestones.completedBy", "name email");

  if (!project) {
    throw new Error("Project not found");
  }

  // Apply role-based data filtering
  if (userRole === "client" && userId) {
    const User = require("./shimUserModel");
    const clientUser = await User.findById(userId).select("clientId");
    if (clientUser && clientUser.clientId) {
      // Verify this project belongs to the requesting client
      if (project.clientId._id.toString() !== clientUser.clientId.toString()) {
        throw new Error("Access denied: You can only view your own projects");
      }
    } else {
      throw new Error("Access denied: No client account linked");
    }
  }

  // Get tasks for this project
  const tasks = await Task.find({ projectId: project._id })
    .populate("assignedTo", "name email role")
    .populate("assignedBy", "name email")
    .sort({ dueDate: 1 });

  await reconcileProjectTaskCounts(project, tenantCompanyId, tasks);

  const projectObj = project.toObject();
  if (!projectObj.masterItemId && projectObj.masterItemIds && projectObj.masterItemIds.length > 0) {
    projectObj.masterItemId = projectObj.masterItemIds[0];
  }

  return {
    ...projectObj,
    tasks,
  };
};

const createProject = async (projectData, tenantCompanyId, createdByUserId) => {
  console.log("[Project Service] createProject called with:", {
    invoiceId: projectData.invoiceId,
    invoiceItemId: projectData.invoiceItemId,
    tenantCompanyId: tenantCompanyId,
    createdByUserId: createdByUserId,
    status: projectData.status,
  });

  // MANDATORY: Invoice is required for project creation
  if (!projectData.invoiceId) {
    throw new Error(
      "Invoice ID is required. Projects can only be created from invoices.",
    );
  }

  if (
    projectData.invoiceItemId === undefined ||
    projectData.invoiceItemId === null
  ) {
    throw new Error("Invoice item index is required.");
  }

  // Get all client companies for this tenant
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  // Fetch and validate invoice
  // Invoice has: clientId (ClientCompany) and companyId (tenant Company)
  // We need to check both: clientId should be in clientCompanyIds AND companyId should match tenantCompanyId
  const invoice = await Invoice.findOne({
    _id: projectData.invoiceId,
    clientId: { $in: clientCompanyIds }, // Invoice belongs to one of the tenant's client companies
    companyId: tenantCompanyId, // Invoice belongs to the tenant company
  }).populate("items.serviceId", "name description");

  if (!invoice) {
    throw new Error(
      "Invoice not found or does not belong to your organization",
    );
  }

  // Validate invoice status - allow created, draft, sent, paid, and overdue invoices to generate projects
  const validStatuses = ["created", "draft", "sent", "paid", "overdue"];
  if (!validStatuses.includes(invoice.status)) {
    throw new Error(
      `Cannot create project from invoice with status "${invoice.status}". Only invoices with status "created", "draft", "sent", "paid", or "overdue" can generate projects.`,
    );
  }

  // Validate invoice is not cancelled
  if (invoice.status === "cancelled") {
    throw new Error("Cannot create project from a cancelled invoice");
  }

  // Get the invoice item
  const invoiceItemIndex = parseInt(projectData.invoiceItemId);
  if (invoiceItemIndex < 0 || invoiceItemIndex >= invoice.items.length) {
    throw new Error("Invalid invoice item index");
  }

  const invoiceItem = invoice.items[invoiceItemIndex];

  if (!invoiceItem.serviceId) {
    throw new Error(
      "Invoice item must have a service (master item) associated",
    );
  }

  // Get the client company ID from the invoice
  // Invoice has: clientId (ClientCompany) and companyId (tenant Company)
  const invoiceClientCompanyId = invoice.clientId?._id || invoice.clientId;

  if (!invoiceClientCompanyId) {
    throw new Error("Invoice does not have a valid client company reference");
  }

  // Verify that the client company belongs to the tenant company
  const clientCompany = await ClientCompany.findOne({
    _id: invoiceClientCompanyId,
    companyId: tenantCompanyId,
  });

  if (!clientCompany) {
    console.error(
      `[Project Creation] Client company not found. InvoiceClientCompanyId: ${invoiceClientCompanyId}, TenantCompanyId: ${tenantCompanyId}, InvoiceId: ${invoice._id}`,
    );
    throw new Error(
      "Client company not found or does not belong to your organization",
    );
  }

  // Fetch service (master item) for additional data
  const service = await Service.findById(invoiceItem.serviceId);
  if (!service) {
    throw new Error("Service (master item) not found");
  }

  // Auto-populate project fields from invoice and master item
  // Use provided name from form, or fallback to service name
  const projectName =
    projectData.name ||
    service.name ||
    invoiceItem.description ||
    "Unnamed Project";

  // Date flow:
  // - Start date: project creation date
  // - End date: start date + handling duration months
  // - Renewal date: end date + 1 day
  const startDate = new Date();
  const handlingDurationSource =
    service?.handlingDuration ||
    (typeof invoiceItem.serviceId === "object"
      ? invoiceItem.serviceId?.handlingDuration
      : null) ||
    null;
  const handlingMonths = parseHandlingDurationMonths(handlingDurationSource);
  const endDate = new Date(startDate);
  if (handlingMonths > 0) {
    endDate.setMonth(endDate.getMonth() + handlingMonths);
  }
  const renewalDate = new Date(endDate);
  renewalDate.setDate(renewalDate.getDate() + 1);

  // Departments removed - tasks will be manually assigned to users
  // No department selection required during project creation
  const departments = [];

  // Create project with auto-populated data
  // Get proposalId from invoice if it exists (invoice might be created from a proposal)
  const proposalId = invoice.proposalId || null;

  // Validate billingType - ensure it's set from invoice item
  const billingType = invoiceItem.billingType || "one-time";
  if (!["one-time", "subscription"].includes(billingType)) {
    throw new Error(
      `Invalid billing type: ${billingType}. Must be 'one-time' or 'subscription'`,
    );
  }

  // New projects always start in "created". Status transitions happen automatically.
  const projectStatus = "created";

  // Digital Marketing / Content Tracking
  let numberOfPosters = service.numberOfPosters || 0;
  let numberOfVideos = service.numberOfVideos || 0;
  let numberOfShoots = service.numberOfShoots || 0;

  // If it's a plan, extract counts from deliverables
  if (invoiceItem.planId) {
    const { Plan } = require("./shimOperationModel");
    const plan = await Plan.findById(invoiceItem.planId);
    if (plan && plan.deliverables) {
      const posterDeliv = plan.deliverables.find(
        (d) => d.type === "image" || d.type === "poster",
      );
      const videoDeliv = plan.deliverables.find((d) => d.type === "video");
      const shootDeliv = plan.deliverables.find((d) => d.type === "shoot");

      if (posterDeliv) numberOfPosters = posterDeliv.quantity;
      if (videoDeliv) numberOfVideos = videoDeliv.quantity;
      if (shootDeliv) numberOfShoots = shootDeliv.quantity;
    }
  }

  const project = await Project.create({
    name: projectName,
    description: projectData.description || service.description || "",
    clientId: invoiceClientCompanyId, // Client company (ClientCompany) - required field
    companyId: tenantCompanyId, // Tenant company (Company) - required field (this is the tenant, not the client)
    createdBy: createdByUserId,
    status: projectStatus, // Use validated status
    startDate,
    endDate,
    renewalDate,
    departments,
    isActive: true, // Projects are active by default
    // Proposal reference (optional - get from invoice if available)
    proposalId: proposalId, // Optional field - get from invoice if invoice was created from a proposal
    // Invoice and master item references
    invoiceId: invoice._id,
    invoiceItemId: invoiceItemIndex,
    masterItemId: invoiceItem.serviceId,
    packageName: invoiceItem.packageName || null,
    planId: invoiceItem.planId || null,
    // Billing information from invoice (required fields)
    billingType: billingType, // Required field
    invoiceType: invoice.type,
    invoiceDate: invoice.createdAt,
    // Milestone workflow type based on service
    milestoneWorkflowType: getMilestoneWorkflowType(service.name),
    // Digital Marketing / Content Tracking
    numberOfPosters,
    numberOfVideos,
    numberOfShoots,
    remainingPosters: numberOfPosters,
    remainingVideos: numberOfVideos,
    remainingShoots: numberOfShoots,
    // Inherit dynamic categories from invoice item
    selectedCategories: (invoiceItem.selectedCategories || []).map((cat) => ({
      ...cat,
      remaining: cat.quantity || 0,
    })),
  });

  console.log(
    "[Project Service] Project created. ProjectId:",
    project._id,
    "CompanyId:",
    project.companyId,
    "ClientId:",
    project.clientId,
  );

  // DO NOT auto-generate tasks here - tasks should only be created after workflow approval
  // Tasks will be created when project workflow is approved (see approveWorkflow endpoint)

  // Populate the project we just created instead of fetching it again
  // This avoids any query issues and ensures we have the correct project
  await project.populate("clientId", "name email phone address");
  await project.populate("companyId", "name email phone address");
  await project.populate("createdBy", "name email");
  await project.populate("invoiceId", "invoiceNumber type status createdAt");
  await project.populate(
    "masterItemId",
    "name description deliverables itemType pricingModel basePrice handlingAmount campaignAmount handlingDuration numberOfPosters numberOfVideos numberOfShoots digitalMarketingPackages campaignPackages seoPackages websitePackages designingPackages selectedCategories isActive",
  );
  await project.populate("planId", "name");

  // Verify the project belongs to the tenant company
  // Project model has companyId (tenant company), not tenantCompanyId
  // Handle both populated (object) and unpopulated (ObjectId) companyId
  let projectCompanyId;
  if (
    project.companyId &&
    typeof project.companyId === "object" &&
    project.companyId._id
  ) {
    projectCompanyId = project.companyId._id.toString();
  } else if (project.companyId) {
    projectCompanyId = project.companyId.toString();
  } else {
    console.error(
      `[Project Creation] Project has no companyId. ProjectId: ${project._id}`,
    );
    throw new Error(
      "Project not found or does not belong to your organization",
    );
  }

  if (projectCompanyId !== tenantCompanyId.toString()) {
    console.error(
      `[Project Creation] Tenant ID mismatch. ProjectCompanyId: ${projectCompanyId}, RequestTenantId: ${tenantCompanyId.toString()}, ProjectId: ${project._id}`,
    );
    throw new Error(
      "Project not found or does not belong to your organization",
    );
  }

  console.log(
    `[Project Creation] Project created successfully. ProjectId: ${project._id}, ClientId: ${project.clientId}, CompanyId: ${projectCompanyId}`,
  );

  // Create timeline event for project creation
  try {
    await createTimelineEvent({
      eventType: "project_created",
      entityType: "Project",
      entityId: project._id,
      performedByUserId: createdByUserId,
      description: `Project "${project.name}" created from invoice ${invoice.invoiceNumber || invoice._id}`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber || null,
        clientId: project.clientId.toString(),
        masterItemId: project.masterItemId?.toString() || null,
        status: project.status,
        billingType: project.billingType,
      },
      companyId: tenantCompanyId,
    });

    // Also create timeline event on client
    await createTimelineEvent({
      eventType: "project_created",
      entityType: "clientCompany",
      entityId: project.clientId,
      performedByUserId: createdByUserId,
      description: `New project "${project.name}" created for you`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        invoiceId: invoice._id.toString(),
      },
      companyId: tenantCompanyId,
    });
  } catch (timelineError) {
    console.error(
      "[Project Service] Failed to create timeline event for project creation:",
      timelineError,
    );
    // Don't throw - timeline failure shouldn't break project creation
  }

  // Get tasks for this project (should be empty since tasks are created after workflow approval)
  // Task model has both companyId (client) and tenantCompanyId (tenant)
  const tasks = await Task.find({
    projectId: project._id,
  })
    .populate("assignedTo", "name email role")
    .populate("assignedBy", "name email")
    .sort({ dueDate: 1 });

  return {
    ...project.toObject(),
    tasks,
  };
};

const updateProject = async (projectId, projectData, tenantCompanyId) => {
  // Get all client companies for this tenant
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  // Project has: clientId (ClientCompany) and companyId (tenant Company)
  // Filter by companyId (tenant) and ensure clientId belongs to the tenant
  const project = await Project.findOne({
    _id: projectId,
    companyId: tenantCompanyId, // Project belongs to the tenant company
    clientId: { $in: clientCompanyIds }, // Client belongs to the tenant
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Prevent updating invoice-related fields and auto-calculated fields
  // Departments removed from allowed updates - tasks will be manually assigned
  const allowedUpdates = [
    "name",
    "description",
    "status",
    "startDate",
    "endDate",
    "renewalDate",
    "isActive",
    "packageName",
    "numberOfPosters",
    "numberOfVideos",
    "numberOfShoots",
    "remainingPosters",
    "remainingVideos",
    "remainingShoots",
    "selectedCategories",
  ];
  // Note: billingType, invoiceType, invoiceDate, departments are read-only
  allowedUpdates.forEach((field) => {
    if (projectData[field] !== undefined) {
      if (field === "startDate" || field === "endDate") {
        // Convert ISO string to Date object
        project[field] = projectData[field]
          ? new Date(projectData[field])
          : null;
      } else {
        project[field] = projectData[field];
      }
    }
  });

  // Ensure departments is always empty array (departments removed from project creation)
  project.departments = [];

  await project.save();

  // If counts were modified, check for auto-completion
  await checkAndMarkProjectCompleted(project._id, null, tenantCompanyId);

  return await getProjectById(project._id, tenantCompanyId);
};

const approveWorkflow = async (
  projectId,
  tenantCompanyId,
  approvedByUserId,
) => {
  const project = await Project.findOne({
    _id: projectId,
    companyId: tenantCompanyId,
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.status !== "workflow_sent") {
    throw new Error("Project workflow must be sent before approval");
  }

  const previousStatus = project.status;

  // Update project status
  project.status = "workflow_approved";
  project.workflowApprovedAt = new Date();
  project.workflowApprovedBy = approvedByUserId;
  await project.save();

  // Create timeline event for workflow approval
  try {
    await createTimelineEvent({
      eventType: "project_workflow_approved",
      entityType: "Project",
      entityId: project._id,
      performedByUserId: approvedByUserId,
      description: `Project workflow approved for "${project.name}"`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        previousStatus: previousStatus,
        currentStatus: "workflow_approved",
        workflowApprovedAt: project.workflowApprovedAt,
        workflowApprovedBy: approvedByUserId.toString(),
        workflowSentAt: project.workflowSentAt,
        workflowSentBy: project.workflowSentBy?.toString() || null,
      },
      companyId: tenantCompanyId,
    });

    // Also create timeline event on client
    await createTimelineEvent({
      eventType: "project_workflow_approved",
      entityType: "clientCompany",
      entityId: project.clientId,
      performedByUserId: approvedByUserId,
      description: `Project workflow approved for "${project.name}"`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        workflowApprovedAt: project.workflowApprovedAt,
        workflowApprovedBy: approvedByUserId.toString(),
      },
      companyId: tenantCompanyId,
    });
  } catch (timelineError) {
    console.error(
      "[Project Service] Failed to create timeline event:",
      timelineError,
    );
    // Don't throw - timeline failure shouldn't break the flow
  }

  // NOW create tasks after workflow approval
  // Get the invoice and master item to generate tasks
  const Invoice = require("./shimInvoiceModel");
  const { Service } = require("./shimOperationModel");
  const { autoGenerateTasksFromMasterItem } = require("./project-auto.service");

  const invoice = await Invoice.findById(project.invoiceId).populate(
    "items.serviceId",
  );
  if (!invoice) {
    throw new Error("Invoice not found for project");
  }

  const invoiceItem = invoice.items[project.invoiceItemId];
  if (!invoiceItem || !invoiceItem.serviceId) {
    throw new Error("Invoice item or service not found");
  }

  const service = await Service.findById(invoiceItem.serviceId._id);
  if (!service) {
    throw new Error("Service (Master Item) not found");
  }

  // DISABLED: Automatic task creation - tasks should be created manually
  // Tasks will be created manually by coordinators/admins when needed
  // Only active projects will be shown in task creation dropdown
  const createdTasksCount = 0;

  // Update project status to in_progress (tasks will be created manually)
  project.status = "in_progress";
  await project.save();

  // Create timeline event for project started
  try {
    await createTimelineEvent({
      eventType: "project_started",
      entityType: "Project",
      entityId: project._id,
      performedByUserId: approvedByUserId,
      description: `Project "${project.name}" started - ready for manual task creation`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        previousStatus: "workflow_approved",
        currentStatus: "in_progress",
        note: "Tasks will be created manually by coordinators/admins",
      },
      companyId: tenantCompanyId,
    });
  } catch (timelineError) {
    console.error(
      "[Project Service] Failed to create timeline event:",
      timelineError,
    );
    // Don't throw - timeline failure shouldn't break the flow
  }

  return await getProjectById(project._id, tenantCompanyId);
};

/**
 * Activate a project (make it visible in task creation dropdown)
 */
const activateProject = async (projectId, tenantCompanyId) => {
  const project = await Project.findOne({
    _id: projectId,
    companyId: tenantCompanyId,
  });

  if (!project) {
    throw new Error("Project not found");
  }

  project.isActive = true;
  await project.save();

  return await getProjectById(project._id, tenantCompanyId);
};

/**
 * Deactivate a project (hide it from task creation dropdown)
 */
const deactivateProject = async (projectId, tenantCompanyId) => {
  const project = await Project.findOne({
    _id: projectId,
    companyId: tenantCompanyId,
  });

  if (!project) {
    throw new Error("Project not found");
  }

  project.isActive = false;
  await project.save();

  return await getProjectById(project._id, tenantCompanyId);
};

const deleteProject = async (projectId, tenantCompanyId) => {
  // Get all client companies for this tenant
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  // Project has: clientId (ClientCompany) and companyId (tenant Company)
  // Filter by companyId (tenant) and ensure clientId belongs to the tenant
  const project = await Project.findOne({
    _id: projectId,
    companyId: tenantCompanyId, // Project belongs to the tenant company
    clientId: { $in: clientCompanyIds }, // Client belongs to the tenant
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Check if project has tasks (only non-deleted tasks block deletion)
  const taskCount = await Task.countDocuments({
    projectId: project._id,
  });
  if (taskCount > 0) {
    throw new Error(
      "Cannot delete project with existing tasks. Please remove or reassign tasks first.",
    );
  }

  // Hard delete
  await Project.findByIdAndDelete(projectId);
  return { message: "Project deleted successfully" };
};

/**
 * Get milestone workflow type based on master item name
 * @param {String} masterItemName - Master item name
 * @returns {String} Workflow type: 'website_team', 'tech_team', 'seo', 'digital-marketing'
 */
const getMilestoneWorkflowType = (masterItemName) => {
  if (!masterItemName) return null;

  const name = masterItemName.toLowerCase().trim();
  if (name === "website" || name === "website designing") return "website_team";
  if (name === "seo") return "seo";
  if (name === "digital marketing") return "digital_marketing";
  // Tech team can be determined by departments or other criteria
  return "website_team";
};

/**
 * Get milestone checklist based on workflow type
 * @param {String} workflowType - Workflow type
 * @returns {Array} Array of milestone steps
 */
const getMilestoneChecklist = (workflowType) => {
  // Normalize workflow type to handle both hyphen and underscore variants
  const normalizedType = workflowType ? workflowType.replace(/-/g, "_") : "";

  const checklists = {
    website_team: [
      "Client Onboarded",
      "Greeting Sent",
      "Requirements Gathered",
      "Theme Selected",
      "Developer Started Working",
      "Phase 1 Demo Shared with Client",
      "Corrections Going On",
      "Client Confirmed Demo to Go Live",
      "Live Work in Progress",
      "Domain Purchased",
      "SSL Installed",
      "Live",
      "Completed",
    ],
    website_designing: [
      "Client Onboarded",
      "Greeting Sent",
      "Requirements Gathered",
      "Theme Selected",
      "Developer Started Working",
      "Phase 1 Demo Shared with Client",
      "Corrections Going On",
      "Client Confirmed Demo to Go Live",
      "Live Work in Progress",
      "Domain Purchased",
      "SSL Installed",
      "Live",
      "Completed",
    ],
    tech_team: [
      "Client Onboarded",
      "Greeting Sent",
      "Requirements Gathered",
      "Theme Selected",
      "Developer Started Working",
      "Review 1 Demo Shared with Client",
      "Corrections Going On",
      "Review 2",
      "Testing",
      "Bug Fixing",
      "Demo Shared with Client",
      "Client Confirmed Demo to Go Live",
      "Live Work in Progress",
      "Domain Purchased",
      "Server Setup",
      "SSL Installed",
      "Live",
      "Completed",
    ],
    web_application_development: [
      "Client Onboarded",
      "Greeting Sent",
      "Requirements Gathered",
      "Theme Selected",
      "Developer Started Working",
      "Review 1 Demo Shared with Client",
      "Corrections Going On",
      "Review 2",
      "Testing",
      "Bug Fixing",
      "Demo Shared with Client",
      "Client Confirmed Demo to Go Live",
      "Live Work in Progress",
      "Domain Purchased",
      "Server Setup",
      "SSL Installed",
      "Live",
      "Completed",
    ],
    seo: [
      "Content Work",
      "On-page SEO",
      "Technical SEO",
      "Local SEO",
      "Keyword Research",
      "Off-page SEO",
    ],
    digital_marketing: ["Poster Creation", "Video Creation", "Posting"],
  };

  return checklists[normalizedType] || [];
};

/**
 * Update project milestones
 * @param {String} projectId - Project ID
 * @param {Object} milestoneData - Milestone data { milestones: [], milestoneWorkflowType: string }
 * @param {String} tenantCompanyId - Tenant company ID
 * @param {String} userId - User ID who updated
 * @returns {Object} Updated project
 */
const updateProjectMilestones = async (
  projectId,
  milestoneData,
  tenantCompanyId,
  userId,
) => {
  // Get all client companies for this tenant
  const clientCompanyIds = await getClientCompanyIds(tenantCompanyId);

  const project = await Project.findOne({
    _id: projectId,
    companyId: tenantCompanyId,
    clientId: { $in: clientCompanyIds },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // If milestoneWorkflowType is provided and different, initialize milestones
  if (
    milestoneData.milestoneWorkflowType &&
    milestoneData.milestoneWorkflowType !== project.milestoneWorkflowType
  ) {
    const checklist = getMilestoneChecklist(
      milestoneData.milestoneWorkflowType,
    );
    project.milestones = checklist.map((step) => ({
      step,
      completed: false,
      completedAt: null,
      completedBy: null,
      metadata: {},
    }));
    project.milestoneWorkflowType = milestoneData.milestoneWorkflowType;
  }

  // Update milestones
  if (milestoneData.milestones && Array.isArray(milestoneData.milestones)) {
    const now = new Date();

    milestoneData.milestones.forEach((milestoneUpdate) => {
      const existingMilestone = project.milestones.find(
        (m) => m.step === milestoneUpdate.step,
      );

      if (existingMilestone) {
        // Update existing milestone
        if (milestoneUpdate.completed !== undefined) {
          existingMilestone.completed = milestoneUpdate.completed;
          if (milestoneUpdate.completed && !existingMilestone.completedAt) {
            existingMilestone.completedAt = now;
            existingMilestone.completedBy = userId;
          } else if (!milestoneUpdate.completed) {
            existingMilestone.completedAt = null;
            existingMilestone.completedBy = null;
          }
        }
        if (milestoneUpdate.metadata) {
          existingMilestone.metadata = {
            ...existingMilestone.metadata,
            ...milestoneUpdate.metadata,
          };
        }
      } else {
        // Add new milestone (for dynamic reviews)
        project.milestones.push({
          step: milestoneUpdate.step,
          completed: milestoneUpdate.completed || false,
          completedAt: milestoneUpdate.completed ? now : null,
          completedBy: milestoneUpdate.completed ? userId : null,
          metadata: milestoneUpdate.metadata || {},
        });
      }
    });
  }

  await project.save();

  // Create timeline events for completed milestones
  if (milestoneData.milestones && Array.isArray(milestoneData.milestones)) {
    for (const milestoneUpdate of milestoneData.milestones) {
      if (milestoneUpdate.completed) {
        const milestone = project.milestones.find(
          (m) => m.step === milestoneUpdate.step,
        );
        if (milestone && milestone.completedAt) {
          try {
            await createTimelineEvent({
              eventType: "milestone_completed",
              entityType: "Project",
              entityId: project._id,
              performedByUserId: userId,
              description: `Milestone "${milestoneUpdate.step}" completed`,
              metadata: {
                milestoneStep: milestoneUpdate.step,
                completedAt: milestone.completedAt,
                metadata: milestone.metadata || {},
              },
              companyId: tenantCompanyId,
            });
          } catch (error) {
            console.error(
              "Failed to create timeline event for milestone:",
              error,
            );
            // Don't throw - timeline failure shouldn't break milestone update
          }
        }
      }
    }
  }

  return await getProjectById(projectId, tenantCompanyId);
};

/**
 * Automatically mark a project as completed if it's based on deliverable counts
 * (Posters, Videos, Shoots) and all items have been assigned (remaining = 0).
 */
const checkAndMarkProjectCompleted = async (
  projectId,
  userId,
  tenantCompanyId,
) => {
  const project = await Project.findById(projectId);
  if (!project) return;

  // Only apply to projects with these specific fields
  const hasDynamicCategories = (project.selectedCategories || []).length > 0;
  const isAutoCompletable =
    (project.numberOfPosters || 0) > 0 ||
    (project.numberOfVideos || 0) > 0 ||
    (project.numberOfShoots || 0) > 0 ||
    hasDynamicCategories;

  if (!isAutoCompletable) return;

  // Check if all relevant counts are at 0 or less
  const allDynamicAssigned = (project.selectedCategories || []).every(
    (cat) => (cat.remaining || 0) <= 0,
  );
  const allItemsAssigned =
    (project.numberOfPosters > 0
      ? (project.remainingPosters || 0) <= 0
      : true) &&
    (project.numberOfVideos > 0 ? (project.remainingVideos || 0) <= 0 : true) &&
    (project.numberOfShoots > 0 ? (project.remainingShoots || 0) <= 0 : true) &&
    allDynamicAssigned;

  if (allItemsAssigned && project.status !== "completed") {
    const previousStatus = project.status;
    project.status = "completed";
    project.completedAt = new Date();
    project.completedBy = userId;
    await project.save();

    console.log(
      `[Project Service] Automated: Project ${project._id} marked as completed due to zero remaining counts.`,
    );

    // Log timeline event
    try {
      await createTimelineEvent({
        eventType: "project_completed",
        entityType: "Project",
        entityId: project._id,
        performedByUserId: userId,
        description: `Project "${project.name}" marked as completed automatically as all posters/videos/shoots were assigned`,
        metadata: {
          projectId: project._id.toString(),
          projectName: project.name,
          previousStatus,
          currentStatus: "completed",
        },
        companyId: tenantCompanyId,
      });
    } catch (error) {
      console.error(
        "[Project Service] Failed to log auto-completion timeline event:",
        error,
      );
    }
  } else if (!allItemsAssigned && project.status === "completed") {
    // REVERSION: If it was completed but a task was deleted/service changed, move back to in_progress
    project.status = "in_progress";
    project.completedAt = null;
    project.completedBy = null;
    await project.save();

    console.log(
      `[Project Service] Automated: Project ${project._id} reverted to in_progress due to refunded count.`,
    );

    // Log timeline event for reversion
    try {
      await createTimelineEvent({
        eventType: "project_started",
        entityType: "Project",
        entityId: project._id,
        performedByUserId: userId,
        description: `Project "${project.name}" reverted to In Progress as some items are now unassigned`,
        metadata: {
          projectId: project._id.toString(),
          projectName: project.name,
          previousStatus: "completed",
          currentStatus: "in_progress",
        },
        companyId: tenantCompanyId,
      });
    } catch (error) {
      console.error(
        "[Project Service] Failed to log auto-reversion timeline event:",
        error,
      );
    }
  }
};

const bulkDeleteProjects = async (projectIds, tenantCompanyId) => {
  const results = {
    success: [],
    failed: [],
  };

  for (const projectId of projectIds) {
    try {
      await deleteProject(projectId, tenantCompanyId);
      results.success.push(projectId);
    } catch (error) {
      results.failed.push({
        projectId,
        error: error.message,
      });
    }
  }

  return results;
};

module.exports = {
  getAllProjects,
  getProjectReport,
  getProjectListSummaryStats,
  getUnassignedDeliverablesSummary,
  getProjectsDropdown,
  getProjectById,
  createProject,
  updateProject,
  approveWorkflow,
  deleteProject,
  bulkDeleteProjects,
  activateProject,
  deactivateProject,
  updateProjectMilestones,
  getMilestoneWorkflowType,
  getMilestoneChecklist,
  normalizeDeliverableKey,
  projectSupportsServiceType,
  getProjectServiceCapacity,
  reconcileProjectTaskCounts,
  checkAndMarkProjectCompleted,
};
