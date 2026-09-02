import React, { useState, useEffect, useRef } from 'react';
import { Button, Typography, Table, Tag, Progress, Tooltip, Input, Select, Modal, Spin, message, Row, Col, Card, Tabs, Empty } from 'antd';
import { DownloadOutlined, AimOutlined, PlusOutlined, SettingOutlined, ReloadOutlined } from '@ant-design/icons';
import { BarChart2, ArrowUp, ArrowDown, Minus, ExternalLink, Globe, Smartphone, Monitor, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { semrushApi } from '../../../api/semrushApi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import SnapshotSelector from './SnapshotSelector';
import './DashboardTab.css'; // Reuse styles
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const PositionTrackingTab = () => {
  const { project, projectData, fetchProjectData } = useOutletContext();
  const domain = project?.domain;
  const projectId = project?._id;

  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [localData, setLocalData] = useState(null);
  const [localError, setLocalError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const pdfRef = useRef(null);
  
  const isConfigured = project?.trackingConfig?.isActive;
  
  const dataStatus = (projectData?.positionTracking?.errorCode === 'campaign_unavailable' || localError === 'campaign_unavailable')
    ? 'campaign_unavailable' 
    : (isConfigured ? 'available' : 'campaign_required');

  const data = localData || projectData?.positionTracking?.data || null;
  const configStatus = dataStatus === 'campaign_unavailable'
    ? 'campaign_unavailable'
    : (localData ? 'available' : dataStatus);

  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState(false);

  const handleSnapshotSelect = async (snapshotId) => {
    if (snapshotId === 'latest') {
      setLocalData(projectData?.positionTracking?.data || null);
      setSnapshotError(false);
      return;
    }
    
    setSnapshotLoading(true);
    setSnapshotError(false);
    try {
      const res = await semrushApi.getSnapshotById(projectId, snapshotId);
      if (res.data.success && res.data.data) {
        const ptData = res.data.data.positionTracking?.data;
        if (!ptData || Object.keys(ptData).length === 0) {
          setSnapshotError(true);
        } else {
          setLocalData(ptData);
        }
      }
    } catch (err) {
      console.error(err);
      setSnapshotError(true);
    } finally {
      setSnapshotLoading(false);
    }
  };

  useEffect(() => {
    // If tracking is configured but data is entirely missing (e.g. stale snapshot), trigger fetch
    if (isConfigured && !data && !refreshing && configStatus !== 'campaign_unavailable' && !snapshotLoading && !snapshotError) {
      handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigured]);

  const handleRefresh = async () => {
    if (!projectId) return;
    setRefreshing(true);
    setLocalError(null);
    try {
      const res = await semrushApi.getPositionTracking(projectId, true);
      if (res.data.success && res.data.data) {
        setLocalData(res.data.data);
        const hasRankings = res.data.data.rankings && res.data.data.rankings.some(r => r.position != null);
        if (hasRankings) {
          message.success('Rankings updated successfully');
        } else {
          message.info('Rankings are still being gathered by Semrush. Please check back later.');
        }
        if (fetchProjectData) fetchProjectData();
      } else {
        if (res.data.errorCode) {
          setLocalError(res.data.errorCode);
        }
        if (res.data.errorCode !== 'campaign_unavailable') {
          message.error(res.data.errorCode || 'Failed to refresh rankings');
        }
      }
    } catch (err) {
      setLocalError('error');
      message.error('An error occurred during refresh');
    } finally {
      setRefreshing(false);
    }
  };

  // Wizard State
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    device: 'Desktop',
    location: 'us',
    keywordsText: ''
  });

  const handleExportPDF = () => {
    try {
      setGeneratingPdf(true);
      message.loading({ content: 'Generating Tracking Table PDF...', key: 'pdfGen' });
      
      const rankings = data?.rankings || [];
      if (rankings.length === 0) {
        message.warning({ content: 'No tracking data available to export.', key: 'pdfGen', duration: 3 });
        return;
      }

      const pdf = new jsPDF({
        orientation: 'l', // Landscape to fit more columns
        unit: 'mm',
        format: 'a4',
      });
      
      const tableColumn = ["Keyword", "Intent", "SF", "KD %", "Pos. Prev", "Pos.", "Diff", "Vis.", "Est. Traffic", "Volume", "CPC", "URL"];
      const tableRows = [];
      
      rankings.forEach(r => {
        const intentCode = String(r.intent || '').split(',')[0];
        const intentMap = { '0': 'C', '1': 'I', '2': 'N', '3': 'T' };
        
        let diff = '-';
        if (r.position !== null && r.previousPosition !== null && r.position !== '> 100' && r.previousPosition !== '> 100') {
          const pos = Number(r.position);
          const prevPos = Number(r.previousPosition);
          if (prevPos > 0 && prevPos !== pos) {
            const d = prevPos - pos;
            diff = d > 0 ? `+${d}` : `${d}`;
          }
        }
        
        const rowData = [
          r.keyword || '',
          intentMap[intentCode] || '-',
          r.serpFeaturesCount || '-',
          r.difficulty !== null && r.difficulty !== undefined ? String(r.difficulty) : '-',
          r.previousPosition || '-',
          r.position || '-',
          diff,
          r.visibility ? `${Number(r.visibility).toFixed(2)}%` : '0.00%',
          r.traffic ? Number(r.traffic).toLocaleString() : '0',
          r.searchVolume ? Number(r.searchVolume).toLocaleString() : '-',
          r.cpc ? `$${Number(r.cpc).toFixed(2)}` : '-',
          r.url || '-'
        ];
        tableRows.push(rowData);
      });

      // Add a simple header
      pdf.setFontSize(16);
      pdf.text(`Position Tracking for ${domain}`, 14, 15);
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 22);

      autoTable(pdf, {
        head: [tableColumn],
        body: tableRows,
        startY: 28,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [114, 46, 209] }, // Purple color from theme
        alternateRowStyles: { fillColor: [250, 250, 250] },
      });
      
      pdf.save(`${domain?.replace(/\./g, '_') || 'project'}_Position_Tracking.pdf`);
      
      message.success({ content: 'Table exported successfully!', key: 'pdfGen', duration: 3 });
    } catch (error) {
      console.error('PDF Generation failed:', error);
      message.error({ content: 'Failed to export table.', key: 'pdfGen', duration: 3 });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // We no longer fetch on mount, data is provided by context

  const handleStartTracking = async () => {
    const rawKeywords = config.keywordsText.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    if (rawKeywords.length === 0) {
      return message.error('Please enter at least one keyword');
    }
    if (rawKeywords.length > 100) {
      return message.warning('Maximum 100 keywords allowed per campaign. Truncating list.');
    }

    try {
      setSaving(true);
      const res = await semrushApi.configureTracking(projectId, {
        device: config.device,
        location: config.location,
        keywords: rawKeywords
      });
      
      if (res.data.success) {
        message.loading({ content: 'Fetching keyword rankings...', key: 'tracking', duration: 0 });
        setShowWizard(false);
        
        // Immediately fetch live rankings so the table appears right away
        try {
          const rankRes = await semrushApi.getPositionTracking(projectId, true);
          if (rankRes.data.success && rankRes.data.data) {
            setLocalData(rankRes.data.data);
            message.success({ content: 'Rankings loaded!', key: 'tracking', duration: 3 });
          } else {
            // Still dismiss the wizard even if rankings aren't ready yet
            setLocalData({ 
              config: { device: config.device, location: config.location }, 
              rankings: rawKeywords.map(kw => ({ keyword: kw, position: null, searchVolume: null, difficulty: null, cpc: null, intent: '', url: null }))
            });
            message.info({ content: 'Campaign configured. Rankings will update within 24h.', key: 'tracking', duration: 4 });
          }
        } catch (fetchErr) {
          message.warning({ content: 'Configured! Rankings will appear after next refresh.', key: 'tracking', duration: 3 });
        }
        if (fetchProjectData) fetchProjectData();
      }
    } catch (err) {
      message.error('Failed to configure tracking');
    } finally {
      setSaving(false);
    }
  };

  const renderWizard = () => (
    <div style={{ maxWidth: 800, margin: '40px auto', background: 'var(--bg-secondary)', borderRadius: 12, padding: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={3}>New Position Tracking Campaign</Title>
        <Text type="secondary">Set up daily tracking for your most important keywords.</Text>
      </div>
      
      {step === 1 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Title level={5} style={{ marginBottom: 16 }}>1. Targeting</Title>
          <div style={{ background: 'var(--app-shell-bg)', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid var(--border-color)' }}>
            <Globe size={16} style={{ marginRight: 8, color: 'var(--accent-info)' }}/> 
            <strong style={{ color: 'var(--text-primary)' }}>{domain}</strong> <span style={{ color: 'var(--text-tertiary)' }}>as Root domain</span>
          </div>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Text strong>Search engine</Text>
              <div style={{ marginTop: 8 }}>
                <Button type="default" style={{ color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', marginRight: 8, background: 'transparent' }}>Google</Button>
                <Button disabled style={{ background: 'transparent' }}>Bing</Button>
              </div>
            </Col>
            <Col span={12}>
              <Text strong>Device</Text>
              <div style={{ marginTop: 8 }}>
                <Button 
                  type={config.device === 'Desktop' ? 'primary' : 'default'}
                  onClick={() => setConfig({...config, device: 'Desktop'})}
                  icon={<Monitor size={14} />}
                  style={{ marginRight: 8 }}
                >
                  Desktop
                </Button>
                <Button 
                  type={config.device === 'Mobile' ? 'primary' : 'default'}
                  onClick={() => setConfig({...config, device: 'Mobile'})}
                  icon={<Smartphone size={14} />}
                >
                  Mobile
                </Button>
              </div>
            </Col>
          </Row>

          <div style={{ marginBottom: 24 }}>
            <Text strong>Location</Text>
            <div style={{ marginTop: 8 }}>
              <Select 
                value={config.location} 
                onChange={(val) => setConfig({...config, location: val})}
                style={{ width: '100%' }}
              >
                <Option value="us">United States</Option>
                <Option value="uk">United Kingdom</Option>
                <Option value="ca">Canada</Option>
                <Option value="au">Australia</Option>
                <Option value="in">India</Option>
              </Select>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <Button type="primary" onClick={() => setStep(2)}>Continue To Keywords &rarr;</Button>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Title level={5} style={{ marginBottom: 16 }}>2. Keywords</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Enter keywords one per line or separated by commas. (Limit: 100)
          </Text>
          
          <TextArea 
            rows={10} 
            placeholder={`keyword 1\nkeyword 2\nkeyword 3`}
            value={config.keywordsText}
            onChange={(e) => setConfig({...config, keywordsText: e.target.value})}
            style={{ marginBottom: 24, borderRadius: 8 }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button type="link" onClick={() => setStep(1)}>&larr; Back To Targeting</Button>
            <Button type="primary" onClick={handleStartTracking} loading={saving} size="large" style={{ background: 'var(--accent-success)', borderColor: 'var(--accent-success)' }}>
              Start Tracking
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );

  const formatNumber = (val) => val != null ? Number(val).toLocaleString() : '-';

  const columns = [
    { 
      title: 'Keyword', 
      dataIndex: 'keyword', 
      key: 'keyword', 
      render: val => <Text strong style={{ fontSize: 14 }}>{val}</Text>,
      sorter: (a, b) => a.keyword.localeCompare(b.keyword)
    },
    { 
      title: 'Intent', 
      dataIndex: 'intent', 
      key: 'intent', 
      render: val => {
        if (!val) return '-';
        const intentCode = String(val).split(',')[0];
        const intentMap = {
          '0': { label: 'C', color: 'var(--accent-warning)', bg: '#fffbe6', title: 'Commercial' },
          '1': { label: 'I', color: 'var(--accent-primary)', bg: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)', title: 'Informational' },
          '2': { label: 'N', color: 'var(--accent-info)', bg: '#f9f0ff', title: 'Navigational' },
          '3': { label: 'T', color: 'var(--accent-success)', bg: '#f6ffed', title: 'Transactional' }
        };
        const intent = intentMap[intentCode];
        if (!intent) return '-';
        return (
          <Tooltip title={intent.title}>
            <div style={{ background: intent.bg, color: intent.color, border: `1px solid ${intent.color}40`, fontSize: 11, fontWeight: '700', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, cursor: 'help' }}>
              {intent.label}
            </div>
          </Tooltip>
        );
      }
    },
    { 
      title: 'SF', 
      dataIndex: 'serpFeaturesCount', 
      key: 'sf', 
      align: 'center',
      render: val => <Text type="secondary" style={{ fontSize: 12 }}>{val || '-'}</Text>,
      sorter: (a, b) => (Number(a.serpFeaturesCount) || 0) - (Number(b.serpFeaturesCount) || 0)
    },
    { 
      title: 'KD %', 
      dataIndex: 'difficulty', 
      key: 'difficulty', 
      align: 'center',
      render: val => {
        const kd = Number(val);
        if (!val && val !== 0) return '-';
        const getColor = (v) => {
          if (v > 84) return { color: '#cf1322', bg: '#fff1f0', border: '#ffa39e' }; 
          if (v > 69) return { color: '#d46b08', bg: '#fff7e6', border: '#ffd591' }; 
          if (v > 49) return { color: '#d4b106', bg: '#fffbe6', border: '#ffe58f' }; 
          if (v > 29) return { color: '#7cb305', bg: '#fcffe6', border: '#eaff8f' }; 
          return { color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f' };
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
      title: 'Pos. Prev', 
      dataIndex: 'previousPosition', 
      key: 'previousPosition', 
      render: (val) => val == null ? <Text type="secondary">Unavailable</Text> : (val === '> 100' ? <Text type="secondary">{val}</Text> : <Text>{val}</Text>),
      sorter: (a, b) => (a.previousPosition == null ? 101 : (a.previousPosition === '> 100' ? 101 : Number(a.previousPosition))) - (b.previousPosition == null ? 101 : (b.previousPosition === '> 100' ? 101 : Number(b.previousPosition)))
    },
    { 
      title: 'Pos.', 
      dataIndex: 'position', 
      key: 'position', 
      render: (val) => val == null ? <Text type="secondary">Unavailable</Text> : (val === '> 100' ? <Text type="secondary">{val}</Text> : <Text strong>{val}</Text>),
      sorter: (a, b) => (a.position == null ? 101 : (a.position === '> 100' ? 101 : Number(a.position))) - (b.position == null ? 101 : (b.position === '> 100' ? 101 : Number(b.position)))
    },
    {
      title: 'Diff',
      key: 'diff',
      align: 'center',
      render: (_, record) => {
        if (record.position == null || record.previousPosition == null) return <Text type="secondary">Unavailable</Text>;
        const pos = Number(record.position);
        const prevPos = Number(record.previousPosition);
        let diff = 0;
        if (prevPos > 0 && prevPos !== pos && prevPos < 101 && pos < 101) diff = prevPos - pos;

        if (diff > 0) return <span style={{ color: 'var(--accent-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500 }}><ArrowUp size={14} style={{ marginRight: 2 }} /> {diff}</span>;
        if (diff < 0) return <span style={{ color: '#ff4d4f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500 }}><ArrowDown size={14} style={{ marginRight: 2 }} /> {Math.abs(diff)}</span>;
        return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
      }
    },
    { title: 'Vis.', dataIndex: 'visibility', key: 'visibility', render: val => val == null ? <Text type="secondary">Unavailable</Text> : `${Number(val).toFixed(2)}%`, sorter: (a, b) => (a.visibility || 0) - (b.visibility || 0) },
    { title: 'Est. Traffic', dataIndex: 'traffic', key: 'traffic', render: val => val == null ? <Text type="secondary">Unavailable</Text> : formatNumber(val), sorter: (a, b) => (a.traffic || 0) - (b.traffic || 0) },
    { 
      title: 'Volume', 
      dataIndex: 'searchVolume', 
      key: 'searchVolume', 
      align: 'right',
      render: val => <Text strong style={{ color: 'var(--text-secondary)' }}>{val != null ? Number(val).toLocaleString() : '-'}</Text>,
      sorter: (a, b) => Number(a.searchVolume) - Number(b.searchVolume)
    },
    { 
      title: 'CPC', 
      dataIndex: 'cpc', 
      key: 'cpc', 
      align: 'right',
      render: val => val ? <Text type="secondary">${Number(val).toFixed(2)}</Text> : <Text type="secondary">-</Text>,
      sorter: (a, b) => Number(a.cpc) - Number(b.cpc)
    },
    { 
      title: 'URL', 
      dataIndex: 'url', 
      key: 'url', 
      align: 'center',
      render: val => val && val !== '-' && val !== null ? <a href={val.startsWith('http') ? val : `https://${val}`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{new URL(val.startsWith('http') ? val : `https://${val}`).pathname || val}</a> : <Text type="secondary">-</Text>
    }
  ];

  if (configStatus === 'not_configured' && !showWizard) {
    return (
      <Card style={{ margin: 24, padding: 40 }}>
        <Empty description="Position Tracking — Provider not configured" />
      </Card>
    );
  }

  if (configStatus === 'campaign_unavailable' && !showWizard) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', background: '#fafafa', borderRadius: 8, border: '1px dashed #d9d9d9', margin: 24 }}>
        <Empty 
          description={
            <span>
              Position Tracking campaign is unavailable or has expired.
            </span>
          }
        >
          <Button 
            type="primary" 
            onClick={() => {
              setConfig({ device: 'Desktop', location: 'us', keywordsText: '' });
              setStep(1);
              setShowWizard(true);
            }}
          >
            Set Up New Campaign
          </Button>
        </Empty>
      </div>
    );
  }

  // Only show wizard if explicitly requested OR if no tracking has been configured at all
  if (showWizard || !isConfigured) {
    return renderWizard();
  }

  if (!data) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Spin size="large" tip="Loading position tracking data..." />
      </div>
    );
  }

  // Show loading state while rankings are being fetched after campaign setup
  if (refreshing && !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
        <Spin size="large" />
        <Text type="secondary">Fetching keyword rankings...</Text>
      </div>
    );
  }

  const rankings = data?.rankings || [];
  const top3 = rankings.filter(r => Number(r.position) > 0 && Number(r.position) <= 3).length;
  const top10 = rankings.filter(r => Number(r.position) > 0 && Number(r.position) <= 10).length;
  const top100 = rankings.filter(r => Number(r.position) > 0 && Number(r.position) <= 100).length;

  // Process data for the 3 bottom Tracking
  const trackedRankings = rankings.filter(r => r.position && r.position !== '> 100');
  
  const topKeywords = [...trackedRankings]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .slice(0, 5);

  const positiveImpact = [...rankings]
    .filter(r => r.visibilityDiff > 0)
    .sort((a, b) => b.visibilityDiff - a.visibilityDiff)
    .slice(0, 5);

  const negativeImpact = [...rankings]
    .filter(r => r.visibilityDiff < 0)
    .sort((a, b) => a.visibilityDiff - b.visibilityDiff)
    .slice(0, 5);

  return (
    <div className="semrush-dashboard-container">
      <AnimatePresence mode="wait">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <Title level={3} style={{ margin: 0 }}>Position Tracking for <span style={{ color: 'var(--accent-info)' }}>{domain}</span></Title>
              <Text type="secondary">
                <Globe size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}/> {data?.config?.location?.toUpperCase()} | 
                <Monitor size={14} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 4px 0 8px' }}/> {data?.config?.device}
              </Text>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button 
                type="primary" 
                icon={<ReloadOutlined spin={refreshing} />} 
                onClick={handleRefresh} 
                loading={refreshing}
                style={{ borderRadius: 8, fontWeight: 600, background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
              >
                {refreshing ? 'Refreshing...' : 'Refresh Rankings'}
              </Button>
              <Button icon={<SettingOutlined />} onClick={() => {
                 // Open configure modal or just reset config
                 setConfig({ ...config, keywordsText: rankings.map(r => r.keyword).join('\n')});
                 setStep(2);
                 setShowWizard(true);
              }}>
                Settings
              </Button>
              <Button 
                icon={<DownloadOutlined />} 
                onClick={handleExportPDF} 
                loading={generatingPdf}
                style={{ borderRadius: 8, fontWeight: 600 }}
              >
                Export
              </Button>
            </div>
          </div>

          <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 24 }}>
            <Tabs.TabPane tab="Dashboard" key="dashboard" />
            <Tabs.TabPane tab="Tracking" key="Tracking" />
          </Tabs>

          {activeTab === 'dashboard' && (
            <>
              <Row gutter={24} style={{ marginBottom: 24 }}>
                <Col span={8}>
                  <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', borderTop: '4px solid var(--accent-info)' }}>
                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 600 }}>Visibility</Text>
                    <Title level={2} style={{ margin: '8px 0 0 0', color: 'var(--text-primary)' }}>
                      {data?.overview?.visibility ? Number(data.overview.visibility).toFixed(2) : '0.00'}%
                    </Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 600 }}>Est. Traffic</Text>
                    <Title level={2} style={{ margin: '8px 0 0 0', color: 'var(--text-primary)' }}>
                      {data?.overview?.traffic ? Number(data.overview.traffic).toLocaleString() : '0'}
                    </Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 600 }}>Avg. Position</Text>
                    <Title level={2} style={{ margin: '8px 0 0 0', color: 'var(--text-primary)' }}>
                      {data?.overview?.avgPosition ? Number(data.overview.avgPosition).toFixed(2) : '0.00'}
                    </Title>
                  </Card>
                </Col>
              </Row>

              {data?.trend && data.trend.length > 0 && (
                <div className="semrush-chart-card" style={{ padding: 24, marginBottom: 24, background: 'var(--bg-secondary)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                     <div style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--accent-info)', marginRight: 8 }} />
                     <Text strong>{domain}</Text>
                  </div>
                  <div style={{ height: 300, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.trend} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} 
                          axisLine={{ stroke: 'var(--border-color)' }} 
                          tickLine={false} 
                          tickFormatter={(val) => {
                            const d = new Date(val);
                            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          }}
                        />
                        <YAxis 
                          tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} 
                          axisLine={false} 
                          tickLine={false} 
                          tickFormatter={(val) => `${val}%`}
                        />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Visibility']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="visibility" 
                          stroke="var(--accent-info)" 
                          strokeWidth={3} 
                          dot={{ r: 4, fill: 'var(--accent-info)', strokeWidth: 0 }} 
                          activeDot={{ r: 6, fill: 'var(--accent-info)', stroke: '#fff', strokeWidth: 2 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Summary Tracking */}
              <Row gutter={24} style={{ marginTop: 24, marginBottom: 24 }}>
            <Col span={8}>
              <Card title={<Text strong>Top Keywords</Text>} bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', height: '100%' }}>
                <Table 
                  dataSource={topKeywords}
                  rowKey="keyword"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: 'Keyword', dataIndex: 'keyword', key: 'keyword', render: (text) => <Text style={{ color: 'var(--accent-primary)' }}>{text}</Text> },
                    { title: 'Pos.', dataIndex: 'position', key: 'position', render: (text, record) => (
                      <span>
                        {text}
                        {record.diff1 > 0 && <span style={{ color: 'var(--accent-success)', marginLeft: 4, fontSize: 12 }}>↑ {record.diff1}</span>}
                        {record.diff1 < 0 && <span style={{ color: '#ff4d4f', marginLeft: 4, fontSize: 12 }}>↓ {Math.abs(record.diff1)}</span>}
                      </span>
                    )},
                    { title: 'Visibility', dataIndex: 'visibility', key: 'visibility', align: 'right', render: (val) => val ? `${Number(val).toFixed(2)}%` : '-' }
                  ]}
                />
              </Card>
            </Col>
            
            <Col span={8}>
              <Card title={<div style={{ display: 'flex', justifyContent: 'space-between' }}><Text strong>Positive Impact</Text></div>} bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', height: '100%' }}>
                <Table 
                  dataSource={positiveImpact}
                  rowKey="keyword"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: 'Keyword', dataIndex: 'keyword', key: 'keyword', render: (text) => <Text style={{ color: 'var(--accent-primary)' }}>{text}</Text> },
                    { title: 'Visibility gain', dataIndex: 'visibilityDiff', key: 'visibilityDiff', align: 'right', render: (val) => <Text style={{ color: 'var(--accent-success)' }}>+{Number(val).toFixed(2)}%</Text> }
                  ]}
                />
              </Card>
            </Col>
            
            <Col span={8}>
              <Card title={<div style={{ display: 'flex', justifyContent: 'space-between' }}><Text strong>Negative Impact</Text></div>} bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', height: '100%' }}>
                <Table 
                  dataSource={negativeImpact}
                  rowKey="keyword"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: 'Keyword', dataIndex: 'keyword', key: 'keyword', render: (text) => <Text style={{ color: 'var(--accent-primary)' }}>{text}</Text> },
                    { title: 'Visibility loss', dataIndex: 'visibilityDiff', key: 'visibilityDiff', align: 'right', render: (val) => <Text style={{ color: '#ff4d4f' }}>{Number(val).toFixed(2)}%</Text> }
                  ]}
                />
              </Card>
            </Col>
          </Row>
            </>
          )}

          {activeTab === 'Tracking' && (
            <div className="semrush-chart-card" style={{ padding: '0', overflow: 'hidden' }}>
              <Table 
                dataSource={rankings}
                columns={columns}
                rowKey="keyword"
                pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'], showSizeChanger: true, showTotal: (total) => `Total ${total} keywords` }}
                size="middle"
                style={{ margin: 0 }}
                rowClassName="semrush-table-row"
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PositionTrackingTab;
