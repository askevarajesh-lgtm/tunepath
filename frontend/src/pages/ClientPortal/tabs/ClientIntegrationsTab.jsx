import React, { useState } from 'react';
import { Typography, Row, Col, Switch, Button, Tag, Spin } from 'antd';
import { motion } from 'framer-motion';
import { Globe, ArrowRight, Settings, MessageCircle, MessageSquare, Mail, CreditCard, Users } from 'lucide-react';

import WebsiteConfigPage from '../../integrations/WebsiteConfigPage';
import WhatsAppConfigPage from '../../integrations/WhatsAppConfigPage';
import SmsConfigPage from '../../integrations/SmsConfigPage';
import EmailConfigPage from '../../integrations/EmailConfigPage';
import PaymentConfigPage from '../../integrations/PaymentConfigPage';
import EktaHrInlineConfigPage from '../../integrations/EktaHrInlineConfigPage';

import { useGetIntegrationsQuery, useUpdateIntegrationMutation, useCreateIntegrationMutation } from '../../../api/integrationApi';

const { Title, Text } = Typography;

const cardStyles = `
  /* ── Card shell ── */
  .int-card {
    position: relative;
    border-radius: 20px;
    border: 1.5px solid #ebebeb;
    cursor: pointer;
    overflow: hidden;
    transition: transform 0.28s cubic-bezier(.22,.68,0,1.2),
                box-shadow 0.28s ease,
                border-color 0.28s ease;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04);
    background: var(--bg-secondary);
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .int-card:hover {
    transform: translateY(-6px) scale(1.01);
    box-shadow: 0 8px 30px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
  }

  /* ── Coloured top banner ── */
  .int-banner {
    position: relative;
    height: 88px;
    overflow: hidden;
    background: linear-gradient(135deg, var(--primary-color) 0%, rgba(37, 99, 235, 0.8) 55%, var(--primary-color) 100%);
  }

  /* decorative circle blobs on banner */
  .int-blob1 {
    position: absolute;
    width: 130px;
    height: 130px;
    border-radius: 50%;
    background: rgba(255,255,255,0.10);
    top: -40px;
    right: -20px;
    pointer-events: none;
  }
  .int-blob2 {
    position: absolute;
    width: 70px;
    height: 70px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    bottom: -28px;
    right: 55px;
    pointer-events: none;
  }
  .int-blob3 {
    position: absolute;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
    top: 10px;
    left: 80px;
    pointer-events: none;
  }

  /* ── Icon circle on banner ── */
  .int-icon-wrap {
    position: absolute;
    top: 18px;
    left: 22px;
    width: 50px;
    height: 50px;
    border-radius: 14px;
    background: rgba(255,255,255,0.20);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid rgba(255,255,255,0.38);
    box-shadow: 0 2px 10px rgba(0,0,0,0.14);
  }

  /* ── Toggle pinned to top-right of banner ── */
  .int-toggle-wrap {
    position: absolute;
    top: 14px;
    right: 16px;
    z-index: 2;
    background: rgba(255,255,255,0.18);
    border-radius: 20px;
    padding: 4px 8px;
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.30);
  }

  .int-toggle-wrap .ant-switch-checked { background: var(--primary-color) !important; }

  .int-toggle-wrap .ant-switch {
    background: rgba(0,0,0,0.20) !important;
  }

  /* ── Card body ── */
  .int-body {
    padding: 18px 22px 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .int-title {
    font-size: 16px;
    font-weight: 600;
    display: block;
    margin-bottom: 10px;
    color: var(--text-primary);
  }

  /* ── Status badges ── */
  .int-badges {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .int-dot {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.6;
  }

  .int-dot-pulse {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }

  .int-dot-inactive { background: #f5f5f5; color: #999; border: 1px solid #e8e8e8; }
  .int-dot-inactive .int-dot-pulse { background: #ccc; }

  .int-dot-active {
    color: var(--primary-color);
    background: rgba(37, 99, 235, 0.08);
    border: 1px solid rgba(37, 99, 235, 0.25);
  }
  .int-dot-active .int-dot-pulse { 
    background: var(--primary-color); 
    animation: int-pulse 1.8s infinite; 
  }

  @keyframes int-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(1.3); }
  }

  .int-dot-configured { color: var(--accent-primary); border: 1px solid #bfdbfe; }

  /* ── Description ── */
  .int-desc {
    font-size: 13px;
    color: #8a8a8a;
    line-height: 1.65;
    margin-bottom: 18px;
    flex: 1;
  }

  /* ── Footer ── */
  .int-footer {
    border-top: 1px solid #f0f0f0;
    padding-top: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: auto;
  }

  /* CTA button */
  .int-cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 18px;
    border-radius: 10px;
    border: none;
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    transition: filter 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
    color: #fff;
    background: linear-gradient(135deg, var(--primary-color), rgba(37, 99, 235, 0.85));
    box-shadow: 0 3px 10px rgba(37, 99, 235, 0.30);
  }

  .int-cta-btn:hover  { filter: brightness(1.08); transform: translateY(-1px); }
  .int-cta-btn:active { transform: scale(0.97); }

  /* Arrow */
  .int-arrow {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #bbb;
    font-size: 13px;
    flex-shrink: 0;
    transition: background 0.2s, color 0.2s, transform 0.2s;
  }

  .int-card:hover .int-arrow { transform: translateX(3px); color: var(--primary-color); }

  /* hover border glow */
  .int-card::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 20px;
    border: 2px solid transparent;
    pointer-events: none;
    transition: border-color 0.28s ease;
  }

  .int-card:hover::after { border-color: rgba(37, 99, 235, 0.27); }
`;

const GearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IntegrationCard = ({ title, description, icon: Icon, active, configured, buttonText, onConfigure, onToggle }) => {
  return (
    <>
      <style>{cardStyles}</style>
      <div className="int-card" onClick={onConfigure} style={{ '--primary-color': 'var(--accent-primary)' }}>
        <div className="int-banner">
          <div className="int-blob1" />
          <div className="int-blob2" />
          <div className="int-blob3" />
          <div className="int-icon-wrap">
            <Icon size={24} color="#fff" />
          </div>
          <div className="int-toggle-wrap" onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={active}
              onChange={onToggle}
              size="small"
            />
          </div>
        </div>

        <div className="int-body">
          <span className="int-title">{title}</span>

          <div className="int-badges">
            <span className={`int-dot ${active ? "int-dot-active" : "int-dot-inactive"}`}>
              <span className="int-dot-pulse" />
              {active ? "Active" : "Inactive"}
            </span>
            {configured && (
              <span className="int-dot int-dot-configured">✦ Configured</span>
            )}
          </div>

          <p className="int-desc">{description}</p>

          <div className="int-footer">
            <button className="int-cta-btn" onClick={(e) => { e.stopPropagation(); onConfigure(); }}>
              <GearIcon />
              Setup Integration
            </button>
            <span className="int-arrow">
              <ArrowRight size={18} />
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

const INTEGRATION_META = {
  whatsapp: {
    title: 'WhatsApp',
    description: 'Send invoices, reminders, and notifications via WhatsApp Business API',
    icon: MessageCircle
  },
  sms: {
    title: 'SMS',
    description: 'Send SMS notifications and payment reminders to clients',
    icon: MessageSquare
  },
  email: {
    title: 'Email (SendPulse)',
    description: 'Send invoices, reports, and notifications via SendPulse email service',
    icon: Mail
  },
  website: {
    title: 'Lead Management Integration',
    description: 'Configure and manage lead integrations from Website forms and WhatsApp',
    icon: Globe
  },
  payment: {
    title: 'Payment Integration',
    description: 'Configure QR codes and payment links for your organization',
    icon: CreditCard
  },
  ekta: {
    title: 'Ekta HR Integration',
    description: 'Sync employee data and attendance info with Ekta HR management system',
    icon: Users
  }
};

const SUPPORTED_INTEGRATIONS = ['whatsapp', 'sms', 'email', 'website', 'payment', 'ekta'];

const ClientIntegrationsTab = ({ user }) => {
  const [selectedConfig, setSelectedConfig] = useState(null);
  const activeClientId = user?.activeClientId || user?.clientId || user?._id;
  const { data, refetch, isLoading } = useGetIntegrationsQuery({ clientId: activeClientId }, { skip: !activeClientId });
  const [updateIntegration] = useUpdateIntegrationMutation();
  const [createIntegration] = useCreateIntegrationMutation();

  const integrations = data?.data?.integrations || [];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const handleToggle = async (integrationType, checked) => {
    try {
      let toggled = false;
      const targetIntegrations = [];

      if (integrationType === 'website') {
        const webInt = integrations.find(i => i.type === 'website');
        const fbInt = integrations.find(i => i.type === 'facebook_leads');
        if (webInt) targetIntegrations.push(webInt);
        if (fbInt) targetIntegrations.push(fbInt);
      } else {
        const intg = integrations.find(i => i.type === integrationType);
        if (intg) targetIntegrations.push(intg);
      }

      if (targetIntegrations.length > 0) {
        for (const item of targetIntegrations) {
          await updateIntegration({
            id: item._id,
            isActive: checked,
          }).unwrap();
        }
        toggled = true;
      } else {
        await createIntegration({
          type: integrationType,
          isActive: checked,
          clientId: activeClientId !== user?._id ? activeClientId : undefined,
        }).unwrap();
        toggled = true;
      }

      message.success(`Integration ${checked ? 'enabled' : 'disabled'} successfully`);
      refetch();
    } catch (error) {
      console.error("Failed to toggle integration", error);
      message.error("Failed to toggle integration status");
    }
  };

  const renderConfigPage = () => {
    const integration = integrations.find(i => i.type === selectedConfig);
    const id = integration?._id || 'new';
    
    switch (selectedConfig) {
      case 'whatsapp': return <WhatsAppConfigPage integrationId={id} clientId={activeClientId} onBack={() => { setSelectedConfig(null); refetch(); }} />;
      case 'sms': return <SmsConfigPage integrationId={id} clientId={activeClientId} onBack={() => { setSelectedConfig(null); refetch(); }} />;
      case 'email': return <EmailConfigPage integrationId={id} clientId={activeClientId} onBack={() => { setSelectedConfig(null); refetch(); }} />;
      case 'website': return <WebsiteConfigPage integrationId={id} clientId={activeClientId} onBack={() => { setSelectedConfig(null); refetch(); }} />;
      case 'payment': return <PaymentConfigPage integrationId={id} clientId={activeClientId} onBack={() => { setSelectedConfig(null); refetch(); }} />;
      case 'ekta': return <EktaHrInlineConfigPage clientId={activeClientId} onBack={() => { setSelectedConfig(null); refetch(); }} />;
      default: return null;
    }
  };

  if (selectedConfig) {
    return renderConfigPage();
  }

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>;
  }

  // Get the effective product integrations from the user object (provided by backend)
  const entitledTypes = (user?.integrations || []).filter(type => SUPPORTED_INTEGRATIONS.includes(type));

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ padding: '0' }}>
      <Row gutter={[24, 24]}>
        {entitledTypes.length > 0 ? (
          entitledTypes.map(type => {
            const meta = INTEGRATION_META[type];
            if (!meta) return null;
            
            const integrationRecord = integrations.find(i => i.type === type);
            let isActive = false;
            let isConfigured = false;
            
            if (type === 'website') {
              const fbIntegration = integrations.find(i => i.type === 'facebook_leads');
              const isWebConfigured = Boolean(integrationRecord?.config?.apiKey?.trim() || integrationRecord?.config?.whatsappLeads?.token?.trim());
              const isFbConfigured = Boolean(
                fbIntegration?.config &&
                (fbIntegration.config.accessToken || (fbIntegration.config.pages && fbIntegration.config.pages.length > 0))
              );
              isConfigured = isWebConfigured || isFbConfigured;

              const webActive = integrationRecord?.isActive;
              const fbActive = fbIntegration?.isActive;

              if (webActive !== undefined || fbActive !== undefined) {
                isActive = Boolean(webActive || fbActive);
              } else if (isConfigured) {
                isActive = true;
              }
            } else {
              isConfigured = Boolean(integrationRecord?.config && Object.keys(integrationRecord.config).length > 0);
              if (integrationRecord?.isActive !== undefined) {
                isActive = integrationRecord.isActive;
              } else if (isConfigured) {
                isActive = true;
              }
            }

            return (
              <Col xs={24} sm={12} lg={6} key={type}>
                <motion.div variants={itemVariants} style={{ height: '100%' }}>
                  <IntegrationCard
                    title={meta.title}
                    description={meta.description}
                    icon={meta.icon}
                    active={isActive}
                    configured={isConfigured}
                    buttonText="Configure"
                    onConfigure={() => setSelectedConfig(type)}
                    onToggle={(checked) => handleToggle(type, checked)}
                  />
                </motion.div>
              </Col>
            );
          })
        ) : (
          <Col span={24}>
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              No integrations available for your current package.
            </div>
          </Col>
        )}
      </Row>
    </motion.div>
  );
};

export default ClientIntegrationsTab;