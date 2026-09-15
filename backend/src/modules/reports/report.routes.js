const express = require('express');
const router = express.Router();
const reportController = require('./report.controller');
const monthlyHighlightsController = require('./monthlyHighlights.controller');
const protect = require('../../middlewares/authMiddleware');

router.use(protect);

router.get('/history', reportController.getRecentSentReports);
router.get('/analytics', reportController.getAnalytics);
router.post('/generate', reportController.generateReport);

// Monthly Highlights (Month-on-Month Client Report)
router.get('/monthly-highlights', monthlyHighlightsController.getMonthlyHighlights);
router.post('/monthly-highlights', monthlyHighlightsController.upsertMonthlyHighlights);
router.get('/monthly-highlights/client-list', monthlyHighlightsController.getClientReportsList);

router.get('/schedules', reportController.getSchedules);
router.post('/schedules', reportController.createSchedule);
router.put('/schedules/:id/status', reportController.updateScheduleStatus);
router.delete('/schedules/:id', reportController.deleteSchedule);

module.exports = router;

