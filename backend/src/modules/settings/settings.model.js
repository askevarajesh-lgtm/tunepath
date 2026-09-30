const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  tenantCompanyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  dmTeam: {
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    departmentName: { type: String, default: 'Digital Marketing' },
    designerDailyLimit: { type: Number, default: 7 },
    videoEditorDailyLimit: { type: Number, default: 3 },
    roleLimits: { type: Map, of: Number, default: {} }
  }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
