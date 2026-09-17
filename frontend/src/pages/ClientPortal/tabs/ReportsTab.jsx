import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Tag, Button, Space, Spin, message, Modal } from 'antd';
import { motion } from 'framer-motion';
import { Download, FileText, BarChart2, Calendar, Eye, Sparkles, CheckCircle2 } from 'lucide-react';
import dayjs from 'dayjs';
import BubbleCard from '../../../components/BubbleCard';
import MonthlyHighlightsCard from '../components/MonthlyHighlightsCard';
import { useAuth } from '../../../contexts/AuthContext';
import { getClientMonthlyReportsList } from '../../../api/reportApi';
import { generateMonthlyHighlightsPDF } from '../../../utils/monthlyHighlightsPdfGenerator';
import { exportToCSV } from '../../../utils/exportUtils';

const { Title, Text } = Typography;

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ReportsTab = () => {
  const { user } = useAuth();
  const clientId = user?._id;
  const clientName = user?.companyName || user?.name || 'Client';
  const [realReports, setRealReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedReportForPreview, setSelectedReportForPreview] = useState(null);

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
  }, [clientId]);

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
  const latestReport = realReports.length > 0 ? realReports[0] : null;
  const reportsThisMonthCount = realReports.filter(r => r.month === currentMonth && r.year === currentYear).length;
  const totalPublishedCount = realReports.length;

  const handleDownloadPdf = (report) => {
    if (!report) return;
    try {
      generateMonthlyHighlightsPDF(report, { companyName: clientName });
      message.success(`PDF report downloaded for ${monthNames[(report.month || 1) - 1]} ${report.year}`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      message.error('Failed to generate PDF report');
    }
  };

  const handleDownloadCsv = (report) => {
    if (!report) return;
    try {
      const overviewCols = [
        { title: 'Month', dataIndex: 'month' },
        { title: 'Keywords Ranking Top 10', dataIndex: 'top10' },
        { title: 'Keywords Ranking Top 20', dataIndex: 'top20' },
        { title: 'Keywords Ranking Top 30 Above', dataIndex: 'top30Above' }
      ];
      exportToCSV(report.keywordRankingOverview || [], overviewCols, `Keyword_Ranking_Overview_${monthNames[(report.month || 1) - 1]}_${report.year}.csv`);

      if (report.keywordRankingDetails && report.keywordRankingDetails.length > 0) {
        const detailRows = report.keywordRankingDetails.map(kd => {
          const row = {
            Keyword: kd.keyword,
            Category: kd.category,
            Volume: kd.volume
          };
          if (kd.monthRanks && Array.isArray(kd.monthRanks)) {
            kd.monthRanks.forEach(mr => {
              row[mr.month] = mr.rank;
            });
          }
          return row;
        });
        const detailCols = [
          { title: 'Keyword', dataIndex: 'Keyword' },
          { title: 'Category', dataIndex: 'Category' },
          { title: 'Volume', dataIndex: 'Volume' },
          ...(report.keywordRankingDetails[0]?.monthRanks || []).map(mr => ({ title: mr.month, dataIndex: mr.month }))
        ];
        exportToCSV(detailRows, detailCols, `Keyword_Ranking_Details_${monthNames[(report.month || 1) - 1]}_${report.year}.csv`);
      }

      if (report.metaInsightsFacebook && report.metaInsightsFacebook.length > 0) {
        const metaCols = [
          { title: 'Month', dataIndex: 'month' },
          { title: 'Facebook Views', dataIndex: 'views' },
          { title: 'Facebook Reach', dataIndex: 'reach' },
          { title: 'Facebook Followers', dataIndex: 'followers' }
        ];
        exportToCSV(report.metaInsightsFacebook, metaCols, `Meta_Insights_Facebook_${monthNames[(report.month || 1) - 1]}_${report.year}.csv`);
      }

      message.success('Report CSV downloaded successfully');
    } catch (err) {
      console.error('Error generating CSV:', err);
      message.error('Failed to export CSV');
    }
  };

  const handleOpenPreview = (report) => {
    setSelectedReportForPreview(report);
    setPreviewModalVisible(true);
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      {/* Page Header */}
      <motion.div variants={itemVariants} style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Workspace Reports</Title>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>Access and download official monthly performance reports published by your agency manager.</Text>
        </div>
        {latestReport && (
          <Button
            type="primary"
            size="large"
            icon={<Download size={18} />}
            onClick={() => handleDownloadPdf(latestReport)}
            style={{ borderRadius: 12, background: 'var(--accent-primary)', fontWeight: 700, padding: '0 24px', height: 44 }}
          >
            Download Latest Report ({monthNames[latestReport.month - 1]} {latestReport.year})
          </Button>
        )}
      </motion.div>

      {/* Overview Stats Cards */}
      <motion.div variants={itemVariants}>
        <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
          <Col xs={24} md={8}>
            <BubbleCard bodyStyle={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 16, borderRadius: 12, color: 'var(--accent-secondary)' }}>
                <FileText size={24} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>PUBLISHED THIS MONTH</Text>
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
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>LATEST REPORT PERIOD</Text>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginTop: 8 }}>
                  {latestReport ? `${monthNames[latestReport.month - 1]} ${latestReport.year}` : 'No Reports Yet'}
                </div>
              </div>
            </BubbleCard>
          </Col>
        </Row>
      </motion.div>

      {/* Featured / Hero Download Banner */}
      {latestReport && (
        <motion.div variants={itemVariants} style={{ marginBottom: 36 }}>
          <Card
            className="glassmorphism"
            style={{
              borderRadius: 20,
              border: '1px solid var(--border-color)',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              overflow: 'hidden'
            }}
            bodyStyle={{ padding: 28 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
              <div style={{ maxWidth: 680 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Tag color="success" style={{ borderRadius: 12, border: 'none', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700, padding: '4px 12px' }}>
                    <CheckCircle2 size={13} style={{ marginRight: 4, display: 'inline' }} /> Official Monthly Report
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 13, fontWeight: 600 }}>
                    Published on {latestReport.publishedAt ? new Date(latestReport.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}
                  </Text>
                </div>

                <Title level={3} style={{ margin: '0 0 10px 0', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {monthNames[latestReport.month - 1]} {latestReport.year} — Performance & Highlights Report
                </Title>
                <Text type="secondary" style={{ fontSize: 14, lineHeight: 1.6, display: 'block', marginBottom: 20 }}>
                  Management-level digital performance summary including deliverable highlights, organic keyword rankings, social media insights, and Google Analytics traffic metrics.
                </Text>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(latestReport.publishedReportTypes && latestReport.publishedReportTypes.length > 0
                    ? latestReport.publishedReportTypes
                    : ['Highlights of the Month', 'Keywords', 'Social Media', 'Website Traffic']
                  ).map((t, idx) => (
                    <Tag key={idx} color="blue" style={{ borderRadius: 12, padding: '3px 12px', fontWeight: 600, border: 'none', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                      <Sparkles size={11} style={{ marginRight: 4, display: 'inline' }} /> {t}
                    </Tag>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 200 }}>
                <Button
                  type="primary"
                  size="large"
                  icon={<Download size={16} />}
                  onClick={() => handleDownloadPdf(latestReport)}
                  style={{ borderRadius: 10, background: 'var(--accent-primary)', fontWeight: 700, height: 46 }}
                >
                  Download PDF Report
                </Button>
                <Button
                  size="large"
                  icon={<Download size={16} />}
                  onClick={() => handleDownloadCsv(latestReport)}
                  style={{ borderRadius: 10, fontWeight: 600, height: 44 }}
                >
                  Download CSV Data
                </Button>
                <Button
                  type="text"
                  icon={<Eye size={16} />}
                  onClick={() => handleOpenPreview(latestReport)}
                  style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
                >
                  View Online Summary
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Reports Grid Cards */}
      <motion.div variants={itemVariants}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Title level={4} style={{ margin: 0, fontWeight: 800 }}>Available Reports Archive</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>Total {totalPublishedCount} published report(s)</Text>
        </div>

        <Spin spinning={loadingReports}>
          {realReports.length > 0 ? (
            <Row gutter={[24, 24]}>
              {realReports.map((report) => {
                const monthName = monthNames[report.month - 1];
                const pubDate = report.publishedAt ? new Date(report.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Published';
                const publishedTypes = report.publishedReportTypes && report.publishedReportTypes.length > 0
                  ? report.publishedReportTypes
                  : ['Highlights of the Month'];

                return (
                  <Col xs={24} sm={12} lg={8} key={report._id || `${report.month}-${report.year}`}>
                    <Card
                      className="hover-card glassmorphism"
                      style={{
                        borderRadius: 16,
                        border: '1px solid var(--border-color)',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'all 0.3s ease',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justify: 'space-between'
                      }}
                      bodyStyle={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                            <FileText size={22} />
                          </div>
                          <Tag color="success" style={{ borderRadius: 12, border: 'none', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 600 }}>
                            Published
                          </Tag>
                        </div>

                        <Title level={4} style={{ margin: '0 0 4px 0', fontWeight: 800 }}>
                          {monthName} {report.year}
                        </Title>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
                          <Calendar size={12} style={{ marginRight: 4, display: 'inline' }} />
                          Published on {pubDate}
                        </Text>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                          {publishedTypes.map((t, idx) => (
                            <Tag key={idx} style={{ borderRadius: 12, fontSize: 11, fontWeight: 600, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                              {t}
                            </Tag>
                          ))}
                        </div>
                      </div>

                      <div style={{ paddingTop: 16, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Button
                          type="primary"
                          icon={<Download size={14} />}
                          onClick={() => handleDownloadPdf(report)}
                          style={{ flex: 1, borderRadius: 8, background: 'var(--accent-primary)', fontWeight: 600 }}
                        >
                          PDF
                        </Button>
                        <Button
                          icon={<Download size={14} />}
                          onClick={() => handleDownloadCsv(report)}
                          style={{ borderRadius: 8, fontWeight: 600 }}
                        >
                          CSV
                        </Button>
                        <Button
                          icon={<Eye size={14} />}
                          onClick={() => handleOpenPreview(report)}
                          style={{ borderRadius: 8, fontWeight: 600 }}
                        >
                          Preview
                        </Button>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          ) : (
            <Card
              className="glassmorphism"
              style={{ borderRadius: 16, border: '1px solid var(--border-color)', textAlign: 'center', padding: '48px 24px' }}
            >
              <FileText size={40} color="var(--text-tertiary)" style={{ marginBottom: 16 }} />
              <Title level={4} style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>No Published Reports Available</Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                There are no published monthly reports available for your account yet. When your agency manager sends a report, it will appear here for download.
              </Text>
            </Card>
          )}
        </Spin>
      </motion.div>

      {/* Online Preview Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 32 }}>
            <span style={{ fontWeight: 800, fontSize: 18 }}>
              Report Preview — {selectedReportForPreview ? `${monthNames[(selectedReportForPreview.month || 1) - 1]} ${selectedReportForPreview.year}` : ''}
            </span>
            {selectedReportForPreview && (
              <Space>
                <Button icon={<Download size={14} />} onClick={() => handleDownloadCsv(selectedReportForPreview)} style={{ borderRadius: 8, fontWeight: 600 }}>
                  Download CSV
                </Button>
                <Button type="primary" icon={<Download size={14} />} onClick={() => handleDownloadPdf(selectedReportForPreview)} style={{ borderRadius: 8, background: 'var(--accent-primary)', fontWeight: 600 }}>
                  Export PDF
                </Button>
              </Space>
            )}
          </div>
        }
        open={previewModalVisible}
        visible={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={null}
        width={1050}
        style={{ top: 20 }}
        bodyStyle={{ padding: 24, maxHeight: '82vh', overflowY: 'auto' }}
      >
        {selectedReportForPreview && (
          <MonthlyHighlightsCard
            clientId={clientId}
            clientName={clientName}
            initialDate={dayjs(`${selectedReportForPreview.year}-${String(selectedReportForPreview.month).padStart(2, '0')}-01`)}
          />
        )}
      </Modal>
    </motion.div>
  );
};

export default ReportsTab;
