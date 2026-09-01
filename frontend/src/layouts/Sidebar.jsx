import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Award,
  BarChart2,
  Bot,
  Briefcase,
  Calendar,
  CheckSquare,
  CreditCard,
  DollarSign,
  FileText,
  GitMerge,
  Globe,
  LayoutDashboard,
  Library,
  LineChart,
  MessageCircle,
  Monitor,
  Palette,
  PieChart,
  Search,
  Settings as SettingsIcon,
  Shield,
  Store,
  Target,
  TrendingUp,
  Users,
  Zap,
  HelpCircle,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PortalSidebar from './PortalSidebar';
import { slaApi } from '../api/slaApi';
import { sidebarApi } from '../api/sidebarApi';
import api from '../services/api';

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

const flattenItems = (items) => items.flatMap((item) => item.children ? flattenItems(item.children) : item);

const Sidebar = ({ collapsed, setCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, user } = useAuth();
  
  const [slaCount, setSlaCount] = React.useState(0);
  const [accountsCount, setAccountsCount] = React.useState(0);
  const [agenciesCount, setAgenciesCount] = React.useState(0);
  
  // Dynamic counts
  const [peopleCount, setPeopleCount] = React.useState('...');
  const [leadsCount, setLeadsCount] = React.useState('...');
  const [pipelineCount, setPipelineCount] = React.useState('...');
  const [mosScore, setMosScore] = React.useState('...');

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

    const fetchAccountsCount = async () => {
      try {
        const res = await api.get('/brands');
        if (res && res.data) {
          const count = res.data.count ?? res.data.pagination?.total ?? res.data.data?.length ?? 0;
          setAccountsCount(count);
        }
      } catch (error) {
        console.error('Failed to fetch accounts count for sidebar', error);
      }
    };

    const fetchAgenciesCount = async () => {
      try {
        const res = await api.get('/agencies');
        if (res && res.data) {
          const count = res.data.count ?? res.data.pagination?.total ?? res.data.data?.length ?? 0;
          setAgenciesCount(count);
        }
      } catch (error) {
        console.error('Failed to fetch agencies count for sidebar', error);
      }
    };

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

    fetchSlaCount();
    fetchAccountsCount();
    fetchAgenciesCount();
    fetchSidebarCounts();
  }, []);

  const menuItems = useMemo(() => [
    {
      key: '/dashboard',
      icon: getIcon(LayoutDashboard),
      label: 'Command Center',
    },
    {
      key: 'clients',
      label: 'CLIENTS',
      icon: getIcon(Users),
      children: [
        ...(['brand_super_admin', 'brand_manager'].includes(role) ? [] : [
          { key: '/clients/accounts', icon: getIcon(Users), label: getLabel('Accounts', agenciesCount.toString()) },
        ]),
        ...(['commander_admin', 'agency_super_admin', 'agency_manager'].includes(role) ? [
          { key: '/clients/sla', icon: getIcon(Shield), label: getLabel('SLA & Success', slaCount > 0 ? slaCount.toString() : null, 'danger') }
        ] : []),
        { key: '/clients/portal', icon: getIcon(Monitor), label: getLabel(role === 'commander_admin' ? 'Direct Brand' : 'Brands', accountsCount.toString()) },
      ],
    },
    {
      key: 'workspace',
      label: 'WORKSPACE',
      icon: getIcon(Briefcase),
      children: [
        { key: '/workspace/strategy', icon: getIcon(Target), label: 'Strategy' },
        { key: '/workspace/content', icon: getIcon(FileText), label: 'Content' },
        { key: '/workspace/aistudio', icon: getIcon(Palette), label: 'AI Studio' },
        { key: '/workspace/social', icon: getIcon(GitMerge), label: 'Social Media' },
        { key: '/workspace/ads', icon: getIcon(BarChart2), label: 'Performance Ads' },
        { key: '/workspace/crm', icon: getIcon(LineChart), label: getLabel('CRM & Leads', leadsCount) },
        // { key: '/workspace/automation', icon: getIcon(Zap), label: 'Automation' },
        ...(role === 'commander_admin' ? [] : [
          { key: '/workspace/proposals', icon: getIcon(FileText), label: 'Proposals' },
          { key: '/workspace/invoices', icon: getIcon(DollarSign), label: 'Invoices' },
        ]),
        {
          key: 'task_management',
          label: 'Task Management',
          icon: getIcon(CheckSquare),
          children: [
            ...(role === 'commander_admin' ? [] : [
              { key: '/workspace/projects', label: 'Projects' },
            ]),
            { key: '/workspace/tasks', label: 'Tasks' },
            { key: '/workspace/tasks/analytics', label: 'Task Analytics' },
            { key: '/workspace/tasks/coordinator', label: 'Coordinator Tasks' },
          ]
        },
        { key: '/workspace/website', icon: getIcon(Globe), label: 'Websites' },
        { key: '/workspace/seo-panel', icon: getIcon(Search), label: 'SEO Panel' },
      ],
    },
    {
      key: 'intelligence',
      label: 'INTELLIGENCE',
      icon: getIcon(Zap),
      children: [
        { key: '/intelligence/analytics', icon: getIcon(TrendingUp), label: 'Google Analytics' },
        ...(['commander_admin', 'supreme_super_admin', 'agency_super_admin', 'agency_manager'].includes(role) ? [
          { key: '/intelligence/mos', icon: getIcon(Activity), label: getLabel('MOS Score', mosScore, 'warning') },
        ] : []),
        // { key: '/intelligence/copilot', icon: getIcon(MessageCircle), label: 'AI Co-Pilot' },
        { key: '/intelligence/chatgpt', icon: getIcon(MessageCircle), label: 'ChatGPT' },
        { key: '/intelligence/canva', icon: getIcon(Palette), label: 'Canva' },
        // { key: '/intelligence/benchmarks', icon: getIcon(Award), label: 'Benchmarks' },
        { key: '/intelligence/reporting', icon: getIcon(FileText), label: 'Reports' },
        // { key: '/intelligence/seo', icon: getIcon(Search), label: 'SEO Intelligence' },
        { key: '/intelligence/seo-aeo-geo', icon: getIcon(Search), label: 'SEO/AEO/GEO' },
      ],
    },

    {
      key: 'ops',
      label: 'AGENCY OPS',
      icon: getIcon(Activity),
      children: [

        { key: '/ops/time', icon: getIcon(Calendar), label: 'Time Tracking' },
        ...(role === 'commander_admin' ? [] : [
          { key: '/ops/finance', icon: getIcon(CreditCard), label: 'Finance' },
          { key: '/ops/profitability', icon: getIcon(DollarSign), label: 'Profitability' },
        ]),
        { key: '/ops/salespipeline', icon: getIcon(Briefcase), label: getLabel('Sales Pipeline', pipelineCount) },
        { key: '/ops/meetings', icon: getIcon(Calendar), label: role === 'commander_admin' ? 'Global Meetings' : 'Meetings' },
        { key: '/ops/calendar', icon: getIcon(Calendar), label: role === 'commander_admin' ? 'Global Calendar' : 'Calendar' },
        { key: '/ops/deliverables', icon: getIcon(FileText), label: role === 'commander_admin' ? 'Global Deliverables' : 'Deliverables' },
      ],
    },
    ...(['commander_admin', 'agency_super_admin', 'agency_manager', 'brand_super_admin', 'brand_manager', 'agency', 'client', 'agency_client'].includes(role) && (user?.features?.includes('hrms') || role === 'commander_admin') ? [
      {
        key: 'hrms',
        label: 'HRMS',
        icon: getIcon(ClipboardList),
        children: [
          ...((user?.features?.includes('hrms') || role === 'commander_admin') ? [
            { key: '/hrms/staff', icon: getIcon(Users), label: 'Staff' },
            { key: '/hrms/attendance', icon: getIcon(ClipboardList), label: 'Attendance' },
          ] : []),
          { key: '/hrms/performance', icon: getIcon(Activity), label: 'Performance' },
          { key: '/hrms/daily-reports', icon: getIcon(FileText), label: 'Daily Reports' },
        ],
      }
    ] : []),
    {
      key: 'settings',
      label: 'SETTINGS',
      icon: getIcon(SettingsIcon),
      children: [
        { key: '/settings/company', icon: getIcon(SettingsIcon), label: 'Settings' },
        ...(['agency_super_admin', 'agency_manager', 'client', 'agency_client', 'brand_super_admin', 'brand_manager'].includes(role) ? [{
          key: '/support',
          icon: getIcon(HelpCircle),
          label: 'Support'
        }] : []),
        ...(role === 'commander_admin' ? [] : [
          { key: '/workspace/master-items', icon: getIcon(Store), label: 'Master Item' },
        ]),
      ],
    },
    
  ], [collapsed, role, agenciesCount, slaCount, accountsCount, leadsCount, mosScore, pipelineCount]);

  const selectedKeys = useMemo(() => {
    const flatItems = flattenItems(menuItems);
    const match = flatItems
      .filter((item) => item.key && item.key.startsWith('/'))
      .sort((a, b) => b.key.length - a.key.length)
      .find((item) => location.pathname.startsWith(item.key));
    return [match?.key || '/dashboard'];
  }, [menuItems, location.pathname]);

  return (
    <PortalSidebar
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      brandInitials="M1"
      brandLogo={user?.logo}
      brandLogoDark={user?.logoDark}
      brandTitle="M1"
      brandSubtitle="Agency Growth OS"
      accent="var(--accent-primary)"
      accentSoft="rgba(59, 130, 246, 0.12)"
      menuItems={menuItems}
      selectedKeys={selectedKeys}
      defaultOpenKeys={['clients', 'workspace', 'intelligence', 'ops', 'settings', 'hrms']}
      onNavigate={navigate}
      partner={{
        initials: getInitials(user?.name),
        avatar: user?.avatar,
        label: user?.roleName || 'Role Not Assigned',
        name: user?.name || 'Unknown User',
        title: user?.brandName || user?.agencyName || user?.companyName || 'Workspace',
        phone: user?.phone,
        email: user?.email,
      }}
    />
  );
};

export default Sidebar;