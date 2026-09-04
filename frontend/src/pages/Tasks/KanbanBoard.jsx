import { useAuth } from "../../contexts/AuthContext";
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Card,
  Avatar,
  Tag,
  Button,
  Empty,
  Spin,
  Select,
  message,
  Modal,
  Form,
  Input,
  Upload,
  DatePicker,
  Tooltip,
} from "antd";
import { notifyLoading, notifySuccess, notifyError } from "../../utils/notify";
import {
  PlusOutlined,
  CalendarOutlined,
  UserOutlined,
  UploadOutlined,
  EditOutlined,
  BellOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useGetTasksForKanbanQuery,
  useGetScheduledNotesQuery,
  useUpdateTaskStatusAndOrderMutation,
  useUpdateTasksOrderMutation,
  useSendTaskReminderMutation,
  useGetWorkflowConfigQuery,
  useGetAllWorkflowConfigsQuery,
  useDeleteTaskMutation,
} from "../../api/taskApi";
import { useGetClientsQuery } from "../../api/clientApi";
import { useGetProjectsDropdownQuery } from "../../api/projectApi";
import { useGetUsersDropdownQuery } from "../../api/userApi";
import { useGetDepartmentsDynamicQuery } from "../../api/accessControlApi";
import { useTheme } from "../../contexts/ThemeContext";
import { useActionPermissions } from "../../hooks/useActionPermissions";
import { PERMISSION_ACTIONS } from "../../utils/actionPermissions";
import TaskDetailDrawer from "./TaskDetailDrawer";
import TaskReopenModal from "./TaskReopenModal";
import { getTaskDurationLabel, isCompletedTask } from "./taskDuration";
import { taskMatchesKanbanDay } from "./taskKanbanDateUtils";
import dayjs from "dayjs";
import { getProjectServiceStats } from "../../utils/categoryUtils";

const { Option } = Select;

// Helper to get service count for a task
const getServiceCount = (task) => {
  if (!task.projectId || !task.serviceType) return null;
  const stats = getProjectServiceStats(task.projectId, task.serviceType);
  if (!stats) return null;
  return { completed: stats.completed, total: stats.total };
};

// ── Shared priority color helper ─────────────────────────────────
const getPriorityColor = (priority) => {
  const colors = {
    low: "#22c55e",
    medium: "#f59e0b",
    high: "#ef4444",
    critical: "#7c3aed",
  };
  return colors[priority] || "#8c8c8c";
};

const getPriorityBg = (priority) => {
  const bgs = {
    low: "#f0fdf4",
    medium: "#fffbeb",
    high: "#fef2f2",
    critical: "#f5f3ff",
  };
  return bgs[priority] || "#f3f4f6";
};

