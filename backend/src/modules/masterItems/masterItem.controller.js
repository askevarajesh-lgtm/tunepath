const MasterItem = require('./masterItem.model');

// Create Master Item
exports.createMasterItem = async (req, res, next) => {
  try {
    const data = { ...req.body };
    data.createdBy = req.user._id;

    // Tenant logic similar to department
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

    // Duplicate name check within the tenant
    const queryFilter = { name: data.name, isDeleted: false };
    if (data.brandId) queryFilter.brandId = data.brandId;
    else if (data.agencyId) queryFilter.agencyId = data.agencyId;
    else if (data.adminId) queryFilter.adminId = data.adminId;

    const existingItem = await MasterItem.findOne(queryFilter);
    if (existingItem) {
      return res.status(400).json({ success: false, message: 'Master Item with this name already exists' });
    }

    const masterItem = await MasterItem.create(data);
    res.status(201).json({ success: true, data: masterItem });
  } catch (error) {
    next(error);
  }
};

// Get All Master Items
exports.getMasterItems = async (req, res, next) => {
  try {
    let queryFilter = { isDeleted: false, isCustom: { $ne: true } };
    
    // Pagination & Search
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    if (req.query.search) {
      queryFilter.name = { $regex: req.query.search, $options: 'i' };
    }
    if (req.query.status) {
      queryFilter.status = req.query.status;
    }

    // Tenant filtering
    if (req.user.role === 'commander_admin') {
      queryFilter.adminId = req.user._id;
    } else if (['brand_super_admin', 'brand_manager'].includes(req.user.role)) {
      queryFilter.brandId = req.user.brandId || req.user._id;
    } else {
      queryFilter.agencyId = req.companyId || req.user.agencyId || req.user._id;
    }

    const total = await MasterItem.countDocuments(queryFilter);
    const masterItems = await MasterItem.find(queryFilter)
      .populate('createdBy', 'name email roleName')
      .populate('departmentId', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({ 
      success: true, 
      count: masterItems.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: masterItems 
    });
  } catch (error) {
    next(error);
  }
};

// Get Single Master Item
exports.getMasterItem = async (req, res, next) => {
  try {
    const masterItem = await MasterItem.findOne({ _id: req.params.id, isDeleted: false })
      .populate('departmentId', 'name slug');
    if (!masterItem) {
      return res.status(404).json({ success: false, message: 'Master Item not found' });
    }
    res.status(200).json({ success: true, data: masterItem });
  } catch (error) {
    next(error);
  }
};

// Update Master Item
exports.updateMasterItem = async (req, res, next) => {
  try {
    const masterItem = await MasterItem.findOne({ _id: req.params.id, isDeleted: false });
    if (!masterItem) {
      return res.status(404).json({ success: false, message: 'Master Item not found' });
    }

    req.body.updatedBy = req.user._id;
    
    // Duplicate name check if name is changed
    if (req.body.name && req.body.name !== masterItem.name) {
      const queryFilter = { name: req.body.name, isDeleted: false };
      if (masterItem.brandId) queryFilter.brandId = masterItem.brandId;
      else if (masterItem.agencyId) queryFilter.agencyId = masterItem.agencyId;
      else if (masterItem.adminId) queryFilter.adminId = masterItem.adminId;

      const existingItem = await MasterItem.findOne(queryFilter);
      if (existingItem) {
        return res.status(400).json({ success: false, message: 'Master Item with this name already exists' });
      }
    }

    const updatedItem = await MasterItem.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    res.status(200).json({ success: true, data: updatedItem });
  } catch (error) {
    next(error);
  }
};

// Soft Delete Master Item
exports.deleteMasterItem = async (req, res, next) => {
  try {
    const masterItem = await MasterItem.findOne({ _id: req.params.id, isDeleted: false });
    if (!masterItem) {
      return res.status(404).json({ success: false, message: 'Master Item not found' });
    }

    masterItem.isDeleted = true;
    masterItem.updatedBy = req.user._id;
    await masterItem.save();

    res.status(200).json({ success: true, message: 'Master Item deleted successfully' });
  } catch (error) {
    next(error);
  }
};
