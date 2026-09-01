import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  Card,
  Spin,
  Alert,
  Descriptions,
  DatePicker,
  Tag,
  Switch,
  ColorPicker,
  InputNumber,
  Row,
  Col,
  Divider,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  useGetProjectByIdQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useGetProjectsQuery,
} from "../../api/projectApi";
import { useGetCompaniesDropdownQuery } from "../../api/companyApi";
import { useGetInvoicesQuery } from "../../api/invoiceApi";
import { useTheme } from "../../contexts/ThemeContext";
import dayjs from "dayjs";
import MasterItemDetailsCard from "../../components/common/MasterItemDetailsCard";

const { TextArea } = Input;
const { Option } = Select;

const parseHandlingDuration = (duration) => {
  if (!duration) return { amount: 0, unit: 'day' };
  const text = String(duration).trim().toLowerCase();
  const match = text.match(/(\d+)/);
  if (!match) return { amount: 0, unit: 'day' };
  const amount = Number(match[1]) || 0;
  
  if (text.includes('month')) return { amount, unit: 'month' };
  if (text.includes('week')) return { amount, unit: 'week' };
  if (text.includes('year')) return { amount, unit: 'year' };
  return { amount, unit: 'day' }; // Default to days
};

const ProjectForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEdit = !!id;
  const fromClient = location.state?.fromClient;
  const fromRenewal = location.state?.fromRenewal;

  const getBaseRoute = () => {
    if (location.pathname.startsWith("/client")) return "/client/workspace";
    if (location.pathname.startsWith("/agency")) return "/agency";
    if (location.pathname.startsWith("/user")) return "/user/workspace";
    return "/workspace";
  };
  const [form] = Form.useForm();
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [selectedInvoiceItemIndex, setSelectedInvoiceItemIndex] =
    useState(null);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const { isDark } = useTheme();

  const { data: projectData, isLoading: isLoadingProject } =
    useGetProjectByIdQuery(id, { skip: !isEdit });
  const { data: companiesData, isLoading: isLoadingCompanies } =
    useGetCompaniesDropdownQuery();
  // Query invoices for the selected client company
  // Backend maps companyId query param to clientId filter (see invoice.service.js line 163)
  const {
    data: invoicesData,
    isLoading: isLoadingInvoices,
    error: invoicesError,
  } = useGetInvoicesQuery(
    { companyId: selectedCompanyId }, // Backend maps this to clientId filter
    { skip: !selectedCompanyId || isEdit },
  );
  const watchedCompanyId = Form.useWatch("companyId", form);
  const [createProject, { isLoading: isCreating }] = useCreateProjectMutation();
  const [updateProject, { isLoading: isUpdating }] = useUpdateProjectMutation();

  // Get refetch function for projects list to manually refresh after creation
  const { refetch: refetchProjects } = useGetProjectsQuery({}, { skip: true });

  const project = projectData?.data?.project;
  // Handle dropdown response (data?.data?.companies) or paginated response (data?.data?.data)
  const companies = companiesData?.data?.companies || companiesData?.data?.data || companiesData?.data || [];
  // Handle paginated response (data?.data?.data) or legacy format (data?.data?.invoices)
  const invoices = Array.isArray(invoicesData) ? invoicesData : 
    (invoicesData?.data?.data || invoicesData?.data?.invoices || invoicesData?.data || []);

  const selectedCompany = React.useMemo(() => {
    return companies.find(
      (c) => String(c._id) === String(watchedCompanyId || selectedCompanyId),
    );
  }, [watchedCompanyId, selectedCompanyId, companies]);

  // Filter invoices to only show valid statuses (draft, sent, paid, overdue)
  // Also exclude cancelled invoices
  const validInvoices = React.useMemo(() => {
    return invoices.filter((inv) => {
      if (!inv || !inv.invoiceStatus) return false;
      if (inv.invoiceStatus === "Cancelled") return false;
      return ["Draft", "Sent", "Pending", "Paid"].includes(
        inv.invoiceStatus,
      );
    });
  }, [invoices]);

  // Debug: Log invoices and filtering in development
  React.useEffect(() => {
    if (process.env.NODE_ENV === "development" && selectedCompanyId) {
      console.log("ProjectForm - Invoice Debug:", {
        selectedCompanyId,
        totalInvoices: invoices.length,
        invoiceStatuses: invoices.map((inv) => ({
          id: inv._id,
          number: inv.invoiceNumber,
          status: inv.invoiceStatus,
          clientId: inv.clientId?._id || inv.clientId,
        })),
        validInvoicesCount: validInvoices.length,
      });
    }
  }, [selectedCompanyId, invoices, validInvoices]);

  useEffect(() => {
    if (!isEdit && fromClient?.clientId) {
      const clientId = String(fromClient.clientId);
      setSelectedCompanyId(clientId);
      form.setFieldsValue({ companyId: clientId });
    } else if (!isEdit && fromRenewal?.companyId) {
      const clientId = String(fromRenewal.companyId);
      setSelectedCompanyId(clientId);
      form.setFieldsValue({ companyId: clientId });
    }
  }, [isEdit, fromClient, fromRenewal, form]);

  // Handle pre-selecting invoice and item for renewal
  useEffect(() => {
    if (!isEdit && fromRenewal?.invoiceId && invoices.length > 0) {
      const invoice = invoices.find(
        (inv) => String(inv._id) === String(fromRenewal.invoiceId),
      );
      if (invoice) {
        setSelectedInvoiceId(invoice._id);
        setInvoiceDetails(invoice);
        form.setFieldsValue({ invoiceId: invoice._id });

        if (fromRenewal.invoiceItemId !== undefined) {
          const itemIndex = parseInt(fromRenewal.invoiceItemId);
          setSelectedInvoiceItemIndex(itemIndex);
          form.setFieldsValue({ invoiceItemId: itemIndex });

          // Trigger the logic to set dates and name
          if (invoice.items && invoice.items[itemIndex]) {
            handleInvoiceItemChange(itemIndex);
          }
        }
      }
    }
  }, [invoices, fromRenewal, isEdit]);

  useEffect(() => {
    if (isEdit && project && companies.length > 0) {
      // Use clientId first (ClientCompany), fallback to companyId for backward compatibility
      // Convert to string to ensure proper matching with dropdown options
      const clientCompanyId =
        project.clientId?._id ||
        project.clientId ||
        project.companyId?._id ||
        project.companyId;
      const clientCompanyIdStr = clientCompanyId
        ? String(clientCompanyId)
        : null;

      // Verify the company exists in the companies list
      const companyExists = companies.some(
        (c) => String(c._id) === clientCompanyIdStr,
      );
      if (!companyExists && clientCompanyIdStr) {
        console.warn(
          "Client company not found in companies list:",
          clientCompanyIdStr,
          "Available companies:",
          companies.map((c) => String(c._id)),
        );
      }

      form.setFieldsValue({
        name: project.name,
        description: project.description,
        companyId: clientCompanyIdStr, // Use clientId (ClientCompany), not companyId (tenant)
        status: project.status,
        startDate: project.startDate ? dayjs(project.startDate) : null,
        endDate: project.endDate ? dayjs(project.endDate) : null,
        renewalDate: project.renewalDate ? dayjs(project.renewalDate) : null,
        isActive: project.isActive !== false, // Default to true if not set
        color: project.color || null,
        numberOfPosters: project.numberOfPosters || 0,
        numberOfVideos: project.numberOfVideos || 0,
        numberOfShoots: project.numberOfShoots || 0,
        remainingPosters: project.remainingPosters || 0,
        remainingVideos: project.remainingVideos || 0,
        remainingShoots: project.remainingShoots || 0,
        selectedCategories: (project.selectedCategories || []).map((cat) => ({
          ...cat,
          name: cat.name || cat.categoryName,
          categoryName: cat.categoryName || cat.name,
        })),
      });
      // In edit mode, we don't allow changing invoice
    }
  }, [isEdit, project, form, companies]);

  // When company changes, reset invoice selection
  const handleCompanyChange = (companyId) => {
    setSelectedCompanyId(companyId);
    setSelectedInvoiceId(null);
    setSelectedInvoiceItemIndex(null);
    setInvoiceDetails(null);
    form.setFieldsValue({ invoiceId: undefined, invoiceItemId: undefined });
  };

  // When invoice changes, load invoice details
  const handleInvoiceChange = (invoiceId) => {
    setSelectedInvoiceId(invoiceId);
    setSelectedInvoiceItemIndex(null);
    setInvoiceDetails(null);
    form.setFieldsValue({ invoiceItemId: undefined, name: undefined });

    const invoice = invoices.find((inv) => inv._id === invoiceId);
    if (invoice) {
      setInvoiceDetails(invoice);
    }
  };

  // Helper function to get package name from service
  const getPackageName = (service) => {
    if (!service || typeof service !== "object") return null;

    const itemName = service.name;
    if (
      itemName === "Digital Marketing" &&
      service.digitalMarketingPackages?.length > 0
    ) {
      const pkg = service.digitalMarketingPackages[0];
      return typeof pkg === "string" ? pkg : pkg?.packageName || pkg;
    }
    if (itemName === "SEO" && service.seoPackages?.length > 0) {
      const pkg = service.seoPackages[0];
      return typeof pkg === "string" ? pkg : pkg?.packageName || pkg;
    }
    if (itemName === "Website" && service.websitePackages?.length > 0) {
      const pkg = service.websitePackages[0];
      return typeof pkg === "string" ? pkg : pkg?.packageName || pkg;
    }
    if (itemName === "Designing" && service.designingPackages?.length > 0) {
      const pkg = service.designingPackages[0];
      return typeof pkg === "string" ? pkg : pkg?.packageName || pkg;
    }
    if (itemName === "Campaign" && service.campaignPackages?.length > 0) {
      const pkg = service.campaignPackages[0];
      return typeof pkg === "string" ? pkg : pkg?.packageName || pkg;
    }
    return null;
  };

  // When invoice item changes, update form
  const handleInvoiceItemChange = (itemIndex) => {
    setSelectedInvoiceItemIndex(itemIndex);
    if (
      invoiceDetails &&
      invoiceDetails.proposalId?.masterItems &&
      invoiceDetails.proposalId?.masterItems[itemIndex]
    ) {
      const item = invoiceDetails.proposalId.masterItems[itemIndex];

      // Auto-populate project name from item with package name if available
      let serviceName = item.name || item.description || "Unnamed Project";

      // Add package name to project name if available
      const packageName = getPackageName(item);
      if (packageName) {
        serviceName = `${serviceName} - ${packageName}`;
      }

      const handlingDuration = item.handlingDuration || "";
      const { amount, unit } = parseHandlingDuration(handlingDuration);
      let startDate = dayjs();
      let endDate = amount > 0 ? startDate.add(amount, unit) : startDate;

      if (item.startDate && item.endDate) {
        startDate = dayjs(item.startDate);
        endDate = dayjs(item.endDate);
      }

      const renewalDate = endDate.add(1, "day");

      form.setFieldsValue({
        startDate: startDate,
        endDate: endDate,
        renewalDate: renewalDate,
      });
    }
  };

  const onFinish = async (values) => {
    try {
      if (isEdit) {
        // For edit, only allow updating certain fields
        const projectData = {
          name: values.name,
          description: values.description,
          status: values.status || "created",
          startDate: values.startDate ? values.startDate.toISOString() : null,
          endDate: values.endDate ? values.endDate.toISOString() : null,
          renewalDate: values.renewalDate
            ? values.renewalDate.toISOString()
            : null,
          isActive: values.isActive !== false, // Handle Switch component (checked = true, unchecked = false)
          numberOfPosters: values.numberOfPosters || 0,
          numberOfVideos: values.numberOfVideos || 0,
          numberOfShoots: values.numberOfShoots || 0,
          remainingPosters: values.remainingPosters || 0,
          remainingVideos: values.remainingVideos || 0,
          remainingShoots: values.remainingShoots || 0,
          selectedCategories: (values.selectedCategories || []).map((cat) => {
            const catName = cat.name || cat.categoryName;
            return {
              ...cat,
              name: catName,
              categoryName: catName,
              // If remaining is not provided (e.g. newly added manual category),
              // default it to the total quantity
              remaining:
                cat.remaining !== undefined && cat.remaining !== null
                  ? cat.remaining
                  : cat.quantity || 0,
            };
          }),
        };
        const result = await updateProject({ id, ...projectData });
        if (result.error) throw result.error;
        message.success("Project updated successfully");
      } else {
        // For create, require invoice
        if (
          !values.invoiceId ||
          values.invoiceItemId === undefined ||
          values.invoiceItemId === null
        ) {
          message.error("Please select an invoice and invoice item");
          return;
        }

        const getCategoryCount = (nameKeywords) => {
          if (!selectedInvoiceItem.categories) return 0;
          return selectedInvoiceItem.categories
            .filter(c => nameKeywords.some(keyword => (c.name || c.categoryName || '').toLowerCase().includes(keyword.toLowerCase())))
            .reduce((sum, cat) => sum + (cat.count || cat.quantity || 0), 0);
        };

        const projectData = {
          name: values.name, // Include the project name from the form
          invoiceId: values.invoiceId,
          invoiceItemId: parseInt(values.invoiceItemId),
          description: values.description || "",
          status: "created",
          startDate: values.startDate ? values.startDate.toISOString() : null,
          endDate: values.endDate ? values.endDate.toISOString() : null,
          renewalDate: values.renewalDate
            ? values.renewalDate.toISOString()
            : null,
          numberOfPosters: selectedInvoiceItem.numberOfPosters || getCategoryCount(["poster", "posters"]),
          numberOfVideos: selectedInvoiceItem.numberOfVideos || getCategoryCount(["video", "videos"]),
          numberOfShoots: selectedInvoiceItem.numberOfShoots || getCategoryCount(["shoot", "shoots"]),
          remainingPosters: selectedInvoiceItem.numberOfPosters || getCategoryCount(["poster", "posters"]),
          remainingVideos: selectedInvoiceItem.numberOfVideos || getCategoryCount(["video", "videos"]),
          remainingShoots: selectedInvoiceItem.numberOfShoots || getCategoryCount(["shoot", "shoots"]),
          selectedCategories: (
            selectedInvoiceItem.selectedCategories || selectedInvoiceItem.categories || []
          ).map((cat, idx) => {
            let catName = cat.name || cat.categoryName;

            // Resolve name from master item if missing
            const master = selectedInvoiceItem;

            if (!catName && master?.selectedCategories?.[idx]) {
              catName =
                master.selectedCategories[idx].name ||
                master.selectedCategories[idx].categoryName;
            } else if (!catName && master?.categories?.[idx]) {
              catName = master.categories[idx].name || master.categories[idx].categoryName;
            }

            // Type fallback
            if (!catName && cat.type) {
              catName = cat.type.charAt(0).toUpperCase() + cat.type.slice(1);
            }

            // quantity comes from cat.quantity (selectedCategories format) OR cat.count (categories format)
            const quantity = cat.quantity !== undefined ? cat.quantity : (cat.count || 0);
            // remaining: use existing remaining if present, otherwise default to full quantity
            const remaining = cat.remaining !== undefined ? cat.remaining : quantity;

            return {
              ...cat,
              name: catName || `Item ${idx + 1}`,
              categoryName: catName || `Item ${idx + 1}`,
              quantity,
              remaining,
              completed: cat.completed || 0,
            };
          }),
          // Explicitly exclude companyId - it will be derived from the invoice
          // Departments removed - tasks will be manually assigned
        };

        try {
          const result = await createProject(projectData);
          if (result.error) throw result.error;
          console.log("Project created successfully:", result);
          message.success("Project created successfully from invoice");
          // Manually refetch projects list to ensure it's updated
          try {
            await refetchProjects();
          } catch (refetchError) {
            console.warn("Failed to refetch projects list:", refetchError);
            // Continue anyway - cache invalidation should handle it
          }
          navigate(`${getBaseRoute()}/projects`);
        } catch (createError) {
          console.error("Error creating project:", createError);
          throw createError; // Re-throw to be caught by outer catch
        }
      }
    } catch (error) {
      message.error(error?.data?.message || "Operation failed");
    }
  };

  if (isEdit && isLoadingProject) {
    return (
      <Spin
        size="large"
        style={{ display: "flex", justifyContent: "center", marginTop: "50px" }}
      />
    );
  }

  // Get selected invoice item details for display
  const selectedInvoiceItem =
    invoiceDetails && selectedInvoiceItemIndex !== null
      ? invoiceDetails.proposalId?.masterItems[selectedInvoiceItemIndex]
      : null;

  console.log(
    "Rendering ProjectForm, selectedInvoiceItem:",
    selectedInvoiceItem,
  );

  // Calculate dates for display
  let startDate = null;
  let endDate = null;
  let renewalDate = null;
  let billingType = null;

  if (selectedInvoiceItem) {
    billingType = selectedInvoiceItem.billingType;
    const item = selectedInvoiceItem;
    const handlingDuration = item.handlingDuration || "";
    const { amount, unit } = parseHandlingDuration(handlingDuration);
    startDate = dayjs();
    endDate = amount > 0 ? startDate.add(amount, unit) : startDate;

    if (item.startDate && item.endDate) {
      startDate = dayjs(item.startDate);
      endDate = dayjs(item.endDate);
    }

    renewalDate = endDate.add(1, "day");
  }

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
          onClick={() => navigate(`${getBaseRoute()}/projects`)}
        >
          Back
        </Button>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>
          {isEdit ? "Edit Project" : "Create Project from Invoice"}
        </h1>
      </div>
      <Card>
        {(selectedCompany?.status === "inactive" ||
          selectedCompany?.status === "closed") && (
          <Alert
            message={`This client is ${selectedCompany.status}. Please create a new one or change the existing client.`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        {!isEdit && (
          <Alert
            message="Invoice Required"
            description="Please select a client and then choose an invoice."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
          initialValues={{
            status: "created",
            isActive: true, // Default to active for new projects
            startDate: dayjs(), // Default start date to today
          }}
        >
          <Form.Item
            label="Client"
            name="companyId"
            rules={[{ required: true, message: "Please select a client" }]}
          >
            <Select
              placeholder="Select client"
              loading={isLoadingCompanies}
              showSearch
              disabled={isEdit}
              onChange={handleCompanyChange}
              filterOption={(input, option) =>
                (option?.children ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {companies
                .filter(
                  (company) =>
                    (company.status !== "inactive" &&
                      company.status !== "closed") ||
                    String(company._id) === String(watchedCompanyId),
                )
                .map((company) => (
                  <Option key={String(company._id)} value={String(company._id)}>
                    {company.status === "inactive"
                      ? `${company.name} (Inactive)`
                      : company.status === "closed"
                        ? `${company.name} (Closed)`
                        : company.name}
                  </Option>
                ))}
            </Select>
          </Form.Item>

          {!isEdit && selectedCompanyId && (
            <>
              {isLoadingInvoices ? (
                <Spin />
              ) : invoicesError ? (
                <Alert
                  message="Error Loading Invoices"
                  description={`Failed to load invoices: ${invoicesError?.data?.message || invoicesError?.message || "Unknown error"}`}
                  type="error"
                  showIcon
                  style={{ marginBottom: 24 }}
                />
              ) : validInvoices.length === 0 ? (
                <Alert
                  message="No Valid Invoices"
                  description={
                    invoices.length === 0
                      ? `No invoices found for this client. Please create an invoice first.`
                      : `Found ${invoices.length} invoice(s) for this client, but none have a valid status for project creation. ` +
                        `Only invoices with status 'Draft', 'Sent', 'Pending', or 'Paid' can generate projects. ` +
                        `Current invoice statuses: ${[...new Set(invoices.map((inv) => inv.invoiceStatus))].join(", ")}`
                  }
                  type="warning"
                  showIcon
                  style={{ marginBottom: 24 }}
                />
              ) : (
                <>
                  <Form.Item
                    label="Invoice"
                    name="invoiceId"
                    rules={[
                      { required: true, message: "Please select an invoice" },
                    ]}
                  >
                    <Select
                      placeholder="Select invoice"
                      onChange={handleInvoiceChange}
                      showSearch
                      filterOption={(input, option) =>
                        (option?.children ?? "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    >
                      {validInvoices.map((invoice) => (
                        <Option key={invoice._id} value={invoice._id}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>
                              {invoice.invoiceNumber || "No Number"} - ₹
                              {invoice.grandTotal?.toLocaleString() || "0"}
                            </span>
                            <Tag
                              color={
                                invoice.invoiceStatus === "Paid"
                                  ? "green"
                                  : invoice.invoiceStatus === "Sent"
                                    ? "blue"
                                    : "default"
                              }
                            >
                              {invoice.invoiceStatus?.toUpperCase()}
                            </Tag>
                          </div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>

                  {invoiceDetails && (
                    <>
                      <Form.Item
                        label="Invoice Item"
                        name="invoiceItemId"
                        rules={[
                          {
                            required: true,
                            message: "Please select an invoice item",
                          },
                        ]}
                      >
                        <Select
                          placeholder="Select invoice item"
                          onChange={handleInvoiceItemChange}
                        >
                          {(invoiceDetails.proposalId?.masterItems || []).map((item, index) => {
                            const itemName = item.name || item.description || "Unknown Item";
                            return (
                              <Option key={item._id || index} value={index}>
                                {itemName} - ₹{item.price?.toLocaleString()}
                              </Option>
                            );
                          })}
                        </Select>
                      </Form.Item>

                      {selectedInvoiceItem && (
                        <>
                          <Card
                            type="inner"
                            title="Invoice Item Details (Read-Only)"
                            style={{
                              marginBottom: 24,
                              backgroundColor: isDark
                                ? "hsl(var(--muted))"
                                : "#fafafa",
                            }}
                          >
                            <Descriptions column={2} bordered size="small">
                              <Descriptions.Item
                                label="Service/Master Item"
                                span={2}
                              >
                                {selectedInvoiceItem.name || selectedInvoiceItem.description || "N/A"}
                              </Descriptions.Item>
                              <Descriptions.Item label="Description" span={2}>
                                {selectedInvoiceItem.description || "N/A"}
                              </Descriptions.Item>
                              {selectedInvoiceItem.categories && selectedInvoiceItem.categories.length > 0 ? (
                                selectedInvoiceItem.categories.map((cat, i) => {
                                  const rawName = cat.name || cat.categoryName || "";
                                  const singularName = rawName.toLowerCase().endsWith('s') ? rawName.slice(0, -1) : rawName;
                                  const formattedName = singularName ? `Number of ${singularName.charAt(0).toUpperCase() + singularName.slice(1)}s` : "Unknown Item";
                                  
                                  return (
                                    <Descriptions.Item key={i} label={formattedName} span={2}>
                                      {cat.count || cat.quantity || 0}
                                    </Descriptions.Item>
                                  );
                                })
                              ) : (
                                <Descriptions.Item label="Categories" span={2}>
                                  No categories
                                </Descriptions.Item>
                              )}
                              <Descriptions.Item label="Price" span={2}>
                                <strong
                                  style={{ fontSize: "16px", color: "var(--accent-primary)" }}
                                >
                                  ₹
                                  {(
                                    selectedInvoiceItem.price || 0
                                  ).toLocaleString("en-IN")}
                                </strong>
                              </Descriptions.Item>
                              <Descriptions.Item
                                label="Invoice Number"
                                span={2}
                              >
                                {invoiceDetails.invoiceNumber || "Draft"}
                              </Descriptions.Item>
                              <Descriptions.Item label="Invoice Type">
                                <Tag
                                  color={
                                    invoiceDetails.type === "proforma"
                                      ? "orange"
                                      : "green"
                                  }
                                >
                                  {invoiceDetails.type === "proforma"
                                    ? "Proforma"
                                    : "Final Tax Invoice"}
                                </Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="Invoice Status">
                                <Tag
                                  color={
                                    invoiceDetails.invoiceStatus === "Paid"
                                      ? "green"
                                      : invoiceDetails.invoiceStatus === "Sent"
                                        ? "blue"
                                        : invoiceDetails.invoiceStatus === "Overdue"
                                          ? "red"
                                          : "default"
                                  }
                                >
                                  {invoiceDetails.invoiceStatus?.toUpperCase()}
                                </Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="Invoice Date">
                                {dayjs(
                                  invoiceDetails.createdAt ||
                                    invoiceDetails.invoiceDate,
                                ).format("DD/MM/YYYY")}
                              </Descriptions.Item>
                              <Descriptions.Item label="Due Date">
                                {invoiceDetails.dueDate
                                  ? dayjs(invoiceDetails.dueDate).format(
                                      "DD/MM/YYYY",
                                    )
                                  : "N/A"}
                              </Descriptions.Item>
                              {selectedInvoiceItem.billingType ===
                                "subscription" && (
                                <>
                                  <Descriptions.Item label="Subscription Start Date">
                                    {selectedInvoiceItem.subscriptionStartDate
                                      ? dayjs(
                                          selectedInvoiceItem.subscriptionStartDate,
                                        ).format("DD/MM/YYYY")
                                      : "N/A"}
                                  </Descriptions.Item>
                                  <Descriptions.Item label="Subscription End Date">
                                    {selectedInvoiceItem.subscriptionEndDate
                                      ? dayjs(
                                          selectedInvoiceItem.subscriptionEndDate,
                                        ).format("DD/MM/YYYY")
                                      : "N/A"}
                                  </Descriptions.Item>
                                </>
                              )}
                              <Descriptions.Item label="Project Start Date">
                                {startDate
                                  ? startDate.format("DD/MM/YYYY")
                                  : "N/A"}
                              </Descriptions.Item>
                              <Descriptions.Item label="Project End Date">
                                {endDate ? endDate.format("DD/MM/YYYY") : "N/A"}
                              </Descriptions.Item>
                              <Descriptions.Item label="Renewal Date">
                                {renewalDate
                                  ? renewalDate.format("DD/MM/YYYY")
                                  : "N/A"}
                              </Descriptions.Item>
                            </Descriptions>
                            <MasterItemDetailsCard
                              service={selectedInvoiceItem}
                              packageName={getPackageName(selectedInvoiceItem)}
                              isDark={isDark}
                              selectedCategories={selectedInvoiceItem.selectedCategories || selectedInvoiceItem.categories}
                              overriddenHandlingAmount={selectedInvoiceItem.handlingAmount}
                              overriddenCampaignAmount={selectedInvoiceItem.campaignAmount}
                              overriddenBasePrice={selectedInvoiceItem.price || selectedInvoiceItem.rate}
                            />
                          </Card>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          <Form.Item
            label="Project Name"
            name="name"
            rules={[{ required: true, message: "Please enter project name" }]}
            tooltip="Enter a unique name for this project."
          >
            <Input placeholder="Enter project name" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <TextArea rows={4} placeholder="Enter project description" />
          </Form.Item>

          {isEdit && (
            <Form.Item label="Status" name="status">
              <Select
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.children ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                <Option value="created">Created</Option>
                <Option value="workflow_sent">Workflow Sent</Option>
                <Option value="workflow_approved">Workflow Approved</Option>
                <Option value="in_progress">In Progress</Option>
                <Option value="on_hold">On Hold</Option>
                <Option value="completed">Completed</Option>
                <Option value="cancelled">Cancelled</Option>
              </Select>
            </Form.Item>
          )}

          {isEdit && (
            <>
              <Form.Item
                label="Active Status"
                name="isActive"
                valuePropName="checked"
                tooltip="Active projects are visible in task creation dropdown. Inactive projects are hidden from task creation."
              >
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>

              <Form.Item
                label="Project Color"
                name="color"
                tooltip="Choose a color to identify this project in Kanban board and task views"
              >
                <ColorPicker
                  showText
                  format="hex"
                  presets={[
                    {
                      label: "Recommended Colors",
                      colors: [
                        "var(--accent-primary)",
                        "#52c41a",
                        "#faad14",
                        "#f5222d",
                        "#722ed1",
                        "#13c2c2",
                        "#eb2f96",
                        "#fa8c16",
                        "#2f54eb",
                        "#a0d911",
                      ],
                    },
                  ]}
                />
              </Form.Item>



              <Divider>Other Dynamic Deliverables</Divider>
              <Form.List name="selectedCategories">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Row
                        key={key}
                        gutter={16}
                        align="middle"
                        style={{ marginBottom: 16 }}
                      >
                        <Col span={10}>
                          <Form.Item
                            {...restField}
                            name={[name, "name"]}
                            rules={[
                              { required: true, message: "Name is required" },
                            ]}
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="Category Name" />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item
                            {...restField}
                            name={[name, "quantity"]}
                            label="Total"
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber
                              placeholder="Total"
                              min={0}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item
                            {...restField}
                            name={[name, "remaining"]}
                            label="Remaining"
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber
                              placeholder="Remaining"
                              min={0}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={2}>
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          />
                        </Col>
                      </Row>
                    ))}
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        block
                        icon={<PlusOutlined />}
                      >
                        Add Custom Deliverable
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </>
          )}

          <Form.Item
            label="Project Start Date"
            name="startDate"
            rules={[
              { required: true, message: "Please select project start date" },
            ]}
            tooltip={
              isEdit
                ? "Update the start date for this project"
                : "Set the start date for this project. Tasks will be created based on this date."
            }
          >
            <DatePicker
              style={{ width: "100%" }}
              placeholder="Select start date"
              onChange={(date) => {
                if (date && selectedInvoiceItem) {
                  const handlingDuration = selectedInvoiceItem.handlingDuration || "";
                  const { amount, unit } = parseHandlingDuration(handlingDuration);
                  if (amount > 0) {
                    const newEndDate = date.add(amount, unit);
                    const newRenewalDate = newEndDate.add(1, "day");
                    form.setFieldsValue({
                      endDate: newEndDate,
                      renewalDate: newRenewalDate,
                    });
                  } else {
                    const newRenewalDate = date.add(1, "day");
                    form.setFieldsValue({
                      endDate: date,
                      renewalDate: newRenewalDate,
                    });
                  }
                }
              }}
            />
          </Form.Item>

          <Form.Item
            label="Project End Date"
            name="endDate"
            rules={[
              { required: true, message: "Please select project end date" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const startDate = getFieldValue("startDate");
                  if (
                    !value ||
                    !startDate ||
                    dayjs(value).isAfter(dayjs(startDate)) ||
                    dayjs(value).isSame(dayjs(startDate), "day")
                  ) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error("End date must be on or after start date"),
                  );
                },
              }),
            ]}
            tooltip={
              isEdit
                ? "Update the end date for this project"
                : "Set the end date for this project. Tasks will be scheduled within this date range."
            }
          >
            <DatePicker
              style={{ width: "100%" }}
              placeholder="Select end date"
              onChange={(date) => {
                if (date) {
                  form.setFieldsValue({
                    renewalDate: date.add(1, "day"),
                  });
                }
              }}
            />
          </Form.Item>

          <Form.Item
            label="Renewal Date"
            name="renewalDate"
            tooltip="Auto-calculated as next day after project end date"
          >
            <DatePicker
              style={{ width: "100%" }}
              placeholder="Select renewal date"
            />
          </Form.Item>

          <Form.Item>
            <div className="responsive-button-group">
              <Button
                type="primary"
                htmlType="submit"
                loading={isCreating || isUpdating}
                disabled={
                  !isEdit &&
                  (!selectedInvoiceId || selectedInvoiceItemIndex === null)
                }
                block
                className="responsive-button-primary"
              >
                {isEdit ? "Update Project" : "Create Project from Invoice"}
              </Button>
              <Button
                onClick={() => navigate(`${getBaseRoute()}/projects`)}
                block
                className="responsive-button-secondary"
              >
                Cancel
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ProjectForm;
