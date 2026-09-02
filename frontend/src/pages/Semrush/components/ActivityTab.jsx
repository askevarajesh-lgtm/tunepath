import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Statistic, Table, Tag, Skeleton, message, Alert, Space, Divider, Select, Button } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { useOutletContext } from 'react-router-dom';
import { semrushApi } from '../../../api/semrushApi';

const { Title, Text } = Typography;
const { Option } = Select;

const ActivityTab = () => {
  const { project } = useOutletContext();
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  
  const [fromId, setFromId] = useState(null);
  const [toId, setToId] = useState(null);
  
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState(null);
  const [dateError, setDateError] = useState(null);

  useEffect(() => {
    if (project?._id) {
      fetchSnapshots();
    }
  }, [project?._id]);

  const fetchSnapshots = async () => {
    setLoadingInitial(true);
    setError(null);
    try {
      const res = await semrushApi.getActivitySnapshots(project._id);
      if (res.data.success) {
        const snaps = res.data.snapshots || [];
        setSnapshots(snaps);
        
        if (snaps.length >= 2) {
          // snaps are sorted newest to oldest
          setToId(snaps[0]._id);
          setFromId(snaps[1]._id);
        } else if (snaps.length === 1) {
          setToId(snaps[0]._id);
          setFromId(null);
        }
      } else {
        setError(res.data.message || 'Failed to load snapshots.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred fetching snapshots.');
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    if (fromId && toId) {
      // Validate chronologically
      const fromIndex = snapshots.findIndex(s => s._id === fromId);
      const toIndex = snapshots.findIndex(s => s._id === toId);
      
      // Since snapshots are sorted newest to oldest, smaller index means newer date
      if (toIndex > fromIndex) {
        setDateError('Compare To must be later than Compare From.');
        setComparison(null);
      } else if (toIndex === fromIndex) {
        setDateError('Please select two different dates.');
        setComparison(null);
      } else {
        setDateError(null);
        fetchComparison(fromId, toId);
      }
    }
  }, [fromId, toId, snapshots]);

  const fetchComparison = async (from, to) => {
    setLoadingComparison(true);
    setError(null);
    try {
      const res = await semrushApi.getActivityComparison(project._id, { from, to });
      if (res.data.success) {
        setComparison(res.data.data);
      } else {
        setError(res.data.message || 'Failed to load activity comparison.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred fetching the comparison.');
    } finally {
      setLoadingComparison(false);
    }
  };

  if (loadingInitial) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  if (error) {
    return <Alert message="Error" description={error} type="error" showIcon style={{ marginBottom: 24 }} />;
  }

  if (snapshots.length === 0) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="No Intelligence snapshots available."
          description="Wait for your first intelligence snapshot to be generated."
          type="info"
          showIcon
        />
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };



  const renderScoreCard = (title, item) => {
    let color = 'var(--text-secondary)';
    let prefix = <MinusOutlined />;
    let bgColor = 'var(--bg-primary)';
    let accentColor = '#d9d9d9'; // Default gray
    let tagColor = 'default';
    let tagText = 'Unchanged';
    
    if (item?.status === 'improved') {
      color = 'var(--accent-secondary)';
      prefix = <ArrowUpOutlined />;
      bgColor = 'linear-gradient(145deg, rgba(56, 203, 137, 0.1) 0%, var(--bg-primary) 100%)';
      accentColor = 'var(--accent-secondary)';
      tagColor = 'success';
      tagText = 'Improved';
    } else if (item?.status === 'regression') {
      color = '#ff4d4f';
      prefix = <ArrowDownOutlined />;
      bgColor = 'linear-gradient(145deg, rgba(255, 77, 79, 0.1) 0%, var(--bg-primary) 100%)';
      accentColor = '#ff4d4f';
      tagColor = 'error';
      tagText = 'Declined';
    } else if (item?.status === 'unchanged') {
       color = 'var(--text-secondary)';
       bgColor = 'linear-gradient(145deg, rgba(140, 140, 140, 0.05) 0%, var(--bg-primary) 100%)';
       accentColor = '#d9d9d9';
    }

    const value = item?.curr !== null && item?.curr !== undefined ? item.curr : 'N/A';
    const prevValue = item?.prev !== null && item?.prev !== undefined ? item.prev : 'N/A';

    return (
      <Card 
        bordered={false} 
        bodyStyle={{ padding: '20px 24px' }}
        style={{ 
          borderRadius: 16, 
          height: '100%', 
          background: bgColor,
          boxShadow: '0 4px 12px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.02)',
          borderTop: `4px solid ${accentColor}`,
          position: 'relative',
          overflow: 'hidden',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        hoverable
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</Text>
          <Tag color={tagColor} style={{ margin: 0, borderRadius: 12, fontWeight: 500, padding: '0 8px' }}>{tagText}</Tag>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
            {value}
          </span>
          {item?.delta !== undefined && item?.delta !== 0 && (
            <span style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              {prefix} {Math.abs(item.delta)}
            </span>
          )}
          {item?.delta === 0 && item?.status === 'unchanged' && value !== 'N/A' && (
             <span style={{ fontSize: 14, fontWeight: 600, color }}>
               <MinusOutlined /> 0
             </span>
          )}
        </div>

        <div style={{ 
          paddingTop: 12, 
          borderTop: '1px dashed rgba(0,0,0,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Previous: <strong style={{ color: 'var(--text-primary)' }}>{prevValue}</strong>
          </Text>
        </div>
      </Card>
    );
  };

  const renderSummaryCard = (title, value, type) => {
    let color = 'var(--text-tertiary)';
    let prefix = <MinusOutlined />;
    let bgColor = 'var(--bg-primary)';
    let accentColor = '#d9d9d9'; // Default gray
    let iconBg = 'rgba(140, 140, 140, 0.1)';
    
    if (type === 'improvements') {
      color = 'var(--accent-secondary)';
      prefix = <ArrowUpOutlined />;
      bgColor = 'linear-gradient(135deg, rgba(56, 203, 137, 0.1) 0%, var(--bg-primary) 100%)';
      accentColor = 'var(--accent-secondary)';
      iconBg = 'rgba(56, 203, 137, 0.15)';
    } else if (type === 'regressions') {
      color = '#ff4d4f';
      prefix = <ArrowDownOutlined />;
      bgColor = 'linear-gradient(135deg, rgba(255, 77, 79, 0.1) 0%, var(--bg-primary) 100%)';
      accentColor = '#ff4d4f';
      iconBg = 'rgba(255, 77, 79, 0.15)';
    } else if (type === 'unchanged') {
       color = 'var(--text-tertiary)';
       bgColor = 'linear-gradient(135deg, rgba(140, 140, 140, 0.05) 0%, var(--bg-primary) 100%)';
       accentColor = '#d9d9d9';
       iconBg = 'rgba(140, 140, 140, 0.15)';
    }

    return (
      <Card 
        bordered={false} 
        bodyStyle={{ padding: '24px', display: 'flex', flexDirection: 'column' }}
        style={{ 
          borderRadius: 16, 
          height: '100%', 
          background: bgColor,
          boxShadow: '0 4px 12px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.02)',
          borderBottom: `4px solid ${accentColor}`,
          position: 'relative',
          overflow: 'hidden',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        hoverable
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Text style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>
              {title}
            </Text>
            <span style={{ fontSize: 48, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              {value}
            </span>
          </div>
          <div style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 12, 
            background: iconBg,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24
          }}>
            {prefix}
          </div>
        </div>
      </Card>
    );
  };

  const rankColumns = [
    { title: 'Keyword', dataIndex: 'keyword', key: 'keyword' },
    { title: 'Search Volume', dataIndex: 'searchVolume', key: 'searchVolume' },
    { 
      title: 'Previous Rank', 
      dataIndex: 'prevRank', 
      key: 'prevRank',
      render: (val) => val === null ? <Text type="secondary">— Ranking unavailable</Text> : val
    },
    { 
      title: 'Current Rank', 
      dataIndex: 'currRank', 
      key: 'currRank',
      render: (val) => val === null ? <Text type="secondary">— Ranking unavailable</Text> : val
    },
    {
      title: 'Change',
      key: 'change',
      render: (_, record) => {
        if (record.delta > 0) return <Tag color="success"><ArrowUpOutlined /> {record.delta}</Tag>;
        if (record.delta < 0) return <Tag color="error"><ArrowDownOutlined /> {Math.abs(record.delta)}</Tag>;
        return <Tag color="default">New / Lost / Unchanged</Tag>;
      }
    }
  ];

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <Title level={4}>Intelligence Activity</Title>
          <Text type="secondary">Compare historical snapshots over time.</Text>
        </div>
        
        <Card bordered={false} bodyStyle={{ padding: '16px' }} style={{ borderRadius: 12, minWidth: 500 }}>
          <Space align="center" size="large">
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Compare From</div>
              <Select 
                style={{ width: 220 }} 
                value={fromId} 
                onChange={setFromId}
                placeholder="Select older snapshot"
              >
                {snapshots.map(s => (
                  <Option key={s._id} value={s._id}>{formatDate(s.collectedAt)}</Option>
                ))}
              </Select>
            </div>
            
            <ArrowUpOutlined style={{ transform: 'rotate(45deg)', color: 'var(--text-secondary)', marginTop: 20 }} />
            
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Compare To</div>
              <Select 
                style={{ width: 220 }} 
                value={toId} 
                onChange={setToId}
                placeholder="Select newer snapshot"
              >
                {snapshots.map(s => (
                  <Option key={s._id} value={s._id}>{formatDate(s.collectedAt)}</Option>
                ))}
              </Select>
            </div>
          </Space>
        </Card>
      </div>

      {dateError && (
        <Alert message="Invalid Date Selection" description={dateError} type="warning" showIcon style={{ marginBottom: 24 }} />
      )}
      
      {!dateError && snapshots.length === 1 && (
        <Alert
          message="No previous snapshot available for comparison."
          description="We need at least two snapshots to compare activity. Check back after your next intelligence refresh."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {loadingComparison && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Skeleton active paragraph={{ rows: 6 }} />
          <Text type="secondary">Loading snapshot comparison...</Text>
        </div>
      )}

      {!loadingComparison && !dateError && comparison && (
        <>
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <Text type="secondary">
              Comparing<br/>
              <strong style={{ color: 'var(--text-primary)' }}>{formatDate(comparison.dates.previous)}</strong><br/>
              against<br/>
              <strong style={{ color: 'var(--text-primary)' }}>{formatDate(comparison.dates.current)}</strong>
            </Text>
          </div>

          <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
            <Col xs={24} sm={8}>
              {renderSummaryCard('Improvements', comparison.summary.improvements, 'improvements')}
            </Col>
            <Col xs={24} sm={8}>
              {renderSummaryCard('Regressions', comparison.summary.regressions, 'regressions')}
            </Col>
            <Col xs={24} sm={8}>
              {renderSummaryCard('Unchanged Metrics', comparison.summary.unchanged, 'unchanged')}
            </Col>
          </Row>

          <Title level={5}>Overall Scores</Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
            <Col xs={24} sm={12} lg={6}>{renderScoreCard('Overall Score', comparison.scores.overall)}</Col>
            <Col xs={24} sm={12} lg={6}>{renderScoreCard('SEO Score', comparison.scores.seo)}</Col>
            <Col xs={24} sm={12} lg={6}>{renderScoreCard('AEO Score', comparison.scores.aeo)}</Col>
            <Col xs={24} sm={12} lg={6}>{renderScoreCard('GEO Score', comparison.scores.geo)}</Col>
          </Row>

          <Title level={5}>SEO Metrics Change</Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
            <Col xs={24} sm={12} lg={8}>{renderScoreCard('Authority Score', comparison.seo.authorityScore)}</Col>
            <Col xs={24} sm={12} lg={8}>{renderScoreCard('Organic Traffic', comparison.seo.organicTraffic)}</Col>
            <Col xs={24} sm={12} lg={8}>{renderScoreCard('Organic Keywords', comparison.seo.organicKeywords)}</Col>
            <Col xs={24} sm={12} lg={8}>{renderScoreCard('Backlinks', comparison.seo.backlinks)}</Col>
            <Col xs={24} sm={12} lg={8}>{renderScoreCard('Site Health Score', comparison.seo.technicalScore)}</Col>
          </Row>

          {comparison.positionTracking && (comparison.positionTracking.improved.length > 0 || comparison.positionTracking.declined.length > 0 || comparison.positionTracking.new.length > 0 || comparison.positionTracking.unavailable.length > 0) && (
            <>
              <Title level={5}>Rankings Activity (Position Tracking)</Title>
              <Card bordered={false} style={{ borderRadius: 12, marginBottom: 24, padding: 0 }} bodyStyle={{ padding: 0 }}>
                <Table
                  dataSource={[...comparison.positionTracking.improved, ...comparison.positionTracking.declined, ...comparison.positionTracking.new, ...comparison.positionTracking.unavailable]}
                  columns={rankColumns}
                  rowKey="keyword"
                  pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                  size="small"
                />
              </Card>
            </>
          )}

          <Title level={5}>AEO Metrics Change</Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
            {Object.keys(comparison.aeo).length === 0 ? (
              <Col span={24}><Text type="secondary">Not available</Text></Col>
            ) : (
              Object.keys(comparison.aeo).map(key => (
                <Col xs={24} sm={12} lg={6} key={key}>
                  {renderScoreCard(key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), comparison.aeo[key])}
                </Col>
              ))
            )}
          </Row>

          <Title level={5}>GEO Metrics Change</Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
            {Object.keys(comparison.geo).length === 0 ? (
              <Col span={24}><Text type="secondary">Not available</Text></Col>
            ) : (
              Object.keys(comparison.geo).map(key => (
                <Col xs={24} sm={12} lg={6} key={key}>
                  {renderScoreCard(key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), comparison.geo[key])}
                </Col>
              ))
            )}
          </Row>

          {comparison.siteHealth && (comparison.siteHealth.resolved.length > 0 || comparison.siteHealth.new.length > 0) && (
            <>
              <Title level={5}>Technical SEO Issues Activity</Title>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                {comparison.siteHealth.new.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ color: '#ff4d4f' }}>New Issues Detected:</Text>
                    <ul>
                      {comparison.siteHealth.new.map(issue => (
                        <li key={issue.id}>Issue #{issue.id} (+{issue.currCount} pages affected)</li>
                      ))}
                    </ul>
                  </div>
                )}
                {comparison.siteHealth.resolved.length > 0 && (
                  <div>
                    <Text strong style={{ color: 'var(--accent-secondary)' }}>Issues Resolved:</Text>
                    <ul>
                      {comparison.siteHealth.resolved.map(issue => (
                        <li key={issue.id}>Issue #{issue.id} (was {issue.prevCount} pages, now 0)</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}

    </div>
  );
};

export default ActivityTab;
