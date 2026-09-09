import React, { useEffect, useState } from 'react';
import { Card, Typography, Form, Input, Button, Space, message, Tag, Skeleton, Alert, Row, Col, Select, Divider, Switch } from 'antd';
import { Settings, KeyRound, Globe, Sliders, Bell, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSEO } from '../context/SEOContext';
import { seoWorkspaceApi } from '../../../../api/seoWorkspaceApi';
import ProjectSelector from '../components/shared/ProjectSelector';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const SettingsTab = () => {
  const { activeProjectId, activeProject, refreshProjects } = useSEO();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  
  const [globalForm] = Form.useForm();
  const [projectForm] = Form.useForm();

  const loadGlobalSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await seoWorkspaceApi.getSettingsStatus();
      setStatus(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGlobalSettings();
  }, []);

  useEffect(() => {
    if (activeProject) {
      projectForm.setFieldsValue({
        name: activeProject.name,
        domain: activeProject.domain,
        languages: activeProject.languages || 'en',
        crawlFrequency: activeProject.settings?.crawlFrequency || 'weekly',
        autoAudit: activeProject.settings?.autoAudit ?? true,
        notifyOnRankChange: activeProject.settings?.notifyOnRankChange ?? true
      });
    }
  }, [activeProject, projectForm]);

  const handleSaveGlobal = async () => {
    const values = await globalForm.validateFields();
    setSavingGlobal(true);
    try {
      await seoWorkspaceApi.saveSettings({ anthropicApiKey: values.anthropicApiKey });
      message.success('Global AI credentials updated successfully');
      globalForm.resetFields();
      await loadGlobalSettings();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to save global settings');
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleSaveProject = async () => {
    if (!activeProjectId) return;
    const values = await projectForm.validateFields();
    setSavingProject(true);
    try {
      await seoWorkspaceApi.updateProjectSettings(activeProjectId, {
        crawlFrequency: values.crawlFrequency,
        autoAudit: values.autoAudit,
        notifyOnRankChange: values.notifyOnRankChange
      });
      message.success('Project configuration updated');
      refreshProjects();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to update project configuration');
    } finally {
      setSavingProject(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #1890ff 0%, #13c2c2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Settings size={24} color="#fff" />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 900 }}>SEO Settings & Configuration</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Manage global AI API keys and project-specific crawler thresholds.</Text>
          </div>
        </div>
        <ProjectSelector style={{ marginBottom: 0 }} />
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />}

      <Row gutter={[20, 20]}>
        {/* Project Specific Settings */}
        <Col xs={24} lg={12}>
          <Card 
            size="small" 
            title={<Space><Globe size={16} color="#1890ff" /> Active Project Settings ({activeProject ? activeProject.name : 'No project selected'})</Space>}
            style={{ borderRadius: 12, border: '1px solid var(--border-color)', height: '100%' }}
          >
            {activeProject ? (
              <Form form={projectForm} layout="vertical" onFinish={handleSaveProject}>
                <Form.Item name="name" label="Project Name">
                  <Input disabled />
                </Form.Item>
                <Form.Item name="domain" label="Target Domain">
                  <Input disabled />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="crawlFrequency" label="Automated Crawl Schedule">
                      <Select>
                        <Option value="daily">Daily Crawl</Option>
                        <Option value="weekly">Weekly Crawl</Option>
                        <Option value="monthly">Monthly Crawl</Option>
                        <Option value="manual">Manual Only</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="languages" label="Primary Language">
                      <Input placeholder="en" />
                    </Form.Item>
                  </Col>
                </Row>
                <Divider style={{ margin: '12px 0' }} />
                <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text strong>Auto-trigger Technical Audits</Text>
                      <div><Text type="secondary" style={{ fontSize: 12 }}>Run audit scans automatically on schedule</Text></div>
                    </div>
                    <Form.Item name="autoAudit" valuePropName="checked" noStyle>
                      <Switch />
                    </Form.Item>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text strong>Keyword Movement Alerts</Text>
                      <div><Text type="secondary" style={{ fontSize: 12 }}>Notify when tracked keywords gain/lose top 10 positions</Text></div>
                    </div>
                    <Form.Item name="notifyOnRankChange" valuePropName="checked" noStyle>
                      <Switch />
                    </Form.Item>
                  </div>
                </Space>
                <Button type="primary" htmlType="submit" loading={savingProject}>Save Project Settings</Button>
              </Form>
            ) : (
              <Alert message="Select or create a Workspace Project above to configure project-level crawler settings." type="info" showIcon />
            )}
          </Card>
        </Col>

        {/* Global AI Keys */}
        <Col xs={24} lg={12}>
          <Card 
            size="small" 
            title={<Space><KeyRound size={16} color="#722ed1" /> AI Engine Credentials</Space>}
            style={{ borderRadius: 12, border: '1px solid var(--border-color)', height: '100%' }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text strong>Active Provider: <Tag color="purple">{status?.activeProvider || 'anthropic'}</Tag></Text>
                  <Tag color="blue">{status?.activeModel || 'claude-sonnet-5'}</Tag>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text strong>Anthropic API Key:</Text>
                  {status?.isAnthropicConfigured
                    ? <Tag color="green">Active ({status.maskedAnthropicKey})</Tag>
                    : <Tag color="orange">Not Configured</Tag>}
                </div>

                <Text type="secondary" style={{ fontSize: 13 }}>
                  Used across all SEO agents (Keyword Research, Competitor Analysis, Technical SEO, AEO, GEO, Reports, and Content AI).
                </Text>

                <Form form={globalForm} layout="vertical" onFinish={handleSaveGlobal}>
                  <Form.Item
                    name="anthropicApiKey"
                    label={status?.isAnthropicConfigured ? 'Replace Anthropic API Key' : 'Anthropic API Key'}
                    rules={[{ required: !status?.isAnthropicConfigured, message: 'Enter an API key' }]}
                  >
                    <Input.Password placeholder="sk-ant-api03-..." />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={savingGlobal}>Update AI Credentials</Button>
                </Form>
              </Space>
            )}

          </Card>
        </Col>
      </Row>
    </motion.div>
  );
};

export default SettingsTab;