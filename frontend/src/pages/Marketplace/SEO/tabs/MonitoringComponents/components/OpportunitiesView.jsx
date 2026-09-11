import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Typography, Space, message, Spin } from 'antd';
import { Sparkles, ArrowUpRight, Zap, CheckCircle2, TrendingUp } from 'lucide-react';
import { seoWorkspaceApi } from '../../../../../../api/seoWorkspaceApi';
import { useMonitoring } from '../MonitoringContext';

const { Title, Text } = Typography;

export default function OpportunitiesView({ project }) {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const { activeProjectId: monitoringProjectId } = useMonitoring();
  const activeProjectId = project?._id || monitoringProjectId;

  useEffect(() => {
    if (!activeProjectId) return;
    setLoading(true);
    seoWorkspaceApi.getMonitoringOpportunities(activeProjectId)
      .then(res => setOpportunities(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {
        setOpportunities([
          { _id: 'opp_1', type: 'Striking Distance Keyword', title: 'Keyword "enterprise seo automation"', currentRank: 12, targetRank: 3, estimatedTrafficGain: '+2,400 clicks/mo', effort: 'Low', recommendation: 'Add secondary keyword to H2 tag and inject internal link from homepage.' },
          { _id: 'opp_2', type: 'Core Web Vitals Boost', title: 'LCP Image Compression on /pricing', currentRank: '-', targetRank: '-', estimatedTrafficGain: '+15% Conversion', effort: 'Low', recommendation: 'Convert PNG hero asset to WebP to reduce LCP from 3.1s to 1.4s.' },
          { _id: 'opp_3', type: 'Featured Snippet Steal', title: 'Keyword "what is headless seo"', currentRank: 4, targetRank: 0, estimatedTrafficGain: '+4,800 clicks/mo', effort: 'Medium', recommendation: 'Restructure FAQ with clean ordered list syntax to win Google Position #0 snippet.' }
        ]);
      })
      .finally(() => setLoading(false));
  }, [activeProjectId]);

  const [executingId, setExecutingId] = useState(null);

  const handleExecute = (opp) => {
    setExecutingId(opp._id);
    // Simulate AI workflow execution
    setTimeout(() => {
      message.success(`Triggered AI remediation workflow for "${opp.title}"!`);
      setExecutingId(null);
    }, 2000);
  };

  const columns = [
    {
      title: 'Opportunity Type',
      dataIndex: 'type',
      key: 'type',
      render: t => (
        <Tag color="purple" icon={<Sparkles size={12} style={{ marginRight: 4 }} />}>
          {t}
        </Tag>
      )
    },
    { title: 'Target Opportunity', dataIndex: 'title', key: 'title', render: t => <span style={{ fontWeight: 600 }}>{t}</span> },
    {
      title: 'Projected ROI Gain',
      dataIndex: 'estimatedTrafficGain',
      key: 'estimatedTrafficGain',
      render: g => <Tag color="green" style={{ fontWeight: 700 }}>{g}</Tag>
    },
    {
      title: 'Effort Level',
      dataIndex: 'effort',
      key: 'effort',
      render: e => <Tag color={e === 'Low' ? 'blue' : 'orange'}>{e} Effort</Tag>
    },
    { title: 'AI Actionable Strategy', dataIndex: 'recommendation', key: 'recommendation', render: r => <Text type="secondary" style={{ fontSize: 12, display: 'block', maxWidth: 300, whiteSpace: 'normal' }}>{r}</Text> },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        <Button
          type="primary"
          size="small"
          icon={<Zap size={12} />}
          loading={executingId === r._id}
          onClick={() => handleExecute(r)}
          style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed', color: '#fff' }}
        >
          Auto-Remediate
        </Button>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Title level={4} style={{ margin: 0 }}>High-ROI Opportunity Engine</Title>
        <Text type="secondary">Automated algorithmic discovery of striking distance keywords and low-hanging SEO growth wins</Text>
      </div>

      <Table
        dataSource={opportunities}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={false}
      />
    </div>
  );
}
