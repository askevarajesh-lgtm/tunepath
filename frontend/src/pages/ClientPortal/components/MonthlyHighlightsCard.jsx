import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, DatePicker, Button, Tag, Empty, Spin, message } from 'antd';
import { Download, Calendar, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import dayjs from 'dayjs';
import { getMonthlyHighlights } from '../../../api/reportApi';
import { generateMonthlyHighlightsPDF } from '../../../utils/monthlyHighlightsPdfGenerator';

const { Title, Text } = Typography;

const MonthlyHighlightsCard = ({ clientId, clientName }) => {
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);

    const fetchHighlights = async (cId, dateVal) => {
        try {
            setLoading(true);
            const m = dateVal.month() + 1;
            const y = dateVal.year();
            const res = await getMonthlyHighlights(cId, m, y);
            if (res && res.status !== 'NotPublished') {
                setReportData(res);
            } else {
                setReportData(null);
            }
        } catch (error) {
            console.error('Error fetching monthly highlights for client:', error);
            setReportData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedDate) {
            fetchHighlights(clientId, selectedDate);
        }
    }, [clientId, selectedDate]);

    const handleDownloadPdf = () => {
        if (!reportData) return;
        try {
            generateMonthlyHighlightsPDF(reportData, { companyName: clientName });
            message.success('PDF report downloaded successfully');
        } catch (error) {
            console.error('PDF export error:', error);
            message.error('Failed to export PDF');
        }
    };

    // Format digital insights text
    const formatDigitalInsights = () => {
        if (!reportData?.digitalInsights) return 'No digital insights recorded.';
        const d = reportData.digitalInsights;
        return (
            <div style={{ lineHeight: 1.6 }}>
                <div>Facebook followers increased: <strong>{d.facebookFollowersIncreased ?? 0}</strong>; total followers: <strong>{d.facebookTotalFollowers ?? 0}</strong>; Facebook reach: <strong>{d.facebookReach ?? 0}</strong></div>
                <div>Instagram followers increased: <strong>{d.instagramFollowersIncreased ?? 0}</strong>; total followers: <strong>{d.instagramTotalFollowers ?? 0}</strong>; Instagram reach: <strong>{d.instagramReach ?? 0}</strong></div>
            </div>
        );
    };

    const columns = [
        {
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
            width: '30%',
            render: text => <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>{text}</strong>
        },
        {
            title: 'Information to Capture',
            dataIndex: 'info',
            key: 'info',
            width: '70%',
            render: text => <div style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>{text}</div>
        }
    ];

    const dataSource = reportData ? [
        ...(reportData.hasSocialMediaModule ? [{
            key: '1',
            category: 'Digital Insights',
            info: formatDigitalInsights()
        }] : []),
        {
            key: '2',
            category: 'Blogs',
            info: `Number of blog updates: ${reportData.blogs?.count ?? 0}${reportData.blogs?.notes ? ` (${reportData.blogs.notes})` : ''}`
        },
        {
            key: '3',
            category: 'Brand Communication Design',
            info: (reportData.brandCommunicationDesign?.deliverables && reportData.brandCommunicationDesign.deliverables.length > 0)
                ? reportData.brandCommunicationDesign.deliverables.map(d => `${d.name} — ${d.completed} / ${d.total} Completed`).join('; ')
                : (reportData.brandCommunicationDesign?.notes || `Number of social media post designs: ${reportData.brandCommunicationDesign?.socialMediaPostDesignsCount ?? 0}; number of videos: ${reportData.brandCommunicationDesign?.videosCount ?? 0}`)
        },
        {
            key: '4',
            category: 'Offline Collaterals',
            info: reportData.offlineCollaterals || 'Internal branding / collateral work completed'
        },
        {
            key: '5',
            category: 'Special Initiatives',
            info: reportData.specialInitiatives || 'Special initiatives completed during the month'
        }
    ] : [];

    return (
        <Card
            className="glassmorphism"
            style={{ borderRadius: 16, border: '1px solid var(--border-color)', marginBottom: 32, boxShadow: 'var(--shadow-sm)' }}
            bodyStyle={{ padding: 24 }}
        >
            {/* CARD HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Title level={4} style={{ margin: 0, fontWeight: 800, color: 'var(--accent-primary)' }}>
                            Highlights of the Month
                        </Title>
                        {reportData && (
                            <Tag color="success" style={{ borderRadius: 12, border: 'none', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 600 }}>
                                <CheckCircle2 size={12} style={{ marginRight: 4, display: 'inline' }} /> Published
                            </Tag>
                        )}
                    </div>
                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                        Purpose: Provide a short management-level summary of the month's completed digital/marketing activities.
                    </Text>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <DatePicker
                        picker="month"
                        value={selectedDate}
                        onChange={date => date && setSelectedDate(date)}
                        allowClear={false}
                        style={{ borderRadius: 8 }}
                    />
                    {reportData && (
                        <Button
                            type="primary"
                            icon={<Download size={14} />}
                            onClick={handleDownloadPdf}
                            style={{ borderRadius: 8, background: 'var(--accent-primary)', fontWeight: 600 }}
                        >
                            Export PDF
                        </Button>
                    )}
                </div>
            </div>

            {/* TABLE CONTENT */}
            <Spin spinning={loading}>
                {reportData ? (
                    <Table
                        columns={columns}
                        dataSource={dataSource}
                        pagination={false}
                        bordered
                        size="middle"
                        rowClassName={() => 'hover-bg'}
                        style={{ borderRadius: 8, overflow: 'hidden' }}
                    />
                ) : (
                    <div style={{ padding: '40px 0', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 12, border: '1px border-dashed var(--border-color)' }}>
                        <Sparkles size={32} color="var(--text-tertiary)" style={{ marginBottom: 12 }} />
                        <Title level={5} style={{ margin: 0, color: 'var(--text-secondary)' }}>No Monthly Highlights Report Available</Title>
                        <Text type="secondary">There is no published management summary report for {selectedDate.format('MMMM YYYY')}.</Text>
                    </div>
                )}
            </Spin>
        </Card>
    );
};

export default MonthlyHighlightsCard;
