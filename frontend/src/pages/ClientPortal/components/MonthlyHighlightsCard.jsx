import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, DatePicker, Button, Tag, Empty, Spin, message } from 'antd';
import { Download, Calendar, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import dayjs from 'dayjs';
import { getMonthlyHighlights } from '../../../api/reportApi';
import { generateMonthlyHighlightsPDF } from '../../../utils/monthlyHighlightsPdfGenerator';
import { exportToCSV } from '../../../utils/exportUtils';

const { Title, Text } = Typography;

const MonthlyHighlightsCard = ({ clientId, clientName, initialDate }) => {
    const [selectedDate, setSelectedDate] = useState(initialDate || dayjs());
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);

    useEffect(() => {
        if (initialDate) {
            setSelectedDate(initialDate);
        }
    }, [initialDate]);

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
                ? reportData.brandCommunicationDesign.deliverables.map(d => `${d.name} — Total: ${d.total || 0}, Completed: ${d.completed || 0}, Remaining: ${d.remaining ?? Math.max(0, (d.total || 0) - (d.completed || 0))}`).join('; ')
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

    const socialMediaPostInsightsColumns = [
        {
            title: 'Type of Post',
            dataIndex: 'typeOfPost',
            key: 'typeOfPost',
            width: '50%',
            render: text => <strong style={{ color: 'var(--text-primary)', fontSize: 13.5 }}>{text}</strong>
        },
        {
            title: 'Number of Post Published',
            dataIndex: 'numberPublished',
            key: 'numberPublished',
            width: '50%',
            align: 'center',
            render: (val, record) => (
                <Tag color={record.key === 'total' ? 'purple' : 'blue'} style={{ fontSize: 13, padding: '3px 12px', fontWeight: 700 }}>
                    {val || 0}
                </Tag>
            )
        }
    ];

    const websiteTrafficColumns = [
        {
            title: 'Month',
            dataIndex: 'month',
            key: 'month',
            width: '34%',
            render: text => <strong style={{ color: 'var(--text-primary)', fontSize: 13.5 }}>{text}</strong>
        },
        {
            title: 'Users (Total users)',
            dataIndex: 'users',
            key: 'users',
            width: '33%',
            align: 'right',
            render: val => <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        },
        {
            title: 'New Users (New users)',
            dataIndex: 'newUsers',
            key: 'newUsers',
            width: '33%',
            align: 'right',
            render: val => <span style={{ fontWeight: 700, color: '#0284c7' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        }
    ];

    const websiteTrafficLandingPagesColumns = [
        {
            title: 'Page path / screen class',
            dataIndex: 'pagePath',
            key: 'pagePath',
            width: '32%',
            render: text => <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{text}</strong>
        },
        {
            title: 'Views',
            dataIndex: 'views',
            key: 'views',
            width: '13%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        },
        {
            title: 'Active users',
            dataIndex: 'activeUsers',
            key: 'activeUsers',
            width: '13%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600, color: '#3b82f6' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        },
        {
            title: 'Views / Active user',
            dataIndex: 'viewsPerActiveUser',
            key: 'viewsPerActiveUser',
            width: '14%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600 }}>{val !== undefined ? Number(val).toFixed(2) : '0.00'}</span>
        },
        {
            title: 'Avg engagement time',
            dataIndex: 'avgEngagementTime',
            key: 'avgEngagementTime',
            width: '15%',
            align: 'right',
            render: text => <span style={{ fontWeight: 600, color: '#10b981' }}>{text || '0s'}</span>
        },
        {
            title: 'Event count',
            dataIndex: 'eventCount',
            key: 'eventCount',
            width: '13%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600, color: '#8b5cf6' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        }
    ];

    const websiteTrafficUsersByCityColumns = [
        {
            title: 'City',
            dataIndex: 'city',
            key: 'city',
            width: '18%',
            render: text => <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{text || '(not set)'}</strong>
        },
        {
            title: 'Active users',
            dataIndex: 'activeUsers',
            key: 'activeUsers',
            width: '10%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600, color: '#3b82f6' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        },
        {
            title: 'New users',
            dataIndex: 'newUsers',
            key: 'newUsers',
            width: '9%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600, color: '#0284c7' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        },
        {
            title: 'Engaged sessions',
            dataIndex: 'engagedSessions',
            key: 'engagedSessions',
            width: '10%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600 }}>{val ? Number(val).toLocaleString() : '0'}</span>
        },
        {
            title: 'Engagement rate',
            dataIndex: 'engagementRate',
            key: 'engagementRate',
            width: '10%',
            align: 'right',
            render: text => <span style={{ fontWeight: 600, color: '#10b981' }}>{text || '0.0%'}</span>
        },
        {
            title: 'Engaged sessions / User',
            dataIndex: 'engagedSessionsPerActiveUser',
            key: 'engagedSessionsPerActiveUser',
            width: '11%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600 }}>{val !== undefined ? Number(val).toFixed(2) : '0.00'}</span>
        },
        {
            title: 'Avg engagement time',
            dataIndex: 'avgEngagementTime',
            key: 'avgEngagementTime',
            width: '11%',
            align: 'right',
            render: text => <span style={{ fontWeight: 600, color: '#0ea5e9' }}>{text || '0s'}</span>
        },
        {
            title: 'Event count',
            dataIndex: 'eventCount',
            key: 'eventCount',
            width: '9%',
            align: 'right',
            render: val => <span style={{ fontWeight: 600, color: '#8b5cf6' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        },
        {
            title: 'Key events',
            dataIndex: 'keyEvents',
            key: 'keyEvents',
            width: '8%',
            align: 'right',
            render: val => <span style={{ fontWeight: 700, color: '#ec4899' }}>{val ? Number(val).toLocaleString() : '0'}</span>
        },
        {
            title: 'User key event rate',
            dataIndex: 'userKeyEventRate',
            key: 'userKeyEventRate',
            width: '9%',
            align: 'right',
            render: text => <span style={{ fontWeight: 600, color: '#f59e0b' }}>{text || '0.0%'}</span>
        }
    ];

    const isSectionPublished = (sectionName) => {
        if (!reportData) return false;
        const publishedList = reportData.publishedReportTypes || [];
        if ((!reportData.publishedReportTypes || reportData.publishedReportTypes.length === 0) && 
            (reportData.status === 'Sent' || reportData.status === 'Published' || reportData.isSentToClient)) {
            return true;
        }
        return publishedList.some(t => {
            const lower = (t || '').toLowerCase();
            if (sectionName === 'Highlights of the Month') return lower.includes('highlight');
            if (sectionName === 'Keywords') return lower.includes('keyword');
            if (sectionName === 'Meta Insights') return lower.includes('meta insights') || lower.includes('facebook') || lower.includes('instagram');
            if (sectionName === 'Social Media Post Insights') return lower.includes('social media') || lower.includes('youtube') || lower.includes('post insights');
            if (sectionName === 'Website Traffic') return lower.includes('website traffic') || lower.includes('traffic');
            if (sectionName === 'Meta Campaign') return lower.includes('meta campaign') || lower.includes('lead') || lower.includes('reach');
            return false;
        });
    };

    const hasAnyPublishedSection = reportData && (
        isSectionPublished('Highlights of the Month') ||
        isSectionPublished('Keywords') ||
        isSectionPublished('Meta Insights') ||
        isSectionPublished('Social Media Post Insights') ||
        isSectionPublished('Website Traffic') ||
        isSectionPublished('Meta Campaign')
    );

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
                        {reportData && hasAnyPublishedSection && (
                            <Tag color="success" style={{ borderRadius: 12, border: 'none', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 600 }}>
                                <CheckCircle2 size={12} style={{ marginRight: 4, display: 'inline' }} /> Published
                            </Tag>
                        )}
                    </div>
                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                        Management-level summary of digital highlights and Month-on-Month organic performance.
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
                    {reportData && hasAnyPublishedSection && (
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
                {reportData && hasAnyPublishedSection ? (
                    <div>
                        {/* HIGHLIGHTS OF THE MONTH */}
                        {isSectionPublished('Highlights of the Month') && (
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
                        )}

                        {/* KEYWORD RANKING OVERVIEW */}
                        {isSectionPublished('Keywords') && (
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
                        )}

                        {/* KEYWORD RANKING DETAILS */}
                        {isSectionPublished('Keywords') && (
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
                                    pagination={{
                                        pageSize: 10,
                                        showSizeChanger: true,
                                        pageSizeOptions: ['5', '10', '20', '50', '100'],
                                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} keywords`
                                    }}
                                    bordered
                                    size="middle"
                                    rowKey="keyword"
                                    style={{ borderRadius: 10, overflow: 'hidden' }}
                                />
                            </div>
                        )}

                        {/* META INSIGHTS – FACEBOOK */}
                        {isSectionPublished('Meta Insights') && (
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
                        )}

                        {/* META INSIGHTS – INSTAGRAM */}
                        {isSectionPublished('Meta Insights') && (
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
                        )}

                        {/* 3.12 SOCIAL MEDIA POST INSIGHTS */}
                        {isSectionPublished('Social Media Post Insights') && (
                            <div style={{ marginTop: 28, padding: 20, background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(236, 72, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Sparkles size={16} color="#ec4899" />
                                        </div>
                                        <Title level={5} style={{ margin: 0, color: 'var(--accent-primary)', fontWeight: 700 }}>3.12 Social Media Post Insights</Title>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginLeft: 38 }}>
                                        Purpose: Track the number of social media contents published during the month.
                                    </Text>
                                </div>
                                <Table
                                    columns={socialMediaPostInsightsColumns}
                                    dataSource={[
                                        {
                                            key: 'video',
                                            typeOfPost: 'Video',
                                            numberPublished: reportData.socialMediaPostInsights?.videoCount ?? reportData.brandCommunicationDesign?.videosCount ?? 0
                                        },
                                        {
                                            key: 'post',
                                            typeOfPost: 'Post',
                                            numberPublished: reportData.socialMediaPostInsights?.postCount ?? reportData.brandCommunicationDesign?.socialMediaPostDesignsCount ?? 0
                                        },
                                        {
                                            key: 'total',
                                            typeOfPost: 'Total Content Published',
                                            numberPublished: reportData.socialMediaPostInsights?.totalCount ?? (
                                                (reportData.socialMediaPostInsights?.videoCount ?? reportData.brandCommunicationDesign?.videosCount ?? 0) +
                                                (reportData.socialMediaPostInsights?.postCount ?? reportData.brandCommunicationDesign?.socialMediaPostDesignsCount ?? 0)
                                            )
                                        }
                                    ]}
                                    pagination={false}
                                    bordered
                                    size="middle"
                                    rowKey="key"
                                    style={{ borderRadius: 10, overflow: 'hidden' }}
                                />
                            </div>
                        )}

                        {/* 3.14 YOUTUBE REPORT */}
                        {isSectionPublished('Social Media Post Insights') && (
                            <div style={{ marginTop: 28, padding: 20, background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Sparkles size={16} color="#ef4444" />
                                        </div>
                                        <Title level={5} style={{ margin: 0, color: 'var(--accent-primary)', fontWeight: 700 }}>3.14 YouTube Report</Title>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginLeft: 38 }}>
                                        Purpose: Simple monthly YouTube performance reporting.
                                    </Text>
                                </div>
                                <Table
                                    columns={[
                                        { title: 'Field', dataIndex: 'field', key: 'field', render: text => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
                                        { title: 'Requirement', dataIndex: 'requirement', key: 'requirement', align: 'center', render: val => <Tag color="blue" style={{ fontSize: 13, padding: '3px 12px', fontWeight: 700 }}>{val}</Tag> }
                                    ]}
                                    dataSource={(() => {
                                        const ytItem = Array.isArray(reportData.youTubeReport) && reportData.youTubeReport.length > 0 
                                            ? reportData.youTubeReport[0] 
                                            : (reportData.youTubeReport || {});
                                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                        const monthStr = ytItem.month || `${monthNames[(selectedDate?.month() || 0)]} ${selectedDate?.year() || 2026}`;
                                        const views = ytItem.views ?? 0;
                                        const lastMonthSubs = ytItem.lastMonthSubscribers ?? 0;
                                        const totalSubs = ytItem.totalSubscribers ?? 0;
                                        return [
                                            { key: 'month', field: 'Month', requirement: String(monthStr) },
                                            { key: 'views', field: 'Views', requirement: typeof views === 'number' ? views.toLocaleString() : String(views) },
                                            { key: 'lastMonthSubscribers', field: 'Last Month Subscribers', requirement: typeof lastMonthSubs === 'number' ? lastMonthSubs.toLocaleString() : String(lastMonthSubs) },
                                            { key: 'totalSubscribers', field: 'Total Subscribers', requirement: typeof totalSubs === 'number' ? totalSubs.toLocaleString() : String(totalSubs) }
                                        ];
                                    })()}
                                    pagination={false}
                                    bordered
                                    size="middle"
                                    rowKey="key"
                                    style={{ borderRadius: 10, overflow: 'hidden' }}
                                />
                            </div>
                        )}

                        {/* WEBSITE TRAFFIC */}
                        {isSectionPublished('Website Traffic') && (
                            <>
                                {/* WEBSITE TRAFFIC – OVERVIEW */}
                                {reportData.websiteTrafficOverview && reportData.websiteTrafficOverview.length > 0 && (
                                    <div style={{ marginTop: 28, padding: 20, background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(2, 132, 199, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Sparkles size={16} color="#0284c7" />
                                                </div>
                                                <Title level={5} style={{ margin: 0, color: 'var(--accent-primary)', fontWeight: 700 }}>Website Traffic – Overview</Title>
                                            </div>
                                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginLeft: 38 }}>
                                                Purpose: Show monthly website traffic trend (Users & New Users) from Google Analytics.
                                            </Text>
                                        </div>
                                        <Table
                                            columns={websiteTrafficColumns}
                                            dataSource={reportData.websiteTrafficOverview}
                                            pagination={{ pageSize: 5, showSizeChanger: true, pageSizeOptions: ['5', '10', '20', '50'] }}
                                            scroll={{ x: 'max-content', y: 350 }}
                                            bordered
                                            size="middle"
                                            rowKey={(record, index) => record.month || index}
                                            style={{ borderRadius: 10, overflow: 'hidden' }}
                                        />
                                    </div>
                                )}

                                {/* WEBSITE TRAFFIC – LANDING PAGE VIEWS */}
                                {reportData.websiteTrafficLandingPages && reportData.websiteTrafficLandingPages.length > 0 && (
                                    <div style={{ marginTop: 28, padding: 20, background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Sparkles size={16} color="#0ea5e9" />
                                                </div>
                                                <Title level={5} style={{ margin: 0, color: 'var(--accent-primary)', fontWeight: 700 }}>Website Traffic – Landing Page Views</Title>
                                            </div>
                                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginLeft: 38 }}>
                                                Purpose: Show which website pages receive the most traffic and engagement from Google Analytics.
                                            </Text>
                                        </div>
                                        <Table
                                            columns={websiteTrafficLandingPagesColumns}
                                            dataSource={reportData.websiteTrafficLandingPages}
                                            pagination={{ pageSize: 5, showSizeChanger: true, pageSizeOptions: ['5', '10', '20', '50'] }}
                                            scroll={{ x: 'max-content', y: 350 }}
                                            bordered
                                            size="middle"
                                            rowKey={(record, index) => record.pagePath || index}
                                            style={{ borderRadius: 10, overflow: 'hidden' }}
                                        />
                                    </div>
                                )}

                                {/* WEBSITE TRAFFIC – USERS BY CITY */}
                                {reportData.websiteTrafficUsersByCity && reportData.websiteTrafficUsersByCity.length > 0 && (
                                    <div style={{ marginTop: 28, padding: 20, background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(2, 132, 199, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Sparkles size={16} color="#0284c7" />
                                                </div>
                                                <Title level={5} style={{ margin: 0, color: 'var(--accent-primary)', fontWeight: 700 }}>Website Traffic – Users by City</Title>
                                            </div>
                                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginLeft: 38 }}>
                                                Purpose: Show website audience and engagement by city from Google Analytics.
                                            </Text>
                                        </div>
                                        <Table
                                            columns={websiteTrafficUsersByCityColumns}
                                            dataSource={reportData.websiteTrafficUsersByCity}
                                            pagination={{ pageSize: 5, showSizeChanger: true, pageSizeOptions: ['5', '10', '20', '50'] }}
                                            scroll={{ x: 'max-content', y: 350 }}
                                            bordered
                                            size="middle"
                                            rowKey={(record, index) => record.city || index}
                                            style={{ borderRadius: 10, overflow: 'hidden' }}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ) : (
                    <div style={{ padding: '40px 0', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 12, border: '1px border-dashed var(--border-color)' }}>
                        <Sparkles size={32} color="var(--text-tertiary)" style={{ marginBottom: 12 }} />
                        <Title level={5} style={{ margin: 0, color: 'var(--text-secondary)' }}>No Published Reports Available</Title>
                        <Text type="secondary">No report has been sent or published for {selectedDate.format('MMMM YYYY')} yet.</Text>
                    </div>
                )}
            </Spin>
        </Card>
    );
};

export default MonthlyHighlightsCard;
