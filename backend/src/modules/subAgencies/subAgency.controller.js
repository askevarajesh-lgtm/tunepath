const mongoose = require("mongoose");
const SubAgency = require("./subAgency.model");
const User = require("../auth/user.model");

// @desc    Create a new Sub Agency
// @route   POST /api/sub-agencies
// @access  Private (agency_super_admin, agency_manager)
exports.createSubAgency = async (req, res) => {
  try {
    const { name, email, phone, password, adminName } = req.body;
    const mainAgencyId = req.companyId; // Deriving from existing auth scoping

    if (!name || !email || !password || !adminName) {
      return res.status(400).json({
        success: false,
        error: "Name, email, password, and adminName are required",
      });
    }

    // Ensure user belongs to a Main Agency and has correct role
    if (
      !mainAgencyId ||
      !["agency_super_admin", "agency_manager"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to create Sub Agencies",
      });
    }

    // 1. Create the Sub Agency entity
    const subAgency = new SubAgency({
      name,
      email,
      phone,
      mainAgencyId,
      createdBy: req.user._id,
      isActive: true,
    });
    await subAgency.save();

    // 2. Create the Sub Agency Super Admin user
    // We check if email exists for the User model first
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      // Rollback sub-agency creation if user creation will fail
      await SubAgency.findByIdAndDelete(subAgency._id);
      return res.status(400).json({
        success: false,
        error: "A user with this email already exists",
      });
    }

    const subAgencyAdmin = new User({
      name: adminName,
      email,
      password, // Password hashed by User schema pre-save hook
      phone,
      role: "sub_agency_super_admin",
      subAgencyId: subAgency._id,
      // Main Agency is still technically the company owner context in terms of billing,
      // but execution is scoped to subAgencyId
      companyName: name,
      isActive: true,
      createdBy: req.user._id,
      agencyId: mainAgencyId, // Keep reference to Main Agency for generic User scoping
    });

    await subAgencyAdmin.save();

    res.status(201).json({
      success: true,
      data: {
        subAgency,
        adminUser: {
          _id: subAgencyAdmin._id,
          name: subAgencyAdmin.name,
          email: subAgencyAdmin.email,
          role: subAgencyAdmin.role,
        },
      },
    });
  } catch (error) {
    console.error("Create Sub Agency error:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
      message: error.message,
    });
  }
};

// @desc    Get all Sub Agencies for a Main Agency
// @route   GET /api/sub-agencies
// @access  Private (agency_super_admin, agency_manager)
exports.getSubAgencies = async (req, res) => {
  try {
    const mainAgencyId = req.companyId;

    if (!mainAgencyId) {
      return res.status(403).json({
        success: false,
        error: "Not authorized",
      });
    }

    const subAgencies = await SubAgency.find({ mainAgencyId });

    res.status(200).json({
      success: true,
      data: subAgencies,
    });
  } catch (error) {
    console.error("Get Sub Agencies error:", error);
    res.status(500).json({
      success: false,
      error: "Server Error",
      message: error.message,
    });
  }
};

// @desc    Get all users for a Sub Agency
// @route   GET /api/sub-agencies/users
// @access  Private (sub_agency_super_admin, sub_agency_manager)
exports.getSubAgencyUsers = async (req, res) => {
  try {
    const subAgencyId = req.user.subAgencyId;

    if (!subAgencyId) {
      return res.status(403).json({ success: false, error: "Not a Sub Agency user" });
    }

    const users = await User.find({ subAgencyId }).select("-password");
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("Get Sub Agency users error:", error);
    res.status(500).json({ success: false, error: "Server Error", message: error.message });
  }
};

// @desc    Create a new Sub Agency user
// @route   POST /api/sub-agencies/users
// @access  Private (sub_agency_super_admin, sub_agency_manager)
exports.createSubAgencyUser = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    const subAgencyId = req.user.subAgencyId;
    const mainAgencyId = req.companyId;

    if (!subAgencyId) {
      return res.status(403).json({ success: false, error: "Not a Sub Agency user" });
    }

    // Role validation
    const allowedRoles = ["sub_agency_super_admin", "sub_agency_user"];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, error: "Invalid role for Sub Agency user" });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "A user with this email already exists" });
    }

    const newUser = new User({
      name,
      email,
      password,
      phone,
      role,
      subAgencyId,
      companyName: req.user.companyName,
      isActive: true,
      createdBy: req.user._id,
      agencyId: mainAgencyId,
    });

    await newUser.save();
    
    newUser.password = undefined;

    res.status(201).json({ success: true, data: newUser });
  } catch (error) {
    console.error("Create Sub Agency user error:", error);
    res.status(500).json({ success: false, error: "Server Error", message: error.message });
  }
};

