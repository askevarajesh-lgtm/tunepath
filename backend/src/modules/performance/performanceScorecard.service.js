const PerformanceScorecard = require("./performanceScorecard.model");
const User = require("../auth/user.model");

// Grade to score mapping
const GRADE_SCORES = {
  A: 90, // EXCELLENT
  B: 75, // GOOD
  C: 60, // NEED IMPROVEMENT
  D: 40, // REMAINS SAME
};

/**
 * Calculate appraisal score based on performance categories
 * @param {Object} categories - Performance categories object
 * @param {String} evaluator - 'self', 'oh', or 'hr'
 * @returns {Number} Score out of 100
 */
const calculateAppraisalScore = (categories, evaluator) => {
  const categoryKeys = Object.keys(categories);
  let totalScore = 0;
  let count = 0;

  categoryKeys.forEach((key) => {
    const category = categories[key];
    if (category && category[evaluator]) {
      const grade = category[evaluator];
      totalScore += GRADE_SCORES[grade] || 0;
      count++;
    }
  });

  return count > 0 ? Math.round(totalScore / count) : 0;
};

/**
 * Submit self-assessment (user fills their own grades)
 * @param {Object} selfAssessmentData - Self-assessment data (only self grades)
 * @param {String} companyId - Company ID
 * @param {String} userId - User ID (the user submitting their self-assessment)
 * @returns {Promise<Object>} Created/Updated scorecard
 */
const submitSelfAssessment = async (selfAssessmentData, companyId, userId) => {
  const { month, year } = selfAssessmentData;

  // Validate inputs
  if (!month || month < 1 || month > 12)
    throw new Error("Invalid month. Must be between 1 and 12");
  if (!year || year < 2000 || year > 2100) throw new Error("Invalid year");
  if (!companyId) throw new Error("Company ID is required");

  // Verify user exists and belongs to company
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (user.companyId && user.companyId.toString() !== companyId.toString()) {
    throw new Error("User does not belong to the specified company");
  }

  // Check if scorecard already exists
  let existing = await PerformanceScorecard.findOne({
    userId,
    month,
    year,
    companyId,
  });

  // Prevent re-submission if already submitted
  if (
    existing &&
    (existing.status === "self_submitted" ||
      existing.status === "review_completed")
  ) {
    throw new Error(
      `You have already submitted your self-assessment for ${month}/${year}. You cannot submit again for this period.`,
    );
  }

  if (existing && existing.status === "review_completed") {
    throw new Error("Cannot modify self-assessment after review is completed");
  }

  // Prepare self-assessment data (only self grades)
  const performanceCategories = {};
  const categoryKeys = Object.keys(
    selfAssessmentData.performanceCategories || {},
  );

  categoryKeys.forEach((key) => {
    if (selfAssessmentData.performanceCategories[key]?.self) {
      // Only include self grade, don't include OH and HR at all
      performanceCategories[key] = {
        self: selfAssessmentData.performanceCategories[key].self,
      };
      // Only preserve existing OH and HR grades if they exist and are not null/undefined
      if (
        existing?.performanceCategories?.[key]?.oh &&
        existing.performanceCategories[key].oh !== null &&
        existing.performanceCategories[key].oh !== undefined
      ) {
        performanceCategories[key].oh = existing.performanceCategories[key].oh;
      }
      if (
        existing?.performanceCategories?.[key]?.hr &&
        existing.performanceCategories[key].hr !== null &&
        existing.performanceCategories[key].hr !== undefined
      ) {
        performanceCategories[key].hr = existing.performanceCategories[key].hr;
      }
    }
  });

  // Calculate self appraisal score
  const selfScore = calculateAppraisalScore(performanceCategories, "self");

  if (existing) {
    // Update existing scorecard with self-assessment
    // Merge performance categories, only updating self grades and preserving OH/HR if they exist
    Object.keys(performanceCategories).forEach((key) => {
      if (!existing.performanceCategories) {
        existing.performanceCategories = {};
      }
      if (!existing.performanceCategories[key]) {
        existing.performanceCategories[key] = {};
      }
      // Update self grade
      existing.performanceCategories[key].self =
        performanceCategories[key].self;
      // Only update OH/HR if they're provided in the update (shouldn't happen in self-assessment, but preserve existing)
      if (
        performanceCategories[key].oh !== undefined &&
        performanceCategories[key].oh !== null
      ) {
        existing.performanceCategories[key].oh = performanceCategories[key].oh;
      }
      if (
        performanceCategories[key].hr !== undefined &&
        performanceCategories[key].hr !== null
      ) {
        existing.performanceCategories[key].hr = performanceCategories[key].hr;
      }
      // Don't set OH/HR to null if they don't exist - leave them undefined
    });

    existing.appraisalScores.self = selfScore;
    existing.status = "self_submitted";
    existing.submittedBy = userId;
    existing.submittedAt = new Date();
    // Recalculate overall if OH and HR scores exist
    if (existing.appraisalScores.oh && existing.appraisalScores.hr) {
      existing.appraisalScores.overall = Math.round(
        (selfScore +
          existing.appraisalScores.oh +
          existing.appraisalScores.hr) /
          3,
      );
    } else {
      // If OH/HR not set, overall is just self score for now
      existing.appraisalScores.overall = selfScore;
    }
    await existing.save();
    return existing;
  } else {
    // Create new scorecard with self-assessment
    // Only include self grades, don't include OH/HR fields at all
    const cleanPerformanceCategories = {};
    Object.keys(performanceCategories).forEach((key) => {
      // Only include self grade, explicitly don't include OH/HR
      cleanPerformanceCategories[key] = {
        self: performanceCategories[key].self,
      };
      // Explicitly do NOT set oh and hr - they should be undefined, not null
    });

    const scorecard = {
      userId,
      companyId,
      month,
      year,
      name: user.name,
      designation: user.role,
      team: user.team || null,
      evaluationDate: selfAssessmentData.evaluationDate || new Date(),
      performanceCategories: cleanPerformanceCategories,
      appraisalScores: {
        self: selfScore,
        oh: 0,
        hr: 0,
        overall: selfScore, // Initially just self score
      },
      status: "self_submitted",
      submittedBy: userId,
      submittedAt: new Date(),
    };

    // Use create with runValidators to ensure validation passes
    const newScorecard = new PerformanceScorecard(scorecard);
    await newScorecard.save();
    return newScorecard;
  }
};

