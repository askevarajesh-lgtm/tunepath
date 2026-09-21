import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Avatar, Tag, Divider, Tabs, Modal, Checkbox, Button, message, Upload } from 'antd';
import { motion } from 'framer-motion';
import { Building2, User, Shield, Star, Briefcase, Link, CreditCard, Users, Camera } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import IntegrationsTab from '../../Settings/tabs/IntegrationsTab';
import ClientIntegrationsTab from './ClientIntegrationsTab';
import BrandUsersTab from './BrandUsersTab';

const availableFeatures = [
  { id: 'hrms', label: 'HRMS' },
  { id: 'crm', label: 'CRM & Leads' },
  { id: 'website', label: 'Website Builder' },
  { id: 'social', label: 'Social Media' },
  { id: 'ads', label: 'Performance Ads' },
  { id: 'analytics', label: 'Google Analytics' },
  { id: 'chatgpt', label: 'Chatgpt' },
  { id: 'claude', label: 'Claude AI' },
  { id: 'canva', label: 'Canva' },
  { id: 'seo-aeo-geo', label: 'SEO/AEO/GEO' },
  // { id: 'benchmark', label: 'Benchmark' },
];

const { Title, Text } = Typography;

const ProfileContent = ({ user, setUser }) => {
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);

  useEffect(() => {
    if (user?.avatar) {
      setAvatarPreview(user.avatar);
    }
  }, [user]);

  const customUploadAvatar = async ({ file, onSuccess, onError }) => {
    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'user-avatars');

      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
        const url = res.data.data.url;
        setAvatarPreview(url);
        
        const updateRes = await api.put(`/users/${user._id || user.id}`, { avatar: url });
        
        if (updateRes.data && updateRes.data.data) {
          const updatedUser = { ...user, ...updateRes.data.data };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
          window.dispatchEvent(new Event('user-updated'));
        }

        onSuccess(res.data);
        message.success('Profile picture updated successfully.');
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error(error);
      onError(error);
      message.error('Failed to upload profile picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <>
      <motion.div variants={itemVariants}>
        <Card bordered={false} className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)', marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={20} color="var(--accent-primary)" /> My Profile
          </Title>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
            <div style={{ position: 'relative' }}>
              <Avatar src={avatarPreview} size={80} style={{ backgroundColor: 'var(--accent-primary)', fontSize: 32, fontWeight: 800 }}>
                {!avatarPreview && (user?.name ? user.name.charAt(0).toUpperCase() : 'U')}
              </Avatar>
              <Upload customRequest={customUploadAvatar} showUploadList={false} accept="image/*">
                <Button 
                  shape="circle" 
                  icon={<Camera size={14} />} 
                  loading={uploadingAvatar}
                  style={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    right: -4, 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                />
              </Upload>
            </div>
            <div>
              <Title level={4} style={{ margin: '0 0 4px 0', fontWeight: 800 }}>{user?.name || 'Client User'}</Title>
              <Text type="secondary" style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>{user?.email}</Text>
              <Tag color="blue" style={{ borderRadius: 12, border: 'none', fontWeight: 700, padding: '2px 12px' }}>
                View Only Access
              </Tag>
            </div>
          </div>

          <Divider />

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <div style={{ marginBottom: 24 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>Full Name</Text>
                <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user?.name || '-'}
                </div>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div style={{ marginBottom: 24 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>Email Address</Text>
                <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user?.email || '-'}
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card bordered={false} className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)' }}>
          <Title level={4} style={{ marginBottom: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={20} color="var(--accent-secondary)" /> Company Information
          </Title>
          
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <div style={{ marginBottom: 24 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>Company Name</Text>
                <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user?.companyName || 'Prestige Estates'}
                </div>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div style={{ marginBottom: 24 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>Account Status</Text>
                <div style={{ padding: '10px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center' }}>
                  <Tag color="success" style={{ borderRadius: 12, border: 'none', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-secondary)', fontWeight: 700, margin: 0 }}>
                    <Star size={12} style={{ marginRight: 4, display: 'inline-block', verticalAlign: '-1px' }} /> Active
                  </Tag>
                </div>
              </div>
            </Col>
          </Row>

          <div style={{ marginTop: 16, padding: '16px 20px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <Text style={{ color: 'var(--accent-warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} /> Contact your dedicated Agency Manager to update company details, manage billing, or adjust permissions.
            </Text>
          </div>
        </Card>
      </motion.div>
    </>
  );
};

const ClientSettingsTab = () => {
  const { user, setUser } = useAuth();
  
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedModules, setSelectedModules] = useState([]);
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false);
  const [clientPackageDetails, setClientPackageDetails] = useState(null);
  const [freshUser, setFreshUser] = useState(user);

  useEffect(() => {
    const fetchPackageDetails = async () => {
      try {
        const meRes = await api.get('/auth/me');
        if (meRes.data.success) {
          const freshUserData = meRes.data.user;
          setFreshUser(freshUserData);
          
          if (freshUserData.packageName) {
            const pkgRes = await api.get('/packages?type=client');
            if (pkgRes.data.success) {
              const pkg = pkgRes.data.data.find(p => p.name === freshUserData.packageName);
              if (pkg) {
                setClientPackageDetails(pkg);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch fresh user or client package details', error);
      }
    };
    fetchPackageDetails();
  }, [user]);

  const handleOpenUpgrade = () => {
    setIsUpgradeModalOpen(true);
  };

  const handleUpgradeSubmit = async () => {
    if (selectedModules.length === 0) {
      return message.warning('Please select at least one additional module to request.');
    }
    
    try {
      setSubmittingUpgrade(true);
      const moduleLabels = selectedModules.map(id => availableFeatures.find(f => f.id === id)?.label).filter(Boolean);
      const currentPlanName = freshUser?.packageName || 'Custom';
      
      const title = `Client Module Upgrade Request`;
      let description = `Client requested additional modules for their ${currentPlanName} package.\n\n`;
      description += `Additional Modules Requested: ${moduleLabels.join(', ')}`;
      
      await api.post('/sla-success', {
        title,
        description,
        dueDate: new Date(Date.now() + 86400000 * 3), // 3 days from now
        priority: 'High',
        triggerType: 'Client Issue',
        entityType: 'SupportTicket',
        clientId: freshUser?._id
      });
      
      message.success('Upgrade request submitted successfully. Your Agency Manager will contact you soon.');
      setIsUpgradeModalOpen(false);
      setSelectedModules([]);
    } catch (error) {
      console.error(error);
      message.error(`Failed to submit upgrade request: ${error.response?.data?.message || error.message}`);
    } finally {
      setSubmittingUpgrade(false);
    }
  };

  const SubscriptionContent = () => {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card bordered={false} className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <Title level={4} style={{ margin: '0 0 8px 0', fontWeight: 700 }}>Current Plan</Title>
              <Text type="secondary">You are currently on the <strong style={{ color: 'var(--text-primary)' }}>{freshUser?.packageName || 'Custom'}</strong> plan.</Text>
            </div>
            <Tag color="success" style={{ borderRadius: 12, padding: '4px 12px', fontSize: 14, fontWeight: 600, border: '1px solid var(--accent-secondary)', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-secondary)' }}>
              <Star size={14} style={{ marginRight: 6, display: 'inline-block', verticalAlign: '-2px' }} /> Active
            </Tag>
          </div>
          
          <Divider />
          
          <Row gutter={[24, 24]}>
            <Col xs={24} md={12}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Price / Cycle</Text>
              <Text style={{ fontSize: 16, fontWeight: 600 }}>{clientPackageDetails ? clientPackageDetails.price : 'Contact Agency'}</Text>
            </Col>
            <Col xs={24} md={12}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Subscription Date</Text>
              <Text style={{ fontSize: 16, fontWeight: 600 }}>
                {clientPackageDetails?.createdAt ? new Date(clientPackageDetails.createdAt).toLocaleDateString() : (freshUser?.createdAt ? new Date(freshUser.createdAt).toLocaleDateString() : 'N/A')}
              </Text>
            </Col>
          </Row>

          <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
            <Button type="primary" onClick={handleOpenUpgrade} style={{ background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 600 }} size="large">Upgrade Plan</Button>
          </div>
        </Card>
      </motion.div>
    );
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const tabItems = [
    {
      key: '1',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><User size={16} /> Profile</span>,
      children: <ProfileContent user={user} setUser={setUser} />,
    },
    ...(user?.role === 'agency_client' ? [
      {
        key: '3',
        label: <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><Shield size={16} /> Subscription</span>,
        children: <SubscriptionContent />,
      }
    ] : []),
    {
      key: '2',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><Link size={16} /> Integrations</span>,
      children: <ClientIntegrationsTab user={freshUser} />,
    },
    ...(user?.role === 'agency_client' ? [
      {
        key: '4',
        label: <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><Users size={16} /> Team</span>,
        children: <BrandUsersTab user={freshUser || user} />,
      }
    ] : [])
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Account Settings</Title>
        <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>
          View your profile, company details, and connected integrations.
        </Text>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Tabs items={tabItems} style={{ marginBottom: 32 }} />
      </motion.div>

      <Modal
        title="Upgrade Your Plan"
        open={isUpgradeModalOpen}
        onCancel={() => setIsUpgradeModalOpen(false)}
        onOk={handleUpgradeSubmit}
        confirmLoading={submittingUpgrade}
        okText="Submit Request"
        okButtonProps={{ style: { background: 'var(--accent-primary)' } }}
        width={600}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            Please select the additional modules you require. Our team will reach out to discuss pricing and complete the setup.
          </Text>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Select Additional Modules</label>
            <Checkbox.Group 
              style={{ width: '100%' }} 
              value={[...(freshUser?.features || []), ...selectedModules]}
              onChange={(checkedValues) => {
                // Filter out the ones already in the plan
                const newModules = checkedValues.filter(v => !(freshUser?.features || []).includes(v));
                setSelectedModules(newModules);
              }}
            >
              <Row gutter={[16, 16]}>
                {availableFeatures.filter(feat => {
                  // Only show features that the AGENCY has
                  return (freshUser?.agencyFeatures || []).includes(feat.id);
                }).map(feat => {
                  const isAlreadyInPlan = freshUser?.features?.includes(feat.id);
                  return (
                    <Col span={12} key={feat.id}>
                      <Checkbox value={feat.id} disabled={isAlreadyInPlan}>
                        {feat.label} {isAlreadyInPlan && <Text type="secondary" style={{fontSize: 12}}>(Included)</Text>}
                      </Checkbox>
                    </Col>
                  );
                })}
              </Row>
            </Checkbox.Group>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};

export default ClientSettingsTab;