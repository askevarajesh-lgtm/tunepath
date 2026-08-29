const express = require("express");
const integrationController = require("./integration.controller");
const metaController = require('./meta.controller');
const authMiddleware = require("../../middlewares/authMiddleware");
const { requireRole } = require("../../middlewares/rbac.middleware");
const rbacMiddleware = (...roles) => requireRole(roles);

const router = express.Router();

// Meta Integration Routes
router.get('/meta/auth', authMiddleware, metaController.generateAuthUrl);
router.get('/meta/callback', metaController.handleCallback); // No authMiddleware for callback since it comes from Meta
router.get('/meta/status', authMiddleware, metaController.getMetaIntegrationStatus);
router.get('/meta/ad-accounts', authMiddleware, metaController.getAdAccounts);
router.post('/meta/ad-accounts', authMiddleware, metaController.saveSelectedAdAccounts);
router.post('/meta/campaigns', authMiddleware, metaController.createCampaign);
router.delete('/meta', authMiddleware, metaController.disconnectMeta);

router.use(authMiddleware);

router.get('/payment/:companyId', integrationController.getPaymentIntegration);

const ALLOWED_INTEGRATION_ROLES = [
  "super_admin",
  "supreme_super_admin",
  "commander_admin",
  "admin",
  "coordinator",
  "digital_marketing_coordinator",
  "website_coordinator",
  "agency_manager",
  "agency_super_admin",
  "brand_manager",
  "brand_super_admin",
  "agency_client",
  "client",
  "brand_team_user",
  "client_user",
  "user",
  "salesperson"
];

router.get(
  "/",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.getAllIntegrations,
);
router.post(
  "/",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.createIntegration,
);
router.put(
  "/:id",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.updateIntegration,
);
router.post(
  "/:id/events",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.upsertEventConfig,
);
router.get(
  "/:id/events",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.getEventConfigs,
);
router.post(
  "/:id/send",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.sendMessage,
);

// Twilio SMS Integration Routes
router.post(
  "/twilio/test",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.testTwilioConnection,
);
router.post(
  "/twilio/save",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.saveTwilioIntegration,
);
router.get(
  "/twilio",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.getTwilioIntegration,
);

router.get(
  "/:id/whatsapp/templates",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.fetchWhatsAppTemplates,
);
router.post(
  "/:id/whatsapp-leads/fetch",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.fetchWhatsAppLeads,
);
router.post(
  "/whatsapp-leads/sync",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.syncAllWhatsAppLeads,
);

// Ekta HR integration endpoints
router.post(
  "/ekta/validate",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.validateEktaApi,
);
router.post(
  "/:id/ekta/sync/staff",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.syncEktaStaff,
);
router.post(
  "/:id/ekta/sync/attendance",
  rbacMiddleware(...ALLOWED_INTEGRATION_ROLES),
  integrationController.syncEktaAttendance,
);

module.exports = router;
