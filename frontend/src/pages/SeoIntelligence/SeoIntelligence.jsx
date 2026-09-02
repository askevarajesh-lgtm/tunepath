import React, { useState } from 'react';
import { Layout, Typography, Card, Space, Button, Row, Col, Spin, Tag, message, Table, Drawer, Modal, Form, Input, Select, Dropdown, Tabs, Progress, Statistic } from 'antd';
import { motion } from 'framer-motion';
import { Globe, Plus, Database, Search, ArrowUpRight, ArrowDownRight, MoreVertical, Edit, Trash2, Key, RefreshCw, Activity, Link as LinkIcon, ExternalLink, ShieldAlert } from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import { 
  useGetSeoProjectsQuery, 
  useTestIntegrationQuery, 
  useGetDashboardStatsQuery, 
  useGetApiCreditUsageQuery, 
  useCreateSeoProjectMutation, 
  useUpdateSeoProjectMutation,
  useDeleteSeoProjectMutation,
  useResearchKeywordsMutation,
  useAddKeywordsMutation,
  useRefreshRankingsMutation,
  useRunAuditMutation,
  useGetBacklinksQuery
} from '../../api/seoIntelligenceApi';
import { useGetClientsQuery } from '../../api/clientApi';
import GeoInsightsTab from './components/GeoInsightsTab';
import DomainOverviewTab from './components/DomainOverviewTab';

const { Title, Text } = Typography;

