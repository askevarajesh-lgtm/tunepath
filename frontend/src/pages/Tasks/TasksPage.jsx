import { useAuth } from "../../contexts/AuthContext";
import React, { useState, useEffect, useMemo, useRef } from "react";
import dayjs from "dayjs";
import {
  Button,
  Space,
  Tabs,
  Drawer,
  message,
  Typography,
  Select,
  Alert,
  Row,
  Col,
  Card,
  Statistic,
  Modal,
  List,
  Tag,
  Input,
  Avatar,
  Badge,
  Tooltip,
  Collapse,
  Empty,
  Divider,
  Segmented,
} from "antd";
import {
  PlusOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  CalendarOutlined,
  SettingOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  TeamOutlined,
  BankOutlined,
  CrownOutlined,
  UserOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  FolderOutlined,
  EyeOutlined,
  FireOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useGetDepartmentsDynamicQuery, useGetRolesQuery } from "../../api/accessControlApi";
import { resolveUserDepartmentSlug, getDepartmentIdentifier } from "../../utils/departmentUtils";
import { useActionPermissions } from "../../hooks/useActionPermissions";
import { PERMISSION_ACTIONS, isSeniorUser } from "../../utils/actionPermissions";
import KanbanBoard from "./KanbanBoard";
import TaskListView from "./TaskListView";
import TaskCalendarView from "./TaskCalendarView";
import TaskDetailDrawer from "./TaskDetailDrawer";
import TaskSettings from "./TaskSettings";
import NotificationSettings from "./NotificationSettings";
import TaskCompletionCelebrate from "./TaskCompletionCelebrate";
import TaskCompletionToast from "./Taskcompletiontoast";
import {
  useGetTodayTaskStatsQuery,
  useGetTodayAssignedDMSummaryQuery,
} from "../../api/taskApi";
import { useGetUnassignedDeliverablesSummaryQuery } from "../../api/projectApi";
import { useGetDMTeamSettingsQuery } from "../../api/settingsApi";
import { useTheme } from "../../contexts/ThemeContext";

const { Title, Text } = Typography;

const TasksPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: user } = useAuth();
  const userRole = user?.role;
  const { canAdd: canCreatePermission, canCreate: canCreateAction, canEdit } = useActionPermissions("/tasks");
  const isSenior = isSeniorUser(user, userRole);
  const canCreate = isSenior || canCreatePermission || canCreateAction;
  
  const getBaseRoute = () => {
    if (location.pathname.startsWith("/client")) return "/client/workspace";
    if (location.pathname.startsWith("/agency")) return "/agency/workspace";
    if (location.pathname.startsWith("/user")) return "/user/workspace";
    return "/workspace";
  };

  const adminRoles = [
    "supreme_super_admin",
    "commander_admin",
    "agency_super_admin",
    "brand_super_admin",
    "agency_manager",
    "brand_manager"
  ];
  const isAdmin = isSenior || adminRoles.includes(userRole);
  const userType = (user?.type || "").toLowerCase().trim();
  const isIntern = userType === "intern";
  const isSEO = false; // Default-Allow model
  const isSEOFullTime = false;

  // Allow create if: the role has explicit Create permission from useActionPermissions or is senior
  const canCreateTask = !isIntern && canCreate && (!isSEO || isSEOFullTime);

  // Define roles that can view tasks (all regular users + admins)
  const rolesWithTaskAccess = [
    "super_admin",
    "admin",
    "operations_head",
    "digital_marketing_manager",
    "designer",
    "editor",
    "developer",
    "sales_manager",
    "salesperson",
    "seo",
  ];

  const [viewMode, setViewMode] = useState("kanban"); // 'kanban' | 'list' | 'calendar'
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const isToday = selectedDate ? dayjs(selectedDate).isSame(dayjs(), "day") : true;
  const dateLabel = isToday ? "Today" : selectedDate ? dayjs(selectedDate).format("DD MMM") : "Today";
  const fullDateLabel = isToday ? "Today" : selectedDate ? dayjs(selectedDate).format("DD MMM YYYY") : "Today";
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedTask, setSelectedTask] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("workflow");
  const [drawerWidth, setDrawerWidth] = useState(900);
  const [isMobile, setIsMobile] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastCount, setToastCount] = useState(0);
  const [toastTotal, setToastTotal] = useState(0);
  const [isTaskTypeModalOpen, setIsTaskTypeModalOpen] = useState(false);
  const [pendingInitialStatus, setPendingInitialStatus] = useState(null);

  const { data: todayStatsData, refetch: refetchTodayStats, isLoading: isTodayStatsLoading } =
    useGetTodayTaskStatsQuery(undefined, {
      skip: !user?._id,
    });
  const todayStats = todayStatsData?.data || {
    completedToday: 0,
    totalToday: 0,
  };
  const [isPosterModalOpen, setIsPosterModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isTodayAssignedModalOpen, setIsTodayAssignedModalOpen] = useState(false);
  const [isTodayUnassignedModalOpen, setIsTodayUnassignedModalOpen] = useState(false);
  const [isRemainingProjectTasksModalOpen, setIsRemainingProjectTasksModalOpen] = useState(false);

  const canViewTaskInsightCards =
    ["admin", "super_admin", "agency_manager", "agency_super_admin"].includes(userRole) ||
    userRole?.toLowerCase().includes("digital-marketing") ||
    user?.team?.toLowerCase().includes("marketing");

  const { data: unassignedSummaryData, isLoading: isUnassignedSummaryLoading } =
    useGetUnassignedDeliverablesSummaryQuery(undefined, {
      skip: !canViewTaskInsightCards,
    });
  const { data: todayAssignedDMData, isLoading: isTodayAssignedLoading } =
    useGetTodayAssignedDMSummaryQuery(
      { date: selectedDate ? selectedDate.format("YYYY-MM-DD") : null },
      {
        skip: !canViewTaskInsightCards,
      }
    );

  const { data: dmSettingsData } = useGetDMTeamSettingsQuery();
  const dmSettings = dmSettingsData?.data?.dmTeam || {};
  const { data: rolesData } = useGetRolesQuery();
  const allRoles = rolesData?.data || [];
  const { data: departmentsResp } = useGetDepartmentsDynamicQuery();
  const departments = departmentsResp?.data?.departments || [];

  const unassignedSummary = unassignedSummaryData?.data?.summary || {};
  const posterProjects = unassignedSummary.posterProjects || [];
  const videoProjects = unassignedSummary.videoProjects || [];
  const todayAssignedSummary = todayAssignedDMData?.data?.summary || {};
  const assignedGrouped = todayAssignedSummary.breakdown || [];
  const todayAssignedUsers = todayAssignedSummary.users || [];
  const totalPendingTasksCount = todayAssignedSummary.totalPendingTasks || 0;
  const totalCompletedTodayCount = todayAssignedSummary.totalCompletedToday || 0;
  const totalTodoCount = todayAssignedSummary.totalTodoCount || 0;
  const totalInProgressCount = todayAssignedSummary.totalInProgressCount || 0;
  const totalReviewCount = todayAssignedSummary.totalReviewCount || 0;
  const totalHoldCount = todayAssignedSummary.totalHoldCount || 0;

  const [userModalSearch, setUserModalSearch] = useState("");
  const [userModalDeptFilter, setUserModalDeptFilter] = useState("all");
  const [userModalViewFilter, setUserModalViewFilter] = useState("all"); // 'all' | 'assigned_today' | 'active' | 'in_review' | 'completed'
  const [userModalActiveTab, setUserModalActiveTab] = useState("team");
  const [userTaskViewMode, setUserTaskViewMode] = useState({}); // { [userId]: 'all' | 'todo' | 'in_progress' | 'review' | 'completed' | 'hold' }

  const filteredAssignedUsers = useMemo(() => {
    return todayAssignedUsers.filter((u) => {
      // 1. Department filter
      if (userModalDeptFilter !== "all") {
        const matchesDept =
          (u.departmentId && u.departmentId.toString() === userModalDeptFilter) ||
          (u.departmentName && u.departmentName.toLowerCase() === userModalDeptFilter.toLowerCase());
        if (!matchesDept) return false;
      }
      // 2. View filter
      if (userModalViewFilter === "assigned_today" && u.todayAssignedCount === 0) {
        return false;
      }
      if (userModalViewFilter === "active" && (u.todoCount + u.inProgressCount) === 0) {
        return false;
      }
      if (userModalViewFilter === "in_review" && u.reviewCount === 0) {
        return false;
      }
      if (userModalViewFilter === "completed" && u.completedCount === 0) {
        return false;
      }
      // 3. Search text
      if (userModalSearch.trim()) {
        const s = userModalSearch.toLowerCase().trim();
        const matchesUser =
          (u.name && u.name.toLowerCase().includes(s)) ||
          (u.email && u.email.toLowerCase().includes(s)) ||
          (u.roleName && u.roleName.toLowerCase().includes(s)) ||
          (u.departmentName && u.departmentName.toLowerCase().includes(s));

        const matchesTask =
          (u.todayTasks || []).some(
            (t) =>
              t.title?.toLowerCase().includes(s) ||
              t.projectName?.toLowerCase().includes(s) ||
              t.clientName?.toLowerCase().includes(s)
          );

        if (!matchesUser && !matchesTask) return false;
      }
      return true;
    });
  }, [todayAssignedUsers, userModalDeptFilter, userModalViewFilter, userModalSearch]);

  const todayAssignedCreativeTotal = todayAssignedSummary.totalAssignedToday || 0;
  const todayAssignedCreativeTotalLimit = todayAssignedSummary.totalCapacity || 0;
  const todayUnassignedTotalCount = todayAssignedSummary.totalRemaining || 0;

  const remainingProjectTasks =
    Number(unassignedSummary.overallUnassignedPosters || 0) +
    Number(unassignedSummary.overallUnassignedVideos || 0) +
    Number(unassignedSummary.overallUnassignedShoots || 0) +
    Number(unassignedSummary.overallUnassignedDynamic || 0);

  const allPendingProjectsMap = new Map();
  const addProjectToMap = (project, type, count) => {
    const validCount = Number(count) || 0;
    if (validCount <= 0) return;
    if (!allPendingProjectsMap.has(project._id)) {
      allPendingProjectsMap.set(project._id, {
        ...project,
        pendingBreakdown: {},
        totalPending: 0
      });
    }
    const p = allPendingProjectsMap.get(project._id);
    p.pendingBreakdown[type] = (p.pendingBreakdown[type] || 0) + validCount;
    p.totalPending += validCount;
  };

  (unassignedSummary.posterProjects || []).forEach(p => addProjectToMap(p, 'Posters', p.pendingCount));
  (unassignedSummary.videoProjects || []).forEach(p => addProjectToMap(p, 'Videos', p.pendingCount));
  (unassignedSummary.shootProjects || []).forEach(p => addProjectToMap(p, 'Shoots', p.pendingCount));
  (unassignedSummary.dynamicProjects || []).forEach(p => {
    if (p.categories && Array.isArray(p.categories) && p.categories.length > 0) {
      p.categories.forEach(cat => {
        const catName = cat.name || cat.categoryName || 'Other';
        const isStandard = ['poster', 'video', 'shoot'].some(k => catName.toLowerCase().includes(k));
        if (!isStandard) {
          const rem = Math.max(0, Number(cat.remaining) || 0);
          if (rem > 0) {
            addProjectToMap(p, catName, rem);
          }
        }
      });
    } else if (p.pendingCount > 0) {
      addProjectToMap(p, 'Other', p.pendingCount);
    }
  });

  const allPendingProjects = Array.from(allPendingProjectsMap.values()).sort((a, b) => b.totalPending - a.totalPending);


  // Page title based on user role
  const pageTitle = isAdmin ? "Tasks" : "My Tasks";

  // Calculate responsive drawer width
  useEffect(() => {
    const calculateWidth = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      setIsMobile(mobile);

      if (mobile) {
        // Mobile: full width
        setDrawerWidth("100%");
      } else if (width < 1024) {
        // Tablet: 85% width
        setDrawerWidth("85%");
      } else if (width < 1440) {
        // Small desktop: 900px
        setDrawerWidth(900);
      } else {
        // Large desktop: 1200px
        setDrawerWidth(1200);
      }
    };

    calculateWidth();
    window.addEventListener("resize", calculateWidth);
    return () => window.removeEventListener("resize", calculateWidth);
  }, []);

  const isBrandPortal = location.pathname.startsWith("/client") ||
    ['brand_super_admin', 'brand_admin', 'brand_manager', 'brand_team_user', 'client', 'agency_client'].includes(userRole) ||
    userRole?.startsWith('brand');
  const canManageClients = user?.permissions && (user.permissions['Clients-Accounts']?.Read || user.permissions['Clients-SLA & Success']?.Read);

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setDrawerVisible(true);
  };

  const handleAddTask = (statusId) => {
    if (isBrandPortal) {
      navigate(`${getBaseRoute()}/tasks/new`, { state: { taskTarget: "own_brand", initialStatus: statusId } });
    } else if (userRole === 'commander_admin' || (!canManageClients && !isAdmin)) {
      navigate(`${getBaseRoute()}/tasks/new`, { state: { taskTarget: "own_brand", initialStatus: statusId } });
    } else {
      setPendingInitialStatus(statusId);
      setIsTaskTypeModalOpen(true);
    }
  };

  const handleOpenCreateTask = () => {
    if (isBrandPortal) {
      navigate(`${getBaseRoute()}/tasks/new`, { state: { taskTarget: "own_brand" } });
    } else if (userRole === 'commander_admin' || (!canManageClients && !isAdmin)) {
      navigate(`${getBaseRoute()}/tasks/new`, { state: { taskTarget: "own_brand" } });
    } else {
      setPendingInitialStatus(null);
      setIsTaskTypeModalOpen(true);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setSelectedTask(null);
  };

  const handleTaskCompleted = async (counts = null) => {
    if (!user?._id) return;

    let totalToday = counts?.totalCount;
    let completedToday = counts?.completedCount;

    if (totalToday === undefined || completedToday === undefined) {
      // Small delay to ensure DB consistency before refetching stats
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        const result = await refetchTodayStats();
        const stats = result.data?.data || result.data || {};
        totalToday = stats.totalToday || 0;
        completedToday = stats.completedToday || 0;
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    }

    if (totalToday > 0 && completedToday >= totalToday) {
      // Trigger full celebration overlay ONLY when ALL assigned tasks for today are completed!
      setShowCelebration(true);
      setShowToast(false);
    } else {
      // Show top-right tooltip toast for intermediate task completions
      setToastCount(completedToday || 1);
      setToastTotal(totalToday > 0 ? totalToday : (completedToday || 1) + 1);
      setShowToast(true);
      setShowCelebration(false);
    }
  };

  // Handle celebration triggered via navigation state (e.g. from TaskForm)
  useEffect(() => {
    if (location.state?.triggerCelebration && user?._id) {
      handleTaskCompleted();
      // Clear state so it doesn't trigger again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, user?._id]);

  const tabItems = [
    {
      key: "kanban",
      label: (
        <span>
          <AppstoreOutlined /> Kanban
        </span>
      ),
      children: (
        <KanbanBoard
          onTaskClick={handleTaskClick}
          onAddTask={handleAddTask}
          departmentFilter={selectedDepartment}
          onTaskCompleted={handleTaskCompleted}
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
        />
      ),
    },
    {
      key: "list",
      label: (
        <span>
          <UnorderedListOutlined /> List
        </span>
      ),
      children: (
        <TaskListView
          onTaskClick={handleTaskClick}
          departmentFilter={selectedDepartment}
          onTaskCompleted={handleTaskCompleted}
        />
      ),
    },
    {
      key: "calendar",
      label: (
        <span>
          <CalendarOutlined /> Calendar View
        </span>
      ),
      children: (
        <TaskCalendarView
          onTaskClick={handleTaskClick}
          departmentFilter={selectedDepartment}
        />
      ),
    },
  ];

  const isUserPortal = location.pathname.startsWith("/user");

  const { data: rolesResp } = useGetRolesQuery();
  const roles = rolesResp?.data || [];

  const userDepartmentSlug = useMemo(() => {
    return resolveUserDepartmentSlug(user, departments, roles);
  }, [user, departments, roles]);

  const isGlobalAdmin = useMemo(() => {
    return user && [
      "super_admin",
      "admin",
      "operations_head",
      "agency_super_admin",
      "agency_manager",
      "commander_admin",
      "supreme_super_admin",
    ].includes(user.role);
  }, [user]);

  const departmentTabItems = useMemo(() => {
    const base = [{ value: "all", label: "All Departments" }];
    const dynamicItems = departments
      .filter((d) => {
        // Hide "General" from non-admin/client roles
        if (d.slug === "general" || d.name?.toLowerCase() === "general") {
          return ["admin", "super_admin", "client"].includes(userRole);
        }
        return true;
      })
      .map((d) => ({
        value: getDepartmentIdentifier(d) || d.slug || (d.name ? d.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : d._id),
        label: d.name,
      }));
    return [...base, ...dynamicItems];
  }, [departments, userRole]);

  const hasInitializedDept = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (!hasInitializedDept.current) {
      if (isGlobalAdmin || isUserPortal) {
        setSelectedDepartment("all");
      } else if (userDepartmentSlug) {
        setSelectedDepartment(userDepartmentSlug);
      } else {
        setSelectedDepartment("all");
      }
      hasInitializedDept.current = true;
    }
  }, [user, isGlobalAdmin, isUserPortal, userDepartmentSlug]);

  const settingsTabItems = [
    {
      key: "workflow",
      label: "Workflow Configuration",
      children: <TaskSettings />,
    },
    {
      key: "notifications",
      label: "Notification Settings",
      children: <NotificationSettings />,
    },
  ];

  const getProjectStatusTagColor = (status) => {
    const s = (status || "").toLowerCase();
    if (["in_progress", "assigned"].includes(s)) return "processing";
    if (["completed", "done", "validated"].includes(s)) return "success";
    if (["on_hold", "pending", "review"].includes(s)) return "warning";
    if (["cancelled", "rejected"].includes(s)) return "error";
    return "default";
  };

  const getTaskStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    if (["completed", "done", "complete", "validated"].includes(s)) return <Tag color="green">Completed</Tag>;
    if (["in_progress", "in progress"].includes(s)) return <Tag color="processing">In Progress</Tag>;
    if (["review", "in_review", "in review", "submitted", "reviewing"].includes(s)) return <Tag color="purple">In Review</Tag>;
    if (["to_do", "to do", "backlog", "created", "assigned"].includes(s)) return <Tag color="cyan">To Do</Tag>;
    if (["hold", "on_hold"].includes(s)) return <Tag color="default">Hold</Tag>;
    if (["rejected", "Rejected"].includes(s)) return <Tag color="error">Rejected</Tag>;
    return <Tag>{status || "Pending"}</Tag>;
  };

  const getPriorityBadge = (priority) => {
    const p = (priority || "").toLowerCase();
    if (p === "critical") return <Tag color="#f5222d" style={{ fontWeight: 600 }}>Critical</Tag>;
    if (p === "high") return <Tag color="#fa8c16">High</Tag>;
    if (p === "medium") return <Tag color="#1890ff">Medium</Tag>;
    return <Tag color="#52c41a">Low</Tag>;
  };

  const getUserInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const summaryCardBase = {
    borderRadius: 14,
    overflow: "hidden",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: isDark
      ? "0 8px 20px rgba(0,0,0,0.35)"
      : "0 8px 20px rgba(15,23,42,0.08)",
    border: isDark ? "1px solid #2b2b31" : "1px solid #e8edf3",
    background: isDark ? "#141419" : "#ffffff",
  };

  const summaryCardBody = (tone) => ({
    padding: "14px 16px",
    borderTop: `3px solid ${tone}`,
    background: isDark
      ? `linear-gradient(180deg, ${tone}18 0%, #141419 80%)`
      : `linear-gradient(180deg, ${tone}10 0%, #ffffff 80%)`,
  });

  const summaryValueStyle = {
    fontSize: 30,
    fontWeight: 700,
    lineHeight: 1.1,
    color: isDark ? "#f3f4f6" : "#0f172a",
  };

  return (
    <div>
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? "12px" : "0",
          marginBottom: isMobile ? "16px" : "24px",
        }}
      >
        <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>
          {pageTitle}
        </Title>
        <Space wrap>
          {isAdmin && (
            <Button
              icon={<SettingOutlined />}
              onClick={() => setSettingsVisible(true)}
              size={isMobile ? "small" : "default"}
            >
              Settings
            </Button>
          )}
          {canCreateTask && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreateTask}
              size={isMobile ? "small" : "default"}
            >
              Create Task
            </Button>
          )}
        </Space>
      </div>

      {/* Universal Tracking Reminder for all departments */}
      {userRole !== "client" && (
        <Alert
          message="Tracking Reminder"
          description="Before starting a task, move it to 'In Progress' to begin tracking."
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      {canViewTaskInsightCards && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>

          <Col style={{ flex: 1, minWidth: 200 }}>
            <Card
              hoverable
              onClick={() => setIsTodayAssignedModalOpen(true)}
              styles={{ body: summaryCardBody("#dc2626") }}
              style={summaryCardBase}
            >
              <Statistic
                title={isToday ? "Today Assigned Total Tasks" : `Assigned Tasks (${dateLabel})`}
                value={todayAssignedCreativeTotal || 0}
                loading={isTodayAssignedLoading}
                valueStyle={summaryValueStyle}
                prefix={
                  <TeamOutlined
                    style={{ color: isDark ? "#fca5a5" : "#dc2626" }}
                  />
                }
              />
            </Card>
          </Col>
          <Col style={{ flex: 1, minWidth: 200 }}>
            <Card
              hoverable
              onClick={() => setIsRemainingProjectTasksModalOpen(true)}
              styles={{ body: summaryCardBody("#1890ff") }}
              style={summaryCardBase}
            >
              <Statistic
                title="Remaining Project Deliverables"
                value={remainingProjectTasks}
                loading={isUnassignedSummaryLoading}
                valueStyle={summaryValueStyle}
                prefix={
                  <AppstoreOutlined
                    style={{ color: isDark ? "#91caff" : "#1890ff" }}
                  />
                }
              />
            </Card>
          </Col>
          <Col style={{ flex: 1, minWidth: 200 }}>
            <Card
              hoverable
              onClick={() => setIsTodayUnassignedModalOpen(true)}
              styles={{ body: summaryCardBody("#faad14") }}
              style={summaryCardBase}
            >
              <Statistic
                title="Today Unassigned Tasks"
                value={todayUnassignedTotalCount || 0}
                loading={isTodayAssignedLoading}
                valueStyle={summaryValueStyle}
                prefix={
                  <UserOutlined
                    style={{ color: isDark ? "#ffe58f" : "#faad14" }}
                  />
                }
              />
            </Card>
          </Col>
        </Row>
      )}

      <Tabs
        activeKey={viewMode}
        onChange={setViewMode}
        items={tabItems}
        type={isMobile ? "line" : "card"}
        size={isMobile ? "small" : "default"}
        style={{ marginBottom: 16 }}
        tabBarExtraContent={
          userRole !== "client" && (
            <Select
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              style={{ width: isMobile ? 180 : 300 }}
              options={departmentTabItems}
              placeholder="Filter by Department"
              disabled={isUserPortal || !isGlobalAdmin}
            />
          )
        }
      />

      <TaskDetailDrawer
        task={selectedTask}
        visible={drawerVisible}
        onClose={handleCloseDrawer}
      />

      <Modal
        title="Projects with Unassigned Posters"
        open={isPosterModalOpen}
        onCancel={() => setIsPosterModalOpen(false)}
        footer={null}
        width={700}
      >
        <List
          dataSource={posterProjects}
          locale={{ emptyText: "No projects with pending posters." }}
          renderItem={(project) => (
            <List.Item
              style={{ paddingInline: 0, alignItems: "flex-start" }}
              actions={[<Tag color="blue">{project.pendingCount} pending</Tag>]}
            >
              <List.Item.Meta
                title={
                  <Space
                    style={{ width: "100%", justifyContent: "space-between" }}
                  >
                    <span style={{ fontWeight: 600 }}>{project.name}</span>
                    <Tag color={getProjectStatusTagColor(project.status)}>
                      {(project.status || "").replace(/_/g, " ")}
                    </Tag>
                  </Space>
                }
                description={
                  <span style={{ color: "#6b7280" }}>
                    Client: {project.clientName}
                  </span>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        title="Projects with Unassigned Videos"
        open={isVideoModalOpen}
        onCancel={() => setIsVideoModalOpen(false)}
        footer={null}
        width={700}
      >
        <List
          dataSource={videoProjects}
          locale={{ emptyText: "No projects with pending videos." }}
          renderItem={(project) => (
            <List.Item
              style={{ paddingInline: 0, alignItems: "flex-start" }}
              actions={[
                <Tag color="purple">{project.pendingCount} pending</Tag>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space
                    style={{ width: "100%", justifyContent: "space-between" }}
                  >
                    <span style={{ fontWeight: 600 }}>{project.name}</span>
                    <Tag color={getProjectStatusTagColor(project.status)}>
                      {(project.status || "").replace(/_/g, " ")}
                    </Tag>
                  </Space>
                }
                description={
                  <span style={{ color: "#6b7280" }}>
                    Client: {project.clientName}
                  </span>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 6 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: isDark ? "rgba(220, 38, 38, 0.2)" : "#fee2e2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TeamOutlined style={{ color: "#dc2626", fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: isDark ? "#f3f4f6" : "#111827" }}>
                {isToday ? "Today Assigned Tasks & User Workload" : `Assigned Tasks & User Workload (${fullDateLabel})`}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 400 }}>
                {isToday
                  ? "Breakdown of tasks assigned today, pending workloads, and status details per team member"
                  : `Breakdown of tasks assigned for ${fullDateLabel}, pending workloads, and status details per team member`}
              </div>
            </div>
          </div>
        }
        open={isTodayAssignedModalOpen}
        onCancel={() => setIsTodayAssignedModalOpen(false)}
        footer={null}
        width={920}
        styles={{
          body: {
            maxHeight: "75vh",
            overflowY: "auto",
            paddingRight: 8,
          },
        }}
      >
        {/* Top Summary Metrics */}
        <Row gutter={[10, 10]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} md={4}>
            <Card
              size="small"
              style={{
                borderRadius: 10,
                border: isDark ? "1px solid #3b2222" : "1px solid #fecaca",
                background: isDark ? "rgba(220, 38, 38, 0.12)" : "#fef2f2",
              }}
              styles={{ body: { padding: "8px 12px" } }}
            >
              <Space direction="vertical" size={1} style={{ width: "100%" }}>
                <span style={{ color: isDark ? "#fca5a5" : "#991b1b", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                  {isToday ? "Today Assigned" : `${dateLabel} Assigned`}
                </span>
                <Statistic
                  value={todayAssignedCreativeTotal || 0}
                  loading={isTodayAssignedLoading}
                  valueStyle={{ fontSize: 20, fontWeight: 800, color: isDark ? "#f87171" : "#dc2626" }}
                  prefix={<TeamOutlined style={{ fontSize: 15 }} />}
                />
              </Space>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card
              size="small"
              style={{
                borderRadius: 10,
                border: isDark ? "1px solid #16363a" : "1px solid #a5f3fc",
                background: isDark ? "rgba(6, 182, 212, 0.12)" : "#ecfeff",
              }}
              styles={{ body: { padding: "8px 12px" } }}
            >
              <Space direction="vertical" size={1} style={{ width: "100%" }}>
                <span style={{ color: isDark ? "#67e8f9" : "#0e7490", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                  To Do
                </span>
                <Statistic
                  value={totalTodoCount || 0}
                  loading={isTodayAssignedLoading}
                  valueStyle={{ fontSize: 20, fontWeight: 800, color: isDark ? "#22d3ee" : "#0891b2" }}
                  prefix={<ClockCircleOutlined style={{ fontSize: 15 }} />}
                />
              </Space>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card
              size="small"
              style={{
                borderRadius: 10,
                border: isDark ? "1px solid #1e2e4a" : "1px solid #bfdbfe",
                background: isDark ? "rgba(37, 99, 235, 0.12)" : "#eff6ff",
              }}
              styles={{ body: { padding: "8px 12px" } }}
            >
              <Space direction="vertical" size={1} style={{ width: "100%" }}>
                <span style={{ color: isDark ? "#93c5fd" : "#1e40af", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                  In Progress
                </span>
                <Statistic
                  value={totalInProgressCount || 0}
                  loading={isTodayAssignedLoading}
                  valueStyle={{ fontSize: 20, fontWeight: 800, color: isDark ? "#60a5fa" : "#2563eb" }}
                  prefix={<SyncOutlined spin style={{ fontSize: 15 }} />}
                />
              </Space>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card
              size="small"
              style={{
                borderRadius: 10,
                border: isDark ? "1px solid #3b1e4a" : "1px solid #e9d5ff",
                background: isDark ? "rgba(147, 51, 234, 0.12)" : "#faf5ff",
              }}
              styles={{ body: { padding: "8px 12px" } }}
            >
              <Space direction="vertical" size={1} style={{ width: "100%" }}>
                <span style={{ color: isDark ? "#d8b4fe" : "#6b21a8", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                  In Review
                </span>
                <Statistic
                  value={totalReviewCount || 0}
                  loading={isTodayAssignedLoading}
                  valueStyle={{ fontSize: 20, fontWeight: 800, color: isDark ? "#c084fc" : "#9333ea" }}
                  prefix={<EyeOutlined style={{ fontSize: 15 }} />}
                />
              </Space>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card
              size="small"
              style={{
                borderRadius: 10,
                border: isDark ? "1px solid #1a3826" : "1px solid #bbf7d0",
                background: isDark ? "rgba(22, 163, 74, 0.12)" : "#f0fdf4",
              }}
              styles={{ body: { padding: "8px 12px" } }}
            >
              <Space direction="vertical" size={1} style={{ width: "100%" }}>
                <span style={{ color: isDark ? "#86efac" : "#166534", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                  Completed
                </span>
                <Statistic
                  value={totalCompletedTodayCount || 0}
                  loading={isTodayAssignedLoading}
                  valueStyle={{ fontSize: 20, fontWeight: 800, color: isDark ? "#4ade80" : "#16a34a" }}
                  prefix={<CheckCircleOutlined style={{ fontSize: 15 }} />}
                />
              </Space>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card
              size="small"
              style={{
                borderRadius: 10,
                border: isDark ? "1px solid #2b2b35" : "1px solid #e2e8f0",
                background: isDark ? "rgba(255, 255, 255, 0.04)" : "#f8fafc",
              }}
              styles={{ body: { padding: "8px 12px" } }}
            >
              <Space direction="vertical" size={1} style={{ width: "100%" }}>
                <span style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                  Team Members
                </span>
                <Statistic
                  value={todayAssignedUsers.length || 0}
                  loading={isTodayAssignedLoading}
                  valueStyle={{ fontSize: 20, fontWeight: 800, color: isDark ? "#e2e8f0" : "#334155" }}
                  prefix={<UserOutlined style={{ fontSize: 15 }} />}
                />
              </Space>
            </Card>
          </Col>
        </Row>

        {/* View Switcher if Role limits breakdown is also available */}
        {assignedGrouped.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <Segmented
              value={userModalActiveTab}
              onChange={setUserModalActiveTab}
              options={[
                { label: `Team Members Workload (${todayAssignedUsers.length})`, value: "team", icon: <UserOutlined /> },
                { label: `Configured Role Limits (${assignedGrouped.length} depts)`, value: "roles", icon: <AppstoreOutlined /> },
              ]}
              block
            />
          </div>
        )}

        {userModalActiveTab === "roles" ? (
          /* Role Limits Breakdown View */
          <div>
            {assignedGrouped.map((dept) => (
              <div key={dept.departmentId} style={{ marginBottom: 16 }}>
                <Title level={5} style={{ marginBottom: 8, color: "var(--accent-primary)", borderBottom: "1px solid #f0f0f0", paddingBottom: 4 }}>
                  {dept.departmentName}
                </Title>
                <List
                  dataSource={dept.roles}
                  renderItem={(row) => (
                    <List.Item
                      style={{ paddingInline: 0, alignItems: "flex-start" }}
                      actions={[
                        <Space key={`row-metrics-${row.roleId}`} size={6}>
                          <Tag color="red">Assigned: {row.assignedToday}</Tag>
                          <Tag color="blue">Limit: {row.dailyLimit}</Tag>
                          <Tag color={row.remaining > 0 ? "gold" : "green"}>
                            Remaining: {row.remaining}
                          </Tag>
                        </Space>,
                      ]}
                    >
                      <List.Item.Meta title={row.roleName} />
                    </List.Item>
                  )}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Team Members Workload & Details View */
          <div>
            {/* Search & Filter Bar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
                padding: "10px 12px",
                background: isDark ? "#1a1a22" : "#f8fafc",
                borderRadius: 8,
                border: isDark ? "1px solid #2b2b35" : "1px solid #e2e8f0",
              }}
            >
              <Input
                placeholder="Search member, role, email, or task..."
                prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
                value={userModalSearch}
                onChange={(e) => setUserModalSearch(e.target.value)}
                allowClear
                style={{ width: isMobile ? "100%" : 260 }}
              />

              <Space wrap>
                <Select
                  value={userModalDeptFilter}
                  onChange={setUserModalDeptFilter}
                  style={{ width: 160 }}
                  options={departmentTabItems}
                  placeholder="Department"
                />

                <Segmented
                  value={userModalViewFilter}
                  onChange={setUserModalViewFilter}
                  options={[
                    { label: `All (${todayAssignedUsers.length})`, value: "all" },
                    {
                      label: `Assigned (${todayAssignedUsers.filter((u) => u.todayAssignedCount > 0).length})`,
                      value: "assigned_today",
                    },
                    {
                      label: `Active (${todayAssignedUsers.filter((u) => (u.todoCount + u.inProgressCount) > 0).length})`,
                      value: "active",
                    },
                    {
                      label: `Review (${todayAssignedUsers.filter((u) => u.reviewCount > 0).length})`,
                      value: "in_review",
                    },
                    {
                      label: `Done (${todayAssignedUsers.filter((u) => u.completedCount > 0).length})`,
                      value: "completed",
                    },
                  ]}
                />
              </Space>
            </div>

            {/* Users List */}
            {filteredAssignedUsers.length === 0 ? (
              <Empty
                description={`No team members match the selected criteria for ${fullDateLabel}.`}
                style={{ padding: "30px 0" }}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredAssignedUsers.map((u) => {
                  const currentTaskTab = userTaskViewMode[u.userId] || "all";
                  const activeTasks =
                    currentTaskTab === "todo"
                      ? u.todoTasks || []
                      : currentTaskTab === "in_progress"
                      ? u.inProgressTasks || []
                      : currentTaskTab === "review"
                      ? u.reviewTasks || []
                      : currentTaskTab === "completed"
                      ? u.completedTasks || []
                      : currentTaskTab === "hold"
                      ? u.holdTasks || []
                      : u.todayTasks || [];

                  return (
                    <Card
                      key={u.userId}
                      size="small"
                      style={{
                        borderRadius: 10,
                        border: isDark
                          ? u.todayAssignedCount > 0 ? "1px solid rgba(220, 38, 38, 0.4)" : "1px solid #2b2b35"
                          : u.todayAssignedCount > 0 ? "1px solid #fecaca" : "1px solid #e2e8f0",
                        background: isDark ? "#141419" : "#ffffff",
                        boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.05)",
                      }}
                      styles={{ body: { padding: "12px 16px" } }}
                    >
                      {/* User Header Row */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar
                            src={u.avatar}
                            style={{
                              backgroundColor: u.todayAssignedCount > 0 ? "#dc2626" : "#4f46e5",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {getUserInitials(u.name)}
                          </Avatar>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 14, color: isDark ? "#f3f4f6" : "#0f172a" }}>
                                {u.name}
                              </span>
                              <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>
                                {u.roleName || "Staff"}
                              </Tag>
                              {u.departmentName && (
                                <Tag color="default" style={{ fontSize: 11, margin: 0 }}>
                                  {u.departmentName}
                                </Tag>
                              )}
                            </div>
                            {u.email && (
                              <span style={{ fontSize: 12, color: "#6b7280" }}>
                                {u.email}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Top KPI Tags */}
                        <Space size={6} wrap>
                          <Tag
                            color="red"
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 6,
                              margin: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            ⚡ Assigned: {u.todayAssignedCount || 0}
                          </Tag>
                          {(u.todoCount || 0) > 0 && (
                            <Tag
                              color="cyan"
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 6,
                                margin: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              📋 To Do: {u.todoCount}
                            </Tag>
                          )}
                          {(u.inProgressCount || 0) > 0 && (
                            <Tag
                              color="processing"
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 6,
                                margin: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              ⏳ In Progress: {u.inProgressCount}
                            </Tag>
                          )}
                          {(u.reviewCount || 0) > 0 && (
                            <Tag
                              color="purple"
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 6,
                                margin: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              🔍 Review: {u.reviewCount}
                            </Tag>
                          )}
                          {(u.completedCount || 0) > 0 && (
                            <Tag
                              color="success"
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 6,
                                margin: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              ✅ Done: {u.completedCount}
                            </Tag>
                          )}
                          {u.dailyLimit !== null && (
                            <Tag color="geekblue" style={{ fontSize: 11, margin: 0 }}>
                              Limit: {u.dailyLimit} (Rem: {u.remaining})
                            </Tag>
                          )}
                        </Space>
                      </div>

                      {/* Status Badges Row */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          padding: "6px 10px",
                          background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
                          borderRadius: 6,
                          marginBottom: 10,
                          alignItems: "center",
                          fontSize: 11,
                        }}
                      >
                        <span style={{ color: "#6b7280", fontWeight: 600, marginRight: 2 }}>
                          {dateLabel} Status:
                        </span>
                        <Tag color="cyan" style={{ margin: 0, fontSize: 11 }}>
                          To Do: <strong>{u.todoCount || 0}</strong>
                        </Tag>
                        <Tag color="processing" style={{ margin: 0, fontSize: 11 }}>
                          In Progress: <strong>{u.inProgressCount || 0}</strong>
                        </Tag>
                        <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>
                          Review: <strong>{u.reviewCount || 0}</strong>
                        </Tag>
                        {u.holdCount > 0 && (
                          <Tag color="default" style={{ margin: 0, fontSize: 11 }}>
                            Hold: <strong>{u.holdCount}</strong>
                          </Tag>
                        )}
                        {u.completedCount > 0 && (
                          <Tag color="success" style={{ margin: 0, fontSize: 11 }}>
                            Completed: <strong>{u.completedCount}</strong>
                          </Tag>
                        )}
                      </div>

                      {/* Tasks Segmented Switcher */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                          overflowX: "auto",
                        }}
                      >
                        <Segmented
                          size="small"
                          value={currentTaskTab}
                          onChange={(val) =>
                            setUserTaskViewMode((prev) => ({ ...prev, [u.userId]: val }))
                          }
                          options={[
                            {
                              label: `All Tasks (${u.todayTasks?.length || 0})`,
                              value: "all",
                            },
                            {
                              label: `To Do (${u.todoCount || 0})`,
                              value: "todo",
                            },
                            {
                              label: `In Progress (${u.inProgressCount || 0})`,
                              value: "in_progress",
                            },
                            {
                              label: `In Review (${u.reviewCount || 0})`,
                              value: "review",
                            },
                            {
                              label: `Completed (${u.completedCount || 0})`,
                              value: "completed",
                            },
                            ...(u.holdCount > 0
                              ? [{ label: `Hold (${u.holdCount})`, value: "hold" }]
                              : []),
                          ]}
                        />
                      </div>

                      {/* Tasks List */}
                      {activeTasks.length === 0 ? (
                        <div
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            fontSize: 12,
                            color: "#9ca3af",
                            background: isDark ? "rgba(255,255,255,0.02)" : "#fafafa",
                            borderRadius: 6,
                          }}
                        >
                          {currentTaskTab === "todo"
                            ? `No To Do tasks for ${dateLabel}`
                            : currentTaskTab === "in_progress"
                            ? `No In Progress tasks for ${dateLabel}`
                            : currentTaskTab === "review"
                            ? `No tasks In Review for ${dateLabel}`
                            : currentTaskTab === "completed"
                            ? `No completed tasks for ${dateLabel}`
                            : currentTaskTab === "hold"
                            ? `No Hold tasks for ${dateLabel}`
                            : `No tasks assigned for ${dateLabel}`}
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            maxHeight: 220,
                            overflowY: "auto",
                            paddingRight: 4,
                          }}
                        >
                          {activeTasks.map((t) => (
                            <div
                              key={t._id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "6px 10px",
                                background: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
                                border: isDark ? "1px solid #2b2b35" : "1px solid #f1f5f9",
                                borderRadius: 6,
                                transition: "all 0.15s ease",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span
                                    onClick={() => handleTaskClick(t)}
                                    style={{
                                      fontWeight: 600,
                                      fontSize: 13,
                                      color: isDark ? "#93c5fd" : "#1d4ed8",
                                      cursor: "pointer",
                                      textDecoration: "underline",
                                      textDecorationColor: "transparent",
                                      transition: "text-decoration-color 0.15s",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = "currentColor")}
                                    onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = "transparent")}
                                  >
                                    {t.title}
                                  </span>
                                  {t.taskCategory && (
                                    <Tag color="magenta" style={{ fontSize: 10, margin: 0, lineHeight: "16px" }}>
                                      {t.taskCategory}
                                    </Tag>
                                  )}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "#6b7280",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    marginTop: 2,
                                  }}
                                >
                                  {t.projectName && (
                                    <span>
                                      <FolderOutlined style={{ marginRight: 3 }} />
                                      {t.projectName}
                                    </span>
                                  )}
                                  {t.clientName && (
                                    <span>
                                      • Client: <strong>{t.clientName}</strong>
                                    </span>
                                  )}
                                  {t.dueDate && (
                                    <span>
                                      • Due: {dayjs(t.dueDate).format("DD MMM YYYY")}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <Space size={4} style={{ flexShrink: 0 }}>
                                {getTaskStatusBadge(t.status)}
                                {getPriorityBadge(t.priority)}
                                <Button
                                  size="small"
                                  type="link"
                                  icon={<EyeOutlined />}
                                  onClick={() => handleTaskClick(t)}
                                  style={{ fontSize: 11, padding: "0 4px" }}
                                >
                                  View
                                </Button>
                              </Space>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="Projects with Remaining Tasks"
        open={isRemainingProjectTasksModalOpen}
        onCancel={() => setIsRemainingProjectTasksModalOpen(false)}
        footer={null}
        width={700}
        styles={{
          body: {
            maxHeight: "60vh",
            overflowY: "auto",
            paddingRight: 8,
          },
        }}
      >
        <List
          dataSource={allPendingProjects}
          locale={{ emptyText: "No projects with pending tasks." }}
          renderItem={(project) => (
            <List.Item
              style={{ paddingInline: 0, alignItems: "flex-start" }}
              actions={[<Tag color="blue" key="total">{project.totalPending} pending</Tag>]}
            >
              <List.Item.Meta
                title={
                  <Space
                    style={{ width: "100%", justifyContent: "space-between" }}
                  >
                    <span style={{ fontWeight: 600 }}>{project.name}</span>
                    <Tag color={getProjectStatusTagColor(project.status)}>
                      {(project.status || "").replace(/_/g, " ")}
                    </Tag>
                  </Space>
                }
                description={
                  <div>
                    <div style={{ color: "#6b7280", marginBottom: 4 }}>
                      Client: {project.clientName}
                    </div>
                    <Space size={4} wrap>
                      {Object.entries(project.pendingBreakdown).map(([type, count]) => (
                        <Tag key={type}>{type}: {count}</Tag>
                      ))}
                    </Space>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        title="Today Unassigned Tasks - Configured Roles"
        open={isTodayUnassignedModalOpen}
        onCancel={() => setIsTodayUnassignedModalOpen(false)}
        footer={null}
        width={700}
        styles={{
          body: {
            maxHeight: "60vh",
            overflowY: "auto",
            paddingRight: 8,
          },
        }}
      >
        <Card
          size="small"
          style={{
            marginBottom: 14,
            borderRadius: 12,
            border: "1px solid #faad14",
            boxShadow: "0 6px 18px rgba(250, 173, 20, 0.08)",
          }}
          styles={{ body: { padding: "14px 16px" } }}
        >
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
              TODAY UNASSIGNED TASKS (REMAINING CAPACITY)
            </span>
            <Statistic
              value={todayUnassignedTotalCount || 0}
              loading={isTodayAssignedLoading}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: "#111827" }}
              prefix={<UserOutlined style={{ color: "#faad14" }} />}
            />
          </Space>
        </Card>
        {assignedGrouped.length === 0 ? (
          <List
            locale={{ emptyText: "No task capacity configured." }}
            dataSource={[]}
            renderItem={() => null}
          />
        ) : (
          assignedGrouped.map((dept) => (
            <div key={dept.departmentId} style={{ marginBottom: 16 }}>
              <Title level={5} style={{ marginBottom: 8, color: "var(--accent-primary)", borderBottom: "1px solid #f0f0f0", paddingBottom: 4 }}>
                {dept.departmentName}
              </Title>
              <List
                dataSource={dept.roles}
                renderItem={(row) => (
                  <List.Item
                    style={{ paddingInline: 0, alignItems: "flex-start" }}
                    actions={[
                      <Space key={`row-metrics-${row.roleId}`} size={6}>
                        <Tag color={row.remaining > 0 ? "gold" : "green"}>
                          Remaining: {row.remaining}
                        </Tag>
                        <Tag color="blue">Limit: {row.dailyLimit}</Tag>
                        <Tag color="red">Assigned: {row.assignedToday}</Tag>
                      </Space>,
                    ]}
                  >
                    <List.Item.Meta
                      title={row.roleName}
                    />
                  </List.Item>
                )}
              />
            </div>
          ))
        )}
      </Modal>

      <Drawer
        title={
          <Typography.Title level={4} style={{ margin: 0 }}>
            Task Settings
          </Typography.Title>
        }
        placement="right"
        width={drawerWidth}
        open={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        styles={{
          body: {
            padding: isMobile ? "16px" : "24px",
            overflow: "auto",
          },
        }}
        closable={true}
        maskClosable={isMobile}
        destroyOnClose={false}
      >
        <Tabs
          activeKey={activeSettingsTab}
          onChange={setActiveSettingsTab}
          items={settingsTabItems}
          size={isMobile ? "small" : "default"}
          type={isMobile ? "line" : "card"}
        />
      </Drawer>

      <TaskCompletionCelebrate
        visible={showCelebration}
        onClose={() => setShowCelebration(false)}
      />

      <TaskCompletionToast
        visible={showToast}
        count={toastCount}
        total={toastTotal}
        onClose={() => setShowToast(false)}
      />

      <Modal
        title={
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>Who is this task for?</Title>
            <Text type="secondary">Select the target of this task</Text>
          </div>
        }
        open={isTaskTypeModalOpen}
        onCancel={() => setIsTaskTypeModalOpen(false)}
        footer={null}
        width={600}
        centered
      >
        <Row gutter={[16, 16]} justify="center">
          <Col xs={24} sm={12}>
            <Card
              hoverable
              onClick={() => {
                setIsTaskTypeModalOpen(false);
                navigate(`${getBaseRoute()}/tasks/new`, { state: { taskTarget: "client", initialStatus: pendingInitialStatus } });
              }}
              style={{
                textAlign: "center",
                borderRadius: 12,
                border: "2px solid transparent",
                background: isDark ? "#1f1f1f" : "#f8fafc",
                transition: "all 0.3s ease",
              }}
              styles={{ body: { padding: "32px 24px" } }}
              className="task-type-card"
            >
              <BankOutlined style={{ fontSize: 48, color: "var(--accent-primary)", marginBottom: 16 }} />
              <Title level={4} style={{ margin: 0 }}>Client</Title>
              <Text type="secondary">Task for a specific client company</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card
              hoverable
              onClick={() => {
                setIsTaskTypeModalOpen(false);
                navigate(`${getBaseRoute()}/tasks/new`, { state: { taskTarget: "own_brand", initialStatus: pendingInitialStatus } });
              }}
              style={{
                textAlign: "center",
                borderRadius: 12,
                border: "2px solid transparent",
                background: isDark ? "#1f1f1f" : "#f8fafc",
                transition: "all 0.3s ease",
              }}
              styles={{ body: { padding: "32px 24px" } }}
              className="task-type-card"
            >
              <CrownOutlined style={{ fontSize: 48, color: "#8b5cf6", marginBottom: 16 }} />
              <Title level={4} style={{ margin: 0 }}>Own Brand</Title>
              <Text type="secondary">Internal task for your own organization</Text>
            </Card>
          </Col>
        </Row>
      </Modal>
    </div>
  );
};

export default TasksPage;
