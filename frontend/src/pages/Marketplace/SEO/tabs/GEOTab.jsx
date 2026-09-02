import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Progress, Tag, Space, Empty, Tooltip, Table, Spin, Badge, Alert, Statistic } from 'antd';
import { Globe2, Info, ArrowUpRight, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSEO } from '../context/SEOContext';
import { seoWorkspaceApi } from '../../../../api/seoWorkspaceApi';
import ProjectSelector from '../components/shared/ProjectSelector';
import AgentFindingsCard from '../components/shared/AgentFindingsCard';

const { Title, Text } = Typography;

const scoreColor = (score) => (score >= 90 ? '#52c41a' : score >= 70 ? '#1890ff' : score >= 50 ? '#faad14' : '#f5222d');
const scoreTagColor = (score) => (score >= 90 ? 'success' : score >= 70 ? 'processing' : score >= 50 ? 'warning' : 'error');

const GEOTab = () => {
  const { activeProjectId: projectId, activeProject } = useSEO();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState([]);
  const [pagesTotal, setPagesTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [technicalData, setTechnicalData] = useState(null);

  // Fetch detailed modular data lazily when a doc is loaded
  useEffect(() => {
    if (doc?._id) {
      fetchPages(1);
      fetchTechnical();
    } else {
      setPages([]);
      setTechnicalData(null);
    }
  }, [doc?._id]);

  const fetchPages = async (page) => {
    try {
      setLoading(true);
      const res = await seoWorkspaceApi.getGeoAuditPages(projectId, doc._id, page, 5);
      if (res && res.success) {
        setPages(res.data || []);
        setPagesTotal(res.pagination?.total || 0);
        setCurrentPage(page);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTechnical = async () => {
    try {
      const res = await seoWorkspaceApi.getGeoAuditTechnical(projectId, doc._id);
      if (res && res.success) setTechnicalData(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const overallScore = doc?.overallGeoScore ?? doc?.agent?.entityConsistencyScore ?? null;
  const healthLevel = doc?.healthLevel || (overallScore >= 90 ? 'excellent' : overallScore >= 70 ? 'good' : overallScore >= 50 ? 'fair' : 'poor');
  const breakdown = doc?.scoreBreakdown || {};

  const columns = [
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (p) => {
        const color = p === 'critical' ? 'red' : p === 'high' ? 'magenta' : p === 'medium' ? 'gold' : 'blue';
        return <Tag color={color}>{p?.toUpperCase() || 'LOW'}</Tag>;
      }
    },
    { title: 'Recommendation', dataIndex: 'title', key: 'title', render: (t) => <Text strong>{t}</Text> },
    { 
      title: 'Description (AI Enhanced)', 
      dataIndex: 'description', 
      key: 'description',
      render: (d, record) => (
        <div>
          <Text>{d}</Text>
          {record.evidence && record.evidence.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Tooltip title={record.evidence.map(e => e.message || e).join(' | ')}>
                <Tag icon={<Info size={12}/>} color="default">View Evidence</Tag>
              </Tooltip>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Page',
      dataIndex: 'page',
      key: 'page',
      render: (u) => (u && u !== 'sitewide') ? (
        <Tooltip title={u}>
          <a href={u} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>Link <ArrowUpRight size={14}/></a>
        </Tooltip>
      ) : <Tag color="purple">Sitewide</Tag>
    }
  ];

  const pageColumns = [
    { title: 'URL', dataIndex: 'url', key: 'url', render: u => <Tooltip title={u}><Text ellipsis style={{maxWidth: 200}}>{u}</Text></Tooltip> },
    { title: 'Schema', dataIndex: 'schemaScore', key: 'schemaScore', render: s => s ? <Tag color={scoreTagColor(s)}>{s}</Tag> : '-' },
    { title: 'Content', dataIndex: 'contentScore', key: 'contentScore', render: s => s ? <Tag color={scoreTagColor(s)}>{s}</Tag> : '-' },
    { title: 'Authority', dataIndex: 'authorityScore', key: 'authorityScore', render: s => s ? <Tag color={scoreTagColor(s)}>{s}</Tag> : '-' },
    { title: 'Evidence', key: 'evidence', render: (_, record) => (
      <Tooltip title={(record.evidence || []).map(e => e.message).join(' | ') || 'No specific evidence'}>
        <Info size={16} color="#1890ff" />
      </Tooltip>
    )}
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Globe2 size={24} color="#fff" />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 900 }}>
              {activeProject ? `${activeProject.name} — GEO Dashboard` : 'GEO Enterprise Dashboard'}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Generative Engine Optimization — deterministic evidence-based scoring and AI-enhanced recommendations.</Text>
          </div>
        </div>
        <ProjectSelector style={{ marginBottom: 0 }} />
      </div>

      {!projectId ? (
        <Empty description="Select or create a Workspace Project to run the GEO Agent" />
      ) : (
        <Row gutter={[16, 16]}>
          {overallScore !== null && (
            <>
              <Col xs={24} lg={6}>
                <Card size="small" title="Overall GEO Health" style={{ height: '100%', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress type="dashboard" percent={overallScore} strokeColor={scoreColor(overallScore)} />
                    <div style={{ marginTop: 8 }}>
                      <Tag color={scoreTagColor(overallScore)} style={{ textTransform: 'uppercase', fontSize: 14, padding: '4px 12px' }}>
                        {healthLevel}
                      </Tag>
                    </div>
                  </div>
                </Card>
              </Col>
              
              {Object.keys(breakdown).length > 0 && (
                <Col xs={24} lg={18}>
                  <Card size="small" title="Score Breakdown & Evidence" style={{ height: '100%', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                    <Row gutter={[16, 16]}>
                      {Object.entries(breakdown).map(([key, data]) => (
                        <Col xs={12} sm={8} md={6} key={key}>
                          <Statistic 
                            title={<span style={{textTransform: 'capitalize'}}>{key}</span>} 
                            value={data.score} 
                            suffix="/ 100" 
                            valueStyle={{ color: scoreColor(data.score) }}
                          />
                          <Tooltip title={`Confidence: ${data.confidence}%`}>
                            <Progress percent={data.confidence} size="small" showInfo={false} strokeColor="var(--border-color)" />
                          </Tooltip>
                        </Col>
                      ))}
                    </Row>
                  </Card>
                </Col>
              )}

              {technicalData && (
                <Col xs={24}>
                  <Card size="small" title="Sitewide Technical Factors" style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
                    <Row gutter={[16,16]}>
                      <Col span={6}>
                        <Statistic title="Robots.txt" value={technicalData.metrics?.hasRobotsTxt ? 'Present' : 'Missing'} prefix={technicalData.metrics?.hasRobotsTxt ? <CheckCircle2 color="green"/> : <XCircle color="red"/>} />
                      </Col>
                      <Col span={6}>
                        <Statistic title="Sitemap.xml" value={technicalData.metrics?.hasSitemapXml ? 'Present' : 'Missing'} prefix={technicalData.metrics?.hasSitemapXml ? <CheckCircle2 color="green"/> : <XCircle color="red"/>} />
                      </Col>
                      <Col span={6}>
                        <Statistic title="Broken Canonicals" value={technicalData.metrics?.brokenCanonicalCount || 0} valueStyle={{ color: technicalData.metrics?.brokenCanonicalCount > 0 ? '#f5222d' : '#52c41a' }} />
                      </Col>
                      <Col span={6}>
                        <Statistic title="Non-Indexable Pages" value={technicalData.metrics?.nonIndexableCount || 0} valueStyle={{ color: technicalData.metrics?.nonIndexableCount > 0 ? '#faad14' : '#52c41a' }} />
                      </Col>
                    </Row>
                  </Card>
                </Col>
              )}

              {pages.length > 0 && (
                <Col xs={24}>
                  <Card size="small" title="Page-Level Analysis (Lazy Loaded)" style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}>
                    <Table 
                      dataSource={pages} 
                      columns={pageColumns} 
                      rowKey="_id"
                      size="small"
                      pagination={{
                        current: currentPage,
                        total: pagesTotal,
                        defaultPageSize: 5, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
                        onChange: fetchPages
                      }}
                      loading={loading}
                    />
                  </Card>
                </Col>
              )}
            </>
          )}

          <Col xs={24}>
            <AgentFindingsCard
              title="Recommendation Center"
              runLabel="Run Enterprise GEO Audit"
              emptyHint="Run the GEO engine to process deterministic scoring and AI-enhanced interpretation."
              findingsKey="recommendations"
              columns={columns}
              doc={doc}
              onDocChange={setDoc}
              onRun={() => seoWorkspaceApi.runGeoAgent(projectId)}
              onApprove={(auditId) => seoWorkspaceApi.approveGeoRecommendations(projectId, auditId)}
              onReject={(auditId, reason) => seoWorkspaceApi.rejectGeoRecommendations(projectId, auditId, reason)}
              onLoadHistory={() => seoWorkspaceApi.getGeoAgentHistory(projectId)}
            />
          </Col>
        </Row>
      )}
    </motion.div>
  );
};

export default GEOTab;