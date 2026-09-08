import React, { useEffect, useMemo, useState } from "react";
import {
    CalendarOutlined,
    CommentOutlined,
    LikeOutlined,
    ShareAltOutlined,
} from "@ant-design/icons";
import { Button, Card, Empty, Input, Pagination, Space, Tag, Typography } from "antd";

const { Text, Title, Paragraph } = Typography;

const PAGE_SIZE_OPTIONS = ["5", "10", "20", "50"];

function getPostMetrics(post) {
    const likes = Number(post?.likes);
    const comments = Number(post?.comments);
    const shares = Number(post?.shares);

    if (
        [likes, comments, shares].every(
            (value) => Number.isFinite(value) && value >= 0,
        )
    ) {
        return { likes, comments, shares };
    }

    return { likes: 0, comments: 0, shares: 0 };
}

function getPlatformLabels(platformIds = [], accounts = []) {
    return platformIds.map((id) => {
        const account = accounts.find((item) => item.id === id);
        if (!account) return id;
        const platform = account.platform
            ? `${account.platform.charAt(0).toUpperCase()}${account.platform.slice(1)}`
            : "Platform";
        const name = account.page_name || account.username || account.id;
        return `${platform} (${name})`;
    });
}

function getScheduleText(post) {
    const date = post.scheduledDate || post.scheduled_date || "-";
    const time = post.scheduledTime || post.scheduled_time || "";
    return `${date}${time ? `, ${time}` : ""}`;
}

