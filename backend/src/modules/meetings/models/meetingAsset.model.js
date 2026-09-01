const mongoose = require('mongoose');

const options = { discriminatorKey: 'assetType', collection: 'meeting_assets', timestamps: true };

const MeetingAssetSchema = new mongoose.Schema({}, options);

// Common indexes for performance
MeetingAssetSchema.index({ companyId: 1 }, { sparse: true });
MeetingAssetSchema.index({ meetingId: 1 }, { sparse: true });

const MeetingAsset = mongoose.model('MeetingAsset', MeetingAssetSchema);

// 1. Base Meeting Model
const Meeting = MeetingAsset.discriminator('Meeting', new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  agenda: {
    type: String,
    trim: true,
  },
  meetingType: {
    type: String,
    enum: [
      'client_review',
      'internal_meeting',
      'prospect_meeting',
      'campaign_planning',
      'seo_review',
      'content_review',
      'sales_call',
      'retainer_renewal',
      'business_review',
      'team_review',
      'other'
    ],
    default: 'internal_meeting',
  },
  status: {
    type: String,
    enum: [
      'upcoming',
      'awaiting_confirmation',
      'completed',
      'cancelled',
      'rescheduled',
      'missed'
    ],
    default: 'upcoming',
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }
  ],
  date: {
    type: Date,
    required: true,
  },
  time: {
    type: String, 
    required: true,
  },
  duration: {
    type: Number, 
    default: 30,
  },
  meetingLink: {
    type: String,
    trim: true,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null,
  },
  history: [
    {
      action: String,
      performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      timestamp: { type: Date, default: Date.now },
      details: String,
    }
  ],
  googleEventId: {
    type: String,
    default: null,
  },
  outlookEventId: {
    type: String,
    default: null,
  },
  notes: [{
    content: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  followUps: [{
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    description: { type: String, required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  }],
  attachments: [{
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    fileType: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  }]
}), 'meeting');

MeetingAssetSchema.index({ host: 1, status: 1 }, { sparse: true });
MeetingAssetSchema.index({ date: 1 }, { sparse: true });

// 2. Meeting Attachment
const MeetingAttachment = MeetingAsset.discriminator('MeetingAttachment', new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeetingAsset',
    required: true,
    index: true,
  },
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
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
}), 'attachment');

// 3. Meeting Follow Up
const MeetingFollowUp = MeetingAsset.discriminator('MeetingFollowUp', new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeetingAsset',
    required: true,
    index: true,
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null,
    index: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending',
  }
}), 'followup');

// 4. Meeting Note
const MeetingNote = MeetingAsset.discriminator('MeetingNote', new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeetingAsset',
    required: true,
    index: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
}), 'note');

module.exports = {
  MeetingAsset,
  Meeting,
  MeetingAttachment,
  MeetingFollowUp,
  MeetingNote
};
