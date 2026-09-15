import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, DatePicker, Button, Row, Col, Divider, Typography, message, Spin, Space, Card, Tag, Switch } from 'antd';
import { RefreshCw, Save, Send, Sparkles, FileText, Share2, Layers, Award, Plus, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { getMonthlyHighlights, upsertMonthlyHighlights } from '../../../api/reportApi';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const MonthlyHighlightsEditorModal = ({ visible, onClose, clients = [], defaultClientId = null, onSuccess }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [selectedClient, setSelectedClient] = useState(defaultClientId);
    const [deliverablesList, setDeliverablesList] = useState([]);
    const [keywordRankingList, setKeywordRankingList] = useState([]);
    const [keywordDetailsList, setKeywordDetailsList] = useState([]);
    const [metaInsightsFacebookList, setMetaInsightsFacebookList] = useState([]);
    const [metaInsightsInstagramList, setMetaInsightsInstagramList] = useState([]);
    const [hasSocialMediaModule, setHasSocialMediaModule] = useState(false);
    const [addMonthModalVisible, setAddMonthModalVisible] = useState(false);
    const [selectedMonthToAdd, setSelectedMonthToAdd] = useState(null);
    const [addingMonthLoading, setAddingMonthLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            if (defaultClientId && defaultClientId !== 'all') {
                setSelectedClient(defaultClientId);
            } else if (clients.length > 0 && (!selectedClient || selectedClient === 'all')) {
                setSelectedClient(clients[0]._id);
            }
        }
    }, [visible, defaultClientId, clients]);

    const loadData = async (clientId, dateVal, refresh = false) => {
        if (!clientId || !dateVal) return;
        try {
            setLoading(true);
            const m = dateVal.month() + 1;
            const y = dateVal.year();
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
                    const defaultRows = defaultMonths.map(mStr => ({ month: mStr, top10: 0, top20: 0, top30Above: 0 }));
                    setKeywordRankingList(defaultRows);
                }

                if (res.keywordRankingDetails && Array.isArray(res.keywordRankingDetails) && res.keywordRankingDetails.length > 0) {
                    setKeywordDetailsList(res.keywordRankingDetails);
                } else {
                    setKeywordDetailsList([]);
                }

                if (res.metaInsightsFacebook && Array.isArray(res.metaInsightsFacebook) && res.metaInsightsFacebook.length > 0) {
                    setMetaInsightsFacebookList(res.metaInsightsFacebook);
                } else {
                    const defaultMetaRows = defaultMonths.map(mStr => ({ month: mStr, views: 0, reach: 0, followers: 0 }));
                    setMetaInsightsFacebookList(defaultMetaRows);
                }

                if (res.metaInsightsInstagram && Array.isArray(res.metaInsightsInstagram) && res.metaInsightsInstagram.length > 0) {
                    setMetaInsightsInstagramList(res.metaInsightsInstagram);
                } else {
                    const defaultMetaRows = defaultMonths.map(mStr => ({ month: mStr, views: 0, reach: 0, followers: 0 }));
                    setMetaInsightsInstagramList(defaultMetaRows);
                }
            }
        } catch (error) {
            console.error('Error loading monthly highlights:', error);
            message.error('Failed to load monthly highlights data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (visible && selectedClient && selectedDate) {
            loadData(selectedClient, selectedDate);
        }
    }, [visible, selectedClient, selectedDate]);

    const handleDeliverableChange = (index, field, value) => {
        const updated = [...deliverablesList];
        updated[index] = { ...updated[index], [field]: value };
        setDeliverablesList(updated);
    };

    const handleAddDeliverable = () => {
        setDeliverablesList([
            ...deliverablesList,
            { name: '', completed: 0, total: 0, unit: 'Completed' }
        ]);
    };

    const handleRemoveDeliverable = (index) => {
        setDeliverablesList(deliverablesList.filter((_, i) => i !== index));
    };

    const parseMonthStr = (mStr) => {
        if (!mStr) return dayjs();
        const parts = mStr.trim().split(' ');
        if (parts.length === 2) {
            const monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const mIdx = monthAbbrs.indexOf(parts[0]);
            const yNum = parseInt(parts[1], 10);
            if (mIdx !== -1 && !isNaN(yNum)) {
                return dayjs(new Date(yNum, mIdx, 1));
            }
        }
        const d = dayjs(mStr);
        return d.isValid() ? d : dayjs();
    };

    const handleKeywordRankingChange = (index, field, value) => {
        const updated = [...keywordRankingList];
        updated[index] = { ...updated[index], [field]: value };
        setKeywordRankingList(updated);
    };

    const handleKeywordRankingMonthChange = async (index, dateVal) => {
        if (!dateVal) return;
        const monthStr = dateVal.format('MMM YYYY');
        const m = dateVal.month() + 1;
        const y = dateVal.year();

        const updated = [...keywordRankingList];
        updated[index] = { ...updated[index], month: monthStr };
        setKeywordRankingList(updated);

        if (selectedClient) {
            try {
                const res = await getMonthlyHighlights(selectedClient, m, y);
                let top10 = 0, top20 = 0, top30Above = 0;
                if (res && res.keywordRankingOverview && Array.isArray(res.keywordRankingOverview) && res.keywordRankingOverview.length > 0) {
                    const match = res.keywordRankingOverview.find(r => r.month === monthStr) || res.keywordRankingOverview[res.keywordRankingOverview.length - 1];
                    if (match) {
                        top10 = match.top10 ?? 0;
                        top20 = match.top20 ?? 0;
                        top30Above = match.top30Above ?? 0;
                    }
                }
                setKeywordRankingList(prevList => {
                    const list = [...prevList];
                    list[index] = {
                        month: monthStr,
                        top10,
                        top20,
                        top30Above
                    };
                    return list;
                });
                message.success(`Fetched metrics for ${monthStr}`);
            } catch (err) {
                console.error('Error fetching month data:', err);
            }
        }
    };

    const handleOpenAddMonthModal = () => {
        setSelectedMonthToAdd(null);
        setAddMonthModalVisible(true);
    };

    const handleConfirmAddMonth = async () => {
        if (!selectedMonthToAdd) {
            message.warning('Please select a month to add');
            return;
        }

        const monthStr = selectedMonthToAdd.format('MMM YYYY');
        const m = selectedMonthToAdd.month() + 1;
        const y = selectedMonthToAdd.year();

        setAddingMonthLoading(true);
        try {
            let top10 = 0, top20 = 0, top30Above = 0;
            if (selectedClient) {
                const res = await getMonthlyHighlights(selectedClient, m, y);
                if (res && res.keywordRankingOverview && Array.isArray(res.keywordRankingOverview) && res.keywordRankingOverview.length > 0) {
                    const match = res.keywordRankingOverview.find(r => r.month === monthStr) || res.keywordRankingOverview[res.keywordRankingOverview.length - 1];
                    if (match) {
                        top10 = match.top10 ?? 0;
                        top20 = match.top20 ?? 0;
                        top30Above = match.top30Above ?? 0;
                    }
                }
            }

            setKeywordRankingList(prevList => [
                ...prevList,
                { month: monthStr, top10, top20, top30Above }
            ]);

            message.success(`Added ${monthStr} with auto-fetched data`);
            setAddMonthModalVisible(false);
            setSelectedMonthToAdd(null);
        } catch (err) {
            console.error('Error fetching data for selected month:', err);
            message.error('Failed to fetch data for selected month');
        } finally {
            setAddingMonthLoading(false);
        }
    };

    const handleRemoveKeywordRankingRow = (index) => {
        setKeywordRankingList(keywordRankingList.filter((_, i) => i !== index));
    };

    const handleKeywordDetailChange = (index, field, value) => {
        const updated = [...keywordDetailsList];
        updated[index] = { ...updated[index], [field]: value };
        setKeywordDetailsList(updated);
    };

    const handleKeywordDetailMonthRankChange = (index, monthIdx, value) => {
        const updated = [...keywordDetailsList];
        const monthRanks = [...(updated[index].monthRanks || [])];
        monthRanks[monthIdx] = { ...monthRanks[monthIdx], rank: value };
        updated[index] = { ...updated[index], monthRanks };
        setKeywordDetailsList(updated);
    };

    const handleAddKeywordDetailRow = () => {
        const mStr = selectedDate.format('MMM YYYY');
        setKeywordDetailsList([
            ...keywordDetailsList,
            {
                keyword: '',
                volume: 0,
                category: 'General',
                monthRanks: [{ month: mStr, rank: '-' }]
            }
        ]);
    };

    const handleRemoveKeywordDetailRow = (index) => {
        setKeywordDetailsList(keywordDetailsList.filter((_, i) => i !== index));
    };

    const handleMetaInsightsFacebookChange = (index, field, value) => {
        const updated = [...metaInsightsFacebookList];
        updated[index] = { ...updated[index], [field]: value };
        setMetaInsightsFacebookList(updated);
    };

    const handleAddMetaInsightsFacebookRow = () => {
        const mStr = selectedDate.format('MMM YYYY');
        setMetaInsightsFacebookList([
            ...metaInsightsFacebookList,
            { month: mStr, views: 0, reach: 0, followers: 0 }
        ]);
    };

    const handleRemoveMetaInsightsFacebookRow = (index) => {
        setMetaInsightsFacebookList(metaInsightsFacebookList.filter((_, i) => i !== index));
    };

    const handleMetaInsightsInstagramChange = (index, field, value) => {
        const updated = [...metaInsightsInstagramList];
        updated[index] = { ...updated[index], [field]: value };
        setMetaInsightsInstagramList(updated);
    };

    const handleAddMetaInsightsInstagramRow = () => {
        const mStr = selectedDate.format('MMM YYYY');
        setMetaInsightsInstagramList([
            ...metaInsightsInstagramList,
            { month: mStr, views: 0, reach: 0, followers: 0 }
        ]);
    };

    const handleRemoveMetaInsightsInstagramRow = (index) => {
        setMetaInsightsInstagramList(metaInsightsInstagramList.filter((_, i) => i !== index));
    };

    const handleSave = async (status = 'Draft') => {
        try {
            const values = await form.validateFields();
            setSaving(true);
            const month = selectedDate.month() + 1;
            const year = selectedDate.year();

            const postDeliv = deliverablesList.find(d => d.name.toLowerCase().includes('social') || d.name.toLowerCase().includes('post') || d.name.toLowerCase().includes('poster'));
            const videoDeliv = deliverablesList.find(d => d.name.toLowerCase().includes('video'));

            const notesText = deliverablesList.length > 0
                ? deliverablesList.map(d => `${d.name} — ${d.completed} / ${d.total} Completed`).join('; ')
                : (values.brandCommNotes || '');

            const payload = {
                clientId: selectedClient,
                month,
                year,
                status,
                hasSocialMediaModule,
                digitalInsights: {
                    facebookFollowersIncreased: values.facebookFollowersIncreased || 0,
                    facebookTotalFollowers: values.facebookTotalFollowers || 0,
                    facebookReach: values.facebookReach || 0,
                    instagramFollowersIncreased: values.instagramFollowersIncreased || 0,
                    instagramTotalFollowers: values.instagramTotalFollowers || 0,
                    instagramReach: values.instagramReach || 0,
                },
                blogs: {
                    count: values.blogsCount || 0,
                    notes: values.blogsNotes || '',
                },
                brandCommunicationDesign: {
                    socialMediaPostDesignsCount: postDeliv ? postDeliv.completed : (values.socialMediaPostDesignsCount || 0),
                    videosCount: videoDeliv ? videoDeliv.completed : (values.videosCount || 0),
                    notes: notesText,
                    deliverables: deliverablesList.filter(d => d.name.trim() !== '')
                },
                offlineCollaterals: values.offlineCollaterals || '',
                specialInitiatives: values.specialInitiatives || '',
                keywordRankingOverview: keywordRankingList.filter(k => k.month && k.month.trim() !== ''),
                keywordRankingDetails: keywordDetailsList.filter(k => k.keyword && k.keyword.trim() !== ''),
                metaInsightsFacebook: metaInsightsFacebookList.filter(m => m.month && m.month.trim() !== ''),
                metaInsightsInstagram: metaInsightsInstagramList.filter(m => m.month && m.month.trim() !== '')
            };

            await upsertMonthlyHighlights(payload);
            message.success(`Monthly Highlights ${status === 'Published' ? 'Published' : 'Saved as Draft'} successfully!`);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving highlights:', error);
            message.error('Failed to save monthly highlights report');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={visible}
            onCancel={onClose}
            style={{ top: 24 }}
            styles={{ body: { maxHeight: 'calc(82vh - 120px)', overflowY: 'auto', paddingRight: 12, overflowX: 'hidden' } }}
            bodyStyle={{ maxHeight: 'calc(85vh - 120px)', overflowY: 'auto', paddingRight: 16, overflowX: 'hidden' }}
            style={{ top: 20 }}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <Sparkles size={22} color="var(--accent-primary)" />
                    </div>
                    <div>
                        <Title level={4} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>Highlights of the Month Editor</Title>
                        <Text type="secondary" style={{ fontSize: 13 }}>Management-level MoM Client Report Studio</Text>
                    </div>
                </div>
            }
            width={1100}
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
                    <Button icon={<RefreshCw size={15} />} onClick={() => loadData(selectedClient, selectedDate, true)} disabled={loading || saving} style={{ borderRadius: 8 }}>
                        Auto-Refetch Data
                    </Button>
                    <Space size="middle">
                        <Button onClick={onClose} style={{ borderRadius: 8 }}>Cancel</Button>
                        <Button icon={<Save size={15} />} onClick={() => handleSave('Draft')} loading={saving} style={{ borderRadius: 8 }}>
                            Save Draft
                        </Button>
                        <Button type="primary" icon={<Send size={15} />} onClick={() => handleSave('Published')} loading={saving} style={{ background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 600 }}>
                            Publish to Client
                        </Button>
                    </Space>
                </div>
            }
            destroyOnClose
        >
            <Spin spinning={loading}>
                <div style={{ marginBottom: 24, padding: 18, background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border-color)', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                        <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Client Account</Text>
                        <Select
                            style={{ width: '100%' }}
                            value={selectedClient}
                            onChange={setSelectedClient}
                            showSearch
                            placeholder="Select client account..."
                            optionFilterProp="children"
                            filterOption={(input, option) =>
                                String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        >
                            {clients.map(c => (
                                <Option key={c._id} value={c._id}>
                                    {c.companyName || c.name || c.brandName || 'Unnamed Client'}
                                </Option>
                            ))}
                        </Select>
                    </div>

                    <div style={{ minWidth: 200 }}>
                        <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Report Month & Year</Text>
                        <DatePicker
                            picker="month"
                            value={selectedDate}
                            onChange={date => date && setSelectedDate(date)}
                            allowClear={false}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>

                <Form form={form} layout="vertical">
                    {/* DIGITAL INSIGHTS (Social Media Module) */}
                    {hasSocialMediaModule && (
                        <Card
                            size="small"
                            title={
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Share2 size={16} color="#3b82f6" />
                                        <strong style={{ fontSize: 14 }}>Digital Insights (Social Media)</strong>
                                    </div>
                                    <Space size="small">
                                        <Text type="secondary" style={{ fontSize: 12 }}>Social Media Module Enabled</Text>
                                        <Switch size="small" checked={hasSocialMediaModule} onChange={setHasSocialMediaModule} />
                                    </Space>
                                </div>
                            }
                            style={{ marginBottom: 20, borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}
                        >
                            <Row gutter={[16, 0]}>
                                <Col span={4}>
                                    <Form.Item name="facebookFollowersIncreased" label="FB Followers Increased">
                                        <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                                    </Form.Item>
                                </Col>
                                <Col span={4}>
                                    <Form.Item name="facebookTotalFollowers" label="Total FB Followers">
                                        <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                                    </Form.Item>
                                </Col>
                                <Col span={4}>
                                    <Form.Item name="facebookReach" label="FB Reach">
                                        <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                                    </Form.Item>
                                </Col>
                                <Col span={4}>
                                    <Form.Item name="instagramFollowersIncreased" label="IG Followers Increased">
                                        <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                                    </Form.Item>
                                </Col>
                                <Col span={4}>
                                    <Form.Item name="instagramTotalFollowers" label="Total IG Followers">
                                        <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                                    </Form.Item>
                                </Col>
                                <Col span={4}>
                                    <Form.Item name="instagramReach" label="IG Reach">
                                        <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>
                    )}

                    {/* BLOGS */}
                    <Card
                        size="small"
                        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={16} color="#10b981" /><strong style={{ fontSize: 14 }}>Blogs & Articles</strong></div>}
                        style={{ marginBottom: 20, borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}
                    >
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

                    {/* BRAND COMMUNICATION DESIGN */}
                    <Card
                        size="small"
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Layers size={16} color="#8b5cf6" />
                                    <strong style={{ fontSize: 14 }}>Brand Communication & Deliverables</strong>
                                </div>
                                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={handleAddDeliverable} style={{ borderRadius: 6 }}>
                                    Add Deliverable
                                </Button>
                            </div>
                        }
                        style={{ marginBottom: 20, borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}
                    >
                        {deliverablesList.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                                {deliverablesList.map((item, idx) => (
                                    <Row key={idx} gutter={[16, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                                        <Col span={10}>
                                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Deliverable Name</Text>
                                            <Input
                                                placeholder="e.g. Social Media Post Designs"
                                                value={item.name}
                                                onChange={e => handleDeliverableChange(idx, 'name', e.target.value)}
                                            />
                                        </Col>
                                        <Col span={5}>
                                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Completed</Text>
                                            <InputNumber
                                                style={{ width: '100%' }}
                                                min={0}
                                                value={item.completed}
                                                onChange={val => handleDeliverableChange(idx, 'completed', val || 0)}
                                            />
                                        </Col>
                                        <Col span={5}>
                                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Target Total</Text>
                                            <InputNumber
                                                style={{ width: '100%' }}
                                                min={0}
                                                value={item.total}
                                                onChange={val => handleDeliverableChange(idx, 'total', val || 0)}
                                            />
                                        </Col>
                                        <Col span={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 14 }}>
                                            <Tag color="blue" style={{ margin: 0, fontWeight: 600, borderRadius: 6, padding: '2px 8px' }}>
                                                {item.completed} / {item.total}
                                            </Tag>
                                            <Button type="text" danger icon={<Trash2 size={16} />} onClick={() => handleRemoveDeliverable(idx)} />
                                        </Col>
                                    </Row>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 12 }}>
                                No specific deliverables detected for this client. Click "Add Deliverable" to add manually.
                            </div>
                        )}

                        <Form.Item name="brandCommNotes" label="Summary Notes (Optional)">
                            <Input placeholder="e.g., 8 / 10 Social Media Posts, 4 / 5 Videos, and 6 / 10 Blog Articles completed." />
                        </Form.Item>
                    </Card>

                    {/* OFFLINE COLLATERALS */}
                    <Card
                        size="small"
                        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Award size={16} color="#f59e0b" /><strong style={{ fontSize: 14 }}>Offline Collaterals & Branding</strong></div>}
                        style={{ marginBottom: 20, borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}
                    >
                        <Form.Item name="offlineCollaterals" label="Internal branding / collateral work completed">
                            <TextArea rows={2} placeholder="e.g., Clinic standees, patient feedback cards, doctor visiting cards designed." />
                        </Form.Item>
                    </Card>

                    {/* SPECIAL INITIATIVES */}
                    <Card
                        size="small"
                        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={16} color="#ec4899" /><strong style={{ fontSize: 14 }}>Special Initiatives & Campaigns</strong></div>}
                        style={{ marginBottom: 20, borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}
                    >
                        <Form.Item name="specialInitiatives" label="Special initiatives completed during the month">
                            <TextArea rows={2} placeholder="e.g., Free bone density checkup campaign branding & Google My Business local SEO drive." />
                        </Form.Item>
                    </Card>

                    {/* KEYWORD RANKING OVERVIEW */}
                    <Card
                        size="small"
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Sparkles size={16} color="#3b82f6" />
                                        <strong style={{ fontSize: 14 }}>Keyword Ranking Overview</strong>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                                        Purpose: Show overall organic keyword-ranking performance for the selected month and compare it with previous months.
                                    </Text>
                                </div>
                                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={handleOpenAddMonthModal} style={{ borderRadius: 6 }}>
                                    Add Month Row
                                </Button>
                            </div>
                        }
                        style={{ marginBottom: 20, borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {keywordRankingList.map((item, idx) => (
                                <Row key={idx} gutter={[16, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                                    <Col span={6}>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Month</Text>
                                        <DatePicker
                                            picker="month"
                                            format="MMM YYYY"
                                            value={item.month ? parseMonthStr(item.month) : null}
                                            onChange={dateVal => dateVal && handleKeywordRankingMonthChange(idx, dateVal)}
                                            style={{ width: '100%' }}
                                            allowClear={false}
                                        />
                                    </Col>
                                    <Col span={5}>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Top 10 (Pos 1–10)</Text>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            min={0}
                                            value={item.top10}
                                            onChange={val => handleKeywordRankingChange(idx, 'top10', val || 0)}
                                        />
                                    </Col>
                                    <Col span={5}>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Top 20 (Pos 1–20)</Text>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            min={0}
                                            value={item.top20}
                                            onChange={val => handleKeywordRankingChange(idx, 'top20', val || 0)}
                                        />
                                    </Col>
                                    <Col span={5}>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Top 30 Above</Text>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            min={0}
                                            value={item.top30Above}
                                            onChange={val => handleKeywordRankingChange(idx, 'top30Above', val || 0)}
                                        />
                                    </Col>
                                    <Col span={3} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 14 }}>
                                        <Button type="text" danger icon={<Trash2 size={16} />} onClick={() => handleRemoveKeywordRankingRow(idx)} />
                                    </Col>
                                </Row>
                            ))}
                        </div>
                    </Card>

                    {/* KEYWORD RANKING DETAILS */}
                    <Card
                        size="small"
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Sparkles size={16} color="#10b981" />
                                        <strong style={{ fontSize: 14 }}>Keyword Ranking Details</strong>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                                        Purpose: Granular organic keyword rankings, search volume, categories, and month-wise rank trends.
                                    </Text>
                                </div>
                                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={handleAddKeywordDetailRow} style={{ borderRadius: 6 }}>
                                    Add Keyword Detail
                                </Button>
                            </div>
                        }
                        style={{ marginBottom: 20, borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {keywordDetailsList.length > 0 ? (
                                keywordDetailsList.map((item, idx) => (
                                    <Card key={idx} size="small" style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                                        <Row gutter={[16, 8]} align="middle" style={{ marginBottom: 10 }}>
                                            <Col span={10}>
                                                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Keyword Name</Text>
                                                <Input
                                                    placeholder="e.g. Geriatric Care Services"
                                                    value={item.keyword}
                                                    onChange={e => handleKeywordDetailChange(idx, 'keyword', e.target.value)}
                                                />
                                            </Col>
                                            <Col span={8}>
                                                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Keyword Category</Text>
                                                <Input
                                                    placeholder="e.g. Geriatric Care / Elder Care / Home Nursing Services"
                                                    value={item.category}
                                                    onChange={e => handleKeywordDetailChange(idx, 'category', e.target.value)}
                                                />
                                            </Col>
                                            <Col span={4}>
                                                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Volume</Text>
                                                <InputNumber
                                                    style={{ width: '100%' }}
                                                    min={0}
                                                    value={item.volume}
                                                    onChange={val => handleKeywordDetailChange(idx, 'volume', val || 0)}
                                                />
                                            </Col>
                                            <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 14 }}>
                                                <Button type="text" danger icon={<Trash2 size={16} />} onClick={() => handleRemoveKeywordDetailRow(idx)} />
                                            </Col>
                                        </Row>
                                        <div>
                                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 500 }}>Month-wise Rank Progression</Text>
                                            <Row gutter={[10, 8]}>
                                                {(item.monthRanks || []).map((mr, mIdx) => (
                                                    <Col key={mIdx} span={4}>
                                                        <Text style={{ fontSize: 11, display: 'block', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{mr.month}</Text>
                                                        <Input
                                                            size="small"
                                                            placeholder="Rank"
                                                            value={mr.rank}
                                                            onChange={e => handleKeywordDetailMonthRankChange(idx, mIdx, e.target.value)}
                                                        />
                                                    </Col>
                                                ))}
                                            </Row>
                                        </div>
                                    </Card>
                                ))
                            ) : (
                                <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                                    No live tracked keywords detected for this client. Click "Add Keyword Detail" to add manually or configure Position Tracking in SEO/AEO/GEO module.
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* META INSIGHTS – FACEBOOK */}
                    <Card
                        size="small"
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Share2 size={16} color="#1877f2" />
                                    <strong style={{ fontSize: 14 }}>Meta Insights – Facebook</strong>
                                </div>
                                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={handleAddMetaInsightsFacebookRow} style={{ borderRadius: 6 }}>
                                    Add Month Row
                                </Button>
                            </div>
                        }
                        style={{ marginBottom: 20, borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}
                    >
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                            Purpose: Show monthly Facebook performance (views, reach, and followers).
                        </Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {metaInsightsFacebookList.map((item, idx) => (
                                <Row key={idx} gutter={[16, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                                    <Col span={6}>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Month</Text>
                                        <Input
                                            placeholder="e.g. Sep 2026"
                                            value={item.month}
                                            onChange={e => handleMetaInsightsFacebookChange(idx, 'month', e.target.value)}
                                        />
                                    </Col>
                                    <Col span={5}>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Facebook Views</Text>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            min={0}
                                            value={item.views}
                                            onChange={val => handleMetaInsightsFacebookChange(idx, 'views', val || 0)}
                                        />
                                    </Col>
                                    <Col span={5}>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Facebook Reach</Text>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            min={0}
                                            value={item.reach}
                                            onChange={val => handleMetaInsightsFacebookChange(idx, 'reach', val || 0)}
                                        />
                                    </Col>
                                    <Col span={5}>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Facebook Followers</Text>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            min={0}
                                            value={item.followers}
                                            onChange={val => handleMetaInsightsFacebookChange(idx, 'followers', val || 0)}
                                        />
                                    </Col>
                                    <Col span={3} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 14 }}>
                                        <Button type="text" danger icon={<Trash2 size={16} />} onClick={() => handleRemoveMetaInsightsFacebookRow(idx)} />
                                    </Col>
                                </Row>
                            ))}
                        </div>
                    </Card>

                    {/* META INSIGHTS – INSTAGRAM */}
                    <Card
                        size="small"
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Share2 size={16} color="#e1306c" />
                                    <strong style={{ fontSize: 14 }}>Meta Insights – Instagram</strong>
                                </div>
                                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={handleAddMetaInsightsInstagramRow} style={{ borderRadius: 6 }}>
                                    Add Month Row
                                </Button>
                            </div>
                        }
                        style={{ marginBottom: 20, borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}
                    >
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                            Purpose: Show monthly Instagram performance (views, reach, and followers).
                        </Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {metaInsightsInstagramList.map((item, idx) => (
                                <Row key={idx} gutter={[16, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                                    <Col span={6}>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Month</Text>
                                        <Input
                                            placeholder="e.g. Sep 2026"
                                            value={item.month}
                                            onChange={e => handleMetaInsightsInstagramChange(idx, 'month', e.target.value)}
                                        />
                                    </Col>
                                    <Col span={5}>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Instagram Views</Text>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            min={0}
                                            value={item.views}
                                            onChange={val => handleMetaInsightsInstagramChange(idx, 'views', val || 0)}
                                        />
                                    </Col>
                                    <Col span={5}>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Instagram Reach</Text>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            min={0}
                                            value={item.reach}
                                            onChange={val => handleMetaInsightsInstagramChange(idx, 'reach', val || 0)}
                                        />
                                    </Col>
                                    <Col span={5}>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Instagram Followers</Text>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            min={0}
                                            value={item.followers}
                                            onChange={val => handleMetaInsightsInstagramChange(idx, 'followers', val || 0)}
                                        />
                                    </Col>
                                    <Col span={3} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 14 }}>
                                        <Button type="text" danger icon={<Trash2 size={16} />} onClick={() => handleRemoveMetaInsightsInstagramRow(idx)} />
                                    </Col>
                                </Row>
                            ))}
                        </div>
                    </Card>
                </Form>

                <Modal
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Sparkles size={18} color="var(--accent-primary)" />
                            <span>Select Month to Add</span>
                        </div>
                    }
                    open={addMonthModalVisible}
                    onCancel={() => setAddMonthModalVisible(false)}
                    onOk={handleConfirmAddMonth}
                    okText="Add & Fetch Data"
                    confirmLoading={addingMonthLoading}
                    width={420}
                    destroyOnClose
                    centered
                >
                    <div style={{ padding: '16px 0 8px 0' }}>
                        <Text style={{ display: 'block', marginBottom: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                            Select the month you would like to add to the Keyword Ranking Overview table:
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                            Month & Year
                        </Text>
                        <DatePicker
                            picker="month"
                            format="MMM YYYY"
                            value={selectedMonthToAdd}
                            onChange={setSelectedMonthToAdd}
                            style={{ width: '100%' }}
                            placeholder="Click to pick month..."
                        />
                    </div>
                </Modal>
            </Spin>
        </Modal>
    );
};

export default MonthlyHighlightsEditorModal;
