import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Table, Button, Avatar, message, Skeleton, DatePicker, List } from 'antd';
import dayjs from 'dayjs';
import { ArrowUpRight, ArrowDownRight, CheckSquare, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart } from 'recharts';
import SlabCard from '../../../components/SlabCard';
import api from '../../../services/api';

const { Title, Text } = Typography;

const PerformanceTab = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([]);
  const [clients, setClients] = useState([]);
  const [team, setTeam] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [projectStats, setProjectStats] = useState({});
  const [selectedDate, setSelectedDate] = useState(dayjs());

  useEffect(() => {
    fetchPerformanceData(selectedDate);
  }, [selectedDate]);

  const fetchPerformanceData = async (date) => {
    try {
      setLoading(true);
      const res = await api.get('/agency/performance', {
        params: {
          month: date.month(),
          year: date.year()
        }
      });
      const { stats, clients, team, chartData, projectStats } = res.data.data;
      setStats(stats);
      setClients(clients);
      setTeam(team);
      setChartData(chartData);
      setProjectStats(projectStats);
    } catch (error) {
      console.error('Failed to fetch agency performance:', error);
      message.error('Failed to load performance data');
    } finally {
      setLoading(false);
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
    ...['MOS', 'SEO', 'AEO', 'ADS', 'LEADS', 'SOCIAL', 'WEB', 'GEO', 'REV', 'CX'].map(col => ({
      title: col,
      dataIndex: col.toLowerCase(),
      key: col.toLowerCase(),
      render: (val) => <span style={{ color: getStatusColor(val), fontWeight: 800 }}>{val}</span>
    }))
  ];

  if (loading) {
    return <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 10 }} /></div>;
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >

      <motion.div variants={itemVariants} style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Agency Performance</Title>
        <DatePicker
          picker="month"
          value={selectedDate}
          onChange={(date) => { if (date) setSelectedDate(date); }}
          size="large"
          style={{ borderRadius: 8, fontWeight: 600, width: 200 }}
          allowClear={false}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
          {stats.map((stat, idx) => (
            <Col xs={24} sm={12} lg={6} key={idx}>
              <SlabCard bodyStyle={{ padding: '24px' }}>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, display: 'block', marginBottom: 16 }}>{stat.label}</Text>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: stat.color }}>
                  {stat.trend === 'up' ? <ArrowUpRight size={16} /> : (stat.trend === 'down' ? <ArrowDownRight size={16} /> : <div style={{ width: 16 }}></div>)}
                  {stat.sub}
                </div>
              </SlabCard>
            </Col>
          ))}
        </Row>
      </motion.div>

      <motion.div variants={itemVariants} style={{ marginBottom: 40 }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border-color)', padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={5} style={{ margin: 0, fontWeight: 800 }}>Profit & Loss Trend</Title>
              </div>
              <div style={{ height: 300, width: '100%' }}>
                <ResponsiveContainer>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.05)', fontWeight: 600 }}
                      itemStyle={{ fontSize: 13 }}
                      labelStyle={{ fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}
                      formatter={(value) => `₹${value.toLocaleString()}`}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} barSize={30} />
                    <Bar dataKey="expenses" name="Expenses" fill="var(--accent-danger)" radius={[4, 4, 0, 0]} barSize={30} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Col>
          <Col xs={24} lg={12}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border-color)', padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={5} style={{ margin: 0, fontWeight: 800 }}>Client Growth Trend</Title>
              </div>
              <div style={{ height: 300, width: '100%' }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.05)', fontWeight: 600 }}
                      itemStyle={{ fontSize: 13 }}
                      labelStyle={{ fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="totalClients" name="Total Clients" stroke="var(--accent-secondary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Col>
        </Row>
      </motion.div>

      <motion.div variants={itemVariants} style={{ marginBottom: 40 }}>
        <SlabCard bodyStyle={{ padding: '32px' }}>
          <Text style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: 24 }}>Team Performance — Top Performers</Text>
          <List
            dataSource={team}
            pagination={{ defaultPageSize: 5, showSizeChanger: true, pageSizeOptions: ['5', '10', '20'] }}
            renderItem={(member, idx) => (
              <List.Item style={{ padding: 0, border: 'none', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'var(--bg-tertiary)', borderRadius: 12, border: '1px solid var(--border-color)', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: 220 }}>
                    <Avatar style={{ backgroundColor: 'var(--text-tertiary)', fontWeight: 700 }}>{member.initials}</Avatar>
                    <Text style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{member.name}</Text>
                  </div>
                  <Text style={{ color: 'var(--text-primary)', fontWeight: 800, width: 120 }}>Tasks Completed: {member.tasksCompleted}</Text>
                  <Text style={{ color: 'var(--text-secondary)', fontWeight: 600, width: 120 }}>Assigned: {member.tasksAssigned}</Text>
                  <Text style={{ color: 'var(--text-secondary)', fontWeight: 600, width: 100 }}>SLA {member.sla}</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 80, color: 'var(--text-primary)', fontWeight: 600 }}>
                    {member.status === 'good' ? (
                      <div style={{ background: 'var(--accent-primary)', color: '#fff', borderRadius: 4, padding: 2, display: 'flex' }}><CheckSquare size={14} /></div>
                    ) : (
                      <div style={{ background: 'var(--accent-warning)', color: '#fff', borderRadius: 4, padding: 2, display: 'flex' }}><AlertTriangle size={14} /></div>
                    )}
                  </div>
                </div>
              </List.Item>
            )}
          />
        </SlabCard>
      </motion.div>

      {/* <motion.div variants={itemVariants} style={{ marginBottom: 40 }}>
        <SlabCard bodyStyle={{ padding: 0 }}>
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>Client Performance Overview (MOS)</Text>
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Live computed scores based on tasks and delays</Text>
            </div>
          </div>
          <Table
            dataSource={clients}
            columns={columns}
            pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }}
            rowKey="code"
            style={{ width: '100%' }}

          />
        </SlabCard>
      </motion.div> */}

    </motion.div>
  );
};

export default PerformanceTab;
