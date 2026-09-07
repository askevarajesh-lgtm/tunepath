import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Row,
  Col,
  Typography,
  Space,
  message,
  Spin,
  Divider,
} from "antd";
import {
  ArrowLeftOutlined,
  UserOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  useCreateOrUpdateScorecardMutation,
  useGetScorecardByIdQuery,
  useGetSelfAssessmentQuery,
} from "../../api/performanceApi";
import { useGetUsersQuery } from "../../api/userApi";
import { useGetAllScorecardsQuery } from "../../api/performanceApi";
import { useGetDepartmentsDynamicQuery } from "../../api/accessControlApi";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const CalculatePerformancePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [selectedUserId, setSelectedUserId] = useState(null);

  const { data: deptData } = useGetDepartmentsDynamicQuery();
  const departmentOptions = React.useMemo(() => {
    if (!deptData) return [];
    if (Array.isArray(deptData.data?.departments)) return deptData.data.departments;
    if (Array.isArray(deptData.departments)) return deptData.departments;
    if (Array.isArray(deptData.data)) return deptData.data;
    if (Array.isArray(deptData)) return deptData;
    return [];
  }, [deptData]);
  const [currentDate] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });
  // Default to current month and year
  const [selectedMonth, setSelectedMonth] = useState(currentDate.month);
  const [selectedYear, setSelectedYear] = useState(currentDate.year);

  const { data: usersData } = useGetUsersQuery();
  const { data: scorecardData, isLoading: isLoadingScorecard } =
    useGetScorecardByIdQuery(id, { skip: !isEdit });
  const { data: existingScorecardsData, refetch: refetchExisting } =
    useGetAllScorecardsQuery(
      {
        month: selectedMonth || currentDate.month,
        year: selectedYear || currentDate.year,
      },
      { skip: !selectedMonth && !selectedYear },
    );

  // Fetch self-assessment when admin selects a user (for pre-filling)
  const { data: selfAssessmentData } = useGetSelfAssessmentQuery(
    {
      userId: selectedUserId,
      month: selectedMonth || currentDate.month,
      year: selectedYear || currentDate.year,
    },
    { skip: !selectedUserId || !selectedMonth || !selectedYear || isEdit },
  );

  const [createOrUpdateScorecard, { isLoading: isSubmitting }] =
    useCreateOrUpdateScorecardMutation();

  // Handle paginated response (data?.data?.data) or legacy format (data?.data?.users)
  const users = usersData?.data?.data || usersData?.data?.users || [];
  const existingScorecards = existingScorecardsData?.data?.scorecards || [];
  const scorecard = scorecardData?.data?.scorecard;

  // Refetch existing scorecards when month/year changes
  useEffect(() => {
    if (selectedMonth && selectedYear) {
      refetchExisting();
    }
  }, [selectedMonth, selectedYear, refetchExisting]);

  // Get user IDs that already have entries for the selected month/year
  const existingUserIds = existingScorecards
    .filter((sc) => {
      const scMonth = selectedMonth || currentDate.month;
      const scYear = selectedYear || currentDate.year;
      return sc.month === scMonth && sc.year === scYear;
    })
    .map((sc) => sc.userId?._id || sc.userId)
    .filter(
      (id) =>
        id && (!isEdit || id !== (scorecard?.userId?._id || scorecard?.userId)),
    );

  // Filter users - exclude those who already have entries (unless editing)
  const availableUsers = users.filter(
    (user) =>
      !existingUserIds.includes(user._id) ||
      (isEdit && user._id === (scorecard?.userId?._id || scorecard?.userId)),
  );

  // Performance categories configuration
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

  const gradeOptions = [
    { value: "A", label: "A - EXCELLENT" },
    { value: "B", label: "B - GOOD" },
    { value: "C", label: "C - NEED IMPROVEMENT" },
    { value: "D", label: "D - REMAINS SAME" },
  ];

  useEffect(() => {
    if (isEdit && scorecard) {
      setSelectedUserId(scorecard.userId?._id || scorecard.userId);
      setSelectedMonth(scorecard.month);
      setSelectedYear(scorecard.year);
      const userObj = scorecard.userId;
      const resolvedDesignation = userObj?.roleName || userObj?.role || scorecard.designation || "";
      const resolvedTeam = scorecard.team || userObj?.departmentName || userObj?.departmentId?.name || "";

      form.setFieldsValue({
        userId: userObj?._id || userObj || scorecard.userId,
        name: scorecard.name,
        designation: resolvedDesignation,
        team: resolvedTeam,
        month: scorecard.month,
        year: scorecard.year,
        evaluationDate: scorecard.evaluationDate
          ? dayjs(scorecard.evaluationDate)
          : dayjs(),
        selfScore: scorecard.appraisalScores?.self,
        ohScore: scorecard.appraisalScores?.oh,
        hrScore: scorecard.appraisalScores?.hr,
        officeTimeLogIn_self:
          scorecard.performanceCategories?.officeTimeLogIn?.self,
        officeTimeLogIn_oh:
          scorecard.performanceCategories?.officeTimeLogIn?.oh,
        officeTimeLogIn_hr:
          scorecard.performanceCategories?.officeTimeLogIn?.hr,
        attendance_self: scorecard.performanceCategories?.attendance?.self,
        attendance_oh: scorecard.performanceCategories?.attendance?.oh,
        attendance_hr: scorecard.performanceCategories?.attendance?.hr,
        commitmentTowardsWork_self:
          scorecard.performanceCategories?.commitmentTowardsWork?.self,
        commitmentTowardsWork_oh:
          scorecard.performanceCategories?.commitmentTowardsWork?.oh,
        commitmentTowardsWork_hr:
          scorecard.performanceCategories?.commitmentTowardsWork?.hr,
        discipline_self: scorecard.performanceCategories?.discipline?.self,
        discipline_oh: scorecard.performanceCategories?.discipline?.oh,
        discipline_hr: scorecard.performanceCategories?.discipline?.hr,
        teamWork_self: scorecard.performanceCategories?.teamWork?.self,
        teamWork_oh: scorecard.performanceCategories?.teamWork?.oh,
        teamWork_hr: scorecard.performanceCategories?.teamWork?.hr,
        innovation_self: scorecard.performanceCategories?.innovation?.self,
        innovation_oh: scorecard.performanceCategories?.innovation?.oh,
        innovation_hr: scorecard.performanceCategories?.innovation?.hr,
        dailyReportSubmission_self:
          scorecard.performanceCategories?.dailyReportSubmission?.self,
        dailyReportSubmission_oh:
          scorecard.performanceCategories?.dailyReportSubmission?.oh,
        dailyReportSubmission_hr:
          scorecard.performanceCategories?.dailyReportSubmission?.hr,
        workConsistency_self:
          scorecard.performanceCategories?.workConsistency?.self,
        workConsistency_oh:
          scorecard.performanceCategories?.workConsistency?.oh,
        workConsistency_hr:
          scorecard.performanceCategories?.workConsistency?.hr,
        workEvaluation_self:
          scorecard.performanceCategories?.workEvaluation?.self,
        workEvaluation_oh: scorecard.performanceCategories?.workEvaluation?.oh,
        workEvaluation_hr: scorecard.performanceCategories?.workEvaluation?.hr,
        roomForImprovement: scorecard.roomForImprovement || "",
        tlRemarks: scorecard.remarks?.tl || "",
        ohRemarks: scorecard.remarks?.oh || "",
        hrRemarks: scorecard.remarks?.hr || "",
      });
    } else {
      form.setFieldsValue({
        month: currentDate.month,
        year: currentDate.year,
        evaluationDate: dayjs(),
      });
      setSelectedMonth(currentDate.month);
      setSelectedYear(currentDate.year);
    }
  }, [isEdit, scorecard, form, currentDate]);

  const handleUserSelect = (userId) => {
    setSelectedUserId(userId);
    const selectedUser = users.find((u) => u._id === userId);
    if (selectedUser) {
      form.setFieldsValue({
        name: selectedUser.name,
        designation: selectedUser.roleName || selectedUser.role || "",
        team: selectedUser.departmentName || selectedUser.departmentId?.name || selectedUser.team || "",
      });
    }
  };

  // Pre-fill self-assessment data when admin selects a user
  useEffect(() => {
    if (
      !isEdit &&
      selectedUserId &&
      selectedMonth &&
      selectedYear &&
      selfAssessmentData?.data?.scorecard
    ) {
      const selfAssessment = selfAssessmentData.data.scorecard;
      const formValues = {};

      // Pre-fill self grades from self-assessment
      performanceCategories.forEach((cat) => {
        formValues[`${cat.key}_self`] =
          selfAssessment.performanceCategories?.[cat.key]?.self;
      });

      // Pre-fill other fields if they exist
      if (selfAssessment.evaluationDate) {
        formValues.evaluationDate = dayjs(selfAssessment.evaluationDate);
      }
      if (selfAssessment.appraisalScores?.self) {
        formValues.selfScore = selfAssessment.appraisalScores.self;
      }

      form.setFieldsValue(formValues);
    }
  }, [
    selectedUserId,
    selectedMonth,
    selectedYear,
    selfAssessmentData,
    isEdit,
    form,
  ]);

  const handleMonthYearChange = (month, year) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  // Calculate overall performance automatically
  const calculateOverall = (self, oh, hr) => {
    if (self !== undefined && oh !== undefined && hr !== undefined) {
      return Math.round((self + oh + hr) / 3);
    }
    return null;
  };

  const onFinish = async (values) => {
    try {
      if (!selectedUserId) {
        message.error("Please select a user");
        return;
      }

      const evaluationDate = values.evaluationDate
        ? dayjs(values.evaluationDate).toDate()
        : new Date();

      const scorecardData = {
        ...(isEdit && id ? { _id: id } : {}),
        userId: selectedUserId,
        month: values.month || currentDate.month,
        year: values.year || currentDate.year,
        name: values.name,
        designation: values.designation,
        team: values.team || null,
        evaluationDate,
        performanceCategories: {
          officeTimeLogIn: {
            self: values.officeTimeLogIn_self,
            oh: values.officeTimeLogIn_oh,
            hr: values.officeTimeLogIn_hr,
          },
          attendance: {
            self: values.attendance_self,
            oh: values.attendance_oh,
            hr: values.attendance_hr,
          },
          commitmentTowardsWork: {
            self: values.commitmentTowardsWork_self,
            oh: values.commitmentTowardsWork_oh,
            hr: values.commitmentTowardsWork_hr,
          },
          discipline: {
            self: values.discipline_self,
            oh: values.discipline_oh,
            hr: values.discipline_hr,
          },
          teamWork: {
            self: values.teamWork_self,
            oh: values.teamWork_oh,
            hr: values.teamWork_hr,
          },
          innovation: {
            self: values.innovation_self,
            oh: values.innovation_oh,
            hr: values.innovation_hr,
          },
          dailyReportSubmission: {
            self: values.dailyReportSubmission_self,
            oh: values.dailyReportSubmission_oh,
            hr: values.dailyReportSubmission_hr,
          },
          workConsistency: {
            self: values.workConsistency_self,
            oh: values.workConsistency_oh,
            hr: values.workConsistency_hr,
          },
          workEvaluation: {
            self: values.workEvaluation_self,
            oh: values.workEvaluation_oh,
            hr: values.workEvaluation_hr,
          },
        },
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

      const { error } = await createOrUpdateScorecard(scorecardData);
      if (error) throw error;
      message.success(
        isEdit
          ? "Performance scorecard updated successfully"
          : "Performance scorecard saved successfully",
      );
      navigate(`${location.pathname.startsWith("/agency") ? "/agency/hrms/performance" : location.pathname.startsWith("/client") ? "/client/hrms/performance" : location.pathname.startsWith("/user") ? "/user/performance" : "/hrms/performance"}`);
    } catch (error) {
      message.error(
        error?.data?.message || "Failed to save performance scorecard",
      );
    }
  };

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
          {isEdit ? "Edit Performance Scorecard" : "Calculate Performance"}
        </h1>
      </div>

      <Card>
        {isLoadingScorecard ? (
          <Spin />
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{
              evaluationDate: dayjs(),
              month: selectedMonth || currentDate.month,
              year: selectedYear || currentDate.year,
            }}
          >
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  name="userId"
                  label="Select User"
                  rules={[{ required: true, message: "Please select a user" }]}
                >
                  <Select
                    placeholder="Select a user"
                    showSearch
                    optionFilterProp="children"
                    onChange={handleUserSelect}
                    disabled={isEdit}
                    filterOption={(input, option) =>
                      (option?.label ?? "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                  >
                    {availableUsers.length === 0 ? (
                      <Option disabled value="no-users">
                        {isEdit
                          ? "No users available"
                          : "All users already have entries for this month/year"}
                      </Option>
                    ) : (
                      availableUsers.map((user) => (
                        <Option
                          key={user._id}
                          value={user._id}
                          label={user.name}
                        >
                          {user.name} ({user.email}) - {user.role}
                        </Option>
                      ))
                    )}
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={6}>
                <Form.Item
                  name="name"
                  label="Name"
                  rules={[{ required: true }]}
                >
                  <Input prefix={<UserOutlined />} disabled={isEdit} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={6}>
                <Form.Item
                  name="designation"
                  label="Designation"
                  rules={[{ required: true }]}
                >
                  <Input disabled={isEdit} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={6}>
                <Form.Item name="team" label="Team">
                  <Select placeholder="Select Department/Team" allowClear showSearch optionFilterProp="children">
                    {departmentOptions.map((dept) => {
                      const val = typeof dept === 'object' ? (dept.name || dept.slug) : dept;
                      return (
                        <Option key={val} value={val}>
                          {val}
                        </Option>
                      );
                    })}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={6}>
                <Form.Item
                  name="evaluationDate"
                  label="Evaluation Date"
                  rules={[{ required: true }]}
                >
                  <DatePicker
                    style={{ width: "100%" }}
                    format="DD/MM/YYYY"
                    disabled={isEdit}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={6}>
                <Form.Item
                  name="month"
                  label="Month"
                  rules={[{ required: true }]}
                >
                  <Select
                    disabled={isEdit}
                    onChange={(value) =>
                      handleMonthYearChange(
                        value,
                        form.getFieldValue("year") || currentDate.year,
                      )
                    }
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(
                      (month) => (
                        <Option key={month} value={month}>
                          {new Date(2000, month - 1).toLocaleString("default", {
                            month: "long",
                          })}
                        </Option>
                      ),
                    )}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={6}>
                <Form.Item
                  name="year"
                  label="Year"
                  rules={[{ required: true }]}
                >
                  <Select
                    disabled={isEdit}
                    onChange={(value) =>
                      handleMonthYearChange(
                        form.getFieldValue("month") || currentDate.month,
                        value,
                      )
                    }
                  >
                    {Array.from(
                      { length: 5 },
                      (_, i) => currentDate.year - 2 + i,
                    ).map((year) => (
                      <Option key={year} value={year}>
                        {year}
                      </Option>
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
                style={{ marginBottom: "16px" }}
                title={category.label}
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name={`${category.key}_self`}
                      label="SELF"
                      rules={[
                        { required: true, message: "Please select grade" },
                      ]}
                    >
                      <Select placeholder="Select grade" disabled={isEdit}>
                        {gradeOptions.map((option) => (
                          <Option key={option.value} value={option.value}>
                            {option.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name={`${category.key}_oh`}
                      label="OH"
                      rules={[
                        { required: true, message: "Please select grade" },
                      ]}
                    >
                      <Select placeholder="Select grade">
                        {gradeOptions.map((option) => (
                          <Option key={option.value} value={option.value}>
                            {option.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name={`${category.key}_hr`}
                      label="HR"
                      rules={[
                        { required: true, message: "Please select grade" },
                      ]}
                    >
                      <Select placeholder="Select grade">
                        {gradeOptions.map((option) => (
                          <Option key={option.value} value={option.value}>
                            {option.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            ))}

            <Divider>
              Manual Scores (Optional - will auto-calculate from categories if
              not provided)
            </Divider>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="selfScore"
                  label="SELF Score (%)"
                  rules={[
                    {
                      type: "number",
                      min: 0,
                      max: 100,
                      message: "Score must be between 0 and 100",
                    },
                  ]}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    min={0}
                    max={100}
                    placeholder="Enter SELF score (0-100)"
                    disabled={isEdit}
                    onChange={(value) => {
                      const oh = form.getFieldValue("ohScore");
                      const hr = form.getFieldValue("hrScore");
                      const overall = calculateOverall(value, oh, hr);
                      if (overall !== null) {
                        form.setFieldsValue({ overallScore: overall });
                      }
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="ohScore"
                  label="OH Score (%)"
                  rules={[
                    {
                      type: "number",
                      min: 0,
                      max: 100,
                      message: "Score must be between 0 and 100",
                    },
                  ]}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    min={0}
                    max={100}
                    placeholder="Enter OH score (0-100)"
                    onChange={(value) => {
                      const self = form.getFieldValue("selfScore");
                      const hr = form.getFieldValue("hrScore");
                      const overall = calculateOverall(self, value, hr);
                      if (overall !== null) {
                        form.setFieldsValue({ overallScore: overall });
                      }
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="hrScore"
                  label="HR Score (%)"
                  rules={[
                    {
                      type: "number",
                      min: 0,
                      max: 100,
                      message: "Score must be between 0 and 100",
                    },
                  ]}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    min={0}
                    max={100}
                    placeholder="Enter HR score (0-100)"
                    onChange={(value) => {
                      const self = form.getFieldValue("selfScore");
                      const oh = form.getFieldValue("ohScore");
                      const overall = calculateOverall(self, oh, value);
                      if (overall !== null) {
                        form.setFieldsValue({ overallScore: overall });
                      }
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="overallScore" label="Overall Performance (%)">
                  <InputNumber
                    style={{ width: "100%" }}
                    min={0}
                    max={100}
                    disabled
                    placeholder="Auto-calculated"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider>Remarks</Divider>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  name="roomForImprovement"
                  label="Room for Improvement"
                >
                  <TextArea rows={3} placeholder="Enter room for improvement" />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="tlRemarks" label="TL Remarks">
                  <TextArea rows={2} placeholder="Enter TL remarks" />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="ohRemarks" label="OH Remarks">
                  <TextArea rows={2} placeholder="Enter OH remarks" />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="hrRemarks" label="HR Remarks">
                  <TextArea rows={2} placeholder="Enter HR remarks" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={isSubmitting}
                  size="large"
                >
                  Save Performance Scorecard
                </Button>
                <Button onClick={() => navigate(`${location.pathname.startsWith("/agency") ? "/agency/hrms/performance" : location.pathname.startsWith("/client") ? "/client/hrms/performance" : location.pathname.startsWith("/user") ? "/user/performance" : "/hrms/performance"}`)} size="large">
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default CalculatePerformancePage;
