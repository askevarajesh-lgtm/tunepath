import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, DatePicker, Button, Tag, Empty, Spin, message } from 'antd';
import { Download, Calendar, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import dayjs from 'dayjs';
import { getMonthlyHighlights } from '../../../api/reportApi';
import { generateMonthlyHighlightsPDF } from '../../../utils/monthlyHighlightsPdfGenerator';
import { exportToCSV } from '../../../utils/exportUtils';

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

    const handleDownloadCsv = () => {
        if (!reportData) return;
        const overviewCols = [
            { title: 'Month', dataIndex: 'month' },
            { title: 'Keywords Ranking Top 10', dataIndex: 'top10' },
            { title: 'Keywords Ranking Top 20', dataIndex: 'top20' },
            { title: 'Keywords Ranking Top 30 Above', dataIndex: 'top30Above' }
        ];
        exportToCSV(reportData.keywordRankingOverview || [], overviewCols, `Keyword_Ranking_Overview_${selectedDate.format('MMM_YYYY')}.csv`);

        if (reportData.keywordRankingDetails && reportData.keywordRankingDetails.length > 0) {
            const detailRows = reportData.keywordRankingDetails.map(kd => {
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
                { title: 'Keyword Category', dataIndex: 'Category' },
                { title: 'Volume', dataIndex: 'Volume' },
                ...(reportData.keywordRankingDetails[0]?.monthRanks || []).map(mr => ({ title: mr.month, dataIndex: mr.month }))
            ];
            exportToCSV(detailRows, detailCols, `Keyword_Ranking_Details_${selectedDate.format('MMM_YYYY')}.csv`);
        }

        if (reportData.metaInsightsFacebook && reportData.metaInsightsFacebook.length > 0) {
            const metaCols = [
                { title: 'Month', dataIndex: 'month' },
                { title: 'Facebook Views', dataIndex: 'views' },
                { title: 'Facebook Reach', dataIndex: 'reach' },
                { title: 'Facebook Followers', dataIndex: 'followers' }
            ];
            exportToCSV(reportData.metaInsightsFacebook, metaCols, `Meta_Insights_Facebook_${selectedDate.format('MMM_YYYY')}.csv`);
        }

        if (reportData.metaInsightsInstagram && reportData.metaInsightsInstagram.length > 0) {
            const metaCols = [
                { title: 'Month', dataIndex: 'month' },
                { title: 'Instagram Views', dataIndex: 'views' },
                { title: 'Instagram Reach', dataIndex: 'reach' },
                { title: 'Instagram Followers', dataIndex: 'followers' }
            ];
            exportToCSV(reportData.metaInsightsInstagram, metaCols, `Meta_Insights_Instagram_${selectedDate.format('MMM_YYYY')}.csv`);
        }
        message.success('Report CSV files downloaded successfully');
    };

    const keywordColumns = [
        {
            title: 'Month',
            dataIndex: 'month',
            key: 'month',
            width: '25%',
            render: text => <strong style={{ color: 'var(--text-primary)', fontSize: 13.5 }}>{text}</strong>
        },
        {
            title: 'Keywords Ranking Top 10',
            dataIndex: 'top10',
            key: 'top10',
            width: '25%',
            align: 'center',
            render: val => <Tag color="blue" style={{ fontSize: 13, padding: '2px 10px', fontWeight: 700 }}>{val || 0}</Tag>
        },
        {
            title: 'Keywords Ranking Top 20',
            dataIndex: 'top20',
            key: 'top20',
            width: '25%',
            align: 'center',
            render: val => <Tag color="purple" style={{ fontSize: 13, padding: '2px 10px', fontWeight: 700 }}>{val || 0}</Tag>
        },
        {
            title: 'Keywords Ranking Top 30 Above',
            dataIndex: 'top30Above',
            key: 'top30Above',
            width: '25%',
            align: 'center',
            render: val => <Tag color="cyan" style={{ fontSize: 13, padding: '2px 10px', fontWeight: 700 }}>{val || 0}</Tag>
        }
    ];

    const getCategoryColor = (cat = '') => {
        const lower = cat.toLowerCase();
        if (lower.includes('geriatric')) return 'blue';
        if (lower.includes('elder')) return 'purple';
        if (lower.includes('nursing') || lower.includes('home')) return 'green';
        if (lower.includes('brand')) return 'magenta';
        return 'orange';
    };

    const keywordDetailsColumns = [
        {
            title: 'Keyword',
            dataIndex: 'keyword',
            key: 'keyword',
            width: '30%',
            render: text => <strong style={{ color: 'var(--text-primary)', fontSize: 13.5 }}>{text}</strong>
        },
        {
            title: 'Keyword Category',
            dataIndex: 'category',
            key: 'category',
            width: '25%',
            render: text => <Tag color={getCategoryColor(text)} style={{ borderRadius: 12, fontWeight: 600, padding: '2px 10px' }}>{text || 'General'}</Tag>
        },
        {
            title: 'Volume',
            dataIndex: 'volume',
            key: 'volume',
            width: '15%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        },
        {
            title: 'Month-wise Rank',
            dataIndex: 'monthRanks',
            key: 'monthRanks',
            width: '30%',
            render: (ranks = []) => (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ranks.map((mr, idx) => {
                        const numericRank = Number(mr.rank);
                        const isTop10 = numericRank > 0 && numericRank <= 10;
                        return (
                            <Tag key={idx} color={isTop10 ? 'success' : 'default'} style={{ fontSize: 11, fontWeight: 600, margin: 0 }}>
                                <span style={{ opacity: 0.75, marginRight: 4 }}>{mr.month.split(' ')[0]}:</span>
                                <strong style={{ color: isTop10 ? '#10b981' : 'inherit' }}>{mr.rank}</strong>
                            </Tag>
                        );
                    })}
                </div>
            )
        }
    ];

    const metaFacebookColumns = [
        {
            title: 'Month',
            dataIndex: 'month',
            key: 'month',
            width: '25%',
            render: text => <strong style={{ color: 'var(--text-primary)', fontSize: 13.5 }}>{text}</strong>
        },
        {
            title: 'Facebook Views',
            dataIndex: 'views',
            key: 'views',
            width: '25%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        },
        {
            title: 'Facebook Reach',
            dataIndex: 'reach',
            key: 'reach',
            width: '25%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600, color: '#3b82f6' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        },
        {
            title: 'Facebook Followers',
            dataIndex: 'followers',
            key: 'followers',
            width: '25%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600, color: '#10b981' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        }
    ];

    const metaInstagramColumns = [
        {
            title: 'Month',
            dataIndex: 'month',
            key: 'month',
            width: '25%',
            render: text => <strong style={{ color: 'var(--text-primary)', fontSize: 13.5 }}>{text}</strong>
        },
        {
            title: 'Instagram Views',
            dataIndex: 'views',
            key: 'views',
            width: '25%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        },
        {
            title: 'Instagram Reach',
            dataIndex: 'reach',
            key: 'reach',
            width: '25%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600, color: '#e1306c' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        },
        {
            title: 'Instagram Followers',
            dataIndex: 'followers',
            key: 'followers',
            width: '25%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600, color: '#10b981' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        }
    ];

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
                            Monthly Performance & Highlights
                        </Title>
                        {reportData && (
                            <Tag color="success" style={{ borderRadius: 12, border: 'none', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 600 }}>
                                <CheckCircle2 size={12} style={{ marginRight: 4, display: 'inline' }} /> Published
                            </Tag>
                        )}
                    </div>
                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                        Management-level summary of digital highlights and Month-on-Month organic keyword-ranking performance.
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
                        <>
                            <Button
                                icon={<Download size={14} />}
                                onClick={handleDownloadCsv}
                                style={{ borderRadius: 8, fontWeight: 600 }}
                            >
                                Download CSV
                            </Button>
                            <Button
                                type="primary"
                                icon={<Download size={14} />}
                                onClick={handleDownloadPdf}
                                style={{ borderRadius: 8, background: 'var(--accent-primary)', fontWeight: 600 }}
                            >
                                Export PDF
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* TABLE CONTENT */}
            <Spin spinning={loading}>
                {reportData ? (
                    <div>
                        {/* HIGHLIGHTS OF THE MONTH */}
                        <div style={{ marginBottom: 28, padding: 20, background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Sparkles size={16} color="var(--accent-primary)" />
                                </div>
                                <Title level={5} style={{ margin: 0, color: 'var(--accent-primary)', fontWeight: 700 }}>Highlights of the Month</Title>
                            </div>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16, marginLeft: 38 }}>
                                Purpose: Short management-level summary of completed digital marketing activities and deliverables.
                            </Text>
                            <Table
                                columns={columns}
                                dataSource={dataSource}
                                pagination={false}
                                bordered
                                size="middle"
                                rowClassName={() => 'hover-bg'}
                                style={{ borderRadius: 10, overflow: 'hidden' }}
                            />
                        </div>

                        {/* KEYWORD RANKING OVERVIEW */}
                        <div style={{ marginBottom: 28, padding: 20, background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Sparkles size={16} color="#10b981" />
                                    </div>
                                    <Title level={5} style={{ margin: 0, color: 'var(--accent-primary)', fontWeight: 700 }}>Keyword Ranking Overview</Title>
                                </div>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginLeft: 38 }}>
                                    Purpose: Show overall organic keyword-ranking performance for the selected month and compare it with previous months.
                                </Text>
                            </div>
                            <Table
                                columns={keywordColumns}
                                dataSource={reportData.keywordRankingOverview || []}
                                pagination={false}
                                bordered
                                size="middle"
                                rowKey="month"
                                style={{ borderRadius: 10, overflow: 'hidden' }}
                            />
                        </div>

                        {/* KEYWORD RANKING DETAILS */}
                        <div style={{ marginBottom: 28, padding: 20, background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Sparkles size={16} color="#8b5cf6" />
                                    </div>
                                    <Title level={5} style={{ margin: 0, color: 'var(--accent-primary)', fontWeight: 700 }}>Keyword Ranking Details</Title>
                                </div>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginLeft: 38 }}>
                                    Purpose: Track organic keyword rankings, search volume, categories, and month-wise rank trends.
                                </Text>
                            </div>
                            <Table
                                columns={keywordDetailsColumns}
                                dataSource={reportData.keywordRankingDetails || []}
                                pagination={false}
                                bordered
                                size="middle"
                                rowKey="keyword"
                                style={{ borderRadius: 10, overflow: 'hidden' }}
                            />
                        </div>

                        {/* META INSIGHTS – FACEBOOK */}
                        <div style={{ marginBottom: 28, padding: 20, background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(24, 119, 242, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Sparkles size={16} color="#1877f2" />
                                    </div>
                                    <Title level={5} style={{ margin: 0, color: 'var(--accent-primary)', fontWeight: 700 }}>Meta Insights – Facebook</Title>
                                </div>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginLeft: 38 }}>
                                    Purpose: Show monthly Facebook performance (views, reach, and followers).
                                </Text>
                            </div>
                            <Table
                                columns={metaFacebookColumns}
                                dataSource={reportData.metaInsightsFacebook || []}
                                pagination={false}
                                bordered
                                size="middle"
                                rowKey="month"
                                style={{ borderRadius: 10, overflow: 'hidden' }}
                            />
                        </div>

                        {/* META INSIGHTS – INSTAGRAM */}
                        <div style={{ padding: 20, background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(225, 48, 108, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Sparkles size={16} color="#e1306c" />
                                    </div>
                                    <Title level={5} style={{ margin: 0, color: 'var(--accent-primary)', fontWeight: 700 }}>Meta Insights – Instagram</Title>
                                </div>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginLeft: 38 }}>
                                    Purpose: Show monthly Instagram performance (views, reach, and followers).
                                </Text>
                            </div>
                            <Table
                                columns={metaInstagramColumns}
                                dataSource={reportData.metaInsightsInstagram || []}
                                pagination={false}
                                bordered
                                size="middle"
                                rowKey="month"
                                style={{ borderRadius: 10, overflow: 'hidden' }}
                            />
                        </div>
                    </div>
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
