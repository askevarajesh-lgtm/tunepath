import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Switch, Button, Tag, Avatar, message } from 'antd';
import { motion } from 'framer-motion';
import { Search, MessageSquare, Smartphone, Mail, Phone, Globe, MonitorPlay, Users, CreditCard, UserPlus } from 'lucide-react';
import api from '../../services/api';

const { Title, Text } = Typography;

const ALL_INTEGRATIONS = [
  {
    type: 'whatsapp',
    name: 'WhatsApp',
    category: 'Communication',
    description: 'Send invoices, reminders, and notifications via WhatsApp Business API',
    icon: <MessageSquare size={24} />,
    bg: '#25D366',
    color: '#fff'
  },
  {
    type: 'sms',
    name: 'SMS',
    category: 'Communication',
    description: 'Send SMS notifications and payment reminders to clients',
    icon: <Smartphone size={24} />,
    bg: '#4A90E2',
    color: '#fff'
  },
  {
    type: 'email',
    name: 'Email (SendPulse)',
    category: 'Communication',
    description: 'Send invoices, reports, and notifications via SendPulse email service',
    icon: <Mail size={24} />,
    bg: '#FF6B6B',
    color: '#fff'
  },
  {
    type: 'ivr',
    name: 'IVR Integration',
    category: 'Communication',
    description: 'Cloud telephony and IVR services setup for voice calls',
    icon: <Phone size={24} />,
    bg: '#F39C12',
    color: '#fff'
  },
  {
    type: 'website',
    name: 'Lead Management Integration',
    category: 'Marketing',
    description: 'Configure and manage lead integrations from Website forms and WhatsApp',
    icon: <Globe size={24} />,
    bg: '#34495E',
    color: '#fff'
  },
  {
    type: 'meta_ads',
    name: 'Meta Ads Integration',
    category: 'Marketing',
    description: 'Connect and manage Meta (Facebook/Instagram) ad campaigns',
    icon: <MonitorPlay size={24} />,
    bg: '#1877F2',
    color: '#fff'
  },
  {
    type: 'facebook_leads',
    name: 'Facebook Leads',
    category: 'Marketing',
    description: 'Sync leads directly from Facebook Lead Ads to your CRM',
    icon: <Users size={24} />,
    bg: '#1877F2',
    color: '#fff'
  },
  {
    type: 'payment',
    name: 'Payment Integration',
    category: 'Finance',
    description: 'Configure QR codes and payment links for your organization',
    icon: <CreditCard size={24} />,
    bg: '#2ECC71',
    color: '#fff'
  },
  {
    type: 'ekta',
    name: 'Ekta HR Integration',
    category: 'HR Management',
    description: 'Sync employee data and attendance info with Ekta HR management system',
    icon: <UserPlus size={24} />,
    bg: '#9B59B6',
    color: '#fff'
  },
  {
    type: 'ivr',
    name: 'Sollu IVR / Telephony',
    category: 'Communication',
    description: 'Outbound cloud telephony and IVR for lead dialing and recordings',
    icon: <Phone size={24} />,
    bg: '#10B981',
    color: '#fff'
  }
];

const Integrations = () => {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/integrations');
      setIntegrations(res.data.data?.integrations || res.data.data || []);
    } catch (error) {
      message.error('Failed to fetch integrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleToggleStatus = async (integrationObj, currentStatus) => {
    try {
      let url = `/integrations`;
      let method = 'post';
      let payload = { 
        type: integrationObj.type, 
        name: integrationObj.name, 
        isActive: !currentStatus 
      };

      if (integrationObj._id && !integrationObj._id.startsWith('dummy')) {
        url = `/integrations/${integrationObj._id}`;
        method = 'put';
        payload = { isActive: !currentStatus };
      }

      await api[method](url, payload);
      message.success(`Integration ${!currentStatus ? 'enabled' : 'disabled'}`);
      fetchIntegrations();
    } catch (error) {
      message.error('Failed to update integration status');
    }
  };

  // Merge default integrations with database integrations
  const mergedIntegrations = ALL_INTEGRATIONS.map(defaultInt => {
    const dbInt = integrations.find(i => i.type === defaultInt.type);
    return {
      ...defaultInt,
      ...dbInt, // overwrite defaults if it exists in db
      _id: dbInt?._id || `dummy-${defaultInt.type}`,
      isActive: dbInt ? (dbInt.isActive || dbInt.status) : false,
      name: dbInt?.name || defaultInt.name,
      category: defaultInt.category, // always use default category
      description: dbInt?.description || defaultInt.description,
      icon: defaultInt.icon,
      bg: defaultInt.bg,
      color: defaultInt.color
    };
  });

  // Group by category
  const categoriesMap = mergedIntegrations.reduce((acc, integration) => {
    if (!acc[integration.category]) {
      acc[integration.category] = [];
    }
    acc[integration.category].push(integration);
    return acc;
  }, {});

  const integrationCategories = Object.keys(categoriesMap).map(category => ({
    category,
    items: categoriesMap[category]
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800, color: 'var(--text-primary)' }}>
            Global Integrations
          </Title>
          <Text type="secondary" style={{ fontSize: 16 }}>
            Manage platform-wide API keys, third-party services, and core infrastructure integrations.
          </Text>
        </div>
        <Button 
          type="primary" 
          icon={<Search size={18} />} 
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', height: 44, borderRadius: 8, fontWeight: 600 }}
        >
          Browse App Directory
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {integrationCategories.length === 0 && !loading && (
          <Text type="secondary">No integrations found.</Text>
        )}
        
        {integrationCategories.map((categoryGroup, idx) => (
          <div key={idx}>
            <Title level={4} style={{ marginBottom: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{categoryGroup.category}</Title>
            <Row gutter={[24, 24]}>
              {categoryGroup.items.map((integration, index) => (
                <Col xs={24} md={12} xl={8} key={integration._id || index}>
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (idx * 0.1) + (index * 0.05) }}>
                    <Card 
                      className="glassmorphism hover-lift"
                      style={{ 
                        borderRadius: 16, 
                        border: integration.isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)', 
                        background: 'var(--bg-secondary)',
                      }}
                      bodyStyle={{ padding: 24 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div style={{ display: 'flex', gap: 16 }}>
                          <Avatar 
                            size={48} 
                            style={{ 
                              background: integration.bg || '#ccc', 
                              color: integration.color || '#fff',
                              fontWeight: 800,
                              fontSize: 20,
                              borderRadius: 12
                            }}
                          >
                            {integration.icon || integration.name.charAt(0)}
                          </Avatar>
                          <div>
                            <Text style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                              {integration.name}
                            </Text>
                            <Tag color={integration.isActive ? 'green' : 'default'} style={{ borderRadius: 12 }}>
                              {integration.isActive ? 'Connected' : 'Disconnected'}
                            </Tag>
                          </div>
                        </div>
                        <Switch 
                          checked={integration.isActive} 
                          onChange={() => handleToggleStatus(integration, integration.isActive)}
                        />
                      </div>
                      
                      <Text type="secondary" style={{ display: 'block', marginBottom: 24, fontSize: 14, minHeight: 44 }}>
                        {integration.description}
                      </Text>
                    </Card>
                  </motion.div>
                </Col>
              ))}
            </Row>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Integrations;

