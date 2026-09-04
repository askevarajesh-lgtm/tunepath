import React, { useMemo, useState } from 'react';
import { Row, Col, Card, Typography, Select, Progress, Space, Avatar, Table, Button, Tag, Input } from 'antd';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TeamOutlined, FireOutlined, RiseOutlined, CheckCircleOutlined, TrophyOutlined, FilterOutlined, CalendarOutlined, FilePdfOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const AdminDashboard = ({ leads = [], onOpenReportModal }) => {
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const [timeframe, setTimeframe] = useState('All Time');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState(null);
  const [formNameFilter, setFormNameFilter] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState(null);

  const handleClearAll = () => {
    setTimeframe('All Time');
    setStatusFilter('All');
    setSourceFilter(null);
    setFormNameFilter(null);
    setOwnerFilter(null);
  };

  const getFormName = (lead) => {
    return lead?.customData?.form_name || lead?.customData?.formName || lead?.formName || '';
  };

  const getActualLeadDate = (lead) => {
    const customDate = lead?.customData?.created_time || lead?.customData?.createdTime || lead?.customData?.createdtime;
    if (customDate) {
      return dayjs(customDate);
    }
    return dayjs(lead?.createdAt);
  };

  const formNames = useMemo(() => {
    const names = new Set();
    leads.forEach(l => {
      const name = getFormName(l);
      if (name) names.add(name);
    });
    return Array.from(names);
  }, [leads]);

  const sourceOptions = useMemo(() => Array.from(new Set(leads.map(l => l.source).filter(Boolean))), [leads]);
  const ownerOptions = useMemo(() => Array.from(new Set(leads.map(l => l.assignedTo).filter(Boolean))), [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const leadDate = getActualLeadDate(l);
      if (timeframe === 'Month' && leadDate) {
        if (leadDate.isBefore(dayjs().subtract(30, 'day'))) return false;
      } else if (timeframe === 'Week' && leadDate) {
        if (leadDate.isBefore(dayjs().subtract(7, 'day'))) return false;
      } else if (timeframe === 'Today' && leadDate) {
        if (leadDate.isBefore(dayjs().startOf('day'))) return false;
      }
      
      if (statusFilter !== 'All') {
        const s = (l.status || '').toLowerCase();
        if (statusFilter === 'New' && s !== 'new') return false;
        if (statusFilter === 'Active' && !['contacted', 'in_progress', 'follow_up'].includes(s)) return false;
        if (statusFilter === 'Converted' && s !== 'converted') return false;
      }
      
      if (sourceFilter && l.source !== sourceFilter) return false;
      if (formNameFilter && getFormName(l) !== formNameFilter) return false;
      
      if (ownerFilter) {
        if (ownerFilter === 'Unassigned') {
          if (l.assignedTo) return false;
        } else {
          if (l.assignedTo !== ownerFilter) return false;
        }
      }
      return true;
    });
  }, [leads, timeframe, statusFilter, sourceFilter, formNameFilter, ownerFilter]);

  const {
    totalLeads,
    newLeads,
    activeLeads,
    assignedLeads,
    convertedLeads,
    contactReadyLeads,
    phoneAddedLeads,
    emailAddedLeads,
    followUpLeads
  } = useMemo(() => {
    let newL = 0, activeL = 0, assignedL = 0, convertedL = 0;
    let contactReady = 0, phoneAdded = 0, emailAdded = 0, followUp = 0;

    filteredLeads.forEach(l => {
      const status = (l.status || '').toLowerCase();
      if (status === 'new') newL++;
      if (['contacted', 'in_progress', 'follow_up'].includes(status)) activeL++;
      if (status === 'converted') convertedL++;
      if (status === 'follow_up') followUp++;
      
      if (l.assignedTo) assignedL++;
      if (l.phoneNumber || l.email) contactReady++;
      if (l.phoneNumber) phoneAdded++;
      if (l.email) emailAdded++;
    });

    return {
      totalLeads: filteredLeads.length,
      newLeads: newL,
      activeLeads: activeL,
      assignedLeads: assignedL,
      convertedLeads: convertedL,
      contactReadyLeads: contactReady,
      phoneAddedLeads: phoneAdded,
      emailAddedLeads: emailAdded,
      followUpLeads: followUp,
    };
  }, [filteredLeads]);

  const conversionRate = totalLeads ? Math.round((convertedLeads / totalLeads) * 100) : 0;
  const assignedRate = totalLeads ? Math.round((assignedLeads / totalLeads) * 100) : 0;

  const statusData = [
    { name: 'New Lead', value: newLeads, color: 'var(--accent-primary)' },
    { name: 'In Progress', value: activeLeads, color: '#8b5cf6' },
    { name: 'Converted', value: convertedLeads, color: '#10b981' }
  ].filter(d => d.value > 0);

  const healthData = [
    { name: 'Assigned', value: assignedLeads },
    { name: 'Contact Ready', value: contactReadyLeads },
    { name: 'Phone Added', value: phoneAddedLeads },
    { name: 'Email Added', value: emailAddedLeads },
    { name: 'Need Follow-up', value: followUpLeads }
  ];

  const sourceData = useMemo(() => {
    const counts = {};
    filteredLeads.forEach(l => {
      const source = l.source || 'Unknown';
      counts[source] = (counts[source] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [filteredLeads]);

  const { trendData, statusMovementData } = useMemo(() => {
    const trends = {};
    const movements = {};
    const today = dayjs();
    for (let i = 9; i >= 0; i--) {
      const d = today.subtract(i, 'day').format('DD MMM');
      trends[d] = 0;
      movements[d] = 0;
    }
    
    filteredLeads.forEach(l => {
      const leadDate = getActualLeadDate(l);
      const d = leadDate.format('DD MMM');
      if (trends[d] !== undefined) trends[d]++;
      
      const updatedD = dayjs(l.updatedAt).format('DD MMM');
      if (movements[updatedD] !== undefined && l.status !== 'new') movements[updatedD]++;
    });

    return {
      trendData: Object.entries(trends).map(([date, count]) => ({ date, leads: count })),
      statusMovementData: Object.entries(movements).map(([date, count]) => ({ date, count }))
    };
  }, [filteredLeads]);

  const ownerData = useMemo(() => {
    const owners = {};
    filteredLeads.forEach(l => {
      const o = l.assignedTo || 'Unassigned';
      if (!owners[o]) {
        owners[o] = { 
          key: o, initials: o.substring(0,2).toUpperCase(), owner: o, 
          color: o === 'Unassigned' ? '#10b981' : 'var(--accent-primary)', 
          leads: 0, new: 0, active: 0, followup: 0, reminders: 0, contactReady: 0, converted: 0 
        };
      }
      owners[o].leads++;
      const status = (l.status || '').toLowerCase();
      if (status === 'new') owners[o].new++;
      if (['contacted', 'in_progress', 'follow_up'].includes(status)) owners[o].active++;
      if (status === 'follow_up') owners[o].followup++;
      if (status === 'converted') owners[o].converted++;
      if (l.phoneNumber || l.email) owners[o].contactReady++;
    });

    return Object.values(owners).map(o => ({
      ...o,
      contactReady: Math.round((o.contactReady / o.leads) * 100),
      conversionRate: Math.round((o.converted / o.leads) * 100)
    }));
  }, [filteredLeads]);

  const kpiCards = [
    { title: 'Total Leads', val: totalLeads.toString(), sub: 'Last 30 days', icon: <TeamOutlined /> },
    { title: 'New Leads', val: newLeads.toString(), sub: 'Fresh leads in this view', icon: <FireOutlined /> },
    { title: 'Active Leads', val: activeLeads.toString(), sub: 'In progress + follow-up', icon: <RiseOutlined /> },
    { title: 'Assigned Leads', val: `${assignedRate}%`, sub: `${assignedLeads} assigned, ${totalLeads - assignedLeads} unassigned`, icon: <CheckCircleOutlined /> },
    { title: 'Conversion Rate', val: `${conversionRate}%`, sub: `${convertedLeads} converted leads`, icon: <TrophyOutlined /> }
  ];

  const ownerColumns = [
    { title: 'Owner', dataIndex: 'owner', key: 'owner', render: (text, record) => (
      <Space>
        <Avatar style={{ backgroundColor: record.color, fontWeight: 700 }}>{record.initials}</Avatar>
        <strong>{text}</strong>
      </Space>
    )},
    { title: 'Leads', dataIndex: 'leads', key: 'leads', render: t => <Tag color="blue">{t}</Tag> },
    { title: 'New', dataIndex: 'new', key: 'new' },
    { title: 'Active', dataIndex: 'active', key: 'active' },
    { title: 'Follow Up', dataIndex: 'followup', key: 'followup' },
    { title: 'Contact Ready', dataIndex: 'contactReady', key: 'contactReady', render: t => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Progress percent={t} showInfo={false} strokeColor="var(--accent-primary)" style={{ width: 100 }} />
        <span>{t}%</span>
      </div>
    )},
    { title: 'Conversion Rate', dataIndex: 'conversionRate', key: 'conversionRate', render: t => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Progress percent={t} showInfo={false} strokeColor="var(--text-tertiary)" style={{ width: 100 }} />
        <span>{t}%</span>
      </div>
    )}
  ];

  return (
    <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
      
      {/* Filters Section */}
      <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
        <Card bodyStyle={{ padding: '20px 24px' }} style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FilterOutlined style={{ color: 'var(--accent-primary)' }} />
              <strong style={{ color: 'var(--accent-primary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Dashboard Filters</strong>
            </div>
            <Space>
              {onOpenReportModal && (
                <Button 
                  type="primary" 
                  size="small" 
                  icon={<FilePdfOutlined />} 
                  onClick={onOpenReportModal}
                  style={{ borderRadius: 6, fontWeight: 600, background: '#1677ff' }}
                >
                  Generate MoM Report
                </Button>
              )}
              <Button size="small" onClick={handleClearAll} style={{ borderRadius: 6, fontWeight: 600 }}>Clear all</Button>
            </Space>
          </div>
          <Title level={4} style={{ margin: '0 0 20px 0', fontWeight: 800 }}>View performance by week, month or pipeline stage</Title>

          
          <Row gutter={[16, 16]}>
            <Col style={{ flex: '1 1 160px' }}>
              <Select value={timeframe} onChange={setTimeframe} style={{ width: '100%' }} size="large">
                <Select.Option value="Today">Today</Select.Option>
                <Select.Option value="Week">This Week</Select.Option>
                <Select.Option value="Month">Last 30 Days</Select.Option>
                <Select.Option value="All Time">All Time</Select.Option>
              </Select>
            </Col>
            <Col style={{ flex: '1 1 160px' }}>
              <Select value={statusFilter} onChange={setStatusFilter} style={{ width: '100%' }} size="large">
                <Select.Option value="All">All ({filteredLeads.length})</Select.Option>
                <Select.Option value="New">New</Select.Option>
                <Select.Option value="Active">Active</Select.Option>
                <Select.Option value="Converted">Converted</Select.Option>
              </Select>
            </Col>
            <Col style={{ flex: '1 1 160px' }}>
              <Select allowClear value={sourceFilter} onChange={setSourceFilter} placeholder="Source" style={{ width: '100%' }} size="large">
                {sourceOptions.map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
              </Select>
            </Col>
            <Col style={{ flex: '1 1 160px' }}>
              <Select allowClear showSearch value={formNameFilter} onChange={setFormNameFilter} placeholder="Form Name" style={{ width: '100%' }} size="large">
                {formNames.map(f => <Select.Option key={f} value={f}>{f}</Select.Option>)}
              </Select>
            </Col>
            <Col style={{ flex: '1 1 160px' }}>
              <Select allowClear showSearch value={ownerFilter} onChange={setOwnerFilter} placeholder="Owner" style={{ width: '100%' }} size="large">
                {ownerOptions.map(o => <Select.Option key={o} value={o}>{o}</Select.Option>)}
                <Select.Option value="Unassigned">Unassigned</Select.Option>
              </Select>
            </Col>
          </Row>
        </Card>
      </motion.div>

      {/* KPI Cards */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {kpiCards.map((kpi, i) => {
          const gradients = [
            'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', // Vibrant Purple/Indigo
            'linear-gradient(135deg, var(--accent-secondary) 0%, var(--accent-primary) 100%)', // Bright Blue
            'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Emerald Green
            'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Amber/Orange
            'linear-gradient(135deg, #ec4899 0%, #be123c 100%)'  // Pink/Rose
          ];
          return (
            <Col style={{ flex: '1 1 200px', minWidth: 200 }} key={i}>
              <motion.div variants={itemVariants} whileHover={{ y: -6, scale: 1.02 }} style={{ height: '100%', transition: 'all 0.3s ease' }}>
                <Card 
                  bodyStyle={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', zIndex: 1 }} 
                  style={{ 
                    borderRadius: 20, 
                    border: 'none', 
                    background: gradients[i % gradients.length], 
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    height: '100%',
                    overflow: 'hidden',
                    color: '#ffffff'
                  }}
                >
                  <div style={{ position: 'absolute', right: -20, top: -20, opacity: 0.15, transform: 'scale(3)' }}>
                    {kpi.icon}
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.2)', borderRadius: 12, display: 'flex', backdropFilter: 'blur(10px)' }}>
                      {React.cloneElement(kpi.icon, { style: { fontSize: 20 } })}
                    </div>
                    <Text style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255, 255, 255, 0.9)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{kpi.title}</Text>
                  </div>
                  <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 900, color: '#ffffff', fontSize: 36, letterSpacing: -1 }}>{kpi.val}</Title>
                  <Text style={{ fontSize: 13, marginTop: 'auto', paddingTop: 8, color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>{kpi.sub}</Text>
                </Card>
              </motion.div>
            </Col>
          );
        })}
      </Row>

      {/* Top 3 Panels */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={8}>
          <motion.div variants={itemVariants} style={{ height: '100%' }}>
            <Card title={<><PieChart style={{marginRight: 8, color: 'var(--accent-primary)'}} /> Lead Status</>} style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%', background: 'var(--bg-secondary)' }} headStyle={{ borderBottom: 'none', padding: '20px 24px 0', fontSize: 16, fontWeight: 800 }}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={90}>
                    {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 24px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-primary)' }}/> New Lead</div>
                <strong style={{ fontSize: 13 }}>{newLeads}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6' }}/> In Progress</div>
                <strong style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{activeLeads}</strong>
              </div>
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} lg={8}>
          <motion.div variants={itemVariants} style={{ height: '100%' }}>
            <Card title={<><TrophyOutlined style={{marginRight: 8, color: 'var(--accent-primary)'}} /> Top Performers</>} style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%', background: 'var(--bg-secondary)' }} headStyle={{ borderBottom: 'none', padding: '20px 24px 0', fontSize: 16, fontWeight: 800 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 300, overflowY: 'auto' }}>
                {ownerData.slice(0, 3).map((o, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar style={{ backgroundColor: o.color, fontWeight: 700 }}>{o.initials}</Avatar>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{o.owner}</strong>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>{o.leads} leads • {o.conversionRate}% conversion</Text>
                      </div>
                    </div>
                    <strong style={{ color: 'var(--accent-primary)', fontSize: 13 }}>{o.converted} converted</strong>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} lg={8}>
          <motion.div variants={itemVariants} style={{ height: '100%' }}>
            <Card title={<><RiseOutlined style={{marginRight: 8, color: 'var(--accent-primary)'}} /> Conversion Funnel</>} style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%', background: 'var(--bg-secondary)' }} headStyle={{ borderBottom: 'none', padding: '20px 24px 0', fontSize: 16, fontWeight: 800 }}>
              <div style={{ background: 'var(--accent-primary)', color: '#fff', padding: '10px 16px', borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>Total Leads</span><span>{totalLeads} (100%)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 24 }}>
                <div style={{ background: 'var(--accent-primary)', color: '#fff', padding: '8px 16px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 600, width: '90%' }}>
                  <span>Active</span><span>{activeLeads} ({totalLeads ? Math.round((activeLeads/totalLeads)*100) : 0}%)</span>
                </div>
                <div style={{ background: '#8b5cf6', color: '#fff', padding: '8px 16px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 600, width: '80%' }}>
                  <span>Follow Up</span><span>{followUpLeads} ({totalLeads ? Math.round((followUpLeads/totalLeads)*100) : 0}%)</span>
                </div>
                <div style={{ background: '#10b981', color: '#fff', padding: '8px 16px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 600, width: '70%' }}>
                  <span>Converted</span><span>{convertedLeads} ({conversionRate}%)</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* Charts Row 1 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <motion.div variants={itemVariants} style={{ height: '100%' }}>
            <Card title={<><RiseOutlined style={{marginRight: 8, color: 'var(--accent-primary)'}} /> Last 10 days Trend</>} extra={<Button size="small" style={{ borderRadius: 20, color: 'var(--accent-primary)', fontWeight: 600 }}>Leads vs Converted</Button>} style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', height: '100%' }} headStyle={{ borderBottom: 'none', padding: '20px 24px 0', fontSize: 16, fontWeight: 800 }}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="var(--text-tertiary)" fontSize={12} axisLine={false} tickLine={false} dx={-10} allowDecimals={false} />
                  <Tooltip cursor={{ stroke: 'var(--border-color)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                  <Line type="monotone" dataKey="leads" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} lg={8}>
          <motion.div variants={itemVariants} style={{ height: '100%' }}>
            <Card title={<><PieChart style={{marginRight: 8, color: 'var(--accent-primary)'}} /> Lead Sources</>} style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', height: '100%' }} headStyle={{ borderBottom: 'none', padding: '20px 24px 0', fontSize: 16, fontWeight: 800 }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sourceData} layout="vertical" margin={{ top: 20, right: 20, left: 30, bottom: 0 }} barSize={16}>
                  <XAxis type="number" stroke="var(--text-tertiary)" fontSize={12} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="var(--text-tertiary)" fontSize={12} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'var(--bg-tertiary)' }} />
                  <Bar dataKey="value" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* Charts Row 2 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <motion.div variants={itemVariants} style={{ height: '100%' }}>
            <Card title={<><CalendarOutlined style={{marginRight: 8, color: 'var(--accent-primary)'}} /> Status Movement</>} style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', height: '100%' }} headStyle={{ borderBottom: 'none', padding: '20px 24px 0', fontSize: 16, fontWeight: 800 }}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={statusMovementData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={11} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="var(--text-tertiary)" fontSize={11} axisLine={false} tickLine={false} dx={-10} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--bg-tertiary)' }} />
                  <Bar dataKey="count" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} lg={12}>
          <motion.div variants={itemVariants} style={{ height: '100%' }}>
            <Card title={<><CheckCircleOutlined style={{marginRight: 8, color: 'var(--accent-primary)'}} /> Management Health</>} style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', height: '100%' }} headStyle={{ borderBottom: 'none', padding: '20px 24px 0', fontSize: 16, fontWeight: 800 }}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={healthData} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }} barSize={16}>
                  <XAxis type="number" stroke="var(--text-tertiary)" fontSize={12} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="var(--text-tertiary)" fontSize={12} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'var(--bg-tertiary)' }} />
                  <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* Leads Table */}
      <motion.div variants={itemVariants}>
        <Card title={<><TeamOutlined style={{marginRight: 8, color: 'var(--accent-primary)'}} /> Lead Management Workload</>} extra={<Button size="small" style={{ borderRadius: 20, color: 'var(--accent-primary)', fontWeight: 600 }}>{ownerData.length} owners</Button>} style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }} headStyle={{ borderBottom: '1px solid var(--border-color)', padding: '20px 24px', fontSize: 16, fontWeight: 800 }}>
          <Table 
            columns={ownerColumns} 
            dataSource={ownerData} 
            pagination={false} 
            scroll={{ x: 'max-content' }} 
            className="ant-table-striped"
          />
        </Card>
      </motion.div>

    </motion.div>
  );
};

export default AdminDashboard;
