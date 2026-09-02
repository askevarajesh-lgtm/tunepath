import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Input, Tag, Space, Dropdown, Menu, Modal, Form, Select, Avatar, message } from 'antd';
import { motion } from 'framer-motion';
import { Search, Plus, MoreVertical, Edit2, Trash2, Shield, UserX, UserCheck } from 'lucide-react';
import api from '../../services/api';
import PhoneInput from '../../components/common/PhoneInput';
import { isValidPhoneNumber } from 'libphonenumber-js';

const { Title, Text } = Typography;
const { Option } = Select;

const Admins = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form] = Form.useForm();
  const [adminsData, setAdminsData] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [adminCountryCode, setAdminCountryCode] = useState('91');
  const [adminCountryIso, setAdminCountryIso] = useState('IN');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, agenciesRes] = await Promise.all([
        api.get('/users'),
        api.get('/agencies')
      ]);
      setCompanies(agenciesRes.data.data || []);
      
      setAdminsData(usersRes.data.data.map(item => ({
        key: item._id,
        _id: item._id,
        name: item.name || item.email.split('@')[0],
        email: item.email,
        phone: item.phone,
        company: item.agencyId || item.brandId,
        role: item.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        rawRole: item.role,
        status: (item.status === 'inactive' || item.status === 'suspended') ? 'Inactive' : 'Active',
        lastLogin: new Date(item.updatedAt).toLocaleDateString(),
        addedOn: new Date(item.createdAt).toLocaleDateString(),
        initial: (item.name ? item.name.charAt(0) : item.email.charAt(0)).toUpperCase()
      })));
    } catch (error) {
      message.error('Failed to fetch admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      message.success('Admin deleted successfully');
      fetchData();
    } catch (error) {
      message.error('Failed to delete admin');
    }
  };

  const handleCreateOrUpdate = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        countryCode: adminCountryCode,
        role: values.role,
        status: values.status === 'inactive' ? 'inactive' : 'active'
      };
      if (values.company) payload.agencyId = values.company;
      if (values.password) payload.password = values.password;

      if (editId) {
        await api.put(`/users/${editId}`, payload);
        message.success('Admin updated successfully');
      } else {
        await api.post('/users', payload);
        message.success('Admin created successfully');
      }
      setIsModalOpen(false);
      setEditId(null);
      form.resetFields();
      setAdminCountryCode('91');
      setAdminCountryIso('IN');
      fetchData();
    } catch (error) {
      if (error.response) {
        message.error(`Failed to ${editId ? 'update' : 'create'} admin: ` + (error.response.data.message || error.message));
      }
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/users/${id}`, { status });
      message.success(`Account ${status === 'active' ? 'activated' : 'deactivated'} successfully`);
      fetchData();
    } catch (error) {
      message.error(`Failed to ${status === 'active' ? 'activate' : 'deactivate'} account`);
    }
  };

  const handleEdit = (record) => {
    setEditId(record._id);
    setAdminCountryCode(record.countryCode || '91');
    setAdminCountryIso(record.countryIso || '');
    form.setFieldsValue({
      name: record.name,
      email: record.email,
      phone: record.phone,
      company: record.company,
      role: record.rawRole || record.role.toLowerCase().replace(/ /g, '_'),
      status: record.status.toLowerCase()
    });
    setIsModalOpen(true);
  };

  const getActionMenu = (record) => [
    { key: 'edit', icon: <Edit2 size={16} />, label: 'Edit Admin' },
    record.status === 'Active' 
      ? { key: 'deactivate', icon: <UserX size={16} />, label: 'Deactivate Account' }
      : { key: 'activate', icon: <UserCheck size={16} />, label: 'Activate Account' },
    { type: 'divider' },
    { key: 'delete', danger: true, icon: <Trash2 size={16} />, label: 'Delete Admin' }
  ];

  const handleMenuClick = (e, record) => {
    if (e.key === 'delete') {
      handleDelete(record._id);
    } else if (e.key === 'deactivate') {
      handleStatusChange(record._id, 'inactive');
    } else if (e.key === 'activate') {
      handleStatusChange(record._id, 'active');
    } else if (e.key === 'edit') {
      handleEdit(record);
    }
  };

  const columns = [
    {
      title: 'Admin User',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size={40} style={{ background: 'var(--accent-primary)', color: '#fff', fontWeight: 700 }}>
            {record.initial}
          </Avatar>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{text}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={role.includes('Super Admin') ? 'purple' : role.includes('Admin') ? 'blue' : 'default'} style={{ borderRadius: 12, px: 8 }}>
          {role}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'Active' ? 'green' : 'red'} style={{ borderRadius: 12 }}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (text) => <Text style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{text}</Text>,
    },
    {
      title: 'Added On',
      dataIndex: 'addedOn',
      key: 'addedOn',
      render: (text) => <Text type="secondary">{text}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Dropdown menu={{ items: getActionMenu(record), onClick: (e) => handleMenuClick(e, record) }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreVertical size={16} style={{ color: 'var(--text-secondary)' }} />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <div >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800, color: 'var(--text-primary)' }}>
            User Management
          </Title>
          <Text type="secondary" style={{ fontSize: 16 }}>
            Manage super admin users, system roles, and access permissions.
          </Text>
        </div>
        <Button 
          type="primary" 
          icon={<Plus size={18} />} 
          style={{ background: 'var(--accent-primary)', height: 44, borderRadius: 8, fontWeight: 600 }}
          onClick={() => {
            setEditId(null);
            form.resetFields();
            setIsModalOpen(true);
          }}
        >
          Add Admin
        </Button>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card 
          className="glassmorphism"
          style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
          bodyStyle={{ padding: '20px 24px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <Input 
              placeholder="Search admins by name or email..." 
              prefix={<Search size={18} style={{ color: 'var(--text-tertiary)' }} />}
              style={{ width: 320, borderRadius: 8, height: 40 }}
            />
            <Space>
              <Select defaultValue="all" style={{ width: 140, height: 40 }} className="custom-select">
                <Option value="all">All Roles</Option>
                <Option value="supreme_super_admin">Supreme Admin</Option>
                <Option value="commander_admin">Commander Admin</Option>
              </Select>
              <Select defaultValue="active" style={{ width: 140, height: 40 }} className="custom-select">
                <Option value="all">All Status</Option>
                <Option value="active">Active</Option>
                <Option value="inactive">Inactive</Option>
              </Select>
            </Space>
          </div>

          <Table 
            columns={columns} 
            dataSource={adminsData} 
            loading={loading}
            pagination={{
              defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
              position: ['bottomRight']
            }}
            
          />
        </Card>
      </motion.div>

      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 18 }}>{editId ? 'Edit Admin User' : 'Add New Admin User'}</span>}
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); setEditId(null); form.resetFields(); setAdminCountryCode('91'); setAdminCountryIso('IN'); }}
        footer={null}
        className="glass-modal"
        centered
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Full Name</Text>} name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Sarah Connor" style={{ borderRadius: 8 }} />
          </Form.Item>
          
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Email Address</Text>} name="email" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="sarah@m1platform.com" style={{ borderRadius: 8 }} />
          </Form.Item>
          
          <Form.Item 
            label={<Text style={{ fontWeight: 600 }}>Phone Number</Text>} 
            name="phone"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (isValidPhoneNumber(value, adminCountryIso)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Please enter a valid phone number for the selected country'));
                }
              }
            ]}
          >
            <PhoneInput 
              style={{ borderRadius: 8 }} 
              countryCodeValue={adminCountryCode}
              onCountryCodeChange={setAdminCountryCode}
              isoCountryValue={adminCountryIso}
              onCountryIsoChange={setAdminCountryIso}
            />
          </Form.Item>
          
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Password</Text>} name="password" rules={[{ required: !editId, message: 'Password is required' }]}>
            <Input.Password placeholder={editId ? "Leave blank to keep unchanged" : "Enter secure password"} style={{ borderRadius: 8 }} />
          </Form.Item>
          
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Associated Company</Text>} name="company" rules={[{ required: true, message: 'Please select a company' }]}>
            <Select style={{ borderRadius: 8 }} placeholder="Select a company">
              {companies.map(c => (
                <Option key={c._id} value={c._id}>{c.name}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item label={<Text style={{ fontWeight: 600 }}>System Role</Text>} name="role" initialValue="commander_admin">
            <Select size="large">
              <Option value="supreme_super_admin">Supreme Super Admin</Option>
              <Option value="commander_admin">Commander Admin</Option>
            </Select>
          </Form.Item>

          <Form.Item label={<Text style={{ fontWeight: 600 }}>Status</Text>} name="status" initialValue="active">
            <Select style={{ borderRadius: 8 }}>
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
            </Select>
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32 }}>
            <Button onClick={() => { setIsModalOpen(false); setEditId(null); form.resetFields(); }} style={{ borderRadius: 8, fontWeight: 600 }}>Cancel</Button>
            <Button type="primary" onClick={handleCreateOrUpdate} style={{ background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 600 }}>
              {editId ? 'Update Admin' : 'Create Admin'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Admins;
