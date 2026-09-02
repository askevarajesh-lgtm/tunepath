const express = require('express');
const router = express.Router();
const websiteController = require('./website.controller');
const websiteSeoAgentController = require('./websiteSeoAgent.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

// Public Website Details
router.get('/:id/public', websiteController.getPublicWebsiteDetails);

router.use(authMiddleware);

// Website CRUD
router.get('/', websiteController.getWebsites);
router.post('/', websiteController.createWebsite);
router.get('/:id', websiteController.getWebsiteDetails);
router.put('/:id', websiteController.updateWebsite);
router.delete('/:id', websiteController.deleteWebsite);
router.post('/:id/clone', websiteController.cloneWebsite);
router.post('/:id/sync-theme', websiteController.syncWebsiteTheme);
router.post('/:websiteId/ai-edit', websiteController.aiEditWebsite);

// Page actions
router.get('/:websiteId/pages/:pageId', websiteController.getPage);
router.post('/:id/pages', websiteController.addPage);
router.post('/:websiteId/pages/:pageId/duplicate', websiteController.duplicatePage);
router.put('/:websiteId/pages/:pageId', websiteController.updatePage);
router.delete('/:websiteId/pages/:pageId', websiteController.deletePage);

router.post('/:websiteId/pages/:pageId/seo-agent/run', websiteSeoAgentController.runWebsiteSeoAgent);
router.put('/:websiteId/pages/:pageId/seo-agent/:runId/approve', websiteSeoAgentController.approveWebsiteSeoFindings);
router.put('/:websiteId/pages/:pageId/seo-agent/:runId/reject', websiteSeoAgentController.rejectWebsiteSeoFindings);
router.get('/:websiteId/pages/:pageId/seo-agent/history', websiteSeoAgentController.getWebsiteSeoExecutionHistory);

module.exports = router;