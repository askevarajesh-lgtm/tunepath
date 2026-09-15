const mongoose = require('mongoose');

const ChatWidgetSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  brandId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  name: { type: String, required: true, trim: true },

  type: { type: String, required: true }, // e.g. All-in-one chat, Live chat, Bot etc
  status: { type: String, enum: ['Draft', 'Published'], default: 'Draft', required: true },
  greeting: { type: String, default: "Hi! How can we help you today?" },
  brandColor: { type: String, default: "var(--accent-primary)" },
  launcherPosition: { type: String, enum: ['Bottom right', 'Bottom left'], default: 'Bottom right' },
  launcherLabel: { type: String, default: "Chat" },
  channels: [{ type: String }], // WhatsApp, Live chat, Email, SMS, Facebook, Instagram, Voice AI
  whatsappPhone: { type: String, default: "" },
  supportEmail: { type: String, default: "" },
  smsPhone: { type: String, default: "" },
  facebookUrl: { type: String, default: "" },
  instagramUrl: { type: String, default: "" },
  voiceAiAgent: { type: String, default: "" },
  isDeleted: { type: Boolean, default: false, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId },
  updatedBy: { type: mongoose.Schema.Types.ObjectId }
}, { timestamps: true });

ChatWidgetSchema.index({ workspaceId: 1, name: 1 });

module.exports = mongoose.model('ChatWidget', ChatWidgetSchema);
