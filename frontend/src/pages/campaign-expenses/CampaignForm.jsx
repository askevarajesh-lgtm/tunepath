import React, { useState, useEffect, useCallback } from "react";
import {
  Form,
  Button,
  Card,
  Select,
  message,
  Space,
  Row,
  Col,
  DatePicker,
  InputNumber,
  Divider,
  Spin,
  Alert,
  Tooltip,
  Tag,
  Modal,
  Table,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
  LockOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  useCreateCampaignMutation,
  useGetCampaignsDropdownQuery,
} from "../../api/campaignApi";
import { useGetCompaniesDropdownQuery } from "../../api/companyApi";
import {
  useGetProjectsDropdownQuery,
  useGetProjectByIdQuery,
} from "../../api/projectApi";
import { useGetInvoiceByIdQuery } from "../../api/invoiceApi";
import dayjs from "dayjs";
import { useDebouncedSearch } from "../../hooks/useDebounce";

const rupeeFormatter = (value) =>
  `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const rupeeParser = (value) => value.replace(/₹\s?|(,*)/g, "");

/** Calculates number of days (inclusive) between two dayjs dates */
const calcDays = (start, end) => {
  if (!start || !end) return 0;
  const diff = dayjs(end).diff(dayjs(start), "day") + 1;
  return diff > 0 ? diff : 0;
};

/** Summary strip shown inside each campaign card */
const CampaignSummaryStrip = ({ dailyBudget, startDate, endDate, campaignAmount }) => {
  if (!dailyBudget || !startDate || !endDate) return null;
  const days = calcDays(startDate, endDate);
  if (days <= 0) return null;
  const total = days * dailyBudget;

  // Check if campaign amount from invoice is set and total exceeds it
  const hasInvoiceLimit = campaignAmount != null && campaignAmount > 0;
  const isOverBudget = hasInvoiceLimit && total > campaignAmount;

  return (
    <div
      style={{
        background: isOverBudget
          ? "linear-gradient(90deg,#fff2f0 0%,#ffccc7 100%)"
          : "linear-gradient(90deg,#f0f9ff 0%,#e6f7ff 100%)",
        border: `1px solid ${isOverBudget ? "#ff4d4f" : "#91d5ff"}`,
        borderRadius: 8,
        padding: "10px 16px",
        marginBottom: 16,
        display: "flex",
        gap: 24,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <div>
        <span style={{ color: "#888", fontSize: 12 }}>Campaign Days: </span>
        <Tag color="blue" style={{ fontWeight: 700, fontSize: 13 }}>
          <CalendarOutlined /> {days} days
        </Tag>
      </div>
      <div>
        <span style={{ color: "#888", fontSize: 12 }}>Daily Budget: </span>
        <Tag color="geekblue" style={{ fontWeight: 700, fontSize: 13 }}>
          ₹{dailyBudget.toLocaleString("en-IN")} / day
        </Tag>
      </div>
      <div>
        <span style={{ color: "#888", fontSize: 12 }}>Total Campaign Value: </span>
        <Tag
          color={isOverBudget ? "red" : "green"}
          style={{ fontWeight: 700, fontSize: 13 }}
        >
          ₹{total.toLocaleString("en-IN")}
        </Tag>
      </div>
      {hasInvoiceLimit && (
        <div>
          <span style={{ color: "#888", fontSize: 12 }}>Invoice Limit: </span>
          <Tag color="orange" style={{ fontWeight: 700, fontSize: 13 }}>
            ₹{campaignAmount.toLocaleString("en-IN")}
          </Tag>
        </div>
      )}
      {isOverBudget && (
        <div style={{ width: "100%", color: "#cf1322", fontWeight: 600, fontSize: 13, marginTop: 4 }}>
          ⚠️ Total Campaign Value (₹{total.toLocaleString("en-IN")}) exceeds the
          Campaign Amount from Invoice (₹{campaignAmount.toLocaleString("en-IN")}).
          Reduce days or daily budget.
        </div>
      )}
    </div>
  );
};

const CampaignForm = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [createdCampaigns, setCreatedCampaigns] = useState([]);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);

  // Local state mirroring form values for live summary + auto-calc
  const [campaignFields, setCampaignFields] = useState([
    { dailyBudget: null, startDate: null, endDate: null, campaignAmount: null },
  ]);

  const [clientSearch, debouncedClientSearch, setClientSearch] = useDebouncedSearch("", 300);
  const { data: clientsData, isLoading: isLoadingClients } = useGetCompaniesDropdownQuery({
    search: debouncedClientSearch,
  });
  const { data: projectsData } = useGetProjectsDropdownQuery(
    selectedClientId ? { companyId: selectedClientId } : {},
    { skip: !selectedClientId },
  );
  const { data: allProjectsData } = useGetProjectsDropdownQuery({});
  const { data: campaignsDropdownData } = useGetCampaignsDropdownQuery({});

  const { data: projectData, isLoading: isLoadingProject } =
    useGetProjectByIdQuery(selectedProjectId, { skip: !selectedProjectId });
  const project = projectData?.data?.project;
  const invoiceId = project?.invoiceId?._id || project?.invoiceId;
  const { data: invoiceData, isLoading: isLoadingInvoice } =
    useGetInvoiceByIdQuery(invoiceId, { skip: !invoiceId });
  const invoice = invoiceData?.data?.invoice;
  const [createCampaign, { isLoading }] = useCreateCampaignMutation();

  const remainingBalance = invoice
    ? invoice.campaignAmount || 0
    : null;

  const rawClients = clientsData?.data?.companies || clientsData?.data?.data || (Array.isArray(clientsData?.data) ? clientsData.data : []) || [];
  const rawProjects = projectsData?.data?.projects || projectsData?.data?.data || [];
  const allProjects = allProjectsData?.data?.projects || allProjectsData?.data?.data || [];
  const allCampaigns = campaignsDropdownData?.data?.campaigns || campaignsDropdownData?.campaigns || [];

  const isCampaignProject = useCallback((proj) => {
    if (!proj) return false;
    const projId = (proj._id || proj.id || "").toString();

    const hasCampaignDoc = (allCampaigns || []).some((c) => {
      const cProjId = (c.projectId?._id || c.projectId || "").toString();
      return cProjId && cProjId === projId;
    });
    if (hasCampaignDoc) return true;

    if (proj.isCampaign || proj.hasCampaigns) return true;
    if (proj.campaignAmount && Number(proj.campaignAmount) > 0) return true;
    if (proj.masterItemId?.isCampaign || (proj.masterItemId?.campaignDetails?.campaignAmount > 0)) return true;
    if (proj.invoiceId?.campaignAmount && Number(proj.invoiceId.campaignAmount) > 0) return true;

    const depts = Array.isArray(proj.departments)
      ? proj.departments
      : [proj.department || ""];
    const hasCampaignDept = depts.some((d) => {
      const s = String(d || "").toLowerCase();
      return s.includes("digital-marketing") || s.includes("campaign") || s.includes("performance-ads");
    });
    if (hasCampaignDept) return true;

    if (proj.milestoneWorkflowType && ["campaign", "ads", "performance_ads"].includes(String(proj.milestoneWorkflowType).toLowerCase())) {
      return true;
    }

    const name = String(proj.name || "").toLowerCase();
    if (name.includes("campaign") || name.includes("meta ad") || name.includes("google ad") || name.includes("performance ad")) {
      return true;
    }

    const cats = Array.isArray(proj.selectedCategories) ? proj.selectedCategories : [];
    const hasCampaignCat = cats.some((c) => {
      const catName = (typeof c === "string" ? c : c.name || c.categoryName || "").toLowerCase();
      return catName.includes("campaign") || catName.includes("meta ad") || catName.includes("google ad") || catName.includes("performance ad");
    });
    if (hasCampaignCat) return true;

    return false;
  }, [allCampaigns]);

  const campaignClientIds = React.useMemo(() => {
    const set = new Set();
    allCampaigns.forEach((c) => {
      const cId = c.clientCompanyId?._id || c.clientCompanyId || c.clientId?._id || c.clientId;
      if (cId) set.add(cId.toString());
    });
    allProjects.forEach((p) => {
      if (isCampaignProject(p)) {
        const cId = p.clientId?._id || p.clientId;
        if (cId) set.add(cId.toString());
      }
    });
    return set;
  }, [allProjects, allCampaigns, isCampaignProject]);

  const clients = React.useMemo(() => {
    return rawClients.filter((c) => {
      const cId = (c._id || c.id || "").toString();
      return campaignClientIds.has(cId) || (selectedClientId && cId === selectedClientId.toString());
    });
  }, [rawClients, campaignClientIds, selectedClientId]);

  const projects = React.useMemo(() => {
    return rawProjects.filter((p) => isCampaignProject(p));
  }, [rawProjects, isCampaignProject]);

  // Auto-populate remainingBalance (read-only) from invoice into all Campaigns
  useEffect(() => {
    if (invoice && remainingBalance != null) {
      const currentCampaigns = form.getFieldValue("campaigns") || [{}];
      const updatedCampaigns = currentCampaigns.map((camp) => ({
        ...camp,
        campaignAmount: remainingBalance,
      }));
      form.setFieldsValue({ campaigns: updatedCampaigns });

      // Update local state for summary strips
      setCampaignFields(
        updatedCampaigns.map((c) => ({
          dailyBudget: c.dailyBudget || null,
          startDate: c.startDate ? dayjs(c.startDate) : null,
          endDate: c.endDate ? dayjs(c.endDate) : null,
          campaignAmount: remainingBalance,
        })),
      );
    }
  }, [invoice, remainingBalance, form]);

  /**
   * Recompute totalCampaignValue for a single campaign index,
   * then push the updated value back into the form field.
   */
  const recalcTotalForIndex = useCallback(
    (index) => {
      const campaigns = form.getFieldValue("campaigns") || [];
      const camp = campaigns[index] || {};
      const { dailyBudget, startDate, endDate, campaignAmount } = camp;
      const days = calcDays(
        startDate ? dayjs(startDate) : null,
        endDate ? dayjs(endDate) : null,
      );
      const total = days > 0 && dailyBudget ? days * dailyBudget : undefined;

      // Push calculated total back into the form
      const updated = [...campaigns];
      updated[index] = { ...updated[index], totalCampaignValue: total };
      form.setFieldsValue({ campaigns: updated });

      // Sync local state for live summary strip (includes campaignAmount for budget check)
      setCampaignFields((prev) => {
        const next = [...prev];
        next[index] = {
          dailyBudget,
          startDate: startDate ? dayjs(startDate) : null,
          endDate: endDate ? dayjs(endDate) : null,
          campaignAmount: campaignAmount ?? null,
        };
        return next;
      });
    },
    [form],
  );

  const onValuesChange = useCallback(
    (changedValues) => {
      // When any campaign field changes, recalculate totals for all campaigns
      const campaigns = form.getFieldValue("campaigns") || [];
      campaigns.forEach((_, idx) => recalcTotalForIndex(idx));
    },
    [form, recalcTotalForIndex],
  );

  const onFinish = async (values) => {
    try {
      if (!values.campaigns || values.campaigns.length === 0) {
        message.error("Please add at least one campaign");
        return;
      }

      // ── Hard budget-cap validation ──────────────────────────────────────
      let totalValueAcrossAll = 0;
      for (let i = 0; i < values.campaigns.length; i++) {
        const camp = values.campaigns[i];
        if (!camp.startDate || !camp.endDate || !camp.dailyBudget) continue;
        const days = calcDays(dayjs(camp.startDate), dayjs(camp.endDate));
        totalValueAcrossAll += days * camp.dailyBudget;
      }

      if (remainingBalance != null && totalValueAcrossAll > remainingBalance) {
        message.error({
          content: (
            <span>
              <strong>Total Budget Exceeded:</strong> The total value of these new campaigns
              (₹{totalValueAcrossAll.toLocaleString("en-IN")}) exceeds the allocated budget
              (₹{remainingBalance.toLocaleString("en-IN")}).
            </span>
          ),
          duration: 6,
        });
        return; // stop — do NOT create any campaign
      }
      // ────────────────────────────────────────────────────────────────────

      const campaignsToCreate = values.campaigns.map((campaign) => {
        const startDate = dayjs(campaign.startDate).toDate();
        const endDate = dayjs(campaign.endDate).toDate();
        const campaignDays = calcDays(
          dayjs(campaign.startDate),
          dayjs(campaign.endDate),
        );
        const totalCampaignValue =
          campaignDays > 0 && campaign.dailyBudget
            ? campaignDays * campaign.dailyBudget
            : 0;

        return {
          clientId: values.clientId,
          clientCompanyId: values.clientId,
          projectId: values.projectId || null,
          platform: campaign.platform,
          startDate,
          endDate,
          campaignDays,
          dailyBudget: campaign.dailyBudget,
          campaignAmount: campaign.campaignAmount || 0,
          totalCampaignValue,
        };
      });

      const results = await Promise.allSettled(
        campaignsToCreate.map((payload) => createCampaign(payload).unwrap()),
      );

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (successful > 0) {
        // Collect created campaign data for display
        const createdData = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value?.data?.campaign || r.value?.campaign)
          .filter(Boolean);
        setCreatedCampaigns(createdData);
        message.success(`Successfully created ${successful} campaign(s)`);
        setIsSuccessModalVisible(true);
      }
      if (failed > 0) {
        message.error(`Failed to create ${failed} campaign(s)`);
        console.error(
          "Campaign creation errors:",
          results.filter((r) => r.status === "rejected"),
        );
      }
    } catch (error) {
      message.error(error?.data?.message || "Failed to create campaigns");
      console.error("Campaign creation error:", error);
    }
  };

  return (
    <div>
      {/* Header */}
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
          onClick={() => navigate("/agency/accounts/campaign-expenses")}
        >
          Back
        </Button>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>
          Create Campaign(s)
        </h1>
      </div>

      <Card style={{ maxWidth: 1000 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={onValuesChange}
          initialValues={{ campaigns: [{}] }}
        >
          {/* ── Common Information ── */}
          <Card
            type="inner"
            title="Common Information"
            style={{ marginBottom: 24 }}
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="clientId"
                  label="Client"
                  rules={[{ required: true, message: "Please select a client" }]}
                >
                  <Select
                    placeholder="Select client"
                    showSearch
                    filterOption={false}
                    onSearch={setClientSearch}
                    loading={isLoadingClients}
                    allowClear
                    onChange={(value) => {
                      setSelectedClientId(value);
                      form.setFieldsValue({ projectId: undefined });
                      setClientSearch("");
                    }}
                    onBlur={() => {
                      setClientSearch("");
                    }}
                    options={clients.map((c) => ({
                      value: c._id,
                      label: c.name,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="projectId"
                  label="Project"
                  rules={[
                    { required: true, message: "Please select a project" },
                  ]}
                  tooltip="Select project to auto-fetch invoice info"
                >
                  <Select
                    placeholder={
                      selectedClientId
                        ? "Select project"
                        : "Select a client first"
                    }
                    disabled={!selectedClientId}
                    showSearch
                    optionFilterProp="label"
                    filterOption={(input, option) =>
                      (option?.label ?? "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                    allowClear
                    onChange={(value) => {
                      setSelectedProjectId(value);
                      // Clear campaign amounts when project changes
                      const current = form.getFieldValue("campaigns") || [{}];
                      form.setFieldsValue({
                        campaigns: current.map((camp) => ({
                          ...camp,
                          campaignAmount: undefined,
                        })),
                      });
                    }}
                    options={projects.map((p) => ({
                      value: p._id,
                      label: `${p.name}${p.status ? ` (${p.status.replace(/_/g, " ")})` : ""}`,
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Loading */}
            {(isLoadingProject || isLoadingInvoice) && (
              <Row style={{ marginTop: 8 }}>
                <Col>
                  <Spin size="small" /> &nbsp;Loading invoice details…
                </Col>
              </Row>
            )}

            {/* Invoice info box */}
            {invoice && !isLoadingInvoice && (
              <Row style={{ marginTop: 16 }}>
                <Col span={24}>
                  <Alert
                    message="Invoice Details"
                    description={
                      <div>
                        <div>
                          <strong>Invoice Number:</strong>{" "}
                          {invoice.invoiceNumber || "Draft"}
                        </div>
                        <div>
                          <strong>Total Invoice Campaign Amount:</strong> ₹
                          {invoice.campaignAmount?.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }) || "0.00"}
                        </div>
                        <div style={{ fontSize: "16px", color: "#3f8600" }}>
                          <strong>Allocated Budget for New Campaigns:</strong> ₹
                          {remainingBalance?.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }) || "0.00"}
                        </div>
                        <div style={{ marginTop: 8, color: "var(--accent-primary)" }}>
                          Allocated Budget auto-populated in campaigns (read-only reference).
                        </div>
                      </div>
                    }
                    type="info"
                    showIcon
                  />
                </Col>
              </Row>
            )}

            {/* No invoice warning */}
            {selectedProjectId &&
              !isLoadingProject &&
              project &&
              !invoiceId && (
                <Row style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <Alert
                      message="No Invoice Found"
                      description="The selected project does not have an associated invoice. Enter campaign details manually."
                      type="warning"
                      showIcon
                    />
                  </Col>
                </Row>
              )}
          </Card>

          {/* ── Campaigns ── */}
          <Card type="inner" title="Campaigns">
            <Form.List name="campaigns">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key}>
                      <Card
                        type="inner"
                        title={`Campaign ${key + 1}`}
                        extra={
                          fields.length > 1 ? (
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => {
                                remove(name);
                                setCampaignFields((prev) =>
                                  prev.filter((_, i) => i !== name),
                                );
                              }}
                            >
                              Remove
                            </Button>
                          ) : null
                        }
                        style={{ marginBottom: 16 }}
                      >
                        {/* Live summary strip */}
                        <CampaignSummaryStrip
                          dailyBudget={campaignFields[key]?.dailyBudget}
                          startDate={campaignFields[key]?.startDate}
                          endDate={campaignFields[key]?.endDate}
                          campaignAmount={campaignFields[key]?.campaignAmount}
                        />

                        {/* Row 1: Platform */}
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <Form.Item
                              {...restField}
                              name={[name, "platform"]}
                              label="Platform"
                              rules={[
                                {
                                  required: true,
                                  message: "Please select a platform",
                                },
                              ]}
                            >
                              <Select placeholder="Select platform">
                                <Select.Option value="instagram">
                                  Instagram
                                </Select.Option>
                                <Select.Option value="facebook">
                                  Facebook
                                </Select.Option>
                                <Select.Option value="meta_ads">
                                  Meta Ads
                                </Select.Option>
                                <Select.Option value="google_ads">
                                  Google Ads
                                </Select.Option>
                                <Select.Option value="other">
                                  Other
                                </Select.Option>
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            {/* Daily Budget */}
                            <Form.Item
                              {...restField}
                              name={[name, "dailyBudget"]}
                              label="Daily Budget (excl GST)"
                              rules={[
                                {
                                  required: true,
                                  message: "Please enter daily budget",
                                },
                                {
                                  type: "number",
                                  min: 1,
                                  message:
                                    "Daily budget must be greater than 0",
                                },
                              ]}
                            >
                              <InputNumber
                                style={{ width: "100%" }}
                                formatter={rupeeFormatter}
                                parser={rupeeParser}
                                min={1}
                                placeholder="e.g. 500"
                              />
                            </Form.Item>
                          </Col>
                        </Row>

                        {/* Row 2: Start Date + End Date */}
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <Form.Item
                              {...restField}
                              name={[name, "startDate"]}
                              label="Start Date"
                              rules={[
                                {
                                  required: true,
                                  message: "Please select start date",
                                },
                              ]}
                            >
                              <DatePicker
                                style={{ width: "100%" }}
                                format="DD/MM/YYYY"
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item
                              {...restField}
                              name={[name, "endDate"]}
                              label="End Date"
                              dependencies={[
                                ["campaigns", name, "startDate"],
                                ["campaigns", name, "dailyBudget"],
                                ["campaigns", name, "campaignAmount"],
                              ]}
                              rules={[
                                {
                                  required: true,
                                  message: "Please select end date",
                                },
                                ({ getFieldValue }) => ({
                                  validator(_, value) {
                                    const campaigns =
                                      getFieldValue("campaigns") || [];
                                    const camp = campaigns[name] || {};
                                    const start = camp.startDate
                                      ? dayjs(camp.startDate)
                                      : null;

                                    if (!start || !value) return Promise.resolve();

                                    // Must be on or after start date
                                    if (dayjs(value).isBefore(start, "day")) {
                                      return Promise.reject(
                                        new Error("End date must be on or after start date"),
                                      );
                                    }

                                    // ── Budget cap check ──────────────────
                                    const { dailyBudget, campaignAmount } = camp;
                                    if (
                                      dailyBudget &&
                                      campaignAmount != null &&
                                      campaignAmount > 0
                                    ) {
                                      const days = calcDays(start, dayjs(value));
                                      const totalValue = days * dailyBudget;
                                      if (totalValue > campaignAmount) {
                                        const maxDays = Math.floor(
                                          campaignAmount / dailyBudget,
                                        );
                                        const maxEnd = start
                                          .add(maxDays - 1, "day")
                                          .format("DD MMM YYYY");
                                        return Promise.reject(
                                          new Error(
                                            `Budget exceeded: ${days} days × ₹${dailyBudget.toLocaleString("en-IN")} = ₹${totalValue.toLocaleString("en-IN")} exceeds invoice limit of ₹${campaignAmount.toLocaleString("en-IN")}. Max end date: ${maxEnd} (${maxDays} days).`,
                                          ),
                                        );
                                      }
                                    }
                                    // ──────────────────────────────────────

                                    return Promise.resolve();
                                  },
                                }),
                              ]}
                            >
                              <DatePicker
                                style={{ width: "100%" }}
                                format="DD/MM/YYYY"
                                disabledDate={(d) => {
                                  const campaigns =
                                    form.getFieldValue("campaigns") || [];
                                  const camp = campaigns[name] || {};
                                  if (!camp.startDate) return false;
                                  const start = dayjs(camp.startDate).startOf("day");
                                  // Disable past start date
                                  if (d && d < start) return true;
                                  // Disable dates that would exceed invoice budget
                                  if (
                                    camp.dailyBudget &&
                                    camp.campaignAmount != null &&
                                    camp.campaignAmount > 0
                                  ) {
                                    const maxDays = Math.floor(
                                      camp.campaignAmount / camp.dailyBudget,
                                    );
                                    const maxEnd = dayjs(camp.startDate).add(
                                      maxDays - 1,
                                      "day",
                                    );
                                    if (d && d > maxEnd) return true;
                                  }
                                  return false;
                                }}
                                renderExtraFooter={() => {
                                  const campaigns =
                                    form.getFieldValue("campaigns") || [];
                                  const camp = campaigns[name] || {};
                                  if (
                                    camp.startDate &&
                                    camp.dailyBudget &&
                                    camp.campaignAmount > 0
                                  ) {
                                    const maxDays = Math.floor(
                                      camp.campaignAmount / camp.dailyBudget,
                                    );
                                    const maxEnd = dayjs(camp.startDate)
                                      .add(maxDays - 1, "day")
                                      .format("DD MMM YYYY");
                                    return (
                                      <div
                                        style={{
                                          padding: "4px 12px",
                                          color: "#d46b08",
                                          fontSize: 12,
                                        }}
                                      >
                                        ⚠️ Max end date:{" "}
                                        <strong>{maxEnd}</strong> ({maxDays} days,
                                        invoice limit ₹{camp.campaignAmount.toLocaleString("en-IN")})
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                            </Form.Item>
                          </Col>
                        </Row>

                        {/* Row 3: Total Campaign Value (auto-calc, read-only) + Campaign Amount from Invoice (read-only) */}
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <Form.Item
                              {...restField}
                              name={[name, "totalCampaignValue"]}
                              label={
                                <span>
                                  Total Campaign Value (excl GST){" "}
                                  <Tooltip title="Auto-calculated: Days × Daily Budget. This field is read-only.">
                                    <InfoCircleOutlined
                                      style={{ color: "var(--accent-primary)" }}
                                    />
                                  </Tooltip>
                                </span>
                              }
                            >
                              <InputNumber
                                style={{
                                  width: "100%",
                                  background: "#f5f5f5",
                                  cursor: "not-allowed",
                                }}
                                formatter={rupeeFormatter}
                                parser={rupeeParser}
                                readOnly
                                tabIndex={-1}
                                placeholder="Auto-calculated from dates × daily budget"
                                prefix={
                                  <LockOutlined style={{ color: "#bbb" }} />
                                }
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item
                              {...restField}
                              name={[name, "campaignAmount"]}
                              label={
                                <span>
                                  Campaign Amount from Invoice (excl GST){" "}
                                  <Tooltip title="Auto-populated from the project invoice. Read-only — for reference only.">
                                    <LockOutlined style={{ color: "#bbb" }} />
                                  </Tooltip>
                                </span>
                              }
                            >
                              <InputNumber
                                style={{
                                  width: "100%",
                                  background: "#f5f5f5",
                                  cursor: "not-allowed",
                                }}
                                formatter={rupeeFormatter}
                                parser={rupeeParser}
                                readOnly
                                tabIndex={-1}
                                placeholder="Auto-populated from invoice"
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                      {key < fields.length - 1 && <Divider />}
                    </div>
                  ))}

                  <Form.Item>
                    <Button
                      type="dashed"
                      onClick={() => {
                        add();
                        setCampaignFields((prev) => [
                          ...prev,
                          { dailyBudget: null, startDate: null, endDate: null, campaignAmount: null },
                        ]);
                      }}
                      block
                      icon={<PlusOutlined />}
                      style={{ marginTop: 16 }}
                    >
                      Add Another Campaign
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Card>

          {/* Submit */}
          <Form.Item style={{ marginTop: 24 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                size="large"
              >
                Create All Campaigns
              </Button>
              <Button onClick={() => navigate("/agency/accounts/campaign-expenses")} size="large">
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* Success Modal - Display Created Campaigns */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 24 }} />
            <span>Campaigns Created Successfully!</span>
          </div>
        }
        open={isSuccessModalVisible}
        onCancel={() => {
          setIsSuccessModalVisible(false);
          navigate("/agency/accounts/campaign-expenses");
        }}
        footer={[
          <Button
            key="view"
            type="primary"
            onClick={() => {
              setIsSuccessModalVisible(false);
              navigate("/agency/accounts/campaign-expenses");
            }}
          >
            View All Campaigns
          </Button>,
        ]}
        width={900}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message={`${createdCampaigns.length} campaign(s) have been created successfully`}
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </div>

        <Table
          columns={[
            {
              title: "Platform",
              dataIndex: "platform",
              key: "platform",
              render: (platform) => platform?.replace("_", " ").toUpperCase(),
            },
            {
              title: "Client",
              dataIndex: "clientCompanyId",
              key: "clientCompanyId",
              render: (client, record) => {
                const clientData = client || record.clientId;
                return (
                  <span style={{ fontWeight: "bold", color: "var(--accent-primary)" }}>
                    {clientData?.name || "N/A"}
                  </span>
                );
              },
            },
            {
              title: "Start Date",
              dataIndex: "startDate",
              key: "startDate",
              render: (date) => new Date(date).toLocaleDateString(),
            },
            {
              title: "End Date",
              dataIndex: "endDate",
              key: "endDate",
              render: (date) => new Date(date).toLocaleDateString(),
            },
            {
              title: "Daily Budget",
              dataIndex: "dailyBudget",
              key: "dailyBudget",
              render: (value) => `₹${value?.toLocaleString("en-IN") || 0}`,
            },
            {
              title: "Total Value",
              dataIndex: "totalCampaignValue",
              key: "totalCampaignValue",
              render: (value) => `₹${value?.toLocaleString("en-IN") || 0}`,
            },
          ]}
          dataSource={createdCampaigns}
          rowKey="_id"
          pagination={false}
          scroll={{ x: "max-content" }}
        />
      </Modal>
    </div>
  );
};

export default CampaignForm;
