import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Form,
  Input,
  message,
  Space,
  Tag,
  Typography,
  Select,
  Table,
  Alert,
  Spin,
  Row,
  Col,
  Modal,
  Switch,
  Tabs,
  Descriptions,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  SettingOutlined,
  PlusOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetIntegrationsQuery,
  useUpdateIntegrationMutation,
  useCreateIntegrationMutation,
  useFetchWhatsAppTemplatesQuery,
  useSendMessageMutation,
  useGetEventConfigsQuery,
  useUpsertEventConfigMutation,
} from "../../api/integrationApi";
import PhoneInput from "../../components/common/PhoneInput";
import { isValidPhoneNumber } from "libphonenumber-js";

const { TextArea } = Input;
const { Title, Text } = Typography;
const { Option } = Select;

const eventTypes = [
  {
    value: "invoice_sent",
    label: "Invoice Sent",
    variables: [
      "invoiceNumber",
      "companyName",
      "totalAmount",
      "dueDate",
      "customMessage",
    ],
  },
  {
    value: "invoice_paid",
    label: "Invoice Paid",
    variables: ["invoiceNumber", "companyName", "amountPaid", "customMessage"],
  },
  {
    value: "payment_reminder",
    label: "Payment Reminder",
    variables: [
      "invoiceNumber",
      "companyName",
      "amountDue",
      "dueDate",
      "customMessage",
    ],
  },
  {
    value: "welcome_message",
    label: "Welcome Message",
    variables: ["username", "companyName", "customMessage"],
  },
  {
    value: "forgot_password",
    label: "Forgot Password",
    variables: ["email", "otp", "companyName", "customMessage"],
  },
  {
    value: "custom_message",
    label: "Custom Message",
    variables: ["username", "customMessage"],
  },
  {
    value: "email_sent",
    label: "Email Sent",
    variables: ["username", "subject", "customMessage"],
  },
  {
    value: "notification",
    label: "Notification",
    variables: ["username", "message", "customMessage"],
  },
  {
    value: "task_assigned",
    label: "Task Assigned",
    variables: [
      "taskTitle",
      "taskId",
      "assignedToName",
      "assignedByName",
      "dueDate",
      "priority",
      "companyName",
      "customMessage",
    ],
  },
  {
    value: "task_status_changed",
    label: "Task Status Changed",
    variables: [
      "taskTitle",
      "taskId",
      "assignedToName",
      "changedByName",
      "oldStatus",
      "newStatus",
      "companyName",
      "customMessage",
    ],
  },
  {
    value: "task_priority_changed",
    label: "Task Priority Changed",
    variables: [
      "taskTitle",
      "taskId",
      "assignedToName",
      "changedByName",
      "oldPriority",
      "newPriority",
      "dueDate",
      "companyName",
      "customMessage",
    ],
  },
  {
    value: "task_completed",
    label: "Task Completed",
    variables: [
      "taskTitle",
      "taskId",
      "completedByName",
      "watcherName",
      "companyName",
      "customMessage",
    ],
  },
  {
    value: "task_due_reminder",
    label: "Task Due Reminder",
    variables: [
      "taskTitle",
      "taskId",
      "assignedToName",
      "dueDate",
      "daysRemaining",
      "companyName",
      "customMessage",
    ],
  },
  {
    value: "task_comment_added",
    label: "Task Comment Added",
    variables: [
      "taskTitle",
      "taskId",
      "assignedToName",
      "commentAuthorName",
      "commentText",
      "companyName",
      "customMessage",
    ],
  },
  {
    value: "task_mentioned",
    label: "Task Mentioned in Comment",
    variables: [
      "taskTitle",
      "taskId",
      "mentionedUserName",
      "commentAuthorName",
      "commentText",
      "companyName",
      "customMessage",
    ],
  },
  {
    value: "task_attachment_added",
    label: "Task Attachment Added",
    variables: [
      "taskTitle",
      "taskId",
      "assignedToName",
      "attachmentAuthorName",
      "attachmentName",
      "attachmentSize",
      "companyName",
      "customMessage",
    ],
  },
];

