import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Row, Col, Table, Button, Avatar, Spin, message, Tag, DatePicker, Select } from 'antd';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, ExternalLink, TrendingUp, CheckSquare, Briefcase, Activity, DollarSign } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import SlabCard from '../../../components/SlabCard';
import api from '../../../services/api';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const { Title, Text } = Typography;

const OverviewTab = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [overviewData, setOverviewData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedClient, setSelectedClient] = useState(null);
  const [allClients, setAllClients] = useState([]);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        const params = {
          month: selectedDate.month(),
          year: selectedDate.year()
        };
        if (selectedClient) {
          params.clientId = selectedClient;
        }
        const res = await api.get('/agency/overview', { params });
        setOverviewData(res.data.data);
        
        // Populate master client list only once if not filtered
        if (!selectedClient && res.data.data.clients) {
            setAllClients(res.data.data.clients);
        }
      } catch (error) {
        console.error('Failed to fetch agency overview:', error);
        message.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, [selectedDate, selectedClient]);

  const handleImpersonate = async (clientId) => {
    try {
      const currentToken = localStorage.getItem('token');
      const currentUserStr = localStorage.getItem('user');

      const res = await api.post(`/auth/impersonate/${clientId}`);
      if (res.data && res.data.success) {
        if (currentToken && currentUserStr) {
          localStorage.setItem('original_token', currentToken);
          localStorage.setItem('original_user', currentUserStr);
        }
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        message.success(`Logged in as ${res.data.user.name}`);
        login(res.data.user);
      }
    } catch (err) {
      console.error('Impersonation error:', err);
      message.error(err.response?.data?.error || 'Failed to login as client');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const getCodeColor = (mos) => {
    if (mos >= 70) return 'var(--accent-primary)'; 
    if (mos >= 50) return 'var(--accent-warning)'; 
    return 'var(--accent-danger)'; 
  };

  const getStatusText = (mos) => {
    if (mos >= 70) return 'Healthy';
    if (mos >= 50) return 'At Risk';
    return 'Critical';
  };

  if (!overviewData && loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}><Spin size="large" /></div>;
  }

  if (!overviewData) return null;

  const renderExecutiveDashboard = () => {
    const { stats, revenueChartData, clients, team } = overviewData;
    const currentMonthName = selectedDate.format('MMMM YYYY');

    const kpis = [
      { label: 'ACTIVE CLIENTS', value: stats.activeClients, sub: 'Total Managed', color: 'var(--accent-primary)', icon: <Briefcase size={20} /> },
      { label: 'ACTIVE PROJECTS', value: stats.activeProjects, sub: 'In Progress', color: 'var(--accent-info)', icon: <CheckSquare size={20} /> },
      { label: 'CURRENT MONTH REVENUE', value: `₹${(stats.currentMonthRevenue/100000).toFixed(1)}L`, sub: 'Collected this month', color: 'var(--accent-success)', icon: <DollarSign size={20} /> },
      { label: 'OUTSTANDING INVOICES', value: `₹${(stats.outstandingInvoicesAmount/100000).toFixed(1)}L`, sub: `${stats.outstandingInvoicesCount} pending payments`, color: 'var(--accent-danger)', icon: <AlertTriangle size={20} /> },
      { label: 'AT RISK CLIENTS', value: stats.atRiskClients, sub: 'MOS < 70', color: stats.atRiskClients > 0 ? 'var(--accent-warning)' : 'var(--accent-success)', icon: <Activity size={20} /> }
    ];

    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" >
        <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} style={{ margin: 0, fontWeight: 800 }}>Executive Overview</Title>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>High-level agency performance — {currentMonthName}.</Text>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Select 
              allowClear
              placeholder="All Clients"
              value={selectedClient}
              onChange={(val) => setSelectedClient(val)}
              style={{ width: 200 }}
              size="large"
            >
              {allClients.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
            <DatePicker 
              picker="month" 
              value={selectedDate} 
              onChange={(date) => { if(date) setSelectedDate(date); }} 
              size="large"
              style={{ borderRadius: 8, fontWeight: 600, width: 200 }}
              allowClear={false}
            />
          </div>
        </motion.div>

        {/* KPI Cards */}
        <motion.div variants={itemVariants}>
          <Row gutter={[24, 24]} style={{ marginBottom: 48 }}>
            {kpis.map((stat, idx) => (
              <Col xs={24} sm={12} flex={1} key={idx}>
                <div style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: 20,
                  padding: 24,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  height: '100%'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: 'var(--text-tertiary)' }}>{stat.label}</Text>
                    <div style={{ color: stat.color, background: `${stat.color}15`, padding: 8, borderRadius: 12 }}>
                      {stat.icon}
                    </div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{stat.sub}</div>
                  <div style={{ position: 'absolute', bottom: -10, right: -10, opacity: 0.05, transform: 'scale(2)' }}>
                    {stat.icon}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </motion.div>

        {/* Charts Row */}
        <motion.div variants={itemVariants} style={{ marginBottom: 48 }}>
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={14}>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 16, border: '1px solid var(--border-color)', padding: 24, height: '100%' }}>
                <Title level={5} style={{ margin: '0 0 24px 0', fontWeight: 800 }}>Month-wise Revenue</Title>
                <div style={{ height: 300, width: '100%' }}>
                  <ResponsiveContainer>
                    <ComposedChart data={revenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: 12, border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.05)', fontWeight: 600 }}
                        formatter={(value) => `₹${value.toLocaleString()}`}
                      />
                      <Legend />
                      <Bar dataKey="revenue" name="Collected Revenue" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} barSize={40} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Col>

            <Col xs={24} lg={10}>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 16, border: '1px solid var(--border-color)', padding: 24, height: '100%', overflowY: 'auto', maxHeight: 400 }}>
                <Title level={5} style={{ margin: '0 0 24px 0', fontWeight: 800 }}>Team Task Completion</Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {team.map((member, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar style={{ backgroundColor: 'var(--text-tertiary)', fontWeight: 700 }}>{member.initials}</Avatar>
                        <div>
                          <Text style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{member.name}</Text>
                          <Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{member.tasksCompleted} / {member.tasksAssigned} tasks</Text>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Text style={{ display: 'block', fontWeight: 800, color: member.status === 'good' ? 'var(--accent-primary)' : 'var(--accent-warning)' }}>
                          {member.completionRate}%
                        </Text>
                        <Text style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>Completion</Text>
                      </div>
                    </div>
                  ))}
                  {team.length === 0 && <Text type="secondary">No team data available.</Text>}
                </div>
              </div>
            </Col>
          </Row>
        </motion.div>

        {/* Detailed Client List */}
        <motion.div variants={itemVariants} style={{ marginBottom: 64 }}>
          <Title level={3} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Client Health Portfolio</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 32, fontSize: 14, fontWeight: 500 }}>All {clients.length} active clients - ranked by overall health</Text>
          
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <Table
              dataSource={clients}
              rowKey="id"
              pagination={{ pageSize: 5, showSizeChanger: false, position: ['bottomCenter'] }}
              columns={[
                {
                  title: 'Client',
                  key: 'client',
                  render: (_, client) => {
                    const statusText = getStatusText(client.mos);
                    const statusColor = getCodeColor(client.mos);
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: statusColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15 }}>{client.code}</div>
                        <div>
                          <Text style={{ fontWeight: 800, display: 'block', color: 'var(--text-primary)', fontSize: 16, marginBottom: 2 }}>{client.name}</Text>
                          <Tag style={{ margin: 0, background: 'transparent', border: `1px solid ${statusColor}40`, color: statusColor, fontWeight: 700 }}>MOS: {client.mos !== null ? client.mos : 'N/A'} ({statusText})</Tag>
                        </div>
                      </div>
                    );
                  }
                },
                {
                  title: 'Monthly MRR',
                  dataIndex: 'mrr',
                  key: 'mrr',
                  render: (mrr) => <Text style={{ fontWeight: 800, fontSize: 16 }}>₹{(mrr/100000).toFixed(1)}L</Text>
                },
                {
                  title: 'Active Projects',
                  dataIndex: 'activeProjects',
                  key: 'activeProjects',
                  render: (activeProjects) => <Text style={{ fontWeight: 800, fontSize: 16 }}>{activeProjects}</Text>
                },
                {
                  title: '',
                  key: 'action',
                  align: 'right',
                  render: (_, client) => (
                    <Button type="text" icon={<ExternalLink size={18} />} onClick={() => handleImpersonate(client.id)} style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>View Dashboard</Button>
                  )
                }
              ]}
            />
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const renderOperationsDashboard = () => {
    const { stats, actionItems, upcomingDeadlines } = overviewData;

    const kpis = [
      { label: 'TASKS DUE TODAY', value: stats.tasksDueTodayCount, sub: 'Requires action', color: 'var(--accent-primary)', icon: <Calendar size={20} /> },
      { label: 'OVERDUE TASKS', value: stats.overdueTasksCount, sub: 'Past deadline', color: 'var(--accent-danger)', icon: <AlertTriangle size={20} /> },
      { label: 'AT RISK SLAs', value: stats.atRiskSlasCount, sub: 'Needs attention', color: 'var(--accent-warning)', icon: <Activity size={20} /> },
      { label: 'PENDING APPROVALS', value: stats.pendingApprovalsCount, sub: 'Awaiting review', color: 'var(--accent-secondary)', icon: <CheckSquare size={20} /> },
      { label: 'ACTIVE PROJECTS', value: stats.activeProjectsCount, sub: 'In progress', color: 'var(--accent-info)', icon: <Briefcase size={20} /> }
    ];

    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" >
        <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} style={{ margin: 0, fontWeight: 800 }}>Operations Center</Title>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>Live agency operations and action items.</Text>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
             <Select 
              allowClear
              placeholder="All Clients"
              value={selectedClient}
              onChange={(val) => setSelectedClient(val)}
              style={{ width: 200 }}
              size="large"
            >
              {allClients.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <motion.div variants={itemVariants}>
          <Row gutter={[24, 24]} style={{ marginBottom: 48 }}>
            {kpis.map((stat, idx) => (
              <Col xs={24} sm={12} flex={1} key={idx}>
                <div style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: 20,
                  padding: 24,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  height: '100%'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: 'var(--text-tertiary)' }}>{stat.label}</Text>
                    <div style={{ color: stat.color, background: `${stat.color}15`, padding: 8, borderRadius: 12 }}>
                      {stat.icon}
                    </div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{stat.sub}</div>
                  <div style={{ position: 'absolute', bottom: -10, right: -10, opacity: 0.05, transform: 'scale(2)' }}>
                    {stat.icon}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </motion.div>

        {/* Action Center Row */}
        <motion.div variants={itemVariants}>
          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col xs={24}>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 16, border: '1px solid var(--border-color)', padding: 24 }}>
                <Title level={5} style={{ margin: '0 0 24px 0', fontWeight: 800 }}>Operational Metrics Overview</Title>
                <div style={{ height: 250, width: '100%' }}>
                  <ResponsiveContainer>
                    <ComposedChart 
                      data={[
                        { name: 'Due Today', count: stats.tasksDueTodayCount },
                        { name: 'Overdue', count: stats.overdueTasksCount },
                        { name: 'Pending Approvals', count: stats.pendingApprovalsCount },
                        { name: 'At Risk SLAs', count: stats.atRiskSlasCount }
                      ]} 
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.05)', fontWeight: 600 }} />
                      <Bar dataKey="count" name="Count" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} barSize={40} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Col>
          </Row>
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 16, border: '1px solid var(--border-color)', padding: 24, height: '100%' }}>
                <Title level={5} style={{ margin: '0 0 24px 0', fontWeight: 800 }}>Tasks Requiring Attention</Title>
                
                <div style={{ marginBottom: 24 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontWeight: 700 }}>Due Today ({actionItems.tasksDueToday.length})</Text>
                  {actionItems.tasksDueToday.map((t, i) => (
                    <div key={i} style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                         <Text style={{ fontWeight: 600, display: 'block' }}>{t.title}</Text>
                         <Text type="secondary" style={{ fontSize: 12 }}>{t.companyId?.companyName} • Assignee: {t.assignee?.name}</Text>
                       </div>
                       <Button 
                         type="primary" 
                         size="small" 
                         onClick={() => navigate('/agency/workspace/tasks')}
                       >
                         View Task
                       </Button>
                    </div>
                  ))}
                  {actionItems.tasksDueToday.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>None</Text>}
                </div>

                <div>
                  <Text type="danger" style={{ display: 'block', marginBottom: 12, fontWeight: 700 }}>Overdue ({actionItems.overdueTasks.length})</Text>
                  {actionItems.overdueTasks.map((t, i) => (
                    <div key={i} style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div>
                         <Text style={{ fontWeight: 600, display: 'block' }}>{t.title}</Text>
                         <Text type="secondary" style={{ fontSize: 12 }}>Due: {new Date(t.dueDate).toLocaleDateString()}</Text>
                       </div>
                       <Button 
                         type="primary" 
                         size="small" 
                         onClick={() => navigate('/agency/workspace/tasks')}
                       >
                         View Task
                       </Button>
                    </div>
                  ))}
                  {actionItems.overdueTasks.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>None</Text>}
                </div>
              </div>
            </Col>
            
            <Col xs={24} lg={12}>
               <div style={{ background: 'var(--bg-tertiary)', borderRadius: 16, border: '1px solid var(--border-color)', padding: 24, height: '100%' }}>
                <Title level={5} style={{ margin: '0 0 24px 0', fontWeight: 800 }}>At Risk SLAs ({actionItems.atRiskSlas.length})</Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {actionItems.atRiskSlas.map((s, i) => (
                    <div key={i} style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ fontWeight: 700 }}>{s.title}</Text>
                        <Tag color="red">{s.status}</Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>Client: {s.clientId?.companyName} • Priority: {s.priority}</Text>
                    </div>
                  ))}
                  {actionItems.atRiskSlas.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>All SLAs are healthy.</Text>}
                </div>
              </div>
            </Col>
          </Row>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <Spin spinning={loading} tip="Updating dashboard...">
      {user?.role === 'agency_super_admin' ? renderExecutiveDashboard() : renderOperationsDashboard()}
    </Spin>
  );
};

export default OverviewTab;
