import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Award,
  BarChart2,
  BookOpen,
  Bot,
  Briefcase,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Cpu,
  CreditCard,
  DollarSign,
  FileText,
  GitMerge,
  Globe,
  Globe2,
  Hash,
  HelpCircle,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Library,
  LineChart,
  MessageCircle,
  Palette,
  PieChart,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Swords,
  Target,
  TrendingUp,
  Users,
  Zap,
  ClipboardList
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFeatures } from '../contexts/FeatureContext';
import PortalSidebar from './PortalSidebar';
import { sidebarApi } from '../api/sidebarApi';
import { slaApi } from '../api/slaApi';

const ClientSidebar = ({ collapsed, setCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, user } = useAuth();
  const { features } = useFeatures();
  
  const [slaCount, setSlaCount] = React.useState(0);

  React.useEffect(() => {
    const fetchSlaCount = async () => {
      try {
        const res = await slaApi.getSlaDashboardStats();
        if (res && res.data && res.data.stats) {
          const { total, resolved } = res.data.stats;
          setSlaCount(total - resolved);
        }
      } catch (error) {
        console.error('Failed to fetch SLA stats for sidebar', error);
      }
    };
    fetchSlaCount();
  }, []);
  
  const hasFeature = (featureName) => {
    return user && user.features && user.features.includes(featureName);
  };

  const hasPermission = (moduleGroup, moduleId) => {
    if (!user) return false;
    if (['brand_super_admin', 'agency_super_admin', 'commander_admin', 'supreme_super_admin'].includes(role)) return true;
    if (user.permissions && Object.keys(user.permissions).length > 0) {
      const perms = user.permissions[`${moduleGroup}-${moduleId}`];
      if (!perms) return false;
      return perms.Read || perms.View || perms.All || perms.Create || perms.Edit;
    }
    return true; 
  };
  
  const [peopleCount, setPeopleCount] = React.useState('...');
  const [leadsCount, setLeadsCount] = React.useState('...');
  const [pipelineCount, setPipelineCount] = React.useState('...');
  const [mosScore, setMosScore] = React.useState('...');

  React.useEffect(() => {
    const fetchSidebarCounts = async () => {
      try {
        const res = await sidebarApi.getCounts();
        if (res?.data?.success) {
          const { people, leads, pipeline, mosScore: mos } = res.data.data;
          setPeopleCount(people.toString());
          setLeadsCount(leads.toString());
          setPipelineCount(pipeline.toString());
          setMosScore(mos.toString());
        }
      } catch (error) {
        console.error('Failed to fetch dynamic sidebar counts', error);
      }
    };
    fetchSidebarCounts();
  }, []);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  };

  const dynamicBrandName = user?.brandName || user?.companyName || 'Prestige Estates';
  const dynamicBrandInitials = dynamicBrandName.substring(0, 2).toUpperCase();

  const getIcon = (IconCmp) => <IconCmp size={18} strokeWidth={2} />;

  const getBadge = (text, type = 'neutral') => (
    <span className={`sidebar-menu-badge sidebar-menu-badge--${type}`}>{text}</span>
  );

  const getLabel = (text, badgeText, badgeType) => {
    if (!badgeText) return text;
    return (
      <div className="sidebar-menu-label">
        <span>{text}</span>
        {getBadge(badgeText, badgeType)}
      </div>
    );
  };

  let allMenuItems = [
    {
      key: '/client/dashboard',
      icon: <LayoutDashboard size={20} />,
      label: 'Dashboard',
    },
  ];



  const workspaceChildren = [];

  const buildMarketplaceMenuItem = () => ({
    key: '/client/marketplace',
    icon: getIcon(ShoppingCart),
    label: 'Marketplace',
  });

  if (['brand_super_admin', 'brand_manager', 'user', 'brand_team_user', 'client_user'].includes(role)) {
    workspaceChildren.push({ key: '/client/workspace/strategy', icon: getIcon(GitMerge), label: 'Strategy', featureId: 'strategy', moduleGroup: 'Workspace', moduleId: 'Strategy' });
    workspaceChildren.push({ key: '/client/workspace/aistudio', icon: getIcon(Bot), label: 'Ai Studio', featureId: 'aistudio', moduleGroup: 'Workspace', moduleId: 'Ai Studio' });
    workspaceChildren.push({ key: '/client/workspace/social', icon: getIcon(MessageCircle), label: 'Social Media', featureId: 'social', moduleGroup: 'Workspace', moduleId: 'Social Media' });
    workspaceChildren.push({ key: '/client/workspace/ads', icon: getIcon(Target), label: 'Performance Ads', featureId: 'ads', moduleGroup: 'Workspace', moduleId: 'Performance Ads' });
    workspaceChildren.push({ key: '/client/workspace/crm', icon: getIcon(LineChart), label: getLabel('CRM & Leads', leadsCount), featureId: 'crm', moduleGroup: 'Workspace', moduleId: 'CRM & Leads' });
    workspaceChildren.push({ key: '/client/workspace/website', icon: getIcon(Globe), label: 'Websites', featureId: 'website', moduleGroup: 'Workspace', moduleId: 'Websites' });
  } else if (role === 'agency_client') {
    workspaceChildren.push({ key: '/client/workspace/strategy', icon: getIcon(GitMerge), label: 'Strategy', featureId: 'strategy', moduleGroup: 'Workspace', moduleId: 'Strategy' });
    workspaceChildren.push({ key: '/client/workspace/aistudio', icon: getIcon(Bot), label: 'Ai Studio', featureId: 'aistudio', moduleGroup: 'Workspace', moduleId: 'Ai Studio' });
    workspaceChildren.push({ key: '/client/workspace/social', icon: getIcon(MessageCircle), label: 'Social Media', featureId: 'social', moduleGroup: 'Workspace', moduleId: 'Social Media' });
    workspaceChildren.push({ key: '/client/workspace/ads', icon: getIcon(Target), label: 'Performance Ads', featureId: 'ads', moduleGroup: 'Workspace', moduleId: 'Performance Ads' });
    workspaceChildren.push({ key: '/client/leads', icon: getIcon(Users), label: 'CRM & Leads', featureId: 'crm', moduleGroup: 'Workspace', moduleId: 'CRM & Leads' });
    workspaceChildren.push({ key: '/client/website', icon: getIcon(Globe), label: 'Websites', featureId: 'website', moduleGroup: 'Workspace', moduleId: 'Websites' });
    workspaceChildren.push(buildMarketplaceMenuItem());
  } else {
    workspaceChildren.push({ key: '/client/leads', icon: getIcon(Users), label: 'CRM & Leads', featureId: 'crm', moduleGroup: 'Workspace', moduleId: 'CRM & Leads' });
    workspaceChildren.push({ key: '/client/website', icon: getIcon(Globe), label: 'Websites', featureId: 'website', moduleGroup: 'Workspace', moduleId: 'Websites' });
  }

  if (workspaceChildren.length > 0) {
    allMenuItems.push({
      key: 'workspace',
      label: 'WORKSPACE',
      icon: getIcon(Briefcase),
      children: workspaceChildren,
    });
  }

  if (['brand_super_admin', 'brand_manager', 'user', 'brand_team_user', 'client_user'].includes(role)) {
    allMenuItems.push({
      key: 'task_management',
      label: 'Task Management',
      icon: getIcon(CheckSquare),
      moduleGroup: 'Workspace',
      moduleId: 'Task Management',
      children: [
        { key: '/client/workspace/tasks', icon: getIcon(CheckSquare), label: 'Tasks' },
        { key: '/client/workspace/tasks/analytics', icon: getIcon(BarChart2), label: 'Task Analytics', moduleGroup: 'Workspace', moduleId: 'Task Analytics' },
        { key: '/client/workspace/tasks/coordinator', icon: getIcon(Users), label: 'Coordinator Tasks', moduleGroup: 'Workspace', moduleId: 'Coordinator Tasks' },
      ]
    });
  }

  const intelligenceChildren = [];
  if (['brand_super_admin', 'brand_manager', 'user', 'brand_team_user', 'client_user'].includes(role)) {
    intelligenceChildren.push({ key: '/client/intelligence/analytics', icon: getIcon(TrendingUp), label: 'Google Analytics', featureId: 'analytics', moduleGroup: 'Intelligence', moduleId: 'Google Analytics' });
    intelligenceChildren.push({ key: '/client/intelligence/chatgpt', icon: getIcon(MessageCircle), label: 'Chatgpt', featureId: 'chatgpt', moduleGroup: 'Intelligence', moduleId: 'ChatGPT' });
    intelligenceChildren.push({ key: '/client/intelligence/canva', icon: getIcon(Palette), label: 'Canva', featureId: 'canva', moduleGroup: 'Intelligence', moduleId: 'Canva' });
    // intelligenceChildren.push({ key: '/client/intelligence/benchmarks', icon: getIcon(Activity), label: 'Benchmark', featureId: 'benchmark', moduleGroup: 'Intelligence', moduleId: 'Benchmarks' });
    // intelligenceChildren.push({ key: '/client/intelligence/reporting', icon: getIcon(FileText), label: 'Reports' });
    intelligenceChildren.push({ key: '/client/intelligence/seo', icon: getIcon(Search), label: 'Seo Intelligence', featureId: 'seo', moduleGroup: 'Intelligence', moduleId: 'Seo Intelligence' });
    intelligenceChildren.push({ key: '/client/intelligence/seo-aeo-geo', icon: getIcon(Search), label: 'SEO/AEO/GEO', featureId: 'seo-aeo-geo', moduleGroup: 'Intelligence', moduleId: 'SEO/AEO/GEO' });
  } else if (role === 'agency_client') {
    intelligenceChildren.push({ key: '/client/intelligence/analytics', icon: getIcon(TrendingUp), label: 'Google Analytics', featureId: 'analytics', moduleGroup: 'Intelligence', moduleId: 'Google Analytics' });
    intelligenceChildren.push({ key: '/client/intelligence/chatgpt', icon: getIcon(MessageCircle), label: 'Chatgpt', featureId: 'chatgpt', moduleGroup: 'Intelligence', moduleId: 'ChatGPT' });
    intelligenceChildren.push({ key: '/client/intelligence/canva', icon: getIcon(Palette), label: 'Canva', featureId: 'canva', moduleGroup: 'Intelligence', moduleId: 'Canva' });
    // intelligenceChildren.push({ key: '/client/intelligence/benchmarks', icon: getIcon(Activity), label: 'Benchmark', featureId: 'benchmark', moduleGroup: 'Intelligence', moduleId: 'Benchmarks' });
    // intelligenceChildren.push({ key: '/client/reports', icon: getIcon(FileText), label: 'Reports' });
    intelligenceChildren.push({ key: '/client/intelligence/seo', icon: getIcon(Search), label: 'Seo Intelligence', featureId: 'seo', moduleGroup: 'Intelligence', moduleId: 'Seo Intelligence' });
    intelligenceChildren.push({ key: '/client/intelligence/seo-aeo-geo', icon: getIcon(Search), label: 'SEO/AEO/GEO', featureId: 'seo-aeo-geo', moduleGroup: 'Intelligence', moduleId: 'SEO/AEO/GEO' });
  } else {
    intelligenceChildren.push({ key: '/client/intelligence/analytics', icon: getIcon(TrendingUp), label: 'Google Analytics', featureId: 'analytics', moduleGroup: 'Intelligence', moduleId: 'Google Analytics' });
    intelligenceChildren.push({ key: '/client/reports', icon: getIcon(FileText), label: 'Reports' });
    intelligenceChildren.push({ key: '/client/intelligence/seo', icon: getIcon(Search), label: 'Seo Intelligence', featureId: 'seo', moduleGroup: 'Intelligence', moduleId: 'Seo Intelligence' });
    intelligenceChildren.push({ key: '/client/intelligence/seo-aeo-geo', icon: getIcon(Search), label: 'SEO/AEO/GEO', featureId: 'seo-aeo-geo', moduleGroup: 'Intelligence', moduleId: 'SEO/AEO/GEO' });
  }

  if (intelligenceChildren.length > 0) {
    allMenuItems.push({
      key: 'intelligence',
      label: 'INTELLIGENCE',
      icon: getIcon(Zap),
      children: intelligenceChildren,
    });
  }

  const opsChildren = [];
  if (role === 'brand_super_admin') {

    opsChildren.push({ key: '/client/ops/time', icon: getIcon(Calendar), label: 'Time Tracking', moduleGroup: 'Agency Ops', moduleId: 'Time Tracking' });
    opsChildren.push({ key: '/client/meetings', icon: getIcon(Calendar), label: 'Meetings', moduleGroup: 'Workspace', moduleId: 'Meetings' });
    opsChildren.push({ key: '/client/calendar', icon: getIcon(Calendar), label: 'Calendar', moduleGroup: 'Workspace', moduleId: 'Calendar' });
  } else if (['brand_manager', 'user', 'brand_team_user', 'client_user'].includes(role)) {

    opsChildren.push({ key: '/client/ops/time', icon: getIcon(Calendar), label: 'Time Tracking', moduleGroup: 'Agency Ops', moduleId: 'Time Tracking' });
    opsChildren.push({ key: '/client/meetings', icon: getIcon(Calendar), label: 'Meetings', moduleGroup: 'Workspace', moduleId: 'Meetings' });
    opsChildren.push({ key: '/client/calendar', icon: getIcon(Calendar), label: 'Calendar', moduleGroup: 'Workspace', moduleId: 'Calendar' });
  } else if (role === 'agency_client') {
    opsChildren.push({ key: '/client/meetings', icon: getIcon(Calendar), label: 'Meetings', moduleGroup: 'Workspace', moduleId: 'Meetings' });
    opsChildren.push({ key: '/client/calendar', icon: getIcon(Calendar), label: 'Calendar', moduleGroup: 'Workspace', moduleId: 'Calendar' });
    opsChildren.push({ key: '/client/deliverables', icon: getIcon(FileText), label: 'Deliverables', moduleGroup: 'Workspace', moduleId: 'Deliverables' });
  } else {
    opsChildren.push({ key: '/client/meetings', icon: getIcon(Calendar), label: 'Meetings', moduleGroup: 'Workspace', moduleId: 'Meetings' });
    opsChildren.push({ key: '/client/calendar', icon: getIcon(Calendar), label: 'Calendar', moduleGroup: 'Workspace', moduleId: 'Calendar' });
    opsChildren.push({ key: '/client/deliverables', icon: getIcon(FileText), label: 'Deliverables', moduleGroup: 'Workspace', moduleId: 'Deliverables' });
  }

  if (opsChildren.length > 0) {
    allMenuItems.push({
      key: 'ops',
      label: 'AGENCY OPS',
      icon: getIcon(Activity),
      children: opsChildren,
    });
  }

  const hrmsChildren = [];
  if (['brand_super_admin', 'brand_manager', 'client', 'user', 'brand_team_user', 'client_user'].includes(role)) {
    if (hasFeature('hrms')) {
      hrmsChildren.push({ key: '/client/hrms/staff', icon: getIcon(Users), label: 'Staff' });
      hrmsChildren.push({ key: '/client/hrms/attendance', icon: getIcon(ClipboardList), label: 'Attendance' });
      hrmsChildren.push({ key: '/client/hrms/performance', icon: getIcon(Activity), label: 'Performance' });
      hrmsChildren.push({ key: '/client/hrms/daily-reports', icon: getIcon(FileText), label: 'Daily Reports' });
    }
  }

  if (hrmsChildren.length > 0) {
    allMenuItems.push({
      key: 'hrms',
      label: 'HRMS',
      icon: getIcon(ClipboardList),
      children: hrmsChildren,
    });
  }

  const settingsChildren = [];
  if (role === 'brand_super_admin') {
    settingsChildren.push({ key: '/client/users', icon: getIcon(Users), label: 'Managers' });
    settingsChildren.push({ key: '/client/billing', icon: getIcon(CreditCard), label: 'Billing' });
    settingsChildren.push({ key: '/client/settings/company', icon: getIcon(SettingsIcon), label: 'Settings' });
  } else if (['brand_manager', 'user', 'brand_team_user', 'client_user'].includes(role)) {
    settingsChildren.push({ key: '/client/settings/company', icon: getIcon(SettingsIcon), label: 'Settings' });
  } else if (role === 'agency_client') {
    settingsChildren.push({ key: '/client/billing', icon: getIcon(CreditCard), label: 'Billing' });
    settingsChildren.push({ key: '/client/settings/company', icon: getIcon(SettingsIcon), label: 'Settings' });
  } else {
    settingsChildren.push({ key: '/client/settings/company', icon: getIcon(SettingsIcon), label: 'Settings' });
  }

  if (settingsChildren.length > 0) {
    allMenuItems.push({
      key: 'settings',
      label: 'SETTINGS',
      icon: getIcon(SettingsIcon),
      children: settingsChildren,
    });
  }

  const filterMenuItems = (items) => items
    .map((item) => {
      let isAllowed = false;
      
      const hasCustomRole = user?.permissions && Object.keys(user.permissions).length > 0;
      const isAdmin = ['brand_super_admin', 'agency_super_admin', 'commander_admin', 'supreme_super_admin'].includes(role);

      if (hasCustomRole && !isAdmin) {
         if (item.moduleGroup && item.moduleId) {
            isAllowed = hasPermission(item.moduleGroup, item.moduleId);
         } else {
            isAllowed = item.featureId ? hasFeature(item.featureId) : true;
         }
      } else {
         isAllowed = item.featureId ? hasFeature(item.featureId) : true;
      }

      if (!isAllowed) return null;

      if (item.children) {
        const children = filterMenuItems(item.children);
        return children.length ? { ...item, children } : null;
      }
      return item;
    })
    .filter(Boolean);

  const menuItems = filterMenuItems(allMenuItems);

  const flattenMenuItems = (items) => items.flatMap((item) => (item.children ? flattenMenuItems(item.children) : item));

  const getSelectedKeys = () => {
    const flatItems = flattenMenuItems(menuItems);
    const match = flatItems
      .filter((item) => item.key.startsWith('/'))
      .sort((a, b) => b.key.length - a.key.length)
      .find((item) => location.pathname.startsWith(item.key));
    return [match?.key || '/client/dashboard'];
  };

  return (
    <PortalSidebar
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      brandInitials={dynamicBrandInitials}
      brandLogo={user?.logo}
      brandLogoDark={user?.logoDark}
      brandTitle={dynamicBrandName}
      brandSubtitle={user?.roleName || "Executive Portal"}
      accent="var(--accent-primary)"
      accentSoft="rgba(16, 185, 129, 0.12)"
      menuItems={menuItems}
      selectedKeys={getSelectedKeys()}
      defaultOpenKeys={['clients', 'workspace', 'intelligence', 'ops', 'settings']}
      onNavigate={navigate}
      partner={{
        initials: getInitials(user?.name) || 'AR',
        avatar: user?.avatar,
        label: user?.roleName || 'Your Growth Partner',
        name: user?.name || 'Arjun Raj',
        title: user?.brandName || user?.agencyName || user?.companyName || 'Senior Brand Strategist',
        phone: user?.phone,
        email: user?.email,
      }}
    />
  );
};

export default ClientSidebar;