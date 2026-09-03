const express = require('express');
const router = express.Router();
const correctionController = require('./correction.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

router.use(authMiddleware);

router.post('/', correctionController.createCorrection);
router.get('/', correctionController.getCorrections);
router.post('/:id/message', correctionController.addMessage);
router.put('/:id/status', correctionController.updateStatus);
router.delete('/:id', correctionController.deleteCorrection);

module.exports = router;
