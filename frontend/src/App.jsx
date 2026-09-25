import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { FeatureProvider } from './contexts/FeatureContext';
import SignIn from './pages/SignIn/SignIn';
import ForgotPassword from './pages/SignIn/ForgotPassword';
import { ClientProvider } from './contexts/ClientContext';
import { Spin } from 'antd';

// Layouts
import AppLayout from './layouts/AppLayout';
import AgencyLayout from './layouts/AgencyLayout';
import ClientLayout from './layouts/ClientLayout';
import UserLayout from './layouts/UserLayout';
import PlaceholderPage from './components/PlaceholderPage';
import { 
  Users, HeartHandshake, Monitor, MessageCircle, TrendingUp, Zap, 
  CheckSquare, Globe, PieChart, BarChart2, GitMerge, LineChart, 
  Lightbulb, Calendar, DollarSign, File, Store, Book, Library, Shield, Bell, CreditCard, Activity, Bot, Award,
  Target, PenTool, Cpu, Share2, Megaphone, Inbox, Layout, Search
} from 'lucide-react';

// Admin Pages
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const CRM = lazy(() => import('./pages/CRM/CRM'));
const WebsiteBuilder = lazy(() => import('./pages/WebsiteBuilder/WebsiteBuilder'));
const BuilderRouteWrapper = lazy(() => import('./pages/WebsiteBuilder/tabs/BuilderRouteWrapper'));
const BlogPostBuilderRouteWrapper = lazy(() => import('./pages/WebsiteBuilder/tabs/BlogPostBuilderRouteWrapper'));
const FormEmbedView = lazy(() => import('./pages/WebsiteBuilder/tabs/FormEmbedView'));
const BlogEmbedView = lazy(() => import('./pages/WebsiteBuilder/tabs/BlogEmbedView'));
const BlogPostEmbedView = lazy(() => import('./pages/WebsiteBuilder/tabs/BlogPostEmbedView'));
const QREmbedView = lazy(() => import('./pages/WebsiteBuilder/tabs/QREmbedView'));
const WebsitePreviewView = lazy(() => import('./pages/WebsiteBuilder/tabs/WebsitePreviewView'));
const CustomDomainWebsiteViewer = lazy(() => import('./pages/WebsiteBuilder/tabs/CustomDomainWebsiteViewer'));
const BlogPostPreviewView = lazy(() => import('./pages/WebsiteBuilder/tabs/BlogPostPreviewView'));
const Strategy = lazy(() => import('./pages/Strategy/Strategy'));
const SeoIntelligence = lazy(() => import('./pages/SeoIntelligence/SeoIntelligence'));
const SemrushDashboard = lazy(() => import('./pages/Semrush/SemrushDashboard'));
const Semrush = lazy(() => import('./pages/Semrush/Semrush'));
const DashboardTab = lazy(() => import('./pages/Semrush/components/DashboardTab'));
const PositionTrackingTab = lazy(() => import('./pages/Semrush/components/PositionTrackingTab'));
const ActivityTab = lazy(() => import('./pages/Semrush/components/ActivityTab'));
const DomainOverviewTab = lazy(() => import('./pages/Semrush/components/DomainOverviewTab'));
const OrganicKeywordsTab = lazy(() => import('./pages/Semrush/components/OrganicKeywordsTab'));
const BacklinksTab = lazy(() => import('./pages/Semrush/components/BacklinksTab'));
const SiteHealthTab = lazy(() => import('./pages/Semrush/components/SiteHealthTab'));
const KeywordMagicToolTab = lazy(() => import('./pages/Semrush/components/KeywordMagicToolTab'));
const CompetitorAnalysisTab = lazy(() => import('./pages/Semrush/components/CompetitorAnalysisTab'));
const TrafficAnalyticsTab = lazy(() => import('./pages/Semrush/components/TrafficAnalyticsTab'));
const ReportsTab = lazy(() => import('./pages/Semrush/components/ReportsTab'));
const Content = lazy(() => import('./pages/Content/Content'));
const AIStudio = lazy(() => import('./pages/AIStudio/AIStudio'));
const CampaignScheduledPage = lazy(() => import('./pages/Campaign Scheduled/CampaignScheduledPage'));
const PerformanceAds = lazy(() => import('./pages/PerformanceAds/PerformanceAds'));
const Accounts = lazy(() => import('./pages/Accounts/Accounts'));
const SLA = lazy(() => import('./pages/SLA/SLA'));
const PortalSettings = lazy(() => import('./pages/PortalSettings/PortalSettings'));
const Analytics = lazy(() => import('./pages/Analytics/Analytics'));
import { ErrorBoundary } from "./components/ErrorBoundary";
const Automation = lazy(() => import('./pages/Automation/Automation'));
const TasksPage = lazy(() => import('./pages/Tasks/TasksPage'));
const TaskForm = lazy(() => import('./pages/Tasks/TaskForm'));
const TaskAnalyticsPage = lazy(() => import('./pages/Tasks/TaskAnalyticsPage'));
const CoordinatorTasks = lazy(() => import('./pages/Tasks/CoordinatorTasks'));
const ProjectList = lazy(() => import('./pages/projects/ProjectList'));
const ProjectForm = lazy(() => import('./pages/projects/ProjectForm'));
const ProjectDetail = lazy(() => import('./pages/projects/ProjectDetail'));
const MasterItemsList = lazy(() => import('./pages/MasterItems/MasterItemsList'));
const MasterItemForm = lazy(() => import('./pages/MasterItems/MasterItemForm'));
const ExpenseManagementPage = lazy(() => import('./pages/expenses/ExpenseManagementPage'));
const CampaignExpensesList = lazy(() => import('./pages/campaign-expenses/CampaignList'));
const CampaignExpensesForm = lazy(() => import('./pages/campaign-expenses/CampaignForm'));
const CampaignExpensesView = lazy(() => import('./pages/campaign-expenses/CampaignView'));
const ProposalsList = lazy(() => import('./pages/Proposals/ProposalsList'));
const ProposalForm = lazy(() => import('./pages/Proposals/ProposalForm'));
const ProposalViewPage = lazy(() => import('./pages/Proposals/ProposalViewPage'));
const InvoicesList = lazy(() => import('./pages/Invoices/InvoicesList'));
const InvoiceForm = lazy(() => import('./pages/Invoices/InvoiceForm'));
const InvoiceViewPage = lazy(() => import('./pages/Invoices/InvoiceViewPage'));
const MeetingsPage = lazy(() => import('./pages/Meetings/MeetingsPage'));
const CalendarPage = lazy(() => import('./pages/Calendar/CalendarPage'));
const DeliverablesPage = lazy(() => import('./pages/Deliverables/DeliverablesPage'));
const PLDashboard = lazy(() => import('./pages/pl-analytics/PLDashboard'));

