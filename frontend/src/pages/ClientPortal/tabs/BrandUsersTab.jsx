import React, { useState, useEffect } from 'react';
import {
  Typography, Table, Button, Tag, Modal, Form, Input, Select,
  message, Checkbox, Space, Popconfirm, Tooltip, Card, Tabs, Avatar, Divider
} from 'antd';
import { motion } from 'framer-motion';
import {
  Users, Building2, Plus, Search, Edit2, Trash2, LogIn, Sliders, Layers
} from 'lucide-react';
import PhoneInput from '../../../components/common/PhoneInput';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const allModuleOptions = [
  { id: 'crm', label: 'CRM & Leads' },
  { id: 'ads', label: 'Performance Ads' },
  { id: 'social', label: 'Social Media' },
  { id: 'website', label: 'Website Builder' },
  { id: 'analytics', label: 'Google Analytics' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'claude', label: 'Claude AI' },
  { id: 'canva', label: 'Canva' },
  { id: 'seo-aeo-geo', label: 'SEO / AEO / GEO' },
  { id: 'seo', label: 'SEO Intelligence' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'aistudio', label: 'AI Studio' },
  { id: 'hrms', label: 'HRMS' }
];

const allIntegrationOptions = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'Email' },
  { id: 'website', label: 'Website & Forms' },
  { id: 'ekta', label: 'Ekta HR' }
];

