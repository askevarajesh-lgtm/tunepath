const mongoose = require("mongoose");

const campaignScheduledPostSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    clientCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientCompany",
      default: null,
      index: true,
    },
    id: { type: String, required: true, index: true },
    caption: { type: String, required: true },
    campaign: { type: String, default: "General" },
    media_url: {
      type: String,
      default: "https://picsum.photos/seed/new/400/400",
    },
    status: {
      type: String,
      enum: ["Scheduled", "Published", "Draft", "Failed", "Publishing"],
      default: "Scheduled",
      index: true,
    },
    type: { type: String, default: "Post Composer" },
    scheduled_date: { type: String, required: true },
    scheduled_time: { type: String, required: true },
    scheduled_iso: { type: String, required: true, index: true },
    postMode: {
      type: String,
      enum: ["immediate", "scheduled", "draft"],
      default: "scheduled",
    },
    post_option: { type: mongoose.Schema.Types.Mixed, default: {} }, // platform-specific options: { youtube: 'video_short', ... }
    boards: { type: mongoose.Schema.Types.Mixed, default: {} }, // Pinterest board IDs keyed by account ID
    platforms: { type: [String], default: [] },
    platform_media_urls: { type: mongoose.Schema.Types.Mixed, default: {} },
    platform_publications: { type: mongoose.Schema.Types.Mixed, default: {} },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    published_at: { type: String, default: null },
    error_message: { type: String, default: null },
    created_at: { type: String, required: true },
  },
  { timestamps: true },
);

campaignScheduledPostSchema.index(
  { companyId: 1, clientCompanyId: 1, id: 1 },
  { unique: true },
);
campaignScheduledPostSchema.index({
  companyId: 1,
  clientCompanyId: 1,
  scheduled_iso: 1,
  status: 1,
});

module.exports = mongoose.model(
  "CampaignScheduledPost",
  campaignScheduledPostSchema,
);
