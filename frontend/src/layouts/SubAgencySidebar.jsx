import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  Settings,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PortalSidebar from './PortalSidebar';

const SubAgencySidebar = ({ collapsed, setCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getIcon = (IconComponent) => (
    <IconComponent size={20} strokeWidth={2} style={{ display: 'inline-flex' }} />
  );

  const menuItems = [
    {
      key: 'workspace',
      label: 'WORKSPACE',
      type: 'group',
      children: [
        { key: '/sub-agency/dashboard', icon: getIcon(LayoutDashboard), label: 'Dashboard' },
        { key: '/sub-agency/projects', icon: getIcon(Briefcase), label: 'Projects' },
        { key: '/sub-agency/tasks', icon: getIcon(CheckSquare), label: 'Tasks' },
      ],
    },
    {
      key: 'settings',
      label: 'SETTINGS',
      icon: getIcon(Settings),
      children: [
        { key: '/sub-agency/settings/users', label: 'Users' },
      ],
    }
  ];

  const flattenItems = (items) => items.flatMap((item) => item.children ? flattenItems(item.children) : item);

  const getSelectedKeys = () => {
    const flatItems = flattenItems(menuItems);
    const match = flatItems
      .filter((item) => item.key.startsWith('/'))
      .sort((a, b) => b.key.length - a.key.length)
      .find((item) => location.pathname.startsWith(item.key));
    return [match?.key || '/sub-agency/dashboard'];
  };

  return (
    <PortalSidebar
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      brandInitials={getInitials(user?.subAgencyName || 'SA')}
      brandTitle={user?.subAgencyName || 'Sub Agency'}
      brandSubtitle={user?.roleName || 'Sub Agency Portal'}
      accent="var(--accent-primary)"
      accentSoft="rgba(59, 130, 246, 0.12)"
      menuItems={menuItems}
      selectedKeys={getSelectedKeys()}
      onNavigate={navigate}
      partner={{
        initials: getInitials(user?.name) || 'SA',
        avatar: user?.avatar,
        label: 'Employee',
        name: user?.name || 'Super Admin',
        title: user?.subAgencyName || 'Sub Agency',
        phone: user?.phone,
        email: user?.email,
      }}
    />
  );
};

export default SubAgencySidebar;
