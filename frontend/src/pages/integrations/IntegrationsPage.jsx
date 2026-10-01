import React from "react";
import { useNavigate } from "react-router-dom";
import { Switch, message, Typography, Button } from "antd";
import { ArrowRightOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import {
  useGetIntegrationsQuery,
  useUpdateIntegrationMutation,
} from "../../api/integrationApi";
import useCompanyIntegrations from "../../hooks/useCompanyIntegrations";
import { useAuth } from "../../contexts/AuthContext";

const { Title, Text } = Typography;

const cardStyles = `
  /* ── Grid ── */
  .int-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: 22px;
    margin-top: 28px;
  }

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
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
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
  }

  .int-title {
    font-size: 16px;
    font-weight: 600;
    display: block;
    margin-bottom: 10px;
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
    background: rgba(var(--primary-color-rgb), 0.08);
    border: 1px solid rgba(var(--primary-color-rgb), 0.25);
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
  }

  /* ── Footer ── */
  .int-footer {
    border-top: 1px solid #f0f0f0;
    padding-top: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
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
  }

  .int-cta-btn {
    background: linear-gradient(135deg, var(--primary-color), rgba(var(--primary-color-rgb), 0.85));
    box-shadow: 0 3px 10px rgba(var(--primary-color-rgb), 0.30);
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

  .int-card:hover::after { border-color: rgba(var(--primary-color-rgb), 0.27); }
`;

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const WhatsAppIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const SmsIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <circle cx="9" cy="10" r="0.9" fill="#fff" stroke="none" />
    <circle cx="12" cy="10" r="0.9" fill="#fff" stroke="none" />
    <circle cx="15" cy="10" r="0.9" fill="#fff" stroke="none" />
  </svg>
);

const EmailIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const EktaIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IvrCallingIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const WebsiteIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const isWebsiteIntegrationConfigured = (websiteIntegration, facebookIntegration) => {
  const isWebConfigured = Boolean(websiteIntegration?.config?.apiKey?.trim() || websiteIntegration?.config?.whatsappLeads?.token?.trim());
  const isFbConfigured = Boolean(facebookIntegration?.config && Object.keys(facebookIntegration.config).length > 0);
  return isWebConfigured || isFbConfigured;
};

const isIvrIntegrationConfigured = (integration) => {
  const c = integration?.config;
  if (!c || typeof c !== "object") return false;
  const keys = [
    "accountSid",
    "subdomain",
    "accountRegion",
    "apiKey",
    "apiToken",
    "exoPhoneNumber",
  ];
  return keys.every((k) => String(c[k] || "").trim().length > 0);
};

const GearIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

