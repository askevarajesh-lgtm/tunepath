import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Button, Table, Modal, Input, Switch, Tag, message, Descriptions, Select } from 'antd';
import { Plus, Edit, Trash2, Eye, Star, Users, Briefcase, Check } from 'lucide-react';
import api from '../../../services/api';

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



// Mirrors the feature-gating already used on the Integrations page
// (Ekta card only shown for hrms feature, Lead Management/website card
// only shown for crm feature). Turning ON the linked feature here
// auto-enables the corresponding integration toggle.
const FEATURE_INTEGRATION_AUTO_MAP = {
  hrms: 'ekta',
  crm: 'website',
};

const DirectPackagesTab = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingPkg, setViewingPkg] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    users: '',
    billingInterval: 'Monthly',
    features: [],
    integrations: []
  });

  const availableIntegrations = [
    { type: 'whatsapp', name: 'WhatsApp' },
    { type: 'sms', name: 'SMS' },
    { type: 'email', name: 'Email (SendPulse)' },
    { type: 'website', name: 'Lead Management Integration' },
    { type: 'ekta', name: 'Ekta HR Integration' },
  ];

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const res = await api.get('/packages?type=directClient');
      setPackages(res.data.data);
    } catch (error) {
      message.error('Failed to fetch direct packages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleOpenModal = (pkg = null) => {
    if (pkg) {
      setEditingPkg(pkg);
      setFormData({
        name: pkg.name,
        description: pkg.description || '',
        price: pkg.price || '',
        users: pkg.userCount || '', // API response comes with userCount
        billingInterval: pkg.billingInterval || 'Monthly',
        features: pkg.features || [],
        integrations: pkg.integrations || []
      });
    } else {
      setEditingPkg(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        users: '',
        billingInterval: 'Monthly',
        features: [],
        integrations: []
      });
    }
    setIsModalOpen(true);
  };

  const handleView = (pkg) => {
    setViewingPkg(pkg);
    setIsViewModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.users) {
      message.error("Package Name, Price, and Users are required fields");
      return;
    }

    // Adapt to our backend model
    const payload = {
      name: formData.name,
      description: formData.description,
      price: formData.price,
      userCount: Number(formData.users),
      billingInterval: formData.billingInterval,
      features: formData.features,
      integrations: formData.integrations
    };

    try {
      if (editingPkg) {
        await api.put(`/packages/${editingPkg._id}`, payload);
        message.success("Package updated successfully");
      } else {
        await api.post('/packages', { ...payload, type: 'directClient' });
        message.success("Package created successfully");
      }
      setIsModalOpen(false);
      fetchPackages();
    } catch (error) {
      message.error("Failed to save package");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/packages/${id}`);
      message.success("Package deleted successfully");
      fetchPackages();
    } catch (error) {
      message.error("Failed to delete package");
    }
  };

  const toggleFeature = (featureId, checked) => {
    setFormData(prev => {
      const nextFeatures = checked
        ? [...prev.features, featureId]
        : prev.features.filter(f => f !== featureId);

      let nextIntegrations = prev.integrations;
      const linkedIntegration = FEATURE_INTEGRATION_AUTO_MAP[featureId];
      const existsInDb = linkedIntegration && availableIntegrations.some(i => i.type === linkedIntegration);
      if (linkedIntegration && existsInDb) {
        if (checked && !prev.integrations.includes(linkedIntegration)) {
          nextIntegrations = [...prev.integrations, linkedIntegration];
        } else if (!checked && prev.integrations.includes(linkedIntegration)) {
          nextIntegrations = prev.integrations.filter(i => i !== linkedIntegration);
        }
      }

      return { ...prev, features: nextFeatures, integrations: nextIntegrations };
    });
  };

  const toggleIntegration = (integrationType, checked) => {
    setFormData(prev => ({
      ...prev,
      integrations: checked
        ? [...prev.integrations, integrationType]
        : prev.integrations.filter(t => t !== integrationType)
    }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 800 }}>Direct Brand Packages</Title>
          <Text type="secondary">Define feature tiers and pricing for your direct brand accounts.</Text>
        </div>
        <Button 
          type="primary" 
          icon={<Plus size={16} />} 
          style={{ background: 'var(--accent-primary)', fontWeight: 700, borderRadius: 8, height: 40 }}
          onClick={() => handleOpenModal()}
        >
          Create Package
        </Button>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
        gap: '24px' 
      }}>
        {packages.map((pkg, index) => {
          const colors = [
            'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
          ];
          const bg = colors[index % colors.length];

          return (
          <div key={pkg._id} style={{
            background: 'var(--bg-secondary)',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
            transition: 'transform 0.2s ease',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          >
            {/* Top Color Block */}
            <div style={{
              background: bg,
              padding: '32px 24px',
              color: '#fff',
              position: 'relative',
              textAlign: 'center'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'rgba(255,255,255,0.9)'
                }}>
                  {pkg.name}
                </div>

              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                <span style={{ fontSize: '56px', fontWeight: 800, lineHeight: 1, letterSpacing: '-2px', textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                  {pkg.price ? (isNaN(pkg.price) ? pkg.price : `₹${pkg.price}`) : 'Custom'}
                </span>
              </div>
              
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                PER {pkg.billingInterval === 'Yearly' ? 'YEAR' : pkg.billingInterval === 'One Time' ? 'LIFETIME' : 'MONTH'}
              </div>

              <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: '4px' }}>
                 <Button 
                   type="text" 
                   size="small" 
                   icon={<Edit size={14} color="#fff" />} 
                   onClick={() => {
                     if (pkg.isAssigned) {
                       message.error("This package has already been assigned and cannot be modified or deleted.");
                     } else {
                       handleOpenModal(pkg);
                     }
                   }} 
                   style={{ minWidth: 'auto', padding: 4, background: 'rgba(255,255,255,0.2)' }} 
                 />
                 <Button 
                   type="text" 
                   size="small" 
                   icon={<Trash2 size={14} color="#fff" />} 
                   onClick={() => {
                     if (pkg.isAssigned) {
                       message.error("This package has already been assigned and cannot be modified or deleted.");
                     } else {
                       handleDelete(pkg._id);
                     }
                   }} 
                   style={{ minWidth: 'auto', padding: 4, background: 'rgba(255,255,255,0.2)' }} 
                 />
              </div>
            </div>

            {/* Bottom Features Block */}
            <div style={{ padding: '32px 24px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginBottom: '32px' }}>
                <div style={{
                   background: 'var(--bg-primary)',
                   border: '1px solid var(--border-color)',
                   padding: '6px 14px',
                   borderRadius: '20px',
                   fontSize: '13px',
                   color: 'var(--text-secondary)',
                   fontWeight: 500,
                   boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}>
                  Up to {pkg.userCount || 5} Team Members
                </div>
                
                {availableFeatures.map(feat => {
                  const isIncluded = pkg.features?.includes(feat.id);
                  if (!isIncluded) return null;
                  return (
                    <div key={feat.id} style={{
                       background: 'var(--bg-primary)',
                       border: '1px solid var(--border-color)',
                       padding: '6px 14px',
                       borderRadius: '20px',
                       fontSize: '13px',
                       color: 'var(--text-secondary)',
                       fontWeight: 500,
                       boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                      {feat.label}
                    </div>
                  );
                })}
              </div>
              
              <Button 
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '24px',
                  background: bg,
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.1)'
                }}
                onClick={() => handleView(pkg)}
              >
                View Details <span style={{ fontSize: '18px' }}>→</span>
              </Button>
              
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>
                {pkg.description || 'Flexible billing options available'}
              </div>
            </div>
          </div>
          );
        })}
        {packages.length === 0 && !loading && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '64px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
            <Text type="secondary">No packages found. Create one to get started.</Text>
          </div>
        )}
      </div>

      <Modal
        title={editingPkg ? "Edit Package" : "Create New Package"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSave}
        okText="Save Package"
        okButtonProps={{ style: { background: 'var(--accent-primary)' } }}
        width={700}
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
        style={{ top: 20 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16, paddingRight: 8 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Package Name <span style={{color: 'red'}}>*</span></label>
            <Input 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="e.g., VIP Tier" 
              size="large"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Description</label>
            <Input.TextArea 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              placeholder="Brief description of this tier" 
              rows={2}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Price <span style={{ color: 'red' }}>*</span></label>
              <Input
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: e.target.value })}
                placeholder="e.g., ₹5.0L"
                size="large"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Billing Interval <span style={{ color: 'red' }}>*</span></label>
              <Select
                value={formData.billingInterval}
                onChange={value => setFormData({ ...formData, billingInterval: value })}
                size="large"
                style={{ width: '100%' }}
                options={[
                  { value: 'Monthly', label: 'Monthly' },
                  { value: 'Yearly', label: 'Yearly' },
                  { value: 'One Time', label: 'One Time' },
                ]}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ marginBottom: 24 }}>
              <Text style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Users - Count <span style={{color: '#ef4444'}}>*</span></Text>
              <Input 
                placeholder="e.g., 5" 
                value={formData.users} 
                onChange={(e) => setFormData({...formData, users: e.target.value})} 
                style={{ borderRadius: 8, padding: '8px 12px' }}
              />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'block', marginBottom: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Included Features</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {availableFeatures.map(feat => (
                <div key={feat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '10px 16px', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{feat.label}</span>
                  <Switch 
                    size="small" 
                    checked={formData.features.includes(feat.id)} 
                    onChange={(checked) => toggleFeature(feat.id, checked)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'block', marginBottom: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Integrations</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {availableIntegrations.map(integration => {
                const autoLinkedFeature = Object.entries(FEATURE_INTEGRATION_AUTO_MAP)
                  .find(([, linkedType]) => linkedType === integration.type)?.[0];
                const autoLinkedFeatureLabel = availableFeatures.find(f => f.id === autoLinkedFeature)?.label;
                return (
                  <div key={integration.type} style={{ display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--bg-tertiary)', padding: '10px 16px', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{integration.name}</span>
                      <Switch
                        size="small"
                        checked={formData.integrations.includes(integration.type)}
                        onChange={(checked) => toggleIntegration(integration.type, checked)}
                      />
                    </div>
                    {autoLinkedFeatureLabel && (
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Auto-enabled when {autoLinkedFeatureLabel} is included
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title={null}
        footer={null}
        open={isViewModalOpen}
        onCancel={() => setIsViewModalOpen(false)}
        width={650}
        bodyStyle={{ padding: 0, borderRadius: 16, overflow: 'hidden' }}
        style={{ top: 20 }}
        closeIcon={<span style={{ color: '#fff', fontSize: 20 }}>×</span>}
      >
        {viewingPkg && (
          <div>
            <div style={{ 
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)', 
              padding: '32px 24px',
              color: '#fff',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ 
                  width: 64, height: 64, borderRadius: 16, 
                  background: 'rgba(255,255,255,0.2)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)'
                }}>
                  <Star size={32} color="#fff" />
                </div>
                <div>
                  <Title level={3} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>{viewingPkg.name}</Title>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{viewingPkg.description || 'No description provided'}</Text>
                </div>
              </div>
            </div>

            <div style={{ padding: '24px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <div style={{ 
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 
              }}>
                <div style={{ padding: 16, background: 'var(--bg-tertiary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>PRICE ({viewingPkg.billingInterval || 'Monthly'})</Text>
                  <Text style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{viewingPkg.price || 'Custom'}</Text>
                </div>
                <div style={{ padding: 16, background: 'var(--bg-tertiary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Users size={14} color="var(--text-secondary)" />
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>USERS</Text>
                  </div>
                  <Text style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    <span style={{ fontWeight: 600 }}>{viewingPkg?.userCount || viewingPkg?.users || '-'}</span>
                  </Text>
                </div>
              </div>

              <div>
                <Title level={5} style={{ marginBottom: 16, fontWeight: 700 }}>Included Features</Title>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {availableFeatures.map(feat => {
                    const isIncluded = viewingPkg.features?.includes(feat.id);
                    return (
                      <div 
                        key={feat.id} 
                        style={{ 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                          background: isIncluded ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-tertiary)', 
                          padding: '12px 16px', 
                          borderRadius: 8,
                          border: isIncluded ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--border-color)',
                          opacity: isIncluded ? 1 : 0.6
                        }}
                      >
                        <span style={{ 
                          fontSize: 13, 
                          fontWeight: 600, 
                          color: isIncluded ? 'var(--text-primary)' : 'var(--text-secondary)' 
                        }}>
                          {feat.label}
                        </span>
                        {isIncluded ? (
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                        ) : (
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-color)' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {viewingPkg.integrations && viewingPkg.integrations.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <Title level={5} style={{ marginBottom: 16, fontWeight: 700 }}>Integrations</Title>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {viewingPkg.integrations.map(type => {
                      const matched = availableIntegrations.find(i => i.type === type);
                      return (
                        <div
                          key={type}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'rgba(16, 185, 129, 0.05)',
                            padding: '12px 16px',
                            borderRadius: 8,
                            border: '1px solid rgba(16, 185, 129, 0.2)'
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {matched?.name || type}
                          </span>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                <Button onClick={() => setIsViewModalOpen(false)} style={{ borderRadius: 8, fontWeight: 600 }}>
                  Close Details
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DirectPackagesTab;