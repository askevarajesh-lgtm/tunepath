import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { FeatureProvider } from './contexts/FeatureContext';
import SignIn from './pages/SignIn/SignIn';
import ForgotPassword from './pages/SignIn/ForgotPassword';
import { ClientProvider } from './contexts/ClientContext';

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
import Dashboard from './pages/Dashboard/Dashboard';
import CRM from './pages/CRM/CRM';
import WebsiteBuilder from './pages/WebsiteBuilder/WebsiteBuilder';
import BuilderRouteWrapper from './pages/WebsiteBuilder/tabs/BuilderRouteWrapper';
import BlogPostBuilderRouteWrapper from './pages/WebsiteBuilder/tabs/BlogPostBuilderRouteWrapper';
import FormEmbedView from './pages/WebsiteBuilder/tabs/FormEmbedView';
import BlogEmbedView from './pages/WebsiteBuilder/tabs/BlogEmbedView';
import BlogPostEmbedView from './pages/WebsiteBuilder/tabs/BlogPostEmbedView';
import QREmbedView from './pages/WebsiteBuilder/tabs/QREmbedView';
import WebsitePreviewView from './pages/WebsiteBuilder/tabs/WebsitePreviewView';
import CustomDomainWebsiteViewer from './pages/WebsiteBuilder/tabs/CustomDomainWebsiteViewer';
import BlogPostPreviewView from './pages/WebsiteBuilder/tabs/BlogPostPreviewView';
import Strategy from './pages/Strategy/Strategy';
import SeoIntelligence from './pages/SeoIntelligence/SeoIntelligence';
import SemrushDashboard from './pages/Semrush/SemrushDashboard';
import Semrush from './pages/Semrush/Semrush';
import DashboardTab from './pages/Semrush/components/DashboardTab';
import PositionTrackingTab from './pages/Semrush/components/PositionTrackingTab';
import ActivityTab from './pages/Semrush/components/ActivityTab';
import DomainOverviewTab from './pages/Semrush/components/DomainOverviewTab';
import OrganicKeywordsTab from './pages/Semrush/components/OrganicKeywordsTab';
import BacklinksTab from './pages/Semrush/components/BacklinksTab';
import SiteHealthTab from './pages/Semrush/components/SiteHealthTab';
import KeywordMagicToolTab from './pages/Semrush/components/KeywordMagicToolTab';
import CompetitorAnalysisTab from './pages/Semrush/components/CompetitorAnalysisTab';
import TrafficAnalyticsTab from './pages/Semrush/components/TrafficAnalyticsTab';
import ReportsTab from './pages/Semrush/components/ReportsTab';
import Content from './pages/Content/Content';
import AIStudio from './pages/AIStudio/AIStudio';
import CampaignScheduledPage from './pages/Campaign Scheduled/CampaignScheduledPage';
import PerformanceAds from './pages/PerformanceAds/PerformanceAds';
import Accounts from './pages/Accounts/Accounts';
import SLA from './pages/SLA/SLA';
import PortalSettings from './pages/PortalSettings/PortalSettings';
import Analytics from './pages/Analytics/Analytics';
import { ErrorBoundary } from "./components/ErrorBoundary";
import Automation from './pages/Automation/Automation';
import TasksPage from './pages/Tasks/TasksPage';
import TaskForm from './pages/Tasks/TaskForm';
import TaskAnalyticsPage from './pages/Tasks/TaskAnalyticsPage';
import CoordinatorTasks from './pages/Tasks/CoordinatorTasks';
import ProjectList from './pages/projects/ProjectList';
import ProjectForm from './pages/projects/ProjectForm';
import ProjectDetail from './pages/projects/ProjectDetail';
import MasterItemsList from './pages/MasterItems/MasterItemsList';
import MasterItemForm from './pages/MasterItems/MasterItemForm';
import ExpenseManagementPage from './pages/expenses/ExpenseManagementPage';
import CampaignExpensesList from './pages/campaign-expenses/CampaignList';
import CampaignExpensesForm from './pages/campaign-expenses/CampaignForm';
import CampaignExpensesView from './pages/campaign-expenses/CampaignView';
import ProposalsList from './pages/Proposals/ProposalsList';
import ProposalForm from './pages/Proposals/ProposalForm';
import ProposalViewPage from './pages/Proposals/ProposalViewPage';
import InvoicesList from './pages/Invoices/InvoicesList';
import InvoiceForm from './pages/Invoices/InvoiceForm';
import InvoiceViewPage from './pages/Invoices/InvoiceViewPage';
import MeetingsPage from './pages/Meetings/MeetingsPage';
import CalendarPage from './pages/Calendar/CalendarPage';
import DeliverablesPage from './pages/Deliverables/DeliverablesPage';
import PLDashboard from './pages/pl-analytics/PLDashboard';

