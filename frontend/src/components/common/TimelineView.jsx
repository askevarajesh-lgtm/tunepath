import React from "react";
import { Timeline, Typography, Empty, Space, Tag } from "antd";
import { UserOutlined, CheckCircleOutlined, EditOutlined, PlusCircleOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Text } = Typography;

const TimelineView = ({ events = [] }) => {
  if (!events || events.length === 0) {
    return (
      <Empty
        description="No activity yet"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  const getEventConfig = (eventType) => {
    switch (eventType) {
      case "seo_created":
        return {
          title: "SEO Entry created",
          icon: <PlusCircleOutlined style={{ fontSize: "16px" }} />,
          color: "green",
        };
      case "seo_updated":
        return {
          title: "SEO Entry updated",
          icon: <EditOutlined style={{ fontSize: "16px" }} />,
          color: "blue",
        };
      case "seo_deleted":
        return {
          title: "SEO Entry deleted",
          icon: <DeleteOutlined style={{ fontSize: "16px" }} />,
          color: "red",
        };
      case "seo_work_update":
        return {
          title: "Work update added",
          icon: <CheckCircleOutlined style={{ fontSize: "16px" }} />,
          color: "purple",
        };
      default:
        return {
          title: eventType.replace(/_/g, " "),
          icon: <CheckCircleOutlined style={{ fontSize: "16px" }} />,
          color: "gray",
        };
    }
  };

  const timelineItems = events.map((event, index) => {
    const config = getEventConfig(event.eventType);
    
    let changedFields = null;
    if (event.eventType === "seo_updated" && event.metadata?.fieldsChanged) {
      changedFields = event.metadata.fieldsChanged;
    }

    return {
      color: config.color,
      dot: config.icon,
      children: (
        <div style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Text strong style={{ display: "block", fontSize: "14px" }}>
              {config.title}
            </Text>
            
            <Space size="middle" style={{ marginBottom: 4 }}>
              {event.performedByUserId && (
                <Text type="secondary" style={{ fontSize: "13px" }}>
                  <UserOutlined style={{ marginRight: 4 }} />
                  {event.performedByUserId.name || "Unknown User"}
                </Text>
              )}
              <Text type="secondary" style={{ fontSize: "13px" }}>
                {dayjs(event.createdAt).format("DD MMM YYYY, hh:mm A")}
              </Text>
            </Space>

            {event.eventType === "seo_work_update" && event.metadata && (
               <div style={{ marginTop: 4 }}>
                  {event.metadata.completedWork && (
                    <Text style={{ display: "block", marginBottom: 4 }}>
                      {event.metadata.completedWork}
                    </Text>
                  )}
               </div>
            )}

            {changedFields && changedFields.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: "13px", display: "block", marginBottom: 4 }}>Changed:</Text>
                <ul style={{ margin: 0, paddingLeft: 16, color: "var(--text-secondary)", fontSize: "13px" }}>
                  {changedFields.map((field, idx) => {
                    const fieldName = field.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase());
                    return <li key={idx}>{fieldName}</li>;
                  })}
                </ul>
              </div>
            )}
            
          </Space>
        </div>
      ),
    };
  });

  return <Timeline mode="left" items={timelineItems} />;
};

export default TimelineView;