const Reports = lazy(() => import('./pages/Reports/Reports'));

const TimeTracking = lazy(() => import('./pages/TimeTracking/TimeTracking'));
const Resources = lazy(() => import('./pages/Resources/Resources'));
const MOSScore = lazy(() => import('./pages/MOSScore/MOSScore'));
const Finance = lazy(() => import('./pages/Finance/Finance'));
const Profitability = lazy(() => import('./pages/Profitability/Profitability'));
const SalesPipeline = lazy(() => import('./pages/SalesPipeline/SalesPipeline'));
const SettingsPage = lazy(() => import('./pages/Settings/Settings'));
const ClientSettingsTab = lazy(() => import('./pages/ClientPortal/tabs/ClientSettingsTab'));
const AIAgents = lazy(() => import('./pages/AIAgents/AIAgents'));
const AICopilot = lazy(() => import('./pages/AICopilot/AICopilot'));
const Benchmarks = lazy(() => import('./pages/Benchmarks/Benchmarks'));
const Marketplace = lazy(() => import('./pages/Marketplace/Marketplace'));
const MarketplaceSEO = lazy(() => import('./pages/Marketplace/SEO/MarketplaceSEO'));
const ClientChatGPTPage = lazy(() => import('./pages/ClientChatGPTPage/ClientChatGPTPage'));
const ClaudeChatPage = lazy(() => import('./pages/ClaudeChatPage/ClaudeChatPage'));
const ClientCanvaPage = lazy(() => import('./pages/ClientCanvaPage/ClientCanvaPage'));

// Agency Portal Tabs
const OverviewTab = lazy(() => import('./pages/AgencyPortal/tabs/OverviewTab'));
const AgencyAdminDashboardTab = lazy(() => import('./pages/AgencyPortal/tabs/AgencyAdminDashboardTab'));
const ClientsTab = lazy(() => import('./pages/AgencyPortal/tabs/ClientsTab'));
const AgencyPerformanceTab = lazy(() => import('./pages/AgencyPortal/tabs/PerformanceTab'));
const AgencyTasksTab = lazy(() => import('./pages/AgencyPortal/tabs/TasksTab'));
const AgencyBillingTab = lazy(() => import('./pages/AgencyPortal/tabs/BillingTab'));
const AgencySupportTab = lazy(() => import('./pages/AgencyPortal/tabs/SupportTab'));
const AgencyReportsTab = lazy(() => import('./pages/AgencyPortal/tabs/AgencyReportsTab'));
const AgencySettingsTab = lazy(() => import('./pages/AgencyPortal/tabs/AgencySettingsTab'));
const AgencyUsersTab = lazy(() => import('./pages/AgencyPortal/tabs/AgencyUsersTab'));

// Client Portal Tabs
const ClientDashboardTab = lazy(() => import('./pages/ClientPortal/tabs/DashboardTab'));
const BrandUsersTab = lazy(() => import('./pages/ClientPortal/tabs/BrandUsersTab'));
const BillingTab = lazy(() => import('./pages/ClientPortal/tabs/BillingTab'));
const ClientPerformanceTab = lazy(() => import('./pages/ClientPortal/tabs/MyPerformanceTab'));
const ClientLeadsTab = lazy(() => import('./pages/ClientPortal/tabs/LeadsTab'));
const ClientTasksTab = lazy(() => import('./pages/ClientPortal/tabs/TasksTab'));
const BrandSettingsTab = lazy(() => import('./pages/ClientPortal/tabs/BrandSettingsTab'));

const ClientBillingTab = lazy(() => import('./pages/ClientPortal/tabs/BillingTab'));
const ClientSupportTab = lazy(() => import('./pages/ClientPortal/tabs/SupportTab'));
const ClientWebsiteTab = lazy(() => import('./pages/ClientPortal/tabs/ClientWebsiteTab'));
const TeamTab = lazy(() => import('./pages/ClientPortal/tabs/TeamTab'));
const ClientReportsTab = lazy(() => import('./pages/ClientPortal/tabs/ReportsTab'));

// User Portal Tabs
const UserDashboardTab = lazy(() => import('./pages/UserPortal/DashboardTab'));
const UserSettingsTab = lazy(() => import('./pages/UserPortal/SettingsTab'));

// Super Admin Layout and Pages
import SuperAdminLayout from './layouts/SuperAdminLayout';
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdmin/Dashboard'));
const SuperAdminCompanies = lazy(() => import('./pages/SuperAdmin/Companies'));
const SuperAdminSubscriptions = lazy(() => import('./pages/SuperAdmin/Subscriptions'));
const SuperAdminIntegrations = lazy(() => import('./pages/SuperAdmin/Integrations'));
const SuperAdminAdmins = lazy(() => import('./pages/SuperAdmin/Admins'));
const SuperAdminSettings = lazy(() => import('./pages/SuperAdmin/Settings/SuperAdminSettings'));

// Ekta HR / HRMS Pages (Commander Admin)
const EktaHrStaffPage = lazy(() => import('./pages/integrations/EktaHrStaffPage'));
const EktaHrAttendanceModulePage = lazy(() => import('./pages/integrations/EktaHrAttendanceModulePage'));
const DailyReports = lazy(() => import('./pages/dailyreport/DailyReports'));

