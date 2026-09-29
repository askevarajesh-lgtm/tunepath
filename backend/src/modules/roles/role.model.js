const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  roleName: { type: String, required: true },
  roleKey: { type: String },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  subAgencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubAgency', default: null },
  permissions: { type: Object, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Role', RoleSchema);
