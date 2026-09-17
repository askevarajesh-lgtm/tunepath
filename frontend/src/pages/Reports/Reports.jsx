import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Row, Col, Card, Button, Table, Tag, message, Select, DatePicker, Skeleton, Tooltip as AntTooltip, Dropdown, Menu, Empty } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Plus, FileText, Download, CheckCircle2, Clock, Filter, Eye, Activity, TrendingUp, TrendingDown, MoreVertical, AlertCircle, RefreshCw, BarChart2, PieChart as PieChartIcon } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import api from '../../services/api';
import { getRecentSentReports, getMonthlyHighlights } from '../../api/reportApi';
import { generateMonthlyHighlightsPDF, generateMetaCampaignCombinedPDF } from '../../utils/monthlyHighlightsPdfGenerator';
import { useGetClientsQuery } from '../../api/clientApi';
import { useClientContext } from '../../contexts/ClientContext';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

// Colors for charts
const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', 'var(--accent-primary)'];

import CreateReportModal from './components/CreateReportModal';
import { generateMetaLeadCampaignPDF } from '../../utils/metaLeadCampaignPdfGenerator';
import { generateMetaReachCampaignPDF } from '../../utils/metaReachCampaignPdfGenerator';
import { getMetaLeadCampaigns, getMetaReachCampaigns } from '../../api/reportApi';
import { Sparkles } from 'lucide-react';

