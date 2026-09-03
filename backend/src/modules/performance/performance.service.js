const Performance = require("./performance.model");
const Task = require("../tasks/task.model");
const SalesTarget = require("../sales/sales.model");

const calculatePerformance = async (userId, month, year, companyId) => {
  // Validate inputs
  if (!userId) throw new Error("User ID is required");
  if (!month || month < 1 || month > 12)
    throw new Error("Invalid month. Must be between 1 and 12");
  if (!year || year < 2000 || year > 2100) throw new Error("Invalid year");
  if (!companyId) throw new Error("Company ID is required");

  const user = await require("../auth/user.model").findById(userId);
  if (!user) throw new Error("User not found");

  // Verify user belongs to the company
  if (user.companyId && user.companyId.toString() !== companyId.toString()) {
    throw new Error("User does not belong to the specified company");
  }

  const performance = {
    userId,
    companyId,
    month,
    year,
    role: user.role,
  };

  // Sales metrics
  if (["salesperson", "sales_manager"].includes(user.role)) {
    const target = await SalesTarget.findOne({
      userId,
      month,
      year,
      companyId,
    });
    if (target) {
      performance.salesTarget = target.targetAmount;
      performance.salesAchieved = target.achievedAmount;
    }
  }

  // Operations metrics - include admin and sales roles as they can also have tasks assigned
  // Sales managers and salespersons can have tasks, so calculate their task metrics too
  const operationsRoles = [
    "admin",
    "designer",
    "editor",
    "developer",
    "digital_marketing_manager",
    "operations_head",
    "salesperson",
    "sales_manager",
  ];

  if (operationsRoles.includes(user.role)) {
    // Calculate date range for the month (first day to last day)
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last moment of the month

    // Get all tasks assigned to user that are completed or validated
    // Note: companyId in performance is the tenantCompanyId, tasks use tenantCompanyId for tenant
    // Tasks also have companyId which is the client company
    const allTasks = await Task.find({
      assignedTo: userId,
      tenantCompanyId: companyId, // Use tenantCompanyId to match tenant
      status: { $in: ["completed", "validated"] },
    }).lean(); // Use lean() for better performance

    console.log(
      `[Performance] Found ${allTasks.length} completed/validated tasks for user ${userId} in company ${companyId}`,
    );

    // Filter tasks that were completed/validated in this specific month
    const tasks = allTasks.filter((task) => {
      let completionDate = null;

      // Priority 1: Check actualCompletionDate
      if (task.actualCompletionDate) {
        completionDate = new Date(task.actualCompletionDate);
      }
      // Priority 2: Fallback to validatedAt
      else if (task.validatedAt) {
        completionDate = new Date(task.validatedAt);
      }
      // Priority 3: Use updatedAt if status is completed/validated
      else if (
        task.updatedAt &&
        ["completed", "validated"].includes(task.status)
      ) {
        completionDate = new Date(task.updatedAt);
      }

      if (!completionDate) return false;

      // Normalize dates to start of day for comparison (ignore time)
      const compDateStart = new Date(
        completionDate.getFullYear(),
        completionDate.getMonth(),
        completionDate.getDate(),
      );
      const startDateNormalized = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
      );
      const endDateNormalized = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
      );

      return (
        compDateStart >= startDateNormalized &&
        compDateStart <= endDateNormalized
      );
    });

    // Initialize default values
    performance.tasksCompleted = 0;
    performance.tasksOnTime = 0;
    performance.tasksDelayed = 0;
    performance.reworkCount = 0;
    performance.averageQualityScore = 0;

    console.log(
      `[Performance] Filtered to ${tasks.length} tasks completed in month ${month}/${year}`,
    );

    if (tasks.length > 0) {
      // Count completed tasks (all tasks in the filtered list are completed/validated)
      performance.tasksCompleted = tasks.length;

      // Count on-time tasks (completed before or on due date)
      performance.tasksOnTime = tasks.filter((t) => {
        const completionDate =
          t.actualCompletionDate || t.validatedAt || t.updatedAt;
        if (!completionDate || !t.dueDate) return false;
        const compDate = new Date(completionDate);
        const dueDate = new Date(t.dueDate);
        return compDate <= dueDate;
      }).length;

      // Count delayed tasks (completed after due date)
      performance.tasksDelayed = tasks.filter((t) => {
        const completionDate =
          t.actualCompletionDate || t.validatedAt || t.updatedAt;
        if (!completionDate || !t.dueDate) return false;
        const compDate = new Date(completionDate);
        const dueDate = new Date(t.dueDate);
        return compDate > dueDate;
      }).length;

      console.log(
        `[Performance] Metrics - Completed: ${performance.tasksCompleted}, OnTime: ${performance.tasksOnTime}, Delayed: ${performance.tasksDelayed}`,
      );

      // Calculate total rework count from tasks completed in this month
      performance.reworkCount = tasks.reduce(
        (sum, t) => sum + (t.reworkCount || 0),
        0,
      );

      // Calculate average quality score from feedback for completed tasks
      const taskIds = tasks.map((t) => t._id);
      if (taskIds.length > 0) {
        const feedbacks = await Feedback.find({
          taskId: { $in: taskIds },
          companyId,
        });

        if (feedbacks.length > 0) {
          const totalRating = feedbacks.reduce(
            (sum, f) => sum + (f.rating || 0),
            0,
          );
          performance.averageQualityScore =
            Math.round((totalRating / feedbacks.length) * 100) / 100; // Round to 2 decimal places
        }
      }
    }
  }

  // Calculate KRI and KPT scores
  performance.kriScore = calculateKRIScore(performance, user.role);
  performance.kptScore = calculateKPTScore(performance, user.role);

  // Calculate overall score (average of KRI and KPT)
  performance.overallScore = (performance.kriScore + performance.kptScore) / 2;

  // Save or update performance
  const existing = await Performance.findOne({
    userId,
    month,
    year,
    companyId,
  });
  if (existing) {
    Object.assign(existing, performance);
    await existing.save();
    return existing;
  } else {
    return await Performance.create(performance);
  }
};

