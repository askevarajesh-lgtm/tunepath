const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const protect = require('../../middlewares/authMiddleware'); // Existing auth middleware

router.use(protect); // Ensure all routes are protected

// GET Analytics dashboard data
router.get('/', analyticsController.getAnalytics);

// Projects management
router.get('/projects', analyticsController.getProjects);
router.post('/projects', analyticsController.createProject);
router.put('/projects/:id/ga4', analyticsController.updateGa4Property);

// Send Report Email
router.post('/send-email', analyticsController.sendReportEmail);

module.exports = router;