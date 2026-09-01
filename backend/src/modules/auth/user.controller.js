const User = require('./user.model');
const Role = require('../roles/role.model');
const Department = require('../departments/department.model');
const { validatePhoneNumber } = require('../../utils/phoneValidation');

const SYSTEM_ROLES = [
  'supreme_super_admin',
  'commander_admin',
  'agency_super_admin',
  'agency_manager',
  'agency_client',
  'brand_super_admin',
  'brand_manager',
  'user'
];

const validRolesForAdmin = [
  'commander_admin',
  'agency_super_admin',
  'agency_manager',
  'agency_client',
  'brand_super_admin',
  'brand_manager',
  'user'
];

exports.getUsers = async (req, res, next) => {
  try {
    let queryFilter = {};
    if (req.query.role) queryFilter.role = req.query.role;
    
    // If user is supreme_super_admin, only return commander_admin
    if (req.user.role === 'supreme_super_admin') {
      queryFilter.role = 'commander_admin';
    } else if (req.user.role === 'commander_admin') {
      queryFilter.adminId = req.user._id;
      queryFilter.agencyId = null;
      queryFilter.brandId = null;
    } else if (['brand_super_admin', 'brand_manager', 'agency_client'].includes(req.user.role) || (req.user.role === 'user' && req.user.brandId)) {
      queryFilter.brandId = req.user.brandId || (req.user.role === 'agency_client' ? req.user._id : null);
      if (req.user.role === 'brand_manager' || req.user.role === 'agency_client' || req.user.role === 'user') {
        queryFilter.role = { $nin: ['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'brand_super_admin'] };
      } else {
        queryFilter.role = { $nin: ['supreme_super_admin', 'commander_admin', 'agency_super_admin'] };
      }
    } else {
      if (req.user.adminId && !req.user.agencyId) {
        queryFilter.adminId = req.user.adminId;
        queryFilter.agencyId = null;
        queryFilter.brandId = null;
      } else {
        queryFilter.agencyId = req.companyId || req.user.agencyId || req.user._id;
        queryFilter.brandId = null;
      }
      queryFilter.role = { $nin: ['supreme_super_admin', 'commander_admin'] };
    }

    const users = await User.find(queryFilter).select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

exports.getUsersDropdown = async (req, res, next) => {
  try {
    let queryFilter = {};
    if (req.query.role) queryFilter.role = req.query.role;
    
    // If user is supreme_super_admin, only return commander_admin
    if (req.user.role === 'supreme_super_admin') {
      queryFilter.role = 'commander_admin';
    } else if (req.user.role === 'commander_admin') {
      queryFilter.adminId = req.user._id;
      queryFilter.agencyId = null;
      queryFilter.brandId = null;
    } else if (req.user.role === 'agency_client') {
      const clientBrandId = req.user.brandId || req.user._id;
      const clientAgencyId = req.companyId || req.user.agencyId;
      queryFilter.$or = [
        { brandId: clientBrandId, role: { $nin: ['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'brand_super_admin'] } },
        { _id: clientBrandId, role: 'agency_client' },
        { agencyId: clientAgencyId, role: { $in: ['agency_super_admin', 'agency_manager'] } }
      ];
    } else if (['brand_super_admin', 'brand_manager'].includes(req.user.role) || (req.user.role === 'user' && req.user.brandId)) {
      queryFilter.brandId = req.user.brandId;
      if (req.user.role === 'brand_manager' || req.user.role === 'user') {
        queryFilter.role = { $nin: ['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'brand_super_admin'] };
      } else {
        queryFilter.role = { $nin: ['supreme_super_admin', 'commander_admin', 'agency_super_admin'] };
      }
    } else {
      if (req.user.adminId && !req.user.agencyId) {
        queryFilter.adminId = req.user.adminId;
        queryFilter.agencyId = null;
        queryFilter.brandId = null;
      } else {
        queryFilter.agencyId = req.companyId || req.user.agencyId || req.user._id;
        queryFilter.brandId = null;
      }
      queryFilter.role = { $nin: ['supreme_super_admin', 'commander_admin'] };
    }

    // Preserve requested role filter safely
    if (req.query.role) {
      if (queryFilter.role) {
        queryFilter = { $and: [{ ...queryFilter }, { role: req.query.role }] };
        delete queryFilter.role; // Remove the top level role since it's now in $and
      } else {
        queryFilter.role = req.query.role;
      }
    }

    const users = await User.find(queryFilter).select('name email role').sort({ name: 1 });
    res.status(200).json({ success: true, data: { users } });
  } catch (error) {
    next(error);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const userData = { ...req.body };
    
    // Validate Phone Number
    if (userData.phone) {
      const validation = validatePhoneNumber(userData.phone, userData.countryCode);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, message: validation.message });
      }
    }
    
    // Check for Two-Tier Role Mapping
    let incomingRole = userData.role;
    if (incomingRole && !SYSTEM_ROLES.includes(incomingRole)) {
      // It's a dynamic custom role, look it up
      const mongoose = require('mongoose');

      let scopeQuery = {};
      if (req.user.role === 'commander_admin') {
        scopeQuery = { adminId: req.user._id };
      } else if (['brand_super_admin', 'brand_manager', 'agency_client'].includes(req.user.role) || (req.user.role === 'user' && req.user.brandId)) {
        scopeQuery = { brandId: req.user.brandId || (req.user.role === 'agency_client' ? req.user._id : null) };
      } else {
        scopeQuery = { agencyId: req.companyId || req.user.agencyId || req.user._id };
      }

      const customRole = await Role.findOne({ 
        $or: [
          { roleKey: incomingRole }, 
          { _id: mongoose.Types.ObjectId.isValid(incomingRole) ? incomingRole : null }
        ],
        ...scopeQuery
      });
      if (customRole) {
        userData.customRoleId = customRole._id;
        userData.roleName = customRole.roleName;
      }
    } else if (incomingRole && SYSTEM_ROLES.includes(incomingRole)) {
      userData.roleName = incomingRole.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    if (userData.departmentId) {
      const dept = await Department.findById(userData.departmentId);
      if (dept) userData.departmentName = dept.name;
    }

    // Default System Role Mapping based on Creator
    if (req.user.role === 'commander_admin') {
      // Commander Admin can create platform-level users
      userData.adminId = req.user._id;
      userData.agencyId = null;
      userData.brandId = null;
      if (!SYSTEM_ROLES.includes(incomingRole)) userData.role = 'user';
    } else if (['brand_super_admin', 'brand_manager', 'agency_client'].includes(req.user.role) || (req.user.role === 'user' && req.user.brandId)) {
      userData.brandId = req.user.brandId || (req.user.role === 'agency_client' ? req.user._id : null);
      userData.agencyId = req.user.agencyId;
      
      if (req.user.role === 'brand_super_admin') {
         userData.role = 'brand_manager'; // Brand Super Admin always creates Brand Managers
      } else {
         userData.role = 'user'; // Brand Manager, Agency Client, and User create generic users
      }

      // Ensure features are a subset of the creator's features
      if (['agency_client', 'user'].includes(req.user.role)) {
        if (userData.features && Array.isArray(userData.features)) {
          userData.features = userData.features.filter(f => (req.user.features || []).includes(f));
        }
      }
    } else {
      // If created by any other agency user (e.g., Operation Head), assign agencyId
      userData.agencyId = req.companyId || req.user.agencyId || req.user._id;
      if (req.user.adminId) userData.adminId = req.user.adminId;
      userData.brandId = null; // Explicitly prevent brand leak
      
      // If custom role, base access is user
      if (!SYSTEM_ROLES.includes(incomingRole)) userData.role = 'user'; 
      else if (!userData.role) userData.role = 'user';
    }

    // Enforce users limit for agency team members
    if (userData.agencyId && !userData.brandId && !userData.isDirect) {
      const agencyUserDoc = await User.findById(userData.agencyId).populate('plan');
      
      if (agencyUserDoc) {
        const baseLimit = Number(agencyUserDoc.plan?.users || agencyUserDoc.allowedUsers || 5);
        const extraLimit = Number(agencyUserDoc.extraUsers || 0);
        const maxUsers = baseLimit + extraLimit;
        
        const currentUsersCount = await User.countDocuments({
          agencyId: userData.agencyId,
          brandId: null, 
          _id: { $ne: userData.agencyId },
          role: { $in: ['agency_manager', 'user'] }
        });

        if (currentUsersCount >= maxUsers) {
          return res.status(400).json({ 
            success: false, 
            message: 'You have reached the maximum limit allowed by your current package. If you need additional capacity, please raise a support ticket or upgrade your package.'
          });
        }
      }
    }

    // Enforce users limit for brand team members (Direct Brands and Agency Clients)
    if (userData.brandId) {
      const brandDoc = await User.findById(userData.brandId);
      if (brandDoc && brandDoc.packageName) {
        let maxUsers = 0;
        
        if (brandDoc.isDirect) {
          const Package = require('../packages/package.model');
          const pkg = await Package.findOne({ type: 'directClient', name: brandDoc.packageName, createdBy: brandDoc.createdBy });
          if (pkg) maxUsers = pkg.userCount;
        } else {
          // Agency Client
          // User limit is unlimited for agency clients
          maxUsers = 0;
        }

        // Wait, if it's not direct, does the agency client have a limit?
        // Let's assume if maxUsers is found we apply it. If it's a Direct Brand, it will definitely apply.
        if (maxUsers > 0) {
          maxUsers = Number(maxUsers) + Number(brandDoc.extraUsers || 0);
          const currentUsersCount = await User.countDocuments({
            brandId: userData.brandId,
            _id: { $ne: userData.brandId },
            role: { $in: ['brand_manager', 'user'] }
          });

          if (currentUsersCount >= maxUsers) {
            return res.status(400).json({ 
              success: false, 
              message: 'You have reached the maximum limit allowed by your current package. If you need additional capacity, please raise a support ticket or upgrade your package.'
            });
          }
        }
      }
    }

    const user = await User.create(userData);
    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;

    // Dispatch system notification
    const { dispatchSystemNotification } = require('../tasks/notification.service');
    const companyId = user.agencyId || user.brandId || req.user.workspaceId;
    if (companyId) {
      await dispatchSystemNotification(
        companyId,
        'userCreated',
        'user_created',
        'New User Created',
        `User ${user.name} (${user.email}) has been created with role ${user.roleName || user.role}.`,
        { userId: user._id }
      );
    }

    res.status(201).json({ success: true, data: userWithoutPassword });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    // Prevent password update through this route
    const { password, ...updateData } = req.body;
    
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Validate Phone Number if updated
    if (updateData.phone !== undefined && updateData.phone !== null && updateData.phone !== '') {
      // Use provided countryCode or fallback to existing
      const cCode = req.body.countryCode || existingUser.countryCode;
      const validation = validatePhoneNumber(updateData.phone, cCode);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, message: validation.message });
      }
    }
    
    // Check for Two-Tier Role Mapping during update
    if (updateData.role && !SYSTEM_ROLES.includes(updateData.role)) {
      const mongoose = require('mongoose');
      
      let scopeQuery = {};
      if (existingUser.agencyId) scopeQuery.agencyId = existingUser.agencyId;
      if (existingUser.brandId) scopeQuery.brandId = existingUser.brandId;
      if (existingUser.adminId) scopeQuery.adminId = existingUser.adminId;

      const customRole = await Role.findOne({ 
        $or: [
          { roleKey: updateData.role }, 
          { _id: mongoose.Types.ObjectId.isValid(updateData.role) ? updateData.role : null }
        ],
        ...scopeQuery
      });
      if (customRole) {
        updateData.customRoleId = customRole._id;
        updateData.roleName = customRole.roleName;
        
        // Preserve their system tier base role based on current user context
        if (['agency_super_admin', 'agency_manager'].includes(req.user.role)) {
          updateData.role = 'user';
        } else if (['brand_super_admin', 'brand_manager'].includes(req.user.role)) {
          updateData.role = 'user';
        } else {
          updateData.role = 'user';
        }
      }
    } else if (updateData.role && SYSTEM_ROLES.includes(updateData.role)) {
      // If they switch back to a system role, clear the custom role
      updateData.customRoleId = null;
      updateData.roleName = updateData.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    if (updateData.departmentId) {
      const dept = await Department.findById(updateData.departmentId);
      if (dept) updateData.departmentName = dept.name;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { returnDocument: 'after', runValidators: true }).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide both current and new password' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid current password' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};