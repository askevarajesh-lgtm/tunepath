import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Progress, Tag, Space, Empty, Tooltip, Collapse, List, Tabs, Table, Button, Drawer, Alert, Badge } from 'antd';
import { MessageCircle, PlayCircle, History, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSEO } from '../context/SEOContext';
import { useTheme } from '../../../../contexts/ThemeContext';
import { seoWorkspaceApi } from '../../../../api/seoWorkspaceApi';
import ProjectSelector from '../components/shared/ProjectSelector';

const { Title, Text, Paragraph } = Typography;

const scoreColor = (score) => (score >= 80 ? '#52c41a' : score >= 50 ? '#faad14' : '#f5222d');

const AEODashboard = ({ projectId }) => {
  const { isDark } = useTheme();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // Lazy Loaded Data
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesPagination, setPagesPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const [recommendations, setRecommendations] = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);

  // Detail Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [entityGraph, setEntityGraph] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [previousAudit, setPreviousAudit] = useState(null);

  const fetchHistory = async () => {
    try {
      const res = await seoWorkspaceApi.getAeoAgentHistory(projectId); // removed limit=2
      if (res.data && res.data.length > 0) {
        setAudit(res.data[0]);
        if (res.data.length > 1) {
          // Find the most recent completed audit that is NOT the current one
          const prev = res.data.slice(1).find(a => a.status === 'completed' || a.status === 'completed_with_warnings');
          setPreviousAudit(prev || res.data[1]);
        }
      } else {
        setAudit(null);
        setPreviousAudit(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchHistory();
    }
  }, [projectId]);

  // Polling for running status
  useEffect(() => {
    let intervalId;
    if (audit && (audit.status === 'queued' || audit.status === 'running')) {
      intervalId = setInterval(() => {
        fetchHistory();
      }, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [audit?.status, projectId]);

  const loadPages = async (page = 1, pageSize = 10) => {
    if (!audit?._id) return;
    setPagesLoading(true);
    try {
      const res = await seoWorkspaceApi.getAeoAuditPages(projectId, audit._id, { page, limit: pageSize });
      setPages(res.data);
      setPagesPagination({ current: res.pagination.page, pageSize: res.pagination.limit, total: res.pagination.total });
    } catch (e) {
      console.error(e);
    } finally {
      setPagesLoading(false);
    }
  };

  const loadRecommendations = async () => {
    if (!audit?._id) return;
    setRecsLoading(true);
    try {
      const res = await seoWorkspaceApi.getAeoAuditRecommendations(projectId, audit._id);
      setRecommendations(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setRecsLoading(false);
    }
  };

  useEffect(() => {
    if (audit && (audit.status === 'completed' || audit.status === 'completed_with_warnings')) {
      loadPages();
      loadRecommendations();
    }
  }, [audit?.status, audit?._id]);

  const openPageDetail = async (pageRecord) => {
    setSelectedPage(pageRecord);
    setDrawerOpen(true);
    setDetailLoading(true);
    try {
      const [simsRes, graphRes] = await Promise.all([
        seoWorkspaceApi.getAeoAuditSimulations(projectId, audit._id, { pageUrl: pageRecord.pageUrl }),
        seoWorkspaceApi.getAeoAuditEntityGraph(projectId, audit._id, { pageUrl: pageRecord.pageUrl })
      ]);
      setSimulations(simsRes.data || []);
      setEntityGraph(graphRes.data?.[0] || null);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRun = async () => {
    setLoading(true);
    try {
      const res = await seoWorkspaceApi.runAeoAgent(projectId);
      setAudit(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAll = async () => {
    setLoading(true);
    try {
      await seoWorkspaceApi.approveAeoRecommendations(projectId, audit._id);
      await loadRecommendations();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const pageColumns = [
    {
      title: 'URL', dataIndex: 'pageUrl', key: 'pageUrl',
      render: (url, record) => <a onClick={() => openPageDetail(record)}>{url}</a>
    },
    {
      title: 'AEO Score', dataIndex: ['pageScores', 'readinessScore'], key: 'readinessScore',
      render: (score) => score ? <Tag color={scoreColor(score)}>{score}</Tag> : '-'
    },
    {
      title: 'Readability', dataIndex: ['pageScores', 'readability'], key: 'readability',
      render: (score) => score ? <Tag color={scoreColor(score)}>{score}</Tag> : '-'
    },
    {
      title: 'Schema Status', dataIndex: ['schemaValidation', 'valid'], key: 'schema',
      render: (valid, record) => {
        if (valid === null) return '-';
        if (valid) return <Tag color="success">Valid</Tag>;
        const errs = record.schemaValidation?.issues?.length || 0;
        return <Tag color="error">{errs} Issues</Tag>;
      }
    }
  ];

  const recColumns = [
    { title: 'Category', dataIndex: 'category', key: 'category', render: c => <Tag>{c}</Tag> },
    { title: 'Priority', dataIndex: 'priority', key: 'priority', render: p => <Tag color={p === 'Critical' ? 'red' : p === 'High' ? 'orange' : 'blue'}>{p}</Tag> },
    { title: 'Title', dataIndex: 'title', key: 'title', render: (t, r) => <div><Text strong>{t}</Text><div style={{fontSize: 12, color: 'var(--text-secondary)'}}>{r.pageUrl || 'Site-wide'}</div></div> },
    { title: 'Fix', dataIndex: 'suggestedFix', key: 'suggestedFix', render: f => <div style={{maxWidth: 300, whiteSpace: 'pre-wrap', fontSize: 12}}>{f}</div> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: s => <Tag color={s === 'Pending' ? 'processing' : s === 'Task Created' ? 'success' : 'default'}>{s}</Tag> }
  ];

  if (!audit) {
    return (
      <Empty description="No AEO Audit found for this project">
        <Button type="primary" icon={<PlayCircle size={16}/>} loading={loading} onClick={handleRun}>Run AEO Audit</Button>
      </Empty>
    );
  }

  if (audit.status === 'queued' || audit.status === 'running') {
    return (
      <Card style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
        <Space direction="vertical" style={{ width: '100%', alignItems: 'center', padding: '40px 0' }}>
          <Progress type="circle" percent={audit.progress || (audit.status === 'running' ? 10 : 0)} status="active" />
          <Title level={4}>Audit is {audit.status}...</Title>
          <Text type="secondary">This may take a few minutes as we crawl and analyze the pages.</Text>
        </Space>
      </Card>
    );
  }

  const { overallScores = {} } = audit;
  const prevScores = previousAudit?.overallScores || {};

  const renderTrend = (current, previous) => {
    if (previous === undefined || previous === null) return null;
    const diff = current - previous;
    if (diff === 0) return <Text type="secondary" style={{marginLeft: 8}}>(-)</Text>;
    return diff > 0 ? <Text type="success" style={{marginLeft: 8}}>(+{diff})</Text> : <Text type="danger" style={{marginLeft: 8}}>({diff})</Text>;
  };

  return (
    <Card
      style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}
      extra={<Button type="primary" icon={<PlayCircle size={16}/>} loading={loading} onClick={handleRun}>Re-run Audit</Button>}
    >
      <Tabs defaultActiveKey="1" items={[
        {
          key: '1',
          label: 'Overview',
          children: (
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Card size="small" title="AEO Readiness" style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <div style={{textAlign: 'center'}}>
                    <Progress type="dashboard" percent={overallScores.aeo || 0} strokeColor={scoreColor(overallScores.aeo || 0)} />
                    <div>{renderTrend(overallScores.aeo || 0, prevScores.aeo)}</div>
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small" title="EEAT Signal" style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <div style={{textAlign: 'center'}}>
                    <Progress type="dashboard" percent={overallScores.eeat || 0} strokeColor={scoreColor(overallScores.eeat || 0)} />
                    <div>{renderTrend(overallScores.eeat || 0, prevScores.eeat)}</div>
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small" title="Citation Likelihood" style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <div style={{textAlign: 'center'}}>
                    <Progress type="dashboard" percent={overallScores.citation || 0} strokeColor={scoreColor(overallScores.citation || 0)} />
                    <div>{renderTrend(overallScores.citation || 0, prevScores.citation)}</div>
                  </div>
                </Card>
              </Col>
              <Col span={24}>
                <Card size="small" title="Executive Summary" style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <Paragraph>{audit.summary || 'No summary available.'}</Paragraph>
                </Card>
              </Col>
            </Row>
          )
        },
        {
          key: '2',
          label: 'Pages',
          children: (
            <Table
              size="small"
              loading={pagesLoading}
              dataSource={pages}
              columns={pageColumns}
              rowKey="_id"
              pagination={{
                ...pagesPagination,
                onChange: (page, size) => loadPages(page, size)
              }}
            />
          )
        },
        {
          key: '3',
          label: <Badge count={recommendations.filter(r=>r.status==='Pending').length} offset={[10, 0]}>Recommendations</Badge>,
          children: (
            <div>
              <div style={{marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8}}>
                <Button onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:5500/api'}/seo-workspace/projects/${projectId}/aeo-agent/${audit._id}/export?token=${localStorage.getItem('token')}`)} type="default">Export CSV</Button>
                <Button type="primary" onClick={handleApproveAll} loading={loading}>Approve All Pending</Button>
              </div>
              <Table size="small" loading={recsLoading} dataSource={recommendations} columns={recColumns} rowKey="_id" pagination={{ defaultPageSize: 15, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }} />
            </div>
          )
        }
      ]} />

      <Drawer
        title={selectedPage ? `AEO Details: ${selectedPage.pageUrl}` : 'Details'}
        placement="right"
        width={700}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        {detailLoading ? <div style={{textAlign: 'center', padding: 50}}><Progress type="circle" percent={50} status="active" /></div> : (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card size="small" title="Entities Extracted" style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
              {entityGraph?.nodes?.length ? (
                <Space wrap>
                  {entityGraph.nodes.map(n => (
                    <Tag key={n.id} color="purple">{n.label} ({n.type})</Tag>
                  ))}
                </Space>
              ) : <Text type="secondary">No entities extracted.</Text>}
            </Card>

            <Card size="small" title="Simulations (AI Platforms)" style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
              {simulations.length ? (
                <Collapse ghost items={simulations.map(sim => ({
                  key: sim.platform,
                  label: <Text strong>{sim.platform} <Tag color={scoreColor(sim.citationLikelihood)}>{sim.citationLikelihood}% Match</Tag></Text>,
                  children: (
                    <Space direction="vertical">
                      <Alert message="Best Candidate Paragraph" description={sim.simulation?.bestCandidateParagraph} type="info" />
                      <div><Text strong>Missing Info:</Text> <ul>{sim.simulation?.missingInformation?.map((m, i) => <li key={i}>{m}</li>)}</ul></div>
                    </Space>
                  )
                }))} />
              ) : <Text type="secondary">No simulations available.</Text>}
            </Card>
          </Space>
        )}
      </Drawer>
    </Card>
  );
};

const AEOTab = () => {
  const { activeProjectId: projectId, activeProject } = useSEO();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #13c2c2 0%, #52c41a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <MessageCircle size={24} color="#fff" />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 900 }}>
              {activeProject ? `${activeProject.name} — AEO Dashboard` : 'AEO Dashboard'}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Answer Engine Optimization — Measure Readiness for AI Overviews, ChatGPT, Gemini
            </Text>
          </div>
        </div>
        <ProjectSelector style={{ marginBottom: 0 }} />
      </div>

      {!projectId ? (
        <Empty description="Select or create a Workspace Project to view the AEO Dashboard" />
      ) : (
        <AEODashboard projectId={projectId} />
      )}
    </motion.div>
  );
};

export default AEOTab;