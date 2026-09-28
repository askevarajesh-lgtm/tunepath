import React from 'react';
import { Tabs } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { SubAgencyUsers } from './index';
import NotificationsTab from '../Settings/tabs/NotificationsTab';

const SubAgencySettings = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeKey = location.pathname.includes('notifications') ? 'notifications' : 'users';

  const items = [
    {
      key: 'users',
      label: 'User Management',
      children: <SubAgencyUsers />
    },
    {
      key: 'notifications',
      label: 'Notifications',
      children: <NotificationsTab />
    }
  ];

  const onChange = (key) => {
    navigate(`/sub-agency/settings/${key}`);
  };

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: '100%' }}>
      <h2 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>Settings</h2>
      <Tabs activeKey={activeKey} items={items} onChange={onChange} />
    </div>
  );
};

export default SubAgencySettings;
