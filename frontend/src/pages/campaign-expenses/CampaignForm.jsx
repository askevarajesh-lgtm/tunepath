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
  Radio,
  Typography,
  AutoComplete,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
  LockOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
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

const { Text } = Typography;

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
const CampaignSummaryStrip = ({ dailyBudget, startDate, endDate, campaignAmount, isInternal }) => {
  if (!dailyBudget || !startDate || !endDate) return null;
  const days = calcDays(startDate, endDate);
  if (days <= 0) return null;
  const total = days * dailyBudget;

  // Check if campaign amount from invoice is set and total exceeds it (client campaigns only)
  const hasInvoiceLimit = !isInternal && campaignAmount != null && campaignAmount > 0;
  const isOverBudget = hasInvoiceLimit && total > campaignAmount;

  return (
    <div
      style={{
        background: isOverBudget
          ? "linear-gradient(90deg,#fff2f0 0%,#ffccc7 100%)"
          : isInternal
            ? "linear-gradient(90deg,#f9f0ff 0%,#f0f5ff 100%)"
            : "linear-gradient(90deg,#f0f9ff 0%,#e6f7ff 100%)",
        border: `1px solid ${isOverBudget ? "#ff4d4f" : isInternal ? "#d3adf7" : "#91d5ff"}`,
        borderRadius: 8,
        padding: "10px 16px",
        marginBottom: 16,
        display: "flex",
        gap: 24,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {isInternal && (
        <div>
          <Tag color="purple" style={{ fontWeight: 700, fontSize: 13, borderRadius: 6 }}>
            <RocketOutlined /> Own Brand Marketing
          </Tag>
        </div>
      )}
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
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [campaignScope, setCampaignScope] = useState("client"); // "client" | "internal"
  const isInternal = campaignScope === "internal";

  const agencyBrandId = user?.companyId?._id || user?.companyId || user?.agencyId?._id || user?.agencyId || user?._id;
  const agencyBrandName = user?.agencyName || user?.companyName || user?.agencyId?.name || user?.agencyId?.companyName || "Tunepath";

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
  const { data: projectsData, isLoading: isLoadingClientProjects } = useGetProjectsDropdownQuery(
    selectedClientId ? { companyId: selectedClientId } : {},
    { skip: !selectedClientId },
  );
  const { data: allProjectsData } = useGetProjectsDropdownQuery({});
  const { data: campaignsDropdownData } = useGetCampaignsDropdownQuery({});

  const { data: projectData, isLoading: isLoadingProject } =
    useGetProjectByIdQuery(selectedProjectId, { skip: !selectedProjectId });
  const project = projectData?.data?.project || projectData?.project || projectData?.data || projectData;
  const invoiceId = project?.invoiceId?._id || (typeof project?.invoiceId === "string" ? project?.invoiceId : null);
  const { data: invoiceData, isLoading: isLoadingInvoice } =
    useGetInvoiceByIdQuery(invoiceId, { skip: !invoiceId });
  const invoice = invoiceData?.data?.invoice || invoiceData?.invoice || invoiceData?.data || invoiceData;
  const [createCampaign, { isLoading }] = useCreateCampaignMutation();

  const rawClients = clientsData?.data?.companies || clientsData?.data?.data || (Array.isArray(clientsData?.data) ? clientsData.data : []) || (Array.isArray(clientsData) ? clientsData : []) || [];
  const rawProjects = projectsData?.data?.projects || projectsData?.data?.data || (Array.isArray(projectsData?.data) ? projectsData.data : []) || (Array.isArray(projectsData) ? projectsData : []) || [];
  const allProjects = allProjectsData?.data?.projects || allProjectsData?.data?.data || (Array.isArray(allProjectsData?.data) ? allProjectsData.data : []) || (Array.isArray(allProjectsData) ? allProjectsData : []) || [];
  const allCampaigns = campaignsDropdownData?.data?.campaigns || campaignsDropdownData?.campaigns || (Array.isArray(campaignsDropdownData?.data) ? campaignsDropdownData.data : []) || (Array.isArray(campaignsDropdownData) ? campaignsDropdownData : []) || [];

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

    // Check master items
    if (proj.masterItemId?.isCampaign || (proj.masterItemId?.campaignDetails?.campaignAmount > 0) || (proj.masterItemId?.campaignAmount > 0)) return true;
    if (Array.isArray(proj.masterItemIds) && proj.masterItemIds.some(m => m?.isCampaign || (m?.campaignDetails?.campaignAmount > 0) || (m?.campaignAmount > 0))) return true;

    // Check invoice / proposal
    if (proj.invoiceId?.campaignAmount && Number(proj.invoiceId.campaignAmount) > 0) return true;
    if (proj.proposalId?.masterItems?.some(m => m?.isCampaign || (m?.campaignDetails?.campaignAmount > 0) || (m?.campaignAmount > 0))) return true;

    const depts = Array.isArray(proj.departments)
      ? proj.departments
      : [proj.department || ""];
    const hasCampaignDept = depts.some((d) => {
      const s = String(d || "").toLowerCase();
      return s.includes("digital-marketing") || s.includes("campaign") || s.includes("performance-ads") || s.includes("marketing");
    });
    if (hasCampaignDept) return true;

    if (proj.milestoneWorkflowType && ["campaign", "ads", "performance_ads", "digital-marketing", "digital_marketing"].includes(String(proj.milestoneWorkflowType).toLowerCase())) {
      return true;
    }

    const name = String(proj.name || "").toLowerCase();
    if (name.includes("campaign") || name.includes("meta ad") || name.includes("google ad") || name.includes("performance ad") || name.includes(" ad") || name.includes("ads")) {
      return true;
    }

    const cats = Array.isArray(proj.selectedCategories) ? proj.selectedCategories : [];
    const hasCampaignCat = cats.some((c) => {
      const catName = (typeof c === "string" ? c : c.name || c.categoryName || "").toLowerCase();
      return catName.includes("campaign") || catName.includes("meta ad") || catName.includes("google ad") || catName.includes("performance ad") || catName.includes("ads");
    });
    if (hasCampaignCat) return true;

    return false;
  }, [allCampaigns]);

  const existingOwnBrandNames = React.useMemo(() => {
    const list = [];
    (allCampaigns || []).forEach((c) => {
      const name = (c.ownBrandName || "").trim();
      if (name && !list.includes(name) && name.toLowerCase() !== (user?.name || "").toLowerCase()) {
        list.push(name);
      }
    });
    if (!list.includes(agencyBrandName)) {
      list.unshift(agencyBrandName);
    }
    return list;
  }, [allCampaigns, agencyBrandName, user?.name]);

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
    if (!rawClients || rawClients.length === 0) return [];
    const filtered = rawClients.filter((c) => {
      const cId = (c._id || c.id || "").toString();
      return campaignClientIds.has(cId) || (selectedClientId && cId === selectedClientId.toString());
    });
    return filtered.length > 0 ? filtered : rawClients;
  }, [rawClients, campaignClientIds, selectedClientId]);

  const projects = React.useMemo(() => {
    if (!rawProjects || rawProjects.length === 0) return [];
    const filtered = rawProjects.filter((p) => isCampaignProject(p));
    return filtered.length > 0 ? filtered : rawProjects;
  }, [rawProjects, isCampaignProject]);

  // Compute allocated budget from project, invoice, proposal, and masterItems
  const remainingBalance = React.useMemo(() => {
    if (isInternal) return null;
    if (!project && !invoice) return null;

    // 1. From invoice directly
    if (invoice?.campaignAmount && Number(invoice.campaignAmount) > 0) {
      return Number(invoice.campaignAmount);
    }
    // 2. From invoice's proposal masterItems
    const invMasterItems = invoice?.proposalId?.masterItems || [];
    const invCampAmt = invMasterItems.reduce((sum, item) => {
      return sum + (item.isCampaign ? (item.campaignDetails?.campaignAmount || item.campaignAmount || 0) : 0);
    }, 0);
    if (invCampAmt > 0) return invCampAmt;

    // 3. From project's proposal masterItems
    const projProposalMasterItems = project?.proposalId?.masterItems || [];
    const projProposalCampAmt = projProposalMasterItems.reduce((sum, item) => {
      return sum + (item.isCampaign ? (item.campaignDetails?.campaignAmount || item.campaignAmount || 0) : 0);
    }, 0);
    if (projProposalCampAmt > 0) return projProposalCampAmt;

    // 4. From project's masterItemIds
    const projMasterItems = Array.isArray(project?.masterItemIds) ? project.masterItemIds : [];
    const projMasterCampAmt = projMasterItems.reduce((sum, item) => {
      return sum + (item.isCampaign ? (item.campaignDetails?.campaignAmount || item.campaignAmount || 0) : 0);
    }, 0);
    if (projMasterCampAmt > 0) return projMasterCampAmt;

    // 5. From project's single masterItemId
    if (project?.masterItemId?.campaignDetails?.campaignAmount > 0) {
      return Number(project.masterItemId.campaignDetails.campaignAmount);
    }
    if (project?.masterItemId?.campaignAmount > 0) {
      return Number(project.masterItemId.campaignAmount);
    }
    if (project?.campaignAmount > 0) {
      return Number(project.campaignAmount);
    }

    return null;
  }, [project, invoice, isInternal]);

  // Auto-populate campaign details from project and invoice into Form
  useEffect(() => {
    if (project && !isInternal) {
      // Find masterItem campaignDetails if available
      const masterCampDetails =
        project?.masterItemId?.campaignDetails ||
        (Array.isArray(project?.masterItemIds)
          ? project.masterItemIds.find((m) => m?.isCampaign && m?.campaignDetails)?.campaignDetails
          : null) ||
        (invoice?.proposalId?.masterItems
          ? invoice.proposalId.masterItems.find((m) => m?.isCampaign && m?.campaignDetails)?.campaignDetails
          : null);

      const defaultDailyBudget = masterCampDetails?.dailyBudget || null;
      const defaultDays = masterCampDetails?.numberOfDays || null;
      const defaultStartDate = defaultDays ? dayjs() : null;
      const defaultEndDate = defaultDays ? dayjs().add(defaultDays - 1, "day") : null;

      const currentCampaigns = form.getFieldValue("campaigns") || [{}];
      const updatedCampaigns = currentCampaigns.map((camp, idx) => {
        const dBudget = camp.dailyBudget || (idx === 0 ? defaultDailyBudget : null);
        const sDate = camp.startDate ? dayjs(camp.startDate) : (idx === 0 ? defaultStartDate : null);
        const eDate = camp.endDate ? dayjs(camp.endDate) : (idx === 0 ? defaultEndDate : null);
        const days = calcDays(sDate, eDate);
        const total = days > 0 && dBudget ? days * dBudget : undefined;

        return {
          ...camp,
          campaignAmount: remainingBalance,
          dailyBudget: dBudget,
          startDate: sDate,
          endDate: eDate,
          totalCampaignValue: total,
        };
      });

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
  }, [project, invoice, remainingBalance, form, isInternal]);

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
          campaignAmount: isInternal ? null : (campaignAmount ?? null),
        };
        return next;
      });
    },
    [form, isInternal],
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

      // ── Hard budget-cap validation (Client campaigns only) ─────────────
      if (!isInternal && remainingBalance != null) {
        let totalValueAcrossAll = 0;
        for (let i = 0; i < values.campaigns.length; i++) {
          const camp = values.campaigns[i];
          if (!camp.startDate || !camp.endDate || !camp.dailyBudget) continue;
          const days = calcDays(dayjs(camp.startDate), dayjs(camp.endDate));
          totalValueAcrossAll += days * camp.dailyBudget;
        }

        if (totalValueAcrossAll > remainingBalance) {
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
      }
      // ────────────────────────────────────────────────────────────────────

      let resolvedBrandName = null;
      if (isInternal) {
        resolvedBrandName = (values.ownBrandName || "").trim();
        if (!resolvedBrandName || resolvedBrandName.toLowerCase() === (user?.name || "").toLowerCase()) {
          resolvedBrandName = agencyBrandName || "Tunepath";
        }
      }

      const effectiveClientId = isInternal ? (agencyBrandId || values.clientId) : values.clientId;

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
          clientId: effectiveClientId,
          clientCompanyId: effectiveClientId,
          projectId: isInternal ? null : (values.projectId || null),
          platform: campaign.platform,
          startDate,
          endDate,
          campaignDays,
          dailyBudget: campaign.dailyBudget,
          campaignAmount: isInternal ? totalCampaignValue : (campaign.campaignAmount || 0),
          totalCampaignValue,
          isInternal: Boolean(isInternal),
          ownBrandName: isInternal ? resolvedBrandName : null,
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
        {/* Campaign Type Selector */}
        <Card
          type="inner"
          style={{
            marginBottom: 24,
            background: isInternal ? "#f9f0ff" : "#f0f7ff",
            border: `1px solid ${isInternal ? "#d3adf7" : "#bae0ff"}`,
            borderRadius: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 15,
                  color: isInternal ? "#722ed1" : "#1677ff",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {isInternal ? <RocketOutlined /> : <ShopOutlined />}
                Campaign Purpose
              </div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
                {isInternal
                  ? "Running campaigns for your agency's own brand. No proposal, project, or invoice budget limit required."
                  : "Running campaigns for a client project with invoice budget tracking."}
              </div>
            </div>
            <Radio.Group
              value={campaignScope}
              onChange={(e) => {
                const newScope = e.target.value;
                setCampaignScope(newScope);
                if (newScope === "internal") {
                  setSelectedClientId(agencyBrandId);
                  setSelectedProjectId(null);
                  form.setFieldsValue({
                    clientId: agencyBrandId,
                    projectId: undefined,
                  });
                  const current = form.getFieldValue("campaigns") || [{}];
                  const updated = current.map((c) => ({ ...c, campaignAmount: undefined }));
                  form.setFieldsValue({ campaigns: updated });
                  setCampaignFields((prev) => prev.map((c) => ({ ...c, campaignAmount: null })));
                } else {
                  setSelectedClientId(null);
                  setSelectedProjectId(null);
                  form.setFieldsValue({ clientId: undefined, projectId: undefined });
                  const current = form.getFieldValue("campaigns") || [{}];
                  const updated = current.map((c) => ({ ...c, campaignAmount: undefined }));
                  form.setFieldsValue({ campaigns: updated });
                  setCampaignFields((prev) => prev.map((c) => ({ ...c, campaignAmount: null })));
                }
              }}
              buttonStyle="solid"
              size="middle"
            >
              <Radio.Button value="client">
                <Space>
                  <ShopOutlined /> Client Campaign
                </Space>
              </Radio.Button>
              <Radio.Button value="internal">
                <Space>
                  <RocketOutlined /> Own Brand Marketing
                </Space>
              </Radio.Button>
            </Radio.Group>
          </div>
        </Card>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={onValuesChange}
          initialValues={{
            campaigns: [{}],
            clientId: isInternal ? agencyBrandId : undefined,
          }}
        >
          {/* ── Common Information / Own Brand Information ── */}
          <Card
            type="inner"
            title={isInternal ? "Own Brand Information" : "Common Information"}
            style={{ marginBottom: 24 }}
          >
            {isInternal ? (
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.Item
                    name="ownBrandName"
                    label={<b>Own Brand / In-House Business Name</b>}
                    rules={[
                      { required: true, message: "Please enter or select your own brand name" },
                    ]}
                    tooltip="Type any brand name or choose from your previous own brands"
                  >
                    <AutoComplete
                      options={existingOwnBrandNames.map((name) => ({
                        value: name,
                        label: `🏢 ${name}`,
                      }))}
                      placeholder="Type or select your own brand name (e.g. Brand 1, Brand 2, Tunepath...)"
                      filterOption={(inputValue, option) =>
                        (option?.value ?? "")
                          .toLowerCase()
                          .includes(inputValue.toLowerCase())
                      }
                      allowClear
                      size="large"
                    />
                  </Form.Item>
                </Col>
              </Row>
            ) : (
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
            )}

            {/* Loading */}
            {!isInternal && (isLoadingProject || isLoadingInvoice) && (
              <Row style={{ marginTop: 8 }}>
                <Col>
                  <Spin size="small" /> &nbsp;Loading invoice details…
                </Col>
              </Row>
            )}

            {/* Invoice & Campaign Budget info box (Client campaigns) */}
            {!isInternal && selectedProjectId && !isLoadingProject && project && (
              <Row style={{ marginTop: 16 }}>
                <Col span={24}>
                  {remainingBalance != null && remainingBalance > 0 ? (
                    <Alert
                      message="Campaign & Budget Details"
                      description={
                        <div>
                          <div>
                            <strong>Project:</strong> {project.name}
                          </div>
                          {(invoice?.invoiceNumber || (typeof project?.invoiceId === "object" && project.invoiceId?.invoiceNumber)) && (
                            <div>
                              <strong>Invoice Number:</strong>{" "}
                              {invoice?.invoiceNumber || project?.invoiceId?.invoiceNumber}
                            </div>
                          )}
                          <div style={{ fontSize: "16px", color: "#3f8600", marginTop: 4 }}>
                            <strong>Allocated Budget for New Campaigns:</strong> ₹
                            {remainingBalance?.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div style={{ marginTop: 6, color: "var(--accent-primary)", fontSize: "13px" }}>
                            Allocated Budget and default campaign details auto-populated in campaigns.
                          </div>
                        </div>
                      }
                      type="info"
                      showIcon
                    />
                  ) : (
                    <Alert
                      message="Manual Campaign Setup"
                      description="No pre-configured campaign budget was found on the selected project or invoice. You can set the platform, daily budget, and duration manually."
                      type="warning"
                      showIcon
                    />
                  )}
                </Col>
              </Row>
            )}

            {/* Info notice for Own Brand campaigns */}
            {isInternal && (
              <Row style={{ marginTop: 12 }}>
                <Col span={24}>
                  <Alert
                    message="Manual Daily Budget Mode"
                    description="Enter your own brand name and daily budget below. The total campaign cost will be calculated automatically based on the number of days, without requiring any project or proposal."
                    type="success"
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
                          isInternal={isInternal}
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
                                <Select.Option value="facebook_instagram_both">
                                  Facebook & Instagram Both
                                </Select.Option>
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

                                    // ── Budget cap check (Client campaigns only) ──
                                    const { dailyBudget, campaignAmount } = camp;
                                    if (
                                      !isInternal &&
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
                                  // Disable dates that would exceed invoice budget (Client campaigns only)
                                  if (
                                    !isInternal &&
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
                                  if (isInternal) return null;
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

                        {/* Row 3: Total Campaign Value (auto-calc, read-only) + Campaign Amount from Invoice (Client campaigns only) */}
                        <Row gutter={16}>
                          <Col xs={24} md={isInternal ? 24 : 12}>
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
                          {!isInternal && (
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
                          )}
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
              title: "Client / Brand",
              dataIndex: "clientCompanyId",
              key: "clientCompanyId",
              render: (client, record) => {
                const clientData = client || record.clientId;
                const clientName = clientData?.companyName || clientData?.agencyName || clientData?.name;
                const name = record.isInternal
                  ? (record.ownBrandName || (clientName !== user?.name ? clientName : null) || agencyBrandName)
                  : (clientName || "N/A");
                return (
                  <Space>
                    <span style={{ fontWeight: "bold", color: "var(--accent-primary)" }}>
                      {name}
                    </span>
                    {record.isInternal && (
                      <Tag color="purple" style={{ fontSize: 11, fontWeight: 600 }}>
                        Own Brand
                      </Tag>
                    )}
                  </Space>
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
