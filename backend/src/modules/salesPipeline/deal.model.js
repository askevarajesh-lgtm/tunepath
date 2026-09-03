const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const activitySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
    },
    performedBy: {
      type: String,
      required: true,
    },
    details: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const dealSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientCompany",
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
    },
    stage: {
      type: String,
      required: true,
      enum: ["lead", "qualified", "proposal", "negotiation", "won", "lost"],
      default: "lead",
      index: true,
    },
    rep: {
      type: String,
      required: false,
      default: "Unassigned",
      trim: true,
    },
    ownerInit: {
      type: String,
      required: false,
      default: "UN",
      trim: true,
    },
    date: {
      type: String,
      default: () => `Added ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
    },
    follow: {
      type: String,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    probability: {
      type: Number,
      min: 0,
      max: 100,
      default: 20,
    },
    lostReason: {
      type: String,
      trim: true,
    },
    daysInStage: {
      type: Number,
      default: 0,
    },
    notes: {
      type: [noteSchema],
      default: [],
    },
    activityLogs: {
      type: [activitySchema],
      default: [],
    },
  },
  { timestamps: true }
);

dealSchema.index({ companyId: 1, stage: 1 });

module.exports = mongoose.model("Deal", dealSchema);
