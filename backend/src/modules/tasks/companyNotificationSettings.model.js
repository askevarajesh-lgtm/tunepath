const mongoose = require("mongoose");

/**
 * Company-level Task Notification Settings
 * These settings apply to all users in the company
 * Individual user settings can override these if needed
 */
const companyNotificationSettingsSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
      index: true,
    },
    // Task-related notifications (company-wide defaults)
    taskAssigned: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    taskStatusChanged: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    taskPriorityChanged: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    taskDueDateReminder: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      daysBefore: { type: Number, default: 1 }, // Remind 1 day before
    },
    taskCommentAdded: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    taskMentioned: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    taskAttachmentAdded: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    taskCompleted: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    // System-wide Triggers
    systemTriggers: {
      userCreated: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      },
      agencyCreated: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      },
      brandCreated: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      },
      reportDownloaded: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      },
      taskCreated: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      },
      taskCompleted: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      },
      formSubmission: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false },
        sms: { type: Boolean, default: false },
      }
    }
  },
  {
    timestamps: true,
  },
);

// Indexes


module.exports = mongoose.model(
  "CompanyNotificationSettings",
  companyNotificationSettingsSchema,
);
