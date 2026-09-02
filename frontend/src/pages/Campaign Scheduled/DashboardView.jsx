import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Select,
  Space,
  Table,
  Avatar,
  Tag,
  Spin,
  Empty,
  Tooltip as AntTooltip,
} from "antd";
import {
  LikeOutlined,
  MessageOutlined,
  ShareAltOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  GlobalOutlined,
  InstagramOutlined,
  FacebookOutlined,
  LinkedinOutlined,
  YoutubeOutlined,
  PinterestOutlined,
  ProjectOutlined,
  RiseOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { campaignScheduledApi } from "./api";
import dayjs from "dayjs";
import { useTheme } from "../../contexts/ThemeContext";

const { Title, Text } = Typography;

const COLORS = ["#6366f1", "#10b981", "#f43f5e", "#f59e0b", "#8b5cf6", "#06b6d4"];

export default function DashboardView({ posts, accounts, activeClientId, refreshTrigger }) {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState("all");

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const data = await campaignScheduledApi.getAnalytics(activeClientId);
        setAnalytics(data);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [activeClientId, refreshTrigger]);

  const platformIcons = {
    facebook: <FacebookOutlined style={{ color: "#1877F2" }} />,
    instagram: <InstagramOutlined style={{ color: "#E4405F" }} />,
    linkedin: <LinkedinOutlined style={{ color: "#0A66C2" }} />,
    youtube: <YoutubeOutlined style={{ color: "#FF0000" }} />,
    pinterest: <PinterestOutlined style={{ color: "#E60023" }} />,
    google_business: <GlobalOutlined style={{ color: "#4285F4" }} />,
    unknown: <ShareAltOutlined style={{ color: "#64748b" }} />,
  };

  const PLATFORM_BRAND_COLORS = {
    facebook: "#1877F2",
    instagram: "#E4405F",
    linkedin: "#0A66C2",
    youtube: "#FF0000",
    pinterest: "#E60023",
    google_business: "#4285F4",
    unknown: "#64748b",
  };

  const filteredEngagementData = useMemo(() => {
    if (!analytics?.engagementOverTime) return [];
    return analytics.engagementOverTime.map((item) => {
      const platformMetrics = {};
      Object.entries(item.platforms || {}).forEach(([p, s]) => {
        platformMetrics[p] = s.likes + s.comments;
      });

      return {
        date: item.date,
        displayDate: dayjs(item.date).format("MMM DD"),
        likes: item.likes,
        comments: item.comments,
        ...platformMetrics
      };
    });
  }, [analytics]);

  const activePlatforms = useMemo(() => {
    if (!analytics?.platformStats) return [];
    return Object.keys(analytics.platformStats);
  }, [analytics]);

  const platformDistributionData = useMemo(() => {
    if (!analytics?.platformStats) return [];
    return Object.entries(analytics.platformStats).map(([name, stats]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      platform: name,
      value: stats.count,
    }));
  }, [analytics]);

  const currentStats = useMemo(() => {
    const baseStats = analytics?.stats || {
      totalPosts: 0,
      publishedPosts: 0,
      scheduledPosts: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
    };
    
    if (selectedPlatform === "all") return baseStats;
    
    const ps = analytics?.platformStats[selectedPlatform];
    if (!ps) return { ...baseStats, totalPosts: 0, publishedPosts: 0, totalLikes: 0, totalComments: 0 };
    
    return {
      ...baseStats,
      totalPosts: ps.count,
      publishedPosts: ps.count,
      totalLikes: ps.likes,
      totalComments: ps.comments,
      totalShares: ps.shares
    };
  }, [analytics, selectedPlatform]);

  const stats = currentStats;

  if (loading) {
    return (
      <div className="dashboard-loading-container">
        <Spin size="large" tip="Brewing your analytics..." />
      </div>
    );
  }

  if (!analytics) {
    return <Empty description="No analytics data found for this period" />;
  }

  return (
    <div className={`premium-campaign-dashboard ${isDark ? "dark-mode" : ""}`}>
      <div className="dashboard-header-section">
        <div className="header-text">
          <Title level={2} className="gradient-text">Performance Overview</Title>
          <Text type="secondary" className="header-subtitle">
            <RiseOutlined /> {activeClientId ? "Real-time analytics for your selected client" : "Real-time analytics for Admin Company"}
          </Text>
        </div>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center' }}>
          <Select
            value={selectedPlatform}
            onChange={setSelectedPlatform}
            className="premium-select platform-switcher"
            placeholder="Select Platform"
            style={{ width: 190 }}
          >
            <Select.Option value="all">
              <Space>
                <GlobalOutlined />
                <span>Global Reach</span>
              </Space>
            </Select.Option>
            {Object.keys(analytics.platformStats || {}).map((p) => (
              <Select.Option key={p} value={p}>
                <Space>
                  {platformIcons[p]}
                  <span>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                </Space>
              </Select.Option>
            ))}
          </Select>
        </div>
      </div>

      <Row gutter={[20, 20]} className="stats-grid">
        <Col xs={24} sm={12} xxl={6}>
          <div className="premium-stat-card card-blue">
            <div className="stat-icon-wrapper">
              <ProjectOutlined />
            </div>
            <div className="stat-content">
              <Text className="stat-label">Total Content</Text>
              <Title level={2} className="stat-value">{stats.totalPosts}</Title>
              <div className="stat-trend positive">
                <Tag color="rgba(255,255,255,0.2)" className="glass-tag">{stats.publishedPosts} Published</Tag>
              </div>
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} xxl={6}>
          <div className="premium-stat-card card-rose">
            <div className="stat-icon-wrapper">
              <LikeOutlined />
            </div>
            <div className="stat-content">
              <Text className="stat-label">Total Likes</Text>
              <Title level={2} className="stat-value">{stats.totalLikes}</Title>
              <div className="stat-trend positive">
                <ArrowUpOutlined /> 14.2% <Text className="trend-label"></Text>
              </div>
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} xxl={6}>
          <div className="premium-stat-card card-emerald">
            <div className="stat-icon-wrapper">
              <MessageOutlined />
            </div>
            <div className="stat-content">
              <Text className="stat-label">Conversations</Text>
              <Title level={2} className="stat-value">{stats.totalComments}</Title>
                <div className="stat-trend">
                  <Text className="trend-label">Avg. {stats.totalComments > 0 ? (stats.totalComments / (stats.publishedPosts || 1)).toFixed(1) : 0} per post</Text>
                </div>
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} xxl={6}>
          <div className="premium-stat-card card-amber">
            <div className="stat-icon-wrapper">
              <TeamOutlined />
            </div>
            <div className="stat-content">
              <Text className="stat-label">Engagement Rate</Text>
              <Title level={2} className="stat-value">
                {stats.publishedPosts > 0 ? (((stats.totalLikes + stats.totalComments) / stats.publishedPosts) * 1.5).toFixed(2) : 0}%
              </Title>
              <div className="stat-trend positive">
                <RiseOutlined /> High <Text className="trend-label"></Text>
              </div>
            </div>
          </div>
        </Col>
      </Row>

      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} xxl={16}>
          <Card className="glass-card chart-main-card">
            <div className="card-header-flex">
              <Title level={4}>Engagement Trends</Title>
              <Text type="secondary">30-Day Activity Flow</Text>
            </div>
            <div className="chart-container-large">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredEngagementData}>
                  <defs>
                    {activePlatforms.map((p) => (
                      <linearGradient key={`grad-${p}`} id={`grad-${p}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PLATFORM_BRAND_COLORS[p] || "#6366f1"} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={PLATFORM_BRAND_COLORS[p] || "#6366f1"} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"} />
                  <XAxis 
                    dataKey="displayDate" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: isDark ? "#64748b" : "#94a3b8" }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: isDark ? "#64748b" : "#94a3b8" }} 
                  />
                  <Tooltip
                    contentStyle={{ 
                      borderRadius: 12, 
                      border: "none", 
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
                      background: isDark ? "#1e293b" : "rgba(255,255,255,0.95)",
                      backdropFilter: "blur(4px)",
                      color: isDark ? "#f1f5f9" : "#1e293b"
                    }}
                    itemStyle={{ color: isDark ? "#f1f5f9" : "#1e293b" }}
                  />
                  {selectedPlatform === "all" ? (
                    activePlatforms.map((p) => (
                      <Area
                        key={p}
                        type="monotone"
                        dataKey={p}
                        stroke={PLATFORM_BRAND_COLORS[p] || "#6366f1"}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill={`url(#grad-${p})`}
                        name={p.charAt(0).toUpperCase() + p.slice(1)}
                        animationDuration={1500}
                        hide={selectedPlatform !== "all" && selectedPlatform !== p}
                      />
                    ))
                  ) : (
                    <>
                      <Area
                        type="monotone"
                        dataKey="likes"
                        stroke={PLATFORM_BRAND_COLORS[selectedPlatform] || "#6366f1"}
                        strokeWidth={4}
                        fillOpacity={1}
                        fill={`url(#grad-${selectedPlatform})`}
                        name="Likes"
                        animationDuration={1500}
                      />
                      <Area
                        type="monotone"
                        dataKey="comments"
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fill="transparent"
                        name="Comments"
                        animationDuration={2000}
                      />
                    </>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} xxl={8}>
          <Card className="glass-card pie-main-card" title="Audience Distribution">
            <div className="pie-chart-wrapper">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={platformDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                    animationBegin={500}
                    animationDuration={1500}
                  >
                    {platformDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PLATFORM_BRAND_COLORS[entry.platform] || COLORS[index % COLORS.length]} cornerRadius={10} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: 12, 
                      border: "none", 
                      background: isDark ? "#1e293b" : "#ffffff",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
                      color: isDark ? "#f1f5f9" : "#1e293b"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-center-label">
                <Title level={3} style={{ margin: 0 }}>{stats.publishedPosts}</Title>
                <Text type="secondary">Total</Text>
              </div>
            </div>
            <div className="platform-legend-list">
              {platformDistributionData.map((item, index) => (
                <div key={item.name} className="legend-item">
                  <div className="legend-info">
                    <div className="legend-dot" style={{ background: PLATFORM_BRAND_COLORS[item.platform] || COLORS[index % COLORS.length] }} />
                    <Text className="legend-name">{item.name}</Text>
                  </div>
                  <Text strong>{item.value}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <div className="section-divider">
        <Title level={4}>Channel Performance</Title>
        <div className="divider-line" />
      </div>

      <Row gutter={[20, 20]}>
        {Object.entries(analytics.platformStats || {}).map(([p, s], index) => (
          <Col xs={24} sm={12} xxl={6} key={p}>
            <div className="platform-premium-card">
              <div className="platform-header">
                <div className="platform-logo-box">{platformIcons[p] || <ShareAltOutlined style={{ color: "#64748b" }} />}</div>
                <div className="platform-name-box">
                  <Text strong>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                  <Text size="small" type="secondary">Active Channel</Text>
                </div>
              </div>
              <div className="platform-metrics-grid">
                <div className="metric-box">
                  <Text className="label">Posts</Text>
                  <Text className="value">{s.count}</Text>
                </div>
                <div className="metric-box">
                  <Text className="label">Likes</Text>
                  <Text className="value">{s.likes}</Text>
                </div>
                <div className="metric-box">
                  <Text className="label">Comments</Text>
                  <Text className="value">{s.comments}</Text>
                </div>
                <div className="metric-box">
                  <Text className="label">Engagement</Text>
                  <Text className="value">{s.count > 0 ? ((s.likes + s.comments) / s.count).toFixed(1) : 0}</Text>
                </div>
              </div>
              <div className="platform-footer">
                <Tag color="success" className="status-tag">Connected</Tag>
              </div>
            </div>
          </Col>
        ))}
      </Row>



      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .premium-campaign-dashboard {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          padding: 10px;
          color: #1e293b;
          transition: all 0.3s ease;
        }

        .premium-campaign-dashboard.dark-mode {
          background: #020617;
          color: #f1f5f9;
        }

        .dashboard-header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          padding: 0 4px;
          flex-wrap: wrap;
          gap: 16px;
        }

        @media (max-width: 768px) {
          .dashboard-header-section {
            flex-direction: column;
            align-items: flex-start;
          }
          .header-actions {
            width: 100%;
          }
          .platform-switcher {
            width: 100% !important;
          }
        }

        .gradient-text {
          background: linear-gradient(135deg, #1e293b 0%, #6366f1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin: 0 !important;
        }

        .dark-mode .gradient-text {
          background: linear-gradient(135deg, #f8fafc 0%, #818cf8 100%);
          -webkit-background-clip: text;
        }

        .header-subtitle {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
        }

        .dark-mode .header-subtitle { color: #94a3b8; }

        .platform-switcher {
          min-width: 190px;
        }

        .platform-switcher .ant-select-selector {
          border: 2px solid #e2e8f0 !important;
          border-radius: 14px !important;
          height: 48px !important;
          padding: 0 16px !important;
          transition: all 0.3s ease !important;
        }

        .platform-switcher:hover .ant-select-selector {
          border-color: #6366f1 !important;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1) !important;
        }

        .platform-switcher .ant-select-selection-item {
          display: flex !important;
          align-items: center !important;
          font-weight: 700 !important;
          color: inherit !important;
        }

        .dark-mode .platform-switcher .ant-select-selection-item {
          color: #f1f5f9 !important;
        }

        /* Stats Cards */
        .premium-stat-card {
          padding: 24px;
          border-radius: 20px;
          display: flex;
          gap: 20px;
          align-items: center;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255,255,255,0.8);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
          position: relative;
          overflow: hidden;
          min-height: 120px;
        }

        @media (max-width: 1400px) {
          .premium-stat-card {
            padding: 16px;
            gap: 12px;
          }
          .stat-icon-wrapper {
            width: 44px;
            height: 44px;
            font-size: 20px;
          }
          .stat-value {
            font-size: 24px !important;
          }
        }

        @media (max-width: 1200px) {
          .premium-stat-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
        }

        .dark-mode .premium-stat-card {
          border-color: rgba(255,255,255,0.05);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
        }

        .premium-stat-card::after {
          content: '';
          position: absolute;
          right: -20px;
          bottom: -20px;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          opacity: 0.1;
          background: currentColor;
        }



        .card-blue { background: #eff6ff; color: var(--accent-primary); }
        .card-rose { background: #fff1f2; color: #e11d48; }
        .card-emerald { background: #ecfdf5; color: #059669; }
        .card-amber { background: #fffbeb; color: #d97706; }

        .dark-mode .card-blue { background: #1e293b; color: #60a5fa; }
        .dark-mode .card-rose { background: #311b22; color: #fb7185; }
        .dark-mode .card-emerald { background: #064e3b; color: #34d399; }
        .dark-mode .card-amber { background: #451a03; color: #fbbf24; }

        .stat-icon-wrapper {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          box-shadow: 0 8px 15px -3px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
        }

        .dark-mode .stat-icon-wrapper {
          background: rgba(255,255,255,0.05);
          box-shadow: none;
        }

        .stat-label {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .dark-mode .stat-label { color: #94a3b8; }

        .stat-value {
          margin: 4px 0 !important;
          font-weight: 800 !important;
          color: #0f172a !important;
        }

        .dark-mode .stat-value { color: #f1f5f9 !important; }

        .stat-trend {
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .stat-trend.positive { color: #10b981; }
        .trend-label { font-weight: 500; color: #94a3b8; }

        .glass-tag {
          background: rgba(255,255,255,0.5) !important;
          border: 1px solid rgba(0,0,0,0.05) !important;
          border-radius: 8px !important;
          font-weight: 600 !important;
          color: #64748b !important;
        }

        /* Glass Cards */
        .glass-card {
          border-radius: 24px !important;
          border: 1px solid #f1f5f9 !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.03) !important;
          overflow: hidden;
        }

        .dark-mode .glass-card {
          background: #0f172a !important;
          border-color: #1e293b !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4) !important;
        }

        .dark-mode .ant-card-head {
          border-bottom-color: #1e293b !important;
          color: #f1f5f9 !important;
        }

        .dark-mode h1, .dark-mode h2, .dark-mode h3, .dark-mode h4, .dark-mode .ant-typography {
          color: #f1f5f9 !important;
        }

        .card-header-flex {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
        }

        .card-header-flex h4 { margin: 0 !important; font-weight: 700 !important; }

        .chart-container-large {
          height: 340px;
          margin-left: -20px;
        }

        .pie-chart-wrapper {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 10px 0;
        }

        .pie-center-label {
          position: absolute;
          text-align: center;
          display: flex;
          flex-direction: column;
        }

        .platform-legend-list {
          margin-top: 24px;
        }

        .legend-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-radius: 12px;
          transition: background 0.2s;
        }



        .legend-info { display: flex; align-items: center; gap: 10px; }
        .legend-dot { width: 10px; height: 10px; border-radius: 3px; }
        .legend-name { font-weight: 600; color: #475569; }

        /* Section Divider */
        .section-divider {
          margin: 40px 0 24px;
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .section-divider h4 { margin: 0 !important; white-space: nowrap; font-weight: 800 !important; color: #1e293b !important; }
        .divider-line { height: 1px; flex: 1; background: #f1f5f9; }

        /* Platform Cards */
        .platform-premium-card {
          background: #ffffff;
          border: 1px solid #f1f5f9;
          border-radius: 20px;
          padding: 20px;
          transition: all 0.3s;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
        }

        .dark-mode .platform-premium-card {
          background: #1e293b;
          border-color: #334155;
        }



        .platform-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
        }

        .platform-logo-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          transition: all 0.3s ease;
        }

        .dark-mode .platform-logo-box { background: #0f172a; }

        .platform-name-box { display: flex; flex-direction: column; }
        .platform-name-box span:first-child { font-size: 15px; color: #1e293b; }
        .dark-mode .platform-name-box span:first-child { color: #f1f5f9; }
        .platform-name-box span:last-child { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }

        .platform-metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 20px;
        }

        .metric-box {
          background: #f8fafc;
          padding: 10px 14px;
          border-radius: 12px;
        }

        .dark-mode .metric-box { background: #0f172a; }

        .metric-box .label { font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px; }
        .metric-box .value { font-size: 16px; font-weight: 800; color: #334155; }
        .dark-mode .metric-box .value { color: #cbd5e1; }

        .platform-footer {
          border-top: 1px solid #f1f5f9;
          padding-top: 12px;
          display: flex;
          justify-content: center;
        }

        .dark-mode .platform-footer { border-color: #334155; }

        .status-tag {
          border-radius: 20px !important;
          padding: 0 12px !important;
          font-weight: 700 !important;
          font-size: 10px !important;
          text-transform: uppercase;
        }

        /* Table Premium Styling */
        .premium-table .ant-table { background: transparent !important; }
        .premium-table .ant-table-thead > tr > th {
          background: #f8fafc !important;
          color: #64748b !important;
          font-weight: 700 !important;
          font-size: 12px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          border-bottom: 1px solid #f1f5f9 !important;
        }

        .dark-mode .premium-table .ant-table-thead > tr > th {
          background: #1e293b !important;
          color: #94a3b8 !important;
          border-bottom-color: #334155 !important;
        }

        .dark-mode .premium-table .ant-table-tbody > tr > td {
          background: #0f172a !important;
          border-bottom-color: #1e293b !important;
          color: #cbd5e1 !important;
        }

        .dark-mode .premium-table .ant-table-row:hover > td {
          background: #1e293b !important;
        }

        .post-preview-cell { display: flex; gap: 16px; align-items: center; }
        .media-thumbnail {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          overflow: hidden;
          background: #f1f5f9;
          flex-shrink: 0;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          transition: all 0.3s ease;
        }

        .dark-mode .media-thumbnail { background: #334155; }



        .media-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
        .placeholder-thumb { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #cbd5e1; font-size: 20px; }

        .post-title-text { display: block !important; margin-bottom: 2px !important; color: #334155 !important; }
        .dark-mode .post-title-text { color: #f1f5f9 !important; }
        .post-caption-text { font-size: 12px !important; display: block; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .platform-icon-stack { display: flex; align-items: center; }
        .stacked-icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: -10px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          font-size: 14px;
        }

        .dark-mode .stacked-icon {
          background: #1e293b;
          border-color: #0f172a;
        }

        .stacked-more {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #f1f5f9;
          border: 2px solid #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
        }

        .table-metrics-box { display: flex; gap: 16px; }
        .table-metrics-box .metric { display: flex; align-items: center; gap: 6px; color: #64748b; }

        .publish-date-cell { display: flex; flex-direction: column; }
        .publish-date-cell span:first-child { color: #334155; }
        .publish-date-cell span:last-child { font-size: 11px; }

        .performance-cell { width: 100px; display: flex; flex-direction: column; gap: 6px; }
        .performance-bar-bg { width: 100%; height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden; }
        .performance-bar-fill { height: 100%; border-radius: 10px; transition: width 1s cubic-bezier(0.4, 0, 0.2, 1); }

        .dashboard-loading-container {
          height: 500px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          border-radius: 24px;
        }

        /* Responsive Fixes */
        @media (max-width: 768px) {
          .dashboard-header-section { flex-direction: column; align-items: flex-start; gap: 20px; }
          .header-actions { width: 100%; }
          .premium-select { width: 100% !important; }
        }
      `}} />
    </div>
  );
}
