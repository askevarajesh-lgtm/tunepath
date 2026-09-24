import React, { useEffect, useState } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  message,
  Typography,
  Space,
  Row,
  Col,
  Spin,
  Tag,
  Divider,
  Radio,
  Switch,
  Alert,
} from "antd";
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PhoneOutlined,
  CopyOutlined,
  ApiOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  useGetIntegrationsQuery,
  useUpdateIntegrationMutation,
  useCreateIntegrationMutation,
} from "../../api/integrationApi";

const { Title, Text, Paragraph } = Typography;

const IvrConfigPage = ({ integrationId, clientId, onBack }) => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [authType, setAuthType] = useState("apiKey");
  const [updateIntegration, { isLoading: isUpdating }] = useUpdateIntegrationMutation();
  const [createIntegration, { isLoading: isCreating }] = useCreateIntegrationMutation();

  const queryParams = clientId ? { clientId } : {};
  const { data, isLoading: isFetching, refetch } = useGetIntegrationsQuery(queryParams);

  const integrations = data?.data?.integrations || [];
  const integration = integrations.find(
    (i) => (integrationId && i._id === integrationId) || i.type === "ivr"
  );
  const isNew = !integration;

  useEffect(() => {
    if (integration) {
      const config = integration.config || {};
      const detectedAuthType = config.bearerToken && !config.apiKey ? "bearer" : "apiKey";
      setAuthType(detectedAuthType);

      form.setFieldsValue({
        authType: detectedAuthType,
        baseUrl: config.baseUrl || "",
        apiKey: config.apiKey || "",
        bearerToken: config.bearerToken || "",
        did: config.did || "914443126059",
        outboundEndpoint: config.outboundEndpoint || "/calls/outbound",
        recordingBaseUrl: config.recordingBaseUrl || "",
        webhookSecret: config.webhookSecret || "",
        isActive: integration.isActive !== false,
      });
    } else {
      form.setFieldsValue({
        authType: "apiKey",
        did: "914443126059",
        outboundEndpoint: "/calls/outbound",
        isActive: true,
      });
    }
  }, [integration, form]);

  const handleSave = async (values) => {
    try {
      const payload = {
        name: "Sollu IVR / Telephony",
        type: "ivr",
        isActive: values.isActive !== undefined ? values.isActive : true,
        ...(clientId ? { clientId } : {}),
        config: {
          authType: values.authType,
          baseUrl: (values.baseUrl || "").trim(),
          apiKey: values.authType === "apiKey" ? (values.apiKey || "").trim() : "",
          bearerToken: values.authType === "bearer" ? (values.bearerToken || "").trim() : "",
          did: (values.did || "").trim(),
          outboundEndpoint: (values.outboundEndpoint || "").trim() || "/calls/outbound",
          recordingBaseUrl: (values.recordingBaseUrl || "").trim(),
          webhookSecret: (values.webhookSecret || "").trim(),
        },
      };

      if (isNew) {
        await createIntegration(payload).unwrap();
      } else {
        await updateIntegration({ id: integration._id, ...payload }).unwrap();
      }

      message.success("Sollu IVR integration settings saved successfully.");
      refetch();
      if (onBack) onBack();
      else navigate("/settings/integrations");
    } catch (err) {
      message.error(err?.data?.message || "Failed to save IVR integration.");
    }
  };

  const webhookUrl = `${window.location.origin}/api/ivr/webhook`;

  if (isFetching) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  const isConfigured = Boolean(
    integration?.config?.baseUrl?.trim() &&
      (integration?.config?.apiKey?.trim() || integration?.config?.bearerToken?.trim())
  );

  return (
    <div style={{ maxWidth: 840, padding: "20px 0" }}>
      <Space style={{ marginBottom: 20 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            if (onBack) onBack();
            else navigate("/settings/integrations");
          }}
        >
          Back to Integrations
        </Button>
      </Space>

      <Card
        title={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Space>
              <PhoneOutlined style={{ color: "#10b981", fontSize: 20 }} />
              <Title level={4} style={{ margin: 0 }}>
                Sollu IVR / Cloud Telephony Integration
              </Title>
            </Space>
            <Space>
              {isConfigured ? (
                <Tag color="success">✦ Configured</Tag>
              ) : (
                <Tag color="warning">Awaiting Setup</Tag>
              )}
              {integration?.isActive ? (
                <Tag color="processing">Active</Tag>
              ) : (
                <Tag color="default">Inactive</Tag>
              )}
            </Space>
          </div>
        }
        bordered={false}
        className="shadow-md"
        style={{ borderRadius: 14 }}
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 20 }}>
          Configure your Sollu IVR API credentials, Caller DID, and webhook receiver to enable outbound click-to-call, call status tracking, and recording playback.
        </Text>

        {/* Webhook URL Display Box */}
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 24, borderRadius: 8 }}
          message={<strong>Sollu Webhook URL</strong>}
          description={
            <div>
              <Paragraph style={{ margin: "4px 0 8px" }}>
                Provide this webhook URL to your Sollu IVR provider. Sollu will post call status updates, agent connections, and recordings directly to this endpoint:
              </Paragraph>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#f1f5f9",
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontFamily: "monospace",
                  fontSize: 13,
                  color: "#0f172a",
                  justifyContent: "space-between",
                }}
              >
                <span>{webhookUrl}</span>
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    message.success("Webhook URL copied to clipboard!");
                  }}
                >
                  Copy URL
                </Button>
              </div>
            </div>
          }
        />

        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Divider orientation="left" style={{ fontSize: 14, color: "#64748b" }}>
            <ApiOutlined /> API Connection Details
          </Divider>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="baseUrl"
                label={<strong>Sollu API Base URL</strong>}
                rules={[{ required: true, message: "Please enter Sollu API Base URL" }]}
              >
                <Input placeholder="https://api.sollu.com/v1" size="large" />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item name="authType" label={<strong>Authentication Method</strong>}>
                <Radio.Group
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value)}
                  buttonStyle="solid"
                >
                  <Radio.Button value="apiKey">API Key (x-api-key)</Radio.Button>
                  <Radio.Button value="bearer">Bearer Token</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>

            {authType === "apiKey" ? (
              <Col span={24}>
                <Form.Item
                  name="apiKey"
                  label={<strong>Sollu API Key</strong>}
                  rules={[{ required: true, message: "Please enter Sollu API Key" }]}
                >
                  <Input.Password placeholder="Enter your Sollu API Key" size="large" />
                </Form.Item>
              </Col>
            ) : (
              <Col span={24}>
                <Form.Item
                  name="bearerToken"
                  label={<strong>Sollu Bearer Token</strong>}
                  rules={[{ required: true, message: "Please enter Sollu Bearer Token" }]}
                >
                  <Input.Password placeholder="Enter your Bearer Token" size="large" />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Divider orientation="left" style={{ fontSize: 14, color: "#64748b" }}>
            <PhoneOutlined /> Call & Caller ID Settings
          </Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="did"
                label={<strong>Virtual Number / Caller DID</strong>}
                tooltip="The outbound caller ID displayed to customers"
                rules={[{ required: true, message: "Please specify Caller DID" }]}
              >
                <Input placeholder="e.g. 914443126059" size="large" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="outboundEndpoint"
                label={<strong>Outbound Calling Endpoint</strong>}
                tooltip="Endpoint on Sollu API for triggering outbound calls"
              >
                <Input placeholder="/calls/outbound" size="large" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="recordingBaseUrl"
                label={<strong>Recording CDN / Base URL (Optional)</strong>}
                tooltip="If Sollu webhook sends filenames (e.g. abcd.mp3) instead of full URLs"
              >
                <Input placeholder="https://recordings.sollu.com/" size="large" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="webhookSecret"
                label={<strong>Webhook Secret Key (Optional)</strong>}
                tooltip="Shared secret to verify Sollu webhook authenticity"
              >
                <Input.Password placeholder="Enter webhook secret token" size="large" />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item name="isActive" label={<strong>Enable Integration</strong>} valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={isUpdating || isCreating}
              size="large"
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                borderColor: "#10b981",
                fontWeight: 600,
                borderRadius: 8,
                padding: "0 28px",
              }}
            >
              Save IVR Settings
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default IvrConfigPage;
