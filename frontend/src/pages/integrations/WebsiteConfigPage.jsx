import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Button,
  Form,
  Input,
  message,
  Space,
  Tag,
  Typography,
  Alert,
  Row,
  Col,
  Switch,
  Tabs,
  Tooltip,
  Divider,
  Select,
} from "antd";
import {
  ArrowLeftOutlined,
  CopyOutlined,
  GlobalOutlined,
  ReloadOutlined,
  SettingOutlined,
  CodeOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  WhatsAppOutlined,
  DownloadOutlined,
  FacebookOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetIntegrationsQuery,
  useUpdateIntegrationMutation,
  useCreateIntegrationMutation,
  useFetchWhatsAppLeadsMutation,
} from "../../api/integrationApi";
import FacebookLeadsTab from "./FacebookLeadsTab";

const { Title, Text, Paragraph } = Typography;

const WebsiteConfigPage = ({ integrationId: propId, initialTab, onBack, clientId }) => {
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const id = propId || paramId;
  const isNew = id === "new";
  
  const {
    data: integrationsData,
    refetch: refetchIntegrations,
    isLoading: isIntegrationsLoading,
  } = useGetIntegrationsQuery(clientId ? { clientId } : undefined, { skip: isNew && !clientId });
  const [updateIntegration] = useUpdateIntegrationMutation();
  const [createIntegration] = useCreateIntegrationMutation();
  const [fetchWhatsAppLeads, { isLoading: isFetchingLeads }] =
    useFetchWhatsAppLeadsMutation();

  const websiteIntegration =
    id === "new"
      ? null
      : integrationsData?.data?.integrations?.find(
          (i) => i.type === "website" && (!id || i._id === id),
        );

  const [websiteForm] = Form.useForm();
  const [whatsappForm] = Form.useForm();
  
  const [isWebsiteEditing, setIsWebsiteEditing] = useState(id === "new");
  const [isWhatsappEditing, setIsWhatsappEditing] = useState(id === "new");
  
  const [apiKey, setApiKey] = useState("");
  const [isHtmlSnippetVisible, setIsHtmlSnippetVisible] = useState(false);
  const [activeKey, setActiveKey] = useState(initialTab || "website");

  const watchedCustomFields = Form.useWatch("customFields", websiteForm);
  const customFieldsToRender = watchedCustomFields || websiteIntegration?.config?.customFields || [];

  useEffect(() => {
    if (initialTab) {
      setActiveKey(initialTab);
    }
    const params = new URLSearchParams(window.location.search);
    if (params.has("facebook_oauth")) {
      setActiveKey("facebook");
    }
  }, [initialTab]);

  useEffect(() => {
    if (websiteIntegration) {
      websiteForm.setFieldsValue({
        name: websiteIntegration.name || "Lead Management Integration",
        domain: websiteIntegration.config?.domain || "",
        isActive: websiteIntegration.isActive || false,
        customFields: websiteIntegration.config?.customFields || [],
      });
      whatsappForm.setFieldsValue({
        whatsappApiUrl: websiteIntegration.config?.whatsappLeads?.apiUrl || "",
        whatsappToken: websiteIntegration.config?.whatsappLeads?.token || "",
      });
      setApiKey(websiteIntegration.config?.apiKey || "");
      setIsWebsiteEditing(false);
      setIsWhatsappEditing(false);
    } else {
      setIsWebsiteEditing(true);
      setIsWhatsappEditing(true);
      if (id === "new") {
        websiteForm.setFieldsValue({
          name: "Lead Management Integration",
          isActive: true,
        });
        generateNewApiKey();
      }
    }
  }, [websiteIntegration, id, websiteForm, whatsappForm]);

  const generateNewApiKey = () => {
    const newKey =
      "tp_" +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    setApiKey(newKey);
  };

  const handleSaveWebsite = async (values) => {
    try {
      const whatsappValues = whatsappForm.getFieldsValue();
      const configData = {
        name: values.name,
        type: "website",
        isActive: values.isActive,
        config: {
          domain: values.domain,
          apiKey: apiKey,
          whatsappLeads: {
            apiUrl: whatsappValues.whatsappApiUrl,
            token: whatsappValues.whatsappToken,
          },
          customFields: values.customFields || [],
        },
      };

      if (clientId) {
        configData.companyId = clientId;
      }

      if (websiteIntegration) {
        await updateIntegration({
          id: websiteIntegration._id,
          ...configData,
        }).unwrap();
      } else {
        const newIntegration = await createIntegration(configData).unwrap();
        if (newIntegration?.data?.integration?._id) {
          if (onBack) {
            onBack();
          } else {
            navigate(
              `/settings/integrations/website/${newIntegration.data.integration._id}`,
              { replace: true },
            );
          }
        }
      }

      message.success("Website configuration saved");
      refetchIntegrations();
      setIsWebsiteEditing(false);
    } catch (error) {
      message.error(error?.data?.message || "Failed to save configuration");
    }
  };

  const handleSaveWhatsapp = async () => {
    try {
      const whatsappValues = await whatsappForm.validateFields();
      const websiteValues = websiteForm.getFieldsValue();
      
      const configData = {
        name: websiteValues.name || "Lead Management Integration",
        type: "website",
        isActive: websiteValues.isActive ?? true,
        config: {
          domain: websiteValues.domain || "",
          apiKey: apiKey,
          whatsappLeads: {
            apiUrl: whatsappValues.whatsappApiUrl,
            token: whatsappValues.whatsappToken,
          },
          customFields: websiteValues.customFields || [],
        },
      };

      if (websiteIntegration) {
        await updateIntegration({
          id: websiteIntegration._id,
          ...configData,
        }).unwrap();
      } else {
        const newIntegration = await createIntegration(configData).unwrap();
        if (newIntegration?.data?.integration?._id) {
          if (onBack) {
            onBack();
          } else {
            navigate(
              `/settings/integrations/website/${newIntegration.data.integration._id}`,
              { replace: true },
            );
          }
        }
      }

      message.success("WhatsApp configuration saved");
      refetchIntegrations();
      setIsWhatsappEditing(false);
    } catch (error) {
      message.error(error?.data?.message || "Failed to save WhatsApp config");
    }
  };

  const handleFetchLeads = async () => {
    if (!websiteIntegration?._id) {
      message.warning("Please save configuration first");
      return;
    }
    try {
      const result = await fetchWhatsAppLeads({
        id: websiteIntegration._id,
      }).unwrap();
      message.success(result.message || "Leads fetched successfully");
    } catch (error) {
      message.error(error?.data?.message || "Failed to fetch leads");
    }
  };

  const copyToClipboard = (text, type = "API Key") => {
    navigator.clipboard.writeText(text);
    message.success(`${type} copied to clipboard`);
  };

  const integrationUrl = `${(
    import.meta.env.VITE_API_BASE_URL || window.location.origin + "/api"
  ).replace(/\/api$/, "")}/api/integrations/public/website/submit`;

  let dynamicPayloadFields = "";
  if (customFieldsToRender && customFieldsToRender.length > 0) {
    dynamicPayloadFields = customFieldsToRender
      .filter((cf) => cf && cf.fieldName)
      .map((cf) => {
        let val = '"..."';
        if (cf.fieldType === 'number') val = '123';
        else if (cf.fieldType === 'boolean') val = 'true';
        return `  "${cf.fieldName}": ${val}`;
      })
      .join(",\n");
  }

  const jsonPayloadExample = `{
  "apiKey": "${apiKey}"${dynamicPayloadFields ? ",\n" + dynamicPayloadFields : ""}
}`;

  let dynamicHtmlInputs = "";
  if (customFieldsToRender && customFieldsToRender.length > 0) {
    dynamicHtmlInputs = customFieldsToRender
      .filter((cf) => cf && cf.fieldName)
      .map((cf) => {
        let inputType = 'text';
        if (cf.fieldType === 'number') inputType = 'number';
        else if (cf.fieldType === 'boolean') inputType = 'checkbox';
        
        return `  <div style="margin-bottom: 10px;">
    <input type="\${inputType}" name="\${cf.fieldName}" placeholder="\${cf.fieldName}" style="width: 100%; padding: 8px;" />
  </div>`;
      })
      .join("\n");
  }

  const htmlSnippet = `
<!-- CRM Lead Form Integration -->
<form id="tunepath-lead-form">
\${dynamicHtmlInputs}
  <button type="submit" style="background: var(--accent-secondary); color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
    Submit
  </button>
</form>

<script>
document.getElementById('tunepath-lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  
  // Add your integration key
  data.apiKey = "${apiKey}";

  try {
    const response = await fetch("${integrationUrl}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    if (result.success) {
      alert("Thank you! We will contact you soon.");
      e.target.reset();
    } else {
      alert("Error: " + result.message);
    }
  } catch (error) {
    console.error("Submission error:", error);
    alert("Failed to submit form. Please try again later.");
  }
});
</script>
  `.trim();

  const websiteTab = (
    <Form form={websiteForm} layout="vertical" onFinish={handleSaveWebsite}>
      <Row gutter={24}>
        <Col span={24} lg={10}>
          <Card
            className="config-card"
            title={
              <>
                <SettingOutlined /> Configuration
              </>
            }
            extra={
              !isWebsiteEditing &&
              websiteIntegration && (
                <Button
                  type="link"
                  onClick={() => setIsWebsiteEditing(true)}
                >
                  Edit
                </Button>
              )
            }
          >
            <Form.Item
              label="Integration Name"
              name="name"
              rules={[{ required: true, message: "Integration name is required" }]}
            >
              <Input placeholder="Website Config" disabled={!isWebsiteEditing} />
            </Form.Item>

            <Form.Item
              label="Authorized Domain"
              name="domain"
              rules={[{ required: true, message: "Authorized domain is required" }]}
              help="Recommended for security. e.g. example.com"
            >
              <Input
                placeholder="http://yourwebsite.com"
                prefix={<GlobalOutlined />}
                disabled={!isWebsiteEditing}
              />
            </Form.Item>

            <Form.Item label="Integration Key (API Key)">
              <Space.Compact style={{ width: "100%" }}>
                <Input
                  value={apiKey}
                  readOnly
                  style={{ background: "#f5f5f5" }}
                  disabled={!isWebsiteEditing}
                />
                <Tooltip title="Copy Key">
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(apiKey)}
                  />
                </Tooltip>
                {isWebsiteEditing && (
                  <Tooltip title="Regenerate">
                    <Button icon={<ReloadOutlined />} onClick={generateNewApiKey} />
                  </Tooltip>
                )}
              </Space.Compact>
            </Form.Item>

            <Form.Item name="isActive" valuePropName="checked" label="Status">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" disabled={!isWebsiteEditing} />
            </Form.Item>

            <Divider orientation="left">Custom Fields</Divider>
            <Form.List name="customFields">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space
                      key={key}
                      style={{ display: "flex", marginBottom: 8, flexWrap: "wrap" }}
                      align="baseline"
                    >
                      <Form.Item
                        {...restField}
                        name={[name, "fieldName"]}
                        rules={[{ required: true, message: "Missing field name" }]}
                        normalize={(value) => (value || "").replace(/\s+/g, "_")}
                      >
                        <Input placeholder="Field Name (e.g. budget)" disabled={!isWebsiteEditing} />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, "fieldType"]}
                        initialValue="string"
                        rules={[{ required: true, message: "Missing field type" }]}
                      >
                        <Select disabled={!isWebsiteEditing} style={{ width: 120 }}>
                          <Select.Option value="string">String</Select.Option>
                          <Select.Option value="number">Number</Select.Option>
                          <Select.Option value="boolean">Boolean</Select.Option>
                        </Select>
                      </Form.Item>
                      {isWebsiteEditing && (
                        <Button type="link" danger onClick={() => remove(name)}>
                          Remove
                        </Button>
                      )}
                    </Space>
                  ))}
                  {isWebsiteEditing && (
                    <Form.Item>
                      <Button type="dashed" onClick={() => add()} block>
                        + Add Custom Field
                      </Button>
                    </Form.Item>
                  )}
                </>
              )}
            </Form.List>

            {isWebsiteEditing && (
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    {websiteIntegration ? "Update" : "Save"} Integration
                  </Button>
                  {websiteIntegration && (
                    <Button onClick={() => setIsWebsiteEditing(false)}>Cancel</Button>
                  )}
                </Space>
              </Form.Item>
            )}
          </Card>

          <Card className="config-card" title={<span><CheckCircleOutlined style={{ color: "#52c41a" }} /> What this does</span>}>
            <Paragraph>
              Once configured, any form submission from your website using this key
              will automatically:
            </Paragraph>
            <ul style={{ paddingLeft: 20 }}>
              <li>Create a new <strong>Lead</strong> in the CRM.</li>
              <li>Set the source to <strong>Website</strong>.</li>
              <li>Notify the assigned admin.</li>
            </ul>
          </Card>
        </Col>

        <Col span={24} lg={14}>
          <Card
            className="config-card"
            title={
              <>
                <CodeOutlined /> Implementation Guide
              </>
            }
          >
            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 12 }}>
                <Text strong>Endpoint URL:</Text>
                <Paragraph code style={{ fontSize: "13px", marginTop: 4, display: 'block' }}>
                  {integrationUrl}
                </Paragraph>
                <Button 
                  size="small" 
                  icon={<CopyOutlined />} 
                  onClick={() => copyToClipboard(integrationUrl, "URL")}
                  style={{ marginTop: 8 }}
                >
                  Copy URL
                </Button>
              </div>

              <div style={{ marginTop: 24 }}>
                <Text strong>JSON Payload Example:</Text>
                <div className="code-block" style={{ marginTop: 12 }}>
                  <pre style={{ margin: 0, fontSize: "13px" }}>
                    {jsonPayloadExample}
                  </pre>
                </div>
              </div>
            </div>

            <Divider />

            {/* <div style={{ textAlign: "center" }}>
              <Button
                type="link"
                icon={<CodeOutlined />}
                onClick={() => setIsHtmlSnippetVisible(!isHtmlSnippetVisible)}
              >
                {isHtmlSnippetVisible ? "Hide HTML Snippet" : "Show HTML Snippet"}
              </Button>
            </div> */}

            {isHtmlSnippetVisible && (
              <div style={{ marginTop: 20 }}>
                <div className="code-block">
                  <Button
                    className="code-copy-btn"
                    icon={<CopyOutlined />}
                    size="small"
                    onClick={() => copyToClipboard(htmlSnippet, "Snippet")}
                  >
                    Copy
                  </Button>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      fontSize: "12px",
                    }}
                  >
                    {htmlSnippet}
                  </pre>
                </div>
              </div>
            )}
          </Card>

          <Alert
            message="Ready to launch?"
            description="Need help with the integration? Contact our support team or check our developer documentation."
            type="info"
            showIcon
            icon={<RocketOutlined />}
            style={{ borderRadius: 12, marginTop: 24 }}
          />
        </Col>
      </Row>
    </Form>
  );

  const whatsappLeadsTab = (
    <Form form={whatsappForm} layout="vertical" onFinish={handleSaveWhatsapp}>
      <Row gutter={24}>
        <Col span={24} lg={12}>
          <Card
            className="config-card"
            title={
              <>
                <WhatsAppOutlined style={{ color: "#25D366" }} /> WhatsApp Lead
                Fetching
              </>
            }
            extra={
              !isWhatsappEditing &&
              websiteIntegration && (
                <Button
                  type="link"
                  onClick={() => setIsWhatsappEditing(true)}
                >
                  Edit
                </Button>
              )
            }
          >
            <Form.Item
              label="API Endpoint"
              name="whatsappApiUrl"
              rules={[{ required: true, message: "API Endpoint is required" }]}
              help="The URL from where WhatsApp leads will be fetched. (e.g., https://api.bccmartech.com/v1/leads)"
            >
              <Input placeholder="https://api.bccmartech.com/v1/leads" disabled={!isWhatsappEditing} />
            </Form.Item>

            <Form.Item
              label="Token / Authentication Details"
              name="whatsappToken"
              rules={[{ required: true, message: "Token is required" }]}
              help="Enter your API token here."
            >
              <Input.Password placeholder="Enter Bearer Token or API Key" disabled={!isWhatsappEditing} />
            </Form.Item>

            {isWhatsappEditing && (
              <div style={{ marginTop: 16 }}>
                <Space>
                  <Button type="primary" htmlType="submit">
                    {websiteIntegration ? "Update" : "Save"} Integration
                  </Button>
                  {websiteIntegration && (
                    <Button onClick={() => setIsWhatsappEditing(false)}>Cancel</Button>
                  )}
                </Space>
              </div>
            )}

            {!isWhatsappEditing && websiteIntegration && (
              <div style={{ marginTop: 24 }}>
                <Divider />
                <div style={{ textAlign: "center" }}>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleFetchLeads}
                    loading={isFetchingLeads}
                    size="large"
                    style={{
                      background: "#25D366",
                      borderColor: "#25D366",
                      borderRadius: "8px",
                    }}
                  >
                    Fetch Leads Now
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </Col>
        <Col span={24} lg={12}>
          <Card className="config-card" title="Integration Details">
            <Paragraph>
              All leads fetched via this method will automatically have their source
              set to 'WhatsApp'.
            </Paragraph>
            <Title level={5}>Supported Formats:</Title>
            <div className="code-block">
              <pre style={{ margin: 0, fontSize: "12px" }}>
                {`{
  "success": true,
  "data": [
    {
      "name": "John Smith",
      "fullMobile": "+919876543210",
      "description": "Interested in solar"
    }
  ]
}`}
              </pre>
            </div>
          </Card>
        </Col>
      </Row>
    </Form>
  );

  if (isIntegrationsLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        Loading configuration...
      </div>
    );
  }

  return (
    <div>
      <style>{`
        .config-card { border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #f0f0f0; margin-bottom: 24px; }
        .code-block { background: #1e1e1e; color: #d4d4d4; padding: 20px; border-radius: 12px; font-family: 'Courier New', Courier, monospace; position: relative; overflow-x: auto; }
        .code-copy-btn { position: absolute; top: 10px; right: 10px; color: #fff; background: rgba(255,255,255,0.1); border: none; }
        .code-copy-btn:hover { background: rgba(255,255,255,0.2) !important; color: #fff !important; }
        .ant-tabs-nav { margin-bottom: 24px; }
        .ant-tabs-tab-btn { font-weight: 500; font-size: 15px; }
      `}</style>

      <Space style={{ marginBottom: 24 }}>
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

      <div style={{ marginBottom: 24 }}>
        <Title level={2}>Lead Management Integration</Title>
        <Text type="secondary">
          Configure how your CRM receives leads from external sources.
        </Text>
      </div>

      {!websiteIntegration && id !== "new" && (
        <Alert
          message="Integration not found"
          description="The requested integration could not be found. Please create a new one."
          type="error"
          showIcon
          action={
            <Button
              size="small"
              type="primary"
              onClick={() => {
                if (onBack) onBack(); // Will reset view if handled, otherwise redirect
                else navigate("/settings/integrations/website/new");
              }}
            >
              Create New
            </Button>
          }
          style={{ marginBottom: 24 }}
        />
      )}

      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        type="card"
        items={[
          {
            key: "website",
            label: (
              <span>
                <GlobalOutlined /> Website
              </span>
            ),
            children: websiteTab,
          },
          {
            key: "whatsapp",
            label: (
              <span>
                <WhatsAppOutlined /> WhatsApp Leads
              </span>
            ),
            children: whatsappLeadsTab,
          },
          {
            key: "facebook",
            label: (
              <span>
                <FacebookOutlined /> Facebook Leads
              </span>
            ),
            children: <FacebookLeadsTab clientId={websiteIntegration?.clientId} />,
          },
        ]}
      />
    </div>
  );
};

export default WebsiteConfigPage;
