import React, { useEffect } from "react";
import {
  Form,
  InputNumber,
  Button,
  Card,
  Typography,
  Space,
  Spin,
  Alert,
  Divider,
  Row,
  Col,
  Select,
} from "antd";
import {
  PictureOutlined,
  VideoCameraOutlined,
  SaveOutlined,
  InfoCircleOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import { notifySuccess, notifyError } from '../../utils/notify';
import {
  useGetDMTeamSettingsQuery,
  useUpdateDMTeamSettingsMutation,
  useGetDepartmentsQuery,
} from "../../api/settingsApi";
import { useTheme } from "../../contexts/ThemeContext";

const { Title, Text } = Typography;
const { Option } = Select;

const DigitalMarketingTeamSettings = () => {
  const [form] = Form.useForm();
  const { isDark } = useTheme();

  const {
    data: dmSettingsData,
    isLoading,
    isError,
    refetch,
  } = useGetDMTeamSettingsQuery();

  const { data: deptData } = useGetDepartmentsQuery();

  const [updateDMTeamSettings, { isLoading: isSaving }] =
    useUpdateDMTeamSettingsMutation();

  const dmSettings = dmSettingsData?.data?.dmTeam;
  const departments = deptData?.data?.departments || deptData?.data || [];

  // Populate form when data arrives
  useEffect(() => {
    if (dmSettings) {
      form.setFieldsValue({
        departmentId: dmSettings.departmentId || undefined,
        designerDailyLimit: dmSettings.designerDailyLimit ?? 7,
        videoEditorDailyLimit: dmSettings.videoEditorDailyLimit ?? 3,
      });
    }
  }, [dmSettings, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const res = await updateDMTeamSettings({
        departmentId: values.departmentId,
        designerDailyLimit: values.designerDailyLimit,
        videoEditorDailyLimit: values.videoEditorDailyLimit,
      });

      if (res?.data?.success) {
        notifySuccess('dm-settings', 'global', "Digital Marketing Team settings saved successfully!");
        refetch();
      } else if (res?.error) {
        notifyError('dm-settings', 'global', res.error?.data?.message || "Failed to save settings.");
      } else {
        notifySuccess('dm-settings', 'global', "Digital Marketing Team settings saved successfully!");
        refetch();
      }
    } catch (error) {
      if (!error?.errorFields) {
        notifyError('dm-settings', 'global', "Failed to save settings. Please try again.");
      }
    }
  };

  const cardStyle = {
    borderRadius: 12,
    border: isDark ? "1px solid #2b2b31" : "1px solid #e8edf3",
    background: isDark ? "#141419" : "#ffffff",
    boxShadow: isDark
      ? "0 4px 16px rgba(0,0,0,0.3)"
      : "0 4px 16px rgba(15,23,42,0.06)",
  };

  const accentStyle = (color) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 10,
    background: isDark ? `${color}22` : `${color}15`,
    color,
    fontSize: 18,
    marginBottom: 8,
  });

  if (isLoading) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <Spin size="large" tip="Loading settings..." />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Failed to load Digital Marketing Team settings"
        description="Please refresh and try again."
        action={
          <Button size="small" onClick={refetch}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header info banner */}
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 20, borderRadius: 10 }}
        message="Daily Task Limit Configuration"
        description="Select your agency department and set the maximum number of tasks that can be assigned per role per day. These limits apply across Task Page, Analytics, and Progress Tracking."
      />

      <Form form={form} layout="vertical" requiredMark="optional">
        {/* Department Selection */}
        <Card style={{ ...cardStyle, marginBottom: 20 }} bodyStyle={{ padding: "20px 24px" }}>
          <div style={accentStyle("var(--accent-info)")}>
            <ApartmentOutlined />
          </div>
          <Title
            level={5}
            style={{
              margin: "0 0 4px",
              color: isDark ? "#f3f4f6" : "#111827",
            }}
          >
            Agency Department Selection
          </Title>
          <Text
            type="secondary"
            style={{ fontSize: 12, display: "block", marginBottom: 16 }}
          >
            Select the digital marketing or agency department these limits apply to
          </Text>
          <Form.Item
            name="departmentId"
            label="Department"
            style={{ marginBottom: 0 }}
          >
            <Select
              showSearch
              placeholder="Select department (e.g. Digital Marketing)"
              optionFilterProp="children"
              allowClear
              size="large"
            >
              {departments.map((d) => (
                <Option key={d._id} value={d._id}>
                  {d.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Card>

        <Row gutter={[20, 0]}>
          {/* Designer limit */}
          <Col xs={24} md={12}>
            <Card style={cardStyle} bodyStyle={{ padding: "20px 24px" }}>
              <div style={accentStyle("var(--accent-primary)")}>
                <PictureOutlined />
              </div>
              <Title
                level={5}
                style={{
                  margin: "0 0 4px",
                  color: isDark ? "#f3f4f6" : "#111827",
                }}
              >
                Designer
              </Title>
              <Text
                type="secondary"
                style={{ fontSize: 12, display: "block", marginBottom: 16 }}
              >
                Max tasks a Designer can be assigned per day
              </Text>
              <Form.Item
                name="designerDailyLimit"
                label="Daily Task Limit"
                rules={[
                  { required: true, message: "Please enter a limit" },
                  {
                    type: "number",
                    min: 1,
                    max: 50,
                    message: "Limit must be between 1 and 50",
                  },
                ]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber
                  min={1}
                  max={50}
                  precision={0}
                  style={{ width: "100%" }}
                  size="large"
                  placeholder="e.g. 7"
                  addonAfter="tasks / day"
                />
              </Form.Item>
            </Card>
          </Col>

          {/* Video Editor limit */}
          <Col xs={24} md={12}>
            <Card style={cardStyle} bodyStyle={{ padding: "20px 24px" }}>
              <div style={accentStyle("#7c3aed")}>
                <VideoCameraOutlined />
              </div>
              <Title
                level={5}
                style={{
                  margin: "0 0 4px",
                  color: isDark ? "#f3f4f6" : "#111827",
                }}
              >
                Video Editor
              </Title>
              <Text
                type="secondary"
                style={{ fontSize: 12, display: "block", marginBottom: 16 }}
              >
                Max tasks a Video Editor can be assigned per day
              </Text>
              <Form.Item
                name="videoEditorDailyLimit"
                label="Daily Task Limit"
                rules={[
                  { required: true, message: "Please enter a limit" },
                  {
                    type: "number",
                    min: 1,
                    max: 50,
                    message: "Limit must be between 1 and 50",
                  },
                ]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber
                  min={1}
                  max={50}
                  precision={0}
                  style={{ width: "100%" }}
                  size="large"
                  placeholder="e.g. 2"
                  addonAfter="tasks / day"
                />
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Divider style={{ margin: "20px 0" }} />

        {/* Current values summary */}
        {dmSettings && (
          <Card
            size="small"
            style={{
              ...cardStyle,
              marginBottom: 20,
              background: isDark ? "#1a1a22" : "#f9fafb",
            }}
            bodyStyle={{ padding: "12px 16px" }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              <strong>Currently saved:</strong> &nbsp; Department →{" "}
              <strong>{dmSettings.departmentName || "Digital Marketing"}</strong>
              &nbsp;&nbsp;|&nbsp;&nbsp; Designer →{" "}
              <strong>{dmSettings.designerDailyLimit} tasks/day</strong>
              &nbsp;&nbsp;|&nbsp;&nbsp; Video Editor →{" "}
              <strong>{dmSettings.videoEditorDailyLimit} tasks/day</strong>
            </Text>
          </Card>
        )}

        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            size="large"
            loading={isSaving}
            onClick={handleSave}
            style={{
              borderRadius: 8,
              fontWeight: 600,
              paddingInline: 28,
            }}
          >
            Save Changes
          </Button>
          <Button
            size="large"
            style={{ borderRadius: 8 }}
            onClick={() => {
              if (dmSettings) {
                form.setFieldsValue({
                  departmentId: dmSettings.departmentId || undefined,
                  designerDailyLimit: dmSettings.designerDailyLimit,
                  videoEditorDailyLimit: dmSettings.videoEditorDailyLimit,
                });
              }
            }}
          >
            Reset
          </Button>
        </Space>
      </Form>
    </div>
  );
};

export default DigitalMarketingTeamSettings;