/**
 * Create or update performance scorecard (admin review)
 * @param {Object} scorecardData - Scorecard data
 * @param {String} companyId - Company ID
 * @param {String} reviewedByUserId - User ID of the admin reviewing
 * @returns {Promise<Object>} Created/Updated scorecard
 */
const createOrUpdateScorecard = async (
  scorecardData,
  companyId,
  reviewedByUserId = null,
) => {
  const { userId, month, year } = scorecardData;

  // Validate inputs
  if (!userId) throw new Error("User ID is required");
  if (!month || month < 1 || month > 12)
    throw new Error("Invalid month. Must be between 1 and 12");
  if (!year || year < 2000 || year > 2100) throw new Error("Invalid year");
  if (!companyId) throw new Error("Company ID is required");

  // Verify user exists and belongs to company
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (user.companyId && user.companyId.toString() !== companyId.toString()) {
    throw new Error("User does not belong to the specified company");
  }

  // Calculate appraisal scores - use manual scores if provided, otherwise calculate from categories
  const appraisalScores = {
    self:
      scorecardData.appraisalScores?.self !== undefined
        ? parseInt(scorecardData.appraisalScores.self)
        : calculateAppraisalScore(
            scorecardData.performanceCategories || {},
            "self",
          ),
    oh:
      scorecardData.appraisalScores?.oh !== undefined
        ? parseInt(scorecardData.appraisalScores.oh)
        : calculateAppraisalScore(
            scorecardData.performanceCategories || {},
            "oh",
          ),
    hr:
      scorecardData.appraisalScores?.hr !== undefined
        ? parseInt(scorecardData.appraisalScores.hr)
        : calculateAppraisalScore(
            scorecardData.performanceCategories || {},
            "hr",
          ),
  };

  // Validate scores are within range
  if (appraisalScores.self < 0 || appraisalScores.self > 100) {
    throw new Error("SELF score must be between 0 and 100");
  }
  if (appraisalScores.oh < 0 || appraisalScores.oh > 100) {
    throw new Error("OH score must be between 0 and 100");
  }
  if (appraisalScores.hr < 0 || appraisalScores.hr > 100) {
    throw new Error("HR score must be between 0 and 100");
  }

  // Calculate overall performance (average of SELF, OH, HR)
  const overallScore = Math.round(
    (appraisalScores.self + appraisalScores.oh + appraisalScores.hr) / 3,
  );
  appraisalScores.overall = overallScore;

  // Check if scorecard already exists for this user/month/year or if updating by ID
  let existing = null;
  if (scorecardData._id) {
    // If updating by ID, find by ID
    existing = await PerformanceScorecard.findOne({
      _id: scorecardData._id,
      companyId,
    });
  } else {
    // Otherwise, check by user/month/year
    existing = await PerformanceScorecard.findOne({
      userId,
      month,
      year,
      companyId,
    });
  }

  // Prepare scorecard data
  const scorecardUpdate = {
    userId,
    companyId,
    month,
    year,
    name: scorecardData.name || user.name,
    designation: scorecardData.designation || user.role,
    team: scorecardData.team || user.team || null,
    evaluationDate: scorecardData.evaluationDate || new Date(),
    performanceCategories: scorecardData.performanceCategories,
    appraisalScores,
    roomForImprovement: scorecardData.roomForImprovement || null,
    remarks: {
      tl: scorecardData.remarks?.tl || null,
      oh: scorecardData.remarks?.oh || null,
      hr: scorecardData.remarks?.hr || null,
    },
  };

  // If admin is reviewing, update status and review info
  if (reviewedByUserId) {
    scorecardUpdate.status = "review_completed";
    scorecardUpdate.reviewedBy = reviewedByUserId;
    scorecardUpdate.reviewedAt = new Date();
  }

  if (existing) {
    // Preserve self-assessment submission info if it exists
    if (existing.submittedBy && !scorecardUpdate.submittedBy) {
      scorecardUpdate.submittedBy = existing.submittedBy;
      scorecardUpdate.submittedAt = existing.submittedAt;
    }
    // Update existing scorecard
    Object.assign(existing, scorecardUpdate);
    await existing.save();
    return existing;
  } else {
    // Create new scorecard
    return await PerformanceScorecard.create(scorecardUpdate);
  }
};

