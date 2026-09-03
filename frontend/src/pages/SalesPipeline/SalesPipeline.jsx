import React, { useState } from 'react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { Typography, Row, Col, Card, Button, Table, Tag, Avatar, Progress, Drawer, Modal, Form, Input, Select, InputNumber, Divider, Timeline, Space, message, Badge, DatePicker } from 'antd';
import { motion } from 'framer-motion';
import { Download, Plus, Target, FileText, TrendingUp, Mail, ExternalLink, Clock, Trash2, CheckCircle2, XCircle, Briefcase, Calendar, User, MessageSquare, AlertCircle, Award } from 'lucide-react';
import {
  useGetDealsQuery,
  useGetPipelineAnalyticsQuery,
  useGetSalesRepsQuery,
  useCreateDealMutation,
  useUpdateDealMutation,
  useDeleteDealMutation,
  useAddDealNoteMutation,
  useConvertDealToClientMutation
} from '../../api/salesPipelineApi';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import useActionPermissions from '../../hooks/useActionPermissions';

const INDUSTRY_CATEGORIES = [
  'Healthcare & Wellness',
  'E-commerce & Retail',
  'Technology & Software (SaaS)',
  'Real Estate & Construction',
  'Finance & Banking (Fintech)',
  'Education & EdTech',
  'Automotive',
  'Hospitality & Tourism',
  'Media & Entertainment',
  'Manufacturing & Industrial',
  'Professional Services',
  'Food & Beverage',
  'Fashion & Apparel',
  'Non-Profit & NGO',
  'Other'
];

