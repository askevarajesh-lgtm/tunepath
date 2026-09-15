import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Table, Tag, Button, Dropdown, Space, Spin, message } from 'antd';
import { motion } from 'framer-motion';
import { Download, FileText, BarChart2, Calendar, MoreVertical, Eye, FileOutput } from 'lucide-react';
import BubbleCard from '../../../components/BubbleCard';
import MonthlyHighlightsCard from '../components/MonthlyHighlightsCard';
import { useAuth } from '../../../contexts/AuthContext';
import { getClientMonthlyReportsList } from '../../../api/reportApi';
import { generateMonthlyHighlightsPDF } from '../../../utils/monthlyHighlightsPdfGenerator';

const { Title, Text } = Typography;

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ReportsTab = () => {
  const { user } = useAuth();
  const clientId = user?._id;
  const clientName = user?.companyName || user?.name || 'Client';
  const [refreshKey, setRefreshKey] = useState(0);
  const [realReports, setRealReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const fetchReportsList = async () => {
    if (!clientId) return;
    try {
      setLoadingReports(true);
      const res = await getClientMonthlyReportsList(clientId);
      setRealReports(res || []);
    } catch (err) {
      console.error('Failed to load published client reports list:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchReportsList();
  }, [clientId, refreshKey]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const reportsThisMonthCount = realReports.filter(r => r.month === currentMonth && r.year === currentYear).length;
  const totalPublishedCount = realReports.length;

  const handleDownloadSinglePdf = (record) => {
    try {
      generateMonthlyHighlightsPDF(record, { companyName: clientName });
      message.success('PDF report downloaded successfully');
    } catch (err) {
      console.error('Error generating PDF:', err);
      message.error('Failed to generate PDF');
    }
  };

  const columns = [
    {
      title: 'REPORT NAME',
      dataIndex: 'month',
      key: 'name',
      render: (_, record) => {
        const title = `Highlights of the Month - ${monthNames[record.month - 1]} ${record.year}`;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'var(--bg-tertiary)', borderRadius: 8, color: 'var(--accent-primary)' }}>
              <FileText size={16} />
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{title}</strong>
              <Text type="secondary" style={{ fontSize: 12 }}>Status: {record.status || 'Published'}</Text>
            </div>
          </div>
        );
      }
    },
    {
      title: 'CATEGORY',
      dataIndex: 'category',
      key: 'category',
      render: () => (
        <Tag style={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)' }}>
          Monthly Summary
        </Tag>
      )
    },
    {
      title: 'FREQUENCY',
      dataIndex: 'frequency',
      key: 'frequency',
      render: () => (
        <Tag color="blue" style={{ borderRadius: 12, border: 'none', background: 'rgba(59, 130, 246, 0.1)', color: 'rgb(59, 130, 246)' }}>
          Monthly
        </Tag>
      )
    },
    {
      title: 'GENERATED ON',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      render: (text, record) => {
        const dateVal = text || record.updatedAt;
        return (
          <Space>
            <Calendar size={14} color="var(--text-secondary)" />
            <Text type="secondary" style={{ fontWeight: 500 }}>
              {dateVal ? new Date(dateVal).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Published'}
            </Text>
          </Space>
        );
      }
    },
    {
      title: 'ACTIONS',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button 
            type="default" 
            size="small" 
            icon={<Download size={14} />} 
            onClick={() => handleDownloadSinglePdf(record)}
            style={{ fontWeight: 600, borderRadius: 6, color: 'var(--text-secondary)' }}
          >
            PDF
          </Button>
        </Space>
      )
    }
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >
      <motion.div variants={itemVariants} style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Workspace Reports</Title>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>Access, view, and download all published reports for your brand.</Text>
        </div>
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
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginTop: 4 }}>
                  {reportsThisMonthCount}
                </div>
              </div>
            </BubbleCard>
          </Col>
          <Col xs={24} md={8}>
            <BubbleCard bodyStyle={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: 16, borderRadius: 12, color: 'rgb(59, 130, 246)' }}>
                <BarChart2 size={24} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>TOTAL PUBLISHED REPORTS</Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginTop: 4 }}>
                  {totalPublishedCount}
                </div>
              </div>
            </BubbleCard>
          </Col>
          <Col xs={24} md={8}>
            <BubbleCard bodyStyle={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: 16, borderRadius: 12, color: 'var(--accent-warning)' }}>
                <Download size={24} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>TOTAL REPORTS GENERATED</Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginTop: 4 }}>
                  {totalPublishedCount}
                </div>
              </div>
            </BubbleCard>
          </Col>
        </Row>
      </motion.div>

      {/* MONTHLY HIGHLIGHTS (3.1 REPORT) */}
      <motion.div variants={itemVariants}>
        <MonthlyHighlightsCard key={refreshKey} clientId={clientId} clientName={clientName} />
      </motion.div>

      {/* Reports Table */}
      <motion.div variants={itemVariants}>
        <Card 
          title={<span style={{ fontWeight: 800, fontSize: 18 }}>Published Reports History</span>}
          className="glassmorphism"
          style={{ borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}
          headStyle={{ borderBottom: '1px solid var(--border-color)', padding: '20px 24px' }}
          bodyStyle={{ padding: 0 }}
        >
          <Table 
            loading={loadingReports}
            columns={columns} 
            dataSource={realReports} 
            pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }} 
            rowKey="_id"
            locale={{
              emptyText: (
                <div style={{ padding: '30px 0', textAlign: 'center' }}>
                  <FileText size={28} color="var(--text-tertiary)" style={{ marginBottom: 8 }} />
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No published reports history</div>
                  <Text type="secondary" style={{ fontSize: 13 }}>Click "Create / Edit Monthly Highlights" above to publish your monthly summary report.</Text>
                </div>
              )
            }}
          />
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default ReportsTab;


