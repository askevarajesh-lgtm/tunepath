const express = require('express');
const router = express.Router();
const timeTrackingController = require('./timeTracking.controller');
const auth = require('../../middlewares/authMiddleware');

router.use(auth); // All time tracking routes require authentication

router.post('/', timeTrackingController.logTime);
router.put('/:id', timeTrackingController.updateTimeEntry);
router.delete('/:id', timeTrackingController.deleteTimeEntry);
router.get('/recent', timeTrackingController.getRecentEntries);
router.get('/dashboard', timeTrackingController.getDashboardData);
router.get('/timesheet', timeTrackingController.getTimesheetData);
router.get('/options', timeTrackingController.getFormOptions);
router.get('/performance', timeTrackingController.getTeamTaskPerformance);

module.exports = router;
