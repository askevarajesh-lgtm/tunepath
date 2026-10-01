const Integration = require('../modules/integrations/integration.model');
const mongoose = require('mongoose');
const { isSupportedProductIntegration } = require('./supportedIntegrations');

/**
 * Resolves the integrations that are available for a given company.
 * Query matches platform-level integrations (companyId: null) or company-specific integrations.
 * 
 * @param {string|object} companyOrId - company ID or Company document
 * @returns {Promise<object>} map of {[type]: true} representing available integration types
 */
const resolveCompanyIntegrations = async (companyOrId) => {
  let companyId = companyOrId;
  if (companyOrId && typeof companyOrId === 'object') {
    companyId = companyOrId._id || companyOrId.brandId || companyOrId.agencyId;
  }

  const query = {
    $or: [
      { companyId: null }
    ]
  };

  if (companyId) {
    try {
      const oid = mongoose.Types.ObjectId.isValid(companyId)
        ? new mongoose.Types.ObjectId(companyId)
        : null;
      if (oid) {
        query.$or.push({ companyId: oid });
      }
    } catch (err) {
      // Ignore conversion errors
    }
  }

  const allowedMap = {};
  
  // Fetch platform-level integration settings to check global switches
  const platformIntegrations = await Integration.find({ companyId: null }).lean();
  const platformConfigMap = {};
  platformIntegrations.forEach(pi => {
    platformConfigMap[pi.type] = pi;
  });

  // By default, all supported product integrations are structurally available.
  // The actual permission gating (Package Entitlements, disabled overrides)
  // is handled by Layer 2 (integrationAccess.js / packageAccess.service.js).
  // Now we respect the global master switch first.
  const { SUPPORTED_INTEGRATIONS, INTERNAL_PROVIDERS } = require('./supportedIntegrations');
  const allIntegrations = [...SUPPORTED_INTEGRATIONS, ...INTERNAL_PROVIDERS];
  
  allIntegrations.forEach(type => {
    const platformConfig = platformConfigMap[type];
    if (platformConfig) {
      // If the platform-level document exists, use its isGloballyEnabled value
      // (Fallback to true if isGloballyEnabled is undefined/missing on old documents)
      allowedMap[type] = platformConfig.isGloballyEnabled !== false;
    } else {
      // If no platform-level document exists, treat it as globally enabled by default
      allowedMap[type] = true;
    }
  });

  return allowedMap;
};

module.exports = { resolveCompanyIntegrations };
