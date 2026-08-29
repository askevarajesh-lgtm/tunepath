import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Input, Form, message, Upload, ColorPicker } from 'antd';
import { motion } from 'framer-motion';
import { Upload as UploadIcon } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';

const { Title, Text } = Typography;

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1, 
    transition: { type: 'spring', stiffness: 300, damping: 24 } 
  }
};

const PanelCard = ({ title, extra, children, accentColor }) => (
  <Card 
    title={<strong style={{ fontSize: 15, color: 'var(--text-primary)', letterSpacing: 0.5 }}>{title}</strong>} 
    extra={extra && <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>{extra}</Text>} 
    className="glassmorphism" 
    style={{ 
      borderRadius: '0 24px 24px 0', 
      marginBottom: 40,
      border: '1px solid var(--border-color)',
      borderLeft: `8px solid ${accentColor}`,
      boxShadow: 'var(--shadow-md)',
      background: 'var(--bg-secondary)'
    }} 
    bodyStyle={{ padding: 32 }}
  >
    {children}
  </Card>
);

const AgencyTab = () => {
  const { user, setUser } = useAuth();
  const { updatePreviewTheme } = useTheme();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoDarkPreview, setLogoDarkPreview] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLogoDark, setUploadingLogoDark] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setFetching(true);
      const res = await api.get('/agency/settings/profile');
      if (res.data && res.data.success) {
        const { companyName, name, email, logo, logoDark, invoiceSignature, theme } = res.data.data;
        form.setFieldsValue({
          companyName,
          name,
          email,
          logo,
          logoDark,
          invoiceSignature,
          theme_primaryColor: theme?.primaryColor || '#034EA1',
          theme_secondaryColor: theme?.secondaryColor || '#0ea5e9'
        });
        if (logo) setLogoPreview(logo);
        if (logoDark) setLogoDarkPreview(logoDark);
        if (invoiceSignature) setSignaturePreview(invoiceSignature);
      }
    } catch (error) {
      message.error('Failed to load agency profile');
    } finally {
      setFetching(false);
    }
  };

  const handleValuesChange = (changedValues) => {
    if (changedValues.theme_primaryColor || changedValues.theme_secondaryColor) {
      const primary = changedValues.theme_primaryColor ? (typeof changedValues.theme_primaryColor === 'string' ? changedValues.theme_primaryColor : changedValues.theme_primaryColor.toHexString()) : null;
      const secondary = changedValues.theme_secondaryColor ? (typeof changedValues.theme_secondaryColor === 'string' ? changedValues.theme_secondaryColor : changedValues.theme_secondaryColor.toHexString()) : null;
      updatePreviewTheme(primary, secondary);
    }
  };

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const payload = {
        ...values,
        theme: {
          primaryColor: typeof values.theme_primaryColor === 'string' ? values.theme_primaryColor : values.theme_primaryColor?.toHexString(),
          secondaryColor: typeof values.theme_secondaryColor === 'string' ? values.theme_secondaryColor : values.theme_secondaryColor?.toHexString()
        }
      };
      const res = await api.put('/agency/settings/profile', payload);
      message.success('Agency profile updated successfully');
      if (res.data && res.data.data) {
        const updatedUser = { ...user, ...res.data.data };
        if (res.data.data.theme) {
          updatedUser.effectiveTheme = res.data.data.theme;
        }
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.dispatchEvent(new Event('user-updated'));
      }
      fetchProfile();
    } catch (error) {
      message.error('Failed to update agency profile');
    } finally {
      setLoading(false);
    }
  };

  const customUpload = async ({ file, onSuccess, onError }) => {
    try {
      setUploadingLogo(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'agency-logos');

      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
        const url = res.data.data.url;
        setLogoPreview(url);
        form.setFieldsValue({ logo: url });
        
        // Auto-save the logo to the DB
        const currentVals = form.getFieldsValue();
        const updateRes = await api.put('/agency/settings/profile', { ...currentVals, logo: url });
        
        if (updateRes.data && updateRes.data.data) {
          const updatedUser = { ...user, ...updateRes.data.data };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }

        onSuccess(res.data);
        message.success('Logo uploaded and applied successfully.');
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
      formData.append('folder', 'agency-logos');

      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
        const url = res.data.data.url;
        setLogoDarkPreview(url);
        form.setFieldsValue({ logoDark: url });
        
        // Auto-save the logo to the DB
        const currentVals = form.getFieldsValue();
        const updateRes = await api.put('/agency/settings/profile', { ...currentVals, logoDark: url });
        
        if (updateRes.data && updateRes.data.data) {
          const updatedUser = { ...user, ...updateRes.data.data };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }

        onSuccess(res.data);
        message.success('Dark mode logo uploaded and applied successfully.');
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

  const customUploadSignature = async ({ file, onSuccess, onError }) => {
    try {
      setUploadingSignature(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'agency-logos'); // Using same folder or maybe agency-signatures

      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
        const url = res.data.data.url;
        setSignaturePreview(url);
        form.setFieldsValue({ invoiceSignature: url });
        
        // Auto-save the signature to the DB
        const currentVals = form.getFieldsValue();
        const updateRes = await api.put('/agency/settings/profile', { ...currentVals, invoiceSignature: url });
        
        if (updateRes.data && updateRes.data.data) {
          const updatedUser = { ...user, ...updateRes.data.data };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }

        onSuccess(res.data);
        message.success('Invoice / Proposal signature uploaded and applied successfully.');
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error(error);
      onError(error);
      message.error('Failed to upload invoice signature');
    } finally {
      setUploadingSignature(false);
    }
  };

  return (
    <>
      <motion.div variants={itemVariants}>
        <Title level={4} style={{ marginBottom: 8, fontWeight: 700, color: 'var(--text-primary)' }}>Agency Settings</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 32, fontSize: 14, fontWeight: 500 }}>Your agency profile and branding.</Text>
      </motion.div>

      {/* Agency Profile */}
      <motion.div variants={itemVariants}>
        <PanelCard title="Agency Profile" accentColor="var(--accent-secondary)">
          <Form 
            layout="vertical" 
            form={form} 
            onFinish={onFinish}
            onValuesChange={handleValuesChange}
            disabled={fetching}
          >
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 400px' }}>
                <Form.Item 
                  name="companyName" 
                  label={<strong style={{ color: 'var(--text-secondary)' }}>Agency Name *</strong>}
                  rules={[{ required: true, message: 'Please enter agency name' }]}
                >
                  <Input style={{ borderRadius: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', fontWeight: 500 }} />
                </Form.Item>
                <Form.Item 
                  name="name" 
                  label={<strong style={{ color: 'var(--text-secondary)' }}>Primary Contact Name *</strong>}
                  rules={[{ required: true, message: 'Please enter contact name' }]}
                >
                  <Input style={{ borderRadius: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', fontWeight: 500 }} />
                </Form.Item>
                <Form.Item 
                  name="email" 
                  label={<strong style={{ color: 'var(--text-secondary)' }}>Primary Contact Email *</strong>}
                  rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}
                >
                  <Input style={{ borderRadius: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', fontWeight: 500 }} />
                </Form.Item>
                <div style={{ display: 'flex', gap: 16 }}>
                  <Form.Item 
                    name="theme_primaryColor" 
                    label={<strong style={{ color: 'var(--text-secondary)' }}>Primary Color</strong>}
                  >
                    <ColorPicker format="hex" />
                  </Form.Item>
                  <Form.Item 
                    name="theme_secondaryColor" 
                    label={<strong style={{ color: 'var(--text-secondary)' }}>Secondary Color</strong>}
                  >
                    <ColorPicker format="hex" />
                  </Form.Item>
                </div>
              </div>
              <div style={{ flex: '1 1 300px' }}>
                <Form.Item label={<strong style={{ color: 'var(--text-secondary)' }}>Light Mode Logo</strong>}>
                  <Form.Item name="logo" hidden>
                    <Input />
                  </Form.Item>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <div style={{ 
                        width: 88, 
                        height: 88, 
                        background: '#f3f4f6', 
                        borderRadius: 12, 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        color: '#000', 
                        fontSize: 28, 
                        fontWeight: 800, 
                        boxShadow: 'var(--shadow-sm)',
                        overflow: 'hidden'
                      }}>
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo Light" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setLogoPreview(null)} />
                        ) : (
                          "BCC"
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <Upload
                          customRequest={customUpload}
                          showUploadList={false}
                          accept="image/*"
                        >
                          <Button 
                            icon={<UploadIcon size={16}/>} 
                            loading={uploadingLogo}
                            style={{ borderRadius: 8, marginBottom: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', fontWeight: 600 }}
                          >
                            Upload Light
                          </Button>
                        </Upload>
                        <Text type="secondary" style={{ display: 'block', fontSize: 11, fontWeight: 500 }}>Min 200x200px</Text>
                      </div>
                    </div>
                  </div>
                </Form.Item>

                <Form.Item label={<strong style={{ color: 'var(--text-secondary)' }}>Dark Mode Logo</strong>}>
                  <Form.Item name="logoDark" hidden>
                    <Input />
                  </Form.Item>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <div style={{ 
                        width: 88, 
                        height: 88, 
                        background: '#1f2937', 
                        borderRadius: 12, 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        color: '#fff', 
                        fontSize: 28, 
                        fontWeight: 800, 
                        boxShadow: 'var(--shadow-sm)',
                        overflow: 'hidden'
                      }}>
                        {logoDarkPreview ? (
                          <img src={logoDarkPreview} alt="Logo Dark" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setLogoDarkPreview(null)} />
                        ) : (
                          "BCC"
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <Upload
                          customRequest={customUploadDark}
                          showUploadList={false}
                          accept="image/*"
                        >
                          <Button 
                            icon={<UploadIcon size={16}/>} 
                            loading={uploadingLogoDark}
                            style={{ borderRadius: 8, marginBottom: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', fontWeight: 600 }}
                          >
                            Upload Dark
                          </Button>
                        </Upload>
                        <Text type="secondary" style={{ display: 'block', fontSize: 11, fontWeight: 500 }}>Min 200x200px</Text>
                      </div>
                    </div>
                  </div>
                </Form.Item>

                <Form.Item label={<strong style={{ color: 'var(--text-secondary)' }}>Invoice / Proposal Signature</strong>}>
                  <Form.Item name="invoiceSignature" hidden>
                    <Input />
                  </Form.Item>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <div style={{ 
                        width: 88, 
                        height: 88, 
                        background: '#f3f4f6', 
                        borderRadius: 12, 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        color: '#000', 
                        fontSize: 28, 
                        fontWeight: 800, 
                        boxShadow: 'var(--shadow-sm)',
                        overflow: 'hidden'
                      }}>
                        {signaturePreview ? (
                          <img src={signaturePreview} alt="Signature" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => setSignaturePreview(null)} />
                        ) : (
                          "Sign"
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <Upload
                          customRequest={customUploadSignature}
                          showUploadList={false}
                          accept="image/*"
                        >
                          <Button 
                            icon={<UploadIcon size={16}/>} 
                            loading={uploadingSignature}
                            style={{ borderRadius: 8, marginBottom: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', fontWeight: 600 }}
                          >
                            Upload Signature
                          </Button>
                        </Upload>
                        <Text type="secondary" style={{ display: 'block', fontSize: 11, fontWeight: 500 }}>Min 200x100px (Transparent PNG recommended)</Text>
                      </div>
                    </div>
                  </div>
                </Form.Item>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, borderTop: '1px solid var(--border-color)', paddingTop: 32 }}>
              <Button 
                type="primary" 
                size="large" 
                htmlType="submit"
                loading={loading}
                style={{ borderRadius: 8, background: 'var(--accent-primary)', fontWeight: 700, border: 'none', boxShadow: 'var(--shadow-sm)' }}
              >
                Save Agency Profile
              </Button>
            </div>
          </Form>
        </PanelCard>
      </motion.div>
    </>
  );
};

export default AgencyTab;