// ── Avatar color generator ────────────────────────────────────────
const nameToColor = (name = "") => {
  const palette = [
    "#6366f1",
    "#f59e0b",
    "#10b981",
    "var(--accent-primary)",
    "#ec4899",
    "#8b5cf6",
    "#14b8a6",
    "#f97316",
    "#ef4444",
    "#06b6d4",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
};

// ── Creative card inner renderer ──────────────────────────────────
const TaskCardInner = ({
  task,
  isDark,
  isOverdue,
  isCompleted,
  durationLabel,
  canEdit,
  canDelete,
  onDelete,
  onReopen,
  navigate,
  userRole,
  showPendingOnly,
  onSendReminder,
  listeners,
  attributes,
  setNodeRef,
  style: dndStyle,
  onClick,
  isDragging,
  isMobileKanbanUi,
  columnStatusId,
  kanbanStatuses,
  onMobileMoveToColumn,
  canUseMobileBoardMove,
  user,
}) => {
  const [mobileMoveSelectKey, setMobileMoveSelectKey] = useState(0);

  const isCreator = task.createdBy &&
    ((task.createdBy._id || task.createdBy)?.toString() === user?._id?.toString());
  const canEditThisTask = canEdit && isCreator;
  const canDeleteThisTask = canDelete && isCreator;

  const accentColor = getPriorityColor(task.priority);
  const projectColor = task.projectId?.color || accentColor;

  // Build the correct task edit URL based on the current portal
  const cardLocation = useLocation();
  const getCardTaskEditUrl = (taskId) => {
    if (cardLocation.pathname.startsWith('/user')) return `/user/tasks/${taskId}/edit`;
    if (cardLocation.pathname.startsWith('/client')) return `/client/workspace/tasks/${taskId}/edit`;
    if (cardLocation.pathname.startsWith('/agency')) return `/agency/workspace/tasks/${taskId}/edit`;
    return `/workspace/tasks/${taskId}/edit`;
  };

  const handleCardClick = (e) => {
    if (
      e.target.closest(".drag-handle") ||
      e.target.closest(".reminder-button") ||
      e.target.closest(".mobile-kanban-move")
    )
      return;
    if (!isDragging && onClick) onClick(task);
  };

  const adminRoles = [
    "super_admin",
    "admin",
    "operations_head",
    "website_coordinator",
    "digital_marketing_coordinator",
    "coordinator",
    "agency_manager",
    "agency_super_admin",
    "brand_manager",
    "brand_super_admin",
    "supreme_super_admin",
    "commander_admin",
  ];
  const isAdmin = adminRoles.includes(userRole);
  // Task creator should also be able to drag (e.g., to move from Review for Correction/Redesign)
  const canDragHandle = isAdmin || isCreator;
  const canEditTaskDetails = canEdit;

  // Category chip config
  const categoryConfig = {
    New: { color: "var(--accent-primary)", bg: "#eff6ff", border: "#bfdbfe" },
    Correction: { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    "Internal Correction": {
      color: "#d97706",
      bg: "#fffbeb",
      border: "#fde68a",
    },
    "Client Correction": { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    Hosting: { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    Redesign: { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  };
  const catStyle = categoryConfig[task.taskCategory] || {};

  const serviceConfig = {
    video: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    poster: { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
    shoot: { color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  };
  const svcStyle = serviceConfig[task.serviceType] || {
    color: "#6366f1",
    bg: "#eef2ff",
    border: "#c7d2fe",
  };

  const assigneeColor = nameToColor(task.assignedTo?.name || "");
  const creatorColor = nameToColor(task.createdBy?.name || "");

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      onClick={handleCardClick}
      style={{
        ...dndStyle,
        marginBottom: 12,
        cursor: "pointer",
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        background: isDark ? "#18181b" : "#ffffff",
        border: isDark ? `1px solid #27272a` : `1px solid #e4e4e7`,
        boxShadow: isDragging
          ? `0 20px 50px rgba(0,0,0,0.25), 0 0 0 2px ${accentColor}60`
          : isOverdue
            ? `0 2px 12px rgba(239,68,68,0.15), 0 0 0 1px #fca5a560`
            : isDark
              ? "0 2px 10px rgba(0,0,0,0.4)"
              : `0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)`,
        transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
      }}
      onMouseEnter={(e) => {
        if (isDragging) return;
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = isOverdue
          ? `0 8px 24px rgba(239,68,68,0.2), 0 0 0 1px #fca5a580`
          : `0 8px 28px ${projectColor}22, 0 2px 8px rgba(0,0,0,0.08)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = isDark
          ? "0 2px 10px rgba(0,0,0,0.4)"
          : `0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)`;
      }}
    >
      {/* ── Colored Header Band ─────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          padding: "14px 14px 12px 16px",
          background: isDark
            ? `linear-gradient(135deg, ${projectColor}28 0%, ${projectColor}10 100%)`
            : `linear-gradient(135deg, ${projectColor}18 0%, ${projectColor}06 100%)`,
          borderBottom: isDark
            ? `1px solid ${projectColor}22`
            : `1px solid ${projectColor}18`,
          overflow: "hidden",
        }}
      >
        {/* Decorative blobs in header */}
        <div
          style={{
            position: "absolute",
            top: -14,
            right: -14,
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: `${projectColor}18`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -10,
            right: 30,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: `${projectColor}12`,
            pointerEvents: "none",
          }}
        />

        {/* Drag handle */}
        {((!isOverdue && !isCompleted) || canDragHandle) && (
          <div
            {...listeners}
            className="drag-handle"
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 22,
              height: 22,
              cursor: "grab",
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              color: `${projectColor}80`,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${projectColor}20`;
              e.currentTarget.style.color = projectColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = `${projectColor}80`;
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              style={{
                fontSize: 13,
                userSelect: "none",
                lineHeight: 1,
                letterSpacing: "-1px",
              }}
            >
              ⠿
            </span>
          </div>
        )}

        {/* Company and Project */}
        <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {task.companyId?.name && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 9.5,
                fontWeight: 800,
                color: isDark ? "#a1a1aa" : "#52525b",
                background: isDark ? "#27272a" : "#f4f4f5",
                borderRadius: 4,
                padding: "2px 6px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                border: isDark ? "1px solid #3f3f46" : "1px solid #e4e4e7",
              }}
            >
              {task.companyId.name}
            </span>
          )}
          {task.projectId && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: projectColor,
                background: isDark ? `${projectColor}22` : `${projectColor}15`,
                borderRadius: 20,
                padding: "3px 10px 3px 6px",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: projectColor,
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              {task.projectId.name || "No Project"}
              {getServiceCount(task) && (
                <span style={{ opacity: 0.7 }}>
                  · {getServiceCount(task).completed}/{getServiceCount(task).total}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{ paddingRight: 26 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: isDark ? "#f4f4f5" : "#18181b",
              lineHeight: 1.4,
              display: "block",
              letterSpacing: "-0.015em",
            }}
          >
            {task.title}
          </span>
          {task.description && (
            <span
              style={{
                fontSize: 11.5,
                color: isDark ? "#71717a" : "#a1a1aa",
                lineHeight: 1.5,
                display: "block",
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {task.description}
            </span>
          )}
        </div>
      </div>

      {/* ── Card Body ──────────────────────────────────────────── */}
      <div style={{ padding: "10px 14px 0" }}>
        {/* Creator row */}
        {task.createdBy && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 8,
              padding: "5px 8px",
              background: isDark ? "#27272a" : "#fafafa",
              borderRadius: 8,
              border: isDark ? "1px solid #3f3f46" : "1px solid #f0f0f0",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: creatorColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 800,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {task.createdBy.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: isDark ? "#71717a" : "#a1a1aa",
                  fontWeight: 500,
                }}
              >
                Created by
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: isDark ? "#d4d4d8" : "#3f3f46",
                  fontWeight: 700,
                }}
              >
                {task.createdBy.name || "Unknown"}
              </span>
            </div>
          </div>
        )}

        {/* Assignee row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
            gap: 6,
          }}
        >
          {/* Assignee pill */}
          {task.assignedTo ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: isDark ? "#27272a" : "#f4f4f5",
                borderRadius: 20,
                padding: "4px 10px 4px 4px",
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${assigneeColor} 0%, ${assigneeColor}cc 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#fff",
                  flexShrink: 0,
                  boxShadow: `0 2px 6px ${assigneeColor}50`,
                }}
              >
                {task.assignedTo?.name?.charAt(0)?.toUpperCase() || (
                  <UserOutlined />
                )}
              </div>
              <span
                style={{
                  fontSize: 11.5,
                  color: isDark ? "#e4e4e7" : "#27272a",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {task.assignedTo?.name || "Unassigned"}
              </span>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: isDark ? "#27272a" : "#f4f4f5",
                borderRadius: 20,
                padding: "4px 10px",
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: isDark ? "#3f3f46" : "#e4e4e7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <UserOutlined style={{ fontSize: 11, color: "#a1a1aa" }} />
              </div>
              <span
                style={{ fontSize: 11.5, color: "#a1a1aa", fontWeight: 500 }}
              >
                Unassigned
              </span>
            </div>
          )}

          {/* Priority badge — right-aligned */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 9px",
              borderRadius: 20,
              background: getPriorityBg(task.priority),
              border: `1.5px solid ${accentColor}40`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: accentColor,
                boxShadow: `0 0 0 2px ${accentColor}30`,
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: accentColor,
              }}
            >
              {task.priority?.toUpperCase() || "MEDIUM"}
            </span>
          </div>
        </div>

        {/* Tags row */}
        {(task.taskCategory ||
          task.serviceType ||
          columnStatusId === "backlog" ||
          (isCompleted && durationLabel)) && (
          <div
            style={{
              display: "flex",
              gap: 5,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            {columnStatusId === "backlog" && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#d97706",
                  background: "#fef3c7",
                  border: `1px solid #fde68a`,
                  borderRadius: 6,
                  padding: "2px 8px",
                }}
              >
                HOLD
              </span>
            )}
            {task.taskCategory && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: catStyle.color,
                  background: catStyle.bg,
                  border: `1px solid ${catStyle.border}`,
                  borderRadius: 6,
                  padding: "2px 8px",
                }}
              >
                {task.taskCategory}
              </span>
            )}
            {task.serviceType && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: svcStyle.color,
                  background: svcStyle.bg,
                  border: `1px solid ${svcStyle.border}`,
                  borderRadius: 6,
                  padding: "2px 8px",
                }}
              >
                {task.serviceType}
              </span>
            )}
            {isCompleted && durationLabel && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#d97706",
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 6,
                  padding: "2px 8px",

                  alignItems: "center",
                  gap: 3,
                }}
              >
                <ClockCircleOutlined style={{ fontSize: 9 }} />
                {durationLabel}
              </span>
            )}
            {task.labels?.slice(0, 2).map((label, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: isDark ? "#a1a1aa" : "#71717a",
                  background: isDark ? "#27272a" : "#f4f4f5",
                  border: isDark ? "1px solid #3f3f46" : "1px solid #e4e4e7",
                  borderRadius: 6,
                  padding: "2px 8px",
                }}
              >
                {label}
              </span>
            ))}
            {task.labels?.length > 2 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#a1a1aa",
                  background: isDark ? "#27272a" : "#f4f4f5",
                  borderRadius: 6,
                  padding: "2px 7px",
                }}
              >
                +{task.labels.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      {isMobileKanbanUi &&
        canUseMobileBoardMove &&
        onMobileMoveToColumn &&
        kanbanStatuses?.length > 0 && (
          <div
            className="mobile-kanban-move"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ padding: "0 14px 10px" }}
          >
            <Select
              key={mobileMoveSelectKey}
              placeholder="Move to…"
              style={{ width: "100%" }}
              size="small"
              variant="borderless"
              styles={{
                popup: { root: { zIndex: 1100 } },
              }}
              options={kanbanStatuses
                .filter((s) => s.id !== columnStatusId)
                .map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
              onChange={(value) => {
                onMobileMoveToColumn(task._id, value);
                setMobileMoveSelectKey((k) => k + 1);
              }}
            />
          </div>
        )}

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px 10px",
          borderTop: isDark ? "1px solid #27272a" : "1px solid #f4f4f5",
          marginTop: 2,
          gap: 8,
        }}
      >
        {/* Due date - only show if not completed */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {!isCompleted && task.dueDate ? (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: isOverdue ? 700 : 500,
                color: isOverdue ? "#ef4444" : isDark ? "#71717a" : "#a1a1aa",
                background: isOverdue
                  ? "#fef2f2"
                  : isDark
                    ? "#27272a"
                    : "#f4f4f5",
                border: isOverdue
                  ? "1px solid #fecaca"
                  : isDark
                    ? "1px solid #3f3f46"
                    : "1px solid #e4e4e7",
                borderRadius: 20,
                padding: "3px 8px",
              }}
            >
              <CalendarOutlined style={{ fontSize: 10 }} />
              {dayjs(task.dueDate).format("MMM DD")}
              {isOverdue && (
                <span
                  style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                  }}
                >
                  OVERDUE
                </span>
              )}
            </span>
          ) : !isCompleted && !task.dueDate ? (
            <span
              style={{ fontSize: 11, color: isDark ? "#52525b" : "#d4d4d8" }}
            >
              No due date
            </span>
          ) : null}
        </div>

        {/* Right side: Reminder / Edit / Locked */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {showPendingOnly &&
            isOverdue &&
            task.assignedTo &&
            onSendReminder && (
              <div className="reminder-button">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendReminder(task._id);
                  }}
                  style={{
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                    background: "#ef4444",
                    border: "none",
                    borderRadius: 8,
                    padding: "5px 10px",
                    cursor: "pointer",
                    height: 28,
                    boxShadow: "0 2px 6px rgba(239,68,68,0.35)",
                  }}
                >
                  <BellOutlined style={{ fontSize: 10 }} />
                  Remind
                </button>
              </div>
            )}

          {canEditThisTask && navigate && (
            <>
              {((isOverdue || isCompleted) && !isAdmin) ||
              ["done", "validated", "completed", "complete"].includes(task.status) ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: isCompleted ? "#a1a1aa" : "#f87171",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    background: isCompleted
                      ? isDark
                        ? "#27272a"
                        : "#f4f4f5"
                      : "#fef2f2",
                    borderRadius: 6,
                    padding: "3px 8px",
                  }}
                >
                  {isCompleted ? (
                    <>🔒 Locked</>
                  ) : (
                    <>
                      <ClockCircleOutlined /> Overdue
                    </>
                  )}
                </span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(getCardTaskEditUrl(task._id));
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    color: projectColor,
                    background: isDark
                      ? `${projectColor}18`
                      : `${projectColor}10`,
                    border: `1px solid ${projectColor}30`,
                    borderRadius: 8,
                    padding: "4px 10px",
                    cursor: "pointer",
                    height: 26,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${projectColor}25`;
                    e.currentTarget.style.borderColor = `${projectColor}60`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isDark
                      ? `${projectColor}18`
                      : `${projectColor}10`;
                    e.currentTarget.style.borderColor = `${projectColor}30`;
                  }}
                >
                  <EditOutlined style={{ fontSize: 10 }} />
                  Edit
                </button>
              )}
            </>
          )}

          {/* Reopen button — only for completed tasks */}
          {isCompleted &&
            onReopen && (
              <Tooltip title="Reopen as Correction Task">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReopen(task);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#f59e0b",
                    background: isDark ? "#451a0314" : "#fffbeb",
                    border: `1px solid #fde68a`,
                    borderRadius: 8,
                    padding: "4px 10px",
                    cursor: "pointer",
                    height: 26,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fef3c7";
                    e.currentTarget.style.borderColor = "#f59e0b";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isDark
                      ? "#451a0314"
                      : "#fffbeb";
                    e.currentTarget.style.borderColor = "#fde68a";
                  }}
                >
                  <ReloadOutlined style={{ fontSize: 10 }} />
                  Reopen
                </button>
              </Tooltip>
            )}

          {canDeleteThisTask && (
            <Tooltip title="Delete Task">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  Modal.confirm({
                    title: "Delete Task",
                    content: "Are you sure you want to delete this task?",
                    okText: "Delete",
                    okType: "danger",
                    cancelText: "Cancel",
                    onOk: async () => {
                      try {
                        await onDelete(task._id);
                        // parent handler will show success notification
                      } catch (err) {
                        notifyError('delete', task._id, err.data?.message || "Failed to delete task");
                      }
                    },
                  });
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  border: `1px solid ${isDark ? "#3f3f46" : "#e4e4e7"}`,
                  background: isDark ? "#27272a" : "#fff",
                  color: "#ef4444",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fef2f2";
                  e.currentTarget.style.borderColor = "#fca5a5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDark
                    ? "#27272a"
                    : "#fff";
                  e.currentTarget.style.borderColor = isDark
                    ? "#3f3f46"
                    : "#e4e4e7";
                }}
              >
                <DeleteOutlined style={{ fontSize: 13 }} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
};

// Sortable Task Card Component
const TaskCard = ({
  task,
  onClick,
  workflowColor,
  userRole,
  navigate,
  canEdit,
  canDrag,
  canDelete,
  onDelete,
  onReopen,
  columnStatusId,
  isMobileKanbanUi,
  kanbanStatuses,
  onMobileMoveToColumn,
  user,
}) => {
  const { isDark } = useTheme();
  const isOverdue =
    task.dueDate &&
    dayjs(task.dueDate).isBefore(dayjs(), "day") &&
    !isCompletedTask(task.status);

  const adminRoles = [
    "super_admin",
    "admin",
    "operations_head",
    "website_coordinator",
    "digital_marketing_coordinator",
    "coordinator",
    "agency_manager",
    "agency_super_admin",
    "brand_manager",
    "brand_super_admin",
    "supreme_super_admin",
    "commander_admin",
  ];
  const coordinatorRoles = ["digital_marketing_coordinator", "coordinator"];
  const isCoordinatorOnly = coordinatorRoles.includes(userRole);
  const canDragFromReviewOnly =
    !isCoordinatorOnly || task.status === "completed";
  const isCompleted = isCompletedTask(task.status);
  const durationLabel = getTaskDurationLabel(task);

  // Task creator can also drag (e.g., to send Review tasks back for Correction/Redesign)
  const isCreator = task.createdBy &&
    ((task.createdBy._id || task.createdBy)?.toString() === user?._id?.toString());
  const isAdminOrCreator = adminRoles.includes(userRole) || isCreator;

  // Drag requires VIEW or EDIT task permission (canEdit prop = canMoveStatus from parent).
  // Edit permission controls editing task details (title, desc, etc.);
  // canMoveStatus now checks VIEW OR EDIT, so both DM (Edit) and Website (View/Read) users can drag.
  const sortableDisabled =
    !canDrag ||
    !canDragFromReviewOnly ||
    (isOverdue && !isAdminOrCreator) ||
    (isCompleted && !isAdminOrCreator);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    disabled: sortableDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TaskCardInner
      task={task}
      isDark={isDark}
      isOverdue={isOverdue}
      isCompleted={isCompleted}
      durationLabel={durationLabel}
      canEdit={canEdit}
      canDelete={canDelete}
      onDelete={onDelete}
      onReopen={onReopen}
      navigate={navigate}
      userRole={userRole}
      listeners={listeners}
      attributes={attributes}
      setNodeRef={setNodeRef}
      style={style}
      onClick={onClick}
      isDragging={isDragging}
      isMobileKanbanUi={isMobileKanbanUi}
      columnStatusId={columnStatusId}
      kanbanStatuses={kanbanStatuses}
      onMobileMoveToColumn={onMobileMoveToColumn}
      canUseMobileBoardMove={!sortableDisabled}
      user={user}
    />
  );
};

