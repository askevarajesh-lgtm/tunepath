const express = require('express');
const router = express.Router();
const aiStudioController = require('./aiStudio.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

router.get('/debug-schema', (req, res) => {
  const model = require('./models/aiConversation.model');
  res.json({
    paths: Object.keys(model.schema.path('messages').schema.paths)
  });
});

router.use(authMiddleware);

router.post('/generate/image', aiStudioController.generateImage);
router.post('/generate/video', aiStudioController.generateVideo);

router.get('/assets', aiStudioController.getAssets);
router.post('/assets', aiStudioController.saveAsset);
router.delete('/assets/:id', aiStudioController.deleteAsset);

const aiUpload = require('../../middlewares/aiUpload');
router.post('/chat/upload', aiUpload.single('file'), aiStudioController.uploadAiFile);

router.get('/settings', aiStudioController.getSettingsStatus);
router.post('/settings', aiStudioController.saveSettings);

router.get('/chat/history', aiStudioController.getConversations);
router.get('/chat/session/:id', aiStudioController.getConversation);
router.delete('/chat/session/:id', aiStudioController.deleteConversation);
router.post('/chat/message', aiStudioController.sendMessage);
router.post('/chat/stream', aiStudioController.streamMessage);


module.exports = router;

