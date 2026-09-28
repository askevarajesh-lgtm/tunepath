import React from "react";
import { Table, Tag, Button, Typography, Space, Card, Spin } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useGetProjectsQuery } from "../../api/projectApi";
import usePagination from "../../hooks/usePagination";
import dayjs from "dayjs";

const { Title } = Typography;

const getStatusColor = (status) => {
  switch (status) {
    case "created": return "blue";
    case "in_progress": return "processing";
    case "completed": return "success";
    case "cancelled": return "error";
    default: return "default";
  }
};

const SubAgencyProjects = () => {
  const navigate = useNavigate();
  const { pagination, queryParams, handleTableChange } = usePagination({ defaultPageSize: 10 });

  const { data, isLoading } = useGetProjectsQuery(queryParams);

  const projects = Array.isArray(data?.data) ? data.data : (data?.data?.data || data?.data?.docs || data?.data?.projects || data?.projects || []);
  const total = data?.data?.pagination?.total || data?.data?.totalDocs || data?.pagination?.total || projects.length || 0;

  const columns = [
    {
      title: "Project Name",
      dataIndex: "name",
      key: "name",
      render: (text, record) => <strong>{text}</strong>,
    },
    {
      title: "Client",
      dataIndex: ["clientId", "name"],
      key: "clientName",
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
            onClick={() => navigate(`/sub-agency/projects/${record._id}`)}
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
        <Title level={2} style={{ margin: 0 }}>Delegated Projects</Title>
      </div>
      <Card>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}><Spin size="large" /></div>
        ) : (
          <Table
            columns={columns}
            dataSource={projects}
            rowKey="_id"
            pagination={{
              ...pagination,
              total,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} projects`,
            }}
            onChange={handleTableChange}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>
    </div>
  );
};

export default SubAgencyProjects;