const WhatsAppConfigPage = ({ integrationId: propId, onBack }) => {
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const id = propId || paramId;
  const isNew = id === "new";
  const { data: integrationsData, refetch: refetchIntegrations } =
    useGetIntegrationsQuery();
  const [updateIntegration] = useUpdateIntegrationMutation();
  const [createIntegration] = useCreateIntegrationMutation();
  const [sendMessage] = useSendMessageMutation();
  const [upsertEventConfig] = useUpsertEventConfigMutation();
  // If id is 'new', we're creating a new integration
  const whatsappIntegration =
    id === "new"
      ? null
      : integrationsData?.data?.integrations?.find(
          (i) => i.type === "whatsapp" && (!id || i._id === id),
        );

  const { data: eventConfigsData, refetch: refetchEventConfigs } =
    useGetEventConfigsQuery(whatsappIntegration?._id, {
      skip: !whatsappIntegration?._id,
    });

  const [configForm] = Form.useForm();
  const [testForm] = Form.useForm();
  const [eventConfigForm] = Form.useForm();
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [eventConfigModalVisible, setEventConfigModalVisible] = useState(false);
  const [editingEventType, setEditingEventType] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [whatsappCountryCode, setWhatsappCountryCode] = useState("91");
  const [whatsappCountryIso, setWhatsappCountryIso] = useState("IN");
  const [testLoading, setTestLoading] = useState(false);
  const [connectionTesting, setConnectionTesting] = useState(false);
  const [activeTab, setActiveTab] = useState("1");
  const [isEditing, setIsEditing] = useState(id === "new");

  const {
    data: templatesData,
    refetch: refetchTemplates,
    isLoading: templatesLoading,
  } = useFetchWhatsAppTemplatesQuery(whatsappIntegration?._id, {
    skip: !whatsappIntegration?._id,
  });

  const eventConfigs = eventConfigsData?.data?.configs || [];

  // Parse templates from API response structure
  const parseTemplates = (templates) => {
    if (!templates || !Array.isArray(templates)) return [];

    return templates.map((template) => {
      // Extract variables from BODY components
      const bodyComponent = template.components?.find((c) => c.type === "BODY");
      const bodyText = bodyComponent?.text || "";

      // Extract numbered variables like {{1}}, {{2}}
      const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
      const variables = variableMatches.map((match) => {
        const num = match.replace(/\{\{|\}\}/g, "");
        return { number: parseInt(num), placeholder: match };
      });

      return {
        id: template.id,
        name: template.name,
        category: template.category,
        status: template.status,
        language: template.language,
        bodyText: bodyText,
        variables: variables,
        components: template.components || [],
        header: template.components?.find((c) => c.type === "HEADER"),
        footer: template.components?.find((c) => c.type === "FOOTER"),
        buttons:
          template.components?.find((c) => c.type === "BUTTONS")?.buttons || [],
      };
    });
  };

  // Get templates from API response or from integration config (fallback)
  const apiTemplates = templatesData?.data?.templates || [];
  const configTemplates = whatsappIntegration?.config?.templates || [];
  const allTemplates = apiTemplates.length > 0 ? apiTemplates : configTemplates;
  const templates = parseTemplates(allTemplates);

  // Check connection status
  const isConnected =
    whatsappIntegration?.isActive &&
    whatsappIntegration?.config?.backendUrl &&
    whatsappIntegration?.config?.apiToken;

  useEffect(() => {
    if (whatsappIntegration) {
      configForm.setFieldsValue({
        backendUrl: whatsappIntegration.config?.backendUrl || "",
        apiToken: whatsappIntegration.config?.apiToken || "",
        isActive: whatsappIntegration.isActive || false,
      });
      // If integration isn't fully connected yet, show input fields immediately.
      setIsEditing(!isConnected);
    } else {
      // If integration isn't found (e.g. route id mismatch / tenant scoping),
      // switch to edit mode so Admin can create & configure it.
      setIsEditing(true);
    }
  }, [whatsappIntegration, configForm, id, isConnected]);

  // Refetch templates when event config modal opens
  useEffect(() => {
    if (
      eventConfigModalVisible &&
      whatsappIntegration?._id &&
      templates.length === 0 &&
      !templatesLoading
    ) {
      refetchTemplates();
    }
  }, [eventConfigModalVisible, whatsappIntegration?._id]);

  const handleSaveConfig = async (values) => {
    try {
      const configData = {
        name: "WhatsApp Integration",
        type: "whatsapp",
        isActive: values.isActive,
        config: {
          backendUrl: values.backendUrl,
          apiToken: values.apiToken,
          templates: templates, // Store parsed templates
        },
      };

      if (whatsappIntegration) {
        await updateIntegration({
          id: whatsappIntegration._id,
          ...configData,
        }).unwrap();
      } else {
        const newIntegration = await createIntegration(configData).unwrap();
        // Navigate to the new integration's config page
        if (newIntegration?.data?.integration?._id) {
          if (onBack) {
            onBack();
          } else {
            navigate(
              `/settings/integrations/whatsapp/${newIntegration.data.integration._id}`,
              { replace: true },
            );
          }
        }
      }

      message.success("WhatsApp configuration saved successfully");
      refetchIntegrations();
      setIsEditing(false); // Switch back to view mode after saving
    } catch (error) {
      message.error(error?.data?.message || "Failed to save configuration");
    }
  };

  const handleCancelEdit = () => {
    if (whatsappIntegration) {
      // Reset form to original values
      configForm.setFieldsValue({
        backendUrl: whatsappIntegration.config?.backendUrl || "",
        apiToken: whatsappIntegration.config?.apiToken || "",
        isActive: whatsappIntegration.isActive || false,
      });
      setIsEditing(false);
    }
  };

  const handleTestConnection = async () => {
    setConnectionTesting(true);
    try {
      await refetchTemplates();
      message.success("Connection successful! Templates fetched.");
      setActiveTab("2"); // Switch to templates tab
    } catch (error) {
      message.error("Connection failed. Please check your configuration.");
    } finally {
      setConnectionTesting(false);
    }
  };

  const handleTestMessage = async (values) => {
    if (!selectedTemplate) {
      message.error("Please select a template first");
      return;
    }

    setTestLoading(true);
    try {
      // Map form values to template variables
      const variables = {};
      selectedTemplate.variables.forEach((varInfo, index) => {
        const formValue = values[`var_${varInfo.number}`];
        if (formValue) {
          variables[varInfo.number] = formValue;
        }
      });

      // Ensure it starts with +, but avoid double country codes
      let formattedPhone = values.phone;
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = `+${whatsappCountryCode}${formattedPhone}`;
      }

      await sendMessage({
        id: whatsappIntegration._id,
        to: formattedPhone,
        templateId: selectedTemplate.id,
        variables: variables,
      }).unwrap();

      message.success("Test message sent successfully!");
      setTestModalVisible(false);
      testForm.resetFields();
    } catch (error) {
      message.error(error?.data?.message || "Failed to send test message");
    } finally {
      setTestLoading(false);
    }
  };

  const handleAddEventConfig = () => {
    if (templates.length === 0 && !templatesLoading) {
      message.warning(
        'Please fetch templates first in the "Available Templates" tab',
      );
      setActiveTab("2"); // Switch to templates tab
      return;
    }
    // Refetch templates when opening modal to ensure we have the latest
    if (whatsappIntegration?._id && templates.length === 0) {
      refetchTemplates();
    }
    eventConfigForm.resetFields();
    setEditingEventType(null);
    setEventConfigModalVisible(true);
  };

  const handleSaveEventConfig = async (values) => {
    try {
      await upsertEventConfig({
        integrationId: whatsappIntegration?._id || id,
        eventType: values.eventType,
        name:
          eventTypes.find((et) => et.value === values.eventType)?.label ||
          values.eventType,
        isActive: values.isActive !== false,
        whatsappTemplate: {
          enabled: true,
          templateId: values.templateId,
          variableMapping: values.variableMapping || {},
        },
        autoSend: {
          whatsapp: values.autoSend || false,
        },
      }).unwrap();

      message.success("Event configuration saved successfully");
      setEventConfigModalVisible(false);
      eventConfigForm.resetFields();
      setEditingEventType(null);
      refetchEventConfigs();
    } catch (error) {
      message.error(
        error?.data?.message || "Failed to save event configuration",
      );
    }
  };

  const templateColumns = [
    {
      title: "Template Name",
      dataIndex: "name",
      key: "name",
      render: (name, record) => (
        <Space direction="vertical" size="small">
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ID: {record.id}
          </Text>
        </Space>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      render: (category) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Tag color={status === "APPROVED" ? "green" : "orange"}>{status}</Tag>
      ),
    },
    {
      title: "Variables",
      key: "variables",
      render: (_, record) => {
        if (!record.variables || record.variables.length === 0) {
          return <Text type="secondary">No variables</Text>;
        }
        return (
          <Space wrap>
            {record.variables.map((v) => (
              <Tag key={v.number} color="purple">
                {`{{${v.number}}}`}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: "Preview",
      key: "preview",
      render: (_, record) => (
        <Text
          type="secondary"
          ellipsis
          style={{ maxWidth: 200 }}
          title={record.bodyText}
        >
          {record.bodyText.substring(0, 50)}...
        </Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            setSelectedTemplate(record);
            setTestModalVisible(true);
          }}
        >
          Test Send
        </Button>
      ),
    },
  ];

  const eventConfigColumns = [
    {
      title: "Event Type",
      dataIndex: "eventType",
      key: "eventType",
      render: (type) => {
        const eventType = eventTypes.find((et) => et.value === type);
        return eventType?.label || type;
      },
    },
    {
      title: "Template",
      key: "template",
      render: (_, record) => {
        if (!record.whatsappTemplate?.enabled) {
          return <Text type="secondary">Not configured</Text>;
        }
        const template = templates.find(
          (t) => t.id === record.whatsappTemplate?.templateId,
        );
        return template ? (
          <Tag color="blue">{template.name}</Tag>
        ) : (
          <Text type="secondary">Template not found</Text>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      render: (_, record) => (
        <Tag color={record.isActive ? "green" : "default"}>
          {record.isActive ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Auto Send",
      key: "autoSend",
      render: (_, record) => (
        <Tag color={record.autoSend?.whatsapp ? "green" : "default"}>
          {record.autoSend?.whatsapp ? "Enabled" : "Disabled"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            const eventTypeInfo = eventTypes.find(
              (et) => et.value === record.eventType,
            );
            const template = templates.find(
              (t) => t.id === record.whatsappTemplate?.templateId,
            );
            // Convert Map to object if needed (Mongoose Maps are converted to objects in JSON)
            const variableMapping =
              record.whatsappTemplate?.variableMapping || {};
            const mappingObj =
              variableMapping instanceof Map
                ? Object.fromEntries(variableMapping)
                : variableMapping;

            eventConfigForm.setFieldsValue({
              eventType: record.eventType,
              templateId: record.whatsappTemplate?.templateId || null,
              variableMapping: mappingObj,
              isActive: record.isActive !== false,
              autoSend: record.autoSend?.whatsapp || false,
            });
            setEditingEventType(record.eventType);
            setEventConfigModalVisible(true);
          }}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            if (onBack) onBack();
            else navigate("/settings/integrations");
          }}
        >
          Back
        </Button>
        <Title level={2} style={{ margin: 0 }}>
          <SettingOutlined /> WhatsApp Configuration
        </Title>
      </Space>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "1",
            label: "Configuration",
            children: (
              <>
                {/* View Mode */}
                {!isEditing && whatsappIntegration && (
                  <Card
                    title="WhatsApp Settings"
                    extra={
                      <Button
                        type="primary"
                        icon={<EditOutlined />}
                        onClick={() => setIsEditing(true)}
                      >
                        Edit Configuration
                      </Button>
                    }
                    style={{ marginBottom: 24 }}
                  >
                    <Descriptions bordered column={1}>
                      <Descriptions.Item label="Backend URL">
                        <Text code>
                          {whatsappIntegration.config?.backendUrl || "N/A"}
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="API Token">
                        <Text code>••••••••••••••••</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Status">
                        <Tag
                          color={
                            whatsappIntegration.isActive ? "green" : "default"
                          }
                        >
                          {whatsappIntegration.isActive ? "Active" : "Inactive"}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                )}

                {/* Edit Mode */}
                {isEditing && (
                  <Card title="WhatsApp Settings" style={{ marginBottom: 24 }}>
                    <Form
                      form={configForm}
                      layout="vertical"
                      onFinish={handleSaveConfig}
                    >
                      <Form.Item
                        label="Backend URL"
                        name="backendUrl"
                        rules={[
                          {
                            required: true,
                            message: "Please enter backend URL",
                          },
                        ]}
                        help="URL for sending WhatsApp messages. Use {{token}} placeholder or it will be appended as query parameter."
                      >
                        <Input placeholder="https://backend.askeva.io/v1/message/send-message?token={{token}}" />
                      </Form.Item>

                      <Form.Item
                        label="API Token"
                        name="apiToken"
                        rules={[
                          { required: true, message: "Please enter API token" },
                        ]}
                      >
                        <Input.Password placeholder="Enter your API token" />
                      </Form.Item>

                      <Form.Item name="isActive" valuePropName="checked">
                        <Switch
                          checkedChildren="Active"
                          unCheckedChildren="Inactive"
                        />
                      </Form.Item>

                      <Form.Item>
                        <Space>
                          <Button type="primary" htmlType="submit">
                            Save Configuration
                          </Button>
                          {whatsappIntegration && (
                            <Button onClick={handleCancelEdit}>Cancel</Button>
                          )}
                        </Space>
                      </Form.Item>
                    </Form>
                  </Card>
                )}

                {/* Connection Status */}
                <Card style={{ marginBottom: 24 }}>
                  <Row gutter={16} align="middle">
                    <Col flex="auto">
                      <Space direction="vertical" size="small">
                        <Text strong>Connection Status</Text>
                        <Space>
                          {isConnected ? (
                            <>
                              <CheckCircleOutlined
                                style={{ color: "#52c41a", fontSize: 20 }}
                              />
                              <Text type="success">Connected</Text>
                            </>
                          ) : (
                            <>
                              <CloseCircleOutlined
                                style={{ color: "#ff4d4f", fontSize: 20 }}
                              />
                              <Text type="danger">Not Connected</Text>
                            </>
                          )}
                        </Space>
                        {isConnected && whatsappIntegration && (
                          <Text type="secondary">
                            Backend URL:{" "}
                            {whatsappIntegration.config?.backendUrl}
                          </Text>
                        )}
                      </Space>
                    </Col>
                    <Col>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={handleTestConnection}
                        loading={connectionTesting}
                        disabled={!isConnected}
                      >
                        Test Connection & Fetch Templates
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {!isConnected && (
                  <Alert
                    message="WhatsApp Not Connected"
                    description="Please configure and save your WhatsApp settings above, then test the connection."
                    type="warning"
                    showIcon
                  />
                )}
              </>
            ),
          },
          {
            key: "2",
            label: "Available Templates",
            children: !isConnected ? (
              <Alert
                message="Not Connected"
                description="Please configure WhatsApp and test connection in the Configuration tab first."
                type="warning"
                showIcon
              />
            ) : (
              <Card
                title={
                  <Space>
                    <span>Available Templates</span>
                    <Button
                      icon={<ReloadOutlined />}
                      size="small"
                      onClick={() => refetchTemplates()}
                      loading={templatesLoading}
                    >
                      Refresh
                    </Button>
                    <Text type="secondary">({templates.length} templates)</Text>
                  </Space>
                }
              >
                {templatesLoading ? (
                  <Spin />
                ) : templates.length > 0 ? (
                  <Table
                    columns={templateColumns}
                    dataSource={templates}
                    rowKey="id"
                    pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                  />
                ) : (
                  <Alert
                    message="No Templates Found"
                    description="Click 'Test Connection & Fetch Templates' in the Configuration tab to fetch templates from your WhatsApp backend."
                    type="info"
                    showIcon
                  />
                )}
              </Card>
            ),
          },
          {
            key: "3",
            label: "Event Configuration",
            children: !isConnected ? (
              <Alert
                message="Not Connected"
                description="Please configure WhatsApp and test connection in the Configuration tab first."
                type="warning"
                showIcon
              />
            ) : (
              <Card
                title="Event Configurations"
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAddEventConfig}
                    disabled={templates.length === 0}
                  >
                    Add Configuration
                  </Button>
                }
              >
                {templates.length === 0 ? (
                  <Alert
                    message="No Templates Available"
                    description="Please fetch templates first in the Available Templates tab."
                    type="info"
                    showIcon
                  />
                ) : (
                  <Table
                    columns={eventConfigColumns}
                    dataSource={eventConfigs.filter(
                      (c) => c.whatsappTemplate?.enabled,
                    )}
                    rowKey="eventType"
                    pagination={false}
                    locale={{
                      emptyText:
                        'No event configurations. Click "Add Configuration" to create one.',
                    }}
                  />
                )}
              </Card>
            ),
          },
        ]}
      />

      {/* Test Message Modal */}
      <Modal
        title={`Test Send - ${selectedTemplate?.name || "Template"}`}
        open={testModalVisible}
        onCancel={() => {
          setTestModalVisible(false);
          testForm.resetFields();
          setSelectedTemplate(null);
        }}
        footer={null}
        width={600}
      >
        {selectedTemplate && (
          <div>
            <Card
              size="small"
              style={{ marginBottom: 16, background: "#f5f5f5" }}
            >
              <Text strong>Template Preview:</Text>
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  background: "white",
                  borderRadius: 4,
                }}
              >
                <Text>{selectedTemplate.bodyText}</Text>
              </div>
              {selectedTemplate.variables.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Text strong>Variables: </Text>
                  {selectedTemplate.variables.map((v) => (
                    <Tag
                      key={v.number}
                      color="purple"
                      style={{ marginLeft: 4 }}
                    >
                      {`{{${v.number}}}`}
                    </Tag>
                  ))}
                </div>
              )}
            </Card>

            <Form
              form={testForm}
              layout="vertical"
              onFinish={handleTestMessage}
            >
              <Form.Item
                label="Phone Number"
                name="phone"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) return Promise.resolve();
                      if (isValidPhoneNumber(value, whatsappCountryIso)) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Please enter a valid phone number for the selected country'));
                    }
                  }
                ]}
                help="Select country code and enter local number"
              >
                <PhoneInput 
                  countryCodeValue={whatsappCountryCode}
                  onCountryCodeChange={setWhatsappCountryCode}
                  isoCountryValue={whatsappCountryIso}
                  onCountryIsoChange={setWhatsappCountryIso}
                />
              </Form.Item>

              {selectedTemplate.variables.map((varInfo) => (
                <Form.Item
                  key={varInfo.number}
                  label={`Variable {{${varInfo.number}}}`}
                  name={`var_${varInfo.number}`}
                  rules={[
                    {
                      required: true,
                      message: `Please enter value for {{${varInfo.number}}}`,
                    },
                  ]}
                >
                  <Input
                    placeholder={`Enter value for {{${varInfo.number}}}`}
                  />
                </Form.Item>
              ))}

              <Form.Item style={{ textAlign: "end" }}>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={testLoading}
                    icon={<SendOutlined />}
                  >
                    Send Test Message
                  </Button>
                  <Button
                    onClick={() => {
                      setTestModalVisible(false);
                      testForm.resetFields();
                      setSelectedTemplate(null);
                    }}
                  >
                    Cancel
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* Event Configuration Modal */}
      <Modal
        title="Configure Event"
        open={eventConfigModalVisible}
        onCancel={() => {
          setEventConfigModalVisible(false);
          eventConfigForm.resetFields();
          setEditingEventType(null);
        }}
        footer={null}
        width={700}
      >
        <Form
          form={eventConfigForm}
          layout="vertical"
          onFinish={handleSaveEventConfig}
        >
          <Form.Item
            label="Event Type"
            name="eventType"
            rules={[{ required: true, message: "Please select an event type" }]}
          >
            <Select
              placeholder="Select an event type"
              disabled={!!editingEventType}
            >
              {eventTypes.map((et) => (
                <Option key={et.value} value={et.value}>
                  {et.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.eventType !== currentValues.eventType
            }
          >
            {({ getFieldValue }) => {
              const selectedEventType = getFieldValue("eventType");
              const eventTypeInfo = eventTypes.find(
                (et) => et.value === selectedEventType,
              );

              return selectedEventType ? (
                <>
                  <Form.Item
                    label="Select Template"
                    name="templateId"
                    rules={[
                      { required: true, message: "Please select a template" },
                    ]}
                  >
                    <Select
                      placeholder={
                        templatesLoading
                          ? "Loading templates..."
                          : templates.length === 0
                            ? "No templates available"
                            : "Select a template"
                      }
                      loading={templatesLoading}
                      disabled={templates.length === 0 && !templatesLoading}
                      notFoundContent={
                        templatesLoading ? (
                          <div style={{ textAlign: "center", padding: "12px" }}>
                            <Spin size="small" /> Loading templates...
                          </div>
                        ) : templates.length === 0 ? (
                          <div
                            style={{
                              textAlign: "center",
                              padding: "12px",
                              color: "#999",
                            }}
                          >
                            No templates available. Please fetch templates
                            first.
                          </div>
                        ) : null
                      }
                      showSearch
                      filterOption={(input, option) =>
                        (option?.children?.toString() || "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    >
                      {templates.map((t) => (
                        <Option key={t.id} value={t.id}>
                          {t.name} ({t.id})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                  {templates.length === 0 && !templatesLoading && (
                    <Alert
                      message="No Templates Available"
                      description="Please go to the 'Available Templates' tab and click 'Test Connection & Fetch Templates' to load templates first."
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) =>
                      prevValues.templateId !== currentValues.templateId
                    }
                  >
                    {({ getFieldValue }) => {
                      const selectedTemplateId = getFieldValue("templateId");
                      const selectedTemplate = templates.find(
                        (t) => t.id === selectedTemplateId,
                      );

                      return selectedTemplate &&
                        selectedTemplate.variables.length > 0 ? (
                        <>
                          <Card
                            size="small"
                            style={{ marginBottom: 16, background: "#f5f5f5" }}
                          >
                            <Text strong>Template Variables:</Text>
                            <div style={{ marginTop: 8 }}>
                              {selectedTemplate.variables.map((v) => (
                                <Tag key={v.number} style={{ marginBottom: 4 }}>
                                  {`{{${v.number}}}`}
                                </Tag>
                              ))}
                            </div>
                            <Text
                              type="secondary"
                              style={{ display: "block", marginTop: 8 }}
                            >
                              Map these template variables to event variables
                              below
                            </Text>
                          </Card>

                          <Form.Item label="Variable Mapping">
                            {selectedTemplate.variables.map((varInfo) => (
                              <Form.Item
                                key={varInfo.number}
                                name={[
                                  "variableMapping",
                                  varInfo.number.toString(),
                                ]}
                                label={`{{${varInfo.number}}} → Event Variable`}
                                style={{ marginBottom: 8 }}
                              >
                                <Select placeholder={`Map to event variable`}>
                                  {eventTypeInfo?.variables?.map((eventVar) => (
                                    <Option key={eventVar} value={eventVar}>
                                      {eventVar}
                                    </Option>
                                  ))}
                                </Select>
                              </Form.Item>
                            ))}
                          </Form.Item>
                        </>
                      ) : null;
                    }}
                  </Form.Item>

                  <Form.Item
                    name="isActive"
                    valuePropName="checked"
                    initialValue={true}
                  >
                    <Switch
                      checkedChildren="Active"
                      unCheckedChildren="Inactive"
                    />
                  </Form.Item>

                  <Form.Item
                    name="autoSend"
                    valuePropName="checked"
                    help="Automatically send WhatsApp message when this event occurs"
                  >
                    <Switch
                      checkedChildren="Auto Send Enabled"
                      unCheckedChildren="Manual Only"
                    />
                  </Form.Item>
                </>
              ) : null;
            }}
          </Form.Item>

          <Form.Item style={{ marginTop: 24, textAlign: "end" }}>
            <Space>
              <Button type="primary" htmlType="submit">
                Save Configuration
              </Button>
              <Button
                onClick={() => {
                  setEventConfigModalVisible(false);
                  eventConfigForm.resetFields();
                  setEditingEventType(null);
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WhatsAppConfigPage;
