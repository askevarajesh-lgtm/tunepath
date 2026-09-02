const express = require('express');
const router = express.Router();
const canvaController = require('./canva.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

// OAuth endpoints (public or session-based depending on flow)
router.get('/auth', authMiddleware, canvaController.connectCanva);
router.get('/callback', canvaController.canvaCallback);

// API endpoints (protected)
router.get('/status', authMiddleware, canvaController.getCanvaStatus);
router.delete('/disconnect', authMiddleware, canvaController.disconnectCanva);
router.get('/designs', authMiddleware, canvaController.getCanvaDesigns);

module.exports = router;
