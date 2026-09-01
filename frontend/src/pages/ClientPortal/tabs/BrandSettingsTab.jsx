import React, { useState, useEffect } from 'react';
import { Typography, Tabs, Card, Form, Input, Button, Upload, Select, message, Tag, Modal, Checkbox, ColorPicker } from 'antd';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Upload as UploadIcon, Building, Package, Shield, ExternalLink, Plug, Users, Bell } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import IntegrationsTab from '../../Settings/tabs/IntegrationsTab';
import UserManagementTab from '../../Settings/tabs/UserManagementTab';
import NotificationsTab from '../../Settings/tabs/NotificationsTab';

const { Title, Text } = Typography;

const availableFeatures = [
  { id: 'hrms', label: 'HRMS' },
  { id: 'crm', label: 'CRM & Leads' },
  { id: 'website', label: 'Website Builder' },
  { id: 'social', label: 'Social Media' },
  { id: 'ads', label: 'Performance Ads' },
  { id: 'analytics', label: 'Google Analytics' },
  { id: 'chatgpt', label: 'Chatgpt' },
  { id: 'canva', label: 'Canva' },
  { id: 'seo-aeo-geo', label: 'SEO/AEO/GEO' },
  // { id: 'benchmark', label: 'Benchmark' },
];

const BrandSettingsTab = () => {
  const { user, setUser } = useAuth();
  const { updatePreviewTheme } = useTheme();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'details');

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state?.activeTab]);

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoDarkPreview, setLogoDarkPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLogoDark, setUploadingLogoDark] = useState(false);
  
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeForm] = Form.useForm();
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const handleValuesChange = (changedValues) => {
    if (changedValues.theme_primaryColor || changedValues.theme_secondaryColor) {
      const primary = changedValues.theme_primaryColor ? (typeof changedValues.theme_primaryColor === 'string' ? changedValues.theme_primaryColor : changedValues.theme_primaryColor.toHexString()) : null;
      const secondary = changedValues.theme_secondaryColor ? (typeof changedValues.theme_secondaryColor === 'string' ? changedValues.theme_secondaryColor : changedValues.theme_secondaryColor.toHexString()) : null;
      updatePreviewTheme(primary, secondary);
    }
  };

  const handleSaveDetails = async (values) => {
    try {
      setLoading(true);
      const res = await fetch('/api/brands/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          companyName: values.name,
          contactEmail: values.email,
          domain: values.website,
          industry: values.industry,
          logo: form.getFieldValue('logo'),
          logoDark: form.getFieldValue('logoDark'),
          theme: {
            primaryColor: typeof values.theme_primaryColor === 'string' ? values.theme_primaryColor : values.theme_primaryColor?.toHexString(),
            secondaryColor: typeof values.theme_secondaryColor === 'string' ? values.theme_secondaryColor : values.theme_secondaryColor?.toHexString()
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        message.success('Brand details updated successfully');
        if (data.data) {
          const updatedUser = { ...user, ...data.data };
          if (data.data.theme) {
            updatedUser.effectiveTheme = data.data.theme;
          }
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
          window.dispatchEvent(new Event('user-updated'));
        }
      } else {
        message.error(data.message || 'Failed to update brand details');
      }
    } catch (error) {
      message.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const customUpload = async ({ file, onSuccess, onError }) => {
    try {
      setUploadingLogo(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'brand-logos');

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      const data = await res.json();

      if (data && data.success) {
        const url = data.data.url;
        setLogoPreview(url);
        form.setFieldsValue({ logo: url });
        onSuccess(data);
        message.success('Logo uploaded successfully.');
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error(error);
      onError(error);
      message.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const customUploadDark = async ({ file, onSuccess, onError }) => {
    try {
      setUploadingLogoDark(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'brand-logos');

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      const data = await res.json();

      if (data && data.success) {
        const url = data.data.url;
        setLogoDarkPreview(url);
        form.setFieldsValue({ logoDark: url });
        onSuccess(data);
        message.success('Dark mode logo uploaded successfully.');
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error(error);
      onError(error);
      message.error('Failed to upload dark mode logo');
    } finally {
      setUploadingLogoDark(false);
    }
  };

  const handleRequestUpgrade = async (values) => {
    try {
      setUpgradeLoading(true);
      const res = await fetch('/api/plan-upgrades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          requestedModules: values.modules || [],
          remarks: values.remarks || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        message.success('Plan upgrade request submitted successfully');
        setIsUpgradeModalOpen(false);
        upgradeForm.resetFields();
      } else {
        message.error(data.message || 'Failed to submit request');
      }
    } catch (error) {
      message.error('An error occurred');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const brandDetailsContent = (
    <div style={{ maxWidth: 800 }}>
      <Card 
        className="glassmorphism" 
        style={{ borderRadius: 16, border: '1px solid var(--border-color)', marginBottom: 24 }}
        bodyStyle={{ padding: 32 }}
      >
        <Title level={4} style={{ marginTop: 0, marginBottom: 24, fontWeight: 800 }}>Brand Profile</Title>
        <Form form={form} layout="vertical" onValuesChange={handleValuesChange} onFinish={handleSaveDetails} initialValues={{ name: user?.companyName || user?.name || 'My Brand', email: user?.contactEmail || user?.email, website: user?.domain, industry: user?.industry, logo: user?.logo, logoDark: user?.logoDark, theme_primaryColor: user?.effectiveTheme?.primaryColor || user?.theme?.primaryColor || '#034EA1', theme_secondaryColor: user?.effectiveTheme?.secondaryColor || user?.theme?.secondaryColor || '#0ea5e9' }}>
          <div style={{ display: 'flex', gap: 24, marginBottom: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Form.Item name="logo" hidden><Input /></Form.Item>
            <Form.Item name="logoDark" hidden><Input /></Form.Item>
            
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Light Mode Logo</div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div style={{ width: 88, height: 88, borderRadius: 12, background: '#f3f4f6', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {(logoPreview || user?.logo) ? (
                    <img src={logoPreview || user?.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <><UploadIcon size={24} color="#6b7280" style={{ marginBottom: 8 }} /><span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Logo</span></>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Upload your brand's light mode logo.</Text>
                  <Upload customRequest={customUpload} showUploadList={false} accept="image/*">
                    <Button loading={uploadingLogo} style={{ borderRadius: 8 }}>Upload Light</Button>
                  </Upload>
                </div>
              </div>
            </div>
            
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Dark Mode Logo</div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div style={{ width: 88, height: 88, borderRadius: 12, background: '#1f2937', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {(logoDarkPreview || user?.logoDark) ? (
                    <img src={logoDarkPreview || user?.logoDark} alt="Logo Dark" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <><UploadIcon size={24} color="#9ca3af" style={{ marginBottom: 8 }} /><span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>Logo Dark</span></>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Upload your brand's dark mode logo.</Text>
                  <Upload customRequest={customUploadDark} showUploadList={false} accept="image/*">
                    <Button loading={uploadingLogoDark} style={{ borderRadius: 8 }}>Upload Dark</Button>
                  </Upload>
                </div>
              </div>
            </div>
          </div>

          <Form.Item name="name" label={<span style={{ fontWeight: 600 }}>Brand Name</span>} rules={[{ required: true }]}>
            <Input size="large" style={{ borderRadius: 8 }} />
          </Form.Item>
          
          <Form.Item name="email" label={<span style={{ fontWeight: 600 }}>Primary Contact Email</span>} rules={[{ required: true, type: 'email' }]}>
            <Input size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item name="website" label={<span style={{ fontWeight: 600 }}>Website URL</span>}>
            <Input size="large" placeholder="https://" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item name="industry" label={<span style={{ fontWeight: 600 }}>Industry</span>}>
            <Select size="large" placeholder="Select industry">
              <Select.Option value="ecommerce">E-Commerce</Select.Option>
              <Select.Option value="saas">SaaS</Select.Option>
              <Select.Option value="realestate">Real Estate</Select.Option>
              <Select.Option value="healthcare">Healthcare</Select.Option>
              <Select.Option value="other">Other</Select.Option>
            </Select>
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item 
              name="theme_primaryColor" 
              label={<span style={{ fontWeight: 600 }}>Primary Color</span>}
            >
              <ColorPicker format="hex" />
            </Form.Item>
            <Form.Item 
              name="theme_secondaryColor" 
              label={<span style={{ fontWeight: 600 }}>Secondary Color</span>}
            >
              <ColorPicker format="hex" />
            </Form.Item>
          </div>

          <Form.Item style={{ marginBottom: 0, marginTop: 32 }}>
            <Button type="primary" htmlType="submit" loading={loading} style={{ background: 'var(--accent-primary)', fontWeight: 700, borderRadius: 8, height: 40, padding: '0 32px' }}>
              Save Changes
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );

  const brandPlansContent = (
    <div style={{ maxWidth: 800 }}>
      <Card 
        className="glassmorphism" 
        style={{ borderRadius: 16, border: '1px solid var(--border-color)', marginBottom: 24 }}
        bodyStyle={{ padding: 32 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <Title level={4} style={{ marginTop: 0, marginBottom: 8, fontWeight: 800 }}>Current Subscription</Title>
            <Text type="secondary" style={{ fontSize: 14 }}>Manage your active features and usage limits.</Text>
          </div>
          <Tag color="green" style={{ borderRadius: 12, padding: '4px 12px', fontWeight: 700, fontSize: 13, border: 'none', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Active</Tag>
        </div>

        <div style={{ background: 'var(--bg-tertiary)', padding: 24, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ background: 'var(--accent-primary)', padding: 8, borderRadius: 8, color: '#fff' }}>
              <Package size={20} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{user?.packageName || 'Custom Package'}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Billed monthly via Agency</div>
            </div>
          </div>
          
          <div style={{ height: 1, background: 'var(--border-color)', margin: '16px 0' }} />
          
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 500 }}><Shield size={16} color="var(--accent-secondary)" /> Full access to Workspace Apps</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 500 }}><Shield size={16} color="var(--accent-secondary)" /> Unlimited Team Seats</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 500 }}><Shield size={16} color="var(--accent-secondary)" /> Advanced Analytics & Reports</li>
          </ul>
        </div>

        <Button onClick={() => setIsUpgradeModalOpen(true)} type="primary" style={{ background: 'var(--accent-primary)', fontWeight: 700, borderRadius: 8, height: 40, display: 'flex', alignItems: 'center', gap: 8 }}>
          Request Plan Upgrade <ExternalLink size={16} />
        </Button>
      </Card>
      
      <Modal
        title={<span style={{ fontWeight: 800, fontSize: 18 }}>Upgrade Your Plan</span>}
        open={isUpgradeModalOpen}
        onCancel={() => setIsUpgradeModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsUpgradeModalOpen(false)} style={{ borderRadius: 8 }}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" loading={upgradeLoading} onClick={() => upgradeForm.submit()} style={{ background: 'var(--accent-primary)', fontWeight: 600, borderRadius: 8 }}>
            Submit Request
          </Button>
        ]}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>Please select the additional modules you require. Our team will reach out to discuss pricing and complete the setup.</Text>
        
        <Form form={upgradeForm} layout="vertical" onFinish={handleRequestUpgrade}>
          <Form.Item name="modules" label={<span style={{ fontWeight: 600 }}>Select Additional Modules</span>}>
             <Checkbox.Group style={{ width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {availableFeatures.map(feat => {
                    const isIncluded = user?.features?.includes(feat.id);
                    return (
                      <Checkbox key={feat.id} value={feat.id} disabled={isIncluded} style={{ fontWeight: 500, opacity: isIncluded ? 0.5 : 1 }}>
                        {feat.label} {isIncluded && '(Included)'}
                      </Checkbox>
                    );
                  })}
                </div>
              </Checkbox.Group>
          </Form.Item>
          <Form.Item name="remarks" label={<span style={{ fontWeight: 600 }}>Remarks (Optional)</span>}>
            <Input.TextArea rows={3} placeholder="Any specific requirements?" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >
      <motion.div variants={itemVariants} style={{ marginBottom: 32 }}>
        <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5 }}>ADMINISTRATION</Text>
        <Title level={2} style={{ margin: '4px 0 8px 0', fontWeight: 800 }}>Brand Settings</Title>
        <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>Manage your brand's profile and active subscriptions.</Text>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          tabBarStyle={{ fontWeight: 600, color: 'var(--text-secondary)' }}
          items={[
            { key: 'details', label: <span><Building size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />Brand Details</span>, children: brandDetailsContent },
            { key: 'users', label: <span><Users size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />User Management</span>, children: <UserManagementTab /> },
            { key: 'integrations', label: <span><Plug size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />Integrations</span>, children: <IntegrationsTab /> },
            { key: 'plans', label: <span><Package size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />Brand Plans</span>, children: brandPlansContent },
            { key: '4', label: <span><Bell size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />Notifications</span>, children: <NotificationsTab /> },
          ]}
        />
      </motion.div>
    </motion.div>
  );
};

export default BrandSettingsTab;
