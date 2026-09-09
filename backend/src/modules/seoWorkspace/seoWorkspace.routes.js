const express = require('express');
const router = express.Router();
const workspaceController = require('./seoWorkspace.controller');
const automationController = require('./controllers/automationV1.controller');
const { verifyToken } = require('../../middlewares/rbac.middleware');
const uploadAttachment = require('./middlewares/uploadAttachment');

router.use(verifyToken);

const VIEW_ONLY_ROLES = ['agency_client', 'client', 'brand_manager', 'brand_super_admin', 'brand_team_user'];
const blockViewOnly = (req, res, next) => {
  if (VIEW_ONLY_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden. Your role has read-only access to SEO Workspace.' });
  }
  next();
};

// API Key Settings
router.get('/settings/api-key', workspaceController.getSettingsStatus);
router.post('/settings/api-key', workspaceController.saveSettings);

// Projects
router.route('/projects')
  .get(workspaceController.getProjects)
  .post(blockViewOnly, workspaceController.createProject);

// Protect ALL project-scoped routes
router.use('/projects/:projectId', workspaceController.requireProjectAccess);

router.put('/projects/:projectId/settings', blockViewOnly, workspaceController.updateSettings);
router.put('/projects/:projectId/credentials/ga4', blockViewOnly, workspaceController.configureGA4Property);

// Audits
router.get('/audits', workspaceController.getAudits);
router.post('/projects/:projectId/audit', blockViewOnly, workspaceController.runAudit);
router.get('/projects/:projectId/audits/compare', workspaceController.compareAudits);
router.get('/projects/:projectId/audit/status', workspaceController.getAuditStatus);


router.post('/projects/:projectId/seo-auditor/run', blockViewOnly, workspaceController.runAuditorAgent);
router.put('/projects/:projectId/seo-auditor/:auditId/approve', blockViewOnly, workspaceController.approveAuditFindings);
router.put('/projects/:projectId/seo-auditor/:auditId/reject', blockViewOnly, workspaceController.rejectAuditFindings);
router.get('/projects/:projectId/seo-auditor/history', workspaceController.getAuditorExecutionHistory);


router.post('/projects/:projectId/keyword-research/run', blockViewOnly, workspaceController.runKeywordResearchAgent);
router.put('/projects/:projectId/keyword-research/approve', blockViewOnly, workspaceController.approveKeywordSuggestions);
router.put('/projects/:projectId/keyword-research/reject', blockViewOnly, workspaceController.rejectKeywordSuggestions);
router.get('/projects/:projectId/keyword-research/history', workspaceController.getKeywordResearchExecutionHistory);
router.post('/projects/:projectId/keywords/detect-intent', blockViewOnly, workspaceController.detectKeywordIntent);
router.post('/projects/:projectId/keywords/related', blockViewOnly, workspaceController.getRelatedKeywords);
router.get('/projects/:projectId/keywords/clusters', workspaceController.getKeywordClusters);
router.get('/projects/:projectId/keywords/authority', workspaceController.getTopicalAuthority);
router.get('/projects/:projectId/keywords/gap', workspaceController.getKeywordGap);


router.post('/projects/:projectId/competitor-agent/run', blockViewOnly, workspaceController.runCompetitorAgent);
router.put('/projects/:projectId/competitor-agent/approve', blockViewOnly, workspaceController.approveCompetitorSuggestions);
router.put('/projects/:projectId/competitor-agent/reject', blockViewOnly, workspaceController.rejectCompetitorSuggestions);
router.get('/projects/:projectId/competitor-agent/history', workspaceController.getCompetitorExecutionHistory);


router.post('/projects/:projectId/technical-seo-agent/run', blockViewOnly, workspaceController.runTechnicalSeoAgent);
router.post('/projects/:projectId/technical-seo-agent/:auditId/generate-fixes', blockViewOnly, workspaceController.generateTechnicalFixes);
router.put('/projects/:projectId/technical-seo-agent/:auditId/approve', blockViewOnly, workspaceController.approveTechnicalFindings);
router.put('/projects/:projectId/technical-seo-agent/:auditId/reject', blockViewOnly, workspaceController.rejectTechnicalFindings);
router.get('/projects/:projectId/technical-seo-agent/history', workspaceController.getTechnicalSeoExecutionHistory);


