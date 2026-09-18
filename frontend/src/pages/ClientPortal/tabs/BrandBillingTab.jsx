import React, { useState, useEffect } from 'react';
import { Row, Col, Typography, Tag, Table, Card, Button, Skeleton, message, Modal, Input, Badge } from 'antd';
import { Download, FileText, Calendar, CreditCard, Box, Zap, Shield, HelpCircle, Star, Check, Sparkles, Send, Users, Layers } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import api from '../../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const availableFeatures = [
  { id: 'hrms', label: 'HRMS' },
  { id: 'crm', label: 'CRM & Leads' },
  { id: 'website', label: 'Website Builder' },
  { id: 'social', label: 'Social Media' },
  { id: 'ads', label: 'Performance Ads' },
  { id: 'analytics', label: 'Google Analytics' },
  { id: 'chatgpt', label: 'ChatGPT AI' },
  { id: 'claude', label: 'Claude AI' },
  { id: 'canva', label: 'Canva Design' },
  { id: 'seo-aeo-geo', label: 'SEO/AEO/GEO' },
];

const availableIntegrations = [
  { type: 'whatsapp', name: 'WhatsApp Integration' },
  { type: 'sms', name: 'SMS Gateway' },
  { type: 'email', name: 'Email (SendPulse)' },
  { type: 'website', name: 'Lead Management' },
  { type: 'ekta', name: 'Ekta HR Integration' },
];