// @desc    Update a Sub Agency user
// @route   PUT /api/sub-agencies/users/:id
// @access  Private (sub_agency_super_admin, sub_agency_manager)
exports.updateSubAgencyUser = async (req, res) => {
  try {
    const { name, phone, role, isActive } = req.body;
    const subAgencyId = req.user.subAgencyId;
    const userId = req.params.id;

    if (!subAgencyId) {
      return res.status(403).json({ success: false, error: "Not a Sub Agency user" });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Cross-tenant/sub-agency isolation check
    if (targetUser.subAgencyId?.toString() !== subAgencyId.toString()) {
      return res.status(403).json({ success: false, error: "Cannot modify user from another Sub Agency" });
    }

    // Role validation
    if (role) {
      const allowedRoles = ["sub_agency_super_admin", "sub_agency_user"];
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, error: "Invalid role for Sub Agency user" });
      }
      targetUser.role = role;
    }

    if (name) targetUser.name = name;
    if (phone !== undefined) targetUser.phone = phone;
    if (isActive !== undefined) targetUser.isActive = isActive;

    // Notice: We specifically ignore attempts to modify email, subAgencyId, agencyId, or companyId.

    await targetUser.save();
    targetUser.password = undefined;

    res.status(200).json({ success: true, data: targetUser });
  } catch (error) {
    console.error("Update Sub Agency user error:", error);
    res.status(500).json({ success: false, error: "Server Error", message: error.message });
  }
};

// @desc    Get all users for a Sub Agency (Main Agency view)
// @route   GET /api/sub-agencies/:id/users
// @access  Private (agency_super_admin, agency_manager)
exports.getMainAgencySubAgencyUsers = async (req, res) => {
  try {
    const mainAgencyId = req.companyId;
    const subAgencyId = req.params.id;

    if (!mainAgencyId) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    // Verify ownership
    const subAgency = await SubAgency.findOne({ _id: subAgencyId, mainAgencyId });
    if (!subAgency) {
      return res.status(404).json({ success: false, error: "Sub Agency not found or not owned by you" });
    }

    const users = await User.find({ subAgencyId }).select("-password");
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("Get Main Agency Sub Agency users error:", error);
    res.status(500).json({ success: false, error: "Server Error", message: error.message });
  }
};

// @desc    Create a new user in a Sub Agency (Main Agency view)
// @route   POST /api/sub-agencies/:id/users
// @access  Private (agency_super_admin, agency_manager)
exports.createMainAgencySubAgencyUser = async (req, res) => {
  try {
    const mainAgencyId = req.companyId;
    const subAgencyId = req.params.id;
    const { name, email, phone, password, role } = req.body;

    if (!mainAgencyId) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    // Verify ownership
    const subAgency = await SubAgency.findOne({ _id: subAgencyId, mainAgencyId });
    if (!subAgency) {
      return res.status(404).json({ success: false, error: "Sub Agency not found or not owned by you" });
    }

    const allowedRoles = ["sub_agency_super_admin", "sub_agency_user"];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, error: "Invalid role for Sub Agency user" });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "A user with this email already exists" });
    }

    const newUser = new User({
      name,
      email,
      password,
      phone,
      role,
      subAgencyId,
      companyName: subAgency.name, // Use the sub agency name for clarity
      isActive: true,
      createdBy: req.user._id,
      agencyId: mainAgencyId,
    });

    await newUser.save();
    newUser.password = undefined;

    res.status(201).json({ success: true, data: newUser });
  } catch (error) {
    console.error("Create Main Agency Sub Agency user error:", error);
    res.status(500).json({ success: false, error: "Server Error", message: error.message });
  }
};

// @desc    Update a user in a Sub Agency (Main Agency view)
// @route   PUT /api/sub-agencies/:subAgencyId/users/:userId
// @access  Private (agency_super_admin, agency_manager)
exports.updateMainAgencySubAgencyUser = async (req, res) => {
  try {
    const mainAgencyId = req.companyId;
    const { subAgencyId, userId } = req.params;
    const { name, phone, role, isActive, password } = req.body;

    if (!mainAgencyId) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    // Verify ownership
    const subAgency = await SubAgency.findOne({ _id: subAgencyId, mainAgencyId });
    if (!subAgency) {
      return res.status(404).json({ success: false, error: "Sub Agency not found or not owned by you" });
    }

    const targetUser = await User.findOne({ _id: userId, subAgencyId });
    if (!targetUser) {
      return res.status(404).json({ success: false, error: "User not found in this Sub Agency" });
    }

    if (role) {
      const allowedRoles = ["sub_agency_super_admin", "sub_agency_user"];
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, error: "Invalid role for Sub Agency user" });
      }
      targetUser.role = role;
    }

    if (name) targetUser.name = name;
    if (phone !== undefined) targetUser.phone = phone;
    if (isActive !== undefined) targetUser.isActive = isActive;
    
    // Explicitly handle password update if provided securely
    if (password) {
      targetUser.password = password;
    }

    await targetUser.save();
    targetUser.password = undefined;

    res.status(200).json({ success: true, data: targetUser });
  } catch (error) {
    console.error("Update Main Agency Sub Agency user error:", error);
    res.status(500).json({ success: false, error: "Server Error", message: error.message });
  }
};
