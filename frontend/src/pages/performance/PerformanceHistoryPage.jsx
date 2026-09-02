import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Modal,
  Row,
  Col,
  Typography,
  Tag,
  Space,
  Select,
  DatePicker,
  Spin,
  message,
  Divider,
  Alert,
} from "antd";
import {
  ArrowLeftOutlined,
  EyeOutlined,
  CalendarOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  useGetPerformanceHistoryQuery,
  useGetAllScorecardsQuery,
  useGetScorecardByIdQuery,
} from "../../api/performanceApi";
import { useGetUsersQuery } from "../../api/userApi";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const PerformanceHistoryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId: userIdParam } = useParams();
  const { user } = useAuth();
  const isAdmin =
    user?.role === "admin" ||
    user?.role === "sales_manager" ||
    user?.role === "operations_head" ||
    user?.role === "commander_admin";

  // Default to current month and year
  const getCurrentMonthYear = () => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  };

  const currentMonthYear = getCurrentMonthYear();

  const [selectedScorecardId, setSelectedScorecardId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // For non-admin users, always use their own userId
  // For admin users, use userIdParam or filters.userId
  // Note: user object has 'id' field, not '_id'
  const effectiveUserId = isAdmin ? userIdParam || null : user?.id || user?._id;

  const [filters, setFilters] = useState({
    userId: effectiveUserId,
    month: null, // Start with null to show all months
    year: null, // Start with null to show all years
  });

  const { data: usersData } = useGetUsersQuery();

  // Determine which userId to use
  // For non-admin users: always use their own userId
  // For admin users: use userIdParam (from URL) or filters.userId (from dropdown)
  // Note: user object has 'id' field, not '_id'
  const activeUserId = isAdmin
    ? userIdParam || filters.userId
    : user?.id || user?._id;

  // Use getPerformanceHistory for specific user (month/year are optional - if not provided, fetch all)
  // For non-admin users, ensure we always have a userId (don't skip the query)
  const shouldSkipQuery = isAdmin ? !activeUserId : !(user?.id || user?._id);

  const {
    data: historyData,
    isLoading: isLoadingHistory,
    error: historyError,
  } = useGetPerformanceHistoryQuery(
    {
      userId: activeUserId || user?.id || user?._id,
      ...(filters.month && { month: filters.month }),
      ...(filters.year && { year: filters.year }),
    },
    { skip: shouldSkipQuery },
  );

  // Debug logging
  React.useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("PerformanceHistoryPage Debug:", {
        isAdmin,
        activeUserId,
        userRole: user?.role,
        filters,
        historyData: historyData?.data,
        historyError,
        isLoadingHistory,
      });
    }
  }, [
    isAdmin,
    activeUserId,
    user?.role,
    filters,
    historyData,
    historyError,
    isLoadingHistory,
  ]);

  // Only use getAllScorecards for admin when no specific user is selected (month/year are optional)
  const {
    data: allScorecardsData,
    isLoading: isLoadingAllScorecards,
    error: allScorecardsError,
  } = useGetAllScorecardsQuery(
    {
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.month && { month: filters.month }),
      ...(filters.year && { year: filters.year }),
    },
    { skip: !!activeUserId || !isAdmin },
  );

  // Debug logging for admin queries
  React.useEffect(() => {
    if (process.env.NODE_ENV === "development" && isAdmin) {
      console.log("PerformanceHistoryPage Admin Debug:", {
        activeUserId,
        filters,
        allScorecardsData: allScorecardsData?.data,
        allScorecardsError,
        isLoadingAllScorecards,
      });
    }
  }, [
    isAdmin,
    activeUserId,
    filters,
    allScorecardsData,
    allScorecardsError,
    isLoadingAllScorecards,
  ]);
  const { data: scorecardData, isLoading: isLoadingScorecard } =
    useGetScorecardByIdQuery(selectedScorecardId, {
      skip: !selectedScorecardId,
    });

  // Handle paginated response (data?.data?.data) or legacy format (data?.data?.users)
  const users = usersData?.data?.data || usersData?.data?.users || [];

  // Use history data if a specific userId is provided, otherwise use all scorecards (admin only)
  const history = activeUserId
    ? historyData?.data?.history || []
    : isAdmin
      ? allScorecardsData?.data?.scorecards || []
      : [];
  const isLoading = activeUserId
    ? isLoadingHistory
    : isAdmin
      ? isLoadingAllScorecards
      : false;
  const scorecard = scorecardData?.data?.scorecard;

  // Update filters when userIdParam changes (admin only)
  useEffect(() => {
    if (isAdmin && userIdParam) {
      setFilters((prev) => ({ ...prev, userId: userIdParam }));
    }
  }, [userIdParam, isAdmin]);

  // Ensure non-admin users always have their userId set
  useEffect(() => {
    if (!isAdmin && (user?.id || user?._id)) {
      const userId = user?.id || user?._id;
      setFilters((prev) => ({ ...prev, userId }));
    }
  }, [isAdmin, user?.id, user?._id]);

  const handleViewDetails = (record) => {
    setSelectedScorecardId(record._id);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedScorecardId(null);
  };

  const getGradeColor = (grade) => {
    const colors = {
      A: "green",
      B: "blue",
      C: "orange",
      D: "red",
    };
    return colors[grade] || "default";
  };

  const performanceCategories = [
    { key: "officeTimeLogIn", label: "Office Time Log In" },
    { key: "attendance", label: "Attendance" },
    { key: "commitmentTowardsWork", label: "Commitment Towards Work" },
    { key: "discipline", label: "Discipline" },
    { key: "teamWork", label: "Team Work" },
    { key: "innovation", label: "Innovation" },
    { key: "dailyReportSubmission", label: "Daily Report Submission" },
    { key: "workConsistency", label: "Work Consistency" },
    { key: "workEvaluation", label: "Work Evaluation" },
  ];

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Designation",
      dataIndex: "designation",
      key: "designation",
    },
    {
      title: "Team",
      dataIndex: "team",
      key: "team",
      render: (team) => team || "-",
    },
    {
      title: "Month/Year",
      key: "period",
      render: (record) => (
        <Space>
          <CalendarOutlined />
          <span>
            {record.month}/{record.year}
          </span>
        </Space>
      ),
    },
    {
      title: "SELF Score",
      dataIndex: ["appraisalScores", "self"],
      key: "selfScore",
      render: (score) => <Tag color="blue">{score}%</Tag>,
    },
    {
      title: "OH Score",
      dataIndex: ["appraisalScores", "oh"],
      key: "ohScore",
      render: (score) => <Tag color="orange">{score}%</Tag>,
    },
    {
      title: "HR Score",
      dataIndex: ["appraisalScores", "hr"],
      key: "hrScore",
      render: (score) => <Tag color="purple">{score}%</Tag>,
    },
    {
      title: "Overall Performance",
      dataIndex: ["appraisalScores", "overall"],
      key: "overallScore",
      render: (score, record) => {
        // Calculate overall if not present (for backward compatibility)
        const overall =
          score ||
          (() => {
            const self = record.appraisalScores?.self || 0;
            const oh = record.appraisalScores?.oh || 0;
            const hr = record.appraisalScores?.hr || 0;
            return Math.round((self + oh + hr) / 3);
          })();
        const color =
          overall >= 80 ? "green" : overall >= 60 ? "orange" : "red";
        return (
          <Tag color={color} style={{ fontWeight: "bold" }}>
            {overall}%
          </Tag>
        );
      },
    },
    {
      title: "Evaluation Date",
      dataIndex: "evaluationDate",
      key: "evaluationDate",
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY") : "-"),
    },
    {
      title: "Actions",
      key: "actions",
      fixed: window.innerWidth <= 768 ? false : "right",
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetails(record)}
        >
          View Details
        </Button>
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
          onClick={() => navigate(`${location.pathname.startsWith("/agency") ? "/agency/hrms/performance" : location.pathname.startsWith("/client") ? "/client/hrms/performance" : location.pathname.startsWith("/user") ? "/user/performance" : "/hrms/performance"}`)}
        >
          Back
        </Button>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>
          Performance History
        </h1>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: "24px" }}>
        <Row gutter={[16, 16]}>
          {/* Only show user selection for admins and when not viewing a specific user via URL */}
          {isAdmin && !userIdParam && (
            <Col xs={24} sm={8}>
              <Text strong>Select User:</Text>
              <Select
                style={{ width: "100%", marginTop: "8px" }}
                placeholder="Select user (optional)"
                allowClear
                showSearch
                optionFilterProp="children"
                value={filters.userId}
                onChange={(value) =>
                  setFilters({ ...filters, userId: value || null })
                }
                filterOption={(input, option) =>
                  (option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                {users.map((user) => (
                  <Option key={user._id} value={user._id} label={user.name}>
                    {user.name} ({user.email})
                  </Option>
                ))}
              </Select>
            </Col>
          )}
          <Col xs={24} sm={8}>
            <Text strong>Month:</Text>
            <Select
              style={{ width: "100%", marginTop: "8px" }}
              placeholder="Select month (optional)"
              allowClear
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              value={filters.month}
              onChange={(value) =>
                setFilters({ ...filters, month: value || null })
              }
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <Option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleString("default", {
                    month: "long",
                  })}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Text strong>Year:</Text>
            <Select
              style={{ width: "100%", marginTop: "8px" }}
              placeholder="Select year (optional - all years if not selected)"
              allowClear
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              value={filters.year}
              onChange={(value) =>
                setFilters({ ...filters, year: value || null })
              }
            >
              {Array.from(
                { length: 10 },
                (_, i) => new Date().getFullYear() - i,
              ).map((year) => (
                <Option key={year} value={year}>
                  {year}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {/* History Table */}
      <Card>
        {(historyError || allScorecardsError) && (
          <Alert
            message="Error Loading Performance History"
            description={
              historyError?.data?.message ||
              allScorecardsError?.data?.message ||
              "Failed to load performance history. Please try again."
            }
            type="error"
            showIcon
            style={{ marginBottom: "16px" }}
          />
        )}
        <Table
          columns={columns}
          dataSource={history}
          rowKey="_id"
          loading={isLoading}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: "No performance history found" }}
        />
      </Card>

      {/* Scorecard Details Modal */}
      <Modal
        title="Performance Scorecard Details"
        open={modalVisible}
        onCancel={handleCloseModal}
        footer={[
          <Button key="close" onClick={handleCloseModal}>
            Close
          </Button>,
        ]}
        width={1000}
      >
        {isLoadingScorecard ? (
          <Spin />
        ) : scorecard ? (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <div>
                    <Text strong>Name:</Text> <Text>{scorecard.name}</Text>
                  </div>
                  <div>
                    <Text strong>Designation:</Text>{" "}
                    <Text>{scorecard.designation}</Text>
                  </div>
                  {scorecard.team && (
                    <div>
                      <Text strong>Team:</Text> <Text>{scorecard.team}</Text>
                    </div>
                  )}
                  <div>
                    <Text strong>Evaluation Date:</Text>{" "}
                    <Text>
                      {scorecard.evaluationDate
                        ? dayjs(scorecard.evaluationDate).format("DD/MM/YYYY")
                        : "-"}
                    </Text>
                  </div>
                  <div>
                    <Text strong>Period:</Text>{" "}
                    <Text>
                      {scorecard.month}/{scorecard.year}
                    </Text>
                  </div>
                </Space>
              </Col>

              <Col span={24}>
                <Divider>Appraisal Scores</Divider>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={6}>
                    <Card size="small">
                      <div style={{ textAlign: "center" }}>
                        <Text type="secondary">SELF Score</Text>
                        <div>
                          <Tag
                            color="blue"
                            style={{ fontSize: "24px", padding: "8px 16px" }}
                          >
                            {scorecard.appraisalScores?.self || 0}%
                          </Tag>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} sm={6}>
                    <Card size="small">
                      <div style={{ textAlign: "center" }}>
                        <Text type="secondary">OH Score</Text>
                        <div>
                          <Tag
                            color="orange"
                            style={{ fontSize: "24px", padding: "8px 16px" }}
                          >
                            {scorecard.appraisalScores?.oh || 0}%
                          </Tag>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} sm={6}>
                    <Card size="small">
                      <div style={{ textAlign: "center" }}>
                        <Text type="secondary">HR Score</Text>
                        <div>
                          <Tag
                            color="purple"
                            style={{ fontSize: "24px", padding: "8px 16px" }}
                          >
                            {scorecard.appraisalScores?.hr || 0}%
                          </Tag>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} sm={6}>
                    <Card size="small">
                      <div style={{ textAlign: "center" }}>
                        <Text type="secondary">Overall Performance</Text>
                        <div>
                          {(() => {
                            const overall =
                              scorecard.appraisalScores?.overall ||
                              (() => {
                                const self =
                                  scorecard.appraisalScores?.self || 0;
                                const oh = scorecard.appraisalScores?.oh || 0;
                                const hr = scorecard.appraisalScores?.hr || 0;
                                return Math.round((self + oh + hr) / 3);
                              })();
                            const color =
                              overall >= 80
                                ? "green"
                                : overall >= 60
                                  ? "orange"
                                  : "red";
                            return (
                              <Tag
                                color={color}
                                style={{
                                  fontSize: "24px",
                                  padding: "8px 16px",
                                  fontWeight: "bold",
                                }}
                              >
                                {overall}%
                              </Tag>
                            );
                          })()}
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </Col>

              <Col span={24}>
                <Divider>Performance Categories</Divider>
                <Table
                  dataSource={performanceCategories.map((cat) => ({
                    key: cat.key,
                    category: cat.label,
                    self: scorecard.performanceCategories?.[cat.key]?.self,
                    oh: scorecard.performanceCategories?.[cat.key]?.oh,
                    hr: scorecard.performanceCategories?.[cat.key]?.hr,
                  }))}
                  columns={[
                    {
                      title: "Category",
                      dataIndex: "category",
                      key: "category",
                    },
                    {
                      title: "SELF",
                      dataIndex: "self",
                      key: "self",
                      render: (grade) => (
                        <Tag color={getGradeColor(grade)}>{grade}</Tag>
                      ),
                    },
                    {
                      title: "OH",
                      dataIndex: "oh",
                      key: "oh",
                      render: (grade) => (
                        <Tag color={getGradeColor(grade)}>{grade}</Tag>
                      ),
                    },
                    {
                      title: "HR",
                      dataIndex: "hr",
                      key: "hr",
                      render: (grade) => (
                        <Tag color={getGradeColor(grade)}>{grade}</Tag>
                      ),
                    },
                  ]}
                  pagination={false}
                  size="small"
                />
              </Col>

              {scorecard.roomForImprovement && (
                <Col span={24}>
                  <Divider>Room for Improvement</Divider>
                  <Text>{scorecard.roomForImprovement}</Text>
                </Col>
              )}

              {(scorecard.remarks?.tl ||
                scorecard.remarks?.oh ||
                scorecard.remarks?.hr) && (
                <Col span={24}>
                  <Divider>Remarks</Divider>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    {scorecard.remarks?.tl && (
                      <div>
                        <Text strong>TL Remarks:</Text>
                        <div style={{ marginTop: "8px" }}>
                          <Text>{scorecard.remarks.tl}</Text>
                        </div>
                      </div>
                    )}
                    {scorecard.remarks?.oh && (
                      <div>
                        <Text strong>OH Remarks:</Text>
                        <div style={{ marginTop: "8px" }}>
                          <Text>{scorecard.remarks.oh}</Text>
                        </div>
                      </div>
                    )}
                    {scorecard.remarks?.hr && (
                      <div>
                        <Text strong>HR Remarks:</Text>
                        <div style={{ marginTop: "8px" }}>
                          <Text>{scorecard.remarks.hr}</Text>
                        </div>
                      </div>
                    )}
                  </Space>
                </Col>
              )}
            </Row>
          </div>
        ) : (
          <Text>No scorecard data available</Text>
        )}
      </Modal>
    </div>
  );
};

export default PerformanceHistoryPage;