/**
 * Get last month's performance scorecard for a user
 * @param {String} userId - User ID
 * @param {String} companyId - Company ID
 * @returns {Promise<Object|null>} Last month's scorecard or null
 */
const getLastMonthScorecard = async (userId, companyId) => {
  if (!userId) throw new Error("User ID is required");
  if (!companyId) throw new Error("Company ID is required");

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11, so add 1 for 1-12
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const lastMonthYear =
    currentMonth === 1 ? now.getFullYear() - 1 : now.getFullYear();

  const scorecard = await PerformanceScorecard.findOne({
    userId,
    month: lastMonth,
    year: lastMonthYear,
    companyId,
  })
    .populate("userId", "name email role team")
    .sort({ createdAt: -1 });

  return scorecard;
};

/**
 * Get performance history for a user
 * @param {String} userId - User ID
 * @param {String} companyId - Company ID
 * @param {Object} filters - Optional filters (month, year)
 * @returns {Promise<Array>} Array of scorecards
 */
const getPerformanceHistory = async (userId, companyId, filters = {}) => {
  if (!userId) throw new Error("User ID is required");
  if (!companyId) throw new Error("Company ID is required");

  const query = { userId, companyId };

  if (filters.month) {
    query.month = parseInt(filters.month);
  }
  if (filters.year) {
    query.year = parseInt(filters.year);
  }

  const scorecards = await PerformanceScorecard.find(query)
    .populate("userId", "name email role team")
    .sort({ year: -1, month: -1, createdAt: -1 });

  return scorecards;
};

/**
 * Get all performance scorecards for a company
 * @param {String} companyId - Company ID
 * @param {Object} filters - Optional filters (userId, month, year)
 * @returns {Promise<Array>} Array of scorecards
 */
const getAllScorecards = async (companyId, filters = {}) => {
  const query = {};

  if (companyId) {
    query.$or = [{ companyId }, { agencyId: companyId }];
  }

  if (filters.userId) {
    query.userId = filters.userId;
  }
  if (filters.month) {
    query.month = parseInt(filters.month);
  }
  if (filters.year) {
    query.year = parseInt(filters.year);
  }

  let scorecards = await PerformanceScorecard.find(query)
    .populate("userId", "name email role team")
    .sort({ year: -1, month: -1, createdAt: -1 });

  // Fallback: If no scorecards found for companyId filter, search by month/year
  if (scorecards.length === 0 && (filters.month || filters.year)) {
    const fallbackQuery = {};
    if (filters.userId) fallbackQuery.userId = filters.userId;
    if (filters.month) fallbackQuery.month = parseInt(filters.month);
    if (filters.year) fallbackQuery.year = parseInt(filters.year);
    scorecards = await PerformanceScorecard.find(fallbackQuery)
      .populate("userId", "name email role team")
      .sort({ year: -1, month: -1, createdAt: -1 });
  }

  return scorecards;
};

/**
 * Get scorecard by ID
 * @param {String} scorecardId - Scorecard ID
 * @param {String} companyId - Company ID
 * @returns {Promise<Object>} Scorecard
 */
const getScorecardById = async (scorecardId, companyId) => {
  if (!scorecardId) throw new Error("Scorecard ID is required");
  if (!companyId) throw new Error("Company ID is required");

  const scorecard = await PerformanceScorecard.findOne({
    _id: scorecardId,
    companyId,
  }).populate("userId", "name email role team");

  if (!scorecard) {
    throw new Error("Scorecard not found");
  }

  return scorecard;
};

/**
 * Get self-assessment for current user and month/year
 * @param {String} userId - User ID
 * @param {String} companyId - Company ID
 * @param {Number} month - Month (1-12)
 * @param {Number} year - Year
 * @returns {Promise<Object|null>} Self-assessment scorecard or null
 */