const calculateKRIScore = (performance, role) => {
  // Key Result Indicator - Outcome based

  // For sales roles: prioritize sales metrics, but also consider tasks if sales target is 0
  if (["salesperson", "sales_manager"].includes(role)) {
    // If sales target exists, use sales metrics
    if (performance.salesTarget && performance.salesTarget > 0) {
      return Math.min(
        100,
        (performance.salesAchieved / performance.salesTarget) * 100,
      );
    }
    // If no sales target but has tasks, use task metrics (sales managers can have tasks)
    if (performance.tasksCompleted > 0) {
      const qualityWeight = (performance.averageQualityScore || 0) * 20; // Max 100 (5 * 20)
      const onTimeWeight =
        (performance.tasksOnTime / performance.tasksCompleted) * 50;
      return Math.min(100, qualityWeight + onTimeWeight);
    }
    return 0;
  }

  // Operations roles: admin, designer, editor, developer, digital_marketing_manager, operations_head
  if (
    [
      "admin",
      "designer",
      "editor",
      "developer",
      "digital_marketing_manager",
      "operations_head",
    ].includes(role)
  ) {
    const qualityWeight = (performance.averageQualityScore || 0) * 20; // Max 100 (5 * 20)
    const onTimeWeight =
      performance.tasksCompleted > 0
        ? (performance.tasksOnTime / performance.tasksCompleted) * 50
        : 0;
    return Math.min(100, qualityWeight + onTimeWeight);
  }

  return 0;
};

const calculateKPTScore = (performance, role) => {
  // Key Performance Target - Expectation based

  // For sales roles: prioritize sales target, but also consider tasks if sales target is 0
  if (["salesperson", "sales_manager"].includes(role)) {
    // If sales target exists, use sales metrics
    if (performance.salesTarget > 0) {
      return 100;
    }
    // If no sales target but has tasks, use task metrics (sales managers can have tasks)
    if (performance.tasksCompleted > 0) {
      const completionWeight = 50;
      const qualityWeight = (performance.averageQualityScore || 0) * 10; // Max 50 (5 * 10)
      return Math.min(100, completionWeight + qualityWeight);
    }
    return 0;
  }

  // Operations roles: admin, designer, editor, developer, digital_marketing_manager, operations_head
  if (
    [
      "admin",
      "designer",
      "editor",
      "developer",
      "digital_marketing_manager",
      "operations_head",
    ].includes(role)
  ) {
    const completionWeight = performance.tasksCompleted > 0 ? 50 : 0;
    const qualityWeight = (performance.averageQualityScore || 0) * 10; // Max 50 (5 * 10)
    return Math.min(100, completionWeight + qualityWeight);
  }

  return 0;
};

const getPerformance = async (companyId, filters = {}) => {
  if (!companyId) {
    throw new Error("Company ID is required");
  }

  const query = { companyId };

  // Apply filters
  if (filters.userId) {
    query.userId = filters.userId;
  }
  if (filters.month) {
    const month = parseInt(filters.month);
    if (month >= 1 && month <= 12) {
      query.month = month;
    }
  }
  if (filters.year) {
    const year = parseInt(filters.year);
    if (year >= 2000 && year <= 2100) {
      query.year = year;
    }
  }
  if (filters.role) {
    query.role = filters.role;
  }

  const performance = await Performance.find(query)
    .populate("userId", "name email role")
    .sort({ year: -1, month: -1, createdAt: -1 });

  // Ensure overallScore is calculated for all records
  return performance.map((perf) => {
    if (!perf.overallScore || perf.overallScore === 0) {
      perf.overallScore = (perf.kriScore + perf.kptScore) / 2;
    }
    return perf;
  });
};

/**
 * Calculate performance for all active users in a company for a given month/year
 * @param {string} companyId - Company ID
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Promise<Array>} Array of performance records
 */
const calculatePerformanceForAllUsers = async (companyId, month, year) => {
  // Validate inputs
  if (!companyId) throw new Error("Company ID is required");
  if (!month || month < 1 || month > 12)
    throw new Error("Invalid month. Must be between 1 and 12");
  if (!year || year < 2000 || year > 2100) throw new Error("Invalid year");

  const User = require("../auth/user.model");

  // Get all active users in the company/agency
  let users = await User.find({
    isActive: true,
    $or: [
      { agencyId: companyId },
      { adminId: companyId },
      { companyId: companyId },
      { _id: companyId },
    ],
  }).select("_id role");

  if (users.length === 0) {
    users = await User.find({ isActive: true }).select("_id role");
  }

  if (users.length === 0) {
    return [];
  }

  const results = [];
  const errors = [];

  // Calculate performance for each user
  for (const user of users) {
    try {
      const performance = await calculatePerformance(
        user._id,
        month,
        year,
        companyId,
      );
      results.push(performance);
    } catch (error) {
      errors.push({
        userId: user._id,
        error: error.message,
      });
    }
  }

  return {
    success: results.length,
    failed: errors.length,
    results,
    errors: errors.length > 0 ? errors : undefined,
  };
};

module.exports = {
  calculatePerformance,
  getPerformance,
  calculatePerformanceForAllUsers,
};
