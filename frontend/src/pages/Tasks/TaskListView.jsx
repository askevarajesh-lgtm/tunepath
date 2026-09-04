import { useAuth } from "../../contexts/AuthContext";
import React, { useState, useMemo, useEffect } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  Select,
  Input,
  message,
  DatePicker,
  Popconfirm,
  Dropdown,
  Modal,
} from "antd";
import {
  EditOutlined,
  EyeOutlined,
  DeleteOutlined,
  MoreOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useGetTasksQuery, useDeleteTaskMutation } from "../../api/taskApi";
import { notifyLoading, notifySuccess, notifyError } from '../../utils/notify';
import { useGetDepartmentsDynamicQuery } from "../../api/accessControlApi";
import { useGetProjectsDropdownQuery } from "../../api/projectApi";
import { useGetUsersDropdownQuery } from "../../api/userApi";
import { useActionPermissions } from "../../hooks/useActionPermissions";
import { PERMISSION_ACTIONS } from "../../utils/actionPermissions";
import dayjs from "dayjs";
import { isDurationTrackingTask, isCompletedTask } from "./taskDuration";
import TaskReopenModal from "./TaskReopenModal";

const { Option } = Select;
const { Search } = Input;

const TaskListView = ({ onTaskClick, departmentFilter, onTaskCompleted, clientId }) => {
  const navigate = useNavigate();
  const [deleteTask] = useDeleteTaskMutation();
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState(
    departmentFilter && departmentFilter !== "all"
      ? { department: departmentFilter }
      : {},
  );
  const [isReopenModalVisible, setIsReopenModalVisible] = useState(false);
  const [taskToReopen, setTaskToReopen] = useState(null);

  // Sync filters with departmentFilter prop change
  useEffect(() => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      // Reset status filter when department changes (avoid invalid status for department)
      delete newFilters.status;
      if (departmentFilter && departmentFilter !== "all") {
        newFilters.department = departmentFilter;
      } else {
        delete newFilters.department;
      }
      return newFilters;
    });
    setCurrentPage(1);
  }, [departmentFilter]);

  // Compute the status options based on the active department
  const statusOptions = useMemo(() => {
    const dept = departmentFilter && departmentFilter !== "all" ? departmentFilter : "all";
    const isShortFlow =
      dept === "seo" ||
      dept === "website_designing" ||
      dept === "website-designing" ||
      dept === "web-application-development" ||
      dept === "web_application_development";
    const isDM =
      dept === "digital-marketing" ||
      dept === "digital_marketing";

    if (isShortFlow) {
      return [
        { value: "backlog", label: "Hold" },
        { value: "to_do", label: "To Do" },
        { value: "in_progress", label: "In Progress" },
        { value: "complete", label: "Complete" },
      ];
    } else if (isDM) {
      return [
        { value: "backlog", label: "Hold" },
        { value: "to_do", label: "To Do" },
        { value: "in_progress", label: "In Progress" },
        { value: "review", label: "Review" },
        { value: "Rejected", label: "Rejected" },
        { value: "complete", label: "Approved" },
      ];
    } else {
      // "all" or unknown department: show full set (union of all statuses)
      return [
        { value: "backlog", label: "Hold" },
        { value: "to_do", label: "To Do" },
        { value: "in_progress", label: "In Progress" },
        { value: "review", label: "Review" },
        { value: "Rejected", label: "Rejected" },
        { value: "complete", label: "Complete / Approved" },
        // Legacy statuses that may still exist in DB
        { value: "created", label: "Created (Legacy)" },
        { value: "assigned", label: "Assigned (Legacy)" },
        { value: "submitted", label: "Submitted (Legacy)" },
        { value: "validated", label: "Validated (Legacy)" },
        { value: "completed", label: "Completed (Legacy)" },
        { value: "rejected", label: "Rejected (Legacy)" },
      ];
    }
  }, [departmentFilter]);

  const { user: user } = useAuth();
  const selectedClientId = clientId || null;
  const userRole = user?.role;

  // Check permissions and roles
  const userType = (user?.type || "").toLowerCase().trim();
  const isIntern = userType === "intern";
  const isSEO = false; // Default-Allow model
  const isSEOFullTime = false;

  const { hasPermission } = useActionPermissions("/tasks");
  const canEdit = hasPermission(PERMISSION_ACTIONS.EDIT_TASK);
  const canDelete = hasPermission(PERMISSION_ACTIONS.DELETE_TASK);
  const canEditTaskDetails = hasPermission(PERMISSION_ACTIONS.EDIT_TASK);

  const isAdmin = true; // Default-Allow model
  const canSeeAllFilters = true; // Default-Allow model
  const canUseClientScope = true; // Default-Allow model

  const { data, isLoading, error, refetch } = useGetTasksQuery(
    {
      search: searchText,
      page: currentPage,
      limit: pageSize,
      sortBy: sortBy,
      sortOrder: sortOrder,
      ...filters,
      ...(canUseClientScope && selectedClientId
        ? { companyId: selectedClientId }
        : {}),
    },
    {
      refetchOnMountOrArgChange: true,
    },
  );
  const { data: departmentsResp } = useGetDepartmentsDynamicQuery();
  const departments = departmentsResp?.data?.departments || [];
  const { data: projectsData } = useGetProjectsDropdownQuery();
  const { data: usersData } = useGetUsersDropdownQuery();

  // Handle paginated response (data?.data?.data) or legacy format (data?.data?.tasks)
  const tasks = data?.data?.data || data?.data?.tasks || [];
  const pagination = data?.data?.pagination || {};
  // Handle paginated response for projects
  const allProjects =
    projectsData?.data?.data || projectsData?.data?.projects || [];
  // Handle paginated response for users
  const users = (usersData?.data?.data || usersData?.data?.users || []).filter(u => u.role !== 'client');

  // Note: Local filtering and sorting removed as it's now handled by the backend
  // Regular users only see projects where they have tasks assigned
  // Admins see all projects
  const projects = useMemo(() => {
    if (isAdmin) {
      return allProjects;
    }

    // For regular users, only show projects that have tasks assigned to them
    const projectIds = new Set(
      tasks
        .map((task) => task.projectId?._id || task.projectId)
        .filter(Boolean),
    );

    return allProjects.filter((project) => projectIds.has(project._id));
  }, [allProjects, tasks, isAdmin]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const isACompleted = ["complete", "completed", "done", "validated"].includes((a.status || "").toLowerCase());
      const isBCompleted = ["complete", "completed", "done", "validated"].includes((b.status || "").toLowerCase());
      if (isACompleted && !isBCompleted) return 1;
      if (!isACompleted && isBCompleted) return -1;
      return 0;
    });
  }, [tasks]);

  const getStatusColor = (status) => {
    const colors = {
      created: "default",
      assigned: "blue",
      in_progress: "processing",
      submitted: "orange",
      validated: "success",
      rejected: "error",
      completed: "green",
      backlog: "default",
      to_do: "blue",
      review: "purple",
      Rejected: "red",
      done: "green",
    };
    return colors[status] || "default";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "green",
      medium: "orange",
      high: "red",
      critical: "purple",
    };
    return colors[priority] || "default";
  };

  const getDepartmentLabel = (value) => {
    const dept = departments.find((d) => d._id === value || d.slug === value);
    return dept?.name || value;
  };

  const handleDelete = async (taskId) => {
    try {
      await deleteTask(taskId).unwrap();
      notifySuccess('delete', taskId, 'Task deleted successfully');
      try { if (typeof refetch === 'function') await refetch(); } catch(e) {}
    } catch (err) {
      notifyError('delete', taskId, err.data?.message || "Failed to delete task");
    }
  };

  const sortOrderForField = (field) =>
    sortBy === field ? (sortOrder === "asc" ? "ascend" : "descend") : null;

  const columns = [
    {
      title: "Task Title",
      dataIndex: "title",
      key: "title",
      sorter: true,
      sortOrder: sortOrderForField("title"),
      render: (text, record) => (
        <Button type="link" onClick={() => onTaskClick(record)}>
          {text}
        </Button>
      ),
    },
    {
      title: "Project",
      dataIndex: ["projectId", "name"],
      key: "projectName",
      render: (_, record) => record.projectId?.name || "N/A",
    },
    {
      title: "Company",
      dataIndex: ["companyId", "name"],
      key: "companyName",
      render: (_, record) => record.companyId?.name || "N/A",
    },
    {
      title: "Department",
      dataIndex: "department",
      key: "department",
      render: (dept) => <Tag>{getDepartmentLabel(dept)}</Tag>,
    },
    {
      title: "Assigned To",
      dataIndex: ["assignedTo", "name"],
      key: "assignedTo",
      render: (_, record) => record.assignedTo?.name || "N/A",
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      sorter: true,
      sortOrder: sortOrderForField("priority"),
      render: (priority) => (
        <Tag color={getPriorityColor(priority)}>
          {priority ? priority.toUpperCase() : "MEDIUM"}
        </Tag>
      ),
    },
    {
      title: "Task Type",
      dataIndex: "taskCategory",
      key: "taskCategory",
      sorter: true,
      sortOrder: sortOrderForField("taskCategory"),
      render: (category) => (
        <Tag
          color={
            [
              "Correction",
              "Internal Correction",
              "Client Correction",
              "Hosting",
            ].includes(category)
              ? "orange"
              : category === "Redesign"
                ? "purple"
                : "blue"
          }
        >
          {category ? category.toUpperCase() : "NEW"}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      sorter: true,
      sortOrder: sortOrderForField("status"),
      render: (status) => {
        const statusLabelMap = {
          validated: "APPROVED",
          done: "APPROVED",
          backlog: "HOLD",
        };
        const displayLabel = status
          ? statusLabelMap[status] || status.replace("_", " ").toUpperCase()
          : "CREATED";

        return <Tag color={getStatusColor(status)}>{displayLabel}</Tag>;
      },
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      sorter: true,
      sortOrder: sortOrderForField("createdAt"),
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY") : "N/A"),
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      sorter: true,
      sortOrder: sortOrderForField("dueDate"),
      render: (date, record) => {
        if (!date) return "N/A";

        const completedStatuses = ["done", "completed", "validated", "review", "complete"];
        const isCompleted = completedStatuses.includes(record?.status);
        const dueDate = dayjs(date);

        let isOverdue = false;
        if (isCompleted) {
          const completionDate =
            record?.actualCompletionDate ||
            record?.workCompletedAt ||
            record?.validatedAt ||
            record?.completedAt;
          // Compare by calendar day so finishing on the due date (same day) is not "late".
          isOverdue = completionDate
            ? dayjs(completionDate)
                .startOf("day")
                .isAfter(dayjs(dueDate).startOf("day"))
            : false;
        } else {
          // For pending tasks, mark overdue once due date has passed.
          isOverdue = dueDate.isBefore(dayjs(), "day");
        }

        return (
          <span style={{ color: isOverdue ? "#ff4d4f" : "inherit" }}>
            {isCompleted ? "-" : dayjs(date).format("DD/MM/YYYY")}
          </span>
        );
      },
    },
    {
      title: "Time Tracking",
      key: "timeTracking",
      render: (_, record) => {
        if (!isDurationTrackingTask(record)) {
          return <span style={{ color: "#bfbfbf" }}>—</span>;
        }

        const {
          workStartedAt,
          workCompletedAt,
          workDurationMinutes,
          updatedAt,
        } = record;
        const isFinished = ["done", "validated", "completed", "complete"].includes(
          record.status,
        );

        const isRunning = workStartedAt && record.status === "in_progress";

        // 1. If it's currently running (In Progress), show live cumulative duration
        if (isRunning) {
          const runningMins = Math.round(
            (Date.now() - new Date(workStartedAt)) / 60000,
          );
          const totalMins = (workDurationMinutes || 0) + runningMins;
          const h = Math.floor(totalMins / 60);
          const m = totalMins % 60;
          const label = h > 0 ? `${h}h ${m}m` : `${m}m`;

          let startDisp = workStartedAt || record.startDate;
          const endDisp = workCompletedAt || (isFinished ? updatedAt : null);

          return (
            <div style={{ lineHeight: "1.4" }}>
              {startDisp && (
                <div style={{ fontSize: 11, color: "#8c8c8c" }}>
                  🟢 {dayjs(startDisp).format("DD/MM HH:mm")}
                </div>
              )}
              {endDisp && (
                <div style={{ fontSize: 11, color: "#8c8c8c" }}>
                  🏁 {dayjs(endDisp).format("DD/MM HH:mm")}
                </div>
              )}
              <Tag color="processing" style={{ marginTop: 3, fontSize: 11 }}>
                ⏳ {label} running
              </Tag>
            </div>
          );
        }

        // 2. If we have a calculated cumulative duration, show it
        if (workDurationMinutes != null) {
          const h = Math.floor(workDurationMinutes / 60);
          const m = workDurationMinutes % 60;
          const label = h > 0 ? `${h}h ${m}m` : `${m}m`;

          let startDisp = workStartedAt || record.startDate;
          if (!startDisp && workCompletedAt && workDurationMinutes != null) {
            // Calculate start time from completion time and duration
            startDisp = new Date(
              new Date(workCompletedAt) - workDurationMinutes * 60 * 1000,
            );
          }
          const endDisp = workCompletedAt || (isFinished ? updatedAt : null);

          return (
            <div style={{ lineHeight: "1.4" }}>
              {startDisp && (
                <div style={{ fontSize: 11, color: "#8c8c8c" }}>
                  🟢 {dayjs(startDisp).format("DD/MM HH:mm")}
                </div>
              )}
              {endDisp && (
                <div style={{ fontSize: 11, color: "#8c8c8c" }}>
                  🏁 {dayjs(endDisp).format("DD/MM HH:mm")}
                </div>
              )}
              <Tag color="orange" style={{ marginTop: 3, fontSize: 11 }}>
                ⏱ {label}
              </Tag>
            </div>
          );
        }

        // 3. Fallback for tasks that haven't started tracking
        return <span style={{ color: "#bfbfbf" }}>—</span>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      align: "center",
      fixed: window.innerWidth <= 768 ? false : "right",
      width: 100,
      render: (_, record) => {
        const isCreator = record.createdBy && (record.createdBy._id === user._id || record.createdBy === user._id);
        const canEditThisTask = canEdit && canEditTaskDetails && isCreator;
        const canDeleteThisTask = canDelete && isCreator;

        // Unified action menu for all roles based on permissions
        const items = [
          {
            key: "view",
            label: "View",
            icon: <EyeOutlined />,
            onClick: () => onTaskClick(record),
          },
            canEditThisTask &&
            !["done", "validated", "completed", "complete", "review"].includes(record.status?.toLowerCase()) && {
              key: "edit",
              label: "Edit",
              icon: <EditOutlined />,
              onClick: () => {
                const basePath = window.location.pathname.startsWith("/client") ? "/client/workspace" : window.location.pathname.startsWith("/agency") ? "/agency/workspace" : window.location.pathname.startsWith("/user") ? "/user/workspace" : "/workspace";
                navigate(`${basePath}/tasks/${record._id}/edit`);
              },
            },
          canDeleteThisTask && {
            key: "delete",
            label: "Delete",
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: "Delete Task",
                content: "Are you sure you want to delete this task?",
                okText: "Delete",
                okType: "danger",
                cancelText: "Cancel",
                onOk: () => handleDelete(record._id),
              });
            },
          },
          isCompletedTask(record.status) &&
            record.department === "website_designing" && {
              key: "reopen",
              label: "Reopen",
              icon: <ReloadOutlined />,
              onClick: () => {
                setTaskToReopen(record);
                setIsReopenModalVisible(true);
              },
            },
        ].filter(Boolean);

        return (
          <Dropdown menu={{ items }} trigger={["click"]}>
            <Button
              type="text"
              icon={<MoreOutlined style={{ fontSize: "18px" }} />}
            />
          </Dropdown>
        );
      },
    },
  ];
  const handleTableChange = (pagination, tableFilters, sorter) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);

    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    if (typeof s?.field === "string" && s?.order) {
      const order = s.order === "ascend" ? "asc" : "desc";
      setSortBy(s.field);
      setSortOrder(order);
    }
  };

  const handleFilterChange = (newFilters) => {
    // Merge with existing filters, then strip out any keys that became undefined/null
    // This ensures clearing a filter (allowClear) truly removes it from the query
    const merged = { ...filters, ...newFilters };
    const cleaned = Object.fromEntries(
      Object.entries(merged).filter(
        ([, v]) => v !== undefined && v !== null && v !== "",
      ),
    );
    setFilters(cleaned);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleSearch = (value) => {
    setSearchText(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchText("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Object.values(filters).some(
      (v) => v !== undefined && v !== null && v !== "",
    ) || searchText;

  return (
    <div>
      <div
        style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        <Select
          placeholder="Filter by Status"
          allowClear
          style={{ width: 180 }}
          value={filters.status}
          onChange={(value) => handleFilterChange({ status: value })}
          options={statusOptions}
        />

        <Select
          placeholder="Filter by Priority"
          allowClear
          style={{ width: 150 }}
          value={filters.priority}
          onChange={(value) => handleFilterChange({ priority: value })}
        >
          <Option value="low">Low</Option>
          <Option value="medium">Medium</Option>
          <Option value="high">High</Option>
          <Option value="critical">Critical</Option>
        </Select>

        {/* Project filter only for Admin and Coordinator roles */}
        {canSeeAllFilters && (
          <Select
            placeholder="Filter by Project"
            allowClear
            showSearch
            style={{ width: 180 }}
            value={filters.projectId}
            onChange={(value) => handleFilterChange({ projectId: value })}
            filterOption={(input, option) =>
              (option?.children ?? "")
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          >
            {projects.map((p) => (
              <Option key={p._id} value={p._id}>
                {p.name}
              </Option>
            ))}
          </Select>
        )}
        {/* Assigned User filter only for Admin and Coordinator roles */}
        {canSeeAllFilters && (
          <Select
            placeholder="Filter by Assigned User"
            allowClear
            showSearch
            style={{ width: 180 }}
            value={filters.assignedTo}
            onChange={(value) => handleFilterChange({ assignedTo: value })}
            filterOption={(input, option) =>
              (option?.children ?? "")
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          >
            <Option value="unassigned">Unassigned</Option>
            {users.map((u) => (
              <Option key={u._id} value={u._id}>
                {u.name}
              </Option>
            ))}
          </Select>
        )}
        <DatePicker
          placeholder="Filter by Date"
          value={filters.startDate ? dayjs(filters.startDate) : undefined}
          onChange={(date) =>
            handleFilterChange({
              startDate: date ? date.startOf("day").toISOString() : undefined,
              endDate: date ? date.endOf("day").toISOString() : undefined,
              dateField: "dueDate",
            })
          }
        />
        <Search
          placeholder="Search tasks..."
          allowClear
          value={searchText}
          style={{ width: 220 }}
          onSearch={handleSearch}
          onChange={(e) => setSearchText(e.target.value)}
        />
        {hasActiveFilters && (
          <Button onClick={handleClearFilters}>Clear Filters</Button>
        )}
      </div>
      <Table
        columns={columns}
        dataSource={sortedTasks}
        rowKey="_id"
        loading={isLoading}
        onChange={handleTableChange}
        pagination={{
          current: pagination.page || currentPage,
          pageSize: pagination.limit || pageSize,
          total: pagination.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} tasks`,
        }}
        scroll={{ x: "max-content" }}
      />

      <TaskReopenModal
        task={taskToReopen}
        visible={isReopenModalVisible}
        onClose={() => {
          setIsReopenModalVisible(false);
          setTaskToReopen(null);
        }}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
};

export default TaskListView;