const BrandUsersTab = ({ user }) => {
  const { user: authUser } = useAuth();
  const activeUser = user || authUser;

  const [activeTab, setActiveTab] = useState('user');
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Search states
  const [userSearch, setUserSearch] = useState('');
  const [deptSearch, setDeptSearch] = useState('');

  // Modals state
  const [userModal, setUserModal] = useState({ open: false, record: null });
  const [deptModal, setDeptModal] = useState({ open: false, record: null });
  const [userForm] = Form.useForm();
  const [deptForm] = Form.useForm();

  // Phone states
  const [userCountryCode, setUserCountryCode] = useState('91');
  const [userCountryIso, setUserCountryIso] = useState('IN');

  const parentFeatures = activeUser?.features || [];
  const parentIntegrations = activeUser?.integrations || [];

  const availableFeatures = allModuleOptions.filter(
    f => parentFeatures.includes(f.id)
  );

  const availableIntegrations = allIntegrationOptions.filter(
    i => parentIntegrations.includes(i.id)
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, deptsRes] = await Promise.all([
        api.get('/users'),
        api.get('/departments')
      ]);

      if (usersRes.data && usersRes.data.success) {
        const allUsers = usersRes.data.data || [];
        setUsers(
          allUsers.filter(
            u =>
              u._id !== (activeUser?._id || activeUser?.id) &&
              u.role !== 'supreme_super_admin' &&
              u.role !== 'commander_admin'
          )
        );
      }

      if (deptsRes.data && deptsRes.data.success) {
        setDepartments(deptsRes.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load team and department data', error);
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeUser?._id]);

  // User Handlers
  const handleUserSubmit = async () => {
    try {
      const values = await userForm.validateFields();
      setSubmitLoading(true);
      const isAgencyFlow =
        activeUser?.role === 'agency_client' ||
        (!activeUser?.isDirect && activeUser?.agencyId);

      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        countryCode: userCountryCode,
        departmentId: values.departmentId || null,
        status: values.status || 'active',
        isActive: values.status === 'active',
        role: isAgencyFlow ? 'user' : (values.role || 'brand_manager'),
        roleName: isAgencyFlow ? 'Team Member' : (values.roleName || 'Brand Manager'),
        features: values.features || [],
        integrations: values.integrations || []
      };

      if (values.password) {
        payload.password = values.password;
      }

      if (userModal.record) {
        await api.put(`/users/${userModal.record._id}`, payload);
        message.success('User updated successfully');
      } else {
        await api.post('/users', payload);
        message.success('User created successfully');
      }

      setUserModal({ open: false, record: null });
      userForm.resetFields();
      fetchData();
    } catch (err) {
      console.error(err);
      if (err.response?.data?.message || err.response?.data?.error) {
        message.error(err.response.data.message || err.response.data.error);
      } else if (err.errorFields) {
        // Form validation error
      } else {
        message.error('Error saving user');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      message.success('User deleted successfully');
      fetchData();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleLoginAs = async (userId) => {
    try {
      const res = await api.post(`/auth/impersonate/${userId}`);
      if (res.data && res.data.success) {
        localStorage.setItem('original_token', localStorage.getItem('token'));
        localStorage.setItem('original_user', localStorage.getItem('user'));
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('userRole', res.data.user.role);
        localStorage.setItem('user', JSON.stringify(res.data.user));

        message.success(`Logged in as ${res.data.user.name}`);
        const isClientPortalUser =
          ['agency_client', 'brand_super_admin', 'brand_manager', 'brand_admin', 'brand_team_user', 'client'].includes(res.data.user.role) ||
          Boolean(res.data.user.brandId);
        window.location.href = isClientPortalUser
          ? '/client/dashboard'
          : '/user/dashboard';
      }
    } catch (error) {
      console.error(error);
      message.error(error.response?.data?.error || error.response?.data?.message || 'Failed to login as user');
    }
  };

  // Department Handlers
  const handleDeptSubmit = async () => {
    try {
      const values = await deptForm.validateFields();
      setSubmitLoading(true);

      if (deptModal.record) {
        await api.put(`/departments/${deptModal.record._id}`, values);
        message.success('Department updated successfully');
      } else {
        await api.post('/departments', values);
        message.success('Department created successfully');
      }

      setDeptModal({ open: false, record: null });
      deptForm.resetFields();
      fetchData();
    } catch (err) {
      console.error(err);
      if (err.response?.data?.message || err.response?.data?.error) {
        message.error(err.response.data.message || err.response.data.error);
      } else if (err.errorFields) {
        // Form validation error
      } else {
        message.error('Error saving department');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteDept = async (id) => {
    try {
      await api.delete(`/departments/${id}`);
      message.success('Department deleted successfully');
      fetchData();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || err.response?.data?.error || 'Failed to delete department');
    }
  };

  // Filtering
  const filteredUsers = users.filter(
    u =>
      (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.departmentName || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredDepartments = departments.filter(
    d =>
      (d.name || '').toLowerCase().includes(deptSearch.toLowerCase()) ||
      (d.slug || '').toLowerCase().includes(deptSearch.toLowerCase()) ||
      (d.status || '').toLowerCase().includes(deptSearch.toLowerCase())
  );

  // Columns definition
  const userColumns = [
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>NAME</strong>,
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space size={10}>
          <Avatar
            style={{
              backgroundColor: 'var(--accent-primary)',
              fontWeight: 700,
              fontSize: 13
            }}
            size={32}
          >
            {text ? text.charAt(0).toUpperCase() : 'U'}
          </Avatar>
          <strong style={{ color: 'var(--text-primary)' }}>{text}</strong>
        </Space>
      )
    },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>DEPARTMENT</strong>,
      key: 'department',
      render: (_, record) => {
        const deptName =
          record.departmentName ||
          departments.find(d => d._id === record.departmentId)?.name;
        return deptName ? (
          <Tag
            style={{
              borderRadius: 8,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--accent-primary)',
              fontWeight: 600,
              padding: '2px 10px'
            }}
          >
            {deptName}
          </Tag>
        ) : (
          <Text type="secondary">-</Text>
        );
      }
    },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>EMAIL</strong>,
      dataIndex: 'email',
      key: 'email',
      render: text => <Text type="secondary">{text}</Text>
    },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>STATUS</strong>,
      key: 'status',
      render: (_, record) => {
        const isActive = record.isActive !== undefined ? record.isActive : (record.status === 'active');
        return (
          <Tag
            color={isActive ? 'success' : 'error'}
            style={{ borderRadius: 6, fontWeight: 700, padding: '2px 8px' }}
          >
            {isActive ? 'ACTIVE' : 'INACTIVE'}
          </Tag>
        );
      }
    },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>ACTIONS</strong>,
      key: 'actions',
      align: 'right',
      render: (_, record) => {
        if (record._id === activeUser?._id || record.role === 'agency_client') {
          return <Text type="secondary">-</Text>;
        }

        return (
          <Space size="small">
            <Tooltip title="Login as User">
              <Button
                type="text"
                icon={<LogIn size={15} />}
                onClick={() => handleLoginAs(record._id)}
                style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
              />
            </Tooltip>
            <Tooltip title="Edit">
              <Button
                type="text"
                icon={<Edit2 size={15} />}
                onClick={() => {
                  setUserModal({ open: true, record });
                  setUserCountryCode(record.countryCode || '91');
                  setUserCountryIso('');
                  userForm.setFieldsValue({
                    name: record.name,
                    email: record.email,
                    phone: record.phone,
                    departmentId: record.departmentId?._id || record.departmentId || undefined,
                    status: (record.isActive !== false && record.status !== 'inactive') ? 'active' : 'inactive',
                    features: record.features || [],
                    integrations: record.integrations || []
                  });
                }}
                style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}
              />
            </Tooltip>
            <Popconfirm
              title="Delete the user"
              description="Are you sure you want to delete this user?"
              onConfirm={() => handleDeleteUser(record._id)}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Delete">
                <Button type="text" danger icon={<Trash2 size={15} />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      }
    }
  ];

  const deptColumns = [
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>DEPARTMENT</strong>,
      dataIndex: 'name',
      key: 'name',
      render: text => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong>
    },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>SLUG</strong>,
      dataIndex: 'slug',
      key: 'slug',
      render: text => <span style={{ fontWeight: 500 }}>{text || '-'}</span>
    },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>STATUS</strong>,
      dataIndex: 'status',
      key: 'status',
      render: status => (
        <Tag
          color={status === 'active' ? 'success' : 'error'}
          style={{ borderRadius: 6, fontWeight: 700, padding: '2px 8px' }}
        >
          {String(status || 'active').toUpperCase()}
        </Tag>
      )
    },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>ACTIONS</strong>,
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<Edit2 size={15} />}
              onClick={() => {
                setDeptModal({ open: true, record });
                deptForm.setFieldsValue({
                  name: record.name,
                  slug: record.slug,
                  status: record.status || 'active'
                });
              }}
              style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete the department"
            description="Are you sure you want to delete this department?"
            onConfirm={() => handleDeleteDept(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<Trash2 size={15} />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 300, damping: 24 }
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <motion.div
        variants={itemVariants}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24
        }}
      >
        <div>
          <Title level={3} style={{ margin: '0 0 4px 0', fontWeight: 800 }}>
            Team & Department Management
          </Title>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>
            Manage your company departments and team members.
          </Text>
        </div>
        {activeTab === 'user' ? (
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setUserModal({ open: true, record: null });
              userForm.resetFields();
              userForm.setFieldsValue({ status: 'active', features: [], integrations: [] });
              setUserCountryCode('91');
              setUserCountryIso('IN');
            }}
            style={{
              background: 'var(--accent-primary)',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              height: 40,
              padding: '0 20px'
            }}
          >
            Add User
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setDeptModal({ open: true, record: null });
              deptForm.resetFields();
              deptForm.setFieldsValue({ status: 'active' });
            }}
            style={{
              background: 'var(--accent-primary)',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              height: 40,
              padding: '0 20px'
            }}
          >
            Add Department
          </Button>
        )}
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card
          className="glassmorphism"
          bodyStyle={{ padding: 0 }}
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            size="large"
            tabBarStyle={{
              padding: '0 24px',
              margin: 0,
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)'
            }}
            items={[
              {
                key: 'user',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                    <Users size={16} /> Team Members
                  </span>
                ),
                children: (
                  <div>
                    <div style={{ padding: '20px 24px 0 24px' }}>
                      <Input
                        placeholder="Search users by name, email, or department..."
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        prefix={<Search size={16} color="var(--text-tertiary)" />}
                        style={{
                          borderRadius: 8,
                          maxWidth: 400,
                          height: 40,
                          fontWeight: 500
                        }}
                      />
                    </div>
                    <Table
                      columns={userColumns}
                      dataSource={filteredUsers}
                      loading={loading}
                      rowKey="_id"
                      pagination={{
                        defaultPageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50'],
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
                        position: ['bottomCenter']
                      }}
                      style={{ padding: 20 }}
                      scroll={{ x: 'max-content' }}
                    />
                  </div>
                )
              },
              {
                key: 'department',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                    <Building2 size={16} /> Departments
                  </span>
                ),
                children: (
                  <div>
                    <div style={{ padding: '20px 24px 0 24px' }}>
                      <Input
                        placeholder="Search departments..."
                        value={deptSearch}
                        onChange={e => setDeptSearch(e.target.value)}
                        prefix={<Search size={16} color="var(--text-tertiary)" />}
                        style={{
                          borderRadius: 8,
                          maxWidth: 400,
                          height: 40,
                          fontWeight: 500
                        }}
                      />
                    </div>
                    <Table
                      columns={deptColumns}
                      dataSource={filteredDepartments}
                      loading={loading}
                      rowKey="_id"
                      pagination={{
                        defaultPageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50'],
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} departments`,
                        position: ['bottomCenter']
                      }}
                      style={{ padding: 20 }}
                      scroll={{ x: 'max-content' }}
                    />
                  </div>
                )
              }
            ]}
          />
        </Card>
      </motion.div>

      {/* User Modal */}
      <Modal
        title={
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>
            {userModal.record ? 'Edit User' : 'Create User'}
          </span>
        }
        open={userModal.open}
        onCancel={() => setUserModal({ open: false, record: null })}
        onOk={handleUserSubmit}
        confirmLoading={submitLoading}
        okText={userModal.record ? 'Update User' : 'Create User'}
        okButtonProps={{
          style: {
            background: 'var(--accent-primary)',
            borderRadius: 8,
            fontWeight: 700,
            border: 'none'
          }
        }}
        cancelButtonProps={{
          style: {
            borderRadius: 8,
            fontWeight: 600,
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)'
          }
        }}
        destroyOnClose
        width={620}
        centered
        styles={{
          body: {
            maxHeight: '68vh',
            overflowY: 'auto',
            paddingRight: '12px',
            paddingTop: '12px'
          }
        }}
        bodyStyle={{
          maxHeight: '68vh',
          overflowY: 'auto',
          paddingRight: '12px',
          paddingTop: '12px'
        }}
      >
        <Form form={userForm} layout="vertical">
          <Form.Item
            name="name"
            label={<strong style={{ color: 'var(--text-secondary)' }}>Full Name</strong>}
            rules={[{ required: true, message: 'Please enter full name' }]}
          >
            <Input placeholder="e.g. Jane Doe" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            name="email"
            label={<strong style={{ color: 'var(--text-secondary)' }}>Email Address</strong>}
            rules={[
              { required: true, message: 'Please enter an email' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (/^[^a-zA-Z0-9]/.test(value)) {
                    return Promise.reject(new Error('Email address cannot start with a special character'));
                  }
                  if (!/^[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
                    return Promise.reject(new Error('Please enter a valid email address'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input
              type="email"
              placeholder="jane@company.com"
              disabled={Boolean(userModal.record)}
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <Form.Item
            name="phone"
            label={<strong style={{ color: 'var(--text-secondary)' }}>Phone Number</strong>}
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

          <Form.Item
            name="password"
            label={
              <strong style={{ color: 'var(--text-secondary)' }}>
                {userModal.record ? 'Password (Leave blank to keep current)' : 'Password'}
              </strong>
            }
            rules={userModal.record ? [] : [{ required: true, message: 'Please set a password' }]}
          >
            <Input.Password placeholder="Enter password" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            name="departmentId"
            label={<strong style={{ color: 'var(--text-secondary)' }}>Department</strong>}
            rules={[{ required: true, message: 'Please select a department' }]}
          >
            <Select size="large" placeholder="Select Department" style={{ borderRadius: 8 }}>
              {departments.map(d => (
                <Option key={d._id} value={d._id}>
                  {d.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label={<strong style={{ color: 'var(--text-secondary)' }}>Status</strong>}
            rules={[{ required: true }]}
          >
            <Select size="large" style={{ borderRadius: 8 }}>
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
            </Select>
          </Form.Item>

          {availableFeatures.length > 0 && (
            <>
              <Divider style={{ margin: '16px 0 12px 0' }} />
              <Form.Item
                name="features"
                label={
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <Layers size={16} color="var(--accent-primary)" /> Configure Permissions (Modules)
                  </span>
                }
              >
                <Checkbox.Group
                  options={availableFeatures.map(f => ({ label: f.label, value: f.id }))}
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}
                />
              </Form.Item>
            </>
          )}

          {availableIntegrations.length > 0 && (
            <>
              <Divider style={{ margin: '16px 0 12px 0' }} />
              <Form.Item
                name="integrations"
                label={
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <Sliders size={16} color="var(--accent-secondary)" /> Configure Integrations
                  </span>
                }
              >
                <Checkbox.Group
                  options={availableIntegrations.map(i => ({ label: i.label, value: i.id }))}
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Department Modal */}
      <Modal
        title={
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>
            {deptModal.record ? 'Edit Department' : 'Create Department'}
          </span>
        }
        open={deptModal.open}
        onCancel={() => setDeptModal({ open: false, record: null })}
        onOk={handleDeptSubmit}
        confirmLoading={submitLoading}
        okText={deptModal.record ? 'Update Department' : 'Create Department'}
        okButtonProps={{
          style: {
            background: 'var(--accent-primary)',
            borderRadius: 8,
            fontWeight: 700,
            border: 'none'
          }
        }}
        cancelButtonProps={{
          style: {
            borderRadius: 8,
            fontWeight: 600,
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)'
          }
        }}
        destroyOnClose
        centered
      >
        <Form form={deptForm} layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item
            name="name"
            label={<strong style={{ color: 'var(--text-secondary)' }}>Department Name</strong>}
            rules={[{ required: true, message: 'Please enter department name' }]}
          >
            <Input placeholder="e.g. Marketing, Sales, Operations" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            name="slug"
            label={<strong style={{ color: 'var(--text-secondary)' }}>Slug (optional)</strong>}
          >
            <Input placeholder="e.g. marketing" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            name="status"
            label={<strong style={{ color: 'var(--text-secondary)' }}>Status</strong>}
            rules={[{ required: true }]}
          >
            <Select size="large" style={{ borderRadius: 8 }}>
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </motion.div>
  );
};

export default BrandUsersTab;