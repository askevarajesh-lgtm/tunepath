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
    const [hasSocialMediaModule, setHasSocialMediaModule] = useState(false);

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
            bodyStyle={{ maxHeight: 'calc(82vh - 120px)', overflowY: 'auto', paddingRight: 12, overflowX: 'hidden' }}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Sparkles size={20} color="var(--accent-primary)" />
                    </div>
                    <div>
                        <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Highlights of the Month Editor</Title>
                        <Text type="secondary" style={{ fontSize: 13 }}>Management-level MoM Client Report (Section 3.1)</Text>
                    </div>
                </div>
            }
            width={850}
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Button icon={<RefreshCw size={14} />} onClick={() => loadData(selectedClient, selectedDate, true)} disabled={loading || saving}>
                        Auto-Refetch Data
                    </Button>
                    <Space>
                        <Button onClick={onClose}>Cancel</Button>
                        <Button icon={<Save size={14} />} onClick={() => handleSave('Draft')} loading={saving}>
                            Save Draft
                        </Button>
                        <Button type="primary" icon={<Send size={14} />} onClick={() => handleSave('Published')} loading={saving} style={{ background: 'var(--accent-primary)' }}>
                            Publish to Client
                        </Button>
                    </Space>
                </div>
            }
            destroyOnClose
        >
            <Spin spinning={loading}>
                <div style={{ marginBottom: 20, padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <Text style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Client Account</Text>
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

                    <div style={{ minWidth: 160 }}>
                        <Text style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Report Month & Year</Text>
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
                                        <strong style={{ fontSize: 14 }}>1. Digital Insights (Social Media)</strong>
                                    </div>
                                    <Space size="small">
                                        <Text type="secondary" style={{ fontSize: 12 }}>Social Media Module Enabled</Text>
                                        <Switch size="small" checked={hasSocialMediaModule} onChange={setHasSocialMediaModule} />
                                    </Space>
                                </div>
                            }
                            style={{ marginBottom: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}
                        >
                            <Row gutter={[16, 0]}>
                                <Col span={8}>
                                    <Form.Item name="facebookFollowersIncreased" label="FB Followers Increased">
                                        <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="facebookTotalFollowers" label="Total FB Followers">
                                        <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="facebookReach" label="FB Reach">
                                        <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                                    </Form.Item>
                                </Col>

                                <Col span={8}>
                                    <Form.Item name="instagramFollowersIncreased" label="IG Followers Increased">
                                        <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="instagramTotalFollowers" label="Total IG Followers">
                                        <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
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
                        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={16} color="#10b981" /><strong style={{ fontSize: 14 }}>2. Blogs</strong></div>}
                        style={{ marginBottom: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}
                    >
                        <Row gutter={[16, 0]}>
                            <Col span={8}>
                                <Form.Item name="blogsCount" label="Number of Blog Updates">
                                    <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                                </Form.Item>
                            </Col>
                            <Col span={16}>
                                <Form.Item name="blogsNotes" label="Blog Notes / Topics (Optional)">
                                    <Input placeholder="e.g., Published 2 articles on Orthopedic health tips" />
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
                                    <strong style={{ fontSize: 14 }}>3. Brand Communication Design & Deliverables</strong>
                                </div>
                                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={handleAddDeliverable}>
                                    Add Deliverable
                                </Button>
                            </div>
                        }
                        style={{ marginBottom: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}
                    >
                        {deliverablesList.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                                {deliverablesList.map((item, idx) => (
                                    <Row key={idx} gutter={[12, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
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
                                        <Col span={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 14 }}>
                                            <Tag color="blue" style={{ margin: 0, fontWeight: 600 }}>
                                                {item.completed} / {item.total}
                                            </Tag>
                                            <Button type="text" danger icon={<Trash2 size={15} />} onClick={() => handleRemoveDeliverable(idx)} />
                                        </Col>
                                    </Row>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 12 }}>
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
                        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Award size={16} color="#f59e0b" /><strong style={{ fontSize: 14 }}>4. Offline Collaterals</strong></div>}
                        style={{ marginBottom: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}
                    >
                        <Form.Item name="offlineCollaterals" label="Internal branding / collateral work completed">
                            <TextArea rows={2} placeholder="e.g., Clinic standees, patient feedback cards, doctor visiting cards designed." />
                        </Form.Item>
                    </Card>

                    {/* SPECIAL INITIATIVES */}
                    <Card
                        size="small"
                        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={16} color="#ec4899" /><strong style={{ fontSize: 14 }}>5. Special Initiatives</strong></div>}
                        style={{ marginBottom: 8, borderRadius: 12, border: '1px solid var(--border-color)' }}
                    >
                        <Form.Item name="specialInitiatives" label="Special initiatives completed during the month">
                            <TextArea rows={2} placeholder="e.g., Free bone density checkup campaign branding & Google My Business local SEO drive." />
                        </Form.Item>
                    </Card>
                </Form>
            </Spin>
        </Modal>
    );
};

export default MonthlyHighlightsEditorModal;
