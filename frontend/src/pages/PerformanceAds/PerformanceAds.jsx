import React, { useState, useEffect } from 'react'; 
import { Typography, Row, Col, Card, Button, Select, Table, Tag, Progress, Spin, message, Modal, Form, Input, Checkbox, Dropdown } from 'antd';
import { ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, PieChart, Pie, Cell, BarChart as RechartsBarChart } from 'recharts';
import { motion } from 'framer-motion';
import { RefreshCcw, Plus, ExternalLink, IndianRupee, Target, Users, Megaphone, Activity, CheckCircle2, Settings, LogOut, RefreshCw } from 'lucide-react';
import { performanceAdsApi } from '../../api/performanceAdsApi';
import api from '../../services/api';
import { useGetClientsQuery } from '../../api/clientApi';
import { useAuth } from '../../contexts/AuthContext';
import CampaignBuilderWizard from './CampaignBuilderWizard';

const { Title, Text } = Typography;
const { Option } = Select;

const PerformanceAds = () => {
  const { user } = useAuth();
  const [adminClients, setAdminClients] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isMetaConnected, setIsMetaConnected] = useState(false);
  const [metaIntegration, setMetaIntegration] = useState(null);
  const [adAccounts, setAdAccounts] = useState([]);

  const [isAdAccountModalOpen, setIsAdAccountModalOpen] = useState(false);
  const [availableAdAccounts, setAvailableAdAccounts] = useState([]);
  const [availablePages, setAvailablePages] = useState([]);
  const [availableBusinesses, setAvailableBusinesses] = useState([]);
  const [selectedAdAccountIds, setSelectedAdAccountIds] = useState([]);
  const [isFetchingAccounts, setIsFetchingAccounts] = useState(false);
  const [isSavingAccounts, setIsSavingAccounts] = useState(false);

  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedCampaignView, setSelectedCampaignView] = useState(null);
  const [form] = Form.useForm();
  const platformWatch = Form.useWatch('platform', form);

  // Fetch clients dynamically
  const { data: clientsData, isLoading: isLoadingClients } = useGetClientsQuery({});
  
  useEffect(() => {
    const fetchAdminClients = async () => {
      if (['commander_admin', 'supreme_super_admin'].includes(user?.role)) {
        try {
          const [agenciesRes, brandsRes] = await Promise.all([
            api.get('/agencies'),
            api.get('/brands') // returns direct brands for admin
          ]);
          const agencies = (agenciesRes.data.data || []).map(a => ({ ...a, clientType: 'Agency' }));
          const brands = (brandsRes.data.data || []).map(b => ({ ...b, clientType: 'Direct Brand' }));
          setAdminClients([...agencies, ...brands]);
          if ([...agencies, ...brands].length === 0) {
            setLoading(false);
          }
        } catch (error) {
          console.error("Failed to fetch admin clients", error);
          setLoading(false);
        }
      }
    };
    fetchAdminClients();
  }, [user]);

  useEffect(() => {
    // Handle OAuth redirect success/error and clean URL
    if (window.location.hash === '#_=_' || window.location.hash === '#') {
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
      message.success('Meta Ads account connected successfully!');
    }
    
    const searchParams = new URLSearchParams(window.location.search);
    const error = searchParams.get('meta_error');
    if (error) {
      message.error('Failed to connect Meta Ads. Please try again.');
      window.history.replaceState(null, document.title, window.location.pathname);
    }
  }, []);

  const isSuperAdmin = ['commander_admin', 'supreme_super_admin'].includes(user?.role);
  const clients = isSuperAdmin ? adminClients : (clientsData?.data || []);

  useEffect(() => {
    if (isSuperAdmin) {
      if (selectedClient) fetchDashboardData();
    } else {
      // Standard users do not need a selectedClient, just fetch
      if (user) fetchDashboardData();
    }
  }, [selectedClient, isSuperAdmin, user]);

  useEffect(() => {
    if (isSuperAdmin && clients.length > 0 && !selectedClient) {
      setSelectedClient(clients[0]._id);
    }
  }, [clients, selectedClient, isSuperAdmin]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await performanceAdsApi.getDashboardData(selectedClient);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setData(null);
      }

      // Check Meta Integration Status
      const intRes = await api.get('/integrations/meta/status', { params: { clientId: selectedClient } });
      const intData = intRes.data;
      if (intData.success && intData.isConnected && intData.data) {
        const metaInt = intData.data;
        setIsMetaConnected(true);
        setMetaIntegration(metaInt);
        const accounts = metaInt.config.selectedAdAccounts || [];
        setAdAccounts(accounts);
        
        if (accounts.length === 0) {
          setIsAdAccountModalOpen(true);
        }
      } else {
        setIsMetaConnected(false);
        setMetaIntegration(null);
        setAdAccounts([]);
      }
    } catch (error) {
      console.error('Failed to fetch performance ads data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdAccountModalOpen && availableAdAccounts.length === 0) {
      const fetchAccounts = async () => {
        setIsFetchingAccounts(true);
        try {
          const res = await api.get(`/integrations/meta/ad-accounts?clientId=${selectedClient}`);
          if (res.data.success) {
            if (res.data.data && res.data.data.adAccounts !== undefined) {
              setAvailableAdAccounts(res.data.data.adAccounts || []);
              setAvailablePages(res.data.data.pages || []);
              setAvailableBusinesses(res.data.data.businesses || []);
            } else {
              setAvailableAdAccounts(res.data.data || []);
              setAvailablePages([]);
              setAvailableBusinesses([]);
            }
            setSelectedAdAccountIds(adAccounts.map(a => a.id));
          } else {
            message.error('Failed to fetch ad accounts');
          }
        } catch (error) {
          console.error('Error fetching ad accounts:', error);
          message.error(error.response?.data?.message || 'Error fetching ad accounts');
        } finally {
          setIsFetchingAccounts(false);
        }
      };
      fetchAccounts();
    }
  }, [isAdAccountModalOpen, availableAdAccounts.length, selectedClient, adAccounts]);

  const handleSaveAdAccounts = async () => {
    if (selectedAdAccountIds.length === 0) {
      return message.warning('Please select at least one ad account');
    }
    const selectedAccounts = availableAdAccounts.filter(a => selectedAdAccountIds.includes(a.id)).map(a => ({ 
      id: a.id, 
      name: a.name, 
      balance: a.balance, 
      currency: a.currency, 
      account_status: a.account_status 
    }));
    setIsSavingAccounts(true);
    try {
      const res = await api.post(`/integrations/meta/ad-accounts?clientId=${selectedClient}`, { selectedAdAccounts: selectedAccounts });
      if (res.data.success) {
        message.success('Ad accounts saved successfully!');
        setAdAccounts(selectedAccounts);
        setIsAdAccountModalOpen(false);
        handleSync();
      }
    } catch (error) {
      message.error('Failed to save ad accounts');
    } finally {
      setIsSavingAccounts(false);
    }
  };



  const handleConnectMeta = async () => {
    try {
      if (!selectedClient) {
        return message.warning('Please select a client first');
      }
      const returnUrl = encodeURIComponent(window.location.pathname);
      const res = await api.get(`/integrations/meta/auth?returnUrl=${returnUrl}&clientId=${selectedClient}`);
      if (res.data.success && res.data.url) {
        window.location.href = res.data.url;
      } else {
        message.error('Failed to get Meta authorization URL');
      }
    } catch (error) {
      console.error('Error connecting Meta:', error);
      message.error(error.response?.data?.message || 'Failed to connect to Meta');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await performanceAdsApi.syncData(selectedClient);
      if (res.success) {
        setData(res.data);
        message.success('Performance data synchronized successfully!');
      }
    } catch (error) {
      console.error('Error syncing performance data:', error);
      message.error('Failed to sync performance data');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateCampaign = async (values) => {
    try {
      setIsCreatingCampaign(true);
      const payload = {
        ...values,
        targeting: { geo_locations: { countries: [values.targetCountry || 'IN'] } }
      };
      const res = await api.post(`/integrations/meta/campaigns?clientId=${selectedClient}`, payload);
      if (res.data.success) {
        message.success('Campaign created successfully on Meta!');
        setIsCampaignModalOpen(false);
        handleSync(); // Sync data to pull the newly created campaign
      } else {
        message.error('Failed to create campaign: ' + res.data.message);
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      message.error(error.response?.data?.message || 'Failed to create campaign');
    } finally {
      setIsCreatingCampaign(false);
    }
  };
  const handleDisconnectMeta = async () => {
    try {
      const endpoint = selectedClient ? `/integrations/meta?clientId=${selectedClient}` : `/integrations/meta`;
      const res = await api.delete(endpoint);
      if (res.data.success) {
        setIsMetaConnected(false);
        setMetaIntegration(null);
        setAdAccounts([]);
        message.success('Meta Ads disconnected successfully');
      }
    } catch (error) {
      message.error('Failed to disconnect Meta Ads');
    }
  };

  const metaMenu = (
    <div style={{ padding: 16, background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow-lg)', width: 320, border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1877F2', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff' }}>
          <CheckCircle2 size={24} />
        </div>
        <div>
          <Text strong style={{ display: 'block', fontSize: 16, color: 'var(--text-primary)' }}>Meta Ads Connected</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>ID: {metaIntegration?.config?.userId || 'N/A'}</Text>
        </div>
      </div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Connection Date</Text>
          <Text strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{new Date(metaIntegration?.createdAt).toLocaleDateString()}</Text>
        </div>
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Status</Text>
          <Tag color="success" style={{ margin: 0, borderRadius: 12 }}>Active</Tag>
        </div>
      </div>
      {adAccounts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Selected Accounts & Balance</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {adAccounts.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: 8 }}>
                <Text strong style={{ fontSize: 13 }}>{a.name}</Text>
                {a.balance !== undefined ? (
                  <Text type="success" strong style={{ fontSize: 13 }}>{(parseFloat(a.balance)/100).toFixed(2)} {a.currency}</Text>
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>Balance N/A</Text>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ borderTop: '1px solid var(--border-color)', margin: '16px -16px 12px -16px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Button block type="text" icon={<Settings size={16} />} style={{ textAlign: 'left', fontWeight: 500, color: 'var(--text-primary)', height: 36 }} onClick={() => setIsAdAccountModalOpen(true)}>Manage Ad Accounts</Button>
        <Button block type="text" icon={<RefreshCw size={16} />} style={{ textAlign: 'left', fontWeight: 500, color: 'var(--text-primary)', height: 36 }} onClick={handleConnectMeta}>Reconnect Account</Button>
        <Button block danger type="text" icon={<LogOut size={16} />} style={{ textAlign: 'left', fontWeight: 500, height: 36 }} onClick={handleDisconnectMeta}>Disconnect</Button>
      </div>
    </div>
  );

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  }

  // Use empty objects/arrays for data if null
  const dashboardData = data || {
    metrics: { adSpendMTD: 0, adSpendPercentage: 0, totalLeads: 0, leadsChange: '0%', costPerLead: 0, roas: 0, roasChange: '0', impressions: 0, clicks: 0, conversions: 0 },
    campaigns: [],
    dailyPerformance: [],
    spendByPlatform: [],
    cplByPlatform: []
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

  const campaignCols = [
    { title: 'CAMPAIGN', dataIndex: 'campaign', key: 'campaign', render: text => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
    {
      title: 'PLATFORM',
      dataIndex: 'platform',
      key: 'platform',
      render: text => {
        let color = text === 'Meta' ? 'var(--accent-info)' : text === 'Google' ? 'var(--accent-primary)' : 'var(--accent-danger)';
        return <Tag style={{ color, borderColor: color, background: 'transparent', borderRadius: 12, fontWeight: 600 }}>{text}</Tag>;
      }
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      render: text => {
        const isActive = text === 'Active' || text === 'ACTIVE';
        return <Tag style={{ borderRadius: 12, background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: isActive ? 'var(--accent-primary)' : 'var(--accent-warning)', border: 'none', fontWeight: 600 }}>{text}</Tag>
      }
    },
    { title: 'BUDGET', dataIndex: 'budget', key: 'budget', render: text => <span style={{ color: 'var(--text-secondary)' }}>{text}</span> },
    {
      title: 'SPEND',
      dataIndex: 'spend',
      key: 'spend',
      render: (text, record) => (
        <div style={{ minWidth: 100 }}>
          <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{text}</strong>
          <Progress percent={record.progress} showInfo={false} size="small" strokeColor={record.progress > 85 ? 'var(--accent-danger)' : 'var(--accent-secondary)'} trailColor="var(--border-color)" />
        </div>
      )
    },
    { title: 'LEADS', dataIndex: 'leads', key: 'leads', render: text => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
    { title: 'CPL', dataIndex: 'cpl', key: 'cpl', render: text => <span style={{ color: 'var(--text-secondary)' }}>{text}</span> },
    { title: 'ROAS', dataIndex: 'roas', key: 'roas', render: text => <span style={{ color: text.includes('x') ? 'var(--accent-primary)' : 'var(--text-tertiary)', fontWeight: text.includes('x') ? 700 : 400 }}>{text}</span> },
    { title: 'CTR', dataIndex: 'ctr', key: 'ctr', render: text => <span style={{ color: 'var(--text-secondary)' }}>{text}</span> },
    { 
      title: 'ACTIONS', 
      key: 'actions', 
      render: (_, record) => (
        <Button type="link" onClick={() => { setSelectedCampaignView(record); setIsViewModalOpen(true); }} style={{ color: 'var(--accent-secondary)', padding: 0, fontWeight: 600 }}>
          View
        </Button>
      ) 
    }
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>Performance Ads</Title>
          <Text type="secondary">Paid media across Meta, Google & YouTube — unified attribution.</Text>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Select 
              value={selectedClient} 
              onChange={(val) => setSelectedClient(val)}
              style={{ width: 220, height: 40 }} 
              options={clients.map(c => ({ 
                value: c._id, 
                label: c.clientType ? `${c.clientType}: ${c.name || c.companyName}` : `Client: ${c.name || c.companyName}` 
              }))} 
            />
            <Button onClick={handleSync} loading={syncing} icon={<RefreshCcw size={14} />} style={{ borderRadius: 8, height: 40, fontWeight: 600 }}>Sync data</Button>
            {!isMetaConnected ? (
              <Button type="primary" onClick={handleConnectMeta} style={{ borderRadius: 8, background: 'linear-gradient(135deg, #1877F2 0%, #0652C5 100%)', height: 40, fontWeight: 700, border: 'none', boxShadow: '0 4px 12px rgba(24, 119, 242, 0.3)', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.3s ease' }}>Connect Meta Ads</Button>
            ) : (
              <>
                <Dropdown dropdownRender={() => metaMenu} trigger={['click']} placement="bottomRight">
                  <Button style={{ borderRadius: 8, height: 40, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: '#1877F2', borderColor: '#1877F2' }}>
                    <CheckCircle2 size={16} /> Meta Connected
                  </Button>
                </Dropdown>
                {false && <Button type="primary" icon={<Plus size={16} />} onClick={() => setIsCampaignModalOpen(true)} style={{ borderRadius: 8, background: 'var(--accent-primary)', height: 40, fontWeight: 700, border: 'none', boxShadow: 'var(--shadow-md)' }}>New campaign</Button>}
              </>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24 }}>
          <Tag style={{ borderRadius: 4, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-primary)', border: 'none', fontWeight: 700, padding: '2px 8px' }}>PE</Tag>
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', cursor: 'pointer' }} className="hover-link">Viewing {clients.find(c => c._id === selectedClient)?.name || 'Client'} <ExternalLink size={14} style={{ marginLeft: 6, color: 'var(--text-tertiary)' }} /></Text>
        </div>
      </motion.div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'AD SPEND (MTD)', val: `₹${(dashboardData.metrics?.adSpendMTD / 100000).toFixed(2)}L`, isProgress: true, pct: dashboardData.metrics?.adSpendPercentage || 0, color: 'var(--accent-secondary)', icon: <IndianRupee size={16} /> },
          { label: 'TOTAL LEADS', val: dashboardData.metrics?.totalLeads || 0, sub: dashboardData.metrics?.leadsChange || '0%', subColor: 'var(--accent-primary)', desc: 'Across all platforms', color: 'var(--accent-primary)', icon: <Users size={16} /> },
          { label: 'COST PER LEAD', val: `₹${dashboardData.metrics?.costPerLead || 0}`, subColor: 'var(--accent-danger)', desc: 'Target ₹5,500', color: 'var(--accent-danger)', icon: <Target size={16} /> },
          { label: 'ROAS', val: `${dashboardData.metrics?.roas || 0}x`, sub: dashboardData.metrics?.roasChange || '0', subColor: 'var(--accent-primary)', desc: 'Target 3.5x', color: 'var(--accent-warning)', icon: <Activity size={16} /> },
          { label: 'IMPRESSIONS', val: `${((dashboardData.metrics?.impressions || 0) / 1000000).toFixed(1)}M`, sub: dashboardData.metrics?.impressionsChange || '0%', subColor: 'var(--accent-primary)', desc: 'Last 30 days', color: 'var(--accent-info)', icon: <Megaphone size={16} /> },
        ].map((kpi, i) => (
          <Col style={{ flex: '1 1 200px', minWidth: 200 }} key={i}>
            <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: '100%' }}>
              <Card
                bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
                style={{
                  borderRadius: 16,
                  height: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-sm)',
                  overflow: 'hidden'
                }}
              >
                <div style={{ background: kpi.color, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: 'var(--bg-primary)', textTransform: 'uppercase' }}>{kpi.label}</Text>
                  <div style={{ color: 'var(--bg-primary)', opacity: 0.9 }}>{kpi.icon}</div>
                </div>
                <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <Title level={2} style={{ margin: 0, color: 'var(--text-primary)', fontSize: 36, fontWeight: 800 }}>{kpi.val}</Title>
                    <Text style={{ fontSize: 13, fontWeight: 600, color: kpi.subColor || 'var(--text-secondary)' }}>{kpi.sub}</Text>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                    {kpi.isProgress ? (
                      <div>
                        <Progress percent={kpi.pct} showInfo={false} size="small" strokeColor={kpi.color} trailColor="var(--border-color)" />
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, marginTop: 4, display: 'block' }}>{kpi.pct}% used</Text>
                      </div>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', fontWeight: 500 }}>{kpi.desc}</Text>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>

      <motion.div variants={itemVariants}>
        <Card
          title={<div style={{ paddingTop: 8 }}><Title level={5} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Active campaigns</Title></div>}
          extra={<Button style={{ borderRadius: 8, borderColor: 'var(--border-color)', color: 'var(--text-primary)', fontWeight: 500 }}>All campaigns</Button>}
          className="glassmorphism" style={{ borderRadius: 16, marginBottom: 24, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: 0 }}
        >
          <Table columns={campaignCols} dataSource={dashboardData.activeCampaigns || []} pagination={false} rowKey="id" size="middle" scroll={{ x: 1000 }} rowClassName={() => 'hover-bg'} />
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card
          title={<div style={{ paddingTop: 8 }}><Title level={5} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Daily performance</Title><Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Last 30 days - leads, spend & ROAS</Text></div>}
          className="glassmorphism" style={{ borderRadius: 16, marginBottom: 24, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: '24px 24px 12px' }}
        >
          <div style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dashboardData.dailyPerformance || []} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="day" stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} dy={10} />
                <YAxis yAxisId="left" stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} dx={-10} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} dx={10} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, boxShadow: 'var(--shadow-md)', fontWeight: 600 }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 20 }} />
                <Area yAxisId="left" type="monotone" dataKey="leads" fill="var(--accent-primary)" fillOpacity={0.15} stroke="var(--accent-primary)" strokeWidth={2} name="Leads" />
                <Line yAxisId="right" type="monotone" dataKey="spend" stroke="var(--accent-info)" strokeWidth={3} dot={false} name="Spend" activeDot={{ r: 6, strokeWidth: 0 }} />
                <Line yAxisId="left" type="monotone" dataKey="roas" stroke="var(--accent-danger)" strokeWidth={3} dot={false} name="ROAS" activeDot={{ r: 6, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </motion.div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <motion.div variants={itemVariants} style={{ height: '100%' }}>
            <Card
              title={<div style={{ paddingTop: 8 }}><Title level={5} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Spend by platform</Title><Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Distribution this month</Text></div>}
              className="glassmorphism" style={{ borderRadius: 16, height: '100%', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: 24 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', height: 280, flexWrap: 'wrap' }}>
                <ResponsiveContainer width="50%" height="100%" minWidth={200}>
                  <PieChart>
                    <Pie data={dashboardData.spendByPlatform || []} innerRadius={70} outerRadius={100} paddingAngle={6} dataKey="value" stroke="none">
                      {(dashboardData.spendByPlatform || []).map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, boxShadow: 'var(--shadow-md)', fontWeight: 600 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 200 }}>
                  {(dashboardData.spendByPlatform || []).map((entry) => (
                    <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, color: 'var(--text-primary)' }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: entry.fill }} /> {entry.name}</span>
                      <Text type="secondary" style={{ fontWeight: 500 }}>{entry.formattedValue}</Text>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} lg={12}>
          <motion.div variants={itemVariants} style={{ height: '100%' }}>
            <Card
              title={<div style={{ paddingTop: 8 }}><Title level={5} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>CPL by platform</Title><Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Target ₹5,500</Text></div>}
              className="glassmorphism" style={{ borderRadius: 16, height: '100%', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: 24 }}
            >
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={dashboardData.cplByPlatform || []} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="name" stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} dy={10} />
                    <YAxis stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} dx={-10} />
                    <Tooltip cursor={{ fill: 'var(--bg-tertiary)', opacity: 0.5 }} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, boxShadow: 'var(--shadow-md)', fontWeight: 600 }} />
                    <Bar dataKey="cpl" radius={[6, 6, 0, 0]} maxBarSize={70}>
                      {(dashboardData.cplByPlatform || []).map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
              <Text style={{ fontSize: 13, display: 'block', textAlign: 'center', color: 'var(--accent-secondary)', fontWeight: 600, marginTop: 16 }}>Meta is most efficient</Text>
            </Card>
          </motion.div>
        </Col>
      </Row>

      <CampaignBuilderWizard 
        open={isCampaignModalOpen} 
        onCancel={() => setIsCampaignModalOpen(false)} 
        onSuccess={handleCreateCampaign} 
        adAccounts={adAccounts} 
      />

      <Modal
        title="Meta Connection Details"
        open={isAdAccountModalOpen}
        onCancel={() => setIsAdAccountModalOpen(false)}
        onOk={handleSaveAdAccounts}
        confirmLoading={isSavingAccounts}
        okText="Save Ad Accounts"
        width={500}
      >
        {isFetchingAccounts ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 8 }}>
            
            {/* Pages Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CheckCircle2 size={16} color="var(--accent-primary)" />
                <Text strong style={{ fontSize: 14 }}>Connected Pages</Text>
              </div>
              {availablePages.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  {availablePages.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong>{p.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{p.id}</Text>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="secondary" style={{ fontSize: 13 }}>No pages linked during Facebook OAuth.</Text>
              )}
            </div>

            {/* Businesses Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CheckCircle2 size={16} color="var(--accent-info)" />
                <Text strong style={{ fontSize: 14 }}>Connected Businesses</Text>
              </div>
              {availableBusinesses.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  {availableBusinesses.map(b => (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong>{b.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{b.id}</Text>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="secondary" style={{ fontSize: 13 }}>No businesses linked during Facebook OAuth.</Text>
              )}
            </div>

            {/* Ad Accounts Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Megaphone size={16} color="var(--accent-warning)" />
                <Text strong style={{ fontSize: 14 }}>Select Ad Accounts to Sync</Text>
              </div>
              {availableAdAccounts.length > 0 ? (
                <Checkbox.Group
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                  value={selectedAdAccountIds}
                  onChange={(checkedValues) => setSelectedAdAccountIds(checkedValues)}
                >
                  {availableAdAccounts.map(account => (
                    <div key={account.id} style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                      <Checkbox value={account.id} style={{ width: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Text strong>{account.name}</Text>
                            {account.business_name && <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>{account.business_name}</Tag>}
                          </div>
                          <Text type="secondary" style={{ fontSize: 12 }}>ID: {account.id}</Text>
                        </div>
                      </Checkbox>
                    </div>
                  ))}
                </Checkbox.Group>
              ) : (
                <Text type="secondary" style={{ fontSize: 13 }}>No Ad Accounts found in your profile or connected businesses.</Text>
              )}
            </div>
            
          </div>
        )}
      </Modal>

      <Modal
        title="Campaign Details"
        open={isViewModalOpen}
        onCancel={() => { setIsViewModalOpen(false); setSelectedCampaignView(null); }}
        footer={[
          <Button key="close" onClick={() => { setIsViewModalOpen(false); setSelectedCampaignView(null); }}>Close</Button>
        ]}
        width={700}
      >
        {selectedCampaignView && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <Title level={4}>{selectedCampaignView.campaign}</Title>
              <div style={{ display: 'flex', gap: 12 }}>
                <Tag color="blue">{selectedCampaignView.platform}</Tag>
                <Tag color={selectedCampaignView.status === 'ACTIVE' || selectedCampaignView.status === 'Active' ? 'green' : 'orange'}>
                  {selectedCampaignView.status}
                </Tag>
              </div>
            </div>
            
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Card size="small">
                  <Text type="secondary">Spend</Text>
                  <Title level={4} style={{ margin: 0 }}>₹{selectedCampaignView.spend}</Title>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Text type="secondary">Leads</Text>
                  <Title level={4} style={{ margin: 0 }}>{selectedCampaignView.leads}</Title>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Text type="secondary">CPL</Text>
                  <Title level={4} style={{ margin: 0 }}>₹{selectedCampaignView.cpl}</Title>
                </Card>
              </Col>
            </Row>

            <Title level={5}>Ad Sets</Title>
            {selectedCampaignView.adSets && selectedCampaignView.adSets.length > 0 ? (
              <Table 
                dataSource={selectedCampaignView.adSets} 
                pagination={false} 
                rowKey="id"
                size="small"
                columns={[
                  { title: 'Ad Set Name', dataIndex: 'name', key: 'name' },
                  { title: 'Status', dataIndex: 'status', key: 'status', render: text => <Tag>{text}</Tag> },
                  { title: 'Budget', dataIndex: 'budget', key: 'budget', render: text => `₹${text}` },
                ]}
              />
            ) : (
              <Text type="secondary">No Ad Sets found.</Text>
            )}
          </div>
        )}
      </Modal>
    </motion.div>
  );
};

export default PerformanceAds;
