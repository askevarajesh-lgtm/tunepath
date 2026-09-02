import React, { useEffect, useState, useMemo } from 'react';
import {
  Typography, Card, Table, Select, Space, Button, Empty, Alert, Tag, message,
  Input, Row, Col, Popconfirm, Tabs, Statistic, Divider, Tooltip, Badge, Drawer, Descriptions
} from 'antd';
import { Hash, Sparkles, Network, TrendingUp, Search, Download, Target, Filter, RefreshCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { useSEO } from '../context/SEOContext';
import { useTheme } from '../../../../contexts/ThemeContext';
import { seoWorkspaceApi } from '../../../../api/seoWorkspaceApi';
import ProjectSelector from '../components/shared/ProjectSelector';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const INTENT_COLORS = { informational: 'blue', navigational: 'orange', commercial: 'purple', transactional: 'green', local: 'cyan', unknown: 'default' };
const STATUS_COLORS = { Suggested: 'orange', Pending: 'orange', Approved: 'green', Rejected: 'red', Declined: 'red', Archived: 'default' };
const KD_COLOR = (kd) => kd < 30 ? '#52c41a' : kd < 70 ? '#faad14' : '#f5222d';

const TrendSparkline = ({ data = [] }) => {
  if (!data || data.length === 0) return <Text type="secondary" style={{ fontSize: 12 }}>N/A</Text>;
  const chartData = data.map((v, i) => ({ val: v, idx: i }));
  return (
    <div style={{ width: 80, height: 30 }}>
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Line type="monotone" dataKey="val" stroke="#1890ff" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const KeywordsTab = () => {
  const { isDark } = useTheme();
  const { activeProjectId: projectId, activeProject } = useSEO();
  const [activeTab, setActiveTab] = useState('tracked');
  const [error, setError] = useState(null);

  // Tracked Keywords State
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [intentFilter, setIntentFilter] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // Discovery State
  const [seedKeyword, setSeedKeyword] = useState('');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [relatedInput, setRelatedInput] = useState('');
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [related, setRelated] = useState(null);

  // Clusters State
  const [clusters, setClusters] = useState([]);
  const [loadingClusters, setLoadingClusters] = useState(false);

  // Gap State
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [gapData, setGapData] = useState(null);
  const [loadingGap, setLoadingGap] = useState(false);
  
  // Evidence Drawer State
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
  const [selectedKeywordEvidence, setSelectedKeywordEvidence] = useState(null);

  const openEvidenceDrawer = (record) => {
    setSelectedKeywordEvidence(record);
    setEvidenceDrawerOpen(true);
  };

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await seoWorkspaceApi.getKeywords({ projectId, status: statusFilter !== 'All' ? statusFilter : undefined });
      setKeywords(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load keywords');
    } finally {
      setLoading(false);
    }
  };

  const loadClusters = async () => {
    if (!projectId) return;
    setLoadingClusters(true);
    try {
      const res = await seoWorkspaceApi.getKeywordClusters(projectId);
      setClusters(res.data || []);
    } catch (err) {
      message.error('Failed to load clusters');
    } finally {
      setLoadingClusters(false);
    }
  };

  useEffect(() => { 
    if (projectId) {
      if (activeTab === 'tracked') load();
      if (activeTab === 'clusters') loadClusters();
    }
  }, [projectId, statusFilter, activeTab]);

  const runResearch = async () => {
    setRunning(true);
    try {
      const res = await seoWorkspaceApi.runKeywordResearchAgent(projectId, seedKeyword || undefined);
      setRunResult(res.data);
      message.success('Keyword research completed');
      load();
    } catch (err) {
      message.error(err?.response?.data?.error || 'Keyword research failed');
    } finally {
      setRunning(false);
    }
  };

  const act = async (fn, successMsg) => {
    try {
      const res = await fn();
      message.success(`${successMsg}${res.modifiedCount != null ? ` (${res.modifiedCount})` : ''}`);
      setSelectedRowKeys([]);
      load();
    } catch (err) {
      message.error(err?.response?.data?.error || err?.response?.data?.message || 'Action failed');
    }
  };

  const [distribution, setDistribution] = useState(null);
  const loadDistribution = async () => {
    if (!projectId) return;
    try {
      const res = await seoWorkspaceApi.getRankDistribution(projectId);
      setDistribution(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRefreshKeywords = () => {
    act(() => seoWorkspaceApi.refreshKeywords(projectId, selectedRowKeys), 'Rank tracking refresh queued');
  };

  useEffect(() => {
    if (projectId) {
      loadDistribution();
    }
  }, [projectId, keywords]);

  const fetchRelated = async () => {
    if (!relatedInput.trim()) return;
    setRelatedLoading(true);
    try {
      const res = await seoWorkspaceApi.getRelatedKeywords(projectId, relatedInput.trim());
      setRelated(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to fetch related keywords');
    } finally {
      setRelatedLoading(false);
    }
  };

  const fetchGap = async () => {
    if (!competitorUrl.trim()) return message.warning('Enter a competitor URL');
    setLoadingGap(true);
    try {
      const res = await seoWorkspaceApi.getKeywordGap(projectId, competitorUrl.trim());
      setGapData(res.data);
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to analyze gap');
    } finally {
      setLoadingGap(false);
    }
  };

  const filteredKeywords = useMemo(() => {
    return keywords.filter(k => {
      const matchesSearch = k.keyword.toLowerCase().includes(searchText.toLowerCase());
      const matchesIntent = intentFilter === 'All' || k.metrics?.intent === intentFilter;
      return matchesSearch && matchesIntent;
    });
  }, [keywords, searchText, intentFilter]);

  const handleExport = () => {
    if (!filteredKeywords.length) return message.warning('No data to export');
    const csvHeader = 'Keyword,Status,Volume,CPC,KD,Intent,Current Rank,Best Rank,Cluster\n';
    const csvData = filteredKeywords.map(k => 
      `"${k.keyword}","${k.status}","${k.metrics?.searchVolume || 0}","${k.metrics?.cpc || 0}","${k.metrics?.keywordDifficulty || 0}","${k.metrics?.intent || 'unknown'}","${k.ranking?.currentRank || ''}","${k.ranking?.bestRank || ''}","${k.cluster || k.parentKeyword || ''}"`
    ).join('\n');
    const blob = new Blob([csvHeader + csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keywords-${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { 
      title: <span style={{whiteSpace:'nowrap'}}>Keyword</span>, 
      dataIndex: 'keyword', 
      key: 'keyword', 
      width: 320, 
      align: 'left',
      ellipsis: true,
      render: (k, r) => (
        <Space direction="vertical" size={0}>
          <a onClick={(e) => { e.preventDefault(); openEvidenceDrawer(r); }} style={{ fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{k}</a>
          {r.cluster && <Text type="secondary" style={{fontSize: 11}}>Cluster: {r.cluster}</Text>}
        </Space>
      )
    },
    { 
      title: <span style={{whiteSpace:'nowrap'}}>Intent</span>, 
      dataIndex: ['metrics', 'intent'], 
      key: 'intent', 
      width: 100, 
      align: 'center',
      render: (i) => <Tag color={INTENT_COLORS[i] || 'default'} style={{ margin: 0 }}>{i || 'unknown'}</Tag> 
    },
    { 
      title: <span style={{whiteSpace:'nowrap'}}>Volume</span>, 
      dataIndex: ['metrics', 'searchVolume'], 
      key: 'volume', 
      width: 100, 
      align: 'right',
      sorter: (a, b) => (a.metrics?.searchVolume || 0) - (b.metrics?.searchVolume || 0), 
      render: v => v ? <Text>{v.toLocaleString()}</Text> : <Text type="secondary">-</Text> 
    },
    { 
      title: <span style={{whiteSpace:'nowrap'}}>KD %</span>, 
      dataIndex: ['metrics', 'keywordDifficulty'], 
      key: 'kd', 
      width: 80, 
      align: 'right',
      render: v => v ? <Text style={{ color: KD_COLOR(v), fontWeight: 500 }}>{v}</Text> : <Text type="secondary">-</Text> 
    },
    { 
      title: <span style={{whiteSpace:'nowrap'}}>CPC</span>, 
      dataIndex: ['metrics', 'cpc'], 
      key: 'cpc', 
      width: 90, 
      align: 'right',
      render: v => v ? <Text>${v.toFixed(2)}</Text> : <Text type="secondary">-</Text> 
    },
    { 
      title: <span style={{whiteSpace:'nowrap'}}>Traffic</span>, 
      dataIndex: ['metrics', 'estimatedTraffic'], 
      key: 'traffic', 
      width: 120, 
      align: 'right',
      render: v => v ? <Text>{v.toLocaleString()}</Text> : <Text type="secondary">-</Text> 
    },
    { 
      title: <span style={{whiteSpace:'nowrap'}}>Opportunity</span>, 
      dataIndex: ['agent', 'opportunityScore'], 
      key: 'opportunity', 
      width: 120, 
      align: 'center',
      sorter: (a, b) => (a.agent?.opportunityScore || 0) - (b.agent?.opportunityScore || 0), 
      render: v => v ? <Badge count={v} style={{ backgroundColor: v > 70 ? '#52c41a' : v > 40 ? '#faad14' : '#d9d9d9', minWidth: 32 }} /> : <Text type="secondary">-</Text> 
    },
    {
      title: <span style={{whiteSpace:'nowrap'}}>Rank</span>,
      dataIndex: ['ranking', 'currentRank'],
      key: 'rank',
      width: 80,
      align: 'right',
      render: (r, rec) => {
        if (r === null || r === undefined) return <Text type="secondary">-</Text>;
        const prev = rec.ranking?.previousRank;
        const diff = prev ? prev - r : 0;
        return (
          <Space size={4}>
            <Text strong>{r}</Text>
            {diff > 0 && <Text type="success" style={{ fontSize: 11 }}>+{diff}</Text>}
            {diff < 0 && <Text type="danger" style={{ fontSize: 11 }}>{diff}</Text>}
          </Space>
        );
      }
    },
    { 
      title: <span style={{whiteSpace:'nowrap'}}>Trend</span>, 
      dataIndex: ['metrics', 'trends'], 
      key: 'trend', 
      width: 120, 
      align: 'center',
      render: (t) => <TrendSparkline data={t} /> 
    },
    { 
      title: <span style={{whiteSpace:'nowrap'}}>Confidence</span>, 
      dataIndex: ['evidence', 'confidenceScore'], 
      key: 'confidence', 
      width: 110, 
      align: 'center',
      render: (c) => c ? <Badge status={c >= 90 ? 'success' : c >= 70 ? 'warning' : 'error'} text={<span style={{fontSize: 12}}>{c}%</span>} /> : <Text type="secondary">-</Text> 
    },
    { 
      title: <span style={{whiteSpace:'nowrap'}}>Status</span>, 
      dataIndex: 'status', 
      key: 'status', 
      width: 120, 
      align: 'center',
      render: (s) => <Tag color={STATUS_COLORS[s] || 'default'} style={{ margin: 0 }}>{s}</Tag> 
    },
    { 
      title: <span style={{whiteSpace:'nowrap'}}>Discovery Source</span>, 
      dataIndex: ['evidence', 'discoverySource'], 
      key: 'discovery', 
      width: 130, 
      align: 'center',
      responsive: ['xl', 'xxl', 'lg'],
      render: (d) => <Text style={{fontSize: 12}} type="secondary" ellipsis>{d || 'Crawler'}</Text> 
    },
    {
      title: <span style={{whiteSpace:'nowrap'}}>Actions</span>,
      key: 'actions',
      width: 80,
      align: 'center',
      fixed: 'right',
      render: (_, r) => (
        <Space size={8}>
          <Tooltip title="View Details">
            <Button type="text" size="small" icon={<Search size={14} />} onClick={() => openEvidenceDrawer(r)} />
          </Tooltip>
          <Tooltip title="Refresh Metrics">
            <Button type="text" size="small" icon={<RefreshCcw size={14} />} onClick={() => act(() => seoWorkspaceApi.refreshKeywords(projectId, [r._id]), 'Refreshing')} />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 8, background: isDark ? 'rgba(114, 46, 209, 0.15)' : '#f9f0ff', borderRadius: 8, color: '#722ed1' }}>
            <Hash size={24} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {activeProject ? `${activeProject.name} — Keyword Intelligence` : 'Keyword Intelligence'}
            </Title>
            <Text type="secondary">Enterprise keyword tracking, clustering, semantic clustering, and competitive gaps.</Text>
          </div>
        </div>
      </div>

      <ProjectSelector style={{ marginBottom: 20 }} />
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />}

      {!projectId ? (
        <Empty description="Select or create a Workspace Project to begin keyword intelligence" />
      ) : (
        <Tabs activeKey={activeTab} onChange={setActiveTab} type="card" style={{ background: isDark ? '#111c31' : '#fff', padding: 16, borderRadius: 8, border: isDark ? '1px solid #1e293b' : 'none' }}>
          <TabPane tab={<Space><Target size={16}/> Tracked Keywords</Space>} key="tracked">
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Input prefix={<Search size={14}/>} placeholder="Search keyword..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 200 }} />
                <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 120 }}>
                  <Option value="All">All Statuses</Option>
                  <Option value="Approved">Approved</Option>
                  <Option value="Suggested">Suggested</Option>
                  <Option value="Rejected">Rejected</Option>
                </Select>
                <Select value={intentFilter} onChange={setIntentFilter} style={{ width: 140 }}>
                  <Option value="All">All Intents</Option>
                  <Option value="informational">Informational</Option>
                  <Option value="navigational">Navigational</Option>
                  <Option value="commercial">Commercial</Option>
                  <Option value="transactional">Transactional</Option>
                </Select>
              </Space>
              <Space>
                {selectedRowKeys.length > 0 && (
                  <>
                    <Popconfirm title={`Approve ${selectedRowKeys.length} keywords?`} onConfirm={() => act(() => seoWorkspaceApi.approveKeywordSuggestions(projectId, selectedRowKeys), 'Approved')}>
                      <Button size="small" type="primary">Approve</Button>
                    </Popconfirm>
                    <Button size="small" danger onClick={() => act(() => seoWorkspaceApi.rejectKeywordSuggestions(projectId, selectedRowKeys), 'Rejected')}>Reject</Button>
                  </>
                )}
                <Button icon={<Sparkles size={14}/>} onClick={runResearch} loading={running} type="primary">Extract Keywords</Button>
                <Button icon={<RefreshCcw size={14}/>} onClick={handleRefreshKeywords}>Manual Refresh</Button>
                <Button icon={<Download size={14}/>} onClick={handleExport}>Export CSV</Button>
              </Space>
            </div>

            {distribution && (
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="Top 3" value={distribution.top3} valueStyle={{ color: '#52c41a' }} /></Card></Col>
                <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="Top 10" value={distribution.top10} valueStyle={{ color: '#1890ff' }} /></Card></Col>
                <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="Top 20" value={distribution.top20} /></Card></Col>
                <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="Top 100" value={distribution.top100} /></Card></Col>
                <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="Visibility Score" value={distribution.averageVisibility} /></Card></Col>
                <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="Not Ranked" value={distribution.notRanked} valueStyle={{ color: '#cf1322' }} /></Card></Col>
              </Row>
            )}
            <style>{`
              .enterprise-table .ant-table-thead > tr > th {
                white-space: nowrap !important;
                height: 52px;
                vertical-align: middle;
                background-color: ${isDark ? '#162238' : '#fafafa'} !important;
                color: ${isDark ? '#f8fafc' : 'inherit'} !important;
                border-bottom: 1px solid ${isDark ? '#1e293b' : '#f0f0f0'} !important;
              }
              .enterprise-table .ant-table-tbody > tr > td {
                padding: 12px 16px !important;
                height: 48px;
                vertical-align: middle;
                border-bottom: 1px solid ${isDark ? '#1e293b' : '#f0f0f0'} !important;
              }
              .enterprise-table .ant-table-tbody > tr:hover > td {
                background-color: ${isDark ? '#1a2b47' : '#f0f7ff'} !important;
              }
            `}</style>
            
            <div style={{ background: isDark ? '#111c31' : '#fff', borderRadius: 8, overflow: 'hidden', border: isDark ? '1px solid #1e293b' : '1px solid #f0f0f0' }}>
              <Table
                rowKey="_id"
                className="enterprise-table"
                size="middle"
                tableLayout="fixed"
                loading={loading}
                dataSource={filteredKeywords}
                columns={columns}
                sticky={true}
                scroll={{ x: 'max-content' }}
                pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'], showSizeChanger: true, pageSizeOptions: ['20', '50', '100', '500'] }}
                rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
                footer={() => {
                  const hiddenCount = keywords.length - filteredKeywords.length;
                  return hiddenCount > 0 ? (
                    <Text type="secondary">
                      Showing {filteredKeywords.length} of {keywords.length} keywords. {hiddenCount} keywords are hidden due to active filters.
                    </Text>
                  ) : (
                    <Text type="secondary">Showing all {keywords.length} keywords.</Text>
                  );
                }}
                locale={{ emptyText: <Empty description="No keywords found. Switch to the Discovery tab to find opportunities." /> }}
              />
            </div>
          </TabPane>

          <TabPane tab={<Space><Sparkles size={16}/> Discovery & Opportunities</Space>} key="discovery">
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Card size="small" title="AI Keyword Research Agent" bordered={false} style={{ background: isDark ? '#162238' : '#f9f9f9', border: isDark ? '1px solid #1e293b' : undefined, height: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>Generate new keyword clusters, related questions, and long-tail opportunities based on the project's domain and target audience.</Text>
                    <Input placeholder="Optional seed keyword (e.g. 'marathon training')" value={seedKeyword} onChange={(e) => setSeedKeyword(e.target.value)} />
                    <Button type="primary" loading={running} onClick={runResearch} icon={<Sparkles size={14}/>}>Run Deep Research</Button>
                    {runResult && (
                      <Alert type="success" showIcon message={`${runResult.suggestedKeywords?.length || 0} suggestion(s) from ${runResult.candidateCount || 0} candidate(s). Go to Tracked Keywords to approve them.`} />
                    )}
                  </Space>
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card size="small" title="Quick Related Keyword Lookup" bordered={false} style={{ background: isDark ? '#162238' : '#f9f9f9', border: isDark ? '1px solid #1e293b' : undefined, height: '100%' }}>
                  <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                    <Input placeholder="Search term (e.g. 'running shoes')" value={relatedInput} onChange={(e) => setRelatedInput(e.target.value)} onPressEnter={fetchRelated} />
                    <Button type="primary" loading={relatedLoading} onClick={fetchRelated} icon={<Search size={14}/>}>Lookup</Button>
                  </Space.Compact>
                  {related && (
                    <Table
                      rowKey="keyword"
                      size="small"
                      dataSource={related}
                      pagination={{ defaultPageSize: 5, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                      locale={{ emptyText: <Empty description="No candidates found" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                      columns={[
                        { title: 'Keyword', dataIndex: 'keyword', key: 'keyword' },
                        { title: 'Volume', dataIndex: 'searchVolume', key: 'searchVolume', render: v => v ? v.toLocaleString() : 'N/A' },
                        { title: 'Action', key: 'action', render: () => <Button size="small">Add to Project</Button> }
                      ]}
                    />
                  )}
                </Card>
              </Col>
            </Row>
          </TabPane>

          <TabPane tab={<Space><Network size={16}/> Clusters</Space>} key="clusters">
            {loadingClusters ? <Empty description="Loading clusters..." /> : clusters.length === 0 ? (
              <Empty description="No clusters generated yet. Ensure your tracked keywords have 'parentKeyword' or 'cluster' defined." />
            ) : (
              <Row gutter={[16, 16]}>
                {clusters.map(cluster => (
                  <Col xs={24} md={12} lg={8} key={cluster.parentKeyword}>
                    <Card size="small" title={<Space><Tag color="blue">{cluster.parentKeyword}</Tag></Space>} bordered>
                      <Statistic title="Total Search Volume" value={cluster.searchVolume.toLocaleString()} prefix={<TrendingUp size={14}/>} valueStyle={{ fontSize: 18 }} />
                      <Divider style={{ margin: '12px 0' }} />
                      <Text type="secondary" strong>{cluster.keywords.length} Keywords in Cluster</Text>
                      <div style={{ maxHeight: 150, overflowY: 'auto', marginTop: 8 }}>
                        {cluster.keywords.map(k => (
                          <div key={k._id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text ellipsis style={{ maxWidth: 150 }}>{k.keyword}</Text>
                            <Text type="secondary">{k.metrics?.searchVolume ? k.metrics.searchVolume.toLocaleString() : 'N/A'}</Text>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </TabPane>

          <TabPane tab={<Space><TrendingUp size={16}/> Keyword Gap</Space>} key="gap">
            <Card size="small" bordered={false} style={{ background: isDark ? '#162238' : '#f9f9f9', border: isDark ? '1px solid #1e293b' : undefined, marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>Identify high-value keywords that your competitors rank for, but you are missing.</Text>
                <Space.Compact style={{ width: 400 }}>
                  <Input placeholder="Competitor Domain (e.g. competitor.com)" value={competitorUrl} onChange={e => setCompetitorUrl(e.target.value)} onPressEnter={fetchGap} />
                  <Button type="primary" onClick={fetchGap} loading={loadingGap}>Analyze Gap</Button>
                </Space.Compact>
              </Space>
            </Card>

          </TabPane>

          <TabPane tab={<Space><Alert size={16}/> Cannibalization Report</Space>} key="cannibalization">
            <Card size="small" bordered={false} style={{ background: isDark ? '#162238' : '#f9f9f9', border: isDark ? '1px solid #1e293b' : undefined, marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>Identify keywords where multiple pages on your site are competing against each other in search results.</Text>
              </Space>
            </Card>
            
            <Table
              rowKey="_id"
              size="small"
              dataSource={keywords.filter(k => k.cannibalization?.isCannibalized)}
              locale={{ emptyText: <Empty description="No cannibalization detected! Your canonical strategy is solid." /> }}
              columns={[
                { title: 'Keyword', dataIndex: 'keyword', key: 'keyword', render: k => <Text strong>{k}</Text> },
                { title: 'Current Rank', dataIndex: ['ranking', 'currentRank'], key: 'rank' },
                { title: 'Severity', dataIndex: ['cannibalization', 'severity'], key: 'severity', render: s => <Tag color={s === 'high' ? 'red' : 'orange'}>{s.toUpperCase()}</Tag> },
                { title: 'Conflicting URLs', dataIndex: ['cannibalization', 'conflictUrls'], key: 'urls', render: urls => (
                  <Space direction="vertical" size={2}>
                    {urls?.map(url => <Text key={url} style={{ fontSize: 12 }}>{url}</Text>)}
                  </Space>
                )}
              ]}
            />
          </TabPane>

          <TabPane tab={<Space><Target size={16}/> Topical Authority</Space>} key="authority">
            <Card size="small" bordered={false} style={{ background: isDark ? '#162238' : '#f9f9f9', border: isDark ? '1px solid #1e293b' : undefined, marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>Topic Authority is calculated by comparing your search volume coverage across keyword clusters.</Text>
                <Button type="primary" onClick={async () => {
                  try {
                    const res = await seoWorkspaceApi.getTopicalAuthority(projectId);
                    message.info(`Your overall Topical Authority Score is: ${res.data.authorityScore}/100`);
                  } catch (e) {
                    message.error('Failed to load Topical Authority');
                  }
                }}>Calculate Authority</Button>
              </Space>
            </Card>
          </TabPane>
        </Tabs>
      )}

      {/* ENTERPRISE EVIDENCE DRAWER */}
      <Drawer
        title={<Space><Search size={18} /> Keyword Evidence: {selectedKeywordEvidence?.keyword}</Space>}
        placement="right"
        width={600}
        onClose={() => setEvidenceDrawerOpen(false)}
        open={evidenceDrawerOpen}
      >
        {selectedKeywordEvidence && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Descriptions title="Discovery Evidence" bordered size="small" column={1}>
              <Descriptions.Item label="Source">{selectedKeywordEvidence.evidence?.discoverySource || 'Manual'}</Descriptions.Item>
              <Descriptions.Item label="First Seen">{selectedKeywordEvidence.evidence?.discoveryTimestamp ? new Date(selectedKeywordEvidence.evidence.discoveryTimestamp).toLocaleString() : 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Source URL">{selectedKeywordEvidence.evidence?.discoveryUrl || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="HTML Element">{selectedKeywordEvidence.evidence?.discoveryElement || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Confidence">{selectedKeywordEvidence.evidence?.confidenceScore || 0}%</Descriptions.Item>
              <Descriptions.Item label="Lifecycle State"><Tag>{selectedKeywordEvidence.lifecycle || 'Discovered'}</Tag></Descriptions.Item>
            </Descriptions>

            <Descriptions title="Ranking Evidence" bordered size="small" column={1}>
              <Descriptions.Item label="Current Rank">{selectedKeywordEvidence.ranking?.currentRank || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Ranking Source"><Tag color="blue">{selectedKeywordEvidence.ranking?.rankingSource || 'UNAVAILABLE'}</Tag></Descriptions.Item>
              <Descriptions.Item label="Search Engine">{selectedKeywordEvidence.ranking?.searchEngine || 'Google'} ({selectedKeywordEvidence.ranking?.device || 'Unknown'})</Descriptions.Item>
              <Descriptions.Item label="Ranking URL">{selectedKeywordEvidence.ranking?.url ? <a href={selectedKeywordEvidence.ranking.url} target="_blank" rel="noreferrer">{selectedKeywordEvidence.ranking.url}</a> : 'N/A'}</Descriptions.Item>
              {selectedKeywordEvidence.ranking?.isUnexpectedUrl && <Descriptions.Item label="Warning"><Alert type="warning" message="Unexpected Ranking URL flagged" showIcon /></Descriptions.Item>}
            </Descriptions>

            <Descriptions title="Metric Sources" bordered size="small" column={1}>
              <Descriptions.Item label="Search Volume">{selectedKeywordEvidence.metrics?.searchVolume || 0} (Source: <Tag>{selectedKeywordEvidence.metrics?.searchVolumeSource || 'DataForSEO'}</Tag>)</Descriptions.Item>
              <Descriptions.Item label="Keyword Difficulty">{selectedKeywordEvidence.metrics?.keywordDifficulty || 0} (Source: <Tag>{selectedKeywordEvidence.metrics?.keywordDifficultySource || 'DataForSEO'}</Tag>)</Descriptions.Item>
              <Descriptions.Item label="CPC">${selectedKeywordEvidence.metrics?.cpc || 0} (Source: <Tag>{selectedKeywordEvidence.metrics?.cpcSource || 'DataForSEO'}</Tag>)</Descriptions.Item>
            </Descriptions>

            <Descriptions title="Opportunity & Intent Calculation" bordered size="small" column={1}>
              <Descriptions.Item label="Primary Intent"><Tag color={INTENT_COLORS[selectedKeywordEvidence.metrics?.intent] || 'default'}>{selectedKeywordEvidence.metrics?.intent || 'Unknown'}</Tag></Descriptions.Item>
              <Descriptions.Item label="Opportunity Score"><Badge count={selectedKeywordEvidence.agent?.opportunityScore || 0} style={{ backgroundColor: '#1890ff' }} /></Descriptions.Item>
              <Descriptions.Item label="Score Rationale">
                {selectedKeywordEvidence.agent?.rationale || 'Calculation not available.'}
                {selectedKeywordEvidence.agent?.opportunityBreakdown && (
                  <pre style={{ fontSize: 11, background: isDark ? '#162238' : '#f5f5f5', color: isDark ? '#f8fafc' : 'inherit', border: isDark ? '1px solid #1e293b' : 'none', padding: 8, marginTop: 8, borderRadius: 4 }}>
                    {JSON.stringify(selectedKeywordEvidence.agent.opportunityBreakdown, null, 2)}
                  </pre>
                )}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </motion.div>
  );
};

export default KeywordsTab;