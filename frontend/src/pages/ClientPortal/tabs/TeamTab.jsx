import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Table, Tag, Modal, Form, Input, Select, message } from 'antd';
import { motion } from 'framer-motion';
import { Users, CheckCircle2 } from 'lucide-react';
import PhoneInput from '../../../components/common/PhoneInput';
import { isValidPhoneNumber } from 'libphonenumber-js';

const { Title, Text } = Typography;
const { Option } = Select;

const TeamTab = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [form] = Form.useForm();

  const [teamCountryCode, setTeamCountryCode] = useState('91');
  const [teamCountryIso, setTeamCountryIso] = useState('IN');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch users', error);
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInvite = async (values) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          phone: values.phone,
          countryCode: teamCountryCode,
          password: values.password,
          role: values.role
        })
      });
      const data = await res.json();
      if (data.success) {
        message.success('Team member added successfully');
        setIsInviteModalOpen(false);
        form.resetFields();
        setTeamCountryCode('91');
        setTeamCountryIso('IN');
        fetchUsers();
      } else {
        message.error(data.message || 'Failed to add user');
      }
    } catch (error) {
      console.error('Failed to add user', error);
      message.error('An error occurred while adding the user');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (text) => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (text) => <Text type="secondary">{text}</Text> },
    { title: 'Role', dataIndex: 'role', key: 'role', render: (text) => <Tag style={{ borderRadius: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>{text.replace(/_/g, ' ').toUpperCase()}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => {
      const displayStatus = status === 'active' ? 'Active' : 'Pending Invite';
      return (
        <span style={{ color: displayStatus === 'Active' ? 'var(--accent-primary)' : 'var(--accent-warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          {displayStatus === 'Active' ? <CheckCircle2 size={14}/> : <div style={{width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-warning)'}}/>}
          {displayStatus}
        </span>
      );
    }},
    { title: 'Actions', key: 'actions', align: 'right', render: () => <Button type="link" style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>Manage</Button> }
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >
      <motion.div variants={itemVariants} style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>User Management</Title>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>Manage your brand's workspace members, roles, and access.</Text>
        </div>
        <Button type="primary" onClick={() => setIsInviteModalOpen(true)} icon={<Users size={16} />} style={{ fontWeight: 700, borderRadius: 8, background: 'var(--accent-primary)', border: 'none' }}>
          Add User
        </Button>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card 
          className="glassmorphism"
          style={{ borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}
          bodyStyle={{ padding: 0 }}
        >
          <Table columns={columns} dataSource={users} rowKey="_id" loading={loading} pagination={false}  />
        </Card>
      </motion.div>

      {/* Add User Modal */}
      <Modal
        title={<span style={{ fontWeight: 800, fontSize: 18 }}>Add User</span>}
        open={isInviteModalOpen}
        onCancel={() => {
          setIsInviteModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        style={{ borderRadius: 16, overflow: 'hidden' }}
      >
        <Form form={form} layout="vertical" onFinish={handleInvite} style={{ marginTop: 24 }}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
            <Input placeholder="John Doe" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="email" label="Email Address" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="john@company.com" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item 
            name="phone" 
            label="Phone Number"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (isValidPhoneNumber(value, teamCountryIso)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Please enter a valid phone number for the selected country'));
                }
              }
            ]}
          >
            <PhoneInput 
              size="large" 
              style={{ borderRadius: 8 }} 
              countryCodeValue={teamCountryCode}
              onCountryCodeChange={setTeamCountryCode}
              isoCountryValue={teamCountryIso}
              onCountryIsoChange={setTeamCountryIso}
            />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password placeholder="Secure password" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]} initialValue="brand_team_user">
            <Select size="large">
              <Option value="brand_manager">Brand Manager (Full Access)</Option>
              <Option value="brand_team_user">Team User (Restricted)</Option>
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" style={{ marginTop: 16, borderRadius: 8, fontWeight: 700 }}>
            Add User
          </Button>
        </Form>
      </Modal>
    </motion.div>
  );
};

export default TeamTab;
