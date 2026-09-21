import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  Card,
  Spin,
  Typography,
  Modal,
  Form,
  InputNumber,
  Select,
  Input,
  message,
  Tabs,
  Row,
  Col,
  DatePicker,
  Divider,
  Tooltip,
  Popconfirm
} from "antd";
import {
  PlusOutlined,
  EyeOutlined,
  ReloadOutlined,
  FilterOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  useGetCampaignsQuery,
  useGetCampaignsDropdownQuery,
  useGetCampaignByIdQuery,
  useGetClientCampaignSummaryQuery,
  useGetGlobalRechargesQuery,
  useAddGlobalRechargeMutation,
  useUpdateGlobalRechargeMutation,
  useDeleteGlobalRechargeMutation,
  useDeleteCampaignMutation,
} from "../../api/campaignApi";
import {
  useGetCompaniesQuery,
  useGetCompaniesDropdownQuery,
} from "../../api/companyApi";
import { useGetProjectsDropdownQuery } from "../../api/projectApi";
import DebouncedSearchInput from "../../components/common/DebouncedSearchInput";
import usePagination from "../../hooks/usePagination";
import { Icon } from "@iconify/react";
import { useActionPermissions } from "../../hooks/useActionPermissions";

const { Title } = Typography;

export const formatPlatformName = (platform) => {
  if (!platform) return "-";
  if (
    platform === "facebook_instagram_both" ||
    platform === "facebook_and_instagram"
  ) {
    return "Facebook & Instagram Both";
  }
  if (platform === "meta_ads") return "Meta Ads";
  if (platform === "google_ads") return "Google Ads";
  if (platform === "facebook") return "Facebook";
  if (platform === "instagram") return "Instagram";
  if (platform === "other") return "Other";
  return platform.replace(/_/g, " ").toUpperCase();
};

