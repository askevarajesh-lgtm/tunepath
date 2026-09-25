const express = require('express');
const router = express.Router();
const ivrController = require('./ivr.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

// Public / Signature-verified Webhook Endpoint (Called by Sollu IVR)
router.all('/webhook', ivrController.handleSolluWebhook);
router.all('/callback', ivrController.handleSolluWebhook);
router.all('/outboundcallback', ivrController.handleSolluWebhook);

// Protected Outbound IVR Endpoints (Called from CRM Frontend)
router.post('/outbound-call', authMiddleware, ivrController.initiateOutboundCall);
router.get('/leads/:leadId/calls', authMiddleware, ivrController.getLeadCallLogs);
router.get('/calls', authMiddleware, ivrController.getAllCallLogs);

module.exports = router;
