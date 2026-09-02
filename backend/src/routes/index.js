const express = require('express');
const router = express.Router();
const healthRoutes = require('../modules/health/health.routes');
const websiteRoutes = require('../modules/websites/website.routes');


const formRoutes = require('../modules/forms/form.routes');
const formTemplateRoutes = require('../modules/forms/form-template.routes');
const blogRoutes = require('../modules/blogs/blog.routes');
const qrRoutes = require('../modules/qrs/qr.routes');
const widgetRoutes = require('../modules/widgets/widget.routes');
const domainRoutes = require('../modules/domains/domain.routes');
const authRoutes = require('../modules/auth/auth.routes');
const templateRoutes = require('../modules/templates/template.routes');
const agencyRoutes = require('../modules/accounts/agency.routes');
const subscriptionRoutes = require('../modules/subscriptions/subscription.routes');
const planUpgradeRequestRoutes = require('../modules/subscriptions/planUpgradeRequest.routes');
const integrationRoutes = require('../modules/integrations/integration.routes');
const facebookRoutes = require('../modules/integrations/facebook.routes');
const userRoutes = require('../modules/auth/user.routes');
const superadminRoutes = require('../modules/superadmin/superadmin.routes');
const commanderRoutes = require('../modules/commander/commander.routes');
const packageRoutes = require('../modules/packages/package.routes');
const brandRoutes = require('../modules/accounts/brand.routes');
const departmentRoutes = require('../modules/departments/department.routes');
const roleRoutes = require('../modules/roles/role.routes');
const mediaRoutes = require('../modules/media/media.routes');
const taskRoutes = require('../modules/tasks/task.routes');
const coordinatorTaskRoutes = require('../modules/tasks/coordinatorTask.routes');
const projectRoutes = require('../modules/projects/project.routes');
const campaignScheduledRoutes = require('../modules/campaign-scheduled/campaignScheduled.routes');
const slaRoutes = require('../modules/sla/sla.routes');
const mosRoutes = require('../modules/mos/mos.routes');
const benchmarkRoutes = require('../modules/benchmarking/benchmark.routes');


// CRM Workflow Routes
const masterItemRoutes = require('../modules/masterItems/masterItem.routes');
const proposalRoutes = require('../modules/proposals/proposal.routes');
const invoiceRoutes = require('../modules/invoices/invoice.routes');
const leadRoutes = require('../modules/leads/lead.routes');
const salesPipelineRoutes = require('../modules/salesPipeline/salesPipeline.routes');

// Agency Restructure Placeholder Routes
const agencyOverviewRoutes = require('../modules/accounts/agencyOverview.routes');
const clientOverviewRoutes = require('../modules/accounts/clientOverview.routes');
const agencyBillingRoutes = require('../modules/accounts/agencyBilling.routes');
const agencyReportsRoutes = require('../modules/accounts/agencyReports.routes');
const agencySettingsRoutes = require('../modules/accounts/agencySettings.routes');
const agencyPerformanceRoutes = require('../modules/accounts/agencyPerformance.routes');
const agencySupportRoutes = require('../modules/accounts/agencySupport.routes');
const agencyUsersRoutes = require('../modules/accounts/agencyUsers.routes');
const supportRoutes = require('../modules/support/support.routes');
const strategyRoutes = require('../modules/strategy/strategy.routes');
const performanceAdsRoutes = require('../modules/performanceAds/performanceAds.routes');
const analyticsRoutes = require('../modules/analytics/analytics.routes');
const reportRoutes = require('../modules/reports/report.routes');
const seoIntelligenceRoutes = require('../modules/seoIntelligence/seoIntelligence.routes');
const seoWorkspaceRoutes = require('../modules/seoWorkspace/seoWorkspace.routes');
const contentAIRoutes = require('../modules/contentAI/contentAI.routes');
const semrushRoutes = require('../modules/semrush/semrush.routes');
const competitorIntelligenceRoutes = require('../modules/competitorIntelligence/competitorIntelligence.routes');

const seoPanelRoutes = require('../modules/seo-panel/seo.routes');

// Missing Financial & Analytics Routes
const expenseRoutes = require('../modules/expenses/expense.routes');
const transactionRoutes = require('../modules/transactions/transaction.routes');
const salesRoutes = require('../modules/sales/sales.routes');
const plAnalyticsRoutes = require('../modules/pl-analytics/pl.routes');
const campaignExpensesRoutes = require('../modules/campaigns/campaign.routes');
const domainPurchaseRoutes = require('../modules/domain-purchases/domainPurchase.routes');
const canvaRoutes = require('../modules/canva/canva.routes');

