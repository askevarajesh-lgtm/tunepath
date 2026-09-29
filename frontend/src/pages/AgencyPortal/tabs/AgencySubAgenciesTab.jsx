import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Tag, Button, Input, Modal, Form, Dropdown, message, Avatar, Select } from 'antd';
import { motion } from 'framer-motion';
import { Plus, MoreVertical, Edit2, Trash2, Mail, Shield, User as UserIcon, Briefcase, Users } from 'lucide-react';
import api from '../../../services/api';
import PhoneInput from '../../../components/common/PhoneInput';
import { isValidPhoneNumber } from 'libphonenumber-js';

const { Title, Text } = Typography;
const { Option } = Select;

const AgencySubAgenciesTab = () => {
  const [subAgencies, setSubAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form] = Form.useForm();

  // Country code state for Sub Agency Create
  const [saCountryCode, setSaCountryCode] = useState('91');
  const [saCountryIso, setSaCountryIso] = useState('IN');

  // Sub Agency Users Management State
  const [selectedSubAgency, setSelectedSubAgency] = useState(null);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  
  // User Create / Edit State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [userForm] = Form.useForm();
  const [userEditForm] = Form.useForm();
  const [editingUser, setEditingUser] = useState(null);
  const [userCountryCode, setUserCountryCode] = useState('91');
  const [userCountryIso, setUserCountryIso] = useState('IN');
  const [editUserCountryCode, setEditUserCountryCode] = useState('91');
  const [editUserCountryIso, setEditUserCountryIso] = useState('IN');

  useEffect(() => {
    fetchSubAgencies();
  }, []);

  const fetchSubAgencies = async () => {
    try {
      setLoading(true);
      const res = await api.get('/sub-agencies');
      if (res.data && res.data.success) {
        setSubAgencies(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
      message.error('Failed to load sub agencies');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubAgencyUsers = async (subAgencyId) => {
    try {
      setUsersLoading(true);
      const res = await api.get(`/sub-agencies/${subAgencyId}/users`);
      if (res.data && res.data.success) {
        setUsers(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
      message.error('Failed to load sub agency users');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCreateSubAgency = async (values) => {
    try {
      setSubmitLoading(true);
      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        countryCode: saCountryCode,
        adminName: values.adminName,
        password: values.password
      };

      const res = await api.post('/sub-agencies', payload);
      
      if (res.data.success) {
        message.success('Sub Agency created successfully');
        setIsModalOpen(false);
        form.resetFields();
        setSaCountryCode('91');
        setSaCountryIso('IN');
        fetchSubAgencies();
      }
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || err.response?.data?.error || 'Failed to create sub agency');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleMenuClick = (e, record) => {
    if (e.key === 'manage_users') {
      setSelectedSubAgency(record);
      setIsUsersModalOpen(true);
      fetchSubAgencyUsers(record._id);
    }
  };

  const getActionMenu = () => [
    { key: 'manage_users', icon: <Users size={16} />, label: 'Manage Users' }
  ];

  const columns = [
    {
      title: 'SUB AGENCY',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size="large" style={{ backgroundColor: 'var(--accent-primary)' }}>{text ? text.charAt(0).toUpperCase() : 'S'}</Avatar>
          <div>
            <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{text}</strong>
            <Text type="secondary" style={{ fontSize: 13 }}><Mail size={12} style={{ marginRight: 4, verticalAlign: '-1px' }}/> {record.email}</Text>
          </div>
        </div>
      )
    },
    {
      title: 'STATUS',
      dataIndex: 'isActive',
      key: 'isActive',
      render: text => {
        let display = text ? 'Active' : 'Inactive';
        let color = text ? 'success' : 'default';
        return <Tag color={color} style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>{display}</Tag>;
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
        <Dropdown menu={{ items: getActionMenu(), onClick: (e) => handleMenuClick(e, record) }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreVertical size={16} />} />
        </Dropdown>
      )
    }
  ];

  // User Management Actions
  const handleCreateUser = async (values) => {
    try {
      setSubmitLoading(true);
      const payload = {
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone,
        countryCode: userCountryCode,
        role: values.role
      };

      const res = await api.post(`/sub-agencies/${selectedSubAgency._id}/users`, payload);
      
      if (res.data.success) {
        message.success('User created successfully');
        setIsUserModalOpen(false);
        userForm.resetFields();
        setUserCountryCode('91');
        setUserCountryIso('IN');
        fetchSubAgencyUsers(selectedSubAgency._id);
      }
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || err.response?.data?.error || 'Failed to create user');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditUser = async (values) => {
    try {
      setSubmitLoading(true);
      const payload = {
        name: values.name,
        phone: values.phone,
        countryCode: editUserCountryCode,
        role: values.role
      };
      if (values.password) {
        payload.password = values.password;
      }

      const res = await api.put(`/sub-agencies/${selectedSubAgency._id}/users/${editingUser._id}`, payload);
      
      if (res.data.success) {
        message.success('User updated successfully');
        setIsUserEditModalOpen(false);
        userEditForm.resetFields();
        fetchSubAgencyUsers(selectedSubAgency._id);
      }
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || err.response?.data?.error || 'Failed to update user');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleUserMenuClick = (e, record) => {
    if (e.key === 'edit') {
      setEditingUser(record);
      setEditUserCountryCode(record.countryCode || '91');
      setEditUserCountryIso(record.countryIso || '');
      userEditForm.setFieldsValue({
        name: record.name,
        email: record.email,
        phone: record.phone,
        role: record.role
      });
      setIsUserEditModalOpen(true);
    }
  };

  const getUserActionMenu = () => [
    { key: 'edit', icon: <Edit2 size={16} />, label: 'Edit User' }
  ];

  const userColumns = [
    {
      title: 'USER',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size="large" style={{ backgroundColor: 'var(--accent-primary)' }}>{text ? text.charAt(0).toUpperCase() : 'U'}</Avatar>
          <div>
            <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{text}</strong>
            <Text type="secondary" style={{ fontSize: 13 }}><Mail size={12} style={{ marginRight: 4, verticalAlign: '-1px' }}/> {record.email}</Text>
          </div>
        </div>
      )
    },
    {
      title: 'ROLE',
      dataIndex: 'role',
      key: 'role',
      render: text => {
        let display = 'User';
        let color = 'default';
        if (text === 'sub_agency_super_admin') { display = 'Super Admin'; color = 'processing'; }
        if (text === 'sub_agency_user') { display = 'Sub Agency User'; color = 'default'; }
        return <Tag color={color} style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>{display}</Tag>;
      }
    },
    {
      title: '',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Dropdown menu={{ items: getUserActionMenu(), onClick: (e) => handleUserMenuClick(e, record) }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreVertical size={16} />} />
        </Dropdown>
      )
    }
  ];


  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>Sub Agencies</Title>
          <Text type="secondary">Create and manage your Sub Agencies and their users.</Text>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button type="primary" onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />} style={{ borderRadius: 8, background: 'var(--accent-primary)', fontWeight: 600 }}>
            Create Sub Agency
          </Button>
        </div>
      </div>

      <Card bordered={false} className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)' }}>
        <Table 
          columns={columns} 
          dataSource={subAgencies} 
          rowKey="_id" 
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }} 
          loading={loading}
          scroll={{ x: 800 }}
        />
      </Card>

      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 18 }}><Briefcase size={18} style={{ marginRight: 8, verticalAlign: '-3px' }}/> Create New Sub Agency</span>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        className="glass-modal"
        centered
        width={450}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSubAgency} style={{ marginTop: 24 }}>
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Sub Agency Name</Text>} name="name" rules={[{ required: true, message: 'Sub Agency Name is required' }]}>
            <Input placeholder="Enter Sub Agency name" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>
          
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Email Address</Text>} name="email" rules={[
            { required: true, message: 'Email address is required' },
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
          ]}>
            <Input placeholder="agency@example.com" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>
          <Form.Item 
            label={<Text style={{ fontWeight: 600 }}>Phone Number</Text>} 
            name="phone"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (isValidPhoneNumber(value, saCountryIso)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Please enter a valid phone number for the selected country'));
                }
              }
            ]}
          >
            <PhoneInput 
              style={{ borderRadius: 8 }} 
              size="large"
              countryCodeValue={saCountryCode}
              onCountryCodeChange={setSaCountryCode}
              isoCountryValue={saCountryIso}
              onCountryIsoChange={setSaCountryIso}
            />
          </Form.Item>

          <Form.Item label={<Text style={{ fontWeight: 600 }}>Admin Name</Text>} name="adminName" rules={[{ required: true, message: 'Admin Name is required' }]} extra="This creates the initial Super Admin user for the Sub Agency">
            <Input placeholder="Enter admin user's name" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>

          <Form.Item label={<Text style={{ fontWeight: 600 }}>Admin Password</Text>} name="password" rules={[{ required: true, message: 'Password is required' }]}>
            <Input.Password placeholder="••••••••" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32 }}>
            <Button onClick={() => setIsModalOpen(false)} style={{ borderRadius: 8, fontWeight: 600 }} size="large">Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitLoading} style={{ background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 600 }} size="large">Create Sub Agency</Button>
          </div>
        </Form>
      </Modal>

      {/* Sub Agency Users Management Modal */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 18 }}><Users size={18} style={{ marginRight: 8, verticalAlign: '-3px' }}/> Manage Users - {selectedSubAgency?.name}</span>}
        open={isUsersModalOpen}
        onCancel={() => setIsUsersModalOpen(false)}
        footer={null}
        className="glass-modal"
        centered
        width={800}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        </div>
        <Table 
          columns={userColumns} 
          dataSource={users} 
          rowKey="_id" 
          pagination={false} 
          loading={usersLoading}
          scroll={{ y: 400 }}
        />
      </Modal>

      {/* Create User Modal */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 18 }}><UserIcon size={18} style={{ marginRight: 8, verticalAlign: '-3px' }}/> Create User</span>}
        open={isUserModalOpen}
        onCancel={() => setIsUserModalOpen(false)}
        footer={null}
        className="glass-modal"
        centered
        width={450}
        zIndex={1001}
      >
        <Form form={userForm} layout="vertical" onFinish={handleCreateUser} style={{ marginTop: 24 }}>
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Full Name</Text>} name="name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Enter user's name" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>
          
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Email Address</Text>} name="email" rules={[
            { required: true, message: 'Email address is required' },
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
          ]}>
            <Input placeholder="user@agency.com" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>

          <Form.Item label={<Text style={{ fontWeight: 600 }}>Role</Text>} name="role" rules={[{ required: true, message: 'Role is required' }]} initialValue="sub_agency_user">
            <Select size="large" style={{ borderRadius: 8 }}>
              <Option value="sub_agency_super_admin">Super Admin</Option>
              <Option value="sub_agency_user">User</Option>
            </Select>
          </Form.Item>

          <Form.Item 
            label={<Text style={{ fontWeight: 600 }}>Phone Number</Text>} 
            name="phone"
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
              style={{ borderRadius: 8 }} 
              size="large"
              countryCodeValue={userCountryCode}
              onCountryCodeChange={setUserCountryCode}
              isoCountryValue={userCountryIso}
              onCountryIsoChange={setUserCountryIso}
            />
          </Form.Item>

          <Form.Item label={<Text style={{ fontWeight: 600 }}>Password</Text>} name="password" rules={[{ required: true, message: 'Password is required' }]}>
            <Input.Password placeholder="••••••••" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32 }}>
            <Button onClick={() => setIsUserModalOpen(false)} style={{ borderRadius: 8, fontWeight: 600 }} size="large">Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitLoading} style={{ background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 600 }} size="large">Create User</Button>
          </div>
        </Form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 18 }}><Edit2 size={18} style={{ marginRight: 8, verticalAlign: '-3px' }}/> Edit User</span>}
        open={isUserEditModalOpen}
        onCancel={() => setIsUserEditModalOpen(false)}
        footer={null}
        className="glass-modal"
        centered
        width={450}
        zIndex={1001}
      >
        <Form form={userEditForm} layout="vertical" onFinish={handleEditUser} style={{ marginTop: 24 }}>
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Full Name</Text>} name="name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Enter user's name" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>
          
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Email Address</Text>} name="email">
            <Input placeholder="user@agency.com" style={{ borderRadius: 8 }} size="large" disabled />
          </Form.Item>

          <Form.Item label={<Text style={{ fontWeight: 600 }}>Role</Text>} name="role" rules={[{ required: true, message: 'Role is required' }]}>
            <Select size="large" style={{ borderRadius: 8 }}>
              <Option value="sub_agency_super_admin">Super Admin</Option>
              <Option value="sub_agency_user">User</Option>
            </Select>
          </Form.Item>

          <Form.Item 
            label={<Text style={{ fontWeight: 600 }}>Phone Number</Text>} 
            name="phone"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (isValidPhoneNumber(value, editUserCountryIso)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Please enter a valid phone number for the selected country'));
                }
              }
            ]}
          >
            <PhoneInput 
              style={{ borderRadius: 8 }} 
              size="large"
              countryCodeValue={editUserCountryCode}
              onCountryCodeChange={setEditUserCountryCode}
              isoCountryValue={editUserCountryIso}
              onCountryIsoChange={setEditUserCountryIso}
            />
          </Form.Item>

          <Form.Item label={<Text style={{ fontWeight: 600 }}>New Password</Text>} name="password" extra="Leave blank to keep current password">
            <Input.Password placeholder="••••••••" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32 }}>
            <Button onClick={() => setIsUserEditModalOpen(false)} style={{ borderRadius: 8, fontWeight: 600 }} size="large">Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitLoading} style={{ background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 600 }} size="large">Save Changes</Button>
          </div>
        </Form>
      </Modal>

    </motion.div>
  );
};

export default AgencySubAgenciesTab;
