import React, { useState, useEffect } from 'react';
import { Select, DatePicker, Button, Input, Tooltip, Typography, Modal, Form, message, Divider } from 'antd';
import { RotateCw, Download, Search, Info, Settings, Plus } from 'lucide-react';
import dayjs from 'dayjs';
import { analyticsApi } from '../../../api/analyticsApi';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

const RANGE_PRESETS = {
  'Last 7 days': [dayjs().subtract(6, 'day'), dayjs()],
  'Last 30 days': [dayjs().subtract(29, 'day'), dayjs()],
  'Last 90 days': [dayjs().subtract(89, 'day'), dayjs()],
  'Month to date': [dayjs().startOf('month'), dayjs()],
};

const DashboardFilters = React.memo(function DashboardFilters({
  projects,
  selectedProject,
  onProjectChange,
  dateRange,
  onDateRangeChange,
  searchTerm,
  onSearchChange,
  onRefresh,
  onProjectsRefresh,
  refreshing,
  onExport,
  showExport,
  previousDateRange
}) {
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [configForm] = Form.useForm();

  const [isAddDomainModalOpen, setIsAddDomainModalOpen] = useState(false);
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [addDomainForm] = Form.useForm();

  const handleOpenConfig = () => {
    if (!selectedProject) return;
    const project = projects.find(p => p._id === selectedProject);
    configForm.setFieldsValue({
      ga4PropertyId: project?.credentials?.ga4PropertyId || ''
    });
    setIsConfigModalOpen(true);
  };

  const handleSaveConfig = async (values) => {
    setIsConfiguring(true);
    try {
      await analyticsApi.configureGA4Property(selectedProject, values.ga4PropertyId);
      message.success('Google Analytics Property ID saved successfully!');
      setIsConfigModalOpen(false);
      onRefresh({ bypassCache: true }); // Bypass cache to fetch fresh data
      if (onProjectsRefresh) onProjectsRefresh(); // Refresh projects to update cached credentials
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to save config.');
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleAddDomain = async (values) => {
    setIsAddingDomain(true);
    try {
      const res = await analyticsApi.createProject({
        domain: values.domain,
        siteUrl: values.domain,
        name: values.name,
        ga4PropertyId: values.ga4PropertyId
      });
      if (res.success && res.data) {
        const newProjectId = res.data._id;
        message.success('Domain added successfully!');
        setIsAddDomainModalOpen(false);
        addDomainForm.resetFields();
        if (onProjectsRefresh) await onProjectsRefresh();
        onProjectChange(newProjectId);
      }
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to add domain');
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleProjectChange = (val) => {
    onProjectChange(val);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          value={selectedProject}
          onChange={handleProjectChange}
          showSearch
          optionFilterProp="children"
          filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}
          style={{ width: 220, fontWeight: 600 }}
          size="large"
          aria-label="Select domain"
        >
          {projects.map(p => <Option key={p._id} value={p._id}>{p.domain} ({p.name})</Option>)}
        </Select>

        <Button 
          type="primary" 
          icon={<Plus size={16} />} 
          onClick={() => setIsAddDomainModalOpen(true)}
          size="large"
          style={{ borderRadius: 8, height: 40, background: 'var(--accent-primary)', color: '#fff', border: 'none', boxShadow: 'var(--shadow-sm)', fontWeight: 600 }}
        >
          Add Domain
        </Button>

        {selectedProject && (
          <Tooltip title="Configure Google Analytics 4">
            <Button
              icon={<Settings size={16} />}
              onClick={handleOpenConfig}
              size="large"
              aria-label="Configure GA4 Property ID"
              style={{ borderRadius: 8, height: 40 }}
            />
          </Tooltip>
        )}

        <RangePicker
          value={dateRange}
          onChange={onDateRangeChange}
          presets={Object.entries(RANGE_PRESETS).map(([label, value]) => ({ label, value }))}
          allowClear={false}
          style={{ borderRadius: 8, height: 40, borderColor: 'var(--border-color)', background: 'var(--bg-secondary)', fontWeight: 600 }}
          aria-label="Select date range"
        />

        <Tooltip title="Refresh data">
          <Button
            icon={<RotateCw size={16} className={refreshing ? 'spin-icon' : ''} />}
            onClick={() => onRefresh({ bypassCache: true })}
            loading={refreshing}
            size="large"
            aria-label="Refresh analytics data"
            style={{ borderRadius: 8, height: 40, fontWeight: 600 }}
          />
        </Tooltip>

        {showExport && (
          <Button
            type="primary"
            icon={<Download size={16} />}
            onClick={onExport}
            size="large"
            aria-label="Export Analytics PDF Report"
            style={{ borderRadius: 8, height: 40, background: 'var(--accent-primary)', color: '#fff', border: 'none', boxShadow: 'var(--shadow-md)', fontWeight: 600 }}
          >
            Export PDF
          </Button>
        )}
      </div>

      {/* Configure GA4 Modal */}
      <Modal
        title="Configure Google Analytics 4"
        open={isConfigModalOpen}
        onCancel={() => setIsConfigModalOpen(false)}
        footer={null}
      >
        <Form form={configForm} layout="vertical" onFinish={handleSaveConfig}>
          <Form.Item
            name="ga4PropertyId"
            label="GA4 Property ID"
            rules={[{ required: true, message: 'Please enter the GA4 Property ID' }]}
            help={
              <div style={{ marginTop: 8 }}>
                <p style={{ margin: '0 0 8px 0' }}>1. Find your Property ID in Google Analytics &gt; Admin &gt; Property Settings.</p>
                <p style={{ margin: 0 }}>
                  2. <strong>Important:</strong> You must add our service account email as a <strong>Viewer</strong> in your Google Analytics Property Access Management:
                </p>
                <code style={{ display: 'block', padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: 4, marginTop: 8, wordBreak: 'break-all' }}>
                  content-marketing-research@deep-geography-489307-e4.iam.gserviceaccount.com
                </code>
              </div>
            }
          >
            <Input placeholder="e.g. 544687897" size="large" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <Button onClick={() => setIsConfigModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={isConfiguring}>Save Configuration</Button>
          </div>
        </Form>
      </Modal>

      {/* Add New Domain Modal */}
      <Modal
        title="Add New Domain"
        open={isAddDomainModalOpen}
        onCancel={() => setIsAddDomainModalOpen(false)}
        footer={null}
      >
        <Form form={addDomainForm} layout="vertical" onFinish={handleAddDomain}>
          <Form.Item
            name="domain"
            label="Website URL / Domain"
            rules={[{ required: true, message: 'Please enter the domain URL' }]}
          >
            <Input placeholder="e.g. https://example.com" size="large" />
          </Form.Item>
          <Form.Item
            name="name"
            label="Project / Business Name"
            rules={[{ required: true, message: 'Please enter the project name' }]}
          >
            <Input placeholder="e.g. Acme Corp" size="large" />
          </Form.Item>
          <Form.Item
            name="ga4PropertyId"
            label="GA4 Property ID (Optional)"
            help="Configure your Google Analytics property immediately, or do it later."
          >
            <Input placeholder="e.g. 544687897" size="large" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <Button onClick={() => setIsAddDomainModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={isAddingDomain}>Add Domain</Button>
          </div>
        </Form>
      </Modal>
    </>
  );
});

export default DashboardFilters;
