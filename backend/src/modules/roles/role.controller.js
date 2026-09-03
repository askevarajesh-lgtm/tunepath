const Role = require('./role.model');

exports.getRoles = async (req, res, next) => {
  try {
    let queryFilter = {};
    if (req.user.role === 'commander_admin') {
      queryFilter.adminId = req.user._id;
    } else if (['brand_super_admin', 'brand_manager'].includes(req.user.role)) {
      queryFilter.brandId = req.user.brandId || req.user._id;
    } else {
      queryFilter.agencyId = req.companyId || req.user.agencyId || req.user._id;
    }
    const roles = await Role.find(queryFilter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
};

exports.createRole = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.user.role === 'commander_admin') {
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
      roleName: { $regex: new RegExp(`^${roleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    };
    if (data.agencyId) existingQuery.agencyId = data.agencyId;
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
    const { roleName } = req.body;
    if (roleName) {
      const trimmedName = roleName.trim();
      const current = await Role.findById(req.params.id);
      if (current) {
        let existingQuery = {
          _id: { $ne: req.params.id },
          roleName: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        };
        if (current.agencyId) existingQuery.agencyId = current.agencyId;
        else if (current.brandId) existingQuery.brandId = current.brandId;
        else if (current.adminId) existingQuery.adminId = current.adminId;

        const existing = await Role.findOne(existingQuery);
        if (existing) {
          return res.status(400).json({ success: false, message: `A role with the name "${trimmedName}" already exists` });
        }
      }
    }
    const role = await Role.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    if (!role) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
};

exports.deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findByIdAndDelete(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
