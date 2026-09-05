const Notepad = require("./notepad.model");
const Notification = require("../tasks/notification.model");
const User = require("../auth/user.model");
const logger = console;

/**
 * Get today's note for a user
 */
const getTodayNote = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const note = await Notepad.findOne({
    userId,
    noteDate: {
      $gte: today,
      $lt: tomorrow,
    },
  });

  // Check if note is still editable
  if (note) {
    note.isEditable = note.checkEditable();
    await note.save();
  }

  return note;
};

/**
 * Create or update today's note
 */
const createOrUpdateTodayNote = async (userId, content) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check if note exists for today
  let note = await Notepad.findOne({
    userId,
    noteDate: {
      $gte: today,
      $lt: tomorrow,
    },
  });

  let isNew = false;
  if (note) {
    // Ensure editExpiresAt exists (for backward compatibility)
    if (!note.editExpiresAt && note.createdAt) {
      note.editExpiresAt = new Date(
        note.createdAt.getTime() + 25 * 60 * 60 * 1000,
      );
    }
    // Check if still editable
    if (!note.checkEditable()) {
      throw new Error("Note cannot be edited after 25 hours");
    }
    // Update existing note
    note.content = content;
    note.updatedAt = new Date();
    await note.save();
  } else {
    // Create new note - editExpiresAt will be set by pre-save hook
    note = await Notepad.create({
      userId,
      noteDate: today,
      content,
    });
    isNew = true;
  }

  // Role-based Notification Routing: Notify the user's creator
  try {
    const user = await User.findById(userId).select("name email createdBy");
    if (user && user.createdBy) {
      // Create and send notification to the parent/creator
      const notification = await Notification.create({
        userId: user.createdBy,
        type: "daily_report_submitted",
        title: "Daily Report Submitted",
        message: `${user.name || user.email} has submitted their daily report.`,
        isRead: false,
      });

      try {
        const socketIO = require("../../utils/socket");
        socketIO.emitNotification(user.createdBy.toString(), notification);
      } catch (socketError) {
        logger.error("Error emitting notification via Socket.IO:", socketError);
      }
    }
  } catch (error) {
    logger.error("Error notifying parent of report submission:", error);
  }

  return note;
};

/**
 * Get notes history for a user
 */
