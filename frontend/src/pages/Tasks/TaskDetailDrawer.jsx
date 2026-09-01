import { useAuth } from "../../contexts/AuthContext";
import React, { useState } from "react";
import {
  Drawer,
  Descriptions,
  Tag,
  Avatar,
  Timeline,
  Input,
  Button,
  Space,
  Tabs,
  Empty,
  message,
  Popconfirm,
  Alert,
  Upload,
  Modal,
} from "antd";
import { notifyLoading, notifySuccess, notifyError } from '../../utils/notify';
import {
  UserOutlined,
  CalendarOutlined,
  FileOutlined,
  CommentOutlined,
  HistoryOutlined,
  EditOutlined,
  ScheduleOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  useGetTaskCommentsQuery,
  useGetTaskActivityQuery,
  useGetTaskByIdQuery,
  useAddCommentMutation,
  useDeleteTaskMutation,
  useUpdateTaskScreenshotMutation,
  useUpdateTaskMutation,
  useHoldTaskMutation,
  useClientApproveTaskMutation,
} from "../../api/taskApi";
import { useActionPermissions } from "../../hooks/useActionPermissions";
import { PERMISSION_ACTIONS } from "../../utils/actionPermissions";
import { getCloudinaryOriginalDeliveryUrl, getCloudinaryDownloadUrl } from "../../utils/cloudinaryUrl";
import dayjs from "dayjs";
import { isDurationTrackingTask, isCompletedTask } from "./taskDuration";
import TaskReopenModal from "./TaskReopenModal";

const { TextArea } = Input;