export default function CampaignLogsView({ posts = [], accounts = [] }) {
    const [query, setQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    const flattenedLogs = useMemo(() => {
        const logs = [];
        posts.forEach((post) => {
            if (post.status !== "Published" && post.status !== "Failed" && !post.platform_publications) return;

            const platforms = post.platforms || [];
            if (platforms.length === 0) {
                logs.push({ ...post, _logId: post.id, _platformStatus: post.status });
                return;
            }

            platforms.forEach((platformId) => {
                const pubInfo = (post.platform_publications || {})[platformId] || {};
                const pStatus = pubInfo.status || (post.status === "Published" ? "Published" : "Failed");

                if (pStatus !== "Published" && pStatus !== "Failed") return;

                const pubLikes = pubInfo.likes !== undefined && pubInfo.likes > 0 ? pubInfo.likes : (post.likes || 0);
                const pubComments = pubInfo.comments !== undefined && pubInfo.comments > 0 ? pubInfo.comments : (post.comments || 0);
                const pubShares = pubInfo.shares !== undefined && pubInfo.shares > 0 ? pubInfo.shares : (post.shares || 0);

                logs.push({
                    ...post,
                    _logId: `${post.id}-${platformId}`,
                    _platformId: platformId,
                    _platformStatus: pStatus,
                    _platformError: pubInfo.error || post.error_message,
                    _externalId: pubInfo.externalId,
                    _url: pubInfo.url,
                    likes: pubLikes,
                    comments: pubComments,
                    shares: pubShares,
                });
            });
        });
        return logs;
    }, [posts]);

    const filteredPosts = useMemo(() => {
        const search = query.trim().toLowerCase();
        if (!search) return flattenedLogs;

        return flattenedLogs.filter((log) => {
            return (
                (log.caption || "").toLowerCase().includes(search) ||
                (log.campaign || "").toLowerCase().includes(search)
            );
        });
    }, [flattenedLogs, query]);

    // Reset to first page when query changes
    useEffect(() => {
        setCurrentPage(1);
    }, [query]);

    const paginatedPosts = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredPosts.slice(start, start + pageSize);
    }, [filteredPosts, currentPage, pageSize]);

    return (
        <div className="campaign-logs-page">
            <div className="campaign-logs-head">
                <div>
                    <Title level={5} style={{ margin: 0 }}>
                        Campaign Logs
                    </Title>
                    <Text type="secondary">
                        Published posts with engagement performance
                    </Text>
                </div>
                <Input.Search
                    allowClear
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by caption or campaign"
                    className="campaign-logs-search"
                />
            </div>

            {filteredPosts.length === 0 ? (
                <Card className="campaign-scheduler-surface">
                    <Empty description="No published posts available for logs yet." />
                </Card>
            ) : (
                <>
                    <div className="campaign-logs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', marginTop: '16px' }}>
                        {paginatedPosts.map((log) => {
                            const metrics = getPostMetrics(log);
                            const platformLabels = log._platformId
                                ? getPlatformLabels([log._platformId], accounts)
                                : getPlatformLabels(log.platforms || [], accounts);

                            return (
                                <Card
                                    key={log._logId}
                                    className="campaign-log-card-premium"
                                    styles={{ body: { padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' } }}
                                    bordered={false}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <Text strong className="premium-card-title" style={{ fontSize: '16px', letterSpacing: '-0.3px', lineHeight: '1.2' }}>{log.campaign || "General Campaign"}</Text>
                                            <Text type="secondary" className="premium-card-subtitle" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <CalendarOutlined />
                                                {getScheduleText(log)}
                                            </Text>
                                        </div>
                                        {log._platformStatus === "Failed" ? (
                                            <Tag className="premium-tag-failed" style={{ margin: 0, border: 'none', borderRadius: '8px', padding: '4px 10px', fontWeight: 600 }}>Failed</Tag>
                                        ) : (
                                            <Tag className="premium-tag-success" style={{ margin: 0, border: 'none', borderRadius: '8px', padding: '4px 10px', fontWeight: 600 }}>Published</Tag>
                                        )}
                                    </div>

                                    <div style={{ flex: 1, marginTop: '4px' }}>
                                        <div style={{ marginBottom: '14px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {platformLabels.length > 0 ? (
                                                platformLabels.map((label, idx) => (
                                                    <Tag key={`${log._logId}-${idx}`} className="premium-platform-tag" style={{ margin: 0, borderRadius: '6px', padding: '2px 10px', fontWeight: 500, fontSize: '12px' }}>
                                                        {label}
                                                    </Tag>
                                                ))
                                            ) : (
                                                <Text type="secondary" style={{ fontSize: '12px' }}>No platforms</Text>
                                            )}
                                        </div>

                                        <Paragraph className="premium-card-text" style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                                            {log.caption || "No caption provided"}
                                        </Paragraph>

                                        {log._platformStatus === "Failed" && log._platformError && (
                                            <div className="premium-error-box" style={{ padding: '10px 14px', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                                                <Text type="danger" style={{ fontSize: '13px', fontWeight: 500 }}>
                                                    {log._platformError}
                                                </Text>
                                            </div>
                                        )}
                                    </div>

                                    <div className="premium-card-divider" style={{ paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Space size={20}>
                                            <span className="premium-metric">
                                                <span className="metric-icon like-icon"><LikeOutlined /></span>
                                                <Text strong className="premium-metric-text">{metrics.likes}</Text>
                                            </span>
                                            <span className="premium-metric">
                                                <span className="metric-icon comment-icon"><CommentOutlined /></span>
                                                <Text strong className="premium-metric-text">{metrics.comments}</Text>
                                            </span>
                                            <span className="premium-metric">
                                                <span className="metric-icon share-icon"><ShareAltOutlined /></span>
                                                <Text strong className="premium-metric-text">{metrics.shares}</Text>
                                            </span>
                                        </Space>

                                        {log._url && (
                                            <Button type="primary" size="small" className="premium-view-btn" href={log._url} target="_blank" rel="noopener noreferrer" style={{ borderRadius: '6px', border: 'none' }}>
                                                View Post
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            marginTop: 16,
                        }}
                    >
                        <Pagination
                            current={currentPage}
                            pageSize={pageSize}
                            total={filteredPosts.length}
                            onChange={(page, size) => {
                                setCurrentPage(page);
                                setPageSize(size);
                            }}
                            showSizeChanger
                            pageSizeOptions={PAGE_SIZE_OPTIONS}
                            showTotal={(total) => `Total ${total} items`}
                        />
                    </div>
                </>
            )}
        </div>
    );
}