const getNotesHistory = async (userId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const notes = await Notepad.find({ userId })
    .sort({ noteDate: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Check editability for each note
  const notesWithEditability = notes.map((note) => ({
    ...note,
    isEditable: new Date() < new Date(note.editExpiresAt),
  }));

  const total = await Notepad.countDocuments({ userId });

  return {
    notes: notesWithEditability,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Check if users have notes for today and send notifications at 6:30 PM
 */
const checkAndNotifyMissingNotes = async () => {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Only run at 6:30 PM (18:30)
    if (currentHour !== 18 || currentMinute !== 30) {
      return;
    }

    logger.info("Checking for missing daily notes at 6:30 PM...");

    const users = await User.find({
      isActive: true,
      role: "user",
    }).select("_id name email");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check each user
    for (const user of users) {
      const hasNote = await Notepad.findOne({
        userId: user._id,
        noteDate: {
          $gte: today,
          $lt: tomorrow,
        },
      });

      if (!hasNote) {
        // Send notification
        try {
          const notification = await Notification.create({
            userId: user._id,
            type: "daily_note_reminder",
            title: "Daily Note Reminder",
            message:
              "You haven't added your daily note yet. Please add it before the 25-hour edit window expires.",
            isRead: false,
          });

          // Emit notification via Socket.IO
          try {
            const socketIO = require("../../utils/socket");
            socketIO.emitNotification(user._id.toString(), notification);
          } catch (socketError) {
            logger.error(
              "Error emitting notification via Socket.IO:",
              socketError,
            );
            // Don't fail if Socket.IO emission fails
          }

          logger.info(
            `Notification sent to user ${user.email} for missing daily note`,
          );
        } catch (error) {
          logger.error(
            `Failed to send notification to user ${user._id}:`,
            error,
          );
        }
      }
    }

    logger.info("Daily note check completed");
  } catch (error) {
    logger.error("Error checking missing notes:", error);
  }
};

/**
 * Get latest daily reports from all users (for admin)
 * Returns the most recent note from each user
 */
const getAllUsersLatestReports = async (tenantId, reqQuery = {}) => {
  // Get all active users belonging to this tenant
  const users = await User.find({
    $or: [
      { agencyId: tenantId },
      { brandId: tenantId },
      { adminId: tenantId },
      { workspaceId: tenantId },
      { createdBy: tenantId }
    ],
    isActive: true,
    role: "user",
  })
    .select("_id name email role googleSheetUrl")
    .lean();

  const latestReports = [];

  // Parse date query if provided (e.g. reqQuery.date or reqQuery.startDate)
  let targetDateStart = null;
  let targetDateEnd = null;
  if (reqQuery.date) {
    targetDateStart = new Date(reqQuery.date);
    targetDateStart.setHours(0, 0, 0, 0);
    targetDateEnd = new Date(reqQuery.date);
    targetDateEnd.setHours(23, 59, 59, 999);
  } else if (reqQuery.startDate || reqQuery.endDate) {
    if (reqQuery.startDate) {
      targetDateStart = new Date(reqQuery.startDate);
      targetDateStart.setHours(0, 0, 0, 0);
    }
    if (reqQuery.endDate) {
      targetDateEnd = new Date(reqQuery.endDate);
      targetDateEnd.setHours(23, 59, 59, 999);
    }
  }

  for (const user of users) {
    // Build query for user note
    const noteQuery = { userId: user._id };
    if (targetDateStart || targetDateEnd) {
      noteQuery.noteDate = {};
      if (targetDateStart) noteQuery.noteDate.$gte = targetDateStart;
      if (targetDateEnd) noteQuery.noteDate.$lte = targetDateEnd;
    }

    // Get the note for this user on the targeted date (or latest)
    const latestNote = await Notepad.findOne(noteQuery)
      .sort({ noteDate: -1, updatedAt: -1 })
      .lean();

    if (latestNote) {
      // Check editability
      const isEditable = new Date() < new Date(latestNote.editExpiresAt);

      latestReports.push({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        googleSheetUrl: user.googleSheetUrl,
        noteId: latestNote._id,
        content: latestNote.content,
        noteDate: latestNote.noteDate,
        updatedAt: latestNote.updatedAt,
        createdAt: latestNote.createdAt,
        isEditable,
      });
    } else {
      // Include users without notes
      latestReports.push({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        googleSheetUrl: user.googleSheetUrl,
        noteId: null,
        content: null,
        noteDate: null,
        updatedAt: null,
        createdAt: null,
        isEditable: false,
      });
    }
  }

  // Apply search filter if provided
  let filteredReports = latestReports;
  if (reqQuery.search) {
    const searchLower = reqQuery.search.toLowerCase();
    filteredReports = latestReports.filter(
      (report) =>
        report.userName?.toLowerCase().includes(searchLower) ||
        report.userEmail?.toLowerCase().includes(searchLower) ||
        report.content?.toLowerCase().includes(searchLower),
    );
  }

  // Sort by updatedAt (most recent first)
  filteredReports.sort((a, b) => {
    if (!a.updatedAt && !b.updatedAt) return 0;
    if (!a.updatedAt) return 1;
    if (!b.updatedAt) return -1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  // Apply pagination
  const page = parseInt(reqQuery.page) || 1;
  const limit = parseInt(reqQuery.limit) || 50;
  const skip = (page - 1) * limit;
  const total = filteredReports.length;
  const paginatedReports = filteredReports.slice(skip, skip + limit);

  return {
    reports: paginatedReports,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get all users' report history (for admin)
 * Returns all notes grouped by user
 */
const getAllUsersReportHistory = async (tenantId, reqQuery = {}) => {
  // Get all active users belonging to this tenant
  const users = await User.find({
    $or: [
      { agencyId: tenantId },
      { brandId: tenantId },
      { adminId: tenantId },
      { workspaceId: tenantId },
      { createdBy: tenantId }
    ],
    isActive: true,
    role: "user",
  })
    .select("_id name email role googleSheetUrl")
    .lean();

  const userReports = [];

  for (const user of users) {
    // Build query for this user's notes
    const noteQuery = { userId: user._id };

    // Apply date filters if provided
    if (reqQuery.startDate || reqQuery.endDate) {
      noteQuery.noteDate = {};
      if (reqQuery.startDate) {
        const startDate = new Date(reqQuery.startDate);
        startDate.setHours(0, 0, 0, 0);
        noteQuery.noteDate.$gte = startDate;
      }
      if (reqQuery.endDate) {
        const endDate = new Date(reqQuery.endDate);
        endDate.setHours(23, 59, 59, 999);
        noteQuery.noteDate.$lte = endDate;
      }
    }

    // Get all notes for this user
    const notes = await Notepad.find(noteQuery)
      .sort({ noteDate: -1, updatedAt: -1 })
      .lean();

    if (notes.length > 0 || reqQuery.includeEmpty !== "false") {
      const notesWithEditability = notes.map((note) => ({
        ...note,
        isEditable: new Date() < new Date(note.editExpiresAt),
      }));

      userReports.push({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        googleSheetUrl: user.googleSheetUrl,
        notes: notesWithEditability,
        totalNotes: notes.length,
        latestNoteDate: notes.length > 0 ? notes[0].noteDate : null,
        latestUpdateDate: notes.length > 0 ? notes[0].updatedAt : null,
      });
    }
  }

  // Apply search filter if provided
  let filteredReports = userReports;
  if (reqQuery.search) {
    const searchLower = reqQuery.search.toLowerCase();
    filteredReports = userReports.filter(
      (report) =>
        report.userName?.toLowerCase().includes(searchLower) ||
        report.userEmail?.toLowerCase().includes(searchLower) ||
        report.notes.some((note) =>
          note.content?.toLowerCase().includes(searchLower),
        ),
    );
  }

  // Sort by latest update date (most recent first)
  filteredReports.sort((a, b) => {
    if (!a.latestUpdateDate && !b.latestUpdateDate) return 0;
    if (!a.latestUpdateDate) return 1;
    if (!b.latestUpdateDate) return -1;
    return new Date(b.latestUpdateDate) - new Date(a.latestUpdateDate);
  });

  // Apply pagination
  const page = parseInt(reqQuery.page) || 1;
  const limit = parseInt(reqQuery.limit) || 20;
  const skip = (page - 1) * limit;
  const total = filteredReports.length;
  const paginatedReports = filteredReports.slice(skip, skip + limit);

  return {
    userReports: paginatedReports,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Notify users who haven't submitted yesterday's daily report (admin only)
 * This checks for reports submitted for yesterday's date specifically
 */
const notifyMissingYesterdayReports = async (tenantId) => {
  try {
    logger.info("Checking for missing yesterday daily reports...");

    // Calculate yesterday's date range
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);

    // Get all active users belonging to this tenant
    const users = await User.find({
      $or: [
        { agencyId: tenantId },
        { brandId: tenantId },
        { adminId: tenantId },
        { workspaceId: tenantId },
        { createdBy: tenantId }
      ],
      isActive: true,
      role: "user",
    })
      .select("_id name email role")
      .lean();

    const notifiedUsers = [];
    const skippedUsers = [];

    // Check each user
    for (const user of users) {
      // Check if user has a note for yesterday
      const hasYesterdayNote = await Notepad.findOne({
        userId: user._id,
        noteDate: {
          $gte: yesterday,
          $lt: yesterdayEnd,
        },
      });

      if (!hasYesterdayNote) {
        // User hasn't submitted yesterday's report - send notification
        try {
          const notification = await Notification.create({
            userId: user._id,
            type: "daily_note_reminder",
            title: "Daily Report Reminder - Yesterday",
            message: `You haven't submitted your daily report for ${yesterday.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}. Please submit it as soon as possible.`,
            isRead: false,
          });

          // Emit notification via Socket.IO
          try {
            const socketIO = require("../../utils/socket");
            socketIO.emitNotification(user._id.toString(), notification);
          } catch (socketError) {
            logger.error(
              "Error emitting notification via Socket.IO:",
              socketError,
            );
            // Don't fail if Socket.IO emission fails
          }

          notifiedUsers.push({
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
          });

          logger.info(
            `Notification sent to user ${user.email} for missing yesterday's daily report`,
          );
        } catch (error) {
          logger.error(
            `Failed to send notification to user ${user._id}:`,
            error,
          );
          skippedUsers.push({
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            error: error.message,
          });
        }
      } else {
        // User has submitted yesterday's report - skip
        skippedUsers.push({
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          reason: "Report already submitted",
        });
      }
    }

    logger.info(
      `Daily report notification check completed. Notified: ${notifiedUsers.length}, Skipped: ${skippedUsers.length}`,
    );

    return {
      success: true,
      notifiedCount: notifiedUsers.length,
      skippedCount: skippedUsers.length,
      notifiedUsers,
      skippedUsers,
      checkDate: yesterday,
    };
  } catch (error) {
    logger.error("Error checking missing yesterday reports:", error);
    throw error;
  }
};

module.exports = {
  getTodayNote,
  createOrUpdateTodayNote,
  getNotesHistory,
  checkAndNotifyMissingNotes,
  getAllUsersLatestReports,
  getAllUsersReportHistory,
  notifyMissingYesterdayReports,
};