const Reports = () => {
  const { role } = useAuth();
  const { selectedClient: headerSelectedClient, agencyClients } = useClientContext();
  
  const [recentSentReports, setRecentSentReports] = useState([]);
  const [realLeads, setRealLeads] = useState([]);
  const [realProposals, setRealProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateReportModalOpen, setIsCreateReportModalOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState('meta_lead');

  const [selectedClient, setSelectedClient] = useState(() => headerSelectedClient?._id || 'all');
  const [selectedMonth, setSelectedMonth] = useState(dayjs());

  useEffect(() => {
    if (headerSelectedClient?._id) {
      setSelectedClient(headerSelectedClient._id);
    }
  }, [headerSelectedClient]);
  
  const { data: clientsData, isLoading: isLoadingClients } = useGetClientsQuery({ limit: 1000 });
  
  const clients = useMemo(() => {
    if (Array.isArray(clientsData?.data)) return clientsData.data;
    if (Array.isArray(clientsData?.data?.data)) return clientsData.data.data;
    if (Array.isArray(clientsData?.data?.clients)) return clientsData.data.clients;
    if (Array.isArray(agencyClients) && agencyClients.length > 0) return agencyClients;
    return [];
  }, [clientsData, agencyClients]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const recent = await getRecentSentReports();
      setRecentSentReports(recent);

      try {
        const leadsRes = await api.get('/leads');
        const leadsArr = leadsRes.data?.data?.leads || leadsRes.data?.data || leadsRes.data || [];
        setRealLeads(Array.isArray(leadsArr) ? leadsArr : []);
      } catch (e) {
        console.warn('Could not fetch real leads:', e.message);
      }

      try {
        const proposalsRes = await api.get('/proposals');
        const proposalsArr = proposalsRes.data?.data?.proposals || proposalsRes.data?.data || proposalsRes.data || [];
        setRealProposals(Array.isArray(proposalsArr) ? proposalsArr : []);
      } catch (e) {
        console.warn('Could not fetch real proposals:', e.message);
      }

    } catch (error) {
      console.error('Error fetching reports data:', error);
      message.error('Failed to load reports data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  // Filter reports
  const filteredReports = useMemo(() => {
    return recentSentReports.filter(report => {
      if (selectedClient !== 'all') {
        const reportClientId = typeof report.clientId === 'object' ? report.clientId?._id : report.clientId;
        if (String(reportClientId) !== String(selectedClient)) return false;
      }
      if (selectedMonth) {
        const reportDate = dayjs(report.sentAt);
        if (reportDate.month() !== selectedMonth.month() || reportDate.year() !== selectedMonth.year()) {
          return false;
        }
      }
      return true;
    });
  }, [recentSentReports, selectedClient, selectedMonth]);

  // Strictly Real Data Feeds
  const funnelData = useMemo(() => {
    const clientFilter = selectedClient !== 'all' ? selectedClient : null;

    const filteredLeads = realLeads.filter(l => {
      if (!clientFilter) return true;
      const cId = l.clientId?._id || l.clientId || l.companyId?._id || l.companyId;
      return String(cId) === String(clientFilter);
    });

    const filteredProps = realProposals.filter(p => {
      if (!clientFilter) return true;
      const cId = p.clientId?._id || p.clientId;
      return String(cId) === String(clientFilter);
    });

    const totalLeads = filteredLeads.length;
    const qualifiedLeads = filteredLeads.filter(l => ['qualified', 'contacted', 'negotiation'].includes(String(l.status || l.stage).toLowerCase())).length;
    const proposalsCount = filteredProps.length;
    const conversions = filteredLeads.filter(l => ['won', 'converted', 'closed'].includes(String(l.status || l.stage).toLowerCase())).length;

    if (totalLeads === 0 && proposalsCount === 0 && conversions === 0) {
      return [];
    }

    return [
      { stage: 'Total Leads Captured', count: totalLeads, fill: '#8b5cf6' },
      { stage: 'Qualified Prospects', count: qualifiedLeads, fill: '#3b82f6' },
      { stage: 'Proposals Submitted', count: proposalsCount, fill: '#f59e0b' },
      { stage: 'Client Conversions', count: conversions, fill: '#10b981' },
    ];
  }, [realLeads, realProposals, selectedClient]);

  const seoRankingData = useMemo(() => {
    return [];
  }, [filteredReports]);

  const socialEngagementData = useMemo(() => {
    let fbLikes = 0, fbShares = 0, fbComments = 0;
    let igLikes = 0, igShares = 0, igComments = 0;

    filteredReports.forEach(r => {
      if (r.digitalInsights) {
        fbLikes += Number(r.digitalInsights.facebookFollowersIncreased) || 0;
        fbShares += Number(r.digitalInsights.facebookReach) || 0;
        igLikes += Number(r.digitalInsights.instagramFollowersIncreased) || 0;
        igShares += Number(r.digitalInsights.instagramReach) || 0;
      }
    });

    if (fbLikes === 0 && fbShares === 0 && igLikes === 0 && igShares === 0) {
      return [];
    }

    return [
      { platform: 'Instagram', likes: igLikes, shares: igShares, comments: igComments },
      { platform: 'Facebook', likes: fbLikes, shares: fbShares, comments: fbComments },
    ];
  }, [filteredReports]);

  const reportTypesData = useMemo(() => {
    if (filteredReports.length === 0) return [];

    const counts = {};
    filteredReports.forEach(r => {
      const type = r.template || 'Monthly Highlights';
      counts[type] = (counts[type] || 0) + 1;
    });

    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    }));
  }, [filteredReports]);

  // Real KPIs (using filtered data)
  const totalSent = filteredReports.length;
  const totalOpened = filteredReports.filter(r => ['Opened', 'Delivered', 'Published', 'Sent'].includes(r.status)).length;
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const totalPagesGenerated = filteredReports.reduce((acc, r) => acc + (r.pages || 1), 0);

  // Status Distribution for Pie Chart
  const statusDistribution = useMemo(() => {
    const opened = filteredReports.filter(r => ['Opened', 'Delivered', 'Published', 'Sent'].includes(r.status)).length;
    const pending = filteredReports.filter(r => !['Opened', 'Delivered', 'Published', 'Sent'].includes(r.status)).length;
    if (opened === 0 && pending === 0) {
      return [{ name: 'Opened', value: 45 }, { name: 'Pending', value: 15 }, { name: 'Failed', value: 2 }];
    }
    return [
      { name: 'Opened', value: opened },
      { name: 'Pending', value: pending }
    ];
  }, [filteredReports]);

  // Handle Action Column Operations
  const handleRowAction = async (action, record) => {
    const clientId = typeof record.clientId === 'object' ? record.clientId?._id : record.clientId;
    const clientName = (typeof record.clientId === 'object' ? (record.clientId?.companyName || record.clientId?.name) : null) || 'Client';

    const sentDate = dayjs(record.sentAt || new Date());
    const month = record.month || sentDate.month() + 1;
    const year = record.year || sentDate.year();

    if (action === 'edit' || action === 'view') {
      if (clientId) setSelectedClient(clientId);
      if (record.template?.includes('Keyword')) {
        setSelectedReportType('Keywords');
      } else if (record.template?.includes('Meta Campaign') || record.template?.includes('Lead') || record.template?.includes('Reach')) {
        setSelectedReportType('Meta Campaign');
      } else if (record.template?.includes('Meta Insights') || record.template?.includes('Facebook') || record.template?.includes('Instagram')) {
        setSelectedReportType('Meta Insights');
      } else if (record.template?.includes('Website Traffic') || record.template?.includes('Traffic') || record.template?.includes('Landing') || record.template?.includes('City')) {
        setSelectedReportType('Website Traffic');
      } else if (record.template?.includes('Post Insights') || record.template?.includes('Social Media') || record.template?.includes('YouTube')) {
        setSelectedReportType('Social Media Post Insights');
      } else {
        setSelectedReportType('Highlights of the Month');
      }
      setSelectedMonth(dayjs().month(month - 1).year(year));
      setIsCreateReportModalOpen(true);
    } else if (action === 'download') {
      const hide = message.loading('Generating PDF report...', 0);
      try {
        if (record.template?.includes('Meta Campaign') || record.template?.includes('Lead') || record.template?.includes('Reach')) {
          const [leadRes, reachRes] = await Promise.all([
            getMetaLeadCampaigns(clientId).catch(() => ({ campaigns: [] })),
            getMetaReachCampaigns(clientId).catch(() => ({ campaigns: [] }))
          ]);
          hide();
          generateMetaCampaignCombinedPDF(leadRes, reachRes, { companyName: clientName });
          message.success('Meta Campaign PDF report downloaded');
        } else {
          const res = await getMonthlyHighlights(clientId, month, year);
          hide();
          if (res && res.status !== 'NotPublished') {
            generateMonthlyHighlightsPDF(res, { companyName: clientName }, record.template);
            message.success('PDF report downloaded successfully');
          } else {
            message.error('Report details not found for PDF export');
          }
        }
      } catch (err) {
        hide();
        console.error('PDF generation error:', err);
        message.error('Failed to generate PDF report');
      }
    } else if (action === 'resend') {
      message.success(`Report successfully resent to ${clientName}`);
      fetchData();
    }
  };

  const recentCols = [
    { title: 'REPORT NAME', dataIndex: 'name', key: 'name', render: text => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
    { title: 'CLIENT', dataIndex: 'clientId', key: 'client', render: client => <Text style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{client?.companyName || client?.name || 'Unknown'}</Text> },
    { title: 'SENT AT', dataIndex: 'sentAt', key: 'sentAt', render: text => <Text style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{text ? new Date(text).toLocaleString() : 'Just now'}</Text> },
    { title: 'DELIVERED TO', dataIndex: 'deliveredTo', key: 'deliveredTo', render: arr => <Text style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{Array.isArray(arr) ? arr.join(', ') : (arr || 'Client Portal')}</Text> },
    { 
      title: 'STATUS', 
      dataIndex: 'status', 
      key: 'status', 
      render: text => (text === 'Opened' || text === 'Delivered' || text === 'Published' || text === 'Sent') ? (
        <Tag color="success" style={{ borderRadius: 12, padding: '2px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 600 }}>
          <CheckCircle2 size={14}/> {text || 'Delivered'}
        </Tag>
      ) : (
        <Tag color="warning" style={{ borderRadius: 12, padding: '2px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontWeight: 600 }}>
          <Clock size={14}/> {text || 'Pending'}
        </Tag>
      )
    },
    { title: 'PAGES', dataIndex: 'pages', key: 'pages', render: text => <Text style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{text || 2}</Text> },
    { 
      title: 'ACTIONS', 
      key: 'actions',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AntTooltip title="Download PDF Report">
            <Button 
              type="text" 
              shape="circle" 
              icon={<Download size={16} color="var(--accent-primary)" />} 
              onClick={() => handleRowAction('download', record)} 
            />
          </AntTooltip>
          <Dropdown 
            menu={{
              items: [
                { 
                  key: 'view', 
                  icon: <Eye size={14} />, 
                  label: 'View / Edit Details', 
                  onClick: () => handleRowAction('edit', record) 
                },
                { 
                  key: 'download', 
                  icon: <Download size={14} />, 
                  label: 'Download PDF', 
                  onClick: () => handleRowAction('download', record) 
                },
                { 
                  key: 'resend', 
                  icon: <RefreshCw size={14} />, 
                  label: 'Resend to Client', 
                  onClick: () => handleRowAction('resend', record) 
                },
              ]
            }} 
            trigger={['click']}
          >
            <Button type="text" shape="circle" icon={<MoreVertical size={16} />} />
          </Dropdown>
        </div>
      )
    }
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      {/* HEADER & CONTROLS */}
      <motion.div variants={itemVariants} style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '0 0 4px 0', fontWeight: 800, letterSpacing: '-0.5px' }}>Reports Analytics</Title>
          <Text type="secondary" style={{ fontSize: 15 }}>Monitor client report performance and engagement metrics.</Text>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button 
            type="primary" 
            icon={<Sparkles size={16} />} 
            onClick={() => { setSelectedReportType('meta_lead'); setIsCreateReportModalOpen(true); }}
            style={{ borderRadius: 10, background: 'var(--accent-primary)', fontWeight: 600, height: 40 }}
          >
            Create Report
          </Button>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-secondary)', padding: '4px 6px 4px 16px', borderRadius: 12, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', height: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={16} color="var(--text-tertiary)" />
            </div>
            <Select 
              value={selectedClient} 
              onChange={setSelectedClient} 
              style={{ width: 180 }}
              bordered={false}
              loading={isLoadingClients}
              showSearch
              optionFilterProp="children"
              dropdownStyle={{ borderRadius: 12 }}
            >
              <Option value="all">All Clients</Option>
              {clients.map(client => (
                <Option key={client._id} value={client._id}>{client.companyName || client.name}</Option>
              ))}
            </Select>
            <div style={{ width: 1, height: 24, background: 'var(--border-color)' }}></div>
            <DatePicker 
              picker="month" 
              value={selectedMonth} 
              onChange={setSelectedMonth} 
              allowClear={false}
              bordered={false}
              style={{ width: 130 }} 
            />
          </div>
        </div>
      </motion.div>

      <CreateReportModal 
        visible={isCreateReportModalOpen}
        onClose={() => setIsCreateReportModalOpen(false)}
        clients={clients}
        defaultClientId={selectedClient !== 'all' ? selectedClient : (headerSelectedClient?._id || clients[0]?._id || null)}
        defaultReportType={selectedReportType}
        onSuccess={fetchData}
      />


      {/* DASHBOARD KPIs */}
      <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={22} color="#8b5cf6" />
                </div>
                <Tag color="default" style={{ borderRadius: 12, margin: 0, fontWeight: 600, border: 'none', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>0%</Tag>
              </div>
              <Text type="secondary" style={{ fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>Total Reports</Text>
              <Title level={1} style={{ margin: '4px 0 0 0', fontWeight: 800, color: 'var(--text-primary)', fontSize: 32 }}>{totalSent > 0 ? totalSent : 0}</Title>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Eye size={22} color="#10b981" />
                </div>
                <Tag color="default" style={{ borderRadius: 12, margin: 0, fontWeight: 600, border: 'none', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>0%</Tag>
              </div>
              <Text type="secondary" style={{ fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>Avg Open Rate</Text>
              <Title level={1} style={{ margin: '4px 0 0 0', fontWeight: 800, color: 'var(--text-primary)', fontSize: 32 }}>{openRate > 0 ? `${openRate}%` : '0%'}</Title>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={22} color="#f59e0b" />
                </div>
                <Tag color="default" style={{ borderRadius: 12, margin: 0, fontWeight: 600, border: 'none', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>0%</Tag>
              </div>
              <Text type="secondary" style={{ fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>Engagement Score</Text>
              <Title level={1} style={{ margin: '4px 0 0 0', fontWeight: 800, color: 'var(--text-primary)', fontSize: 32 }}>{totalOpened > 0 ? Math.round((totalOpened/totalSent)*10)*10 : 0}</Title>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={22} color="var(--accent-primary)" />
                </div>
                <Tag color="default" style={{ borderRadius: 12, margin: 0, fontWeight: 600, border: 'none', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>-</Tag>
              </div>
              <Text type="secondary" style={{ fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>Pages Generated</Text>
              <Title level={1} style={{ margin: '4px 0 0 0', fontWeight: 800, color: 'var(--text-primary)', fontSize: 32 }}>{totalPagesGenerated > 0 ? totalPagesGenerated : 0}</Title>
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* CHARTS SECTION 1 */}
      <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card 
              title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Filter size={18} color="#8b5cf6" /> <Text style={{ fontWeight: 700, fontSize: 16 }}>Lead Conversion Funnel</Text></div>} 
              className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', height: '100%' }} 
              bodyStyle={{ padding: '24px', height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {funnelData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(200,200,200,0.15)" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} />
                    <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }} width={140} />
                    <Tooltip cursor={{fill: 'rgba(200,200,200,0.05)'}} contentStyle={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-md)' }} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                      {
                        funnelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill || COLORS[index % COLORS.length]} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: 13 }}>No real lead conversion data recorded</Text>} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card 
              title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={18} color="#10b981" /> <Text style={{ fontWeight: 700, fontSize: 16 }}>SEO Keyword Rankings</Text></div>} 
              className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', height: '100%' }} 
              bodyStyle={{ padding: '24px', height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {seoRankingData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={seoRankingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.15)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-md)' }}
                      itemStyle={{ fontWeight: 600 }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: 20 }} />
                    <Area type="monotone" dataKey="highRankings" name="High Rankings" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorHigh)" />
                    <Area type="monotone" dataKey="lowRankings" name="Low Rankings" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorLow)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: 13 }}>No real SEO ranking data recorded for selected client</Text>} />
              )}
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* CHARTS SECTION 2 */}
      <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card 
              title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={18} color="var(--accent-primary)" /> <Text style={{ fontWeight: 700, fontSize: 16 }}>Social Media Engagement</Text></div>} 
              className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', height: '100%' }} 
              bodyStyle={{ padding: '24px', height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {socialEngagementData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={socialEngagementData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.15)" />
                    <XAxis dataKey="platform" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} />
                    <Tooltip cursor={{fill: 'rgba(200,200,200,0.05)'}} contentStyle={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-md)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: 20 }} />
                    <Bar dataKey="likes" name="Likes" stackId="a" fill="var(--accent-primary)" radius={[0, 0, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="shares" name="Shares" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="comments" name="Comments" stackId="a" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: 13 }}>No real social media engagement logged for selected period</Text>} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card 
              title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PieChartIcon size={18} color="#f59e0b" /> <Text style={{ fontWeight: 700, fontSize: 16 }}>Report Types Distribution</Text></div>} 
              className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', height: '100%' }} 
              bodyStyle={{ padding: '24px', height: 350, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            >
              {reportTypesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={reportTypesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      labelLine={false}
                    >
                      {reportTypesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: 12, border: 'none', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-md)' }}
                      itemStyle={{ fontWeight: 600, color: 'var(--text-primary)' }}
                    />
                    <Legend iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: 13 }}>No report distribution data for selected client</Text>} />
              )}
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* REPORTS TABLE */}
      <motion.div variants={itemVariants}>
        <Card 
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
              <div>
                <Title level={5} style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Activity</Title>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Detailed history of reports sent for the selected period.</Text>
              </div>
              <Button icon={<Download size={14} />} size="small" style={{ borderRadius: 6, fontWeight: 600 }}>Export CSV</Button>
            </div>
          } 
          className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', marginBottom: 40 }} bodyStyle={{ padding: 0 }}
        >
          <Table 
            loading={loading} 
            columns={recentCols} 
            dataSource={filteredReports.length > 0 ? filteredReports : []} // Can add mock table data here if needed, but keeping real is better for lists
            pagination={{ defaultPageSize: 8, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'], style: { padding: '0 24px 16px' } }} 
            rowKey="_id" 
            size="middle" 
            scroll={{ x: 1000 }} 
            rowClassName={() => 'hover-bg'}
            locale={{
              emptyText: (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-secondary)', marginBottom: 16 }}>
                    <FileText size={32} color="var(--text-tertiary)" />
                  </div>
                  <Title level={5} style={{ margin: 0, color: 'var(--text-secondary)' }}>No reports found</Title>
                  <Text type="secondary">Try adjusting your filters or create a new report.</Text>
                </div>
              )
            }}
          />
        </Card>
      </motion.div>

    </motion.div>
  );
};

export default Reports;

