import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Radio, Button, Input, Checkbox, Tabs, Typography, Form, message, Spin, Space, Card, Divider } from 'antd';
import { Download, Mail, FileText, Eye, CheckCircle2, Send, Sparkles } from 'lucide-react';
import dayjs from 'dayjs';
import { generateAnalyticsPdf, downloadAnalyticsPdf, getAnalyticsPdfDataUrl, getAnalyticsPdfBlob } from '../utils/pdfExport';
import { exportDetailedReportAsCsv } from '../utils/csvExport';
import { analyticsApi } from '../../../api/analyticsApi';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const ReportExportModal = ({
  open,
  onClose,
  data,
  projectInfo,
  dateRange
}) => {
  const [exportFormat, setExportFormat] = useState('pdf');
  const [activeTab, setActiveTab] = useState('customize');
  const [sendingEmail, setSendingEmail] = useState(false);

  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [executiveSummary, setExecutiveSummary] = useState('');

  const [selectedSections, setSelectedSections] = useState({
    kpis: true,
    pages: true,
    queries: true
  });

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);

  useEffect(() => {
    if (projectInfo) {
      const projName = projectInfo.name || projectInfo.domain || 'Client';
      const rangeText = dateRange ? `${dayjs(dateRange[0]).format('MMM D')} - ${dayjs(dateRange[1]).format('MMM D, YYYY')}` : '';
      setEmailSubject(`Google Analytics & SEO Performance Report - ${projName} (${rangeText})`);
    }
  }, [projectInfo, dateRange]);

  // Generate live preview URL when modal opens or custom inputs change
  useEffect(() => {
    if (open && data && exportFormat === 'pdf') {
      try {
        const url = getAnalyticsPdfDataUrl({
          data,
          projectInfo,
          dateRange,
          executiveSummary,
          selectedSections
        });
        setPdfPreviewUrl(url);
      } catch (err) {
        console.error('Failed to generate PDF preview:', err);
      }
    }
  }, [open, data, projectInfo, dateRange, executiveSummary, selectedSections, exportFormat]);

  const handleDownload = () => {
    if (!data) return message.warning('No data available to export');

    if (exportFormat === 'csv') {
      exportDetailedReportAsCsv({
        filename: `${projectInfo?.name || 'Analytics'}_Detailed_Report_${dayjs().format('YYYY-MM-DD')}`,
        data
      });
      message.success('CSV Report exported successfully');
      onClose();
    } else {
      downloadAnalyticsPdf({
        data,
        projectInfo,
        dateRange,
        executiveSummary,
        selectedSections
      });
      message.success('PDF Report downloaded successfully');
      onClose();
    }
  };

  const handleSendEmail = async () => {
    if (!recipientEmail || !recipientEmail.trim()) {
      return message.error('Please enter a valid recipient email address');
    }

    setSendingEmail(true);
    try {
      let pdfBase64 = null;
      if (exportFormat === 'pdf') {
        const pdfDoc = generateAnalyticsPdf({
          data,
          projectInfo,
          dateRange,
          executiveSummary,
          selectedSections
        });
        pdfBase64 = pdfDoc.output('datauristring').split(',')[1];
      }

      await analyticsApi.sendReportEmail({
        projectId: projectInfo?._id,
        recipientEmail,
        subject: emailSubject,
        executiveSummary,
        pdfBase64,
        dateRangeText: dateRange ? `${dayjs(dateRange[0]).format('MMM D, YYYY')} - ${dayjs(dateRange[1]).format('MMM D, YYYY')}` : ''
      });

      message.success(`Analytics Report sent successfully to ${recipientEmail}!`);
      onClose();
    } catch (err) {
      console.error('Failed to send email:', err);
      message.error(err?.response?.data?.message || 'Failed to send report email');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={20} color="var(--accent-primary, #1890ff)" />
          <span style={{ fontWeight: 700, fontSize: 18 }}>Export & Share Analytics Report</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={850}
      footer={null}
      destroyOnClose
      style={{ top: 20 }}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Generate an executive performance report for <strong>{projectInfo?.name || projectInfo?.domain}</strong> and download or email it directly to your client.
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'customize',
            label: (
              <span>
                <FileText size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Configure & Details
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
                <div>
                  <Text bold style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Export Format:</Text>
                  <Radio.Group value={exportFormat} onChange={e => setExportFormat(e.target.value)} buttonStyle="solid" size="large">
                    <Radio.Button value="pdf">PDF Document (Formatted Executive Report)</Radio.Button>
                    <Radio.Button value="csv">CSV Spreadsheet (Raw Data Tables)</Radio.Button>
                  </Radio.Group>
                </div>

                {exportFormat === 'pdf' && (
                  <>
                    <Card title="Include Report Sections" size="small" style={{ borderRadius: 8, background: '#fafafa' }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Checkbox
                          checked={selectedSections.kpis}
                          onChange={e => setSelectedSections(prev => ({ ...prev, kpis: e.target.checked }))}
                        >
                          <strong>Key Performance Indicators Grid</strong> (Sessions, Users, Clicks, CTR, Bounce Rate)
                        </Checkbox>
                        <Checkbox
                          checked={selectedSections.pages}
                          onChange={e => setSelectedSections(prev => ({ ...prev, pages: e.target.checked }))}
                        >
                          <strong>Top Performing Landing Pages Table</strong>
                        </Checkbox>
                        <Checkbox
                          checked={selectedSections.queries}
                          onChange={e => setSelectedSections(prev => ({ ...prev, queries: e.target.checked }))}
                        >
                          <strong>Top Organic Search Queries Table</strong>
                        </Checkbox>
                      </Space>
                    </Card>

                    <div>
                      <Text bold style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Executive Notes / Highlights for Client:</Text>
                      <TextArea
                        rows={3}
                        placeholder="Add custom commentary, recommendations, or key wins for your client..."
                        value={executiveSummary}
                        onChange={e => setExecutiveSummary(e.target.value)}
                        maxLength={500}
                        showCount
                      />
                    </div>
                  </>
                )}

                <Divider style={{ margin: '8px 0' }} />

                <Card title="Email Report directly to Client" size="small" style={{ borderRadius: 8, borderColor: '#e5e7eb' }}>
                  <Form layout="vertical">
                    <Form.Item label="Client Recipient Email" required style={{ marginBottom: 12 }}>
                      <Input
                        prefix={<Mail size={16} color="#8c8c8c" />}
                        placeholder="client@company.com"
                        value={recipientEmail}
                        onChange={e => setRecipientEmail(e.target.value)}
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item label="Email Subject" style={{ marginBottom: 8 }}>
                      <Input
                        value={emailSubject}
                        onChange={e => setEmailSubject(e.target.value)}
                      />
                    </Form.Item>
                  </Form>
                </Card>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  {exportFormat === 'pdf' ? (
                    <Button icon={<Eye size={16} />} onClick={() => setActiveTab('preview')}>
                      Preview PDF
                    </Button>
                  ) : <div />}

                  <Space>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                      type="default"
                      icon={<Download size={16} />}
                      onClick={handleDownload}
                    >
                      Download {exportFormat.toUpperCase()}
                    </Button>
                    <Button
                      type="primary"
                      icon={<Send size={16} />}
                      loading={sendingEmail}
                      onClick={handleSendEmail}
                      style={{ background: 'var(--accent-primary, #1890ff)' }}
                    >
                      Send to Client Email
                    </Button>
                  </Space>
                </div>
              </div>
            )
          },
          ...(exportFormat === 'pdf' ? [{
            key: 'preview',
            label: (
              <span>
                <Eye size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                PDF Preview
              </span>
            ),
            children: (
              <div style={{ paddingTop: 8 }}>
                {pdfPreviewUrl ? (
                  <iframe
                    src={pdfPreviewUrl}
                    title="Analytics PDF Report Preview"
                    style={{ width: '100%', height: '520px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                  />
                ) : (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <Spin size="large" tip="Generating PDF preview..." />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                  <Button onClick={() => setActiveTab('customize')}>Back to Settings</Button>
                  <Button type="default" icon={<Download size={16} />} onClick={handleDownload}>
                    Download PDF
                  </Button>
                  <Button type="primary" icon={<Send size={16} />} loading={sendingEmail} onClick={handleSendEmail}>
                    Send to Client Email
                  </Button>
                </div>
              </div>
            )
          }] : [])
        ]}
      />
    </Modal>
  );
};

export default ReportExportModal;
