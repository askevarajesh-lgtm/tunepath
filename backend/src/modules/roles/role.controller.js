const Role = require('./role.model');

exports.getRoles = async (req, res, next) => {
  try {
    let queryFilter = {};
    if (['sub_agency_super_admin', 'sub_agency_user'].includes(req.user.role)) {
      if (!req.user.subAgencyId) return res.status(403).json({ success: false, message: 'Not a Sub Agency user' });
      queryFilter.subAgencyId = req.user.subAgencyId;
    } else if (req.user.role === 'commander_admin') {
      queryFilter.adminId = req.user._id;
      queryFilter.agencyId = null;
      queryFilter.brandId = null;
    } else if (['brand_super_admin', 'brand_manager'].includes(req.user.role) || (req.user.role === 'user' && req.user.brandId)) {
      queryFilter.brandId = req.user.brandId || req.user._id;
    } else {
      queryFilter.agencyId = req.companyId || req.user.agencyId || req.user._id;
      queryFilter.brandId = null;
    }
    const roles = await Role.find(queryFilter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
};

exports.createRole = async (req, res, next) => {
  try {
    if (req.user.role === 'sub_agency_user') {
      return res.status(403).json({ success: false, message: 'Forbidden: Sub Agency Users cannot create roles' });
    }
    const data = { ...req.body };
    if (req.user.role === 'sub_agency_super_admin') {
      if (!req.user.subAgencyId) return res.status(403).json({ success: false, message: 'Not a Sub Agency user' });
      data.subAgencyId = req.user.subAgencyId;
    } else if (req.user.role === 'commander_admin') {
      data.adminId = req.user._id;
    } else if (['brand_super_admin', 'brand_manager'].includes(req.user.role)) {
      data.brandId = req.user.brandId || req.user._id;
      data.agencyId = req.companyId || req.user.agencyId;
      if (req.user.adminId) data.adminId = req.user.adminId;
    } else {
      data.agencyId = req.companyId || req.user.agencyId || req.user._id;
      if (req.user.adminId) data.adminId = req.user.adminId;
    }

    const roleName = data.roleName ? data.roleName.trim() : '';
    if (!roleName) {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    let existingQuery = {
      roleName: { $regex: new RegExp(`^${roleName.replace(/[.*+?^$!()|[\]\\]/g, '\\$&')}$`, 'i') }
    };
    if (data.subAgencyId) existingQuery.subAgencyId = data.subAgencyId;
    else if (data.agencyId) existingQuery.agencyId = data.agencyId;
    else if (data.brandId) existingQuery.brandId = data.brandId;
    else if (data.adminId) existingQuery.adminId = data.adminId;

    const existing = await Role.findOne(existingQuery);
    if (existing) {
      return res.status(400).json({ success: false, message: `A role with the name "${roleName}" already exists` });
    }

    const role = await Role.create(data);
    res.status(201).json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
};

exports.updateRole = async (req, res, next) => {
  try {
    if (req.user.role === 'sub_agency_user') {
      return res.status(403).json({ success: false, message: 'Forbidden: Sub Agency Users cannot update roles' });
    }
    const { roleName } = req.body;
    const current = await Role.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: 'Not found' });
    
    if (req.user.role === 'sub_agency_super_admin') {
      if (!current.subAgencyId || current.subAgencyId.toString() !== req.user.subAgencyId.toString()) {
        return res.status(403).json({ success: false, message: 'Forbidden: Role does not belong to your Sub Agency' });
      }
    }

    if (roleName) {
      const trimmedName = roleName.trim();
      let existingQuery = {
        _id: { $ne: req.params.id },
        roleName: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^$!()|[\]\\]/g, '\\$&')}$`, 'i') }
      };
      if (current.subAgencyId) existingQuery.subAgencyId = current.subAgencyId;
      else if (current.agencyId) existingQuery.agencyId = current.agencyId;
      else if (current.brandId) existingQuery.brandId = current.brandId;
      else if (current.adminId) existingQuery.adminId = current.adminId;

      const existing = await Role.findOne(existingQuery);
      if (existing) {
        return res.status(400).json({ success: false, message: `A role with the name "${trimmedName}" already exists` });
      }
    }
    const role = await Role.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    res.status(200).json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
};

exports.deleteRole = async (req, res, next) => {
  try {
    if (req.user.role === 'sub_agency_user') {
      return res.status(403).json({ success: false, message: 'Forbidden: Sub Agency Users cannot delete roles' });
    }
    const current = await Role.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: 'Not found' });
    
    if (req.user.role === 'sub_agency_super_admin') {
      if (!current.subAgencyId || current.subAgencyId.toString() !== req.user.subAgencyId.toString()) {
        return res.status(403).json({ success: false, message: 'Forbidden: Role does not belong to your Sub Agency' });
      }
    }

    await Role.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
