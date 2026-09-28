import React from "react";
import { Table, Tag, Button, Typography, Space, Card, Spin } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useGetTasksQuery } from "../../api/taskApi";
import usePagination from "../../hooks/usePagination";
import dayjs from "dayjs";
import TaskDetailDrawer from "../tasks/TaskDetailDrawer";

const { Title } = Typography;

const getStatusColor = (status) => {
  switch (status) {
    case "todo": return "default";
    case "in_progress": return "processing";
    case "completed": return "success";
    case "on_hold": return "warning";
    default: return "default";
  }
};

const SubAgencyTasks = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pagination, queryParams, handleTableChange } = usePagination({ defaultPageSize: 10 });
  const [selectedTaskId, setSelectedTaskId] = React.useState(null);
  
  // Try to parse task ID from URL
  React.useEffect(() => {
    const match = location.pathname.match(/\/tasks\/([a-f0-9]{24})/);
    if (match) {
      setSelectedTaskId(match[1]);
    } else {
      setSelectedTaskId(null);
    }
  }, [location.pathname]);

  const handleOpenTask = (taskId) => {
    navigate(`/sub-agency/tasks/${taskId}`);
  };

  const handleCloseDrawer = () => {
    navigate('/sub-agency/tasks');
  };

  const { data, isLoading } = useGetTasksQuery(queryParams);

  const tasks = Array.isArray(data?.data) ? data.data : (data?.data?.data || data?.data?.docs || data?.data?.tasks || data?.tasks || []);
  const total = data?.data?.pagination?.total || data?.data?.totalDocs || data?.pagination?.total || tasks.length || 0;

  const columns = [
    {
      title: "Task",
      dataIndex: "title",
      key: "title",
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: "Project",
      dataIndex: ["projectId", "name"],
      key: "projectName",
      render: (text) => text || "N/A",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {(status || "").replace(/_/g, " ").toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
    },
    {
      title: "Assigned Date",
      dataIndex: "delegatedAt",
      key: "delegatedAt",
      render: (date) => (date ? dayjs(date).format("DD MMM YYYY") : "N/A"),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleOpenTask(record._id)}
          >
            View
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Delegated Tasks</Title>
      </div>
      <Card>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}><Spin size="large" /></div>
        ) : (
          <Table
            columns={columns}
            dataSource={tasks}
            rowKey="_id"
            pagination={{
              ...pagination,
              total,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} tasks`,
            }}
            onChange={handleTableChange}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>

      <TaskDetailDrawer
        taskId={selectedTaskId}
        visible={!!selectedTaskId}
        onClose={handleCloseDrawer}
      />
    </div>
  );
};

export default SubAgencyTasks;