router.post('/projects/:projectId/content-agent/run', blockViewOnly, workspaceController.runContentAgent);
router.put('/projects/:projectId/content-agent/:contentBriefId/approve', blockViewOnly, workspaceController.approveContentBriefs);
router.put('/projects/:projectId/content-agent/:contentBriefId/reject', blockViewOnly, workspaceController.rejectContentBriefs);
router.get('/projects/:projectId/content-agent/history', workspaceController.getContentAgentExecutionHistory);


router.post('/projects/:projectId/schema-agent/run', blockViewOnly, workspaceController.runSchemaAgent);
router.put('/projects/:projectId/schema-agent/:markupId/approve', blockViewOnly, workspaceController.approveSchemaMarkup);
router.put('/projects/:projectId/schema-agent/:markupId/reject', blockViewOnly, workspaceController.rejectSchemaMarkup);
router.get('/projects/:projectId/schema-agent/history', workspaceController.getSchemaAgentExecutionHistory);


router.post('/projects/:projectId/internal-linking-agent/run', blockViewOnly, workspaceController.runInternalLinkingAgent);
router.put('/projects/:projectId/internal-linking-agent/:linkRunId/approve', blockViewOnly, workspaceController.approveInternalLinkSuggestions);
router.put('/projects/:projectId/internal-linking-agent/:linkRunId/reject', blockViewOnly, workspaceController.rejectInternalLinkSuggestions);
router.get('/projects/:projectId/internal-linking-agent/history', workspaceController.getInternalLinkingExecutionHistory);


router.post('/projects/:projectId/image-seo-agent/run', blockViewOnly, workspaceController.runImageSeoAgent);
router.put('/projects/:projectId/image-seo-agent/:imageSeoRunId/approve', blockViewOnly, workspaceController.approveImageSeoRecommendations);
router.put('/projects/:projectId/image-seo-agent/:imageSeoRunId/reject', blockViewOnly, workspaceController.rejectImageSeoRecommendations);
router.get('/projects/:projectId/image-seo-agent/history', workspaceController.getImageSeoExecutionHistory);


router.post('/projects/:projectId/aeo-agent/run', blockViewOnly, workspaceController.runAeoAgent);
router.put('/projects/:projectId/aeo-agent/:auditId/approve', blockViewOnly, workspaceController.approveAeoRecommendations);
router.put('/projects/:projectId/aeo-agent/:auditId/reject', blockViewOnly, workspaceController.rejectAeoRecommendations);
router.get('/projects/:projectId/aeo-agent/history', workspaceController.getAeoAgentExecutionHistory);
router.get('/projects/:projectId/aeo-agent/:auditId/summary', workspaceController.getAeoAuditSummary);
router.get('/projects/:projectId/aeo-agent/:auditId/pages', workspaceController.getAeoAuditPages);
router.get('/projects/:projectId/aeo-agent/:auditId/simulations', workspaceController.getAeoAuditSimulations);
router.get('/projects/:projectId/aeo-agent/:auditId/entity-graph', workspaceController.getAeoAuditEntityGraph);
router.get('/projects/:projectId/aeo-agent/:auditId/recommendations', workspaceController.getAeoAuditRecommendations);
router.get('/projects/:projectId/aeo-agent/:auditId/export', workspaceController.exportAeoAudit);

router.post('/projects/:projectId/geo-agent/run', blockViewOnly, workspaceController.runGeoAgent);
router.put('/projects/:projectId/geo-agent/:auditId/approve', blockViewOnly, workspaceController.approveGeoRecommendations);
router.put('/projects/:projectId/geo-agent/:auditId/reject', blockViewOnly, workspaceController.rejectGeoRecommendations);

router.get('/projects/:projectId/geo-agent/:auditId/summary', workspaceController.getGeoAuditSummary);
router.get('/projects/:projectId/geo-agent/:auditId/pages', workspaceController.getGeoAuditPages);
router.get('/projects/:projectId/geo-agent/:auditId/entities', workspaceController.getGeoAuditEntities);
router.get('/projects/:projectId/geo-agent/:auditId/technical', workspaceController.getGeoAuditTechnical);
router.get('/projects/:projectId/geo-agent/:auditId/recommendations', workspaceController.getGeoAuditRecommendations);
router.get('/projects/:projectId/geo-agent/trends', workspaceController.getGeoAuditTrends);

