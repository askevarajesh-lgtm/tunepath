const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const settingsController = require('./settings.controller');

router.use(authMiddleware);

router.get('/dm-team', settingsController.getDMTeamSettings);
router.put('/dm-team', settingsController.updateDMTeamSettings);
router.get('/priority-levels', settingsController.getPriorityLevels);

module.exports = router;
