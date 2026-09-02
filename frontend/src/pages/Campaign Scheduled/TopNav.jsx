import React from "react";
import { Button, Space, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
// import SchedulerStatusPanel from "./SchedulerStatusPanel";

const { Title, Text } = Typography;

export default function TopNav({
  onCreateClick,
  onConnectClick,
  isConnected,
  schedulerStatus,
  onRefreshClick,
  canCreate = true,
  isRefreshing = false,
}) {
  return (
    <div className="campaign-scheduler-header">
      <Space direction="vertical" size={2}>
        <Title level={4} style={{ margin: 0 }}>
          Marketing Planner
        </Title>
        <Text type="secondary">
          Schedule, manage, and publish campaign posts from one place
        </Text>
        {/* <SchedulerStatusPanel schedulerStatus={schedulerStatus} /> */}
      </Space>
      <Space className="campaign-scheduler-actions">
        <Button
          size="large"
          icon={<ReloadOutlined />}
          onClick={onRefreshClick}
          loading={isRefreshing}
        >
          Refresh
        </Button>
        {canCreate && (
          <Button
            size="large"
            type="primary"
            onClick={onCreateClick}
            disabled={!isConnected}
          >
            Create New Post
          </Button>
        )}
      </Space>
    </div>
  );
}
