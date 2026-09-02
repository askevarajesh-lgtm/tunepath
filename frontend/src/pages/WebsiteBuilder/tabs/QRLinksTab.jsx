import React, { useState, useEffect } from "react";
import { Button, Table, Typography, Space, Input, Select, Card, Row, Col, Popconfirm, Divider, message, ColorPicker } from "antd";
import { Plus, Trash2, Link2, MessageSquare, Phone, Mail, CreditCard, FormInput, User, FileText, Wifi, QrCode, ArrowRight, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import PhoneInput from "../../../components/common/PhoneInput";
import { isValidPhoneNumber } from "libphonenumber-js";
import { useActionPermissions } from "../../../hooks/useActionPermissions";

const { Title, Text } = Typography;
const { Option } = Select;

const qrTypes = [
  { id: 'Website', icon: <Link2 size={24} /> },
  { id: 'Review Link', icon: <MessageSquare size={24} /> },
  { id: 'Call', icon: <Phone size={24} /> },
  { id: 'SMS', icon: <MessageSquare size={24} /> },
  { id: 'Email', icon: <Mail size={24} /> },
  { id: 'Payment', icon: <CreditCard size={24} /> },
  { id: 'WhatsApp', icon: <MessageSquare size={24} /> },

  { id: 'Form', icon: <FormInput size={24} /> },
  { id: 'Survey', icon: <FormInput size={24} /> },
  { id: 'Quiz', icon: <FormInput size={24} /> },
  { id: 'Digital VCard', icon: <User size={24} /> },
  { id: 'Personal Profile', icon: <User size={24} /> },
  { id: 'Business Profile', icon: <User size={24} /> },
  { id: 'File', icon: <FileText size={24} /> },
  { id: 'WiFi', icon: <Wifi size={24} /> }
];

const resolveColor = (color) => {
  const getCssVar = (varName) => {
    if (typeof window !== 'undefined') {
      const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      return val || '#10b981';
    }
    return '#10b981';
  };

  if (typeof color === 'string') {
    if (color === 'var(--accent-primary)') return getCssVar('--accent-primary');
    if (color.startsWith('var(')) {
      const match = color.match(/var\((.*?)\)/);
      const varName = match ? match[1] : '--accent-primary';
      return getCssVar(varName);
    }
    if (color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl') || /^[a-z]+$/i.test(color)) {
      return color;
    }
  }
  return getCssVar('--accent-primary');
};

const CreateQRView = ({ setView, handleCreateQR, itemVariants, forms = [], websites = [] }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: `QR-${Math.floor(Date.now() / 1000)}`,
    type: 'Website',
    customUrl: '',
    phone: '',
    smsMessage: '',
    email: '',
    emailSubject: '',
    emailBody: '',
    waMessage: '',
    wifiSsid: '',
    wifiPassword: '',
    wifiEncryption: 'WPA',
    vcardFirstName: '',
    vcardLastName: '',
    vcardOrg: '',
    vcardPhone: '',
    vcardEmail: '',
    vcardUrl: '',
    countryCode: '91',
    countryIso: 'IN',
    vcardCountryCode: '91',
    vcardCountryIso: 'IN',
    foreground: 'var(--accent-primary)',
    background: '#ffffff',
    shape: 'Square'
  });
  const [previewQrUrl, setPreviewQrUrl] = useState("");

  const getScanLink = () => {
    const { 
      type, customUrl, phone, smsMessage, email, emailSubject, emailBody, 
      waMessage, wifiSsid, wifiPassword, wifiEncryption, 
      vcardFirstName, vcardLastName, vcardOrg, vcardPhone, vcardEmail, vcardUrl 
    } = formData;

    switch (type) {
      case 'Website':
      case 'Review Link':
      case 'Payment':
      case 'File':
        return customUrl || "https://yoursite.com";
      case 'Call':
        return phone ? `tel:${phone}` : "tel:";
      case 'WhatsApp':
        return phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}${waMessage ? `?text=${encodeURIComponent(waMessage)}` : ''}` : "https://wa.me/";
      case 'SMS':
        return phone ? `sms:${phone}${smsMessage ? `?body=${encodeURIComponent(smsMessage)}` : ''}` : "sms:";
      case 'Email':
        return email ? `mailto:${email}?subject=${encodeURIComponent(emailSubject || '')}&body=${encodeURIComponent(emailBody || '')}` : "mailto:";
      case 'WiFi':
        return `WIFI:S:${wifiSsid || ''};T:${wifiEncryption || 'WPA'};P:${wifiPassword || ''};;`;
      case 'Digital VCard':
      case 'Personal Profile':
      case 'Business Profile':
        return `BEGIN:VCARD\nVERSION:3.0\nN:${vcardLastName || ''};${vcardFirstName || ''};;;\nFN:${vcardFirstName || ''} ${vcardLastName || ''}\nORG:${vcardOrg || ''}\nTEL:${vcardPhone || ''}\nEMAIL:${vcardEmail || ''}\nURL:${vcardUrl || ''}\nEND:VCARD`;
      case 'Form':
      case 'Survey':
      case 'Quiz':
        return customUrl || "https://yoursite.com";

        return customUrl || "https://yoursite.com";
      default:
        return customUrl || "https://yoursite.com";
    }
  };

  useEffect(() => {
    const text = getScanLink();
    const fg = resolveColor(formData.foreground);
    const bg = resolveColor(formData.background);
    
    QRCode.toDataURL(text, {
      width: 160,
      margin: 1,
      color: {
        dark: fg,
        light: bg
      }
    })
      .then(url => setPreviewQrUrl(url))
      .catch(err => console.error(err));
  }, [formData]);

  const renderStepper = () => (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: step >= 1 ? 1 : 0.5 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: step >= 1 ? 'var(--accent-primary)' : 'var(--bg-secondary)', color: step >= 1 ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>1</div>
        <div style={{ fontWeight: 800, color: step >= 1 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>CHOOSE TYPE</div>
      </div>
      <div style={{ height: 2, flex: 1, background: step >= 2 ? 'var(--accent-primary)' : 'var(--border-color)', margin: '0 16px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: step >= 2 ? 1 : 0.5 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: step >= 2 ? 'var(--accent-primary)' : 'var(--bg-secondary)', color: step >= 2 ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>2</div>
        <div style={{ fontWeight: 800, color: step >= 2 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>ADDITIONAL INFO</div>
      </div>
      <div style={{ height: 2, flex: 1, background: step >= 3 ? 'var(--accent-primary)' : 'var(--border-color)', margin: '0 16px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: step >= 3 ? 1 : 0.5 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: step >= 3 ? 'var(--accent-primary)' : 'var(--bg-secondary)', color: step >= 3 ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>3</div>
        <div style={{ fontWeight: 800, color: step >= 3 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>DESIGN & COLORS</div>
      </div>
    </div>
  );

  const renderPhoneMockup = () => (
    <div style={{ padding: 24, display: "flex", justifyContent: "center", alignItems: "center", borderRadius: "0 16px 16px 0", height: "100%", background: 'var(--bg-primary)' }}>
      <div style={{ width: 300, height: 600, border: '8px solid var(--border-color)', borderRadius: 40, position: 'relative', background: 'var(--bg-secondary)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ width: 120, height: 24, background: 'var(--border-color)', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}></div>
        <div style={{ padding: 40, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ background: resolveColor(formData.background), padding: 24, borderRadius: formData.shape === 'Rounded' ? 32 : 16, boxShadow: 'var(--shadow-sm)', marginBottom: 24, display: 'inline-block' }}>
              {previewQrUrl ? (
                <img src={previewQrUrl} alt="QR Preview" style={{ width: 120, height: 120, display: 'block' }} />
              ) : (
                <QrCode size={120} color="var(--accent-primary)" />
              )}
            </div>
            <div style={{ color: "var(--text-primary)", fontWeight: 800, fontSize: 18 }}>{formData.type}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 8, wordBreak: 'break-all', maxLines: 3, textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {getScanLink()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <Row>
      <Col span={16} style={{ padding: 40 }}>
        {renderStepper()}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>QR Name</div>
          <Input 
            size="large"
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            style={{ borderRadius: 8 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>Select QR Type <span style={{ fontWeight: 500, color: "var(--text-tertiary)", textTransform: "none" }}>(dynamic URL supported)</span></div>
          <Row gutter={[16, 16]}>
            {qrTypes.map(t => (
              <Col span={6} key={t.id}>
                <div 
                  onClick={() => setFormData({...formData, type: t.id})}
                  style={{
                    border: formData.type === t.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: formData.type === t.id ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-primary)',
                    borderRadius: 12,
                    padding: 20,
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: formData.type === t.id ? '0 4px 12px rgba(59, 130, 246, 0.1)' : 'none'
                  }}
                  className="hover-shadow-md"
                >
                  <div style={{ color: formData.type === t.id ? 'var(--accent-primary)' : 'var(--text-tertiary)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{t.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: formData.type === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{t.id}</div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </Col>
      <Col span={8}>
        {renderPhoneMockup()}
      </Col>
    </Row>
  );

  const renderStep2Form = () => {
    const { type } = formData;

    if (['Website', 'Review Link', 'Payment', 'File'].includes(type)) {
      return (
        <div>
          <Title level={4} style={{ marginBottom: 8, color: 'var(--text-primary)', fontWeight: 800 }}>{type} Settings</Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 32, fontSize: 14, fontWeight: 500 }}>Enter the target URL where scanning users will be redirected.</Text>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Select Destination Type</div>
            <Select 
              size="large" 
              value={formData.destinationType || (formData.customUrl.startsWith(window.location.origin) ? "workspace" : "custom")} 
              style={{ width: "100%" }}
              onChange={(val) => {
                if (val === 'custom') {
                  setFormData({...formData, destinationType: 'custom', customUrl: ''});
                } else {
                  setFormData({...formData, destinationType: 'workspace', customUrl: websites.length > 0 ? `${window.location.origin}/preview/website/${websites[0]._id}/page/home` : window.location.origin});
                }
              }}
            >
              <Option value="custom">Custom External URL</Option>
              <Option value="workspace">Existing Website</Option>
            </Select>
          </div>
          {(formData.destinationType === 'workspace' || formData.customUrl.startsWith(window.location.origin)) && websites.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Select Website</div>
              <Select 
                size="large" 
                style={{ width: "100%" }}
                placeholder="Choose website..."
                value={formData.customUrl.startsWith(window.location.origin) && formData.customUrl.length > window.location.origin.length ? formData.customUrl : undefined}
                onChange={(val) => setFormData({...formData, customUrl: val})}
              >
                {websites.map(w => (
                  <Option key={w._id} value={`${window.location.origin}/preview/website/${w._id}/page/home`}>{w.name}</Option>
                ))}
              </Select>
            </div>
          )}
          {(!formData.destinationType || formData.destinationType === 'custom') && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Target URL</div>
              <Input 
                size="large"
                placeholder="https://yoursite.com/offer" 
                value={formData.customUrl}
                onChange={e => setFormData({...formData, customUrl: e.target.value})}
                style={{ borderRadius: 8 }}
              />
            </div>
          )}
        </div>
      );
    }

    if (type === 'Form' || type === 'Survey' || type === 'Quiz') {
      return (
        <div>
          <Title level={4} style={{ marginBottom: 8, color: 'var(--text-primary)', fontWeight: 800 }}>{type} Integration</Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 32, fontSize: 14, fontWeight: 500 }}>Select a MERN Form, Survey, or Quiz to generate a scannable link for.</Text>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Select Form</div>
            <Select 
              size="large" 
              style={{ width: "100%" }}
              placeholder="Choose a Form/Survey/Quiz"
              onChange={(val) => setFormData({...formData, customUrl: `${window.location.origin}/embed/form/${val}`})}
            >
              {forms.map(f => (
                <Option key={f._id} value={f._id}>{f.name}</Option>
              ))}
            </Select>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Computed Embed URL</div>
            <Input size="large" value={formData.customUrl} readOnly style={{ borderRadius: 8, background: 'var(--bg-secondary)' }} />
          </div>
        </div>
      );
    }

    if (type === 'Call') {
      return (
        <div>
          <Title level={4} style={{ marginBottom: 8, color: 'var(--text-primary)', fontWeight: 800 }}>Call Setup</Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 32, fontSize: 14, fontWeight: 500 }}>Scan triggers a direct phone call request.</Text>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Phone Number</div>
            <PhoneInput 
              size="large"
              style={{ borderRadius: 8 }}
              countryCodeValue={formData.countryCode}
              onCountryCodeChange={val => setFormData({...formData, countryCode: val})}
              isoCountryValue={formData.countryIso}
              onCountryIsoChange={val => setFormData({...formData, countryIso: val})}
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
        </div>
      );
    }

    if (type === 'SMS') {
      return (
        <div>
          <Title level={4} style={{ marginBottom: 8, color: 'var(--text-primary)', fontWeight: 800 }}>SMS Setup</Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 32, fontSize: 14, fontWeight: 500 }}>Scan drafts an SMS message to a specific number.</Text>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Phone Number</div>
            <PhoneInput 
              size="large"
              style={{ borderRadius: 8 }}
              countryCodeValue={formData.countryCode}
              onCountryCodeChange={val => setFormData({...formData, countryCode: val})}
              isoCountryValue={formData.countryIso}
              onCountryIsoChange={val => setFormData({...formData, countryIso: val})}
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Message</div>
            <Input.TextArea 
              rows={4}
              placeholder="Enter pre-filled draft text..." 
              value={formData.smsMessage}
              onChange={e => setFormData({...formData, smsMessage: e.target.value})}
              style={{ borderRadius: 8 }}
            />
          </div>
        </div>
      );
    }

    if (type === 'WhatsApp') {
      return (
        <div>
          <Title level={4} style={{ marginBottom: 8, color: 'var(--text-primary)', fontWeight: 800 }}>WhatsApp Action</Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 32, fontSize: 14, fontWeight: 500 }}>Scan opens WhatsApp chat with custom pre-filled message.</Text>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Phone Number</div>
            <PhoneInput 
              size="large"
              style={{ borderRadius: 8 }}
              countryCodeValue={formData.countryCode}
              onCountryCodeChange={val => setFormData({...formData, countryCode: val})}
              isoCountryValue={formData.countryIso}
              onCountryIsoChange={val => setFormData({...formData, countryIso: val})}
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Pre-filled Message</div>
            <Input.TextArea 
              rows={4}
              placeholder="Hello! I scanned your QR code and wanted to connect..." 
              value={formData.waMessage}
              onChange={e => setFormData({...formData, waMessage: e.target.value})}
              style={{ borderRadius: 8 }}
            />
          </div>
        </div>
      );
    }

    if (type === 'Email') {
      return (
        <div>
          <Title level={4} style={{ marginBottom: 8, color: 'var(--text-primary)', fontWeight: 800 }}>Email Generator</Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 32, fontSize: 14, fontWeight: 500 }}>Scan opens default mail app with pre-filled content.</Text>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Target Email Address</div>
            <Input 
              size="large"
              placeholder="info@yourcompany.com" 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              style={{ borderRadius: 8 }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Subject Line</div>
            <Input 
              size="large"
              placeholder="e.g. Partnership Inquiry" 
              value={formData.emailSubject}
              onChange={e => setFormData({...formData, emailSubject: e.target.value})}
              style={{ borderRadius: 8 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Body Message</div>
            <Input.TextArea 
              rows={4}
              placeholder="Draft your email body..." 
              value={formData.emailBody}
              onChange={e => setFormData({...formData, emailBody: e.target.value})}
              style={{ borderRadius: 8 }}
            />
          </div>
        </div>
      );
    }

    if (type === 'WiFi') {
      return (
        <div>
          <Title level={4} style={{ marginBottom: 8, color: 'var(--text-primary)', fontWeight: 800 }}>WiFi Settings</Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 32, fontSize: 14, fontWeight: 500 }}>Scan connects users directly to your local wireless network.</Text>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Network Name (SSID)</div>
            <Input 
              size="large"
              placeholder="MyHomeWifi" 
              value={formData.wifiSsid}
              onChange={e => setFormData({...formData, wifiSsid: e.target.value})}
              style={{ borderRadius: 8 }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Network Password</div>
            <Input.Password 
              size="large"
              placeholder="WirelessPassword" 
              value={formData.wifiPassword}
              onChange={e => setFormData({...formData, wifiPassword: e.target.value})}
              style={{ borderRadius: 8 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Security Encryption</div>
            <Select 
              size="large" 
              value={formData.wifiEncryption} 
              style={{ width: "100%" }}
              onChange={(val) => setFormData({...formData, wifiEncryption: val})}
            >
              <Option value="WPA">WPA / WPA2 (Recommended)</Option>
              <Option value="WEP">WEP</Option>
              <Option value="nopass">None (Open Network)</Option>
            </Select>
          </div>
        </div>
      );
    }

    if (['Digital VCard', 'Personal Profile', 'Business Profile'].includes(type)) {
      return (
        <div>
          <Title level={4} style={{ marginBottom: 8, color: 'var(--text-primary)', fontWeight: 800 }}>VCard / Profile Setup</Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 32, fontSize: 14, fontWeight: 500 }}>Scan downloads contact card (.vcf) directly to mobile contact list.</Text>
          <Row gutter={16}>
            <Col span={12}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>First Name</div>
                <Input size="large" value={formData.vcardFirstName} onChange={e => setFormData({...formData, vcardFirstName: e.target.value})} style={{ borderRadius: 8 }} />
              </div>
            </Col>
            <Col span={12}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Last Name</div>
                <Input size="large" value={formData.vcardLastName} onChange={e => setFormData({...formData, vcardLastName: e.target.value})} style={{ borderRadius: 8 }} />
              </div>
            </Col>
          </Row>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Organization / Company</div>
            <Input size="large" value={formData.vcardOrg} onChange={e => setFormData({...formData, vcardOrg: e.target.value})} style={{ borderRadius: 8 }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Phone Number</div>
            <PhoneInput 
              size="large"
              style={{ borderRadius: 8 }}
              countryCodeValue={formData.vcardCountryCode}
              onCountryCodeChange={val => setFormData({...formData, vcardCountryCode: val})}
              isoCountryValue={formData.vcardCountryIso}
              onCountryIsoChange={val => setFormData({...formData, vcardCountryIso: val})}
              value={formData.vcardPhone}
              onChange={e => setFormData({...formData, vcardPhone: e.target.value})}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Email Address</div>
            <Input size="large" value={formData.vcardEmail} onChange={e => setFormData({...formData, vcardEmail: e.target.value})} style={{ borderRadius: 8 }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Website URL</div>
            <Input size="large" value={formData.vcardUrl} onChange={e => setFormData({...formData, vcardUrl: e.target.value})} style={{ borderRadius: 8 }} />
          </div>
        </div>
      );
    }

    return null;
  };

  const renderStep2 = () => (
    <Row>
      <Col span={16} style={{ padding: 40 }}>
        {renderStepper()}
        {renderStep2Form()}
      </Col>
      <Col span={8}>
        {renderPhoneMockup()}
      </Col>
    </Row>
  );

  const renderStep3 = () => (
    <Row>
      <Col span={16} style={{ padding: 40 }}>
        {renderStepper()}
        <Title level={4} style={{ marginBottom: 8, color: 'var(--text-primary)', fontWeight: 800 }}>Design & colors</Title>
        <Text type="secondary" style={{ display: "block", marginBottom: 32, fontSize: 14, fontWeight: 500 }}>Choose a profile theme (light or dark) and customize your scannable QR code.</Text>
        
        <Divider style={{ margin: "24px 0", borderColor: 'var(--border-color)' }} />

        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8, color: 'var(--text-primary)' }}>QR code style</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24, fontWeight: 500 }}>Colors encoded in the scannable image.</div>

        <Row gutter={24} style={{ marginBottom: 32 }}>
          <Col span={12}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>FOREGROUND</div>
            <div style={{ display: "flex", gap: 12, alignItems: 'center' }}>
              <ColorPicker 
                value={resolveColor(formData.foreground)}
                onChange={(color) => {
                  const colorStr = (color && typeof color === 'object' && color.toHexString) 
                    ? color.toHexString() 
                    : (typeof color === 'string' ? color : '#000000');
                  setFormData({...formData, foreground: colorStr});
                }}
              />
              <Input 
                size="large"
                value={formData.foreground} 
                onChange={e => setFormData({...formData, foreground: e.target.value})}
                style={{ borderRadius: 8 }}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>BACKGROUND</div>
            <div style={{ display: "flex", gap: 12, alignItems: 'center' }}>
              <ColorPicker 
                value={resolveColor(formData.background)}
                onChange={(color) => {
                  const colorStr = (color && typeof color === 'object' && color.toHexString) 
                    ? color.toHexString() 
                    : (typeof color === 'string' ? color : '#ffffff');
                  setFormData({...formData, background: colorStr});
                }}
              />
              <Input 
                size="large"
                value={formData.background} 
                onChange={e => setFormData({...formData, background: e.target.value})}
                style={{ borderRadius: 8 }}
              />
            </div>
          </Col>
        </Row>

        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>MODULE SHAPE</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Button 
            size="large"
            style={{ 
              borderRadius: 8, 
              fontWeight: 700,
              background: formData.shape === 'Square' ? 'var(--accent-primary)' : 'var(--bg-primary)',
              color: formData.shape === 'Square' ? '#fff' : 'var(--text-primary)',
              borderColor: formData.shape === 'Square' ? 'var(--accent-primary)' : 'var(--border-color)'
            }}
            onClick={() => setFormData({...formData, shape: "Square"})}
          >
            Square
          </Button>
          <Button 
            size="large"
            style={{ 
              borderRadius: 8, 
              fontWeight: 700,
              background: formData.shape === 'Rounded' ? 'var(--accent-primary)' : 'var(--bg-primary)',
              color: formData.shape === 'Rounded' ? '#fff' : 'var(--text-primary)',
              borderColor: formData.shape === 'Rounded' ? 'var(--accent-primary)' : 'var(--border-color)'
            }}
            onClick={() => setFormData({...formData, shape: "Rounded"})}
          >
            Rounded
          </Button>
        </div>
      </Col>
      <Col span={8}>
        {renderPhoneMockup()}
      </Col>
    </Row>
  );

  return (
    <motion.div variants={itemVariants} className="builder-view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 700 }} onClick={() => setView("list")}>
        <ArrowLeft size={16} /> Back to QR Links
      </div>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: 0, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 900 }}>Create QR Code</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>Generate your QR with ease — same flow as GoHighLevel.</Text>
        </div>
      </div>

      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 24, overflow: "hidden", maxWidth: 1000, margin: "0 auto", border: "1px solid var(--border-color)", background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-md)' }}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        
        <div style={{ padding: "24px 40px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: 'var(--bg-primary)' }}>
          <Button 
            size="large"
            type="text" 
            disabled={step === 1} 
            onClick={() => setStep(step - 1)}
            style={{ fontWeight: 700, color: step === 1 ? "var(--text-tertiary)" : "var(--text-secondary)" }}
          >
            Previous
          </Button>
          <Button 
            size="large"
            type="primary" 
            style={{ backgroundColor: "var(--accent-primary)", border: "none", borderRadius: 8, fontWeight: 800, padding: "0 32px" }}
            onClick={() => {
              if (step < 3) setStep(step + 1);
              else handleCreateQR({...formData, customUrl: getScanLink()});
            }}
          >
            {step === 3 ? "Create QR Code" : "Next"}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};

const ManageQRView = ({ activeQR, setView, handleDeleteQR, itemVariants }) => {
  const { canAdd, canEdit, canDelete } = useActionPermissions('/website');
  const [qrUrl, setQrUrl] = useState("");
  const [svgContent, setSvgContent] = useState("");

  const trackingUrl = ['Website', 'Form', 'Survey', 'Quiz', 'Review Link'].includes(activeQR.type) 
    ? `${window.location.origin}/api/qrs/scan/${activeQR.slug}`
    : activeQR.scanLink;

  useEffect(() => {
    const fg = resolveColor(activeQR.foreground);
    const bg = resolveColor(activeQR.background);
    
    QRCode.toDataURL(trackingUrl, {
      width: 300,
      margin: 1,
      color: {
        dark: fg,
        light: bg
      }
    })
      .then(url => setQrUrl(url))
      .catch(err => console.error(err));

    QRCode.toString(trackingUrl, {
      type: 'svg',
      margin: 1,
      color: {
        dark: fg,
        light: bg
      }
    })
      .then(svg => setSvgContent(svg))
      .catch(err => console.error(err));
  }, [activeQR]);

  const handleDownloadSVG = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeQR.slug || 'qrcode'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success("QR Code SVG downloaded successfully!");
  };

  return (
    <motion.div variants={itemVariants} className="builder-view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 700 }} onClick={() => setView("list")}>
        <ArrowLeft size={16} /> Back to QR Links
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: 0, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 900 }}>{activeQR.name}</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 600 }}>{activeQR.type} · {activeQR.scans} scans</Text>
        </div>
        <Space>
          {canAdd && <Button size="large" type="primary" onClick={() => setView("create")} icon={<Plus size={16} />} style={{ backgroundColor: "var(--accent-primary)", border: "none", borderRadius: 8, fontWeight: 800 }}>New QR Code</Button>}
        </Space>
      </div>

      <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", color: "var(--accent-success)", padding: "16px 24px", borderRadius: 12, marginBottom: 32, fontWeight: 600, fontSize: 14 }}>
        QR code created successfully. Download the image or share the scan link.
      </div>

      <Row gutter={32}>
        <Col span={10}>
          <Card style={{ borderRadius: 24, textAlign: "center", border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-md)' }} bodyStyle={{ padding: 40 }}>
            <div style={{ marginBottom: 40, display: "flex", justifyContent: "center" }}>
               <div style={{ background: resolveColor(activeQR.background), padding: 32, borderRadius: activeQR.shape === 'Rounded' ? 32 : 16, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
                 {qrUrl ? (
                   <img src={qrUrl} alt="QR Code" style={{ width: 200, height: 200, display: 'block' }} />
                 ) : (
                   <QrCode size={200} color={activeQR.foreground === 'var(--accent-primary)' ? 'var(--accent-primary)' : activeQR.foreground} />
                 )}
               </div>
            </div>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Button size="large" type="primary" block onClick={handleDownloadSVG} style={{ backgroundColor: "var(--accent-primary)", border: "none", borderRadius: 8, fontWeight: 800 }}>Download SVG</Button>
              <Button size="large" block onClick={() => window.open(trackingUrl, '_blank')} style={{ borderRadius: 8, fontWeight: 700, borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>Open scan URL</Button>
            </Space>
          </Card>
        </Col>
        <Col span={14}>
          <Card style={{ borderRadius: 24, marginBottom: 24, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 24 }}>DETAILS</div>
            
            <div style={{ marginBottom: 24, background: 'var(--bg-primary)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", marginBottom: 4 }}>TYPE</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>{activeQR.type}</div>
            </div>
            
            <div style={{ marginBottom: 24, background: 'var(--bg-primary)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", marginBottom: 4 }}>ABOUT</div>
              <div style={{ color: "var(--text-secondary)", fontWeight: 500, lineHeight: 1.5 }}>
                {['Website', 'Form', 'Survey', 'Quiz', 'Review Link'].includes(activeQR.type)
                  ? "Dynamic trackable redirection scan flow."
                  : "Static scan action, executing standard local handset commands."}
              </div>
            </div>

            <div style={{ marginBottom: 24, background: 'var(--bg-primary)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", marginBottom: 4 }}>DESTINATION</div>
              <div style={{ color: "var(--accent-info)", fontWeight: 600, wordBreak: "break-all" }}>{activeQR.scanLink}</div>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", marginBottom: 4 }}>TRACKING</div>
              <div style={{ fontWeight: 800, color: ['Website', 'Form', 'Survey', 'Quiz', 'Review Link'].includes(activeQR.type) ? 'var(--accent-success)' : 'var(--text-secondary)' }}>
                {['Website', 'Form', 'Survey', 'Quiz', 'Review Link'].includes(activeQR.type) ? "Scan analytics enabled" : "Analytics not supported for static QR codes"}
              </div>
            </div>
          </Card>

          {canDelete && (
            <Popconfirm title="Are you sure you want to delete this QR code?" onConfirm={() => handleDeleteQR(activeQR.key)}>
              <Button size="large" block danger style={{ borderRadius: 12, fontWeight: 800, background: "rgba(239, 68, 68, 0.1)", border: "none", color: "var(--accent-danger)" }}>
                Delete QR code
              </Button>
            </Popconfirm>
          )}
        </Col>
      </Row>
    </motion.div>
  );
};

const QRLinksTab = ({ itemVariants }) => {
  const { canAdd, canEdit, canDelete } = useActionPermissions('/website');
  const [view, setView] = useState("list"); 
  const [qrs, setQrs] = useState([]);
  const [activeQR, setActiveQR] = useState(null);
  
  const [forms, setForms] = useState([]);
  const [websites, setWebsites] = useState([]);

  useEffect(() => {
    const fetchQRs = async () => {
      if (view !== "list") return;
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/qrs", {
          headers: { "Authorization": token ? `Bearer ${token}` : "" }
        });
        const data = await res.json();
        if (data.success) {
          setQrs(data.data.map(q => ({
            key: q._id,
            name: q.name,
            slug: q.slug,
            type: q.type,
            scans: q.scans || 0,
            scanLink: q.scanLink,
            foreground: q.foreground,
            background: q.background,
            shape: q.shape,
            ...q
          })));
        }
      } catch (err) {
        console.error("Failed to fetch QRs", err);
      }
    };

    const loadData = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { "Authorization": token ? `Bearer ${token}` : "" };
        const [formsRes, websitesRes] = await Promise.all([
          fetch("/api/forms", { headers }),
          fetch("/api/websites", { headers })
        ]);
        
        const [formsData, websitesData] = await Promise.all([
          formsRes.json(),
          websitesRes.json()
        ]);

        if (formsData.success) setForms(formsData.data);
        if (websitesData.success) setWebsites(websitesData.data);
      } catch (err) {
        console.error("Failed to fetch resources", err);
      }
    };

    fetchQRs();
    loadData();
  }, [view]);

  const handleCreateQR = async (formData) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/qrs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          customUrl: formData.customUrl,
          foreground: formData.foreground,
          background: formData.background,
          shape: formData.shape
        })
      });
      const resData = await res.json();
      if (resData.success) {
        const newQR = { ...resData.data, key: resData.data._id, scans: 0, scanLink: resData.data.scanLink };
        setActiveQR(newQR);
        setView("manage");
        message.success("QR Code generated successfully!");
      } else {
        message.error(resData.error || "Failed to create QR code");
      }
    } catch (err) {
      console.error(err);
      message.error("Failed to create QR code");
    }
  };

  const handleDeleteQR = async (key) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/qrs/${key}`, {
        method: "DELETE",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setQrs(qrs.filter(q => q.key !== key));
        setView("list");
        message.success("QR Code deleted successfully!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderList = () => {
    const columns = [
      {
        title: "NAME",
        dataIndex: "name",
        key: "name",
        render: (_, record) => (
          <div>
            <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 15 }}>{record.name}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "13px", fontWeight: 500 }}>{record.slug}</div>
          </div>
        )
      },
      {
        title: "TYPE",
        dataIndex: "type",
        key: "type",
        render: (text) => <Text strong style={{ color: 'var(--text-primary)' }}>{text}</Text>
      },
      {
        title: "SCANS",
        dataIndex: "scans",
        key: "scans",
        render: (text) => <Text strong style={{ color: 'var(--text-primary)' }}>{text}</Text>
      },
      {
        title: "DESTINATION",
        dataIndex: "scanLink",
        key: "scanLink",
        render: (text) => <Text type="secondary" style={{ fontWeight: 500 }}>{text}</Text>
      },
      {
        title: "ACTIONS",
        key: "actions",
        align: "right",
        render: (_, record) => (
          <Space size="middle">
            <span 
              style={{ color: "var(--accent-primary)", fontWeight: 700, cursor: "pointer", display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={() => {
                setActiveQR(record);
                setView("manage");
              }}
            >
              Manage <ArrowRight size={14} />
            </span>
            {canDelete && (
              <Popconfirm 
                title="Are you sure you want to delete this QR code?" 
                onConfirm={() => handleDeleteQR(record.key)}
                okText="Yes"
                cancelText="No"
              >
                <span 
                  style={{ color: "var(--accent-danger)", fontWeight: 700, cursor: "pointer", display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Trash2 size={14} /> Delete
                </span>
              </Popconfirm>
            )}
          </Space>
        )
      },
    ];

    return (
      <motion.div variants={itemVariants}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={4} style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
              <QrCode size={24} color="var(--accent-primary)" /> QR Links
            </Title>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>
              Trackable QR codes for websites, forms, contact actions, WiFi, and more.
            </Text>
          </div>
          <Space>
            {canAdd && (
              <Button 
                type="primary" 
                icon={<Plus size={18} />} 
                style={{ backgroundColor: "var(--accent-primary)", border: 'none', borderRadius: 8, fontWeight: 700, height: 44, padding: '0 24px', boxShadow: 'var(--shadow-md)' }}
                onClick={() => setView("create")}
              >
                Create QR Code
              </Button>
            )}
          </Space>
        </div>

        <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <Table scroll={{ x: 800 }} 
            columns={columns}
            dataSource={qrs}
            pagination={{
              defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
              position: ['bottomCenter']
            }}
            locale={{
              emptyText: (
                <div style={{ padding: "80px 0", textAlign: "center" }}>
                  <div style={{ width: 80, height: 80, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <QrCode size={40} />
                  </div>
                  <Title level={4} style={{ marginBottom: 12, color: 'var(--text-primary)', fontWeight: 800 }}>No QR Codes yet</Title>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 32, fontSize: 15, fontWeight: 500 }}>
                    Click <strong style={{ color: "var(--text-primary)" }}>+ Create QR Code</strong> to generate trackable links.
                  </Text>
                  {canAdd && <Button type="primary" icon={<Plus size={18} />} onClick={() => setView("create")} style={{ borderRadius: 8, height: 44, background: 'var(--accent-primary)', border: 'none', fontWeight: 700, padding: '0 32px' }}>Create QR Code</Button>}
                </div>
              )
            }}
          />
        </Card>
      </motion.div>
    );
  };

  return (
    <div style={{ position: "relative" }}>
      {view === "list" && renderList()}
      {view === "create" && <CreateQRView setView={setView} handleCreateQR={handleCreateQR} itemVariants={itemVariants} forms={forms} websites={websites} />}
      {view === "manage" && <ManageQRView activeQR={activeQR} setView={setView} handleDeleteQR={handleDeleteQR} itemVariants={itemVariants} />}
    </div>
  );
};

export default QRLinksTab;