// ── Page ──────────────────────────────────────────────────────────────────────
const IntegrationsPage = () => {
  const navigate = useNavigate();
  const { data, refetch } = useGetIntegrationsQuery();
  const [updateIntegration] = useUpdateIntegrationMutation();
  const companyIntegrations = useCompanyIntegrations();
  const { user } = useAuth();
  const integrations = data?.data?.integrations || [];
  const globalStateMap = data?.data?.globalStateMap || {};

  const whatsappIntegration = integrations.find((i) => i.type === "whatsapp");
  const smsIntegration = integrations.find((i) => i.type === "sms");
  const emailIntegration = integrations.find((i) => i.type === "email");
  const ektaIntegration = integrations.find((i) => i.type === "ekta");
  const ivrIntegration = integrations.find((i) => i.type === "ivr");
  const websiteIntegration = integrations.find((i) => i.type === "website");
  const facebookIntegration = integrations.find((i) => i.type === "facebook_leads");

  const handleToggle = async (integrationType, checked) => {
    try {
      let toggled = false;
      const integration = integrations.find(i => i.type === integrationType);
      
      if (integration) {
        await updateIntegration({
          id: integration._id,
          isActive: checked,
        }).unwrap();
        toggled = true;
      }
      
      if (integrationType === 'website') {
        const fbIntegration = integrations.find(i => i.type === 'facebook_leads');
        if (fbIntegration) {
          await updateIntegration({
            id: fbIntegration._id,
            isActive: checked,
          }).unwrap();
          toggled = true;
        }
      }

      if (!toggled) {
        message.warning("Please configure the integration first before enabling it.");
      } else {
        message.success(`Integration ${checked ? 'enabled' : 'disabled'} successfully`);
      }
      refetch();
    } catch (error) {
      message.error(error?.data?.message || "Failed to update integration");
    }
  };

  const IntegrationCard = ({ type, integration, icon, title, description, isActiveOverride, isConfiguredOverride }) => {
    const isGloballyDisabled = globalStateMap[type] === false;
    let isActive = isGloballyDisabled ? false : (isActiveOverride !== undefined ? isActiveOverride : (integration?.isActive || false));
    
    let isConfigured = isConfiguredOverride !== undefined ? isConfiguredOverride : (
      type === "ivr"
        ? isIvrIntegrationConfigured(integration)
        : Boolean(integration?.config && Object.keys(integration.config).length > 0)
    );

    // As per user request: "If any integration is configured inside the Integrations section, its corresponding card should show Active."
    if (isConfigured && integration?.isActive !== false && !isGloballyDisabled) {
      isActive = true;
    }

    const handleCardClick = () => {
      if (isGloballyDisabled) {
        message.warning("This integration is currently disabled platform-wide by Super Admin.");
        return;
      }
      if (type === "whatsapp") {
        navigate(
          integration?._id
            ? `/settings/integrations/whatsapp/${integration._id}`
            : "/settings/integrations/whatsapp/new",
        );
      } else if (type === "email") {
        navigate(
          integration?._id
            ? `/settings/integrations/email/${integration._id}`
            : "/settings/integrations/email/new",
        );
      } else if (type === "sms") {
        navigate("/settings/integrations/sms");
      } else if (type === "ekta") {
        navigate(
          integration?._id
            ? `/settings/integrations/ekta/${integration._id}`
            : "/settings/integrations/ekta/new",
        );
      } else if (type === "ivr") {
        navigate(
          integration?._id
            ? `/settings/integrations/ivr/${integration._id}`
            : "/settings/integrations/ivr/new",
        );
      } else if (type === "website") {
        navigate(
          integration?._id
            ? `/settings/integrations/website/${integration._id}`
            : "/settings/integrations/website/new",
        );
      } else {
        message.info(`This module is available in this package. Purchase or upgrade your package to enable access.`);
      }
    };

    return (
      <div className={`int-card int-card-${type}`} onClick={handleCardClick}>
        {/* Coloured banner */}
        <div className="int-banner">
          <div className="int-blob1" />
          <div className="int-blob2" />
          <div className="int-blob3" />
          <div className="int-icon-wrap">{icon}</div>
          <div className="int-toggle-wrap" onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={isActive}
              disabled={isGloballyDisabled}
              onChange={(checked) => {
                if (isGloballyDisabled) {
                  message.warning("This integration is currently disabled platform-wide by Super Admin.");
                  return;
                }
                handleToggle(type, checked);
              }}
              size="small"
            />
          </div>
        </div>

        {/* Body */}
        <div className="int-body">
          <span className="int-title">{title}</span>

          <div className="int-badges">
            {isGloballyDisabled ? (
              <span className="int-dot" style={{ background: '#ffeee8', color: '#ff4d4f', border: '1px solid #ffccc7' }}>
                Disabled by Super Admin
              </span>
            ) : (
              <span
                className={`int-dot ${isActive ? "int-dot-active" : "int-dot-inactive"}`}
              >
                <span className="int-dot-pulse" />
                {isActive ? "Active" : "Inactive"}
              </span>
            )}
            {!isGloballyDisabled && isConfigured && (
              <span className="int-dot int-dot-configured">✦ Configured</span>
            )}
          </div>

          <p className="int-desc">{description}</p>

          <div className="int-footer">
            <button
              className="int-cta-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick();
              }}
            >
              <GearIcon />
              {integration ? "Configure" : "Setup Integration"}
            </button>
            <span className="int-arrow">
              <ArrowRightOutlined />
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{cardStyles}</style>
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "8px",
          }}
        >
          <Button
            type="ghost"
            shape="circle"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/settings")}
          />
          <Title level={2} style={{ margin: 0 }}>
            Company Integrations
          </Title>
        </div>
        <Text type="secondary">
          Configure messaging infrastructure for your company. Click on a card
          to configure.
        </Text>

        <div className="int-grid">
          {(companyIntegrations.isPlatformAdmin || companyIntegrations.isEntitled('whatsapp')) && (
            <IntegrationCard
              type="whatsapp"
              integration={whatsappIntegration}
              icon={<WhatsAppIcon />}
              title="WhatsApp"
              description="Send invoices, reminders, and notifications via WhatsApp Business API"
            />
          )}
          {(companyIntegrations.isPlatformAdmin || companyIntegrations.isEntitled('sms')) && (
            <IntegrationCard
              type="sms"
              integration={smsIntegration}
              icon={<SmsIcon />}
              title="SMS"
              description="Send SMS notifications and payment reminders to clients"
            />
          )}
          {(companyIntegrations.isPlatformAdmin || companyIntegrations.isEntitled('email')) && (
            <IntegrationCard
              type="email"
              integration={emailIntegration}
              icon={<EmailIcon />}
              title="Email (SendPulse)"
              description="Send invoices, reports, and notifications via SendPulse email service"
            />
          )}
          {(companyIntegrations.isPlatformAdmin || companyIntegrations.isEntitled('ekta')) && user?.features?.includes('hrms') && (
            <IntegrationCard
              type="ekta"
              integration={ektaIntegration}
              icon={<EktaIcon />}
              title="Ekta HR Integration"
              description="Sync employee data and payroll info with Ekta HR management system"
            />
          )}
          {(companyIntegrations.isPlatformAdmin || companyIntegrations.isEntitled('ivr')) && (
            <IntegrationCard
              type="ivr"
              integration={ivrIntegration}
              icon={<IvrCallingIcon />}
              title="IVR Calling"
              description="Outbound voice and IVR for leads using your telephony account (Exotel-style API credentials)"
            />
          )}
          {(companyIntegrations.isPlatformAdmin || companyIntegrations.isEntitled('website')) && (
            <IntegrationCard
              type="website"
              integration={websiteIntegration}
              isActiveOverride={
                (websiteIntegration?.isActive) || (facebookIntegration?.isActive) || false
              }
              isConfiguredOverride={
                isWebsiteIntegrationConfigured(websiteIntegration, facebookIntegration)
              }
              icon={<WebsiteIcon />}
              title="Lead Management Integration"
              description="Configure and manage lead integrations from Website forms and WhatsApp"
            />
          )}
        </div>
        {!companyIntegrations.isPlatformAdmin && companyIntegrations.entitledTypes.length === 0 && (
          <Alert
            style={{ marginTop: 16 }}
            type="info"
            showIcon
            message="No integrations enabled"
            description="Super Admin has disabled all integrations for this company."
          />
        )}
      </div>
    </>
  );
};

export default IntegrationsPage;