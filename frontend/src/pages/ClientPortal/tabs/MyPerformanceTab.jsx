import React, { useState } from 'react';
import { Typography, Row, Col, Button, Tag, Progress, Table } from 'antd';
import { motion } from 'framer-motion';
import { Download, ChevronDown, CheckCircle2, ArrowUpRight, ArrowRight, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import BubbleCard from '../../../components/BubbleCard';

const { Title, Text } = Typography;

const MyPerformanceTab = () => {
  const [activeSubTab, setActiveSubTab] = useState('website');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const signals = [
    { name: 'Website Health', value: 88 },
    { name: 'SEO Performance', value: 91 },
    { name: 'GMB Visibility', value: 72 },
    { name: 'Social Media', value: 79 },
    { name: 'Performance Ads', value: 86 },
    { name: 'Lead Generation', value: 83 },
    { name: 'Revenue Impact', value: 78 },
    { name: 'Client Experience', value: 90 },
  ];

  const topStats = [
    { label: 'WEBSITE SESSIONS', value: '48,200', trend: '↑ 18%', vs: 'vs May 2026', color: 'var(--accent-primary)' },
    { label: 'LEADS GENERATED', value: '142', trend: '↑ 23%', vs: 'vs May 2026', color: 'var(--accent-primary)' },
    { label: 'ROAS', value: '4.2x', trend: '↑ 0.4x', vs: 'vs May 2026', color: 'var(--accent-primary)' },
    { label: 'COST PER LEAD', value: '₹5,929', trend: '↓ 240', vs: 'vs May 2026', color: 'var(--accent-primary)' },
    { label: 'SOCIAL REACH', value: '2.8M', trend: '↑ 11%', vs: 'vs May 2026', color: 'var(--accent-primary)' },
    { label: 'KEYWORDS TRACKED', value: '142', trend: '↑ 12', vs: 'vs May 2026', color: 'var(--accent-primary)' },
  ];

  const subStats = [
    { label: 'SESSIONS', value: '48,200', trend: '↑ 18%', vs: 'vs May 2026' },
    { label: 'USERS', value: '34,800', trend: '↑ 14%', vs: 'vs May 2026' },
    { label: 'AVG DURATION', value: '3m 42s', trend: '↑ 8%', vs: 'vs May 2026' },
    { label: 'BOUNCE RATE', value: '42.1%', trend: '↓ 3.2%', vs: 'vs May 2026' },
  ];

  // Dummy area chart data
  const trafficData = [
    { name: '1 Jun', organic: 4000, paid: 2400, direct: 2400 },
    { name: '5 Jun', organic: 3000, paid: 1398, direct: 2210 },
    { name: '10 Jun', organic: 2000, paid: 9800, direct: 2290 },
    { name: '15 Jun', organic: 2780, paid: 3908, direct: 2000 },
    { name: '20 Jun', organic: 1890, paid: 4800, direct: 2181 },
    { name: '25 Jun', organic: 2390, paid: 3800, direct: 2500 },
    { name: '30 Jun', organic: 3490, paid: 4300, direct: 2100 },
  ];

  const donutData = [
    { name: 'Organic', value: 55, color: '#0d9488' },
    { name: 'Paid', value: 35, color: 'var(--accent-primary)' },
    { name: 'Direct', value: 10, color: '#94a3b8' },
  ];

  const topPages = [
    { page: '/homepage', sessions: '12,400', bounce: '38%', duration: '2m 12s', conv: '4.2%' },
    { page: '/projects/somerville', sessions: '8,200', bounce: '31%', duration: '4m 48s', conv: '8.1%' },
    { page: '/projects/luxury', sessions: '6,100', bounce: '29%', duration: '5m 12s', conv: '0.4%' },
    { page: '/blog/top-10-projects', sessions: '4,800', bounce: '52%', duration: '3m 02s', conv: '1.8%' },
    { page: '/projects/whitefield', sessions: '3,200', bounce: '34%', duration: '4m 28s', conv: '7.2%' },
  ];

  const columns = [
    { title: 'PAGE', dataIndex: 'page', key: 'page', render: text => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{text}</span> },
    { title: 'SESSIONS', dataIndex: 'sessions', key: 'sessions', render: text => <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{text}</span> },
    { title: 'BOUNCE', dataIndex: 'bounce', key: 'bounce', render: text => <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{text}</span> },
    { title: 'DURATION', dataIndex: 'duration', key: 'duration', render: text => <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{text}</span> },
    { title: 'CONV', dataIndex: 'conv', key: 'conv', render: text => <span style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{text}</span> },
  ];

  const devices = [
    { name: 'Mobile', value: 62 },
    { name: 'Desktop', value: 32 },
    { name: 'Tablet', value: 6 },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >
      
      <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>My Performance</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>Full channel breakdown for Prestige Estates</Text>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: 6, borderRadius: 12, border: '1px solid var(--border-color)' }}>
          {['This Month', 'Last Month', 'Last Quarter', 'Last 6 Months', 'Custom ▾'].map((filter, idx) => (
            <Button key={filter} type="text" style={{ background: idx === 0 ? 'var(--accent-primary)' : 'transparent', color: idx === 0 ? '#fff' : 'var(--text-secondary)', fontWeight: 700, borderRadius: 8 }}>
              {filter}
            </Button>
          ))}
        </div>
        <Button type="primary" icon={<Download size={16} />} style={{ background: 'var(--accent-primary)', fontWeight: 700, borderRadius: 8, height: 40 }}>
          Download Report
        </Button>
      </motion.div>

      <motion.div variants={itemVariants} style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 13, fontWeight: 600, fontStyle: 'italic' }}>Showing data for: <strong style={{ color: 'var(--text-primary)' }}>June 2026</strong> <span style={{ margin: '0 4px' }}>- vs</span> May 2026</Text>
      </motion.div>

      {/* Dark MOS Score Section */}
      <motion.div variants={itemVariants} style={{ marginBottom: 40 }}>
        <BubbleCard bodyStyle={{ padding: '48px', background: '#0f172a', borderRadius: 24, color: '#fff' }} style={{ background: '#0f172a', border: 'none' }}>
          <Row gutter={[48, 48]} align="middle">
            <Col xs={24} md={10} style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, display: 'block', marginBottom: 32 }}>MARKETING OPERATING SCORE</Text>
              <div style={{ position: 'relative', width: 140, height: 140, marginBottom: 24 }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--accent-primary)" strokeWidth="3" strokeDasharray="84, 100" strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 44, fontWeight: 800, color: '#fff', lineHeight: 1 }}>84</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginTop: 4 }}>/100</span>
                </div>
              </div>
              <Tag style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, padding: '4px 12px', fontSize: 12, marginBottom: 12 }}>
                EXCELLENT
              </Tag>
              <Text style={{ display: 'block', color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Top 20% in Real Estate</Text>
              <Text style={{ display: 'block', color: 'var(--accent-primary)', fontSize: 14, fontWeight: 800, marginBottom: 8 }}>↑ +3 pts vs May 2026</Text>
              <Text style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 500, marginBottom: 16 }}>Score for June 2026</Text>
              <Button type="link" style={{ padding: 0, color: 'var(--accent-primary)', fontWeight: 700 }}>What is MOS?</Button>
              <Text style={{ display: 'block', color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600, marginTop: 16 }}>Powered by M1 Intelligence</Text>
            </Col>
            
            <Col xs={24} md={14}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 800, display: 'block', marginBottom: 4 }}>8 Signal Breakdown</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 32 }}>What makes up your 84/100</Text>
              
              <Row gutter={[48, 24]}>
                {signals.map((sig, idx) => (
                  <Col span={12} key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600 }}>{sig.name}</Text>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>{sig.value}</Text>
                    </div>
                    <Progress percent={sig.value} showInfo={false} strokeColor="var(--accent-primary)" trailColor="rgba(255,255,255,0.1)" size="small" />
                  </Col>
                ))}
              </Row>
            </Col>
          </Row>
        </BubbleCard>
      </motion.div>

      {/* Top 6 Stats */}
      <motion.div variants={itemVariants}>
        <Row gutter={[16, 16]} style={{ marginBottom: 40 }}>
          {topStats.map((stat, idx) => (
            <Col xs={12} md={8} lg={4} key={idx}>
              <BubbleCard bodyStyle={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Text style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 800, letterSpacing: 1, display: 'block', marginBottom: 12 }}>{stat.label}</Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                  <Text style={{ color: stat.color, fontWeight: 800, fontSize: 12 }}>{stat.trend}</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 500, marginTop: 4 }}>{stat.vs}</Text>
              </BubbleCard>
            </Col>
          ))}
        </Row>
      </motion.div>

      {/* Sub Tabs */}
      <motion.div variants={itemVariants} style={{ marginBottom: 24, borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 32 }}>
        {['Website', 'SEO', 'Ads', 'Social', 'Leads', 'AI Search'].map(tab => (
          <div 
            key={tab}
            onClick={() => setActiveSubTab(tab.toLowerCase())}
            style={{ 
              paddingBottom: 16, 
              cursor: 'pointer',
              color: activeSubTab === tab.toLowerCase() ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeSubTab === tab.toLowerCase() ? 800 : 600,
              borderBottom: activeSubTab === tab.toLowerCase() ? '3px solid var(--accent-primary)' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            {tab}
          </div>
        ))}
      </motion.div>

      {/* Sub Stats Row */}
      <motion.div variants={itemVariants}>
        <Row gutter={[16, 16]} style={{ marginBottom: 40 }}>
          {subStats.map((stat, idx) => (
            <Col xs={12} lg={6} key={idx}>
              <BubbleCard bodyStyle={{ padding: '24px' }}>
                <Text style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 800, letterSpacing: 1, display: 'block', marginBottom: 12 }}>{stat.label}</Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: stat.trend.includes('↑') ? 'var(--accent-primary)' : 'var(--accent-danger)', fontWeight: 800, fontSize: 13 }}>{stat.trend}</Text>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>{stat.vs}</Text>
                </div>
              </BubbleCard>
            </Col>
          ))}
        </Row>
      </motion.div>

      <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
        {/* Area Chart */}
        <Col xs={24} lg={16}>
          <motion.div variants={itemVariants} style={{ height: '100%' }}>
            <BubbleCard style={{ height: '100%' }} bodyStyle={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Text style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: 24 }}>Traffic by Source</Text>
              <div style={{ flex: 1, minHeight: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trafficData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--text-secondary)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--text-secondary)' }} dx={-10} />
                    <RechartsTooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-md)' }} />
                    <Area type="monotone" dataKey="organic" stackId="1" stroke="#0d9488" fill="#0d9488" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="paid" stackId="1" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="direct" stackId="1" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </BubbleCard>
          </motion.div>
        </Col>

        {/* Donut Chart */}
        <Col xs={24} lg={8}>
          <motion.div variants={itemVariants} style={{ height: '100%' }}>
            <BubbleCard style={{ height: '100%' }} bodyStyle={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Text style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: 24 }}>Traffic Sources</Text>
              <div style={{ flex: 1, minHeight: 250, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value" stroke="none">
                      {donutData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
                {donutData.map((entry, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color }} />
                    <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{entry.name}</Text>
                  </div>
                ))}
              </div>
            </BubbleCard>
          </motion.div>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
        {/* Top Pages Table */}
        <Col xs={24} lg={16}>
          <motion.div variants={itemVariants}>
            <BubbleCard bodyStyle={{ padding: '24px 0 0 0' }}>
              <Text style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: 16, paddingLeft: 24 }}>Top Pages</Text>
              <Table 
                dataSource={topPages} 
                columns={columns} 
                pagination={false} 
                rowKey="page"
                
                style={{ width: '100%' }}
              />
            </BubbleCard>
          </motion.div>
        </Col>

        {/* Devices */}
        <Col xs={24} lg={8}>
          <motion.div variants={itemVariants}>
            <BubbleCard bodyStyle={{ padding: 24 }}>
              <Text style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: 24 }}>Devices</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {devices.map((device, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{device.name}</Text>
                      <Text style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{device.value}%</Text>
                    </div>
                    <Progress percent={device.value} showInfo={false} strokeColor="var(--accent-primary)" trailColor="var(--bg-secondary)" size="small" />
                  </div>
                ))}
              </div>
            </BubbleCard>
          </motion.div>
        </Col>
      </Row>

      {/* Summary Section */}
      <motion.div variants={itemVariants}>
        <BubbleCard bodyStyle={{ padding: 32, background: 'rgba(16, 185, 129, 0.03)' }} style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
          <Title level={4} style={{ margin: '0 0 24px 0', fontWeight: 800, color: 'var(--text-primary)' }}>June 2026 — Your Month in Summary</Title>
          <Row gutter={48}>
            <Col xs={24} md={12}>
              <Text style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, textTransform: 'uppercase' }}>
                🏆 THIS PERIOD'S WINS
              </Text>
              <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  'MOS Score hit all-time high of 84/100',
                  '142 leads — best month ever (+23%)',
                  'ROAS improved to 4.2x — 6th consecutive month of growth',
                  '3 new #1 keyword rankings achieved',
                  'GEO score crossed 70 — top 20% of Real Estate industry',
                  '2 bookings confirmed from last month\'s leads'
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <CheckCircle2 size={16} color="var(--accent-primary)" />
                    <Text style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{item}</Text>
                  </li>
                ))}
              </ul>
            </Col>
            <Col xs={24} md={12} style={{ marginTop: { xs: 32, md: 0 } }}>
              <Text style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, textTransform: 'uppercase' }}>
                🎯 WHAT WE'RE FOCUSED ON NEXT
              </Text>
              <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  'Launch Q3 awareness campaign (budget ₹10L)',
                  'Publish 4 new SEO-optimized blog posts',
                  'Implement schema on 3 pages (+est. 6 GEO pts)',
                  "Target 'apartments for sale bangalore' — currently #7, target #3"
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 16, height: 2, background: 'var(--accent-warning)', borderRadius: 2 }} />
                    <Text style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{item}</Text>
                  </li>
                ))}
              </ul>
            </Col>
          </Row>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <Button type="link" style={{ padding: 0, fontWeight: 700, color: 'var(--accent-secondary)' }}>Questions? Chat with your Account Manager →</Button>
            <Button type="link" style={{ padding: 0, fontWeight: 700, color: 'var(--accent-secondary)' }}>Download Full Report →</Button>
          </div>
        </BubbleCard>
      </motion.div>

    </motion.div>
  );
};

export default MyPerformanceTab;
