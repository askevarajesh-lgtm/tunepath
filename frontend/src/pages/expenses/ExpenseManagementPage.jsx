import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Tabs,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Typography,
  Spin,
  Row,
  Col,
  Statistic,
  Radio,
  Divider,
  Checkbox,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DollarOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useGetExpenseStatsQuery,
  useGetMonthlySummaryQuery,
  useDuplicateFixedExpensesMutation,
  useDuplicateVariableExpensesMutation,
  useGetSalaryHistoryQuery,
} from "../../api/expenseApi";
import { useGetUsersQuery, useGetUsersByRoleQuery } from "../../api/userApi";
import { useGetDepartmentsDynamicQuery } from "../../api/accessControlApi";
import { RESPONSIVE_COLS } from "../../utils/responsive";
import SalaryHistoryModal from "./SalaryHistoryModal";
import { Icon } from "@iconify/react";
import { useAuth } from "../../contexts/AuthContext";
const { Title } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker, MonthPicker } = DatePicker;

const ExpenseManagementPage = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const { user } = useAuth();
  const userRole = user?.role;
  const [activeTab, setActiveTab] = useState("fixed");
  const [form] = Form.useForm();
  const [dateFilter, setDateFilter] = useState("allTime");
  const [customDateRange, setCustomDateRange] = useState(null);
  const [showMonthlySummary, setShowMonthlySummary] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1);
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [showDepartmentWise, setShowDepartmentWise] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateForm] = Form.useForm();
  const [showVariableDuplicateModal, setShowVariableDuplicateModal] =
    useState(false);
  const [variableDuplicateForm] = Form.useForm();
  const [showSalaryHistoryModal, setShowSalaryHistoryModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  // Calculate date range based on filter
  const getDateRange = () => {
    const now = dayjs();
    switch (dateFilter) {
      case "currentMonth":
        return {
          startDate: now.startOf("month").toISOString(),
          endDate: now.endOf("month").toISOString(),
        };
      case "previousMonth":
        return {
          startDate: now.subtract(1, "month").startOf("month").toISOString(),
          endDate: now.subtract(1, "month").endOf("month").toISOString(),
        };
      case "last3Months":
        return {
          startDate: now.subtract(3, "month").startOf("month").toISOString(),
          endDate: now.endOf("month").toISOString(),
        };
      case "last6Months":
        return {
          startDate: now.subtract(6, "month").startOf("month").toISOString(),
          endDate: now.endOf("month").toISOString(),
        };
      case "custom":
        if (customDateRange && customDateRange[0] && customDateRange[1]) {
          return {
            startDate: customDateRange[0].startOf("day").toISOString(),
            endDate: customDateRange[1].endOf("day").toISOString(),
          };
        }
        return {};
      case "allTime":
      default:
        return {};
    }
  };

  const dateRange = getDateRange();
  const queryParams = {
    expenseType: activeTab,
    ...(dateRange.startDate && { startDate: dateRange.startDate }),
    ...(dateRange.endDate && { endDate: dateRange.endDate }),
  };

  const statsQueryParams = {
    ...(dateRange.startDate && { startDate: dateRange.startDate }),
    ...(dateRange.endDate && { endDate: dateRange.endDate }),
  };

  const { data, isLoading, refetch } = useGetExpensesQuery(queryParams);
  const { data: statsData, refetch: refetchStats } =
    useGetExpenseStatsQuery(statsQueryParams);
  const { data: monthlySummaryData, isLoading: monthlySummaryLoading } =
    useGetMonthlySummaryQuery(
      { month: selectedMonth, year: selectedYear },
      { skip: !showMonthlySummary },
    );
  const { data: usersData } = useGetUsersQuery();
  const { data: departmentsResp, isLoading: isLoadingDepartments } =
    useGetDepartmentsDynamicQuery();
  const { data: bdeUsersData } = useGetUsersByRoleQuery("bde", {
    skip: selectedCategory !== "bde_salary",
  });
  const [createExpense, { isLoading: isCreating }] = useCreateExpenseMutation();
  const [updateExpense, { isLoading: isUpdating }] = useUpdateExpenseMutation();
  const [deleteExpense] = useDeleteExpenseMutation();
  const [duplicateFixedExpenses, { isLoading: isDuplicating }] =
    useDuplicateFixedExpensesMutation();
  const [duplicateVariableExpenses, { isLoading: isVariableDuplicating }] =
    useDuplicateVariableExpensesMutation();

  // Handle paginated response (data?.data?.data) or legacy format (data?.data?.expenses)
  const expenses = data?.data?.data || data?.data?.expenses || [];
  const stats = statsData?.data || {};
  const fetchedDepartments = departmentsResp?.data?.departments || [];
  const rawTeamsList = fetchedDepartments
    .map((d) => d.name || d.slug)
    .filter(Boolean);

  // Filter expenses by type
  const filteredExpenses = useMemo(() => {
    if (activeTab === "fixed") {
      return expenses.filter((e) => {
        if (e.expenseType === "fixed") return true;
        // Legacy support
        const isFixedCategory = [
          "rent",
          "electricity",
          "eb",
          "internet",
          "water",
          "utilities",
          "maintenance",
          "tea_coffee",
          "maid",
          "transport",
          "ceo_salary",
          "bde_salary",
          "oh_salary",
          "oh_incentive",
          "om_salary",
          "hr_account",
          "campaign_ads",
          "hosting",
          "domain_purchase",
          "domain_renewal",
          "mobile_recharge",
          "event",
          "purchase_gymbal",
          "purchase_camera",
          "other_trip",
          "other_miscellaneous",
        ].includes(e.category);
        return isFixedCategory && !e.staffId;
      });
    } else {
      return expenses.filter((e) => {
        if (e.expenseType === "variable") return true;
        // Legacy support: expenses with staffId are variable
        return e.staffId !== null && e.staffId !== undefined;
      });
    }
  }, [expenses, activeTab]);

  // Group expenses by month (optional enhancement)
  const groupedExpenses = useMemo(() => {
    const groups = {};
    filteredExpenses.forEach((expense) => {
      const monthKey = dayjs(expense.date).format("MMMM YYYY");
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(expense);
    });
    return groups;
  }, [filteredExpenses]);

  // Staff users for variable expenses
  const staffUsers = useMemo(() => {
    // Handle paginated response (data?.data?.data) or legacy format (data?.data?.users)
    const users = usersData?.data?.data || usersData?.data?.users || usersData?.data || [];
    if (!users || users.length === 0) return [];
    return users.filter(
      (user) => user.role !== "super_admin" && user.isActive !== false,
    );
  }, [usersData]);

  // Teams from user management
  const teams = useMemo(() => {
    return rawTeamsList.map((team) => ({
      value: team,
      label: team,
    }));
  }, [rawTeamsList]);

  // BDE users for BDE Salary category
  const bdeUsers = useMemo(() => {
    const users = bdeUsersData?.data?.data || bdeUsersData?.data?.users || bdeUsersData?.data || [];
    // Also get BDE users from main users data if not available
    if (users.length === 0) {
      const allUsers = usersData?.data?.data || usersData?.data?.users || usersData?.data || [];
      return allUsers.filter(
        (user) =>
          (user.role === "bde" || user.team === "BDE") &&
          user.isActive !== false,
      );
    }
    return users.filter((user) => user.isActive !== false);
  }, [bdeUsersData, usersData]);

  // Fixed Expense Categories (Predefined)
  const fixedExpenseCategories = [
    { value: "rent", label: "Rent" },
    { value: "eb", label: "EB (Electricity)" },
    { value: "internet", label: "Internet" },
    { value: "water", label: "Water" },
    { value: "maintenance", label: "Maintenance" },
    { value: "tea_coffee", label: "Tea/Coffee" },
    { value: "maid", label: "Maid" },
    { value: "transport", label: "Transport" },
    { value: "ceo_salary", label: "CEO Salary" },
    { value: "bde_salary", label: "BDE Salary" },
    { value: "oh_salary", label: "OH Salary" },
    { value: "oh_incentive", label: "OH Incentive" },
    { value: "om_salary", label: "OM Salary" },
    { value: "hr_account", label: "HR Account" },
    { value: "campaign_ads", label: "Campaign Ads" },
    { value: "hosting", label: "Hosting" },
    { value: "domain_purchase", label: "Domain Purchase" },
    { value: "domain_renewal", label: "Domain Renewal" },
    { value: "mobile_recharge", label: "Mobile Recharge" },
    { value: "event", label: "Event" },
    { value: "purchase_gymbal", label: "Purchase – Gymbal" },
    { value: "purchase_camera", label: "Purchase – Camera" },
    { value: "other_trip", label: "Other/Trip" },
    { value: "other_miscellaneous", label: "Other Miscellaneous" },
    // Legacy categories for backward compatibility
    { value: "electricity", label: "Electricity (Legacy)" },
    { value: "utilities", label: "Utilities (Legacy)" },
  ];

  // Departments - use departments from settings API
  const departments = useMemo(() => {
    let list = [];
    if (fetchedDepartments.length > 0) {
      list = fetchedDepartments.map((d) => ({
        value: d.name, // Save name in DB to avoid displaying IDs
        label: d.name,
        slug: d.slug,
      }));
    } else {
      // Fallback to teams from user management if departments from settings not available
      list = teams;
    }

    // Hide "General" from non-admin/client roles
    return list.filter((d) => {
      if (
        d.slug === "general" ||
        (d.label || d.name)?.toLowerCase() === "general" ||
        d.value === "general"
      ) {
        return ["admin", "super_admin", "client"].includes(userRole);
      }
      return true;
    });
  }, [fetchedDepartments, teams, userRole]);

  // Transform departmentWise stats into format needed for table
  const departmentWiseSalaries = useMemo(() => {
    const departmentWise = stats.departmentWise || {};
    const transformed = {};

    Object.keys(departmentWise).forEach((dept) => {
      const deptData = departmentWise[dept];
      transformed[dept] = {
        department: dept,
        employeeCount: deptData.employees?.length || 0,
        count: deptData.count || 0,
        total: deptData.total || 0,
      };
    });

    return transformed;
  }, [stats.departmentWise]);

  const fixedExpenseColumns = [
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      width: 150,
      ellipsis: true,
      render: (category) => {
        const catObj = fixedExpenseCategories.find((c) => c.value === category);
        return <Tag>{catObj?.label || category || "N/A"}</Tag>;
      },
    },
    {
      title: "Department",
      dataIndex: "department",
      key: "department",
      width: 120,
      responsive: ["md"],
      render: (dept) =>
        dept ? (
          <Tag color="blue">{dept.replace(/_/g, " ").toUpperCase()}</Tag>
        ) : (
          "N/A"
        ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 120,
      ellipsis: true,
      render: (type) => type || "N/A",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 120,
      render: (amount) =>
        `₹${amount ? amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`,
    },
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 120,
      render: (date) => (date ? dayjs(date).format("DD MMM YYYY") : "N/A"),
    },
    {
      title: "Payment Method",
      dataIndex: "paymentMethod",
      key: "paymentMethod",
      width: 120,
      ellipsis: true,
      responsive: ["lg"],
      render: (method) =>
        method
          ? method.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
          : "N/A",
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      key: "remarks",
      width: 150,
      ellipsis: true,
      responsive: ["lg"],
      render: (remarks) => remarks || "N/A",
    },
    {
      title: "Created By",
      dataIndex: "createdBy",
      key: "createdBy",
      width: 120,
      ellipsis: true,
      responsive: ["md"],
      render: (createdBy) => createdBy?.name || "N/A",
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: window.innerWidth <= 768 ? false : "right",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            title="Edit"
          >
            <span className="hide-on-mobile">Edit</span>
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            title="Delete"
          >
            <span className="hide-on-mobile">Delete</span>
          </Button>
        </Space>
      ),
    },
  ];

  const variableExpenseColumns = [
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      width: 150,
      render: (category, record) => {
        if (record.staffId) {
          return <Tag color="blue">Employee Salary</Tag>;
        }
        if (record.type === "tool_expenses") {
          return <Tag color="geekblue">Tool Expenses</Tag>;
        }
        return <Tag color="orange">Others</Tag>;
      },
    },
    {
      title: "Department",
      dataIndex: "department",
      key: "department",
      width: 150,
      render: (dept, record) => {
        if (!dept && record.staffId) {
          dept = record.staffId.team || record.staffId.department;
        }
        
        // Map legacy ObjectId back to department name if possible
        if (dept && /^[0-9a-fA-F]{24}$/.test(dept)) {
          const foundDept = fetchedDepartments.find((d) => d._id === dept);
          if (foundDept) {
            dept = foundDept.name;
          }
        }

        return dept ? (
          <Tag color="blue">
            {dept.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </Tag>
        ) : (
          <Tag color="default">Other</Tag>
        );
      },
    },
    {
      title: "Name",
      key: "name",
      width: 160,
      ellipsis: true,
      render: (_, record) => {
        if (record.staffId) return record.staffId?.name || "N/A";
        if (record.type === "tool_expenses")
          return record.toolName || "Tool Expenses";
        if (record.description) return record.description;
        return "Others";
      },
    },
    {
      title: "Website URL",
      dataIndex: "websiteUrl",
      key: "websiteUrl",
      width: 160,
      ellipsis: true,
      render: (url, record) => {
        if (record.type !== "tool_expenses") return "N/A";
        return url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
            {url.replace(/^https?:\/\//, "").slice(0, 25)}
            {url.length > 30 ? "…" : ""}
          </a>
        ) : (
          "N/A"
        );
      },
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 120,
      render: (amount) =>
        `₹${amount ? amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`,
    },
    {
      title: "Start Date",
      key: "startDate",
      width: 120,
      render: (_, record) => {
        if (record.type !== "tool_expenses") return "N/A";
        return record.startDate
          ? dayjs(record.startDate).format("DD MMM YYYY")
          : "N/A";
      },
    },
    {
      title: "Expiry Date",
      key: "expiryDate",
      width: 120,
      render: (_, record) => {
        if (record.type !== "tool_expenses") return "N/A";
        if (!record.expiryDate) return "N/A";
        const isExpired = dayjs(record.expiryDate).isBefore(dayjs());
        return (
          <span style={{ color: isExpired ? "#ff4d4f" : "inherit" }}>
            {dayjs(record.expiryDate).format("DD MMM YYYY")}
            {isExpired && " ⚠"}
          </span>
        );
      },
    },
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 120,
      render: (date) => (date ? dayjs(date).format("DD MMM YYYY") : "N/A"),
    },
    {
      title: "Credentials",
      dataIndex: "description",
      key: "description",
      width: 180,
      ellipsis: true,
      render: (desc, record) => {
        if (record.type !== "tool_expenses") return "N/A";
        return desc || "N/A";
      },
    },
    {
      title: "Payment Method",
      dataIndex: "paymentMethod",
      key: "paymentMethod",
      width: 120,
      ellipsis: true,
      responsive: ["lg"],
      render: (method) =>
        method
          ? method.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
          : "N/A",
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      key: "remarks",
      width: 150,
      ellipsis: true,
      responsive: ["lg"],
      render: (remarks) => remarks || "N/A",
    },
    {
      title: "Created By",
      dataIndex: "createdBy",
      key: "createdBy",
      width: 120,
      ellipsis: true,
      responsive: ["lg"],
      render: (createdBy) => createdBy?.name || "N/A",
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: window.innerWidth <= 768 ? false : "right",
      render: (_, record) => {
        // Only show salary history for variable expenses with staffId
        const showHistory = record.expenseType === "variable" && record.staffId;
        return (
          <Space size="small">
            {showHistory && (
              <Button
                type="link"
                size="small"
                icon={<HistoryOutlined />}
                onClick={() => {
                  setSelectedEmployeeId(record.staffId?._id || record.staffId);
                  setShowSalaryHistoryModal(true);
                }}
                title="View Salary History"
              >
                <span className="hide-on-mobile">History</span>
              </Button>
            )}
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              title="Edit"
            >
              <span className="hide-on-mobile">Edit</span>
            </Button>
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              title="Delete"
            >
              <span className="hide-on-mobile">Delete</span>
            </Button>
          </Space>
        );
      },
    },
  ];

  const handleAdd = () => {
    setEditingExpense(null);
    setSelectedCategory(null);
    form.resetFields();
    form.setFieldsValue({
      expenseType: activeTab === "fixed" ? "fixed" : "variable",
      // Default Employee to 'Others' when adding a variable expense
      ...(activeTab !== "fixed" && { staffId: "others" }),
    });
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingExpense(record);
    const formValues = { ...record };

    // Determine expense type
    if (record.expenseType) {
      formValues.expenseType = record.expenseType;
    } else if (record.staffId) {
      formValues.expenseType = "variable";
    } else {
      formValues.expenseType = "fixed";
    }

    // Handle staffId
    if (record.staffId) {
      formValues.staffId = record.staffId._id || record.staffId;
    } else if (
      record.expenseType === "variable" &&
      record.type === "tool_expenses"
    ) {
      formValues.staffId = "tool_expenses";
      // Rehydrate tool-specific fields
      formValues.toolName = record.toolName || null;
      formValues.websiteUrl = record.websiteUrl || null;
      formValues.toolDescription = record.description || null;
      if (record.startDate) formValues.startDate = dayjs(record.startDate);
      if (record.expiryDate) formValues.expiryDate = dayjs(record.expiryDate);
    } else if (record.expenseType === "variable") {
      formValues.staffId = "others";
    }

    // Set category and selectedCategory for BDE Salary
    if (record.category === "bde_salary") {
      setSelectedCategory("bde_salary");
    } else {
      setSelectedCategory(null);
    }

    // Set date
    if (record.date) {
      formValues.date = dayjs(record.date);
    }

    form.setFieldsValue(formValues);
    setIsModalVisible(true);
  };

  const handleDelete = async (record) => {
    Modal.confirm({
      title: "Delete Expense",
      content:
        "Are you sure you want to delete this expense? This action cannot be undone.",
      onOk: async () => {
        try {
          await deleteExpense(record._id).unwrap();
          message.success("Expense deleted successfully");
          refetch();
          refetchStats();
        } catch (error) {
          message.error(error?.data?.message || "Failed to delete expense");
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      const isToolExpense =
        values.expenseType === "variable" && values.staffId === "tool_expenses";

      // Build expense data with all fields
      const expenseData = {
        expenseType: values.expenseType,
        category: values.expenseType === "fixed" ? values.category : null,
        // If 'others' is selected, send null so backend doesn't get an invalid ObjectId
        staffId:
          values.expenseType === "variable" &&
          values.staffId !== "others" &&
          values.staffId !== "tool_expenses"
            ? values.staffId
            : null,
        department: values.department || null,
        type: isToolExpense ? "tool_expenses" : values.type || null,
        amount: values.amount,
        description: isToolExpense
          ? values.toolDescription || null
          : values.description || null,
        date: values.date
          ? dayjs(values.date).toISOString()
          : new Date().toISOString(),
        vendor: values.vendor || null,
        paymentMethod: values.paymentMethod || null,
        notes: values.notes || null,
        remarks: values.remarks || null,
        // Tool Expense specific fields
        toolName: isToolExpense ? values.toolName || null : null,
        websiteUrl: isToolExpense ? values.websiteUrl || null : null,
        startDate:
          isToolExpense && values.startDate
            ? dayjs(values.startDate).toISOString()
            : null,
        expiryDate:
          isToolExpense && values.expiryDate
            ? dayjs(values.expiryDate).toISOString()
            : null,
        // Referral fields (only if isReferral is true, not shown for tool expenses)
        referral:
          !isToolExpense && values.referral?.isReferral
            ? {
                isReferral: true,
                referralId: values.referral.referralId || null,
                referralAmount: values.referral.referralAmount || 0,
                referralNotes: values.referral.referralNotes || null,
              }
            : {
                isReferral: false,
                referralId: null,
                referralAmount: 0,
                referralNotes: null,
              },
      };

      // Clean up null/undefined values
      Object.keys(expenseData).forEach((key) => {
        if (
          expenseData[key] === null ||
          expenseData[key] === undefined ||
          expenseData[key] === ""
        ) {
          delete expenseData[key];
        }
      });

      if (editingExpense) {
        await updateExpense({
          id: editingExpense._id,
          ...expenseData,
        }).unwrap();
        message.success("Expense updated successfully");
      } else {
        await createExpense(expenseData).unwrap();
        message.success("Expense added successfully");
      }
      setIsModalVisible(false);
      form.resetFields();
      setEditingExpense(null);
      refetch();
      refetchStats();
    } catch (error) {
      message.error(error?.data?.message || "Operation failed");
    }
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingExpense(null);
  };

  const handleDuplicateFromPreviousMonth = async () => {
    try {
      const values = await duplicateForm.validateFields();
      const sourceDate = dayjs(values.sourceMonth);
      const targetDate = dayjs(values.targetMonth);

      const result = await duplicateFixedExpenses({
        sourceMonth: sourceDate.month() + 1,
        sourceYear: sourceDate.year(),
        targetMonth: targetDate.month() + 1,
        targetYear: targetDate.year(),
      }).unwrap();

      message.success(
        result.message ||
          `Successfully duplicated ${result.count} fixed expense(s)`,
      );
      setShowDuplicateModal(false);
      duplicateForm.resetFields();
      refetch();
      refetchStats();
    } catch (error) {
      message.error(error?.data?.message || "Failed to duplicate expenses");
    }
  };

  const handleDuplicateModalCancel = () => {
    setShowDuplicateModal(false);
    duplicateForm.resetFields();
  };

  const handleDuplicateVariableFromPreviousMonth = async () => {
    try {
      const values = await variableDuplicateForm.validateFields();
      const sourceDate = dayjs(values.sourceMonth);
      const targetDate = dayjs(values.targetMonth);

      const result = await duplicateVariableExpenses({
        sourceMonth: sourceDate.month() + 1,
        sourceYear: sourceDate.year(),
        targetMonth: targetDate.month() + 1,
        targetYear: targetDate.year(),
      }).unwrap();

      message.success(
        result.message ||
          `Successfully duplicated ${result.count} variable expense(s)`,
      );

      if (result.failedCount && result.failedCount > 0) {
        message.warning(
          `${result.failedCount} variable expense(s) could not be duplicated (conflicts with existing entries)`,
        );
      }

      setShowVariableDuplicateModal(false);
      variableDuplicateForm.resetFields();
      refetch();
      refetchStats();
    } catch (error) {
      message.error(
        error?.data?.message || "Failed to duplicate variable expenses",
      );
    }
  };

  const handleVariableDuplicateModalCancel = () => {
    setShowVariableDuplicateModal(false);
    variableDuplicateForm.resetFields();
  };

  const handleDateFilterChange = (e) => {
    setDateFilter(e.target.value);
    if (e.target.value !== "custom") {
      setCustomDateRange(null);
    }
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const itemVariants = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ width: "100%" }}>
      {/* ─── Page Header ────────────────────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        style={{
          marginBottom: 32,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <Title level={2} style={{ margin: "4px 0 0 0", fontWeight: 800 }}>
            Expense Management
          </Title>
          <Typography.Text type="secondary" style={{ fontWeight: 500 }}>
            Track fixed overheads, variable employee costs, department budgets and financial analytics.
          </Typography.Text>
        </div>
        <Space size={12}>
          <Button
            size="large"
            onClick={() => setShowMonthlySummary(!showMonthlySummary)}
            style={{ borderRadius: 10, fontWeight: 600, height: 42 }}
          >
            {showMonthlySummary ? "Hide Report" : "Monthly Summary"}
          </Button>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            style={{ borderRadius: 10, fontWeight: 600, height: 42, background: "var(--accent-primary)" }}
          >
            Add Expense
          </Button>
        </Space>
      </motion.div>

      {/* ─── KPI Analytics Cards ───────────────────────────────────────────── */}
      <motion.div variants={itemVariants} style={{ marginBottom: 32 }}>
        <Row gutter={[20, 20]}>
          <Col xs={24} sm={12} lg={8}>
            <motion.div whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: "100%" }}>
              <Card
                className="glassmorphism hover-bg"
                style={{
                  borderRadius: 16,
                  border: "1px solid var(--border-color)",
                  height: "100%",
                  position: "relative",
                  overflow: "hidden",
                }}
                bodyStyle={{ padding: "20px 24px" }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "var(--accent-info)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2 }}>
                    TOTAL EXPENSES
                  </Typography.Text>
                  <div
                    style={{
                      padding: 8,
                      borderRadius: 10,
                      backgroundColor: "rgba(59, 130, 246, 0.1)",
                      color: "var(--accent-info)",
                      border: "1px solid rgba(59, 130, 246, 0.2)",
                    }}
                  >
                    <DollarOutlined style={{ fontSize: 18 }} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <Title level={2} style={{ margin: 0, color: "var(--text-primary)", fontWeight: 800, lineHeight: 1 }}>
                    ₹{(stats.totalExpenses || 0).toLocaleString("en-IN")}
                  </Title>
                </div>
                <Typography.Text style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginTop: 8, fontWeight: 500 }}>
                  Combined Fixed & Variable Outgoings
                </Typography.Text>
              </Card>
            </motion.div>
          </Col>

          <Col xs={24} sm={12} lg={8}>
            <motion.div whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: "100%" }}>
              <Card
                className="glassmorphism hover-bg"
                style={{
                  borderRadius: 16,
                  border: "1px solid var(--border-color)",
                  height: "100%",
                  position: "relative",
                  overflow: "hidden",
                }}
                bodyStyle={{ padding: "20px 24px" }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "var(--accent-primary)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2 }}>
                    FIXED EXPENSES
                  </Typography.Text>
                  <div
                    style={{
                      padding: 8,
                      borderRadius: 10,
                      backgroundColor: "rgba(16, 185, 129, 0.1)",
                      color: "var(--accent-primary)",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                    }}
                  >
                    <Icon icon="mdi:cash-lock" width="20" />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <Title level={2} style={{ margin: 0, color: "var(--text-primary)", fontWeight: 800, lineHeight: 1 }}>
                    ₹{(stats.fixedTotal || 0).toLocaleString("en-IN")}
                  </Title>
                </div>
                <Typography.Text style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginTop: 8, fontWeight: 500 }}>
                  Rent, Overheads, Software & Subscriptions
                </Typography.Text>
              </Card>
            </motion.div>
          </Col>

          <Col xs={24} sm={12} lg={8}>
            <motion.div whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: "100%" }}>
              <Card
                className="glassmorphism hover-bg"
                style={{
                  borderRadius: 16,
                  border: "1px solid var(--border-color)",
                  height: "100%",
                  position: "relative",
                  overflow: "hidden",
                }}
                bodyStyle={{ padding: "20px 24px" }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "var(--accent-warning)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2 }}>
                    VARIABLE EXPENSES
                  </Typography.Text>
                  <div
                    style={{
                      padding: 8,
                      borderRadius: 10,
                      backgroundColor: "rgba(245, 158, 11, 0.1)",
                      color: "var(--accent-warning)",
                      border: "1px solid rgba(245, 158, 11, 0.2)",
                    }}
                  >
                    <Icon icon="mdi:cash-sync" width="20" />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <Title level={2} style={{ margin: 0, color: "var(--text-primary)", fontWeight: 800, lineHeight: 1 }}>
                    ₹{(stats.variableTotal || 0).toLocaleString("en-IN")}
                  </Title>
                </div>
                <Typography.Text style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginTop: 8, fontWeight: 500 }}>
                  Employee Payroll, Allowances & Bonuses
                </Typography.Text>
              </Card>
            </motion.div>
          </Col>
        </Row>
      </motion.div>

      {/* ─── Monthly Summary Report Dropdown Drawer/Card ────────────────────── */}
      {showMonthlySummary && (
        <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
          <Card className="glassmorphism" style={{ borderRadius: 16, border: "1px solid var(--border-color)" }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Title level={4} style={{ margin: 0 }}>Monthly Summary Report</Title>
                <Space>
                  <span>Select Month:</span>
                  <MonthPicker
                    value={dayjs(`${selectedYear}-${selectedMonth.toString().padStart(2, "0")}-01`)}
                    onChange={(date) => {
                      if (date) {
                        setSelectedMonth(date.month() + 1);
                        setSelectedYear(date.year());
                      }
                    }}
                    format="MMMM YYYY"
                    style={{ borderRadius: 8 }}
                  />
                </Space>
              </div>
              <Spin spinning={monthlySummaryLoading}>
                {monthlySummaryData?.data && (
                  <div>
                    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                      <Col span={8}>
                        <Card size="small" style={{ borderRadius: 12, background: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                          <Statistic
                            title="Total Fixed Expenses"
                            value={monthlySummaryData.data.summary.fixedTotal}
                            prefix={<DollarOutlined />}
                            formatter={(value) => `₹${value?.toLocaleString("en-IN") || 0}`}
                          />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" style={{ borderRadius: 12, background: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                          <Statistic
                            title="Total Variable Expenses"
                            value={monthlySummaryData.data.summary.variableTotal}
                            prefix={<DollarOutlined />}
                            formatter={(value) => `₹${value?.toLocaleString("en-IN") || 0}`}
                          />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" style={{ borderRadius: 12, background: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                          <Statistic
                            title="Combined Total"
                            value={monthlySummaryData.data.summary.totalExpenses}
                            prefix={<DollarOutlined />}
                            formatter={(value) => `₹${value?.toLocaleString("en-IN") || 0}`}
                          />
                        </Card>
                      </Col>
                    </Row>

                    {monthlySummaryData.data.fixedCategoryWise?.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <Title level={5} style={{ marginBottom: 12 }}>Fixed Expenses by Category</Title>
                        <Table
                          columns={[
                            {
                              title: "Category",
                              dataIndex: "category",
                              key: "category",
                              render: (cat) => {
                                const catObj = fixedExpenseCategories.find((c) => c.value === cat);
                                return catObj?.label || cat;
                              },
                            },
                            { title: "Count", dataIndex: "count", key: "count" },
                            {
                              title: "Total Amount",
                              dataIndex: "total",
                              key: "total",
                              render: (amt) => `₹${(amt || 0).toLocaleString("en-IN")}`,
                            },
                          ]}
                          dataSource={monthlySummaryData.data.fixedCategoryWise}
                          rowKey="category"
                          pagination={false}
                          size="small"
                        />
                      </div>
                    )}

                    {monthlySummaryData.data.variableEmployeeWise?.length > 0 && (
                      <div>
                        <Title level={5} style={{ marginBottom: 12 }}>Variable Expenses by Employee</Title>
                        <Table
                          columns={[
                            {
                              title: "Employee",
                              key: "name",
                              render: (_, record) => `${record.staffName} (${record.staffRole?.replace(/_/g, " ") || "N/A"})`,
                            },
                            {
                              title: "Team",
                              dataIndex: "staffTeam",
                              key: "team",
                              render: (team) => team || "N/A",
                            },
                            { title: "Count", dataIndex: "count", key: "count" },
                            {
                              title: "Total Amount",
                              dataIndex: "total",
                              key: "total",
                              render: (amt) => `₹${(amt || 0).toLocaleString("en-IN")}`,
                            },
                          ]}
                          dataSource={monthlySummaryData.data.variableEmployeeWise}
                          rowKey="staffId"
                          pagination={false}
                          size="small"
                        />
                      </div>
                    )}
                  </div>
                )}
              </Spin>
            </Space>
          </Card>
        </motion.div>
      )}

      {/* ─── Date Filter Bar ────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
        <Card
          className="glassmorphism"
          style={{ borderRadius: 16, border: "1px solid var(--border-color)" }}
          bodyStyle={{ padding: "16px 20px" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Typography.Text strong style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Filter by Date:
              </Typography.Text>
              <Radio.Group
                value={dateFilter}
                onChange={handleDateFilterChange}
                buttonStyle="solid"
                size="middle"
              >
                <Radio.Button value="allTime">All Time</Radio.Button>
                <Radio.Button value="currentMonth">Current Month</Radio.Button>
                <Radio.Button value="previousMonth">Previous Month</Radio.Button>
                <Radio.Button value="last3Months">Last 3 Months</Radio.Button>
                <Radio.Button value="last6Months">Last 6 Months</Radio.Button>
                <Radio.Button value="custom">Custom Range</Radio.Button>
              </Radio.Group>
            </div>
            {dateFilter === "custom" && (
              <RangePicker
                value={customDateRange}
                onChange={setCustomDateRange}
                style={{ borderRadius: 8 }}
              />
            )}
          </div>
        </Card>
      </motion.div>

      {/* ─── Main Expenses Table Card ───────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card
          className="glassmorphism"
          style={{ borderRadius: 16, marginBottom: 32, border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}
          bodyStyle={{ padding: 24 }}
        >
          <Spin spinning={isLoading || isCreating || isUpdating}>
            <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
              <TabPane
                key="fixed"
                tab={
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <Icon icon="mdi:cash-lock" width="20" style={{ color: "var(--accent-primary)" }} />
                    Fixed Expenses
                    <Tag style={{ borderRadius: 12, marginLeft: 4, background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", fontWeight: 700 }}>
                      {activeTab === "fixed" ? filteredExpenses.length : 0}
                    </Tag>
                  </span>
                }
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <Button
                    type="default"
                    icon={<Icon icon="mdi:content-duplicate" width="16" />}
                    onClick={() => {
                      const now = dayjs();
                      const prevMonth = now.subtract(1, "month");
                      duplicateForm.setFieldsValue({
                        sourceMonth: prevMonth,
                        targetMonth: now,
                      });
                      setShowDuplicateModal(true);
                    }}
                    style={{ borderRadius: 8, fontWeight: 600 }}
                  >
                    Duplicate from Previous Month
                  </Button>
                </div>
                <Table
                  columns={fixedExpenseColumns}
                  dataSource={filteredExpenses}
                  rowKey="_id"
                  pagination={{
                    defaultPageSize: 10,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "50", "100", "200"],
                    responsive: true,
                  }}
                  scroll={{ x: "max-content" }}
                  size="middle"
                  rowClassName={() => "hover-bg"}
                  locale={{
                    emptyText: 'No fixed expenses found. Click "Add Expense" to create one.',
                  }}
                />
              </TabPane>

              <TabPane
                key="variable"
                tab={
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <Icon icon="mdi:cash-sync" width="20" style={{ color: "var(--accent-warning)" }} />
                    Variable Expenses
                    <Tag style={{ borderRadius: 12, marginLeft: 4, background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", fontWeight: 700 }}>
                      {activeTab === "variable" ? filteredExpenses.length : 0}
                    </Tag>
                  </span>
                }
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <Space>
                    <Button
                      type="default"
                      icon={<Icon icon="mdi:content-duplicate" width="16" />}
                      onClick={() => {
                        const now = dayjs();
                        const prevMonth = now.subtract(1, "month");
                        variableDuplicateForm.setFieldsValue({
                          sourceMonth: prevMonth,
                          targetMonth: now,
                        });
                        setShowVariableDuplicateModal(true);
                      }}
                      style={{ borderRadius: 8, fontWeight: 600 }}
                    >
                      Duplicate from Previous Month
                    </Button>
                    <Button
                      onClick={() => setShowDepartmentWise(!showDepartmentWise)}
                      style={{ borderRadius: 8, fontWeight: 600 }}
                    >
                      {showDepartmentWise ? "Hide" : "Show"} Department-wise Summary
                    </Button>
                  </Space>
                </div>

                {showDepartmentWise && Object.keys(departmentWiseSalaries).length > 0 && (
                  <Card style={{ marginBottom: 24, borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-tertiary)" }}>
                    <Title level={5} style={{ marginBottom: 16 }}>Department-wise Salary Expenses</Title>
                    <Table
                      columns={[
                        {
                          title: "Department",
                          dataIndex: "department",
                          key: "department",
                          render: (dept) => {
                            const deptObj = departments.find((d) => d.value === dept);
                            return (
                              <Tag color="blue" style={{ borderRadius: 12, fontWeight: 600 }}>
                                {deptObj?.label || dept.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                              </Tag>
                            );
                          },
                        },
                        { title: "Employee Count", dataIndex: "employeeCount", key: "employeeCount" },
                        { title: "Total Expenses", dataIndex: "count", key: "count" },
                        {
                          title: "Total Amount",
                          dataIndex: "total",
                          key: "total",
                          render: (amt) => `₹${(amt || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        },
                      ]}
                      dataSource={Object.values(departmentWiseSalaries)}
                      rowKey="department"
                      pagination={false}
                      size="small"
                    />
                  </Card>
                )}

                <Table
                  columns={variableExpenseColumns}
                  dataSource={filteredExpenses}
                  rowKey="_id"
                  pagination={{
                    defaultPageSize: 10,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "50", "100", "200"],
                    responsive: true,
                  }}
                  scroll={{ x: "max-content" }}
                  size="middle"
                  rowClassName={() => "hover-bg"}
                  locale={{
                    emptyText: 'No variable expenses found. Click "Add Expense" to create one.',
                  }}
                />
              </TabPane>
            </Tabs>
          </Spin>
        </Card>
      </motion.div>

      {/* Add/Edit Expense Modal */}
      <Modal
        title={editingExpense ? "Edit Expense" : "Add Expense"}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={800}
        styles={{ body: { height: "500px", overflowY: "auto" } }}
        okText="Save"
        cancelText="Cancel"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            expenseType: activeTab === "fixed" ? "fixed" : "variable",
          }}
        >
          {/* Expense Type Selection */}
          <Form.Item
            name="expenseType"
            label="Expense Type"
            rules={[{ required: true, message: "Please select expense type" }]}
          >
            <Radio.Group
              onChange={(e) => {
                // Clear fields when switching types
                if (e.target.value === "fixed") {
                  form.setFieldsValue({ staffId: undefined });
                } else {
                  form.setFieldsValue({ category: undefined });
                }
              }}
            >
              <Radio value="fixed">Fixed Expense</Radio>
              <Radio value="variable">Variable Expense (Employee Salary)</Radio>
            </Radio.Group>
          </Form.Item>

          {/* Category Selection - Only for Fixed Expenses */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.expenseType !== currentValues.expenseType
            }
          >
            {({ getFieldValue }) => {
              const expenseType = getFieldValue("expenseType");

              if (expenseType === "fixed") {
                return (
                  <Form.Item
                    name="category"
                    label="Category"
                    rules={[
                      { required: true, message: "Please select category" },
                    ]}
                  >
                    <Select
                      placeholder="Select fixed expense category"
                      onChange={(value) => {
                        // Clear staffId when category changes
                        form.setFieldsValue({ staffId: undefined });
                        setSelectedCategory(value);
                      }}
                    >
                      {fixedExpenseCategories.map((cat) => (
                        <Option key={cat.value} value={cat.value}>
                          {cat.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          {/* BDE Users Selection - Only for Fixed Expenses with BDE Salary category */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.expenseType !== currentValues.expenseType ||
              prevValues.category !== currentValues.category
            }
          >
            {({ getFieldValue }) => {
              const expenseType = getFieldValue("expenseType");
              const category = getFieldValue("category");

              if (expenseType === "fixed" && category === "bde_salary") {
                return (
                  <Form.Item
                    name="staffId"
                    label="BDE Employee"
                    rules={[
                      { required: true, message: "Please select BDE employee" },
                    ]}
                  >
                    <Select
                      showSearch
                      placeholder="Select BDE employee"
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        (option?.label ?? "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    >
                      {bdeUsers.map((user) => (
                        <Option
                          key={user._id}
                          value={user._id}
                          label={user.name}
                        >
                          {user.name} ({user.team || "BDE"})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          {/* Employee Selection - Only for Variable Expenses */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.expenseType !== currentValues.expenseType
            }
          >
            {({ getFieldValue }) => {
              const expenseType = getFieldValue("expenseType");

              if (expenseType === "variable") {
                return (
                  <Form.Item
                    name="staffId"
                    label="Employee"
                    rules={[
                      { required: true, message: "Please select employee" },
                    ]}
                  >
                    <Select
                      showSearch
                      placeholder="Select employee"
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        (option?.label ?? "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    >
                      {staffUsers.map((user) => (
                        <Option
                          key={user._id}
                          value={user._id}
                          label={user.name}
                        >
                          {user.name} (
                          {user.role
                            ?.replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase()) || "N/A"}
                          )
                        </Option>
                      ))}
                      {/* Others option - always last */}
                      <Option
                        key="tool_expenses"
                        value="tool_expenses"
                        label="Tool Expenses"
                      >
                        Tool Expenses
                      </Option>
                      <Option key="others" value="others" label="Others">
                        Others
                      </Option>
                    </Select>
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          {/* Department - Required for tool expenses, optional for others */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.expenseType !== currentValues.expenseType ||
              prevValues.staffId !== currentValues.staffId
            }
          >
            {({ getFieldValue }) => {
              const expenseType = getFieldValue("expenseType");
              const staffId = getFieldValue("staffId");
              if (expenseType === "fixed") return null;
              const isToolExpense = staffId === "tool_expenses";
              return (
                <Form.Item
                  name="department"
                  label="Employee Department"
                  rules={
                    isToolExpense
                      ? [
                          {
                            required: true,
                            message: "Please select a department",
                          },
                        ]
                      : []
                  }
                >
                  <Select
                    placeholder="Select department/team"
                    allowClear={!isToolExpense}
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                      (option?.children ?? "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                  >
                    {departments.map((dept) => (
                      <Option key={dept.value} value={dept.value}>
                        {dept.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              );
            }}
          </Form.Item>

          {/* Tool Expenses specific fields */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.expenseType !== currentValues.expenseType ||
              prevValues.staffId !== currentValues.staffId
            }
          >
            {({ getFieldValue }) => {
              const expenseType = getFieldValue("expenseType");
              const staffId = getFieldValue("staffId");
              if (expenseType !== "variable" || staffId !== "tool_expenses")
                return null;
              return (
                <>
                  <Form.Item
                    name="toolName"
                    label="Tool Name"
                    rules={[
                      { required: true, message: "Please enter the tool name" },
                    ]}
                  >
                    <Input placeholder="e.g. Adobe Photoshop, Slack, Ahrefs" />
                  </Form.Item>

                  <Form.Item name="websiteUrl" label="Website URL">
                    <Input placeholder="e.g. https://www.ahrefs.com" />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>

          {/* Type/Subcategory - Hidden for tool expenses and fixed expenses */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.expenseType !== currentValues.expenseType ||
              prevValues.staffId !== currentValues.staffId
            }
          >
            {({ getFieldValue }) => {
              const expenseType = getFieldValue("expenseType");
              const staffId = getFieldValue("staffId");
              if (expenseType === "fixed" || staffId === "tool_expenses")
                return null;
              return (
                <Form.Item name="type" label="Type/Subcategory (Optional)">
                  <Input placeholder="Enter expense type or subcategory" />
                </Form.Item>
              );
            }}
          </Form.Item>

          {/* Amount */}
          <Form.Item
            name="amount"
            label="Amount"
            rules={[{ required: true, message: "Please enter amount" }]}
          >
            <InputNumber
              prefix="₹"
              style={{ width: "100%" }}
              min={0}
              step={0.01}
            />
          </Form.Item>

          {/* Start Date & Expiry Date - Tool Expenses only */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.staffId !== currentValues.staffId ||
              prevValues.expenseType !== currentValues.expenseType
            }
          >
            {({ getFieldValue }) => {
              const staffId = getFieldValue("staffId");
              const expenseType = getFieldValue("expenseType");
              if (expenseType !== "variable" || staffId !== "tool_expenses")
                return null;
              return (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="startDate"
                      label="Start Date"
                      rules={[
                        { required: true, message: "Please select start date" },
                      ]}
                    >
                      <DatePicker style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="expiryDate"
                      label="Expiry Date"
                      rules={[
                        {
                          required: true,
                          message: "Please select expiry date",
                        },
                      ]}
                    >
                      <DatePicker style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                </Row>
              );
            }}
          </Form.Item>

          {/* Date - shown always (hidden label adjusted for tool expenses) */}
          <Form.Item
            name="date"
            label="Date"
            rules={[{ required: true, message: "Please select date" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          {/* Description / Credentials */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.expenseType !== currentValues.expenseType ||
              prevValues.staffId !== currentValues.staffId
            }
          >
            {({ getFieldValue }) => {
              const expenseType = getFieldValue("expenseType");
              const staffId = getFieldValue("staffId");
              if (expenseType === "fixed") return null;
              const isToolExpense = staffId === "tool_expenses";
              return (
                <Form.Item
                  name={isToolExpense ? "toolDescription" : "description"}
                  label={
                    isToolExpense
                      ? "Description (Credentials)"
                      : "Description (Optional)"
                  }
                >
                  <Input.TextArea
                    rows={3}
                    placeholder={
                      isToolExpense
                        ? "Enter login credentials or notes for this tool"
                        : "Enter expense description"
                    }
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          {/* Vendor, Payment Method, Referral, Remarks, Notes - Hidden for fixed expenses to simplify */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.expenseType !== currentValues.expenseType
            }
          >
            {({ getFieldValue }) => {
              const expenseType = getFieldValue("expenseType");
              // For fixed expenses, hide these optional fields to simplify the form
              if (expenseType === "fixed") {
                return null;
              }
              return (
                <>
                  {/* Vendor (Optional) */}
                  <Form.Item name="vendor" label="Vendor/Supplier (Optional)">
                    <Input placeholder="Enter vendor or supplier name" />
                  </Form.Item>

                  {/* Payment Method (Optional) */}
                  <Form.Item
                    name="paymentMethod"
                    label="Payment Method (Optional)"
                  >
                    <Select
                      placeholder="Select payment method"
                      allowClear
                      showSearch
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        (option?.children ?? "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    >
                      <Option value="cash">Cash</Option>
                      <Option value="bank_transfer">Bank Transfer</Option>
                      <Option value="upi">UPI</Option>
                      <Option value="cheque">Cheque</Option>
                      <Option value="other">Other</Option>
                    </Select>
                  </Form.Item>

                  {/* Referral Section (Optional) */}
                  <Divider>Referral Details (Optional)</Divider>

                  <Form.Item
                    name={["referral", "isReferral"]}
                    valuePropName="checked"
                  >
                    <Checkbox>This expense is related to a referral</Checkbox>
                  </Form.Item>

                  <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) =>
                      prevValues.referral?.isReferral !==
                      currentValues.referral?.isReferral
                    }
                  >
                    {({ getFieldValue }) => {
                      const isReferral = getFieldValue([
                        "referral",
                        "isReferral",
                      ]);

                      if (isReferral) {
                        return (
                          <>
                            <Form.Item
                              name={["referral", "referralId"]}
                              label="Referrer (Optional)"
                            >
                              <Select
                                showSearch
                                placeholder="Select referrer"
                                allowClear
                                optionFilterProp="children"
                              >
                                {staffUsers.map((user) => (
                                  <Option key={user._id} value={user._id}>
                                    {user.name}
                                  </Option>
                                ))}
                              </Select>
                            </Form.Item>
                            <Form.Item
                              name={["referral", "referralAmount"]}
                              label="Referral Amount/Commission (Optional)"
                            >
                              <InputNumber
                                prefix="₹"
                                style={{ width: "100%" }}
                                min={0}
                                step={0.01}
                              />
                            </Form.Item>
                            <Form.Item
                              name={["referral", "referralNotes"]}
                              label="Referral Notes (Optional)"
                            >
                              <Input.TextArea
                                rows={2}
                                placeholder="Enter referral-related notes"
                              />
                            </Form.Item>
                          </>
                        );
                      }
                      return null;
                    }}
                  </Form.Item>

                  {/* Remarks */}
                  <Form.Item name="remarks" label="Remarks (Optional)">
                    <Input.TextArea rows={3} placeholder="Enter remarks" />
                  </Form.Item>

                  {/* Notes (Optional) */}
                  <Form.Item name="notes" label="Additional Notes (Optional)">
                    <Input.TextArea
                      rows={2}
                      placeholder="Enter any additional notes"
                    />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* Duplicate Fixed Expenses Modal */}
      <Modal
        title="Duplicate Fixed Expenses from Previous Month"
        open={showDuplicateModal}
        onOk={handleDuplicateFromPreviousMonth}
        onCancel={handleDuplicateModalCancel}
        okText="Duplicate"
        cancelText="Cancel"
        confirmLoading={isDuplicating}
      >
        <Form form={duplicateForm} layout="vertical">
          <Form.Item
            name="sourceMonth"
            label="Source Month (Copy From)"
            rules={[{ required: true, message: "Please select source month" }]}
          >
            <MonthPicker
              style={{ width: "100%" }}
              format="MMMM YYYY"
              placeholder="Select source month"
            />
          </Form.Item>
          <Form.Item
            name="targetMonth"
            label="Target Month (Copy To)"
            rules={[{ required: true, message: "Please select target month" }]}
          >
            <MonthPicker
              style={{ width: "100%" }}
              format="MMMM YYYY"
              placeholder="Select target month"
            />
          </Form.Item>
          <Typography.Text type="secondary">
            This will copy all fixed expenses from the source month to the
            target month. If the target month already has expenses, the
            operation will be cancelled.
          </Typography.Text>
        </Form>
      </Modal>

      {/* Duplicate Variable Expenses Modal */}
      <Modal
        title="Duplicate Variable Expenses from Previous Month"
        open={showVariableDuplicateModal}
        onOk={handleDuplicateVariableFromPreviousMonth}
        onCancel={handleVariableDuplicateModalCancel}
        okText="Duplicate"
        cancelText="Cancel"
        confirmLoading={isVariableDuplicating}
      >
        <Form form={variableDuplicateForm} layout="vertical">
          <Form.Item
            name="sourceMonth"
            label="Source Month (Copy From)"
            rules={[{ required: true, message: "Please select source month" }]}
          >
            <MonthPicker
              style={{ width: "100%" }}
              format="MMMM YYYY"
              placeholder="Select source month"
            />
          </Form.Item>
          <Form.Item
            name="targetMonth"
            label="Target Month (Copy To)"
            rules={[{ required: true, message: "Please select target month" }]}
          >
            <MonthPicker
              style={{ width: "100%" }}
              format="MMMM YYYY"
              placeholder="Select target month"
            />
          </Form.Item>
          <Typography.Text type="secondary">
            This will copy all variable expenses from the source month to the
            target month. If an employee already has an entry in the target
            month, it will be skipped to prevent duplicates.
          </Typography.Text>
        </Form>
      </Modal>

      {/* Salary History Modal */}
      <SalaryHistoryModal
        open={showSalaryHistoryModal}
        onClose={() => {
          setShowSalaryHistoryModal(false);
          setSelectedEmployeeId(null);
        }}
        employeeId={selectedEmployeeId}
      />
    </motion.div>
  );
};

export default ExpenseManagementPage;