// Sortable Task Card Component with Reminder Button
const TaskCardWithReminder = ({
  task,
  onClick,
  workflowColor,
  userRole,
  navigate,
  showPendingOnly,
  onSendReminder,
  canEdit,
  user,
}) => {
  const { isDark } = useTheme();
  const isOverdue =
    task.dueDate &&
    dayjs(task.dueDate).isBefore(dayjs(), "day") &&
    !["done", "completed", "validated", "complete"].includes(task.status);

  const isCompleted = isCompletedTask(task.status);
  const allAdminRoles = [
    "super_admin", "admin", "operations_head",
    "website_coordinator", "digital_marketing_coordinator", "coordinator",
    "agency_manager", "agency_super_admin", "brand_manager",
    "brand_super_admin", "supreme_super_admin", "commander_admin",
  ];
  const coordinatorRoles = ["digital_marketing_coordinator", "coordinator"];
  const isCoordinatorOnly = coordinatorRoles.includes(userRole);
  const canDragFromReviewOnly =
    !isCoordinatorOnly || task.status === "completed";
  const durationLabel = getTaskDurationLabel(task);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    // Drag requires VIEW or EDIT permission — canEdit prop = canMoveStatus (VIEW OR EDIT based).
    disabled:
      !canEdit ||
      !canDragFromReviewOnly ||
      (isOverdue &&
        !allAdminRoles.includes(userRole)),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TaskCardInner
      task={task}
      isDark={isDark}
      isOverdue={isOverdue}
      isCompleted={isCompleted}
      durationLabel={durationLabel}
      canEdit={canEdit}
      canDelete={canEdit} // For now, if they can edit/move, we allow delete prop to be true if passed, but TaskCardWithReminder doesn't have it explicitly yet.
      navigate={navigate}
      userRole={userRole}
      showPendingOnly={showPendingOnly}
      onSendReminder={onSendReminder}
      listeners={listeners}
      attributes={attributes}
      setNodeRef={setNodeRef}
      style={style}
      onClick={onClick}
      isDragging={isDragging}
      user={user}
    />
  );
};

