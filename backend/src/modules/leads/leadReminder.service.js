const mongoose = require("mongoose");
const Lead = require("./lead.model");
const Notification = require("../tasks/notification.model");
const User = require("../auth/user.model");

/**
 * Resolve the recipient User document for a lead reminder.
 * Searches in order:
 * 1. reminder.remindTo (if specified and not 'Self')
 * 2. lead.assignedTo (if assigned)
 * 3. lead.ownerId
 * 4. lead.createdBy
 * 5. defaultUserId / currentUser._id
 */
const findRecipientUserForLeadReminder = async (lead, reminder, defaultUserId = null) => {
  try {
    const targets = [
      reminder?.remindTo,
      lead?.assignedTo,
      lead?.ownerId,
      lead?.createdBy,
      defaultUserId,
    ].filter(Boolean);

    for (const target of targets) {
      // Check if target is an ObjectId or valid 24-character hex
      if (mongoose.Types.ObjectId.isValid(target) && String(target).length === 24) {
        const user = await User.findById(target);
        if (user && user.isActive !== false) {
          return user;
        }
      }

      // If target is a string (e.g. user's name, username, email)
      if (typeof target === "string" && target.trim()) {
        const cleanTarget = target.trim();
        if (cleanTarget.toLowerCase() === "self") {
          continue; // Will fallback to lead owner/creator or default user
        }

        // Search by name, username, or email
        const user = await User.findOne({
          $or: [
            { name: { $regex: new RegExp(`^${cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } },
            { username: { $regex: new RegExp(`^${cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } },
            { email: { $regex: new RegExp(`^${cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } },
          ],
          isActive: { $ne: false },
        });

        if (user) {
          return user;
        }
      }
    }

    // Fallback: Check ownerId or createdBy
    const fallbackId = lead?.ownerId || lead?.createdBy || defaultUserId;
    if (fallbackId && mongoose.Types.ObjectId.isValid(fallbackId)) {
      const fallbackUser = await User.findById(fallbackId);
      if (fallbackUser && fallbackUser.isActive !== false) {
        return fallbackUser;
      }
    }

    return null;
  } catch (err) {
    console.error("[LeadReminderService] Error resolving recipient user:", err);
    return null;
  }
};

/**
 * Trigger the in-app notification & socket emission for a lead reminder,
 * and mark the reminder as notified.
 */
const triggerLeadReminderNotification = async (lead, reminder, explicitRecipient = null) => {
  try {
    const recipientUser = explicitRecipient || (await findRecipientUserForLeadReminder(lead, reminder));

    if (!recipientUser) {
      console.warn(`[LeadReminderService] No active recipient user found for lead reminder: ${reminder._id} (Lead: ${lead._id})`);
      reminder.notificationSent = true;
      await lead.save();
      return null;
    }

    const leadName = lead.fullName || lead.companyName || "Lead";
    const notificationTitle = `Lead Reminder: ${leadName}`;
    const notificationMessage = reminder.description || `Follow-up reminder for lead ${leadName}`;

    // 1. Create in-app Notification record
    const notification = await Notification.create({
      userId: recipientUser._id,
      leadId: lead._id,
      type: "lead_reminder",
      title: notificationTitle,
      message: notificationMessage,
      metadata: {
        leadId: lead._id.toString(),
        reminderId: reminder._id.toString(),
        leadName: leadName,
        remindAt: reminder.remindAt,
        remindTo: reminder.remindTo || recipientUser.name,
        assignedTo: lead.assignedTo,
      },
      channels: {
        inApp: true,
        email: false,
        sms: false,
      },
    });

    // 2. Emit real-time notification via Socket.IO if available
    try {
      const socketIO = require("../tasks/shimSocket");
      if (socketIO && typeof socketIO.emitNotification === "function") {
        socketIO.emitNotification(recipientUser._id.toString(), notification);
      }
    } catch (sockErr) {
      // Non-blocking socket emission error
    }

    // 3. Mark reminder as sent and completed
    reminder.notificationSent = true;
    reminder.status = "completed";

    // 4. Record in activity log
    if (!lead.activityLogs) {
      lead.activityLogs = [];
    }
    lead.activityLogs.push({
      message: `Reminder notification sent to ${recipientUser.name || recipientUser.username || "user"} for "${reminder.description}"`,
      createdAt: new Date(),
    });

    await lead.save();
    console.log(`[LeadReminderService] Notification successfully sent to ${recipientUser.email || recipientUser.name} for lead ${lead._id}`);

    return notification;
  } catch (err) {
    console.error(`[LeadReminderService] Error triggering reminder notification:`, err);
    return null;
  }
};

module.exports = {
  findRecipientUserForLeadReminder,
  triggerLeadReminderNotification,
};
