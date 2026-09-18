import React, { useState, useEffect } from 'react';
import { Typography, Card, Select, Button, Switch, Input, Table, Tag, Avatar, ConfigProvider, Modal, Form, message, Drawer, Dropdown, Space, Popconfirm, Checkbox, InputNumber } from 'antd';
import { motion } from 'framer-motion';
import { ExternalLink, Upload, Pencil, Trash2, Plus, Palette, Layout, Database, Users, Bell, MoreVertical, Eye, Ban, CheckCircle } from 'lucide-react';
import { useFeatures } from '../../contexts/FeatureContext';
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
];

const DIRECT_BRAND_INTEGRATIONS = [
  { type: 'whatsapp', name: 'WhatsApp' },
  { type: 'sms', name: 'SMS' },
  { type: 'email', name: 'Email (SendPulse)' },
  { type: 'website', name: 'Lead Management Integration' },
  { type: 'ekta', name: 'Ekta HR Integration' },
];

const PortalSettings = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dbBrands, setDbBrands] = useState([]);
  
  const [brandCountryCode, setBrandCountryCode] = useState('91');
  const [brandCountryIso, setBrandCountryIso] = useState('IN');
  
  const [brandEditCountryCode, setBrandEditCountryCode] = useState('91');
  const [brandEditCountryIso, setBrandEditCountryIso] = useState('IN');
  
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const res = await api.get('/brands');
      if (res && res.data && res.data.success) {
        setDbBrands(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch brands', error);
      message.error('Failed to load Direct Brands');
    } finally {
      setLoading(false);
    }
  };

  const fetchPackages = async () => {
    try {
      setPackagesLoading(true);
      const res = await api.get('/packages?type=directClient');
      if (res && res.data && res.data.success) {
        setPackages(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch direct packages', error);
    } finally {
      setPackagesLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
    fetchPackages();
  }, []);

  const handleCreateBrand = async (values) => {
    try {
      setLoading(true);

      const selectedPkgObj = packages.find(p => p.name === values.packageName);
      const pkgIntegrations = selectedPkgObj?.integrations || [];
      const userSelectedIntegrations = values.integrations || [];
      const disabledPackageIntegrations = pkgIntegrations.filter(i => !userSelectedIntegrations.includes(i));
      const additionalIntegrations = userSelectedIntegrations.filter(i => !pkgIntegrations.includes(i));

      const payload = {
        ...values,
        countryCode: brandCountryCode,
        features: values.features || [],
        additionalIntegrations,
        disabledPackageIntegrations
      };

      const res = await api.post('/brands', payload);
      const data = res.data;
      
      if (data.success) {
        message.success('Direct Brand created successfully');
        setIsCreateModalOpen(false);
        form.resetFields();
        setBrandCountryCode('91');
        setBrandCountryIso('IN');
        fetchBrands();
      } else {
        message.error(data.message || 'Failed to create brand');
      }
    } catch (error) {
        message.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEditBrand = async (values) => {
    try {
      setLoading(true);

      const selectedPkgObj = packages.find(p => p.name === values.packageName);
      const pkgIntegrations = selectedPkgObj?.integrations || [];
      const userSelectedIntegrations = values.integrations || [];
      const disabledPackageIntegrations = pkgIntegrations.filter(i => !userSelectedIntegrations.includes(i));
      const additionalIntegrations = userSelectedIntegrations.filter(i => !pkgIntegrations.includes(i));

      const payload = {
        name: values.name,
        phone: values.phone,
        countryCode: brandEditCountryCode,
        packageName: values.packageName,
        features: values.features || [],
        additionalIntegrations,
        disabledPackageIntegrations,
        extraUsers: values.extraUsers || 0
      };

      const res = await api.put(`/brands/${editingBrand._id}`, payload);
      const data = res.data;

      if (data.success) {
        message.success('Brand updated successfully');
        setIsEditModalOpen(false);
        fetchBrands();
      } else {
        message.error(data.message || 'Failed to update brand');
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'An error occurred while updating the brand');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendBrand = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const res = await fetch(`/api/brands/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        message.success(`Brand ${newStatus === 'active' ? 'activated' : 'suspended'} successfully`);
        fetchBrands();
      } else {
        message.error(data.message || 'Failed to update status');
      }
    } catch (error) {
      message.error('An error occurred');
    }
  };

  const handleDeleteBrand = async (id) => {
    try {
      const res = await fetch(`/api/brands/${id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        message.success('Brand deleted successfully');
        fetchBrands();
      } else {
        message.error(data.message || 'Failed to delete brand');
      }
    } catch (error) {
      message.error('An error occurred');
    }
  };

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

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >
      <motion.div variants={itemVariants} style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>Direct Brand</Title>
          <Text type="secondary">Per-client configuration for the white-label portal.</Text>
        </div>
      </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glassmorphism" style={{ borderRadius: 16, marginBottom: 24, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }} bodyStyle={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
              <Title level={4} style={{ margin: 0, fontWeight: 800 }}>Direct Brands</Title>
              <div style={{ display: 'flex', gap: 12 }}>
                <Button 
                  type="primary"
                  onClick={() => setIsCreateModalOpen(true)}
                  icon={<Plus size={16} />} 
                  style={{ borderRadius: 8, height: 40, background: 'var(--accent-primary)', fontWeight: 600 }}
                >
                  Create Direct Brand
                </Button>
              </div>
            </div>

            <Table 
              dataSource={dbBrands} 
              rowKey="_id" 
              pagination={false}
              columns={[
                {
                  title: 'BRAND NAME',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text) => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong>
                },
                {
                  title: 'SUPER ADMIN EMAIL',
                  dataIndex: 'adminEmail',
                  key: 'adminEmail',
                  render: (text) => text ? <Text type="secondary">{text}</Text> : <Text type="secondary" italic>Unassigned</Text>
                },
                {
                  title: 'PACKAGE',
                  dataIndex: 'packageName',
                  key: 'packageName',
                  render: (text) => text ? <Tag color="blue">{text}</Tag> : <Text type="secondary">-</Text>
                },
                {
                  title: 'STATUS',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status) => (
                    <Tag style={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'transparent', padding: '2px 10px', color: 'var(--text-primary)' }}>
                      <span style={{ color: status === 'active' ? 'var(--accent-primary)' : 'var(--accent-warning)' }}>●</span> {status}
                    </Tag>
                  )
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
                  title: 'ACTIONS',
                  key: 'actions',
                  align: 'right',
                  render: (_, record) => {
                    const items = [
                      {
                        key: 'edit',
                        label: 'Edit',
                        icon: <Pencil size={16} />,
                        onClick: () => {
                          setEditingBrand(record);
                          
                          const selectedPkgObj = packages.find(p => p.name === record.packageName);
                          const pkgIntegrations = selectedPkgObj?.integrations || [];
                          const disabledPackageIntegrations = record.disabledPackageIntegrations || [];
                          const additionalIntegrations = record.additionalIntegrations || [];
                          
                          const effectiveIntegrations = [
                            ...new Set([
                              ...pkgIntegrations.filter(i => !disabledPackageIntegrations.includes(i)),
                              ...additionalIntegrations
                            ])
                          ];

                          setBrandEditCountryCode(record.countryCode || '91');
                          setBrandEditCountryIso('');
                          editForm.setFieldsValue({
                            name: record.companyName || (record.name ? record.name.replace(' Admin', '') : ''),
                            phone: record.phone,
                            packageName: record.packageName,
                            features: record.features || [],
                            integrations: effectiveIntegrations,
                            extraUsers: record.extraUsers || 0
                          });
                          setIsEditModalOpen(true);
                        }
                      },
                      {
                        key: 'suspend',
                        label: record.status === 'active' ? 'Suspend Agency' : 'Activate Agency',
                        icon: record.status === 'active' ? <Ban size={16} /> : <CheckCircle size={16} />,
                        onClick: () => handleSuspendBrand(record._id, record.status)
                      },
                      {
                        type: 'divider'
                      },
                      {
                        key: 'delete',
                        label: <span style={{ color: 'var(--accent-danger)' }}>Delete</span>,
                        icon: <Trash2 size={16} color="var(--accent-danger)" />,
                        onClick: () => {
                          Modal.confirm({
                            title: 'Are you sure you want to delete this brand?',
                            content: 'This action cannot be undone.',
                            okText: 'Yes, Delete',
                            okType: 'danger',
                            cancelText: 'Cancel',
                            onOk: () => handleDeleteBrand(record._id)
                          });
                        }
                      }
                    ];
                    return (
                      <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
                        <Button type="text" icon={<MoreVertical size={20} />} style={{ color: 'var(--text-secondary)' }} />
                      </Dropdown>
                    );
                  }
                }
              ]}
            />
          </Card>
        </motion.div>

      {/* Create Direct Brand Modal */}
      <Modal
        title={<span style={{ fontWeight: 800, fontSize: 18 }}>Create Direct Brand</span>}
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        width={480}
        destroyOnClose
      >
        <div style={{ maxHeight: '65vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: '12px' }}>
          <Form 
            form={form} 
          layout="vertical" 
          onFinish={handleCreateBrand} 
          style={{ marginTop: 24 }}
          onValuesChange={(changedValues) => {
             if (changedValues.packageName) {
               const pkg = packages.find(p => p.name === changedValues.packageName);
               if (pkg) {
                 form.setFieldsValue({ 
                   features: pkg.features || [],
                   integrations: pkg.integrations || [] 
                 });
               }
            }
          }}
        >
          <Form.Item name="name" label={<span><span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Brand Name</span></span>} rules={[{ required: true, message: 'Please enter brand name' }]}>
            <Input size="large" placeholder="e.g. Acme Corp" style={{ borderRadius: 8 }} />
          </Form.Item>
          
          <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid var(--border-color)' }}>
            <Title level={5} style={{ marginTop: 0, marginBottom: 16, fontWeight: 700 }}>Brand Super Admin User</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Create an initial super admin login account for this brand.</Text>
            
            <Form.Item name="email" label="Admin Email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
              <Input type="email" placeholder="admin@brand.com" />
            </Form.Item>
            
            <Form.Item 
              name="phone" 
              label="Phone Number"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    if (isValidPhoneNumber(value, brandCountryIso)) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Please enter a valid phone number for the selected country'));
                  }
                }
              ]}
            >
              <PhoneInput 
                countryCodeValue={brandCountryCode}
                onCountryCodeChange={setBrandCountryCode}
                isoCountryValue={brandCountryIso}
                onCountryIsoChange={setBrandCountryIso}
              />
            </Form.Item>
            
            <Form.Item name="password" label="Initial Password" rules={[{ required: true, message: 'Please enter a password' }]}>
              <Input.Password placeholder="Enter a secure password" />
            </Form.Item>
          </div>

          <Form.Item name="packageName" label={<span> <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Package Selection</span></span>} rules={[{ required: true, message: 'Please select a package' }]}>
            <Select size="large" placeholder="Select a package">
              {packages.map(pkg => (
                <Select.Option key={pkg.name} value={pkg.name}>{pkg.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <div style={{ marginTop: 24, marginBottom: 16 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 16 }}>Included Modules</span>
            <Form.Item name="features" valuePropName="value">
              <Checkbox.Group style={{ width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {availableFeatures.map(feat => (
                    <Checkbox key={feat.id} value={feat.id} style={{ fontWeight: 500 }}>
                      {feat.label}
                    </Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </Form.Item>
          </div>

          <div style={{ marginBottom: 24 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 16 }}>Integrations</span>
            <Form.Item name="integrations" valuePropName="value">
              <Checkbox.Group style={{ width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {DIRECT_BRAND_INTEGRATIONS.map(int => (
                    <Checkbox key={int.type} value={int.type} style={{ fontWeight: 500 }}>
                      {int.name}
                    </Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </Form.Item>
          </div>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block style={{ background: 'var(--accent-primary)', fontWeight: 700 }}>
              Create Brand
            </Button>
          </Form.Item>
        </Form>
        </div>
      </Modal>

      {/* Edit Direct Brand Modal */}
      <Modal
        title={<span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>Edit Direct Brand</span>}
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsEditModalOpen(false)} style={{ borderRadius: 8, fontWeight: 600 }}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" loading={loading} onClick={() => editForm.submit()} style={{ background: 'var(--accent-primary)', fontWeight: 600, borderRadius: 8 }}>
            Save Changes
          </Button>
        ]}
        width={550}
        destroyOnClose
        className="glassmorphism-modal"
      >
        <div style={{ maxHeight: '65vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: '12px' }}>
          <Form 
            form={editForm} 
          layout="vertical" 
          onFinish={handleEditBrand} 
          style={{ marginTop: 24 }}
          onValuesChange={(changedValues) => {
             if (changedValues.packageName) {
               const pkg = packages.find(p => p.name === changedValues.packageName);
               if (pkg) {
                 editForm.setFieldsValue({ 
                   features: pkg.features || [],
                   integrations: pkg.integrations || [] 
                 });
               }
            }
          }}
        >
          <Form.Item name="name" label={<span><span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Brand Name</span></span>} rules={[{ required: true, message: 'Please enter brand name' }]}>
            <Input size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item 
            name="phone" 
            label={<span><span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Phone Number</span></span>}
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (isValidPhoneNumber(value, brandEditCountryIso)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Please enter a valid phone number for the selected country'));
                }
              }
            ]}
          >
            <PhoneInput 
              countryCodeValue={brandEditCountryCode}
              onCountryCodeChange={setBrandEditCountryCode}
              isoCountryValue={brandEditCountryIso}
              onCountryIsoChange={setBrandEditCountryIso}
            />
          </Form.Item>

          <Form.Item name="packageName" label={<span><span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Package Selection</span></span>} rules={[{ required: true, message: 'Please select a package' }]}>
            <Select size="large" placeholder="Select a package">
              {packages.map(pkg => (
                <Select.Option key={pkg.name} value={pkg.name}>{pkg.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <div style={{ marginTop: 24, marginBottom: 16 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 16 }}>Included Modules</span>
            <Form.Item name="features" valuePropName="value">
              <Checkbox.Group style={{ width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {availableFeatures.map(feat => (
                    <Checkbox key={feat.id} value={feat.id} style={{ fontWeight: 500 }}>
                      {feat.label}
                    </Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </Form.Item>
          </div>

          <div style={{ marginBottom: 24 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 16 }}>Integrations</span>
            <Form.Item name="integrations" valuePropName="value">
              <Checkbox.Group style={{ width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {DIRECT_BRAND_INTEGRATIONS.map(int => (
                    <Checkbox key={int.type} value={int.type} style={{ fontWeight: 500 }}>
                      {int.name}
                    </Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </Form.Item>
          </div>

          <Form.Item name="extraUsers" label={<span><span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Extra Allowed Users</span></span>} tooltip="Additional users beyond the package limit">
            <InputNumber min={0} size="large" style={{ width: '100%', borderRadius: 8 }} />
          </Form.Item>
        </Form>
        </div>
      </Modal>

    </motion.div>
  );
};

export default PortalSettings;