// Kanban Column Component
const KanbanColumn = ({
  status,
  tasks,
  onTaskClick,
  onAddTask,
  canCreate = false,
  canEdit = false,
  canDrag = false,
  canDelete = false,
  onDelete,
  getWorkflowColorForTask,
  userRole,
  navigate,
  isMobileKanbanUi,
  kanbanStatuses,
  onMobileMoveToColumn,
  onReopen,
  user,
}) => {
  const statusConfig = status;
  const taskIds = tasks.map((task) => task._id);
  const { isDark } = useTheme();

  const { setNodeRef } = useDroppable({
    id: `column-${statusConfig.id}`,
    data: {
      statusId: statusConfig.id,
      type: "column",
    },
  });

  const colColor = statusConfig.color || "#6366f1";

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 308,
        maxWidth: 308,
        borderRadius: 16,
        padding: "0 0 12px",
        marginRight: 14,
        display: "flex",
        flexDirection: "column",
        height: "fit-content",
        maxHeight: "calc(100vh - 200px)",
        background: isDark ? "#131315" : "#f8fafc",
        border: isDark ? "1px solid #222226" : "1px solid #e8eaed",
        boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      {/* Column Header */}
      <div
        style={{
          padding: "14px 14px 12px",
          borderBottom: isDark ? "1px solid #222226" : "1px solid #edf0f3",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Status indicator */}
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: colColor,
                boxShadow: `0 0 0 3px ${colColor}25`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: isDark ? "#e5e7eb" : "#1e293b",
                letterSpacing: "-0.01em",
              }}
            >
              {statusConfig.name}
            </span>

            {statusConfig.id === "to_do" &&
              (userRole?.toLowerCase().includes("marketing") ||
                userRole?.toLowerCase().includes("digital marketing")) && (
                <Tooltip title="Before starting a task, move it to 'In Progress' to begin tracking.">
                  <InfoCircleOutlined
                    style={{ color: "#60a5fa", cursor: "help", fontSize: 12 }}
                  />
                </Tooltip>
              )}

            {/* Count badge */}
            <div
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: 100,
                background:
                  tasks.length > 0 ? colColor : isDark ? "#2a2a2e" : "#e5e7eb",
                color:
                  tasks.length > 0 ? "#ffffff" : isDark ? "#555" : "#9ca3af",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 6px",
              }}
            >
              {tasks.length}
            </div>
          </div>

          {canCreate && (
            <button
              onClick={() => onAddTask(statusConfig.id)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                border: `1px solid ${isDark ? "#2a2a2e" : "#e2e8f0"}`,
                background: isDark ? "#1c1c1e" : "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDark ? "#6b7280" : "#94a3b8",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colColor;
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.borderColor = colColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDark
                  ? "#1c1c1e"
                  : "#ffffff";
                e.currentTarget.style.color = isDark ? "#6b7280" : "#94a3b8";
                e.currentTarget.style.borderColor = isDark
                  ? "#2a2a2e"
                  : "#e2e8f0";
              }}
            >
              <PlusOutlined style={{ fontSize: 12 }} />
            </button>
          )}
        </div>
      </div>

      {/* Cards area */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div
          style={{
            overflowY: "auto",
            flex: 1,
            padding: "4px 10px 0",
          }}
        >
          {tasks.length === 0 ? (
            <div
              style={{
                padding: "36px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: isDark ? "#1c1c1e" : "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PlusOutlined
                  style={{ fontSize: 14, color: isDark ? "#444" : "#cbd5e1" }}
                />
              </div>
              <span
                style={{
                  color: isDark ? "#444" : "#cbd5e1",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                No tasks
              </span>
            </div>
          ) : (
            tasks.map((task) => {
              const workflowColor = getWorkflowColorForTask(task);
              return (
                <TaskCard
                  key={task._id}
                  task={task}
                  onClick={onTaskClick}
                  workflowColor={workflowColor}
                  userRole={userRole}
                  navigate={navigate}
                  canEdit={canEdit}
                  canDrag={canDrag}
                  canDelete={canDelete}
                  onDelete={onDelete}
                  onReopen={onReopen}
                  columnStatusId={statusConfig.id}
                  isMobileKanbanUi={isMobileKanbanUi}
                  kanbanStatuses={kanbanStatuses}
                  onMobileMoveToColumn={onMobileMoveToColumn}
                  user={user}
                />
              );
            })
          )}
        </div>
      </SortableContext>
    </div>
  );
};

const KanbanBoard = ({
  onTaskClick,
  onAddTask,
  departmentFilter,
  onTaskCompleted,
}) => {
  const { isDark } = useTheme();
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [tasksByStatus, setTasksByStatus] = useState({});
  const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [statusForm] = Form.useForm();
  const [screenshotFile, setScreenshotFile] = useState(null);
  const screenshotPreviewUrl = useMemo(
    () => (screenshotFile ? URL.createObjectURL(screenshotFile) : null),
    [screenshotFile],
  );
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [isReopenModalVisible, setIsReopenModalVisible] = useState(false);
  const [taskToReopen, setTaskToReopen] = useState(null);

  useEffect(() => {
    return () => {
      if (screenshotPreviewUrl) URL.revokeObjectURL(screenshotPreviewUrl);
    };
  }, [screenshotPreviewUrl]);

  const handleReopenClick = (task) => {
    setTaskToReopen(task);
    setIsReopenModalVisible(true);
  };
  const [isPendingTasksModalVisible, setIsPendingTasksModalVisible] =
    useState(false);
  const [pendingTasksData, setPendingTasksData] = useState([]);
  const [sendingReminders, setSendingReminders] = useState(new Set());
  const [selectedPriority, setSelectedPriority] = useState(null);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [selectedTaskType, setSelectedTaskType] = useState(null);
  const [isMobileKanbanUi, setIsMobileKanbanUi] = useState(false);
  // Guard to prevent runQuickMoveToInProgress firing twice on the same drag
  const moveInFlightRef = React.useRef(false);

  const { user: user } = useAuth();
  const selectedClientId = null;
  const userRole = user?.role;
  const navigate = useNavigate();
  const location = useLocation();
  const getTaskEditUrl = (taskId) => {
    if (location.pathname.startsWith('/user')) return `/user/tasks/${taskId}/edit`;
    if (location.pathname.startsWith('/client')) return `/client/workspace/tasks/${taskId}/edit`;
    if (location.pathname.startsWith('/agency')) return `/agency/workspace/tasks/${taskId}/edit`;
    return `/workspace/tasks/${taskId}/edit`;
  };

  const userType = (user?.type || "").toLowerCase().trim();
  const isIntern = userType === "intern";
  const isSEO = false; // Default-Allow model
  const isSEOFullTime = false;

  const { hasPermission } = useActionPermissions("/tasks");
  const adminRoles = [
    "supreme_super_admin",
    "commander_admin",
    "agency_super_admin",
    "brand_super_admin",
    "agency_manager",
    "brand_manager"
  ];
  const kanbanIsAdmin = adminRoles.includes(userRole);
  const canCreate = kanbanIsAdmin && hasPermission(PERMISSION_ACTIONS.CREATE_TASK);
  const canEdit = hasPermission(PERMISSION_ACTIONS.EDIT_TASK);
  const canDelete = hasPermission(PERMISSION_ACTIONS.DELETE_TASK);
  const canMoveStatus = true; // Drag functionality should always remain enabled by default for all users.
  
  const isAdmin = true; // Default-Allow model
  const isCoordinatorRole = true; // Default-Allow model
  const canUseClientScope = true; // Default-Allow model

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { data: kanbanData, isLoading: isLoadingTasks, refetch } =
    useGetTasksForKanbanQuery(
      {
        projectId: selectedProject,
        assignedTo: selectedUser,
        createdBy: selectedCreator,
        priority: selectedPriority,
        department: departmentFilter !== "all" ? departmentFilter : undefined,
        startDate: selectedDate
          ? selectedDate.startOf("day").toISOString()
          : null,
        endDate: selectedDate ? selectedDate.endOf("day").toISOString() : null,
        dateField: "dueDate",
        taskCategory: selectedTaskType,
        ...(canUseClientScope && selectedClientId
          ? { companyId: selectedClientId }
          : {}),
      },
      {
        refetchOnMountOrArgChange: true,
      },
    );
  const selectedDateRange = useMemo(
    () =>
      selectedDate
        ? {
            startDate: selectedDate.format("YYYY-MM-DD"),
            endDate: selectedDate.format("YYYY-MM-DD"),
          }
        : null,
    [selectedDate],
  );
  const { data: scheduledNotesData, isFetching: isScheduledNotesLoading } =
    useGetScheduledNotesQuery(selectedDateRange, {
      skip: !selectedDateRange,
    });

  const { data: pendingKanbanData } = useGetTasksForKanbanQuery(
    { showPendingOnly: true },
    { skip: !isPendingTasksModalVisible },
  );

  const { data: departmentsResp } = useGetDepartmentsDynamicQuery();
  const departments = departmentsResp?.data?.departments || [];

  const userDeptSlug = useMemo(() => {
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

    const roleMap = {
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
    if (user.role && roleMap[user.role]) {
      const mapped = roleMap[user.role];
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
    return null;
  }, [user, departments]);

  const activeDepartmentSlug = useMemo(() => {
    if (departmentFilter && departmentFilter !== "all") return departmentFilter;
    if (!isAdmin) return userDeptSlug || undefined;
    return undefined;
  }, [departmentFilter, isAdmin, userDeptSlug]);

  const { data: workflowData, isLoading: isLoadingWorkflow } =
    useGetWorkflowConfigQuery({
      projectId: selectedProject,
      projectType: activeDepartmentSlug,
    });

  const { data: allWorkflowConfigsData } = useGetAllWorkflowConfigsQuery();
  const { data: projectsData } = useGetProjectsDropdownQuery();
  const { data: usersData } = useGetUsersDropdownQuery();
  const [updateTaskStatusAndOrder, { isLoading: isStatusUpdating }] =
    useUpdateTaskStatusAndOrderMutation();
  const [updateTasksOrder] = useUpdateTasksOrderMutation();
  const [sendTaskReminder] = useSendTaskReminderMutation();
  const [deleteTask] = useDeleteTaskMutation();

  const allProjects =
    projectsData?.data?.data || projectsData?.data?.projects || [];
  const workflowConfig = workflowData?.data?.config;
  const allWorkflowConfigs = allWorkflowConfigsData?.data?.configs || [];

  const tasks = useMemo(() => kanbanData?.data?.tasks || {}, [kanbanData]);
  const selectedDayNotes = useMemo(
    () => scheduledNotesData?.data?.notes || [],
    [scheduledNotesData],
  );
  const users = (usersData?.data?.data || usersData?.data?.users || []).filter(u => u.role !== 'client');

  const getWorkflowColorForTask = useMemo(() => {
    return (task) => {
      if (!task.projectId) return null;
      const projectId = task.projectId._id || task.projectId;
      const projectSpecificConfig = allWorkflowConfigs.find(
        (config) =>
          config.projectId &&
          (config.projectId._id?.toString() === projectId.toString() ||
            config.projectId.toString() === projectId.toString()),
      );
      if (projectSpecificConfig) return projectSpecificConfig.color || null;

      const project = allProjects.find(
        (p) =>
          p._id?.toString() === projectId.toString() || p._id === projectId,
      );
      if (project) {
        let projectType = null;
        if (
          project.departments &&
          Array.isArray(project.departments) &&
          project.departments.length > 0
        ) {
          if (
            project.departments.includes("website-designing") ||
            project.departments.includes("website-designing")
          )
            projectType = "website-designing";
          else if (project.departments.includes("seo")) projectType = "seo";
          else if (
            project.departments.includes("digital-marketing") ||
            project.departments.includes("digital-marketing")
          )
            projectType = "digital-marketing";
          else if (
            project.departments.includes("web-application-development") ||
            project.departments.includes("web-application-development") ||
            project.departments.includes("tech_team")
          )
            projectType = "web-application-development";
        }
        if (!projectType) {
          const name = (project.name || "").toLowerCase();
          const description = (project.description || "").toLowerCase();
          if (
            name.includes("website") ||
            description.includes("website") ||
            name.includes("design") ||
            description.includes("design")
          ) {
            projectType = "website-designing";
          } else if (name.includes("seo") || description.includes("seo")) {
            projectType = "seo";
          } else if (
            name.includes("digital marketing") ||
            description.includes("digital marketing") ||
            name.includes("marketing")
          ) {
            projectType = "digital-marketing";
          } else if (
            name.includes("web app") ||
            description.includes("web app") ||
            name.includes("development") ||
            description.includes("development") ||
            name.includes("application") ||
            description.includes("application")
          ) {
            projectType = "web-application-development";
          }
        }
        if (projectType) {
          const projectTypeConfig = allWorkflowConfigs.find(
            (config) => config.projectType === projectType && !config.projectId,
          );
          if (projectTypeConfig) return projectTypeConfig.color || null;
        }
      }
      const defaultConfig = allWorkflowConfigs.find(
        (config) => !config.projectId && !config.projectType,
      );
      if (defaultConfig) return defaultConfig.color || null;
      return null;
    };
  }, [allWorkflowConfigs, allProjects]);

  const projects = useMemo(() => {
    if (isAdmin) return allProjects;
    const taskList = Object.values(tasks).flat();
    const projectIds = new Set(
      taskList
        .map((task) => task.projectId?._id || task.projectId)
        .filter(Boolean),
    );
    return allProjects.filter((project) => projectIds.has(project._id));
  }, [allProjects, tasks, isAdmin]);

  const statuses = useMemo(() => {
    let result = [];

    // Determine user's assigned department slug if any
    let userDeptSlug = null;
    if (user) {
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
          userDeptSlug = user.departmentId.slug;
        } else {
          userDeptSlug = findMatch(user.departmentId);
        }
      }

      if (!userDeptSlug) {
        for (const val of [user.departmentName, user.department, user.team, user.roleName, user.designation, user.title]) {
          const match = findMatch(val);
          if (match) {
            userDeptSlug = match;
            break;
          }
        }
      }

      if (!userDeptSlug && user.role) {
        const roleMap = {
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
        const mapped = roleMap[user.role];
        userDeptSlug = findMatch(mapped) || mapped || findMatch(user.role) || null;
      }

      if (!userDeptSlug) {
        for (const val of [user.roleName, user.departmentName, user.department, user.designation, user.team]) {
          if (val) {
            userDeptSlug = String(val).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
            if (userDeptSlug) break;
          }
        }
      }

      if (!userDeptSlug && (user.name || user.fullName)) {
        const fullName = String(user.name || user.fullName);
        const match = (departments || []).find((d) => {
          if (!d?.name) return false;
          return fullName.toLowerCase().includes(d.name.toLowerCase());
        });
        if (match?.slug) userDeptSlug = match.slug;
      }
    }

    const isGlobalAdminRole =
      user &&
      [
        "super_admin",
        "admin",
        "operations_head",
        "agency_super_admin",
        "agency_manager",
        "commander_admin",
        "supreme_super_admin",
      ].includes(user.role);

    // Determine rawDept:
    // For non-global admin users, force their assigned userDeptSlug so they only see their department workflow.
    // For global admins, allow explicit filter or default to "all".
    const rawDept = !isGlobalAdminRole
      ? userDeptSlug || (departmentFilter && departmentFilter !== "all" ? departmentFilter : "all")
      : (departmentFilter || "all");

    const effectiveDept =
      rawDept && rawDept !== "all"
        ? rawDept.toLowerCase().replace(/_/g, "-")
        : "all";

    let hasDbConfig = false;

    // 1. Search in allWorkflowConfigs for department template match if effectiveDept is specified
    if (
      effectiveDept &&
      effectiveDept !== "all" &&
      allWorkflowConfigs.length > 0
    ) {
      const getVariants = (val) => {
        if (!val) return new Set();
        const s = String(val).toLowerCase().trim();
        const norm = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const set = new Set([s, norm, norm.replace(/-/g, "_")]);
        if (["dev", "developer", "development", "web-application-development", "tech-team", "tech_team"].includes(norm)) {
          ["dev", "developer", "development", "web-application-development", "web_application_development", "tech_team", "tech-team"].forEach(x => set.add(x));
        } else if (["video-editor", "video_editor", "video-editing", "video"].includes(norm)) {
          ["video-editor", "video_editor", "video-editing", "video"].forEach(x => set.add(x));
        } else if (["designer", "design", "graphic-designer", "graphic_designer"].includes(norm)) {
          ["designer", "design", "graphic-designer", "graphic_designer"].forEach(x => set.add(x));
        } else if (["digital-marketing", "digital_marketing", "dm", "marketing"].includes(norm)) {
          ["digital-marketing", "digital_marketing", "dm", "marketing"].forEach(x => set.add(x));
        } else if (["deployment", "deploy", "deployer"].includes(norm)) {
          ["deployment", "deploy", "deployer"].forEach(x => set.add(x));
        }
        return set;
      };

      const effVariants = getVariants(effectiveDept);

      const deptWorkflow = allWorkflowConfigs.find((c) => {
        if (!c.projectType || c.projectId) return false;
        const configType = String(c.projectType).toLowerCase().replace(/_/g, "-");
        if (effVariants.has(configType)) return true;

        const matchingDept = (departments || []).find((d) => {
          const dSlug = (d.slug || "").toLowerCase();
          const dNameSlug = (d.name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
          return (
            d._id === c.projectType ||
            dSlug === configType ||
            dNameSlug === configType ||
            d._id === rawDept ||
            dSlug === effectiveDept ||
            dNameSlug === effectiveDept ||
            effVariants.has(dSlug) ||
            effVariants.has(dNameSlug)
          );
        });

        if (matchingDept) {
          const matchVariants = getVariants(matchingDept.slug || matchingDept.name);
          if (
            matchVariants.has(effectiveDept) ||
            matchVariants.has(configType) ||
            matchingDept._id === rawDept ||
            matchingDept._id === c.projectType
          ) {
            return true;
          }
        }
        return false;
      });

      if (deptWorkflow?.statuses && deptWorkflow.statuses.length > 0) {
        result = [...deptWorkflow.statuses];
        hasDbConfig = true;
      }
    }

    // 2. Check for custom workflow config from DB (for project or specific query)
    if (!hasDbConfig && workflowConfig?.statuses && workflowConfig.statuses.length > 0 && !workflowConfig.defaultStatuses) {
      result = [...workflowConfig.statuses];
      hasDbConfig = true;
    }

    // 3. Search in allWorkflowConfigs for global default workflow (no project, no projectType)
    if (
      result.length === 0 &&
      allWorkflowConfigs.length > 0
    ) {
      const defaultWorkflow = allWorkflowConfigs.find(
        (c) => !c.projectId && !c.projectType,
      );
      if (defaultWorkflow?.statuses && defaultWorkflow.statuses.length > 0) {
        result = [...defaultWorkflow.statuses];
        hasDbConfig = true;
      }
    }

    // 4. Default Fallback if no custom workflow configured (Standard 6-status flow)
    if (result.length === 0) {
      result = [
        { id: "backlog", name: "Hold", color: "#8c8c8c", order: 0 },
        { id: "to_do", name: "To Do", color: "var(--accent-primary)", order: 1 },
        { id: "in_progress", name: "In Progress", color: "#faad14", order: 2 },
        { id: "review", name: "Review", color: "#722ed1", order: 3 },
        { id: "Rejected", name: "Rejected", color: "#ff4d4f", order: 4 },
        { id: "complete", name: "Complete", color: "#52c41a", order: 5 },
      ];
    }

    const normalizedDept = effectiveDept?.toLowerCase();
    const isDigitalMarketing = normalizedDept === "digital-marketing";

    // Return the exact workflow statuses from DB (or fallback) in their exact configured order, ensuring completion status displays as 'Complete' and appears at the end
    return result
      .map((status) => {
        let displayName = status.name;
        if (status.id === "backlog") {
          displayName = "Hold";
        } else if (
          ["complete", "done", "completed", "validated"].includes((status.id || "").toLowerCase()) ||
          (status.name || "").toLowerCase() === "done" ||
          (status.name || "").toLowerCase() === "complete"
        ) {
          displayName = isDigitalMarketing ? "Approved" : "Complete";
        }
        return {
          ...status,
          name: displayName,
        };
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [
    selectedProject,
    workflowConfig,
    allWorkflowConfigs,
    departmentFilter,
    departments,
    user,
    userRole,
  ]);

  useEffect(() => {
    if (tasks) {
      const selectedDay = selectedDate ? dayjs(selectedDate) : dayjs();
      const filteredTasks = {};

      Object.keys(tasks).forEach((statusId) => {
        filteredTasks[statusId] = tasks[statusId].filter((task) => {
          if (!selectedDate) return true;
          return taskMatchesKanbanDay(task, selectedDay);
        });
      });

      setTasksByStatus(filteredTasks);
    }
  }, [tasks, selectedDate]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileKanbanUi(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (isPendingTasksModalVisible && pendingKanbanData?.data?.tasks) {
      const allPendingTasks = Object.values(
        pendingKanbanData.data.tasks,
      ).flat();
      const userTasksMap = new Map();
      allPendingTasks.forEach((task) => {
        if (task.assignedTo) {
          const userId = task.assignedTo._id || task.assignedTo;
          const userName =
            task.assignedTo.name || task.assignedTo.email || "Unknown";
          const userEmail = task.assignedTo.email || "";
          if (!userTasksMap.has(userId)) {
            userTasksMap.set(userId, {
              userId,
              userName,
              userEmail,
              tasks: [],
            });
          }
          userTasksMap.get(userId).tasks.push(task);
        }
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const userList = Array.from(userTasksMap.values()).map((user) => {
        const tasksToRemind = user.tasks.filter(
          (t) =>
            !t.lastReminderSentAt ||
            new Date(t.lastReminderSentAt) < todayStart,
        );
        return {
          ...user,
          tasksToRemind,
          hasRemindedToday: tasksToRemind.length === 0,
        };
      });

      setPendingTasksData(userList);
    }
  }, [isPendingTasksModalVisible, pendingKanbanData]);

  const handleOpenPendingTasksModal = () => setIsPendingTasksModalVisible(true);

  const handleSendUserReminder = async (userId, tasks) => {
    setSendingReminders((prev) => new Set(prev).add(userId));
    try {
      const promises = tasks.map((task) => sendTaskReminder(task._id));
      await Promise.all(promises);
      setPendingTasksData((prevData) =>
        prevData.map((user) =>
          user.userId === userId ? { ...user, hasRemindedToday: true } : user,
        ),
      );
      notifySuccess('reminder', userId, `Reminder sent to user successfully!`);
    } catch (error) {
      console.error("Failed to send reminder:", error);
      notifyError('reminder', userId, error?.data?.message || "Failed to send reminder");
    } finally {
      setSendingReminders((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleSendAllReminders = async () => {
    setSendingReminders(new Set(["all"]));
    try {
      const allTasks = pendingTasksData.flatMap((user) => user.tasksToRemind);
      if (allTasks.length === 0) {
        message.info(
          "All pending tasks have already received reminders today.",
        );
        setSendingReminders(new Set());
        return;
      }
      const promises = allTasks.map((task) =>
        sendTaskReminder(task._id),
      );
      await Promise.all(promises);
      setPendingTasksData((prevData) =>
        prevData.map((user) => ({ ...user, hasRemindedToday: true })),
      );
      notifySuccess('reminder', 'all', `Reminders sent to all users successfully!`);
    } catch (error) {
      console.error("Failed to send reminders:", error);
      notifyError('reminder', 'all', error?.data?.message || "Failed to send reminders");
    } finally {
      setSendingReminders(new Set());
    }
  };

  const handleDragStart = (event) => setActiveId(event.active.id);

  const getValidNextStatuses = (task, currentStatusId) => {
    const rawStatuses = (() => {
    const canAccessRejected = isAdmin || isCoordinatorRole;

    let wfConfig = null;
    if (task.projectId) {
      const projectId = task.projectId._id || task.projectId;
      wfConfig = allWorkflowConfigs.find(
        (config) =>
          config.projectId &&
          (config.projectId._id?.toString() === projectId.toString() ||
            config.projectId.toString() === projectId.toString()),
      );
    }
    if (!wfConfig && task.department) {
      const normDept = String(task.department).toLowerCase().replace(/_/g, "-");
      wfConfig = allWorkflowConfigs.find(
        (c) =>
          !c.projectId &&
          c.projectType &&
          c.projectType.toLowerCase().replace(/_/g, "-") === normDept,
      );
    }
    if (!wfConfig) {
      wfConfig = workflowConfig;
    }

    if (!wfConfig || !wfConfig.statuses || wfConfig.statuses.length === 0)
      return statuses.map((s) => s.id);

    const sortedStatuses = [...wfConfig.statuses].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    const currentStatusIndex = sortedStatuses.findIndex(
      (s) => s.id === currentStatusId,
    );
    if (currentStatusIndex === -1) return statuses.map((s) => s.id);
    const validStatusIds = new Set();
    validStatusIds.add(currentStatusId);
    if (currentStatusIndex < sortedStatuses.length - 1)
      validStatusIds.add(sortedStatuses[currentStatusIndex + 1].id);
    if (currentStatusIndex > 0)
      validStatusIds.add(sortedStatuses[currentStatusIndex - 1].id);
    for (let i = 0; i < currentStatusIndex; i++)
      validStatusIds.add(sortedStatuses[i].id);

    // Allow jumping from 'backlog' (Hold) to 'in_progress'
    if (currentStatusId === "backlog") {
      validStatusIds.add("in_progress");
    }

    const finalStatusIds = Array.from(validStatusIds);
    if (canAccessRejected && !finalStatusIds.includes("Rejected")) {
      finalStatusIds.push("Rejected");
    } else if (!canAccessRejected) {
      return finalStatusIds.filter((id) => id !== "Rejected");
    }
    return finalStatusIds;
    })();

    // Forcefully allow moving back to 'to_do' or 'in_progress' from 'review'
    if (currentStatusId === "review") {
      if (!rawStatuses.includes("to_do")) rawStatuses.push("to_do");
      if (!rawStatuses.includes("in_progress")) rawStatuses.push("in_progress");
    }


    // Restrict moving backward before In Progress once the task is in progress or beyond
    const inProgressOrBeyond = [
      "in_progress",
      "review",
      "Rejected",
      "rejected",
      "done",
      "completed",
      "validated",
      "submitted",
      "complete",
    ];
    const beforeInProgress = ["to_do", "backlog", "created", "assigned"];

    // Globally prevent moving TO 'backlog' (Hold) via drag-and-drop from any other status
    return rawStatuses.filter((id) => {
      if (id === "backlog" && currentStatusId !== "backlog") {
        return false;
      }
      
      const isCreator = task.createdBy &&
        ((task.createdBy._id || task.createdBy)?.toString() === user?._id?.toString());
      const canBypassWorkflow = isCreator || kanbanIsAdmin;
      // Globally prevent moving backward before In Progress once it has started
      if (
        inProgressOrBeyond.includes(currentStatusId) &&
        beforeInProgress.includes(id)
      ) {
        return false;
      }
      // Globally prevent moving from Hold/backlog to anything other than In Progress
      if (
        (currentStatusId === "backlog" || currentStatusId === "hold") &&
        id !== "backlog" &&
        id !== "hold" &&
        id !== "in_progress"
      ) {
        return false;
      }
      return true;
    });
  };

  const appendBoardDateScope = (formData) => {
    if (!selectedDate) return;
    formData.append(
      "boardStartDate",
      selectedDate.startOf("day").toISOString(),
    );
    formData.append("boardEndDate", selectedDate.endOf("day").toISOString());
    formData.append("boardDateField", "assignedOrStartDate");
  };

  const runQuickMoveToInProgress = async (taskId) => {
    // Prevent double-fire when dnd-kit triggers both the column path
    // and the card-to-card path on the same drag drop event
    if (moveInFlightRef.current) return;
    moveInFlightRef.current = true;
    const keyId = taskId || 'quick-move';
    notifyLoading('move', keyId, 'Moving task...');
    try {
      const formData = new FormData();
      formData.append("status", "in_progress");
      formData.append("order", "0");
      appendBoardDateScope(formData);
      await updateTaskStatusAndOrder({
        id: taskId,
        formData,
      }).unwrap();
      try {
        if (typeof refetch === 'function') await refetch();
      } catch (e) {
        // ignore refetch errors
      }
      notifySuccess('move', keyId, 'Moved to In Progress');
    } catch (error) {
      notifyError('move', keyId, error?.data?.message || "Failed to move task");
    } finally {
      moveInFlightRef.current = false;
    }
  };

  const initiateColumnMove = async (
    taskId,
    draggedTask,
    sourceStatus,
    targetStatusId,
  ) => {
    if (sourceStatus === targetStatusId) return;

    const canAccessRejected = isAdmin || isCoordinatorRole;
    if (targetStatusId === "Rejected" && !canAccessRejected) {
      notifyError('move', taskId, "Only Admins and Digital Marketing Coordinators can move tasks to Rejected.");
      return;
    }

    const reviewApproverRoles = [
      "super_admin",
      "admin",
      "digital_marketing_coordinator",
      "coordinator",
      "website_coordinator",
      "agency_manager",
      "agency_super_admin",
    ];
    const canApproveReview = reviewApproverRoles.includes(userRole);
    const isDigitalMarketing = draggedTask.department === "digital-marketing";
    // 1. Mandatory In Progress move (Applies to all)
    if (
      sourceStatus === "to_do" &&
      targetStatusId !== "in_progress" &&
      !isAdmin
    ) {
      message.warning(
        "Tasks must be moved to 'In Progress' from 'To Do' before being completed.",
      );
      return;
    }

    // 2. Mandatory Review move (ONLY for Digital Marketing)
    if (
      isDigitalMarketing &&
      sourceStatus === "in_progress" &&
      ["done", "completed", "validated", "complete"].includes(targetStatusId) &&
      !isAdmin
    ) {
      message.warning(
        "Digital Marketing tasks must be moved to 'Review' before being marked as Done.",
      );
      return;
    }

    // 3. Approval permission check (Moving TO terminal status)
    if (isDigitalMarketing && (targetStatusId === "done" || targetStatusId === "complete") && !canApproveReview) {
      notifyError('move', taskId, "For Digital Marketing, only a Coordinator or Admin can mark a task as Done/Approved.");
      return;
    }

    // 4. Moving FROM Review permission check
    if (
      isDigitalMarketing &&
      sourceStatus === "review" &&
      (targetStatusId !== "done" && targetStatusId !== "complete") &&
      !canApproveReview
    ) {
      notifyError('move', taskId, "Only the task creator, Agency Manager, or Coordinator can move tasks from Review.");
      return;
    }
    const validNextStatuses = getValidNextStatuses(draggedTask, sourceStatus);
    if (!validNextStatuses.includes(targetStatusId)) {
      message.warning(
        `Cannot move task to "${statuses.find((s) => s.id === targetStatusId)?.name || targetStatusId}". Please follow the workflow order.`,
      );
      return;
    }

    if ((sourceStatus === "to_do" || sourceStatus === "backlog") && targetStatusId === "in_progress") {
      await runQuickMoveToInProgress(taskId);
      return;
    }
    setPendingStatusChange({
      taskId,
      task: draggedTask,
      sourceStatus,
      targetStatus: targetStatusId,
    });
    setIsStatusModalVisible(true);
  };

  const handleMobileMoveToColumn = (taskId, targetStatusId) => {
    if (!canMoveStatus) {
      notifyError('move', taskId, "You don't have permission to update task status");
      return;
    }
    let draggedTask = null;
    let sourceStatus = null;
    for (const [status, taskList] of Object.entries(tasksByStatus)) {
      const t = taskList.find((x) => x._id === taskId);
      if (t) {
        draggedTask = t;
        sourceStatus = status;
        break;
      }
    }
    if (!draggedTask) return;

    const isTaskOverdue =
      draggedTask.dueDate &&
      dayjs(draggedTask.dueDate).isBefore(dayjs(), "day") &&
      !["done", "completed", "validated", "complete"].includes(draggedTask.status);
    if (isTaskOverdue && !isAdmin) {
      notifyError('move', draggedTask._id, "Overdue tasks cannot be moved. Please contact an admin to update the due date first.");
      return;
    }
    const isTaskCompleted = ["done", "completed", "validated", "complete"].includes(
      draggedTask.status,
    );
    const reviewApproverRoles = [
      "super_admin",
      "admin",
      "digital_marketing_coordinator",
      "coordinator",
    ];
    const canApproveReview = reviewApproverRoles.includes(userRole);
    if (isTaskCompleted && !isAdmin && !canApproveReview) {
      notifyError('move', draggedTask._id, "Completed tasks cannot be moved. Only admins can modify completed tasks.");
      return;
    }

    void initiateColumnMove(taskId, draggedTask, sourceStatus, targetStatusId);
  };

  const handleDragEnd = async (event) => {
    if (!canMoveStatus) {
      notifyError('move', 'global', "You don't have permission to update task status");
      return;
    }
    const { active, over } = event;
    setActiveId(null);
    // Reset the in-flight lock at the start of every drag-end so a
    // new drag can always proceed even if the previous one was aborted.
    moveInFlightRef.current = false;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    let draggedTask = null;
    let sourceStatus = null;
    for (const [status, taskList] of Object.entries(tasksByStatus)) {
      const task = taskList.find((t) => t._id === activeId);
      if (task) {
        draggedTask = task;
        sourceStatus = status;
        break;
      }
    }
    if (!draggedTask) return;

    const isTaskOverdue =
      draggedTask.dueDate &&
      dayjs(draggedTask.dueDate).isBefore(dayjs(), "day") &&
      !["done", "completed", "validated", "complete"].includes(draggedTask.status);
    if (isTaskOverdue && !isAdmin) {
      notifyError('move', draggedTask._id, "Overdue tasks cannot be moved. Please contact an admin to update the due date first.");
      return;
    }
    const isTaskCompleted = ["done", "completed", "validated", "complete"].includes(
      draggedTask.status,
    );
    const reviewApproverRoles = [
      "super_admin",
      "admin",
      "digital_marketing_coordinator",
      "coordinator",
      "website_coordinator",
      "agency_manager",
      "agency_super_admin",
    ];
    const canApproveReview = reviewApproverRoles.includes(userRole);
    if (isTaskCompleted && !isAdmin && !canApproveReview) {
      notifyError('move', draggedTask._id, "Completed tasks cannot be moved. Only admins can modify completed tasks.");
      return;
    }
    const targetStatusId = over.data.current?.statusId;
    const isColumn = over.data.current?.type === "column";
    if (isColumn && targetStatusId) {
      if (sourceStatus !== targetStatusId) {
        await initiateColumnMove(
          activeId,
          draggedTask,
          sourceStatus,
          targetStatusId,
        );
      }
      return;
    }
    let targetTask = null;
    let targetStatusFromTask = null;
    for (const [status, taskList] of Object.entries(tasksByStatus)) {
      const task = taskList.find((t) => t._id === overId);
      if (task) {
        targetTask = task;
        targetStatusFromTask = status;
        break;
      }
    }
    if (targetTask) {
      if (sourceStatus === targetStatusFromTask) {
        const sourceTasks = [...tasksByStatus[sourceStatus]];
        const oldIndex = sourceTasks.findIndex((t) => t._id === activeId);
        const newIndex = sourceTasks.findIndex((t) => t._id === overId);
        if (oldIndex === newIndex) return;
        const reorderedTasks = arrayMove(sourceTasks, oldIndex, newIndex);
        const updates = reorderedTasks.map((task, index) => ({
          taskId: task._id,
          order: index,
        }));
        try {
          await updateTasksOrder({ updates }).unwrap();
          refetch();
        } catch (error) {
          notifyError('reorder', activeId || 'reorder', "Failed to reorder task");
        }
      } else {
        if (
          draggedTask.department === "digital-marketing" &&
          (targetStatusFromTask === "done" || targetStatusFromTask === "complete") &&
          !canApproveReview
        ) {
          notifyError('move', activeId, "Assigned users cannot move tasks to Done. Move In Progress to Review only.");
          return;
        }
        const validNextStatuses = getValidNextStatuses(
          draggedTask,
          sourceStatus,
        );
        if (!validNextStatuses.includes(targetStatusFromTask)) {
          message.warning(
            `Cannot move task to "${statuses.find((s) => s.id === targetStatusFromTask)?.name || targetStatusFromTask}". Please follow the workflow order.`,
          );
          return;
        }

        if (
          (sourceStatus === "to_do" || sourceStatus === "backlog") &&
          targetStatusFromTask === "in_progress"
        ) {
          await runQuickMoveToInProgress(activeId);
          return;
        }
          if (
            draggedTask.department === "digital-marketing" &&
            sourceStatus === "review" &&
            (targetStatusFromTask !== "done" && targetStatusFromTask !== "complete") &&
            !canApproveReview
          ) {
            notifyError('move', activeId, "Only the task creator, Agency Manager, or Coordinator can move tasks from Review.");
            return;
          }
        setPendingStatusChange({
          taskId: activeId,
          task: draggedTask,
          sourceStatus,
          targetStatus: targetStatusFromTask,
        });
        setIsStatusModalVisible(true);
      }
    }
  };

  const handleStatusModalSubmit = async (values) => {
    if (!pendingStatusChange) return;
    const isInProgressToReview =
      pendingStatusChange.sourceStatus === "in_progress" &&
      pendingStatusChange.targetStatus === "review";
    const isToDoToInProgress =
      pendingStatusChange.sourceStatus === "to_do" &&
      pendingStatusChange.targetStatus === "in_progress";
    const isReviewToInProgress =
      pendingStatusChange.sourceStatus === "review" &&
      pendingStatusChange.targetStatus === "in_progress";
    const isReviewToToDo =
      pendingStatusChange.sourceStatus === "review" &&
      pendingStatusChange.targetStatus === "to_do";
    const isReviewToApproved =
      pendingStatusChange.sourceStatus === "review" &&
      (pendingStatusChange.targetStatus === "done" || pendingStatusChange.targetStatus === "complete");
    const isDigitalMarketing =
      pendingStatusChange?.task?.department === "digital-marketing";
    const requiresCommand =
      !isInProgressToReview && !isToDoToInProgress && !isReviewToApproved;
    if (requiresCommand && !values.command) {
      notifyError('move', pendingStatusChange?.taskId || 'status-change', "Please enter a command.");
      return;
    }
    if (isInProgressToReview && !screenshotFile) {
      notifyError('move', pendingStatusChange?.taskId || 'status-change', "Please upload a file before moving task to Review.");
      return;
    }
    if (isDigitalMarketing && isReviewToApproved && !screenshotFile) {
      notifyError('move', pendingStatusChange?.taskId || 'status-change', "Please upload a file before moving task to Approved.");
      return;
    }
    const keyId = pendingStatusChange?.taskId || 'status-change';
    notifyLoading('move', keyId, 'Moving task...');
    try {
      const formData = new FormData();
      formData.append("status", pendingStatusChange.targetStatus);
      formData.append("order", "0");
      appendBoardDateScope(formData);
      if (requiresCommand) {
        formData.append("command", values.command);
      }
      if (isReviewToInProgress) formData.append("taskCategory", "Correction");
      if (isReviewToToDo) formData.append("taskCategory", "Redesign");
      if (screenshotFile) formData.append("screenshot", screenshotFile);
      await updateTaskStatusAndOrder({
        id: pendingStatusChange.taskId,
        formData,
      }).unwrap();
      // Determine completion status configured in active workflow template
      const currentBoardStatuses = statuses || [];
      const hasReviewStatus = currentBoardStatuses.some(
        (s) => (s.id || "").toLowerCase() === "review" || (s.name || "").toLowerCase() === "review",
      );
      const lastWorkflowStatus = currentBoardStatuses.length > 0 ? currentBoardStatuses[currentBoardStatuses.length - 1] : null;
      const lastStatusId = (lastWorkflowStatus?.id || "").toLowerCase().trim();
      const targetStatusNorm = (pendingStatusChange.targetStatus || "").toLowerCase().trim();

      const isTargetCompleted =
        (hasReviewStatus && (targetStatusNorm === "review" || targetStatusNorm === "in_review")) ||
        (targetStatusNorm === lastStatusId) ||
        ["complete", "completed", "done", "validated"].includes(targetStatusNorm);

      const assignedToId =
        pendingStatusChange.task?.assignedTo?._id ||
        pendingStatusChange.task?.assignedTo ||
        null;
      const isAssignedToMe =
        !assignedToId || assignedToId?.toString?.() === user?._id?.toString?.();

      if (isTargetCompleted && (isAssignedToMe || !isAdmin) && onTaskCompleted) {
        // Calculate exact counts from current board state
        const allBoardTasks = Object.values(tasksByStatus).flat();
        const totalBoardCount = allBoardTasks.length;
        const targetTaskId = pendingStatusChange.taskId?.toString();
        
        let completedCount = 0;
        allBoardTasks.forEach((t) => {
          const tId = (t._id || t.id)?.toString();
          const isThisTaskTarget = tId === targetTaskId;
          const statusNorm = isThisTaskTarget
            ? targetStatusNorm
            : (t.status || "").toLowerCase().trim();

          const isTaskDone =
            (hasReviewStatus && (statusNorm === "review" || statusNorm === "in_review")) ||
            (statusNorm === lastStatusId) ||
            ["complete", "completed", "done", "validated"].includes(statusNorm);

          if (isTaskDone) completedCount++;
        });

        onTaskCompleted({ completedCount, totalCount: totalBoardCount });
      }
      try {
        if (typeof refetch === 'function') await refetch();
      } catch (e) {
        // ignore
      }
      notifySuccess('move', keyId, 'Task moved successfully');
      setIsStatusModalVisible(false);
      statusForm.resetFields();
      setScreenshotFile(null);
      setPendingStatusChange(null);

    } catch (error) {
      notifyError('move', keyId, error?.data?.message || "Failed to move task");
    }
  };

  const handleStatusModalCancel = () => {
    setIsStatusModalVisible(false);
    statusForm.resetFields();
    setScreenshotFile(null);
    setPendingStatusChange(null);
  };

  const activeTask = activeId
    ? Object.values(tasksByStatus)
        .flat()
        .find((task) => task._id === activeId)
    : null;

  // ── Shared select style ───────────────────────────────────────────
  const selectStyle = {
    height: 36,
    fontSize: 13,
  };

  return (
    <div
      style={{
        padding: "20px 24px",
        minHeight: "100%",
        backgroundColor: isDark ? "hsl(var(--background))" : "#ffffff",
      }}
    >
      {/* ── Filter Bar ─────────────────────────────────────────────── */}
      <div
        style={{
          marginBottom: 20,
          padding: "14px 16px",
          background: isDark ? "#0f0f11" : "#f8fafc",
          border: isDark ? "1px solid #1e1e22" : "1px solid #e8eaed",
          borderRadius: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              flex: 1,
            }}
          >
            {(userRole === "admin" ||
              userRole === "super_admin" ||
              userRole === "client" ||
              userRole === "digital_marketing_manager" ||
              userRole === "digital_marketing_coordinator" ||
              userRole === "website_coordinator") && (
              <>
                <Select
                  placeholder="Filter by Project"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  style={{ width: 200, ...selectStyle }}
                  onChange={setSelectedProject}
                  value={selectedProject}
                >
                  {projects.map((project) => (
                    <Option key={project._id} value={project._id}>
                      {project.name}
                    </Option>
                  ))}
                </Select>

                <Select
                  placeholder="Assigned To"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  style={{ width: 180, ...selectStyle }}
                  onChange={setSelectedUser}
                  value={selectedUser}
                >
                  <Option value="unassigned">Unassigned</Option>
                  {users.map((u) => (
                    <Option key={u._id} value={u._id}>
                      {u.name}
                    </Option>
                  ))}
                </Select>

                <Select
                  placeholder="Assigned By"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  style={{ width: 180, ...selectStyle }}
                  onChange={setSelectedCreator}
                  value={selectedCreator}
                >
                  {users
                    .filter((u) =>
                      [
                        "super_admin",
                        "admin",
                        "coordinator",
                        "digital_marketing_coordinator",
                        "website_coordinator",
                        "digital_marketing_manager",
                        "operations_head",
                      ].includes(u.role),
                    )
                    .map((u) => (
                      <Option key={u._id} value={u._id}>
                        {u.name}
                      </Option>
                    ))}
                </Select>
              </>
            )}

            <Select
              placeholder="Priority"
              allowClear
              style={{ width: 130, ...selectStyle }}
              onChange={setSelectedPriority}
              value={selectedPriority}
            >
              <Option value="low">Low</Option>
              <Option value="medium">Medium</Option>
              <Option value="high">High</Option>
              <Option value="critical">Critical</Option>
            </Select>

            <Select
              placeholder="Type"
              allowClear
              style={{ width: 120, ...selectStyle }}
              onChange={setSelectedTaskType}
              value={selectedTaskType}
            >
              <Option value="New">New</Option>
              <Option value="Correction">Correction</Option>
              <Option value="Redesign">Redesign</Option>
            </Select>

            <DatePicker
              placeholder="Due Date"
              style={{ width: 150, height: 36 }}
              onChange={setSelectedDate}
              value={selectedDate}
            />

            <button
              onClick={() => {
                setSelectedProject(null);
                setSelectedUser(null);
                setSelectedCreator(null);
                setSelectedPriority(null);
                setSelectedDate(dayjs());
              }}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: isDark ? "#6b7280" : "#94a3b8",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
                height: 36,
                display: "flex",
                alignItems: "center",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = isDark ? "#d1d5db" : "#4b5563")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = isDark ? "#6b7280" : "#94a3b8")
              }
            >
              Reset Filters
            </button>
          </div>

          {(userRole === "admin" ||
            userRole === "super_admin" ||
            userRole === "digital_marketing_manager" ||
            userRole === "digital_marketing_coordinator" ||
            userRole === "website_coordinator") && (
            <Button
              type="primary"
              icon={<BellOutlined />}
              onClick={handleOpenPendingTasksModal}
              style={{
                height: 36,
                borderRadius: 9,
                fontWeight: 600,
                fontSize: 13,
                paddingInline: 16,
                boxShadow: "0 2px 8px rgba(239,68,68,0.3)",
                background: "#ef4444",
                border: "none",
              }}
            >
              Pending Tasks
            </Button>
          )}
        </div>
      </div>

      {selectedDate &&
      !isScheduledNotesLoading &&
      selectedDayNotes.length > 0 ? (
        <div
          style={{
            marginBottom: 18,
            padding: "16px 18px",
            borderRadius: 18,
            border: isDark ? "1px solid #334155" : "1px solid #dbeafe",
            background: isDark
              ? "linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(15, 23, 42, 0.92))"
              : "linear-gradient(135deg, rgba(219, 234, 254, 0.9), rgba(255, 255, 255, 1))",
            boxShadow: isDark
              ? "0 14px 32px rgba(2, 6, 23, 0.32)"
              : "0 12px 28px rgba(59, 130, 246, 0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isDark ? "rgba(96, 165, 250, 0.16)" : "#dbeafe",
                  color: isDark ? "#93c5fd" : "var(--accent-primary)",
                  flexShrink: 0,
                }}
              >
                <CalendarOutlined />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: isDark ? "#f8fafc" : "#0f172a",
                  }}
                >
                  Notes for {selectedDate.format("DD MMM YYYY")}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: isDark ? "#94a3b8" : "#64748b",
                    marginTop: 2,
                  }}
                >
                  {selectedDayNotes.length} scheduled{" "}
                  {selectedDayNotes.length === 1 ? "note" : "notes"} available
                  for this day
                </div>
              </div>
            </div>

            <Tag
              style={{
                marginInlineEnd: 0,
                borderRadius: 999,
                padding: "6px 12px",
                fontWeight: 700,
                borderColor: isDark ? "var(--accent-primary)" : "#93c5fd",
                background: isDark ? "rgba(29, 78, 216, 0.2)" : "#eff6ff",
                color: isDark ? "var(--accent-primary)" : "var(--accent-primary)",
              }}
            >
              {selectedDayNotes.length} note
              {selectedDayNotes.length === 1 ? "" : "s"}
            </Tag>
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {selectedDayNotes.map((note) => (
              <div
                key={note._id}
                style={{
                  minWidth: 220,
                  flex: "1 1 240px",
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: isDark ? "1px solid #334155" : "1px solid #dbeafe",
                  background: isDark
                    ? "linear-gradient(180deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.96))"
                    : "rgba(255, 255, 255, 0.92)",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: isDark ? "#e2e8f0" : "#1e293b",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {note.notes}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11.5,
                    color: isDark ? "#94a3b8" : "#64748b",
                  }}
                >
                  Created by {note.createdBy?.name || "N/A"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Kanban Board ─────────────────────────────────────────────── */}
      <Spin spinning={isLoadingTasks || isLoadingWorkflow}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            style={{
              display: "flex",
              overflowX: "auto",
              paddingBottom: 20,
              gap: 0,
            }}
          >
            {statuses.map((status) => {
              const statusTasks = [...(tasksByStatus[status.id] || [])].sort(
                (a, b) => {
                  if (a.order !== b.order) return a.order - b.order;
                  return new Date(a.dueDate) - new Date(b.dueDate);
                },
              );
              return (
                <KanbanColumn
                  key={status.id}
                  status={status}
                  tasks={statusTasks}
                  onTaskClick={onTaskClick}
                  onAddTask={onAddTask}
                  canCreate={canCreate}
                  canEdit={canEdit}
                  canDrag={canMoveStatus}
                  canDelete={canDelete}
                  onDelete={async (id) => {
                    await deleteTask(id).unwrap();
                    refetch();
                  }}
                  getWorkflowColorForTask={getWorkflowColorForTask}
                  userRole={userRole}
                  navigate={navigate}
                  isMobileKanbanUi={isMobileKanbanUi}
                  kanbanStatuses={statuses}
                  onMobileMoveToColumn={handleMobileMoveToColumn}
                  onReopen={handleReopenClick}
                  user={user}
                />
              );
            })}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeTask
              ? (() => {
                  const activeWorkflowColor =
                    getWorkflowColorForTask(activeTask);
                  const borderColor =
                    activeWorkflowColor ||
                    getPriorityColor(activeTask.priority);
                  return (
                    <div
                      style={{
                        width: 295,
                        borderRadius: 12,
                        overflow: "hidden",
                        background: isDark ? "#1c1c1e" : "#ffffff",
                        border: isDark
                          ? "1px solid #2a2a2e"
                          : "1px solid #e8eaed",
                        boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
                        position: "relative",
                        transform: "rotate(1.5deg)",
                        opacity: 0.95,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 4,
                          background: borderColor,
                        }}
                      />
                      <div style={{ padding: "12px 14px 12px 18px" }}>
                        <div style={{ marginBottom: 8 }}>
                          <strong
                            style={{
                              fontSize: 13.5,
                              color: isDark ? "#e5e7eb" : "#111827",
                            }}
                          >
                            {activeTask.title}
                          </strong>
                        </div>
                        {activeTask.description && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#9ca3af",
                              marginBottom: 10,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {activeTask.description}
                          </div>
                        )}
                        {activeTask.projectId && (
                          <span
                            style={{
                              alignItems: "center",
                              gap: 5,
                              fontSize: 11,
                              fontWeight: 600,
                              color: activeTask.projectId.color || "var(--accent-primary)",
                              background: activeTask.projectId.color
                                ? `${activeTask.projectId.color}12`
                                : "#eff6ff",
                              border: `1px solid ${activeTask.projectId.color ? `${activeTask.projectId.color}30` : "#bfdbfe"}`,
                              borderRadius: 6,
                              padding: "3px 8px",
                              marginBottom: 10,
                              display: "block",
                            }}
                          >
                            {activeTask.projectId.name || "No Project"}
                          </span>
                        )}
                        {activeTask.createdBy && (
                          <div
                            style={{
                              alignItems: "center",
                              gap: 5,
                              background: isDark ? "#242428" : "#f8fafc",
                              borderRadius: 6,
                              padding: "3px 8px 3px 4px",
                              border: `1px solid ${isDark ? "#2d2d32" : "#e2e8f0"}`,
                              marginBottom: 10,
                            }}
                          >
                            <Avatar
                              size={18}
                              style={{ background: "#6366f1", fontSize: 9 }}
                            >
                              {activeTask.createdBy.name?.charAt(0) || "U"}
                            </Avatar>
                            <span
                              style={{
                                fontSize: 11,
                                color: isDark ? "#d1d5db" : "#374151",
                                fontWeight: 600,
                              }}
                            >
                              {activeTask.createdBy.name || "Unknown"}
                            </span>
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {activeTask.assignedTo ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                background: isDark ? "#242428" : "#f1f5f9",
                                borderRadius: 20,
                                padding: "2px 8px 2px 3px",
                              }}
                            >
                              <Avatar
                                size={18}
                                src={activeTask.assignedTo?.avatar}
                                style={{ background: "#10b981", fontSize: 9 }}
                              >
                                {activeTask.assignedTo?.name?.charAt(0) || (
                                  <UserOutlined />
                                )}
                              </Avatar>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: isDark ? "#d1d5db" : "#374151",
                                  fontWeight: 500,
                                }}
                              >
                                {activeTask.assignedTo?.name || "Unassigned"}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>
                              Unassigned
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              color: getPriorityColor(activeTask.priority),
                              background: getPriorityBg(activeTask.priority),
                              borderRadius: 5,
                              padding: "2px 7px",
                            }}
                          >
                            {activeTask.priority?.toUpperCase() || "MEDIUM"}
                          </span>
                        </div>
                        {activeTask.dueDate && (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 11,
                              color: "#9ca3af",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <CalendarOutlined style={{ fontSize: 10 }} />
                            {dayjs(activeTask.dueDate).format("MMM DD")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              : null}
          </DragOverlay>
        </DndContext>
      </Spin>

      {/* Status Change Modal */}
      <Modal
        title={
          pendingStatusChange?.sourceStatus === 'review' && pendingStatusChange?.targetStatus === 'in_progress'
            ? '🔄 Mark as Correction'
            : pendingStatusChange?.sourceStatus === 'review' && pendingStatusChange?.targetStatus === 'to_do'
            ? '🎨 Send for Redesign'
            : 'Move Task to Next Status'
        }
        open={isStatusModalVisible}
        onCancel={handleStatusModalCancel}
        footer={null}
        width={600}
      >
        {pendingStatusChange && (
          <div style={{ marginBottom: 16 }}>
            <p>
              <strong>Task:</strong> {pendingStatusChange.task?.title}
            </p>
            <p>
              <strong>Moving from:</strong>{" "}
              {statuses.find((s) => s.id === pendingStatusChange.sourceStatus)
                ?.name || pendingStatusChange.sourceStatus}
              {" → "}
              <strong>To:</strong>{" "}
              {statuses.find((s) => s.id === pendingStatusChange.targetStatus)
                ?.name || pendingStatusChange.targetStatus}
            </p>
          </div>
        )}
        {(() => {
          const isInProgressToReview =
            pendingStatusChange?.sourceStatus === "in_progress" &&
            pendingStatusChange?.targetStatus === "review";
          const isToDoToInProgress =
            pendingStatusChange?.sourceStatus === "to_do" &&
            pendingStatusChange?.targetStatus === "in_progress";
          const isReviewToInProgress =
            pendingStatusChange?.sourceStatus === "review" &&
            pendingStatusChange?.targetStatus === "in_progress";
          const isReviewToToDo =
            pendingStatusChange?.sourceStatus === "review" &&
            pendingStatusChange?.targetStatus === "to_do";
          const isReviewToApproved =
            pendingStatusChange?.sourceStatus === "review" &&
            (pendingStatusChange?.targetStatus === "done" || pendingStatusChange?.targetStatus === "complete");
          const isDigitalMarketing =
            pendingStatusChange?.task?.department === "digital-marketing";
          const shouldShowCommand =
            !isInProgressToReview && !isToDoToInProgress && !isReviewToApproved;
          const shouldHideScreenshot =
            (!isDigitalMarketing && !isInProgressToReview) ||
            isToDoToInProgress ||
            isReviewToInProgress ||
            isReviewToToDo;
          const isFileRequired =
            isInProgressToReview || (isDigitalMarketing && isReviewToApproved);
          return (
            <Form
              form={statusForm}
              layout="vertical"
              onFinish={handleStatusModalSubmit}
              autoComplete="off"
            >
              {/* Contextual banner for Correction (Review → In Progress) */}
              {isReviewToInProgress && (
                <div style={{
                  marginBottom: 16,
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #fff3cd, #fff8e1)',
                  border: '1px solid #ffd600',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}>
                  <span style={{ fontSize: 22 }}>🔄</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#b45309', marginBottom: 4 }}>Moving to Correction</div>
                    <div style={{ fontSize: 13, color: '#78350f' }}>
                      This task will be moved back to <strong>In Progress</strong> and tagged as a <strong>Correction</strong>.
                      The assigned user will continue working on it.
                    </div>
                  </div>
                </div>
              )}
              {/* Contextual banner for Redesign (Review → To Do) */}
              {isReviewToToDo && (
                <div style={{
                  marginBottom: 16,
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #f3e8ff, #ede9fe)',
                  border: '1px solid #a78bfa',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}>
                  <span style={{ fontSize: 22 }}>🎨</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#6d28d9', marginBottom: 4 }}>Sending for Redesign</div>
                    <div style={{ fontSize: 13, color: '#4c1d95' }}>
                      This task will be moved back to <strong>To Do</strong> and tagged as a <strong>Redesign</strong>.
                      The assignee will need to restart the task from scratch.
                    </div>
                  </div>
                </div>
              )}
              {shouldShowCommand && (
                <Form.Item
                  name="command"
                  label={(isReviewToInProgress || isReviewToToDo) ? "Comments/Description" : "Command"}
                  rules={[
                    { required: true, message: (isReviewToInProgress || isReviewToToDo) ? "Please enter comments/description" : "Please enter a command" },
                  ]}
                >
                  <Input.TextArea
                    rows={4}
                    placeholder={(isReviewToInProgress || isReviewToToDo) ? "Explain why the task is being sent back..." : "Enter command or notes for this status change"}
                  />
                </Form.Item>
              )}
              {!shouldHideScreenshot && (
                <Form.Item
                  name="screenshot"
                  label={isFileRequired ? "File" : "Screenshot (Optional)"}
                  required={isFileRequired}
                  rules={
                    isFileRequired
                      ? [
                          {
                            validator: () =>
                              screenshotFile
                                ? Promise.resolve()
                                : Promise.reject(
                                    new Error(
                                      isReviewToApproved
                                        ? "Please upload a file before moving to Approved."
                                        : "Please upload a file before moving to Review.",
                                    ),
                                  ),
                          },
                        ]
                      : []
                  }
                >
                  <div>
                    <Upload
                      beforeUpload={(file) => {
                        const isImage = file.type.startsWith("image/");
                        if (!isImage) {
                          notifyError('upload', 'global', "You can only upload image files!");
                          return false;
                        }
                        const isLt5M = file.size / 1024 / 1024 < 5;
                        if (!isLt5M) {
                          notifyError('upload', 'global', "Image must be smaller than 5MB!");
                          return false;
                        }
                        setScreenshotFile(file);
                        return false;
                      }}
                      maxCount={1}
                      accept="image/*"
                      showUploadList={false}
                    >
                      <Button icon={<UploadOutlined />}>
                        {screenshotFile ? "Replace file" : "Upload"}
                      </Button>
                    </Upload>
                    {screenshotPreviewUrl && (
                      <div
                        style={{
                          marginTop: 12,
                          width: "fit-content",
                          maxWidth: "100%",
                        }}
                      >
                        <img
                          src={screenshotPreviewUrl}
                          alt={screenshotFile?.name || "Selected file preview"}
                          style={{
                            maxWidth: "100%",
                            width: "auto",
                            height: "auto",
                            display: "block",
                            borderRadius: 8,
                            border: isDark
                              ? "1px solid #27272a"
                              : "1px solid #e5e7eb",
                          }}
                        />
                        <Button
                          type="link"
                          danger
                          size="small"
                          style={{ paddingLeft: 0, marginTop: 4 }}
                          onClick={() => setScreenshotFile(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                  <div
                    style={{ marginTop: 8, color: "#9ca3af", fontSize: "12px" }}
                  >
                    Maximum size: 5MB
                  </div>
                </Form.Item>
              )}
              <Form.Item>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
                  <Button onClick={handleStatusModalCancel}>Cancel</Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={isStatusUpdating}
                  >
                    Submit & Move
                  </Button>
                </div>
              </Form.Item>
            </Form>
          );
        })()}
      </Modal>

      {/* Pending Tasks Modal */}
      <Modal
        title="Pending Tasks - Send Reminders"
        open={isPendingTasksModalVisible}
        onCancel={() => setIsPendingTasksModalVisible(false)}
        footer={null}
        width={600}
      >
        {pendingTasksData.length === 0 ? (
          <Empty
            description="No pending tasks found"
            style={{ padding: "40px 0" }}
          />
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <p style={{ color: "#6b7280", marginBottom: 16 }}>
                The following users have overdue tasks. Click the reminder icon
                to send a notification to a specific user, or use "Send All" to
                notify everyone.
              </p>
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {pendingTasksData.map((userData) => (
                  <div
                    key={userData.userId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      marginBottom: 8,
                      backgroundColor: isDark ? "#1a1a1a" : "#f9fafb",
                      borderRadius: 10,
                      border: isDark ? "1px solid #333" : "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <Avatar
                          size="small"
                          style={{
                            backgroundColor: "#10b981",
                            fontSize: "12px",
                          }}
                        >
                          {userData.userName.charAt(0).toUpperCase()}
                        </Avatar>
                        <strong style={{ fontSize: "14px" }}>
                          {userData.userName}
                        </strong>
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#6b7280",
                          marginLeft: 32,
                        }}
                      >
                        {userData.userEmail}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#ef4444",
                          marginLeft: 32,
                          marginTop: 4,
                        }}
                      >
                        {userData.tasks.length} overdue task
                        {userData.tasks.length > 1 ? "s" : ""}
                      </div>
                    </div>
                    {userData.hasRemindedToday ? (
                      <Tag
                        color="success"
                        style={{
                          marginLeft: 12,
                          marginRight: 0,
                          padding: "4px 8px",
                          fontSize: "12px",
                          border: "none",
                          fontWeight: 500,
                        }}
                      >
                        Sent Today
                      </Tag>
                    ) : (
                      <Button
                        type="primary"
                        icon={<BellOutlined />}
                        size="small"
                        loading={sendingReminders.has(userData.userId)}
                        onClick={() =>
                          handleSendUserReminder(
                            userData.userId,
                            userData.tasksToRemind,
                          )
                        }
                        style={{ marginLeft: 12 }}
                      >
                        Remind
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                paddingTop: 16,
                borderTop: isDark ? "1px solid #333" : "1px solid #e5e7eb",
              }}
            >
              <Button onClick={() => setIsPendingTasksModalVisible(false)}>
                Close
              </Button>
              <Button
                type="primary"
                danger
                icon={<BellOutlined />}
                loading={sendingReminders.has("all")}
                onClick={handleSendAllReminders}
              >
                Send All Reminders
              </Button>
            </div>
          </>
        )}
      </Modal>

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

export default KanbanBoard;
