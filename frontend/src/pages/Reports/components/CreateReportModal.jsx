import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, DatePicker, Button, Row, Col, Typography, message, Spin, Space, Card, Tag, Switch, Table, Alert } from 'antd';
import { 
  RefreshCw, Save, Send, Sparkles, FileText, Share2, Layers, Award, Plus, Trash2, 
  Megaphone, Download, TrendingUp, Eye 
} from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../../services/api';
import { 
  getMonthlyHighlights, 
  upsertMonthlyHighlights, 
  getMetaLeadCampaigns, 
  getMetaReachCampaigns,
  generateReport 
} from '../../../api/reportApi';
import { 
  generateHighlightsOfTheMonthPDF,
  generateKeywordRankingOverviewPDF,
  generateKeywordRankingDetailsPDF,
  generateMetaInsightsFacebookPDF,
  generateMetaInsightsInstagramPDF
} from '../../../utils/monthlyHighlightsPdfGenerator';
import { generateMetaLeadCampaignPDF } from '../../../utils/metaLeadCampaignPdfGenerator';
import { generateMetaReachCampaignPDF } from '../../../utils/metaReachCampaignPdfGenerator';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const REPORT_TYPES = [
  { value: 'Highlights of the Month', label: '1. Highlights of the Month', icon: Sparkles, color: '#8b5cf6', desc: 'Management-level summary of completed deliverables, blogs, offline collaterals & initiatives' },
  { value: 'Keyword Ranking Overview', label: '2. Keyword Ranking Overview', icon: TrendingUp, color: '#10b981', desc: 'Organic keyword position counts (Top 10, Top 20, Top 30 Above) compared across months' },
  { value: 'Keyword Ranking Details', label: '3. Keyword Ranking Details', icon: Eye, color: '#059669', desc: 'Granular keyword list with search volume, categories, and month-wise rank trends' },
  { value: 'Meta Insights – Facebook', label: '4. Meta Insights – Facebook', icon: Share2, color: '#1877f2', desc: 'Monthly Facebook page performance (views, reach, and followers growth)' },
  { value: 'Meta Insights – Instagram', label: '5. Meta Insights – Instagram', icon: Share2, color: '#e1306c', desc: 'Monthly Instagram profile performance (views, reach, and followers growth)' },
  { value: 'Meta Campaign Insights – Lead Campaign', label: '6. Meta Campaign Insights – Lead Campaign', icon: Megaphone, color: '#3b82f6', desc: 'Campaign-wise reporting for connected Meta Lead campaigns (Campaign Name, Type, Spend, Leads, CPL)' },
  { value: 'Meta Campaign Insights – Reach Campaign', label: '7. Meta Campaign Insights – Reach Campaign', icon: Megaphone, color: '#ec4899', desc: 'Campaign-wise reporting for connected Meta Reach campaigns (Campaign Name, Type, Spend, Views, Reach, Followers Gained)' },
];

