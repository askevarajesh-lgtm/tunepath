import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Table, Tag, Button, Input, Select, Progress, Avatar, Space, Modal, Form, message, Dropdown, Checkbox, InputNumber } from 'antd';
import { motion } from 'framer-motion';
import { Download, Plus, LayoutGrid, List, ArrowUpRight, Users, CircleDollarSign, Activity, AlertTriangle, MoreVertical, Edit2, Trash2, ShieldOff, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import PhoneInput from '../../components/common/PhoneInput';
import { isValidPhoneNumber } from 'libphonenumber-js';

const { Title, Text } = Typography;
const { Option } = Select;

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
]; // Trigger hot reload

const AGENCY_ACCOUNT_INTEGRATIONS = [
  { type: 'whatsapp', name: 'WhatsApp' },
  { type: 'sms', name: 'SMS' },
  { type: 'email', name: 'Email (SendPulse)' },
  { type: 'website', name: 'Lead Management Integration' },
  { type: 'payment', name: 'Payment Integration' },
  { type: 'ekta', name: 'Ekta HR Integration' },
];


const Accounts = () => {
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [agencies, setAgencies] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState(null);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [form] = Form.useForm();

  const [agencyCountryCode, setAgencyCountryCode] = useState('91');
  const [agencyCountryIso, setAgencyCountryIso] = useState('IN');

  const selectedPackageObj = packages.find(p => p._id === selectedPackageId);

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
      const [agenciesRes, packagesRes] = await Promise.all([
        api.get('/agencies'),
        api.get('/packages?type=agency')
      ]);
      setAgencies(agenciesRes.data.data || []);
      setPackages(packagesRes.data.data || []);
    } catch (error) {
      message.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (agency = null) => {
    if (agency) {
      setEditingAgency(agency);
      const pkgId = agency.plan?._id || agency.plan;
      setSelectedPackageId(pkgId);

      const selectedPkgObj = packages.find(p => p._id === pkgId);
      const pkgIntegrations = selectedPkgObj?.integrations || [];
      const disabledPackageIntegrations = agency.disabledPackageIntegrations || [];
      const additionalIntegrations = agency.additionalIntegrations || [];

      const effectiveIntegrations = [
        ...new Set([
          ...pkgIntegrations.filter(i => !disabledPackageIntegrations.includes(i)),
          ...additionalIntegrations
        ])
      ];

      setAgencyCountryCode(agency.countryCode || '91');
      setAgencyCountryIso(''); // Reset ISO so PhoneInput recalcs from countryCode
      form.setFieldsValue({
        name: agency.name,
        email: agency.email,
        phone: agency.phone,
        package: pkgId,
        features: agency.features || [],
        integrations: effectiveIntegrations,
        extraUsers: agency.extraUsers || 0,
        extraClients: agency.extraClients || 0
      });
    } else {
      setEditingAgency(null);
      setSelectedPackageId(null);
      form.resetFields();
      setAgencyCountryCode('91');
      setAgencyCountryIso('IN');
    }
    setIsModalOpen(true);
  };

  const handleCreateOrUpdate = async () => {
    try {
      const values = await form.validateFields();
      const selectedPkgObj = packages.find(p => p._id === values.package);
      const pkgIntegrations = selectedPkgObj?.integrations || [];
      const userSelectedIntegrations = values.integrations || [];

      const disabledPackageIntegrations = pkgIntegrations.filter(i => !userSelectedIntegrations.includes(i));
      const additionalIntegrations = userSelectedIntegrations.filter(i => !pkgIntegrations.includes(i));

      if (editingAgency) {
        await api.put(`/agencies/${editingAgency._id}`, {
          name: values.name,
          phone: values.phone,
          countryCode: agencyCountryCode,
          package: values.package,
          features: values.features,
          additionalIntegrations,
          disabledPackageIntegrations,
          extraUsers: values.extraUsers || 0,
          extraClients: values.extraClients || 0
        });
        message.success("Agency updated successfully");
      } else {
        await api.post('/agencies', {
          name: values.name,
          email: values.email,
          password: values.password,
          phone: values.phone,
          countryCode: agencyCountryCode,
          package: values.package,
          features: values.features,
          additionalIntegrations,
          disabledPackageIntegrations
        });
        message.success("Agency created successfully");
      }
      setIsModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      if (error.response && error.response.data) {
        message.error(error.response.data.message || "Failed to save agency");
      }
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/agencies/${id}`, { status: newStatus });
      message.success(`Agency marked as ${newStatus}`);
      fetchData();
    } catch (error) {
      message.error("Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: 'Delete Agency',
      content: 'Are you sure you want to delete this agency? This action cannot be undone.',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await api.delete(`/agencies/${id}`);
          message.success("Agency deleted successfully");
          fetchData();
        } catch (error) {
          message.error("Failed to delete agency");
        }
      }
    });
  };

  const getActionMenu = (record) => {
    return [
      { key: 'edit', icon: <Edit2 size={16} />, label: 'Edit Agency' },
      record.status === 'active'
        ? { key: 'suspend', icon: <ShieldOff size={16} />, label: 'Suspend Agency' }
        : { key: 'activate', icon: <ShieldCheck size={16} />, label: 'Activate Agency' },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={16} />, label: 'Delete Agency', danger: true },
    ];
  };

  const handleActionClick = ({ key }, record) => {
    switch (key) {
      case 'edit':
        handleOpenModal(record);
        break;
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
      title: 'AGENCY',
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
                <Text type="secondary">{record.email}</Text>
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
      title: 'PACKAGE',
      dataIndex: 'plan',
      key: 'package',
      render: plan => <Text type="secondary" style={{ fontWeight: 600 }}>{plan?.name || 'Custom'}</Text>
    },
    {
      title: 'USERS',
      key: 'users',
      render: (_, record) => {
        const limit = (record.plan?.users || record.allowedUsers || 5) + (record.extraUsers || 0);
        return <strong style={{ color: 'var(--text-primary)' }}>{record.usersCount || 0} / {limit}</strong>;
      }
    },
    {
      title: 'CLIENTS',
      key: 'clients',
      render: (_, record) => {
        const limit = (record.plan?.clients || 10) + (record.extraClients || 0);
        return <strong style={{ color: 'var(--text-primary)' }}>{record.clientsCount || 0} / {limit}</strong>;
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

  const filteredAgencies = React.useMemo(() => {
    return agencies.filter(agency => {
      let matchesFilter = true;
      if (filter !== 'All') {
        matchesFilter = agency.status === (filter === 'Active' ? 'active' : filter.toLowerCase());
      }

      let matchesSearch = true;
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        matchesSearch = (agency.name && agency.name.toLowerCase().includes(query)) ||
          (agency.email && agency.email.toLowerCase().includes(query));
      }

      return matchesFilter && matchesSearch;
    });
  }, [agencies, filter, searchQuery]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>Agency Accounts</Title>
          <Text type="secondary">Manage your agency accounts and provision packages.</Text>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button type="primary" onClick={() => handleOpenModal()} icon={<Plus size={16} />} style={{ borderRadius: 8, background: 'var(--accent-primary)', border: 'none', boxShadow: 'var(--shadow-md)' }}>Create Agency</Button>
        </div>
      </motion.div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'TOTAL AGENCIES', val: agencies.length, sub: 'All accounts', icon: <Users size={20} />, color: 'var(--accent-primary)', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, transparent 100%)' },
          { label: 'ACTIVE AGENCIES', val: agencies.filter(a => a.status === 'active').length, sub: 'Currently active', icon: <Activity size={20} />, color: 'var(--accent-secondary)', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, transparent 100%)' },
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
            { label: 'All', count: agencies.length },
            { label: 'Active', count: agencies.filter(a => a.status === 'active').length },
            { label: 'Suspended', count: agencies.filter(a => a.status === 'suspended').length }
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
            placeholder="Search agencies..."
            style={{ width: '100%', maxWidth: 360 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <Table
            columns={columns}
            dataSource={filteredAgencies}
            rowKey="_id"
            pagination={{
              defaultPageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
              position: ['bottomCenter']
            }}
            rowSelection={{ type: 'checkbox' }}
            size="middle"
            loading={loading}
            scroll={{ x: 1000 }}
          />
        </div>
      </motion.div>

      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 18 }}>{editingAgency ? "Edit Agency Account" : "Create Agency Account"}</span>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        className="glass-modal"
        centered
        width={500}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden', paddingRight: '8px' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item label={<Text style={{ fontWeight: 600 }}>Agency Name</Text>} name="name" rules={[{ required: true, message: 'Please enter agency name' }]}>
            <Input placeholder="e.g. Acme Corp" style={{ borderRadius: 8 }} size="large" />
          </Form.Item>

          <Form.Item
            name="phone"
            label={<Text style={{ fontWeight: 600 }}>Phone Number</Text>}
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (isValidPhoneNumber(value, agencyCountryIso)) {
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
              countryCodeValue={agencyCountryCode}
              onCountryCodeChange={setAgencyCountryCode}
              isoCountryValue={agencyCountryIso}
              onCountryIsoChange={setAgencyCountryIso}
            />
          </Form.Item>

          {!editingAgency && (
            <>
              <Form.Item label={<Text style={{ fontWeight: 600 }}>Admin Email</Text>} name="email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
                <Input placeholder="admin@agency.com" style={{ borderRadius: 8 }} size="large" />
              </Form.Item>

              <Form.Item label={<Text style={{ fontWeight: 600 }}>Password</Text>} name="password" rules={[{ required: true, message: 'Please set an initial password' }]}>
                <Input.Password placeholder="Set admin password" style={{ borderRadius: 8 }} size="large" />
              </Form.Item>
            </>
          )}

          <Form.Item label={<Text style={{ fontWeight: 600 }}>Package Selection</Text>} name="package" rules={[{ required: true, message: 'Please select an agency package' }]}>
            <Select
              style={{ borderRadius: 8 }}
              size="large"
              placeholder="Select a package"
              onChange={(value) => {
                setSelectedPackageId(value);
                const selectedPkg = packages.find(p => p._id === value);
                if (selectedPkg) {
                  form.setFieldsValue({ features: selectedPkg.features || [] });

                  const pkgIntegrations = selectedPkg.integrations || [];
                  form.setFieldsValue({ integrations: pkgIntegrations });
                }
              }}
            >
              {packages.map(pkg => (
                <Option key={pkg._id} value={pkg._id}>{pkg.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label={<Text style={{ fontWeight: 600 }}>Included Modules</Text>} name="features">
            <Checkbox.Group
              style={{ width: '100%' }}
              onChange={(checkedFeatures) => {
                const currentIntegrations = form.getFieldValue('integrations') || [];
                let newIntegrations = [...currentIntegrations];

                const AUTO_MAP = { hrms: 'ekta', crm: 'website' };

                Object.keys(AUTO_MAP).forEach(feat => {
                  const mappedInt = AUTO_MAP[feat];
                  if (checkedFeatures.includes(feat)) {
                    if (!newIntegrations.includes(mappedInt)) newIntegrations.push(mappedInt);
                  } else {
                    newIntegrations = newIntegrations.filter(i => i !== mappedInt);
                  }
                });

                form.setFieldsValue({ integrations: newIntegrations });
              }}
            >
              <Row gutter={[16, 16]}>
                {availableFeatures.map(feat => (
                  <Col span={12} key={feat.id}>
                    <Checkbox value={feat.id}>{feat.label}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item label={<Text style={{ fontWeight: 600 }}>Integrations</Text>} name="integrations">
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[16, 16]}>
                {AGENCY_ACCOUNT_INTEGRATIONS.map((integration) => (
                  <Col span={12} key={integration.type}>
                    <Checkbox value={integration.type}>
                      {integration.name}
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          {editingAgency && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label={<Text style={{ fontWeight: 600 }}>Extra Allowed Users</Text>} name="extraUsers" tooltip="Additional users beyond the package limit">
                  <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} size="large" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={<Text style={{ fontWeight: 600 }}>Extra Allowed Clients</Text>} name="extraClients" tooltip="Additional clients beyond the package limit">
                  <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} size="large" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32 }}>
            <Button onClick={() => setIsModalOpen(false)} style={{ borderRadius: 8, fontWeight: 600 }} size="large">Cancel</Button>
            <Button type="primary" onClick={handleCreateOrUpdate} style={{ background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 600 }} size="large">
              {editingAgency ? "Update Agency" : "Create Agency"}
            </Button>
          </div>
        </Form>
      </Modal>
    </motion.div>
  );
};

export default Accounts;