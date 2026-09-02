import React, { useState, useMemo } from "react";
import {
  Card,
  Table,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  Space,
  Select,
  DatePicker,
  Button,
  Collapse,
  Descriptions,
  Empty,
  Spin,
  Divider,
  Tooltip,
} from "antd";
import { useNavigate } from "react-router-dom";
import {
  UserOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  TeamOutlined,
  GlobalOutlined,
  FilterOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useGetSEOClientUserReportQuery } from "../../api/seoApi";
import { useGetCompaniesDropdownQuery } from "../../api/companyApi";
import { useGetUsersDropdownQuery } from "../../api/userApi";
import { useGetProjectsDropdownQuery } from "../../api/projectApi";

const { Title, Text } = Typography;
const { Panel } = Collapse;
const { RangePicker } = DatePicker;

const SEOClientUserReport = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    clientCompanyId: undefined,
    projectId: undefined,
    userId: undefined,
    dateRange: null,
    includeNoClient: false,
  });

  // Build query params
  const queryParams = useMemo(() => {
    const params = {};
    if (filters.clientCompanyId) {
      params.clientCompanyId = filters.clientCompanyId;
    }
    if (filters.projectId) {
      params.projectId = filters.projectId;
    }
    if (filters.userId) {
      params.userId = filters.userId;
    }
    if (filters.dateRange && filters.dateRange.length === 2) {
      params.startDate = filters.dateRange[0].startOf("day").toISOString();
      params.endDate = filters.dateRange[1].endOf("day").toISOString();
    }
    if (filters.includeNoClient) {
      params.includeNoClient = "true";
    }
    return params;
  }, [filters]);

  const { data, isLoading, refetch } =
    useGetSEOClientUserReportQuery(queryParams);
  const { data: clientsData } = useGetCompaniesDropdownQuery({
    department: "seo",
  });
  const { data: projectsData } = useGetProjectsDropdownQuery({
    milestoneWorkflowType: "seo",
    companyId: filters.clientCompanyId,
  });
  const { data: usersData } = useGetUsersDropdownQuery({ limit: 1000 });

  const report = data?.data;
  const clients =
    clientsData?.data?.companies ||
    (Array.isArray(clientsData?.data) ? clientsData.data : []);
  const projects =
    projectsData?.data?.projects ||
    (Array.isArray(projectsData?.data) ? projectsData.data : []);
  const users =
    usersData?.data?.users ||
    usersData?.data?.data ||
    (Array.isArray(usersData?.data) ? usersData.data : []);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      clientCompanyId: undefined,
      projectId: undefined,
      userId: undefined,
      dateRange: null,
      includeNoClient: false,
    });
  };

  const hasActiveFilters =
    filters.clientCompanyId ||
    filters.projectId ||
    filters.userId ||
    filters.dateRange ||
    filters.includeNoClient;

  // Work type labels
  const workTypeLabels = {
    contentWork: "Content Work",
    onpageSeo: "On-page SEO",
    technicalSeo: "Technical SEO",
    localSeo: "Local SEO",
    keywordResearch: "Keyword Research",
    offPageSeo: "Off-page SEO",
  };

  const workTypeColors = {
    contentWork: "blue",
    onpageSeo: "green",
    technicalSeo: "orange",
    localSeo: "magenta",
    keywordResearch: "cyan",
    offPageSeo: "purple",
  };

  // User work updates table columns
  const userWorkUpdateColumns = [
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (date) => dayjs(date).format("DD MMM YYYY"),
    },
    {
      title: "Project",
      dataIndex: "projectName",
      key: "projectName",
      width: 150,
      render: (name) => <Text type="secondary">{name || "N/A"}</Text>,
    },
    {
      title: "Website",
      dataIndex: "websiteLink",
      key: "websiteLink",
      width: 200,
      ellipsis: true,
      render: (link) => (
        <a href={link} target="_blank" rel="noopener noreferrer">
          {link}
        </a>
      ),
    },
    {
      title: "Work Type",
      dataIndex: "workType",
      key: "workType",
      width: 150,
      render: (type) => (
        <Tag color={workTypeColors[type] || "default"}>
          {workTypeLabels[type] || type}
        </Tag>
      ),
    },
    {
      title: "Completed Work",
      dataIndex: "completedWork",
      key: "completedWork",
      ellipsis: { tooltip: true },
    },
    {
      title: "Backlinks",
      dataIndex: "offPageBacklinkCount",
      key: "offPageBacklinkCount",
      width: 100,
      align: "center",
      render: (count) =>
        count > 0 ? (
          <Tag color="green">{count}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 24,
          gap: 16,
        }}
      >
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("..")}
        >
          Back
        </Button>
        <h1
          style={{ margin: 0, fontSize: "24px", fontWeight: "bold", flex: 1 }}
        >
          SEO Client & User Work Report
        </h1>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Filter by Client"
              allowClear
              showSearch
              style={{ width: "100%" }}
              value={filters.clientCompanyId}
              onChange={(value) => handleFilterChange("clientCompanyId", value)}
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={clients.map((client) => ({
                value: client._id,
                label: `${client.name}`,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Filter by Project"
              allowClear
              showSearch
              style={{ width: "100%" }}
              value={filters.projectId}
              onChange={(value) => handleFilterChange("projectId", value)}
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={projects.map((project) => ({
                value: project._id,
                label: project.name,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Filter by User"
              allowClear
              showSearch
              style={{ width: "100%" }}
              value={filters.userId}
              onChange={(value) => handleFilterChange("userId", value)}
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={users.map((user) => ({
                value: user._id,
                label: `${user.name}${user.email ? ` (${user.email})` : ""}`,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <RangePicker
              style={{ width: "100%" }}
              value={filters.dateRange}
              onChange={(dates) => handleFilterChange("dateRange", dates)}
              format="DD/MM/YYYY"
            />
          </Col>
        </Row>
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <Button
              type={filters.includeNoClient ? "primary" : "default"}
              onClick={() =>
                handleFilterChange("includeNoClient", !filters.includeNoClient)
              }
              size="small"
            >
              {filters.includeNoClient ? "Hide" : "Show"} Entries Without
              Clients
            </Button>
          </Col>
        </Row>
        {hasActiveFilters && (
          <Button
            icon={<FilterOutlined />}
            onClick={handleClearFilters}
            size="small"
            style={{ marginTop: 16 }}
          >
            Clear Filters
          </Button>
        )}
      </Card>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "50px" }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* Summary Statistics */}
          {report?.summary && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card className="glass-card">
                  <div className="icon-bg"></div>
                  <div className="card-accent"></div>
                  <div style={{ position: "relative", zIndex: 2 }}>
                    <div className="card-title">Total Clients</div>
                    <div className="card-value">
                      {report.summary.totalClients}
                    </div>
                  </div>
                  <GlobalOutlined className="card-icon" />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card className="glass-card">
                  <div className="icon-bg"></div>
                  <div className="card-accent"></div>
                  <div style={{ position: "relative", zIndex: 2 }}>
                    <div className="card-title">Total Users</div>
                    <div className="card-value">
                      {report.summary.totalUsers}
                    </div>
                  </div>
                  <UserOutlined className="card-icon" />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card className="glass-card">
                  <div className="icon-bg"></div>
                  <div className="card-accent"></div>
                  <div style={{ position: "relative", zIndex: 2 }}>
                    <div className="card-title">Total Backlinks</div>
                    <div className="card-value">
                      {report.summary.totalBacklinks}
                    </div>
                  </div>
                  <LinkOutlined className="card-icon" />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card className="glass-card">
                  <div className="icon-bg"></div>
                  <div className="card-accent"></div>
                  <div style={{ position: "relative", zIndex: 2 }}>
                    <div className="card-title">Total Work Updates</div>
                    <div className="card-value">
                      {report.summary.totalWorkUpdates}
                    </div>
                  </div>
                  <CheckCircleOutlined className="card-icon" />
                </Card>
              </Col>
            </Row>
          )}

          {/* Client Reports */}
          {report?.clientReports && report.clientReports.length > 0 ? (
            <Card>
              <Collapse
                defaultActiveKey={report.clientReports.map((_, idx) =>
                  idx.toString(),
                )}
                ghost
              >
                {report.clientReports.map((clientReport, idx) => (
                  <Panel
                    key={idx}
                    header={
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          width: "100%",
                        }}
                      >
                        <Space>
                          <Text strong style={{ fontSize: "16px" }}>
                            {clientReport.clientName}
                          </Text>
                          {clientReport.clientEmail && (
                            <Text type="secondary">
                              ({clientReport.clientEmail})
                            </Text>
                          )}
                        </Space>
                        <Space>
                          <Tag color="blue">
                            <FileTextOutlined /> {clientReport.totalSEOEntries}{" "}
                            Entries
                          </Tag>
                          <Tag color="green">
                            <CheckCircleOutlined />{" "}
                            {clientReport.totalWorkUpdates} Updates
                          </Tag>
                          <Tag color="purple">
                            <LinkOutlined /> {clientReport.totalBacklinks}{" "}
                            Backlinks
                          </Tag>
                          <Tag color="orange">
                            <UserOutlined /> {clientReport.users.length} Users
                          </Tag>
                        </Space>
                      </div>
                    }
                  >
                    {/* Client Details */}
                    <Descriptions
                      bordered
                      column={2}
                      size="small"
                      style={{ marginBottom: 24 }}
                    >
                      <Descriptions.Item label="Client Name">
                        {clientReport.clientName}
                      </Descriptions.Item>
                      <Descriptions.Item label="Email">
                        {clientReport.clientEmail || "N/A"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Phone">
                        {clientReport.clientPhone || "N/A"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Total SEO Entries">
                        {clientReport.totalSEOEntries}
                      </Descriptions.Item>
                      <Descriptions.Item label="Total Work Updates">
                        {clientReport.totalWorkUpdates}
                      </Descriptions.Item>
                      <Descriptions.Item label="Total Backlinks">
                        {clientReport.totalBacklinks}
                      </Descriptions.Item>
                    </Descriptions>

                    {/* Users Working on This Client */}
                    <Title
                      level={4}
                      style={{ marginTop: 24, marginBottom: 16 }}
                    >
                      Users Working on This Client ({clientReport.users.length})
                    </Title>

                    {clientReport.users.length > 0 ? (
                      <Collapse ghost style={{ marginBottom: 24 }}>
                        {clientReport.users.map((user, userIdx) => (
                          <Panel
                            key={userIdx}
                            header={
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  width: "100%",
                                }}
                              >
                                <Space>
                                  <UserOutlined />
                                  <Text strong>{user.userName}</Text>
                                  {user.userEmail && (
                                    <Text type="secondary">
                                      ({user.userEmail})
                                    </Text>
                                  )}
                                </Space>
                                <Space>
                                  <Tag color="green">
                                    <CheckCircleOutlined />{" "}
                                    {user.workUpdateCount} Updates
                                  </Tag>
                                  <Tag color="purple">
                                    <LinkOutlined /> {user.totalBacklinks}{" "}
                                    Backlinks
                                  </Tag>
                                </Space>
                              </div>
                            }
                          >
                            {/* User Summary */}
                            <Row gutter={16} style={{ marginBottom: 16 }}>
                              <Col xs={24} sm={12} md={8}>
                                <Statistic
                                  title="Work Updates"
                                  value={user.workUpdateCount}
                                  prefix={<CheckCircleOutlined />}
                                />
                              </Col>
                              <Col xs={24} sm={12} md={8}>
                                <Statistic
                                  title="Total Backlinks"
                                  value={user.totalBacklinks}
                                  prefix={<LinkOutlined />}
                                />
                              </Col>
                              <Col xs={24} sm={12} md={8}>
                                <Statistic
                                  title="Contribution %"
                                  value={
                                    clientReport.totalBacklinks > 0
                                      ? Math.round(
                                          (user.totalBacklinks /
                                            clientReport.totalBacklinks) *
                                            100,
                                        )
                                      : 0
                                  }
                                  suffix="%"
                                />
                              </Col>
                            </Row>

                            <Divider />

                            {/* User Work Updates Table */}
                            <Title level={5} style={{ marginBottom: 16 }}>
                              Work Updates by {user.userName}
                            </Title>
                            <Table
                              columns={userWorkUpdateColumns}
                              dataSource={user.workUpdates}
                              rowKey="workUpdateId"
                              pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                              size="small"
                            />
                          </Panel>
                        ))}
                      </Collapse>
                    ) : (
                      <Empty description="No users have worked on this client yet" />
                    )}
                  </Panel>
                ))}
              </Collapse>
            </Card>
          ) : (
            <Card>
              <Empty description="No SEO work data found for the selected filters" />
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default SEOClientUserReport;
