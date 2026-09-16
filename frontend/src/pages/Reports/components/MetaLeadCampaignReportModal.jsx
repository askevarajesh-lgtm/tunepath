import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Select, Tag, Space, Typography, Card, message, Row, Col, Alert, Spin, Tooltip } from 'antd';
import { Download, Send, RefreshCw, Megaphone, Target, DollarSign, Users, TrendingUp, Sparkles, CheckCircle, FileText } from 'lucide-react';
import api from '../../../services/api';
import { getMetaLeadCampaigns, generateReport } from '../../../api/reportApi';
import { generateMetaLeadCampaignPDF } from '../../../utils/metaLeadCampaignPdfGenerator';

const { Title, Text } = Typography;
const { Option } = Select;

const MetaLeadCampaignReportModal = ({ visible, onClose, clients = [], defaultClientId = 'all', onSuccess }) => {
  const [selectedClient, setSelectedClient] = useState(defaultClientId || 'all');
  const [reportData, setReportData] = useState({ campaigns: [], summary: {} });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedClient(defaultClientId || 'all');
      fetchData(defaultClientId || 'all');
    }
  }, [visible, defaultClientId]);

  const fetchData = async (clientId) => {
    try {
      setLoading(true);
      const res = await getMetaLeadCampaigns(clientId);
      setReportData(res || { campaigns: [], summary: {} });
    } catch (err) {
      console.error('Error fetching Meta Lead campaigns:', err);
      message.error('Failed to fetch Meta Lead campaign details');
    } finally {
      setLoading(false);
    }
  };

  const handleClientChange = (val) => {
    setSelectedClient(val);
    fetchData(val);
  };

  const handleSyncMetaAds = async () => {
    try {
      setSyncing(true);
      await api.post('/performance-ads/sync', { clientId: selectedClient !== 'all' ? selectedClient : undefined });
      message.success('Meta Ads performance data synced successfully!');
      await fetchData(selectedClient);
    } catch (err) {
      console.error('Meta sync error:', err);
      message.error('Failed to sync Meta Ads data');
    } finally {
      setSyncing(false);
    }
  };

  const getSelectedClientInfo = () => {
    if (selectedClient === 'all') return { name: 'All Clients', companyName: 'All Clients' };
    const found = clients.find(c => String(c._id) === String(selectedClient));
    return found || { name: 'Client', companyName: 'Client' };
  };

  const handleDownloadPDF = () => {
    try {
      const clientInfo = getSelectedClientInfo();
      generateMetaLeadCampaignPDF(reportData, clientInfo);
      message.success('Meta Lead Campaign PDF report downloaded');
    } catch (err) {
      console.error('PDF export error:', err);
      message.error('Failed to download PDF report');
    }
  };

  const handleSendReport = async () => {
    if (selectedClient === 'all') {
      message.warning('Please select a specific client to send this report.');
      return;
    }
    const clientInfo = getSelectedClientInfo();
    const recipientEmail = clientInfo.email || `${clientInfo.companyName || clientInfo.name}@client.com`;
    
    try {
      setSending(true);
      await generateReport({
        clientId: selectedClient,
        template: 'Meta Campaign Insights - Lead Campaign',
        recipients: [recipientEmail],
        deliveryMethod: 'Email'
      });
      message.success(`Meta Lead Campaign Report sent to ${clientInfo.companyName || clientInfo.name}!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Send report error:', err);
      message.error('Failed to send report to client');
    } finally {
      setSending(false);
    }
  };

  const columns = [
    {
      title: 'Campaign Name',
      dataIndex: 'campaignName',
      key: 'campaignName',
      render: text => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Megaphone size={16} color="var(--accent-primary, #3b82f6)" />
          <strong style={{ color: 'var(--text-primary)' }}>{text}</strong>
        </div>
      )
    },
    {
      title: 'Type of Campaign',
      dataIndex: 'typeOfCampaign',
      key: 'typeOfCampaign',
      width: 140,
      render: text => (
        <Tag color="blue" style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600, border: 'none' }}>
          {text || 'Lead'}
        </Tag>
      )
    },
    {
      title: 'Amount Spent',
      dataIndex: 'amountSpent',
      key: 'amountSpent',
      align: 'right',
      render: text => <strong style={{ color: '#10b981' }}>{text}</strong>
    },
    {
      title: 'No. of Leads',
      dataIndex: 'noOfLeads',
      key: 'noOfLeads',
      align: 'right',
      render: text => <Text style={{ fontWeight: 700, fontSize: 14 }}>{text}</Text>
    },
    {
      title: 'CPL',
      dataIndex: 'cpl',
      key: 'cpl',
      align: 'right',
      render: text => <Text style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{text}</Text>
    }
  ];

  const campaigns = reportData?.campaigns || [];
  const summary = reportData?.summary || {};

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} color="#3b82f6" />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 800 }}>3.6 Meta Campaign Insights – Lead Campaign</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Simple campaign-wise reporting for Lead campaigns from connected Performance Ads.</Text>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose} style={{ borderRadius: 8 }}>
          Close
        </Button>,
        <Button 
          key="download" 
          icon={<Download size={15} />} 
          onClick={handleDownloadPDF} 
          style={{ borderRadius: 8, fontWeight: 600 }}
        >
          Download PDF
        </Button>,
        <Button 
          key="send" 
          type="primary" 
          icon={<Send size={15} />} 
          loading={sending}
          onClick={handleSendReport} 
          style={{ borderRadius: 8, background: 'var(--accent-primary)', fontWeight: 600 }}
        >
          Send Report to Client
        </Button>
      ]}
      style={{ top: 20 }}
    >
      <div style={{ padding: '16px 0' }}>
        {/* Controls & Sync */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontWeight: 600 }}>Select Client:</Text>
            <Select
              value={selectedClient}
              onChange={handleClientChange}
              style={{ width: 220 }}
              dropdownStyle={{ borderRadius: 12 }}
            >
              <Option value="all">All Clients (Aggregate)</Option>
              {clients.map(c => (
                <Option key={c._id} value={c._id}>{c.companyName || c.name}</Option>
              ))}
            </Select>
          </div>
          <Button
            icon={<RefreshCw size={14} className={syncing ? 'spin' : ''} />}
            loading={syncing}
            onClick={handleSyncMetaAds}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Sync Meta Ads
          </Button>
        </div>

        {/* Specification Requirement Notice */}
        <Alert
          message="Report Field Requirements"
          description={
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              <strong>Campaign Name:</strong> Name of campaign | <strong>Type of Campaign:</strong> Lead | <strong>Amount Spent:</strong> Campaign spend | <strong>No. of Leads:</strong> Leads generated | <strong>CPL:</strong> Cost per lead
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 20, borderRadius: 12 }}
        />

        {/* Summary Metric Cards */}
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={8}>
            <Card bodyStyle={{ padding: '16px' }} style={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Amount Spent</Text>
              <Title level={3} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>
                {summary.totalAmountSpent || '₹0'}
              </Title>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card bodyStyle={{ padding: '16px' }} style={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>No. of Leads</Text>
              <Title level={3} style={{ margin: '4px 0 0 0', color: 'var(--text-primary)', fontWeight: 800 }}>
                {summary.totalLeads ?? 0}
              </Title>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card bodyStyle={{ padding: '16px' }} style={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Blended CPL</Text>
              <Title level={3} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>
                {summary.avgCpl || '₹0'}
              </Title>
            </Card>
          </Col>
        </Row>

        {/* Campaign Data Table */}
        <Table
          loading={loading}
          columns={columns}
          dataSource={campaigns}
          rowKey="id"
          pagination={false}
          size="middle"
          bordered
          locale={{
            emptyText: (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <FileText size={32} color="var(--text-tertiary)" style={{ marginBottom: 8 }} />
                <Title level={5} style={{ margin: 0, color: 'var(--text-secondary)' }}>No Meta Lead campaigns connected</Title>
                <Text type="secondary" style={{ fontSize: 13 }}>Ensure Meta Ads integration is connected and synced in Performance Ads.</Text>
              </div>
            )
          }}
        />
      </div>
    </Modal>
  );
};

export default MetaLeadCampaignReportModal;
