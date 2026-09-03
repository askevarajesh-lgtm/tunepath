const Department = require('./department.model');

exports.getDepartments = async (req, res, next) => {
  try {
    let queryFilter = {};
    if (req.user.role === 'commander_admin') {
      queryFilter.adminId = req.user._id;
    } else if (['brand_super_admin', 'brand_manager'].includes(req.user.role)) {
      queryFilter.brandId = req.user.brandId || req.user._id;
    } else {
      if (req.user.adminId && !req.user.agencyId) {
        queryFilter.adminId = req.user.adminId;
      } else {
        queryFilter.agencyId = req.companyId || req.user.agencyId || req.user._id;
      }
    }
    const departments = await Department.find(queryFilter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: departments });
  } catch (error) {
    next(error);
  }
};

exports.getDepartmentsDynamic = async (req, res, next) => {
  try {
    let queryFilter = {};
    if (req.user.role === 'commander_admin') {
      queryFilter.adminId = req.user._id;
    } else if (['brand_super_admin', 'brand_manager'].includes(req.user.role)) {
      queryFilter.brandId = req.user.brandId || req.user._id;
    } else {
      if (req.user.adminId && !req.user.agencyId) {
        queryFilter.adminId = req.user.adminId;
      } else {
        queryFilter.agencyId = req.companyId || req.user.agencyId || req.user._id;
      }
    }
    const departments = await Department.find(queryFilter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { departments } });
  } catch (error) {
    next(error);
  }
};

exports.createDepartment = async (req, res, next) => {
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

    const name = data.name ? data.name.trim() : '';
    if (!name) {
      return res.status(400).json({ success: false, message: 'Department name is required' });
    }

    let existingQuery = {
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    };
    if (data.agencyId) existingQuery.agencyId = data.agencyId;
    else if (data.brandId) existingQuery.brandId = data.brandId;
    else if (data.adminId) existingQuery.adminId = data.adminId;

    const existing = await Department.findOne(existingQuery);
    if (existing) {
      return res.status(400).json({ success: false, message: `A department with the name "${name}" already exists` });
    }

    const department = await Department.create(data);
    res.status(201).json({ success: true, data: department });
  } catch (error) {
    next(error);
  }
};

exports.updateDepartment = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (name) {
      const trimmedName = name.trim();
      const current = await Department.findById(req.params.id);
      if (current) {
        let existingQuery = {
          _id: { $ne: req.params.id },
          name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        };
        if (current.agencyId) existingQuery.agencyId = current.agencyId;
        else if (current.brandId) existingQuery.brandId = current.brandId;
        else if (current.adminId) existingQuery.adminId = current.adminId;

        const existing = await Department.findOne(existingQuery);
        if (existing) {
          return res.status(400).json({ success: false, message: `A department with the name "${trimmedName}" already exists` });
        }
      }
    }
    const department = await Department.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    if (!department) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, data: department });
  } catch (error) {
    next(error);
  }
};

exports.deleteDepartment = async (req, res, next) => {
  try {
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
