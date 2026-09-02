import React from 'react';
import { Typography, Row, Col, Card, Table, Tag, Button, Dropdown, Space } from 'antd';
import { motion } from 'framer-motion';
import { Download, FileText, BarChart2, Calendar, MoreVertical, Eye, FileOutput } from 'lucide-react';
import BubbleCard from '../../../components/BubbleCard';

const { Title, Text } = Typography;

const ReportsTab = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  // Mock Data specifically for the logged-in Brand
  const reports = [
    { id: 1, name: 'Q1 Marketing Performance', type: 'Comprehensive', frequency: 'Quarterly', lastGenerated: '2026-04-01', size: '2.4 MB' },
    { id: 2, name: 'Monthly SEO Overview', type: 'SEO', frequency: 'Monthly', lastGenerated: '2026-06-01', size: '1.1 MB' },
    { id: 3, name: 'Weekly Ad Spend Analysis', type: 'Paid Ads', frequency: 'Weekly', lastGenerated: '2026-06-20', size: '0.8 MB' },
    { id: 4, name: 'Social Media Engagement', type: 'Social', frequency: 'Monthly', lastGenerated: '2026-06-01', size: '3.2 MB' },
    { id: 5, name: 'Website Traffic Insights', type: 'Analytics', frequency: 'Monthly', lastGenerated: '2026-05-01', size: '1.5 MB' },
  ];

  const getActionMenu = (record) => [
    { key: 'view', icon: <Eye size={16} />, label: 'View Online' },
    { key: 'download', icon: <Download size={16} />, label: 'Download PDF' },
  ];

  const columns = [
    {
      title: 'REPORT NAME',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 8, background: 'var(--bg-tertiary)', borderRadius: 8, color: 'var(--accent-primary)' }}>
            <FileText size={16} />
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{text}</strong>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.size}</Text>
          </div>
        </div>
      )
    },
    {
      title: 'CATEGORY',
      dataIndex: 'type',
      key: 'type',
      render: text => (
        <Tag style={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)' }}>
          {text}
        </Tag>
      )
    },
    {
      title: 'FREQUENCY',
      dataIndex: 'frequency',
      key: 'frequency',
      render: text => (
        <Tag color="blue" style={{ borderRadius: 12, border: 'none', background: 'rgba(59, 130, 246, 0.1)', color: 'rgb(59, 130, 246)' }}>
          {text}
        </Tag>
      )
    },
    {
      title: 'GENERATED ON',
      dataIndex: 'lastGenerated',
      key: 'lastGenerated',
      render: text => (
        <Space>
          <Calendar size={14} color="var(--text-secondary)" />
          <Text type="secondary" style={{ fontWeight: 500 }}>{new Date(text).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </Space>
      )
    },
    {
      title: 'ACTIONS',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button type="default" size="small" icon={<Download size={14} />} style={{ fontWeight: 600, borderRadius: 6, color: 'var(--text-secondary)' }}>PDF</Button>
          <Dropdown menu={{ items: getActionMenu(record) }} trigger={['click']} placement="bottomRight">
            <Button type="text" icon={<MoreVertical size={16} />} />
          </Dropdown>
        </Space>
      )
    }
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >
      <motion.div variants={itemVariants} style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Workspace Reports</Title>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>Access, view, and download all automated reports for your brand.</Text>
        </div>
        <Button type="primary" icon={<FileOutput size={16} />} style={{ borderRadius: 8, background: 'var(--accent-primary)', fontWeight: 600 }}>
          Generate Custom Report
        </Button>
      </motion.div>

      {/* Overview Stats */}
      <motion.div variants={itemVariants}>
        <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
          <Col xs={24} md={8}>
            <BubbleCard bodyStyle={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 16, borderRadius: 12, color: 'var(--accent-secondary)' }}>
                <FileText size={24} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>REPORTS THIS MONTH</Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginTop: 4 }}>12</div>
              </div>
            </BubbleCard>
          </Col>
          <Col xs={24} md={8}>
            <BubbleCard bodyStyle={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: 16, borderRadius: 12, color: 'rgb(59, 130, 246)' }}>
                <BarChart2 size={24} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>ACTIVE DASHBOARDS</Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginTop: 4 }}>4</div>
              </div>
            </BubbleCard>
          </Col>
          <Col xs={24} md={8}>
            <BubbleCard bodyStyle={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: 16, borderRadius: 12, color: 'var(--accent-warning)' }}>
                <Download size={24} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>TOTAL DOWNLOADS</Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginTop: 4 }}>48</div>
              </div>
            </BubbleCard>
          </Col>
        </Row>
      </motion.div>

      {/* Reports Table */}
      <motion.div variants={itemVariants}>
        <Card 
          title={<span style={{ fontWeight: 800, fontSize: 18 }}>Generated Reports</span>}
          className="glassmorphism"
          style={{ borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}
          headStyle={{ borderBottom: '1px solid var(--border-color)', padding: '20px 24px' }}
          bodyStyle={{ padding: 0 }}
        >
          <Table 
            columns={columns} 
            dataSource={reports} 
            pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }} 
             
            rowKey="id"
          />
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default ReportsTab;
