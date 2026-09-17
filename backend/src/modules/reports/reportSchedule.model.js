const mongoose = require('mongoose');

const reportScheduleSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  template: { type: String, required: true, enum: ['Highlights of the Month', 'Keyword Ranking Overview', 'Keyword Ranking Details', 'Meta Insights – Facebook', 'Meta Insights – Instagram', 'Meta Campaign Insights – Lead Campaign', 'Meta Campaign Insights – Reach Campaign', 'Website Traffic – Overview', 'Website Traffic – Landing Page Views', 'Website Traffic – Users by City', 'Monthly Performance Report', 'SEO Ranking Report', 'Paid Media Report', 'Executive Summary'] },
  frequency: { type: String, required: true, enum: ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Quarterly'] },
  nextSend: { type: Date, required: true },
  format: { type: String, required: true, default: 'PDF' },
  deliveryMethod: { type: String, enum: ['Email', 'WhatsApp', 'Both'], default: 'Email' },
  recipients: [{ type: String }],
  whatsappRecipients: [{ type: String }],
  notes: { type: String },
  status: { type: String, enum: ['Active', 'Paused'], default: 'Active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.model('ReportSchedule', reportScheduleSchema);
