import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Button, Table, Tag, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, Users, Zap, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import BubbleCard from '../../../components/BubbleCard';
import ClientDeliverablesWidget from '../components/ClientDeliverablesWidget';

const { Title, Text } = Typography;

const BrandAdminDashboardTab = () => {
  const navigate = useNavigate();
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch users', error);
      message.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const overviewStats = [
    { label: 'TOTAL MARKETING SPEND', value: '₹0', trend: '0.0% MoM', icon: <CreditCard size={20}/>, color: 'var(--accent-primary)' },
    { label: 'ACTIVE TEAM SEATS', value: `${users.filter(u => u.status === 'active').length}`, trend: 'Active members', icon: <Users size={20}/>, color: 'var(--accent-secondary)' },
    { label: 'BRAND ROI', value: '0.0x', trend: '0.0x MoM', icon: <Zap size={20}/>, color: 'var(--accent-warning)' },
  ];

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (text) => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
    { title: 'Role', dataIndex: 'role', key: 'role', render: (text) => <Tag style={{ borderRadius: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>{text.replace(/_/g, ' ').toUpperCase()}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => {
      const displayStatus = status === 'active' ? 'Active' : 'Pending Invite';
      return (
        <span style={{ color: displayStatus === 'Active' ? 'var(--accent-primary)' : 'var(--accent-warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          {displayStatus === 'Active' ? <CheckCircle2 size={14}/> : <div style={{width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-warning)'}}/>}
          {displayStatus}
        </span>
      );
    }},
    { title: 'Actions', key: 'actions', align: 'right', render: () => <Button type="link" onClick={() => navigate('/client/users')} style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>Manage</Button> }
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >
      <motion.div variants={itemVariants} style={{ marginBottom: 32 }}>
        <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5 }}>BRAND ADMIN PORTAL</Text>
        <Title level={2} style={{ margin: '4px 0 8px 0', fontWeight: 800 }}>Brand Administration</Title>
        <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>Manage your brand's workspace, billing, and team members.</Text>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
          {overviewStats.map((stat, idx) => (
            <Col xs={24} md={8} key={idx}>
              <BubbleCard bodyStyle={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 12, border: '1px solid var(--border-color)', color: stat.color }}>{stat.icon}</div>
                  <Text type="secondary" style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>{stat.label}</Text>
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{stat.value}</div>
                <div style={{ color: stat.color, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowUpRight size={16} /> {stat.trend}
                </div>
              </BubbleCard>
            </Col>
          ))}
        </Row>
      </motion.div>

      <ClientDeliverablesWidget />

      <motion.div variants={itemVariants}>
        <Card 
          title={<span style={{ fontWeight: 800, fontSize: 18 }}>Workspace Members</span>}
          extra={<Button type="primary" onClick={() => navigate('/client/users')} style={{ background: 'var(--accent-primary)', fontWeight: 700, borderRadius: 8 }}>+ Create User</Button>}
          className="glassmorphism"
          style={{ borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}
          headStyle={{ borderBottom: '1px solid var(--border-color)', padding: '20px 24px' }}
          bodyStyle={{ padding: 0 }}
        >
          <Table columns={columns} dataSource={users.slice(0, 5)} loading={loading} rowKey="_id" pagination={false}  />
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default BrandAdminDashboardTab;
