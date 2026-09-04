const User = require('../auth/user.model');
const SlaRecord = require('../sla/sla.model');
const Task = require('../tasks/task.model');
const bcrypt = require('bcryptjs');

exports.getDashboardStats = async (req, res, next) => {
  try {
    // Only count unique agencies. Usually top-level agency accounts have role 'commander_admin' or 'agency_super_admin'
    const agencies = await User.find({ 
      role: { $in: ['commander_admin', 'agency_super_admin'] }
    }, 'mrr status createdAt plan').populate('plan', 'price');

    const totalCompanies = agencies.length;
    
    let activeAgenciesCount = 0;
    let mrr = 0;
    let churnedCount = 0;
    let newAgencies = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    agencies.forEach(agency => {
      let agencyMrr = agency.mrr || 0;
      if (!agencyMrr && agency.plan && agency.plan.price) {
          agencyMrr = parseFloat(String(agency.plan.price).replace(/[^\d.]/g, '')) || 0;
      }

      if (agency.status === 'active' || agency.status === 'trial') {
        activeAgenciesCount++;
        mrr += agencyMrr;
      } else if (agency.status === 'churned') {
        churnedCount++;
      }
      
      if (agency.createdAt >= thirtyDaysAgo) {
        newAgencies++;
      }
    });
    
    // Active Users (genuine count of all active users across platform)
    const activeUsers = await User.countDocuments({ status: 'active' });
    
    const churnRate = totalCompanies > 0 ? ((churnedCount / totalCompanies) * 100).toFixed(1) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalCompanies,
        activeAgencies: activeAgenciesCount,
        newAgencies,
        activeUsers,
        mrr,
        churnRate: `${churnRate}%`,
        agenciesData: agencies // For platform alerts or tables
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { companyName, email, phone, domain, logo, logoDark } = req.body;
    
    // Check if email is being updated to an existing one
    if (email) {
      const existingEmail = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (existingEmail) {
        return res.status(400).json({ success: false, error: 'Email is already in use.' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { companyName, email, phone, domain, logo, logoDark },
      { new: true, returnDocument: 'after', runValidators: true }
    ).select('-password');

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid current password' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getPlatformConfig = async (req, res, next) => {
  try {
    const superAdmin = await User.findOne({ role: 'supreme_super_admin' }).select('logo logoDark domain companyName');
    res.status(200).json({
      success: true,
      data: {
        logo: superAdmin?.logo || null,
        logoDark: superAdmin?.logoDark || null,
        domain: superAdmin?.domain || null,
        companyName: superAdmin?.companyName || null,
      }
    });
  } catch (error) {
    next(error);
  }
};