// Mount routes
router.use('/', domainPurchaseRoutes);
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/auth/canva', canvaRoutes);
router.use('/agencies', agencyRoutes);
router.use('/brands', brandRoutes);

router.use('/agency/overview', agencyOverviewRoutes);
router.use('/client/overview', clientOverviewRoutes);
router.use('/agency/billing', agencyBillingRoutes);
router.use('/agency/reports', agencyReportsRoutes);
router.use('/agency/settings', agencySettingsRoutes);
router.use('/agency/performance', agencyPerformanceRoutes);
router.use('/agency/support', agencySupportRoutes);
router.use('/agency/users', agencyUsersRoutes);
router.use('/packages', packageRoutes);
router.use('/strategy', strategyRoutes);
router.use('/performance-ads', performanceAdsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/mos', mosRoutes);
router.use('/benchmark', benchmarkRoutes);
router.use('/reports', reportRoutes);
router.use('/seo-intelligence', seoIntelligenceRoutes);
router.use('/seo-workspace', seoWorkspaceRoutes);

router.use('/seo-panel', seoPanelRoutes);

const automationV1Routes = require('../modules/seoWorkspace/routes/automationV1.routes');
router.use('/v1/automation', automationV1Routes);
router.use('/content-ai', contentAIRoutes);
router.use('/semrush', semrushRoutes);
router.use('/competitor-intelligence', competitorIntelligenceRoutes);
router.use('/time-tracking', require('../modules/timeTracking/timeTracking.routes'));
router.use('/resources', require('../modules/resources/resources.routes'));
// router.use('/business-intel', require('../modules/businessIntel/businessIntel.routes'));
router.use('/hrms/performance', require('../modules/performance/performance.routes'));
router.use('/websites', websiteRoutes);


router.use('/forms', formRoutes);
router.use('/support', supportRoutes);
router.use('/form-templates', formTemplateRoutes);
router.use('/blogs', blogRoutes);
router.use('/qrs', qrRoutes);
router.use('/chat-widgets', widgetRoutes);
router.use('/domains', domainRoutes);
router.use('/templates', templateRoutes);
router.use('/agencies', agencyRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/plan-upgrades', planUpgradeRequestRoutes);
router.use('/integrations', integrationRoutes);
router.use('/facebook', facebookRoutes);
router.use('/users', userRoutes);
router.use('/superadmin', superadminRoutes);
router.use('/commander', commanderRoutes);
router.use('/departments', departmentRoutes);
router.use('/roles', roleRoutes);
router.use('/media', mediaRoutes);
router.use('/tasks', taskRoutes);
router.use('/coordinator-tasks', coordinatorTaskRoutes);
router.use('/projects', projectRoutes);
router.use('/campaign-scheduled', campaignScheduledRoutes);
router.use('/sla-success', slaRoutes);


// CRM Workflow Mounts
router.use('/master-items', masterItemRoutes);
router.use('/proposals', proposalRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/leads', leadRoutes);
router.use('/sales-pipeline', salesPipelineRoutes);

// Financial & Analytics Mounts
router.use('/expenses', expenseRoutes);
router.use('/transactions', transactionRoutes);
router.use('/sales', salesRoutes);
router.use('/pl-analytics', plAnalyticsRoutes);
router.use('/campaign-expenses', campaignExpensesRoutes);

// Meetings Mount
router.use('/meetings', require('../modules/meetings/meeting.routes'));

// Calendar Mount
router.use('/calendar', require('../modules/calendar/calendar.routes'));

// Deliverables Mount
router.use('/deliverables', require('../modules/deliverables/deliverables.routes'));

// AI Studio Mount
router.use('/ai-studio', require('../modules/aiStudio/aiStudio.routes'));

// Content Mount
router.use('/content', require('../modules/content/content.routes'));

// Sidebar Mount
router.use('/sidebar', require('../modules/sidebar/sidebar.routes'));

// Marketplace Mount
router.use('/marketplace', require('../modules/marketplace/marketplace.routes'));

// WordPress Integration Mount
router.use('/wordpress', require('../modules/wordpress/wordpress.routes'));

// Notepad Mount
router.use('/notepad', require('../modules/notepad/notepad.routes'));

module.exports = router;