import Reports from './pages/Reports/Reports';

import TimeTracking from './pages/TimeTracking/TimeTracking';
import Resources from './pages/Resources/Resources';
import MOSScore from './pages/MOSScore/MOSScore';
import Finance from './pages/Finance/Finance';
import Profitability from './pages/Profitability/Profitability';
import SalesPipeline from './pages/SalesPipeline/SalesPipeline';
import SettingsPage from './pages/Settings/Settings';
import ClientSettingsTab from './pages/ClientPortal/tabs/ClientSettingsTab';
import AIAgents from './pages/AIAgents/AIAgents';
import AICopilot from './pages/AICopilot/AICopilot';
import Benchmarks from './pages/Benchmarks/Benchmarks';
import Marketplace from './pages/Marketplace/Marketplace';
import MarketplaceSEO from './pages/Marketplace/SEO/MarketplaceSEO';
import ClientChatGPTPage from './pages/ClientChatGPTPage/ClientChatGPTPage';
import ClientCanvaPage from './pages/ClientCanvaPage/ClientCanvaPage';

// Agency Portal Tabs
import OverviewTab from './pages/AgencyPortal/tabs/OverviewTab';
import AgencyAdminDashboardTab from './pages/AgencyPortal/tabs/AgencyAdminDashboardTab';
import ClientsTab from './pages/AgencyPortal/tabs/ClientsTab';
import AgencyPerformanceTab from './pages/AgencyPortal/tabs/PerformanceTab';
import AgencyTasksTab from './pages/AgencyPortal/tabs/TasksTab';
import AgencyBillingTab from './pages/AgencyPortal/tabs/BillingTab';
import AgencySupportTab from './pages/AgencyPortal/tabs/SupportTab';
import AgencyReportsTab from './pages/AgencyPortal/tabs/AgencyReportsTab';
import AgencySettingsTab from './pages/AgencyPortal/tabs/AgencySettingsTab';
import AgencyUsersTab from './pages/AgencyPortal/tabs/AgencyUsersTab';

// Client Portal Tabs
import ClientDashboardTab from './pages/ClientPortal/tabs/DashboardTab';
import BrandUsersTab from './pages/ClientPortal/tabs/BrandUsersTab';
import BillingTab from './pages/ClientPortal/tabs/BillingTab';
import ClientPerformanceTab from './pages/ClientPortal/tabs/MyPerformanceTab';
import ClientLeadsTab from './pages/ClientPortal/tabs/LeadsTab';
import ClientTasksTab from './pages/ClientPortal/tabs/TasksTab';
import BrandSettingsTab from './pages/ClientPortal/tabs/BrandSettingsTab';

import ClientBillingTab from './pages/ClientPortal/tabs/BillingTab';
import ClientSupportTab from './pages/ClientPortal/tabs/SupportTab';
import ClientWebsiteTab from './pages/ClientPortal/tabs/ClientWebsiteTab';
import TeamTab from './pages/ClientPortal/tabs/TeamTab';
import ClientReportsTab from './pages/ClientPortal/tabs/ReportsTab';

// User Portal Tabs
import UserDashboardTab from './pages/UserPortal/DashboardTab';
import UserSettingsTab from './pages/UserPortal/SettingsTab';

