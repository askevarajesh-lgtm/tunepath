import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Select,
  Typography,
  Space,
  Tag,
  Table,
  Dropdown,
  message,
  Empty,
  Alert,
  Spin,
  Modal,
  List,
  Badge,
  Drawer,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Row,
  Col,
  Divider,
} from "antd";
import {
  HistoryOutlined,
  TrophyOutlined,
  EditOutlined,
  DownloadOutlined,
  FileTextOutlined,
  BellOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  useGetAllScorecardsQuery,
  useGetPerformanceHistoryQuery,
  useGetUsersWithoutSelfAssessmentQuery,
  useNotifyPendingSelfAssessmentMutation,
  useGetScorecardByIdQuery,
  useCreateOrUpdateScorecardMutation,
} from "../../api/performanceApi";
import { exportToCSV } from "../../utils/exportUtils";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// ─── Grade options ────────────────────────────────────────────────────────────
const gradeOptions = [
  { value: "A", label: "A - EXCELLENT" },
  { value: "B", label: "B - GOOD" },
  { value: "C", label: "C - NEED IMPROVEMENT" },
  { value: "D", label: "D - REMAINS SAME" },
];

// ─── Performance category keys & labels ──────────────────────────────────────
const performanceCategories = [
  { key: "officeTimeLogIn", label: "Office Time Log In" },
  { key: "attendance", label: "Attendance" },
  { key: "commitmentTowardsWork", label: "Commitment Towards Work" },
  { key: "discipline", label: "Discipline" },
  { key: "teamWork", label: "Team Work" },
  { key: "innovation", label: "Innovation" },
  { key: "dailyReportSubmission", label: "Daily Report Submission" },
  { key: "workConsistency", label: "Work Consistency" },
  {
    key: "workEvaluation",
    label:
      "Work Evaluation (Quality of Backlinks/SEO Analytics and Reporting/Task Completion and Deadline)",
  },
];