const SiteAuditTab = ({ projects, refetchProjects }) => {
  const [selectedProject, setSelectedProject] = useState(projects[0]?._id);
  const [runAudit, { isLoading: isAuditing }] = useRunAuditMutation();
  const [auditData, setAuditData] = useState(null);

  React.useEffect(() => {
    if (!selectedProject && projects?.length > 0) {
      setSelectedProject(projects[0]._id);
    }
  }, [projects, selectedProject]);

  const handleRunAudit = async () => {
    if (!selectedProject) return message.warning('Select a project first');
    try {
      const res = await runAudit(selectedProject);
      if (res.error) throw res.error;
      setAuditData(res.data?.data);
      message.success('Site audit completed');
      refetchProjects();
    } catch (error) {
      message.error(error?.response?.data?.message || error?.message || 'Failed to run audit');
    }
  };

  const project = projects.find(p => p._id === selectedProject);

  return (
    <div style={{ padding: '24px 0' }}>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Card title="Site Audit Engine" style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%' }}>
            <Form layout="vertical">
              <Form.Item label="Target Project">
                <Select 
                  size="large" 
                  value={selectedProject} 
                  onChange={setSelectedProject}
                  options={projects.map(p => ({ label: p.domain, value: p._id }))}
                />
              </Form.Item>
              <Button type="primary" size="large" block loading={isAuditing} onClick={handleRunAudit} icon={<Activity size={18} />} style={{ borderRadius: 8 }}>
                Run Deep Audit
              </Button>
            </Form>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Progress 
                type="dashboard" 
                percent={Math.round(auditData?.page_metrics?.onpage_score || project?.stats?.lastAuditScore || 0)} 
                strokeColor={
                  (auditData?.page_metrics?.onpage_score || project?.stats?.lastAuditScore || 0) > 80 ? '#10b981' : 
                  (auditData?.page_metrics?.onpage_score || project?.stats?.lastAuditScore || 0) > 50 ? '#f59e0b' : '#ef4444'
                }
                format={percent => (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)' }}>{percent}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Score</span>
                  </div>
                )}
                size={180}
              />
              <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>Health Score (0-100)</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card title={<Text strong>Crawl Statistics & Issues</Text>} style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%' }}>
            {!auditData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-tertiary)' }}>
                <ShieldAlert size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                <Text type="secondary">Run an audit to see detailed metrics and technical SEO issues.</Text>
              </div>
            ) : (
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Card size="small" style={{ background: 'var(--bg-secondary)', border: 0, borderRadius: 8 }}>
                    <Statistic title="Pages Crawled" value={auditData.crawl_status?.pages_crawled || 0} />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" style={{ background: '#fef2f2', border: 0, borderRadius: 8 }}>
                    <Statistic title={<span style={{ color: '#ef4444' }}>Critical Errors</span>} value={auditData.issues?.filter(i => i.severity === 'Error').reduce((sum, i) => sum + (i.count || 0), 0) || 0} valueStyle={{ color: '#ef4444', fontWeight: 700 }} />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" style={{ background: '#fffbeb', border: 0, borderRadius: 8 }}>
                    <Statistic title={<span style={{ color: '#f59e0b' }}>Warnings</span>} value={auditData.issues?.filter(i => i.severity === 'Warning').reduce((sum, i) => sum + (i.count || 0), 0) || 0} valueStyle={{ color: '#f59e0b', fontWeight: 700 }} />
                  </Card>
                </Col>
                
                <Col span={24}>
                  <div style={{ marginTop: 16 }}>
                    <Title level={5}>Top Issues Detected</Title>
                    {auditData.issues && auditData.issues.length > 0 ? (
                      <Table 
                        pagination={false}
                        size="small"
                        columns={[
                          { title: 'Severity', dataIndex: 'severity', render: s => <Tag color={s==='Error'?'error':'warning'}>{s}</Tag> },
                          { title: 'Issue Type', dataIndex: 'type', render: t => <Text strong>{t}</Text> },
                          { title: 'Pages Affected', dataIndex: 'count' }
                        ]}
                        dataSource={auditData.issues}
                        rowKey="key"
                      />
                    ) : (
                      <Text type="secondary">No critical issues detected. Great job!</Text>
                    )}
                  </div>
                </Col>
              </Row>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

const BacklinkTab = ({ projects }) => {
  const [selectedProject, setSelectedProject] = useState(projects[0]?._id);
  const [hasRun, setHasRun] = useState(false);
  
  React.useEffect(() => {
    if (!selectedProject && projects?.length > 0) {
      setSelectedProject(projects[0]._id);
    }
  }, [projects, selectedProject]);
  
  const { data: backlinkData, isLoading: isFetchingBacklinks } = useGetBacklinksQuery(selectedProject, { skip: !selectedProject || !hasRun });
  
  const backlinks = backlinkData?.data || null;

  const handleRunAnalysis = () => {
    if (selectedProject) {
      setHasRun(true);
    }
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Card title="Backlink Profile" style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%' }}>
            <Form layout="vertical">
              <Form.Item label="Target Project">
                <Select 
                  size="large" 
                  value={selectedProject} 
                  onChange={(val) => {
                    setSelectedProject(val);
                    setHasRun(false);
                  }}
                  options={projects.map(p => ({ label: p.domain, value: p._id }))}
                />
              </Form.Item>
              <Button 
                type="primary" 
                size="large" 
                block 
                loading={isFetchingBacklinks} 
                onClick={handleRunAnalysis} 
                icon={<Activity size={18} />} 
                style={{ borderRadius: 8 }}
              >
                Run Backlink Analysis
              </Button>
            </Form>

            {isFetchingBacklinks ? (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0' }}><Spin /></div>
            ) : backlinks ? (
              <div style={{ marginTop: 24 }}>
                <Card size="small" style={{ background: 'var(--bg-secondary)', border: 0, borderRadius: 8, marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Domain Rank / Authority</Text>
                  <Title level={2} style={{ margin: 0, color: 'var(--accent-primary)' }}>{backlinks.rank || 0}</Title>
                </Card>
                <Row gutter={[12, 12]}>
                  <Col span={12}>
                    <Card size="small" style={{ background: 'var(--bg-secondary)', border: 0, borderRadius: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Total Backlinks</Text>
                      <Title level={4} style={{ margin: 0 }}>{(backlinks.total_backlinks || 0).toLocaleString()}</Title>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" style={{ background: 'var(--bg-secondary)', border: 0, borderRadius: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Referring Domains</Text>
                      <Title level={4} style={{ margin: 0 }}>{(backlinks.referring_domains || 0).toLocaleString()}</Title>
                    </Card>
                  </Col>
                </Row>
              </div>
            ) : null}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card title={<Text strong>Top Referring Domains</Text>} style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%' }} bodyStyle={{ padding: 0 }}>
            {isFetchingBacklinks ? (
              <div style={{ padding: '80px 0', textAlign: 'center' }}><Spin size="large" /></div>
            ) : backlinks?.items?.length > 0 ? (
              <Table 
                dataSource={backlinks.items}
                rowKey="url_from"
                pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                style={{ borderTop: '1px solid var(--border-color)' }}
                columns={[
                  { title: 'Referring Domain', dataIndex: 'url_from', key: 'url_from', render: text => <a href={text.startsWith('http') ? text : `https://${text}`} target="_blank" rel="noreferrer" style={{ fontWeight: 500, color: 'var(--accent-primary)' }}>{text}</a> },
                  { title: 'Domain Rank', dataIndex: 'rank', key: 'rank', render: val => <Tag color={val >= 70 ? 'success' : val >= 40 ? 'processing' : 'default'} style={{ borderRadius: 12 }}>{val || 0}</Tag> },
                  { title: 'Backlinks', dataIndex: 'backlinks', key: 'backlinks', render: val => <Text strong>{(val || 0).toLocaleString()}</Text> },
                  { title: 'Top Anchor', dataIndex: 'anchor', key: 'anchor', render: val => val ? <Tag>{val}</Tag> : '-' }
                ]}
              />
            ) : (
              <div style={{ padding: '80px 0', textAlign: 'center', opacity: 0.6 }}>
                <LinkIcon size={48} color="var(--text-secondary)" style={{ marginBottom: 16, opacity: 0.3 }} />
                {!hasRun ? (
                  <Text type="secondary" style={{ display: 'block' }}>Click "Run Backlink Analysis" to fetch live data.</Text>
                ) : (
                  <Text type="secondary" style={{ display: 'block' }}>No backlink data found in the index for this domain.</Text>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

const KeywordIntelligenceTab = ({ projects, isLoadingProjects, refetchProjects }) => {
  const [selectedProject, setSelectedProject] = useState(projects[0]?._id);
  const [searchQuery, setSearchQuery] = useState('');
  const [researchKeywords, { isLoading: isSearching }] = useResearchKeywordsMutation();
  const [addKeywords, { isLoading: isAdding }] = useAddKeywordsMutation();
  const [refreshRankings, { isLoading: isRefreshing }] = useRefreshRankingsMutation();
  
  React.useEffect(() => {
    if (!selectedProject && projects?.length > 0) {
      setSelectedProject(projects[0]._id);
    }
  }, [projects, selectedProject]);
  
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      const response = await researchKeywords({ keyword: searchQuery });
      setSearchResults(response.data?.data || []);
    } catch (error) {
      message.error('Failed to fetch keyword ideas');
    }
  };

  const handleAddSelected = async () => {
    if (!selectedProject) return message.error('Select a project first');
    if (selectedRowKeys.length === 0) return message.warning('No keywords selected');
    
    try {
      const keywordsToAdd = searchResults.filter(k => selectedRowKeys.includes(k.keyword));
      await addKeywords({ projectId: selectedProject, keywords: keywordsToAdd });
      message.success(`${keywordsToAdd.length} keywords added to tracking`);
      setSelectedRowKeys([]);
      setSearchResults([]);
      refetchProjects();
    } catch (error) {
      message.error('Failed to add keywords');
    }
  };

  const handleRefresh = async () => {
    if (!selectedProject) return;
    try {
      await refreshRankings(selectedProject);
      message.success('Rankings refreshed successfully');
    } catch (error) {
      message.error('Failed to refresh rankings');
    }
  };

  const searchColumns = [
    { title: 'Keyword', dataIndex: 'keyword', key: 'keyword', render: t => <Text strong>{t}</Text> },
    { title: 'Search Volume', dataIndex: 'search_volume', key: 'vol', render: v => v?.toLocaleString() || '-' },
    { title: 'Difficulty', dataIndex: 'keyword_difficulty', key: 'diff', render: v => (
      <Progress percent={v} size="small" showInfo={false} strokeColor={v > 70 ? '#ef4444' : v > 40 ? '#f59e0b' : '#10b981'} />
    )},
    { title: 'CPC ($)', dataIndex: 'cpc', key: 'cpc' },
    { title: 'Intent', dataIndex: ['search_intent_info', 'main_intent'], key: 'intent', render: t => (
      <Tag color="blue" style={{ borderRadius: 12 }}>{t}</Tag>
    )}
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Card title="Keyword Research" style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%' }}>
            <Form layout="vertical">
              <Form.Item label="Target Project">
                <Select 
                  size="large" 
                  value={selectedProject} 
                  onChange={setSelectedProject}
                  options={projects.map(p => ({ label: p.domain, value: p._id }))}
                />
              </Form.Item>
              <Form.Item label="Seed Keyword">
                <Input 
                  size="large" 
                  placeholder="e.g., crm software" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onPressEnter={handleSearch}
                  prefix={<Search size={16} color="var(--text-tertiary)" />}
                />
              </Form.Item>
              <Button type="primary" size="large" block loading={isSearching} onClick={handleSearch} style={{ borderRadius: 8 }}>
                Generate Keyword Ideas
              </Button>
            </Form>

            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text strong>Tracked Keywords Overview</Text>
                <Button type="text" size="small" icon={<RefreshCw size={14} />} loading={isRefreshing} onClick={handleRefresh}>Refresh Ranks</Button>
              </div>
              <Card size="small" style={{ borderRadius: 8, background: 'var(--bg-secondary)', border: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text type="secondary">Total Tracked</Text>
                  <Text strong>{projects.find(p => p._id === selectedProject)?.stats?.totalKeywords || 0}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Top 10 Rankings</Text>
                  <Text strong style={{ color: '#10b981' }}>{projects.find(p => p._id === selectedProject)?.stats?.rankingsInTop10 || 0}</Text>
                </div>
              </Card>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card 
            title={<Text strong>Keyword Opportunities</Text>} 
            extra={selectedRowKeys.length > 0 && <Button type="primary" onClick={handleAddSelected} loading={isAdding} style={{ borderRadius: 8 }}>Add {selectedRowKeys.length} Keywords</Button>}
            style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%' }}
            bodyStyle={{ padding: 0 }}
          >
            {searchResults.length > 0 ? (
              <Table 
                rowSelection={{
                  selectedRowKeys,
                  onChange: setSelectedRowKeys
                }}
                columns={searchColumns} 
                dataSource={searchResults} 
                rowKey="keyword" 
                pagination={false}
                style={{ borderRadius: '0 0 16px 16px' }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--text-tertiary)' }}>
                <Key size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                <Text type="secondary">Enter a seed keyword to discover high-value opportunities</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

const DashboardTab = ({ projects, stats, handleDelete, handleEdit, handleCreateProject, isCreating, isDrawerVisible, setIsDrawerVisible, form, clients = [], isEditDrawerVisible, setIsEditDrawerVisible, editRecord, editForm, isUpdating }) => {
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const trendChartOptions = {
    chart: { type: 'area', toolbar: { show: false }, sparkline: { enabled: true } },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0, stops: [0, 100] } },
    colors: ['var(--accent-primary)'],
    tooltip: { fixed: { enabled: false }, x: { show: false }, y: { title: { formatter: () => '' } }, marker: { show: false } }
  };

  const funnelChartOptions = {
    chart: { type: 'bar', toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 4, horizontal: true, distributed: true, dataLabels: { position: 'bottom' } } },
    colors: ['var(--accent-primary)', '#10b981', '#f59e0b', '#8b5cf6'],
    dataLabels: { enabled: true, textAnchor: 'start', style: { colors: ['#fff'] } },
    xaxis: { categories: ['Impressions', 'Clicks', 'Leads', 'Conversions'] },
    yaxis: { labels: { show: false } },
    tooltip: { theme: 'dark' }
  };

  const columns = [
    { title: 'Domain URL', dataIndex: 'domain', key: 'domain', render: (text, record) => (
      <Space>
        <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe size={16} color="#fff" /></div>
        <div>
          <Text strong style={{ display: 'block' }}>{record.domain}</Text>
        </div>
      </Space>
    )},
    { title: 'Keywords', dataIndex: ['stats', 'totalKeywords'], key: 'keywords', render: val => val || 0 },
    { title: 'Top 10', dataIndex: ['stats', 'top10Rankings'], key: 'top10', render: val => val || 0 },
    { title: 'Audit Score', dataIndex: ['stats', 'lastAuditScore'], key: 'auditScore', render: val => (
      <Tag color={!val ? 'default' : val >= 80 ? 'success' : val >= 60 ? 'warning' : 'error'} style={{ borderRadius: 12 }}>
        {val ? `${val}/100` : 'N/A'}
      </Tag>
    )},
    { title: 'Status', dataIndex: 'status', key: 'status', render: () => <Tag color="processing" style={{ borderRadius: 12 }}>Active</Tag> },
    { title: 'Actions', key: 'actions', render: (_, record) => (
      <Dropdown menu={{ items: [
        { key: '1', label: 'Edit Project', icon: <Edit size={14} />, onClick: () => handleEdit(record) },
        { key: '2', label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => handleDelete(record._id) }
      ]}}>
        <Button type="text" icon={<MoreVertical size={16} />} />
      </Dropdown>
    )}
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { title: 'Total Keywords Tracked', value: stats.totalKeywords.toLocaleString(), trend: null, isUp: true, series: [{ data: stats.keywordTrend?.length > 1 ? stats.keywordTrend : [0, stats.totalKeywords || 0] }] },
          { title: 'Avg. SEO Audit Score', value: stats.averageAuditScore > 0 ? `${stats.averageAuditScore}/100` : 'N/A', trend: null, isUp: true, series: [{ data: stats.auditScoreTrend?.length > 1 ? stats.auditScoreTrend : [0, stats.averageAuditScore || 0] }], color: '#10b981' },
          { title: 'Top 10 Rankings', value: stats.totalRankingsInTop10?.toLocaleString() || '0', trend: null, isUp: true, series: [{ data: [0, stats.totalRankingsInTop10 || 0] }], color: '#8b5cf6' },
          { title: 'Total Projects', value: stats.totalProjects?.toString() || '0', trend: null, isUp: true, series: [{ data: [0, stats.totalProjects || 0] }], color: '#f59e0b' },
        ].map((kpi, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <motion.div variants={itemVariants}>
              <Card style={{ borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }} bodyStyle={{ padding: 20 }}>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>{kpi.title}</Text>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
                  <Title level={3} style={{ margin: 0, fontWeight: 700 }}>{kpi.value}</Title>
                  <div style={{ width: 80, height: 40 }}>
                    <ReactApexChart options={{ ...trendChartOptions, colors: [kpi.color || 'var(--accent-primary)'] }} series={kpi.series} type="area" height={40} />
                  </div>
                </div>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {kpi.trend ? (
                    <>
                      <Tag color={kpi.isUp ? 'success' : 'error'} style={{ borderRadius: 12, border: 0, padding: '2px 8px' }}>
                        {kpi.isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {kpi.trend}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>vs last month</Text>
                    </>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>Live from database</Text>
                  )}
                </div>
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <motion.div variants={itemVariants}>
            <Card title={<Text strong style={{ fontSize: 16 }}>Website Projects</Text>} style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%' }} bodyStyle={{ padding: 0 }}>
              <Table 
                columns={columns} 
                dataSource={projects} 
                rowKey="_id" 
                pagination={{ defaultPageSize: 5, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }} 
                style={{ borderRadius: '0 0 16px 16px', overflow: 'hidden' }}
              />
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} lg={8}>
          <motion.div variants={itemVariants}>
            <Card title={<Text strong style={{ fontSize: 16 }}>Lead Generation Funnel</Text>} style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%' }}>
              {(() => {
                // Build funnel from real project aggregate stats
                const funnelImpressions = stats.totalKeywords * 120 || 0; // rough proxy: avg 120 impressions per tracked kw
                const funnelClicks = Math.round(funnelImpressions * 0.045); // avg 4.5% CTR
                const funnelLeads = Math.round(funnelClicks * 0.08);
                const funnelConversions = stats.totalRankingsInTop10 || 0;
                const funnelData = [funnelImpressions, funnelClicks, funnelLeads, funnelConversions];
                return (
                  <ReactApexChart 
                    options={funnelChartOptions} 
                    series={[{ data: funnelData }]} 
                    type="bar" 
                    height={320} 
                  />
                );
              })()}
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* ── Create Project Drawer ── */}
      <Drawer
        title="Add New SEO Project"
        placement="right"
        width={400}
        onClose={() => setIsDrawerVisible(false)}
        open={isDrawerVisible}
        extra={
          <Space>
            <Button onClick={() => setIsDrawerVisible(false)} style={{ borderRadius: 8 }}>Cancel</Button>
            <Button type="primary" onClick={() => form.submit()} loading={isCreating} style={{ borderRadius: 8 }}>Create Project</Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form} onFinish={handleCreateProject}>
          <Form.Item name="domain" label="Domain URL" rules={[{ required: true, message: 'Please enter a domain' }]}>
            <Input placeholder="e.g. example.com" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="searchEngines" label="Target Search Engines" initialValue={['google']}>
            <Select mode="multiple" size="large" style={{ borderRadius: 8 }}>
              <Select.Option value="google">Google</Select.Option>
              <Select.Option value="bing">Bing</Select.Option>
              <Select.Option value="yahoo">Yahoo</Select.Option>
            </Select>
          </Form.Item>
          {clients.length > 0 && (
            <Form.Item name="clientId" label="Assign to Client (optional)">
              <Select size="large" placeholder="Select a client..." allowClear showSearch optionFilterProp="children" style={{ borderRadius: 8 }}>
                {clients.map(c => (
                  <Select.Option key={c._id} value={c._id}>
                    {c.brandName || c.name || c.companyName || c._id}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Drawer>

      {/* ── Edit Project Modal ── */}
      <Modal
        title={`Edit Project: ${editRecord?.domain || ''}`}
        open={isEditDrawerVisible}
        onCancel={() => setIsEditDrawerVisible(false)}
        centered
        width={480}
        footer={
          <Space>
            <Button onClick={() => setIsEditDrawerVisible(false)} style={{ borderRadius: 8 }}>Cancel</Button>
            <Button type="primary" onClick={() => editForm.submit()} loading={isUpdating} style={{ borderRadius: 8 }}>Save Changes</Button>
          </Space>
        }
      >
        <Form layout="vertical" form={editForm} onFinish={(values) => handleEdit(null, values)} style={{ marginTop: 16 }}>
          <Form.Item name="domain" label="Domain URL" rules={[{ required: true, message: 'Please enter a domain' }]}>
            <Input placeholder="e.g. example.com" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="searchEngines" label="Target Search Engines">
            <Select mode="multiple" size="large" style={{ borderRadius: 8 }}>
              <Select.Option value="google">Google</Select.Option>
              <Select.Option value="bing">Bing</Select.Option>
              <Select.Option value="yahoo">Yahoo</Select.Option>
            </Select>
          </Form.Item>
          {clients.length > 0 && (
            <Form.Item name="clientId" label="Assign to Client">
              <Select size="large" placeholder="Select a client..." allowClear showSearch optionFilterProp="children" style={{ borderRadius: 8 }}>
                {clients.map(c => (
                  <Select.Option key={c._id} value={c._id}>
                    {c.brandName || c.name || c.companyName || c._id}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

const SeoIntelligence = () => {
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isEditDrawerVisible, setIsEditDrawerVisible] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { data: projectsData, isLoading: isLoadingProjects, refetch: refetchProjects } = useGetSeoProjectsQuery();
  const { data: statsData, isLoading: isLoadingStats } = useGetDashboardStatsQuery();
  const { data: integrationData } = useTestIntegrationQuery();
  const { data: creditsData } = useGetApiCreditUsageQuery();
  const { data: clientsData } = useGetClientsQuery();
  
  const [createProject, { isLoading: isCreating }] = useCreateSeoProjectMutation();
  const [updateProject, { isLoading: isUpdating }] = useUpdateSeoProjectMutation();
  const [deleteProject] = useDeleteSeoProjectMutation();

  const projects = projectsData?.data || [];
  const stats = statsData?.data || { totalProjects: 0, totalKeywords: 0, averageAuditScore: 0, totalRankingsInTop10: 0, keywordTrend: [], trafficTrend: [] };
  const isConfigured = integrationData?.isConfigured;
  const credits = creditsData?.data || { limit: 100000, used: 0, remaining: 100000 };
  const clients = clientsData?.data || clientsData?.brands || [];

  const handleCreateProject = async (values) => {
    try {
      const payload = {
        name: values.domain, // Managing completely by URL, but backend requires a 'name' field
        domain: values.domain,
        searchEngines: values.searchEngines || ['google'],
        ...(values.clientId ? { clientId: values.clientId } : {}),
      };
      const result = await createProject(payload);
      if (result?.data?.success) {
        message.success('Project created successfully!');
        setIsDrawerVisible(false);
        form.resetFields();
        refetchProjects();
      } else {
        message.error(result?.data?.message || result?.error?.response?.data?.message || 'Failed to create project');
      }
    } catch (error) {
      message.error('Failed to create project');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteProject(id);
      message.success('Project deleted');
      refetchProjects();
    } catch (error) {
      message.error('Failed to delete project');
    }
  };

  // Opens the edit drawer pre-populated with existing project data
  // When called with (record, null) — opens drawer.
  // When called with (null, values) — submits the form.
  const handleEdit = async (record, values) => {
    if (record) {
      // Open drawer and pre-fill
      setEditRecord(record);
      editForm.setFieldsValue({
        domain: record.domain,
        searchEngines: record.searchEngines || ['google'],
        clientId: record.clientId?._id || record.clientId || undefined,
      });
      setIsEditDrawerVisible(true);
    } else if (values && editRecord) {
      // Submit update
      try {
        const payload = {
          id: editRecord._id,
          name: values.domain,
          domain: values.domain,
          searchEngines: values.searchEngines || ['google'],
          ...(values.clientId ? { clientId: values.clientId } : {}),
        };
        const result = await updateProject(payload);
        if (result?.data?.success) {
          message.success('Project updated successfully!');
          setIsEditDrawerVisible(false);
          editForm.resetFields();
          setEditRecord(null);
          refetchProjects();
        } else {
          message.error(result?.data?.message || 'Failed to update project');
        }
      } catch (error) {
        message.error('Failed to update project');
      }
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

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      
      <motion.div variants={itemVariants} style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ margin: '0 0 4px 0', fontWeight: 800 }}>SEO Intelligence</Title>
          <Text type="secondary" style={{ fontSize: 15 }}>Comprehensive SEO and marketing performance dashboard.</Text>
        </div>
        
        <Space direction="vertical" align="end">
          <Space>
            <Tag icon={<Database size={14} />} color={isConfigured ? 'success' : 'warning'} style={{ borderRadius: 12, padding: '4px 12px', border: 0, fontWeight: 500 }}>
              API: {isConfigured ? 'Connected' : 'Mock Mode'}
            </Tag>
            {activeTab === 'overview' && (
              <Button type="primary" icon={<Plus size={16} />} style={{ borderRadius: 8, fontWeight: 600, height: 38 }} onClick={() => setIsDrawerVisible(true)}>
                New Project
              </Button>
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {isConfigured ? `API Credits Balance: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: credits.currency || 'USD' }).format(credits.remaining || 0)}` : 'API: No credentials configured'}
          </Text>
        </Space>
      </motion.div>

      <Spin spinning={isLoadingStats || isLoadingProjects}>
        <Tabs 
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'overview',
              label: 'Overview & Reports',
              children: <DashboardTab 
                projects={projects} 
                stats={stats} 
                handleDelete={handleDelete}
                handleEdit={handleEdit}
                handleCreateProject={handleCreateProject}
                isCreating={isCreating}
                isDrawerVisible={isDrawerVisible}
                setIsDrawerVisible={setIsDrawerVisible}
                form={form}
                clients={clients}
                isEditDrawerVisible={isEditDrawerVisible}
                setIsEditDrawerVisible={setIsEditDrawerVisible}
                editRecord={editRecord}
                editForm={editForm}
                isUpdating={isUpdating}
              />
            },
            {
              key: 'keywords',
              label: 'Keyword Intelligence',
              children: <KeywordIntelligenceTab 
                projects={projects} 
                isLoadingProjects={isLoadingProjects} 
                refetchProjects={refetchProjects} 
              />
            },
            {
              key: 'overview-score',
              label: 'Domain Authority',
              children: <DomainOverviewTab projects={projects} />
            },
            {
              key: 'audits',
              label: 'Site Audits',
              children: <SiteAuditTab projects={projects} refetchProjects={refetchProjects} />
            },
            {
              key: 'backlinks',
              label: 'Backlink Analysis',
              children: <BacklinkTab projects={projects} />
            },
            {
              key: 'geo',
              label: 'Local/Geo Insights',
              children: <GeoInsightsTab projects={projects} />
            }
          ]} 
        />
      </Spin>
    </motion.div>
  );
};

export default SeoIntelligence;
