import React, { useState } from 'react';
import { Typography, Row, Col, Card, Button, Select, Avatar, Tag } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { Download, Calendar as CalendarIcon, Camera, MessageSquare, Briefcase, Video, Image as ImageIcon, Edit3, X, Heart, MessageCircle, Share2, TrendingUp } from 'lucide-react';
import { socialPosts, organicTrafficSparkline } from '../../data/mock';

import GenerateSocialReportModal from './components/GenerateSocialReportModal';

const { Title, Text } = Typography;
const { Option } = Select;

const SocialMedia = () => {
  const [activeTab, setActiveTab] = useState('Instagram');
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Expand to 30 days
  const expandedReach = Array.from({ length: 30 }, (_, i) => ({ day: i + 1, reach: 10000 + Math.random() * 10000 + (i > 15 ? 5000 : 0) }));

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

  const platforms = [
    { id: 'Instagram', icon: <Camera size={16} />, color: 'var(--accent-secondary)' },
    { id: 'Facebook', icon: <MessageSquare size={16} />, color: 'var(--accent-info)' },
    { id: 'LinkedIn', icon: <Briefcase size={16} />, color: 'var(--accent-primary)' },
    { id: 'YouTube', icon: <Video size={16} />, color: 'var(--accent-danger)' }
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>

          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>Social Media</Title>
          <Text type="secondary">Publish, schedule, and measure social performance across platforms.</Text>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select defaultValue="Prestige Estates" style={{ width: 200, fontWeight: 600 }} size="large"><Option value="Prestige Estates">Prestige Estates</Option></Select>
          <Button 
            icon={<Download size={16} />} 
            onClick={() => setReportModalOpen(true)}
            style={{ borderRadius: 8, height: 40, borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-secondary)', fontWeight: 600 }}
          >
            Export Report
          </Button>
          <Button type="primary" icon={<CalendarIcon size={16} />} style={{ borderRadius: 8, height: 40, background: 'var(--accent-primary)', border: 'none', boxShadow: 'var(--shadow-md)', fontWeight: 600 }}>Schedule Post</Button>
        </div>
      </motion.div>

      {/* NEW CENTERED MONOLITH CARDS WITH GLOWING UNDERLINE */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'TOTAL REACH (MTD)', val: '2.8M', sub: '▲ +11%', color: 'var(--accent-secondary)' },
          { label: 'IMPRESSIONS', val: '8.4M', sub: '▲ +9%', color: 'var(--accent-info)' },
          { label: 'ENGAGEMENT RATE', val: '4.2%', sub: '▲ +0.3%', color: 'var(--accent-warning)' },
          { label: 'FOLLOWERS GROWTH', val: '+1,240', sub: 'This month', color: 'var(--accent-primary)' },
          { label: 'POSTS PUBLISHED', val: '28', sub: 'This month', color: 'var(--accent-danger)' }
        ].map((kpi, i) => (
          <Col style={{ flex: '1 1 200px', minWidth: 200 }} key={i}>
            <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: '100%' }}>
              <Card
                bodyStyle={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', height: '100%' }}
                style={{
                  borderRadius: 16,
                  height: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderBottom: `4px solid ${kpi.color}`,
                  boxShadow: `0 4px 12px ${kpi.color}15`
                }}
              >
                <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{kpi.label}</Text>
                <Title level={1} style={{ margin: '12px 0 8px', color: 'var(--text-primary)', fontSize: 32, fontWeight: 800 }}>{kpi.val}</Title>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
                  {kpi.sub.includes('▲') && <TrendingUp size={14} color="var(--accent-primary)" />}
                  <Text style={{ fontSize: 13, fontWeight: 600, color: kpi.sub.includes('▲') ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{kpi.sub.replace('▲ ', '')}</Text>
                </div>
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>

      <motion.div variants={itemVariants}>
        <div className="glassmorphism" style={{ borderRadius: 16, padding: '24px', marginBottom: 24, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          {/* INTERACTIVE PILL TABS */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
            {platforms.map(tab => (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 24,
                  fontWeight: 600,
                  background: activeTab === tab.id ? tab.color : 'transparent',
                  color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                  border: activeTab === tab.id ? `1px solid ${tab.color}` : '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: activeTab === tab.id ? `0 4px 12px ${tab.color}40` : 'none'
                }}
              >
                <span style={{ color: activeTab === tab.id ? '#fff' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>{tab.icon}</span>
                {tab.id}
              </div>
            ))}
          </div>

          <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
            {[
              { label: 'FOLLOWERS', val: '48,200', sub: '+1,040 this month' },
              { label: 'AVG ENGAGEMENT', val: '4.8%', sub: 'Above industry avg' },
              { label: 'REACH PER POST', val: '18,400', sub: 'Last 30 days' },
            ].map((kpi, i) => (
              <Col style={{ flex: '1 1 200px', minWidth: 200 }} key={i}>
                <div style={{ padding: '0 20px', borderRight: i < 2 ? '1px solid var(--border-color)' : 'none' }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{kpi.label}</Text>
                  <Title level={2} style={{ margin: '8px 0 4px', color: 'var(--text-primary)', fontWeight: 800 }}>{kpi.val}</Title>
                  <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>{kpi.sub}</Text>
                </div>
              </Col>
            ))}
          </Row>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
              <div>
                <Title level={5} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Reach trend</Title>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Daily reach over the last 30 days</Text>
              </div>
            </div>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={expandedReach} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="day" stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} dy={10} />
                  <YAxis stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} tickFormatter={val => `${val / 1000}K`} dx={-10} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, boxShadow: 'var(--shadow-md)', fontWeight: 600 }}
                    itemStyle={{ color: 'var(--accent-secondary)' }}
                  />
                  {/* Dynamic color based on active tab */}
                  <Line type="monotone" dataKey="reach" stroke={platforms.find(p => p.id === activeTab)?.color || 'var(--accent-secondary)'} strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: platforms.find(p => p.id === activeTab)?.color }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} style={{ marginBottom: 16, marginTop: 40 }}>
        <Title level={5} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Recent posts</Title>
        <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Top-performing content this month</Text>
      </motion.div>

      <Row gutter={[20, 20]} style={{ marginBottom: 40 }}>
        {socialPosts.map((post, i) => (
          <Col xs={24} sm={12} lg={8} key={post.id}>
            <motion.div variants={itemVariants} whileHover={{ y: -6, transition: { duration: 0.2 } }} style={{ height: '100%' }}>
              <Card
                bodyStyle={{ padding: 20, display: 'flex', flexDirection: 'column', height: '100%' }}
                style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)', height: '100%' }}
              >
                <div style={{ background: 'var(--bg-tertiary)', height: 200, borderRadius: 12, marginBottom: 20, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <ImageIcon size={32} color="var(--text-tertiary)" />
                </div>
                <strong style={{ display: 'block', fontSize: 15, marginBottom: 16, minHeight: 44, color: 'var(--text-primary)', lineHeight: 1.4 }}>{post.title}</strong>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 'auto' }}>
                  <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>{post.date}</Text>
                  <Tag style={{ borderRadius: 12, border: 'none', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-primary)', margin: 0, fontWeight: 700, padding: '2px 8px' }}>ER {post.er}</Tag>
                </div>

                <div style={{ background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                  <Text strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>Reach: {post.reach}</Text>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Heart size={14} /> {post.likes}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MessageCircle size={14} /> {post.comments}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Share2 size={14} /> {post.shares}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>

      <motion.div variants={itemVariants}>
        <Card
          title={<div style={{ paddingTop: 8 }}><Title level={5} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Scheduled posts</Title><Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Queued for the next 30 days</Text></div>}
          className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: 24 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { title: 'June project highlights reel — Prestige Somerville flythrough.', date: 'Jun 12 · 11:00' },
              { title: 'Investor AMA recap — key takeaways from Saturday\'s session.', date: 'Jun 14 · 18:30' },
              { title: 'Carousel: Top 5 amenities every luxury buyer expects in 2026.', date: 'Jun 16 · 10:00' },
            ].map((item, i) => (
              <div key={i} style={{ border: '1px solid var(--border-color)', background: 'var(--bg-primary)', padding: '16px 20px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <div style={{ background: 'var(--bg-tertiary)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CalendarIcon size={20} color="var(--accent-secondary)" /></div>
                  <div>
                    <strong style={{ display: 'block', fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>{item.title}</strong>
                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>{item.date}</Text>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Button size="middle" icon={<Edit3 size={16} />} style={{ borderRadius: 8, fontWeight: 600, color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}>Edit</Button>
                  <Button size="middle" danger icon={<X size={16} />} style={{ borderRadius: 8, fontWeight: 600 }}>Cancel</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      <GenerateSocialReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        posts={socialPosts}
      />
    </motion.div>
  );
};

export default SocialMedia;
