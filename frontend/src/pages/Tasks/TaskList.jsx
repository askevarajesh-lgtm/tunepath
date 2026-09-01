import { useAuth } from "../../contexts/AuthContext";
import React, { useState } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  message,
  Card,
  Spin,
  Select,
  Input,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useGetTasksQuery, useDeleteTaskMutation } from "../../api/taskApi";
import { useGetDepartmentsDynamicQuery } from "../../api/accessControlApi";
import useBulkSelection from "../../hooks/useBulkSelection";
import BulkActionBar from "../../components/common/BulkActionBar";
import { useActionPermissions } from "../../hooks/useActionPermissions";
import { PERMISSION_ACTIONS } from "../../utils/actionPermissions";
import dayjs from "dayjs";
import { getProjectServiceStats } from "../../utils/categoryUtils";
import { notifyLoading, notifySuccess, notifyError } from '../../utils/notify';

const { Option } = Select;

// Helper to get service count for a task
const getServiceCount = (task) => {
  if (!task.projectId || !task.serviceType) return null;
  const stats = getProjectServiceStats(task.projectId, task.serviceType);
  if (!stats) return null;
  return { used: stats.used, total: stats.total };
};

const TaskList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const getTaskEditUrl = (taskId) => {
    if (location.pathname.startsWith('/user')) return `/user/tasks/${taskId}/edit`;
    if (location.pathname.startsWith('/client')) return `/client/workspace/tasks/${taskId}/edit`;
    if (location.pathname.startsWith('/agency')) return `/agency/workspace/tasks/${taskId}/edit`;
    return `/workspace/tasks/${taskId}/edit`;
  };
  const {
    canAdd: canCreatePermission,
    canEdit: canEditPermission,
    canDelete: canDeletePermission,
    canView,
  } = useActionPermissions("/tasks");
  const [deleteTask] = useDeleteTaskMutation();

  const { user: user } = useAuth();
  const userRole = user?.role;

  // Check permissions for actions; intern type must not see Create Task regardless of role
  // SEO users must be full-time
  const userType = (user?.type || "").toLowerCase().trim();
  const isIntern = userType === "intern";
  const isSEO = userRole === "seo";
  const isSEOFullTime = isSEO && userType === "full_time";

  const adminRoles = [
    "supreme_super_admin",
    "commander_admin",
    "agency_super_admin",
    "brand_super_admin",
    "agency_manager",
    "brand_manager"
  ];
  const isAdmin = adminRoles.includes(userRole);

  const canCreate =
    !isIntern && canCreatePermission && (!isSEO || isSEOFullTime);
  const canEdit = !isIntern && canEditPermission && (!isSEO || isSEOFullTime);
  const canDelete =
    !isIntern && canDeletePermission && (!isSEO || isSEOFullTime);
  const [filters, setFilters] = useState({});
  const { data, isLoading, error, refetch } = useGetTasksQuery(filters);
  const { data: departmentsResp } = useGetDepartmentsDynamicQuery();
  const departments = departmentsResp?.data?.departments || [];

  // Handle paginated response (data?.data?.data) or legacy format (data?.data?.tasks)
  const tasks = data?.data?.data || data?.data?.tasks || [];

  // Use standard bulk selection hook
  const { rowSelection, handleClearSelection, selectionCount } =
    useBulkSelection(tasks);

  const getStatusColor = (status) => {
    const colors = {
      created: "default",
      assigned: "blue",
      in_progress: "processing",
      submitted: "orange",
      validated: "success",
      rejected: "error",
      completed: "green",
    };
    return colors[status] || "default";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "green",
      medium: "orange",
      high: "red",
    };
    return colors[priority] || "default";
  };

  const getDepartmentLabel = (value) => {
    const dept = departments.find((d) => d._id === value);
    return dept?.name || value;
  };

  const handleDelete = async (taskId) => {
    try {
      notifyLoading('delete', taskId, 'Deleting task...');
      await deleteTask(taskId).unwrap();
      notifySuccess('delete', taskId, 'Task deleted successfully');
      try { if (typeof refetch === 'function') await refetch(); } catch(e) {}
    } catch (err) {
      notifyError('delete', taskId, err.data?.message || "Failed to delete task");
    }
  };

  const columns = [
    {
      title: "Task Title",
      dataIndex: "title",
      key: "title",
    },
    {
      title: "Department",
      dataIndex: "department",
      key: "department",
      render: (dept) => <Tag>{getDepartmentLabel(dept)}</Tag>,
    },
    {
      title: "Company",
      dataIndex: ["companyId", "name"],
      key: "companyName",
      render: (_, record) => record.companyId?.name || "N/A",
      className: "hide-on-mobile",
    },
    {
      title: "Project",
      dataIndex: ["projectId", "name"],
      key: "projectName",
      render: (_, record) => (
        <span>
          {record.projectId?.name || "N/A"}
          {getServiceCount(record) && (
            <span style={{ marginLeft: 8, color: "#9ca3af" }}>
              ({getServiceCount(record).used}/{getServiceCount(record).total})
            </span>
          )}
        </span>
      ),
      className: "hide-on-mobile",
    },
    {
      title: "Assigned To",
      dataIndex: ["assignedTo", "name"],
      key: "assignedTo",
      render: (_, record) => record.assignedTo?.name || "N/A",
      className: "hide-on-mobile",
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
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
      render: (type) => (
        <Tag
          color={
            type === "New"
              ? "blue"
              : type === "Correction"
                ? "orange"
                : "purple"
          }
        >
          {type ? type.toUpperCase() : "NEW"}
        </Tag>
      ),
    },
    {
      title: "Content Type",
      dataIndex: "serviceType",
      key: "serviceType",
      render: (type) => (
        <Tag
          color={
            type === "video"
              ? "magenta"
              : type === "poster"
                ? "cyan"
                : type === "shoot"
                  ? "geekblue"
                  : "default"
          }
          style={{ textTransform: "capitalize" }}
        >
          {type || "-"}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status ? status.replace("_", " ").toUpperCase() : "CREATED"}
        </Tag>
      ),
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      render: (date, record) => {
        const isCompleted = [
          "done",
          "completed",
          "validated",
          "review",
        ].includes(record.status);
        return isCompleted
          ? "-"
          : date
            ? dayjs(date).format("DD/MM/YYYY")
            : "N/A";
      },
      className: "hide-on-mobile",
    },
    {
      title: "Actions",
      key: "actions",
      align: "center",
      render: (_, record) => {
        const isCreator = record.createdBy && (record.createdBy._id === user?._id || record.createdBy === user?._id);
        const canEditThisTask = canEdit && !isIntern && isCreator;
        const canDeleteThisTask = canDelete && isCreator;

        return (
          <Space className="table-actions">
            {canView && (
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/tasks/${record._id}`)}
              >
                <span className="hide-on-mobile">View</span>
              </Button>
            )}
            {canEditThisTask &&
              !["done", "validated", "completed", "complete", "review"].includes(record.status?.toLowerCase()) && (
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => navigate(getTaskEditUrl(record._id))}
              >
                <span className="hide-on-mobile">Edit</span>
              </Button>
            )}
            {canDeleteThisTask && (
              <Popconfirm
                title="Are you sure you want to delete this task?"
                onConfirm={() => handleDelete(record._id)}
                okText="Yes"
                cancelText="No"
              >
                <Button type="link" danger icon={<DeleteOutlined />}>
                  <span className="hide-on-mobile">Delete</span>
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Tasks</h1>
        {canCreate && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/workspace/tasks/new")}
          >
            Create Task
          </Button>
        )}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="filter-bar">
          <Select
            placeholder="Filter by Status"
            allowClear
            style={{ width: "100%", minWidth: 200 }}
            onChange={(value) => setFilters({ ...filters, status: value })}
          >
            <Option value="created">Created</Option>
            <Option value="assigned">Assigned</Option>
            <Option value="in_progress">In Progress</Option>
            <Option value="submitted">Submitted</Option>
            <Option value="validated">Validated</Option>
            <Option value="rejected">Rejected</Option>
            <Option value="completed">Completed</Option>
            <Option value="on_hold">On Hold</Option>
            <Option value="cancelled">Cancelled</Option>
          </Select>
          <Select
            placeholder="Filter by Type"
            allowClear
            style={{ width: "100%", minWidth: 200 }}
            onChange={(value) =>
              setFilters({ ...filters, taskCategory: value })
            }
          >
            <Option value="New">New</Option>
            <Option value="Correction">Correction</Option>
            <Option value="Redesign">Redesign</Option>
          </Select>
        </div>
      </Card>

      <BulkActionBar
        selectionCount={selectionCount}
        onClearSelection={handleClearSelection}
        showDelete={false}
      />

      <Card>
        <Spin spinning={isLoading}>
          <Table
            rowSelection={rowSelection}
            columns={columns}
            dataSource={tasks}
            rowKey="_id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} tasks`,
            }}
            scroll={{ x: "max-content" }}
            locale={{
              emptyText: 'No tasks found. Click "Create Task" to create one.',
            }}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default TaskList;
