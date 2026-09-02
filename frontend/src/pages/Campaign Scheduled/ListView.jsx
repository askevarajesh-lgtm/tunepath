import React, { useMemo, useState } from "react";
import {
  FileImageOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  LinkOutlined,
  VideoCameraOutlined,
  FacebookFilled,
  InstagramFilled,
  LinkedinFilled,
  YoutubeFilled,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { SOCIAL_ACCOUNTS } from "./socialAccounts";

const { Text, Title } = Typography;

export default function ListView({
  posts,
  accounts = [],
  onView,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  const filtered = useMemo(
    () =>
      posts.filter((p) => {
        const matchesSearch =
          p.caption.toLowerCase().includes(query.toLowerCase()) ||
          p.campaign.toLowerCase().includes(query.toLowerCase()) ||
          (p.type || "").toLowerCase().includes(query.toLowerCase());
        const matchesStatus = status === "All" || p.status === status;
        return matchesSearch && matchesStatus;
      }),
    [posts, query, status],
  );

  const scheduledCount = posts.filter((p) => p.status === "Scheduled").length;
  const publishedCount = posts.filter((p) => p.status === "Published").length;
  const draftCount = posts.filter((p) => p.status === "Draft").length;

  const metrics = [
    {
      key: "total",
      title: "Total Posts",
      value: posts.length,
      meta: `${draftCount} drafts`,
      icon: <FileTextOutlined />,
      tone: "neutral",
    },
    {
      key: "scheduled",
      title: "Scheduled",
      value: scheduledCount,
      meta: "Queued for publishing",
      icon: <ClockCircleOutlined />,
      tone: "info",
    },
    {
      key: "published",
      title: "Published",
      value: publishedCount,
      meta: "Live on channels",
      icon: <CheckCircleOutlined />,
      tone: "success",
    },
  ];

  const getPostTypeLabel = (row) => {
    if (row?.type === "Text Post") return "Text";
    if (row?.mediaUrl) {
      if (/\.(mp4|mov|avi|webm|mkv)$/i.test(row.mediaUrl)) return "Video";
      return "Image";
    }
    return "Text";
  };

  const getPlatformLabels = (platformIds = []) =>
    platformIds.map((id) => {
      const account = accounts.find((item) => item.id === id);
      if (!account) return { label: id, platform: "unknown" };
      return {
        label: account.page_name || account.username || account.id,
        platform: account.platform,
      };
    });

  const getPlatformIcon = (platformName) => {
    const config = SOCIAL_ACCOUNTS.find((acc) => acc.id === platformName);
    if (!config || !config.icon) return <LinkOutlined />;
    
    const IconComponent = config.icon;
    return <IconComponent style={{ color: config.color }} />;
  };


  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Row gutter={[12, 12]}>
        {metrics.map((metric) => (
          <Col key={metric.key} xs={24} md={8}>
            <Card
              className={`campaign-scheduler-metric-card campaign-scheduler-metric-card-${metric.tone}`}
            >
              <div className="campaign-scheduler-metric-head">
                <div className="campaign-scheduler-metric-icon">
                  {metric.icon}
                </div>
                <Text className="campaign-scheduler-metric-title">
                  {metric.title}
                </Text>
              </div>
              <Title level={2} className="campaign-scheduler-metric-value">
                {metric.value}
              </Title>
              <Text className="campaign-scheduler-metric-meta">
                {metric.meta}
              </Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="campaign-scheduler-surface">
        <Space wrap style={{ marginBottom: 14 }}>
          <Input.Search
            allowClear
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or description"
            style={{ width: 300 }}
          />
          <Select
            style={{ width: 180 }}
            value={status}
            onChange={setStatus}
            options={["All", "Scheduled", "Published", "Draft", "Failed"].map(
              (s) => ({
                label: s,
                value: s,
              }),
            )}
          />
        </Space>
        <Table
          rowKey="id"
          dataSource={filtered}
          pagination={{ defaultPageSize: 6, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
          scroll={{ x: 1300 }}
          columns={[
            {
              title: "Platform",
              key: "platforms",
              render: (_, row) => {
                const platformIds = row.platforms || [];
                const publications = row.platform_publications || {};
                if (!platformIds.length) return <Text type="secondary">-</Text>;

                return (
                  <Space size={14}>
                    {platformIds.map((id) => {
                      let account = accounts.find((item) => item.id === id);
                      if (!account) {
                        account = accounts.find((item) => item.platform === id);
                      }

                      let inferredPlatform = id;
                      if (typeof id === "string" && !account) {
                        const matchedConfig = SOCIAL_ACCOUNTS.find(acc => id.startsWith(acc.id) || id.startsWith(acc.prefix || acc.id.substring(0, 2)));
                        if (matchedConfig) inferredPlatform = matchedConfig.id;
                      }

                      const platformName = account?.platform || inferredPlatform;
                      const icon = getPlatformIcon(platformName);
                      const label =
                        account?.page_name ||
                        account?.username ||
                        account?.id ||
                        id;

                      // Lookup publication info - try account ID then platform name
                      const pubInfo =
                        publications[id] ||
                        (account ? publications[account.id] : null) ||
                        publications[platformName];
                        
                      // Legacy records don't have status, so we assume published if pubInfo exists and doesn't explicitly say Failed
                      const isPublished = pubInfo ? (pubInfo.status === "Published" || !pubInfo.status) : false;
                      const hasError =
                        pubInfo?.status === "Failed" ||
                        (!isPublished &&
                          (row.status === "Failed" || row.status === "Published"));
                      const isPending =
                        row.status === "Scheduled" || row.status === "Draft";

                      let statusBadge = null;
                      let borderColor = "transparent";
                      if (isPublished) {
                        borderColor = "#52c41a";
                        statusBadge = (
                          <CheckCircleOutlined
                            style={{
                              fontSize: 12,
                              color: "#fff",
                              backgroundColor: "#52c41a",
                              borderRadius: "50%",
                              position: "absolute",
                              bottom: -4,
                              right: -4,
                              border: "1px solid #fff",
                            }}
                          />
                        );
                      } else if (hasError) {
                        borderColor = "#ff4d4f";
                        statusBadge = (
                          <ClockCircleOutlined
                            style={{
                              fontSize: 10,
                              color: "#fff",
                              backgroundColor: "#ff4d4f",
                              borderRadius: "50%",
                              position: "absolute",
                              bottom: -4,
                              right: -4,
                              border: "1px solid #fff",
                            }}
                          />
                        );
                      }

                      return (
                        <Tooltip
                          key={id}
                          title={
                            <div style={{ fontSize: 12 }}>
                              <div style={{ fontWeight: "bold" }}>{label}</div>
                              <div
                                style={{
                                  opacity: 0.8,
                                  textTransform: "capitalize",
                                }}
                              >
                                {platformName}
                              </div>
                              <div style={{ opacity: 0.8 }}>
                                Status:{" "}
                                {isPublished
                                  ? "Successfully Published"
                                  : hasError
                                    ? "Publishing Failed"
                                    : "Pending"}
                              </div>
                              {hasError && pubInfo?.error && (
                                <div style={{ color: "#ff4d4f", marginTop: 4 }}>
                                  {pubInfo.error}
                                </div>
                              )}
                            </div>
                          }
                        >
                          <div
                            style={{
                              position: "relative",
                              padding: 4,
                              // border: `1px solid ${borderColor}`,
                              borderRadius: 6,
                              backgroundColor: isPublished
                                ? "#f6ffed"
                                : hasError
                                  ? "#fff1f0"
                                  : "transparent",
                              cursor: pubInfo?.url ? "pointer" : "help",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onClick={() =>
                              pubInfo?.url && window.open(pubInfo.url, "_blank")
                            }
                          >
                            <div
                              style={{
                                fontSize: "12px !important",
                                display: "flex",
                              }}
                            >
                              {icon}
                            </div>
                            {statusBadge}
                          </div>
                        </Tooltip>
                      );
                    })}
                  </Space>
                );
              },
            },
            {
              title: "Scheduled At",
              key: "scheduled",
              render: (_, row) => (
                <div style={{ lineHeight: "1.2" }}>
                  <div>{row.scheduledDate || "-"}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {row.scheduledTime || "-"}
                  </Text>
                </div>
              ),
            },
            {
              title: "Workflow",
              key: "postMode",
              render: (_, row) => {
                const mode =
                  row.postMode ||
                  (row.status === "Draft" ? "draft" : "scheduled");
                if (mode === "immediate")
                  return <Tag color="volcano">Immediate</Tag>;
                if (mode === "draft") return <Tag color="default">Draft</Tag>;
                return <Tag color="cyan">Scheduled</Tag>;
              },
            },
            {
              title: "Status",
              dataIndex: "status",
              key: "status",
              render: (value, row) => {
                const intendedCount = (row.platforms || []).length;
                const publishedCount = Object.values(
                  row.platform_publications || {}
                ).filter(p => !p.status || p.status === "Published").length;

                let displayStatus = value;
                let color = "var(--accent-primary)"; // Default Blue
                let icon = null;

                // Logic: If it says Published but nothing was actually sent, it's a failure.
                // If some but not all were sent, it's a partial success (shown as Failed/Warning).
                if (value === "Published") {
                  if (publishedCount === 0 && intendedCount > 0) {
                    displayStatus = "Failed";
                    color = "#ff4d4f"; // Red
                    icon = <ClockCircleOutlined />;
                  } else if (publishedCount < intendedCount) {
                    displayStatus = "Partial Fail";
                    color = "#faad14"; // Orange-Yellow (Warning)
                    icon = <ClockCircleOutlined />;
                  } else {
                    displayStatus = "Published";
                    color = "#52c41a"; // Green
                    icon = <CheckCircleOutlined />;
                  }
                } else if (value === "Failed") {
                  displayStatus = "Failed";
                  color = "#ff4d4f"; // Red
                  icon = <ClockCircleOutlined />;
                } else if (value === "Draft") {
                  displayStatus = "Draft";
                  color = "var(--accent-primary)"; // Blue
                  icon = <FileTextOutlined />;
                } else if (value === "Scheduled") {
                  displayStatus = "Scheduled";
                  color = "var(--accent-primary)"; // Blue
                  icon = <ClockCircleOutlined />;
                }

                return (
                  <Tooltip
                    title={
                      row.error_message ||
                      (displayStatus === "Partial Fail"
                        ? "Some platforms failed to publish."
                        : null)
                    }
                  >
                    <Tag
                      color={color}
                      icon={icon}
                      style={{
                        textTransform: "capitalize",
                        cursor:
                          row.error_message || displayStatus === "Partial Fail"
                            ? "help"
                            : "default",
                        borderRadius: "6px",
                        fontWeight: "500",
                        padding: "2px 8px",
                      }}
                    >
                      {displayStatus}
                    </Tag>
                  </Tooltip>
                );
              },
            },
            {
              title: "Post Type",
              key: "type",
              render: (_, row) => {
                const postType = getPostTypeLabel(row);
                return (
                  <Tag
                    color={
                      postType === "Video"
                        ? "purple"
                        : postType === "Image"
                          ? "geekblue"
                          : "default"
                    }
                  >
                    {postType}
                  </Tag>
                );
              },
            },
            {
              title: "Media",
              key: "media",
              render: (_, row) => {
                const postType = getPostTypeLabel(row);
                if (postType === "Text")
                  return <Text type="secondary">Text-only</Text>;
                const icon =
                  postType === "Video" ? (
                    <VideoCameraOutlined />
                  ) : (
                    <FileImageOutlined />
                  );
                if (!row.mediaUrl || (Array.isArray(row.mediaUrl) && row.mediaUrl.length === 0))
                  return <Text type="secondary">No media</Text>;
                
                const isBlob = Array.isArray(row.mediaUrl)
                  ? row.mediaUrl.some(url => url?.startsWith("blob:"))
                  : row.mediaUrl?.startsWith("blob:");

                if (isBlob) {
                  return (
                    <Tooltip title="Temporary local storage. Edit and re-upload to save permanently to bucket.">
                      <Tag color="orange" icon={<LinkOutlined />}>
                        Needs Re-upload
                      </Tag>
                    </Tooltip>
                  );
                }
                
                const firstMediaUrl = Array.isArray(row.mediaUrl) ? row.mediaUrl[0] : row.mediaUrl;
                const isCarousel = Array.isArray(row.mediaUrl) && row.mediaUrl.length > 1;

                return (
                  <a href={firstMediaUrl} target="_blank" rel="noreferrer">
                    <Space size={4}>
                      {icon}
                      <LinkOutlined />
                      <span>{isCarousel ? `View ${row.mediaUrl.length} files` : 'View file'}</span>
                    </Space>
                  </a>
                );
              },
            },
            {
              title: "Content",
              key: "content",
              width: 250,
              render: (_, row) => (
                <div style={{ maxWidth: 250 }}>
                  {row.campaign && (
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        marginBottom: 2,
                        color: "#1e293b",
                      }}
                    >
                      {row.campaign}
                    </div>
                  )}
                  <div
                    style={{
                      color: row.campaign ? "#64748b" : "inherit",
                      fontSize: row.campaign ? 12 : "inherit",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.caption}
                  </div>
                </div>
              ),
            },
            { title: "Title", dataIndex: "campaign", key: "campaign" },
            {
              title: "Action",
              key: "action",
              render: (_, row) => (
                <Space size={4}>
                  <Tooltip title="View">
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      aria-label={`View ${row.caption}`}
                      onClick={() => onView?.(row)}
                    />
                  </Tooltip>
                  {canEdit && (row.status === "Draft" || row.status === "Failed") && (
                    <Tooltip title="Edit">
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        aria-label={`Edit ${row.caption}`}
                        onClick={() => onEdit?.(row)}
                      />
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Popconfirm
                      title="Delete this post?"
                      description="This action cannot be undone."
                      okText="Delete"
                      cancelText="Cancel"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => onDelete?.(row)}
                    >
                      <Tooltip title="Delete">
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label={`Delete ${row.caption}`}
                        />
                      </Tooltip>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