// Super Admin Layout and Pages
import SuperAdminLayout from './layouts/SuperAdminLayout';
import SuperAdminDashboard from './pages/SuperAdmin/Dashboard';
import SuperAdminCompanies from './pages/SuperAdmin/Companies';
import SuperAdminSubscriptions from './pages/SuperAdmin/Subscriptions';
import SuperAdminIntegrations from './pages/SuperAdmin/Integrations';
import SuperAdminAdmins from './pages/SuperAdmin/Admins';
import SuperAdminSettings from './pages/SuperAdmin/Settings/SuperAdminSettings';

// Ekta HR / HRMS Pages (Commander Admin)
import EktaHrStaffPage from './pages/integrations/EktaHrStaffPage';
import EktaHrAttendanceModulePage from './pages/integrations/EktaHrAttendanceModulePage';
import DailyReports from './pages/dailyreport/DailyReports';

import PerformancePage from './pages/performance/PerformancePage';
import SelfAssessmentForm from './pages/performance/SelfAssessmentForm';
import TransactionsPage from './pages/transactions/TransactionsPage';
import SalesTrackingPageEnhanced from './pages/sales/SalesTrackingPageEnhanced';
import SEOPanel from './pages/seo-panel/SEOPanel';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function OAuthRedirectHandler() {
  const { search } = useLocation();
  const { role, user } = useAuth();
  
  if (!role) {
    return <Navigate to="/signin" replace />;
  }

  let target = "/dashboard";
  if (['supreme_super_admin', 'superadmin', 'commander_admin'].includes(role)) {
      target = "/workspace/social";
  } else if (['agency_super_admin', 'agency_manager', 'agency'].includes(role)) {
      target = "/agency/social-media";
  } else if (['agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user', 'client'].includes(role) || (role === 'user' && user?.brandId)) {
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
  
  const isClientUser = role === 'user' && user?.brandId;
  const matchRole = isClientUser ? 'client_user' : role;

  if (allowedRoles && !allowedRoles.includes(matchRole) && !allowedRoles.includes(role)) {
    if (['supreme_super_admin', 'superadmin'].includes(role)) return <Navigate to="/superadmin/dashboard" replace />;
    if (role === 'commander_admin') return <Navigate to="/dashboard" replace />;
    if (role === 'agency_super_admin') return <Navigate to="/agency/admin-overview" replace />;
    if (['agency_manager', 'agency'].includes(role)) return <Navigate to="/agency/overview" replace />;
    if (['brand_super_admin', 'brand_manager', 'agency_client', 'brand_team_user', 'client'].includes(role) || isClientUser) return <Navigate to="/client/dashboard" replace />;
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
  if (['agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user', 'client'].includes(role) || (role === 'user' && user?.brandId)) {
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

const AppRoutes = () => {
  const { role, user } = useAuth();
  
  return (
    <Routes>
      {/* Top-level universal SEO route */}
      <Route path="/seo" element={<SeoRedirect />} />
      <Route path="/seo/*" element={<SeoRedirect />} />

      <Route path="/signin" element={role ? (
        <Navigate to={
          ['supreme_super_admin', 'superadmin'].includes(role) ? '/superadmin/dashboard' : 
          role === 'commander_admin' ? '/dashboard' : 
          role === 'agency_super_admin' ? '/agency/admin-overview' :
          ['agency_manager', 'agency'].includes(role) ? '/agency/overview' : 
          (['agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user', 'client'].includes(role) || (role === 'user' && user?.brandId)) ? '/client/dashboard' :
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

          <Route path="intelligence/analytics" element={<Analytics />} />
          <Route path="intelligence/mos" element={<MOSScore />} />
          <Route path="intelligence/copilot" element={<AICopilot />} />
          <Route path="intelligence/chatgpt" element={<ClientChatGPTPage />} />
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
          <Route path="reports" element={<AgencyReportsTab />} />
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
      <Route element={<ProtectedRoute allowedRoles={['supreme_super_admin', 'superadmin', 'agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user', 'client', 'client_user']} />}>
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
            role === 'agency_client' ? <ClientSettingsTab /> : 
            <SettingsPage />
          } />
          
          <Route element={<ProtectedRoute allowedRoles={['agency_client']} />}>
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
          <Route path="reports" element={<ClientReportsTab />} />
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
        <Route element={<UserLayout />}>
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
          <Route path="intelligence/chatgpt" element={<ClientChatGPTPage />} />
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