const PerformancePage = lazy(() => import('./pages/performance/PerformancePage'));
const SelfAssessmentForm = lazy(() => import('./pages/performance/SelfAssessmentForm'));
const TransactionsPage = lazy(() => import('./pages/transactions/TransactionsPage'));
const SalesTrackingPageEnhanced = lazy(() => import('./pages/sales/SalesTrackingPageEnhanced'));
const SEOPanel = lazy(() => import('./pages/seo-panel/SEOPanel'));


const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
    <Spin size="large" />
  </div>
);

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function OAuthRedirectHandler() {
  const { search } = useLocation();
  const { role } = useAuth();
  
  if (!role) {
    return <Navigate to="/signin" replace />;
  }

  let target = "/dashboard";
  if (['supreme_super_admin', 'superadmin', 'commander_admin'].includes(role)) {
      target = "/workspace/social";
  } else if (['agency_super_admin', 'agency_manager', 'agency'].includes(role)) {
      target = "/agency/social-media";
  } else if (['agency_client', 'brand_super_admin', 'brand_manager', 'brand_admin', 'brand_team_user', 'client'].includes(role)) {
      target = "/client/workspace/social";
  } else {
      target = "/user/workspace/social";
  }
  
  return <Navigate to={`${target}${search}`} replace />;
}

// Protected Route Component
const ProtectedRoute = ({ allowedRoles }) => {
  const { role, user } = useAuth();
  
  if (!role) {
    return <Navigate to="/signin" replace />;
  }

  const isClientUser = ['agency_client', 'brand_super_admin', 'brand_manager', 'brand_admin', 'brand_team_user', 'client'].includes(role) || Boolean(user?.brandId);

  if (allowedRoles && !allowedRoles.includes(role)) {
    if (isClientUser && (allowedRoles.includes('agency_client') || allowedRoles.includes('brand_team_user') || allowedRoles.includes('client') || allowedRoles.includes('brand_super_admin') || allowedRoles.includes('user'))) {
      return <Outlet />;
    }

    if (['supreme_super_admin', 'superadmin'].includes(role)) return <Navigate to="/superadmin/dashboard" replace />;
    if (role === 'commander_admin') return <Navigate to="/dashboard" replace />;
    if (role === 'agency_super_admin') return <Navigate to="/agency/admin-overview" replace />;
    if (['agency_manager', 'agency'].includes(role)) return <Navigate to="/agency/overview" replace />;
    if (isClientUser) return <Navigate to="/client/dashboard" replace />;
    return <Navigate to="/user/dashboard" replace />;
  }
  
  return <Outlet />;
};

const SeoRedirect = () => {
  const { role } = useAuth();
  const location = useLocation();
  const sub = location.pathname.replace(/^\/seo\/?/, '') || 'dashboard';

  if (['agency_super_admin', 'agency_manager', 'agency'].includes(role)) {
    return <Navigate to={`/agency/marketplace/seo/${sub}`} replace />;
  }
  if (['agency_client', 'brand_super_admin', 'brand_manager', 'brand_admin', 'brand_team_user', 'client'].includes(role)) {
    return <Navigate to={`/client/marketplace/seo/${sub}`} replace />;
  }
  if (['supreme_super_admin', 'superadmin', 'commander_admin'].includes(role)) {
    return <Navigate to={`/workspace/seo/${sub}`} replace />;
  }
  return <Navigate to={`/user/workspace/seo/${sub}`} replace />;
};

const AgencySeoRedirect = () => {
  const location = useLocation();
  const sub = location.pathname.replace(/^\/agency\/seo\/?/, '') || 'dashboard';
  return <Navigate to={`/agency/marketplace/seo/${sub}`} replace />;
};

const ReportsRedirect = () => {
  const { role } = useAuth();

  if (['agency_super_admin', 'agency_manager', 'agency'].includes(role)) {
    return <Navigate to="/agency/reports" replace />;
  }
  if (role === 'agency_client') {
    return <Navigate to="/client/reports" replace />;
  }
  if (['brand_super_admin', 'brand_manager', 'brand_admin', 'brand_team_user', 'client'].includes(role)) {
    return <Navigate to="/client/dashboard" replace />;
  }
  return <Navigate to="/intelligence/reporting" replace />;
};

const ClientReportsRouteGuard = () => {
  const { role } = useAuth();
  if (['brand_super_admin', 'brand_manager', 'brand_admin', 'brand_team_user'].includes(role)) {
    return <Navigate to="/client/dashboard" replace />;
  }
  return <ClientReportsTab />;
};

const UserLayoutRouteGuard = () => {
  const { role, user } = useAuth();
  const isClientUser = ['agency_client', 'brand_super_admin', 'brand_manager', 'brand_admin', 'brand_team_user', 'client'].includes(role) || Boolean(user?.brandId);
  if (isClientUser) {
    return <Navigate to="/client/dashboard" replace />;
  }
  return <UserLayout />;
};

