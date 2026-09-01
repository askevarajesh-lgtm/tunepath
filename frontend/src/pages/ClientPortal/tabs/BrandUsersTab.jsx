import React, { useState, useEffect } from 'react';
import { Typography, Table, Button, Tag, Modal, Form, Input, message, Checkbox, Space, Popconfirm, Tooltip } from 'antd';
import { motion } from 'framer-motion';
import { Users, CheckCircle2, UserPlus, Edit2, Trash2, LogIn } from 'lucide-react';
import PhoneInput from '../../../components/common/PhoneInput';
import { isValidPhoneNumber } from 'libphonenumber-js';

const { Title, Text } = Typography;

const BrandUsersTab = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const [userCountryCode, setUserCountryCode] = useState('91');
  const [userCountryIso, setUserCountryIso] = useState('IN');

  const parentFeatures = user?.features || [];
  const availableFeatures = [
    { id: 'hrms', label: 'HRMS' },
    { id: 'crm', label: 'CRM & Leads' },
    { id: 'website', label: 'Website Builder' },
    { id: 'social', label: 'Social Media' },
    { id: 'ads', label: 'Performance Ads' },
    { id: 'analytics', label: 'Google Analytics' },
    { id: 'chatgpt', label: 'Chatgpt' },
    { id: 'canva', label: 'Canva' },
    { id: 'seo-aeo-geo', label: 'SEO/AEO/GEO' },
    // { id: 'benchmark', label: 'Benchmark' },
  ].filter(f => parentFeatures.includes(f.id));

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.filter(u => u.role !== 'user'));
      }
    } catch (error) {
      console.error('Failed to fetch users', error);
      message.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (values) => {
    try {
      setSubmitLoading(true);
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
          countryCode: userCountryCode,
          password: values.password,
          role: 'brand_manager',
          features: values.features || []
        })
      });

      const data = await res.json();
      if (data.success) {
        message.success('User created successfully');
        setIsModalOpen(false);
        form.resetFields();
        setUserCountryCode('91');
        setUserCountryIso('IN');
        fetchUsers();
      } else {
        message.error(data.message || 'Failed to create user');
      }
    } catch (error) {
      message.error('An error occurred');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditUser = async (values) => {
    try {
      setSubmitLoading(true);
      const res = await fetch(`/api/users/${editingUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: values.name,
          phone: values.phone,
          countryCode: userCountryCode,
          ...(values.password ? { password: values.password } : {}),
          features: values.features || []
        })
      });

      const data = await res.json();
      if (data.success) {
        message.success('User updated successfully');
        setIsEditModalOpen(false);
        setEditingUser(null);
        editForm.resetFields();
        fetchUsers();
      } else {
        message.error(data.message || 'Failed to update user');
      }
    } catch (error) {
      message.error('An error occurred');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        message.success('User deleted successfully');
        fetchUsers();
      } else {
        message.error(data.message || 'Failed to delete user');
      }
    } catch (error) {
      message.error('An error occurred');
    }
  };

  const handleLoginAs = async (userId) => {
    try {
      const res = await fetch(`/api/auth/impersonate/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('original_token', localStorage.getItem('token'));
        localStorage.setItem('original_user', localStorage.getItem('user'));
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', data.user.role);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        message.success(`Logged in as ${data.user.name}`);
        window.location.href = '/client/dashboard';
      } else {
        message.error(data.error || 'Failed to login as user');
      }
    } catch (error) {
      console.error(error);
      message.error('An error occurred');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (text) => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
    { title: 'Role', dataIndex: 'role', key: 'role', render: (text) => <Tag style={{ borderRadius: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>{(text || '').replace(/_/g, ' ').toUpperCase()}</Tag> },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (text) => <Text type="secondary">{text}</Text> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => {
      const displayStatus = status === 'active' ? 'Active' : 'Pending Invite';
      return (
        <span style={{ color: displayStatus === 'Active' ? 'var(--accent-primary)' : 'var(--accent-warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          {displayStatus === 'Active' ? <CheckCircle2 size={14}/> : <div style={{width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-warning)'}}/>}
          {displayStatus}
        </span>
      );
    }},
    { title: 'Actions', key: 'actions', align: 'right', render: (_, record) => {
      if (record._id === user?._id || record.role === 'agency_client') return <Text type="secondary">-</Text>;
      
      return (
        <Space>

          <Tooltip title="Edit">
            <Button 
              type="text" 
              icon={<Edit2 size={16} />} 
              onClick={() => {
                setEditingUser(record);
                setUserCountryCode(record.countryCode || '91');
                editForm.setFieldsValue({
                  name: record.name,
                  email: record.email,
                  phone: record.phone,
                  features: record.features || []
                });
                setIsEditModalOpen(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete the user"
            description="Are you sure to delete this user?"
            onConfirm={() => handleDeleteUser(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<Trash2 size={16} />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      );
    }}
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >
      <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Managers</Title>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>Manage your brand's team members.</Text>
        </div>
        <Button 
          type="primary" 
          icon={<UserPlus size={16} />} 
          onClick={() => setIsModalOpen(true)}
          style={{ background: 'var(--accent-primary)', fontWeight: 700, borderRadius: 8, height: 40 }}
        >
          Create User
        </Button>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Table 
          columns={columns} 
          dataSource={users} 
          loading={loading} 
          rowKey="_id" 
          pagination={false} 
          
          style={{ background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}
        />
      </motion.div>

      <Modal
        title={<span style={{ fontWeight: 800, fontSize: 18 }}>Create User</span>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateUser} style={{ marginTop: 24 }}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input placeholder="e.g. Jane Doe" />
          </Form.Item>
          <Form.Item name="email" label="Email Address" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
            <Input type="email" placeholder="jane@brand.com" />
          </Form.Item>
          <Form.Item 
            name="phone" 
            label="Phone Number"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (isValidPhoneNumber(value, userCountryIso)) {
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
              countryCodeValue={userCountryCode}
              onCountryCodeChange={setUserCountryCode}
              isoCountryValue={userCountryIso}
              onCountryIsoChange={setUserCountryIso}
            />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Please enter a password' }]}>
            <Input.Password placeholder="Enter a secure password" />
          </Form.Item>
          {availableFeatures.length > 0 && (
            <Form.Item name="features" label="Configure Permissions (Modules)">
              <Checkbox.Group options={availableFeatures.map(f => ({ label: f.label, value: f.id }))} />
            </Form.Item>
          )}
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitLoading} block style={{ background: 'var(--accent-primary)', fontWeight: 700 }}>
              Create User
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span style={{ fontWeight: 800, fontSize: 18 }}>Edit User</span>}
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditUser} style={{ marginTop: 24 }}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input placeholder="e.g. Jane Doe" />
          </Form.Item>
          <Form.Item name="email" label="Email Address">
            <Input type="email" disabled />
          </Form.Item>
          <Form.Item 
            name="phone" 
            label="Phone Number"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (isValidPhoneNumber(value, userCountryIso)) {
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
              countryCodeValue={userCountryCode}
              onCountryCodeChange={setUserCountryCode}
              isoCountryValue={userCountryIso}
              onCountryIsoChange={setUserCountryIso}
            />
          </Form.Item>
          <Form.Item name="password" label="Password (Leave blank to keep current)">
            <Input.Password placeholder="Enter a new password" />
          </Form.Item>
          {availableFeatures.length > 0 && (
            <Form.Item name="features" label="Configure Permissions (Modules)">
              <Checkbox.Group options={availableFeatures.map(f => ({ label: f.label, value: f.id }))} />
            </Form.Item>
          )}
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitLoading} block style={{ background: 'var(--accent-primary)', fontWeight: 700 }}>
              Update User
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </motion.div>
  );
};

export default BrandUsersTab;