// Helper component for dynamic Client Amount in recharge modal
const ClientAmountField = ({ clientId, form, rechargeAmount }) => {
  const isInternalKey = typeof clientId === "string" && clientId.startsWith("internal_");
  const { data, isLoading } = useGetClientCampaignSummaryQuery(clientId, {
    skip: !clientId || isInternalKey,
  });
  const balance = isInternalKey ? 0 : (data?.data?.remainingBalance || 0);

  useEffect(() => {
    if (data?.data) {
      // Set the initial value if not already set or if it's a new selection
      const currentVal = form.getFieldValue(["clientDetails", clientId, "clientAmount"]);
      if (currentVal === undefined || currentVal === null) {
        form.setFieldValue(
          ["clientDetails", clientId, "clientAmount"],
          data.data.remainingBalance,
        );
      }
    }
  }, [data, clientId, form]);

  // Display value is balance minus current recharge
  const displayValue = Number((balance - rechargeAmount).toFixed(2));


  useEffect(() => {
    form.setFieldValue(["clientDetails", clientId, "clientAmount"], displayValue);
  }, [displayValue, clientId, form]);

  return (
    <Form.Item
      name={["clientDetails", clientId, "clientAmount"]}
      style={{ marginBottom: 0 }}
    >
      <InputNumber
        prefix="₹"
        style={{ width: "100%" }}
        readOnly
        disabled
        precision={2}
        step={0.01}
        formatter={(value) =>
          `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        }
        style={{ fontWeight: "bold", color: "var(--accent-primary)", width: "100%" }}
      />
    </Form.Item>
  );
};

// Helper component for auto-calculating Recharge Amount (exactly matches Spent)
const RechargeAmountField = ({ clientId, form }) => {
  const spent = Form.useWatch(["clientDetails", clientId, "dailyAmountSpent"], form) || 0;
  
  useEffect(() => {
    const recharge = Number(spent.toFixed(2));
    form.setFieldValue(["clientDetails", clientId, "rechargeAmount"], recharge);
  }, [spent, clientId, form]);

  return (
    <Form.Item
      name={["clientDetails", clientId, "rechargeAmount"]}
      rules={[{ required: true, message: "Required" }]}
      style={{ marginBottom: 0 }}
    >
      <InputNumber
        prefix="₹"
        style={{ width: "100%" }}
        precision={2}
        step={0.01}
        placeholder="Recharge"
        readOnly
        variant="filled"
        style={{ backgroundColor: '#f0f5ff', fontWeight: 'bold' }}
      />
    </Form.Item>
  );
};


const CampaignList = ({ isClientView = false, defaultTab = "campaigns" }) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const selectedClientId = null;
  const [filters, setFilters] = useState({
    status: undefined,
    platform: undefined,
    clientCompanyId: undefined,
  });

  const {
    pagination,
    queryParams,
    handleTableChange,
    handleSearchChange,
    setPagination,
  } = usePagination({ defaultPageSize: 10 });

  // Reset to page 1 whenever the global client scope changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [selectedClientId]);

  // Build query params with filters — selectedClientId from header takes priority
  const queryParamsWithFilters = useMemo(
    () => ({
      ...queryParams,
      ...(filters.status && { status: filters.status }),
      ...(filters.platform && { platform: filters.platform }),
      ...(selectedClientId
        ? { clientCompanyId: selectedClientId }
        : filters.clientCompanyId && {
            clientCompanyId: filters.clientCompanyId,
          }),
    }),
    [queryParams, filters, selectedClientId],
  );

  const { data, isLoading, refetch } = useGetCampaignsQuery(
    queryParamsWithFilters,
  );
  const { data: campaignsDropdownData } = useGetCampaignsDropdownQuery({ limit: 1000 });
  const { data: allProjectsData } = useGetProjectsDropdownQuery({ hasCampaigns: true });
  const { data: clientsData } = useGetCompaniesQuery();
  const { data: clientsDropdownData } = useGetCompaniesDropdownQuery({
    limit: 100,
  });
  const [addGlobalRecharge, { isLoading: isAddingRecharge }] =
    useAddGlobalRechargeMutation();
  const [updateGlobalRecharge, { isLoading: isUpdatingRecharge }] =
    useUpdateGlobalRechargeMutation();
  const [deleteCampaign, { isLoading: isDeleting }] =
    useDeleteCampaignMutation();
  const rechargeQueryParams = useMemo(
    () => ({
      ...(selectedClientId
        ? { clientCompanyId: selectedClientId }
        : filters.clientCompanyId && {
            clientCompanyId: filters.clientCompanyId,
          }),
      ...(filters.platform && { platform: filters.platform }),
    }),
    [filters.clientCompanyId, filters.platform, selectedClientId],
  );

  const [deleteGlobalRecharge] = useDeleteGlobalRechargeMutation();

  const { data: globalRechargesData, isLoading: isLoadingRecharges, refetch: refetchRecharges } =
    useGetGlobalRechargesQuery(rechargeQueryParams);
  const [rechargeForm] = Form.useForm();
  const [isRechargeModalVisible, setIsRechargeModalVisible] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [editingRecharge, setEditingRecharge] = useState(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const {
    canAdd: canCreate,
    canEdit,
    canDelete,
    canView,
    canRead,
    isAdmin,
  } = useActionPermissions("/campaigns");

  // Fetch campaign details when selected
  const { data: selectedCampaignData } = useGetCampaignByIdQuery(
    selectedCampaignId,
    {
      skip: !selectedCampaignId,
    },
  );
  const selectedCampaign = selectedCampaignData?.data?.campaign;

  // Watch form values for dynamic UI
  const selectedClientIds = Form.useWatch("clientCompanyIds", rechargeForm) || [];
  const clientDetails = Form.useWatch("clientDetails", rechargeForm) || {};

  // Handle paginated response
  const paginationData = data?.data?.pagination;
  const campaigns = data?.data?.data || data?.data?.campaigns || [];
  
  const totalRef = React.useRef(0);
  if (paginationData?.total !== undefined) {
    totalRef.current = paginationData.total;
  }
  const total = paginationData?.total || campaigns.length || totalRef.current;

  // Handle dropdown data
  const campaignsDropdown = campaignsDropdownData?.data?.campaigns || campaignsDropdownData?.campaigns || [];
  const allProjects = allProjectsData?.data?.projects || allProjectsData?.data?.data || [];
  const clients = clientsData?.data || clientsData?.companies || [];
  const rawClientsDropdown =
    clientsDropdownData?.data ||
    clientsDropdownData?.companies ||
    [];

  const isCampaignProject = useCallback((proj) => {
    if (!proj) return false;
    const projId = (proj._id || proj.id || "").toString();

    const hasCampaignDoc = (campaignsDropdown || []).some((c) => {
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
  }, [campaignsDropdown]);

  // Clients and individual Own Brands who have existing campaigns created in Campaign Create
  const rechargeClientsDropdown = useMemo(() => {
    const map = new Map();
    const agencyName = currentUser?.agencyName || currentUser?.companyName || currentUser?.agencyId?.name || currentUser?.agencyId?.companyName || "Tunepath";

    // Collect campaigns from ALL available sources (dropdown query AND current table campaigns)
    const allCampaignsList = [
      ...(Array.isArray(campaignsDropdown) ? campaignsDropdown : []),
      ...(Array.isArray(campaigns) ? campaigns : []),
    ];

    allCampaignsList.forEach((c) => {
      const isInternal = Boolean(c.isInternal);
      if (isInternal) {
        let brandName = (c.ownBrandName || "").trim();
        if (!brandName || brandName.toLowerCase() === (currentUser?.name || "").toLowerCase()) {
          brandName = c.clientCompanyId?.companyName || c.clientCompanyId?.agencyName || agencyName;
        }
        const internalKey = `internal_${brandName}`;
        if (!map.has(internalKey)) {
          const rawId = c.clientCompanyId?._id || c.clientCompanyId || c.clientId?._id || c.clientId;
          map.set(internalKey, {
            _id: internalKey,
            rawClientId: rawId,
            name: `${brandName} (Own Brand)`,
            ownBrandName: brandName,
            isInternal: true,
          });
        }
      } else {
        const clientObj = c.clientCompanyId || c.clientId;
        const cId = (clientObj?._id || clientObj || "").toString();
        if (cId) {
          let name = "";
          let email = "";

          if (typeof clientObj === "object" && (clientObj.companyName || clientObj.name)) {
            name = clientObj.companyName || clientObj.name;
            email = clientObj.email || "";
          } else {
            const found = (rawClientsDropdown || []).find(
              (rc) => (rc._id || rc.id || "").toString() === cId,
            );
            if (found) {
              name = found.companyName || found.name;
              email = found.email || "";
            }
          }

          if (name && !map.has(cId)) {
            map.set(cId, {
              _id: cId,
              name,
              email,
              isInternal: false,
            });
          }
        }
      }
    });

    // Also include all client companies from rawClientsDropdown
    (rawClientsDropdown || []).forEach((client) => {
      const cId = (client._id || client.id || "").toString();
      if (cId && !map.has(cId)) {
        map.set(cId, {
          _id: cId,
          name: client.companyName || client.name || "Client",
          email: client.email || "",
          isInternal: false,
        });
      }
    });

    // Also ensure agency's own company is included for internal recharges
    const agencyKey = `internal_${agencyName}`;
    if (!map.has(agencyKey) && !isClientView) {
      const agencyId = (currentUser?.companyId?._id || currentUser?.companyId || currentUser?.agencyId?._id || currentUser?.agencyId || currentUser?._id || "").toString();
      map.set(agencyKey, {
        _id: agencyKey,
        rawClientId: agencyId,
        name: `${agencyName} (Own Brand)`,
        ownBrandName: agencyName,
        email: currentUser?.email || "",
        isInternal: true,
      });
    }

    return Array.from(map.values());
  }, [campaignsDropdown, campaigns, rawClientsDropdown, currentUser, isClientView]);

  const canViewAmounts = canRead;
  const canManageClientAmountValue = canEdit;

  // Get unique platforms from campaigns
  const uniquePlatforms = useMemo(() => {
    const platforms = new Set();
    campaigns.forEach((campaign) => {
      if (campaign.platform) {
        platforms.add(campaign.platform);
      }
    });
    return Array.from(platforms).sort();
  }, [campaigns]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      status: undefined,
      platform: undefined,
      clientCompanyId: isClientView ? currentUser?.clientId : undefined,
    });
  };

  const hasActiveFilters =
    filters.status || filters.platform || filters.clientCompanyId;

  // Get global recharges
  const globalRecharges = globalRechargesData?.data?.data || [];

  const handleAddRecharge = async (values) => {
    try {
      if (editingRecharge) {
        await updateGlobalRecharge({
          id: editingRecharge._id,
          platform: values.platform,
          rechargeDate: values.rechargeDate,
          activeCampaignsCount: values.activeCampaignsCount,
          clientCompanyIds: values.clientCompanyIds,
          clientDetails: values.clientDetails, // Passing the whole details object for backend aggregation
          notes: values.notes || "",
        }).unwrap();
        message.success("Campaign recharge updated successfully");
      } else {
        // Create ONE single combined record for all clients
        await addGlobalRecharge({
          platform: values.platform,
          rechargeDate: values.rechargeDate,
          activeCampaignsCount: values.activeCampaignsCount,
          clientCompanyIds: values.clientCompanyIds,
          clientDetails: values.clientDetails, // Passing the whole details object for backend aggregation
          notes: values.notes || "",
        }).unwrap();
        message.success("Combined campaign recharge added successfully");
      }
      setIsRechargeModalVisible(false);
      setEditingRecharge(null);
      rechargeForm.resetFields();
      setSelectedCampaignId(null);
      refetch();
      if (refetchRecharges) refetchRecharges();
    } catch (error) {
      message.error(error?.data?.message || "Failed to process recharge");
    }
  };

  const handleEditRecharge = (record) => {
    setEditingRecharge(record);

    const clientIds = [];
    const details = {};

    if (record.clientRecharges?.length > 0) {
      record.clientRecharges.forEach((cr) => {
        const id = cr.ownBrandName
          ? `internal_${cr.ownBrandName}`
          : (cr.clientId?._id || cr.clientId);
        if (id) {
          const strId = id.toString();
          clientIds.push(strId);
          details[strId] = {
            dailyAmountSpent: cr.dailyAmountSpent,
            dailyBudget: cr.dailyBudget,
            rechargeAmount: cr.rechargeAmount,
          };
        }
      });
    } else {
      const rawIds =
        record.clientCompanyIds?.map((c) => c._id || c) ||
        (record.clientCompanyId?._id
          ? [record.clientCompanyId._id]
          : record.clientCompanyId
            ? [record.clientCompanyId]
            : []);
      rawIds.forEach((id) => {
        const strId = id.toString();
        clientIds.push(strId);
        details[strId] = {
          dailyAmountSpent: record.dailyAmountSpent,
          dailyBudget: record.dailyBudget,
          rechargeAmount: record.rechargeAmount,
        };
      });
    }

    rechargeForm.setFieldsValue({
      platform: record.platform,
      rechargeDate: dayjs(record.rechargeDate || record.rechargedAt),
      activeCampaignsCount: record.activeCampaignsCount,
      clientCompanyIds: clientIds,
      clientDetails: details,
      notes: record.notes,
    });
    setIsViewOnly(false);
    setIsRechargeModalVisible(true);
  };

  const handleViewRecharge = (record) => {
    setEditingRecharge(record);

    const clientIds = [];
    const details = {};

    if (record.clientRecharges?.length > 0) {
      record.clientRecharges.forEach((cr) => {
        const id = cr.ownBrandName
          ? `internal_${cr.ownBrandName}`
          : (cr.clientId?._id || cr.clientId);
        if (id) {
          const strId = id.toString();
          clientIds.push(strId);
          details[strId] = {
            dailyAmountSpent: cr.dailyAmountSpent,
            dailyBudget: cr.dailyBudget,
            rechargeAmount: cr.rechargeAmount,
          };
        }
      });
    } else {
      const rawIds =
        record.clientCompanyIds?.map((c) => c._id || c) ||
        (record.clientCompanyId?._id
          ? [record.clientCompanyId._id]
          : record.clientCompanyId
            ? [record.clientCompanyId]
            : []);
      rawIds.forEach((id) => {
        const strId = id.toString();
        clientIds.push(strId);
        details[strId] = {
          dailyAmountSpent: record.dailyAmountSpent,
          dailyBudget: record.dailyBudget,
          rechargeAmount: record.rechargeAmount,
        };
      });
    }

    rechargeForm.setFieldsValue({
      platform: record.platform,
      rechargeDate: dayjs(record.rechargeDate || record.rechargedAt),
      activeCampaignsCount: record.activeCampaignsCount,
      clientCompanyIds: clientIds,
      clientDetails: details,
      notes: record.notes,
    });
    setIsViewOnly(true);
    setIsRechargeModalVisible(true);
  };

  const handleDeleteRecharge = async (id) => {
    try {
      await deleteGlobalRecharge(id).unwrap();
      message.success("Recharge record deleted successfully");
      if (refetchRecharges) refetchRecharges();
    } catch (error) {
      message.error(error?.data?.message || "Failed to delete recharge record");
    }
  };


  const handleDelete = (id) => {
    Modal.confirm({
      title: "Are you sure you want to delete this campaign?",
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await deleteCampaign(id).unwrap();
          message.success("Campaign deleted successfully");
          refetch();
        } catch (error) {
          message.error(error?.data?.message || "Failed to delete campaign");
        }
      },
    });
  };

  const handleCampaignChange = (campaignId) => {
    setSelectedCampaignId(campaignId);
    // Reset client, daily amount, date range, and client amount when campaign changes
    rechargeForm.setFieldsValue({
      platform: undefined,
      rechargeDate: dayjs(),
      activeCampaignsCount: undefined,
      clientCompanyIds: [],
      dailyAmountSpent: undefined,
      dailyBudget: undefined,
      clientAmount: undefined,
      rechargeAmount: undefined,
      notes: "",
    });
  };

  // Update client amount when campaign data is loaded
  useEffect(() => {
    if (selectedCampaign && selectedCampaignId) {
      // Auto-populate client if not already set
      // Auto-populate client and platform if not already set
      const currentClients = rechargeForm.getFieldValue("clientCompanyIds");
      if (!currentClients || currentClients.length === 0) {
        const campaignClientId =
          selectedCampaign.clientCompanyId?._id ||
          selectedCampaign.clientCompanyId ||
          selectedCampaign.clientId?._id ||
          selectedCampaign.clientId;
        if (campaignClientId) {
          rechargeForm.setFieldsValue({
            clientCompanyIds: [campaignClientId],
          });
        }
      }
      const currentPlatform = rechargeForm.getFieldValue("platform");
      if (!currentPlatform && selectedCampaign.platform) {
        rechargeForm.setFieldsValue({
          platform: selectedCampaign.platform.replace("_", " ").toUpperCase(),
        });
      }
    }
  }, [selectedCampaign, selectedCampaignId, rechargeForm]);

  // Auto-fill dailyBudget for selected clients from their existing campaigns if available
  useEffect(() => {
    if (selectedClientIds && selectedClientIds.length > 0) {
      const allCampaignsList = [
        ...(Array.isArray(campaignsDropdown) ? campaignsDropdown : []),
        ...(Array.isArray(campaigns) ? campaigns : []),
      ];
      if (allCampaignsList.length > 0) {
        selectedClientIds.forEach((clientId) => {
          const currentBudget = rechargeForm.getFieldValue(["clientDetails", clientId, "dailyBudget"]);
          if (currentBudget === undefined || currentBudget === null) {
            const clientCampaign = allCampaignsList.find((c) => {
              if (typeof clientId === "string" && clientId.startsWith("internal_")) {
                const targetBrand = clientId.replace(/^internal_/, "").toLowerCase();
                const cBrand = (c.ownBrandName || "").trim().toLowerCase();
                return Boolean(c.isInternal) && cBrand === targetBrand && c.dailyBudget;
              }
              const cId = (c.clientCompanyId?._id || c.clientCompanyId || c.clientId?._id || c.clientId || "").toString();
              return cId === clientId.toString() && c.dailyBudget;
            });
            if (clientCampaign?.dailyBudget) {
              rechargeForm.setFieldValue(["clientDetails", clientId, "dailyBudget"], clientCampaign.dailyBudget);
            }
          }
        });
      }
    }
  }, [selectedClientIds, campaignsDropdown, campaigns, rechargeForm]);

  // Handle form values change
  const handleFormValuesChange = (changedValues, allValues) => {
    // This can be used for future auto-calculations if needed
  };

  const columns = [
    {
      title: "Platform",
      dataIndex: "platform",
      key: "platform",
      render: (platform) => formatPlatformName(platform),
    },
    {
      title: "Client / Brand",
      dataIndex: "clientCompanyId",
      key: "clientCompanyId",
      render: (client, record) => {
        // Support both clientCompanyId and clientId (legacy)
        const clientData = client || record.clientId;
        const clientName = clientData?.companyName || clientData?.agencyName || clientData?.name;
        const agencyName = currentUser?.agencyName || currentUser?.companyName || currentUser?.agencyId?.name || currentUser?.agencyId?.companyName || "Tunepath";
        const name = record.isInternal
          ? (
              (record.ownBrandName && record.ownBrandName.toLowerCase() !== (currentUser?.name || "").toLowerCase())
                ? record.ownBrandName
                : (clientData?.companyName || clientData?.agencyName || (clientData?.name !== currentUser?.name ? clientData?.name : null) || agencyName)
            )
          : (clientName || "N/A");
        return (
          <Space>
            <span>{name}</span>
            {record.isInternal && (
              <Tag color="purple" style={{ fontWeight: 600, fontSize: 11, borderRadius: 4 }}>
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
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const statusColors = {
          planned: "default",
          active: "green",
          paused: "orange",
          completed: "blue",
          cancelled: "red",
        };
        return (
          <Tag color={statusColors[status] || "default"}>
            {status ? status.toUpperCase() : "Unknown"}
          </Tag>
        );
      },
    },
    // Only show budget column to Admin and Coordinator
    ...(canViewAmounts
      ? [
          {
            title: "Total Value",
            dataIndex: "totalCampaignValue",
            key: "totalCampaignValue",
            render: (value, record) => `₹${(value || record.campaignAmount || 0).toLocaleString("en-IN")}`,
          },
        ]
      : []),
    {
      title: "Actions",
      key: "actions",
      align: "center",
      fixed: window.innerWidth <= 768 ? false : "right",
      width: 110,
      render: (_, record) => (
        <Space>
          {canView && (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() =>
                navigate(
                  isClientView
                    ? `/client/accounts/campaign-expenses/${record._id}`
                    : `/agency/accounts/campaign-expenses/${record._id}`,
                )
              }
            >
              View
            </Button>
          )}
          {!isClientView && canDelete && (
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record._id)}
            >
              Delete
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Title level={2}>Campaigns</Title>
        <Space>
          {!isClientView && (
            <>
              {canEdit && (
                <Button
                  type="default"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setSelectedCampaignId(null);
                    rechargeForm.resetFields();
                    setIsRechargeModalVisible(true);
                  }}
                >
                  Campaign Recharge
                </Button>
              )}
              {canCreate && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate("/agency/accounts/campaign-expenses/new")}
                >
                  Create Campaign
                </Button>
              )}
            </>
          )}
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Filter by Status"
              allowClear
              style={{ width: "100%" }}
              value={filters.status}
              onChange={(value) => handleFilterChange("status", value)}
            >
              <Select.Option value="planned">Planned</Select.Option>
              <Select.Option value="active">Active</Select.Option>
              <Select.Option value="paused">Paused</Select.Option>
              <Select.Option value="completed">Completed</Select.Option>
              <Select.Option value="cancelled">Cancelled</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Filter by Platform"
              allowClear
              style={{ width: "100%" }}
              value={filters.platform}
              onChange={(value) => handleFilterChange("platform", value)}
            >
              {uniquePlatforms.map((platform) => (
                <Select.Option key={platform} value={platform}>
                  {formatPlatformName(platform)}
                </Select.Option>
              ))}
            </Select>
          </Col>
          {!isClientView && (
            <Col xs={24} sm={12} md={6}>
              <Select
                placeholder="Filter by Client"
                allowClear
                showSearch
                style={{ width: "100%" }}
                value={filters.clientCompanyId}
                onChange={(value) =>
                  handleFilterChange("clientCompanyId", value)
                }
                filterOption={(input, option) =>
                  (option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                options={rechargeClientsDropdown.map((client) => ({
                  value: client._id,
                  label: `${client.name}${client.email ? ` (${client.email})` : ""}`,
                }))}
              />
            </Col>
          )}
          <Col xs={24} sm={24} md={6}>
            <DebouncedSearchInput
              placeholder="Search campaigns by platform..."
              onChange={handleSearchChange}
              debounceDelay={500}
            />
          </Col>
        </Row>
        {hasActiveFilters && (
          <Button
            icon={<FilterOutlined />}
            onClick={handleClearFilters}
            size="small"
          >
            Clear Filters
          </Button>
        )}
      </Card>

      <Card>
        <Tabs
          defaultActiveKey={defaultTab}
          items={[
            {
              key: "recharges",
              label: (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ThunderboltOutlined style={{ fontSize: 16 }} />
                  Recharge Campaign Details
                </span>
              ),
              children: (
                <Spin spinning={isLoadingRecharges}>
                  <Table
                    columns={[
                      {
                        title: "Platform",
                        dataIndex: "platform",
                        key: "platform",
                        render: (text) => formatPlatformName(text),
                      },
                      {
                        title: "Date",
                        dataIndex: "rechargeDate",
                        key: "rechargeDate",
                        render: (date, record) =>
                          dayjs(date || record.rechargedAt).format("DD/MM/YYYY"),
                        sorter: (a, b) =>
                          new Date(a.rechargeDate || a.rechargedAt) -
                          new Date(b.rechargeDate || b.rechargedAt),
                      },
                      {
                        title: "# Active Campaigns",
                        dataIndex: "activeCampaignsCount",
                        key: "activeCampaignsCount",
                        align: "center",
                      },
                      {
                        title: "Clients / Brands",
                        key: "clients",
                        width: 350,
                        render: (_, record) => {
                          const clientRecharges = record.clientRecharges || [];
                          if (clientRecharges.length > 0) {
                            return (
                              <Space wrap>
                                {clientRecharges.map((cr, idx) => {
                                  const name = cr.ownBrandName
                                    ? `${cr.ownBrandName}`
                                    : (cr.clientId?.companyName || cr.clientId?.name || (clients.find((c) => c._id === (cr.clientId?._id || cr.clientId))?.name) || "Client");
                                  return (
                                    <Tag key={cr.clientId?._id || idx} color={cr.ownBrandName || cr.isInternal ? "purple" : "blue"}>
                                      {name} {cr.ownBrandName || cr.isInternal ? "(Own Brand)" : ""}
                                    </Tag>
                                  );
                                })}
                              </Space>
                            );
                          }
                          const clientIds = record.clientCompanyIds || [];
                          if (clientIds.length === 0 && record.clientCompanyId) {
                            // Handle legacy single client
                            const id =
                              record.clientCompanyId._id ||
                              record.clientCompanyId;
                            const client = clients.find((c) => c._id === id);
                            return client?.name ? (
                              <Tag>{client.name}</Tag>
                            ) : (
                              "N/A"
                            );
                          }
                          return (
                            (
                              <Space wrap>
                                {clientIds.map((c, idx) => (
                                  <Tag key={c._id || idx} color="blue">
                                    {c.name || "N/A"}
                                  </Tag>
                                ))}
                              </Space>
                            ) || "N/A"
                          );
                        },
                      },
                      {
                        title: "Daily Amount Spent",
                        dataIndex: "dailyAmountSpent",
                        key: "dailyAmountSpent",
                        render: (amount) =>
                          `₹${(amount || 0).toLocaleString("en-IN")}`,
                      },
                      {
                        title: "Daily Budget",
                        dataIndex: "dailyBudget",
                        key: "dailyBudget",
                        render: (amount) =>
                          `₹${(amount || 0).toLocaleString("en-IN")}`,
                      },

                      {
                        title: "Recharge Amount",
                        dataIndex: "rechargeAmount",
                        key: "rechargeAmount",
                        render: (amount) => (
                          <span style={{ color: "#3f8600", fontWeight: 500 }}>
                            ₹{(amount || 0).toLocaleString("en-IN")}
                          </span>
                        ),
                        sorter: (a, b) =>
                          (a.rechargeAmount || 0) - (b.rechargeAmount || 0),
                      },
                      {
                        title: "Notes",
                        dataIndex: "notes",
                        key: "notes",
                        render: (notes) => notes || "-",
                      },
                      ...(canManageClientAmountValue
                        ? [
                            {
                              title: "Actions",
                              key: "actions",
                              fixed: window.innerWidth <= 768 ? false : "right",
                              width: 130,
                              render: (_, record) => (
                                <Space>
                                  <Tooltip title="View">
                                    <Button
                                      type="text"
                                      icon={<Icon icon="lucide:eye" />}
                                      onClick={() => handleViewRecharge(record)}
                                    />
                                  </Tooltip>
                                  {canEdit && (
                                    <Tooltip title="Edit">
                                      <Button
                                        type="text"
                                        icon={<Icon icon="lucide:edit" />}
                                        onClick={() => handleEditRecharge(record)}
                                      />
                                    </Tooltip>
                                  )}
                                  {isAdmin && (
                                    <Popconfirm
                                      title="Delete Recharge"
                                      description="Are you sure you want to delete this recharge record? This action cannot be undone."
                                      onConfirm={() =>
                                        handleDeleteRecharge(record._id)
                                      }
                                      okText="Yes, Delete"
                                      cancelText="Cancel"
                                      okButtonProps={{ danger: true }}
                                    >
                                      <Tooltip title="Delete">
                                        <Button
                                          type="text"
                                          danger
                                          icon={<Icon icon="lucide:trash-2" />}
                                        />
                                      </Tooltip>
                                    </Popconfirm>
                                  )}
                                </Space>
                              ),
                            },
                          ]
                        : []),
                    ]}
                    dataSource={globalRecharges}
                    rowKey={(record, index) => record._id || index}
                    pagination={{
                      defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
                      showSizeChanger: true,
                      showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} recharges`,
                      pageSizeOptions: ["10", "20", "50", "100"],
                    }}
                    scroll={{ x: "max-content" }}
                    locale={{ emptyText: "No recharge history found." }}
                  />
                </Spin>
              ),
            },
            {
              key: "campaigns",
              label: (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon icon="ic:baseline-campaign" width="22" height="22" />
                  Campaign Details
                </span>
              ),
              children: (
                <Spin spinning={isLoading}>
                  <Table
                    columns={columns}
                    dataSource={campaigns}
                    rowKey="_id"
                    pagination={{
                      current: pagination.current,
                      pageSize: pagination.pageSize,
                      total: total,
                      showSizeChanger: true,
                      showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} campaigns`,
                      pageSizeOptions: ["10", "20", "50", "100"],
                    }}
                    onChange={handleTableChange}
                    scroll={{ x: "max-content" }}
                    locale={{ emptyText: "No campaigns found." }}
                  />
                </Spin>
              ),
            },
          ]}
        />
      </Card>

      {/* Campaign Recharge Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon
              icon={
                isViewOnly
                  ? "lucide:eye"
                  : editingRecharge
                    ? "lucide:edit"
                    : "mdi:flash"
              }
              width="24"
            />
            <span>
              {isViewOnly
                ? "View Campaign Recharge"
                : editingRecharge
                  ? "Edit Campaign Recharge"
                  : "Campaign Recharge Flow"}
            </span>
          </div>
        }
        open={isRechargeModalVisible}
        onCancel={() => {
          setIsRechargeModalVisible(false);
          setEditingRecharge(null);
          setIsViewOnly(false);
          rechargeForm.resetFields();
          setSelectedCampaignId(null);
        }}
        footer={isViewOnly ? [
          <Button key="close" onClick={() => {
            setIsRechargeModalVisible(false);
            setIsViewOnly(false);
          }}>
            Close
          </Button>
        ] : null}
        width={1100}
        styles={{
          body: {
            paddingTop: 10,
            maxHeight: "75vh",
            overflowY: "auto",
          },
        }}
      >
        <Form
          form={rechargeForm}
          layout="vertical"
          onFinish={handleAddRecharge}
          onValuesChange={handleFormValuesChange}
          disabled={isViewOnly}
          initialValues={{
            rechargeDate: dayjs(),
          }}
        >
          <Card
            size="small"
            style={{
              marginBottom: 20,
              border: "1px solid #e5e7eb",
            }}
          >
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item
                  name="platform"
                  label={<b>Platform</b>}
                  rules={[{ required: true, message: "Please select platform" }]}
                >
                  <Select placeholder="Select platform" size="large">
                    <Select.Option value="facebook_instagram_both">
                      Facebook & Instagram Both
                    </Select.Option>
                    <Select.Option value="instagram">Instagram</Select.Option>
                    <Select.Option value="facebook">Facebook</Select.Option>
                    <Select.Option value="meta_ads">Meta Ads</Select.Option>
                    <Select.Option value="google_ads">Google Ads</Select.Option>
                    <Select.Option value="other">Other</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="rechargeDate"
                  label={<b>Recharge Date</b>}
                  rules={[{ required: true, message: "Please select date" }]}
                >
                  <DatePicker
                    style={{ width: "100%" }}
                    format="DD/MM/YYYY"
                    size="large"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="activeCampaignsCount"
                  label={<b>Number of Active Campaigns</b>}
                  rules={[
                    {
                      required: true,
                      message: "Please enter active campaigns count",
                    },
                  ]}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    min={0}
                    placeholder="e.g. 5"
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Form.Item
            name="clientCompanyIds"
            label={<b>Select Clients to Recharge</b>}
            rules={[{ required: true, message: "Please select at least one client" }]}
            help="You can select multiple clients. Separate fields will appear for each."
          >
            <Select
              mode="multiple"
              placeholder="Start typing client name..."
              showSearch
              size="large"
              optionFilterProp="label"
              options={rechargeClientsDropdown.map((client) => ({
                value: client._id,
                label: `${client.name}${client.email ? ` (${client.email})` : ""}`,
              }))}
            />
          </Form.Item>

          {selectedClientIds.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <Divider orientation="left">
                <Space>
                  <Icon icon="lucide:users" />
                  Per-Client Recharge Details
                </Space>
              </Divider>
              
              <Table
                dataSource={selectedClientIds}
                pagination={false}
                rowKey={(id) => id}
                bordered
                size="small"
                columns={[
                  {
                    title: "Client Name",
                    key: "clientName",
                    width: "20%",
                    render: (clientId) => {
                      const client = rechargeClientsDropdown.find(c => (c.value || c._id) === clientId);
                      return <b>{client?.name || client?.label || "Client"}</b>;
                    }
                  },
                  {
                    title: "Daily Budget (Recvd)",
                    key: "dailyBudget",
                    render: (clientId) => (
                      <Form.Item
                        name={["clientDetails", clientId, "dailyBudget"]}
                        rules={[{ required: true, message: "Required" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          prefix="₹"
                          style={{ width: "100%" }}
                          min={0}
                          precision={2}
                          step={0.01}
                          placeholder="Budget"
                        />
                      </Form.Item>
                    )
                  },
                  {
                    title: "Daily Amount Spent",
                    key: "dailyAmountSpent",
                    render: (clientId) => (
                      <Form.Item
                        name={["clientDetails", clientId, "dailyAmountSpent"]}
                        rules={[{ required: true, message: "Required" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          prefix="₹"
                          style={{ width: "100%" }}
                          min={0}
                          precision={2}
                          step={0.01}
                          placeholder="Spent"
                        />
                      </Form.Item>
                    )
                  },
                  ...(canManageClientAmountValue ? [{
                    title: "Client Amount",
                    key: "clientAmount",
                    render: (clientId) => (
                      <ClientAmountField 
                        clientId={clientId} 
                        form={rechargeForm} 
                        rechargeAmount={clientDetails[clientId]?.rechargeAmount || 0}
                      />
                    )
                  }] : []),
                  {
                    title: "Recharge Amount",
                    key: "rechargeAmount",
                    render: (clientId) => (
                      <RechargeAmountField 
                        clientId={clientId} 
                        form={rechargeForm} 
                      />
                    )
                  }
                ]}
                footer={() => (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
                    <b>Total Clients: {selectedClientIds.length}</b>
                    <span style={{ fontSize: '16px' }}>
                      Total Recharge: <b style={{ color: '#3f8600' }}>₹{
                        selectedClientIds.reduce((sum, id) => sum + (clientDetails[id]?.rechargeAmount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      }</b>
                    </span>
                  </div>
                )}
              />
            </div>
          )}

          <Form.Item name="notes" label={<b>Notes (Optional)</b>}>
            <Input.TextArea
              rows={2}
              placeholder="Enter any additional notes about this batch recharge"
            />
          </Form.Item>

          <Divider />

          <Form.Item style={{ textAlign: "end", marginBottom: 0 }}>
            <Space size="middle">
              <Button
                onClick={() => {
                  setIsRechargeModalVisible(false);
                  setEditingRecharge(null);
                  rechargeForm.resetFields();
                  setSelectedCampaignId(null);
                }}
                size="large"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={isAddingRecharge || isUpdatingRecharge}
                size="large"
                icon={<Icon icon="lucide:check-circle" />}
                style={{ paddingLeft: 40, paddingRight: 40 }}
              >
                {editingRecharge ? "Update Recharge" : "Submit Recharges"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CampaignList;