const BrandBillingTab = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [packageDetails, setPackageDetails] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmittingUpgrade, setIsSubmittingUpgrade] = useState(false);
  const [upgradeRemarks, setUpgradeRemarks] = useState('');

  useEffect(() => {
    if (user && user.brandPackageDetails) {
      setPackageDetails(user.brandPackageDetails);
    }
  }, [user]);

  // Card styles
  const cardStyle = {
    background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
    borderRadius: 16,
    padding: '24px',
    boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.02)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  };

  const planAmount = packageDetails?.price || '0';
  const interval = packageDetails?.billingInterval || 'Monthly';
  
  // Estimate next billing date based on user creation date
  let nextBillingDate = dayjs(user?.createdAt).add(1, 'month');
  if (interval === 'Yearly') {
    nextBillingDate = dayjs(user?.createdAt).add(1, 'year');
  }

  const handleRequestUpgrade = async () => {
    try {
      setIsSubmittingUpgrade(true);
      await api.post('/plan-upgrades', {
        requestedModules: packageDetails?.features || availableFeatures.map(f => f.id),
        remarks: upgradeRemarks || 'Requesting package upgrade for Direct Brand account'
      });
      message.success('Plan upgrade request submitted successfully! Our team will contact you shortly.');
      setIsModalOpen(false);
      setUpgradeRemarks('');
    } catch (err) {
      console.error('Error submitting plan upgrade:', err);
      message.error(err.response?.data?.message || 'Failed to submit upgrade request');
    } finally {
      setIsSubmittingUpgrade(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
          Subscription & Billing
        </Title>
        <Text style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Manage your workspace subscription, billing details, and payment methods.
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* Current Plan Overview */}
        <Col span={24} md={16}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <Text style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: 1, textTransform: 'uppercase' }}>
                  CURRENT SUBSCRIPTION
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <Title level={3} style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {packageDetails?.name || user?.packageName || 'Enterprise Package'}
                  </Title>
                  <Tag style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: 'none', borderRadius: 6, fontWeight: 700, padding: '2px 10px' }}>
                    Active
                  </Tag>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'baseline' }}>
                  ₹{Number(planAmount).toLocaleString()}
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 4 }}>
                    /{interval === 'Yearly' ? 'yr' : 'mo'}
                  </span>
                </span>
              </div>
            </div>

            <div style={{ background: isDark ? 'rgba(0, 0, 0, 0.2)' : '#f8fafc', padding: 16, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Calendar size={14} color="var(--text-secondary)" />
                  <Text style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Next Payment Due</Text>
                </div>
                <Text style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {nextBillingDate.format('MMM DD, YYYY')}
                </Text>
              </div>
              <div style={{ width: 1, height: 40, background: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0' }}></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <CreditCard size={14} color="var(--text-secondary)" />
                  <Text style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Payment Method</Text>
                </div>
                <Text style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Invoice via Email
                </Text>
              </div>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', gap: 12 }}>
              <Button 
                type="primary" 
                size="large" 
                style={{ fontWeight: 600, borderRadius: 8, background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
                onClick={() => setIsModalOpen(true)}
              >
                Upgrade Package
              </Button>
              <Button 
                size="large" 
                style={{ fontWeight: 600, borderRadius: 8, color: 'var(--text-secondary)' }}
                onClick={() => message.info('Please contact your administrator to modify or cancel your subscription.')}
              >
                Cancel Subscription
              </Button>
            </div>
          </div>
        </Col>

        {/* Features / Details */}
        <Col span={24} md={8}>
          <div style={cardStyle}>
            <Text style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
              PACKAGE INCLUDES
            </Text>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ background: 'rgba(51, 149, 255, 0.1)', padding: 8, borderRadius: 8, color: '#3395FF' }}>
                  <Box size={18} />
                </div>
                <div>
                  <Text style={{ display: 'block', fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>User Licenses</Text>
                  <Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Up to {packageDetails?.userCount || 5} active team members</Text>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 8, color: '#10b981' }}>
                  <Zap size={18} />
                </div>
                <div>
                  <Text style={{ display: 'block', fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>Core Features</Text>
                  <Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Full access to workspace & analytics</Text>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: 8, borderRadius: 8, color: '#f59e0b' }}>
                  <Shield size={18} />
                </div>
                <div>
                  <Text style={{ display: 'block', fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>Priority Support</Text>
                  <Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>24/7 technical assistance</Text>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 24 }}>
              <Button 
                type="text" 
                icon={<HelpCircle size={14} />} 
                style={{ padding: 0, color: 'var(--accent-primary)', fontWeight: 600 }}
                onClick={() => setIsModalOpen(true)}
              >
                View full package details
              </Button>
            </div>
          </div>
        </Col>

        {/* Payment History */}
        <Col span={24}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                Billing History
              </Text>
              {/* <Button icon={<Download size={14} />} style={{ borderRadius: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Export
              </Button> */}
            </div>
            
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <FileText size={32} color="var(--text-tertiary)" style={{ marginBottom: 12, opacity: 0.5 }} />
              <Text style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>
                No past billing records found
              </Text>
              <Text style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Your future invoices and receipts will appear here.
              </Text>
            </div>
          </div>
        </Col>
      </Row>

      {/* Direct Brand Package Details & Upgrade Modal */}
      <Modal
        title={null}
        footer={null}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        width={680}
        bodyStyle={{ padding: 0, borderRadius: 16, overflow: 'hidden' }}
        style={{ top: 20 }}
        closeIcon={<span style={{ color: '#fff', fontSize: 22, lineHeight: 1 }}>×</span>}
      >
        <div>
          {/* Header Banner */}
          <div style={{ 
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #3b82f6 100%)', 
            padding: '32px 28px',
            color: '#fff',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ 
                width: 60, height: 60, borderRadius: 16, 
                background: 'rgba(255,255,255,0.2)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)'
              }}>
                <Star size={30} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Title level={3} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>
                    {packageDetails?.name || user?.packageName || 'Enterprise Package'}
                  </Title>
                  <Tag style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, padding: '2px 10px' }}>
                    Active
                  </Tag>
                </div>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
                  {packageDetails?.description || 'Direct Brand Subscription Package with full platform feature entitlements.'}
                </Text>
              </div>
            </div>
          </div>

          <div style={{ padding: '24px 28px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div style={{ padding: 16, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  PRICE ({interval})
                </Text>
                <Text style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  ₹{Number(planAmount).toLocaleString()}
                </Text>
              </div>

              <div style={{ padding: 16, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Users size={14} color="var(--text-secondary)" />
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>MAX USERS</Text>
                </div>
                <Text style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {packageDetails?.userCount || 5} Seats
                </Text>
              </div>

              <div style={{ padding: 16, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Layers size={14} color="var(--text-secondary)" />
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>BILLING TYPE</Text>
                </div>
                <Text style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Direct Brand
                </Text>
              </div>
            </div>

            {/* Included Features */}
            <div style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 14, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                Included Modules & Features
              </Title>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {availableFeatures.map(feat => {
                  const isIncluded = !packageDetails?.features || packageDetails.features.includes(feat.id);
                  return (
                    <div 
                      key={feat.id} 
                      style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                        background: isIncluded ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-tertiary)', 
                        padding: '10px 14px', 
                        borderRadius: 8,
                        border: isIncluded ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-color)',
                        opacity: isIncluded ? 1 : 0.6
                      }}
                    >
                      <span style={{ 
                        fontSize: 13, 
                        fontWeight: 600, 
                        color: isIncluded ? 'var(--text-primary)' : 'var(--text-secondary)' 
                      }}>
                        {feat.label}
                      </span>
                      {isIncluded ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: 12, fontWeight: 700 }}>
                          <Check size={14} /> Included
                        </div>
                      ) : (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-color)' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Included Integrations */}
            <div style={{ marginBottom: 28 }}>
              <Title level={5} style={{ marginBottom: 14, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                Supported Integrations
              </Title>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {availableIntegrations.map(integ => {
                  const isIncluded = !packageDetails?.integrations || packageDetails.integrations.includes(integ.type);
                  return (
                    <div
                      key={integ.type}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: isIncluded ? 'rgba(51, 149, 255, 0.06)' : 'var(--bg-tertiary)',
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: isIncluded ? '1px solid rgba(51, 149, 255, 0.25)' : '1px solid var(--border-color)',
                        opacity: isIncluded ? 1 : 0.6
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: isIncluded ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {integ.name}
                      </span>
                      {isIncluded ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#3395FF', fontSize: 12, fontWeight: 700 }}>
                          <Check size={14} /> Active
                        </div>
                      ) : (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-color)' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Request Plan Upgrade Section */}
            <div style={{ 
              background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc', 
              borderRadius: 12, 
              padding: 20, 
              border: '1px solid var(--border-color)' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Sparkles size={18} color="var(--accent-primary)" />
                <Title level={5} style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                  Request Package Upgrade
                </Title>
              </div>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
                Need additional seats, custom module entitlements, or an upgraded billing plan? Submit your request below to notify our administration team.
              </Text>

              <TextArea
                rows={3}
                placeholder="Enter details about your upgrade request (e.g. Need 10 user seats, custom API access...)"
                value={upgradeRemarks}
                onChange={(e) => setUpgradeRemarks(e.target.value)}
                style={{ borderRadius: 8, marginBottom: 16, background: isDark ? 'rgba(0,0,0,0.2)' : '#fff' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <Button onClick={() => setIsModalOpen(false)} style={{ borderRadius: 8, fontWeight: 600 }}>
                  Close
                </Button>
                <Button 
                  type="primary" 
                  icon={<Send size={14} />} 
                  loading={isSubmittingUpgrade}
                  onClick={handleRequestUpgrade}
                  style={{ borderRadius: 8, fontWeight: 700, background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
                >
                  Submit Upgrade Request
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BrandBillingTab;
