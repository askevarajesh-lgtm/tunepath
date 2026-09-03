import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart2,
  Briefcase,
  Calendar,
  CheckSquare,
  CreditCard,
  DollarSign,
  FileText,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Library,
  Megaphone,
  PenTool,
  PieChart,
  Search,
  Settings,
  Share2,
  Shield,
  Store,
  Target,
  TrendingUp,
  Users,
  Zap,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useClientContext } from '../contexts/ClientContext';
import PortalSidebar from './PortalSidebar';
import { slaApi } from '../api/slaApi';

const AgencySidebar = ({ collapsed, setCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, features, user } = useAuth();
  const { selectedClient } = useClientContext();

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

  const dynamicAgencyName = user?.agencyName || user?.companyName || 'M1 Labs';
  const dynamicAgencyInitials = dynamicAgencyName.substring(0, 2).toUpperCase();

  const getIcon = (IconCmp) => <IconCmp size={18} strokeWidth={2} />;

  const getBadge = (text, type = 'neutral') => (
    <span className={`sidebar-menu-badge sidebar-menu-badge--${type}`}>{text}</span>
  );

  const getLabel = (text, badgeText, badgeType) => {
    if (!badgeText) return text;
    return (
      <div className="sidebar-menu-label">
        <span className="sidebar-menu-text">{text}</span>
        {!collapsed && getBadge(badgeText, badgeType)}
      </div>
    );
  };

  let menuItems = [
    {
      key: role === 'agency_super_admin' ? '/agency/admin-overview' : '/agency/overview',
      icon: getIcon(LayoutDashboard),
      label: 'Command Center',
    }
  ];

  let feats = features || [];
  if (selectedClient && Array.isArray(selectedClient.features)) {
    // Intersect the user's features with the client's features
    feats = feats.filter(f => selectedClient.features.includes(f));
  }
  
  const hasAgencyFullAccess = ['agency_manager', 'agency_super_admin'].includes(role);

  if (hasAgencyFullAccess || feats.includes('clients')) {
    menuItems.push({
      key: 'clients',
      label: 'CLIENTS',
      icon: getIcon(Users),
      children: [
        { key: '/agency/clients', icon: getIcon(Users), label: 'Accounts' },
        ...(['agency_super_admin', 'agency_manager'].includes(role) ? [
          { key: '/agency/sla', icon: getIcon(Activity), label: getLabel('SLA & Success', slaCount > 0 ? slaCount.toString() : null, 'danger') }
        ] : []),
      ],
    });
  }

  // When a specific client is selected, these modules should be hidden
  const isClientSelected = !!selectedClient;

  const workspaceChildren = [];

  if (role !== 'agency_super_admin') {
    if (feats.includes('strategy')) workspaceChildren.push({ key: '/agency/strategy', icon: getIcon(Target), label: 'Strategy' });
    if (feats.includes('aistudio')) workspaceChildren.push({ key: '/agency/ai-studio', icon: getIcon(Zap), label: 'AI Studio' });
    if (feats.includes('social')) workspaceChildren.push({ key: '/agency/social-media', icon: getIcon(Share2), label: 'Social Media' });
    if (feats.includes('ads')) workspaceChildren.push({ key: '/agency/performance-ads', icon: getIcon(Megaphone), label: 'Performance Ads' });

    if (feats.includes('crm')) {
      workspaceChildren.push({ key: '/agency/crm', icon: getIcon(Inbox), label: 'CRM & Leads' });
    }

    // Default modules always available
    workspaceChildren.push({ key: '/agency/proposals', icon: getIcon(FileText), label: 'Proposals' });
    if (feats.includes('website')) workspaceChildren.push({ key: '/agency/website', icon: getIcon(LayoutDashboard), label: 'Websites' });
    // Marketplace: hidden when a specific client is selected
    if (!isClientSelected && ['agency_manager', 'agency'].includes(role)) {
      workspaceChildren.push({
        key: '/agency/marketplace',
        icon: getIcon(Store),
        label: 'Marketplace',
      });
    }
    // SEO Panel: hidden when a specific client is selected
    if (!isClientSelected && (feats.includes('seo-panel') || ['agency_super_admin', 'agency_manager'].includes(role))) {
      workspaceChildren.push({ key: '/agency/workspace/seo-panel', icon: getIcon(Search), label: 'SEO Panel' });
    }
  }

  if (workspaceChildren.length > 0) {
    menuItems.push({
      key: 'workspace',
      label: 'WORKSPACE',
      icon: getIcon(Briefcase),
      children: workspaceChildren,
    });
  }

  if (role !== 'agency_super_admin') {
    menuItems.push({
      key: 'task_management',
      label: 'Task Management',
      icon: getIcon(CheckSquare),
      children: [
        { key: '/agency/projects', icon: getIcon(Target), label: 'Projects' },
        { key: '/agency/workspace/tasks', icon: getIcon(CheckSquare), label: 'Tasks' },
        { key: '/agency/workspace/tasks/analytics', icon: getIcon(BarChart2), label: 'Task Analytics' },
        { key: '/agency/workspace/tasks/coordinator', icon: getIcon(Users), label: 'Coordinator Tasks' },
      ]
    });
  }

  const intelligenceChildren = [];
  if (role !== 'agency_super_admin') {
    if (feats.includes('analytics')) intelligenceChildren.push({ key: '/agency/analytics', icon: getIcon(TrendingUp), label: 'Google Analytics' });
    // ChatGPT: hidden when a specific client is selected
    if (!isClientSelected && feats.includes('chatgpt')) intelligenceChildren.push({ key: '/agency/chatgpt', icon: getIcon(HelpCircle), label: 'ChatGPT' });
    // Canva: hidden when a specific client is selected
    if (!isClientSelected && feats.includes('canva')) intelligenceChildren.push({ key: '/agency/canva', icon: getIcon(PenTool), label: 'Canva' });
    if (feats.includes('seo-aeo-geo')) intelligenceChildren.push({ key: '/agency/seo-aeo-geo', icon: getIcon(Search), label: 'SEO/AEO/GEO' });
    // if (feats.includes('benchmark')) intelligenceChildren.push({ key: '/agency/benchmarks', icon: getIcon(Activity), label: 'Benchmark' });
  }

  if (role === 'agency_super_admin') {
    intelligenceChildren.push({ key: '/agency/performance', icon: getIcon(TrendingUp), label: 'Performance' });
  }

  if (intelligenceChildren.length > 0) {
    menuItems.push({
      key: 'intelligence',
      label: 'INTELLIGENCE',
      icon: getIcon(Zap),
      children: intelligenceChildren,
    });
  }

  const opsChildren = [];
  // Time Tracking: hidden when a specific client is selected
  if (!isClientSelected) opsChildren.push({ key: '/agency/time', icon: getIcon(Calendar), label: 'Time Tracking' });
  // Sales Pipeline: hidden when a specific client is selected
  if (!isClientSelected) opsChildren.push({ key: '/agency/salespipeline', icon: getIcon(Briefcase), label: 'Sales Pipeline' });
  // Meetings: hidden when a specific client is selected
  if (!isClientSelected) opsChildren.push({ key: '/agency/meetings', icon: getIcon(Calendar), label: 'Meetings' });
  opsChildren.push({ key: '/agency/calendar', icon: getIcon(Calendar), label: 'Calendar' });
  opsChildren.push({ key: '/agency/deliverables', icon: getIcon(FileText), label: 'Deliverables' });

  if (opsChildren.length > 0) {
    menuItems.push({
      key: 'ops',
      label: 'AGENCY OPS',
      icon: getIcon(Activity),
      children: opsChildren,
    });
  }

  const accountsChildren = [];
  accountsChildren.push({ key: '/agency/invoices', icon: getIcon(CreditCard), label: 'Invoices' });
  accountsChildren.push({ key: '/agency/accounts/transactions', icon: getIcon(CreditCard), label: 'Transactions' });
  // Sales Tracking: hidden when a specific client is selected
  if (!isClientSelected) accountsChildren.push({ key: '/agency/accounts/sales-tracking', icon: getIcon(TrendingUp), label: 'Sales Tracking' });
  // Expenses Management: hidden when a specific client is selected
  if (!isClientSelected) accountsChildren.push({ key: '/agency/accounts/expenses', icon: getIcon(FileText), label: 'Expenses Management' });
  // Campaign Expenses: hidden when a specific client is selected
  if (!isClientSelected) accountsChildren.push({ key: '/agency/accounts/campaign-expenses', icon: getIcon(DollarSign), label: 'Campaign Expenses' });
  // P&L Analytics: hidden when a specific client is selected
  if (!isClientSelected) accountsChildren.push({ key: '/agency/accounts/pl-analytics', icon: getIcon(PieChart), label: 'P&L Analytics' });

  if (accountsChildren.length > 0) {
    menuItems.push({
      key: 'accounts',
      label: 'ACCOUNTS',
      icon: getIcon(CreditCard),
      children: accountsChildren,
    });
  }

  // HRMS: entire section hidden when a specific client is selected
  if (!isClientSelected) {
    const hrmsChildren = [];
    if (feats.includes('hrms')) {
      hrmsChildren.push({ key: '/agency/hrms/staff', icon: getIcon(Users), label: 'Staff' });
      hrmsChildren.push({ key: '/agency/hrms/attendance', icon: getIcon(ClipboardList), label: 'Attendance' });
    }

    if (['agency_super_admin', 'agency_manager', 'agency'].includes(role)) {
      hrmsChildren.push({ key: '/agency/hrms/performance', icon: getIcon(Activity), label: 'Performance' });
      hrmsChildren.push({ key: '/agency/hrms/daily-reports', icon: getIcon(FileText), label: 'Daily Reports' });
    }

    if (hrmsChildren.length > 0) {
      menuItems.push({
        key: 'hrms',
        label: 'HRMS',
        icon: getIcon(ClipboardList),
        children: hrmsChildren,
      });
    }
  }

  const settingsChildren = [];
  // Master Item: hidden when a specific client is selected
  if (!isClientSelected && (feats.includes('master-items') || hasAgencyFullAccess)) settingsChildren.push({ key: '/agency/master-items', icon: getIcon(Store), label: 'Master Item' });
  if (role === 'agency_super_admin') {
    settingsChildren.push({ key: '/agency/users', icon: getIcon(Shield), label: 'Manager' });
    settingsChildren.push({ key: '/agency/billing', icon: getIcon(CreditCard), label: 'Billing' });
  }
  // Support: hidden when a specific client is selected
  if (!isClientSelected && ['agency_super_admin', 'agency_manager', 'agency_client'].includes(role)) {
    settingsChildren.push({ key: '/agency/support', icon: getIcon(HelpCircle), label: 'Support' });
  }
  // Settings item itself: always shown, unaffected by client selection
  if (feats.includes('settings') || hasAgencyFullAccess) settingsChildren.push({ key: '/agency/settings', icon: getIcon(Settings), label: 'Settings' });

  if (settingsChildren.length > 0) {
    menuItems.push({
      key: 'settings',
      label: 'SETTINGS',
      icon: getIcon(Settings),
      children: settingsChildren,
    });
  }

  const flattenItems = (items) => items.flatMap((item) => item.children ? flattenItems(item.children) : item);

  const getSelectedKeys = () => {
    const flatItems = flattenItems(menuItems);
    const match = flatItems
      .filter((item) => item.key.startsWith('/'))
      .sort((a, b) => b.key.length - a.key.length)
      .find((item) => location.pathname.startsWith(item.key));
    return [match?.key || (role === 'agency_super_admin' ? '/agency/admin-overview' : '/agency/overview')];
  };

  return (
    <PortalSidebar
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      brandInitials={dynamicAgencyInitials}
      brandLogo={user?.logo}
      brandLogoDark={user?.logoDark}
      brandTitle={dynamicAgencyName}
      brandSubtitle={user?.roleName || "Agency Portal"}
      accent="var(--accent-primary)"
      accentSoft="rgba(59, 130, 246, 0.12)"
      menuItems={menuItems}
      selectedKeys={getSelectedKeys()}
      onNavigate={navigate}
      partner={{
        initials: getInitials(user?.name) || 'AP',
        avatar: user?.avatar,
        label: user?.roleName || 'Agency Success',
        name: user?.name || 'Alpha Partners',
        title: user?.brandName || user?.agencyName || user?.companyName || 'Partner Support Desk',
        phone: user?.phone,
        email: user?.email,
      }}
    />
  );
};

export default AgencySidebar;