const performanceScorecardService = require("./performanceScorecard.service");
const { sendSuccess, sendError } = require("../../utils/response");

/**
 * Submit self-assessment (user fills their own grades)
 */
const submitSelfAssessment = async (req, res, next) => {
  try {
    const companyId = req.companyId || req.user?.agencyId || req.user?.brandId || req.user?.workspaceId || req.user?._id;
    const userId = req.user?._id || req.user?.id;
    const scorecard = await performanceScorecardService.submitSelfAssessment(
      req.body,
      companyId,
      userId,
    );
    return sendSuccess(res, "Self-assessment submitted successfully", {
      scorecard,
    });
  } catch (error) {
    if (
      error.message.includes("not found") ||
      error.message.includes("does not belong")
    ) {
      return sendError(res, 404, error.message);
    }
    return sendError(
      res,
      400,
      error.message || "Failed to submit self-assessment",
    );
  }
};

/**
 * Get self-assessment for a user (current user by default, or specified userId for admin)
 */
const getSelfAssessment = async (req, res) => {
  try {
    const { month, year, userId } = req.query;
    if (!month || !year) {
      return sendError(res, 400, "Month and year are required");
    }
    // Allow admin to fetch any user's self-assessment, otherwise use current user
    const targetUserId = userId || req.user._id;
    const scorecard = await performanceScorecardService.getSelfAssessment(
      targetUserId,
      req.companyId,
      parseInt(month),
      parseInt(year),
    );
    return sendSuccess(res, "Self-assessment retrieved successfully", {
      scorecard,
    });
  } catch (error) {
    if (
      error.message.includes("required") ||
      error.message.includes("Invalid")
    ) {
      return sendError(res, 400, error.message);
    }
    return sendError(
      res,
      500,
      error.message || "Failed to retrieve self-assessment",
    );
  }
};

/**
 * Create or update performance scorecard (admin review)
 */
const createOrUpdateScorecard = async (req, res) => {
  try {
    const scorecard = await performanceScorecardService.createOrUpdateScorecard(
      req.body,
      req.companyId,
      req.user._id, // Pass admin user ID for review tracking
    );

    // If review is completed, send notification to the user
    if (scorecard.status === "review_completed" && scorecard.userId) {
      try {
        const Notification = require("../tasks/notification.model");
        const notification = await Notification.create({
          userId: scorecard.userId,
          type: "performance_review_completed",
          title: "Performance Review Completed",
          message: `Your performance review for ${scorecard.month}/${scorecard.year} has been completed. Please check your performance history.`,
          isRead: false,
          channels: {
            inApp: true,
            email: false,
          },
          metadata: {
            scorecardId: scorecard._id,
            month: scorecard.month,
            year: scorecard.year,
          },
        });

        // Emit notification via Socket.IO
        try {
          const socketIO = require("../../utils/socket");
          socketIO.emitNotification(scorecard.userId.toString(), notification);
        } catch (socketError) {
          console.error(
            "Error emitting notification via Socket.IO:",
            socketError,
          );
        }
      } catch (notificationError) {
        console.error("Error creating notification:", notificationError);
        // Don't fail the request if notification fails
      }
    }

    return sendSuccess(res, "Performance scorecard saved successfully", {
      scorecard,
    });
  } catch (error) {
    if (
      error.message.includes("not found") ||
      error.message.includes("does not belong")
    ) {
      return sendError(res, 404, error.message);
    }
    if (
      error.message.includes("Invalid") ||
      error.message.includes("required")
    ) {
      return sendError(res, 400, error.message);
    }
    return sendError(
      res,
      500,
      error.message || "Failed to save performance scorecard",
    );
  }
};

/**
 * Get last month's performance scorecard for current user
 */
const getLastMonthScorecard = async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id;
    const scorecard = await performanceScorecardService.getLastMonthScorecard(
      userId,
      req.companyId,
    );

    if (!scorecard) {
      return sendSuccess(res, "No performance scorecard found for last month", {
        scorecard: null,
      });
    }

    return sendSuccess(
      res,
      "Last month performance scorecard retrieved successfully",
      { scorecard },
    );
  } catch (error) {
    if (error.message.includes("required")) {
      return sendError(res, 400, error.message);
    }
    return sendError(
      res,
      500,
      error.message || "Failed to retrieve last month scorecard",
    );
  }
};

/**
 * Get performance history for a user
 */
