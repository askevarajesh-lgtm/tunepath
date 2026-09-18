const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema({
  url: { type: String },
  name: { type: String },
  type: { type: String },
  size: { type: Number }
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String
  },
  attachment: AttachmentSchema,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const AiConversationSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'New Conversation'
  },
  messages: {
    type: [MessageSchema],
    default: []
  },
  provider: {
    type: String,
    enum: ['openai', 'anthropic'],
    default: 'openai',
    index: true
  },
  model: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('AiConversation', AiConversationSchema);
