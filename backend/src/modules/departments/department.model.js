const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  subAgencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubAgency', default: null, index: true }
}, { timestamps: true });

module.exports = mongoose.model('Department', DepartmentSchema);