const CreateReportModal = ({ visible, onClose, clients = [], defaultClientId = null, defaultReportType = 'Highlights of the Month', onSuccess }) => {
  const [form] = Form.useForm();
  const [reportType, setReportType] = useState(defaultReportType || 'Highlights of the Month');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedClient, setSelectedClient] = useState(defaultClientId);

  // Meta Lead Campaigns State
  const [metaReportData, setMetaReportData] = useState({ campaigns: [], summary: {} });
  // Meta Reach Campaigns State
  const [metaReachReportData, setMetaReachReportData] = useState({ campaigns: [], summary: {} });

  // MoM / SEO / Social Media Highlights State
  const [deliverablesList, setDeliverablesList] = useState([]);
  const [keywordRankingList, setKeywordRankingList] = useState([]);
  const [keywordDetailsList, setKeywordDetailsList] = useState([]);
  const [metaInsightsFacebookList, setMetaInsightsFacebookList] = useState([]);
  const [metaInsightsInstagramList, setMetaInsightsInstagramList] = useState([]);
  const [hasSocialMediaModule, setHasSocialMediaModule] = useState(false);

  useEffect(() => {
    if (visible) {
      if (defaultClientId && defaultClientId !== 'all') {
        setSelectedClient(defaultClientId);
      } else if (clients.length > 0 && (!selectedClient || selectedClient === 'all')) {
        setSelectedClient(clients[0]._id);
      }
      setReportType(defaultReportType || 'Highlights of the Month');
    }
  }, [visible, defaultClientId, clients, defaultReportType]);

  const loadData = async (clientId, dateVal, refresh = false) => {
    if (!clientId || !dateVal) return;
    try {
      setLoading(true);
      const m = dateVal.month() + 1;
      const y = dateVal.year();

      // Fetch Meta Lead Data
      if (reportType === 'Meta Campaign Insights – Lead Campaign') {
        const metaRes = await getMetaLeadCampaigns(clientId);
        setMetaReportData(metaRes || { campaigns: [], summary: {} });
      }

      // Fetch Meta Reach Data
      if (reportType === 'Meta Campaign Insights – Reach Campaign') {
        const reachRes = await getMetaReachCampaigns(clientId);
        setMetaReachReportData(reachRes || { campaigns: [], summary: {} });
      }

      // Fetch MoM / Highlights / SEO / Social Data
      const res = await getMonthlyHighlights(clientId, m, y, refresh);
      if (res) {
        setHasSocialMediaModule(res.hasSocialMediaModule ?? false);
        form.setFieldsValue({
          facebookFollowersIncreased: res.digitalInsights?.facebookFollowersIncreased ?? 0,
          facebookTotalFollowers: res.digitalInsights?.facebookTotalFollowers ?? 0,
          facebookReach: res.digitalInsights?.facebookReach ?? 0,
          instagramFollowersIncreased: res.digitalInsights?.instagramFollowersIncreased ?? 0,
          instagramTotalFollowers: res.digitalInsights?.instagramTotalFollowers ?? 0,
          instagramReach: res.digitalInsights?.instagramReach ?? 0,
          blogsCount: res.blogs?.count ?? 0,
          blogsNotes: res.blogs?.notes ?? '',
          socialMediaPostDesignsCount: res.brandCommunicationDesign?.socialMediaPostDesignsCount ?? 0,
          videosCount: res.brandCommunicationDesign?.videosCount ?? 0,
          brandCommNotes: res.brandCommunicationDesign?.notes ?? '',
          offlineCollaterals: res.offlineCollaterals ?? '',
          specialInitiatives: res.specialInitiatives ?? '',
        });

        if (res.brandCommunicationDesign?.deliverables && Array.isArray(res.brandCommunicationDesign.deliverables)) {
          setDeliverablesList(res.brandCommunicationDesign.deliverables);
        } else {
          setDeliverablesList([]);
        }

        const monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const defaultMonths = [];
        for (let i = 1; i >= 0; i--) {
          const d = new Date(y, m - 1 - i, 1);
          defaultMonths.push(`${monthAbbrs[d.getMonth()]} ${d.getFullYear()}`);
        }

        if (res.keywordRankingOverview && Array.isArray(res.keywordRankingOverview) && res.keywordRankingOverview.length > 0) {
          setKeywordRankingList(res.keywordRankingOverview);
        } else {
          setKeywordRankingList(defaultMonths.map(mStr => ({ month: mStr, top10: 0, top20: 0, top30Above: 0 })));
        }

        if (res.keywordRankingDetails && Array.isArray(res.keywordRankingDetails) && res.keywordRankingDetails.length > 0) {
          setKeywordDetailsList(res.keywordRankingDetails);
        } else {
          setKeywordDetailsList([]);
        }

        if (res.metaInsightsFacebook && Array.isArray(res.metaInsightsFacebook) && res.metaInsightsFacebook.length > 0) {
          setMetaInsightsFacebookList(res.metaInsightsFacebook);
        } else {
          setMetaInsightsFacebookList(defaultMonths.map(mStr => ({ month: mStr, views: 0, reach: 0, followers: 0 })));
        }

        if (res.metaInsightsInstagram && Array.isArray(res.metaInsightsInstagram) && res.metaInsightsInstagram.length > 0) {
          setMetaInsightsInstagramList(res.metaInsightsInstagram);
        } else {
          setMetaInsightsInstagramList(defaultMonths.map(mStr => ({ month: mStr, views: 0, reach: 0, followers: 0 })));
        }
      }
    } catch (error) {
      console.error('Error loading report data:', error);
      message.error('Failed to load report details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && selectedClient && selectedDate) {
      loadData(selectedClient, selectedDate);
    }
  }, [visible, selectedClient, selectedDate, reportType]);

  const handleSyncMetaAds = async () => {
    try {
      setSyncing(true);
      await api.post('/performance-ads/sync', { clientId: selectedClient !== 'all' ? selectedClient : undefined });
      message.success('Meta Ads performance data synced successfully!');
      await loadData(selectedClient, selectedDate);
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

  const handleDownloadPDF = async () => {
    const clientInfo = getSelectedClientInfo();
    try {
      if (reportType === 'Meta Campaign Insights – Lead Campaign') {
        generateMetaLeadCampaignPDF(metaReportData, clientInfo);
        message.success('Meta Lead Campaign PDF downloaded');
      } else if (reportType === 'Meta Campaign Insights – Reach Campaign') {
        generateMetaReachCampaignPDF(metaReachReportData, clientInfo);
        message.success('Meta Reach Campaign PDF downloaded');
      } else {
        const values = form.getFieldsValue();
        const dataPayload = {
          month: selectedDate.month() + 1,
          year: selectedDate.year(),
          hasSocialMediaModule,
          digitalInsights: values,
          blogs: { count: values.blogsCount || 0, notes: values.blogsNotes },
          brandCommunicationDesign: { deliverables: deliverablesList, notes: values.brandCommNotes },
          offlineCollaterals: values.offlineCollaterals,
          specialInitiatives: values.specialInitiatives,
          keywordRankingOverview: keywordRankingList,
          keywordRankingDetails: keywordDetailsList,
          metaInsightsFacebook: metaInsightsFacebookList,
          metaInsightsInstagram: metaInsightsInstagramList
        };

        if (reportType === 'Highlights of the Month') {
          generateHighlightsOfTheMonthPDF(dataPayload, clientInfo);
          message.success('Highlights of the Month PDF downloaded');
        } else if (reportType === 'Keyword Ranking Overview') {
          generateKeywordRankingOverviewPDF(dataPayload, clientInfo);
          message.success('Keyword Ranking Overview PDF downloaded');
        } else if (reportType === 'Keyword Ranking Details') {
          generateKeywordRankingDetailsPDF(dataPayload, clientInfo);
          message.success('Keyword Ranking Details PDF downloaded');
        } else if (reportType === 'Meta Insights – Facebook') {
          generateMetaInsightsFacebookPDF(dataPayload, clientInfo);
          message.success('Meta Insights – Facebook PDF downloaded');
        } else if (reportType === 'Meta Insights – Instagram') {
          generateMetaInsightsInstagramPDF(dataPayload, clientInfo);
          message.success('Meta Insights – Instagram PDF downloaded');
        }
      }
    } catch (err) {
      console.error('Download PDF error:', err);
      message.error('Failed to generate PDF');
    }
  };

  const handlePublishAndSend = async () => {
    if (!selectedClient || selectedClient === 'all') {
      message.warning('Please select a specific client account to send the report.');
      return;
    }

    try {
      setSaving(true);
      const clientInfo = getSelectedClientInfo();
      const recipientEmail = clientInfo.email || `${clientInfo.companyName || clientInfo.name}@client.com`;

      // Save database state for non-standalone Meta Lead/Reach reports
      if (reportType !== 'Meta Campaign Insights – Lead Campaign' && reportType !== 'Meta Campaign Insights – Reach Campaign') {
        const values = await form.validateFields().catch(() => form.getFieldsValue());
        const payload = {
          clientId: selectedClient,
          month: selectedDate.month() + 1,
          year: selectedDate.year(),
          status: 'Published',
          hasSocialMediaModule,
          digitalInsights: {
            facebookFollowersIncreased: values.facebookFollowersIncreased || 0,
            facebookTotalFollowers: values.facebookTotalFollowers || 0,
            facebookReach: values.facebookReach || 0,
            instagramFollowersIncreased: values.instagramFollowersIncreased || 0,
            instagramTotalFollowers: values.instagramTotalFollowers || 0,
            instagramReach: values.instagramReach || 0,
          },
          blogs: { count: values.blogsCount || 0, notes: values.blogsNotes || '' },
          brandCommunicationDesign: { deliverables: deliverablesList },
          offlineCollaterals: values.offlineCollaterals || '',
          specialInitiatives: values.specialInitiatives || '',
          keywordRankingOverview: keywordRankingList,
          keywordRankingDetails: keywordDetailsList,
          metaInsightsFacebook: metaInsightsFacebookList,
          metaInsightsInstagram: metaInsightsInstagramList
        };
        await upsertMonthlyHighlights(payload);
      }

      // Dispatch exact standalone report via API
      await generateReport({
        clientId: selectedClient,
        template: reportType,
        recipients: [recipientEmail],
        deliveryMethod: 'Email'
      });

      message.success(`Standalone "${reportType}" report sent to ${clientInfo.companyName || clientInfo.name}!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error publishing report:', error);
      message.error('Failed to send report to client');
    } finally {
      setSaving(false);
    }
  };

  // List modification helpers
  const handleDeliverableChange = (index, field, value) => {
    const updated = [...deliverablesList];
    updated[index] = { ...updated[index], [field]: value };
    setDeliverablesList(updated);
  };
  const handleAddDeliverable = () => setDeliverablesList([...deliverablesList, { name: '', completed: 0, total: 0, unit: 'Completed' }]);
  const handleRemoveDeliverable = (index) => setDeliverablesList(deliverablesList.filter((_, i) => i !== index));

  const metaColumns = [
    { title: 'Campaign Name', dataIndex: 'campaignName', key: 'campaignName', render: text => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
    { title: 'Type of Campaign', dataIndex: 'typeOfCampaign', key: 'typeOfCampaign', width: 140, render: text => <Tag color="blue" style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600, border: 'none' }}>{text || 'Lead'}</Tag> },
    { title: 'Amount Spent', dataIndex: 'amountSpent', key: 'amountSpent', align: 'right', render: text => <strong style={{ color: '#10b981' }}>{text}</strong> },
    { title: 'No. of Leads', dataIndex: 'noOfLeads', key: 'noOfLeads', align: 'right', render: text => <Text style={{ fontWeight: 700, fontSize: 14 }}>{text}</Text> },
    { title: 'CPL', dataIndex: 'cpl', key: 'cpl', align: 'right', render: text => <Text style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{text}</Text> }
  ];

  const metaReachColumns = [
    { title: 'Campaign Name', dataIndex: 'campaignName', key: 'campaignName', render: text => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
    { title: 'Type of Campaign', dataIndex: 'typeOfCampaign', key: 'typeOfCampaign', width: 140, render: text => <Tag color="magenta" style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600, border: 'none' }}>{text || 'Reach'}</Tag> },
    { title: 'Amount Spent', dataIndex: 'amountSpent', key: 'amountSpent', align: 'right', render: text => <strong style={{ color: '#10b981' }}>{text}</strong> },
    { title: 'Views', dataIndex: 'views', key: 'views', align: 'right', render: num => <Text style={{ fontWeight: 600 }}>{(num ?? 0).toLocaleString('en-IN')}</Text> },
    { title: 'Reach', dataIndex: 'reach', key: 'reach', align: 'right', render: num => <Text style={{ fontWeight: 600, color: '#3b82f6' }}>{(num ?? 0).toLocaleString('en-IN')}</Text> },
    { title: 'Followers Gained', dataIndex: 'followersGained', key: 'followersGained', align: 'right', render: num => <Text style={{ fontWeight: 700, color: '#ec4899' }}>{(num ?? 0).toLocaleString('en-IN')}</Text> }
  ];

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      style={{ top: 20 }}
      width={1050}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <Sparkles size={22} color="var(--accent-primary)" />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 800 }}>Create Report</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Select a report type to generate and send custom single-topic reports for your clients.</Text>
          </div>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
          <Button icon={<RefreshCw size={15} className={syncing ? 'spin' : ''} />} onClick={() => loadData(selectedClient, selectedDate, true)} disabled={loading || saving} style={{ borderRadius: 8 }}>
            Auto-Refetch Data
          </Button>
          <Space size="middle">
            <Button onClick={onClose} style={{ borderRadius: 8 }}>Cancel</Button>
            <Button icon={<Download size={15} />} onClick={handleDownloadPDF} style={{ borderRadius: 8, fontWeight: 600 }}>
              Download PDF
            </Button>
            <Button type="primary" icon={<Send size={15} />} onClick={handlePublishAndSend} loading={saving} style={{ background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 600 }}>
              Publish & Send Report
            </Button>
          </Space>
        </div>
      }
      destroyOnClose
    >
      <Spin spinning={loading}>
        {/* TOP CONTROLS: Client Account, Report Type, Report Period */}
        <Card style={{ marginBottom: 20, borderRadius: 14, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }} bodyStyle={{ padding: 18 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={7}>
              <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Client Account</Text>
              <Select
                style={{ width: '100%' }}
                value={selectedClient}
                onChange={setSelectedClient}
                showSearch
                placeholder="Select client account..."
                optionFilterProp="children"
              >
                {clients.map(c => (
                  <Option key={c._id} value={c._id}>
                    {c.companyName || c.name || c.brandName || 'Unnamed Client'}
                  </Option>
                ))}
              </Select>
            </Col>

            <Col xs={24} md={11}>
              <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Report Type</Text>
              <Select
                style={{ width: '100%' }}
                value={reportType}
                onChange={setReportType}
                dropdownStyle={{ borderRadius: 12 }}
              >
                {REPORT_TYPES.map(r => (
                  <Option key={r.value} value={r.value}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <r.icon size={15} color={r.color} />
                      <strong style={{ fontSize: 13 }}>{r.value}</strong>
                    </div>
                  </Option>
                ))}
              </Select>
            </Col>

            <Col xs={24} md={6}>
              <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Report Period</Text>
              <DatePicker
                picker="month"
                value={selectedDate}
                onChange={date => date && setSelectedDate(date)}
                allowClear={false}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>
        </Card>

        {/* DYNAMIC FORM/TABLE RENDERING FOR THE EXACT SELECTED REPORT TYPE */}

        {/* 1. HIGHLIGHTS OF THE MONTH */}
        {reportType === 'Highlights of the Month' && (
          <Form form={form} layout="vertical">
            <Card size="small" title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={16} color="#10b981" /><strong style={{ fontSize: 14 }}>Blogs & Articles</strong></div>} style={{ marginBottom: 16, borderRadius: 12 }}>
              <Row gutter={[16, 0]}>
                <Col span={6}>
                  <Form.Item name="blogsCount" label="Number of Blog Updates">
                    <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                  </Form.Item>
                </Col>
                <Col span={18}>
                  <Form.Item name="blogsNotes" label="Blog Notes / Topics (Optional)">
                    <Input placeholder="e.g., Published 2 articles on Orthopedic health tips & IVF treatments" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card size="small" title={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Layers size={16} color="#8b5cf6" /><strong style={{ fontSize: 14 }}>Brand Communication & Deliverables</strong></div><Button type="dashed" size="small" icon={<Plus size={14} />} onClick={handleAddDeliverable}>Add Deliverable</Button></div>} style={{ marginBottom: 16, borderRadius: 12 }}>
              {deliverablesList.map((item, idx) => (
                <Row key={idx} gutter={[12, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, marginBottom: 8 }}>
                  <Col span={10}><Input placeholder="Deliverable name" value={item.name} onChange={e => handleDeliverableChange(idx, 'name', e.target.value)} /></Col>
                  <Col span={5}><InputNumber style={{ width: '100%' }} placeholder="Completed" value={item.completed} onChange={val => handleDeliverableChange(idx, 'completed', val || 0)} /></Col>
                  <Col span={5}><InputNumber style={{ width: '100%' }} placeholder="Total" value={item.total} onChange={val => handleDeliverableChange(idx, 'total', val || 0)} /></Col>
                  <Col span={4} style={{ textAlign: 'right' }}><Button type="text" danger icon={<Trash2 size={16} />} onClick={() => handleRemoveDeliverable(idx)} /></Col>
                </Row>
              ))}
              <Form.Item name="brandCommNotes" label="Summary Notes (Optional)">
                <Input placeholder="Summary of brand communication deliverables..." />
              </Form.Item>
            </Card>

            <Card size="small" title={<strong style={{ fontSize: 14 }}>Offline Collaterals & Special Initiatives</strong>} style={{ marginBottom: 16, borderRadius: 12 }}>
              <Form.Item name="offlineCollaterals" label="Offline Collaterals & Internal Branding">
                <TextArea rows={2} placeholder="Clinic standees, visiting cards..." />
              </Form.Item>
              <Form.Item name="specialInitiatives" label="Special Initiatives & Campaigns">
                <TextArea rows={2} placeholder="Free checkup campaign branding..." />
              </Form.Item>
            </Card>
          </Form>
        )}

        {/* 2. KEYWORD RANKING OVERVIEW */}
        {reportType === 'Keyword Ranking Overview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Keyword Ranking Overview</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Show overall organic keyword-ranking performance for the selected month and compare it with previous months.</Text>
              </div>
              <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => setKeywordRankingList([...keywordRankingList, { month: selectedDate.format('MMM YYYY'), top10: 0, top20: 0, top30Above: 0 }])}>
                Add Month Row
              </Button>
            </div>
            <Card size="small" style={{ borderRadius: 12 }}>
              {keywordRankingList.map((item, idx) => (
                <Row key={idx} gutter={[12, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, marginBottom: 8 }}>
                  <Col span={6}><Text style={{ fontSize: 11, fontWeight: 600 }}>Month</Text><Input value={item.month} onChange={e => { const updated = [...keywordRankingList]; updated[idx].month = e.target.value; setKeywordRankingList(updated); }} /></Col>
                  <Col span={5}><Text style={{ fontSize: 11 }}>Top 10 (1-10)</Text><InputNumber style={{ width: '100%' }} value={item.top10} onChange={val => { const updated = [...keywordRankingList]; updated[idx].top10 = val || 0; setKeywordRankingList(updated); }} /></Col>
                  <Col span={5}><Text style={{ fontSize: 11 }}>Top 20 (1-20)</Text><InputNumber style={{ width: '100%' }} value={item.top20} onChange={val => { const updated = [...keywordRankingList]; updated[idx].top20 = val || 0; setKeywordRankingList(updated); }} /></Col>
                  <Col span={5}><Text style={{ fontSize: 11 }}>Top 30 Above</Text><InputNumber style={{ width: '100%' }} value={item.top30Above} onChange={val => { const updated = [...keywordRankingList]; updated[idx].top30Above = val || 0; setKeywordRankingList(updated); }} /></Col>
                  <Col span={3} style={{ textAlign: 'right' }}><Button type="text" danger icon={<Trash2 size={16} />} onClick={() => setKeywordRankingList(keywordRankingList.filter((_, i) => i !== idx))} /></Col>
                </Row>
              ))}
            </Card>
          </div>
        )}

        {/* 3. KEYWORD RANKING DETAILS */}
        {reportType === 'Keyword Ranking Details' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Keyword Ranking Details</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Granular organic keyword rankings, search volumes, categories, and month-wise rank trends.</Text>
              </div>
              <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => setKeywordDetailsList([...keywordDetailsList, { keyword: '', category: 'General', volume: 0, monthRanks: [{ month: selectedDate.format('MMM YYYY'), rank: '-' }] }])}>
                Add Keyword Detail
              </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {keywordDetailsList.length > 0 ? (
                keywordDetailsList.map((item, idx) => (
                  <Card key={idx} size="small" style={{ background: 'var(--bg-secondary)', borderRadius: 10 }}>
                    <Row gutter={[12, 8]} align="middle">
                      <Col span={10}><Input placeholder="Keyword" value={item.keyword} onChange={e => { const updated = [...keywordDetailsList]; updated[idx].keyword = e.target.value; setKeywordDetailsList(updated); }} /></Col>
                      <Col span={8}><Input placeholder="Category" value={item.category} onChange={e => { const updated = [...keywordDetailsList]; updated[idx].category = e.target.value; setKeywordDetailsList(updated); }} /></Col>
                      <Col span={4}><InputNumber style={{ width: '100%' }} placeholder="Volume" value={item.volume} onChange={val => { const updated = [...keywordDetailsList]; updated[idx].volume = val || 0; setKeywordDetailsList(updated); }} /></Col>
                      <Col span={2} style={{ textAlign: 'right' }}><Button type="text" danger icon={<Trash2 size={16} />} onClick={() => setKeywordDetailsList(keywordDetailsList.filter((_, i) => i !== idx))} /></Col>
                    </Row>
                  </Card>
                ))
              ) : (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>No keyword details added yet. Click "Add Keyword Detail" to add manually.</div>
              )}
            </div>
          </div>
        )}

        {/* 4. META INSIGHTS – FACEBOOK */}
        {reportType === 'Meta Insights – Facebook' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Meta Insights – Facebook</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Show monthly Facebook performance (views, reach, and followers).</Text>
              </div>
              <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => setMetaInsightsFacebookList([...metaInsightsFacebookList, { month: selectedDate.format('MMM YYYY'), views: 0, reach: 0, followers: 0 }])}>
                Add Month Row
              </Button>
            </div>
            <Card size="small" style={{ borderRadius: 12 }}>
              {metaInsightsFacebookList.map((item, idx) => (
                <Row key={idx} gutter={[12, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, marginBottom: 8 }}>
                  <Col span={6}><Text style={{ fontSize: 11, fontWeight: 600 }}>Month</Text><Input value={item.month} onChange={e => { const updated = [...metaInsightsFacebookList]; updated[idx].month = e.target.value; setMetaInsightsFacebookList(updated); }} /></Col>
                  <Col span={5}><Text style={{ fontSize: 11 }}>Views</Text><InputNumber style={{ width: '100%' }} value={item.views} onChange={val => { const updated = [...metaInsightsFacebookList]; updated[idx].views = val || 0; setMetaInsightsFacebookList(updated); }} /></Col>
                  <Col span={5}><Text style={{ fontSize: 11 }}>Reach</Text><InputNumber style={{ width: '100%' }} value={item.reach} onChange={val => { const updated = [...metaInsightsFacebookList]; updated[idx].reach = val || 0; setMetaInsightsFacebookList(updated); }} /></Col>
                  <Col span={5}><Text style={{ fontSize: 11 }}>Followers</Text><InputNumber style={{ width: '100%' }} value={item.followers} onChange={val => { const updated = [...metaInsightsFacebookList]; updated[idx].followers = val || 0; setMetaInsightsFacebookList(updated); }} /></Col>
                  <Col span={3} style={{ textAlign: 'right' }}><Button type="text" danger icon={<Trash2 size={16} />} onClick={() => setMetaInsightsFacebookList(metaInsightsFacebookList.filter((_, i) => i !== idx))} /></Col>
                </Row>
              ))}
            </Card>
          </div>
        )}

        {/* 5. META INSIGHTS – INSTAGRAM */}
        {reportType === 'Meta Insights – Instagram' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Meta Insights – Instagram</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Show monthly Instagram performance (views, reach, and followers).</Text>
              </div>
              <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => setMetaInsightsInstagramList([...metaInsightsInstagramList, { month: selectedDate.format('MMM YYYY'), views: 0, reach: 0, followers: 0 }])}>
                Add Month Row
              </Button>
            </div>
            <Card size="small" style={{ borderRadius: 12 }}>
              {metaInsightsInstagramList.map((item, idx) => (
                <Row key={idx} gutter={[12, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, marginBottom: 8 }}>
                  <Col span={6}><Text style={{ fontSize: 11, fontWeight: 600 }}>Month</Text><Input value={item.month} onChange={e => { const updated = [...metaInsightsInstagramList]; updated[idx].month = e.target.value; setMetaInsightsInstagramList(updated); }} /></Col>
                  <Col span={5}><Text style={{ fontSize: 11 }}>Views</Text><InputNumber style={{ width: '100%' }} value={item.views} onChange={val => { const updated = [...metaInsightsInstagramList]; updated[idx].views = val || 0; setMetaInsightsInstagramList(updated); }} /></Col>
                  <Col span={5}><Text style={{ fontSize: 11 }}>Reach</Text><InputNumber style={{ width: '100%' }} value={item.reach} onChange={val => { const updated = [...metaInsightsInstagramList]; updated[idx].reach = val || 0; setMetaInsightsInstagramList(updated); }} /></Col>
                  <Col span={5}><Text style={{ fontSize: 11 }}>Followers</Text><InputNumber style={{ width: '100%' }} value={item.followers} onChange={val => { const updated = [...metaInsightsInstagramList]; updated[idx].followers = val || 0; setMetaInsightsInstagramList(updated); }} /></Col>
                  <Col span={3} style={{ textAlign: 'right' }}><Button type="text" danger icon={<Trash2 size={16} />} onClick={() => setMetaInsightsInstagramList(metaInsightsInstagramList.filter((_, i) => i !== idx))} /></Col>
                </Row>
              ))}
            </Card>
          </div>
        )}

        {/* 6. META CAMPAIGN INSIGHTS – LEAD CAMPAIGN */}
        {reportType === 'Meta Campaign Insights – Lead Campaign' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Meta Campaign Insights – Lead Campaign</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Connected real Meta Lead campaigns from Performance Ads.</Text>
              </div>
              <Button icon={<RefreshCw size={14} className={syncing ? 'spin' : ''} />} loading={syncing} onClick={handleSyncMetaAds} style={{ borderRadius: 8, fontWeight: 600 }}>
                Sync Meta Ads
              </Button>
            </div>

            <Alert
              message="Report Requirement Fields"
              description="Campaign Name | Type of Campaign: Lead | Amount Spent: Campaign spend | No. of Leads: Leads generated | CPL: Cost per lead"
              type="info"
              showIcon
              style={{ marginBottom: 16, borderRadius: 10 }}
            />

            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>AMOUNT SPENT</Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{metaReportData.summary?.totalAmountSpent || '₹0'}</Title>
                </Card>
              </Col>
              <Col span={8}>
                <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>NO. OF LEADS</Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>{metaReportData.summary?.totalLeads ?? 0}</Title>
                </Card>
              </Col>
              <Col span={8}>
                <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>BLENDED CPL</Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>{metaReportData.summary?.avgCpl || '₹0'}</Title>
                </Card>
              </Col>
            </Row>

            <Table
              columns={metaColumns}
              dataSource={metaReportData.campaigns || []}
              rowKey="id"
              pagination={false}
              size="middle"
              bordered
            />
          </div>
        )}

        {/* 7. META CAMPAIGN INSIGHTS – REACH CAMPAIGN */}
        {reportType === 'Meta Campaign Insights – Reach Campaign' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Meta Campaign Insights – Reach Campaign</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Connected real Meta Reach campaigns from Performance Ads.</Text>
              </div>
              <Button icon={<RefreshCw size={14} className={syncing ? 'spin' : ''} />} loading={syncing} onClick={handleSyncMetaAds} style={{ borderRadius: 8, fontWeight: 600 }}>
                Sync Meta Ads
              </Button>
            </div>

            <Alert
              message="Report Requirement Fields"
              description="Campaign Name | Type of Campaign: Reach | Amount Spent: Campaign spend | Views: Views generated | Reach: People reached | Followers Gained: Followers gained"
              type="info"
              showIcon
              style={{ marginBottom: 16, borderRadius: 10 }}
            />

            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>SPENT (INCL. GST)</Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{metaReachReportData.summary?.totalAmountSpentInclGst || '₹0'}</Title>
                </Card>
              </Col>
              <Col span={6}>
                <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOTAL VIEWS</Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>{(metaReachReportData.summary?.totalViews ?? 0).toLocaleString('en-IN')}</Title>
                </Card>
              </Col>
              <Col span={6}>
                <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOTAL REACH</Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>{(metaReachReportData.summary?.totalReach ?? 0).toLocaleString('en-IN')}</Title>
                </Card>
              </Col>
              <Col span={6}>
                <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>FOLLOWERS GAINED</Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', color: '#ec4899', fontWeight: 800 }}>{(metaReachReportData.summary?.totalFollowersGained ?? 0).toLocaleString('en-IN')}</Title>
                </Card>
              </Col>
            </Row>

            <Table
              columns={metaReachColumns}
              dataSource={metaReachReportData.campaigns || []}
              rowKey="id"
              pagination={false}
              size="middle"
              bordered
              summary={() => {
                const summary = metaReachReportData.summary || {};
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: 'var(--bg-secondary)', fontWeight: 800 }}>
                      <Table.Summary.Cell index={0}><Text style={{ fontWeight: 800 }}>Total (Including GST)</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="center"><Tag color="magenta" style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600, border: 'none' }}>Reach</Tag></Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right"><Text style={{ fontWeight: 800, color: '#10b981' }}>{summary.totalAmountSpentInclGst || '₹0'}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right"><Text style={{ fontWeight: 800 }}>{(summary.totalViews ?? 0).toLocaleString('en-IN')}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={4} align="right"><Text style={{ fontWeight: 800, color: '#3b82f6' }}>{(summary.totalReach ?? 0).toLocaleString('en-IN')}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={5} align="right"><Text style={{ fontWeight: 800, color: '#ec4899' }}>{(summary.totalFollowersGained ?? 0).toLocaleString('en-IN')}</Text></Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
            />
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default CreateReportModal;
