import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Typography, Input, Button, Tag, Row, Col, Drawer, Tabs, Progress, Switch, Select, message, Modal, Form, Checkbox, Table, Dropdown, Menu, Popconfirm, Tooltip , Card} from 'antd';
import { useAuth } from '../../../contexts/AuthContext';
import { useGetIntegrationsQuery } from '../../../api/integrationApi';
import { Search, AlertTriangle, CheckCircle, ExternalLink, MoreHorizontal, Circle, ArrowUpRight, Shield, Zap, Globe, Users, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import PhoneInput from '../../../components/common/PhoneInput';
import { isValidPhoneNumber } from 'libphonenumber-js';
import SlabCard from '../../../components/SlabCard';
import TaskListView from '../../Tasks/TaskListView';
import TaskDetailDrawer from '../../Tasks/TaskDetailDrawer';
import ClientBilling from './ClientBilling';
import ClientActivity from './ClientActivity';
import ClientDetailContent from './ClientDetailContent';
import { useClientContext } from '../../../contexts/ClientContext';

const { Title, Text } = Typography;

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
];

const ClientsTab = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedClient, setSelectedClient] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbClients, setDbClients] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDrawerVisible, setTaskDrawerVisible] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [packages, setPackages] = useState([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [createDealId, setCreateDealId] = useState(null);
  
  // Assign Users State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningClient, setAssigningClient] = useState(null);
  const [agencyUsersList, setAgencyUsersList] = useState([]);
  const [assignForm] = Form.useForm();

  const [clientProposals, setClientProposals] = useState([]);
  const [clientProjects, setClientProjects] = useState([]);
  const [clientInvoices, setClientInvoices] = useState([]);
  const [clientDataLoading, setClientDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [clientCountryCode, setClientCountryCode] = useState('91');
  const [clientCountryIso, setClientCountryIso] = useState('IN');
  const [clientEditCountryCode, setClientEditCountryCode] = useState('91');
  const [clientEditCountryIso, setClientEditCountryIso] = useState('IN');

  const { user, features: agencyFeatures, login } = useAuth();
  const { selectedClient: globalSelectedClient } = useClientContext();

  const { data: integrationsData } = useGetIntegrationsQuery();
  const rawIntegrations = integrationsData?.data?.integrations || [];

  const fetchPackages = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch('/api/packages?type=client', { headers });
      const data = await res.json();
      if (data.success) {
        setPackages(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch packages', error);
    }
  };

  const fetchAgencyUsers = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch('/api/users', { headers });
      const data = await res.json();
      if (data.success) {
        // Filter out agency super admins or anyone who inherently has access to all clients
        // Or just let them be assignable too. For now, we list all agency users.
        const allUsers = data.data || [];
        const excludedRoles = [
          'supreme_super_admin', 'superadmin', 'super_admin', 'commander_admin', 'admin',
          'agency_super_admin'
        ];
        setAgencyUsersList(allUsers.filter(u => !excludedRoles.includes(u.role)));
      }
    } catch (error) {
      console.error('Failed to fetch agency users', error);
    }
  };

  const handleImpersonate = async (clientId) => {
    try {
      const currentToken = localStorage.getItem('token');
      const currentUserStr = localStorage.getItem('user');

      const headers = { 'Authorization': `Bearer ${currentToken}` };
      const res = await fetch(`/api/auth/impersonate/${clientId}`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      
      if (data.success) {
        if (currentToken && currentUserStr) {
          localStorage.setItem('original_token', currentToken);
          localStorage.setItem('original_user', currentUserStr);
        }
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        message.success(`Logged in as ${data.user.name}`);
        login(data.user);
        
        // Redirect to the client's dashboard path based on their role
        navigate('/client');
      } else {
        message.error(data.message || data.error || 'Failed to login as client');
      }
    } catch (err) {
      console.error('Impersonation error:', err);
      message.error('Failed to login as client');
    }
  };

  const fetchClients = async () => {
    try {
      setLoading(true);
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };

      const [brandsRes, mosRes] = await Promise.all([
        fetch('/api/brands', { headers }),
        fetch('/api/mos/dashboard', { headers })
      ]);

      const brandsData = await brandsRes.json();
      const mosData = await mosRes.json();

      const mosClients = mosData.success && mosData.data ? mosData.data.clients : [];

      if (brandsData.success) {
        setDbClients(brandsData.data.map(c => {
          const mosInfo = mosClients.find(m => m.clientId === c._id) || {};

          return {
            ...c,
            accountStatus: c.status || 'active',
            code: c.code || c.name?.substring(0, 2).toUpperCase() || 'NA',
            status: mosInfo.overall >= 70 ? 'Healthy' : mosInfo.overall >= 50 ? 'At Risk' : 'Critical',
            mos: mosInfo.overall || 0,
            industry: c.industry || 'Unknown',
            am: c.am || 'Unassigned',
            scores: mosInfo.overall ? {
              SEO: mosInfo.seo,
              ADS: mosInfo.ads,
              LEADS: mosInfo.leads,
              SOCIAL: mosInfo.social,
              WEB: mosInfo.website,
              GEO: mosInfo.geo || 0
            } : { SEO: 0, ADS: 0, LEADS: 0, SOCIAL: 0, WEB: 0, GEO: 0 }
          };
        }));
      }
    } catch (error) {
      console.error('Failed to fetch clients', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchPackages();
  }, []);

  useEffect(() => {
    if (location.state?.openCreateClientModal) {
      setIsCreateModalOpen(true);
      if (location.state.dealName) {
        form.setFieldsValue({ name: location.state.dealName });
      }
      if (location.state.dealId) {
        setCreateDealId(location.state.dealId);
      }
      // Clean up state so refresh doesn't reopen modal
      window.history.replaceState({}, document.title)
    }
  }, [location.state, form]);

  const handleCreateClient = async (values) => {
    try {
      setLoading(true);

      let selectedPackage = null;
      if (values.packageName) {
        selectedPackage = packages.find(p => p.name === values.packageName);
      }

      const payload = {
        ...values,
        countryCode: clientCountryCode,
        features: selectedPackage ? selectedPackage.features : [],
        mrr: selectedPackage ? selectedPackage.price : 0,
        dealId: createDealId || location.state?.dealId || undefined
      };

      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        message.success('Client created successfully');
        setIsCreateModalOpen(false);
        form.resetFields();
        setClientCountryCode('91');
        setClientCountryIso('IN');
        setCreateDealId(null);
        fetchClients();
      } else {
        message.error(data.message || 'Failed to create client');
      }
    } catch (error) {
      message.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };



  const handleEditClientSubmit = async (values) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/brands/${editingClient._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          phone: values.phone,
          countryCode: clientEditCountryCode,
          address: values.address,
          packageName: values.packageName || null
        })
      });
      const data = await res.json();

      if (data.success) {
        message.success('Client updated successfully');
        setIsEditModalOpen(false);
        setEditingClient(null);
        editForm.resetFields();
        fetchClients();
      } else {
        message.error(data.message || 'Failed to update client');
      }
    } catch (error) {
      message.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignUsersSubmit = async (values) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/brands/${assigningClient._id}/assign-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ assignedUsers: values.assignedUsers })
      });
      const data = await res.json();

      if (data.success) {
        message.success('Users assigned successfully');
        setIsAssignModalOpen(false);
        setAssigningClient(null);
        assignForm.resetFields();
        fetchClients();
      } else {
        message.error(data.message || 'Failed to assign users');
      }
    } catch (error) {
      message.error('An error occurred while assigning users');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendClient = async (clientId, currentStatus) => {
    try {
      setLoading(true);
      const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
      const res = await fetch(`/api/brands/${clientId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        message.success(`Client ${newStatus === 'suspended' ? 'suspended' : 'activated'} successfully`);
        fetchClients();
      } else {
        message.error(data.message || 'Failed to update status');
      }
    } catch (error) {
      message.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (clientId) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/brands/${clientId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        message.success('Client deleted successfully');
        fetchClients();
      } else {
        message.error(data.message || 'Failed to delete client');
      }
    } catch (error) {
      message.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };


  const selectedPackageName = Form.useWatch('packageName', form);
  const selectedPackageObj = packages.find(p => p.name === selectedPackageName) || null;
  const includedFeatures = selectedPackageObj ? selectedPackageObj.features : [];

  const getStatusColor = (status) => {
    if (status === 'Healthy') return 'var(--accent-primary)';
    if (status === 'At Risk') return 'var(--accent-warning)';
    return 'var(--accent-danger)';
  };

  const getScoreColor = (val) => {
    if (val >= 70) return 'var(--accent-primary)';
    if (val >= 50) return 'var(--accent-warning)';
    return 'var(--accent-danger)';
  };

  const ScoreBar = ({ label, score }) => (
    <div style={{ flex: '1 1 80px', minWidth: 80, maxWidth: 140 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: getScoreColor(score) }}>{score}</span>
      </div>
      <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ height: '100%', background: getScoreColor(score), borderRadius: 3 }}
        />
      </div>
    </div>
  );

  // Filter clients by name or email against the search query.
  // This is the piece that was missing: the Input had no value/onChange,
  // so nothing ever consumed what the user typed.
  const filteredClients = useMemo(() => {
    let clientsToFilter = dbClients;
    if (globalSelectedClient) {
      clientsToFilter = dbClients.filter(c => c._id === globalSelectedClient._id);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clientsToFilter;
    return clientsToFilter.filter(c => {
      const name = (c.name || '').toLowerCase();
      const email = (c.adminEmail || c.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [dbClients, searchQuery]);

  const hasAccountsPerm = (action) => {
    if (['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'agency_manager'].includes(user?.role)) return true;
    return user?.permissions?.['Clients-Accounts']?.[action] === true;
  };

  const isAgencyAdmin = ['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'agency_manager'].includes(user?.role);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >

      <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>All Clients</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>
            {filteredClients.length} of {dbClients.length} total active clients in your agency
          </Text>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {hasAccountsPerm('Create') && (
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => setIsCreateModalOpen(true)}
              style={{ borderRadius: 8, background: 'var(--accent-primary)', fontWeight: 600, border: 'none' }}
            >
              Create Client
            </Button>
          )}
        </div>
      </motion.div>

      {/* Filter Bar */}
      <motion.div variants={itemVariants} style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', padding: 12, borderRadius: 16, border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 16 }}>

          <Input
            prefix={<Search size={18} style={{ color: 'var(--text-tertiary)' }} />}
            placeholder="Search clients by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            onClear={() => setSearchQuery('')}
            style={{
              maxWidth: 400,
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              fontSize: 15
            }}
          />
        </div>
      </motion.div>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>Edit Client Details</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)' }}>{editingClient?.name}</div>
            </div>
          </div>
        }
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingClient(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        confirmLoading={loading}
        okText="Save Changes"
        cancelText="Cancel"
        width={560}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditClientSubmit} style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <Form.Item
                name="name"
                label={<span style={{ fontWeight: 600 }}>Client Company Name</span>}
                rules={[{ required: true, message: 'Please enter client name' }]}
                style={{ marginBottom: 0 }}
              >
                <Input placeholder="e.g. Acme Corp" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
            </div>

            <div>
              <Text style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, display: 'block' }}>
                Contact & Account Details
              </Text>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Form.Item
                    name="email"
                    label={<span style={{ fontWeight: 600 }}>Admin Email</span>}
                    rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input type="email" placeholder="manager@client.com" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    name="phone"
                    label={<span style={{ fontWeight: 600 }}>Phone Number</span>}
                    rules={[
                      {
                        validator: (_, value) => {
                          if (!value) return Promise.resolve();
                          if (isValidPhoneNumber(value, clientCountryIso)) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('Please enter a valid phone number for the selected country'));
                        }
                      }
                    ]}
                    style={{ marginBottom: 0 }}
                  >
                    <PhoneInput 
                      size="large" 
                      style={{ borderRadius: 8 }} 
                      countryCodeValue={clientCountryCode}
                      onCountryCodeChange={setClientCountryCode}
                      isoCountryValue={clientCountryIso}
                      onCountryIsoChange={setClientCountryIso}
                    />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    name="address"
                    label={<span style={{ fontWeight: 600 }}>Address</span>}
                    rules={[{ required: true, message: 'Please enter an address' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input.TextArea placeholder="e.g. 123 Main St, City, Country" size="large" rows={2} style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div>
              <Text style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, display: 'block' }}>
                Subscription
              </Text>
              <Form.Item
                name="packageName"
                label={<span style={{ fontWeight: 600 }}>Assign Package</span>}
                style={{ marginBottom: 0 }}
              >
                <Select placeholder="Select a package" size="large" style={{ borderRadius: 8 }}>
                  <Select.Option value={null}>No Package (Custom)</Select.Option>
                  {packages.map(pkg => (
                    <Select.Option key={pkg.name} value={pkg.name}>{pkg.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </div>
          </div>
        </Form>
      </Modal>

      {/* Assign Users Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>Assign Users</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)' }}>{assigningClient?.name}</div>
            </div>
          </div>
        }
        open={isAssignModalOpen}
        onCancel={() => {
          setIsAssignModalOpen(false);
          setAssigningClient(null);
          assignForm.resetFields();
        }}
        onOk={() => assignForm.submit()}
        confirmLoading={loading}
        okText="Assign"
        cancelText="Cancel"
        width={480}
      >
        <Form form={assignForm} layout="vertical" onFinish={handleAssignUsersSubmit} style={{ marginTop: 24 }}>
          <Form.Item
            name="assignedUsers"
            label={<span style={{ fontWeight: 600 }}>Select Users to Manage this Client</span>}
            rules={[{ required: true, message: 'Please select at least one user' }]}
          >
            <Select
              mode="multiple"
              placeholder="Select users"
              size="large"
              style={{ borderRadius: 8 }}
              optionFilterProp="children"
            >
              {agencyUsersList.map(u => (
                <Select.Option key={u._id} value={u._id}>
                  {u.name} ({u.email})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Card>
        <Table
          
          dataSource={filteredClients}
          rowKey="_id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            position: ['bottomRight']
          }}
          locale={{ emptyText: searchQuery ? 'No clients match your search' : 'No clients found' }}
          columns={[
            {
              title: 'Client Name',
              dataIndex: 'name',
              key: 'name',
              render: (text, record) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', fontWeight: 800, fontSize: 16 }}>
                    {record.code}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{text}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{record.adminEmail || record.email}</div>
                  </div>
                </div>
              )
            },
            {
              title: 'Package',
              dataIndex: 'packageName',
              key: 'packageName',
              render: (text) => text || 'Custom'
            },
            {
              title: 'Account Status',
              dataIndex: 'accountStatus',
              key: 'accountStatus',
              render: (status) => (
                <Tag color={status === 'active' ? 'success' : 'error'} style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>
                  {status === 'active' ? 'Active' : 'Suspended'}
                </Tag>
              )
            },

            {
              title: 'Created By',
              key: 'createdBy',
              render: (_, record) => {
                const creator = record.createdBy;
                if (!creator) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
                return (
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{creator.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      {(creator.roleName || creator.role || '').replace(/_/g, ' ')}
                    </div>
                  </div>
                );
              }
            },
            {
              title: 'Assigned Users',
              key: 'assignedUsers',
              render: (_, record) => {
                const users = record.assignedUsers || [];
                if (users.length === 0) return <span style={{ color: 'var(--text-tertiary)' }}>No one assigned</span>;
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {users.map(u => {
                      // If it's not populated, just show the ID (shouldn't happen)
                      const isObj = typeof u === 'object';
                      const name = isObj ? u.name : u;
                      const email = isObj ? u.email : '';
                      return (
                        <Tooltip title={email} key={isObj ? u._id : u}>
                          <Tag style={{ margin: 0, borderRadius: 12, padding: '2px 8px', fontWeight: 600 }}>{name}</Tag>
                        </Tooltip>
                      );
                    })}
                  </div>
                );
              }
            },
            {
              title: 'Actions',
              key: 'actions',
              align: 'right',
              render: (_, record) => (
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'view',
                        label: 'View Client',
                        onClick: () => setSelectedClient(record)
                      },
                      isAgencyAdmin ? {
                        key: 'assign',
                        label: 'Assign Users',
                        onClick: () => {
                          setAssigningClient(record);
                          fetchAgencyUsers();
                          assignForm.setFieldsValue({
                            assignedUsers: (record.assignedUsers || []).map(u => typeof u === 'object' ? u._id : u)
                          });
                          setIsAssignModalOpen(true);
                        }
                      } : null,
                      hasAccountsPerm('Edit') ? {
                        key: 'edit',
                        label: 'Edit Client',
                        onClick: () => {
                          setEditingClient(record);
                          setClientEditCountryCode(record.countryCode || '91');
                          setClientEditCountryIso(record.countryIso || '');
                          editForm.setFieldsValue({
                            name: record.companyName || record.name,
                            email: record.adminEmail || record.email,
                            phone: record.phone || '',
                            address: record.address || '',
                            packageName: record.packageName || null
                          });
                          setIsEditModalOpen(true);
                        }
                      } : null,
                      isAgencyAdmin ? {
                        key: 'suspend',
                        label: record.accountStatus === 'suspended' ? 'Activate Client' : 'Suspend Client',
                        onClick: () => handleSuspendClient(record._id, record.accountStatus)
                      } : null,
                      hasAccountsPerm('Delete') ? {
                        type: 'divider'
                      } : null,
                      hasAccountsPerm('Delete') ? {
                        key: 'delete',
                        danger: true,
                        label: (
                          <div onClick={(e) => e.stopPropagation()}>
                            <Popconfirm
                              title="Delete Client"
                              description="Are you sure you want to delete this client? This action cannot be undone."
                              onConfirm={() => handleDeleteClient(record._id)}
                              okText="Yes"
                              cancelText="No"
                              okButtonProps={{ danger: true }}
                            >
                              <div style={{ width: '100%' }}>Delete Client</div>
                            </Popconfirm>
                          </div>
                        )
                      } : null
                    ].filter(Boolean)
                  }}
                  trigger={['click']}
                >
                  <Button type="text" icon={<MoreHorizontal size={18} />} />
                </Dropdown>
              )
            }
          ]}
        />
      </Card>

      {/* Client Detail Drawer */}
      <Drawer
        open={!!selectedClient}
        onClose={() => { setSelectedClient(null); setClientProposals([]); setClientProjects([]); setClientInvoices([]); }}
        width={Math.min(window.innerWidth, 960)}
        closeIcon={<span style={{ color: 'var(--text-tertiary)', fontSize: 20 }}>×</span>}
        headerStyle={{ borderBottom: '1px solid var(--border-color)', padding: '24px 32px' }}
        bodyStyle={{ padding: '24px 32px' }}
        title={selectedClient && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `${getStatusColor(selectedClient.status)}22`, color: getStatusColor(selectedClient.status), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, border: `2px solid ${getStatusColor(selectedClient.status)}40` }}>
              {selectedClient.code}
            </div>
            <div style={{ flex: 1 }}>
              <Title level={4} style={{ margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>{selectedClient.name}</Title>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>{selectedClient.industry}</Text>
                <span style={{ color: 'var(--border-color)' }}>·</span>
                <Tag style={{ margin: 0, borderRadius: 8, background: `${getStatusColor(selectedClient.status)}15`, color: getStatusColor(selectedClient.status), border: 'none', fontWeight: 700, fontSize: 11 }}>
                  {selectedClient.status}
                </Tag>
                {selectedClient.packageName && <Tag style={{ margin: 0, borderRadius: 8, fontWeight: 600, fontSize: 11 }}>{selectedClient.packageName}</Tag>}
              </div>
            </div>
            <Button 
              type="primary" 
              size="small" 
              icon={<ArrowUpRight size={14} />} 
              style={{ background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 700 }}
              onClick={() => handleImpersonate(selectedClient._id)}
            >
              Full Dashboard
            </Button>
          </div>
        )}
      >
        {selectedClient && (
          <ClientDetailContent
            selectedClient={selectedClient}
            allowedFeatures={availableFeatures}
            allowedIntegrations={user?.integrations || []}
            getStatusColor={getStatusColor}
            getScoreColor={getScoreColor}
            clientProposals={clientProposals}
            setClientProposals={setClientProposals}
            clientProjects={clientProjects}
            setClientProjects={setClientProjects}
            clientInvoices={clientInvoices}
            setClientInvoices={setClientInvoices}
            clientDataLoading={clientDataLoading}
            setClientDataLoading={setClientDataLoading}
            onTaskClick={(task) => { setSelectedTask(task); setTaskDrawerVisible(true); }}
            onClientUpdated={(updatedClient) => {
              setSelectedClient(updatedClient);
              fetchClients();
            }}
          />
        )}
      </Drawer>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Users size={20} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 800 }}>Create New Client</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>Provision a new workspace and admin account</Text>
            </div>
          </div>
        }
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        width={520}
        closeIcon={<span style={{ color: 'var(--text-tertiary)', fontSize: 20 }}>×</span>}
        styles={{
          header: { padding: '24px 24px 16px 24px', borderBottom: '1px solid var(--border-color)' },
          body: { padding: '24px', maxHeight: '550px', overflowY: 'auto' },
          content: { borderRadius: 16, overflow: 'hidden' }
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateClient}
          requiredMark={true}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <Text style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, display: 'block' }}>
                Company Details
              </Text>
              <Form.Item
                name="name"
                label={<span style={{ fontWeight: 600 }}>Client Company Name</span>}
                rules={[{ required: true, message: 'Please enter client name' }]}
                style={{ marginBottom: 0 }}
              >
                <Input placeholder="e.g. Acme Corp" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
            </div>

            <div>
              <Text style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, display: 'block' }}>
                Admin Account
              </Text>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    name="email"
                    label={<span style={{ fontWeight: 600 }}>Admin Email</span>}
                    rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}
                  >
                    <Input type="email" placeholder="manager@client.com" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    name="password"
                    label={<span style={{ fontWeight: 600 }}>Initial Password</span>}
                    rules={[{ required: true, message: 'Please enter a password' }]}
                  >
                    <Input.Password placeholder="Enter a secure password" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    name="phone"
                    label={<span style={{ fontWeight: 600 }}>Phone Number</span>}
                    rules={[
                      {
                        validator: (_, value) => {
                          if (!value) return Promise.resolve();
                          if (isValidPhoneNumber(value, clientEditCountryIso)) {
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
                      countryCodeValue={clientEditCountryCode}
                      onCountryCodeChange={setClientEditCountryCode}
                      isoCountryValue={clientEditCountryIso}
                      onCountryIsoChange={setClientEditCountryIso}
                    />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    name="address"
                    label={<span style={{ fontWeight: 600 }}>Address</span>}
                    rules={[{ required: true, message: 'Please enter an address' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input.TextArea placeholder="e.g. 123 Main St, City, Country" size="large" rows={2} style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, display: 'block' }}>
                Subscription
              </Text>
              <Form.Item
                name="packageName"
                label={<span style={{ fontWeight: 600 }}>Assign Package</span>}
                style={{ marginBottom: 16 }}
              >
                <Select placeholder="Select a package" size="large" style={{ borderRadius: 8 }}>
                  {packages.map(pkg => (
                    <Select.Option key={pkg.name} value={pkg.name}>{pkg.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {selectedPackageName && (
                <div>
                  <Text style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 12, display: 'block' }}>
                    Included Modules
                  </Text>
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    {availableFeatures.map(feat => {
                      const isIncluded = includedFeatures.includes(feat.id);
                      return (
                        <Col span={12} key={feat.id}>
                          <Checkbox checked={isIncluded} disabled>
                            {feat.label}
                          </Checkbox>
                        </Col>
                      );
                    })}
                  </Row>

                  <Text style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 12, display: 'block' }}>
                    Included Integrations
                  </Text>
                  {selectedPackageObj?.integrations && selectedPackageObj.integrations.length > 0 ? (
                    <Row gutter={[16, 16]}>
                      {selectedPackageObj.integrations.map(type => {
                        const matched = rawIntegrations.find(i => i.type === type);
                        const label = matched?.name || type;
                        return (
                          <Col span={12} key={type}>
                            <Checkbox checked={true} disabled>
                              {label}
                            </Checkbox>
                          </Col>
                        );
                      })}
                    </Row>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 13 }}>No integrations included in this package.</Text>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button
              onClick={() => setIsCreateModalOpen(false)}
              style={{ fontWeight: 600, borderRadius: 8, height: 44, padding: '0 24px' }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{ background: 'var(--accent-primary)', fontWeight: 700, borderRadius: 8, height: 44, padding: '0 24px' }}
            >
              Provision Workspace
            </Button>
          </div>
        </Form>
      </Modal>

      <TaskDetailDrawer
        visible={taskDrawerVisible}
        onClose={() => {
          setTaskDrawerVisible(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onTaskUpdated={() => {
          // Optionally trigger a refetch here if needed
        }}
      />
    </motion.div>
  );
};

export default ClientsTab;