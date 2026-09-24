const mongoose = require('mongoose');

const sentReportSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportSchedule' }, // Optional, null if sent manually
  name: { type: String, required: true },
  template: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
  deliveredTo: [{ type: String }], // Array of emails or numbers
  deliveryMethod: { type: String, enum: ['Email', 'WhatsApp', 'Both'] },
  status: { type: String, enum: ['Pending', 'Sent', 'Delivered', 'Opened', 'Failed', 'Published'], default: 'Sent' },
  pages: { type: Number, default: 1 },
  downloadUrl: { type: String }, // Dummy or real URL to the PDF
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // System generated if null
  month: { type: Number },
  year: { type: Number },
  fromDate: { type: Date },
  toDate: { type: Date },
  projectId: { type: mongoose.Schema.Types.ObjectId }
}, {
  timestamps: true
});

module.exports = mongoose.model('SentReport', sentReportSchema);
