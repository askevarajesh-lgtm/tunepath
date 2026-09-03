import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Button, Tag, Empty, Table, Spin, DatePicker, Avatar } from 'antd';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, CheckCircle2, FileText, Receipt, CheckSquare, TrendingUp, DollarSign } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useFeatures } from '../../../contexts/FeatureContext';
import BubbleCard from '../../../components/BubbleCard';
import TaskDetailDrawer from '../../Tasks/TaskDetailDrawer';
import TaskCompletionCelebrate from '../../Tasks/TaskCompletionCelebrate';
import api from '../../../services/api';
import { semrushApi } from '../../../api/semrushApi';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import ScoreGaugeCard from '../../SEO/components/ScoreGaugeCard';

const { Title, Text } = Typography;

const DashboardTab = () => {
  const { role, user } = useAuth();
  const { hasFeature } = useFeatures();
  const navigate = useNavigate();

  const isSeoFeatureEnabled = React.useMemo(() => {
    if (user?.features && Array.isArray(user.features)) {
      return user.features.includes('seo-aeo-geo') || user.features.includes('seo');
    }
    if (typeof hasFeature === 'function') {
      return hasFeature('seo-aeo-geo') || hasFeature('seo');
    }
    return true;
  }, [user?.features, hasFeature]);

  const [loading, setLoading] = useState(true);
  const [overviewData, setOverviewData] = useState(null);
  const [semrushProject, setSemrushProject] = useState(null);
  
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    fetchOverview();
  }, [selectedDate]);

  useEffect(() => {
    // Fetch Client's SEO/AEO/GEO project to display scores if feature is enabled
    if (isSeoFeatureEnabled) {
      semrushApi.getProjects()
        .then(res => {
          if (res.data?.success && res.data.data?.length > 0) {
            setSemrushProject(res.data.data[0]);
          }
        })
        .catch(err => console.error('Failed to fetch Semrush project:', err));
    }
  }, [isSeoFeatureEnabled]);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const params = {
        month: selectedDate.month(),
        year: selectedDate.year()
      };
      const res = await api.get('/client/overview', { params });
      if (res.data && res.data.success) {
        setOverviewData(res.data.data);
      }
    } catch (error) {
      console.error('Failed to load client overview', error);
    } finally {
      setLoading(false);
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

  if (!overviewData && loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}><Spin size="large" /></div>;
  }

  if (!overviewData) return null;

  const renderExecutiveDashboard = () => {
    const { stats, upcomingInvoice, pendingApprovals, recentInvoices } = overviewData;
    const currentMonthName = selectedDate.format('MMMM YYYY');

    const kpis = [
      { label: 'ACTIVE PROJECTS', value: stats.activeProjects, sub: `${stats.completedProjects} total completed`, color: 'var(--accent-primary)', icon: <CheckSquare size={20} /> },
      { label: 'PENDING APPROVALS', value: pendingApprovals?.length || 0, sub: 'Awaiting your review', color: 'var(--accent-info)', icon: <CheckCircle2 size={20} /> },
      { label: 'MONTHLY SPEND', value: `₹${(stats.paidAmountThisMonth/100000).toFixed(1)}L`, sub: 'Paid this month', color: 'var(--accent-success)', icon: <DollarSign size={20} /> },
      { label: 'OUTSTANDING AMOUNT', value: `₹${(stats.outstandingAmount/100000).toFixed(1)}L`, sub: `${stats.pendingInvoicesCount} pending invoices`, color: stats.outstandingAmount > 0 ? 'var(--accent-danger)' : 'var(--accent-success)', icon: <AlertTriangle size={20} /> },
    ];

    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        {/* Header Section */}
        <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} style={{ margin: '4px 0 8px 0', fontWeight: 800 }}>
              Good {dayjs().hour() < 12 ? 'morning' : dayjs().hour() < 17 ? 'afternoon' : 'evening'}, {user?.name || 'Brand Team'}.
            </Title>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>
              Here's your executive overview for {currentMonthName}.
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <DatePicker 
              picker="month" 
              value={selectedDate} 
              onChange={(date) => date && setSelectedDate(date)} 
              size="large"
              allowClear={false}
            />
          </div>
        </motion.div>

        {/* KPI Cards */}
        <motion.div variants={itemVariants} style={{ marginBottom: 32 }}>
          <Row gutter={[16, 16]}>
            {kpis.map((kpi, idx) => (
              <Col xs={24} sm={12} lg={6} key={idx}>
                <div style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: 20,
                  padding: 24,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                  border: '1px solid var(--border-color)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: -10, right: -10, width: 80, height: 80, borderRadius: '50%', background: kpi.color, opacity: 0.05 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${kpi.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>
                      {kpi.icon}
                    </div>
                  </div>
                  <Title level={3} style={{ margin: '0 0 4px 0', fontWeight: 800 }}>{kpi.value}</Title>
                  <Text style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
                    {kpi.label}
                  </Text>
                  <Text style={{ color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500 }}>
                    {kpi.sub}
                  </Text>
                </div>
              </Col>
            ))}
          </Row>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Row gutter={48}>
            <Col xs={24} lg={12}>
              <Title level={4} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Pending Approvals</Title>
              <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 24, fontWeight: 500 }}>Tasks awaiting your review</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {pendingApprovals && pendingApprovals.length > 0 ? (
                  pendingApprovals.map((item, idx) => (
                    <div key={idx} className="hover-bg" style={{ display: 'flex', alignItems: 'center', padding: '20px 24px', background: 'var(--bg-secondary)', borderRadius: '24px 24px 24px 8px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', flexWrap: 'wrap', gap: 16 }}>
                      <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 12, color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                        <FileText size={18}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <Text style={{ fontWeight: 700, display: 'block', fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>{item.title}</Text>
                        <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>{dayjs(item.dueDate || item.createdAt).format('D MMM YYYY')}</Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 24, minWidth: 150, justifyContent: 'flex-end' }}>
                        <Button type="primary" size="small" onClick={() => setSelectedTaskDetails(item)} style={{ borderRadius: 8 }}>
                          Review Task
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty description="No tasks pending approval" />
                )}
              </div>
            </Col>

            <Col xs={24} lg={12} style={{ marginTop: { xs: 48, lg: 0 } }}>
              <Title level={4} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Financial Overview</Title>
              <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 24, fontWeight: 500 }}>Billing & Spend</Text>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <BubbleCard bodyStyle={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ color: 'var(--text-secondary)', marginTop: 4, background: 'var(--bg-tertiary)', padding: 12, borderRadius: 12, border: '1px solid var(--border-color)' }}><FileText size={20} /></div>
                      <div>
                        <Text style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', fontWeight: 600, marginBottom: 4 }}>Next Invoice</Text>
                        {upcomingInvoice ? (
                          <>
                            <Text style={{ fontSize: 18, fontWeight: 800, display: 'block', color: 'var(--text-primary)', marginBottom: 4 }}>₹{(upcomingInvoice.grandTotal || 0).toLocaleString()}</Text>
                            <Text style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>due {dayjs(upcomingInvoice.dueDate || upcomingInvoice.createdAt).format('D MMM YYYY')}</Text>
                          </>
                        ) : (
                          <Text style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 500 }}>No pending invoices</Text>
                        )}
                      </div>
                    </div>
                    {upcomingInvoice && (
                      <Button type="link" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-secondary)', padding: 0 }} onClick={() => navigate(`/client/workspace/invoices/${upcomingInvoice._id}/view`)}>View</Button>
                    )}
                  </div>
                </BubbleCard>
                
                <BubbleCard bodyStyle={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ color: 'var(--accent-secondary)', marginTop: 4, background: 'rgba(13,148,136,0.1)', padding: 12, borderRadius: 12, border: '1px solid rgba(13,148,136,0.2)' }}><Receipt size={20} /></div>
                      <div>
                        <Text style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', fontWeight: 600, marginBottom: 4 }}>Total Invoices</Text>
                        <Text style={{ fontSize: 22, fontWeight: 800, display: 'block', color: 'var(--text-primary)', marginBottom: 4 }}>{stats.totalInvoicesCount}</Text>
                        <Text style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, lineHeight: 1.6 }}>
                          {stats.totalInvoicesCount - stats.pendingInvoicesCount} paid · {stats.pendingInvoicesCount} pending
                        </Text>
                      </div>
                    </div>
                    <Button type="link" style={{ padding: 0, fontWeight: 700, color: 'var(--accent-secondary)', fontSize: 13 }} onClick={() => navigate('/client/billing')}>View All</Button>
                  </div>
                </BubbleCard>
              </div>
            </Col>
          </Row>
        </motion.div>
      </motion.div>
    );
  };

  const renderOperationsDashboard = () => {
    const { stats, recentDeliverables, actionItems } = overviewData;
    const currentMonthName = selectedDate.format('MMMM YYYY');

    const kpis = [
      { label: 'TASKS COMPLETED', value: stats.completedTasksThisMonth, sub: `Out of ${stats.totalTasksThisMonth} this month`, color: 'var(--accent-secondary)', icon: <TrendingUp size={20} /> },
      { label: 'OPEN TASKS', value: stats.openTasksCount, sub: `In progress`, color: 'var(--accent-primary)', icon: <CheckSquare size={20} /> },
      { label: 'OVERDUE TASKS', value: stats.overdueTasksCount, sub: `Requires action`, color: stats.overdueTasksCount > 0 ? 'var(--accent-danger)' : 'var(--accent-success)', icon: <AlertTriangle size={20} /> },
      { label: 'DELIVERABLES IN QUEUE', value: stats.pendingDeliverables, sub: `In pipeline`, color: 'var(--accent-info)', icon: <FileText size={20} /> },
    ];

    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        {/* Header Section */}
        <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} style={{ margin: '4px 0 8px 0', fontWeight: 800 }}>
              Good {dayjs().hour() < 12 ? 'morning' : dayjs().hour() < 17 ? 'afternoon' : 'evening'}, {user?.name || 'Brand Team'}.
            </Title>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>
              Here's your operations and execution overview for {currentMonthName}.
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <DatePicker 
              picker="month" 
              value={selectedDate} 
              onChange={(date) => date && setSelectedDate(date)} 
              size="large"
              allowClear={false}
            />
          </div>
        </motion.div>

        {/* KPI Cards */}
        <motion.div variants={itemVariants} style={{ marginBottom: 32 }}>
          <Row gutter={[16, 16]}>
            {kpis.map((kpi, idx) => (
              <Col xs={24} sm={12} lg={6} key={idx}>
                <div style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: 20,
                  padding: 24,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                  border: '1px solid var(--border-color)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: -10, right: -10, width: 80, height: 80, borderRadius: '50%', background: kpi.color, opacity: 0.05 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${kpi.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>
                      {kpi.icon}
                    </div>
                  </div>
                  <Title level={3} style={{ margin: '0 0 4px 0', fontWeight: 800 }}>{kpi.value}</Title>
                  <Text style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
                    {kpi.label}
                  </Text>
                  <Text style={{ color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500 }}>
                    {kpi.sub}
                  </Text>
                </div>
              </Col>
            ))}
          </Row>
        </motion.div>

        {/* AI Optimization Intelligence Scores */}
        {isSeoFeatureEnabled && (
          <motion.div variants={itemVariants}>
            <div style={{ marginBottom: 16 }}>
              <Title level={2} style={{ margin: '0 0 4px 0', fontWeight: 800 }}>AI Optimization Intelligence</Title>
              <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>Enterprise SEO, GEO, and AEO tracking and analysis.</Text>
            </div>

            {semrushProject ? (
              <Row gutter={[24, 24]} style={{ marginBottom: 40, alignItems: 'stretch' }}>
                <Col xs={24} md={12} xl={8}>
                  <ScoreGaugeCard 
                    title="SEO Score" 
                    score={semrushProject.optimizationScore?.seoScore ?? semrushProject.latestSnapshot?.scores?.seo ?? 0} 
                    previousScore={null} 
                    color="var(--accent-secondary)"
                    description="Traditional Search Engine Optimization score based on authority and technical health."
                    delay={0.1}
                    details={[
                      { label: 'Authority Score', ...(semrushProject.latestSnapshot?.seo?.authorityScore || {}) },
                      { label: 'Technical Health', ...(semrushProject.latestSnapshot?.seo?.technicalScore || {}) },
                      { label: 'Core Web Vitals', ...(semrushProject.latestSnapshot?.seo?.coreWebVitals || {}) }
                    ]}
                  />
                </Col>
                <Col xs={24} md={12} xl={8}>
                  <ScoreGaugeCard 
                    title="GEO Score" 
                    score={semrushProject.optimizationScore?.geoScore ?? semrushProject.latestSnapshot?.scores?.geo ?? 0} 
                    previousScore={null} 
                    color="var(--accent-warning)"
                    description="Generative Engine Optimization readiness for AI summaries."
                    delay={0.2}
                    details={[
                      { label: 'E-E-A-T Signals', ...(semrushProject.latestSnapshot?.geo?.eeatSignals || {}) },
                      { label: 'AI Readability', ...(semrushProject.latestSnapshot?.geo?.aiReadability || {}) },
                      { label: 'LLM Formatting', ...(semrushProject.latestSnapshot?.geo?.llmFormatting || {}) }
                    ]}
                  />
                </Col>
                <Col xs={24} md={12} xl={8}>
                  <ScoreGaugeCard 
                    title="AEO Score" 
                    score={semrushProject.optimizationScore?.aeoScore ?? semrushProject.latestSnapshot?.scores?.aeo ?? 0} 
                    previousScore={null} 
                    color="var(--accent-info)"
                    description="Answer Engine Optimization for voice and direct answers."
                    delay={0.3}
                    details={[
                      { label: 'Answer Intent', ...(semrushProject.latestSnapshot?.aeo?.answerIntent || {}) },
                      { label: 'Conversational', ...(semrushProject.latestSnapshot?.aeo?.conversationalContent || {}) },
                      { label: 'FAQ Schema', ...(semrushProject.latestSnapshot?.aeo?.faqSchema || {}) }
                    ]}
                  />
                </Col>
              </Row>
            ) : (
              <BubbleCard large style={{ marginBottom: 40, textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ maxWidth: 500, margin: '0 auto' }}>
                  <div style={{ background: 'var(--bg-secondary)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '1px solid var(--border-color)' }}>
                    <TrendingUp size={36} style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <Title level={3} style={{ fontWeight: 800, marginBottom: 12 }}>No Optimization Project Found</Title>
                  <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 24, lineHeight: 1.6 }}>
                    Create an SEO/AEO/GEO project in the Intelligence tab to unlock powerful search engine performance metrics and AI optimization insights.
                  </Text>
                  <Button 
                    type="primary" 
                    size="large" 
                    style={{ borderRadius: 8, fontWeight: 600, padding: '0 24px' }}
                    onClick={() => navigate('/client/intelligence/seo-aeo-geo')}
                  >
                    Create Project Now
                  </Button>
                </div>
              </BubbleCard>
            )}
          </motion.div>
        )}

        {/* Deliverables and Upcoming Row */}
        <motion.div variants={itemVariants}>
          <Row gutter={48}>
            <Col xs={24} lg={12}>
              <Title level={4} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Recent deliverables</Title>
              <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 24, fontWeight: 500 }}>Latest updates from your account team</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {recentDeliverables && recentDeliverables.length > 0 ? (
                  recentDeliverables.map((item, idx) => (
                    <div key={idx} className="hover-bg" style={{ display: 'flex', alignItems: 'center', padding: '20px 24px', background: 'var(--bg-secondary)', borderRadius: '24px 24px 24px 8px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', flexWrap: 'wrap', gap: 16 }}>
                      <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 12, color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                        <FileText size={18}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <Text style={{ fontWeight: 700, display: 'block', fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>{item.title}</Text>
                        <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>{dayjs(item.dueDate || item.createdAt).format('D MMM YYYY')}</Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 24, minWidth: 150, justifyContent: 'flex-end' }}>
                        <Button type="primary" size="small" onClick={() => setSelectedTaskDetails(item)} style={{ borderRadius: 8 }}>
                          View Task
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty description="No recent deliverables found" />
                )}
              </div>
            </Col>

            <Col xs={24} lg={12} style={{ marginTop: { xs: 48, lg: 0 } }}>
              <Title level={4} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Action Items</Title>
              <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 24, fontWeight: 500 }}>Tasks requiring attention</Text>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {actionItems && actionItems.length > 0 ? (
                  actionItems.map((item, idx) => (
                    <div key={idx} className="hover-bg" style={{ display: 'flex', alignItems: 'center', padding: '20px 24px', background: 'var(--bg-secondary)', borderRadius: '24px 24px 24px 8px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', flexWrap: 'wrap', gap: 16 }}>
                      <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 12, color: 'var(--accent-danger)', border: '1px solid var(--border-color)' }}>
                        <AlertTriangle size={18}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <Text style={{ fontWeight: 700, display: 'block', fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>{item.title}</Text>
                        <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Due: {dayjs(item.dueDate || item.createdAt).format('D MMM YYYY')}</Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 24, minWidth: 150, justifyContent: 'flex-end' }}>
                        <Button type="primary" size="small" onClick={() => setSelectedTaskDetails(item)} style={{ borderRadius: 8 }}>
                          Resolve
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty description="No action items found" />
                )}
              </div>
            </Col>
          </Row>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <Spin spinning={loading} tip="Updating dashboard...">
      {role === 'brand_super_admin' ? renderExecutiveDashboard() : renderOperationsDashboard()}

      <TaskDetailDrawer
        task={selectedTaskDetails}
        visible={!!selectedTaskDetails}
        onClose={() => setSelectedTaskDetails(null)}
        onTaskCompleted={() => {
          setShowCelebration(true);
          fetchOverview();
        }}
      />

      <TaskCompletionCelebrate
        isActive={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />
    </Spin>
  );
};

export default DashboardTab;
