const express = require('express');
const router = express.Router();
const performanceAdsController = require('./performanceAds.controller');
const protect = require('../../middlewares/authMiddleware'); // Existing auth middleware

router.use(protect); // Ensure all routes are protected

const reportController = require('../reports/report.controller');

// GET Dashboard data
router.get('/dashboard', performanceAdsController.getDashboard);

// Report Aliases
router.get('/meta-lead-reports', reportController.getMetaLeadCampaigns);
router.get('/meta-reach-reports', reportController.getMetaReachCampaigns);
router.get('/meta-lead-campaigns', reportController.getMetaLeadCampaigns);
router.get('/meta-reach-campaigns', reportController.getMetaReachCampaigns);

// POST /api/performance-ads/sync
router.post('/sync', protect, performanceAdsController.syncData);

// POST /api/performance-ads/campaign
router.post('/campaign', protect, performanceAdsController.addCampaign);

module.exports = router;
