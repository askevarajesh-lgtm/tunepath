import React, { useState } from "react";
import {
  Badge,
  Calendar,
  Card,
  Col,
  Row,
  Statistic,
  Typography,
  Space,
  Tooltip,
  Select,
  Radio,
  Modal,
  List,
  Button,
  Tag,
} from "antd";
import {
  CheckCircleFilled,
  ClockCircleFilled,
  CloseCircleFilled,
  FacebookFilled,
  InstagramFilled,
  LinkedinFilled,
  YoutubeFilled,
  FileTextFilled,
  PlusOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Text, Title } = Typography;

const PLATFORM_ICONS = {
  facebook: <FacebookFilled style={{ color: "#1877f2" }} />,
  instagram: <InstagramFilled style={{ color: "#e4405f" }} />,
  linkedin: <LinkedinFilled style={{ color: "#0a66c2" }} />,
  youtube: <YoutubeFilled style={{ color: "#ff0000" }} />,
};

const getStatusConfig = (status) => {
  switch (status) {
    case "Published":
      return { color: "#52c41a", bg: "#f6ffed", icon: <CheckCircleFilled /> };
    case "Failed":
      return { color: "#ff4d4f", bg: "#fff1f0", icon: <CloseCircleFilled /> };
    case "Draft":
      return { color: "#8c8c8c", bg: "#fafafa", icon: <FileTextFilled /> };
    default:
      return { color: "#1677ff", bg: "#e6f4ff", icon: <ClockCircleFilled /> }; // Scheduled
  }
};