const getSelfAssessment = async (userId, companyId, month, year) => {
  if (!userId) throw new Error("User ID is required");
  if (!companyId) throw new Error("Company ID is required");
  if (!month || month < 1 || month > 12) throw new Error("Invalid month");
  if (!year) throw new Error("Year is required");

  const scorecard = await PerformanceScorecard.findOne({
    userId,
    month,
    year,
    companyId,
  }).populate("userId", "name email role team");

  return scorecard;
};

/**
 * Get users who haven't completed self-assessment for a given month/year
 * @param {String} companyId - Company ID
 * @param {Number} month - Month (1-12)
 * @param {Number} year - Year
 * @returns {Promise<Array>} Array of users who haven't completed self-assessment
 */
const getUsersWithoutSelfAssessment = async (companyId, month, year) => {
  if (!companyId) throw new Error("Company ID is required");
  if (!month || month < 1 || month > 12) throw new Error("Invalid month");
  if (!year) throw new Error("Year is required");

  const User = require("../auth/user.model");

  const excludeRoles = [
    "admin",
    "superadmin",
    "super_admin",
    "supreme_super_admin",
    "commander_admin",
    "agency_super_admin",
    "agency_manager",
    "agency",
    "brand_super_admin",
    "brand_admin",
    "brand_manager",
    "agency_client",
    "client",
  ];

  // Get all active staff users in the company/agency
  let allUsers = await User.find({
    isActive: true,
    role: { $nin: excludeRoles },
    $or: [
      { agencyId: companyId },
      { adminId: companyId },
      { companyId: companyId },
      { _id: companyId },
      { createdBy: companyId },
    ],
  }).select("_id name email role team");

  // Fallback: If tenant query yields 0 users, search all active staff users
  if (allUsers.length === 0) {
    allUsers = await User.find({
      isActive: true,
      role: { $nin: excludeRoles },
    }).select("_id name email role team");
  }

  // Get users who have submitted self-assessment for this month/year
  const usersWithAssessment = await PerformanceScorecard.find({
    month,
    year,
    status: { $in: ["self_submitted", "review_completed"] },
  })
    .select("userId")
    .distinct("userId");

  // Filter out users who have already submitted
  const usersWithoutAssessment = allUsers.filter(
    (user) =>
      !usersWithAssessment.some(
        (userId) => userId.toString() === user._id.toString(),
      ),
  );

  return usersWithoutAssessment;
};

/**
 * Notify users about pending self-assessment
 * @param {String} companyId - Company ID
 * @param {Number} month - Month (1-12)
 * @param {Number} year - Year
 * @param {Array} userIds - Optional array of specific user IDs to notify (if not provided, notifies all users without assessment)
 * @returns {Promise<Object>} Result with notified users count
 */
const notifyPendingSelfAssessment = async (
  companyId,
  month,
  year,
  userIds = null,
) => {
  if (!companyId) throw new Error("Company ID is required");
  if (!month || month < 1 || month > 12) throw new Error("Invalid month");
  if (!year) throw new Error("Year is required");

  const Notification = require("../tasks/notification.model");
  const User = require("../auth/user.model");

  let usersToNotify = [];

  if (userIds && userIds.length > 0) {
    // Notify specific users
    usersToNotify = await User.find({
      _id: { $in: userIds },
      isActive: true,
    }).select("_id name email role");
  } else {
    // Get all users without self-assessment
    usersToNotify = await getUsersWithoutSelfAssessment(companyId, month, year);
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthName = monthNames[month - 1];

  // Create notifications for each user
  const notifications = [];
  for (const user of usersToNotify) {
    // Check if notification already exists for this user/month/year
    const existingNotification = await Notification.findOne({
      userId: user._id,
      type: "performance_self_assessment_pending",
      "metadata.month": month,
      "metadata.year": year,
      isRead: false,
    });

    // Only create if no unread notification exists
    if (!existingNotification) {
      const notification = await Notification.create({
        userId: user._id,
        type: "performance_self_assessment_pending",
        title: "Self-Assessment Pending",
        message: `Please complete your self-assessment for ${monthName} ${year}. Your performance review is pending.`,
        channels: {
          inApp: true,
          email: false, // Will be enabled later
        },
        metadata: {
          month,
          year,
          monthName,
        },
      });
      notifications.push(notification);
    }
  }

  return {
    notified: notifications.length,
    totalUsers: usersToNotify.length,
    users: usersToNotify.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
    })),
  };
};

module.exports = {
  submitSelfAssessment,
  createOrUpdateScorecard,
  getLastMonthScorecard,
  getPerformanceHistory,
  getAllScorecards,
  getScorecardById,
  getSelfAssessment,
  getUsersWithoutSelfAssessment,
  notifyPendingSelfAssessment,
  calculateAppraisalScore,
  GRADE_SCORES,
};
