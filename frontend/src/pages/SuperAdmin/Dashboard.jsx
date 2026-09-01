import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Table, Tag, message } from 'antd';
import { motion } from 'framer-motion';
import { Building2, Users, CreditCard, TrendingUp, ArrowUpRight, Activity } from 'lucide-react';
import api from '../../services/api';

const { Title, Text } = Typography;

const Dashboard = () => {
  const [stats, setStats] = useState([
    { title: 'Total Agencies', value: '0', prefix: <Building2 size={20} /> },
    { title: 'Active Agencies', value: '0', prefix: <Activity size={20} /> },
    { title: 'MRR', value: '₹0', prefix: <CreditCard size={20} /> },
    { title: 'New Agencies (30d)', value: '0', prefix: <ArrowUpRight size={20} /> },
    { title: 'Active Users', value: '0', prefix: <Users size={20} /> },
    { title: 'Churn Rate', value: '0%', prefix: <TrendingUp size={20} /> },
  ]);
  const [recentCompanies, setRecentCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, agenciesRes] = await Promise.all([
        api.get('/superadmin/dashboard-stats'),
        api.get('/agencies')
      ]);

      const data = statsRes.data.data;
      setStats([
        { title: 'Total Agencies', value: data.totalCompanies.toString(), prefix: <Building2 size={20} /> },
        { title: 'Active Agencies', value: data.activeAgencies.toString(), prefix: <Activity size={20} /> },
        { title: 'MRR', value: `₹${data.mrr.toLocaleString()}`, prefix: <CreditCard size={20} /> },
        { title: 'New Agencies (30d)', value: data.newAgencies.toString(), prefix: <ArrowUpRight size={20} /> },
        { title: 'Active Users', value: data.activeUsers.toString(), prefix: <Users size={20} /> },
        { title: 'Churn Rate', value: data.churnRate, prefix: <TrendingUp size={20} /> },
      ]);

      // Just take the first 5 for recent
      setRecentCompanies(agenciesRes.data.data.slice(0, 5).map(item => ({
        key: item._id,
        name: item.name || item.companyName || 'Unknown',
        plan: item.plan ? (typeof item.plan === 'object' ? item.plan.name : item.plan.charAt(0).toUpperCase() + item.plan.slice(1)) : 'Custom',
        status: item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Active',
        mrr: `₹${item.mrr || 0}`,
        joined: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'
      })));

    } catch (error) {
      message.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const columns = [
    {
      title: 'Company Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{text}</Text>,
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      key: 'plan',
      render: (plan) => (
        <Tag color={plan === 'Enterprise' ? 'purple' : plan === 'Pro' ? 'blue' : 'default'} style={{ borderRadius: 12, px: 8 }}>
          {plan}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'green';
        if (status === 'Trial') color = 'orange';
        if (status === 'Churned') color = 'red';
        return <Tag color={color} style={{ borderRadius: 12 }}>{status}</Tag>;
      },
    },
    {
      title: 'MRR',
      dataIndex: 'mrr',
      key: 'mrr',
      render: (text) => <Text style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{text}</Text>,
    },
    {
      title: 'Joined Date',
      dataIndex: 'joined',
      key: 'joined',
      render: (text) => <Text type="secondary">{text}</Text>,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800, color: 'var(--text-primary)' }}>
          Platform Command Center
        </Title>
        <Text type="secondary" style={{ fontSize: 16 }}>
          Monitor platform performance and metrics.
        </Text>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={8} xl={4} key={index}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              style={{ height: '100%' }}
            >
              <Card 
                className="glassmorphism hover-lift"
                style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', height: '100%' }}
                bodyStyle={{ padding: 24 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ background: 'var(--bg-tertiary)', padding: 10, borderRadius: 12, color: 'var(--accent-primary)' }}>
                    {stat.prefix}
                  </div>
                </div>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 4 }}>{stat.title}</Text>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{stat.value}</div>
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card 
              title={<span style={{ fontWeight: 700, fontSize: 18 }}>Recent Agencies</span>}
              className="glassmorphism"
              style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', height: '100%' }}
              headStyle={{ borderBottom: '1px solid var(--border-color)', padding: '20px 24px' }}
              bodyStyle={{ padding: 0 }}
            >
              <Table 
                columns={columns} 
                dataSource={recentCompanies} 
                loading={loading}
                pagination={false}
                
                locale={{ emptyText: 'No recent agencies found' }}
              />
            </Card>
          </motion.div>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
