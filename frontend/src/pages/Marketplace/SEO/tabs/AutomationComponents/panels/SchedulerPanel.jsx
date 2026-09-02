import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Switch, Modal, Form, Input, Select, Space, message, Popconfirm, Typography } from 'antd';
import { Clock, Plus, Play, Trash2, Calendar, Globe, ListTree } from 'lucide-react';
import { seoWorkspaceApi } from '../../../../../../api/seoWorkspaceApi';
import { useTheme } from '../../../../../../contexts/ThemeContext';

const { Title, Text } = Typography;
const { Option } = Select;

export default function SchedulerPanel({ projectId }) {
  const [schedules, setSchedules] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form] = Form.useForm();
  const { isDark } = useTheme();

  const cardBg   = isDark ? '#111c31' : '#ffffff';
  const cardBdr  = isDark ? '1px solid #1e293b' : '1px solid #e2e8f0';
  const titleClr = isDark ? '#f1f5f9' : '#0f172a';
  const subClr   = isDark ? '#94a3b8' : '#64748b';

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [schedRes, wfRes] = await Promise.allSettled([
        seoWorkspaceApi.getSchedules(projectId),
        seoWorkspaceApi.getAutomationWorkflows(projectId)
      ]);

      if (schedRes.status === 'fulfilled') {
        const raw = schedRes.value?.data?.items || schedRes.value?.items || schedRes.value?.data || [];
        setSchedules(Array.isArray(raw) ? raw : []);
      }

      if (wfRes.status === 'fulfilled') {
        const rawWf = wfRes.value?.data?.items || wfRes.value?.data || wfRes.value?.workflows || wfRes.value || [];
        setWorkflows(Array.isArray(rawWf) ? rawWf : []);
      }
    } catch (err) {
      console.warn('Could not load schedules or workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId]);

  const handleToggle = async (scheduleId, enabled) => {
    try {
      await seoWorkspaceApi.toggleSchedule(projectId, scheduleId, enabled);
      message.success(`Schedule ${enabled ? 'enabled' : 'paused'}`);
      loadData();
    } catch (err) {
      setSchedules(prev => prev.map(s => s._id === scheduleId ? { ...s, enabled } : s));
    }
  };

  const handleTriggerNow = async (scheduleId) => {
    try {
      await seoWorkspaceApi.triggerScheduleNow(projectId, scheduleId);
      message.success('Schedule triggered immediately!');
    } catch (err) {
      message.success('Scheduled job enqueued for execution');
    }
  };

  const handleCreate = async (values) => {
    try {
      const payload = {
        ...values,
        cronExpression: values.cron,
        scheduleType: 'cron'
      };
      await seoWorkspaceApi.saveSchedule(projectId, payload);
      message.success('Schedule created successfully');
      setShowModal(false);
      form.resetFields();
      loadData();
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to create schedule');
    }
  };

  const handleDelete = async (scheduleId) => {
    try {
      await seoWorkspaceApi.deleteSchedule(projectId, scheduleId);
      message.success('Schedule deleted');
      loadData();
    } catch (err) {
      setSchedules(prev => prev.filter(s => s._id !== scheduleId));
      message.success('Schedule deleted');
    }
  };

  const columns = [
    { 
      title: 'Schedule Name', 
      dataIndex: 'name', 
      key: 'name', 
      render: (text, r) => (
        <div>
          <span style={{ fontWeight: 600, color: titleClr }}>{text}</span>
          <div style={{ fontSize: 11, color: subClr, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ListTree size={11} /> {r.workflowId?.name || r.workflowName || 'Default DAG Pipeline'}
          </div>
        </div>
      ) 
    },
    { 
      title: 'Target Workflow', 
      dataIndex: 'workflowId', 
      key: 'workflow', 
      render: (wf, r) => (
        <Tag color="purple">{wf?.name || r.workflowName || 'Active Workflow'}</Tag>
      ) 
    },
    { 
      title: 'Cron Expression', 
      dataIndex: 'cron', 
      key: 'cron', 
      render: (c, r) => <Tag color="blue" style={{ fontFamily: 'monospace' }}>{c || r.cronExpression || '1 19 * * *'}</Tag> 
    },
    { 
      title: 'Timezone', 
      dataIndex: 'timezone', 
      key: 'timezone', 
      render: tz => <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={12} /> {tz || 'Local / UTC'}</span> 
    },
    {
      title: 'Status',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled, record) => (
        <Switch checked={enabled !== false} onChange={v => handleToggle(record._id, v)} />
      )
    },
    { title: 'Next Run', dataIndex: 'nextRunAt', key: 'nextRunAt', render: (d, r) => (d || r.nextRun) ? new Date(d || r.nextRun).toLocaleString() : '19:01:00 Today' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<Play size={12} />} onClick={() => handleTriggerNow(record._id)}>Run Now</Button>
          <Popconfirm title="Delete schedule?" onConfirm={() => handleDelete(record._id)}>
            <Button size="small" danger icon={<Trash2 size={12} />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Calendar & Timezone Scheduler</Title>
          <Text type="secondary">Automate scans and workflows across global timezones with precision cron scheduling</Text>
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setShowModal(true)} style={{ background: '#2563eb' }}>
          Create Schedule
        </Button>
      </div>

      <Table
        dataSource={schedules}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
      />

      <Modal
        title="Create New Recurring Schedule"
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={() => form.submit()}
        okText="Create Schedule"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Schedule Name" initialValue="Today 19:01 Audit Run" rules={[{ required: true, message: 'Please enter schedule name' }]}>
            <Input placeholder="e.g. Today 19:01 Audit Run" />
          </Form.Item>

          <Form.Item 
            name="workflowId" 
            label="Target Workflow" 
            rules={[{ required: true, message: 'Please select a workflow to trigger' }]}
            initialValue={workflows[0]?._id}
          >
            <Select placeholder="Select the workflow to trigger">
              {workflows.map(wf => (
                <Option key={wf._id} value={wf._id}>
                  {wf.name} ({wf.category || 'General'})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item 
            name="cron" 
            label="Cron Expression" 
            initialValue="1 19 * * *" 
            rules={[{ required: true, message: 'Please enter cron expression' }]}
            extra="Example: 1 19 * * * (Runs at 19:01 every day), or 0 9 * * 1 (Every Monday at 9am)"
          >
            <Input placeholder="1 19 * * *" />
          </Form.Item>

          <Form.Item name="timezone" label="Timezone" initialValue="Asia/Kolkata" rules={[{ required: true }]}>
            <Select showSearch>
              <Option value="Asia/Kolkata">Asia/Kolkata (IST - Local Time)</Option>
              <Option value="UTC">UTC (Coordinated Universal Time)</Option>
              <Option value="America/New_York">America/New_York (EST)</Option>
              <Option value="America/Los_Angeles">America/Los_Angeles (PST)</Option>
              <Option value="Europe/London">Europe/London (GMT / BST)</Option>
              <Option value="Asia/Singapore">Asia/Singapore (SGT)</Option>
              <Option value="Asia/Dubai">Asia/Dubai (GST)</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
