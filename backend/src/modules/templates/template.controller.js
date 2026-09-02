const Template = require('./template.model');

exports.getTemplates = async (req, res, next) => {
  try {
    const { type } = req.query; // 'website', 'form'
    
    let query = { isDeleted: false };
    if (type) {
      query.type = type;
    }

    if (req.user) {
      if (req.user.role !== 'commander_admin') {
        query.$or = [
          { isGlobal: true },
          { agencyId: req.user.agencyId },
          { brandId: req.user.brandId }
        ];
      }
    }

    const templates = await Template.find(query).sort({ createdAt: -1 }).lean();

    const mappedTemplates = templates.map(t => {
      let canDelete = false;
      if (req.user) {
        if (req.user.role === 'commander_admin') {
          canDelete = true;
        } else {
          const isClientSideUpload = !!t.brandId;
          const isAgencySideUpload = !!t.agencyId && !t.brandId;
          const currentIsClientSide = req.isClientRole;
          
          if (isClientSideUpload && currentIsClientSide && t.brandId.toString() === (req.user.brandId?.toString() || req.user._id?.toString())) {
            canDelete = true;
          } else if (isAgencySideUpload && !currentIsClientSide && t.agencyId?.toString() === (req.user.agencyId?.toString() || req.user._id?.toString())) {
            canDelete = true;
          }
        }
      }
      return { ...t, canDelete };
    });

    // Group by category to help frontend UI easily
    const categories = {};
    mappedTemplates.forEach(t => {
      const cat = t.category || 'Uncategorized';
      if (!categories[cat]) {
        categories[cat] = [];
      }
      categories[cat].push(t);
    });

    const categoryList = Object.keys(categories).map(cat => ({
      name: cat,
      count: categories[cat].length
    })).sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: {
        templates: mappedTemplates,
        categories: categoryList
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.uploadTemplate = async (req, res, next) => {
  try {
    const { name, type, category, description, featuresCount } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'Name and type are required' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No ZIP file uploaded' });
    }

    const template = new Template({
      name,
      type,
      category: category || 'Custom Uploads',
      description: description || '',
      featuresCount: featuresCount ? parseInt(featuresCount) : 1,
      zipUrl: req.file.path && req.file.path.startsWith('http') ? req.file.path : `uploads/templates/${req.file.filename}`, // Local or Cloudinary URL
      zipPublicId: req.file.path && req.file.path.startsWith('http') ? (req.file.filename || '') : '', // Cloudinary public_id (raw resource), used to rebuild a reliable download URL later
      isRealData: true,
      createdBy: req.user ? req.user.userId : null,
      agencyId: req.user ? req.user.agencyId : null,
      brandId: req.user ? req.user.brandId : null,
      isGlobal: req.user && req.user.role === 'commander_admin'
    });

    const savedTemplate = await template.save();

    res.status(201).json({
      success: true,
      data: savedTemplate,
      message: 'Template uploaded successfully'
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    if (req.user.role !== 'commander_admin') {
      const isClientSideUpload = !!template.brandId;
      const isAgencySideUpload = !!template.agencyId && !template.brandId;
      
      const currentIsClientSide = req.isClientRole;
      
      if (isClientSideUpload) {
        if (!currentIsClientSide) {
           return res.status(403).json({ success: false, error: 'This template was uploaded by a client and can only be deleted from the client portal' });
        }
        if (template.brandId.toString() !== (req.user.brandId?.toString() || req.user._id?.toString())) {
           return res.status(403).json({ success: false, error: 'You do not have permission to delete this template' });
        }
      } else if (isAgencySideUpload) {
        if (currentIsClientSide) {
           return res.status(403).json({ success: false, error: 'This template was uploaded by the agency and can only be deleted from the agency portal' });
        }
        if (template.agencyId.toString() !== (req.user.agencyId?.toString() || req.user._id?.toString())) {
           return res.status(403).json({ success: false, error: 'You do not have permission to delete this template' });
        }
      } else {
         return res.status(403).json({ success: false, error: 'You do not have permission to delete this template' });
      }
    }

    template.isDeleted = true;
    await template.save();

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};