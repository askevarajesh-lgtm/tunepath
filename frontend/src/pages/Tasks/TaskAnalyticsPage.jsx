import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import minMax from "dayjs/plugin/minMax";
import isBetween from "dayjs/plugin/isBetween";
dayjs.extend(minMax);
dayjs.extend(isBetween);
import {
  Card,
  Typography,
  Row,
  Col,
  DatePicker,
  Select,
  Tag,
  Avatar,
  Progress,
  Badge,
  Space,
  Divider,
  Button,
  Segmented,
  Spin,
  Alert,
  ConfigProvider,
  theme as antTheme,
  Table,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  SyncOutlined,
  UnorderedListOutlined,
  FilterOutlined,
  ReloadOutlined,
  RiseOutlined,
  FallOutlined,
  UserOutlined,
  CalendarOutlined,
  TrophyOutlined,
  FireOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  HighlightOutlined,
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { useGetTasksQuery } from "../../api/taskApi";
import { useGetUsersDropdownQuery } from "../../api/userApi";
import { useGetDepartmentsDynamicQuery } from "../../api/accessControlApi";
import { useGetDMTeamSettingsQuery } from "../../api/settingsApi";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import TaskDetailDrawer from "./TaskDetailDrawer";
import { isCorrectionTask, isRedesignTask } from "./taskDuration";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// ─── Design Tokens (Base) ─────────────────────────────────────────────────────
const PRIMARY = "#e53935";
const PRIMARY_LIGHT_BASE = "#ffebee";
const PRIMARY_MID = "#ef9a9a";
const PRIMARY_DARK = "#b71c1c";

const SUCCESS = "#2e7d32";
const SUCCESS_BG_BASE = "#e8f5e9";
const WARNING = "#e65100";
const WARNING_BG_BASE = "#fff3e0";
const INFO = "#1565c0";
const INFO_BG_BASE = "#e3f2fd";
const YELLOW = "#f9a825";
const YELLOW_BG_BASE = "#fff8e1";

// Avatar color palette for users
const AVATAR_COLORS = [
  PRIMARY,
  "#1565c0",
  "#2e7d32",
  "#e65100",
  "#6a1b9a",
  "#00838f",
  "#ad1457",
  "#4527a0",
  "#558b2f",
  "#f57f17",
];

// Map backend statuses to display groups
const isCompleted = (status) =>
  ["review", "completed", "validated", "approved", "done", "in_review", "reviewing"].includes(status?.toLowerCase());
const isInProgress = (status) => 
  ["in_progress", "submitted"].includes(status?.toLowerCase());
const isPending = (status) =>
  ["created", "assigned", "backlog", "to_do"].includes(status?.toLowerCase());

// Every task (New, Correction, Redesign) counts as exactly 1 task unit.
const getTaskWorkloadUnits = (task) => 1;

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatDisplayStatus = (status) => {
  if (!status) return "-";
  return status === "in_progress" ? "In Progress" : status.replace(/_/g, " ");
};

const formatRoleLabel = (role) => {
  if (!role) return "N/A";
  return role.replace(/_/g, " ").toUpperCase();
};

const formatExportDate = (value) => {
  if (!value) return "-";
  const date = dayjs(value);
  return date.isValid() ? date.format("YYYY-MM-DD") : "-";
};

const formatExportDateTime = (value) => {
  if (!value) return "-";
  const date = dayjs(value);
  return date.isValid() ? date.format("YYYY-MM-DD HH:mm:ss") : "-";
};

const sanitizeFilePart = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const getDateRangeExportLabel = (range) => {
  if (!range?.[0] || !range?.[1]) return "all_dates";

  const todayStart = dayjs().startOf("day");
  const todayEnd = dayjs().endOf("day");
  const lastWeekStart = dayjs().subtract(7, "day");
  const lastWeekEnd = dayjs();
  const last28Start = dayjs().subtract(28, "day");
  const last28End = dayjs();

  if (range[0].isSame(todayStart, "day") && range[1].isSame(todayEnd, "day"))
    return "today";
  if (
    range[0].isSame(lastWeekStart, "day") &&
    range[1].isSame(lastWeekEnd, "day")
  ) {
    return "last_week";
  }
  if (range[0].isSame(last28Start, "day") && range[1].isSame(last28End, "day"))
    return "last_28_days";

  return `${range[0].format("YYYY-MM-DD")}_to_${range[1].format("YYYY-MM-DD")}`;
};

const getDateRangeDisplayLabel = (range) => {
  if (!range?.[0] || !range?.[1]) return "All Dates";

  const todayStart = dayjs().startOf("day");
  const todayEnd = dayjs().endOf("day");
  const lastWeekStart = dayjs().subtract(7, "day");
  const lastWeekEnd = dayjs();
  const last28Start = dayjs().subtract(28, "day");
  const last28End = dayjs();

  if (range[0].isSame(todayStart, "day") && range[1].isSame(todayEnd, "day"))
    return "Today";
  if (
    range[0].isSame(lastWeekStart, "day") &&
    range[1].isSame(lastWeekEnd, "day")
  ) {
    return "Last Week";
  }
  if (range[0].isSame(last28Start, "day") && range[1].isSame(last28End, "day"))
    return "Last 28 Days";

  return `${range[0].format("MMM D, YYYY")} to ${range[1].format("MMM D, YYYY")}`;
};

const getInitials = (name = "") => {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, isDark, tokens }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: tokens.SURFACE,
        border: `1px solid ${tokens.BORDER}`,
        borderRadius: 10,
        padding: "10px 16px",
        boxShadow: isDark
          ? "0 4px 20px rgba(0,0,0,0.4)"
          : "0 4px 20px rgba(0,0,0,0.10)",
      }}
    >
      <p
        style={{
          color: tokens.TEXT_SUB,
          margin: "0 0 6px",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      {payload.map((p) => (
        <p
          key={p.name}
          style={{ color: p.color, margin: "2px 0", fontSize: 13 }}
        >
          <span style={{ display: "inline-block", width: 90 }}>{p.name}</span>
          <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── Performance Badge ─────────────────────────────────────────────────────────
// ─── Performance Logic & Targets ───────────────────────────────────────────────

const isTargetRole = (role) => {
  const r = role?.toLowerCase() || "";
  return (
    r.includes("designer") ||
    r.includes("video_editor") ||
    r.includes("video editor") ||
    r.includes("seo") ||
    r.includes("website") ||
    r.includes("developer")
  );
};

// NOTE: getFixedDailyTargetForRole is now dynamic — built inside the component
// using admin-configured limits from useGetDMTeamSettingsQuery.

// Map score to tier properties
const getTier = (score, tokens) => {
  if (score >= 100)
    return {
      label: "Elite",
      color: SUCCESS,
      bg: tokens.SUCCESS_BG,
      icon: <TrophyOutlined />,
    };
  if (score >= 80)
    return {
      label: "Strong",
      color: YELLOW,
      bg: tokens.YELLOW_BG,
      icon: <FireOutlined />,
    };
  if (score >= 50)
    return {
      label: "Average",
      color: WARNING,
      bg: tokens.WARNING_BG,
      icon: <ThunderboltOutlined />,
    };
  return {
    label: "Needs Work",
    color: PRIMARY,
    bg: tokens.PRIMARY_LIGHT,
    icon: <RiseOutlined />,
  };
};

const PerformanceBadge = ({ score, tokens }) => {
  const tier = getTier(score, tokens);
  return (
    <Tag
      icon={tier.icon}
      style={{
        background: tier.bg,
        border: `1px solid ${tier.color}25`,
        color: tier.color,
        borderRadius: 20,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {tier.label}
    </Tag>
  );
};

// ─── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, icon, accent, accentBg, trend, tokens }) => (
  <Card
    bordered={false}
    style={{
      background: tokens.SURFACE,
      borderRadius: 14,
      border: `1px solid ${tokens.BORDER}`,
      boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
      overflow: "hidden",
      position: "relative",
    }}
    bodyStyle={{ padding: "20px 20px 18px" }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: accent,
        borderRadius: "14px 14px 0 0",
      }}
    />
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 14,
      }}
    >
      <Text style={{ color: tokens.TEXT_SUB, fontSize: 13, fontWeight: 500 }}>
        {title}
      </Text>
      <div
        style={{
          background: accentBg,
          border: `1px solid ${accent}25`,
          borderRadius: 10,
          padding: "7px 9px",
          color: accent,
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        {icon}
      </div>
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span
        style={{
          fontSize: 38,
          fontWeight: 800,
          color: tokens.TEXT_MAIN,
          lineHeight: 1,
          letterSpacing: "-1px",
        }}
      >
        {value}
      </span>
      {trend !== undefined && (
        <Tag
          style={{
            background: trend >= 0 ? tokens.SUCCESS_BG : tokens.PRIMARY_LIGHT,
            border: "none",
            color: trend >= 0 ? SUCCESS : PRIMARY,
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
          }}
        >
          {trend >= 0 ? <RiseOutlined /> : <FallOutlined />} {Math.abs(trend)}%
        </Tag>
      )}
    </div>
  </Card>
);

// ─── Main Component ────────────────────────────────────────────────────────────
const TaskAnalyticsPage = () => {
  const { isDark } = useTheme();
  const { token: antdToken } = antTheme.useToken();
  const { user } = useAuth();
  const selectedClientId = null;
  const userRole = user?.role;

  // Dynamic tokens based on theme
  const tokens = useMemo(
    () => ({
      SURFACE: isDark ? "#1d1d1d" : "#ffffff",
      SURFACE_2: isDark ? "#141414" : "#f5f6fa",
      BORDER: isDark ? "#303030" : "#e8eaf0",
      TEXT_MAIN: isDark ? "#ffffff" : "#1a1f36",
      TEXT_SUB: isDark ? "#a6a6a6" : "#6b7280",
      TEXT_MUTED: isDark ? "#595959" : "#9ca3af",
      PRIMARY_LIGHT: isDark ? "rgba(229, 57, 53, 0.15)" : "#ffebee",
      SUCCESS_BG: isDark ? "rgba(46, 125, 50, 0.15)" : "#e8f5e9",
      WARNING_BG: isDark ? "rgba(230, 81, 0, 0.15)" : "#fff3e0",
      INFO_BG: isDark ? "rgba(21, 101, 192, 0.15)" : "#e3f2fd",
      YELLOW_BG: isDark ? "rgba(249, 168, 37, 0.15)" : "#fff8e1",
      PURPLE: "#722ed1",
      PURPLE_BG: isDark ? "rgba(114, 46, 209, 0.15)" : "#f9f0ff",
      ORANGE: "#fa8c16",
      ORANGE_BG: isDark ? "rgba(250, 140, 22, 0.15)" : "#fff7e6",
    }),
    [isDark],
  );

  const getTodayRange = () => [dayjs().startOf("day"), dayjs().endOf("day")];
  const [dateRange, setDateRange] = useState(getTodayRange);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [chartView, setChartView] = useState("Bar");
  const [performanceView, setPerformanceView] = useState("completed");
  const [selectedTask, setSelectedTask] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(null); // 'Correction' or 'Redesign'

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setSelectedTask(null);
  };

  const isSingleDay = useMemo(() => {
    return dateRange && dateRange[0].isSame(dateRange[1], "day");
  }, [dateRange]);
  const rangeDays = useMemo(() => {
    if (!dateRange?.[0] || !dateRange?.[1]) return 1;
    return Math.max(
      1,
      dateRange[1].startOf("day").diff(dateRange[0].startOf("day"), "day") + 1,
    );
  }, [dateRange]);

  // ─── Fetch all tasks (no limit — admin sees all) ──────────────────────────
  const {
    data: tasksData,
    isLoading: tasksLoading,
    isError: tasksError,
  } = useGetTasksQuery(
    {
      limit: 1000,
      department: selectedDepartment,
      ...(selectedClientId ? { companyId: selectedClientId } : {}),
    },
    { refetchOnMountOrArgChange: true },
  );

  // ─── Fetch users (dropdown) for filter ───────────────────────────────────
  const { data: usersData, isLoading: usersLoading } = useGetUsersDropdownQuery(
    { limit: 200 },
    { refetchOnMountOrArgChange: true },
  );
  const { data: departmentsResp } = useGetDepartmentsDynamicQuery();
  const departments = departmentsResp?.data?.departments || [];

  // Dynamic DM team daily task limits (admin-configurable)
  const { data: dmTeamSettingsData } = useGetDMTeamSettingsQuery();
  const dmTeamSettings = dmTeamSettingsData?.data?.dmTeam;
  const designerDailyLimit = dmTeamSettings?.designerDailyLimit ?? 7;
  const videoEditorDailyLimit = dmTeamSettings?.videoEditorDailyLimit ?? 2;

  // Dynamic replacement for the former static getFixedDailyTargetForRole
  const getFixedDailyTargetForRole = (role) => {
    const r = (role || "").toLowerCase().replace(/\s+/g, "_");
    if (r.includes("designer")) return designerDailyLimit;
    if (r.includes("video_editor")) return videoEditorDailyLimit;
    return null;
  };

  const allTasks = useMemo(() => {
    if (!tasksData) return [];
    const raw =
      tasksData?.data?.data ||
      tasksData?.data?.tasks ||
      tasksData?.tasks ||
      tasksData?.data ||
      tasksData;
    return Array.isArray(raw) ? raw : [];
  }, [tasksData]);

  const allUsers = useMemo(() => {
    if (!usersData) return [];
    const raw =
      usersData?.users ||
      usersData?.data?.users ||
      usersData?.data ||
      usersData;
    return Array.isArray(raw) ? raw : [];
  }, [usersData]);

  // Build user lookup map for quick reference
  const userMap = useMemo(() => {
    const map = {};
    allUsers.forEach((u) => {
      map[u._id] = u;
    });
    return map;
  }, [allUsers]);

  // ─── Apply filters ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allTasks.filter((t) => {
      if (selectedUser) {
        const assignedId = t.assignedTo?._id || t.assignedTo;
        if (assignedId !== selectedUser) return false;
      }
      if (selectedStatus) {
        if (selectedStatus === "completed" && !isCompleted(t.status))
          return false;
        if (selectedStatus === "in_progress" && !isInProgress(t.status))
          return false;
        if (selectedStatus === "pending" && !isPending(t.status)) return false;
      }
      if (selectedDepartment) {
        const selectedDeptObj = departments.find((d) => d._id === selectedDepartment);
        const taskDeptId = t.department?._id || t.department;
        const taskDeptSlug = t.department?.slug || t.department;
        const generatedSlug = selectedDeptObj?.slug || (selectedDeptObj?.name ? selectedDeptObj.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : null);
        if (taskDeptId !== selectedDepartment && taskDeptSlug !== generatedSlug) return false;
      }
      if (dateRange?.[0] && dateRange?.[1]) {
        const start = dayjs(t.startDate || t.createdAt).startOf("day");
        const completedAt =
          t.actualCompletionDate ||
          t.completedAt ||
          (isCompleted(t.status) ? t.updatedAt : null);
        const effectiveEnd =
          isCompleted(t.status) && completedAt
            ? dayjs(completedAt).endOf("day")
            : dayjs(t.dueDate || t.createdAt).endOf("day");

        const filterStart = dateRange[0].startOf("day");
        const filterEnd = dateRange[1].endOf("day");
        // Overlap: task.start <= filterEnd AND task.effectiveEnd >= filterStart
        if (start.isAfter(filterEnd) || effectiveEnd.isBefore(filterStart))
          return false;
      }
      return true;
    });
  }, [allTasks, selectedUser, selectedStatus, dateRange, selectedDepartment, departments]);

  // Decoupled counts (ALWAYS count, regardless of status filter)
  const statusAgnosticFiltered = useMemo(() => {
    return allTasks.filter((t) => {
      if (selectedUser) {
        const assignedId = t.assignedTo?._id || t.assignedTo;
        if (assignedId !== selectedUser) return false;
      }
      if (dateRange?.[0] && dateRange?.[1]) {
        const start = dayjs(t.startDate || t.createdAt).startOf("day");
        const completedAt =
          t.actualCompletionDate ||
          t.completedAt ||
          (isCompleted(t.status) ? t.updatedAt : null);
        const effectiveEnd =
          isCompleted(t.status) && completedAt
            ? dayjs(completedAt).endOf("day")
            : dayjs(t.dueDate || t.createdAt).endOf("day");

        const filterStart = dateRange[0].startOf("day");
        const filterEnd = dateRange[1].endOf("day");
        if (start.isAfter(filterEnd) || effectiveEnd.isBefore(filterStart))
          return false;
      }
      if (selectedDepartment) {
        const selectedDeptObj = departments.find((d) => d._id === selectedDepartment);
        const taskDeptId = t.department?._id || t.department;
        const taskDeptSlug = t.department?.slug || t.department;
        const generatedSlug = selectedDeptObj?.slug || (selectedDeptObj?.name ? selectedDeptObj.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : null);
        if (taskDeptId !== selectedDepartment && taskDeptSlug !== generatedSlug) return false;
      }
      return true;
    });
  }, [allTasks, selectedUser, selectedDepartment, dateRange, departments]);

  const total = filtered.reduce((sum, t) => sum + getTaskWorkloadUnits(t), 0);
  const completed = filtered.reduce((sum, t) => {
    if (!isCompleted(t.status)) return sum;
    const completedAt =
      t.actualCompletionDate ||
      t.completedAt ||
      (isCompleted(t.status) ? t.updatedAt : null);

    if (!dateRange) return sum + getTaskWorkloadUnits(t);

    const filterStart = dateRange[0].startOf("day");
    const filterEnd = dateRange[1].endOf("day");

    if (
      completedAt &&
      dayjs(completedAt).isBetween(filterStart, filterEnd, "day", "[]")
    ) {
      return sum + getTaskWorkloadUnits(t);
    }
    return sum;
  }, 0);
  const inProgress = filtered.reduce(
    (sum, t) => sum + (isInProgress(t.status) ? getTaskWorkloadUnits(t) : 0),
    0,
  );
  const pending = filtered.reduce(
    (sum, t) => sum + (isPending(t.status) ? getTaskWorkloadUnits(t) : 0),
    0,
  );
  const corrections = statusAgnosticFiltered.filter((t) =>
    isCorrectionTask(t),
  ).length;
  const redesigns = statusAgnosticFiltered.filter((t) =>
    isRedesignTask(t),
  ).length;

  // ─── Chart data: tasks by date (createdAt) ────────────────────────────────
  const dateChartData = useMemo(() => {
    const map = {};
    filtered.forEach((t) => {
      const start = dayjs(t.startDate || t.createdAt).startOf("day");
      const completedAt =
        t.actualCompletionDate ||
        t.completedAt ||
        (isCompleted(t.status) ? t.updatedAt : null);
      const effectiveEnd =
        isCompleted(t.status) && completedAt
          ? dayjs(completedAt).endOf("day")
          : dayjs(t.dueDate || t.createdAt).endOf("day");

      const filterStart = dateRange ? dateRange[0].startOf("day") : start;
      const filterEnd = dateRange ? dateRange[1].endOf("day") : effectiveEnd;

      const overlapStart = start.isBefore(filterStart) ? filterStart : start;
      const overlapEnd = effectiveEnd.isAfter(filterEnd)
        ? filterEnd
        : effectiveEnd;

      let current = overlapStart;
      while (
        current.isBefore(overlapEnd) ||
        current.isSame(overlapEnd, "day")
      ) {
        const key = current.format("YYYY-MM-DD");
        if (!map[key]) {
          map[key] = {
            raw: key,
            date: formatDate(key),
            Assigned: 0,
            Completed: 0,
            Correction: 0,
            Redesign: 0,
          };
        }
        map[key].Assigned++;

        if (isCorrectionTask(t)) {
          map[key].Correction++;
        } else if (isRedesignTask(t)) {
          map[key].Redesign++;
        }

        // Count completed if the task was finished by the end of this range
        // AND was active on this specific day (following the 'retrospective completion' requirement)
        if (
          completedAt &&
          (dayjs(completedAt).isAfter(current) ||
            dayjs(completedAt).isSame(current, "day"))
        ) {
          map[key].Completed += getTaskWorkloadUnits(t);
        }

        current = current.add(1, "day");
      }
    });
    return Object.values(map).sort((a, b) => a.raw.localeCompare(b.raw));
  }, [filtered, dateRange]);

  // ─── Per-user performance ──────────────────────────────────────────────────
  const userPerf = useMemo(() => {
    const perfMap = {};
    filtered.forEach((t) => {
      const assignedId = t.assignedTo?._id || t.assignedTo;
      if (!assignedId) return;
      if (!perfMap[assignedId]) {
        const u = userMap[assignedId] || t.assignedTo;
        const name = u?.name || "Unknown";
        perfMap[assignedId] = {
          id: assignedId,
          name,
          initials: getInitials(name),
          role: u?.role,
          type: u?.type,
          color:
            AVATAR_COLORS[Object.keys(perfMap).length % AVATAR_COLORS.length],
          profileImage: u?.profileImage || null,
          assigned: 0,
          distinctAssigned: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          corrections: 0,
          redesigns: 0,
        };
      }

      const start = dayjs(t.startDate || t.createdAt).startOf("day");
      const completedAt =
        t.actualCompletionDate ||
        t.completedAt ||
        (isCompleted(t.status) ? t.updatedAt : null);
      const effectiveEnd =
        isCompleted(t.status) && completedAt
          ? dayjs(completedAt).endOf("day")
          : dayjs(t.dueDate || t.createdAt).endOf("day");

      const filterStart = dateRange ? dateRange[0].startOf("day") : start;
      const filterEnd = dateRange ? dateRange[1].endOf("day") : effectiveEnd;
      const overlapStart = start.isBefore(filterStart) ? filterStart : start;
      const overlapEnd = effectiveEnd.isAfter(filterEnd)
        ? filterEnd
        : effectiveEnd;

      const activeDaysInRange = Math.max(
        0,
        overlapEnd.diff(overlapStart, "day") + 1,
      );

      perfMap[assignedId].assigned += activeDaysInRange;
      perfMap[assignedId].distinctAssigned++;

      // Completed units are matched to assigned days to ensure correct performance score
      if (
        completedAt &&
        dayjs(completedAt).isAfter(overlapStart.subtract(1, "day"))
      ) {
        // If completed, add workload units for each active day in the range
        perfMap[assignedId].completed +=
          getTaskWorkloadUnits(t) * activeDaysInRange;
      }

      if (isInProgress(t.status)) perfMap[assignedId].inProgress++;
      else if (isPending(t.status)) perfMap[assignedId].pending++;
    });

    // Populate corrections/redesigns from status-agnostic list to ensure THEY ALWAYS COUNT
    statusAgnosticFiltered.forEach((t) => {
      const assignedId = t.assignedTo?._id || t.assignedTo;
      if (!assignedId || !perfMap[assignedId]) return;

      if (isCorrectionTask(t)) perfMap[assignedId].corrections++;
      if (isRedesignTask(t)) perfMap[assignedId].redesigns++;
    });

    return Object.values(perfMap)
      .map((u) => {
        const actualNewTasks = Math.max(0, u.distinctAssigned - u.corrections - u.redesigns);
        return {
          ...u,
          newTasks: actualNewTasks,
          totalAssignedWorkload: u.distinctAssigned,
        };
      })
      .map((u) => {
        const fixedDailyTarget = getFixedDailyTargetForRole(u.role);
        const assignedBase = u.totalAssignedWorkload || 0;
        const expectedTarget =
          fixedDailyTarget !== null
            ? fixedDailyTarget * rangeDays
            : assignedBase;
        const unassignedCount =
          fixedDailyTarget !== null
            ? Math.max(0, expectedTarget - assignedBase)
            : 0;

        // Designer/Video Editor performance is based on assigned workload
        // (not expected quota), and must never exceed 100%.
        const performanceBase =
          fixedDailyTarget !== null ? assignedBase : expectedTarget;
        const scoreRaw =
          performanceBase > 0 ? (u.completed / performanceBase) * 100 : 0;
        const score = Math.min(100, Math.round(scoreRaw));

        return {
          ...u,
          fixedDailyTarget,
          expectedTarget,
          target: performanceBase,
          performanceBase,
          unassignedCount,
          hasTarget: true,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [
    filtered,
    statusAgnosticFiltered,
    userMap,
    dateRange,
    isSingleDay,
    rangeDays,
    designerDailyLimit,
    videoEditorDailyLimit,
  ]);

  // ─── Performance Tasks Array for Selected User ───────────────────────────────
  const performanceTasksList = useMemo(() => {
    if (!selectedUser) return [];

    const buildCompletionRows = (task) => {
      const isDone = isCompleted(task.status);
      if (!isDone) return [];

      const baseRow = {
        ...task,
        _id: `${task._id}-completion-current`,
      };

      return [baseRow];
    };

    return statusAgnosticFiltered
      .filter((task) => {
        const assignedId = task.assignedTo?._id || task.assignedTo;
        return assignedId === selectedUser;
      })
      .flatMap((task) =>
        performanceView === "completed" ? buildCompletionRows(task) : [task],
      )
      .filter((t) => {
        const isDone = isCompleted(t.status);
        if (performanceView === "completed") {
          if (!isDone) return false;
        } else if (isDone) {
          // "Pending" view shows anything NOT completed
          return false;
        }

        // Apply Category Filter if set
        if (categoryFilter && t.taskCategory !== categoryFilter) return false;

        const start = dayjs(t.startDate || t.createdAt).startOf("day");
        const due = dayjs(t.dueDate || t.createdAt).endOf("day");
        const filterStart = dateRange ? dateRange[0].startOf("day") : start;
        const filterEnd = dateRange ? dateRange[1].endOf("day") : due;

        // For completed tasks, filter by completion date in selected range
        if (performanceView === "completed") {
          const completedAt =
            t.actualCompletionDate ||
            t.completedAt ||
            (isCompleted(t.status) ? t.updatedAt : null);

          if (!completedAt) return false;
          if (
            !dayjs(completedAt).isBetween(filterStart, filterEnd, "day", "[]")
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (performanceView === "completed") {
          const dateA = dayjs(
            a.actualCompletionDate || a.completedAt || a.updatedAt,
          );
          const dateB = dayjs(
            b.actualCompletionDate || b.completedAt || b.updatedAt,
          );
          return dateB.diff(dateA);
        } else {
          const dateA = dayjs(a.dueDate || a.createdAt);
          const dateB = dayjs(b.dueDate || b.createdAt);
          return dateA.diff(dateB);
        }
      });
  }, [
    statusAgnosticFiltered,
    selectedUser,
    performanceView,
    dateRange,
    categoryFilter,
  ]);

  const totalCompleted = userPerf.reduce((s, u) => s + u.completed, 0);
  const totalDistinctAssigned = userPerf.reduce(
    (s, u) => s + (u.totalAssignedWorkload || 0),
    0,
  );

  // For benchmarked roles only (Designer/Video Editor)
  const targetedCompleted = userPerf.reduce(
    (s, u) => s + (u.hasTarget ? u.completed : 0),
    0,
  );
  const targetedTarget = userPerf.reduce((s, u) => s + (u.target || 0), 0);

  const avgScore = useMemo(() => {
    if (userPerf.length === 0) return 0;
    if (isSingleDay) {
      const targetUsers = userPerf.filter(
        (u) => u.hasTarget && u.score !== null,
      );
      if (targetUsers.length === 0) return 0;
      return Math.round(
        targetUsers.reduce((s, u) => s + u.score, 0) / targetUsers.length,
      );
    } else {
      // For ranges: Total Completed / Total Assigned
      if (totalDistinctAssigned === 0) return 0;
      return Math.round((totalCompleted / totalDistinctAssigned) * 100);
    }
  }, [userPerf, isSingleDay, totalCompleted, totalDistinctAssigned]);

  const isDefaultTodayRange =
    !!dateRange?.[0] &&
    !!dateRange?.[1] &&
    dateRange[0].isSame(dayjs().startOf("day"), "day") &&
    dateRange[1].isSame(dayjs().endOf("day"), "day");

  const hasFilters =
    !isDefaultTodayRange ||
    selectedUser ||
    selectedStatus ||
    selectedDepartment ||
    categoryFilter;
  const resetFilters = () => {
    setDateRange(getTodayRange());
    setSelectedUser(null);
    setSelectedStatus(null);
    setSelectedDepartment(null);
    setCategoryFilter(null);
  };

  const exportAnalyticsToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      const generatedAt = formatExportDateTime(dayjs());
      const dateRangeLabel = getDateRangeExportLabel(dateRange);
      const dateRangeDisplayLabel = getDateRangeDisplayLabel(dateRange);
      const selectedUserName = selectedUser
        ? userMap[selectedUser]?.name || "Selected Member"
        : "All Members";
      const selectedDepartmentName = selectedDepartment
        ? departments.find(
            (d) => d._id === selectedDepartment || d.slug === selectedDepartment,
          )?.name || selectedDepartment
        : "All Departments";
      const selectedStatusName = selectedStatus
        ? {
            completed: "Completed",
            in_progress: "In Progress",
            pending: "Pending",
          }[selectedStatus] || selectedStatus
        : "All Statuses";
      const selectedCategoryName = categoryFilter || "All Categories";
      const performanceViewName = performanceView === "completed"
        ? "Completed"
        : "Pending";

      const resolveDepartmentName = (departmentValue) => {
        if (!departmentValue) return "N/A";
        if (typeof departmentValue === "object") {
          return (
            departmentValue.name ||
            departmentValue.slug ||
            departmentValue._id ||
            "N/A"
          );
        }

        const department = departments.find(
          (d) => d._id === departmentValue || d.slug === departmentValue,
        );
        return department?.name || departmentValue || "N/A";
      };

      const resolveAssigneeName = (task) => {
        const assignedId = task.assignedTo?._id || task.assignedTo;
        if (task.assignedTo?.name) return task.assignedTo.name;
        if (assignedId && userMap[assignedId]?.name) {
          return userMap[assignedId].name;
        }
        return "Unassigned";
      };

      const getTaskRowType = (task) => {
        if (typeof task?._id !== "string") return "Task";
        if (task._id.endsWith("-completion-new")) return "New Completion";
        if (task._id.endsWith("-completion-current"))
          return "Current Completion";
        return "Task";
      };

      const getTaskRelevantDate = (task) => {
        const completedDate =
          task.actualCompletionDate ||
          task.completedAt ||
          (isCompleted(task.status) ? task.updatedAt : null);
        return (
          completedDate ||
          task.dueDate ||
          task.startDate ||
          task.createdAt ||
          null
        );
      };

      const activityRowsSource = selectedUser ? performanceTasksList : filtered;

      const summaryRows = [
        ["Task Analytics Export"],
        [],
        ["Generated At", generatedAt],
        ["Date Range", dateRangeDisplayLabel],
        ["Team Member", selectedUserName],
        ["Department", selectedDepartmentName],
        ["Task Status", selectedStatusName],
        ["Category", selectedCategoryName],
        ["Performance View", selectedUser ? performanceViewName : "Team View"],
        [],
        ["Metric", "Value"],
        ["Filtered Tasks", filtered.length],
        ["Assigned Workload", total],
        ["Completed Workload", completed],
        ["In Progress Workload", inProgress],
        ["Pending Workload", pending],
        ["Corrections", corrections],
        ["Redesigns", redesigns],
        ["Completion Rate", `${total ? Math.round((completed / total) * 100) : 0}%`],
        ["Average Score", `${avgScore}%`],
        ["Users in Analytics", userPerf.length],
        ["Activity Detail Rows", activityRowsSource.length],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      summarySheet["!cols"] = [{ wch: 28 }, { wch: 42 }];

      const dailyTrendColumns = [
        "Date",
        "Assigned",
        "Completed",
        "Correction",
        "Redesign",
      ];
      const dailyTrendSheet = XLSX.utils.aoa_to_sheet([dailyTrendColumns]);
      XLSX.utils.sheet_add_json(
        dailyTrendSheet,
        dateChartData.map((row) => ({
          Date: row.date,
          Assigned: row.Assigned,
          Completed: row.Completed,
          Correction: row.Correction,
          Redesign: row.Redesign,
        })),
        { origin: "A2", skipHeader: true },
      );
      dailyTrendSheet["!cols"] = [
        { wch: 16 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
      ];

      const performanceColumns = [
        "Member",
        "Role",
        "Assigned",
        "New",
        "Done",
        "In Progress",
        "Pending",
        "Correction",
        "Redesign",
        "Done / Target",
        "Score (%)",
        "Status",
        "Unassigned",
      ];
      const performanceSheet = XLSX.utils.aoa_to_sheet([performanceColumns]);
      XLSX.utils.sheet_add_json(
        performanceSheet,
        userPerf.map((u) => ({
          Member: u.name,
          Role: formatRoleLabel(u.role),
          Assigned: u.totalAssignedWorkload,
          New: u.newTasks,
          Done: u.completed,
          "In Progress": u.inProgress,
          Pending: u.pending,
          Correction: u.corrections,
          Redesign: u.redesigns,
          "Done / Target": `${u.completed} / ${u.performanceBase}`,
          "Score (%)": u.score,
          Status: getTier(u.score, tokens).label,
          Unassigned: u.unassignedCount,
        })),
        { origin: "A2", skipHeader: true },
      );
      performanceSheet["!cols"] = [
        { wch: 24 },
        { wch: 18 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 16 },
        { wch: 11 },
        { wch: 14 },
        { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(
        workbook,
        performanceSheet,
        "User Analytics",
      );

      const activityRows = activityRowsSource
        .map((task) => {
          const assignedName = resolveAssigneeName(task);
          const relevantDate = getTaskRelevantDate(task);
          const startDate = formatExportDate(task.startDate || task.createdAt);
          const dueDate = formatExportDate(task.dueDate || task.createdAt);
          const completedDate = formatExportDate(
            task.actualCompletionDate ||
              task.completedAt ||
              (isCompleted(task.status) ? task.updatedAt : null),
          );
          const activityDate = formatExportDate(relevantDate);

          return {
            __member: assignedName,
            __activityDate: relevantDate ? dayjs(relevantDate).valueOf() : 0,
            __title: task.title || "",
            Member: assignedName,
            Role: formatRoleLabel(userMap[task.assignedTo?._id || task.assignedTo]?.role),
            "Row Type": getTaskRowType(task),
            "Activity Date": activityDate,
            "Start Date": startDate,
            "Due Date": dueDate,
            "Completed Date": completedDate,
            Title: task.title || "-",
            "Content Type": task.serviceType || "-",
            Category: task.taskCategory || "-",
            Company: task.companyId?.name || "N/A",
            Department: resolveDepartmentName(task.department),
            Status: formatDisplayStatus(task.status),
            "Workload Units": getTaskWorkloadUnits(task),
          };
        })
        .sort((a, b) => {
          const memberDiff = a.__member.localeCompare(b.__member);
          if (memberDiff !== 0) return memberDiff;
          if (a.__activityDate !== b.__activityDate) {
            return a.__activityDate - b.__activityDate;
          }
          return a.__title.localeCompare(b.__title);
        })
        .map(({ __member, __activityDate, __title, ...row }) => row);

      const activityColumns = [
        "Member",
        "Role",
        "Row Type",
        "Activity Date",
        "Start Date",
        "Due Date",
        "Completed Date",
        "Title",
        "Content Type",
        "Category",
        "Company",
        "Department",
        "Status",
        "Workload Units",
      ];
      const activitySheet = XLSX.utils.aoa_to_sheet([activityColumns]);
      XLSX.utils.sheet_add_json(activitySheet, activityRows, {
        origin: "A2",
        skipHeader: true,
      });
      activitySheet["!cols"] = [
        { wch: 22 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 30 },
        { wch: 14 },
        { wch: 14 },
        { wch: 22 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(
        workbook,
        activitySheet,
        "User Activity Details",
      );

      XLSX.utils.book_append_sheet(workbook, dailyTrendSheet, "Daily Trend");

      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

      const fileNameParts = [
        "task_analytics",
        dateRangeLabel,
        selectedUser ? sanitizeFilePart(selectedUserName) : "",
      ].filter(Boolean);

      XLSX.writeFile(workbook, `${fileNameParts.join("_")}.xlsx`);
      message.success("Task analytics exported to Excel");
    } catch (error) {
      console.error("Failed to export task analytics", error);
      message.error("Failed to export task analytics to Excel");
    }
  };

  const sectionCard = {
    background: tokens.SURFACE,
    border: `1px solid ${tokens.BORDER}`,
    borderRadius: 14,
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
    marginTop: 16,
  };

  if (tasksLoading || usersLoading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" tip="Loading analytics data..." />
      </div>
    );
  }

  if (tasksError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="Failed to load task analytics"
          description="There was an error fetching data from the server. Please try again."
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 22,
        }}
      >
        <Title
          level={2}
          style={{
            color: tokens.TEXT_MAIN,
            margin: 0,
            fontWeight: 800,
            letterSpacing: "-0.4px",
          }}
        >
          Task Analytics
        </Title>
        {hasFilters && (
          <Button
            icon={<ReloadOutlined />}
            onClick={resetFilters}
            style={{
              background: tokens.PRIMARY_LIGHT,
              border: `1px solid ${PRIMARY_MID}`,
              color: PRIMARY,
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* ── Layout ─────────────────────────────────────────────────────────── */}
      <Row gutter={[20, 20]} wrap={true}>
        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <Col xs={24} lg={17} xl={18}>
          {/* Stat Cards */}
          <Row gutter={[14, 14]}>
            {[
              {
                title: "Total Tasks Assigned",
                value: total,
                icon: <UnorderedListOutlined />,
                accent: PRIMARY,
                accentBg: tokens.PRIMARY_LIGHT,
              },
              {
                title: "Total Tasks Completed",
                value: completed,
                icon: <CheckCircleOutlined />,
                accent: SUCCESS,
                accentBg: tokens.SUCCESS_BG,
              },
              {
                title: "Total Tasks In Progress",
                value: inProgress,
                icon: <SyncOutlined />,
                accent: WARNING,
                accentBg: tokens.WARNING_BG,
              },
              {
                title: "Total Tasks Pending",
                value: pending,
                icon: <ClockCircleOutlined />,
                accent: INFO,
                accentBg: tokens.INFO_BG,
              },
              {
                title: "Correction Tasks",
                value: corrections,
                icon: <ToolOutlined />,
                accent: tokens.ORANGE,
                accentBg: tokens.ORANGE_BG,
              },
              {
                title: "Redesign Tasks",
                value: redesigns,
                icon: <HighlightOutlined />,
                accent: tokens.PURPLE,
                accentBg: tokens.PURPLE_BG,
              },
            ].map((c) => (
              <Col xs={24} sm={12} md={8} xl={8} key={c.title}>
                <StatCard {...c} tokens={tokens} />
              </Col>
            ))}
          </Row>

          {/* Performance Section */}
          <Card
            bordered={false}
            style={sectionCard}
            headStyle={{
              borderBottom: `1px solid ${tokens.BORDER}`,
              padding: "14px 20px",
            }}
            bodyStyle={{ padding: "14px 20px 20px" }}
            title={
              <Space>
                <div
                  style={{
                    background: isDark ? "rgba(230, 81, 0, 0.15)" : "#fff8e1",
                    borderRadius: 8,
                    padding: "5px 7px",
                    color: "#e65100",
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  <TrophyOutlined />
                </div>
                <Text
                  style={{
                    color: tokens.TEXT_MAIN,
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {selectedUser
                    ? "Separate User Performance"
                    : "Team Performance Score"}
                </Text>
                <Tag
                  style={{
                    background: isDark ? "rgba(230, 81, 0, 0.1)" : "#fff8e1",
                    border: "1px solid #e6510030",
                    color: "#e65100",
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  out of 100
                </Tag>
              </Space>
            }
          >
            {userPerf.length === 0 ? (
              <div
                style={{
                  padding: "24px 0",
                  textAlign: "center",
                  color: tokens.TEXT_MUTED,
                }}
              >
                No assigned task data available.
              </div>
            ) : !selectedUser ? (
              <Table
                dataSource={userPerf}
                columns={[
                  {
                    title: "Member",
                    dataIndex: "name",
                    key: "name",
                    width: 280,
                    render: (text, u) => (
                      <Space size="middle">
                        <Avatar
                          size={36}
                          src={u.profileImage || undefined}
                          style={{ background: u.color, flexShrink: 0 }}
                        >
                          {!u.profileImage && u.initials}
                        </Avatar>
                        <Text
                          strong
                          style={{
                            color: tokens.TEXT_MAIN,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {text}
                        </Text>
                      </Space>
                    ),
                    sorter: (a, b) => a.name.localeCompare(b.name),
                  },
                  {
                    title: "Role",
                    dataIndex: "role",
                    key: "role",
                    width: 180,
                    render: (role) => (
                      <Tag color="blue" style={{ borderRadius: 12 }}>
                        {role ? role.replace("_", " ").toUpperCase() : "N/A"}
                      </Tag>
                    ),
                  },
                  {
                    title: "Assigned",
                    dataIndex: "totalAssignedWorkload",
                    key: "totalAssignedWorkload",
                    sorter: (a, b) =>
                      (a.totalAssignedWorkload || 0) -
                      (b.totalAssignedWorkload || 0),
                    align: "center",
                    render: (v, u) => (
                      <Space size={4}>
                        <Text>{v}</Text>
                        {u.unassignedCount > 0 && (
                          <Tag color="default" style={{ borderRadius: 10 }}>
                            Unassigned: {u.unassignedCount}
                          </Tag>
                        )}
                      </Space>
                    ),
                  },
                  {
                    title: "New",
                    dataIndex: "newTasks",
                    key: "newTasks",
                    sorter: (a, b) => (a.newTasks || 0) - (b.newTasks || 0),
                    align: "center",
                  },
                  {
                    title: "Done",
                    dataIndex: "completed",
                    key: "completed",
                    sorter: (a, b) => a.completed - b.completed,
                    align: "center",
                    render: (v) => <Text style={{ color: SUCCESS }}>{v}</Text>,
                  },
                  {
                    title: "In Progress",
                    dataIndex: "inProgress",
                    key: "inProgress",
                    sorter: (a, b) => a.inProgress - b.inProgress,
                    align: "center",
                  },
                  {
                    title: "Pending",
                    dataIndex: "pending",
                    key: "pending",
                    sorter: (a, b) => a.pending - b.pending,
                    align: "center",
                    render: (v) => <Text style={{ color: INFO }}>{v}</Text>,
                  },
                  {
                    title: "Correction",
                    dataIndex: "corrections",
                    key: "corrections",
                    align: "center",
                    sorter: (a, b) => a.corrections - b.corrections,
                    render: (v) => (
                      <Text style={{ color: tokens.ORANGE, fontWeight: 600 }}>
                        {v}
                      </Text>
                    ),
                  },
                  {
                    title: "Redesign",
                    dataIndex: "redesigns",
                    key: "redesigns",
                    align: "center",
                    sorter: (a, b) => a.redesigns - b.redesigns,
                    render: (v) => (
                      <Text style={{ color: tokens.PURPLE, fontWeight: 600 }}>
                        {v}
                      </Text>
                    ),
                  },
                  {
                    title: "Done / Target",
                    key: "performance",
                    width: 200,
                    render: (_, u) => {
                      const tier = getTier(u.score, tokens);
                      return (
                        <div style={{ minWidth: 160 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 11,
                              marginBottom: 4,
                            }}
                          >
                            <Text strong>
                              {u.completed} / {u.performanceBase}
                            </Text>
                            <Text strong style={{ color: tier.color }}>
                              {u.score}%
                            </Text>
                          </div>
                          <Progress
                            percent={Math.min(100, u.score || 0)}
                            size="small"
                            strokeColor={tier.color}
                            showInfo={false}
                          />
                        </div>
                      );
                    },
                    sorter: (a, b) => (a.score || 0) - (b.score || 0),
                  },
                  {
                    title: "Status",
                    key: "tier",
                    render: (_, u) => (
                      <PerformanceBadge score={u.score} tokens={tokens} />
                    ),
                    align: "center",
                  },
                ]}
                rowKey="id"
                size="middle"
                scroll={{ x: 1000 }}
                onRow={(record) => ({
                  onClick: () => setSelectedUser(record.id),
                  style: { cursor: "pointer" },
                })}
                pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'], hideOnSinglePage: true }}
                style={{
                  background: tokens.SURFACE,
                  borderRadius: 12,
                  overflow: "hidden",
                  border: `1px solid ${tokens.BORDER}`,
                }}
              />
            ) : (
              <>
                {/* ── User Cards — Full-Width Rectangle Row ─────────────────── */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    marginBottom: 28,
                  }}
                >
                  {userPerf.map((u) => {
                    const tier = getTier(u.score, tokens);
                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUser(u.id)}
                        style={{
                          background: isDark ? "#1e1e1e" : "#ffffff",
                          border: `1.5px solid ${u.id === selectedUser ? tier.color + "60" : tokens.BORDER}`,
                          borderRadius: 18,
                          overflow: "hidden",
                          boxShadow: isDark
                            ? "0 4px 24px rgba(0,0,0,0.25)"
                            : `0 2px 16px rgba(0,0,0,0.06)`,
                          cursor: "pointer",
                          transition:
                            "box-shadow 0.2s ease, border-color 0.2s ease",
                          width: "100%",
                        }}
                      >
                        {/* Top accent gradient bar */}
                        <div
                          style={{
                            height: 4,
                            background: `linear-gradient(90deg, ${tier.color}, ${tier.color}55)`,
                          }}
                        />

                        {/* ── Horizontal Rectangle Body ── */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "stretch",
                            justifyContent: "space-between",
                            padding: "20px 24px",
                            gap: 16,
                            flexWrap: "nowrap",
                            overflowX: "auto",
                          }}
                        >
                          {/* ① Avatar + Name — Left Section */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 14,
                              minWidth: 180,
                              flex: "0 0 auto",
                            }}
                          >
                            <Avatar
                              size={52}
                              src={u.profileImage || undefined}
                              style={{
                                background: u.color,
                                fontWeight: 700,
                                fontSize: 17,
                                flexShrink: 0,
                                boxShadow: `0 0 0 3px ${u.color}30`,
                              }}
                            >
                              {!u.profileImage && u.initials}
                            </Avatar>
                            <div>
                              <Text
                                style={{
                                  color: tokens.TEXT_MAIN,
                                  fontWeight: 700,
                                  fontSize: 15,
                                  display: "block",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {u.name}
                              </Text>
                              {u.role && (
                                <Text
                                  style={{
                                    color: tokens.TEXT_MUTED,
                                    fontSize: 12,
                                    display: "block",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {u.role.replace(/_/g, " ")}
                                </Text>
                              )}
                              {u.hasTarget && (
                                <div style={{ marginTop: 6 }}>
                                  <PerformanceBadge
                                    score={u.score}
                                    tokens={tokens}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Divider */}
                          <div
                            style={{
                              width: 1,
                              background: tokens.BORDER,
                              alignSelf: "stretch",
                              flexShrink: 0,
                            }}
                          />

                          {/* ② Performance Progress — Center Section */}
                          <div
                            style={{
                              flex: "0 1 240px",
                              minWidth: 180,
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={{
                                  color: tokens.TEXT_SUB,
                                  fontSize: 12,
                                  fontWeight: 500,
                                }}
                              >
                                Performance (Done vs Target)
                              </Text>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "baseline",
                                  gap: 3,
                                }}
                              >
                                <span
                                  style={{
                                    color: tier.color,
                                    fontWeight: 900,
                                    fontSize: 28,
                                    lineHeight: 1,
                                  }}
                                >
                                  {u.completed}
                                </span>
                                <span
                                  style={{
                                    fontSize: 14,
                                    color: tokens.TEXT_MUTED,
                                    fontWeight: 500,
                                  }}
                                >
                                  /{u.performanceBase}
                                </span>
                              </div>
                            </div>
                            <Progress
                              percent={Math.min(100, u.score)}
                              showInfo={false}
                              strokeColor={{
                                "0%": tier.color,
                                "100%": `${tier.color}aa`,
                              }}
                              trailColor={isDark ? "#3a3a3a" : "#e8eaf0"}
                              strokeWidth={9}
                              strokeLinecap="round"
                            />
                            <Text
                              style={{ fontSize: 11, color: tokens.TEXT_MUTED }}
                            >
                              {u.totalAssignedWorkload} assigned, {u.completed}{" "}
                              completed
                              {u.unassignedCount > 0
                                ? `, ${u.unassignedCount} unassigned`
                                : ""}
                            </Text>
                          </div>

                          {/* Divider */}
                          <div
                            style={{
                              width: 1,
                              background: tokens.BORDER,
                              alignSelf: "stretch",
                              flexShrink: 0,
                            }}
                          />

                          {/* ③ Status Pills — Done / In Progress / Pending */}
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                              flex: "0 0 auto",
                              flexWrap: "nowrap",
                            }}
                          >
                            {[
                              {
                                label: "Done",
                                val: u.completed,
                                color: SUCCESS,
                                bg: tokens.SUCCESS_BG,
                              },
                              {
                                label: "In Progress",
                                val: u.inProgress,
                                color: WARNING,
                                bg: tokens.WARNING_BG,
                              },
                              {
                                label: "Pending",
                                val: u.pending,
                                color: INFO,
                                bg: tokens.INFO_BG,
                              },
                            ].map((s) => (
                              <div
                                key={s.label}
                                style={{
                                  background: s.bg,
                                  border: `1.5px solid ${s.color}25`,
                                  borderRadius: 14,
                                  padding: "10px 2px",
                                  textAlign: "center",
                                  width: 70,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <div
                                  style={{
                                    color: s.color,
                                    fontWeight: 800,
                                    fontSize: 18,
                                    lineHeight: 1,
                                    marginBottom: 4,
                                  }}
                                >
                                  {s.val}
                                </div>
                                <div
                                  style={{
                                    color: tokens.TEXT_MUTED,
                                    fontSize: 8,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.3px",
                                  }}
                                >
                                  {s.label}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Divider */}
                          <div
                            style={{
                              width: 1,
                              background: tokens.BORDER,
                              alignSelf: "stretch",
                              flexShrink: 0,
                            }}
                          />

                          {/* ④ Correction & Redesign — Right Section */}
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                              flex: "0 0 auto",
                              flexWrap: "nowrap",
                            }}
                          >
                            {[
                              {
                                label: "Correction",
                                val: u.corrections,
                                color: tokens.ORANGE,
                                bg: tokens.ORANGE_BG,
                              },
                              {
                                label: "Redesign",
                                val: u.redesigns,
                                color: tokens.PURPLE,
                                bg: tokens.PURPLE_BG,
                              },
                            ].map((s) => (
                              <div
                                key={s.label}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCategoryFilter(
                                    categoryFilter === s.label ? null : s.label,
                                  );
                                }}
                                style={{
                                  background:
                                    categoryFilter === s.label
                                      ? `${s.color}18`
                                      : s.bg,
                                  border: `1.5px solid ${categoryFilter === s.label ? s.color : s.color + "30"}`,
                                  borderRadius: 14,
                                  padding: "10px 2px",
                                  textAlign: "center",
                                  width: 70,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                }}
                              >
                                <div
                                  style={{
                                    color: s.color,
                                    fontWeight: 800,
                                    fontSize: 18,
                                    lineHeight: 1,
                                    marginBottom: 4,
                                  }}
                                >
                                  {s.val}
                                </div>
                                <div
                                  style={{
                                    color: tokens.TEXT_MUTED,
                                    fontSize: 8,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.3px",
                                  }}
                                >
                                  {s.label}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Tasks Table Row ─────────────────────────────────────────── */}
                <div
                  style={{
                    background: isDark ? "#1a1a1a" : "#f8f9fc",
                    border: `1px solid ${tokens.BORDER}`,
                    borderRadius: 16,
                    padding: "20px 20px 4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <Space>
                      <Text strong style={{ color: tokens.TEXT_MAIN }}>
                        {performanceView === "completed"
                          ? "Completed"
                          : "Pending"}{" "}
                        {categoryFilter ? `${categoryFilter} ` : ""}Tasks
                      </Text>
                      {categoryFilter && (
                        <Tag
                          closable
                          onClose={() => setCategoryFilter(null)}
                          color={
                            categoryFilter === "Correction"
                              ? "orange"
                              : "purple"
                          }
                          style={{ borderRadius: 10, fontSize: 11 }}
                        >
                          {categoryFilter}
                        </Tag>
                      )}
                    </Space>
                    <Segmented
                      value={performanceView}
                      onChange={setPerformanceView}
                      options={[
                        { label: "Completed", value: "completed" },
                        { label: "Pending", value: "pending" },
                      ]}
                      size="small"
                    />
                  </div>
                  <Table
                    dataSource={performanceTasksList}
                    size="large"
                    rowKey="_id"
                    pagination={{ defaultPageSize: 5, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                    scroll={{ x: 1100 }}
                    onRow={(record) => ({
                      onClick: () => {
                        setSelectedTask(record);
                        setDrawerVisible(true);
                      },
                      style: { cursor: "pointer" },
                    })}
                    columns={[
                      // Start Date (Only for target roles with due dates)
                      ...(selectedUser &&
                      isTargetRole(userMap[selectedUser]?.role)
                        ? [
                            {
                              title: "Start Date",
                              key: "startDate",
                              width: 100,
                              onCell: () => ({
                                style: { padding: "16px 8px" },
                              }),
                              render: (_, t) =>
                                formatDate(t.startDate || t.createdAt),
                            },
                          ]
                        : []),
                      // Primary Date Column (Completed Date or Due/Start Date)
                      {
                        title:
                          performanceView === "completed"
                            ? "Completed Date"
                            : "Date",
                        key: "primaryDate",
                        width: 120,
                        onCell: () => ({ style: { padding: "16px 8px" } }),
                        render: (_, t) =>
                          performanceView === "completed"
                            ? formatDate(
                                t.actualCompletionDate ||
                                  t.completedAt ||
                                  t.updatedAt,
                              )
                            : formatDate(
                                t.dueDate || t.startDate || t.createdAt,
                              ),
                      },
                      // Due Date (Only for target roles with due dates)
                      ...(selectedUser &&
                      isTargetRole(userMap[selectedUser]?.role)
                        ? [
                            {
                              title: "Due Date",
                              key: "dueDate",
                              width: 100,
                              onCell: () => ({
                                style: { padding: "16px 8px" },
                              }),
                              render: (_, t) =>
                                formatDate(t.dueDate || t.createdAt),
                            },
                          ]
                        : []),
                      {
                        title: "Title",
                        dataIndex: "title",
                        key: "title",
                        width: 280,
                        ellipsis: true,
                        onCell: () => ({ style: { padding: "16px 8px" } }),
                        render: (text) => (
                          <Text
                            strong
                            style={{ color: tokens.TEXT_MAIN, fontSize: 13 }}
                          >
                            {text}
                          </Text>
                        ),
                      },
                      {
                        title: "Content Type",
                        dataIndex: "serviceType",
                        key: "serviceType",
                        width: 110,
                        onCell: () => ({ style: { padding: "16px 8px" } }),
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
                            style={{
                              borderRadius: 10,
                              fontSize: 11,
                              textTransform: "capitalize",
                            }}
                          >
                            {type || "-"}
                          </Tag>
                        ),
                      },
                      {
                        title: "Category",
                        dataIndex: "taskCategory",
                        key: "taskCategory",
                        width: 100,
                        onCell: () => ({ style: { padding: "16px 8px" } }),
                        render: (cat) => (
                          <Tag
                            color={
                              cat === "Correction"
                                ? "orange"
                                : cat === "Redesign"
                                  ? "purple"
                                  : "blue"
                            }
                            style={{ borderRadius: 10, fontSize: 11 }}
                          >
                            {cat}
                          </Tag>
                        ),
                      },
                      {
                        title: "Company",
                        key: "company",
                        width: 180,
                        ellipsis: true,
                        onCell: () => ({ style: { padding: "16px 8px" } }),
                        render: (_, t) => (
                          <Text
                            style={{ color: tokens.TEXT_SUB, fontSize: 13 }}
                          >
                            {t.companyId?.name || "N/A"}
                          </Text>
                        ),
                      },
                      {
                        title: "Status",
                        dataIndex: "status",
                        key: "status",
                        width: 110,
                        onCell: () => ({ style: { padding: "16px 8px" } }),
                        render: (status) => {
                          let color = tokens.TEXT_MUTED;
                          if (isCompleted(status)) color = SUCCESS;
                          else if (isInProgress(status)) color = WARNING;
                          else if (status === "rejected") color = PRIMARY;
                          else color = INFO;

                          return (
                            <Tag
                              color={color}
                              style={{
                                textTransform: "capitalize",
                                borderRadius: 12,
                                border: "none",
                                fontSize: 11,
                                fontWeight: 600,
                                margin: 0,
                              }}
                            >
                              {status === "in_progress"
                                ? "In Progress"
                                : status}
                            </Tag>
                          );
                        },
                      },
                    ]}
                    style={{
                      background: tokens.SURFACE,
                      borderRadius: 12,
                      border: `1px solid ${tokens.BORDER}`,
                      overflow: "hidden",
                    }}
                  />
                </div>
              </>
            )}

            {/* Overall team score */}
            {userPerf.length > 0 && (
              <>
                <Divider
                  style={{ borderColor: tokens.BORDER, margin: "20px 0 16px" }}
                />
                {/* ── Attractive Performance Banner ────────────────────────── */}
                <div
                  style={{
                    position: "relative",
                    borderRadius: 18,
                    overflow: "hidden",
                    background: isDark
                      ? `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`
                      : `linear-gradient(135deg, ${getTier(avgScore, tokens).bg} 0%, #ffffff 60%, ${getTier(avgScore, tokens).bg}aa 100%)`,
                    border: `1.5px solid ${getTier(avgScore, tokens).color}40`,
                    boxShadow: isDark
                      ? `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`
                      : `0 8px 32px ${getTier(avgScore, tokens).color}18, inset 0 1px 0 rgba(255,255,255,0.8)`,
                    padding: "24px 28px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 20,
                  }}
                >
                  {/* Decorative blobs */}
                  <div
                    style={{
                      position: "absolute",
                      top: -30,
                      right: 120,
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      background: `${getTier(avgScore, tokens).color}12`,
                      pointerEvents: "none",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: -20,
                      right: 40,
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      background: `${getTier(avgScore, tokens).color}0a`,
                      pointerEvents: "none",
                    }}
                  />

                  {/* Left: label + score */}
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          background: `${getTier(avgScore, tokens).color}20`,
                          border: `1px solid ${getTier(avgScore, tokens).color}40`,
                          borderRadius: 8,
                          padding: "4px 8px",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 12,
                          color: getTier(avgScore, tokens).color,
                          fontWeight: 700,
                        }}
                      >
                        <TrophyOutlined style={{ fontSize: 11 }} />
                        {selectedUser
                          ? "Separate User Performance"
                          : "Overall Team Performance"}
                      </div>
                      <PerformanceBadge score={avgScore} tokens={tokens} />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 36,
                          fontWeight: 900,
                          color: getTier(avgScore, tokens).color,
                          lineHeight: 1,
                          letterSpacing: "-3px",
                        }}
                      >
                        {isSingleDay ? targetedCompleted : totalCompleted}
                      </span>
                      <span
                        style={{
                          color: tokens.TEXT_MUTED,
                          fontSize: 22,
                          fontWeight: 500,
                          letterSpacing: "-0.5px",
                        }}
                      >
                        / {isSingleDay ? targetedTarget : totalDistinctAssigned}
                      </span>
                    </div>
                    <Text
                      style={{
                        color: tokens.TEXT_MUTED,
                        fontSize: 12,
                        display: "block",
                        marginTop: 4,
                      }}
                    >
                      tasks completed vs assigned target
                    </Text>
                  </div>

                  {/* Right: circular progress */}
                  <div
                    style={{
                      position: "relative",
                      zIndex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Progress
                      type="circle"
                      percent={avgScore}
                      width={100}
                      strokeColor={{
                        "0%": getTier(avgScore, tokens).color,
                        "100%": `${getTier(avgScore, tokens).color}bb`,
                      }}
                      trailColor={
                        isDark
                          ? "rgba(255,255,255,0.08)"
                          : `${getTier(avgScore, tokens).color}20`
                      }
                      strokeWidth={10}
                      format={(p) => (
                        <span
                          style={{
                            color: getTier(avgScore, tokens).color,
                            fontWeight: 900,
                            fontSize: 18,
                            letterSpacing: "-0.5px",
                          }}
                        >
                          {p}%
                        </span>
                      )}
                    />
                    <Text
                      style={{
                        color: tokens.TEXT_MUTED,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.4px",
                        textTransform: "uppercase",
                      }}
                    >
                      Completion Rate
                    </Text>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Activity Chart */}
          <Card
            bordered={false}
            style={sectionCard}
            headStyle={{
              borderBottom: `1px solid ${tokens.BORDER}`,
              padding: "14px 20px",
            }}
            bodyStyle={{ padding: "14px 20px 20px" }}
            title={
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Space>
                  <div
                    style={{
                      background: tokens.PRIMARY_LIGHT,
                      borderRadius: 8,
                      padding: "5px 7px",
                      color: PRIMARY,
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    <CalendarOutlined />
                  </div>
                  <Text
                    style={{
                      color: tokens.TEXT_MAIN,
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    Task Activity by Date
                  </Text>
                </Space>
                <Segmented
                  value={chartView}
                  onChange={setChartView}
                  options={["Bar", "Area"]}
                  style={{ background: isDark ? "#262626" : tokens.SURFACE_2 }}
                />
              </div>
            }
          >
            {dateChartData.length === 0 ? (
              <div
                style={{
                  height: 260,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: tokens.TEXT_MUTED,
                  fontSize: 14,
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 32 }}>📭</span>No task data for
                selected filters
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={270}>
                {chartView === "Bar" ? (
                  <BarChart
                    data={dateChartData}
                    barCategoryGap="35%"
                    barGap={4}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={tokens.BORDER}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: tokens.TEXT_MUTED, fontSize: 12 }}
                      axisLine={{ stroke: tokens.BORDER }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: tokens.TEXT_MUTED, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RTooltip
                      content={
                        <CustomTooltip isDark={isDark} tokens={tokens} />
                      }
                    />
                    <Legend
                      wrapperStyle={{
                        color: tokens.TEXT_SUB,
                        fontSize: 13,
                        paddingTop: 10,
                      }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Bar
                      dataKey="Assigned"
                      fill={PRIMARY}
                      radius={[5, 5, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      dataKey="Completed"
                      fill={SUCCESS}
                      radius={[5, 5, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      dataKey="Correction"
                      fill={tokens.ORANGE}
                      radius={[5, 5, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      dataKey="Redesign"
                      fill={tokens.PURPLE}
                      radius={[5, 5, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                ) : (
                  <AreaChart data={dateChartData}>
                    <defs>
                      <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={PRIMARY}
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="95%"
                          stopColor={PRIMARY}
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                      <linearGradient id="cG" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={SUCCESS}
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="95%"
                          stopColor={SUCCESS}
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                      <linearGradient id="oG" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={tokens.ORANGE}
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="95%"
                          stopColor={tokens.ORANGE}
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                      <linearGradient id="pG" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={tokens.PURPLE}
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="95%"
                          stopColor={tokens.PURPLE}
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={tokens.BORDER}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: tokens.TEXT_MUTED, fontSize: 12 }}
                      axisLine={{ stroke: tokens.BORDER }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: tokens.TEXT_MUTED, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RTooltip
                      content={
                        <CustomTooltip isDark={isDark} tokens={tokens} />
                      }
                    />
                    <Legend
                      wrapperStyle={{
                        color: tokens.TEXT_SUB,
                        fontSize: 13,
                        paddingTop: 10,
                      }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Area
                      type="monotone"
                      dataKey="Assigned"
                      stroke={PRIMARY}
                      strokeWidth={2}
                      fill="url(#aG)"
                      dot={{ fill: PRIMARY, r: 4, strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Completed"
                      stroke={SUCCESS}
                      strokeWidth={2}
                      fill="url(#cG)"
                      dot={{ fill: SUCCESS, r: 4, strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Correction"
                      stroke={tokens.ORANGE}
                      strokeWidth={2}
                      fill="url(#oG)"
                      dot={{ fill: tokens.ORANGE, r: 4, strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Redesign"
                      stroke={tokens.PURPLE}
                      strokeWidth={2}
                      fill="url(#pG)"
                      dot={{ fill: tokens.PURPLE, r: 4, strokeWidth: 0 }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* ── Right Sidebar: Filters ────────────────────────────────────────── */}
        <Col xs={24} lg={7} xl={6}>
          <div style={{ position: "sticky", top: 20, marginBottom: 20 }}>
            <Card
              bordered={false}
              style={{
                background: tokens.SURFACE,
                border: `1px solid ${tokens.BORDER}`,
                borderRadius: 14,
                boxShadow: isDark
                  ? "0 4px 20px rgba(0,0,0,0.3)"
                  : "0 2px 10px rgba(0,0,0,0.05)",
                overflow: "hidden",
              }}
              headStyle={{
                background: isDark
                  ? "linear-gradient(90deg, #262626, #1d1d1d)"
                  : `linear-gradient(90deg, ${PRIMARY_LIGHT_BASE}, #ffffff)`,
                borderBottom: `1px solid ${tokens.BORDER}`,
                padding: "14px 18px",
              }}
              bodyStyle={{ padding: "18px" }}
              title={
                <Space>
                  <FilterOutlined style={{ color: PRIMARY }} />
                  <Text
                    style={{
                      color: tokens.TEXT_MAIN,
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    Filters
                  </Text>
                  {hasFilters && (
                    <Badge
                      count={
                        [
                          dateRange,
                          selectedUser,
                          selectedStatus,
                          selectedDepartment,
                        ].filter(Boolean).length
                      }
                      style={{ background: PRIMARY }}
                    />
                  )}
                </Space>
              }
            >
              <Space direction="vertical" size={18} style={{ width: "100%" }}>
                {/* Date Range */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      marginBottom: 8,
                    }}
                  >
                    <CalendarOutlined
                      style={{ color: PRIMARY, fontSize: 13 }}
                    />
                    <Text
                      style={{
                        color: tokens.TEXT_SUB,
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      Filter by Date
                    </Text>
                  </div>
                  <RangePicker
                    value={dateRange}
                    onChange={(dates) => {
                      if (!dates || !dates[0] || !dates[1]) {
                        setDateRange(null);
                      } else {
                        setDateRange([
                          dates[0].startOf("day"),
                          dates[1].endOf("day"),
                        ]);
                      }
                    }}
                    style={{
                      width: "100%",
                      border: `1px solid ${tokens.BORDER}`,
                      borderRadius: 8,
                    }}
                    allowClear
                    placeholder={["Start Date", "End Date"]}
                    size="small"
                  />
                  <Row gutter={8} style={{ marginTop: 8 }}>
                    {[
                      {
                        label: "Today",
                        range: [dayjs().startOf("day"), dayjs().endOf("day")],
                      },
                      {
                        label: "Last Week",
                        range: [dayjs().subtract(7, "day"), dayjs()],
                      },
                      {
                        label: "Last 28 Days",
                        range: [dayjs().subtract(28, "day"), dayjs()],
                      },
                    ].map((p) => (
                      <Col span={8} key={p.label}>
                        <Button
                          block
                          size="small"
                          style={{
                            fontSize: 10,
                            padding: "0 4px",
                            height: 24,
                            borderRadius: 6,
                            background:
                              dateRange?.[0]?.isSame(p.range[0], "day") &&
                              dateRange?.[1]?.isSame(p.range[1], "day")
                                ? tokens.PRIMARY_LIGHT
                                : "transparent",
                            borderColor:
                              dateRange?.[0]?.isSame(p.range[0], "day") &&
                              dateRange?.[1]?.isSame(p.range[1], "day")
                                ? PRIMARY
                                : tokens.BORDER,
                            color:
                              dateRange?.[0]?.isSame(p.range[0], "day") &&
                              dateRange?.[1]?.isSame(p.range[1], "day")
                                ? PRIMARY
                                : tokens.TEXT_SUB,
                          }}
                          onClick={() => setDateRange(p.range)}
                        >
                          {p.label}
                        </Button>
                      </Col>
                    ))}
                  </Row>
                  <Button
                    block
                    icon={<DownloadOutlined />}
                    onClick={exportAnalyticsToExcel}
                    style={{
                      marginTop: 10,
                      background: PRIMARY,
                      borderColor: PRIMARY,
                      color: "#ffffff",
                      borderRadius: 8,
                      fontWeight: 700,
                    }}
                  >
                    Download Excel
                  </Button>
                </div>

                {/* Department Filter */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      marginBottom: 8,
                    }}
                  >
                    <UnorderedListOutlined
                      style={{ color: PRIMARY, fontSize: 13 }}
                    />
                    <Text
                      style={{
                        color: tokens.TEXT_SUB,
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      Department
                    </Text>
                  </div>
                  <Select
                    allowClear
                    placeholder="All departments"
                    value={selectedDepartment}
                    onChange={setSelectedDepartment}
                    style={{ width: "100%" }}
                    size="small"
                  >
                    {departments
                      .filter((d) => {
                        // Hide "General" from non-admin/client roles
                        if (
                          d.slug === "general" ||
                          d.name?.toLowerCase() === "general"
                        ) {
                          return ["admin", "super_admin", "client"].includes(
                            userRole,
                          );
                        }
                        return true;
                      })
                      .map((dept) => (
                        <Option key={dept._id} value={dept._id}>
                          {dept.name}
                        </Option>
                      ))}
                  </Select>
                </div>

                {/* Team Member */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      marginBottom: 8,
                    }}
                  >
                    <UserOutlined style={{ color: PRIMARY, fontSize: 13 }} />
                    <Text
                      style={{
                        color: tokens.TEXT_SUB,
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      Team Member
                    </Text>
                  </div>
                  <Select
                    allowClear
                    placeholder="All members"
                    value={selectedUser}
                    onChange={setSelectedUser}
                    style={{ width: "100%" }}
                    size="small"
                    showSearch
                    filterOption={(input, option) =>
                      (option?.searchvalue ?? "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                    loading={usersLoading}
                  >
                    {allUsers.map((u, idx) => (
                      <Option key={u._id} value={u._id} searchvalue={u.name}>
                        <Space>
                          <Avatar
                            size={18}
                            src={u.profileImage || undefined}
                            style={{
                              background:
                                AVATAR_COLORS[idx % AVATAR_COLORS.length],
                              fontSize: 9,
                              fontWeight: 700,
                            }}
                          >
                            {!u.profileImage && getInitials(u.name)}
                          </Avatar>
                          {u.name}
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </div>

                {/* Task Status */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      marginBottom: 8,
                    }}
                  >
                    <CheckCircleOutlined
                      style={{ color: PRIMARY, fontSize: 13 }}
                    />
                    <Text
                      style={{
                        color: tokens.TEXT_SUB,
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      Task Status
                    </Text>
                  </div>
                  <Select
                    allowClear
                    placeholder="All statuses"
                    value={selectedStatus}
                    onChange={setSelectedStatus}
                    style={{ width: "100%" }}
                    size="small"
                  >
                    <Option value="completed">
                      <Space>
                        <CheckCircleOutlined style={{ color: SUCCESS }} />
                        Completed
                      </Space>
                    </Option>
                    <Option value="in_progress">
                      <Space>
                        <SyncOutlined style={{ color: WARNING }} spin />
                        In Progress
                      </Space>
                    </Option>
                    <Option value="pending">
                      <Space>
                        <ClockCircleOutlined style={{ color: INFO }} />
                        Pending
                      </Space>
                    </Option>
                  </Select>
                </div>

                <Divider
                  style={{ borderColor: tokens.BORDER, margin: "2px 0" }}
                />

                {/* Filter Summary */}
                <div
                  style={{
                    background: isDark ? "#262626" : tokens.SURFACE_2,
                    border: `1px solid ${tokens.BORDER}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                  }}
                >
                  <Text
                    style={{
                      color: tokens.TEXT_MUTED,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.6px",
                      display: "block",
                      marginBottom: 12,
                      textTransform: "uppercase",
                    }}
                  >
                    Filter Summary
                  </Text>
                  {[
                    { label: "Assigned", val: total, color: PRIMARY },
                    { label: "Completed", val: completed, color: SUCCESS },
                    { label: "In Progress", val: inProgress, color: WARNING },
                    { label: "Pending", val: pending, color: INFO },
                    {
                      label: "Corrections",
                      val: corrections,
                      color: tokens.ORANGE,
                    },
                    {
                      label: "Redesigns",
                      val: redesigns,
                      color: tokens.PURPLE,
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 9,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: s.color,
                            flexShrink: 0,
                          }}
                        />
                        <Text style={{ color: tokens.TEXT_SUB, fontSize: 12 }}>
                          {s.label}
                        </Text>
                      </div>
                      <Text
                        style={{
                          color: s.color,
                          fontWeight: 700,
                          fontSize: 15,
                        }}
                      >
                        {s.val}
                      </Text>
                    </div>
                  ))}
                  <Divider
                    style={{ borderColor: tokens.BORDER, margin: "10px 0" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: tokens.TEXT_SUB,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Completion Rate
                    </Text>
                    <Text
                      style={{
                        color: SUCCESS,
                        fontWeight: 800,
                        fontSize: 18,
                        lineHeight: 1,
                      }}
                    >
                      {total ? Math.round((completed / total) * 100) : 0}%
                    </Text>
                  </div>
                </div>

                {hasFilters && (
                  <Button
                    block
                    icon={<ReloadOutlined />}
                    onClick={resetFilters}
                    style={{
                      background: tokens.PRIMARY_LIGHT,
                      border: `1px solid ${PRIMARY_MID}40`,
                      color: PRIMARY,
                      borderRadius: 8,
                      height: 36,
                      fontWeight: 600,
                    }}
                  >
                    Reset All Filters
                  </Button>
                )}
              </Space>
            </Card>
          </div>
        </Col>
      </Row>
      <TaskDetailDrawer
        task={selectedTask}
        visible={drawerVisible}
        onClose={handleCloseDrawer}
      />
    </div>
  );
};

export default TaskAnalyticsPage;
