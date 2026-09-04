import { useAuth } from "../../contexts/AuthContext";
import React, { useState, useEffect, useMemo } from "react";
import {
  Form,
  Input,
  Button,
  Space,
  Card,
  Tag,
  message,
  Select,
  Table,
  ColorPicker,
  Popconfirm,
  Tooltip,
  Divider,
} from "antd";
import { notifySuccess, notifyError } from '../../utils/notify';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckOutlined,
  CloseOutlined,
  DragOutlined,
} from "@ant-design/icons";
import {
  useCreateOrUpdateWorkflowConfigMutation,
  useGetAllWorkflowConfigsQuery,
} from "../../api/taskApi";
import { useGetDepartmentsDynamicQuery } from "../../api/accessControlApi";

const { Option } = Select;

const WorkflowTemplateManager = () => {
  const [form] = Form.useForm();
  const [templateColor, setTemplateColor] = useState("var(--accent-primary)");
  const [statuses, setStatuses] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const { user: user } = useAuth();
  const userRole = user?.role;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const isGlobalRole = useMemo(() => {
    return ["admin", "super_admin", "operations_head", "agency_super_admin", "agency_manager", "commander_admin", "supreme_super_admin"].includes(userRole);
  }, [userRole]);

  const { data: departmentsResp, isLoading: isLoadingDepartments } =
    useGetDepartmentsDynamicQuery();
  const departments = departmentsResp?.data?.departments || [];

  const userDepartmentSlug = useMemo(() => {
    if (!user) return null;

    const findMatch = (str) => {
      if (!str) return null;
      const norm = String(str).trim().toLowerCase();
      if (!norm) return null;
      const match = (departments || []).find((d) => {
        if (!d) return false;
        const dSlug = (d.slug || "").toLowerCase();
        const dName = (d.name || "").toLowerCase();
        const normSanitized = norm.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const dNameSanitized = dName.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        return (
          d._id === str ||
          dSlug === norm ||
          dName === norm ||
          dSlug === normSanitized ||
          dNameSanitized === normSanitized
        );
      });
      if (match?.slug) return match.slug;
      return null;
    };

    if (user.departmentId) {
      if (typeof user.departmentId === "object" && user.departmentId.slug) {
        return user.departmentId.slug;
      }
      const match = findMatch(user.departmentId);
      if (match) return match;
    }

    for (const val of [user.departmentName, user.department, user.team, user.roleName, user.designation, user.title]) {
      const match = findMatch(val);
      if (match) return match;
    }

    const roleSlugMap = {
      website_coordinator: "website-designing",
      digital_marketing_coordinator: "digital-marketing",
      digital_marketing_manager: "digital-marketing",
      seo_specialist: "seo",
      seo_manager: "seo",
      designer: "designer",
      graphic_designer: "designer",
      developer: "developer",
      dev: "developer",
      video_editor: "video-editor",
      video_editing: "video-editor",
      deployment: "deployment",
      deployer: "deployment",
      deploy: "deployment",
    };

    if (user.role && roleSlugMap[user.role]) {
      const mapped = roleSlugMap[user.role];
      const match = findMatch(mapped);
      if (match) return match;
      return mapped;
    }

    if (user.role) {
      const match = findMatch(user.role);
      if (match) return match;
    }

    for (const val of [user.roleName, user.departmentName, user.department, user.designation, user.team]) {
      if (val) {
        const slugified = String(val).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        if (slugified) return slugified;
      }
    }

    if (user.name || user.fullName) {
      const fullName = String(user.name || user.fullName);
      const match = (departments || []).find((d) => {
        if (!d?.name) return false;
        return fullName.toLowerCase().includes(d.name.toLowerCase());
      });
      if (match?.slug) return match.slug;
    }

    return null;
  }, [user, departments]);

  const [filterDepartment, setFilterDepartment] = useState(null);

  useEffect(() => {
    if (userDepartmentSlug) {
      if (!selectedDepartment && !editingTemplate) {
        setSelectedDepartment(userDepartmentSlug);
      }
      if (!isGlobalRole && filterDepartment !== userDepartmentSlug) {
        setFilterDepartment(userDepartmentSlug);
      }
    }
  }, [userDepartmentSlug, isGlobalRole, editingTemplate, filterDepartment]);

  const activeDepartmentQueryParam = filterDepartment || (!isGlobalRole ? userDepartmentSlug : null);
  const { data: allConfigsData, refetch: refetchConfigs } =
    useGetAllWorkflowConfigsQuery(activeDepartmentQueryParam ? { department: activeDepartmentQueryParam } : undefined);

  const [createOrUpdateWorkflow, { isLoading: isSaving }] =
    useCreateOrUpdateWorkflowConfigMutation();

  const allConfigs = allConfigsData?.data?.configs || [];

  // Department options from dynamic departments
  const departmentOptions = useMemo(() => {
    return departments
      .filter((d) => {
        // Hide "General" from non-admin/client roles
        if (d.slug === "general" || d.name?.toLowerCase() === "general") {
          return ["admin", "super_admin", "client"].includes(userRole);
        }
        return true;
      })
      .map((dept) => ({
        value: dept.slug || dept._id,
        label: dept.name,
        color: "var(--accent-primary)",
      }));
  }, [departments, userRole]);

  // Initialize with default statuses
  useEffect(() => {
    if (statuses.length === 0 && !editingTemplate) {
      setStatuses([
        {
          _key: "backlog",
          id: "backlog",
          name: "Hold",
          color: "#8c8c8c",
          order: 0,
        },
        {
          _key: "to_do",
          id: "to_do",
          name: "To Do",
          color: "var(--accent-primary)",
          order: 1,
        },
        {
          _key: "in_progress",
          id: "in_progress",
          name: "In Progress",
          color: "#faad14",
          order: 2,
        },
        {
          _key: "review",
          id: "review",
          name: "Review",
          color: "#722ed1",
          order: 3,
        },
        {
          _key: "Rejected",
          id: "Rejected",
          name: "Rejected",
          color: "#ff4d4f",
          order: 4,
        },
        { _key: "done", id: "done", name: "Complete", color: "#52c41a", order: 5 },
      ]);
    }
  }, [editingTemplate]);

  // Load template when editing
  useEffect(() => {
    if (editingTemplate) {
      const template = allConfigs.find((c) => c._id === editingTemplate);
      if (template) {
        setSelectedDepartment(template.projectType);
        setTemplateColor(template.color || "var(--accent-primary)");
        if (template.statuses && template.statuses.length > 0) {
          // Sort by order and add stable keys if missing
          const sortedStatuses = [...template.statuses]
            .sort((a, b) => a.order - b.order)
            .map((s) => ({
              ...s,
              _key:
                s._key ||
                s.id ||
                `st_${Math.random().toString(36).substr(2, 9)}`,
            }));
          setStatuses(sortedStatuses);
        }
        form.setFieldsValue({
          name: template.name,
        });
      }
    }
  }, [editingTemplate, allConfigs, form]);

  const handleAddStatus = () => {
    const newStatus = {
      _key: `st_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      id: `status_${Date.now()}`,
      name: "New Status",
      color: "var(--accent-primary)",
      order: statuses.length,
    };
    setStatuses([...statuses, newStatus]);
  };

  const handleRemoveStatus = (index) => {
    if (index <= 2) {
      notifyError('workflow-template', 'global', "Core statuses (Hold, To Do, In Progress) cannot be deleted");
      return;
    }
    const newStatuses = statuses.filter((_, i) => i !== index);
    // Reorder remaining statuses
    newStatuses.forEach((status, idx) => {
      status.order = idx;
    });
    setStatuses(newStatuses);
  };

  const handleStatusChange = (index, field, value) => {
    const newStatuses = [...statuses];
    newStatuses[index] = { ...newStatuses[index], [field]: value };
    setStatuses(newStatuses);
  };

  const handleMoveStatus = (index, direction) => {
    if (index <= 2) return;
    if (direction === "up" && index === 3) return; // Cannot swap with index 2 (In Progress)

    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === statuses.length - 1) return;

    const newStatuses = [...statuses];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    // Swap orders
    const tempOrder = newStatuses[index].order;
    newStatuses[index].order = newStatuses[targetIndex].order;
    newStatuses[targetIndex].order = tempOrder;

    // Swap items
    [newStatuses[index], newStatuses[targetIndex]] = [
      newStatuses[targetIndex],
      newStatuses[index],
    ];

    setStatuses(newStatuses);
  };

  const handleReset = () => {
    form.resetFields();
    setSelectedDepartment(null);
    setTemplateColor("var(--accent-primary)");
    setStatuses([
      {
        _key: "backlog",
        id: "backlog",
        name: "Hold",
        color: "#8c8c8c",
        order: 0,
      },
      { _key: "to_do", id: "to_do", name: "To Do", color: "var(--accent-primary)", order: 1 },
      {
        _key: "in_progress",
        id: "in_progress",
        name: "In Progress",
        color: "#faad14",
        order: 2,
      },
      {
        _key: "review",
        id: "review",
        name: "Review",
        color: "#722ed1",
        order: 3,
      },
      {
        _key: "Rejected",
        id: "Rejected",
        name: "Rejected",
        color: "#ff4d4f",
        order: 4,
      },
      { _key: "done", id: "done", name: "Complete", color: "#52c41a", order: 5 },
    ]);
    setEditingTemplate(null);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (!values.name || values.name.trim() === "") {
        notifyError('workflow-template', 'global', "Please enter a workflow template name");
        return;
      }
      if (!selectedDepartment) {
        notifyError('workflow-template', 'global', "Please select a department");
        return;
      }
      if (statuses.length === 0) {
        notifyError('workflow-template', 'global', "Please add at least one status");
        return;
      }

      // Enforce that Hold, To Do, and In Progress are fixed at the top
      if (
        statuses.length < 3 ||
        statuses[0].id !== "backlog" ||
        statuses[1].id !== "to_do" ||
        statuses[2].id !== "in_progress"
      ) {
        notifyError('workflow-template', 'global', "The first three statuses must be Hold (backlog), To Do (to_do), and In Progress (in_progress) to support task time tracking.");
        return;
      }

      // Ensure statuses are properly ordered
      const orderedStatuses = statuses.map((s, idx) => ({ ...s, order: idx }));

      await createOrUpdateWorkflow({
        ...values,
        projectId: null, // Department templates don't have projectId
        projectType: selectedDepartment,
        color: templateColor,
        statuses: orderedStatuses,
        isActive: true,
      }).unwrap();

      notifySuccess('workflow-template', editingTemplate || 'global', "Workflow template saved successfully");
      handleReset();
      refetchConfigs();
    } catch (error) {
      notifyError('workflow-template', editingTemplate || 'global', error?.data?.message || "Failed to save workflow template");
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template._id);
  };

  const handleDelete = async (templateId) => {
    try {
      // TODO: Implement delete mutation
      notifySuccess('workflow-template', templateId || 'global', "Delete functionality will be implemented");
      refetchConfigs();
    } catch (error) {
      notifyError('workflow-template', templateId || 'global', "Failed to delete template");
    }
  };

  const defaultColors = [
    "#8c8c8c",
    "var(--accent-primary)",
    "#faad14",
    "#722ed1",
    "#ff4d4f",
    "#52c41a",
    "#13c2c2",
    "#eb2f96",
    "#fa8c16",
    "#2f54eb",
  ];

  // Filter templates by department (projectType)
  const departmentTemplates = useMemo(() => {
    let list = allConfigs.filter(
      (config) => config.projectType && !config.projectId,
    );

    const activeFilter = filterDepartment || (!isGlobalRole ? userDepartmentSlug : null);

    if (activeFilter && activeFilter !== "all") {
      const normFilter = activeFilter.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
      list = list.filter((config) => {
        if (!config.projectType) return false;
        const normConfig = config.projectType.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
        return normConfig === normFilter || normConfig.includes(normFilter) || normFilter.includes(normConfig);
      });
    }

    return list;
  }, [allConfigs, filterDepartment, isGlobalRole, userDepartmentSlug]);

  const templateColumns = [
    {
      title: "Template Name",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <Space>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              backgroundColor: record.color || "var(--accent-primary)",
              border: "1px solid #d9d9d9",
            }}
          />
          <strong>{text}</strong>
        </Space>
      ),
    },
    {
      title: "Department",
      key: "department",
      render: (_, record) => {
        const deptOption = departmentOptions.find(
          (o) => o.value === record.projectType,
        );
        return (
          <Tag color={deptOption?.color || "default"}>
            {deptOption?.label ||
              record.projectType?.replace(/_/g, " ") ||
              "N/A"}
          </Tag>
        );
      },
    },
    {
      title: "Status Flow",
      key: "statuses",
      render: (_, record) => {
        const sortedStatuses = [...(record.statuses || [])].sort(
          (a, b) => a.order - b.order,
        );
        return (
          <Space wrap>
            {sortedStatuses.map((status, idx) => (
              <Tag key={idx} color={status.color} style={{ margin: 0 }}>
                {idx + 1}. {status.name}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: "Final Status",
      key: "finalStatus",
      render: (_, record) => {
        const sortedStatuses = [...(record.statuses || [])].sort(
          (a, b) => b.order - a.order,
        );
        const finalStatus = sortedStatuses[0];
        return finalStatus ? (
          <Tag color={finalStatus.color}>
            {finalStatus.name} (Order: {finalStatus.order})
          </Tag>
        ) : (
          <Tag>N/A</Tag>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      render: (isActive) => (
        <Tag color={isActive ? "green" : "red"}>
          {isActive ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit Template">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ width: "100%" }}>
      <Card
        title="Create Department Workflow Template"
        style={{ marginBottom: 24 }}
        size={isMobile ? "small" : "default"}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Template Name"
            name="name"
            rules={[{ required: true, message: "Please enter template name" }]}
          >
            <Input placeholder="e.g., 'Website Design Workflow', 'SEO Workflow'" />
          </Form.Item>

          <Form.Item label="Department" required>
            <Select
              placeholder="Select department for this template"
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              disabled={!!editingTemplate}
            >
              {departmentOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  <Space>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        backgroundColor: option.color,
                        display: "inline-block",
                      }}
                    />
                    {option.label}
                  </Space>
                </Option>
              ))}
            </Select>
            <div style={{ marginTop: 8, color: "#999", fontSize: "12px" }}>
              {selectedDepartment
                ? `This template will be available for all ${departmentOptions.find((o) => o.value === selectedDepartment)?.label || selectedDepartment} projects`
                : "Select a department to create a workflow template for that department"}
            </div>
          </Form.Item>

          <Form.Item label="Template Color">
            <ColorPicker
              value={templateColor}
              onChange={(color) => setTemplateColor(color.toHexString())}
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
            <div style={{ marginTop: 8, color: "#999", fontSize: "12px" }}>
              Choose a color to identify this template
            </div>
          </Form.Item>
        </Form>

        <Divider>Status Configuration</Divider>

        <div style={{ marginBottom: 16 }}>
          <Button icon={<PlusOutlined />} onClick={handleAddStatus}>
            Add Status
          </Button>
          <div style={{ marginTop: 8, color: "#999", fontSize: "12px" }}>
            Configure the status flow. Tasks will progress through these
            statuses in order. The final status (highest order) is considered
            "Completed".
          </div>
        </div>

        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {statuses.map((status, index) => (
            <Card
              key={status._key || status.id || index}
              size="small"
              style={{ borderLeft: `4px solid ${status.color}` }}
            >
              <Space
                direction={isMobile ? "vertical" : "horizontal"}
                style={{ width: "100%", justifyContent: "space-between" }}
                wrap
                size={isMobile ? "small" : "middle"}
              >
                <Space
                  wrap
                  size={isMobile ? "small" : "middle"}
                  style={{ width: isMobile ? "100%" : "auto" }}
                >
                  <Tag
                    color={status.color}
                    style={{
                      minWidth: isMobile ? 50 : 60,
                      textAlign: "center",
                    }}
                  >
                    Order: {index}
                  </Tag>
                  <Input
                    value={status.name}
                    onChange={(e) =>
                      handleStatusChange(index, "name", e.target.value)
                    }
                    style={{ width: isMobile ? "100%" : 200 }}
                    placeholder="Status name"
                    size={isMobile ? "small" : "default"}
                  />
                  <Input
                    value={status.id}
                    onChange={(e) =>
                      handleStatusChange(index, "id", e.target.value)
                    }
                    style={{ width: isMobile ? "100%" : 150 }}
                    placeholder="Status ID"
                    size={isMobile ? "small" : "default"}
                    disabled={index <= 2}
                  />
                  <Select
                    value={status.color}
                    onChange={(value) =>
                      handleStatusChange(index, "color", value)
                    }
                    style={{ width: isMobile ? "100%" : 120 }}
                    size={isMobile ? "small" : "default"}
                  >
                    {defaultColors.map((color) => (
                      <Option key={color} value={color}>
                        <Tag color={color}>{color}</Tag>
                      </Option>
                    ))}
                  </Select>
                  {!isMobile && <Tag color={status.color}>{status.name}</Tag>}
                </Space>
                <Space size={isMobile ? "small" : "middle"}>
                  <Tooltip title="Move Up">
                    <Button
                      icon={<ArrowUpOutlined />}
                      onClick={() => handleMoveStatus(index, "up")}
                      disabled={index <= 3}
                      size={isMobile ? "small" : "default"}
                    />
                  </Tooltip>
                  <Tooltip title="Move Down">
                    <Button
                      icon={<ArrowDownOutlined />}
                      onClick={() => handleMoveStatus(index, "down")}
                      disabled={index <= 2 || index === statuses.length - 1}
                      size={isMobile ? "small" : "default"}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="Delete this status?"
                    onConfirm={() => handleRemoveStatus(index)}
                    okText="Yes"
                    cancelText="No"
                    disabled={index <= 2}
                  >
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      size={isMobile ? "small" : "default"}
                      disabled={index <= 2}
                    />
                  </Popconfirm>
                </Space>
              </Space>
            </Card>
          ))}
        </Space>

        <Space style={{ marginTop: 16 }}>
          <Button type="primary" onClick={handleSave} loading={isSaving}>
            {editingTemplate ? "Update Template" : "Save Template"}
          </Button>
          <Button onClick={handleReset}>Reset</Button>
        </Space>
      </Card>

      <Card
        title="Department Workflow Templates"
        extra={
          isGlobalRole ? (
            <Space wrap>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Filter Department:
              </span>
              <Select
                placeholder="All Departments"
                value={filterDepartment}
                onChange={setFilterDepartment}
                style={{ width: 200 }}
                allowClear
              >
                <Option value="all">All Departments</Option>
                {departmentOptions.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>
            </Space>
          ) : userDepartmentSlug ? (
            <Tag color="blue">
              Department:{" "}
              {departmentOptions.find((o) => o.value === userDepartmentSlug)
                ?.label || userDepartmentSlug}
            </Tag>
          ) : null
        }
        size={isMobile ? "small" : "default"}
      >
        <Table
          columns={templateColumns}
          dataSource={departmentTemplates}
          rowKey="_id"
          pagination={{
            pageSize: isMobile ? 5 : 10,
            showSizeChanger: !isMobile,
            simple: isMobile,
          }}
          scroll={isMobile ? { x: "max-content" } : undefined}
          size={isMobile ? "small" : "default"}
          locale={{
            emptyText: "No workflow templates created yet. Create one above.",
          }}
        />
      </Card>
    </div>
  );
};

export default WorkflowTemplateManager;