const SalesPipeline = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user, role } = useAuth();
  const { canAdd, canEdit, canDelete } = useActionPermissions(role === 'agency_manager' || role === 'agency' ? '/agency/salespipeline' : '/ops/salespipeline');

  // States
  const [filterStage, setFilterStage] = useState(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDealId, setSelectedDealId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

  // Forms
  const [form] = Form.useForm();
  const [convertForm] = Form.useForm();

  // API Queries
  const { data: dealsResponse, isLoading: dealsLoading, refetch: refetchDeals } = useGetDealsQuery({
    stage: filterStage,
    search: searchTerm || undefined
  });

  const { data: analyticsResponse, isLoading: analyticsLoading, refetch: refetchAnalytics } = useGetPipelineAnalyticsQuery();
  const { data: repsResponse } = useGetSalesRepsQuery();
  const reps = repsResponse?.data?.reps || [];

  // API Mutations
  const [createDeal, { isLoading: isCreating }] = useCreateDealMutation();
  const [updateDeal, { isLoading: isUpdating }] = useUpdateDealMutation();
  const [deleteDeal] = useDeleteDealMutation();
  const [addDealNote, { isLoading: isAddingNote }] = useAddDealNoteMutation();
  const [convertDeal, { isLoading: isConverting }] = useConvertDealToClientMutation();

  const deals = dealsResponse?.data?.deals || [];
  const analytics = analyticsResponse?.data?.analytics || {
    kpis: { totalPipelineValue: 0, weightedPipelineValue: 0, winRate: 0, avgDealSize: 0, activeProspects: 0, proposalsSent: 0, dealsWonThisMonth: 0, dealsLostThisMonth: 0 },
    funnel: [],
    leaderboard: [],
    stalledDeals: []
  };

  const selectedDeal = deals.find(d => d._id === selectedDealId);

  const handleCreate = async (values) => {
    try {
      const repName = values.rep || "Unassigned";
      const repInitials = values.rep ? values.rep.split(" ").map(n => n[0]).join("").toUpperCase() : "UN";
      await createDeal({
        ...values,
        rep: repName,
        ownerInit: repInitials
      }).unwrap();
      message.success("Deal created successfully");
      setIsCreateOpen(false);
      form.resetFields();
      refetchDeals();
      refetchAnalytics();
    } catch (err) {
      message.error(err?.error || "Failed to create deal");
    }
  };

  const handleConvert = async (values) => {
    try {
      await convertDeal({ id: selectedDealId, email: values.email, password: values.password, phone: values.phone }).unwrap();
      message.success("Deal successfully converted!");
      setIsConvertModalOpen(false);
      convertForm.resetFields();
      setIsDetailOpen(false);
      refetchDeals();
      refetchAnalytics();
    } catch (err) {
      console.error("CONVERT ERROR DETAILS:", err);
      let errMsg = "Failed to convert deal";
      if (typeof err === 'string') errMsg = err;
      else if (err?.error) errMsg = err.error;
      else if (err?.message) errMsg = err.message;
      else if (err?.data?.message) errMsg = err.data.message;
      message.error(errMsg);
    }
  };

  const handleStageChange = async (dealId, nextStage) => {
    try {
      let probability = 20;
      if (nextStage === 'qualified') probability = 40;
      else if (nextStage === 'proposal') probability = 60;
      else if (nextStage === 'negotiation') probability = 80;
      else if (nextStage === 'won') probability = 100;
      else if (nextStage === 'lost') probability = 0;

      await updateDeal({ id: dealId, stage: nextStage, probability }).unwrap();
      message.success(`Moved deal to ${nextStage.toUpperCase()}`);
      refetchDeals();
      refetchAnalytics();
    } catch (err) {
      message.error(err?.error || "Failed to update deal stage");
    }
  };

  const handleDragStart = (e, dealId) => {
    e.dataTransfer.setData("text/plain", dealId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("text/plain");
    if (!dealId) return;
    await handleStageChange(dealId, targetStage);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      await addDealNote({ dealId: selectedDealId, content: newNote }).unwrap();
      setNewNote('');
      message.success("Note added successfully");
      refetchDeals();
    } catch (err) {
      message.error(err?.error || "Failed to add note");
    }
  };

  const handleDeleteDeal = async (id) => {
    Modal.confirm({
      title: 'Delete Opportunity',
      content: 'Are you sure you want to permanently delete this deal?',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteDeal(id).unwrap();
          message.success("Opportunity deleted successfully");
          setIsDetailOpen(false);
          refetchDeals();
          refetchAnalytics();
        } catch (err) {
          message.error(err?.error || "Failed to delete deal");
        }
      }
    });
  };

  const formatPrice = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${val.toLocaleString()}`;
  };

  // Group deals into pipeline stages
  const getDealsByStage = (stage) => deals.filter(d => d.stage === stage);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 350, damping: 25 } }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ minHeight: '100vh', background: isDark ? '#0d1526' : '#f5f7fa' }}>

      {/* Top Header */}
      <motion.div variants={itemVariants} style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 800, color: isDark ? '#fff' : '#000' }}>Sales Pipeline</Title>
          <Text type="secondary" style={{ fontWeight: 500 }}>Real-time opportunity tracking, sales velocity, and revenue forecasting.</Text>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search deals, reps..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: 220, borderRadius: 8, height: 40 }}
          />
          <Select
            placeholder="Filter Stage"
            allowClear
            value={filterStage}
            onChange={setFilterStage}
            style={{ width: 150, height: 40 }}
          >
            <Option value="lead">Lead</Option>
            <Option value="qualified">Qualified</Option>
            <Option value="proposal">Proposal Sent</Option>
            <Option value="negotiation">Negotiation</Option>
            <Option value="won">Won</Option>
            <Option value="lost">Lost</Option>
          </Select>
          {canAdd && (
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => setIsCreateOpen(true)}
              style={{ borderRadius: 8, background: 'var(--accent-primary)', height: 40, fontWeight: 700, border: 'none', boxShadow: 'var(--shadow-md)' }}
            >
              Add Sales Proposal
            </Button>
          )}
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={itemVariants}>
        <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
          {[
            { label: 'TOTAL PIPELINE VALUE', val: formatPrice(analytics.kpis.totalPipelineValue), sub: 'Active potential revenue', icon: <TrendingUp size={20} />, color: 'var(--text-primary)' },
            { label: 'WEIGHTED PIPELINE', val: formatPrice(analytics.kpis.weightedPipelineValue), sub: 'Risk-adjusted forecast', icon: <Target size={20} />, color: 'var(--accent-secondary)' },
            { label: 'ACTIVE OPPORTUNITIES', val: analytics.kpis.activeProspects, sub: 'Across 4 active stages', icon: <Briefcase size={20} />, color: 'var(--text-primary)' },
            { label: 'WIN RATE (YTD)', val: `${analytics.kpis.winRate}%`, sub: `${analytics.kpis.dealsWonThisMonth} won · ${analytics.kpis.dealsLostThisMonth} lost`, icon: <CheckCircle2 size={20} />, color: 'var(--accent-primary)' },
          ].map((kpi, i) => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <motion.div whileHover={{ y: -3, transition: { duration: 0.15 } }} style={{ height: '100%' }}>
                <div style={{ display: 'inline-block', background: isDark ? '#1f1f1f' : '#e6f4ea', padding: '6px 16px', borderRadius: '10px 10px 0 0', border: '1px solid var(--border-color)', borderBottom: 'none', marginLeft: 16 }}>
                  <Text type="secondary" style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2 }}>{kpi.label}</Text>
                </div>
                <Card
                  style={{ borderRadius: 16, borderTopLeftRadius: 0, border: '1px solid var(--border-color)', background: isDark ? '#1d1d1d' : '#fff', boxShadow: 'var(--shadow-sm)', marginTop: '-1px' }}
                  bodyStyle={{ padding: '20px 24px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <Title level={2} style={{ margin: 0, color: kpi.color, fontWeight: 800, fontSize: '26px' }}>{kpi.val}</Title>
                    <div style={{ color: 'var(--accent-secondary)', background: isDark ? 'rgba(13,148,136,0.15)' : 'rgba(13, 148, 136, 0.08)', padding: 8, borderRadius: '50%' }}>{kpi.icon}</div>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>{kpi.sub}</Text>
                </Card>
              </motion.div>
            </Col>
          ))}
        </Row>
      </motion.div>

      {/* Kanban Stages Board */}
      <motion.div variants={itemVariants} style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
          {[
            { id: 'lead', title: 'NEW LEAD', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.06)' },
            { id: 'qualified', title: 'QUALIFIED', color: 'var(--accent-primary)', bg: 'rgba(59, 130, 246, 0.06)' },
            { id: 'proposal', title: 'PROPOSAL SENT', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.06)' },
            { id: 'negotiation', title: 'NEGOTIATION', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.06)' },
            { id: 'won', title: 'COMPLETED', color: '#10b981', bg: 'rgba(16, 185, 129, 0.06)' }
          ].map(stage => {
            const stageDeals = getDealsByStage(stage.id);
            const totalVal = stageDeals.reduce((sum, d) => sum + d.value, 0);

            return (
              <div
                key={stage.id}
                onDragOver={handleDragOver}
                onDrop={(e) => canEdit && handleDrop(e, stage.id)}
                style={{ flex: 1, minWidth: 290, background: isDark ? '#1a1a1a' : '#f8f9fa', borderRadius: 16, padding: 16, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${stage.color}`, paddingBottom: 8 }}>
                  <div>
                    <strong style={{ fontSize: 12, color: isDark ? '#fff' : '#1f1f1f', letterSpacing: 0.5 }}>{stage.title}</strong>
                    <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 10, background: isDark ? '#2a2a2a' : '#e9ecef', fontSize: 11, fontWeight: 600 }}>{stageDeals.length}</span>
                  </div>
                  <strong style={{ color: stage.color, fontSize: 13 }}>{formatPrice(totalVal)}</strong>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', minHeight: 400 }}>
                  {stageDeals.map(deal => (
                    <Card
                      key={deal._id}
                      bodyStyle={{ padding: 16 }}
                      onClick={() => { setSelectedDealId(deal._id); setIsDetailOpen(true); }}
                      draggable={canEdit}
                      onDragStart={(e) => handleDragStart(e, deal._id)}
                      style={{ borderRadius: 12, border: '1px solid var(--border-color)', background: isDark ? '#242424' : '#fff', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                      hoverable
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <strong style={{ fontSize: 14, color: isDark ? '#fff' : '#1f1f1f' }}>{deal.name}</strong>
                        <Avatar size="small" style={{ backgroundColor: stage.color, fontSize: 10, fontWeight: 700 }}>{deal.ownerInit}</Avatar>
                      </div>
                      <Tag style={{ borderRadius: 12, fontSize: 10, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', marginBottom: 12 }}>{deal.category}</Tag>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: stage.color }}>{formatPrice(deal.value)}</span>
                        {deal.priority && (
                          <Tag color={deal.priority === 'critical' || deal.priority === 'high' ? 'red' : 'blue'} style={{ borderRadius: 6, fontSize: 9 }}>{deal.priority.toUpperCase()}</Tag>
                        )}
                      </div>

                      <Divider style={{ margin: '12px 0' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} /> {deal.rep}</span>
                        {deal.follow && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-warning)' }}>
                            <Clock size={12} /> {dayjs(deal.follow).isValid() ? dayjs(deal.follow).format('DD MMM YYYY') : deal.follow}
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                  {stageDeals.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#8c8c8c', padding: '40px 0', fontSize: 12 }}>Drop deals here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Won / Lost Outcomes */}
      <motion.div variants={itemVariants} style={{ marginBottom: 32 }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <Card title="Won Deals (Won)" className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {getDealsByStage('won').map(deal => (
                  <div key={deal._id} onClick={() => { setSelectedDealId(deal._id); setIsDetailOpen(true); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isDark ? '#262626' : 'rgba(16,185,129,0.05)', borderRadius: 12, border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Avatar style={{ backgroundColor: 'var(--accent-primary)', fontWeight: 700 }}>{deal.ownerInit}</Avatar>
                      <div>
                        <strong style={{ color: isDark ? '#fff' : '#000' }}>{deal.name}</strong>
                        <div style={{ fontSize: 12, color: '#8c8c8c' }}>{deal.category} · Rep: {deal.rep}</div>
                      </div>
                    </div>
                    <strong style={{ color: 'var(--accent-primary)', fontSize: 16 }}>{formatPrice(deal.value)}</strong>
                  </div>
                ))}
                {getDealsByStage('won').length === 0 && <Text type="secondary" style={{ textAlign: 'center', display: 'block', padding: 20 }}>No won deals this month</Text>}
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Lost Deals (Lost)" className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {getDealsByStage('lost').map(deal => (
                  <div key={deal._id} onClick={() => { setSelectedDealId(deal._id); setIsDetailOpen(true); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isDark ? '#262626' : 'rgba(239,68,68,0.05)', borderRadius: 12, border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Avatar style={{ backgroundColor: 'var(--accent-danger)', fontWeight: 700 }}>{deal.ownerInit}</Avatar>
                      <div>
                        <strong style={{ color: isDark ? '#fff' : '#000' }}>{deal.name}</strong>
                        <div style={{ fontSize: 12, color: '#8c8c8c' }}>Reason: {deal.lostReason || "Not specified"}</div>
                      </div>
                    </div>
                    <strong style={{ color: 'var(--accent-danger)', fontSize: 16 }}>{formatPrice(deal.value)}</strong>
                  </div>
                ))}
                {getDealsByStage('lost').length === 0 && <Text type="secondary" style={{ textAlign: 'center', display: 'block', padding: 20 }}>No lost deals recorded</Text>}
              </div>
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* Analytics, Stalled Deals & Top Performers */}
      <motion.div variants={itemVariants}>
        <Row gutter={[24, 24]}>

          {/* Conversion Funnel */}
          <Col xs={24} md={12} lg={8}>
            <Card title="Conversion Funnel" className="glassmorphism" style={{ borderRadius: 16, height: '100%', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                {analytics.funnel.map((f, idx) => {
                  const maxCount = Math.max(...analytics.funnel.map(item => item.count), 1);
                  const pct = Math.round((f.count / maxCount) * 100);
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{f.stage}</span>
                        <span style={{ fontSize: 12, color: '#8c8c8c' }}>{f.count} ({formatPrice(f.value)})</span>
                      </div>
                      <Progress percent={pct} showInfo={false} strokeColor="var(--accent-secondary)" trailColor={isDark ? '#2a2a2a' : '#f0f0f0'} />
                    </div>
                  );
                })}
              </div>
            </Card>
          </Col>

          {/* Stalled Deals */}
          <Col xs={24} md={12} lg={8}>
            <Card title="Stalled Opportunities" extra={<Badge count={analytics.stalledDeals.length} />} className="glassmorphism" style={{ borderRadius: 16, height: '100%', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
                {analytics.stalledDeals.map(d => (
                  <div key={d._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>{d.name}</strong>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>Stage: {d.stage.toUpperCase()} · Owner: {d.rep}</div>
                    </div>
                    <Tag color="warning" icon={<AlertCircle size={10} style={{ marginRight: 2 }} />}>No Action</Tag>
                  </div>
                ))}
                {analytics.stalledDeals.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#8c8c8c', padding: '40px 0', fontSize: 12 }}>No stalled opportunities detected</div>
                )}
              </div>
            </Card>
          </Col>

          {/* Top Performers */}
          <Col xs={24} lg={8}>
            <Card title="Top Sales Performers" className="glassmorphism" style={{ borderRadius: 16, height: '100%', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {analytics.leaderboard.map((leader, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Avatar style={{ backgroundColor: 'var(--accent-secondary)' }}>{leader.ownerInit}</Avatar>
                      <div>
                        <strong>{leader.rep}</strong>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>Win Rate: {leader.winRate}% · {leader.countWon} won</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ color: 'var(--accent-primary)', display: 'block' }}>{formatPrice(leader.valueWon)}</strong>
                      <span style={{ fontSize: 11, color: '#8c8c8c' }}>Pipe: {formatPrice(leader.pipelineVal)}</span>
                    </div>
                  </div>
                ))}
                {analytics.leaderboard.length === 0 && <Text type="secondary">No performer stats found</Text>}
              </div>
            </Card>
          </Col>

        </Row>
      </motion.div>

      {/* Deal Detail Drawer */}
      <Drawer
        title={selectedDeal ? `Opportunity Details: ${selectedDeal.name}` : 'Deal Details'}
        placement="right"
        width={550}
        onClose={() => setIsDetailOpen(false)}
        open={isDetailOpen}
        extra={
          selectedDeal && canDelete && (
            <Button
              danger
              icon={<Trash2 size={16} />}
              onClick={() => handleDeleteDeal(selectedDeal._id)}
            >
              Delete
            </Button>
          )
        }
      >
        {selectedDeal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-secondary)' }}>{formatPrice(selectedDeal.value)}</span>
                <Tag color="cyan" style={{ borderRadius: 12, padding: '4px 12px', fontSize: 12 }}>{selectedDeal.stage.toUpperCase()}</Tag>
              </div>
              <Paragraph style={{ color: '#8c8c8c' }}>
                Assigned to <strong>{selectedDeal.rep}</strong> · Opportunity Category: <strong>{selectedDeal.category}</strong>
              </Paragraph>
            </div>

            <Divider style={{ margin: 0 }} />

            {/* Quick Actions to Progress Stage */}
            {canEdit && (
              <div>
                <Title level={5} style={{ marginBottom: 12 }}>Change Pipeline Stage</Title>
                <Space wrap>
                  {['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'].map(stg => (
                    <Button
                      key={stg}
                      type={selectedDeal.stage === stg ? 'primary' : 'default'}
                      onClick={() => handleStageChange(selectedDeal._id, stg)}
                      style={{ borderRadius: 8, fontSize: 12 }}
                    >
                      {stg.toUpperCase()}
                    </Button>
                  ))}
                </Space>
                {selectedDeal.stage === 'won' && !selectedDeal.clientId && (
                  <div style={{ marginTop: 16 }}>
                    <Button 
                      type="primary" 
                      onClick={() => {
                        const isAdminOrManager = ['supreme_super_admin', 'superadmin', 'commander_admin', 'agency_super_admin', 'agency_manager', 'agency', 'admin', 'brand_super_admin', 'brand_admin', 'brand_manager'].includes(role);
                        const hasAccountAccessAll = user?.permissions?.['Clients-Accounts']?.All;
                        if (isAdminOrManager || hasAccountAccessAll) {
                          navigate('/agency/clients', { 
                            state: { 
                              openCreateClientModal: true, 
                              dealId: selectedDeal._id, 
                              dealName: selectedDeal.name 
                            } 
                          });
                        } else {
                          message.warning("You do not have permission to convert this deal to a client. Only users with full 'Account Access' can perform this action.");
                        }
                      }}
                      style={{ background: 'var(--accent-primary)', borderRadius: 8, width: '100%', fontWeight: 'bold' }}
                      size="large"
                    >
                      Convert to Client
                    </Button>
                  </div>
                )}
              </div>
            )}
            {canEdit && <Divider style={{ margin: 0 }} />}

            {/* Notes Section */}
            <div>
              <Title level={5} style={{ marginBottom: 12 }}><MessageSquare size={16} style={{ marginRight: 6 }} /> Notes</Title>
              {canEdit && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <Input.TextArea
                    rows={2}
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Type notes or follow-up logs..."
                  />
                  <Button
                    type="primary"
                    loading={isAddingNote}
                    onClick={handleAddNote}
                    style={{ height: 'auto', background: 'var(--accent-primary)', borderRadius: 8 }}
                  >
                    Save
                  </Button>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 200, overflowY: 'auto' }}>
                {selectedDeal.notes.map((note, idx) => (
                  <div key={idx} style={{ padding: 12, background: isDark ? '#262626' : '#f9f9f9', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{note.createdBy}</span>
                      <span style={{ fontSize: 10, color: '#8c8c8c' }}>{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <Text style={{ fontSize: 13 }}>{note.content}</Text>
                  </div>
                ))}
                {selectedDeal.notes.length === 0 && <Text type="secondary">No notes added yet.</Text>}
              </div>
            </div>

            <Divider style={{ margin: 0 }} />

            {/* Activity History Timeline */}
            <div>
              <Title level={5} style={{ marginBottom: 16 }}><Clock size={16} style={{ marginRight: 6 }} /> Activity History</Title>
              <Timeline mode="left">
                {selectedDeal.activityLogs.map((log, idx) => (
                  <Timeline.Item key={idx} label={new Date(log.createdAt).toLocaleDateString()} color="teal">
                    <strong>{log.action}</strong>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>{log.details} · by {log.performedBy}</div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </div>
          </div>
        )}
      </Drawer>

      {/* Add Opportunity Modal */}
      <Modal
        title="Add New Sales Opportunity"
        open={isCreateOpen}
        onCancel={() => setIsCreateOpen(false)}
        okText="Create Opportunity"
        onOk={() => form.submit()}
        confirmLoading={isCreating}
        okButtonProps={{ style: { background: 'var(--accent-primary)', borderRadius: 8 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ stage: 'lead', priority: 'medium', probability: 20 }}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label="Prospect/Client Name"
            name="name"
            rules={[{ required: true, message: 'Please enter prospect name' }]}
          >
            <Input placeholder="e.g. HealthKart" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Industry Category"
                name="category"
                rules={[{ required: true, message: 'Please select an industry category' }]}
              >
                <Select placeholder="Select Industry Category" showSearch allowClear style={{ width: '100%' }}>
                  {INDUSTRY_CATEGORIES.map(cat => (
                    <Option key={cat} value={cat}>{cat}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="MRR Potential (Value)"
                name="value"
                rules={[{ required: true, message: 'Please enter monthly value' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="₹ value per month" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Initial Stage" name="stage">
                <Select>
                  <Option value="lead">New Lead</Option>
                  <Option value="qualified">Qualified</Option>
                  <Option value="proposal">Proposal Sent</Option>
                  <Option value="negotiation">Negotiation</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Priority" name="priority">
                <Select>
                  <Option value="low">Low</Option>
                  <Option value="medium">Medium</Option>
                  <Option value="high">High</Option>
                  <Option value="critical">Critical</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Assigned Rep (Owner)"
                name="rep"
              >
                <Select
                  placeholder="Select assigned rep (optional)"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  style={{ width: '100%' }}
                >
                  {reps.map(r => (
                    <Option key={r._id} value={r.name}>{r.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Follow-up Date" name="follow">
                <DatePicker style={{ width: '100%' }} placeholder="Select Date" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>


    </motion.div>
  );
};

export default SalesPipeline;
