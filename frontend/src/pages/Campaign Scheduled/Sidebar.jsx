import React from "react";
import {
  AppstoreOutlined,
  CalendarOutlined,
  DatabaseOutlined,
  FundProjectionScreenOutlined,
  SettingOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { Menu, Tag, Typography } from "antd";

const { Title, Text } = Typography;

const items = [
  { key: "dashboard", label: "Dashboard", icon: <FundProjectionScreenOutlined /> },
  { key: "planner", label: "Planner", icon: <AppstoreOutlined /> },
  { key: "calendar", label: "Calendar", icon: <CalendarOutlined /> },
  {
    key: "campaigns",
    label: "Campaign Logs",
    icon: <DatabaseOutlined />,
  },
  // { key: "reviews", label: "Reviews", icon: <MessageOutlined /> },
  { key: "accounts", label: "Accounts", icon: <SettingOutlined /> },
];

export default function Sidebar({ activeTab, setActiveTab }) {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 992);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 992);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="campaign-scheduler-sidebar-inner">
      <div className="campaign-scheduler-brand">
        <div>
          <Title level={5} style={{ marginBottom: 2 }}>
            Campaign Scheduled
          </Title>
          <Text type="secondary">Plan and publish social campaigns</Text>
        </div>
      </div>
      <Tag color="blue" style={{ marginTop: 14, borderRadius: 999 }}>
        Marketing Suite
      </Tag>
      <Menu
        className="campaign-scheduler-menu"
        style={{ marginTop: 16, borderInlineEnd: 0, background: "transparent" }}
        mode={isMobile ? "horizontal" : "inline"}
        selectedKeys={[activeTab]}
        items={items}
        onClick={({ key }) => setActiveTab(key)}
      />
    </div>
  );
}
