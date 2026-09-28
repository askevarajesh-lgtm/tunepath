const Package = require('./package.model');

const AGENCY_ROOT_ROLES = ['agency', 'agency_manager', 'agency_super_admin', 'commander_admin', 'supreme_super_admin'];
const BRAND_ROOT_ROLES = ['brand', 'brand_super_admin', 'brand_manager', 'agency_client', 'client'];

/**

 * @param {object} user - a User document (or plain object with at least
 *   role/_id/agencyId/brandId)
 * @returns {Promise<object|null>} the company-root user doc, or null
 */
const resolveCompanyUser = async (user) => {
  if (!user) return null;

  const User = require('../auth/user.model');

  if (user.brandId) {
    return User.findById(user.brandId).lean();
  }

  if (user.agencyId) {
    return User.findById(user.agencyId).lean();
  }

  if (AGENCY_ROOT_ROLES.includes(user.role) || BRAND_ROOT_ROLES.includes(user.role)) {
    if (!user._id) return null;
    return User.findById(user._id).lean();
  }

  if (user.adminId) {
    return User.findById(user.adminId).lean();
  }

  // No known company relationship -- nothing to resolve against.
  return null;
};

/**
 * @param {object} user
 * @returns {Promise<object|null>} lean Package document, or null
 */
const getEffectivePackageForUser = async (user) => {
  const companyUser = await resolveCompanyUser(user);
  if (!companyUser) return null;

  // Agency root: `plan` is a direct ObjectId ref to a Package(type: 'agency').
  if (companyUser.plan) {
    return Package.findOne({ _id: companyUser.plan, type: 'agency' }).lean();
  }

  if (companyUser.packageName) {
    if (companyUser.isDirect) {
      return Package.findOne({
        type: 'directClient',
        name: companyUser.packageName,
        createdBy: companyUser.createdBy
      }).lean();
    }
    return Package.findOne({
      type: 'client',
      name: companyUser.packageName,
      agencyId: companyUser.agencyId
    }).lean();
  }

  return null;
};

/**
 * @param {object} user
 * @returns {Promise<string[]>}
 */
const getEffectivePackageIntegrations = async (user) => {
  const pkg = await getEffectivePackageForUser(user);
  return (pkg && Array.isArray(pkg.integrations)) ? pkg.integrations : [];
};

/**
 * @param {object} user
 * @returns {Promise<string[]>}
 */
const getEffectivePackageFeatures = async (user) => {
  const pkg = await getEffectivePackageForUser(user);
  return (pkg && Array.isArray(pkg.features)) ? pkg.features : [];
};

module.exports = {
  resolveCompanyUser,
  getEffectivePackageForUser,
  getEffectivePackageIntegrations,
  getEffectivePackageFeatures
};