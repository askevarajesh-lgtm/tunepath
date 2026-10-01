const Notification = require("./notification.model");

/**
 * Get notifications for a user
 */
const getUserNotifications = async (userId, options = {}) => {
  const { limit = 50, skip = 0, unreadOnly = false } = options;

  const query = { userId };
  if (unreadOnly) {
    query.isRead = false;
  }

  const notifications = await Notification.find(query)
    .populate("taskId", "title status")
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);

  // Replace any raw ObjectId in messages with the actual user name
  const objectIdRegex = /\b([a-f0-9]{24})\b/gi;
  const idSet = new Set();
  for (const notif of notifications) {
    const matches = notif.message ? notif.message.match(objectIdRegex) : null;
    if (matches) {
      matches.forEach((id) => idSet.add(id));
    }
  }

  // Resolve all found IDs to user names in one batch query
  const idNameMap = {};
  if (idSet.size > 0) {
    const mongoose = require('mongoose');
    const validIds = [...idSet].filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length > 0) {
      const User = require('../auth/user.model');
      const users = await User.find({ _id: { $in: validIds } }).select('name');
      for (const u of users) {
        idNameMap[u._id.toString()] = u.name;
      }
    }
  }

  // Replace IDs in messages with resolved names
  const resolvedNotifications = notifications.map((notif) => {
    const obj = notif.toObject();
    if (obj.message && Object.keys(idNameMap).length > 0) {
      obj.message = obj.message.replace(objectIdRegex, (match) => {
        return idNameMap[match.toLowerCase()] || match;
      });
    }
    return obj;
  });

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({
    userId,
    isRead: false,
  });

  return {
    notifications: resolvedNotifications,
    total,
    unreadCount,
  };
};

/**
 * Mark notification as read
 */
const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    userId,
  });

  if (!notification) {
    throw new Error("Notification not found");
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  return notification;
};

/**
 * Mark all notifications as read for a user
 */
const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() },
  );

  return result;
};

/**
 * Delete notification
 */
const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    userId,
  });

  if (!notification) {
    throw new Error("Notification not found");
  }

  return notification;
};

/**
 * Delete multiple notifications
 */
const deleteNotifications = async (notificationIds, userId) => {
  const result = await Notification.deleteMany({
    _id: { $in: notificationIds },
    userId,
  });

  return result;
};

const CompanyNotificationSettings = require("./companyNotificationSettings.model");
const User = require("../auth/user.model");
const Integration = require("../integrations/integration.model");
const twilioService = require("../../utils/twilio.service");
const { isIntegrationGloballyEnabled } = require('../../utils/integrationAccess');

/**
 * Dispatch system notification
 */
const dispatchSystemNotification = async (companyId, triggerKey, type, title, message, metadata = {}) => {
  try {
    // Check if the trigger is enabled in company settings
    const settings = await CompanyNotificationSettings.findOne({ companyId });
    if (!settings || !settings.systemTriggers || !settings.systemTriggers[triggerKey]) {
      return; // Not configured or disabled
    }

    const triggerSettings = settings.systemTriggers[triggerKey];
    if (!triggerSettings.inApp && !triggerSettings.email && !triggerSettings.sms) {
      return; // No channels enabled
    }

    // Find admins to notify
    const admins = await User.find({
      $or: [
        { agencyId: companyId },
        { brandId: companyId }
      ],
      role: { $in: ["agency_super_admin", "commander_admin", "brand_super_admin"] },
      isActive: true
    });

    if (!admins.length) return;

    // Create in-app notifications
    if (triggerSettings.inApp) {
      const notifications = admins.map(admin => ({
        userId: admin._id,
        type,
        title,
        message,
        metadata,
        channels: { inApp: true, email: triggerSettings.email, whatsapp: triggerSettings.whatsapp, sms: triggerSettings.sms }
      }));
      
      await Notification.insertMany(notifications);
    }

    // Send SMS via Twilio
    if (triggerSettings.sms) {
      const isSmsGloballyEnabled = await isIntegrationGloballyEnabled('sms');
      const smsIntegration = isSmsGloballyEnabled ? await Integration.findOne({
        companyId,
        type: "sms",
        isActive: true,
      }) : null;

      if (smsIntegration && smsIntegration.config && smsIntegration.config.accountSid) {
        const { accountSid, authToken, phoneNumber: fromNumber } = smsIntegration.config;
        
        // Use a background loop to send SMS to each admin that has a phone number
        for (const admin of admins) {
          const adminPhone = admin.phone || admin.phoneNumber || admin.contactNumber;
          if (adminPhone) {
            twilioService.sendSms(accountSid, authToken, fromNumber, adminPhone, `${title}: ${message}`)
              .catch(err => console.error("Failed to send system SMS notification:", err));
          }
        }
      }
    }
  } catch (err) {
    console.error("Error dispatching system notification:", err);
  }
};

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteNotifications,
  dispatchSystemNotification,
};
