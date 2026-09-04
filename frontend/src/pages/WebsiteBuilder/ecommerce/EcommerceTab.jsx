import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Typography, Row, Col, Card, Button, Layout, Menu } from 'antd';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ShoppingBag,
  Settings,
  CreditCard,
  Truck,
  Users,
  Package,
  LayoutTemplate,
  Paintbrush,
  FileText
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

import EcommerceDashboard from './components/EcommerceDashboard';
import EcommerceProducts from './components/EcommerceProducts';
import EcommerceOrders from './components/EcommerceOrders';
import EcommerceSettings from './components/EcommerceSettings';
import EcommerceStoreBuilder from './components/EcommerceStoreBuilder';
import StorefrontRenderer from './storefront/StorefrontRenderer';
import EcommerceTemplates from './components/EcommerceTemplates';
import TemplateCatalog from './components/TemplateCatalog';
import EcommerceStoreManager from './components/EcommerceStoreManager';
import EcommerceCustomers from './components/EcommerceCustomers';
import EcommercePayments from './components/EcommercePayments';
import EcommerceShipping from './components/EcommerceShipping';
import { EcommerceProvider, useEcommerce } from './contexts/EcommerceContext';
import { Select, Space } from 'antd';

const { Title, Text } = Typography;
const { Sider, Content } = Layout;
const { Option } = Select;

const EcommerceTabContent = ({ itemVariants }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const { websiteId, websites, changeWebsite, allTemplates, activeTemplateId, changeTemplate } = useEcommerce();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];

  // Base path for ecommerce routes
  const match = location.pathname.match(/^(.*?\/website\/ecommerce)(?=\/|$)/);
  const basePath = match ? match[0] : '/workspace/website/ecommerce';

  const activeKey = ['dashboard', 'pages', 'builder', 'templates', 'preview', 'products', 'orders', 'customers', 'payments', 'shipping', 'settings'].includes(lastPart)
    ? lastPart
    : 'dashboard';

  const handleMenuClick = ({ key }) => {
    navigate(`${basePath}/${key}`);
  };

  const baseMenuItems = [
    { key: 'templates', icon: <LayoutTemplate size={18} />, label: 'Saved Stores' },
    { key: 'builder', icon: <Paintbrush size={18} />, label: 'Store Builder' },
  ];

  const storeMenuItems = [
    { key: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { key: 'pages', icon: <FileText size={18} />, label: 'Pages' },
    { key: 'preview', icon: <ShoppingBag size={18} />, label: 'Store Preview' },
    { key: 'products', icon: <Package size={18} />, label: 'Products' },
    { key: 'orders', icon: <ShoppingBag size={18} />, label: 'Orders' },
    { key: 'customers', icon: <Users size={18} />, label: 'Customers' },
    { key: 'payments', icon: <CreditCard size={18} />, label: 'Payments' },
    { key: 'shipping', icon: <Truck size={18} />, label: 'Shipping' },
    { key: 'settings', icon: <Settings size={18} />, label: 'Settings' }
  ];

  const menuItems = activeTemplateId ? storeMenuItems : baseMenuItems;

  const showSider = activeTemplateId && !['templates', 'catalog'].includes(lastPart);

  return (
    <motion.div variants={itemVariants} style={{ height: '100%', minHeight: 'calc(100vh - 200px)' }}>
      <Layout style={{ background: 'transparent', height: '100%' }}>
        {showSider && (
          <Sider
            width={240}
            style={{
              background: 'var(--bg-secondary)',
              borderRight: '1px solid var(--border-color)',
              borderRadius: '16px 0 0 16px',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '24px 16px' }}>
              <Title level={5} style={{ margin: 0, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingBag size={20} color="var(--accent-primary)" /> E-commerce
              </Title>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Store Management</Text>
            </div>
            <Menu
              mode="inline"
              selectedKeys={[activeKey]}
              onClick={handleMenuClick}
              items={menuItems}
              style={{
                borderRight: 'none',
                background: 'transparent',
                padding: '0 8px'
              }}
            />
          </Sider>
        )}
        <Layout style={{ background: 'transparent', padding: showSider ? '0 0 0 24px' : '0' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px 0 0' }}>
            {activeTemplateId && showSider && (
              <Space>
                <Text type="secondary" style={{ fontWeight: 600 }}>Active Store:</Text>
                <Text strong>{allTemplates?.find(t => t.id === activeTemplateId)?.name || activeTemplateId}</Text>
              </Space>
            )}
          </div>
          <Content style={{ position: 'relative' }}>
            {websiteId ? (
              <motion.div
                key={activeKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{ height: '100%' }}
              >
                <Routes>
                  {activeTemplateId && <Route path="dashboard" element={<EcommerceDashboard />} />}
                  {activeTemplateId && <Route path="products" element={<EcommerceProducts />} />}
                  {activeTemplateId && <Route path="orders" element={<EcommerceOrders />} />}
                  {activeTemplateId && <Route path="customers" element={<EcommerceCustomers />} />}
                  {activeTemplateId && <Route path="payments" element={<EcommercePayments />} />}
                  {activeTemplateId && <Route path="shipping" element={<EcommerceShipping />} />}
                  {activeTemplateId && <Route path="settings" element={<EcommerceSettings />} />}
                  
                  <Route path="builder/:templateId/:pageId?" element={<EcommerceStoreBuilder />} />
                  <Route path="builder" element={<EcommerceStoreBuilder />} />
                  <Route path="store/:templateId" element={<EcommerceStoreManager />} />
                  <Route path="pages" element={<EcommerceStoreManager templateId={activeTemplateId} />} />
                  <Route path="preview/:templateId?" element={<StorefrontRenderer templateId={activeTemplateId} />} />
                  <Route path="templates" element={<EcommerceTemplates />} />
                  <Route path="catalog" element={<TemplateCatalog />} />
                  
                  <Route path="*" element={<Navigate to="templates" replace />} />
                </Routes>
              </motion.div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column' }}>
                <Title level={4}>No Website Selected</Title>
                <Text type="secondary">Please select a website from the dropdown above to manage its e-commerce store.</Text>
              </div>
            )}
          </Content>
        </Layout>
      </Layout>
    </motion.div>
  );
};

const EcommerceTab = (props) => (
  <EcommerceProvider>
    <EcommerceTabContent {...props} />
  </EcommerceProvider>
);

export default EcommerceTab;
