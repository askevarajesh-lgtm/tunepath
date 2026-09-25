const SUPPORTED_INTEGRATIONS = [
  'whatsapp',
  'sms',
  'email',
  'website',
  'payment',
  'ekta',
  'facebook_leads',
  'ivr'
];

const INTERNAL_PROVIDERS = [
  'meta_ads' // Used by Performance Ads, not exposed as a generic product integration
];

/**
 * Checks if a given type is a supported PRODUCT integration.
 * Internal providers like meta_ads will return false here.
 * @param {string} type 
 * @returns {boolean}
 */
const isSupportedProductIntegration = (type) => {
  return SUPPORTED_INTEGRATIONS.includes(type);
};

/**
 * Checks if a given type is a known internal provider.
 * @param {string} type 
 * @returns {boolean}
 */
const isInternalProvider = (type) => {
  return INTERNAL_PROVIDERS.includes(type);
};

module.exports = {
  SUPPORTED_INTEGRATIONS,
  INTERNAL_PROVIDERS,
  isSupportedProductIntegration,
  isInternalProvider
};
