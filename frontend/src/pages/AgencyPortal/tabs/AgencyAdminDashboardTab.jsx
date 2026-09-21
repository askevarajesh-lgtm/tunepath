import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Button, Table, Tag, Progress, Spin, List, Avatar, Modal, DatePicker } from 'antd';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Activity, ArrowUpRight, ArrowDownRight, Briefcase, FileText, CheckCircle, Clock } from 'lucide-react';
import SlabCard from '../../../components/SlabCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const AgencyAdminDashboardTab = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [modalTitle, setModalTitle] = useState('');
  const [dashboardData, setDashboardData] = useState({
    agencyMrr: '₹0',
    grossMargin: 'N/A',
    activeClients: 0,
    teamMembers: 0,
    totalInvoiceAmount: '₹0',
    totalPaidAmount: '₹0',
    pendingAmount: '₹0',
    revenue: '₹0',
    teamPerformance: [],
    recentActivities: []
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        let url = '/api/agencies/dashboard-stats';
        if (selectedDate) {
          url += `?month=${selectedDate.month()}&year=${selectedDate.year()}`;
        }
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setDashboardData(data.data);
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [selectedDate]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const handleStatClick = (stat) => {
    setModalType(stat.label);
    setModalTitle(`${stat.label} Details`);
    setModalVisible(true);
  };

  const renderModalContent = () => {
    if (!dashboardData) return null;

    if (modalType === 'ACTIVE CLIENTS') {
      const clientColumns = [
        { title: 'Client Name', dataIndex: 'name', key: 'name' },
        { title: 'Email', dataIndex: 'email', key: 'email' },
        { title: 'MRR', dataIndex: 'mrr', key: 'mrr', render: val => `₹${val || 0}` },
        { title: 'Status', dataIndex: 'status', key: 'status', render: text => <Tag color={text === 'active' ? 'green' : 'red'}>{text}</Tag> }
      ];
      return <Table columns={clientColumns} dataSource={dashboardData.clientsList || []} rowKey="id" pagination={false} scroll={{ y: 400 }} />;
    }
    if (modalType === 'TEAM MEMBERS') {
      const teamColumns = [
        { title: 'Name', dataIndex: 'name', key: 'name' },
        { title: 'Email', dataIndex: 'email', key: 'email' },
        { title: 'Role', dataIndex: 'role', key: 'role', render: text => text === 'agency_manager' ? 'Agency Manager' : text },
        { title: 'Status', dataIndex: 'status', key: 'status', render: text => <Tag color={text === 'active' ? 'green' : 'red'}>{text}</Tag> }
      ];
      return <Table columns={teamColumns} dataSource={dashboardData.teamMembersList || []} rowKey="id" pagination={false} scroll={{ y: 400 }} />;
    }
    if (['REVENUE', 'PENDING AMOUNT', 'TOTAL INVOICED'].includes(modalType)) {
      const invoiceColumns = [
        { title: 'Invoice Number', dataIndex: 'invoiceNumber', key: 'invoiceNumber' },
        { title: 'Grand Total', dataIndex: 'grandTotal', key: 'grandTotal', render: val => `₹${val || 0}` },
        { title: 'Total Paid', dataIndex: 'totalPaid', key: 'totalPaid', render: val => `₹${val || 0}` },
        { title: 'Pending Amount', dataIndex: 'pendingAmount', key: 'pendingAmount', render: val => `₹${val || 0}` },
        { title: 'Status', dataIndex: 'status', key: 'status', render: text => <Tag color={text === 'Paid' ? 'green' : text === 'Pending' ? 'orange' : 'red'}>{text}</Tag> },
        { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', render: date => date ? new Date(date).toLocaleDateString() : 'N/A' }
      ];
      return <Table columns={invoiceColumns} dataSource={dashboardData.invoicesList || []} rowKey="id" pagination={false} scroll={{ y: 400 }} />;
    }
    if (modalType === 'AGENCY MRR') {
      const clientColumns = [
        { title: 'Client Name', dataIndex: 'name', key: 'name' },
        { title: 'MRR', dataIndex: 'mrr', key: 'mrr', render: val => `₹${val || 0}` },
        { title: 'Status', dataIndex: 'status', key: 'status', render: text => <Tag color={text === 'active' ? 'green' : 'red'}>{text}</Tag> }
      ];
      return <Table columns={clientColumns} dataSource={dashboardData.clientsList || []} rowKey="id" pagination={false} scroll={{ y: 400 }} />;
    }
    return <Text>No details available.</Text>;
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const stats = [
    { label: 'REVENUE', value: dashboardData.revenue, sub: 'Total Paid', trend: 'up', color: 'var(--accent-primary)', icon: <TrendingUp size={20}/> },
    { label: 'AGENCY MRR', value: dashboardData.agencyMrr, sub: 'Current', trend: 'up', color: 'var(--accent-secondary)', icon: <Activity size={20}/> },
    { label: 'PENDING AMOUNT', value: dashboardData.pendingAmount, sub: 'Outstanding', trend: 'neutral', color: 'var(--accent-warning)', icon: <Clock size={20}/> },
    { label: 'TOTAL INVOICED', value: dashboardData.totalInvoiceAmount, sub: 'All Time', trend: 'up', color: 'var(--accent-primary)', icon: <FileText size={20}/> },
    { label: 'ACTIVE CLIENTS', value: dashboardData.activeClients.toString(), sub: 'Managed', trend: 'up', color: 'var(--accent-secondary)', icon: <Briefcase size={20}/> },
    { label: 'TEAM MEMBERS', value: dashboardData.teamMembers.toString(), sub: 'Total', trend: 'neutral', color: 'var(--accent-warning)', icon: <Users size={20}/> }
  ];

  const chartData = dashboardData.chartData || [];

  const columns = [
    { title: 'Manager Name', dataIndex: 'name', key: 'name', render: (text) => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (text) => <Text type="secondary">{text}</Text> },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', render: (text) => <Text type="secondary">{text}</Text> },
    { title: 'Role', dataIndex: 'role', key: 'role', render: (text) => <Tag style={{ borderRadius: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>{text}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => {
      let color = status === 'Active' ? 'var(--accent-primary)' : 'var(--accent-danger)';
      return <span style={{ color, fontWeight: 700 }}>{status}</span>;
    }}
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >
      <motion.div variants={itemVariants} style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5 }}>AGENCY OWNER VIEW</Text>
          <Title level={2} style={{ margin: '4px 0 8px 0', fontWeight: 800 }}>Agency Administration</Title>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>High-level overview of your agency's financial health, operations, and team performance.</Text>
        </div>
        <DatePicker 
          picker="month" 
          value={selectedDate} 
          onChange={(date) => setSelectedDate(date)} 
          placeholder="All Time"
          style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600 }}
          allowClear
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
          {stats.map((stat, idx) => (
            <Col xs={24} sm={12} lg={8} xl={4} key={idx}>
              <SlabCard 
                bodyStyle={{ padding: '24px 16px', height: '100%', cursor: 'pointer' }}
                onClick={() => handleStatClick(stat)}
                className="hover-scale"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ background: 'var(--bg-tertiary)', padding: 10, borderRadius: 12, border: '1px solid var(--border-color)', color: stat.color }}>{stat.icon}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${stat.color}15`, color: stat.color, padding: '4px 8px', borderRadius: 8, fontWeight: 700, fontSize: 12 }}>
                    {stat.trend === 'up' ? <ArrowUpRight size={14}/> : stat.trend === 'down' ? <ArrowDownRight size={14}/> : <Activity size={14}/>}
                  </div>
                </div>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>{stat.label}</Text>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{stat.value}</div>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 500, marginTop: 4, display: 'block' }}>{stat.sub}</Text>
              </SlabCard>
            </Col>
          ))}
        </Row>
      </motion.div>

      <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
        <Col xs={24} xl={16}>
          <motion.div variants={itemVariants} style={{ height: '100%' }}>
            <Card 
              title={<span style={{ fontWeight: 800, fontSize: 18 }}>Revenue Overview</span>}
              className="glassmorphism"
              style={{ borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden', height: '100%' }}
              headStyle={{ borderBottom: '1px solid var(--border-color)', padding: '20px 24px' }}
              bodyStyle={{ padding: 24, height: 350 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <Tooltip 
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--accent-primary)', fontWeight: 700 }}
                    formatter={(value) => [`₹${value}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} xl={8}>
          <motion.div variants={itemVariants} style={{ height: '100%' }}>
            <Card 
              title={<span style={{ fontWeight: 800, fontSize: 18 }}>Recent Activities</span>}
              className="glassmorphism"
              style={{ borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden', height: '100%' }}
              headStyle={{ borderBottom: '1px solid var(--border-color)', padding: '20px 24px' }}
              bodyStyle={{ padding: '0 24px' }}
            >
              <List
                itemLayout="horizontal"
                dataSource={dashboardData.recentActivities || []}
                renderItem={(item) => (
                  <List.Item style={{ borderBottom: '1px solid var(--border-color)', padding: '16px 0' }}>
                    <List.Item.Meta
                      avatar={
                        <Avatar 
                          style={{ 
                            background: item.type === 'invoice' ? 'var(--accent-primary)20' : 
                                        item.type === 'client' ? 'var(--accent-secondary)20' : 
                                        'var(--accent-warning)20',
                            color: item.type === 'invoice' ? 'var(--accent-primary)' : 
                                   item.type === 'client' ? 'var(--accent-secondary)' : 
                                   'var(--accent-warning)'
                          }}
                          icon={item.type === 'invoice' ? <FileText size={16}/> : item.type === 'client' ? <Briefcase size={16}/> : <CheckCircle size={16}/>} 
                        />
                      }
                      title={<span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>}
                      description={<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.time}</span>}
                    />
                  </List.Item>
                )}
              />
              {(!dashboardData.recentActivities || dashboardData.recentActivities.length === 0) && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>No recent activities.</div>
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>

      <motion.div variants={itemVariants}>
        <Card 
          title={<span style={{ fontWeight: 800, fontSize: 18 }}>Team Performance & Allocations</span>}
          extra={<Button type="primary" onClick={() => navigate('/agency/settings', { state: { activeTab: '7' } })} style={{ background: 'var(--accent-primary)', fontWeight: 700, borderRadius: 8 }}>Manage Team</Button>}
          className="glassmorphism"
          style={{ borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}
          headStyle={{ borderBottom: '1px solid var(--border-color)', padding: '20px 24px' }}
          bodyStyle={{ padding: 0 }}
        >
          <Table columns={columns} dataSource={dashboardData.teamPerformance} pagination={false}  />
        </Card>
      </motion.div>

      <Modal
        title={<span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>{modalTitle}</span>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
        styles={{ 
          body: { padding: '24px 0 0 0' },
          content: { borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }
        }}
      >
        {renderModalContent()}
      </Modal>
    </motion.div>
  );
};

export default AgencyAdminDashboardTab;
