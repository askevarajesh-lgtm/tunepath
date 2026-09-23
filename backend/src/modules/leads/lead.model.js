const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
    },
    remindAt: {
      type: Date,
      required: true,
    },
    remindTo: {
      type: String,
      required: false,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const activityLogSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const leadNoteSchema = new mongoose.Schema(
  {
    noteType: {
      type: String,
      enum: ["text", "audio", "image", "video", "document"],
      required: true,
      default: "text",
    },
    content: {
      type: String,
      trim: true,
      default: "",
    },
    fileUrl: {
      type: String,
      trim: true,
      default: "",
    },
    fileName: {
      type: String,
      trim: true,
      default: "",
    },
    mimeType: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

const leadSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      index: true,
      default: null,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientCompany",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    fullName: {
      type: String,
      trim: true,
      default: "",
    },
    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      default: "",
    },
    projectType: {
      type: String,
      trim: true,
      default: "",
    },
    source: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      default: "new",
    },
    assignedTo: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    customData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastInteractionAt: {
      type: Date,
      default: Date.now,
    },
    reminders: {
      type: [reminderSchema],
      default: [],
    },
    activityLogs: {
      type: [activityLogSchema],
      default: [],
    },
    leadNotes: {
      type: [leadNoteSchema],
      default: [],
    },
    // Legacy fields (older leads) — kept for backward compatibility
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    mobile: { type: String, trim: true },
    branch: { type: String, trim: true },
    isClientLead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

leadSchema.index({ companyId: 1, createdAt: -1 });
// Supports Google Analytics aggregations (per-client, date-ranged lead/channel queries)
leadSchema.index({ companyId: 1, clientId: 1, createdAt: -1 });
leadSchema.index({ companyId: 1, source: 1, createdAt: -1 });

module.exports = mongoose.model("Lead", leadSchema);