// ─── Inline Edit Drawer ────────────────────────────────────────────────────────
const EditScorecardDrawer = ({ scorecardId, open, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [createOrUpdateScorecard, { isLoading: isSubmitting }] =
    useCreateOrUpdateScorecardMutation();

  const { data: scorecardData, isLoading } = useGetScorecardByIdQuery(
    scorecardId,
    { skip: !scorecardId || !open }
  );

  const scorecard = scorecardData?.data?.scorecard;

  // Populate form when scorecard loads
  useEffect(() => {
    if (scorecard && open) {
      form.setFieldsValue({
        userId: scorecard.userId?._id || scorecard.userId,
        name: scorecard.name,
        designation: scorecard.designation,
        team: scorecard.team || "",
        month: scorecard.month,
        year: scorecard.year,
        evaluationDate: scorecard.evaluationDate
          ? dayjs(scorecard.evaluationDate)
          : dayjs(),
        selfScore: scorecard.appraisalScores?.self,
        ohScore: scorecard.appraisalScores?.oh,
        hrScore: scorecard.appraisalScores?.hr,
        // Performance categories
        ...performanceCategories.reduce((acc, cat) => {
          acc[`${cat.key}_self`] = scorecard.performanceCategories?.[cat.key]?.self;
          acc[`${cat.key}_oh`] = scorecard.performanceCategories?.[cat.key]?.oh;
          acc[`${cat.key}_hr`] = scorecard.performanceCategories?.[cat.key]?.hr;
          return acc;
        }, {}),
        roomForImprovement: scorecard.roomForImprovement || "",
        tlRemarks: scorecard.remarks?.tl || "",
        ohRemarks: scorecard.remarks?.oh || "",
        hrRemarks: scorecard.remarks?.hr || "",
      });
    }
  }, [scorecard, open, form]);

  const calculateOverall = (self, oh, hr) => {
    if (self !== undefined && oh !== undefined && hr !== undefined) {
      return Math.round((self + oh + hr) / 3);
    }
    return null;
  };

  const onFinish = async (values) => {
    try {
      const evaluationDate = values.evaluationDate
        ? dayjs(values.evaluationDate).toDate()
        : new Date();

      const scorecardPayload = {
        _id: scorecardId,
        userId: scorecard?.userId?._id || scorecard?.userId,
        month: values.month || scorecard?.month,
        year: values.year || scorecard?.year,
        name: values.name,
        designation: values.designation,
        team: values.team || null,
        evaluationDate,
        performanceCategories: performanceCategories.reduce((acc, cat) => {
          acc[cat.key] = {
            self: values[`${cat.key}_self`],
            oh: values[`${cat.key}_oh`],
            hr: values[`${cat.key}_hr`],
          };
          return acc;
        }, {}),
        appraisalScores: {
          self: values.selfScore,
          oh: values.ohScore,
          hr: values.hrScore,
        },
        roomForImprovement: values.roomForImprovement || null,
        remarks: {
          tl: values.tlRemarks || null,
          oh: values.ohRemarks || null,
          hr: values.hrRemarks || null,
        },
      };

      const { error } = await createOrUpdateScorecard(scorecardPayload);
      if (error) throw error;
      message.success("Performance scorecard updated successfully");
      onSuccess();
    } catch (error) {
      message.error(
        error?.data?.message || "Failed to save performance scorecard"
      );
    }
  };

  return (
    <Drawer
      title={
        <Space>
          <EditOutlined />
          <span>Edit Performance Scorecard</span>
          {scorecard && (
            <Tag color="blue">
              {scorecard.name} — {scorecard.month}/{scorecard.year}
            </Tag>
          )}
        </Space>
      }
      width={Math.min(window.innerWidth, 900)}
      open={open}
      onClose={onClose}
      destroyOnClose
      footer={null}
    >
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "60px" }}>
          <Spin size="large" />
        </div>
      ) : (
        <Form form={form} layout="vertical" onFinish={onFinish}>
          {/* Basic Info (read-only) */}
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Name">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="designation" label="Designation">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="team" label="Team">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="evaluationDate" label="Evaluation Date">
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" disabled />
              </Form.Item>
            </Col>
            <Col xs={12} sm={4}>
              <Form.Item name="month" label="Month">
                <Select disabled>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <Option key={m} value={m}>
                      {new Date(2000, m - 1).toLocaleString("default", { month: "long" })}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={12} sm={4}>
              <Form.Item name="year" label="Year">
                <Select disabled>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                    <Option key={y} value={y}>{y}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider>Performance Categories</Divider>

          {performanceCategories.map((category) => (
            <Card
              key={category.key}
              size="small"
              style={{ marginBottom: 12 }}
              title={<Text strong>{category.label}</Text>}
            >
              <Row gutter={[12, 0]}>
                <Col xs={24} sm={8}>
                  <Form.Item name={`${category.key}_self`} label="SELF">
                    <Select placeholder="Select grade" disabled>
                      {gradeOptions.map((opt) => (
                        <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    name={`${category.key}_oh`}
                    label="OH"
                    rules={[{ required: true, message: "Please select a grade" }]}
                  >
                    <Select placeholder="Select grade">
                      {gradeOptions.map((opt) => (
                        <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    name={`${category.key}_hr`}
                    label="HR"
                    rules={[{ required: true, message: "Please select a grade" }]}
                  >
                    <Select placeholder="Select grade">
                      {gradeOptions.map((opt) => (
                        <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          ))}

          <Divider>Manual Scores (Optional)</Divider>
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={8}>
              <Form.Item name="selfScore" label="SELF Score (%)">
                <InputNumber style={{ width: "100%" }} min={0} max={100} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="ohScore" label="OH Score (%)">
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  max={100}
                  onChange={(val) => {
                    const self = form.getFieldValue("selfScore");
                    const hr = form.getFieldValue("hrScore");
                    const overall = calculateOverall(self, val, hr);
                    if (overall !== null) form.setFieldsValue({ overallScore: overall });
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="hrScore" label="HR Score (%)">
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  max={100}
                  onChange={(val) => {
                    const self = form.getFieldValue("selfScore");
                    const oh = form.getFieldValue("ohScore");
                    const overall = calculateOverall(self, oh, val);
                    if (overall !== null) form.setFieldsValue({ overallScore: overall });
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="overallScore" label="Overall Performance (%)">
                <InputNumber style={{ width: "100%" }} min={0} max={100} disabled placeholder="Auto-calculated" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Remarks</Divider>
          <Form.Item name="roomForImprovement" label="Room for Improvement">
            <TextArea rows={3} placeholder="Enter room for improvement" />
          </Form.Item>
          <Form.Item name="tlRemarks" label="TL Remarks">
            <TextArea rows={2} placeholder="Enter TL remarks" />
          </Form.Item>
          <Form.Item name="ohRemarks" label="OH Remarks">
            <TextArea rows={2} placeholder="Enter OH remarks" />
          </Form.Item>
          <Form.Item name="hrRemarks" label="HR Remarks">
            <TextArea rows={2} placeholder="Enter HR remarks" />
          </Form.Item>

          <Form.Item style={{ marginTop: 16 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={isSubmitting}
                size="large"
              >
                Save Scorecard
              </Button>
              <Button onClick={onClose} size="large">
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Drawer>
  );
};

// ─── Main Scorecard Page ───────────────────────────────────────────────────────
const PerformanceScorecardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin =
    user?.role === "admin" ||
    user?.role === "sales_manager" ||
    user?.role === "operations_head" ||
    user?.role === "commander_admin";

  const [currentDate] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });
  const [selectedMonth, setSelectedMonth] = useState(currentDate.month);
  const [selectedYear, setSelectedYear] = useState(currentDate.year);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [notifying, setNotifying] = useState(false);

  // Inline edit drawer state
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingScorecardId, setEditingScorecardId] = useState(null);

  // For admin: get all scorecards
  const { data: allScorecardsData, isLoading: isLoadingScorecards, refetch: refetchScorecards } =
    useGetAllScorecardsQuery(
      { month: selectedMonth, year: selectedYear },
      { skip: !isAdmin }
    );

  const { data: userHistoryData, isLoading: isLoadingUserHistory } =
    useGetPerformanceHistoryQuery(
      {
        userId: user?.id || user?._id,
        month: selectedMonth,
        year: selectedYear,
      },
      { skip: isAdmin || !(user?.id || user?._id) }
    );

  // Get users without self-assessment (admin only)
  const {
    data: pendingUsersData,
    isLoading: isLoadingPendingUsers,
    refetch: refetchPendingUsers,
  } = useGetUsersWithoutSelfAssessmentQuery(
    { month: selectedMonth, year: selectedYear },
    { skip: !isAdmin || !notificationModalVisible }
  );

  const [notifyPending] = useNotifyPendingSelfAssessmentMutation();

  const allScorecards = allScorecardsData?.data?.scorecards || [];
  const userHistory = userHistoryData?.data?.history || [];

  const handleExport = () => {
    if (allScorecards.length === 0) {
      message.warning("No data to export");
      return;
    }

    const exportColumns = [
      { title: "Name", dataIndex: "name", key: "name" },
      { title: "Designation", dataIndex: "designation", key: "designation" },
      { title: "Team", dataIndex: "team", key: "team" },
      { title: "SELF Score (%)", key: "selfScore", getValue: (r) => r.appraisalScores?.self || 0 },
      { title: "OH Score (%)", key: "ohScore", getValue: (r) => r.appraisalScores?.oh || 0 },
      { title: "HR Score (%)", key: "hrScore", getValue: (r) => r.appraisalScores?.hr || 0 },
      {
        title: "Overall Performance (%)",
        key: "overallScore",
        getValue: (r) => {
          const overall = r.appraisalScores?.overall;
          if (overall !== undefined) return overall;
          return Math.round(((r.appraisalScores?.self || 0) + (r.appraisalScores?.oh || 0) + (r.appraisalScores?.hr || 0)) / 3);
        },
      },
      { title: "Month/Year", key: "period", getValue: (r) => `${r.month}/${r.year}` },
      {
        title: "Evaluation Date",
        key: "evaluationDate",
        getValue: (r) => r.evaluationDate ? dayjs(r.evaluationDate).format("DD/MM/YYYY") : "-",
      },
    ];

    const filename = `performance_scorecards_${selectedMonth}_${selectedYear}_${dayjs().format("YYYY-MM-DD_HH-mm-ss")}.csv`;
    exportToCSV(allScorecards, exportColumns, filename);
    message.success(`Exported ${allScorecards.length} scorecard(s) successfully`);
  };

  const handleNotifyPending = () => {
    setNotificationModalVisible(true);
    if (isAdmin) refetchPendingUsers();
  };

  const handleSendNotifications = async () => {
    try {
      setNotifying(true);
      const { data, error } = await notifyPending({
        month: selectedMonth,
        year: selectedYear,
      });
      if (error) throw error;
      message.success(`Notifications sent to ${data?.data?.notified || 0} user(s)`);
      setNotificationModalVisible(false);
      refetchPendingUsers();
    } catch (error) {
      console.error("Error sending notifications:", error);
      message.error(error?.data?.message || "Failed to send notifications");
    } finally {
      setNotifying(false);
    }
  };

  const handleOpenEdit = (record) => {
    setEditingScorecardId(record._id);
    setEditDrawerOpen(true);
  };

  const handleEditSuccess = () => {
    setEditDrawerOpen(false);
    setEditingScorecardId(null);
    refetchScorecards();
  };

  const pendingUsers = pendingUsersData?.data?.users || [];

  const exportMenuItems = [
    {
      key: "export",
      label: "Export to CSV",
      icon: <DownloadOutlined />,
      onClick: handleExport,
    },
  ];

  // ─── Admin table columns ───────────────────────────────────────────────────
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text, record) => text || record.userId?.name || "N/A",
    },
    { title: "Designation", dataIndex: "designation", key: "designation" },
    { title: "Team", dataIndex: "team", key: "team", render: (t) => t || "-" },
    {
      title: "SELF Score",
      dataIndex: ["appraisalScores", "self"],
      key: "selfScore",
      render: (score) => <Tag color="blue">{score || 0}%</Tag>,
    },
    {
      title: "OH Score",
      dataIndex: ["appraisalScores", "oh"],
      key: "ohScore",
      render: (score) => <Tag color="orange">{score || 0}%</Tag>,
    },
    {
      title: "HR Score",
      dataIndex: ["appraisalScores", "hr"],
      key: "hrScore",
      render: (score) => <Tag color="purple">{score || 0}%</Tag>,
    },
    {
      title: "Overall Performance",
      dataIndex: ["appraisalScores", "overall"],
      key: "overallScore",
      render: (score, record) => {
        const overall =
          score ||
          Math.round(
            ((record.appraisalScores?.self || 0) +
              (record.appraisalScores?.oh || 0) +
              (record.appraisalScores?.hr || 0)) /
              3
          );
        const color = overall >= 80 ? "green" : overall >= 60 ? "orange" : "red";
        return <Tag color={color} style={{ fontWeight: "bold" }}>{overall}%</Tag>;
      },
    },
    {
      title: "Status",
      key: "status",
      render: (_, record) => {
        const status = record.status || "draft";
        const statusMap = {
          draft: { color: "default", text: "Draft" },
          self_submitted: { color: "blue", text: "Self-Submitted" },
          review_completed: { color: "green", text: "Review Completed" },
        };
        const { color, text } = statusMap[status] || statusMap.draft;
        return <Tag color={color}>{text}</Tag>;
      },
    },
    { title: "Month/Year", key: "period", render: (_, r) => `${r.month}/${r.year}` },
    {
      title: "Actions",
      key: "actions",
      fixed: window.innerWidth <= 768 ? false : "right",
      width: 200,
      render: (_, record) => {
        const userId = record.userId?._id || record.userId;
        return (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
            >
              Edit
            </Button>
            <Button
              type="link"
              onClick={() => {
                if (userId && userId !== record._id) {
                  navigate(
                    `${location.pathname.startsWith("/agency") ? "/agency/hrms/performance" : location.pathname.startsWith("/client") ? "/client/hrms/performance" : location.pathname.startsWith("/user") ? "/user/performance" : "/hrms/performance"}/history/${userId}`
                  );
                }
              }}
            >
              View History
            </Button>
          </Space>
        );
      },
    },
  ];

  // ─── Non-admin view ────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <Space>
            <Button
              icon={<FileTextOutlined />}
              type="primary"
              onClick={() =>
                navigate(
                  `${location.pathname.startsWith("/agency") ? "/agency/hrms/performance" : location.pathname.startsWith("/client") ? "/client/hrms/performance" : location.pathname.startsWith("/user") ? "/user/performance" : "/hrms/performance"}/self-assessment`
                )
              }
              size="large"
            >
              Submit Self-Assessment
            </Button>
            <Button
              icon={<HistoryOutlined />}
              onClick={() =>
                navigate(
                  `${location.pathname.startsWith("/agency") ? "/agency/hrms/performance" : location.pathname.startsWith("/client") ? "/client/hrms/performance" : location.pathname.startsWith("/user") ? "/user/performance" : "/hrms/performance"}/history`
                )
              }
            >
              View History
            </Button>
          </Space>
        </div>

        <Alert
          message="Performance Self-Assessment"
          description="Submit your self-assessment for the current month. Your performance will be reviewed by the admin team."
          type="info"
          showIcon
          style={{ marginBottom: "24px" }}
          action={
            <Button
              size="small"
              type="primary"
              onClick={() =>
                navigate(
                  `${location.pathname.startsWith("/agency") ? "/agency/hrms/performance" : location.pathname.startsWith("/client") ? "/client/hrms/performance" : location.pathname.startsWith("/user") ? "/user/performance" : "/hrms/performance"}/self-assessment`
                )
              }
            >
              Start Assessment
            </Button>
          }
        />

        <Card
          title={
            <Space>
              <TrophyOutlined />
              <span>My Performance History</span>
            </Space>
          }
          extra={
            <Space>
              <Select
                style={{ width: 150 }}
                value={selectedMonth}
                onChange={(value) => setSelectedMonth(value)}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <Option key={month} value={month}>
                    {new Date(2000, month - 1).toLocaleString("default", { month: "long" })}
                  </Option>
                ))}
              </Select>
              <Select
                style={{ width: 100 }}
                value={selectedYear}
                onChange={(value) => setSelectedYear(value)}
              >
                {Array.from({ length: 5 }, (_, i) => currentDate.year - 2 + i).map((year) => (
                  <Option key={year} value={year}>{year}</Option>
                ))}
              </Select>
            </Space>
          }
        >
          {isLoadingUserHistory ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <Spin size="large" />
            </div>
          ) : userHistory.length === 0 ? (
            <Empty
              description="No performance history found for this period"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button
                type="primary"
                onClick={() =>
                  navigate(
                    `${location.pathname.startsWith("/agency") ? "/agency/hrms/performance" : location.pathname.startsWith("/client") ? "/client/hrms/performance" : location.pathname.startsWith("/user") ? "/user/performance" : "/hrms/performance"}/self-assessment`
                  )
                }
              >
                Submit Self-Assessment
              </Button>
            </Empty>
          ) : (
            <Table
              columns={[
                { title: "Month/Year", key: "period", render: (r) => `${r.month}/${r.year}` },
                {
                  title: "SELF Score",
                  dataIndex: ["appraisalScores", "self"],
                  key: "selfScore",
                  render: (score) => <Tag color="blue">{score || 0}%</Tag>,
                },
                {
                  title: "OH Score",
                  dataIndex: ["appraisalScores", "oh"],
                  key: "ohScore",
                  render: (score) => <Tag color="orange">{score || 0}%</Tag>,
                },
                {
                  title: "HR Score",
                  dataIndex: ["appraisalScores", "hr"],
                  key: "hrScore",
                  render: (score) => <Tag color="purple">{score || 0}%</Tag>,
                },
                {
                  title: "Overall Performance",
                  dataIndex: ["appraisalScores", "overall"],
                  key: "overallScore",
                  render: (score, record) => {
                    const overall =
                      score ||
                      Math.round(
                        ((record.appraisalScores?.self || 0) +
                          (record.appraisalScores?.oh || 0) +
                          (record.appraisalScores?.hr || 0)) /
                          3
                      );
                    const color = overall >= 80 ? "green" : overall >= 60 ? "orange" : "red";
                    return <Tag color={color} style={{ fontWeight: "bold" }}>{overall}%</Tag>;
                  },
                },
                {
                  title: "Status",
                  key: "status",
                  render: (record) => {
                    const status = record.status || "draft";
                    const statusMap = {
                      draft: { color: "default", text: "Draft" },
                      self_submitted: { color: "blue", text: "Self-Submitted" },
                      review_completed: { color: "green", text: "Review Completed" },
                    };
                    const { color, text } = statusMap[status] || statusMap.draft;
                    return <Tag color={color}>{text}</Tag>;
                  },
                },
                {
                  title: "Actions",
                  key: "actions",
                  fixed: window.innerWidth <= 768 ? false : "right",
                  width: 120,
                  render: (_, record) => (
                    <Button
                      type="link"
                      onClick={() =>
                        navigate(
                          `${location.pathname.startsWith("/agency") ? "/agency/hrms/performance" : location.pathname.startsWith("/client") ? "/client/hrms/performance" : location.pathname.startsWith("/user") ? "/user/performance" : "/hrms/performance"}/history`
                        )
                      }
                    >
                      View Details
                    </Button>
                  ),
                },
              ]}
              dataSource={userHistory}
              rowKey="_id"
              pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: "No performance history found" }}
            />
          )}
        </Card>
      </div>
    );
  }

  // ─── Admin view ────────────────────────────────────────────────────────────
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Performance Scorecard
        </Title>
        <Space>
          <Button
            icon={<HistoryOutlined />}
            onClick={() =>
              navigate(
                `${location.pathname.startsWith("/agency") ? "/agency/hrms/performance" : location.pathname.startsWith("/client") ? "/client/hrms/performance" : location.pathname.startsWith("/user") ? "/user/performance" : "/hrms/performance"}/history`
              )
            }
          >
            View History
          </Button>
          <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
            <Button icon={<DownloadOutlined />}>Export</Button>
          </Dropdown>
          <Button icon={<BellOutlined />} onClick={handleNotifyPending} size="large">
            Notify Pending Users
          </Button>
        </Space>
      </div>

      {/* Performance Table */}
      <Card
        title={
          <Space>
            <TrophyOutlined />
            <span>Performance Scorecards</span>
          </Space>
        }
        extra={
          <Space>
            <Select
              style={{ width: 150 }}
              value={selectedMonth}
              onChange={(value) => setSelectedMonth(value)}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <Option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleString("default", { month: "long" })}
                </Option>
              ))}
            </Select>
            <Select
              style={{ width: 100 }}
              value={selectedYear}
              onChange={(value) => setSelectedYear(value)}
            >
              {Array.from({ length: 5 }, (_, i) => currentDate.year - 2 + i).map((year) => (
                <Option key={year} value={year}>{year}</Option>
              ))}
            </Select>
          </Space>
        }
        style={{ marginBottom: "24px" }}
      >
        <Table
          columns={columns}
          dataSource={allScorecards}
          rowKey="_id"
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
          loading={isLoadingScorecards}
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: `No performance data available for ${selectedMonth}/${selectedYear}.`,
          }}
        />
      </Card>

      {/* Inline Edit Drawer */}
      <EditScorecardDrawer
        scorecardId={editingScorecardId}
        open={editDrawerOpen}
        onClose={() => {
          setEditDrawerOpen(false);
          setEditingScorecardId(null);
        }}
        onSuccess={handleEditSuccess}
      />

      {/* Notification Modal */}
      <Modal
        title={
          <Space>
            <BellOutlined />
            <span>Notify Users with Pending Self-Assessment</span>
            {pendingUsers.length > 0 && (
              <Badge count={pendingUsers.length} showZero />
            )}
          </Space>
        }
        open={notificationModalVisible}
        onOk={handleSendNotifications}
        onCancel={() => setNotificationModalVisible(false)}
        okText="Send Notifications"
        cancelText="Cancel"
        confirmLoading={notifying}
        width={600}
      >
        <Alert
          message={`For ${new Date(2000, selectedMonth - 1).toLocaleString("default", { month: "long" })} ${selectedYear}`}
          description={`The following ${pendingUsers.length} user(s) haven't completed their self-assessment:`}
          type="info"
          showIcon
          style={{ marginBottom: "16px" }}
        />
        {isLoadingPendingUsers ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <Spin />
          </div>
        ) : pendingUsers.length === 0 ? (
          <Empty
            description="All users have completed their self-assessment for this period"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={pendingUsers}
            renderItem={(user) => (
              <List.Item>
                <List.Item.Meta
                  title={user.name}
                  description={user.email || user.role || "No email"}
                />
              </List.Item>
            )}
            style={{ maxHeight: "400px", overflowY: "auto" }}
          />
        )}
      </Modal>
    </div>
  );
};

export default PerformanceScorecardPage;
