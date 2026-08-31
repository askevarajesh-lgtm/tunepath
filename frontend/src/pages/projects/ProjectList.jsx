import React, { useState, useMemo, useEffect } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  message,
  Card,
  Spin,
  Popconfirm,
  Typography,
  Select,
  Row,
  Col,
  Statistic,
  Tooltip,
  Modal,
  List,
} from "antd";
import Icon, {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  FilterOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  CameraOutlined,
  SyncOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import {
  useGetProjectsQuery,
  useGetProjectListSummaryStatsQuery,
  useLazyGetProjectReportQuery,
  useGetUnassignedDeliverablesSummaryQuery,
  useDeleteProjectMutation,
  useBulkDeleteProjectsMutation,
} from "../../api/projectApi";
import { useGetCompaniesDropdownQuery } from "../../api/companyApi";
import useBulkSelection from "../../hooks/useBulkSelection";
import BulkActionBar from "../../components/common/BulkActionBar";
import DebouncedSearchInput from "../../components/common/DebouncedSearchInput";
import usePagination from "../../hooks/usePagination";
import { useActionPermissions } from "../../hooks/useActionPermissions";
import { MASTER_ITEM_NAME_OPTIONS } from "../../constants/masterItemNames";
import dayjs from "dayjs";
import { downloadProjectReportExcel } from "../../utils/projectReportExport";
import "./ProjectList.css";

const { Title } = Typography;

const ProjectList = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getBaseRoute = () => {
    if (location.pathname.startsWith("/client")) return "/client/workspace";
    if (location.pathname.startsWith("/agency")) return "/agency";
    if (location.pathname.startsWith("/user")) return "/user/workspace";
    return "/workspace";
  };

  const selectedClientId = null;
  const [filters, setFilters] = useState({
    status: undefined,
    companyId: undefined,
    itemName: undefined,
  });
  const [insightModal, setInsightModal] = useState({
    open: false,
    title: "",
    rows: [],
    tagColor: "default",
    showPendingCount: false,
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
      ...(selectedClientId
        ? { companyId: selectedClientId }
        : filters.companyId && { companyId: filters.companyId }),
      ...(filters.itemName && { itemName: filters.itemName }),
    }),
    [queryParams, filters, selectedClientId],
  );

  const summaryStatsParams = useMemo(
    () => ({
      ...(filters.status && { status: filters.status }),
      ...(selectedClientId
        ? { companyId: selectedClientId }
        : filters.companyId && { companyId: filters.companyId }),
      ...(filters.itemName && { itemName: filters.itemName }),
      ...(queryParams.search && { search: queryParams.search }),
    }),
    [
      filters.status,
      filters.companyId,
      filters.itemName,
      queryParams.search,
      selectedClientId,
    ],
  );

  const { data, isLoading, error, refetch } = useGetProjectsQuery(
    queryParamsWithFilters,
  );
  const [getProjectReport, { isFetching: isExporting }] =
    useLazyGetProjectReportQuery();
  const { data: summaryStatsResponse, isLoading: isSummaryLoading } =
    useGetProjectListSummaryStatsQuery(summaryStatsParams);
  const { data: deliverablesSummaryResponse } =
    useGetUnassignedDeliverablesSummaryQuery(summaryStatsParams);
  const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation();
  const [bulkDeleteProjects, { isLoading: isBulkDeleting }] =
    useBulkDeleteProjectsMutation();
  const {
    canAdd: canCreate,
    canEdit,
    canDelete,
    canView,
  } = useActionPermissions("/projects");
  const { data: clientsData } = useGetCompaniesDropdownQuery({});
  const clients = clientsData?.data?.data || clientsData?.data?.companies || [];

  // Handle paginated response
  const paginationData = data?.data?.pagination;
  const projects = data?.data?.data || data?.data?.projects || [];
  
  const totalRef = React.useRef(0);
  if (paginationData?.total !== undefined) {
    totalRef.current = paginationData.total;
  }
  const total = paginationData?.total || projects.length || totalRef.current;

  // Use standard bulk selection hook
  const { rowSelection, handleClearSelection, selectionCount } =
    useBulkSelection(projects);

  const getStatusColor = (status) => {
    const colors = {
      created: "default",
      workflow_sent: "processing",
      workflow_revision_requested: "warning",
      workflow_approved: "success",
      in_progress: "processing",
      sent_for_client_review: "processing",
      approved: "success",
      on_hold: "warning",
      completed: "success",
      cancelled: "error",
      project_near_due_date: "warning",
    };
    return colors[status] || "default";
  };

  const handleDelete = async (id) => {
    try {
      await deleteProject(id).unwrap();
      message.success("Project deleted successfully");
      refetch();
    } catch (error) {
      message.error(error?.data?.message || "Failed to delete project");
    }
  };

  const handleBulkDelete = async () => {
    try {
      const { selectedRowKeys } = rowSelection;
      if (selectedRowKeys.length === 0) return;

      await bulkDeleteProjects(selectedRowKeys).unwrap();
      message.success(
        `${selectedRowKeys.length} projects deleted successfully`,
      );
      handleClearSelection();
      refetch();
    } catch (error) {
      message.error(
        error?.data?.message || "Failed to delete projects in bulk",
      );
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      status: undefined,
      companyId: undefined,
      itemName: undefined,
    });
  };

  const hasActiveFilters =
    filters.status || filters.companyId || filters.itemName;

  const exportQueryParams = useMemo(
    () => ({
      ...(queryParams.search ? { search: queryParams.search } : {}),
      ...(filters.status && { status: filters.status }),
      ...(selectedClientId
        ? { companyId: selectedClientId }
        : filters.companyId && { companyId: filters.companyId }),
      ...(filters.itemName && { itemName: filters.itemName }),
    }),
    [queryParams.search, filters.status, filters.companyId, filters.itemName, selectedClientId],
  );

  const reportFilterRows = useMemo(() => {
    const activeCompanyId = selectedClientId || filters.companyId;
    const activeClient = clients.find(
      (client) => String(client._id) === String(activeCompanyId),
    );
    const statusLabel = filters.status
      ? String(filters.status).replace(/_/g, " ").toUpperCase()
      : "All Statuses";
    return [
      ["Status Filter", statusLabel],
      [
        "Client Filter",
        activeClient?.name || (activeCompanyId ? "Selected Client" : "All Clients"),
      ],
      ["Item Filter", filters.itemName || "All Items"],
      ["Search", queryParams.search || "None"],
    ];
  }, [clients, filters.companyId, filters.itemName, filters.status, queryParams.search, selectedClientId]);

  const handleExportReport = async () => {
    try {
      const response = await getProjectReport(exportQueryParams).unwrap();
      downloadProjectReportExcel(response?.data?.report, {
        filterRows: reportFilterRows,
        fileNamePrefix:
          (selectedClientId || filters.status || filters.companyId || filters.itemName || queryParams.search
            ? "filtered_project_report"
            : "project_report"),
      });
      message.success("Project report exported to Excel");
    } catch (error) {
      message.error(error?.data?.message || "Failed to export project report");
    }
  };

  const handleAction = (record, path) => {
    const status = record.clientId?.status;
    if (status === "inactive" || status === "closed") {
      Modal.warning({
        title: "Action Restricted",
        content: `This client is ${status}. Therefore, you cannot edit this record. Please go to the client section and Change to new or change to existing client Status.`,
      });
      return;
    }
    navigate(path);
  };

  const columns = [
    {
      title: "Project Name",
      dataIndex: "name",
      key: "name",
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: "Client Company",
      dataIndex: ["clientId", "name"],
      key: "clientCompanyName",
      render: (_, record) =>
        record.clientId?.name || record.companyId?.name || "N/A",
      className: "hide-on-mobile",
    },
    {
      title: "Invoice",
      dataIndex: ["invoiceId", "invoiceNumber"],
      key: "invoiceNumber",
      render: (_, record) => record.invoiceId?.invoiceNumber || "N/A",
      className: "hide-on-mobile",
    },
    {
      title: "Service Type",
      dataIndex: ["masterItemId", "name"],
      key: "serviceType",
      render: (_, record) => {
        const serviceName = record.masterItemId?.name || "N/A";
        const packageName = record.packageName || "";
        const displayName = packageName
          ? `${serviceName} (${packageName})`
          : serviceName;

        const colorMap = {
          "Digital Marketing": "purple",
          SEO: "green",
          Website: "blue",
          Designing: "orange",
        };
        return (
          <Tag color={colorMap[serviceName] || "default"}>{displayName}</Tag>
        );
      },
      className: "hide-on-mobile",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status, record) => {
        let displayStatus = status ? status.replace(/_/g, " ").toUpperCase() : "CREATED";
        
        let totalDeliverables = (record.numberOfPosters || 0) + (record.numberOfVideos || 0) + (record.numberOfShoots || 0);
        let completedDeliverables = (record.completedPosters || 0) + (record.completedVideos || 0) + (record.completedShoots || 0);

        if (record.selectedCategories && Array.isArray(record.selectedCategories)) {
          record.selectedCategories.forEach(cat => {
            const rawName = cat.name || cat.categoryName || "";
            const isStandard = ["poster", "video", "shoot"].some(k => rawName.toLowerCase().includes(k));
            if (!isStandard) {
              const qty = cat.quantity || 0;
              const completed = cat.completed || 0;
              totalDeliverables += qty;
              completedDeliverables += completed;
            }
          });
        }
        
        let completionPercentage = 0;
        let showPercentage = false;
        
        if (totalDeliverables > 0) {
          completionPercentage = Math.round((completedDeliverables / totalDeliverables) * 100);
          showPercentage = true;
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
            <Tag color={getStatusColor(status)}>
              {displayStatus}
            </Tag>
            {showPercentage && (
              <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>
                {completionPercentage}% Complete
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: "Start Date",
      dataIndex: "startDate",
      key: "startDate",
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY") : "N/A"),
      className: "hide-on-mobile",
    },
    {
      title: "End Date",
      dataIndex: "endDate",
      key: "endDate",
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY") : "N/A"),
      className: "hide-on-mobile",
    },
    {
      title: "Renewal Date",
      key: "renewalDate",
      render: (_, record) => {
        if (record.renewalDate) {
          const rDate = dayjs(record.renewalDate);
          if (rDate.isValid()) {
            const isExpired = rDate.isBefore(dayjs().startOf("day"));
            return (
              <span style={isExpired ? { color: "#dc2626", fontWeight: 600 } : {}}>
                {rDate.format("DD/MM/YYYY")}
              </span>
            );
          }
        }

        // Fallback for older records
        const isDigitalMarketing =
          (record.masterItemId?.name || "").toLowerCase() ===
          "digital marketing";
        if (!isDigitalMarketing) return "N/A";
        if (!record.endDate) return "N/A";

        // Next cycle for digital marketing starts immediately after end date.
        const renewalDate = dayjs(record.endDate).add(1, "day");
        if (!renewalDate.isValid()) return "N/A";

        const isExpired = renewalDate.isBefore(dayjs().startOf("day"));
        return (
          <span style={isExpired ? { color: "#dc2626", fontWeight: 600 } : {}}>
            {renewalDate.format("DD/MM/YYYY")}
          </span>
        );
      },
      className: "hide-on-mobile",
    },
    {
      title: "Created By",
      dataIndex: "createdBy",
      key: "createdBy",
      render: (user) => (user?.name || "Unknown"),
    },
    {
      title: "Actions",
      key: "actions",
      align: "center",
      fixed: window.innerWidth <= 768 ? false : "right",
      width: 200,
      render: (_, record) => (
        <Space className="table-actions">
          {canView && (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() =>
                handleAction(record, `${getBaseRoute()}/projects/${record._id}`)
              }
            >
              <span className="hide-on-mobile">View</span>
            </Button>
          )}
          {canEdit && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() =>
                handleAction(record, `${getBaseRoute()}/projects/${record._id}/edit`)
              }
            >
              <span className="hide-on-mobile">Edit</span>
            </Button>
          )}
          {canDelete && (
            <Popconfirm
              title="Delete Project"
              description="Are you sure you want to delete this project?"
              onConfirm={() => handleDelete(record._id)}
              okText="Delete"
              okType="danger"
              cancelText="Cancel"
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                loading={isDeleting}
              >
                <span className="hide-on-mobile">Delete</span>
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const summary = summaryStatsResponse?.data?.summary || {};
  const deliverablesSummary = deliverablesSummaryResponse?.data?.summary || {};
  const pendingPostersCount = summary.pendingPosters ?? 0;
  const pendingVideosCount = summary.pendingVideos ?? 0;
  const pendingShootsCount = summary.pendingShoots ?? 0;
  const pendingDynamicCount = summary.pendingDynamic ?? 0;
  const inProgressProjectsCount = summary.inProgressProjects ?? 0;

  const openInsightModal = (type) => {
    if (type === "posters") {
      setInsightModal({
        open: true,
        title: "Projects with Pending Posters",
        rows: deliverablesSummary.posterProjects || [],
        tagColor: "blue",
        showPendingCount: true,
      });
      return;
    }
    if (type === "videos") {
      setInsightModal({
        open: true,
        title: "Projects with Pending Videos",
        rows: deliverablesSummary.videoProjects || [],
        tagColor: "purple",
        showPendingCount: true,
      });
      return;
    }
    if (type === "shoots") {
      setInsightModal({
        open: true,
        title: "Projects with Pending Shoots",
        rows: deliverablesSummary.shootProjects || [],
        tagColor: "green",
        showPendingCount: true,
      });
      return;
    }
    if (type === "dynamic") {
      setInsightModal({
        open: true,
        title: "Projects with Pending Other Deliverables",
        rows: deliverablesSummary.dynamicProjects || [],
        tagColor: "red",
        showPendingCount: true,
        isDynamic: true,
      });
      return;
    }
    setInsightModal({
      open: true,
      title: "Projects In Progress",
      rows: deliverablesSummary.inProgressProjects || [],
      tagColor: "processing",
      showPendingCount: false,
    });
  };

  return (
    <div>
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Projects
        </Title>
        <Space>
          {canView && (
            <Button
              icon={<FileExcelOutlined />}
              onClick={handleExportReport}
              loading={isExporting}
            >
              Download Excel
            </Button>
          )}
          {canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate(`${getBaseRoute()}/projects/new`)}
            >
              Create Project
            </Button>
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
              <Select.Option value="created">Created</Select.Option>
              <Select.Option value="workflow_sent">Workflow Sent</Select.Option>
              <Select.Option value="workflow_approved">
                Workflow Approved
              </Select.Option>
              <Select.Option value="in_progress">In Progress</Select.Option>
              <Select.Option value="on_hold">On Hold</Select.Option>
              <Select.Option value="completed">Completed</Select.Option>
              <Select.Option value="project_near_due_date">Near Due Date</Select.Option>
              <Select.Option value="cancelled">Cancelled</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Filter by Client"
              allowClear
              showSearch
              style={{ width: "100%" }}
              value={filters.companyId}
              onChange={(value) => handleFilterChange("companyId", value)}
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={clients.map((client) => ({
                value: client._id,
                label: `${client.name}${client.email ? ` (${client.email})` : ""}`,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Filter by Item"
              allowClear
              showSearch
              style={{ width: "100%" }}
              value={filters.itemName}
              onChange={(value) => handleFilterChange("itemName", value)}
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={MASTER_ITEM_NAME_OPTIONS.map((name) => ({
                value: name,
                label: name,
              }))}
            />
          </Col>
          <Col xs={24} sm={24} md={6}>
            <DebouncedSearchInput
              placeholder="Search projects by name or description..."
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

      <BulkActionBar
        selectionCount={selectionCount}
        onClearSelection={handleClearSelection}
        onBulkDelete={handleBulkDelete}
        showDelete={canDelete}
        deleteText="Delete Projects"
      />

      <Card>
        <Spin spinning={isLoading || isDeleting}>
          <Table
            rowSelection={canDelete ? rowSelection : undefined}
            columns={columns}
            dataSource={projects}
            rowKey="_id"
            onRow={(record) => ({
              onClick: (e) => {
                if (
                  e.target.closest(
                    "button, a, [role='button'], .ant-input, .ant-select",
                  )
                )
                  return;
                if (canView) {
                  navigate(`${getBaseRoute()}/projects/${record._id}`);
                }
              },
              style: { cursor: canView ? "pointer" : "default" },
            })}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: total,
              showSizeChanger: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} projects`,
              pageSizeOptions: ["10", "20", "50", "100"],
            }}
            onChange={handleTableChange}
            scroll={{ x: "max-content" }}
            locale={{
              emptyText: isLoading ? "Loading projects..." : "No projects found.",
            }}
          />
        </Spin>
      </Card>

      <Modal
        title={insightModal.title}
        open={insightModal.open}
        onCancel={() => setInsightModal((prev) => ({ ...prev, open: false }))}
        footer={null}
        width={760}
        styles={{
          body: {
            maxHeight: "60vh",
            overflowY: "auto",
            paddingRight: 8,
          },
        }}
      >
        <List
          dataSource={insightModal.rows}
          locale={{ emptyText: `No records found for ${insightModal.title}.` }}
          renderItem={(row) => (
            <List.Item
              style={{ paddingInline: 0 }}
              actions={[
                insightModal.showPendingCount ? (
                  <Tag color={insightModal.tagColor}>
                    {row.pendingCount || 0} pending
                  </Tag>
                ) : (
                  <Tag color="processing">IN PROGRESS</Tag>
                ),
              ]}
            >
              <List.Item.Meta
                title={
                  <Button
                    type="link"
                    style={{ padding: 0, height: "auto" }}
                    onClick={() => navigate(`${getBaseRoute()}/projects/${row._id}`)}
                  >
                    {row.name}
                  </Button>
                }
                description={
                  <div>
                    <div>Client: {row.clientName || "N/A"}</div>
                    {insightModal.isDynamic && row.categories && (
                      <div style={{ marginTop: 4 }}>
                        {row.categories.map((cat, idx) => (
                          <Tag
                            key={idx}
                            color="blue"
                            style={{ marginBottom: 4 }}
                          >
                            {cat.categoryName || cat.name || "Category"}:{" "}
                            {cat.remaining} pending
                          </Tag>
                        ))}
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
};

export default ProjectList;