export default function CalendarView({ posts, accounts = [], onView, onEdit }) {
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState({
    date: null,
    posts: [],
  });

  const handleSeeMore = (e, date, dayPosts) => {
    e.stopPropagation();
    setSelectedDayData({ date, posts: dayPosts });
    setDayModalOpen(true);
  };

  const renderPostTag = (post) => {
    const config = getStatusConfig(post.status);

    // Get unique platforms for this post
    const platformIcons = [
      ...new Set(
        (post.platforms || [])
          .map((id) => {
            const acc = accounts.find((a) => a.id === id);
            return acc?.platform;
          })
          .filter(Boolean),
      ),
    ];

    return (
      <Tooltip
        key={post.id}
        title={`${post.scheduledTime} - ${post.campaign || "Untitled"}`}
        mouseEnterDelay={0.5}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onView(post);
          }}
          style={{
            fontSize: 11,
            padding: "2px 6px",
            borderRadius: 4,
            backgroundColor: config.bg,
            borderLeft: `3px solid ${config.color}`,
            color: "#262626",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            transition: "transform 0.1s ease",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = "translateX(2px)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.transform = "translateX(0)")
          }
        >
          <span style={{ fontSize: 10, flexShrink: 0, display: "flex" }}>
            {platformIcons.length > 0
              ? PLATFORM_ICONS[platformIcons[0]]
              : config.icon}
          </span>
          <span
            style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {post.campaign || post.caption || "Untitled"}
          </span>
        </div>
      </Tooltip>
    );
  };

  const dateCellRender = (date) => {
    const key = dayjs(date).format("YYYY-MM-DD");
    const dayPosts = posts.filter((p) => p.scheduledDate === key);

    return (
      <div
        className="calendar-cell-content"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "2px",
        }}
      >
        {dayPosts.slice(0, 6).map((post) => renderPostTag(post))}
        {dayPosts.length > 6 && (
          <div
            onClick={(e) => handleSeeMore(e, key, dayPosts)}
            style={{
              fontSize: 10,
              color: "#1677ff",
              textAlign: "center",
              fontWeight: 600,
              cursor: "pointer",
              padding: "2px 0",
              borderRadius: 4,
              backgroundColor: "#f0f7ff",
            }}
          >
            +{dayPosts.length - 6} more
          </div>
        )}
      </div>
    );
  };

  const scheduledCount = posts.filter((p) => p.status === "Scheduled").length;
  const publishedCount = posts.filter((p) => p.status === "Published").length;
  const draftCount = posts.filter((p) => p.status === "Draft").length;

  const metrics = [
    {
      title: "Total Planner",
      value: posts.length,
      color: "#1677ff",
      icon: <FileTextFilled />,
    },
    {
      title: "Scheduled",
      value: scheduledCount,
      color: "#1677ff",
      icon: <ClockCircleFilled />,
    },
    {
      title: "Published",
      value: publishedCount,
      color: "#52c41a",
      icon: <CheckCircleFilled />,
    },
    {
      title: "Drafts",
      value: draftCount,
      color: "#8c8c8c",
      icon: <FileTextFilled />,
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={[12, 12]}>
        {metrics.map((m) => (
          <Col key={m.title} xs={12} sm={6}>
            <Card
              size="small"
              className="campaign-scheduler-surface"
              style={{ borderRadius: 12 }}
            >
              <Statistic
                title={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {m.title}
                  </Text>
                }
                value={m.value}
                valueStyle={{ color: m.color, fontSize: 20, fontWeight: 600 }}
                prefix={
                  <span style={{ marginRight: 8, opacity: 0.7 }}>{m.icon}</span>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        className="campaign-scheduler-surface campaign-scheduler-calendar-card"
        bodyStyle={{ padding: 0 }}
        style={{ borderRadius: 16, overflow: "hidden" }}
      >
        <Calendar
          cellRender={dateCellRender}
          style={{ padding: 12 }}
          headerRender={({ value, type, onChange, onTypeChange }) => {
            const start = 0;
            const end = 12;
            const monthOptions = [];

            const current = value.clone();
            const localeData = value.localeData();
            const months = [];
            for (let i = 0; i < 12; i++) {
              const monthInstance = current.month(i);
              months.push(localeData.monthsShort(monthInstance));
            }

            for (let i = start; i < end; i++) {
              monthOptions.push(
                <Select.Option key={i} value={i} className="month-item">
                  {months[i]}
                </Select.Option>,
              );
            }

            const year = value.year();
            const month = value.month();
            const options = [];
            for (let i = year - 10; i < year + 10; i += 1) {
              options.push(
                <Select.Option key={i} value={i} className="year-item">
                  {i}
                </Select.Option>,
              );
            }

            return (
              <div
                style={{
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <Title level={4} style={{ margin: 0 }}>
                  Content Calendar
                </Title>
                <Space wrap>
                  <Select
                    size="small"
                    dropdownMatchSelectWidth={false}
                    className="my-year-select"
                    value={year}
                    onChange={(newYear) => {
                      const now = value.clone().year(newYear);
                      onChange(now);
                    }}
                  >
                    {options}
                  </Select>
                  <Select
                    size="small"
                    dropdownMatchSelectWidth={false}
                    value={month}
                    onChange={(newMonth) => {
                      const now = value.clone().month(newMonth);
                      onChange(now);
                    }}
                  >
                    {monthOptions}
                  </Select>
                  <Radio.Group
                    size="small"
                    onChange={(e) => onTypeChange(e.target.value)}
                    value={type}
                  >
                    <Radio.Button value="month">Month</Radio.Button>
                    <Radio.Button value="year">Year</Radio.Button>
                  </Radio.Group>
                </Space>
              </div>
            );
          }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <span>Posts for</span>
            <Tag color="blue" style={{ borderRadius: 4 }}>
              {selectedDayData.date}
            </Tag>
          </Space>
        }
        open={dayModalOpen}
        onCancel={() => setDayModalOpen(false)}
        footer={null}
        width={800}
        centered
        destroyOnClose
        styles={{
          body: {
            maxHeight: "70vh",
            overflowY: "auto",
            padding: "0 24px",
          },
        }}
      >
        <List
          dataSource={selectedDayData.posts}
          renderItem={(post) => (
            <List.Item
              key={post.id}
              actions={[
                <Button
                  key="view"
                  size="small"
                  onClick={() => {
                    setDayModalOpen(false);
                    onView(post);
                  }}
                >
                  View
                </Button>,
                <Button
                  key="edit"
                  size="small"
                  type="primary"
                  onClick={() => {
                    setDayModalOpen(false);
                    onEdit(post);
                  }}
                >
                  Edit
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div style={{ fontSize: 20 }}>
                    {getStatusConfig(post.status).icon}
                  </div>
                }
                title={
                  <Space>
                    <Text strong>{post.scheduledTime}</Text>
                    <Text>{post.campaign || "Untitled Campaign"}</Text>
                    <Tag color={getStatusConfig(post.status).color}>
                      {post.status}
                    </Tag>
                  </Space>
                }
                description={
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" ellipsis={{ rows: 2 }}>
                      {post.caption}
                    </Text>
                    <div style={{ marginTop: 8 }}>
                      <Space>
                        {(post.platforms || []).map((id) => {
                          const acc = accounts.find((a) => a.id === id);
                          if (!acc) return null;
                          return (
                            <Tooltip
                              key={id}
                              title={acc.page_name || acc.username}
                            >
                              <span style={{ fontSize: 16 }}>
                                {PLATFORM_ICONS[acc.platform]}
                              </span>
                            </Tooltip>
                          );
                        })}
                      </Space>
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </Space>
  );
}
