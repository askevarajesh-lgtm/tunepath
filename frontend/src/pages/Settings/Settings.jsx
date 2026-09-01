import React, { useState, useEffect } from 'react';
import { Typography, Tabs } from 'antd';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { User, Building, Users, Plug, Receipt, Package, Bell } from 'lucide-react';

import AgencyTab from './tabs/AgencyTab';
import IntegrationsTab from './tabs/IntegrationsTab';
import TeamAccessTab from './tabs/TeamAccessTab';
import NotificationsTab from './tabs/NotificationsTab';
import BackendConfigTab from './tabs/BackendConfigTab';
import AccessMatrixTab from './tabs/AccessMatrixTab';
import UserManagementTab from './tabs/UserManagementTab';
import AgencyPackagesTab from './tabs/AgencyPackagesTab';
import DirectPackagesTab from './tabs/DirectPackagesTab';
import ClientPackagesTab from '../AgencyPortal/tabs/ClientPackagesTab';
import UserSettingsTab from '../UserPortal/SettingsTab';
import TaxSettingsTab from './tabs/TaxSettingsTab';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

const SettingsPage = () => {
  const { role, user } = useAuth();
  const location = useLocation();

  const hasFullCrmAccess = () => {
    if (['commander_admin', 'agency_super_admin', 'agency_manager', 'brand_super_admin', 'brand_manager'].includes(role)) return true;
    
    // For agency client sub-users, check their features array
    if (role === 'user' && user?.brandId) {
      return (user?.features || []).includes('crm');
    }

    const crm = user?.permissions?.['Workspace-CRM & Leads'];
    if (crm) {
      const isManagerRole = ['admin', 'brand_admin', 'brand_manager'].includes(role);
      const isAllChecked = (crm.Read || false) && (crm.View || false) && (crm.Create || isManagerRole) && (crm.Edit || isManagerRole) && (crm.Delete || isManagerRole);
      return isAllChecked;
    }
    return false;
  };

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'integrations' && hasFullCrmAccess()) return '2';
    if (location.state?.activeTab) return location.state.activeTab;
    if (['commander_admin', 'agency_super_admin', 'brand_super_admin'].includes(role)) return '1';
    if (['agency_manager', 'brand_manager'].includes(role)) return '7';
    return '9'; // Default to profile for regular users
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'integrations' && hasFullCrmAccess()) {
      setActiveTab('2');
    } else if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state?.activeTab, location.search]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1, 
      transition: { type: 'spring', stiffness: 300, damping: 24 } 
    }
  };

  const renderContent = () => {
    switch(activeTab) {
      case '1': return <AgencyTab />;
      case '2': return hasFullCrmAccess() ? <IntegrationsTab /> : <UserSettingsTab />;
      case '3': return <TeamAccessTab />;
      case '4': return <NotificationsTab />;
      case '5': return <BackendConfigTab />;
      case '6': return <AccessMatrixTab />;
      case '7': return <UserManagementTab />;
      case '8': return <AgencyPackagesTab />;
      case '10': return <DirectPackagesTab />;
      case '11': return <ClientPackagesTab />;
      case '12': return <TaxSettingsTab />;
      case '9': return <UserSettingsTab />;
      default: return <UserSettingsTab />;
    }
  };

  const allTabs = [
    { key: '9', label: <span><User size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />Profile</span> },
    { key: '1', label: <span><Building size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />Agency</span> },
    { key: '7', label: <span><Users size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />User Management</span> },
    { key: '2', label: <span><Plug size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />Integrations</span> },
    { key: '12', label: <span><Receipt size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />Tax Settings</span> },
    ...(['brand_super_admin', 'brand_manager'].includes(role) ? [] : [
      { key: '8', label: <span><Package size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />Agency Packages</span> },
      { key: '10', label: <span><Package size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />Direct Brand Packages</span> }
    ]),
    ...(['commander_admin', 'brand_super_admin', 'brand_manager'].includes(role) ? [] : [
      { key: '11', label: <span><Package size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />Client Packages</span> }
    ]),
    { key: '4', label: <span><Bell size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />Notifications</span> }
  ];

  let allowedKeys = [];
  if (['commander_admin', 'agency_super_admin', 'brand_super_admin'].includes(role)) {
    allowedKeys = allTabs.map(t => t.key);
  } else if (['agency_manager', 'brand_manager'].includes(role)) {
    allowedKeys = [hasFullCrmAccess() ? '2' : null, '4', '7', '12', '9', '11'].filter(Boolean);
  } else {
    // agency_user, brand_team_user, client, agency_client
    allowedKeys = [hasFullCrmAccess() ? '2' : null, '4', '9'].filter(Boolean);
  }

  const tabItems = allTabs.filter(t => allowedKeys.includes(t.key));

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >
      <motion.div variants={itemVariants} style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>Settings</Title>
        <Text type="secondary" style={{ fontWeight: 500 }}>Configure how the M1 platform works for M1 Labs.</Text>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          style={{ marginBottom: 32 }} 
          size="large"
          tabBarStyle={{ fontWeight: 600, color: 'var(--text-secondary)' }}
          items={tabItems}
        />
      </motion.div>

      {renderContent()}

    </motion.div>
  );
};

export default SettingsPage;
