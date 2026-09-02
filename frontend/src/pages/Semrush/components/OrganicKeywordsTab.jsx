import React, { useState, useEffect } from 'react';
import { Button, Typography, Table, Tag, Progress, Tooltip, message } from 'antd';
import { semrushApi } from '../../../api/semrushApi';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { BarChart2, ArrowUp, ArrowDown, Minus, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import SnapshotSelector from './SnapshotSelector';
import './DashboardTab.css'; 

const { Title, Text } = Typography;

const OrganicKeywordsTab = () => {
  const { project, projectData, fetchProjectData } = useOutletContext();
  const domain = project?.domain || 'this domain';

  const [localData, setLocalData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const data = localData || projectData?.organicKeywords || [];

  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState(false);

  const handleSnapshotSelect = async (snapshotId) => {
    if (snapshotId === 'latest') {
      setLocalData(projectData?.organicKeywords || []);
      setSnapshotError(false);
      return;
    }
    
    setSnapshotLoading(true);
    setSnapshotError(false);
    try {
      const res = await semrushApi.getSnapshotById(project._id, snapshotId);
      if (res.data.success && res.data.data) {
        const organicKeywordsData = res.data.data.organicKeywords;
        if (!organicKeywordsData || organicKeywordsData.length === 0) {
          setSnapshotError(true);
        } else {
          setLocalData(organicKeywordsData);
        }
      }
    } catch (err) {
      console.error(err);
      setSnapshotError(true);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!project?._id) return;
    setRefreshing(true);
    try {
      const res = await semrushApi.getOrganicResearch(project._id, true);
      if (res.data.success && res.data.data) {
        setLocalData(res.data.data.organicKeywordsData || []);
        message.success('Organic Research updated successfully');
        if (fetchProjectData) fetchProjectData();
      } else {
        message.error(res.data.errorCode || 'Failed to refresh Organic Research');
      }
    } catch (err) {
      message.error('An error occurred during refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = () => {
    try {
      if (!data || data.length === 0) {
        message.warning('No organic keywords data available to export.');
        return;
      }

      // Map data for Excel
      const exportData = data.map(row => ({
        'Keyword': row.keyword || '-',
        'Position': row.position || '-',
        'Previous Position': row.previousPosition || '-',
        'Search Volume': row.searchVolume || 0,
        'Traffic %': Number(row.trafficPercent || 0).toFixed(2) + '%',
        'Keyword Difficulty %': row.difficulty || 0,
        'CPC (USD)': row.cpc || 0,
        'URL': row.url || '-'
      }));

      // Create workbook
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Organic Keywords');

      // Export
      const filename = `${domain?.replace(/\./g, '_') || 'project'}_Organic_Keywords.xlsx`;
      XLSX.writeFile(workbook, filename);
      
      message.success('Organic Keywords report exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      message.error('Failed to export organic keywords report.');
    }
  };

  const columns = [
    { 
      title: 'Keyword', 
      dataIndex: 'keyword', 
      key: 'keyword', 
      render: val => <Text strong style={{ fontSize: 14 }}>{val}</Text>,
      sorter: (a, b) => a.keyword.localeCompare(b.keyword)
    },
    {
      title: 'SERP',
      dataIndex: 'serpFeatures',
      key: 'serpFeatures',
      render: val => {
        if (!val) return null;
        const features = String(val).split(',').map(Number);
        const featureMap = {
          0: { label: 'Instant Answer', icon: '⚡', color: '#fadb14' },
          1: { label: 'Knowledge Panel', icon: '🧠', color: '#13c2c2' },
          2: { label: 'Carousel', icon: '🎠', color: 'var(--accent-info)' },
          3: { label: 'Local Pack', icon: '📍', color: '#eb2f96' },
          4: { label: 'Top Stories', icon: '📰', color: 'var(--accent-primary)' },
          5: { label: 'Images', icon: '🖼️', color: 'var(--accent-success)' },
          6: { label: 'Sitelinks', icon: '🔗', color: '#fa8c16' },
          7: { label: 'Reviews', icon: '⭐', color: 'var(--accent-warning)' },
          9: { label: 'Video', icon: '🎥', color: '#f5222d' },
          10: { label: 'Featured Snippet', icon: '👑', color: '#a0d911' },
          13: { label: 'Shopping', icon: '🛍️', color: 'var(--accent-primary)' }
        };
        const rendered = features.map(f => featureMap[f]).filter(Boolean).slice(0, 3);
        if (rendered.length === 0) return null;
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            {rendered.map((f, i) => (
              <Tooltip key={i} title={f.label}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: `${f.color}20`, border: `1px solid ${f.color}40`, fontSize: 11 }}>
                  {f.icon}
                </div>
              </Tooltip>
            ))}
            {features.length > 3 && (
              <Tooltip title={`${features.length - 3} more`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'var(--border-color)', border: '1px solid #d9d9d9', fontSize: 10, color: 'var(--text-secondary)' }}>
                  +{features.length - 3}
                </div>
              </Tooltip>
            )}
          </div>
        );
      }
    },
    { 
      title: 'Position', 
      dataIndex: 'position', 
      key: 'position', 
      render: (val, record) => {
        const pos = Number(val);
        const prevPos = Number(record.previousPosition);
        let diff = 0;
        if (prevPos > 0 && prevPos !== pos) diff = prevPos - pos;

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color={pos <= 3 ? 'green' : pos <= 10 ? 'blue' : 'default'} style={{ margin: 0, fontWeight: 600, minWidth: 28, textAlign: 'center' }}>
              {pos}
            </Tag>
            <div style={{ minWidth: 40 }}>
              {diff > 0 && <span style={{ color: 'var(--accent-success)', display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 500 }}><ArrowUp size={14} style={{ marginRight: 2 }} /> {diff}</span>}
              {diff < 0 && <span style={{ color: '#ff4d4f', display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 500 }}><ArrowDown size={14} style={{ marginRight: 2 }} /> {Math.abs(diff)}</span>}
              {diff === 0 && prevPos > 0 && <span style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', fontSize: 12 }}><Minus size={14} style={{ marginRight: 2 }} /></span>}
              {prevPos === 0 && <span style={{ color: 'var(--accent-success)', fontSize: 10, fontWeight: 600, background: '#f6ffed', padding: '2px 4px', borderRadius: 4 }}>NEW</span>}
            </div>
          </div>
        );
      },
      sorter: (a, b) => Number(a.position) - Number(b.position)
    },
    { 
      title: 'Intent', 
      dataIndex: 'intent', 
      key: 'intent', 
      render: val => {
        if (val === undefined || val === null || val === '') return '-';
        const intents = String(val).split(',').map(Number);
        const intentMap = {
          0: { label: 'C', color: 'var(--accent-warning)', bg: '#fffbe6', title: 'Commercial' },
          1: { label: 'I', color: 'var(--accent-primary)', bg: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)', title: 'Informational' },
          2: { label: 'N', color: 'var(--accent-info)', bg: '#f9f0ff', title: 'Navigational' },
          3: { label: 'T', color: 'var(--accent-success)', bg: '#f6ffed', title: 'Transactional' }
        };
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            {intents.map((i, idx) => {
              const intent = intentMap[i];
              if (!intent) return null;
              return (
                <Tooltip key={idx} title={intent.title}>
                  <div style={{ background: intent.bg, color: intent.color, border: `1px solid ${intent.color}40`, fontSize: 11, fontWeight: '700', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, cursor: 'help' }}>
                    {intent.label}
                  </div>
                </Tooltip>
              );
            })}
          </div>
        );
      }
    },
    { 
      title: 'Volume', 
      dataIndex: 'searchVolume', 
      key: 'searchVolume', 
      align: 'right',
      render: val => <Text strong style={{ color: 'var(--text-secondary)' }}>{Number(val).toLocaleString()}</Text>,
      sorter: (a, b) => Number(a.searchVolume) - Number(b.searchVolume)
    },
    { 
      title: 'Traffic %', 
      dataIndex: 'trafficPercent', 
      key: 'trafficPercent', 
      align: 'right',
      render: val => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 60 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{Number(val).toFixed(2)}%</span>
          <Progress percent={Number(val)} showInfo={false} size="small" strokeColor="var(--accent-primary)" trailColor="var(--border-color)" style={{ margin: 0, width: '100%' }} />
        </div>
      ),
      sorter: (a, b) => Number(a.trafficPercent) - Number(b.trafficPercent)
    },
    { 
      title: 'KD %', 
      dataIndex: 'difficulty', 
      key: 'difficulty', 
      align: 'center',
      render: val => {
        const kd = Number(val);
        const getColor = (v) => {
          if (v > 84) return { color: '#cf1322', bg: '#fff1f0', border: '#ffa39e' }; // Very hard
          if (v > 69) return { color: '#d46b08', bg: '#fff7e6', border: '#ffd591' }; // Hard
          if (v > 49) return { color: '#d4b106', bg: '#fffbe6', border: '#ffe58f' }; // Possible
          if (v > 29) return { color: '#7cb305', bg: '#fcffe6', border: '#eaff8f' }; // Easy
          return { color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f' }; // Very easy
        };
        const style = getColor(kd);
        return (
          <Tooltip title={`${kd}% Keyword Difficulty`}>
             <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 26, borderRadius: 13, background: style.bg, color: style.color, border: `1px solid ${style.border}`, fontWeight: 700, fontSize: 12, cursor: 'help' }}>
               {kd}
             </div>
          </Tooltip>
        );
      },
      sorter: (a, b) => Number(a.difficulty) - Number(b.difficulty)
    },
    { 
      title: 'CPC (USD)', 
      dataIndex: 'cpc', 
      key: 'cpc', 
      align: 'right',
      render: val => <Text type="secondary">${Number(val).toFixed(2)}</Text>,
      sorter: (a, b) => Number(a.cpc) - Number(b.cpc)
    },
    { 
      title: 'URL', 
      dataIndex: 'url', 
      key: 'url', 
      align: 'center',
      render: val => (
        <Tooltip title={val}>
          <a href={val} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#bae0ff'} onMouseOut={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-primary) 15%, transparent)'}>
            <ExternalLink size={14} />
          </a>
        </Tooltip>
      )
    }
  ];

  return (
    <div className="semrush-dashboard-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Organic Keywords for <span style={{ color: 'var(--accent-info)' }}>{domain}</span></Title>
          <Text type="secondary">Displaying the top keywords driving traffic to this domain.</Text>
        </div>
        
        <SnapshotSelector 
          projectId={project?._id} 
          tabKey="organic-research" 
          onSnapshotSelect={handleSnapshotSelect} 
        />
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button 
            type="primary" 
            icon={<ReloadOutlined spin={refreshing} />} 
            onClick={handleRefresh} 
            loading={refreshing}
            style={{ borderRadius: 8, fontWeight: 600, background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} style={{ borderRadius: 8, fontWeight: 600 }}>
            Export
          </Button>
        </div>
      </div>
      
      {snapshotError ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Text type="secondary">Historical data not available for this snapshot.</Text>
        </div>
      ) : snapshotLoading ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Text type="secondary">Loading historical data...</Text>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {data && data.length > 0 ? (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="semrush-chart-card" style={{ padding: '0', overflow: 'hidden' }}>
              <Table 
                dataSource={data}
                columns={columns}
                rowKey="key"
                loading={refreshing}
                pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'], showSizeChanger: true, showTotal: (total) => `Total ${total} keywords` }}
                size="middle"
                style={{ margin: 0 }}
                rowClassName="semrush-table-row"
              />
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="semrush-empty-state"
          >
            <BarChart2 style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16, width: 48, height: 48 }} />
            <Title level={4} style={{ color: 'var(--text-tertiary)', margin: 0 }}>No Organic Keywords Data Available</Title>
            <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>Click the 'Refresh Data' button below to fetch the latest insights.</Text>
            <Button 
              type="primary" 
              icon={<ReloadOutlined spin={refreshing} />} 
              onClick={handleRefresh} 
                style={{ borderRadius: 8, fontWeight: 600, background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
              >
                {refreshing ? 'Refreshing...' : 'Refresh Data'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default OrganicKeywordsTab;