router.post('/projects/:projectId/automation/run', blockViewOnly, automationController.runWorkflow);
router.post('/projects/:projectId/automation', blockViewOnly, automationController.createWorkflow);
router.get('/projects/:projectId/automation', automationController.listWorkflows);
router.put('/projects/:projectId/automation/:id/approve', blockViewOnly, automationController.publishWorkflow);
router.put('/projects/:projectId/automation/:id/reject', blockViewOnly, automationController.archiveWorkflow);
router.get('/projects/:projectId/automation/history', automationController.getHistory);
router.get('/projects/:projectId/geo-agent/history', workspaceController.getGeoAgentExecutionHistory);

// Keywords
router.get('/keywords', workspaceController.getKeywords);
router.post('/projects/:projectId/keywords/refresh', blockViewOnly, workspaceController.refreshKeywords);
router.get('/projects/:projectId/keywords/distribution', workspaceController.getRankDistribution);

// Strategies
router.get('/strategies', workspaceController.getStrategies);
router.post('/projects/:projectId/generate-strategy', blockViewOnly, workspaceController.generateStrategy);
router.put('/projects/:projectId/strategies/:strategyId/approve', blockViewOnly, workspaceController.approveStrategy);
router.put('/projects/:projectId/strategies/:strategyId/reject', blockViewOnly, workspaceController.rejectStrategy);
router.post('/projects/:projectId/strategies/:strategyId/publish', blockViewOnly, workspaceController.publishStrategy);

// Analytics
router.get('/projects/:projectId/analytics', workspaceController.getAnalytics);

// Tasks (Approvals Queue)
router.get('/projects/:projectId/tasks', workspaceController.getTasks);
router.put('/projects/:projectId/tasks/:taskId/status', blockViewOnly, workspaceController.updateTaskStatus);
router.put('/projects/:projectId/tasks/:taskId/verify', blockViewOnly, workspaceController.verifyTask);

// Reports
router.get('/projects/:projectId/reports', workspaceController.getReports);
router.post('/projects/:projectId/generate-report', blockViewOnly, workspaceController.generateReport);
router.get('/projects/:projectId/reports/:reportId/download', workspaceController.downloadReport);

// Enterprise Report Additions
router.get('/projects/:projectId/reports/:reportId/preview', workspaceController.previewReport);
router.post('/projects/:projectId/reports/:reportId/share', blockViewOnly, workspaceController.shareReport);
router.put('/projects/:projectId/reports/:reportId/status', blockViewOnly, workspaceController.updateReportStatus);
router.post('/projects/:projectId/reports/bulk', blockViewOnly, workspaceController.bulkReportActions);
router.get('/projects/:projectId/reports-analytics', workspaceController.getReportAnalytics);

// Dashboard & Search
router.get('/dashboard', workspaceController.getDashboard);
router.get('/search', workspaceController.globalSearch);

// Monitoring Module (Enterprise)
const monitoringRoutes = require('./routes/monitoringV1.routes');
router.use('/projects/:projectId/monitoring', monitoringRoutes);

// Comments (polymorphic: targetType is 'Strategy' | 'Task' | 'Report')
router.get('/:targetType/:targetId/comments', workspaceController.getComments);
router.post('/:targetType/:targetId/comments', blockViewOnly, workspaceController.createComment);
router.delete('/comments/:commentId', workspaceController.deleteComment);

// Attachments (polymorphic, same targetType set as comments)
router.get('/:targetType/:targetId/attachments', workspaceController.getAttachments);
router.post('/:targetType/:targetId/attachments', blockViewOnly, uploadAttachment, workspaceController.createAttachment);
router.delete('/attachments/:attachmentId', workspaceController.deleteAttachment);


router.get('/projects/:projectId/history', workspaceController.getHistory);
router.get('/:targetType/:targetId/history', workspaceController.getHistory);

module.exports = router;