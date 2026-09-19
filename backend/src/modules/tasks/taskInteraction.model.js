const mongoose = require("mongoose");

const options = { discriminatorKey: 'interactionType', collection: 'taskinteractions', timestamps: true };

const TaskInteractionSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  options
);

TaskInteractionSchema.index({ taskId: 1, createdAt: -1 });
TaskInteractionSchema.index({ userId: 1, createdAt: -1 });

const TaskInteraction = mongoose.model("TaskInteraction", TaskInteractionSchema);

// Task Activity Discriminator
const TaskActivity = TaskInteraction.discriminator(
  "TaskActivity",
  new mongoose.Schema({
    action: {
      type: String,
      required: true,
      enum: [
        "created",
        "updated",
        "status_changed",
        "priority_changed",
        "assigned",
        "reassigned",
        "comment_added",
        "attachment_added",
        "due_date_changed",
        "label_added",
        "label_removed",
        "watcher_added",
        "watcher_removed",
        "reminder_sent",
        "reopened",
      ],
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    description: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  }),
  'activity'
);

// We need an index on action and createdAt
TaskInteractionSchema.index({ action: 1, createdAt: -1 });

// Task Comment Discriminator
const TaskComment = TaskInteraction.discriminator(
  "TaskComment",
  new mongoose.Schema({
    content: {
      type: String,
      required: true,
      trim: true,
    },
    isRichText: {
      type: Boolean,
      default: false,
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    attachments: [
      {
        url: {
          type: String,
          required: true,
        },
        fileName: {
          type: String,
          required: true,
        },
        fileType: {
          type: String,
        },
      },
    ],
  }),
  'comment'
);

module.exports = {
  TaskInteraction,
  TaskActivity,
  TaskComment
};
