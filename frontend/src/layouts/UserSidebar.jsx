import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  CheckSquare, LayoutDashboard, Settings, FileText, Palette, GitMerge, 
  Target, Search, BarChart2, Globe, LineChart, MessageCircle, TrendingUp, Briefcase, Users, Activity
} from 'lucide-react';
import PortalSidebar from './PortalSidebar';
import { useAuth } from '../contexts/AuthContext';

const UserSidebar = ({ collapsed, setCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useAuth();
  const permissions = user?.permissions || {};

  const getIcon = (IconCmp) => <IconCmp size={18} strokeWidth={2} />;

  const hasPerm = (key) => permissions[key]?.Read;

  const taskManagementChildren = [
    { key: '/user/tasks', label: 'Tasks' },
  ];

  if (hasPerm('Workspace-Task Analytics')) {
    taskManagementChildren.push({ key: '/user/workspace/tasks/analytics', label: 'Task Analytics' });
  }
  if (hasPerm('Workspace-Coordinator Tasks')) {
    taskManagementChildren.push({ key: '/user/workspace/tasks/coordinator', label: 'Coordinator Tasks' });
  }

  let menuItems = [
    { key: '/user/dashboard', icon: getIcon(LayoutDashboard), label: 'Dashboard' },
  ];

  const clientsChildren = [];
  if (hasPerm('Clients-Accounts')) {
    clientsChildren.push({ key: '/user/clients', icon: getIcon(Users), label: 'Accounts' });
  }

  if (clientsChildren.length > 0) {
    menuItems.push({
      key: 'clients',
      label: 'CLIENTS',
      icon: getIcon(Users),
      children: clientsChildren
    });
  }

  const workspaceChildren = [];
  if (hasPerm('Workspace-Strategy')) workspaceChildren.push({ key: '/user/workspace/strategy', icon: getIcon(Target), label: 'Strategy' });
  if (hasPerm('Workspace-Content')) workspaceChildren.push({ key: '/user/workspace/content', icon: getIcon(FileText), label: 'Content' });
  if (hasPerm('Workspace-AI Studio')) workspaceChildren.push({ key: '/user/workspace/aistudio', icon: getIcon(Palette), label: 'AI Studio' });
  if (hasPerm('Workspace-Social Media')) workspaceChildren.push({ key: '/user/workspace/social', icon: getIcon(GitMerge), label: 'Social Media' });
  if (hasPerm('Workspace-Performance Ads')) workspaceChildren.push({ key: '/user/workspace/ads', icon: getIcon(BarChart2), label: 'Performance Ads' });
  if (hasPerm('Workspace-CRM & Leads')) workspaceChildren.push({ key: '/user/workspace/crm', icon: getIcon(LineChart), label: 'CRM & Leads' });
  if (hasPerm('Workspace-Websites')) workspaceChildren.push({ key: '/user/workspace/website', icon: getIcon(Globe), label: 'Websites' });
  if (hasPerm('Workspace-Proposals')) workspaceChildren.push({ key: '/user/workspace/proposals', icon: getIcon(FileText), label: 'Proposals' });
  if (hasPerm('Workspace-Invoices')) workspaceChildren.push({ key: '/user/workspace/invoices', icon: getIcon(FileText), label: 'Invoices' });
  if (hasPerm('Workspace-Projects')) workspaceChildren.push({ key: '/user/workspace/projects', icon: getIcon(Target), label: 'Projects' });
  if (hasPerm('Workspace-SEO Panel')) workspaceChildren.push({ key: '/user/workspace/seo-panel', icon: getIcon(Search), label: 'SEO Panel' });

  if (workspaceChildren.length > 0) {
    menuItems.push({
      key: 'workspace',
      label: 'WORKSPACE',
      icon: getIcon(Briefcase),
      children: workspaceChildren
    });
  }

  if (hasPerm('Workspace-Task Management') || taskManagementChildren.length > 0) {
    menuItems.push({
      key: 'task_management',
      label: 'Task Management',
      icon: getIcon(CheckSquare),
      children: taskManagementChildren
    });
  }

  const intelligenceChildren = [];
  if (hasPerm('Intelligence-Google Analytics')) intelligenceChildren.push({ key: '/user/intelligence/analytics', icon: getIcon(TrendingUp), label: 'Analytics' });
  if (hasPerm('Intelligence-MOS Score')) intelligenceChildren.push({ key: '/user/intelligence/mos', icon: getIcon(BarChart2), label: 'MOS Score' });
  if (hasPerm('Intelligence-ChatGPT')) intelligenceChildren.push({ key: '/user/intelligence/chatgpt', icon: getIcon(MessageCircle), label: 'ChatGPT' });
  if (hasPerm('Intelligence-Canva')) intelligenceChildren.push({ key: '/user/intelligence/canva', icon: getIcon(Palette), label: 'Canva' });
  if (hasPerm('Intelligence-AI Agent')) intelligenceChildren.push({ key: '/user/intelligence/agents', icon: getIcon(Target), label: 'AI Agent' });
  // if (hasPerm('Intelligence-Benchmarks')) intelligenceChildren.push({ key: '/user/intelligence/benchmarks', icon: getIcon(TrendingUp), label: 'Benchmarks' });
  if (hasPerm('Intelligence-Reports')) intelligenceChildren.push({ key: '/user/intelligence/reports', icon: getIcon(FileText), label: 'Reports' });
  if (hasPerm('Intelligence-SEO / AEO / GEO(semrush)') || hasPerm('Workspace-SEO / AEO / GEO')) intelligenceChildren.push({ key: '/user/intelligence/seo-aeo-geo', icon: getIcon(Search), label: 'SEO/AEO/GEO' });

  if (intelligenceChildren.length > 0) {
    menuItems.push({
      key: 'intelligence',
      label: 'INTELLIGENCE',
      icon: getIcon(Target),
      children: intelligenceChildren
    });
  }

  const opsChildren = [];
  if (hasPerm('Agency Ops-Meetings') || hasPerm('Workspace-Meetings')) opsChildren.push({ key: '/user/workspace/meetings', icon: getIcon(MessageCircle), label: 'Meetings' });
  if (hasPerm('Agency Ops-Calendar') || hasPerm('Workspace-Calendar')) opsChildren.push({ key: '/user/workspace/calendar', icon: getIcon(CheckSquare), label: 'Calendar' });
  if (hasPerm('Agency Ops-Deliverables') || hasPerm('Workspace-Deliverables')) opsChildren.push({ key: '/user/workspace/deliverables', icon: getIcon(CheckSquare), label: 'Deliverables' });
  if (hasPerm('Agency Ops-Sales Pipeline')) opsChildren.push({ key: '/user/workspace/salespipeline', icon: getIcon(Briefcase), label: 'Sales Pipeline' });

  if (opsChildren.length > 0) {
    menuItems.push({
      key: 'ops',
      label: 'AGENCY OPS',
      icon: getIcon(Activity),
      children: opsChildren
    });
  }

  const hrmsChildren = [];
  hrmsChildren.push({ key: '/user/hrms/performance', icon: getIcon(Target), label: 'Performance' });
  if (hasPerm('HRMS-Daily Reports')) {
    hrmsChildren.push({ key: '/user/hrms/daily-reports', icon: getIcon(FileText), label: 'Daily Reports' });
  }

  if (hrmsChildren.length > 0) {
    menuItems.push({
      key: 'hrms',
      label: 'HRMS',
      icon: getIcon(Users), // Wait, AgencySidebar uses ClipboardList or Target
      children: hrmsChildren
    });
  }

  const settingsChildren = [];
  if (hasPerm('Workspace-Automation')) settingsChildren.push({ key: '/user/workspace/automation', icon: getIcon(Settings), label: 'Automation' });
  if (hasPerm('General-Master Item') || hasPerm('Workspace-Master Item')) settingsChildren.push({ key: '/user/workspace/master-items', icon: getIcon(Settings), label: 'Master Item' });
  settingsChildren.push({ key: '/user/settings', icon: getIcon(Settings), label: 'Settings' });

  if (settingsChildren.length > 0) {
    menuItems.push({
      key: 'settings',
      label: 'SETTINGS',
      icon: getIcon(Settings),
      children: settingsChildren
    });
  }

  const flattenItems = (items) => items.flatMap((item) => item.children ? flattenItems(item.children) : item);

  const getSelectedKeys = () => {
    const flatItems = flattenItems(menuItems);
    const match = flatItems
      .filter((item) => item.key && item.key.startsWith('/'))
      .sort((a, b) => b.key.length - a.key.length)
      .find((item) => location.pathname.startsWith(item.key));
    return [match?.key || '/user/dashboard'];
  };

  return (
    <PortalSidebar
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      width={260}
      brandInitials="U"
      brandLogo={user?.logo}
      brandLogoDark={user?.logoDark}
      brandTitle={user?.companyName || "Employee Panel"}
      brandSubtitle={user?.roleName || "M1 Platform"}
      accent="var(--accent-primary)"
      accentSoft="rgba(139, 92, 246, 0.12)"
      menuItems={menuItems}
      selectedKeys={getSelectedKeys()}
      onNavigate={navigate}
      partner={{
        initials: user?.name ? user.name.substring(0, 2).toUpperCase() : 'U',
        avatar: user?.avatar,
        label: user?.roleName || 'Employee',
        name: user?.name || 'User',
        title: user?.brandName || user?.agencyName || user?.companyName || 'Workspace',
        phone: user?.phone,
        email: user?.email,
      }}
    />
  );
};

export default UserSidebar;
