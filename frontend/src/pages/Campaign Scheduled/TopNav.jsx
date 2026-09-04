import React from "react";
import { Button, Space, Typography } from "antd";
import { ReloadOutlined, FilePdfOutlined } from "@ant-design/icons";
// import SchedulerStatusPanel from "./SchedulerStatusPanel";

const { Title, Text } = Typography;

export default function TopNav({
  onCreateClick,
  onConnectClick,
  isConnected,
  schedulerStatus,
  onRefreshClick,
  onOpenReportModal,
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
        {onOpenReportModal && (
          <Button
            size="large"
            type="primary"
            icon={<FilePdfOutlined />}
            onClick={onOpenReportModal}
            style={{
              background: "linear-gradient(135deg, #1677ff 0%, #0050b3 100%)",
              borderColor: "transparent",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(22, 119, 255, 0.25)"
            }}
          >
            Generate MoM Report
          </Button>
        )}
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
