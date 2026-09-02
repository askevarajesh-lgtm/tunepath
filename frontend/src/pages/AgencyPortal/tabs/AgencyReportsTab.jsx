import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Table, Tag, Button, Input, Select, Modal, Form, Dropdown, message, Avatar, Skeleton } from 'antd';
import { motion } from 'framer-motion';
import { Download, Plus, FileText, BarChart2, Calendar, MoreVertical, Edit2, Trash2, Send, Filter, Eye } from 'lucide-react';
import api from '../../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const AgencyReportsTab = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [reports, setReports] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ total: 0, automated: 0, processing: 0 });
  const [loading, setLoading] = useState(true);
  const [editingReport, setEditingReport] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/agency/reports');
      setReports(res.data.data.reports);
      setStats(res.data.data.stats);
      setClients(res.data.data.clients || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      message.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    try {
      const values = await form.validateFields();
      if (editingReport) {
        await api.put(`/agency/reports/${editingReport.id}`, values);
        message.success('Report schedule updated successfully!');
      } else {
        await api.post('/agency/reports', values);
        message.success('Report schedule created successfully!');
      }
      setIsModalOpen(false);
      form.resetFields();
      setEditingReport(null);
      fetchReports();
    } catch (error) {
      console.error('Save failed:', error);
      if (error.errorFields) return; // Validation error
      message.error(error.response?.data?.message || 'Failed to save report schedule');
    }
  };

  const handleAction = async (action, record) => {
    try {
      if (action === 'delete') {
        await api.delete(`/agency/reports/${record.id}`);
        message.success('Report deleted successfully');
        fetchReports();
      } else if (action === 'edit') {
        setEditingReport(record);
        form.setFieldsValue({
          clientId: record.clientId,
          name: record.name,
          template: record.type,
          frequency: record.frequency,
          format: record.format,
          deliveryMethod: record.deliveryMethod,
        });
        setIsModalOpen(true);
      } else if (action === 'view') {
        message.info(`Viewing report: ${record.name}`);
      } else {
        const res = await api.post(`/agency/reports/${record.id}/action`, { action });
        message.success(res.data.message || `Action ${action} executed`);
      }
    } catch (error) {
      console.error(`Action ${action} failed:`, error);
      message.error(error.response?.data?.message || `Failed to execute action ${action}`);
    }
  };

  const getActionMenu = (record) => [
    { key: 'view', icon: <Eye size={16} />, label: 'View Report', onClick: () => handleAction('view', record) },
    { key: 'download', icon: <Download size={16} />, label: 'Download PDF', onClick: () => handleAction('download', record) },
    { key: 'send', icon: <Send size={16} />, label: 'Email to Client', onClick: () => handleAction('send', record) },
    { type: 'divider' },
    { key: 'edit', icon: <Edit2 size={16} />, label: 'Edit Schedule', onClick: () => handleAction('edit', record) },
    { key: 'delete', icon: <Trash2 size={16} />, label: 'Delete Report', danger: true, onClick: () => handleAction('delete', record) },
  ];

  const columns = [
    {
      title: 'REPORT NAME',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{text}</strong>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.type}</Text>
        </div>
      )
    },
    {
      title: 'CLIENT',
      dataIndex: 'client',
      key: 'client',
      render: (text) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size="small" style={{ backgroundColor: 'var(--accent-primary)' }}>{text.charAt(0)}</Avatar>
          <Text>{text}</Text>
        </div>
      )
    },
    {
      title: 'FREQUENCY',
      dataIndex: 'frequency',
      key: 'frequency',
      render: text => <Tag style={{ borderRadius: 12 }}>{text}</Tag>
    },
    {
      title: 'LAST GENERATED',
      dataIndex: 'lastGenerated',
      key: 'lastGenerated',
      render: text => <Text type="secondary">{new Date(text).toLocaleDateString()}</Text>
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      render: text => {
        let color = text === 'ready' ? 'success' : 'processing';
        return <Tag color={color} style={{ borderRadius: 12, border: `1px solid var(--accent-${color === 'success' ? 'secondary' : 'primary'})`, background: 'transparent', color: `var(--accent-${color === 'success' ? 'secondary' : 'primary'})` }}>{text.toUpperCase()}</Tag>
      }
    },
    {
      title: '',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Dropdown menu={{ items: getActionMenu(record) }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreVertical size={16} />} />
        </Dropdown>
      )
    }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>Client Reports</Title>
          <Text type="secondary">Automate, generate, and manage performance reports for your clients.</Text>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button icon={<Download size={16} />} style={{ borderRadius: 8 }}>Export All</Button>
          <Button type="primary" onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />} style={{ borderRadius: 8, background: 'var(--accent-primary)', fontWeight: 600 }}>
            Create Report
          </Button>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'TOTAL REPORTS', val: stats.total, icon: <FileText size={20} />, color: 'var(--accent-primary)' },
          { label: 'AUTOMATED', val: stats.automated, icon: <Calendar size={20} />, color: 'var(--accent-secondary)' },
          { label: 'PROCESSING', val: stats.processing, icon: <BarChart2 size={20} />, color: 'var(--accent-warning)' },
        ].map((kpi, i) => (
          <Col xs={24} md={8} key={i}>
            <Card 
              className="glassmorphism" 
              bodyStyle={{ padding: '24px' }} 
              style={{ borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5 }}>{kpi.label}</Text>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'var(--bg-secondary)', color: kpi.color, border: '1px solid var(--border-color)' }}>
                  {kpi.icon}
                </div>
              </div>
              <Title level={2} style={{ margin: 0, fontSize: 36, fontWeight: 800 }}>{kpi.val}</Title>
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <Input.Search placeholder="Search reports..." style={{ maxWidth: 300 }} />
          <Button icon={<Filter size={16} />}>Filter</Button>
        </div>
        
        <Table 
          columns={columns} 
          dataSource={reports} 
          rowKey="id" 
          pagination={{ defaultPageSize: 5, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }} 
          scroll={{ x: 800 }}
        />
      </Card>

      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 18 }}>Create New Report</span>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        className="glass-modal"
        centered
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateOrUpdate} style={{ marginTop: 24 }}>
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Report Name</Text>} name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Monthly SEO Performance" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>
          
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Select Client</Text>} name="clientId" rules={[{ required: true }]}>
            <Select placeholder="Select a client" size="large">
              {clients.map(client => (
                <Option key={client.id} value={client.id}>{client.name}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Template</Text>} name="template" rules={[{ required: true }]}>
            <Select placeholder="Select template" size="large">
              <Option value="Monthly Performance Report">Monthly Performance Report</Option>
              <Option value="SEO Ranking Report">SEO Ranking Report</Option>
              <Option value="Paid Media Report">Paid Media Report</Option>
              <Option value="Executive Summary">Executive Summary</Option>
            </Select>
          </Form.Item>

          <Form.Item label={<Text style={{ fontWeight: 600 }}>Generation Frequency</Text>} name="frequency" rules={[{ required: true }]}>
            <Select placeholder="Select frequency" size="large">
              <Option value="Daily">Daily</Option>
              <Option value="Weekly">Weekly</Option>
              <Option value="Bi-weekly">Bi-weekly</Option>
              <Option value="Monthly">Monthly</Option>
              <Option value="Quarterly">Quarterly</Option>
            </Select>
          </Form.Item>
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Next Send Date</Text>} name="nextSend" rules={[{ required: true }]}>
            <Input type="date" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32 }}>
            <Button onClick={() => setIsModalOpen(false)} style={{ borderRadius: 8, fontWeight: 600 }} size="large">Cancel</Button>
            <Button type="primary" htmlType="submit" style={{ background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 600 }} size="large">Schedule Report</Button>
          </div>
        </Form>
      </Modal>
    </motion.div>
  );
};

export default AgencyReportsTab;