const TaskDetailDrawer = ({ task, visible, onClose, onTaskCompleted }) => {
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [deleteTask] = useDeleteTaskMutation();
  const { user: user } = useAuth();
  const userRole = user?.role;
  const [isReopenModalVisible, setIsReopenModalVisible] = useState(false);
  const [taskToReopen, setTaskToReopen] = useState(null);

  const [isHoldModalVisible, setIsHoldModalVisible] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [updateTask] = useUpdateTaskMutation();
  const [clientApproveTask, { isLoading: isApproving }] = useClientApproveTaskMutation();
  const [holdTask, { isLoading: isHoldingTask }] = useHoldTaskMutation();

  // Check permissions and roles
  // SEO users must be full-time
  const userType = (user?.type || "").toLowerCase().trim();
  const isIntern = userType === "intern";
  const isSEO = userRole === "seo";
  const isSEOFullTime = isSEO && userType === "full_time";

  const { hasPermission } = useActionPermissions("/tasks");
  const canEdit = hasPermission(PERMISSION_ACTIONS.EDIT_TASK);
  const canEditTaskDetails = hasPermission(PERMISSION_ACTIONS.EDIT_TASK);
  const canDelete = hasPermission(PERMISSION_ACTIONS.DELETE_TASK);

  const isCreator = task?.createdBy && (task.createdBy._id === user?._id || task.createdBy === user?._id);
  const canEditThisTask = canEdit && canEditTaskDetails && isCreator;
  const canDeleteThisTask = canDelete && isCreator;

  const [updateScreenshot] = useUpdateTaskScreenshotMutation();

  const handleScreenshotUpdate = async (attachmentId, file) => {
    try {
      const formData = new FormData();
      formData.append("screenshot", file);

      await updateScreenshot({
        taskId: task._id,
        attachmentId,
        formData,
      }).unwrap();

      notifySuccess('screenshot', task._id, "Screenshot updated successfully");
    } catch (error) {
      console.error("Failed to update screenshot:", error);
      notifyError('screenshot', task._id, error.data?.message || "Failed to update screenshot");
    }
    return false; // Prevent default upload behavior
  };

  // Always fetch fresh task data when drawer is open so attachments/files are up-to-date
  const { data: freshTaskData } = useGetTaskByIdQuery(task?._id, {
    skip: !task?._id || !visible,
  });
  const liveTask = freshTaskData?.data?.task || freshTaskData?.data || task;

  const { data: commentsData, isLoading: isLoadingComments } =
    useGetTaskCommentsQuery(task?._id, {
      skip: !task?._id || !visible,
    });

  const { data: activityData, isLoading: isLoadingActivity } =
    useGetTaskActivityQuery(task?._id, {
      skip: !task?._id || !visible,
    });

  const [addComment, { isLoading: isAddingComment }] = useAddCommentMutation();

  const comments = commentsData?.data?.comments || [];
  const activity = activityData?.data?.activity || [];

  const getHoldReasonFromActivity = (item) => {
    if (item?.metadata?.holdReason) return item.metadata.holdReason;
    const desc = item?.description || "";
    const match = desc.match(/hold reason:\s*(.*)$/i);
    return match?.[1]?.trim() || null;
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

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      message.warning("Please enter a comment");
      return;
    }

    try {
      await addComment({
        taskId: task._id,
        content: commentText,
      }).unwrap();
      setCommentText("");
      notifySuccess('comment', task._id, 'Comment added successfully');
    } catch (error) {
      notifyError('comment', task._id, error?.data?.message || 'Failed to add comment');
    }
  };

  const handleDelete = async () => {
      try {
        await deleteTask(task._id).unwrap();
        notifySuccess('delete', task._id, 'Task deleted successfully');
        onClose();
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
      notifyError('delete', task._id, err.data?.message || "Failed to delete task");
    }
  };

  const handleHoldSubmit = async () => {
    if (!holdReason.trim()) {
      notifyError('hold', task._id, "Hold reason is required.");
      return;
    }
    try {
      await holdTask({ id: task._id, holdReason: holdReason.trim() }).unwrap();
      notifySuccess('hold', task._id, 'Task placed on hold');
      setIsHoldModalVisible(false);
      setHoldReason("");
      onClose();
    } catch (err) {
      notifyError('hold', task._id, err.data?.message || "Failed to hold task");
    }
  };

  const handleClientAction = async (newStatus) => {
    const taskId = liveTask?._id || task._id;
    try {
      if (newStatus === 'complete') {
        await clientApproveTask(taskId).unwrap();
        notifySuccess('task', taskId, `Task approved successfully`);
      } else {
        await updateTask({ id: taskId, status: newStatus }).unwrap();
        notifySuccess('task', taskId, `Task rejected successfully`);
      }
      
      if (newStatus === 'complete' && typeof onTaskCompleted === 'function') {
        onTaskCompleted();
      }
      onClose();
    } catch (err) {
      notifyError('task', taskId, err.data?.message || "Failed to update task");
    }
  };

  const tabItems = [
    {
      key: "details",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ScheduleOutlined /> Details
        </span>
      ),
      children: task && (
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Title">{liveTask.title}</Descriptions.Item>
          <Descriptions.Item label="Description">
            {liveTask.description || "No description"}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={getStatusColor(liveTask.status)}>
              {liveTask.status === "backlog"
                ? "HOLD"
                : liveTask.status?.replace("_", " ").toUpperCase() || "CREATED"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Priority">
            <Tag color={getPriorityColor(liveTask.priority)}>
              {liveTask.priority?.toUpperCase() || "MEDIUM"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Project">
            {liveTask.projectId?.name || "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="Company">
            {liveTask.companyId?.name || "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="Department">
            {liveTask.department?.replace("_", " ").toUpperCase() || "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="Assigned To">
            <Space>
              <Avatar size="small" src={liveTask.assignedTo?.avatar}>
                {liveTask.assignedTo?.name?.charAt(0) || <UserOutlined />}
              </Avatar>
              {liveTask.assignedTo?.name || "N/A"}
            </Space>
          </Descriptions.Item>
          {!(
            liveTask.status &&
            ["review", "done", "completed", "validated", "complete"].includes(liveTask.status)
          ) && (
            <Descriptions.Item label="Due Date">
              <Space>
                <CalendarOutlined />
                {liveTask.dueDate
                  ? dayjs(liveTask.dueDate).format("DD/MM/YYYY HH:mm")
                  : "N/A"}
              </Space>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Start Date">
            {liveTask.startDate
              ? dayjs(liveTask.startDate).format("DD/MM/YYYY HH:mm")
              : "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="Labels">
            {liveTask.labels && liveTask.labels.length > 0 ? (
              <Space>
                {liveTask.labels.map((label, idx) => (
                  <Tag key={idx}>{label}</Tag>
                ))}
              </Space>
            ) : (
              "No labels"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Attachments">
            {liveTask.attachments &&
            liveTask.attachments.filter((a) => !a.isScreenshot).length > 0 ? (
              <Space direction="vertical">
                {liveTask.attachments
                  .filter((a) => !a.isScreenshot)
                  .map((attachment, idx) => (
                    <a
                      key={idx}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileOutlined /> {attachment.fileName}
                    </a>
                  ))}
              </Space>
            ) : (
              "No attachments"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Created By">
            <Space>
              <Avatar size="small" src={liveTask.createdBy?.profileImage}>
                {liveTask.createdBy?.name?.charAt(0) || <UserOutlined />}
              </Avatar>
              {liveTask.createdBy?.name || liveTask.assignedBy?.name || "N/A"}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Created At">
            {task.createdAt
              ? dayjs(task.createdAt).format("DD/MM/YYYY HH:mm")
              : "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="Updated By">
            {task.updatedBy ? (
              <Space>
                <Avatar size="small" src={task.updatedBy?.profileImage}>
                  {task.updatedBy?.name?.charAt(0) || <UserOutlined />}
                </Avatar>
                {task.updatedBy?.name || "N/A"}
              </Space>
            ) : (
              "N/A"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Updated At">
            {task.updatedAt
              ? dayjs(task.updatedAt).format("DD/MM/YYYY HH:mm")
              : "N/A"}
          </Descriptions.Item>

          {/* ── Time Tracking ─────────────────────────────────── */}
          {isDurationTrackingTask(task) && (
            <>
              <Descriptions.Item
                label={
                  <Space>
                    <PlayCircleOutlined style={{ color: "var(--accent-primary)" }} />
                    Start Time
                  </Space>
                }
              >
                {(() => {
                  // If workStartedAt exists, show it directly
                  if (task.workStartedAt) {
                    return (
                      <Tag color="blue" icon={<PlayCircleOutlined />}>
                        {dayjs(task.workStartedAt).format("DD/MM/YYYY HH:mm")}
                      </Tag>
                    );
                  }

                  // If task is completed and has duration, calculate start time from end time - duration
                  if (
                    task.workCompletedAt &&
                    task.workDurationMinutes != null
                  ) {
                    const completedTime = new Date(task.workCompletedAt);
                    const startTime = new Date(
                      completedTime - task.workDurationMinutes * 60 * 1000,
                    );
                    return (
                      <Tag color="blue" icon={<PlayCircleOutlined />}>
                        {dayjs(startTime).format("DD/MM/YYYY HH:mm")}
                      </Tag>
                    );
                  }

                  // Otherwise, task hasn't started
                  return <Tag color="default">Not started yet</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <Space>
                    <CheckSquareOutlined style={{ color: "#52c41a" }} />
                    Completed Time
                  </Space>
                }
              >
                {task.workCompletedAt ? (
                  <Tag color="green" icon={<CheckSquareOutlined />}>
                    {dayjs(task.workCompletedAt).format("DD/MM/YYYY HH:mm")}
                  </Tag>
                ) : (
                  <Tag color="default">Not completed yet</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <Space>
                    <ClockCircleOutlined style={{ color: "#fa8c16" }} />
                    Duration
                  </Space>
                }
              >
                {task.workStartedAt && task.status === "in_progress" ? (
                  (() => {
                    const runningMins = Math.round(
                      (Date.now() - new Date(task.workStartedAt)) / 60000,
                    );
                    const totalMins = (task.workDurationMinutes || 0) + runningMins;
                    const h = Math.floor(totalMins / 60);
                    const m = totalMins % 60;
                    return (
                      <Tag color="processing" icon={<ClockCircleOutlined />}>
                        {h > 0 ? `${h}h ${m}m` : `${m}m`} (in progress)
                      </Tag>
                    );
                  })()
                ) : task.workDurationMinutes != null ? (
                  (() => {
                    const mins = task.workDurationMinutes;
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
                    return (
                      <Tag color="orange" icon={<ClockCircleOutlined />}>
                        {label}
                      </Tag>
                    );
                  })()
                ) : (
                  <Tag color="default">—</Tag>
                )}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      ),
    },
    {
      key: "comments",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CommentOutlined /> Comments ({comments.length})
        </span>
      ),
      children: (
        <div>
          {userRole !== "client" && (
            <div style={{ marginBottom: 16 }}>
              <TextArea
                rows={4}
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <Button
                type="primary"
                style={{ marginTop: 8 }}
                onClick={handleAddComment}
                loading={isAddingComment}
              >
                Add Comment
              </Button>
            </div>
          )}
          <div>
            {isLoadingComments ? (
              <div>Loading comments...</div>
            ) : comments.length === 0 ? (
              <Empty description="No comments yet" />
            ) : (
              <Space direction="vertical" style={{ width: "100%" }}>
                {comments.map((comment) => (
                  <div
                    key={comment._id}
                    style={{
                      padding: 12,
                      backgroundColor: "hsl(var(--muted))",
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <Avatar size="small" src={comment.userId?.avatar}>
                        {comment.userId?.name?.charAt(0) || <UserOutlined />}
                      </Avatar>
                      <span style={{ marginLeft: 8, fontWeight: "bold" }}>
                        {comment.userId?.name || "Unknown"}
                      </span>
                      <span
                        style={{
                          marginLeft: 8,
                          color: "#999",
                          fontSize: "12px",
                        }}
                      >
                        {dayjs(comment.createdAt).format("MMM DD, YYYY HH:mm")}
                      </span>
                    </div>
                    <div>{comment.content}</div>
                  </div>
                ))}
              </Space>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "activity",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <HistoryOutlined /> Activity
        </span>
      ),
      children: (
        <div>
          {isLoadingActivity ? (
            <div>Loading activity...</div>
          ) : activity.length === 0 ? (
            <Empty description="No activity yet" />
          ) : (
            <Timeline>
              {activity.map((item) => (
                <Timeline.Item key={item._id}>
                  {(() => {
                    const holdReason = getHoldReasonFromActivity(item);
                    return (
                      <div>
                        <strong>{item.userId?.name || "System"}</strong>
                        <span style={{ marginLeft: 8, color: "#999" }}>
                          {item.description || item.action}
                        </span>
                        {holdReason && (
                          <div style={{ marginTop: 6 }}>
                            <Tag color="orange">Hold Reason: {holdReason}</Tag>
                          </div>
                        )}
                        <div
                          style={{
                            color: "#999",
                            fontSize: "12px",
                            marginTop: 4,
                          }}
                        >
                          {dayjs(item.createdAt).format("MMM DD, YYYY HH:mm")}
                        </div>
                      </div>
                    );
                  })()}
                </Timeline.Item>
              ))}
            </Timeline>
          )}
        </div>
      ),
    },
    {
      key: "screenshots",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FileOutlined /> Files
        </span>
      ),
      children: (
        <div>
          {liveTask?.attachments &&
          liveTask.attachments.filter(
            (a) => a.isScreenshot || a.fileName?.includes("screenshot"),
          ).length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {liveTask.attachments
                .filter(
                  (a) => a.isScreenshot || a.fileName?.includes("screenshot"),
                )
                .map((screenshot, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      overflow: "hidden",
                      backgroundColor: "hsl(var(--muted))",
                      width: 300,
                      maxWidth: "100%",
                      alignSelf: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 300,
                        height: 300,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 0,
                        boxSizing: "border-box",
                      }}
                    >
                      <img
                        src={screenshot.url}
                        alt={screenshot.fileName}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        padding: 8,
                        textAlign: "center",
                        display: "flex",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <Button
                        type="link"
                        size="small"
                        href={getCloudinaryOriginalDeliveryUrl(screenshot.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        href={getCloudinaryDownloadUrl(screenshot.url, screenshot.fileName)}
                        download={screenshot.fileName || 'download'}
                        rel="noopener noreferrer"
                      >
                        Download
                      </Button>
                      {isDurationTrackingTask(liveTask) &&
                        !["admin", "digital_marketing_coordinator"].includes(
                          userRole,
                        ) &&
                        String(screenshot.uploadedBy) === String(user?._id) && (
                          <Upload
                            showUploadList={false}
                            beforeUpload={(file) =>
                              handleScreenshotUpdate(screenshot._id, file)
                            }
                            accept="image/*"
                          >
                            <Button type="link" size="small">
                              Edit
                            </Button>
                          </Upload>
                        )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <Empty description="No screenshots yet" />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Drawer
        title={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <span>{liveTask?.title || task?.title || "Task Details"}</span>
            <Space>
              {liveTask &&
                ['brand_super_admin', 'brand_manager', 'agency_client', 'client', 'brand_team_user'].includes(userRole) &&
                ['review', 'sent_for_client_review', 'in_review'].includes(liveTask.status?.toLowerCase()) && (
                  <>
                    <Button
                      type="primary"
                      style={{ background: "#52c41a", borderColor: "#52c41a" }}
                      onClick={() => handleClientAction("complete")}
                    >
                      Approve
                    </Button>
                    <Popconfirm
                      title="Are you sure you want to reject this task?"
                      onConfirm={() => handleClientAction('rejected')}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button
                        type="primary"
                        danger
                      >
                        Reject
                      </Button>
                    </Popconfirm>
                  </>
                )}
              {task &&
                (canEditTaskDetails || (task.assignedTo && (task.assignedTo._id === user._id || task.assignedTo === user._id))) &&
                task.status !== "hold" &&
                !["done", "validated", "completed", "complete"].includes(task.status) && (
                  <Button
                    style={{ background: "#d97706", color: "white", border: "none" }}
                    onClick={() => setIsHoldModalVisible(true)}
                  >
                    Hold Task
                  </Button>
                )}
              {task &&
                canEditThisTask &&
                !["done", "validated", "completed", "complete", "review"].includes(task.status?.toLowerCase()) && (
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => {
                      onClose();
                      navigate(`/tasks/${task._id}/edit`);
                    }}
                  >
                    Edit
                  </Button>
                )}
              {task && canDeleteThisTask && (
                <Popconfirm
                  title="Are you sure you want to delete this task?"
                  onConfirm={handleDelete}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button type="primary" danger icon={<DeleteOutlined />}>
                    Delete
                  </Button>
                </Popconfirm>
              )}
              {task &&
                isCompletedTask(task.status) && (
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      setTaskToReopen(task);
                      setIsReopenModalVisible(true);
                    }}
                    style={{
                      background: "#f59e0b",
                      color: "white",
                      border: "none",
                    }}
                  >
                    Reopen
                  </Button>
                )}
            </Space>
          </div>
        }
        placement="right"
        width={600}
        open={visible}
        onClose={onClose}
      >
        {task?.companyId?.status === "inactive" && (
          <Alert
            message="Inactive Client"
            description="This task is associated with an inactive client."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        {task ? (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          />
        ) : (
          <Empty description="No task selected" />
        )}
      </Drawer>
      <TaskReopenModal
        task={taskToReopen}
        visible={isReopenModalVisible}
        onClose={() => {
          setIsReopenModalVisible(false);
          setTaskToReopen(null);
        }}
        onSuccess={() => {
          onClose(); // Close drawer after successful reopen
        }}
      />
      <Modal
        title="Hold Task"
        open={isHoldModalVisible}
        onOk={handleHoldSubmit}
        onCancel={() => {
          setIsHoldModalVisible(false);
          setHoldReason("");
        }}
        confirmLoading={isHoldingTask}
        okText="Submit & Hold"
      >
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: "red" }}>*</span> Hold Reason:
        </div>
        <TextArea
          rows={4}
          placeholder="Enter reason for putting this task on hold..."
          value={holdReason}
          onChange={(e) => setHoldReason(e.target.value)}
        />
      </Modal>
    </>
  );
};

export default TaskDetailDrawer;
