import React, { useState, useEffect } from 'react';
import {
  Table, Button, Space, Tag, Input, Modal, Switch,
  Card, Tabs, Typography, Form, Select, Checkbox, Popconfirm, message
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  LoginOutlined, StopOutlined, CheckCircleOutlined, ApiOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import PhoneInput from '../../../components/common/PhoneInput';
import { isValidPhoneNumber } from 'libphonenumber-js';

const { Title, Text } = Typography;
const { Option } = Select;

const getRoleColor = (role) => {
  if (!role) return 'default';
  const colors = {
    super_admin: 'red',
    admin: 'purple',
    coordinator: 'blue',
    website_coordinator: 'geekblue',
    bde: 'orange',
    seo: 'green',
    designer: 'magenta',
    developer: 'volcano',
    client: 'default'
  };
  return colors[role] || 'default';
};

const UserManagementTab = () => {
  const { login, user } = useAuth();
  const [activeTab, setActiveTab] = useState('user');

  // States for data
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Phone state for modal
  const [userCountryCode, setUserCountryCode] = useState('91');
  const [userCountryIso, setUserCountryIso] = useState('IN');

  // Search states
  const [userSearch, setUserSearch] = useState('');

  // Modals state
  const [userModal, setUserModal] = useState({ open: false, record: null });
  const [userForm] = Form.useForm();


  const [deptModal, setDeptModal] = useState({ open: false, record: null });
  const [deptForm] = Form.useForm();

  const [roleModal, setRoleModal] = useState({ open: false, record: null });
  const [roleForm] = Form.useForm();

  const [viewUserModal, setViewUserModal] = useState({ open: false, record: null });

  const [permissionRoleId, setPermissionRoleId] = useState(null);
  const [draftPermissions, setDraftPermissions] = useState({});

  const getPermissionGroupsForRole = (currentRole, feats = []) => {
    const hasF = (f) => feats.includes(f);

    if (['supreme_super_admin', 'superadmin', 'commander_admin'].includes(currentRole)) {
      return {
        'General': [],
        'Workspace': [
          // 'Strategy', 
          'SEO / AEO / GEO', 'Content', 'AI Studio',
          'Social Media', 'Performance Ads', 'CRM & Leads',
          'Task Management', 'Websites', 'Task Analytics', 'Coordinator Tasks'
        ],
        'Intelligence': [
          'Google Analytics', 'ChatGPT', 'Canva'
          // 'Benchmarks', 
        ],
        'Agency Ops': [
          'Time Tracking',
          'Sales Pipeline',
          'Global Meetings', 'Global Calendar', 'Global Deliverables'
        ],
        'HRMS': ['Performance']
      };
    } else if (['agency_super_admin', 'agency_manager', 'agency'].includes(currentRole)) {
      const groups = {
        'General': [],
        'Clients': ['Accounts'],
        'Workspace': [],
        'Intelligence': [],
        'Agency Ops': []
      };

      // Workspace
      if (hasF('social')) groups.Workspace.push('Social Media');
      if (hasF('ads')) groups.Workspace.push('Performance Ads');
      if (hasF('crm')) groups.Workspace.push('CRM & Leads');

      // Default Workspace Modules
      groups.Workspace.push('Proposals', 'Invoices', 'Projects', 'Task Management', 'Task Analytics', 'Coordinator Tasks', 'SEO Panel');

      if (hasF('website')) groups.Workspace.push('Websites');
      if (hasF('marketplace')) groups.Workspace.push('Marketplace');

      // Intelligence
      if (hasF('analytics')) groups.Intelligence.push('Google Analytics');
      if (hasF('chatgpt')) groups.Intelligence.push('ChatGPT');
      if (hasF('canva')) groups.Intelligence.push('Canva');
      // if (hasF('benchmark')) groups.Intelligence.push('Benchmarks');
      if (currentRole === 'agency_super_admin') {
        groups.Intelligence.push('Performance');
      }

      // Agency Ops
      groups['Agency Ops'].push('Sales Pipeline', 'Meetings', 'Calendar', 'Deliverables');

      // Settings extras (can go in General or Agency Ops)
      groups.General.push('Master Item');

      groups['HRMS'] = ['Performance'];

      return groups;
    } else if (['brand_super_admin', 'brand_manager', 'brand_team_user'].includes(currentRole)) {
      const groups = {
        'General': [],
        'Clients': [],
        'Workspace': [],
        'Intelligence': [],
        'Agency Ops': []
      };

      // Workspace conditional modules
      if (hasF('social')) groups.Workspace.push('Social Media');
      if (hasF('ads')) groups.Workspace.push('Performance Ads');
      if (hasF('crm')) groups.Workspace.push('CRM & Leads');
      if (hasF('website')) groups.Workspace.push('Websites');

      // Workspace default modules
      groups.Workspace.push('Task Management', 'Meetings', 'Calendar', 'Deliverables', 'Task Analytics', 'Coordinator Tasks', 'SEO Panel');

      // Intelligence conditional modules
      if (hasF('analytics')) groups.Intelligence.push('Google Analytics');
      if (hasF('chatgpt')) groups.Intelligence.push('ChatGPT');
      if (hasF('canva')) groups.Intelligence.push('Canva');
      // if (hasF('benchmark')) groups.Intelligence.push('Benchmarks');

      // Intelligence default modules
      // groups.Intelligence.push('Reports');

      // Agency Ops default modules
      groups['Agency Ops'].push('Time Tracking', 'Sales Pipeline');

      groups['HRMS'] = ['Performance'];

      return groups;
    }
    return {
      'General': ['Dashboard', 'Tasks']
    };
  };

  const permissionGroups = getPermissionGroupsForRole(user?.role, user?.features || []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, deptsRes, rolesRes] = await Promise.all([
        api.get('/users'),
        api.get('/departments'),
        api.get('/roles')
      ]);
      const allUsers = usersRes.data?.data || [];
      const excludedRoles = [
        'supreme_super_admin', 'superadmin', 'super_admin', 'commander_admin', 'admin',
        'agency_super_admin', 'agency_manager',
        'brand_super_admin', 'brand_manager',
        'manager', 'agency_client', 'client'
      ];
      setUsers(allUsers.filter(u => !excludedRoles.includes(u.role)));
      setDepartments(deptsRes.data?.data || []);
      setRoles(rolesRes.data?.data || []);
    } catch (err) {
      console.error(err);
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handlers
  const handleToggleUserStatus = async (record, isClient = false) => {
    try {
      await api.put(`/users/${record._id}`, { isActive: !record.isActive });
      message.success('Status updated');
      fetchData();
    } catch (err) {
      message.error('Failed to update status');
    }
  };

  const handleDeleteUser = async (id, isClient = false) => {
    try {
      await api.delete(`/users/${id}`);
      message.success('User deleted');
      fetchData();
    } catch (err) {
      message.error('Failed to delete user');
    }
  };

  const handleImpersonate = async (record) => {
    try {
      const currentToken = localStorage.getItem('token');
      const currentUserStr = localStorage.getItem('user');

      const res = await api.post(`/auth/impersonate/${record._id}`);
      if (res.data && res.data.success) {
        if (currentToken && currentUserStr) {
          localStorage.setItem('original_token', currentToken);
          localStorage.setItem('original_user', currentUserStr);
        }
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        message.success(`Logged in as ${res.data.user.name}`);
        login(res.data.user);
      }
    } catch (err) {
      console.error('Impersonation error:', err);
      message.error(err.response?.data?.error || 'Failed to login as user');
    }
  };

  // User Columns
  const userColumns = [
    { title: <strong style={{ color: 'var(--text-secondary)' }}>NAME</strong>, dataIndex: 'name', key: 'name', render: t => <strong style={{ color: 'var(--text-primary)' }}>{t}</strong> },
    { title: <strong style={{ color: 'var(--text-secondary)' }}>EMAIL</strong>, dataIndex: 'email', key: 'email', render: t => <span style={{ fontWeight: 500 }}>{t}</span> },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>ROLE</strong>, key: 'role', render: (_, record) => {
        let displayRole = record.roleName || record.role;
        if (record.customRoleId) {
          const customRole = roles.find(r => r._id === record.customRoleId);
          if (customRole) displayRole = customRole.roleName || customRole.roleKey || displayRole;
        }
        if (!displayRole) displayRole = 'Unknown';
        return (
          <Tag color={getRoleColor(record.role)} style={{ borderRadius: 6, fontWeight: 700, padding: '2px 8px' }}>
            {typeof displayRole === 'string' ? displayRole.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN'}
          </Tag>
        );
      }
    },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>DEPARTMENT</strong>, key: 'department', render: (_, record) => {
        return <span style={{ fontWeight: 500 }}>{record.departmentName || '-'}</span>;
      }
    },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>STATUS</strong>, dataIndex: 'isActive', key: 'isActive', render: isActive => (
        <Tag color={isActive ? 'success' : 'error'} style={{ borderRadius: 6, fontWeight: 700, padding: '2px 8px' }}>
          {isActive ? 'ACTIVE' : 'INACTIVE'}
        </Tag>
      )
    },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>ACTIONS</strong>, key: 'actions', align: 'right', fixed: 'right',
      render: (_, record) => (
        <Space size="middle">
          <Button type="text" icon={<EyeOutlined />} onClick={() => setViewUserModal({ open: true, record })} style={{ color: 'var(--accent-info)', fontWeight: 600 }}>View</Button>
          <Button type="text" icon={<LoginOutlined />} onClick={() => handleImpersonate(record)} style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Login as User</Button>
          <Button type="text" icon={<EditOutlined />} onClick={() => {
            setUserModal({ open: true, record });
            let formRole = record.role;
            if (record.customRoleId) {
              const customRole = roles.find(r => r._id === record.customRoleId);
              if (customRole) formRole = customRole.roleKey || customRole._id;
            }
            setUserCountryCode(record.countryCode || '91');
            // Reset ISO to let PhoneInput determine it based on country code
            setUserCountryIso('');
            userForm.setFieldsValue({
              ...record,
              role: formRole,
              status: record.isActive ? 'active' : 'inactive',
              viewAllClients: record.viewAllClients || false
            });
          }} style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>Edit</Button>
          <Popconfirm title="Delete this user?" onConfirm={() => handleDeleteUser(record._id)}>
            <Button type="text" danger icon={<DeleteOutlined />} style={{ fontWeight: 600 }}>Delete</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];


  // Department Columns
  const deptColumns = [
    { title: <strong style={{ color: 'var(--text-secondary)' }}>DEPARTMENT</strong>, dataIndex: 'name', key: 'name', render: t => <strong style={{ color: 'var(--text-primary)' }}>{t}</strong> },
    { title: <strong style={{ color: 'var(--text-secondary)' }}>SLUG</strong>, dataIndex: 'slug', key: 'slug', render: t => <span style={{ fontWeight: 500 }}>{t}</span> },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>STATUS</strong>, dataIndex: 'status', key: 'status', render: status => (
        <Tag color={status === 'active' ? 'success' : 'error'} style={{ borderRadius: 6, fontWeight: 700, padding: '2px 8px' }}>
          {String(status).toUpperCase()}
        </Tag>
      )
    },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>ACTIONS</strong>, key: 'actions', align: 'right', fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => {
            setDeptModal({ open: true, record });
            deptForm.setFieldsValue(record);
          }} style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Edit</Button>
          <Popconfirm title="Delete this department?" onConfirm={async () => {
            try {
              await api.delete(`/departments/${record._id}`);
              message.success('Department deleted');
              fetchData();
            } catch (err) {
              message.error('Failed to delete department');
            }
          }}>
            <Button type="text" danger icon={<DeleteOutlined />} style={{ fontWeight: 600 }}>Delete</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // Role Columns
  const roleColumns = [
    { title: <strong style={{ color: 'var(--text-secondary)' }}>ROLE NAME</strong>, dataIndex: 'roleName', key: 'roleName', render: t => <strong style={{ color: 'var(--text-primary)' }}>{t}</strong> },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>DEPARTMENT</strong>, key: 'department', render: (_, r) => (
        <span style={{ fontWeight: 500 }}>{departments.find(d => d._id === r.departmentId)?.name || <Tag color="blue" style={{ borderRadius: 6 }}>System</Tag>}</span>
      )
    },
    { title: <strong style={{ color: 'var(--text-secondary)' }}>ROLE KEY</strong>, dataIndex: 'roleKey', key: 'roleKey', render: t => <span style={{ fontWeight: 500 }}>{t}</span> },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>STATUS</strong>, dataIndex: 'status', key: 'status', render: status => (
        <Tag color={status === 'active' ? 'success' : 'error'} style={{ borderRadius: 6, fontWeight: 700, padding: '2px 8px' }}>
          {String(status).toUpperCase()}
        </Tag>
      )
    },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>ACCESS</strong>, key: 'access', render: (_, record) => (
        <Button type="text" icon={<SafetyCertificateOutlined />} onClick={() => {
          setPermissionRoleId(record._id);
          setDraftPermissions(record.permissions || {});
        }} style={{ color: 'var(--accent-info)', fontWeight: 600 }}>Configure Permissions</Button>
      )
    },
    {
      title: <strong style={{ color: 'var(--text-secondary)' }}>ACTIONS</strong>, key: 'actions', align: 'right', fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => {
            setRoleModal({ open: true, record });
            roleForm.setFieldsValue(record);
          }} style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Edit</Button>
          <Popconfirm title="Delete this role?" onConfirm={async () => {
            try {
              await api.delete(`/roles/${record._id}`);
              message.success('Role deleted');
              fetchData();
            } catch (err) {
              message.error('Failed to delete role');
            }
          }}>
            <Button type="text" danger icon={<DeleteOutlined />} style={{ fontWeight: 600 }}>Delete</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const handleSavePermissions = async () => {
    try {
      setSubmitLoading(true);
      await api.put(`/roles/${permissionRoleId}`, { permissions: draftPermissions });
      message.success('Permissions updated');
      setPermissionRoleId(null);
      fetchData();
    } catch (err) {
      console.error(err);
      message.error('Error saving permissions');
    } finally {
      setSubmitLoading(false);
    }
  };


  const handleDeptSubmit = async () => {
    try {
      const values = await deptForm.validateFields();
      setSubmitLoading(true);
      if (deptModal.record) {
        await api.put(`/departments/${deptModal.record._id}`, values);
        message.success('Department updated');
      } else {
        await api.post('/departments', values);
        message.success('Department created');
      }
      setDeptModal({ open: false, record: null });
      fetchData();
    } catch (err) {
      console.error(err);
      if (err.response) message.error(err.response.data.message || 'Error saving department');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleRoleSubmit = async () => {
    try {
      const values = await roleForm.validateFields();
      setSubmitLoading(true);
      if (roleModal.record) {
        await api.put(`/roles/${roleModal.record._id}`, values);
        message.success('Role updated');
      } else {
        await api.post('/roles', values);
        message.success('Role created');
      }
      setRoleModal({ open: false, record: null });
      fetchData();
    } catch (err) {
      console.error(err);
      if (err.response) message.error(err.response.data.message || 'Error saving role');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleUserSubmit = async () => {
    try {
      const values = await userForm.validateFields();
      setSubmitLoading(true);
      const payload = { ...values, isActive: values.status === 'active', countryCode: userCountryCode };
      if (userModal.record) {
        await api.put(`/users/${userModal.record._id}`, payload);
        message.success('User updated');
      } else {
        await api.post('/users', payload);
        message.success('User created successfully');
      }
      setUserModal({ open: false, record: null });
      fetchData();
    } catch (err) {
      console.error(err);
      if (err.response) message.error(err.response.data.message || 'Error saving user');
    } finally {
      setSubmitLoading(false);
    }
  };



  const filteredUsers = users.filter(u =>
    (u.name || '').toLowerCase().includes((userSearch || '').toLowerCase()) ||
    (u.email || '').toLowerCase().includes((userSearch || '').toLowerCase())
  );

  const activeRoleForMatrix = roles.find(r => r._id === permissionRoleId);
  const isManagerRole = activeRoleForMatrix && ['agency_manager', 'admin', 'brand_admin', 'brand_manager'].includes(activeRoleForMatrix.roleKey);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 900 }}>User Management</Title>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>Manage users, departments, and roles.</Text>
        </div>
        {activeTab === 'user' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setUserModal({ open: true, record: null });
            userForm.resetFields();
            userForm.setFieldsValue({ status: 'active' });
            setUserCountryCode('91');
            setUserCountryIso('IN');
          }} style={{ background: 'var(--accent-primary)', border: 'none', borderRadius: 8, fontWeight: 700, height: 40, padding: '0 24px' }}>
            Add User
          </Button>
        )}
      </div>

      <Card
        className="glassmorphism"
        bodyStyle={{ padding: 0 }}
        style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          tabBarStyle={{ padding: '0 24px', margin: 0, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}
          items={[
            {
              key: 'user',
              label: <strong style={{ fontWeight: 600 }}>User</strong>,
              children: (
                <div>
                  <div style={{ padding: '24px 24px 0 24px' }}>
                    <Input
                      placeholder="Search users by name or email..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      prefix={<Search size={16} color="var(--text-tertiary)" />}
                      style={{ borderRadius: 10, maxWidth: 400, height: 44, fontWeight: 500 }}
                    />
                  </div>
                  <Table
                    columns={userColumns}
                    dataSource={filteredUsers}
                    rowKey="_id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50'],
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                      position: ['bottomCenter']
                    }}
                    style={{ padding: 24 }}
                    rowClassName={() => 'hover-bg'}
                    scroll={{ x: 'max-content' }}
                    loading={loading}
                  />
                </div>
              )
            },
            {
              key: 'department',
              label: <strong style={{ fontWeight: 600 }}>Department</strong>,
              children: (
                <div>
                  <div style={{ padding: '24px 24px 0 24px', display: 'flex', justifyContent: 'space-between' }}>
                    <Input
                      placeholder="Search departments..."
                      prefix={<Search size={16} color="var(--text-tertiary)" />}
                      style={{ borderRadius: 10, maxWidth: 400, height: 44, fontWeight: 500 }}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setDeptModal({ open: true, record: null }); deptForm.resetFields(); deptForm.setFieldsValue({ status: 'active' }); }} style={{ background: 'var(--accent-primary)', border: 'none', borderRadius: 8, fontWeight: 700, height: 40, padding: '0 24px' }}>
                      Add Department
                    </Button>
                  </div>
                  <Table
                    columns={deptColumns}
                    dataSource={departments}
                    rowKey="_id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50'],
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                      position: ['bottomCenter']
                    }}
                    style={{ padding: 24 }}
                    rowClassName={() => 'hover-bg'}
                    scroll={{ x: 'max-content' }}
                    loading={loading}
                  />
                </div>
              )
            },
            {
              key: 'role',
              label: <strong style={{ fontWeight: 600 }}>Role</strong>,
              children: (
                <div>
                  <div style={{ padding: '24px 24px 0 24px', display: 'flex', justifyContent: 'space-between' }}>
                    <Input
                      placeholder="Search roles..."
                      prefix={<Search size={16} color="var(--text-tertiary)" />}
                      style={{ borderRadius: 10, maxWidth: 400, height: 44, fontWeight: 500 }}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setRoleModal({ open: true, record: null }); roleForm.resetFields(); roleForm.setFieldsValue({ status: 'active' }); }} style={{ background: 'var(--accent-primary)', border: 'none', borderRadius: 8, fontWeight: 700, height: 40, padding: '0 24px' }}>
                      Add Role
                    </Button>
                  </div>
                  <Table
                    columns={roleColumns}
                    dataSource={roles}
                    rowKey="_id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50'],
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                      position: ['bottomCenter']
                    }}
                    style={{ padding: 24 }}
                    rowClassName={() => 'hover-bg'}
                    scroll={{ x: 'max-content' }}
                    loading={loading}
                  />
                </div>
              )
            }
          ]}
        />
      </Card>

      {/* Modals */}
      <Modal
        title={<div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>{userModal.record ? 'Edit User' : 'Create User'}</div>}
        open={userModal.open}
        onCancel={() => setUserModal({ open: false, record: null })}
        onOk={handleUserSubmit}
        confirmLoading={submitLoading}
        okButtonProps={{ style: { background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 700, border: 'none' } }}
        cancelButtonProps={{ style: { borderRadius: 8, fontWeight: 600, background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' } }}
        className="glassmorphism-modal"
      >
        <Form form={userForm} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item name="name" label={<strong style={{ color: 'var(--text-secondary)' }}>Full Name</strong>} rules={[{ required: true }]}>
            <Input size="large" style={{ borderRadius: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="email" label={<strong style={{ color: 'var(--text-secondary)' }}>Email Address</strong>} rules={[{ required: true, type: 'email' }]}>
            <Input size="large" style={{ borderRadius: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
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
              style={{ borderRadius: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              countryCodeValue={userCountryCode}
              onCountryCodeChange={setUserCountryCode}
              isoCountryValue={userCountryIso}
              onCountryIsoChange={setUserCountryIso}
            />
          </Form.Item>
          {!userModal.record && (
            <Form.Item name="password" label={<strong style={{ color: 'var(--text-secondary)' }}>Password</strong>} rules={[{ required: true, message: 'Please set a password' }]}>
              <Input.Password size="large" style={{ borderRadius: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
            </Form.Item>
          )}
          <Form.Item name="viewAllClients" valuePropName="checked">
            <Checkbox>
              <strong style={{ color: 'var(--text-secondary)' }}>Can View All Clients</strong>
            </Checkbox>
          </Form.Item>
          <Form.Item name="departmentId" label={<strong style={{ color: 'var(--text-secondary)' }}>Department</strong>} rules={[{ required: true }]}>
            <Select size="large" placeholder="Select Department">
              {departments.map(d => <Option key={d._id} value={d._id}>{d.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="role" label={<strong style={{ color: 'var(--text-secondary)' }}>Role</strong>} rules={[{ required: true }]}>
            <Select size="large">
              {roles.map(r => <Option key={r._id} value={r.roleKey || r._id}>{r.roleName}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="status" label={<strong style={{ color: 'var(--text-secondary)' }}>Status</strong>} rules={[{ required: true }]}>
            <Select size="large">
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>{deptModal.record ? 'Edit Department' : 'Create Department'}</div>}
        open={deptModal.open}
        onCancel={() => setDeptModal({ open: false, record: null })}
        onOk={handleDeptSubmit}
        confirmLoading={submitLoading}
        okButtonProps={{ style: { background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 700, border: 'none' } }}
        cancelButtonProps={{ style: { borderRadius: 8, fontWeight: 600, background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' } }}
        className="glassmorphism-modal"
      >
        <Form form={deptForm} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item name="name" label={<strong style={{ color: 'var(--text-secondary)' }}>Name</strong>} rules={[{ required: true }]}>
            <Input size="large" style={{ borderRadius: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="slug" label={<strong style={{ color: 'var(--text-secondary)' }}>Slug (optional)</strong>}>
            <Input size="large" style={{ borderRadius: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="status" label={<strong style={{ color: 'var(--text-secondary)' }}>Status</strong>} rules={[{ required: true }]}>
            <Select size="large">
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>{roleModal.record ? 'Edit Role' : 'Create Role'}</div>}
        open={roleModal.open}
        onCancel={() => setRoleModal({ open: false, record: null })}
        onOk={handleRoleSubmit}
        confirmLoading={submitLoading}
        okButtonProps={{ style: { background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 700, border: 'none' } }}
        cancelButtonProps={{ style: { borderRadius: 8, fontWeight: 600, background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' } }}
        className="glassmorphism-modal"
      >
        <Form form={roleForm} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item name="departmentId" label={<strong style={{ color: 'var(--text-secondary)' }}>Department</strong>} rules={[{ required: true }]}>
            <Select size="large">
              {departments.map(d => <Option key={d._id} value={d._id}>{d.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="roleName" label={<strong style={{ color: 'var(--text-secondary)' }}>Role Name</strong>} rules={[{ required: true }]}>
            <Input size="large" style={{ borderRadius: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="roleKey" label={<strong style={{ color: 'var(--text-secondary)' }}>Role Key (optional)</strong>}>
            <Input size="large" style={{ borderRadius: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          </Form.Item>
          <Form.Item name="status" label={<strong style={{ color: 'var(--text-secondary)' }}>Status</strong>} rules={[{ required: true }]}>
            <Select size="large">
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>



      <Modal
        title={<div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>Module Permission Matrix <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>— {roles.find(r => r._id === permissionRoleId)?.roleName}</span></div>}
        width={900}
        open={!!permissionRoleId}
        onCancel={() => setPermissionRoleId(null)}
        footer={[
          <Button key="cancel" onClick={() => setPermissionRoleId(null)} style={{ borderRadius: 8, fontWeight: 600, background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} size="large">Cancel</Button>,
          <Button key="ok" loading={submitLoading} onClick={handleSavePermissions} style={{ background: '#d9363e', borderColor: '#d9363e', borderRadius: 8, fontWeight: 700, padding: '0 32px' }} size="large" type="primary">OK</Button>
        ]}
        className="glassmorphism-modal"
        styles={{ body: { maxHeight: "70vh", overflowY: "auto", overflowX: "hidden" } }}
      >
        <Tabs
          items={Object.entries(permissionGroups).map(([group, modules]) => {
            let activeModules = [...modules];

            if (group === 'HRMS' && activeModules.includes('Performance')) {
              const perf = draftPermissions['HRMS-Performance'] || {};
              const isManagerPerf = isManagerRole;
              const hasAllPerf = (perf.Read || true) && (perf.View || true) && (perf.Create || isManagerPerf) && (perf.Edit || isManagerPerf) && (perf.Delete || isManagerPerf);
              if (hasAllPerf && !activeModules.includes('Ekta HR Integration')) {
                activeModules.push('Ekta HR Integration');
              }
            }
            
            if (activeModules.length === 0) return null;

            return {
              key: group,
              label: <strong style={{ fontWeight: 600 }}>{group}</strong>,
              children: (
                <Table
                  rowKey="module"
                  dataSource={activeModules.map(m => ({ module: m }))}
                  pagination={false}
                  scroll={{ y: 400 }}
                  rowClassName={() => 'hover-bg'}
                  columns={[
                    { title: <strong style={{ color: 'var(--text-secondary)' }}>Module</strong>, dataIndex: 'module', key: 'module', render: t => <span style={{ fontWeight: 500 }}>{t}</span> },
                    ...['Read', 'View', 'All', 'Create', 'Edit', 'Delete'].map(field => ({
                      title: <strong style={{ color: 'var(--text-secondary)' }}>{field}</strong>,
                      key: field,
                      align: 'center',
                      render: (_, record) => {
                        if (field === 'All' && record.module !== 'Accounts') return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
                        if (['Google Analytics', 'ChatGPT', 'Canva', 'Performance', 'Calendar'].includes(record.module) && field !== 'Read') return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
                        if (record.module === 'Performance Ads' && ['Create', 'Edit', 'Delete'].includes(field)) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
                        if (record.module === 'Task Analytics' && ['Create', 'Edit', 'Delete'].includes(field)) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
                        if (record.module === 'Deliverables' && !['Read', 'Create', 'Edit'].includes(field)) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
                        return (
                          <Checkbox
                            checked={
                              (isManagerRole && ['Create', 'Edit', 'Delete'].includes(field)) ? true :
                                (!!draftPermissions[`${group}-${record.module}`]?.[field] ||
                                  (record.module === 'Dashboard' && field === 'Read') ||
                                  (['Task Management', 'Performance'].includes(record.module) && ['Read', 'View'].includes(field)))
                            }
                            disabled={
                              (isManagerRole && ['Create', 'Edit', 'Delete'].includes(field)) ? true :
                                (record.module === 'Dashboard' && field === 'Read') ||
                                (['Task Management', 'Performance'].includes(record.module) && ['Read', 'View'].includes(field))
                            }
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setDraftPermissions(prev => {
                                const updated = {
                                  ...prev,
                                  [`${group}-${record.module}`]: {
                                    ...(prev[`${group}-${record.module}`] || {}),
                                    [field]: isChecked
                                  }
                                };



                                if (group === 'HRMS' && record.module === 'Performance') {
                                  const perf = updated['HRMS-Performance'];
                                  const isManagerPerf = isManagerRole;
                                  const isAllChecked = (perf.Read || true) && (perf.View || true) && (perf.Create || isManagerPerf) && (perf.Edit || isManagerPerf) && (perf.Delete || isManagerPerf);
                                  updated['HRMS-Ekta HR Integration'] = {
                                    Read: isAllChecked, View: isAllChecked, Create: isAllChecked, Edit: isAllChecked, Delete: isAllChecked
                                  };
                                }

                                return updated;
                              });
                            }}
                          />
                        );
                      }
                    }))
                  ]}
                />
              )
            };
          }).filter(Boolean)}
          tabBarStyle={{ marginBottom: 16 }}
        />
      </Modal>

      <Modal
        title={<div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>User Details</div>}
        open={viewUserModal.open}
        onCancel={() => setViewUserModal({ open: false, record: null })}
        footer={[
          <Button key="close" onClick={() => setViewUserModal({ open: false, record: null })} style={{ borderRadius: 8, fontWeight: 600, background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} size="large">Close</Button>
        ]}
        className="glassmorphism-modal"
      >
        {viewUserModal.record && (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Full Name</Text>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{viewUserModal.record.name}</div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Email Address</Text>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{viewUserModal.record.email}</div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Role</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={getRoleColor(viewUserModal.record.role)} style={{ borderRadius: 6, fontWeight: 700, padding: '2px 8px' }}>
                  {(viewUserModal.record.roleName || viewUserModal.record.role).replace(/_/g, ' ').toUpperCase()}
                </Tag>
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Department</Text>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{viewUserModal.record.departmentName || '-'}</div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Status</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={viewUserModal.record.isActive ? 'success' : 'error'} style={{ borderRadius: 6, fontWeight: 700, padding: '2px 8px' }}>
                  {viewUserModal.record.isActive ? 'ACTIVE' : 'INACTIVE'}
                </Tag>
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Client Visibility</Text>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                {viewUserModal.record.viewAllClients ? 'Can View All Clients' : 'Assigned Clients Only'}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
};

export default UserManagementTab;