import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Row, Col, Card, Button, Table, Tag, message, Select, DatePicker, Skeleton, Tooltip as AntTooltip, Dropdown, Menu, Empty } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Plus, FileText, Download, CheckCircle2, Clock, Filter, Eye, 
  Activity, TrendingUp, TrendingDown, MoreVertical, AlertCircle, RefreshCw, 
  BarChart2, PieChart as PieChartIcon, Layers, Sparkles, Users 
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import api from '../../services/api';
import { getRecentSentReports, getMonthlyHighlights, getReportDashboardStats } from '../../api/reportApi';
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

const Reports = () => {
  const { role } = useAuth();
  const { selectedClient: headerSelectedClient, agencyClients } = useClientContext();
  
  const [recentSentReports, setRecentSentReports] = useState([]);
  const [totalReports, setTotalReports] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dashboardStats, setDashboardStats] = useState(null);
  
  const [realLeads, setRealLeads] = useState([]);
  const [realProposals, setRealProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateReportModalOpen, setIsCreateReportModalOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState('meta_lead');

  const [modalClientId, setModalClientId] = useState(null);
  const [modalDate, setModalDate] = useState(null);

  const [selectedClient, setSelectedClient] = useState(() => headerSelectedClient?._id || 'all');
  const [selectedMonth, setSelectedMonth] = useState(dayjs());

  useEffect(() => {
    if (headerSelectedClient?._id) {
      setSelectedClient(headerSelectedClient._id);
    } else {
      setSelectedClient('all');
    }
  }, [headerSelectedClient]);

  useEffect(() => {
    const handleClientSwitched = () => {
      const saved = localStorage.getItem('selectedClient');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed?._id) {
            setSelectedClient(parsed._id);
            return;
          }
        } catch (e) {}
      }
      setSelectedClient('all');
    };

    window.addEventListener('client-switched', handleClientSwitched);
    return () => window.removeEventListener('client-switched', handleClientSwitched);
  }, []);
  
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
      const params = {
        page: currentPage,
        limit: pageSize,
        clientId: selectedClient,
        month: selectedMonth ? selectedMonth.month() + 1 : 'all',
        year: selectedMonth ? selectedMonth.year() : 'all'
      };
      
      const recent = await getRecentSentReports(params);
      setRecentSentReports(recent.data || []);
      setTotalReports(recent.total || 0);

      const stats = await getReportDashboardStats({
        clientId: selectedClient,
        month: selectedMonth ? selectedMonth.month() + 1 : 'all',
        year: selectedMonth ? selectedMonth.year() : 'all'
      });
      setDashboardStats(stats);

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
  }, [selectedClient, selectedMonth, currentPage, pageSize]);

  const handleTableChange = (pagination) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  // We no longer filter reports on the frontend; recentSentReports are already filtered.
  const filteredReports = recentSentReports;

  // Use dashboardStats from backend instead of computing on frontend
  const clientCoverage = useMemo(() => {
    const total = (selectedClient && selectedClient !== 'all') ? 1 : clients.length;
    const covered = dashboardStats?.clientCoverage || 0;
    const percentage = total > 0 ? Math.round((covered / total) * 100) : 0;
    
    const targetClients = (selectedClient && selectedClient !== 'all')
      ? clients.filter(c => String(c._id) === String(selectedClient))
      : clients;

    const list = targetClients.map(c => {
      const cId = String(c._id);
      const stats = dashboardStats?.clientStatsMap?.[cId] || { reportsCount: 0, latestReport: null };
      return {
        client: c,
        reportsCount: stats.reportsCount,
        hasReport: stats.reportsCount > 0,
        latestReport: stats.latestReport
      };
    });
    
    return { covered, total, percentage, list };
  }, [dashboardStats, clients, selectedClient]);

  const monthlyTrendData = dashboardStats?.monthlyTrendData || [];
  const reportTypesData = dashboardStats?.reportTypesData || [];
  
  const totalSent = dashboardStats?.totalSent || 0;
  const deliveryRate = dashboardStats?.deliveryRate || "0%";
  const activeCategoriesCount = dashboardStats?.activeCategoriesCount || 0;

  const handleOpenCreateReport = (clientId = null, template = 'Highlights of the Month') => {
    const rawClientId = (clientId && typeof clientId === 'object' && clientId._id) ? clientId._id : (typeof clientId === 'string' ? clientId : null);
    const targetClientId = rawClientId || (selectedClient !== 'all' && typeof selectedClient === 'string' ? selectedClient : (headerSelectedClient?._id || (clients.length > 0 ? clients[0]._id : null)));
    setModalClientId(targetClientId);
    setSelectedReportType(typeof template === 'string' ? template : 'Highlights of the Month');
    setModalDate(selectedMonth || dayjs());
    setIsCreateReportModalOpen(true);
  };

  const REPORT_TEMPLATES = [
    { key: 'Highlights of the Month', title: 'Highlights of Month', icon: Sparkles, color: '#8b5cf6', desc: 'Deliverables & Initiatives' },
    { key: 'Keywords', title: 'Keywords Ranking', icon: TrendingUp, color: '#10b981', desc: 'SEO/AEO/GEO Rankings' },
    { key: 'Meta Campaign', title: 'Meta Campaigns', icon: FileText, color: '#3b82f6', desc: 'Leads & Reach Ads' },
    { key: 'Meta Insights', title: 'Meta Insights', icon: RefreshCw, color: '#1877f2', desc: 'Facebook & Instagram' },
    { key: 'Website Traffic', title: 'Website Traffic', icon: Eye, color: '#0284c7', desc: 'GA4 Traffic & City Users' },
    { key: 'Social Media Post Insights', title: 'Social Media Posts', icon: Sparkles, color: '#ec4899', desc: 'Content & YouTube Stats' },
  ];

  // Handle Action Column Operations
  const handleRowAction = async (action, record) => {
    const clientId = typeof record.clientId === 'object' ? record.clientId?._id : record.clientId;
    const clientName = (typeof record.clientId === 'object' ? (record.clientId?.companyName || record.clientId?.name) : null) || 'Client';

    const sentDate = dayjs(record.sentAt || new Date());
    const month = record.month || sentDate.month() + 1;
    const year = record.year || sentDate.year();

    if (action === 'edit' || action === 'view') {
      const targetClientId = clientId || (selectedClient !== 'all' ? selectedClient : (headerSelectedClient?._id || (clients.length > 0 ? clients[0]._id : null)));
      setModalClientId(targetClientId);
      
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
      
      let passDate;
      if (record.fromDate && record.toDate) {
        passDate = {
          fromDate: record.fromDate,
          toDate: record.toDate,
          label: `Custom Range`,
          filterType: 'custom'
        };
      } else {
        passDate = dayjs().month(month - 1).year(year);
      }
      
      setModalDate(passDate);
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
          const res = await getMonthlyHighlights(clientId, month, year, false, record.projectId, record.fromDate, record.toDate);
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
            onClick={() => handleOpenCreateReport()}
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
        defaultClientId={modalClientId || (selectedClient !== 'all' ? selectedClient : (headerSelectedClient?._id || clients[0]?._id || null))}
        defaultReportType={selectedReportType}
        defaultDate={modalDate || selectedMonth || dayjs()}
        onSuccess={fetchData}
      />


      {/* DASHBOARD KPIs */}
      <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={22} color="#8b5cf6" />
                </div>
                <Tag color="purple" style={{ borderRadius: 12, margin: 0, fontWeight: 600, border: 'none', background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
                  {selectedMonth.format('MMM YYYY')}
                </Tag>
              </div>
              <Text type="secondary" style={{ fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>Total Reports Generated</Text>
              <Title level={1} style={{ margin: '4px 0 0 0', fontWeight: 800, color: 'var(--text-primary)', fontSize: 32 }}>{totalSent}</Title>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={22} color="#3b82f6" />
                </div>
                <Tag color="blue" style={{ borderRadius: 12, margin: 0, fontWeight: 600, border: 'none', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                  {clientCoverage.percentage}% Covered
                </Tag>
              </div>
              <Text type="secondary" style={{ fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>Client Coverage</Text>
              <Title level={1} style={{ margin: '4px 0 0 0', fontWeight: 800, color: 'var(--text-primary)', fontSize: 32 }}>
                {clientCoverage.covered} <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-tertiary)' }}>/ {clientCoverage.total} {clientCoverage.total === 1 ? 'Client' : 'Clients'}</span>
              </Title>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={22} color="#10b981" />
                </div>
                <Tag color="success" style={{ borderRadius: 12, margin: 0, fontWeight: 600, border: 'none', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>Live</Tag>
              </div>
              <Text type="secondary" style={{ fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>Delivery Success Rate</Text>
              <Title level={1} style={{ margin: '4px 0 0 0', fontWeight: 800, color: 'var(--text-primary)', fontSize: 32 }}>{deliveryRate}%</Title>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={22} color="#f59e0b" />
                </div>
                <Tag color="warning" style={{ borderRadius: 12, margin: 0, fontWeight: 600, border: 'none', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                  {activeCategoriesCount > 0 ? `${activeCategoriesCount} Active` : '0 Active'}
                </Tag>
              </div>
              <Text type="secondary" style={{ fontWeight: 600, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>Report Templates Used</Text>
              <Title level={1} style={{ margin: '4px 0 0 0', fontWeight: 800, color: 'var(--text-primary)', fontSize: 32 }}>
                {activeCategoriesCount} <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-tertiary)' }}>/ 6 Templates</span>
              </Title>
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* OVERVIEW SECTION: CLIENT COVERAGE & REPORT TYPES */}
      <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {/* Client Reporting Status */}
          <Col xs={24} lg={14}>
            <Card 
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={18} color="var(--accent-primary)" />
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 16 }}>
                      {selectedClient !== 'all' && clientCoverage.list.length === 1 
                        ? `${clientCoverage.list[0].client.companyName || clientCoverage.list[0].client.name} — Reporting Status` 
                        : 'Client Reporting Status'}
                    </span>
                  </div>
                  <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600 }}>
                    {clientCoverage.covered} of {clientCoverage.total} Completed
                  </Tag>
                </div>
              } 
              className="glassmorphism" 
              style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%', boxShadow: 'var(--shadow-sm)' }}
              bodyStyle={{ padding: '16px 20px', maxHeight: 340, overflowY: 'auto' }}
            >
              {clientCoverage.list.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {clientCoverage.list.map(({ client, hasReport, reportsCount, latestReport }) => (
                    <div 
                      key={client._id}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '10px 14px', 
                        borderRadius: 12, 
                        background: 'var(--bg-tertiary)', 
                        border: '1px solid var(--border-color)' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ 
                          width: 34, 
                          height: 34, 
                          borderRadius: 8, 
                          background: hasReport ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {hasReport ? <CheckCircle2 size={18} color="#10b981" /> : <Clock size={18} color="#f59e0b" />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <Text strong style={{ color: 'var(--text-primary)', fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {client.companyName || client.name}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {hasReport 
                              ? `${reportsCount} report${reportsCount > 1 ? 's' : ''} sent • Latest: ${latestReport?.template || 'Highlights'}`
                              : 'No report generated for this month'}
                          </Text>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {hasReport ? (
                          <Tag color="success" style={{ borderRadius: 6, fontWeight: 600, margin: 0 }}>Completed</Tag>
                        ) : (
                          <Button 
                            type="primary" 
                            size="small" 
                            icon={<Plus size={13} />} 
                            onClick={() => handleOpenCreateReport(client._id)}
                            style={{ borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'var(--accent-primary)' }}
                          >
                            Create Report
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Empty description="No clients found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </div>
              )}
            </Card>
          </Col>

          {/* Report Types Distribution */}
          <Col xs={24} lg={10}>
            <Card 
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PieChartIcon size={18} color="#8b5cf6" />
                  <Text style={{ fontWeight: 700, fontSize: 16 }}>Report Types Breakdown</Text>
                </div>
              } 
              className="glassmorphism" 
              style={{ borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', height: '100%' }} 
              bodyStyle={{ padding: '20px', height: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            >
              {reportTypesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={reportTypesData}
                      cx="50%"
                      cy="48%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      labelLine={false}
                    >
                      {reportTypesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-md)' }}
                      itemStyle={{ fontWeight: 600, color: 'var(--text-primary)' }}
                    />
                    <Legend iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: 13 }}>No reports created in this period yet</Text>} />
              )}
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* PUBLISHING TREND & QUICK LAUNCHPAD */}
      <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {/* 6-Month Publishing Trend */}
          <Col xs={24} lg={14}>
            <Card 
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart2 size={18} color="#10b981" />
                    <Text style={{ fontWeight: 700, fontSize: 16 }}>Monthly Publishing Output</Text>
                  </div>
                  <Tag color="green" style={{ borderRadius: 6, fontWeight: 600 }}>Last 6 Months</Tag>
                </div>
              } 
              className="glassmorphism" 
              style={{ borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', height: '100%' }} 
              bodyStyle={{ padding: '20px 24px 10px 10px', height: 320 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.15)" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-md)' }}
                    itemStyle={{ fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="reports" name="Reports Published" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorReports)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* Quick Report Launchpad */}
          <Col xs={24} lg={10}>
            <Card 
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} color="var(--accent-primary)" />
                  <Text style={{ fontWeight: 700, fontSize: 16 }}>Quick Report Launchpad</Text>
                </div>
              } 
              className="glassmorphism" 
              style={{ borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', height: '100%' }} 
              bodyStyle={{ padding: '16px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {REPORT_TEMPLATES.map(template => {
                  const IconComp = template.icon;
                  return (
                    <div 
                      key={template.key}
                      onClick={() => handleOpenCreateReport(null, template.key)}
                      style={{ 
                        padding: '12px', 
                        borderRadius: 12, 
                        background: 'var(--bg-tertiary)', 
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = template.color;
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${template.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <IconComp size={15} color={template.color} />
                        </div>
                        <Plus size={14} color="var(--text-tertiary)" />
                      </div>
                      <div>
                        <Text strong style={{ fontSize: 13, color: 'var(--text-primary)', display: 'block', lineHeight: 1.2 }}>{template.title}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{template.desc}</Text>
                      </div>
                    </div>
                  );
                })}
              </div>
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
            dataSource={filteredReports.length > 0 ? filteredReports : []}
            onChange={handleTableChange}
            pagination={{ 
              current: currentPage,
              pageSize: pageSize,
              total: totalReports,
              pageSizeOptions: ['10', '20', '50', '100'], 
              showSizeChanger: true, 
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} reports`,
              style: { padding: '12px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 } 
            }} 
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

