const express = require('express');
const router = express.Router();
const timelineController = require('./timeline.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', timelineController.getTimelineEvents);
router.post('/', timelineController.createTimelineEvent);

module.exports = router;
