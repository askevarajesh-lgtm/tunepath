import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Table, Button, Tag, message, Skeleton } from 'antd';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import SlabCard from '../../../components/SlabCard';
import api from '../../../services/api';

const { Title, Text } = Typography;

const BillingTab = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [donutData, setDonutData] = useState([]);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const res = await api.get('/agency/billing');
      const { stats, invoices, donutData } = res.data.data;
      setStats(stats);
      setInvoices(invoices);
      setDonutData(donutData);
    } catch (error) {
      console.error('Failed to fetch agency billing:', error);
      message.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action, record) => {
    if (action === 'Receipt') {
      try {
        message.loading({ content: 'Downloading receipt...', key: 'receiptDownload' });
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/invoices/${record.id}/pdf`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Failed to download invoice PDF');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Receipt_${record.invoice || 'Invoice'}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        message.success({ content: 'Receipt downloaded successfully', key: 'receiptDownload' });
      } catch (error) {
        console.error('Receipt download error:', error);
        message.error({ content: 'Failed to download receipt PDF', key: 'receiptDownload' });
      }
      return;
    }

    try {
      const res = await api.post(`/agency/billing/${record.id}/action`, { action });
      message.success(res.data.message || 'Payment link sent to client panel successfully');
    } catch (error) {
      console.error(`Billing action ${action} failed:`, error);
      message.error(error.response?.data?.message || `Failed to send payment link`);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  // Invoices replaced by state


  const getStatusColor = (val) => {
    if (val >= 70) return 'var(--accent-primary)';
    if (val >= 50) return 'var(--accent-warning)';
    return 'var(--accent-danger)';
  };

  const columns = [
    { 
      title: 'CLIENT', 
      key: 'client', 
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: getStatusColor(record.mos), color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {record.code}
          </div>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{record.name}</span>
        </div>
      )
    },
    { title: 'INVOICE', dataIndex: 'invoice', key: 'invoice', render: (val) => <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{val}</span> },
    { title: 'AMOUNT', dataIndex: 'amount', key: 'amount', render: (val) => <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{val}</span> },
    { 
      title: 'STATUS', 
      dataIndex: 'status', 
      key: 'status', 
      render: (val) => (
        <Tag style={{ 
          margin: 0, 
          border: 'none', 
          background: val === 'Paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
          color: val === 'Paid' ? 'var(--accent-primary)' : 'var(--accent-warning)', 
          fontWeight: 800, 
          borderRadius: 8, 
          padding: '4px 12px' 
        }}>
          {val}
        </Tag>
      ) 
    },
    { 
      title: 'ACTION', 
      key: 'action', 
      render: (_, record) => {
        const actionText = record.status === 'Paid' ? 'Receipt' : 'Send Link';
        return (
          <Button type="text" style={{ color: 'var(--accent-secondary)', fontWeight: 700, padding: 0 }} onClick={() => handleAction(actionText, record)}>
            {actionText}
          </Button>
        );
      }
    },
  ];

  // Donut data replaced by state

  if (loading) {
    return <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 10 }} /></div>;
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >
      
      <motion.div variants={itemVariants} style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Agency Billing</Title>
        <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>All client invoices and payments — {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
          {stats.map((stat, idx) => (
            <Col xs={24} sm={12} lg={6} key={idx}>
              <SlabCard bodyStyle={{ padding: '24px' }}>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, display: 'block', marginBottom: 16 }}>{stat.label}</Text>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: stat.subColor || stat.color }}>{stat.sub}</div>
              </SlabCard>
            </Col>
          ))}
        </Row>
      </motion.div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <motion.div variants={itemVariants} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <SlabCard style={{ flex: 1, display: 'flex', flexDirection: 'column' }} bodyStyle={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Text style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: 32 }}>Invoice Status</Text>
              
              <div style={{ position: 'relative', height: 280, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => `₹${value}L`}
                      contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, fontWeight: 600 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{stats[0]?.value || '₹0'}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>total</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-primary)' }} />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13 }}>Paid</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-warning)' }} />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13 }}>Pending</span>
                </div>
              </div>
            </SlabCard>
          </motion.div>
        </Col>

        <Col xs={24} lg={16}>
          <motion.div variants={itemVariants}>
            <SlabCard bodyStyle={{ padding: 0 }}>
              <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Invoices</Text>
              </div>
              <Table 
                dataSource={invoices} 
                columns={columns} 
                pagination={false} 
                rowKey="id"
                style={{ width: '100%' }}
                
              />
            </SlabCard>
          </motion.div>
        </Col>
      </Row>

    </motion.div>
  );
};

export default BillingTab;
