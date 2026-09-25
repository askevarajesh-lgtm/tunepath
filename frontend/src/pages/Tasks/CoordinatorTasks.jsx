import UserSelect from '../../components/common/UserSelect';
import { useAuth } from "../../contexts/AuthContext";
import React, { useState, useMemo } from "react";
import {
  Typography,
  Button,
  Avatar,
  Space,
  Empty,
  Tooltip,
  Popconfirm,
  message,
  Progress,
  DatePicker,
  theme as antTheme,
  Spin,
} from "antd";
import dayjs from "dayjs";
import {
  PlusOutlined,
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import {
  useGetCoordinatorTasksQuery,
  useDeleteCoordinatorTaskMutation,
  useGetTodayCoordinatorTaskStatsQuery,
} from "../../api/coordinatorTaskApi";
import { useGetUsersDropdownQuery } from "../../api/userApi";
import CreateCoordinatorTaskModal from "./CreateCoordinatorTaskModal";
import CoordinatorTaskDetailModal from "./CoordinatorTaskDetailModal";
import TaskPendingReasonModal from "./TaskPendingReasonModal";
import CoordinatorTaskCard from "./CoordinatorTaskCard";
import TaskCompletionCelebrate from "./TaskCompletionCelebrate";
import TaskCompletionToast from "./Taskcompletiontoast";
import { isCompletedTask } from "./taskDuration";
import { notifyLoading, notifySuccess, notifyError } from '../../utils/notify';
import { useActionPermissions } from "../../hooks/useActionPermissions";


const { Title, Text } = Typography;

const stringToColor = (str = "") => {
  const colors = [
    "#6366f1",
    "#f59e0b",
    "#10b981",
    "var(--accent-primary)",
    "#ec4899",
    "#8b5cf6",
    "#14b8a6",
    "#f97316",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const CoordinatorTasks = () => {
  const { token } = antTheme.useToken();
  const { user } = useAuth();
  const { canAdd, canEdit, canDelete } = useActionPermissions("/coordinator-tasks");
  const [selectedDate, setSelectedDate] = useState(dayjs());

  const {
    data: tasksData,
    isLoading: tasksLoading,
    refetch,
  } = useGetCoordinatorTasksQuery({
    date: selectedDate.format("YYYY-MM-DD"),
  });
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const { data: usersData, isLoading: usersLoading } = useGetUsersDropdownQuery(
    {
      hasModuleAccess: "coordinator-tasks",
      isActive: true,
    },
  );
  const [deleteTask] = useDeleteCoordinatorTaskMutation();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [isPendingReasonVisible, setIsPendingReasonVisible] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastCount, setToastCount] = useState(0);
  const [toastTotal, setToastTotal] = useState(0);

  const { data: todayStatsData, refetch: refetchTodayStats } =
    useGetTodayCoordinatorTaskStatsQuery(undefined, {
      skip: !user?._id,
    });

  const handleTaskCompleted = async () => {
    if (!user?._id) return;

    // Small delay to ensure DB consistency before refetching stats
    await new Promise((resolve) => setTimeout(resolve, 800));

    try {
      const result = await refetchTodayStats();
      const stats = result.data?.data || result.data;

      if (stats && stats.totalToday > 0) {
        if (stats.completedToday >= stats.totalToday) {
          setShowCelebration(true);
        } else {
          setToastCount(stats.completedToday);
          setToastTotal(stats.totalToday);
          setShowToast(true);
        }
      }
    } catch (error) {
      console.error("Error fetching coordinator task stats:", error);
    }
  };

  const coordinators = useMemo(() => {
    const allCoordinators = usersData?.data?.users || [];
    const isAdminView = [
      "admin",
      "super_admin",
      "superadmin",
      "supreme_super_admin",
      "commander_admin",
      "agency_super_admin",
      "agency_manager",
      "brand_admin",
      "brand_manager",
    ].includes(user?.role);

    if (isAdminView) {
      // Agency managers/admins should see all tasks, even for users without the module enabled.
      // So we must combine dropdown users with any users found in tasks.
      const tasks = tasksData?.data?.tasks || [];
      const userMap = new Map();

      allCoordinators.forEach((u) => userMap.set(u._id, u));

      tasks.forEach((task) => {
        if (task.assignedTo && !userMap.has(task.assignedTo._id || task.assignedTo)) {
          // Add the missing user from the task
          const userObj = task.assignedTo._id ? task.assignedTo : { _id: task.assignedTo, name: 'Unknown User' };
          userMap.set(userObj._id, userObj);
        }
      });

      return Array.from(userMap.values());
    }

    return allCoordinators.filter((u) => u._id === user?._id);
  }, [usersData, user, tasksData]);

  const tasksByCoordinator = useMemo(() => {
    const tasks = tasksData?.data?.tasks || [];
    return tasks.reduce((acc, task) => {
      const coordinatorId = task.assignedTo?._id || task.assignedTo;
      if (!acc[coordinatorId]) acc[coordinatorId] = [];
      acc[coordinatorId].push(task);
      return acc;
    }, {});
  }, [tasksData]);

  const handleEditClick = (e, task) => {
    e.stopPropagation();
    setSelectedTask(task);
    setIsModalVisible(true);
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setIsDetailVisible(true);
  };

  const handleDeleteTask = async (id) => {
    try {
      notifyLoading('delete', id, 'Deleting task...');
      await deleteTask(id).unwrap();
      notifySuccess('delete', id, 'Task deleted successfully');
      try { if (typeof refetch === 'function') await refetch(); } catch(e) {}
    } catch (err) {
      notifyError('delete', id, err.data?.message || "Failed to delete task");
    }
  };

  const handleCreateSuccess = () => {
    refetch();
  };

  const handleManualCreate = (newTask) => {
    setSelectedTask(newTask);
    setIsDetailVisible(true);
  };

  const handlePendingReasonClick = (task) => {
    setSelectedTask(task);
    setIsPendingReasonVisible(true);
  };

  if (tasksLoading || usersLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
          flexDirection: "column",
          gap: 16,
        }}
      >
        <Spin size="large" />
        <Text style={{ color: token.colorTextSecondary, fontSize: 13 }}>
          Loading dashboard…
        </Text>
      </div>
    );
  }

  return (
    <div style={{ height: "100%" }}>
      {/* ── Page Header ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
          paddingBottom: 20,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div>
          <Title
            level={3}
            style={{
              margin: 0,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: token.colorText,
              fontSize: 22,
            }}
          >
            Coordinator Tasks
          </Title>
          <Text
            style={{
              color: token.colorTextTertiary,
              fontSize: 13,
              marginTop: 2,
              display: "block",
            }}
          >
            Track client progress through 13-point standard checklists
          </Text>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <DatePicker
            value={selectedDate}
            onChange={(date) => setSelectedDate(date || dayjs())}
            allowClear={false}
            format="MMM D, YYYY"
            suffixIcon={
              <CalendarOutlined style={{ color: token.colorTextTertiary }} />
            }
            style={{
              height: 38,
              borderRadius: 10,
              width: 155,
              border: `1.5px solid ${token.colorBorderSecondary}`,
              fontSize: 13,
            }}
          />
          {canAdd && (user.role !== "admin" && user.role !== "super_admin") && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setSelectedTask(null);
                setIsModalVisible(true);
              }}
              style={{
                background: token.colorPrimary,
                border: "none",
                borderRadius: 10,
                height: 38,
                paddingInline: 18,
                fontWeight: 600,
                fontSize: 13,
                boxShadow: `0 2px 8px ${token.colorPrimary}35`,
              }}
            >
              New Task
            </Button>
          )}
        </div>
      </div>

      {/* ── Kanban Columns ── */}
      <div
        style={{
          display: "flex",
          overflowX: "auto",
          gap: 14,
          paddingBottom: 20,
          minHeight: "calc(100vh - 220px)",
          alignItems: "flex-start",
        }}
      >
        {coordinators.map((coordinator) => {
          const colTasks = tasksByCoordinator[coordinator._id] || [];
          const avatarColor = stringToColor(coordinator.name);
          const completedTasks = colTasks.filter(
            (t) => isCompletedTask(t.status?.toLowerCase()),
          ).length;

          return (
            <div
              key={coordinator._id}
              style={{
                minWidth: 300,
                maxWidth: 300,
                borderRadius: 16,
                border: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgContainer,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                maxHeight: "calc(100vh - 220px)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              {/* Column Header */}
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  background: token.colorBgContainer,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <Avatar
                      size={32}
                      src={coordinator.profileImage}
                      icon={!coordinator.profileImage && <UserOutlined />}
                      style={{
                        background: avatarColor,
                        fontWeight: 700,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      {!coordinator.profileImage &&
                        coordinator.name?.charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                      <Text
                        strong
                        style={{
                          fontSize: 13,
                          display: "block",
                          lineHeight: "1.2",
                          color: token.colorText,
                        }}
                      >
                        {coordinator.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10.5,
                          color: token.colorTextTertiary,
                          textTransform: "capitalize",
                        }}
                      >
                        {coordinator.role?.replace(/_/g, " ")}
                      </Text>
                    </div>
                  </div>

                  <div
                    style={{
                      minWidth: 22,
                      height: 22,
                      borderRadius: 100,
                      background:
                        colTasks.length > 0
                          ? token.colorPrimary
                          : token.colorFillSecondary,
                      color:
                        colTasks.length > 0
                          ? "#ffffff"
                          : token.colorTextQuaternary,
                      fontSize: 11,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 6px",
                    }}
                  >
                    {colTasks.length}
                  </div>
                </div>

                {/* Mini progress bar for the column */}
                {colTasks.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          color: token.colorTextQuaternary,
                        }}
                      >
                        {completedTasks}/{colTasks.length} completed
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: token.colorPrimary,
                          fontWeight: 600,
                        }}
                      >
                        {Math.round((completedTasks / colTasks.length) * 100)}%
                      </Text>
                    </div>
                    <div
                      style={{
                        height: 3,
                        borderRadius: 100,
                        background: token.colorFillSecondary,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round(
                            (completedTasks / colTasks.length) * 100,
                          )}%`,
                          borderRadius: 100,
                          background: token.colorPrimary,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Task Cards */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "12px 10px",
                  background: token.colorBgLayout,
                }}
              >
                {colTasks.length > 0 ? (
                  colTasks.map((task) => (
                    <CoordinatorTaskCard
                      key={task._id}
                      task={task}
                      user={user}
                      onEdit={handleEditClick}
                      onDelete={handleDeleteTask}
                      onClick={() => handleTaskClick(task)}
                      onPendingReason={handlePendingReasonClick}
                      canDelete={canDelete}
                    />
                  ))
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "50px 0",
                    }}
                  >
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <span
                          style={{
                            color: token.colorTextQuaternary,
                            fontSize: 12,
                          }}
                        >
                          No tasks yet
                        </span>
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {coordinators.length === 0 && (
          <div style={{ width: "100%", textAlign: "center", paddingTop: 80 }}>
            <Empty description="No coordinators found" />
          </div>
        )}
      </div>

      <CreateCoordinatorTaskModal
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onSuccess={handleCreateSuccess}
        task={selectedTask}
        initialDate={selectedDate.toDate()}
        onManualCreate={handleManualCreate}
        coordinators={coordinators}
      />

      <CoordinatorTaskDetailModal
        taskId={selectedTask?._id}
        visible={isDetailVisible}
        onCancel={() => {
          setIsDetailVisible(false);
          refetch();
        }}
        onTaskCompleted={handleTaskCompleted}
      />

      <TaskPendingReasonModal
        visible={isPendingReasonVisible}
        onCancel={() => setIsPendingReasonVisible(false)}
        task={selectedTask}
        onSuccess={() => refetch()}
      />

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
    </div>
  );
};

export default CoordinatorTasks;
