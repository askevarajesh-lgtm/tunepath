import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Typography, Card, Table, Button, Space, Empty, Alert, Tag, message,
  Popconfirm, Collapse, Tabs, Statistic, Row, Col, Input, Select,
  Progress, Badge, Tooltip, Skeleton, Divider, Spin
} from 'antd';
import {
  Swords, History as HistoryIcon, TrendingUp, TrendingDown,
  AlertTriangle, Target, Zap, Globe, Link2, FileText, BarChart2,
  Search, RefreshCcw, Download, Camera, ChevronRight, ArrowUpRight,
  Shield, Layers, Brain, Award, Activity, Eye, ExternalLink,
  CheckCircle, Clock, Flame, Star, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { useSEO } from '../context/SEOContext';
import { useTheme } from '../../../../contexts/ThemeContext';
import { seoWorkspaceApi } from '../../../../api/seoWorkspaceApi';
import { competitorIntelligenceApi } from '../../../../api/competitorIntelligenceApi';
import ProjectSelector from '../components/shared/ProjectSelector';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// ── Design tokens ────────────────────────────────────────────────────────────
const THREAT_COLORS   = { minimal: '#d9d9d9', low: '#52c41a', medium: '#faad14', high: '#f5222d', critical: '#820014' };
const STATUS_COLORS   = { Suggested: 'gold', Approved: 'green', Rejected: 'red' };
const CHART_COLORS    = ['#1677ff','#52c41a','#faad14','#f5222d','#722ed1','#13c2c2'];
const GAP_TYPE_LABELS = {
  keyword_gap: 'Keyword Gap', content_gap: 'Content Gap',
  backlink_gap: 'Backlink Gap', page_gap: 'Page Gap'
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => (n == null ? '—' : typeof n === 'number' ? n.toLocaleString() : n);
const formatCompact = (n) => {
  if (n == null || n === '' || n === '—') return '—';
  const num = typeof n === 'string' ? Number(n.replace(/,/g, '')) : Number(n);
  if (isNaN(num)) return n;
  if (Math.abs(num) >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (Math.abs(num) >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (Math.abs(num) >= 10_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toLocaleString();
};
const pct = (n) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${typeof n === 'number' ? n.toLocaleString() : n}`);
const scoreColor = (n) => n >= 65 ? '#f5222d' : n >= 35 ? '#faad14' : '#52c41a';
const getDomainFavicon = (domain) =>
  `https://www.google.com/s2/favicons?sz=32&domain_url=${domain}`;

const motionFade = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25 } };

// ── Score Gauge ──────────────────────────────────────────────────────────────
const ScoreGauge = ({ value = 0, size = 48, label }) => (
  <div style={{ textAlign: 'center' }}>
    <Progress
      type="circle"
      percent={value}
      size={size}
      strokeColor={scoreColor(value)}
      format={() => <span style={{ fontSize: size * 0.28, fontWeight: 700 }}>{value}</span>}
    />
    {label && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>}
  </div>
);

// ── Metric Card ──────────────────────────────────────────────────────────────
const MetricCard = ({ title, value, sub, icon: Icon, color, gradient }) => {
  const isNumeric = value != null && value !== '' && value !== '—' && !isNaN(Number(String(value).replace(/,/g, '')));
  const rawNum = isNumeric ? Number(String(value).replace(/,/g, '')) : null;
  const displayVal = isNumeric && Math.abs(rawNum) >= 10000 ? formatCompact(rawNum) : (value != null ? value : '—');
  const fullVal = isNumeric ? rawNum.toLocaleString() : value;

  return (
    <Card
      size="small"
      bordered={false}
      style={{
        background: gradient || `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
        border: `1px solid ${color}30`,
        borderRadius: 12,
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <div style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            fontWeight: 500,
            marginBottom: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }} title={title}>
            {title}
          </div>
          <Tooltip title={fullVal != null ? `${title}: ${fullVal}` : undefined}>
            <div style={{
              fontSize: 'clamp(16px, 1.3vw, 20px)',
              fontWeight: 800,
              color,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {displayVal}
            </div>
          </Tooltip>
          {sub && (
            <div style={{
              fontSize: 10,
              color: 'var(--text-secondary)',
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }} title={sub}>
              {sub}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

// ── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ icon: Icon = Globe, title, desc, action }) => (
  <div style={{ textAlign: 'center', padding: '48px 24px' }}>
    <div style={{
      width: 72, height: 72, borderRadius: 20, background: 'var(--bg-secondary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
    }}>
      <Icon size={32} style={{ color: 'var(--text-secondary)' }} />
    </div>
    <Title level={5} style={{ margin: '0 0 8px' }}>{title}</Title>
    <Text type="secondary" style={{ fontSize: 13 }}>{desc}</Text>
    {action && <div style={{ marginTop: 20 }}>{action}</div>}
  </div>
);

// ── Main Component ───────────────────────────────────────────────────────────
const CompetitorsTab = () => {
  const { isDark } = useTheme();
  const { activeProjectId: projectId, activeProject } = useSEO();

  const BUCKET_META = useMemo(() => ({
    quick_win:  { label: 'Quick Win',  color: '#52c41a', bg: isDark ? 'rgba(82, 196, 26, 0.12)' : '#f6ffed', icon: Zap,       order: 0 },
    easy_win:   { label: 'Easy Win',   color: '#1677ff', bg: isDark ? 'rgba(22, 119, 255, 0.12)' : '#e6f4ff', icon: Target,    order: 1 },
    medium:     { label: 'Medium',     color: '#faad14', bg: isDark ? 'rgba(250, 173, 20, 0.12)' : '#fffbe6', icon: Activity,  order: 2 },
    hard:       { label: 'Hard',       color: '#f5222d', bg: isDark ? 'rgba(245, 34, 45, 0.12)' : '#fff1f0', icon: Flame,     order: 3 },
    long_term:  { label: 'Long Term',  color: '#722ed1', bg: isDark ? 'rgba(114, 46, 209, 0.12)' : '#f9f0ff', icon: Star,      order: 4 }
  }), [isDark]);

  const [activeTab, setActiveTab] = useState('overview');

  // Agent discovery state (existing functionality)
  const [running, setRunning] = useState(false);
  const [agentResult, setAgentResult] = useState(null);
  const [agentError, setAgentError] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // Enterprise data state
  const [competitors, setCompetitors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Comparison state
  const [gapType, setGapType] = useState('keyword_gap');
  const [gapResult, setGapResult] = useState(null);
  const [gapLoading, setGapLoading] = useState(false);
  const [gapFilter, setGapFilter] = useState('');

  // Opportunities state
  const [opportunities, setOpportunities] = useState(null);
  const [oppsLoading, setOppsLoading] = useState(false);

  // Recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [selectedRecKeys, setSelectedRecKeys] = useState([]);

  // Trend state
  const [trendDays, setTrendDays] = useState(30);
  const [trendData, setTrendData] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);

  // Top pages
  const [topPagesResult, setTopPagesResult] = useState(null);
  const [topPagesLoading, setTopPagesLoading] = useState(false);

  // ── Load functions ─────────────────────────────────────────────────────────
  const loadCompetitors = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await competitorIntelligenceApi.getCompetitors(projectId);
      setCompetitors(Array.isArray(data) ? data : []);
    } catch (_) { /* non-fatal */ }
  }, [projectId]);

  const loadSummary = useCallback(async () => {
    if (!projectId) return;
    setSummaryLoading(true);
    try {
      const data = await competitorIntelligenceApi.getCompetitorSummary(projectId);
      setSummary(data);
    } catch (_) { /* non-fatal */ } finally {
      setSummaryLoading(false);
    }
  }, [projectId]);

  const loadHistory = useCallback(async () => {
    if (!projectId) return;
    setHistoryLoading(true);
    try {
      const data = await seoWorkspaceApi.getCompetitorHistory(projectId);
      setHistory(Array.isArray(data) ? data : []);
    } catch (_) { message.error('Failed to load history'); } finally {
      setHistoryLoading(false);
    }
  }, [projectId]);

  const loadTrend = useCallback(async () => {
    if (!projectId) return;
    setTrendLoading(true);
    try {
      const data = await competitorIntelligenceApi.getCompetitorTrend(projectId, trendDays);
      setTrendData(data);
    } catch (_) { } finally { setTrendLoading(false); }
  }, [projectId, trendDays]);

  const loadOpportunities = useCallback(async () => {
    if (!projectId) return;
    setOppsLoading(true);
    try {
      const data = await competitorIntelligenceApi.getOpportunities(projectId);
      setOpportunities(data);
    } catch (_) { } finally { setOppsLoading(false); }
  }, [projectId]);

  const loadRecommendations = useCallback(async () => {
    if (!projectId) return;
    setRecsLoading(true);
    try {
      const data = await competitorIntelligenceApi.getRecommendations(projectId);
      setRecommendations(Array.isArray(data) ? data : []);
    } catch (_) { } finally { setRecsLoading(false); }
  }, [projectId]);

  // On project change, reload core data
  useEffect(() => {
    if (!projectId) return;
    loadCompetitors();
    loadSummary();
  }, [projectId, loadCompetitors, loadSummary]);

  // On tab switch, load tab-specific data
  useEffect(() => {
    if (!projectId) return;
    if (activeTab === 'trend') loadTrend();
    if (activeTab === 'opportunities') loadOpportunities();
    if (activeTab === 'recommendations') loadRecommendations();
  }, [activeTab, projectId]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const runAgent = async () => {
    setRunning(true);
    setAgentError(null);
    try {
      const res = await seoWorkspaceApi.runCompetitorAgent(projectId);
      setAgentResult(res.data);
      setSelectedRowKeys([]);
      await loadCompetitors();
      await loadSummary();
      message.success('Competitor analysis completed');
    } catch (err) {
      setAgentError(err?.response?.data?.error || 'Competitor analysis failed');
    } finally { setRunning(false); }
  };

  const approveSelected = async () => {
    try {
      const res = await seoWorkspaceApi.approveCompetitorSuggestions(projectId, selectedRowKeys);
      message.success(`Approved ${res.modifiedCount || ''}`);
      setSelectedRowKeys([]);
      await loadCompetitors();
      await loadSummary();
    } catch (err) { message.error(err?.response?.data?.message || 'Approve failed'); }
  };

  const rejectSelected = async () => {
    try {
      await seoWorkspaceApi.rejectCompetitorSuggestions(projectId, selectedRowKeys);
      message.success('Rejected');
      setSelectedRowKeys([]);
      await loadCompetitors();
      await loadSummary();
    } catch (err) { message.error(err?.response?.data?.message || 'Reject failed'); }
  };

  const runComparison = async () => {
    const approved = competitors.filter((c) => c.status === 'Approved').map((c) => c.domain);
    if (approved.length === 0) {
      message.warning('Approve at least one competitor first');
      return;
    }
    setGapLoading(true);
    setGapResult(null);
    try {
      const data = await competitorIntelligenceApi.runComparison(projectId, approved, gapType);
      setGapResult(data);
    } catch (err) {
      message.error(err?.response?.data?.error || 'Comparison failed');
    } finally { setGapLoading(false); }
  };

  const runTopPages = async () => {
    const approved = competitors.filter((c) => c.status === 'Approved').map((c) => c.domain);
    if (approved.length === 0) { message.warning('Approve at least one competitor first'); return; }
    setTopPagesLoading(true);
    setTopPagesResult(null);
    try {
      const data = await competitorIntelligenceApi.runComparison(projectId, approved, 'top_pages');
      setTopPagesResult(data);
    } catch (err) { message.error('Top pages analysis failed'); } finally { setTopPagesLoading(false); }
  };

  const generateRecs = async () => {
    if (!gapResult || !Array.isArray(gapResult.rows) || gapResult.rows.length === 0) {
      message.warning('Run a gap analysis first to get data for recommendations');
      return;
    }
    try {
      await competitorIntelligenceApi.generateRecommendations(projectId, gapResult);
      message.success('Recommendations generated');
      await loadRecommendations();
      await loadOpportunities();
    } catch (err) { message.error('Failed to generate recommendations'); }
  };

  const dismissRecs = async () => {
    try {
      const res = await competitorIntelligenceApi.dismissRecommendations(projectId, selectedRecKeys);
      message.success(`Dismissed ${res.modifiedCount || ''}`);
      setSelectedRecKeys([]);
      await loadRecommendations();
      await loadOpportunities();
    } catch (err) { message.error('Dismiss failed'); }
  };

  const convertToTasks = async (ids) => {
    try {
      const tasks = await competitorIntelligenceApi.generateTasks(projectId, ids);
      message.success(`${tasks.length} task(s) created`);
      setSelectedRecKeys([]);
      await loadRecommendations();
      await loadOpportunities();
    } catch (err) { message.error('Failed to create tasks'); }
  };

  const captureSnapshot = async () => {
    try {
      const res = await competitorIntelligenceApi.captureSnapshot(projectId);
      message.success(`Snapshot captured (${res.captured} competitors)`);
      await loadTrend();
    } catch (err) { message.error('Snapshot failed'); }
  };

  const exportCSV = (rows, filename) => {
    if (!rows || rows.length === 0) { message.info('No data to export'); return; }
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    message.success('Exported');
  };

  // ── Gap rows (filtered) ───────────────────────────────────────────────────
  const filteredGapRows = useMemo(() => {
    if (!gapResult?.rows) return [];
    return gapResult.rows.filter((r) =>
      !gapFilter || (r.keyword || r.referringDomain || r.pageUrl || '').toLowerCase().includes(gapFilter.toLowerCase())
    );
  }, [gapResult, gapFilter]);

  // ── Radar data for matrix ─────────────────────────────────────────────────
  const radarData = useMemo(() => {
    const metrics = ['Traffic', 'Keywords', 'Backlinks', 'Authority', 'ThreatScore', 'OppScore'];
    const metricKeys = [
      'metrics.organicTraffic', 'metrics.organicKeywords', 'metrics.backlinks',
      'metrics.authority', 'threatScore', 'opportunityScore'
    ];
    const maxes = metricKeys.map((k) => {
      const vals = competitors.map((c) => {
        const parts = k.split('.');
        return parts.length === 2 ? (c[parts[0]]?.[parts[1]] || 0) : (c[parts[0]] || 0);
      });
      return Math.max(1, ...vals);
    });

    return metrics.map((m, i) => {
      const row = { metric: m };
      competitors.slice(0, 5).forEach((c) => {
        const parts = metricKeys[i].split('.');
        const val = parts.length === 2 ? (c[parts[0]]?.[parts[1]] || 0) : (c[parts[0]] || 0);
        row[c.domain] = Math.round((val / maxes[i]) * 100);
      });
      return row;
    });
  }, [competitors]);

  // ── Approved competitor domains ────────────────────────────────────────────
  const approvedCompetitors = useMemo(() => competitors.filter((c) => c.status === 'Approved'), [competitors]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── Tab Renderers ─────────────────────────────────────────────────────────
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ── 1. Overview + Discovery ───────────────────────────────────────────────
  const renderOverview = () => {
    if (!summaryLoading && summary && summary.totalCompetitors === 0) {
      const isKeyMissing = agentError && agentError.toLowerCase().includes('api key is not configured');
      return (
        <motion.div {...motionFade}>
          <EmptyState
            icon={isKeyMissing ? AlertTriangle : Swords}
            title={isKeyMissing ? "Anthropic API key is not configured" : "No Competitors Found"}
            desc={isKeyMissing ? "Please configure your Anthropic API Key in AI Settings to enable competitor discovery." : "Run the Competitor Agent to discover and analyze competitors for your project."}
            action={!isKeyMissing && <Button type="primary" loading={running} onClick={runAgent}>Run Competitor Agent</Button>}
          />
          {agentError && !isKeyMissing && (
            <Alert type="error" showIcon message={agentError} style={{ marginTop: 16, maxWidth: 600, margin: '16px auto' }} />
          )}
        </motion.div>
      );
    }

    return (
    <motion.div {...motionFade}>
      {/* Executive Summary */}
      {summaryLoading ? (
        <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 24 }} />
      ) : summary ? (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={8} md={4} lg={4}>
              <MetricCard title="Total Competitors" value={summary.totalCompetitors}
                icon={Globe} color="#1677ff"
                sub={`${summary.approvedCount} approved`} />
            </Col>
            <Col xs={12} sm={8} md={4} lg={4}>
              <MetricCard title="Avg Traffic" value={summary.avgTraffic}
                icon={TrendingUp} color="#52c41a"
                sub="vs competitors" />
            </Col>
            <Col xs={12} sm={8} md={4} lg={4}>
              <MetricCard title="Total Keywords" value={summary.totalKeywords}
                icon={BarChart2} color="#722ed1" />
            </Col>
            <Col xs={12} sm={8} md={4} lg={4}>
              <MetricCard title="Avg Threat Score" value={summary.avgThreatScore}
                icon={AlertTriangle} color={scoreColor(summary.avgThreatScore)}
                sub="0–100" />
            </Col>
            <Col xs={12} sm={8} md={4} lg={4}>
              <MetricCard title="Avg Opp Score" value={summary.avgOpportunityScore}
                icon={Target} color="#13c2c2"
                sub="0–100" />
            </Col>
            <Col xs={12} sm={8} md={4} lg={4}>
              <MetricCard title="Open Recs" value={summary.openRecommendations}
                icon={Brain} color="#fa8c16"
                sub="proposed" />
            </Col>
          </Row>

          {/* Threat Distribution */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} md={8}>
              <Card size="small" title="Threat Distribution" bordered={false}
                style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
                {Object.entries(summary.threatDistribution || {}).map(([level, count]) => (
                  <div key={level} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Tag color={level === 'high' ? 'red' : level === 'medium' ? 'gold' : 'green'}>
                        {level.toUpperCase()}
                      </Tag>
                      <Text strong>{count}</Text>
                    </div>
                    <Progress
                      percent={summary.totalCompetitors > 0 ? Math.round((count / summary.totalCompetitors) * 100) : 0}
                      strokeColor={THREAT_COLORS[level]}
                      showInfo={false}
                      size="small"
                    />
                  </div>
                ))}
              </Card>
            </Col>
            <Col xs={24} md={16}>
              <Card size="small" title="Recent Comparison Runs" bordered={false}
                style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
                {(summary.recentRuns || []).length === 0 ? (
                  <Empty description="No runs yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <Table
                    size="small" pagination={false} showHeader={false}
                    dataSource={summary.recentRuns}
                    rowKey={(r, i) => i}
                    columns={[
                      { key: 't', render: (_, r) => <Tag>{GAP_TYPE_LABELS[r.type] || r.type}</Tag> },
                      { key: 's', render: (_, r) => (
                        <Tag color={r.status === 'completed' ? 'green' : r.status === 'failed' ? 'red' : 'gold'}>
                          {r.status}
                        </Tag>
                      )},
                      { key: 'd', render: (_, r) => <Text type="secondary">{r.durationMs ? `${(r.durationMs/1000).toFixed(1)}s` : '—'}</Text> },
                      { key: 'at', render: (_, r) => <Text type="secondary" style={{ fontSize: 11 }}>{new Date(r.createdAt).toLocaleString()}</Text> }
                    ]}
                  />
                )}
              </Card>
            </Col>
          </Row>
        </>
      ) : null}

      {/* Agent Discovery Card */}
      <Card
        size="small"
        title={<Space><Swords size={16} />Competitor Agent</Space>}
        extra={
          <Space>
            {selectedRowKeys.length > 0 && (
              <>
                <Popconfirm title={`Approve ${selectedRowKeys.length} competitor(s)?`} onConfirm={approveSelected}>
                  <Button size="small" type="primary">Approve Selected</Button>
                </Popconfirm>
                <Button size="small" danger onClick={rejectSelected}>Reject Selected</Button>
              </>
            )}
            <Button type="primary" loading={running} onClick={runAgent} icon={<RefreshCcw size={14} />}>
              Run Analysis
            </Button>
          </Space>
        }
        style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}
      >
        {agentError && <Alert type="error" showIcon message={agentError.includes('API key') ? 'Anthropic API key is not configured. Please configure it in AI Settings.' : agentError} style={{ marginBottom: 16 }} closable onClose={() => setAgentError(null)} />}

        {agentResult?.summary && (
          <div style={{
            background: isDark ? 'linear-gradient(135deg, rgba(22, 119, 255, 0.15) 0%, rgba(22, 119, 255, 0.05) 100%)' : 'linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%)',
            borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            border: isDark ? '1px solid rgba(22, 119, 255, 0.3)' : '1px solid #bae0ff'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Brain size={16} style={{ color: '#1677ff', marginTop: 2, flexShrink: 0 }} />
              <Text style={{ fontSize: 13 }}>{agentResult.summary}</Text>
            </div>
          </div>
        )}

        <Table
          rowKey="_id"
          size="small"
          dataSource={competitors}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys, getCheckboxProps: (r) => ({ disabled: r.status !== 'Suggested' }) }}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'], showSizeChanger: false }}
          columns={[
            {
              title: 'Competitor', key: 'domain',
              render: (_, r) => (
                <Space>
                  <img src={getDomainFavicon(r.domain)} width={16} height={16} onError={(e) => e.target.style.display='none'} alt="" />
                  <a href={`https://${r.domain}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                    {r.domain}
                  </a>
                  {r.country && <Tag style={{ fontSize: 10 }}>{r.country}</Tag>}
                </Space>
              )
            },
            {
              title: 'Threat', key: 'threat',
              render: (_, r) => {
                const level = r.agent?.threatLevel || 'medium';
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color={level === 'high' ? 'red' : level === 'medium' ? 'gold' : 'green'}>
                      {level.toUpperCase()}
                    </Tag>
                    {r.threatScore > 0 && (
                      <Progress percent={r.threatScore} size="small" showInfo={false}
                        strokeColor={scoreColor(r.threatScore)}
                        style={{ width: 60 }} />
                    )}
                  </div>
                );
              }
            },
            { title: 'Org. Traffic', key: 'ot', render: (_, r) => fmt(r.metrics?.organicTraffic) },
            { title: 'Keywords', key: 'kw', render: (_, r) => fmt(r.metrics?.organicKeywords) },
            { title: 'Backlinks', key: 'bl', render: (_, r) => fmt(r.metrics?.backlinks) },
            { title: 'Authority', key: 'da', render: (_, r) => r.metrics?.authority ? <Badge count={r.metrics.authority} style={{ background: '#722ed1' }} /> : '—' },
            {
              title: 'Status', key: 'status',
              render: (_, r) => <Tag color={STATUS_COLORS[r.status] || 'default'}>{r.status}</Tag>
            }
          ]}
          expandable={{
            rowExpandable: (r) => r.agent?.strengths?.length || r.agent?.weaknesses?.length || r.agent?.contentGaps?.length,
            expandedRowRender: (r) => (
              <div style={{ padding: '8px 16px' }}>
                <Row gutter={16}>
                  {r.agent?.strengths?.length > 0 && (
                    <Col span={8}>
                      <Text strong style={{ color: '#52c41a' }}>Strengths</Text>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                        {r.agent.strengths.map((s, i) => <li key={i} style={{ fontSize: 12 }}>{s}</li>)}
                      </ul>
                    </Col>
                  )}
                  {r.agent?.weaknesses?.length > 0 && (
                    <Col span={8}>
                      <Text strong style={{ color: '#f5222d' }}>Weaknesses</Text>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                        {r.agent.weaknesses.map((s, i) => <li key={i} style={{ fontSize: 12 }}>{s}</li>)}
                      </ul>
                    </Col>
                  )}
                  {r.agent?.contentGaps?.length > 0 && (
                    <Col span={8}>
                      <Text strong style={{ color: '#fa8c16' }}>Content Gaps</Text>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                        {r.agent.contentGaps.map((s, i) => <li key={i} style={{ fontSize: 12 }}>{s}</li>)}
                      </ul>
                    </Col>
                  )}
                </Row>
                {r.agent?.rationale && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>{r.agent.rationale}</Text>}
              </div>
            )
          }}
          locale={{ emptyText: <Empty description="Run the competitor agent to discover competitors" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Card>
    </motion.div>
  );
};

  // ── 2. Keyword / Content / Backlink / Page Gap ────────────────────────────
  const renderGapAnalysis = () => {
    const cols = {
      keyword_gap: [
        { title: 'Keyword', dataIndex: 'keyword', key: 'kw', sorter: (a, b) => (a.keyword || '').localeCompare(b.keyword || '') },
        { title: 'Volume', dataIndex: 'searchVolume', key: 'vol', sorter: (a, b) => (b.searchVolume || 0) - (a.searchVolume || 0), render: (v) => fmt(v) },
        { title: 'Competitor', dataIndex: 'competitorDomain', key: 'cd', render: (v) => <Tag>{v}</Tag> },
        { title: 'Their Rank', dataIndex: 'competitorRank', key: 'cr', sorter: (a, b) => (a.competitorRank || 999) - (b.competitorRank || 999), render: (v) => v ? `#${v}` : '—' },
        { title: 'Your Rank', dataIndex: 'ownRank', key: 'or', render: (v) => v ? `#${v}` : <Tag color="red">Not Ranking</Tag> }
      ],
      content_gap: [
        { title: 'Keyword / Topic', dataIndex: 'keyword', key: 'kw' },
        { title: 'Volume', dataIndex: 'searchVolume', key: 'vol', sorter: (a, b) => (b.searchVolume || 0) - (a.searchVolume || 0), render: (v) => fmt(v) },
        { title: 'Competitor Page', dataIndex: 'pageUrl', key: 'pu', render: (v) => v ? <a href={v} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{v.split('/').slice(-2).join('/')}</a> : '—' },
        { title: 'Competitor', dataIndex: 'competitorDomain', key: 'cd', render: (v) => <Tag>{v}</Tag> },
        { title: 'Status', key: 'st', render: (_, r) => r.ownRank ? <Tag color="blue">Weak</Tag> : <Tag color="red">Missing</Tag> }
      ],
      backlink_gap: [
        { title: 'Referring Domain', dataIndex: 'referringDomain', key: 'rd', render: (v) => v || <Text type="secondary">Aggregate gap</Text> },
        { title: 'Competitor', dataIndex: 'competitorDomain', key: 'cd', render: (v) => <Tag>{v}</Tag> },
        { title: 'Domain Rank', dataIndex: 'competitorRank', key: 'dr', sorter: (a, b) => (b.competitorRank || 0) - (a.competitorRank || 0), render: (v) => fmt(v) },
        { title: 'Action', key: 'act', render: () => <Tag color="purple">Outreach</Tag> }
      ],
      page_gap: [
        { title: 'Competitor Page', dataIndex: 'pageUrl', key: 'pu', render: (v) => v ? <a href={v} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{v}</a> : '—' },
        { title: 'Keyword', dataIndex: 'keyword', key: 'kw' },
        { title: 'Volume', dataIndex: 'searchVolume', key: 'vol', sorter: (a, b) => (b.searchVolume || 0) - (a.searchVolume || 0), render: (v) => fmt(v) },
        { title: 'Competitor', dataIndex: 'competitorDomain', key: 'cd', render: (v) => <Tag>{v}</Tag> }
      ]
    };

    return (
      <motion.div {...motionFade}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Gap Type</Text>
            <Select value={gapType} onChange={setGapType} style={{ width: 160 }}>
              <Option value="keyword_gap">Keyword Gap</Option>
              <Option value="content_gap">Content Gap</Option>
              <Option value="backlink_gap">Backlink Gap</Option>
              <Option value="page_gap">Page Gap</Option>
            </Select>
          </div>
          <Button type="primary" loading={gapLoading} onClick={runComparison} icon={<Swords size={14} />}>
            Run Analysis
          </Button>
          {gapResult && (
            <>
              <Button onClick={generateRecs} icon={<Brain size={14} />}>
                Generate Recommendations
              </Button>
              <Button icon={<Download size={14} />} onClick={() => exportCSV(gapResult.rows, `${gapType}_gap.csv`)}>
                Export CSV
              </Button>
            </>
          )}
          {approvedCompetitors.length === 0 && (
            <Alert type="warning" showIcon message="Approve competitors in the Overview tab to run gap analysis" style={{ padding: '4px 12px' }} />
          )}
        </div>

        {gapLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : gapResult ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={8}>
                  <Card size="small" bordered={false} style={{ background: isDark ? 'rgba(22, 119, 255, 0.12)' : '#f0f5ff', border: isDark ? '1px solid rgba(22, 119, 255, 0.3)' : undefined, borderRadius: 8, overflow: 'hidden' }}>
                    <Statistic title="Total Gaps Found" value={gapResult.rows?.length || 0} valueStyle={{ color: '#1677ff', fontSize: 'clamp(18px, 1.4vw, 24px)' }} />
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card size="small" bordered={false} style={{ background: isDark ? 'rgba(82, 196, 26, 0.12)' : '#f6ffed', border: isDark ? '1px solid rgba(82, 196, 26, 0.3)' : undefined, borderRadius: 8, overflow: 'hidden' }}>
                    <Statistic title="Avg Search Volume" value={formatCompact(Math.round((gapResult.rows || []).reduce((s, r) => s + (r.searchVolume || 0), 0) / Math.max(1, gapResult.rows?.length || 1)))} valueStyle={{ color: '#52c41a', fontSize: 'clamp(18px, 1.4vw, 24px)' }} />
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card size="small" bordered={false} style={{ background: isDark ? 'rgba(250, 140, 22, 0.12)' : '#fff7e6', border: isDark ? '1px solid rgba(250, 140, 22, 0.3)' : undefined, borderRadius: 8, overflow: 'hidden' }}>
                    <Statistic title="Competitors Analyzed" value={gapResult.domains?.length - 1 || 0} valueStyle={{ color: '#fa8c16', fontSize: 'clamp(18px, 1.4vw, 24px)' }} />
                  </Card>
                </Col>
              </Row>
            </div>

            <Input.Search
              placeholder="Filter by keyword / domain / URL..."
              value={gapFilter} onChange={(e) => setGapFilter(e.target.value)}
              style={{ maxWidth: 400, marginBottom: 12 }}
              allowClear
            />

            <Table
              rowKey={(r, i) => r.keyword || r.referringDomain || r.pageUrl || i}
              size="small"
              dataSource={filteredGapRows}
              columns={cols[gapType] || cols.keyword_gap}
              pagination={{ defaultPageSize: 25, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'], showSizeChanger: true }}
              scroll={{ x: 'max-content' }}
            />
          </>
        ) : (
          <EmptyState
            icon={Search}
            title="No gap analysis yet"
            desc="Select a gap type and run analysis to discover opportunities against your approved competitors."
            action={<Button type="primary" onClick={runComparison} loading={gapLoading}>Run Analysis</Button>}
          />
        )}
      </motion.div>
    );
  };

  // ── 3. Top Pages ──────────────────────────────────────────────────────────
  const renderTopPages = () => (
    <motion.div {...motionFade}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button type="primary" loading={topPagesLoading} onClick={runTopPages} icon={<Globe size={14} />}>
          Analyze Top Pages
        </Button>
        {topPagesResult && (
          <Button icon={<Download size={14} />} onClick={() => {
            const allPages = Object.values(topPagesResult.pagesByDomain || {}).flat();
            exportCSV(allPages, 'top_pages.csv');
          }}>Export CSV</Button>
        )}
        {approvedCompetitors.length === 0 && (
          <Alert type="warning" showIcon message="Approve competitors in Overview first" style={{ padding: '4px 12px' }} />
        )}
      </div>

      {topPagesLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : topPagesResult?.pagesByDomain ? (
        <Tabs
          type="card"
          items={Object.entries(topPagesResult.pagesByDomain).map(([domain, pages]) => ({
            key: domain,
            label: (
              <Space>
                <img src={getDomainFavicon(domain)} width={14} height={14} onError={(e) => e.target.style.display='none'} alt="" />
                {domain}
                <Badge count={pages.length} style={{ background: '#1677ff' }} />
              </Space>
            ),
            children: (
              <Table
                rowKey="url"
                size="small"
                dataSource={pages}
                pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                columns={[
                  { title: 'URL', dataIndex: 'url', key: 'url', render: (v) => (
                    <a href={v} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                      {v.replace(/^https?:\/\/[^/]+/, '').substring(0, 60) || '/'}
                      <ExternalLink size={10} style={{ marginLeft: 4 }} />
                    </a>
                  )},
                  { title: 'Est. Traffic', dataIndex: 'traffic', key: 'traffic', sorter: (a, b) => b.traffic - a.traffic, render: (v) => fmt(v) },
                  { title: 'Keywords', dataIndex: 'keywords', key: 'kw', render: (v) => fmt(v) },
                  { title: 'Backlinks', dataIndex: 'backlinks', key: 'bl', render: (v) => fmt(v) }
                ]}
              />
            )
          }))}
        />
      ) : (
        <EmptyState icon={Globe} title="No top pages yet" desc="Analyze competitor top pages to find their most valuable content."
          action={<Button type="primary" onClick={runTopPages} loading={topPagesLoading}>Analyze Now</Button>} />
      )}
    </motion.div>
  );

  // ── 4. Trend Analysis ──────────────────────────────────────────────────────
  const renderTrend = () => {
    const allDomains = Object.keys(trendData || {});
    const chartData = useMemo(() => {
      if (!trendData || allDomains.length === 0) return [];
      const allDates = [...new Set(allDomains.flatMap((d) => trendData[d].map((s) => s.capturedAt)))].sort();
      return allDates.map((date) => {
        const point = { date: new Date(date).toLocaleDateString() };
        allDomains.forEach((domain) => {
          const snap = trendData[domain].find((s) => s.capturedAt === date);
          if (snap) point[domain] = snap.organicTraffic || 0;
        });
        return point;
      });
    }, [trendData, allDomains]);

    return (
      <motion.div {...motionFade}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select value={trendDays} onChange={(v) => { setTrendDays(v); }} style={{ width: 120 }}>
            <Option value={7}>7 Days</Option>
            <Option value={30}>30 Days</Option>
            <Option value={90}>90 Days</Option>
            <Option value={180}>180 Days</Option>
            <Option value={365}>365 Days</Option>
          </Select>
          <Button onClick={loadTrend} icon={<RefreshCcw size={14} />}>Refresh</Button>
          <Button onClick={captureSnapshot} icon={<Camera size={14} />}>Capture Snapshot</Button>
        </div>

        {trendLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : chartData.length > 0 ? (
          <Card size="small" title="Organic Traffic Trend" bordered={false}
            style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData}>
                <defs>
                  {allDomains.slice(0, 6).map((domain, i) => (
                    <linearGradient key={domain} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[i]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS[i]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                <RechartsTooltip formatter={(v) => fmt(v)} />
                <Legend />
                {allDomains.slice(0, 6).map((domain, i) => (
                  <Area key={domain} type="monotone" dataKey={domain}
                    stroke={CHART_COLORS[i]} fill={`url(#grad${i})`} strokeWidth={2} dot={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        ) : (
          <EmptyState icon={Activity} title="No trend data yet"
            desc="Capture a snapshot to start tracking competitor trends over time."
            action={<Button type="primary" onClick={captureSnapshot} icon={<Camera size={14} />}>Capture First Snapshot</Button>} />
        )}
      </motion.div>
    );
  };

  // ── 5. Opportunities ───────────────────────────────────────────────────────
  const renderOpportunities = () => {
    if (oppsLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
    if (!opportunities) return (
      <EmptyState icon={Target} title="No opportunities yet"
        desc="Run a gap analysis and generate recommendations to see prioritized opportunities."
        action={<Button type="primary" onClick={loadOpportunities}>Load Opportunities</Button>} />
    );

    return (
      <motion.div {...motionFade}>
        {/* Summary row */}
        <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
          {Object.entries(BUCKET_META).map(([key, meta]) => {
            const BucketIcon = meta.icon;
            const count = opportunities.buckets?.[key]?.length || 0;
            return (
              <Col xs={12} sm={8} md={4} lg={4} key={key}>
                <Card
                  size="small"
                  bordered={false}
                  style={{
                    background: meta.bg,
                    border: `1px solid ${meta.color}30`,
                    borderRadius: 12,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '12px 8px',
                    height: '100%',
                    overflow: 'hidden'
                  }}
                >
                  <BucketIcon size={20} style={{ color: meta.color, margin: '0 auto 4px auto' }} />
                  <div style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', fontWeight: 800, color: meta.color, lineHeight: 1.2 }}>{count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{meta.label}</div>
                </Card>
              </Col>
            );
          })}
          {opportunities.summary && (
            <Col xs={12} sm={8} md={4} lg={4}>
              <Card
                size="small"
                bordered={false}
                style={{
                  background: isDark ? 'rgba(22, 119, 255, 0.12)' : '#f0f5ff',
                  borderRadius: 12,
                  border: isDark ? '1px solid rgba(22, 119, 255, 0.3)' : '1px solid #bae0ff',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '12px 8px',
                  height: '100%',
                  overflow: 'hidden'
                }}
              >
                <TrendingUp size={20} style={{ color: '#1677ff', margin: '0 auto 4px auto' }} />
                <div style={{ fontSize: 'clamp(16px, 1.4vw, 20px)', fontWeight: 800, color: '#1677ff', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {formatCompact(opportunities.summary.totalEstimatedTraffic)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }} title={`~$${formatCompact(opportunities.summary.totalEstimatedRevenue)} revenue potential`}>
                  ~${formatCompact(opportunities.summary.totalEstimatedRevenue)} rev
                </div>
              </Card>
            </Col>
          )}
        </Row>

        {/* Bucket tabs */}
        <Tabs
          items={Object.entries(BUCKET_META).map(([key, meta]) => {
            const BucketIcon = meta.icon;
            const items = opportunities.buckets?.[key] || [];
            return {
              key,
              label: (
                <Space>
                  <BucketIcon size={14} style={{ color: meta.color }} />
                  {meta.label}
                  {items.length > 0 && <Badge count={items.length} style={{ background: meta.color }} />}
                </Space>
              ),
              children: items.length === 0 ? (
                <Empty description={`No ${meta.label.toLowerCase()} opportunities`} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                  {items.slice(0, 20).map((opp, i) => (
                    <Card key={opp._id || i} size="small" bordered={false}
                      style={{ borderRadius: 12, border: `1px solid ${meta.color}30`, background: meta.bg }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Tag style={{ fontSize: 10 }}>{GAP_TYPE_LABELS[opp.type] || opp.type}</Tag>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Tooltip title="Confidence">
                            <Badge
                              status={opp.confidence === 'high' ? 'success' : opp.confidence === 'medium' ? 'warning' : 'default'}
                              text={<Text style={{ fontSize: 10 }}>{opp.confidence}</Text>}
                            />
                          </Tooltip>
                        </div>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, lineHeight: 1.4 }}>
                        {opp.item?.keyword || opp.item?.pageUrl || opp.item?.referringDomain || 'Gap opportunity'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        {opp.rationale}
                      </div>
                      <Row gutter={8} style={{ marginBottom: 12 }}>
                        <Col span={8}>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Est. Traffic</div>
                          <div style={{ fontWeight: 700, color: '#1677ff' }}>{fmt(opp.estimatedTrafficImpact)}</div>
                        </Col>
                        <Col span={8}>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Est. Revenue</div>
                          <div style={{ fontWeight: 700, color: '#52c41a' }}>${fmt(opp.estimatedRevenue)}</div>
                        </Col>
                        <Col span={8}>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Time Est.</div>
                          <div style={{ fontWeight: 700, color: meta.color }}>{opp.estimatedTimeDays}d</div>
                        </Col>
                      </Row>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>Difficulty</div>
                        <Progress percent={opp.difficulty} size="small" showInfo={false}
                          strokeColor={opp.difficulty > 60 ? '#f5222d' : opp.difficulty > 30 ? '#faad14' : '#52c41a'} />
                      </div>
                      <Button size="small" type="primary" ghost block icon={<CheckCircle size={12} />}
                        onClick={() => convertToTasks([opp._id])}>
                        Convert to Task
                      </Button>
                    </Card>
                  ))}
                </div>
              )
            };
          })}
        />
      </motion.div>
    );
  };

  // ── 6. Recommendations ─────────────────────────────────────────────────────
  const renderRecommendations = () => (
    <motion.div {...motionFade}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button onClick={loadRecommendations} loading={recsLoading} icon={<RefreshCcw size={14} />}>Refresh</Button>
        {selectedRecKeys.length > 0 && (
          <>
            <Button type="primary" icon={<CheckCircle size={14} />} onClick={() => convertToTasks(selectedRecKeys)}>
              Convert to Tasks ({selectedRecKeys.length})
            </Button>
            <Popconfirm title="Dismiss selected recommendations?" onConfirm={dismissRecs}>
              <Button danger>Dismiss ({selectedRecKeys.length})</Button>
            </Popconfirm>
          </>
        )}
        <Button icon={<Download size={14} />} onClick={() => exportCSV(recommendations, 'recommendations.csv')}>Export</Button>
      </div>

      {recsLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : recommendations.length === 0 ? (
        <EmptyState icon={Brain} title="No recommendations yet"
          desc="Run a gap analysis and click 'Generate Recommendations' to get AI-powered insights."
          action={<Button onClick={() => setActiveTab('gaps')}>Go to Gap Analysis</Button>} />
      ) : (
        <Table
          rowKey="_id"
          size="small"
          dataSource={recommendations}
          rowSelection={{ selectedRowKeys: selectedRecKeys, onChange: setSelectedRecKeys }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
          columns={[
            { title: 'Type', dataIndex: 'type', key: 'type', render: (v) => <Tag>{GAP_TYPE_LABELS[v] || v}</Tag> },
            { title: 'Opportunity', key: 'item',
              render: (_, r) => (
                <div>
                  <Text strong style={{ fontSize: 13 }}>{r.item?.keyword || r.item?.pageUrl || r.item?.referringDomain || 'Gap'}</Text>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{r.rationale?.substring(0, 120)}...</div>
                </div>
              )},
            { title: 'Priority', dataIndex: 'priorityScore', key: 'ps', sorter: (a, b) => b.priorityScore - a.priorityScore,
              render: (v) => (
                <Progress percent={Math.min(100, Math.round(v / 10))} size="small" showInfo={false}
                  strokeColor={v > 500 ? '#f5222d' : v > 100 ? '#faad14' : '#52c41a'} style={{ width: 80 }} />
              )},
            { title: 'Est. Traffic', dataIndex: 'estimatedTrafficImpact', key: 'eti', sorter: (a, b) => b.estimatedTrafficImpact - a.estimatedTrafficImpact, render: (v) => fmt(v) },
            { title: 'Effort', dataIndex: 'effortHint', key: 'ef',
              render: (v) => <Tag color={v === 'low' ? 'green' : v === 'high' ? 'red' : 'gold'}>{v}</Tag> },
            { title: 'Status', dataIndex: 'status', key: 'st',
              render: (v) => <Tag color={v === 'proposed' ? 'blue' : v === 'converted_to_task' ? 'green' : 'default'}>{v}</Tag> },
            { title: 'AI', key: 'ai',
              render: (_, r) => r.agent?.rationaleSource === 'ai'
                ? <Tooltip title="AI-annotated"><Brain size={14} style={{ color: '#722ed1' }} /></Tooltip>
                : <Tooltip title="Deterministic"><Shield size={14} style={{ color: '#52c41a' }} /></Tooltip>
            }
          ]}
        />
      )}
    </motion.div>
  );

  // ── 7. Comparison Matrix ───────────────────────────────────────────────────
  const renderMatrix = () => (
    <motion.div {...motionFade}>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Competitor Radar (normalised 0–100)" bordered={false}
            style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
            {approvedCompetitors.length === 0 ? (
              <Empty description="Approve competitors to see radar chart" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border-color)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                  {approvedCompetitors.slice(0, 5).map((c, i) => (
                    <Radar key={c.domain} name={c.domain} dataKey={c.domain}
                      stroke={CHART_COLORS[i]} fill={CHART_COLORS[i]} fillOpacity={0.15} strokeWidth={2} />
                  ))}
                  <Legend />
                  <RechartsTooltip />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Metrics Comparison Table" bordered={false}
            style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
            <Table
              rowKey="domain"
              size="small"
              dataSource={competitors}
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: 'Domain', dataIndex: 'domain', key: 'domain', fixed: 'left', render: (v) => <Text strong style={{ fontSize: 12 }}>{v}</Text> },
                { title: 'Traffic', key: 'traffic', render: (_, r) => fmt(r.metrics?.organicTraffic) },
                { title: 'Keywords', key: 'kw', render: (_, r) => fmt(r.metrics?.organicKeywords) },
                { title: 'Backlinks', key: 'bl', render: (_, r) => fmt(r.metrics?.backlinks) },
                { title: 'Authority', key: 'da', render: (_, r) => r.metrics?.authority || '—' },
                { title: 'Threat', key: 'ts', render: (_, r) => (
                  <Tag color={r.agent?.threatLevel === 'high' ? 'red' : r.agent?.threatLevel === 'medium' ? 'gold' : 'green'}>
                    {r.agent?.threatLevel?.toUpperCase() || '—'}
                  </Tag>
                )},
                { title: 'Status', key: 'st', render: (_, r) => <Tag color={STATUS_COLORS[r.status]}>{r.status}</Tag> }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </motion.div>
  );

  // ── 8. Execution History ───────────────────────────────────────────────────
  const renderHistory = () => (
    <motion.div {...motionFade}>
      <div style={{ marginBottom: 16 }}>
        <Button loading={historyLoading} onClick={loadHistory} icon={<RefreshCcw size={14} />}>
          {history ? 'Refresh' : 'Load History'}
        </Button>
      </div>
      {historyLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !history ? (
        <EmptyState icon={HistoryIcon} title="No history loaded" desc="Click Load History to see past executions."
          action={<Button type="primary" onClick={loadHistory}>Load History</Button>} />
      ) : history.length === 0 ? (
        <Empty description="No previous runs" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Table
          rowKey={(r, i) => r._id || i}
          size="small"
          pagination={{ defaultPageSize: 15, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
          dataSource={history}
          columns={[
            { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => (
              <Tag color={s === 'completed' ? 'green' : s === 'failed' ? 'red' : s === 'running' ? 'blue' : 'gold'}>{s}</Tag>
            )},
            { title: 'Agent', dataIndex: 'agentKey', key: 'ak', render: (v) => v || '—' },
            { title: 'Started', dataIndex: 'createdAt', key: 'createdAt', render: (d) => d ? new Date(d).toLocaleString() : '—' },
            { title: 'Duration', dataIndex: 'durationMs', key: 'durationMs', render: (v) => v ? `${(v / 1000).toFixed(1)}s` : '—' },
            { title: 'Error', dataIndex: 'error', key: 'error', render: (v) => v ? <Text type="danger" style={{ fontSize: 11 }}>{v.substring(0, 80)}</Text> : '—' }
          ]}
        />
      )}
    </motion.div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── Render ────────────────────────────────────────────────────────────────
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const tabItems = [
    { key: 'overview',         label: <Space><Globe size={14} />Overview</Space>,         children: renderOverview() },
    { key: 'gaps',             label: <Space><Swords size={14} />Gap Analysis</Space>,     children: renderGapAnalysis() },
    { key: 'top-pages',        label: <Space><FileText size={14} />Top Pages</Space>,      children: renderTopPages() },
    { key: 'trend',            label: <Space><TrendingUp size={14} />Trends</Space>,       children: renderTrend() },
    { key: 'opportunities',    label: <Space><Target size={14} />Opportunities</Space>,    children: renderOpportunities() },
    { key: 'recommendations',  label: <Space><Brain size={14} />Recommendations</Space>,   children: renderRecommendations() },
    { key: 'matrix',           label: <Space><BarChart2 size={14} />Matrix</Space>,        children: renderMatrix() },
    { key: 'history',          label: <Space><HistoryIcon size={14} />History</Space>,     children: renderHistory() }
  ];

  return (
    <motion.div {...motionFade}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Swords size={24} color="#fff" />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 900 }}>
              {activeProject ? `${activeProject.name} — Competitor Intelligence` : 'Competitor Intelligence'}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Enterprise-grade competitor analysis — discovery, gaps, trends, and AI insights.
            </Text>
          </div>
        </div>
        <ProjectSelector style={{ marginBottom: 0 }} />
      </div>

      {!projectId ? (
        <EmptyState icon={Swords} title="Select a project to begin"
          desc="Choose or create a Workspace Project to access the full Competitor Intelligence suite." />
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          tabBarStyle={{ marginBottom: 20, fontWeight: 600 }}
          size="middle"
        />
      )}
    </motion.div>
  );
};

export default CompetitorsTab;