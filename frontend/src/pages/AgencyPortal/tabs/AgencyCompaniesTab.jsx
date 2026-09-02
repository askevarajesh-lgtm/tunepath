import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Table, Tag, Button, Input, Select, Avatar, Modal, Form, message, Dropdown } from 'antd';
import { motion } from 'framer-motion';
import { Download, Plus, Users, Activity, AlertTriangle, MoreVertical, Edit2, Trash2, ShieldOff, ShieldCheck, ArrowUpRight } from 'lucide-react';
import api from '../../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const AgencyCompaniesTab = () => {
  const [filter, setFilter] = useState('All');
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1, 
      transition: { type: 'spring', stiffness: 300, damping: 24 } 
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/brands');
      setCompanies(res.data.data || []);
    } catch (error) {
      message.error("Failed to fetch companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = () => {
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/brands', {
        name: values.name,
        email: values.email,
        password: values.password
      });
      message.success("Company created successfully");
      setIsModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      if (error.response && error.response.data) {
        message.error(error.response.data.message || "Failed to create company");
      }
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/brands/${id}`, { status: newStatus });
      message.success(`Company marked as ${newStatus}`);
      fetchData();
    } catch (error) {
      message.error("Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: 'Delete Company',
      content: 'Are you sure you want to delete this company? This action cannot be undone.',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await api.delete(`/brands/${id}`);
          message.success("Company deleted successfully");
          fetchData();
        } catch (error) {
          message.error("Failed to delete company");
        }
      }
    });
  };

  const getActionMenu = (record) => {
    return [
      record.status === 'active' 
        ? { key: 'suspend', icon: <ShieldOff size={16} />, label: 'Suspend Company' }
        : { key: 'activate', icon: <ShieldCheck size={16} />, label: 'Activate Company' },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={16} />, label: 'Delete Company', danger: true },
    ];
  };

  const handleActionClick = ({ key }, record) => {
    switch (key) {
      case 'suspend':
        handleStatusChange(record._id, 'suspended');
        break;
      case 'activate':
        handleStatusChange(record._id, 'active');
        break;
      case 'delete':
        handleDelete(record._id);
        break;
      default:
        break;
    }
  };

  const columns = [
    { 
      title: 'COMPANY', 
      dataIndex: 'name', 
      key: 'name', 
      render: (text, record) => {
        const initial = text.charAt(0).toUpperCase();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar style={{ backgroundColor: 'var(--accent-primary)' }}>{initial}</Avatar>
            <div>
              <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{text}</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, marginTop: 2 }}>
                <span style={{ color: record.status === 'active' ? 'var(--accent-secondary)' : 'var(--accent-danger)', fontSize: 10 }}>●</span>
                <Text type="secondary">{record.managerEmail || 'No manager assigned'}</Text>
              </div>
            </div>
          </div>
        );
      }
    },
    { 
      title: 'STATUS', 
      dataIndex: 'status', 
      key: 'status', 
      render: text => {
        let color = text === 'active' ? 'success' : 'warning';
        return <Tag color={color} style={{ borderRadius: 12, background: 'transparent', border: `1px solid var(--accent-${color === 'success' ? 'secondary' : 'warning'})`, color: `var(--accent-${color === 'success' ? 'secondary' : 'warning'})` }}>{text.toUpperCase()}</Tag>
      } 
    },
    { 
      title: 'CREATED DATE', 
      dataIndex: 'createdAt', 
      key: 'createdAt', 
      render: text => <Text type="secondary">{new Date(text).toLocaleDateString()}</Text> 
    },
    { 
      title: '', 
      key: 'action', 
      align: 'right',
      render: (_, record) => (
        <Dropdown menu={{ items: getActionMenu(record), onClick: (e) => handleActionClick(e, record) }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreVertical size={16} />} />
        </Dropdown>
      ) 
    }
  ];

  const filteredCompanies = React.useMemo(() => {
    return companies.filter(company => {
      if (filter === 'All') return true;
      if (filter === 'Active') return company.status === 'active';
      return company.status === filter.toLowerCase();
    });
  }, [companies, filter]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>Companies</Title>
          <Text type="secondary">Manage your client companies and assign managers.</Text>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button icon={<Download size={16} />} style={{ borderRadius: 8, borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-secondary)' }}>Export</Button>
          <Button type="primary" onClick={handleOpenModal} icon={<Plus size={16} />} style={{ borderRadius: 8, background: 'var(--accent-primary)', border: 'none', boxShadow: 'var(--shadow-md)' }}>Create Company</Button>
        </div>
      </motion.div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'TOTAL COMPANIES', val: companies.length, sub: 'All clients', icon: <Users size={20} />, color: 'var(--accent-primary)', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, transparent 100%)' },
          { label: 'ACTIVE COMPANIES', val: companies.filter(c => c.status === 'active').length, sub: 'Currently active', icon: <Activity size={20} />, color: 'var(--accent-secondary)', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, transparent 100%)' },
        ].map((kpi, i) => (
          <Col style={{ flex: '1 1 200px', minWidth: 200 }} key={i}>
            <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: '100%' }}>
              <Card 
                className="glassmorphism" 
                bodyStyle={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }} 
                style={{ 
                  borderRadius: 16, 
                  height: '100%', 
                  border: '1px solid var(--border-color)', 
                  boxShadow: 'var(--shadow-md)',
                  background: `var(--glass-bg)`,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: kpi.gradient, pointerEvents: 'none' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, position: 'relative', zIndex: 1 }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5 }}>{kpi.label}</Text>
                  <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'var(--bg-secondary)', color: kpi.color, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    {kpi.icon}
                  </div>
                </div>
                
                <div style={{ marginTop: 'auto', position: 'relative', zIndex: 1 }}>
                  <Title level={2} style={{ margin: '0 0 4px', fontSize: 36, fontWeight: 800, color: kpi.isAlert ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{kpi.val}</Title>
                  <Text style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{kpi.sub}</Text>
                </div>
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>

      <motion.div variants={itemVariants} className="glassmorphism" style={{ padding: '20px 24px', borderRadius: 16, marginBottom: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
          {[
            { label: 'All', count: companies.length },
            { label: 'Active', count: companies.filter(c => c.status === 'active').length },
            { label: 'Suspended', count: companies.filter(c => c.status === 'suspended').length }
          ].map(f => (
            <motion.div 
              key={f.label}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(f.label)}
              style={{ 
                padding: '6px 14px', 
                borderRadius: 20, 
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                background: filter === f.label ? 'var(--text-primary)' : 'transparent',
                color: filter === f.label ? 'var(--bg-primary)' : 'var(--text-secondary)',
                border: filter === f.label ? '1px solid var(--text-primary)' : '1px solid var(--border-color)',
                fontWeight: filter === f.label ? 600 : 500,
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {f.label} <Tag style={{ borderRadius: 12, margin: 0, background: filter === f.label ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)', border: 'none', color: 'inherit', fontWeight: 600 }}>{f.count}</Tag>
            </motion.div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
          <Input.Search 
            placeholder="Search companies..." 
            style={{ width: '100%', maxWidth: 360 }} 
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <Table 
            columns={columns} 
            dataSource={filteredCompanies} 
            rowKey="_id" 
            pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }} 
            size="middle"
            loading={loading}
            scroll={{ x: 1000 }} 
            style={{ minWidth: 1000 }}
          />
        </div>
      </motion.div>

      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 18 }}>Create Company</span>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        className="glass-modal"
        centered
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Company Name</Text>} name="name" rules={[{ required: true, message: 'Please enter company name' }]}>
            <Input placeholder="e.g. Acme Corp" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>
          
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Manager Email</Text>} name="email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
            <Input placeholder="manager@acmecorp.com" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>
          
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Manager Password</Text>} name="password" rules={[{ required: true, message: 'Please set an initial password' }]}>
            <Input.Password placeholder="Set manager password" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32 }}>
            <Button onClick={() => setIsModalOpen(false)} style={{ borderRadius: 8, fontWeight: 600 }} size="large">Cancel</Button>
            <Button type="primary" onClick={handleCreate} style={{ background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 600 }} size="large">Create Company</Button>
          </div>
        </Form>
      </Modal>
    </motion.div>
  );
};

export default AgencyCompaniesTab;
