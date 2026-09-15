const mongoose = require('mongoose');

const FormSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  brandId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  name: { type: String, required: true, trim: true },

  status: { type: String, enum: ['Draft', 'Published'], default: 'Published', required: true },
  fields: [{
    label: { type: String, required: true },
    type: { type: String, required: true }, // e.g., text, textarea, select, hidden, date, upload
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: "" },
    options: [{ type: String }],
    order: { type: Number, required: true }
  }],
  settings: {
    headline: { type: String, default: "" },
    subHeadline: { type: String, default: "" },
    accentColor: { type: String, default: "#3b82f6" },
    submitButtonLabel: { type: String, default: "Submit" },
    successMessage: { type: String, default: "Thank you — we received your submission." },
    trackingPixels: {
      metaPixelId: { type: String, default: "" },
      googleAnalyticsId: { type: String, default: "" },
      googleTagManagerId: { type: String, default: "" },
      tiktokPixelId: { type: String, default: "" },
      fireMetaLeadEvent: { type: Boolean, default: false }
    },
    customHeadCode: { type: String, default: "" },
    customBodyCode: { type: String, default: "" }
  },
  isDeleted: { type: Boolean, default: false, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId },
  updatedBy: { type: mongoose.Schema.Types.ObjectId }
}, { timestamps: true });

FormSchema.index({ workspaceId: 1, name: 1 });

module.exports = mongoose.model('Form', FormSchema);
