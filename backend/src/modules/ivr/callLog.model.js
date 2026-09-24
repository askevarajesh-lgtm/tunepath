const mongoose = require('mongoose');

const calledAgentSchema = new mongoose.Schema(
  {
    agentName: { type: String, trim: true, default: '' },
    agentNumber: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const callLogSchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    agentPhone: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      index: true,
      default: null,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
      default: null,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClientCompany',
      index: true,
      default: null,
    },
    status: {
      type: String,
      trim: true,
      default: 'Initiated',
      index: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      default: 'outbound',
      index: true,
    },
    date: {
      type: String,
      trim: true,
      default: '',
    },
    time: {
      type: String,
      trim: true,
      default: '',
    },
    callRecording: {
      type: String,
      trim: true,
      default: '',
    },
    callRecordingUrl: {
      type: String,
      trim: true,
      default: '',
    },
    callDuration: {
      type: Number,
      default: 0,
    },
    totalCallDuration: {
      type: Number,
      default: 0,
    },
    did: {
      type: String,
      trim: true,
      default: '',
    },
    calledAgents: {
      type: [calledAgentSchema],
      default: [],
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

callLogSchema.index({ leadId: 1, createdAt: -1 });
callLogSchema.index({ companyId: 1, createdAt: -1 });
callLogSchema.index({ customerPhone: 1, createdAt: -1 });

module.exports = mongoose.model('CallLog', callLogSchema);
