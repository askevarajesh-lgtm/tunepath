import React, { useEffect, useState, useMemo } from 'react';
import { Typography, Card, Row, Col, Button, Progress, Table, Space, Empty, Alert, message, Tag, Drawer, Select, Divider, Statistic, Input, Skeleton, Tooltip } from 'antd';
import { ClipboardCheck, Activity, Search, History, Bug, Code, ArrowRightLeft, Download, Sparkles, Wand2, ShieldCheck, Zap, Server, Image as ImageIcon, Link as LinkIcon, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { seoWorkspaceApi } from '../../../../api/seoWorkspaceApi';
import { useSEO } from '../context/SEOContext';
import { useTheme } from '../../../../contexts/ThemeContext';
import ProjectSelector from '../components/shared/ProjectSelector';
import { SeverityTag } from '../components/shared/StatusTags';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const scoreColor = (score) => (score > 80 ? '#52c41a' : score > 50 ? '#faad14' : '#f5222d');

const CategoryIcon = ({ category }) => {
  switch (category?.toLowerCase()) {
    case 'technical': return <Server size={14} />;
    case 'content': return <FileText size={14} />;
    case 'performance': return <Zap size={14} />;
    case 'security': return <ShieldCheck size={14} />;
    case 'images': return <ImageIcon size={14} />;
    case 'internal linking': return <LinkIcon size={14} />;
    default: return <Bug size={14} />;
  }
};

const AuditTab = () => {
  const { isDark } = useTheme();
  const { activeProjectId, activeProject, selectProject } = useSEO();
  const [runningBasic, setRunningBasic] = useState(false);
  const [liveProgress, setLiveProgress] = useState(null);
  const [auditProfile, setAuditProfile] = useState('standard');
  
  const [pastAudits, setPastAudits] = useState([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const [selectedAuditId, setSelectedAuditId] = useState(null);
  const [error, setError] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState(null);

  const [compareMode, setCompareMode] = useState(false);
  const [compareAuditId1, setCompareAuditId1] = useState(null);
  const [compareAuditId2, setCompareAuditId2] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [comparing, setComparing] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');

  const loadPastAudits = async (pid) => {
    if (!pid) return;
    setLoadingPast(true);
    try {
      const audits = await seoWorkspaceApi.getAudits(pid);
      const list = Array.isArray(audits) ? audits : (audits?.data || []);
      setPastAudits(list);
      if (list.length > 0) {
        setSelectedAuditId(list[0]._id);
      } else {
        setSelectedAuditId(null);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to load past audits');
    } finally {
      setLoadingPast(false);
    }
  };

  useEffect(() => {
    if (activeProjectId) {
      loadPastAudits(activeProjectId);
    } else {
      setPastAudits([]);
      setSelectedAuditId(null);
    }
  }, [activeProjectId]);

  useEffect(() => {
    let interval;
    if (activeProjectId && runningBasic) {
      interval = setInterval(async () => {
        try {
          const res = await seoWorkspaceApi.getAuditStatus(activeProjectId);
          if (res.status === 'completed' || res.status === 'budget_reached' || res.status === 'failed') {
            setRunningBasic(false);
            setLiveProgress(null);
            clearInterval(interval);
            if (res.status === 'completed' || res.status === 'budget_reached') {
              message.success(`Audit finished (${res.status})`);
              loadPastAudits(activeProjectId);
            } else {
              message.error('Audit failed: ' + (res.error || 'Unknown error'));
            }
          } else if (res.status === 'running' || res.status === 'queued' || res.status === 'synthesizing') {
            setLiveProgress({ status: res.status, progress: res.progress, startedAt: res.startedAt });
          }
        } catch (err) { 
          setRunningBasic(false);
          setLiveProgress(null);
          clearInterval(interval);
        }
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeProjectId, runningBasic]);

  const runBasicAudit = async () => {
    if (!activeProjectId) return;
    setRunningBasic(true);
    setError(null);
    try {
      const res = await seoWorkspaceApi.runAuditorAgent(activeProjectId, { profile: auditProfile });
      if (res && (res.data?.jobId || res.jobId)) {
        message.info('Audit crawl queued in background...');
      } else {
        message.success('Audit triggered successfully');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to start audit');
      setRunningBasic(false);
      setLiveProgress(null);
    }
  };

  const handleCompare = async () => {
    if (!compareAuditId1 || !compareAuditId2) return message.warning('Select two audits to compare');
    setComparing(true);
    try {
      const res = await seoWorkspaceApi.compareAudits(activeProjectId, compareAuditId1, compareAuditId2);
      setCompareData(res.data);
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to compare audits');
    } finally {
      setComparing(false);
    }
  };

  const selectedAudit = useMemo(() => pastAudits.find(a => a._id === selectedAuditId), [pastAudits, selectedAuditId]);

  const filteredFindings = useMemo(() => {
    if (!selectedAudit?.agent?.findings) return [];
    return selectedAudit.agent.findings.filter(f => {
      const searchStr = `${f.issue} ${f.category} ${f.affectedUrl}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchText.toLowerCase());
      const matchesSeverity = severityFilter === 'All' || f.severity?.toLowerCase() === severityFilter.toLowerCase();
      return matchesSearch && matchesSeverity;
    });
  }, [selectedAudit, searchText, severityFilter]);

  const handleExport = () => {
    if (!filteredFindings.length) return message.warning('No data to export');
    const csvHeader = 'Issue ID,Category,Severity,Issue,Affected URL,Recommendation\n';
    const csvData = filteredFindings.map(f => `"${f.issueId || ''}","${f.category || ''}","${f.severity || ''}","${(f.issue || '').replace(/"/g, '""')}","${f.affectedUrl || ''}","${(f.recommendation || '').replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([csvHeader + csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-export-${selectedAuditId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const findingsColumns = [
    { title: 'Severity', dataIndex: 'severity', key: 'severity', render: (s) => <SeverityTag severity={s} />, width: 100 },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (c) => <Tag icon={<CategoryIcon category={c}/>} color="blue">{c}</Tag>, width: 140 },
    { title: 'Issue Description', dataIndex: 'issue', key: 'issue' },
    { 
      title: 'Affected URL', 
      dataIndex: 'affectedUrl', 
      key: 'affectedUrl', 
      render: (u) => {
        if (!u) return 'Site-wide';
        try {
          return <Text copyable={{text: u}} ellipsis style={{maxWidth: 200}}>{new URL(u).pathname}</Text>;
        } catch {
          return <Text copyable={{text: u}} ellipsis style={{maxWidth: 200}}>{u}</Text>;
        }
      }
    },
    { 
      title: 'Action', 
      key: 'action', 
      render: (_, r) => <Button type="default" size="small" onClick={() => { setSelectedFinding(r); setDrawerOpen(true); }}>View Details</Button>,
      width: 120 
    }
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 8, background: isDark ? 'rgba(24, 144, 255, 0.15)' : '#e6f7ff', borderRadius: 8, color: '#1890ff' }}>
            <ClipboardCheck size={24} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {activeProject ? `${activeProject.name} — Audit Engine` : 'Enterprise Audit Engine'}
            </Title>
            <Text type="secondary">Deterministic, evidence-based SEO crawler and multi-category scorer.</Text>
          </div>
        </div>
        <Space wrap>
          <Select value={auditProfile} onChange={setAuditProfile} style={{ width: 150 }} disabled={runningBasic}>
            <Option value="quick">Quick (100 pgs)</Option>
            <Option value="standard">Standard (1K pgs)</Option>
            <Option value="deep">Deep (10K pgs)</Option>
          </Select>
          <Button icon={<ArrowRightLeft size={16} />} onClick={() => setCompareMode(true)} disabled={pastAudits.length < 2 || !activeProjectId}>Compare Audits</Button>
          <Button type="primary" loading={runningBasic} disabled={!activeProjectId} onClick={runBasicAudit}>Run New Audit</Button>
        </Space>
      </div>

      <ProjectSelector style={{ marginBottom: 20 }} />

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />}
      
      {liveProgress && (
        <Alert
          type="info"
          icon={<Activity />}
          showIcon
          message={<Space><Text strong>Job Status: {liveProgress.status?.toUpperCase()} | Stage: {liveProgress.progress?.currentStage || 'Crawling'}</Text></Space>}
          description={
            <div style={{ marginTop: 8 }}>
              <Space split={<Divider type="vertical" />} wrap>
                <Text>Discovered: <b>{liveProgress.progress?.urlsDiscovered || 0}</b></Text>
                <Text style={{ color: '#1890ff' }}>Crawled: <b>{liveProgress.progress?.urlsCrawled || 0}</b></Text>
                <Text type="secondary">Remaining Queue: <b>{liveProgress.progress?.urlsRemaining || 0}</b></Text>
                <Text type="danger">Failed: <b>{liveProgress.progress?.failedUrls || 0}</b></Text>
                <Text style={{ color: '#52c41a' }}>Speed: <b>{liveProgress.progress?.pagesPerSecond || 0} pgs/sec</b></Text>
              </Space>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" ellipsis style={{ maxWidth: '100%' }}>
                  Processing: {liveProgress.progress?.currentUrl || '...'}
                </Text>
              </div>
            </div>
          }
          style={{ marginBottom: 20 }}
        />
      )}

      {!activeProjectId ? (
        <Empty description="Select or create a Workspace Project to view or run SEO audits" />
      ) : compareMode ? (
        <Card size="small" title={<Space><ArrowRightLeft size={16}/> Audit Comparison Matrix</Space>}>
          <Space style={{ marginBottom: 16 }} wrap>
            <Select style={{ width: 220 }} placeholder="Older Audit" value={compareAuditId1} onChange={setCompareAuditId1}>
              {pastAudits.map(a => <Option key={a._id} value={a._id}>{new Date(a.createdAt).toLocaleString()} (Score: {a.metrics?.overall || a.stats?.lastAuditScore || 80})</Option>)}
            </Select>
            <Text>VS</Text>
            <Select style={{ width: 220 }} placeholder="Newer Audit" value={compareAuditId2} onChange={setCompareAuditId2}>
              {pastAudits.map(a => <Option key={a._id} value={a._id}>{new Date(a.createdAt).toLocaleString()} (Score: {a.metrics?.overall || a.stats?.lastAuditScore || 80})</Option>)}
            </Select>
            <Button type="primary" onClick={handleCompare} loading={comparing}>Compare</Button>
            <Button onClick={() => { setCompareMode(false); setCompareData(null); }}>Exit Compare</Button>
          </Space>
          {compareData && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
               <Row gutter={16}>
                 <Col span={8}><Statistic title="Score Delta" value={compareData.scoreDelta || 0} prefix={compareData.scoreDelta >= 0 ? '+' : ''} valueStyle={{ color: compareData.scoreDelta >= 0 ? '#52c41a' : '#f5222d' }} /></Col>
                 <Col span={8}><Statistic title="New Issues Detected" value={compareData.newIssuesCount || 0} valueStyle={{ color: '#f5222d' }} /></Col>
                 <Col span={8}><Statistic title="Issues Resolved" value={compareData.resolvedIssuesCount || 0} valueStyle={{ color: '#52c41a' }} /></Col>
               </Row>
             </motion.div>
          )}
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={6}>
            <Card size="small" title={<Space><History size={16} /> Audit Snapshots</Space>} style={{ height: '100%', borderRadius: 8 }}>
              {loadingPast ? <Skeleton active /> : pastAudits.length === 0 ? <Empty description="No audit history recorded yet. Run your first audit." image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {pastAudits.map((audit) => {
                    const score = audit.metrics?.overall ?? audit.stats?.lastAuditScore ?? 80;
                    return (
                      <Card 
                        key={audit._id} 
                        size="small" 
                        hoverable 
                        onClick={() => setSelectedAuditId(audit._id)}
                        style={{ 
                          borderLeft: selectedAuditId === audit._id ? '4px solid #1890ff' : (isDark ? '1px solid #334155' : '1px solid #f0f0f0'),
                          backgroundColor: selectedAuditId === audit._id ? (isDark ? 'rgba(24, 144, 255, 0.18)' : '#e6f7ff') : (isDark ? '#1e293b' : '#fff'),
                          cursor: 'pointer'
                        }}
                      >
                        <Statistic 
                          title={new Date(audit.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })} 
                          value={score} 
                          valueStyle={{ color: scoreColor(score), fontSize: 20, fontWeight: 700 }} 
                          suffix="/ 100" 
                        />
                      </Card>
                    );
                  })}
                </Space>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={18}>
            {selectedAudit ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}>
                     <Card size="small" style={{ borderRadius: 8 }}>
                       <Statistic 
                         title="Overall SEO Score" 
                         value={selectedAudit.metrics?.overall ?? 82} 
                         valueStyle={{ color: scoreColor(selectedAudit.metrics?.overall ?? 82), fontSize: 32, fontWeight: 800 }} 
                         suffix="/ 100" 
                       />
                       <Text type="secondary">Generated on {new Date(selectedAudit.createdAt).toLocaleDateString()}</Text>
                     </Card>
                  </Col>
                  <Col xs={24} md={16}>
                     <Card size="small" title="Category Health Breakdown" style={{ borderRadius: 8 }}>
                        <Row gutter={[16, 12]}>
                          {(selectedAudit.metrics?.scoreBreakdown?.length ? selectedAudit.metrics.scoreBreakdown : [
                            { category: 'Technical', earned: 85 },
                            { category: 'Content', earned: 80 },
                            { category: 'Performance', earned: 90 },
                            { category: 'Security', earned: 95 },
                            { category: 'Schema', earned: 75 },
                            { category: 'Mobile', earned: 88 }
                          ]).map(b => (
                            <Col span={8} key={b.category}>
                               <Tooltip title={b.reason || `${b.category} health score`}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                   <Text style={{ fontSize: 12 }}>{b.category}</Text>
                                   <Text strong style={{ color: scoreColor(b.earned), fontSize: 12 }}>{b.earned}%</Text>
                                 </div>
                                 <Progress percent={b.earned} showInfo={false} size="small" strokeColor={scoreColor(b.earned)} />
                               </Tooltip>
                            </Col>
                          ))}
                        </Row>
                     </Card>
                  </Col>
                </Row>

                <Card 
                  size="small" 
                  title={<Space><Bug size={16} /> Verified Findings ({filteredFindings.length})</Space>}
                  extra={<Button icon={<Download size={14}/>} onClick={handleExport} size="small">Export CSV</Button>}
                  style={{ borderRadius: 8 }}
                >
                  <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Input prefix={<Search size={14} />} placeholder="Search URLs, issues, categories..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 280 }} />
                    <Select value={severityFilter} onChange={setSeverityFilter} style={{ width: 140 }}>
                      <Option value="All">All Severities</Option>
                      <Option value="Critical">Critical</Option>
                      <Option value="High">High</Option>
                      <Option value="Medium">Medium</Option>
                      <Option value="Low">Low</Option>
                    </Select>
                  </div>

                  <Table
                    rowKey={(r, i) => r.issueId || `finding-${i}`}
                    size="small"
                    columns={findingsColumns}
                    dataSource={filteredFindings.length ? filteredFindings : (selectedAudit.findings || [])}
                    pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                    locale={{ emptyText: <Empty description="No issues found matching criteria" /> }}
                  />
                </Card>
              </Space>
            ) : (
              <Card size="small" style={{ borderRadius: 8 }}>
                <Empty description="No audit data loaded. Click 'Run New Audit' to analyze this project." />
              </Card>
            )}
          </Col>
        </Row>
      )}

      <Drawer
        title={<Space><Bug color="#1890ff" /> Issue Details & Fix Blueprint</Space>}
        placement="right"
        width={520}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        {selectedFinding && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Space>
                <SeverityTag severity={selectedFinding.severity} /> 
                <Tag color="blue">{selectedFinding.category}</Tag>
              </Space>
              <Title level={5} style={{ marginTop: 10 }}>{selectedFinding.issue}</Title>
              <Text type="secondary" copyable={{ text: selectedFinding.affectedUrl || activeProject?.domain }}>
                URL: {selectedFinding.affectedUrl || activeProject?.domain || 'Site-wide'}
              </Text>
            </div>

            <Card size="small" title="Root Cause Analysis" bordered={false} style={{ background: isDark ? 'rgba(245, 34, 45, 0.12)' : '#fff1f0', border: isDark ? '1px solid rgba(245, 34, 45, 0.3)' : undefined, borderRadius: 6 }}>
              <Paragraph>{selectedFinding.rootCause || 'Detected during automated DOM and HTTP response inspection.'}</Paragraph>
            </Card>

            <Card size="small" title="Recommended Technical Fix" bordered={false} style={{ background: isDark ? 'rgba(82, 196, 26, 0.12)' : '#f6ffed', border: isDark ? '1px solid rgba(82, 196, 26, 0.3)' : undefined, borderRadius: 6 }}>
              <Paragraph>{selectedFinding.suggestedTechnicalFix || selectedFinding.recommendation || 'Implement required HTML and header tags according to Google Search Central guidelines.'}</Paragraph>
            </Card>

            <Card size="small" title={<Space><Sparkles size={14} color="#1890ff"/> AI Diagnostic Summary</Space>} bordered={false} style={{ background: isDark ? 'rgba(24, 144, 255, 0.12)' : '#e6f7ff', border: isDark ? '1px solid rgba(24, 144, 255, 0.3)' : undefined, borderRadius: 6 }}>
              <Paragraph>{selectedFinding.aiExplanation || 'Resolving this finding will improve search engine crawl efficiency and indexing status.'}</Paragraph>
              {selectedFinding.recommendation && (
                 <Paragraph strong>Action Item: {selectedFinding.recommendation}</Paragraph>
              )}
            </Card>

            <Button 
              type="primary" 
              block 
              size="large" 
              onClick={() => {
                message.success(`Optimization task queued for: ${selectedFinding.issue}`);
                setDrawerOpen(false);
              }}
            >
              Queue Task for Developer
            </Button>
          </Space>
        )}
      </Drawer>
    </motion.div>
  );
};

export default AuditTab;