const AppRoutes = () => {
  const { role, user } = useAuth();
  
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
      {/* Top-level universal SEO and Reports routes */}
      <Route path="/seo" element={<SeoRedirect />} />
      <Route path="/seo/*" element={<SeoRedirect />} />
      <Route path="/workspace/reports" element={<ReportsRedirect />} />
      <Route path="/reports" element={<ReportsRedirect />} />

      <Route path="/signin" element={role ? (
        <Navigate to={
          ['supreme_super_admin', 'superadmin'].includes(role) ? '/superadmin/dashboard' : 
          role === 'commander_admin' ? '/dashboard' : 
          role === 'agency_super_admin' ? '/agency/admin-overview' :
          ['agency_manager', 'agency'].includes(role) ? '/agency/overview' : 
          (['agency_client', 'brand_super_admin', 'brand_manager', 'brand_admin', 'brand_team_user', 'client'].includes(role) || Boolean(user?.brandId)) ? '/client/dashboard' :
          '/user/dashboard'
        } replace />
      ) : <SignIn />} />
      <Route path="/forgot-password" element={role ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} />
      
      {/* Public / Embed Routes */}
      <Route path="/embed/form/:formId" element={<FormEmbedView />} />
      <Route path="/embed/blog/:blogId" element={<BlogEmbedView />} />
      <Route path="/embed/qr/:qrId" element={<QREmbedView />} />
      <Route path="/blog/:blogSlug" element={<BlogEmbedView />} />
      <Route path="/blog/:blogSlug/:postSlug" element={<BlogPostEmbedView />} />
      <Route path="/preview/website/:websiteId/page/:pageId" element={<WebsitePreviewView />} />
      <Route path="/preview/website/:websiteId/blog-post/:postId" element={<BlogPostPreviewView />} />
      
      {/* Super Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['supreme_super_admin', 'superadmin']} />}>
        <Route path="/superadmin" element={<SuperAdminLayout />}>
          <Route index element={<Navigate to="/superadmin/dashboard" replace />} />
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route path="companies" element={<SuperAdminCompanies />} />
          <Route path="subscriptions" element={<SuperAdminSubscriptions />} />
          <Route path="integrations" element={<SuperAdminIntegrations />} />
          
          <Route path="admins" element={<SuperAdminAdmins />} />
          <Route path="settings" element={<SuperAdminSettings />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['supreme_super_admin', 'superadmin', 'commander_admin']} />}>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          
          <Route path="clients/accounts" element={<Accounts />} />
          <Route path="clients/sla" element={<SLA />} />
          <Route path="clients/portal" element={<PortalSettings />} />

          <Route path="workspace/strategy" element={<Strategy />} />
          <Route path="workspace/seo/*" element={<MarketplaceSEO />} />
          <Route path="workspace/seo" element={<MarketplaceSEO />} />
          <Route path="workspace/content" element={<Content />} />
          <Route path="workspace/aistudio" element={<AIStudio />} />
          <Route path="workspace/social" element={<CampaignScheduledPage />} />
          <Route path="workspace/ads" element={<PerformanceAds />} />
          <Route path="workspace/crm" element={<CRM />} />
          <Route path="workspace/automation" element={<Automation />} />
          <Route path="workspace/tasks" element={<TasksPage />} />
          <Route path="workspace/tasks/new" element={<TaskForm />} />
          <Route path="workspace/tasks/:id/edit" element={<TaskForm />} />
          <Route path="workspace/tasks/analytics" element={<TaskAnalyticsPage />} />
          <Route path="workspace/tasks/coordinator" element={<CoordinatorTasks />} />
          <Route path="workspace/projects" element={<ProjectList />} />
          <Route path="workspace/projects/new" element={<ProjectForm />} />
          <Route path="workspace/projects/:id" element={<ProjectDetail />} />
          <Route path="workspace/projects/:id/edit" element={<ProjectForm />} />
          <Route path="workspace/master-items" element={<MasterItemsList />} />
          <Route path="workspace/master-items/new" element={<MasterItemForm />} />
          <Route path="workspace/master-items/:id" element={<MasterItemForm />} />
          <Route path="workspace/proposals" element={<ProposalsList />} />
          <Route path="workspace/proposals/new" element={<ProposalForm />} />
          <Route path="workspace/proposals/:id" element={<ProposalForm />} />
          <Route path="workspace/proposals/:id/view" element={<ProposalViewPage />} />
          <Route path="workspace/invoices" element={<InvoicesList />} />
          <Route path="workspace/invoices/new" element={<InvoiceForm />} />
          <Route path="workspace/invoices/:id" element={<InvoiceForm />} />
          <Route path="workspace/invoices/:id/view" element={<InvoiceViewPage />} />
          <Route path="workspace/website/*" element={<WebsiteBuilder />} />
          <Route path="workspace/website/:websiteId/pages/:pageId/edit" element={<BuilderRouteWrapper />} />
          <Route path="workspace/website/:websiteId/blogs/:blogId/posts/:postId/edit" element={<BlogPostBuilderRouteWrapper />} />
          <Route path="workspace/reports" element={<Reports />} />

          <Route path="intelligence/analytics" element={<Analytics />} />
          <Route path="intelligence/mos" element={<MOSScore />} />
          <Route path="intelligence/copilot" element={<AICopilot />} />
          <Route path="intelligence/chatgpt" element={<ClientChatGPTPage />} />
          <Route path="intelligence/claude" element={<ClaudeChatPage />} />
          <Route path="intelligence/canva" element={<ClientCanvaPage />} />
          <Route path="intelligence/agents" element={<AIAgents />} />
          {/* <Route path="intelligence/benchmarks" element={<Benchmarks />} /> */}
          <Route path="intelligence/reporting" element={<Reports />} />
          <Route path="intelligence/seo" element={<SeoIntelligence />} />
          <Route path="intelligence/seo-aeo-geo" element={<SemrushDashboard />} />
          <Route path="intelligence/seo-aeo-geo/:projectId" element={<Semrush />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardTab />} />
            <Route path="domain-overview" element={<DomainOverviewTab />} />
            <Route path="position-tracking" element={<PositionTrackingTab />} />
            <Route path="organic-keywords" element={<OrganicKeywordsTab />} />
            <Route path="keyword-magic-tool" element={<KeywordMagicToolTab />} />
            <Route path="competitor-analysis" element={<CompetitorAnalysisTab />} />
            <Route path="backlinks" element={<BacklinksTab />} />
            <Route path="site-health" element={<SiteHealthTab />} />
            <Route path="traffic-analytics" element={<TrafficAnalyticsTab />} />
            <Route path="reports" element={<ReportsTab />} />
            <Route path="activity" element={<ActivityTab />} />
          </Route>
          <Route path="intelligence/semrush" element={<SemrushDashboard />} />
          <Route path="intelligence/semrush/:projectId" element={<Semrush />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardTab />} />
            <Route path="domain-overview" element={<DomainOverviewTab />} />
            <Route path="position-tracking" element={<PositionTrackingTab />} />
            <Route path="organic-keywords" element={<OrganicKeywordsTab />} />
            <Route path="keyword-magic-tool" element={<KeywordMagicToolTab />} />
            <Route path="competitor-analysis" element={<CompetitorAnalysisTab />} />
            <Route path="backlinks" element={<BacklinksTab />} />
            <Route path="site-health" element={<SiteHealthTab />} />
            <Route path="traffic-analytics" element={<TrafficAnalyticsTab />} />
            <Route path="reports" element={<ReportsTab />} />
            <Route path="activity" element={<ActivityTab />} />
          </Route>


          <Route path="ops/time" element={<TimeTracking />} />
          <Route path="ops/resources" element={<Resources />} />
          <Route path="ops/finance" element={<Finance />} />
          <Route path="ops/profitability" element={<Profitability />} />
          <Route path="ops/salespipeline" element={<SalesPipeline />} />
          <Route path="ops/meetings" element={<MeetingsPage />} />
          <Route path="ops/calendar" element={<CalendarPage />} />
          <Route path="ops/deliverables" element={<DeliverablesPage />} />

          <Route path="settings/company" element={<SettingsPage />} />
          <Route path="settings/marketplace" element={<Marketplace />} />
          <Route path="settings/users" element={<PlaceholderPage title="User Settings" description="Manage user preferences." icon={Users} />} />
          <Route path="settings/roles" element={<PlaceholderPage title="Roles & Permissions" description="Define role-based access control." icon={Shield} />} />
          <Route path="settings/integrations" element={<PlaceholderPage title="Integrations" description="Connect third-party apps and APIs." icon={Zap} />} />
          <Route path="settings/notifications" element={<PlaceholderPage title="Notifications" description="Configure email and in-app alerts." icon={Bell} />} />
          <Route path="settings/billing" element={<PlaceholderPage title="Billing" description="Manage subscription plans and payment methods." icon={CreditCard} />} />
          <Route path="settings/audit" element={<PlaceholderPage title="Audit Logs" description="Review system activity and security events." icon={Activity} />} />

          {/* HRMS Routes (Commander Admin) */}
          <Route path="hrms/staff" element={<EktaHrStaffPage />} />
          <Route path="hrms/attendance" element={<EktaHrAttendanceModulePage />} />
          <Route path="hrms/performance" element={<PerformancePage />} />
          <Route path="hrms/performance/history/:userId?" element={<PerformancePage />} />
          <Route path="hrms/performance/self-assessment" element={<SelfAssessmentForm />} />
          <Route path="hrms/daily-reports" element={<DailyReports />} />
          <Route path="workspace/seo-panel/*" element={<SEOPanel />} />
        </Route>
      </Route>

      {/* Agency Routes */}
      <Route element={<ProtectedRoute allowedRoles={['supreme_super_admin', 'superadmin', 'agency_super_admin', 'agency_manager', 'agency']} />}>
        <Route path="/agency" element={<AgencyLayout />}>
          <Route index element={<Navigate to={role === 'agency_super_admin' ? "/agency/admin-overview" : "/agency/overview"} replace />} />
          <Route path="admin-overview" element={<AgencyAdminDashboardTab />} />
          <Route path="overview" element={<OverviewTab />} />
          <Route path="clients" element={<ClientsTab />} />
          <Route path="performance" element={<AgencyPerformanceTab />} />
          <Route path="tasks" element={<AgencyTasksTab />} />
          <Route path="billing" element={<AgencyBillingTab />} />
          <Route path="reports" element={<Reports />} />
          <Route path="workspace/reports" element={<Reports />} />
          <Route path="intelligence/reporting" element={<Reports />} />
          <Route path="settings" element={role === 'agency_super_admin' ? <ErrorBoundary><AgencySettingsTab /></ErrorBoundary> : <ErrorBoundary><SettingsPage /></ErrorBoundary>} />
          <Route path="users" element={<AgencyUsersTab />} />
          <Route path="support" element={<AgencySupportTab />} />
          
          {/* Agency Manager Dynamic Modules */}
          <Route element={<ProtectedRoute allowedRoles={['agency_manager', 'agency']} />}>
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="marketplace/seo/*" element={<Marketplace />} />
            <Route path="marketplace/*" element={<Marketplace />} />
          </Route>
          <Route path="sla" element={<SLA />} />
          <Route path="strategy" element={<Strategy />} />
          <Route path="seo" element={<Navigate to="/agency/marketplace/seo/dashboard" replace />} />
          <Route path="seo/*" element={<AgencySeoRedirect />} />
          <Route path="content" element={<Content />} />
          <Route path="ai-studio" element={<AIStudio />} />
          <Route path="social-media" element={<CampaignScheduledPage />} />
          <Route path="performance-ads" element={<PerformanceAds />} />
          <Route path="crm" element={<CRM />} />
          <Route path="automation" element={<Automation />} />
          <Route path="website/*" element={<WebsiteBuilder />} />
          <Route path="website/:websiteId/pages/:pageId/edit" element={<BuilderRouteWrapper />} />
          <Route path="website/:websiteId/blogs/:blogId/posts/:postId/edit" element={<BlogPostBuilderRouteWrapper />} />
          <Route path="chatgpt" element={<ClientChatGPTPage />} />
          <Route path="claude" element={<ClaudeChatPage />} />
          <Route path="canva" element={<ClientCanvaPage />} />
          {/* <Route path="benchmarks" element={<Benchmarks />} /> */}
          <Route path="analytics" element={<Analytics />} />
          <Route path="seo-aeo-geo" element={<SemrushDashboard />} />
          <Route path="seo-aeo-geo/:projectId" element={<Semrush />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardTab />} />
            <Route path="domain-overview" element={<DomainOverviewTab />} />
            <Route path="position-tracking" element={<PositionTrackingTab />} />
            <Route path="organic-keywords" element={<OrganicKeywordsTab />} />
            <Route path="keyword-magic-tool" element={<KeywordMagicToolTab />} />
            <Route path="competitor-analysis" element={<CompetitorAnalysisTab />} />
            <Route path="backlinks" element={<BacklinksTab />} />
            <Route path="site-health" element={<SiteHealthTab />} />
            <Route path="traffic-analytics" element={<TrafficAnalyticsTab />} />
            <Route path="reports" element={<ReportsTab />} />
            <Route path="activity" element={<ActivityTab />} />
          </Route>
          <Route path="master-items" element={<MasterItemsList />} />
          <Route path="master-items/new" element={<MasterItemForm />} />
          <Route path="master-items/:id" element={<MasterItemForm />} />
          <Route path="proposals" element={<ProposalsList />} />
          <Route path="proposals/new" element={<ProposalForm />} />
          <Route path="proposals/:id" element={<ProposalForm />} />
          <Route path="proposals/:id/view" element={<ProposalViewPage />} />
          <Route path="invoices" element={<InvoicesList />} />
          <Route path="invoices/new" element={<InvoiceForm />} />
          <Route path="invoices/:id" element={<InvoiceForm />} />
          <Route path="invoices/:id/view" element={<InvoiceViewPage />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/new" element={<ProjectForm />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="projects/:id/edit" element={<ProjectForm />} />
          <Route path="workspace/tasks" element={<TasksPage />} />
          <Route path="workspace/tasks/new" element={<TaskForm />} />
          <Route path="workspace/tasks/:id/edit" element={<TaskForm />} />
          <Route path="workspace/tasks/analytics" element={<TaskAnalyticsPage />} />
          <Route path="workspace/tasks/coordinator" element={<CoordinatorTasks />} />
          <Route path="time" element={<TimeTracking />} />
          <Route path="meetings" element={<MeetingsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="deliverables" element={<DeliverablesPage />} />
          <Route path="salespipeline" element={<SalesPipeline />} />
          <Route path="accounts/transactions" element={<TransactionsPage />} />
          <Route path="accounts/expenses" element={<ExpenseManagementPage />} />
          <Route path="accounts/campaign-expenses" element={<CampaignExpensesList />} />
          <Route path="accounts/campaign-expenses/new" element={<CampaignExpensesForm />} />
          <Route path="accounts/campaign-expenses/:id" element={<CampaignExpensesView />} />
          <Route path="accounts/sales-tracking" element={<SalesTrackingPageEnhanced />} />
          <Route path="accounts/pl-analytics" element={<PLDashboard />} />
          
          {/* HRMS Routes (Agency Manager) */}
          <Route path="hrms/staff" element={<EktaHrStaffPage />} />
          <Route path="hrms/attendance" element={<EktaHrAttendanceModulePage />} />
          <Route path="hrms/performance" element={<PerformancePage />} />
          <Route path="hrms/performance/history/:userId?" element={<PerformancePage />} />
          <Route path="hrms/performance/self-assessment" element={<SelfAssessmentForm />} />
          <Route path="hrms/daily-reports" element={<DailyReports />} />
          <Route path="workspace/seo-panel/*" element={<SEOPanel />} />
        </Route>
      </Route>

      {/* Client Routes */}
      <Route element={<ProtectedRoute allowedRoles={['supreme_super_admin', 'superadmin', 'agency_client', 'brand_super_admin', 'brand_manager', 'brand_admin', 'brand_team_user', 'client', 'user']} />}>
        <Route path="/client" element={<ClientLayout />}>
          <Route index element={<Navigate to="/client/dashboard" replace />} />
          <Route path="users" element={<BrandUsersTab />} />
          <Route path="billing" element={<BillingTab />} />
          
          <Route path="dashboard" element={<ClientDashboardTab />} />
          
          {/* Brand Admin / Manager Additional Modules */}
          <Route path="clients/sla" element={<SLA />} />
          {role !== 'brand_manager' && (
            <Route path="clients/portal" element={<PortalSettings />} />
          )}

          <Route path="workspace/strategy" element={<Strategy />} />
          <Route path="workspace/seo/*" element={<MarketplaceSEO />} />
          <Route path="workspace/seo" element={<MarketplaceSEO />} />
          <Route path="workspace/content" element={<Content />} />
          <Route path="workspace/aistudio" element={<AIStudio />} />
          <Route path="workspace/social" element={<CampaignScheduledPage />} />
          <Route path="workspace/ads" element={<PerformanceAds />} />
          <Route path="workspace/crm" element={<CRM />} />
          <Route path="workspace/automation" element={<Automation />} />
          <Route path="workspace/tasks" element={<TasksPage />} />
          <Route path="workspace/tasks/new" element={<TaskForm />} />
          <Route path="workspace/tasks/:id/edit" element={<TaskForm />} />
          <Route path="workspace/tasks/analytics" element={<TaskAnalyticsPage />} />
          <Route path="workspace/tasks/coordinator" element={<CoordinatorTasks />} />
          <Route path="workspace/projects" element={<ProjectList />} />
          <Route path="workspace/projects/new" element={<ProjectForm />} />
          <Route path="workspace/projects/:id" element={<ProjectDetail />} />
          <Route path="workspace/projects/:id/edit" element={<ProjectForm />} />
          <Route path="workspace/master-items" element={<MasterItemsList />} />
          <Route path="workspace/master-items/new" element={<MasterItemForm />} />
          <Route path="workspace/master-items/:id" element={<MasterItemForm />} />
          <Route path="workspace/proposals" element={<ProposalsList />} />
          <Route path="workspace/proposals/new" element={<ProposalForm />} />
          <Route path="workspace/proposals/:id" element={<ProposalForm />} />
          <Route path="workspace/proposals/:id/view" element={<ProposalViewPage />} />
          <Route path="workspace/invoices" element={<InvoicesList />} />
          <Route path="workspace/invoices/new" element={<InvoiceForm />} />
          <Route path="workspace/invoices/:id" element={<InvoiceForm />} />
          <Route path="workspace/invoices/:id/view" element={<InvoiceViewPage />} />
          
          <Route path="workspace/website/*" element={<WebsiteBuilder />} />
          <Route path="workspace/website/:websiteId/pages/:pageId/edit" element={<BuilderRouteWrapper />} />
          <Route path="workspace/website/:websiteId/blogs/:blogId/posts/:postId/edit" element={<BlogPostBuilderRouteWrapper />} />

          <Route path="intelligence/analytics" element={<Analytics />} />
          <Route path="intelligence/mos" element={<MOSScore />} />
          <Route path="intelligence/copilot" element={<AICopilot />} />
          <Route path="intelligence/chatgpt" element={<ClientChatGPTPage />} />
          <Route path="intelligence/claude" element={<ClaudeChatPage />} />
          <Route path="intelligence/canva" element={<ClientCanvaPage />} />
          <Route path="intelligence/agents" element={<AIAgents />} />
          {/* <Route path="intelligence/benchmarks" element={<Benchmarks />} /> */}
          <Route path="intelligence/reporting" element={<Reports />} />
          <Route path="intelligence/seo" element={<SeoIntelligence />} />
          <Route path="intelligence/seo-aeo-geo" element={<SemrushDashboard />} />
          <Route path="intelligence/seo-aeo-geo/:projectId" element={<Semrush />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardTab />} />
            <Route path="domain-overview" element={<DomainOverviewTab />} />
            <Route path="position-tracking" element={<PositionTrackingTab />} />
            <Route path="organic-keywords" element={<OrganicKeywordsTab />} />
            <Route path="keyword-magic-tool" element={<KeywordMagicToolTab />} />
            <Route path="competitor-analysis" element={<CompetitorAnalysisTab />} />
            <Route path="backlinks" element={<BacklinksTab />} />
            <Route path="site-health" element={<SiteHealthTab />} />
            <Route path="traffic-analytics" element={<TrafficAnalyticsTab />} />
            <Route path="reports" element={<ReportsTab />} />
            <Route path="activity" element={<ActivityTab />} />
          </Route>


          <Route path="ops/time" element={<TimeTracking />} />
          <Route path="ops/resources" element={<Resources />} />
          <Route path="ops/finance" element={<Finance />} />
          <Route path="ops/profitability" element={<Profitability />} />
          <Route path="ops/salespipeline" element={<SalesPipeline />} />

          <Route path="settings/company" element={
            role === 'brand_super_admin' ? <BrandSettingsTab /> : 
            (role === 'agency_client' || Boolean(user?.brandId)) ? <ClientSettingsTab /> : 
            <SettingsPage />
          } />
          
          <Route element={<ProtectedRoute allowedRoles={['agency_client', 'user', 'client']} />}>
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="marketplace/seo/*" element={<Marketplace />} />
            <Route path="marketplace/*" element={<Marketplace />} />
          </Route>
          
          <Route path="settings/users" element={<PlaceholderPage title="User Settings" description="Manage user preferences." icon={Users} />} />
          <Route path="settings/roles" element={<PlaceholderPage title="Roles & Permissions" description="Define role-based access control." icon={Shield} />} />
          <Route path="settings/integrations" element={<PlaceholderPage title="Integrations" description="Connect third-party apps and APIs." icon={Zap} />} />
          <Route path="settings/notifications" element={<PlaceholderPage title="Notifications" description="Configure email and in-app alerts." icon={Bell} />} />
          <Route path="settings/billing" element={<PlaceholderPage title="Billing" description="Manage subscription plans and payment methods." icon={CreditCard} />} />
          <Route path="settings/audit" element={<PlaceholderPage title="Audit Logs" description="Review system activity and security events." icon={Activity} />} />
          <Route path="performance" element={<ClientPerformanceTab />} />
          <Route path="leads" element={<ClientLeadsTab />} />
          <Route path="website/*" element={<ClientWebsiteTab />} />
          <Route path="team" element={<TeamTab />} />
          <Route path="tasks" element={<ClientTasksTab />} />

          <Route path="billing" element={<ClientBillingTab />} />
          <Route path="reports" element={<ClientReportsRouteGuard />} />
          <Route path="support" element={<ClientSupportTab />} />
          <Route path="meetings" element={<MeetingsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="deliverables" element={<DeliverablesPage />} />
          
          {/* HRMS Routes (Brand Manager) */}
          <Route path="hrms/staff" element={<EktaHrStaffPage />} />
          <Route path="hrms/attendance" element={<EktaHrAttendanceModulePage />} />
          <Route path="hrms/performance" element={<PerformancePage />} />
          <Route path="hrms/performance/history/:userId?" element={<PerformancePage />} />
          <Route path="hrms/performance/self-assessment" element={<SelfAssessmentForm />} />
          <Route path="hrms/daily-reports" element={<DailyReports />} />
        </Route>
      </Route>

      {/* User Routes */}
      <Route path="/user" element={
        <ProtectedRoute />
      }>
        <Route element={<UserLayoutRouteGuard />}>
          <Route index element={<Navigate to="/user/dashboard" replace />} />
          <Route path="dashboard" element={<UserDashboardTab />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/new" element={<TaskForm />} />
          <Route path="tasks/:id/edit" element={<TaskForm />} />
          <Route path="workspace/tasks" element={<TasksPage />} />
          <Route path="workspace/tasks/new" element={<TaskForm />} />
          <Route path="workspace/tasks/:id/edit" element={<TaskForm />} />
          <Route path="workspace/tasks/analytics" element={<TaskAnalyticsPage />} />
          <Route path="workspace/tasks/coordinator" element={<CoordinatorTasks />} />
          
          <Route path="clients" element={<ClientsTab />} />
          <Route path="sla" element={<SLA />} />
          
          {/* Dynamically Granted Modules */}
          <Route path="workspace/strategy" element={<Strategy />} />
          <Route path="workspace/seo/*" element={<MarketplaceSEO />} />
          <Route path="workspace/seo" element={<MarketplaceSEO />} />
          <Route path="workspace/content" element={<Content />} />
          <Route path="workspace/aistudio" element={<AIStudio />} />
          <Route path="workspace/social" element={<CampaignScheduledPage />} />
          <Route path="workspace/ads" element={<PerformanceAds />} />
          <Route path="workspace/crm" element={<CRM />} />
          <Route path="workspace/automation" element={<Automation />} />
          <Route path="workspace/master-items" element={<MasterItemsList />} />
          <Route path="workspace/master-items/new" element={<MasterItemForm />} />
          <Route path="workspace/master-items/:id" element={<MasterItemForm />} />
          <Route path="workspace/proposals" element={<ProposalsList />} />
          <Route path="workspace/proposals/new" element={<ProposalForm />} />
          <Route path="workspace/proposals/:id" element={<ProposalForm />} />
          <Route path="workspace/proposals/:id/view" element={<ProposalViewPage />} />
          <Route path="workspace/invoices" element={<InvoicesList />} />
          <Route path="workspace/invoices/new" element={<InvoiceForm />} />
          <Route path="workspace/invoices/:id" element={<InvoiceForm />} />
          <Route path="workspace/invoices/:id/view" element={<InvoiceViewPage />} />
          <Route path="workspace/projects" element={<ProjectList />} />
          <Route path="workspace/projects/new" element={<ProjectForm />} />
          <Route path="workspace/projects/:id" element={<ProjectDetail />} />
          <Route path="workspace/projects/:id/edit" element={<ProjectForm />} />
          <Route path="workspace/website/*" element={<WebsiteBuilder />} />
          <Route path="workspace/website/:websiteId/pages/:pageId/edit" element={<BuilderRouteWrapper />} />
          <Route path="workspace/website/:websiteId/blogs/:blogId/posts/:postId/edit" element={<BlogPostBuilderRouteWrapper />} />
          <Route path="workspace/meetings" element={<MeetingsPage />} />
          <Route path="workspace/calendar" element={<CalendarPage />} />
          <Route path="workspace/deliverables" element={<DeliverablesPage />} />
          <Route path="workspace/salespipeline" element={<SalesPipeline />} />
          <Route path="time" element={<TimeTracking />} />
          <Route path="ops/time" element={<TimeTracking />} />
          
          {/* HRMS Modules for Employees */}
          <Route path="hrms/performance" element={<PerformancePage />} />
          <Route path="hrms/performance/history/:userId?" element={<PerformancePage />} />
          <Route path="hrms/performance/self-assessment" element={<SelfAssessmentForm />} />
          <Route path="hrms/daily-reports" element={<DailyReports />} />
          <Route path="workspace/seo-panel/*" element={<SEOPanel />} />
          
          {/* Keep legacy route temporarily for fallback if needed */}
          <Route path="performance" element={<PerformancePage />} />
          <Route path="performance/history/:userId?" element={<PerformancePage />} />
          <Route path="performance/self-assessment" element={<SelfAssessmentForm />} />
          <Route path="intelligence/analytics" element={<Analytics />} />
          <Route path="intelligence/mos" element={<MOSScore />} />
          <Route path="intelligence/agents" element={<AIAgents />} />
          <Route path="intelligence/reports" element={<Reports />} />
          <Route path="workspace/reports" element={<Reports />} />
          <Route path="intelligence/chatgpt" element={<ClientChatGPTPage />} />
          <Route path="intelligence/claude" element={<ClaudeChatPage />} />
          <Route path="intelligence/canva" element={<ClientCanvaPage />} />
          <Route path="intelligence/seo-aeo-geo" element={<SemrushDashboard />} />
          <Route path="intelligence/seo-aeo-geo/:projectId" element={<Semrush />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardTab />} />
            <Route path="domain-overview" element={<DomainOverviewTab />} />
            <Route path="position-tracking" element={<PositionTrackingTab />} />
            <Route path="organic-keywords" element={<OrganicKeywordsTab />} />
            <Route path="keyword-magic-tool" element={<KeywordMagicToolTab />} />
            <Route path="competitor-analysis" element={<CompetitorAnalysisTab />} />
            <Route path="backlinks" element={<BacklinksTab />} />
            <Route path="site-health" element={<SiteHealthTab />} />
            <Route path="traffic-analytics" element={<TrafficAnalyticsTab />} />
            <Route path="reports" element={<ReportsTab />} />
            <Route path="activity" element={<ActivityTab />} />
          </Route>
          
          <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
        </Route>
      </Route>



      {/* OAuth Redirect Handler for Social Media */}
      <Route path="/campaigns-scheduled" element={<OAuthRedirectHandler />} />

      {/* Catch all - Redirect to sign in if no role, otherwise to respective dashboard */}
      <Route path="*" element={<ProtectedRoute allowedRoles={['supreme_super_admin', 'superadmin', 'commander_admin', 'agency_super_admin', 'agency_manager', 'agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user', 'agency', 'client']} />} />
    </Routes>
    </Suspense>
  );
};

const isPlatformDomain = (hostname) => {
  if (!hostname) return true;
  const host = hostname.toLowerCase();
  const reserved = [
    'localhost',
    '127.0.0.1',
    'tunepath.askeva.io',
    'm1.workforce.themilabs.com'
  ];
  return reserved.some(plat => host === plat || host.endsWith('.' + plat));
};

function App() {
  const currentHostname = window.location.hostname;

  // Render Custom Domain Website directly if visiting via a custom domain
  if (!isPlatformDomain(currentHostname)) {
    return <CustomDomainWebsiteViewer />;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const oauthStatus = searchParams.get("facebook_oauth");
  const reason = searchParams.get("reason");

  // Intercept popup OAuth redirects so the full app doesn't load inside the popup
  if (oauthStatus && window.opener && window.opener !== window) {
    window.opener.postMessage({ type: 'FACEBOOK_OAUTH_SUCCESS', oauthStatus, reason }, '*');
    window.close();
    return null;
  }

  return (
    <Router>
      <ScrollToTop />
      <AuthProvider>
        <ClientProvider>
          <FeatureProvider>
            <LayoutProvider>
              <AppRoutes />
            </LayoutProvider>
          </FeatureProvider>
        </ClientProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;