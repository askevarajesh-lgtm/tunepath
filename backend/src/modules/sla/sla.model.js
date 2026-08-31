const mongoose = require('mongoose');

const slaNoteSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

const slaActivitySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

const slaRecordSchema = new mongoose.Schema({
  slaId: {
    type: String,
    required: true,
    unique: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  agencyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  clientType: {
    type: String,
    enum: ['Direct User Client', 'Agency Client', 'Agency', 'Brand'],
    default: 'Direct User Client'
  },
  triggerType: {
    type: String,
    enum: ['Due Date', 'Payment', 'Client Issue', 'Agency Client Issue', 'Completion', 'Due Date & Completion'],
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    // Reference to Task, Invoice, Project, etc.
    default: null
  },
  entityType: {
    type: String,
    enum: ['Task', 'Project', 'Invoice', 'Complaint', 'SupportTicket', 'MasterItem'],
    default: 'Task'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  dueDate: {
    type: Date,
    required: true
  },
  paymentStatus: {
    type: String,
    default: null
  },
  issueStatus: {
    type: String,
    default: null
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Normal', 'At Risk', 'Breached', 'Resolved'],
    default: 'Normal'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  notes: [slaNoteSchema],
  activityTimeline: [slaActivitySchema],
  resolvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for fast querying on Dashboard/Table
slaRecordSchema.index({ status: 1 });
slaRecordSchema.index({ triggerType: 1 });
slaRecordSchema.index({ clientId: 1 });
slaRecordSchema.index({ agencyId: 1 });
slaRecordSchema.index({ entityId: 1, entityType: 1 });

module.exports = mongoose.model('SlaRecord', slaRecordSchema);