const getPerformanceHistory = async (req, res) => {
  try {
    // For non-admin users, always use their own userId
    // For admin users, use userId from query or default to req.user.id
    const userRole = req.user.role;
    const isAdmin = [
      "admin",
      "superadmin",
      "super_admin",
      "supreme_super_admin",
      "commander_admin",
      "agency_super_admin",
      "agency_manager",
      "agency",
      "operations_head",
      "sales_manager",
      "brand_super_admin",
      "brand_admin",
      "brand_manager",
      "hr",
      "hr_manager",
    ].includes(userRole);

    let userId = req.query.userId;

    // If no userId provided and user is not admin, use their own userId
    if (!userId && !isAdmin) {
      userId = req.user._id || req.user.id;
    }

    // If still no userId, use req.user.id as fallback
    if (!userId) {
      userId = req.user._id || req.user.id;
    }

    console.log("getPerformanceHistory:", {
      userRole,
      isAdmin,
      requestedUserId: req.query.userId,
      finalUserId: userId,
      companyId: req.companyId,
      filters: req.query,
    });

    const history = await performanceScorecardService.getPerformanceHistory(
      userId,
      req.companyId,
      req.query,
    );

    console.log("getPerformanceHistory result:", {
      userId,
      count: history?.length || 0,
    });

    return sendSuccess(res, "Performance history retrieved successfully", {
      history,
    });
  } catch (error) {
    console.error("getPerformanceHistory error:", error);
    if (error.message.includes("required")) {
      return sendError(res, 400, error.message);
    }
    return sendError(
      res,
      500,
      error.message || "Failed to retrieve performance history",
    );
  }
};

/**
 * Get all performance scorecards (for admin/HR)
 */
const getAllScorecards = async (req, res) => {
  try {
    console.log("getAllScorecards:", {
      userRole: req.user.role,
      companyId: req.companyId,
      filters: req.query,
    });

    const scorecards = await performanceScorecardService.getAllScorecards(
      req.companyId,
      req.query,
    );

    console.log("getAllScorecards result:", {
      count: scorecards?.length || 0,
      filters: req.query,
    });

    return sendSuccess(res, "Performance scorecards retrieved successfully", {
      scorecards,
    });
  } catch (error) {
    console.error("getAllScorecards error:", error);
    if (error.message.includes("required")) {
      return sendError(res, 400, error.message);
    }
    return sendError(
      res,
      500,
      error.message || "Failed to retrieve performance scorecards",
    );
  }
};

/**
 * Get scorecard by ID
 */
const getScorecardById = async (req, res) => {
  try {
    const scorecard = await performanceScorecardService.getScorecardById(
      req.params.id,
      req.companyId,
    );
    return sendSuccess(res, "Performance scorecard retrieved successfully", {
      scorecard,
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      return sendError(res, 404, error.message);
    }
    if (error.message.includes("required")) {
      return sendError(res, 400, error.message);
    }
    return sendError(
      res,
      500,
      error.message || "Failed to retrieve performance scorecard",
    );
  }
};

/**
 * Get users who haven't completed self-assessment
 */
const getUsersWithoutSelfAssessment = async (req, res) => {
  try {
    const month = parseInt(req.query.month);
    const year = parseInt(req.query.year);

    if (!month || month < 1 || month > 12) {
      return sendError(res, 400, "Valid month (1-12) is required");
    }
    if (!year) {
      return sendError(res, 400, "Year is required");
    }

    const companyId = req.companyId || req.user?.agencyId || req.user?._id;

    const users =
      await performanceScorecardService.getUsersWithoutSelfAssessment(
        companyId,
        month,
        year,
      );

    return sendSuccess(
      res,
      "Users without self-assessment retrieved successfully",
      { users },
    );
  } catch (error) {
    console.error("getUsersWithoutSelfAssessment error:", error);
    if (error.message.includes("required")) {
      return sendError(res, 400, error.message);
    }
    return sendError(
      res,
      500,
      error.message || "Failed to retrieve users without self-assessment",
    );
  }
};

/**
 * Notify users about pending self-assessment
 */
const notifyPendingSelfAssessment = async (req, res) => {
  try {
    const { month, year, userIds } = req.body;

    if (!month || month < 1 || month > 12) {
      return sendError(res, 400, "Valid month (1-12) is required");
    }
    if (!year) {
      return sendError(res, 400, "Year is required");
    }

    console.log("notifyPendingSelfAssessment:", {
      month,
      year,
      userIds,
      companyId: req.companyId,
    });

    const result =
      await performanceScorecardService.notifyPendingSelfAssessment(
        req.companyId,
        month,
        year,
        userIds,
      );

    console.log("notifyPendingSelfAssessment result:", result);

    return sendSuccess(res, "Notifications sent successfully", result);
  } catch (error) {
    console.error("notifyPendingSelfAssessment error:", error);
    if (error.message.includes("required")) {
      return sendError(res, 400, error.message);
    }
    return sendError(res, 500, error.message || "Failed to send notifications");
  }
};

module.exports = {
  submitSelfAssessment,
  getSelfAssessment,
  createOrUpdateScorecard,
  getLastMonthScorecard,
  getPerformanceHistory,
  getAllScorecards,
  getScorecardById,
  getUsersWithoutSelfAssessment,
  notifyPendingSelfAssessment,
};
