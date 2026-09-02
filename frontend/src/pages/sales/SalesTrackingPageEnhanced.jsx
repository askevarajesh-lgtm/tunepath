import React, { useState } from "react";
import {
  Card,
  Table,
  Space,
  Tag,
  message,
  DatePicker,
  Select,
  Button,
  Row,
  Col,
  Statistic,
  Spin,
  Typography,
  Tabs,
  Divider,
  Modal,
  Form,
  InputNumber,
} from "antd";
import {
  DollarOutlined,
  UserOutlined,
  RiseOutlined,
  TeamOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ApartmentOutlined,
  CommentOutlined,
} from "@ant-design/icons";
import {
  useGetSalesTrackingQuery,
  useGetTargetsQuery,
  useRecalculateMetricsMutation,
} from "../../api/salesApi";
// import { API_BASE_URL } from "../../api/baseApi";
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:5500/api";
import { useGetUsersQuery } from "../../api/userApi";
import { RESPONSIVE_COLS } from "../../utils/responsive";
import dayjs from "dayjs";

const { Title } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { MonthPicker } = DatePicker;

const SalesTrackingPageEnhanced = () => {
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1);
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [isTargetModalVisible, setIsTargetModalVisible] = useState(false);
  const [targetForm] = Form.useForm();
  const [targetType, setTargetType] = useState("individual"); // 'individual' or 'team'

  const {
    data: trackingData,
    isLoading: trackingLoading,
    refetch: refetchTracking,
  } = useGetSalesTrackingQuery({
    month: selectedMonth,
    year: selectedYear,
  });
  const { data: targetsData, refetch: refetchTargets } = useGetTargetsQuery({
    month: selectedMonth,
    year: selectedYear,
  });
  const { data: usersData } = useGetUsersQuery({ role: "salesperson" });
  const [recalculateMetrics] = useRecalculateMetricsMutation();

  const tracking = trackingData?.data?.tracking;
  const targets = targetsData?.data?.targets || [];
  // Handle paginated response (data?.data?.data) or legacy format (data?.data?.users)
  const users = usersData?.data?.data || usersData?.data?.users || [];

  // Get unique teams
  const teams = [...new Set(users.filter((u) => u.team).map((u) => u.team))];

  const handleDownloadReport = async () => {
    try {


      const token = localStorage.getItem('token');

      const response = await fetch(
        `${API_BASE_URL}/sales/reports/monthly?month=${selectedMonth}&year=${selectedYear}&format=pdf`,
        {
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-report-${selectedYear}-${selectedMonth.toString().padStart(2, "0")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success("Report downloaded successfully");
    } catch (error) {
      message.error("Failed to download report");
    }
  };

  const handleRecalculateAll = async () => {
    try {
      Modal.confirm({
        title: "Recalculate Metrics",
        content:
          "This will recalculate all sales metrics for the selected period. Continue?",
        onOk: async () => {
          const promises = targets.map((target) =>
            recalculateMetrics(target._id)
              .unwrap()
              .catch((err) => {
                console.error(
                  `Failed to recalculate target ${target._id}:`,
                  err,
                );
                return null;
              }),
          );
          await Promise.all(promises);
          message.success("Metrics recalculated successfully");
          refetchTracking();
          refetchTargets();
        },
      });
    } catch (error) {
      message.error("Failed to recalculate metrics");
    }
  };

  // Overall metrics columns
  const overallMetricsColumns = [
    {
      title: "Metric",
      dataIndex: "label",
      key: "label",
      width: 200,
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
      render: (value, record) => {
        if (record.type === "currency") {
          return `₹${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (record.type === "percentage") {
          return `${(value || 0).toFixed(2)}%`;
        }
        return value;
      },
    },
  ];

  // Team-wise columns - Invoice amounts (total, collected, pending)
  const teamWiseColumns = [
    {
      title: "Team",
      dataIndex: "team",
      key: "team",
      width: 150,
    },
    {
      title: "Total Amount",
      dataIndex: "totalAmount",
      key: "totalAmount",
      width: 150,
      render: (amount) => `₹${(amount || 0).toLocaleString("en-IN")}`,
    },
    {
      title: "Achieved Amount",
      dataIndex: "totalAchieved",
      key: "totalAchieved",
      width: 150,
      render: (amount) => `₹${(amount || 0).toLocaleString("en-IN")}`,
    },
    {
      title: "Pending Amount",
      dataIndex: "totalPending",
      key: "totalPending",
      width: 150,
      render: (amount) => `₹${(amount || 0).toLocaleString("en-IN")}`,
    },
  ];

  // Department-wise columns
  const departmentWiseColumns = [
    {
      title: "Department",
      dataIndex: "department",
      key: "department",
      width: 200,
      render: (dept) => (
        <Tag color="blue">
          {dept?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) ||
            "N/A"}
        </Tag>
      ),
    },
    {
      title: "Tasks",
      dataIndex: "taskCount",
      key: "taskCount",
      width: 100,
      render: (count) => count || 0,
    },
    {
      title: "Total Time (hrs)",
      dataIndex: "totalTimeSpent",
      key: "totalTimeSpent",
      width: 150,
      render: (hours) => `${(hours || 0).toFixed(2)} hrs`,
    },
    {
      title: "Estimated Cost",
      dataIndex: "estimatedCost",
      key: "estimatedCost",
      width: 150,
      render: (amount) =>
        `₹${(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: "Members",
      dataIndex: "members",
      key: "members",
      width: 200,
      render: (members) => members?.length || 0,
    },
  ];

  // Department member columns (for expandable rows)
  const departmentMemberColumns = [
    {
      title: "Member",
      dataIndex: "name",
      key: "name",
      width: 150,
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 150,
      render: (role) => (
        <Tag>
          {role?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) ||
            "N/A"}
        </Tag>
      ),
    },
    {
      title: "Tasks",
      dataIndex: "taskCount",
      key: "taskCount",
      width: 100,
    },
    {
      title: "Time Spent (hrs)",
      dataIndex: "totalTimeSpent",
      key: "totalTimeSpent",
      width: 150,
      render: (hours) => `${(hours || 0).toFixed(2)} hrs`,
    },
  ];

  // Individual columns - Invoice amounts (total, collected, pending)
  const individualColumns = [
    {
      title: "Name",
      dataIndex: ["userId", "name"],
      key: "name",
      width: 150,
      render: (name, record) => name || record.userId?.name || "N/A",
    },
    {
      title: "Team",
      dataIndex: ["userId", "team"],
      key: "team",
      width: 120,
      render: (team) => (team ? <Tag>{team}</Tag> : "N/A"),
    },
    {
      title: "Total Amount",
      dataIndex: "totalAmount",
      key: "totalAmount",
      width: 150,
      render: (amount) => `₹${(amount || 0).toLocaleString("en-IN")}`,
    },
    {
      title: "Achieved Amount",
      dataIndex: "achievedAmount",
      key: "achievedAmount",
      width: 150,
      render: (amount) => `₹${(amount || 0).toLocaleString("en-IN")}`,
    },
    {
      title: "Pending Amount",
      dataIndex: "pendingAmount",
      key: "pendingAmount",
      width: 150,
      render: (amount) => `₹${(amount || 0).toLocaleString("en-IN")}`,
    },
  ];

  // Prepare overall metrics data - Invoice amounts (total, collected, pending)
  const overallMetricsData = tracking?.overallMetrics
    ? [
        {
          label: "Total Amount",
          value: tracking.overallMetrics.totalAmount,
          type: "currency",
        },
        {
          label: "Achieved Amount",
          value: tracking.overallMetrics.totalAchieved,
          type: "currency",
        },
        {
          label: "Pending Amount",
          value: tracking.overallMetrics.totalPending,
          type: "currency",
        },
      ]
    : [];

  // Filter team-wise data
  const filteredTeamWise =
    selectedTeam === "all"
      ? tracking?.teamWise || []
      : (tracking?.teamWise || []).filter((t) => t.team === selectedTeam);

  // Filter individual data
  const filteredIndividual =
    selectedTeam === "all"
      ? tracking?.individual || []
      : (tracking?.individual || []).filter(
          (t) => t.userId?.team === selectedTeam,
        );

  return (
    <div>
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Sales Tracking - Invoices
        </Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRecalculateAll}
            title="Recalculate all metrics"
          >
            Recalculate
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownloadReport}
          >
            Download Monthly Report
          </Button>
        </Space>
      </div>

      {/* Period Selection */}
      <Card style={{ marginBottom: 24 }}>
        <Space>
          <span>Select Period:</span>
          <MonthPicker
            value={dayjs(
              `${selectedYear}-${selectedMonth.toString().padStart(2, "0")}-01`,
            )}
            onChange={(date) => {
              if (date) {
                setSelectedMonth(date.month() + 1);
                setSelectedYear(date.year());
              }
            }}
            format="MMMM YYYY"
          />
          <Select
            value={selectedTeam}
            onChange={setSelectedTeam}
            style={{ width: 200 }}
            allowClear
          >
            <Option value="all">All Teams</Option>
            {teams.map((team) => (
              <Option key={team} value={team}>
                {team}
              </Option>
            ))}
          </Select>
        </Space>
      </Card>

      {/* Overall Summary Statistics - Invoice Amounts (Total, Collected, Pending) */}
      {tracking?.overallMetrics && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col {...RESPONSIVE_COLS.threeCols}>
            <Card className="custom-stat-card">
              <Statistic
                title={<span className="card-title">Total Amount</span>}
                value={tracking.overallMetrics.totalAmount}
                prefix={<DollarOutlined className="card-icon" />}
                formatter={(value) => `₹${value?.toLocaleString("en-IN") || 0}`}
              />
            </Card>
          </Col>

          <Col {...RESPONSIVE_COLS.threeCols}>
            <Card className="custom-stat-card">
              <Statistic
                title={<span className="card-title">Achieved Amount</span>}
                value={tracking.overallMetrics.totalAchieved}
                prefix={<DollarOutlined className="card-icon" />}
                formatter={(value) => `₹${value?.toLocaleString("en-IN") || 0}`}
              />
            </Card>
          </Col>
          <Col {...RESPONSIVE_COLS.threeCols}>
            <Card className="custom-stat-card">
              <Statistic
                title={<span className="card-title">Pending Amount</span>}
                value={tracking.overallMetrics.totalPending}
                prefix={<DollarOutlined className="card-icon" />}
                formatter={(value) => `₹${value?.toLocaleString("en-IN") || 0}`}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Detailed Performance */}
      <Card>
        <Spin spinning={trackingLoading}>
          <Tabs defaultActiveKey="team">
            <TabPane
              tab={
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <TeamOutlined /> Team-wise Performance
                </span>
              }
              key="team"
            >
              <Table
                columns={teamWiseColumns}
                dataSource={filteredTeamWise}
                rowKey="team"
                pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                scroll={{ x: "max-content" }}
                locale={{ emptyText: "No team data available" }}
              />
            </TabPane>
            <TabPane
              tab={
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <UserOutlined /> Individual Performance
                </span>
              }
              key="individual"
            >
              <Table
                columns={individualColumns}
                dataSource={filteredIndividual}
                rowKey={(record) => record._id || record.userId?._id}
                pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                scroll={{ x: "max-content" }}
                locale={{ emptyText: "No individual data available" }}
              />
            </TabPane>
            <TabPane
              tab={
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CommentOutlined /> Overall Metrics
                </span>
              }
              key="metrics"
            >
              <Table
                columns={overallMetricsColumns}
                dataSource={overallMetricsData}
                rowKey="label"
                pagination={false}
                bordered
              />
            </TabPane>
          </Tabs>
        </Spin>
      </Card>
    </div>
  );
};

export default SalesTrackingPageEnhanced;
