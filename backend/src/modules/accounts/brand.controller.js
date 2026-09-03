const User = require('../auth/user.model');
const { validatePhoneNumber } = require('../../utils/phoneValidation');

// Get all brands/companies for the current agency
exports.getBrands = async (req, res, next) => {
  try {
    const isAdmin = ['supreme_super_admin', 'commander_admin'].includes(req.user.role);
    const isAgencyAdmin = ['agency_super_admin', 'agency_manager'].includes(req.user.role);
    const isEmployee = !isAdmin && !isAgencyAdmin && !['brand_super_admin', 'brand_manager', 'agency_client'].includes(req.user.role);

    if (!isAdmin && !isAgencyAdmin && !isEmployee) {
      return res.status(403).json({ success: false, message: 'Not authorized to access brands' });
    }

    let filter = { role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client'] } };

    if (isAgencyAdmin || isEmployee) {
      // For agency admins and their employees, companyId represents the agency.
      const agencyId = req.user.agencyId || req.user.adminId || req.companyId || (isAgencyAdmin ? req.user._id : null);
      if (!agencyId) {
        return res.status(400).json({ success: false, message: 'No agency associated with this user' });
      }
      filter.agencyId = agencyId;
      if (isEmployee) {
        let hasViewAllFromRole = false;
        try {
          const dbUser = await User.findById(req.user._id);
          // Check if they have the individual toggle on
          if (dbUser && dbUser.viewAllClients) {
            hasViewAllFromRole = true;
          } 
          // Otherwise, check their role permissions
          else if (dbUser && dbUser.customRoleId) {
            const mongoose = require('mongoose');
            const RoleModel = mongoose.models.Role || require('../roles/role.model');
            const roleDoc = await RoleModel.findById(dbUser.customRoleId);
            if (roleDoc && roleDoc.permissions && roleDoc.permissions['Clients-Accounts']) {
              hasViewAllFromRole = roleDoc.permissions['Clients-Accounts'].All || false;
            }
          }
        } catch (e) {
          console.error('Error fetching role for permissions:', e);
        }
        
        if (!hasViewAllFromRole) {
          filter.assignedUsers = req.user._id;
        }
      }
    } else {
      filter.isDirect = true;
      if (req.user && req.user.role === 'commander_admin') {
        filter.createdBy = req.user._id;
      }
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { companyName: searchRegex },
        { email: searchRegex }
      ];
    }

    const brands = await User.find(filter).sort({ createdAt: -1 })
      .populate('createdBy', 'name role roleName')
      .populate('assignedUsers', 'name email role roleName');

    const brandIds = brands.map(b => b._id);
    const usersCounts = await User.aggregate([
      {
        $match: {
          brandId: { $in: brandIds },
          role: { $in: ['brand_manager', 'user'] }
        }
      },
      {
        $match: {
          $expr: { $ne: ['$_id', '$brandId'] }
        }
      },
      {
        $group: {
          _id: '$brandId',
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = {};
    usersCounts.forEach(c => {
      if (c._id) {
        countMap[c._id.toString()] = c.count;
      }
    });

    const data = brands.map((brand) => {
      return {
        ...brand.toObject(),
        adminEmail: brand.email,
        usersCount: countMap[brand._id.toString()] || 0
      };
    });

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// Create a new brand/company and its agency manager user
exports.createBrand = async (req, res, next) => {
  try {
    const { name, email, password, packageName, features, mrr, phone, countryCode, address, dealId } = req.body;

    // Validate Phone Number
    if (phone) {
      const validation = validatePhoneNumber(phone, countryCode);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, message: validation.message });
      }
    }

    const isAdmin = ['supreme_super_admin', 'commander_admin'].includes(req.user.role);
    const isAgency = ['agency_super_admin', 'agency_manager'].includes(req.user.role);
    const isEmployee = !isAdmin && !isAgency && !['brand_super_admin', 'brand_manager', 'agency_client'].includes(req.user.role);

    let hasCreatePerm = false;
    if (isEmployee) {
      const dbUser = await User.findById(req.user._id);
      if (dbUser && dbUser.customRoleId) {
        const mongoose = require('mongoose');
        const RoleModel = mongoose.models.Role || require('../roles/role.model');
        const roleDoc = await RoleModel.findById(dbUser.customRoleId);
        if (roleDoc && roleDoc.permissions && roleDoc.permissions['Clients-Accounts']) {
          hasCreatePerm = roleDoc.permissions['Clients-Accounts'].Create;
        }
      }
    }

    if (!isAdmin && !isAgency && !(isEmployee && hasCreatePerm)) {
      return res.status(403).json({ success: false, message: 'Not authorized to create companies' });
    }

    let agencyId = null;
    let isDirect = false;

    if (isAgency || isEmployee) {
      agencyId = req.user.agencyId || req.user.adminId || (isAgency ? req.user._id : null);
      if (!agencyId) {
        return res.status(400).json({ success: false, message: 'No agency associated with this user' });
      }

      // Check clients limit
      const agencyUserDoc = await User.findById(agencyId).populate('plan');
      const baseClientsLimit = Number(agencyUserDoc?.plan?.clients || 10);
      const extraClientsLimit = Number(agencyUserDoc?.extraClients || 0);
      const maxClients = baseClientsLimit + extraClientsLimit;

      const currentClientsCount = await User.countDocuments({
        agencyId,
        role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client'] },
        isDirect: false
      });

      if (currentClientsCount >= maxClients) {
        return res.status(400).json({
          success: false,
          message: 'You have reached the maximum limit allowed by your current package. If you need additional capacity, please raise a support ticket or upgrade your package.'
        });
      }
    } else {
      isDirect = true;
    }

    // Check if user with this email already exists
    if (email) {
      const emailQuery = email.trim();
      const existingEmail = await User.findOne({
        email: { $regex: new RegExp(`^${emailQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'Email address is already in use. Please use a different email.' });
      }
    }

    // Check if user with this phone number already exists
    if (phone) {
      const phoneQuery = phone.trim();
      const existingPhone = await User.findOne({ phone: phoneQuery });
      if (existingPhone) {
        return res.status(400).json({ success: false, message: 'Phone number is already in use. Please use a different phone number.' });
      }
    }

    let packageBillingInterval = 'Monthly';
    let packageIntegrations = [];
    if (packageName) {
      const Package = require('../packages/package.model');
      let pkg;
      if (isDirect) {
        pkg = await Package.findOne({ type: 'directClient', name: packageName, createdBy: req.user._id });
      } else {
        pkg = await Package.findOne({ type: 'client', name: packageName, agencyId: agencyId });
      }

      if (!pkg) {
        return res.status(400).json({ success: false, message: `Package "${packageName}" not found in your scope.` });
      }

      if (pkg.billingInterval) packageBillingInterval = pkg.billingInterval;
      packageIntegrations = pkg.integrations || [];

      if (req.body.additionalIntegrations && Array.isArray(req.body.additionalIntegrations)) {
        req.body.additionalIntegrations = req.body.additionalIntegrations.filter(i => !packageIntegrations.includes(i));
      } else {
        req.body.additionalIntegrations = [];
      }
      if (req.body.disabledPackageIntegrations && Array.isArray(req.body.disabledPackageIntegrations)) {
        req.body.disabledPackageIntegrations = req.body.disabledPackageIntegrations.filter(i => packageIntegrations.includes(i));
      } else {
        req.body.disabledPackageIntegrations = [];
      }
    } else {
      req.body.additionalIntegrations = [];
      req.body.disabledPackageIntegrations = [];
    }

    const now = new Date();
    let subscriptionEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Default Monthly
    if (packageBillingInterval === 'Yearly') {
      subscriptionEndDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    } else if (packageBillingInterval === 'One Time') {
      subscriptionEndDate = null;
    }

    // Create the User for this brand (which IS the Brand)
    const brand = await User.create({
      name: name,
      email,
      phone,
      countryCode,
      address,
      password: password || undefined,
      role: (isAgency || isEmployee) ? 'agency_client' : (isAdmin ? 'brand_super_admin' : 'brand_manager'),
      agencyId, // Null for direct brands
      companyName: name,
      isDirect,
      packageName: packageName || null,
      features: features || [],
      integrations: [...new Set([...packageIntegrations.filter(i => !req.body.disabledPackageIntegrations.includes(i)), ...req.body.additionalIntegrations])],
      additionalIntegrations: req.body.additionalIntegrations,
      disabledPackageIntegrations: req.body.disabledPackageIntegrations,
      mrr: mrr || 0,
      subscriptionStartDate: now,
      subscriptionEndDate,
      billingInterval: packageBillingInterval,
      createdBy: req.user._id
    });

    brand.brandId = brand._id;
    await brand.save();

    // Dispatch system notification
    const { dispatchSystemNotification } = require('../tasks/notification.service');
    const companyId = req.user?.workspaceId || agencyId || brand._id;
    if (companyId) {
      await dispatchSystemNotification(
        companyId,
        'brandCreated',
        'brand_created',
        'New Brand Created',
        `Brand ${brand.companyName} (${brand.email}) has been created.`,
        { brandId: brand._id }
      );
    }

    if (dealId) {
      const Deal = require('../salesPipeline/deal.model');
      const deal = await Deal.findById(dealId);
      if (deal) {
        deal.clientId = brand._id;
        deal.activityLogs.push({
          action: "Converted to Client",
          performedBy: req.user.name || "System",
          details: `Converted deal to Client user`
        });
        await deal.save();
      }
    }

    res.status(201).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

// Update brand status
exports.updateBrandStatus = async (req, res, next) => {
  try {
    const isAdmin = ['supreme_super_admin', 'commander_admin'].includes(req.user.role);
    const isAgency = ['agency_super_admin', 'agency_manager'].includes(req.user.role);
    const isEmployee = !isAdmin && !isAgency && !['brand_super_admin', 'brand_manager', 'agency_client'].includes(req.user.role);
    
    let hasEditPerm = false;
    if (isEmployee) {
      const dbUser = await User.findById(req.user._id);
      if (dbUser && dbUser.customRoleId) {
        const mongoose = require('mongoose');
        const RoleModel = mongoose.models.Role || require('../roles/role.model');
        const roleDoc = await RoleModel.findById(dbUser.customRoleId);
        if (roleDoc && roleDoc.permissions && roleDoc.permissions['Clients-Accounts']) {
          hasEditPerm = roleDoc.permissions['Clients-Accounts'].Edit;
        }
      }
    } else if (req.user.permissions && req.user.permissions['Clients-Accounts']) {
      hasEditPerm = req.user.permissions['Clients-Accounts'].Edit;
    }

    if (!isAdmin && !isAgency && !(isEmployee && hasEditPerm)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    let filter = { _id: req.params.id, role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client'] } };
    if (isAgency || isEmployee) {
      filter.agencyId = req.user.agencyId || req.user.adminId || (isAgency ? req.user._id : null);
    } else {
      filter.isDirect = true;
    }

    const { status } = req.body;
    const brand = await User.findOneAndUpdate(
      filter,
      { status },
      { returnDocument: 'after', runValidators: true }
    );

    if (!brand) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

// Delete brand
exports.deleteBrand = async (req, res, next) => {
  try {
    const isAdmin = ['supreme_super_admin', 'commander_admin'].includes(req.user.role);
    const isAgency = ['agency_super_admin', 'agency_manager'].includes(req.user.role);
    const isEmployee = !isAdmin && !isAgency && !['brand_super_admin', 'brand_manager', 'agency_client'].includes(req.user.role);

    let hasDeletePerm = false;
    if (isEmployee) {
      const dbUser = await User.findById(req.user._id);
      if (dbUser && dbUser.customRoleId) {
        const mongoose = require('mongoose');
        const RoleModel = mongoose.models.Role || require('../roles/role.model');
        const roleDoc = await RoleModel.findById(dbUser.customRoleId);
        if (roleDoc && roleDoc.permissions && roleDoc.permissions['Clients-Accounts']) {
          hasDeletePerm = roleDoc.permissions['Clients-Accounts'].Delete;
        }
      }
    }

    if (!isAdmin && !isAgency && !(isEmployee && hasDeletePerm)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    let filter = { _id: req.params.id, role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client'] } };
    if (isAgency || isEmployee) {
      filter.agencyId = req.user.agencyId || req.user.adminId || (isAgency ? req.user._id : null);
    } else {
      filter.isDirect = true;
    }

    const brand = await User.findOneAndDelete(filter);

    if (!brand) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // Also delete associated users
    await User.deleteMany({ brandId: req.params.id });

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// Update brand details
exports.updateBrand = async (req, res, next) => {
  try {
    const isAdmin = ['supreme_super_admin', 'commander_admin'].includes(req.user.role);
    const isAgency = ['agency_super_admin', 'agency_manager'].includes(req.user.role);
    const isEmployee = !isAdmin && !isAgency && !['brand_super_admin', 'brand_manager', 'agency_client'].includes(req.user.role);
    
    let hasEditPerm = false;
    if (isEmployee) {
      const dbUser = await User.findById(req.user._id);
      if (dbUser && dbUser.customRoleId) {
        const mongoose = require('mongoose');
        const RoleModel = mongoose.models.Role || require('../roles/role.model');
        const roleDoc = await RoleModel.findById(dbUser.customRoleId);
        if (roleDoc && roleDoc.permissions && roleDoc.permissions['Clients-Accounts']) {
          hasEditPerm = roleDoc.permissions['Clients-Accounts'].Edit;
        }
      }
    } else if (req.user.permissions && req.user.permissions['Clients-Accounts']) {
      hasEditPerm = req.user.permissions['Clients-Accounts'].Edit;
    }

    if (!isAdmin && !isAgency && !(isEmployee && hasEditPerm)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    let filter = { _id: req.params.id, role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client'] } };
    if (isAgency || isEmployee) {
      filter.agencyId = req.user.agencyId || req.user.adminId || (isAgency ? req.user._id : null);
    } else {
      filter.isDirect = true;
    }

    const { name, email, phone, address, packageName, features, integrations, additionalIntegrations, disabledPackageIntegrations, mrr, extraUsers } = req.body;
    let updates = {};

    // Validate Phone Number
    if (phone) {
      let cCode = req.body.countryCode;
      if (!cCode) {
        const existingBrand = await User.findOne(filter).select('countryCode');
        cCode = existingBrand?.countryCode;
      }
      const validation = validatePhoneNumber(phone, cCode);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, message: validation.message });
      }
      updates.phone = phone;
      if (req.body.countryCode) updates.countryCode = req.body.countryCode;
    }

    if (name) {
      updates.companyName = name;
      updates.name = name;
    }
    if (email) updates.email = email;
    if (address) updates.address = address;
    if (mrr !== undefined) updates.mrr = mrr;
    if (extraUsers !== undefined) updates.extraUsers = extraUsers;

    const currentBrand = await User.findOne(filter);
    if (!currentBrand) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const activePackageName = packageName !== undefined ? packageName : currentBrand.packageName;

    let packageIntegrations = [];
    let packageFeatures = [];
    let packagePrice = 0;
    if (activePackageName) {
      const Package = require('../packages/package.model');
      let pkg;
      if (currentBrand.isDirect) {
        pkg = await Package.findOne({ type: 'directClient', name: activePackageName, createdBy: req.user._id });
      } else {
        const agencyId = currentBrand.agencyId || req.user.agencyId || req.user.adminId || (['agency_super_admin', 'agency_manager'].includes(req.user.role) ? req.user._id : null);
        pkg = await Package.findOne({ type: 'client', name: activePackageName, agencyId });
      }

      if (!pkg && packageName !== undefined && packageName !== null) {
        return res.status(400).json({ success: false, message: `Package "${activePackageName}" not found in your scope.` });
      }

      if (pkg) {
        packageIntegrations = pkg.integrations || [];
        packageFeatures = pkg.features || [];
        packagePrice = pkg.price || 0;
      }
    }

    let finalAdditional = additionalIntegrations !== undefined ? additionalIntegrations : (currentBrand.additionalIntegrations || []);
    let finalDisabled = disabledPackageIntegrations !== undefined ? disabledPackageIntegrations : (currentBrand.disabledPackageIntegrations || []);

    if (packageName !== undefined) {
      updates.packageName = packageName;
      updates.features = packageFeatures;
      
      if (mrr === undefined) {
        let parsedPrice = parseFloat(String(packagePrice).replace(/[^\d.-]/g, ''));
        updates.mrr = packageName ? (isNaN(parsedPrice) ? 0 : parsedPrice) : 0;
      }

      finalAdditional = finalAdditional.filter(i => !packageIntegrations.includes(i));
      finalDisabled = finalDisabled.filter(i => packageIntegrations.includes(i));
    } else {
      if (features !== undefined) updates.features = features;
      
      if (integrations !== undefined) {
        // Compute additional and disabled based on the provided explicit integrations array
        finalAdditional = integrations.filter(i => !packageIntegrations.includes(i));
        finalDisabled = packageIntegrations.filter(i => !integrations.includes(i));
      } else {
        if (additionalIntegrations !== undefined) {
          finalAdditional = additionalIntegrations.filter(i => !packageIntegrations.includes(i));
        }
        if (disabledPackageIntegrations !== undefined) {
          finalDisabled = disabledPackageIntegrations.filter(i => packageIntegrations.includes(i));
        }
      }
    }

    updates.additionalIntegrations = finalAdditional;
    updates.disabledPackageIntegrations = finalDisabled;
    updates.integrations = [...new Set([...packageIntegrations.filter(i => !finalDisabled.includes(i)), ...finalAdditional])];

    const brand = await User.findOneAndUpdate(
      filter,
      updates,
      { returnDocument: 'after', runValidators: true }
    );

    if (!brand) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

// Update brand profile (for brand admins)
exports.updateBrandProfile = async (req, res, next) => {
  try {
    const isBrandAdmin = ['brand_super_admin'].includes(req.user.role);
    if (!isBrandAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to update brand profile' });
    }

    const { companyName, contactEmail, domain, industry, logo, logoDark } = req.body;
    let updates = {};
    if (companyName) updates.companyName = companyName;
    if (contactEmail) updates.contactEmail = contactEmail;
    if (domain) updates.domain = domain;
    if (industry) updates.industry = industry;
    if (logo) updates.logo = logo;
    if (logoDark) updates.logoDark = logoDark;
    if (req.body.theme) updates.theme = req.body.theme;

    // Use req.user._id since the brand_super_admin's user record is the brand record 
    // or their brandId if they are just a user
    const brandId = req.user.brandId || req.user._id;

    const brand = await User.findByIdAndUpdate(
      brandId,
      updates,
      { returnDocument: 'after', runValidators: true }
    );

    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

// Assign users to a brand/client
exports.assignUsersToBrand = async (req, res, next) => {
  try {
    const isAdmin = ['supreme_super_admin', 'commander_admin'].includes(req.user.role);
    const isAgencyAdmin = ['agency_super_admin', 'agency_manager'].includes(req.user.role);
    const isEmployee = !isAdmin && !isAgencyAdmin && !['brand_super_admin', 'brand_manager', 'agency_client'].includes(req.user.role);
    
    // Check if user is head or admin
    if (!isAdmin && !isAgencyAdmin && !(isEmployee && req.user.viewAllClients)) {
      return res.status(403).json({ success: false, message: 'Not authorized to assign users' });
    }

    const brandId = req.params.id;
    const { assignedUsers } = req.body;

    if (!Array.isArray(assignedUsers)) {
      return res.status(400).json({ success: false, message: 'assignedUsers must be an array of user IDs' });
    }

    const brand = await User.findById(brandId);
    if (!brand) {
        return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    brand.assignedUsers = assignedUsers;
    await brand.save();

    res.status(200).json({ success: true, message: 'Users assigned successfully', data: brand });
  } catch (error) {
    next(error);
  }
};