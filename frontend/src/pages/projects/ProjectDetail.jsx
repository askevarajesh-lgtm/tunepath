import React, { useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Spin,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Steps,
  Timeline,
  Divider,
  Image,
  Tabs,
  Typography,
  theme,
  Checkbox,
  Alert,
  Table,
  DatePicker,
  Calendar,
  List,
  Empty,
  Segmented,
} from "antd";

const { Text, Title } = Typography;
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  SendOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  RedoOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import MasterItemDetailsCard from "../../components/common/MasterItemDetailsCard";
import TaskDetailDrawer from "../tasks/TaskDetailDrawer";
import { useTheme } from "../../contexts/ThemeContext";
import { LayoutDashboard, GitMerge, CheckSquare, MessageSquare, CheckCircle, DollarSign, Clock, FileText } from "lucide-react";
import {
  useGetProjectByIdQuery,
  useSubmitForClientReviewMutation,
  useClientApproveMutation,
  // useSendWorkflowMutation - REMOVED: Send workflow to client functionality has been disabled
  useApproveWorkflowMutation,
  useRequestWorkflowRevisionMutation,
  useCompleteProjectMutation,
  useReopenProjectMutation,
  useActivateProjectMutation,
  useDeactivateProjectMutation,
  useUpdateProjectMilestonesMutation,
  useRenewProjectMutation,
} from "../../api/projectApi";
import { useGetUsersDropdownQuery } from "../../api/userApi";
import {
  useGetCorrectionsByProjectQuery,
  useRequestCorrectionMutation,
  useDeleteCorrectionMutation,
} from "../../api/correctionApi";
import { useGetProjectPLQuery } from "../../api/plApi";
import { useGetTimelineEventsQuery } from "../../api/timelineApi";
import { useAuth } from "../../contexts/AuthContext";
import { canPerformAction } from "../../utils/roleAccess";
import dayjs from "dayjs";
import TimelineView from "../../components/common/TimelineView";
import { useClientApproveTaskMutation } from "../../api/taskApi";
import {
  isDurationTrackingTask,
  formatMinutesAsDuration,
} from "../tasks/taskDuration";

const { TextArea } = Input;
const { TabPane } = Tabs;

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const getBaseRoute = () => {
    if (location.pathname.startsWith("/client")) return "/client/workspace";
    if (location.pathname.startsWith("/agency")) return "/agency";
    if (location.pathname.startsWith("/user")) return "/user/workspace";
    return "/workspace";
  };

  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const [form] = Form.useForm();
  const [correctionForm] = Form.useForm();
  const [isCorrectionModalVisible, setIsCorrectionModalVisible] =
    useState(false);
  const [isReopenModalVisible, setIsReopenModalVisible] = useState(false);
  const [reopenForm] = Form.useForm();
  const { user: currentUser } = useAuth();
  const [renewProject, { isLoading: isRenewing }] = useRenewProjectMutation();

  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskDrawerVisible, setIsTaskDrawerVisible] = useState(false);
  const [taskViewMode, setTaskViewMode] = useState("list");
  const [taskCalendarPanelDate, setTaskCalendarPanelDate] = useState(dayjs());
  const [selectedTaskCalendarDate, setSelectedTaskCalendarDate] =
    useState(dayjs());
  const [isPosterModalVisible, setIsPosterModalVisible] = useState(false);
  const [selectedPosterTask, setSelectedPosterTask] = useState(null);
  const [selectedPosterUrl, setSelectedPosterUrl] = useState("");

  const handleCloseTaskDrawer = () => {
    setIsTaskDrawerVisible(false);
    setSelectedTask(null);
  };

  const [clientApproveTask, { isLoading: isClientTaskApproving }] =
    useClientApproveTaskMutation();

  const getLatestPosterUrl = (task) => {
    const screenshots = (task?.attachments || [])
      .filter((attachment) => attachment?.isScreenshot && attachment?.url)
      .sort(
        (a, b) =>
          new Date(b?.uploadedAt || b?.createdAt || 0) -
          new Date(a?.uploadedAt || a?.createdAt || 0),
      );
    return screenshots[0]?.url || "";
  };

  const handleOpenPosterModal = (task) => {
    const posterUrl = getLatestPosterUrl(task);
    if (!posterUrl) {
      message.warning("No final approval poster image found for this task.");
      return;
    }
    setSelectedPosterTask(task);
    setSelectedPosterUrl(posterUrl);
    setIsPosterModalVisible(true);
  };

  const handleOpenTaskDetails = (task) => {
    if (currentUser?.role === "client") {
      handleOpenPosterModal(task);
      return;
    }
    setSelectedTask(task);
    setIsTaskDrawerVisible(true);
  };

  const handleClientTaskApprove = async () => {
    if (!selectedPosterTask?._id) return;
    try {
      await clientApproveTask(selectedPosterTask._id).unwrap();
      setSelectedPosterTask((prev) =>
        prev ? { ...prev, clientReviewStatus: "approved" } : prev,
      );
      message.success("Client side approval updated to Approved");
    } catch (error) {
      message.error(error?.data?.message || "Failed to update approval");
    }
  };

  const [deleteCorrection, { isLoading: isDeletingCorrection }] =
    useDeleteCorrectionMutation();

  const handleDeleteCorrection = (correctionId) => {
    Modal.confirm({
      title: "Are you sure you want to delete this correction?",
      content:
        "This will also delete any associated Correction or Redesign tasks. This action cannot be undone.",
      okText: "Yes, Delete",
      okType: "danger",
      cancelText: "No",
      onOk: async () => {
        try {
          await deleteCorrection(correctionId).unwrap();
          message.success("Correction deleted successfully");
        } catch (error) {
          message.error(error.data?.message || "Failed to delete correction");
        }
      },
    });
  };

  const { data, isLoading, error, refetch: refetchProject } = useGetProjectByIdQuery(id);
  const { data: correctionsData, refetch: refetchCorrections } = useGetCorrectionsByProjectQuery(id);
  const { data: plData } = useGetProjectPLQuery(id);
  const { data: timelineData, isLoading: isLoadingTimeline, refetch: refetchTimeline } =
    useGetTimelineEventsQuery(
      { entityType: "Project", entityId: id },
      { skip: !id },
    );
  const { data: usersData } = useGetUsersDropdownQuery({});
  const users = usersData?.data?.users || usersData?.data?.data || [];
  const [submitForReview, { isLoading: isSubmitting }] =
    useSubmitForClientReviewMutation();
  const [clientApprove, { isLoading: isApproving }] =
    useClientApproveMutation();
  const [requestCorrection, { isLoading: isRequestingCorrection }] =
    useRequestCorrectionMutation();
  // const [sendWorkflow, { isLoading: isSendingWorkflow }] = useSendWorkflowMutation(); // REMOVED: Send workflow to client functionality has been disabled
  const [approveWorkflow, { isLoading: isApprovingWorkflow }] =
    useApproveWorkflowMutation();
  const [requestWorkflowRevision, { isLoading: isRequestingRevision }] =
    useRequestWorkflowRevisionMutation();
  const [completeProject, { isLoading: isCompleting }] =
    useCompleteProjectMutation();
  const [reopenProject, { isLoading: isReopening }] =
    useReopenProjectMutation();
  const [activateProject, { isLoading: isActivating }] =
    useActivateProjectMutation();
  const [deactivateProject, { isLoading: isDeactivating }] =
    useDeactivateProjectMutation();
  const [isRevisionModalVisible, setIsRevisionModalVisible] = useState(false);
  const [revisionForm] = Form.useForm();
  const [isMilestoneModalVisible, setIsMilestoneModalVisible] = useState(false);
  const [milestoneForm] = Form.useForm();
  const [updateProjectMilestones, { isLoading: isUpdatingMilestones }] =
    useUpdateProjectMilestonesMutation();
  const [dynamicReviews, setDynamicReviews] = useState([]);

  const project = data?.data?.project;
  const corrections = Array.isArray(correctionsData) ? correctionsData : (correctionsData?.data?.corrections || correctionsData?.data || []);
  const plEntry = plData?.data?.plEntry;
  const timelineEvents = Array.isArray(timelineData) ? timelineData : (timelineData?.data?.timelineEvents || timelineData?.data || []);

  const isRenewable = useMemo(() => {
    if (currentUser?.role === "client") return false;
    if (!project) return false;

    // Check if services are completed (all remaining counts are 0)
    // We only check fields that are actually being tracked (where numberOf... > 0)
    const postersCompleted =
      project.numberOfPosters > 0 ? project.remainingPosters === 0 : true;
    const videosCompleted =
      project.numberOfVideos > 0 ? project.remainingVideos === 0 : true;
    const shootsCompleted =
      project.numberOfShoots > 0 ? project.remainingShoots === 0 : true;
    const categoriesCompleted = (project.selectedCategories || []).every(
      (cat) => cat.remaining === 0,
    );

    const deliverablesCompleted =
      postersCompleted &&
      videosCompleted &&
      shootsCompleted &&
      categoriesCompleted;

    // Check if renewal date is reached (today >= renewalDate - 1 day)
    const renewalDateReached = project.renewalDate
      ? dayjs().isAfter(
          dayjs(project.renewalDate).subtract(1, "day").startOf("day"),
        )
      : false;

    return deliverablesCompleted && renewalDateReached;
  }, [project, currentUser]);

  const handleRenewProject = () => {
    const clientId = project.clientId?._id || project.clientId;

    if (!clientId) {
      message.error(
        "Required client information is missing for manual renewal.",
      );
      return;
    }

    navigate("/proposals/new", {
      state: {
        fromClient: { clientId: clientId.toString() },
        fromRenewalProject: {
          clientId: clientId.toString(),
          projectName: project.name,
          masterItemId: project.masterItemId?._id || project.masterItemId || project.masterItemIds?.[0]?._id || project.masterItemIds?.[0],
        },
      },
    });
  };

  const completedStatusSet = useMemo(
    () => new Set(["completed", "validated", "review", "approved", "done"]),
    [],
  );

  const getTaskCompletionDate = (task) =>
    task?.actualCompletionDate ||
    task?.completedAt ||
    (completedStatusSet.has((task?.status || "").toLowerCase())
      ? task?.updatedAt
      : null);

  const completedProjectTasksByDate = useMemo(() => {
    const map = {};
    (project?.tasks || []).forEach((task) => {
      const statusKey = (task?.status || "").toLowerCase();
      if (!completedStatusSet.has(statusKey)) return;

      const completedAt = getTaskCompletionDate(task);
      if (!completedAt) return;

      const dayKey = dayjs(completedAt).format("YYYY-MM-DD");
      if (!map[dayKey]) map[dayKey] = [];
      map[dayKey].push(task);
    });

    return map;
  }, [project?.tasks, completedStatusSet]);

  const selectedTaskCalendarDateKey =
    selectedTaskCalendarDate.format("YYYY-MM-DD");
  const selectedTaskCalendarTasks =
    completedProjectTasksByDate[selectedTaskCalendarDateKey] || [];

  const getStatusColor = (status) => {
    const colors = {
      created: "default",
      in_progress: "processing",
      sent_for_client_review: "blue",
      approved: "success",
      completed: "success",
      on_hold: "warning",
      cancelled: "error",
    };
    return colors[status] || "default";
  };

  const getStatusSteps = () => {
    // Removed 'sent_for_client_review' and 'approved' from status bar as requested
    const statusOrder = ["created", "in_progress", "completed"];
    const currentIndex = statusOrder.indexOf(project?.status || "created");
    return statusOrder.map((status, index) => ({
      title: status.replace(/_/g, " ").toUpperCase(),
      status:
        index < currentIndex
          ? "finish"
          : index === currentIndex
            ? "process"
            : "wait",
    }));
  };

  const handleSubmitForReview = async () => {
    try {
      await submitForReview(id).unwrap();
      message.success("Project submitted for client review successfully");
    } catch (error) {
      message.error(error?.data?.message || "Failed to submit for review");
    }
  };

  const handleApprove = async (values) => {
    try {
      await clientApprove({
        id,
        reviewNotes: values.reviewNotes || "",
      }).unwrap();
      message.success("Project approved successfully");
      form.resetFields();
    } catch (error) {
      message.error(error?.data?.message || "Failed to approve project");
    }
  };

  const handleRequestCorrection = async (values) => {
    try {
      const requestedByType =
        currentUser.role === "client"
          ? "client"
          : values.requestedByType || "coordinator";

      const res = await requestCorrection({
        projectId: id,
        ...values,
        requestedByType,
      });

      if (res && typeof res.unwrap === 'function') {
        res.unwrap();
      } else if (res?.error) {
        throw res.error;
      }

      message.success("Correction requested successfully");
      setIsCorrectionModalVisible(false);
      correctionForm.resetFields();
      if (typeof refetchCorrections === 'function') refetchCorrections();
      if (typeof refetchTimeline === 'function') refetchTimeline();
      if (typeof refetchProject === 'function') refetchProject();
    } catch (error) {
      console.error("Correction request error:", error);
      message.error(error?.response?.data?.message || error?.data?.message || error?.message || "Failed to request correction");
    }
  };

  const handleCompleteProject = async () => {
    try {
      Modal.confirm({
        title: "Complete Project",
        content: "Are you sure you want to mark this project as completed?",
        onOk: async () => {
          await completeProject(id).unwrap();
          message.success("Project marked as completed successfully");
        },
      });
    } catch (error) {
      message.error(error?.data?.message || "Failed to complete project");
    }
  };

  const handleActivateProject = async () => {
    try {
      Modal.confirm({
        title: "Activate Project",
        content:
          "This will make the project visible in task creation dropdown. Continue?",
        onOk: async () => {
          await activateProject(id).unwrap();
          message.success("Project activated successfully");
        },
      });
    } catch (error) {
      message.error(error?.data?.message || "Failed to activate project");
    }
  };

  const handleDeactivateProject = async () => {
    try {
      Modal.confirm({
        title: "Deactivate Project",
        content:
          "This will hide the project from task creation dropdown. Continue?",
        onOk: async () => {
          await deactivateProject(id).unwrap();
          message.success("Project deactivated successfully");
        },
      });
    } catch (error) {
      message.error(error?.data?.message || "Failed to deactivate project");
    }
  };

  const handleReopenProject = async () => {
    setIsReopenModalVisible(true);
  };

  const handleReopenSubmit = async (values) => {
    try {
      const reopenData = {
        status: values.status,
        additionalPayment:
          values.additionalPaymentAmount > 0
            ? {
                amount: values.additionalPaymentAmount,
                reason: values.additionalPaymentReason || "",
              }
            : null,
        updateTaskStatus: values.updateTaskStatus || false,
        taskStatus: values.taskStatus || null,
      };

      await reopenProject({ id, ...reopenData }).unwrap();
      message.success("Project reopened successfully");
      setIsReopenModalVisible(false);
      reopenForm.resetFields();
    } catch (error) {
      message.error(error?.data?.message || "Failed to reopen project");
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Project not found</p>
          <Button onClick={() => navigate(`${getBaseRoute()}/projects`)}>
            Back to Projects
          </Button>
        </div>
      </Card>
    );
  }

  // Use role-based access utilities
  // canSendWorkflow and canResendWorkflow - REMOVED: Send workflow to client functionality has been disabled
  const canApproveWorkflow =
    canPerformAction(currentUser?.role, "projects", "approveWorkflow") &&
    project.status === "workflow_sent";
  const canRequestRevision =
    canPerformAction(currentUser?.role, "projects", "requestRevision") &&
    project.status === "workflow_sent";
  const canSubmitForReview =
    canPerformAction(currentUser?.role, "projects", "submitForReview") &&
    project.status === "in_progress";
  const canApprove =
    canPerformAction(currentUser?.role, "projects", "approve") &&
    project.status === "sent_for_client_review";
  const canComplete =
    canPerformAction(currentUser?.role, "projects", "complete") &&
    project.status !== "completed" &&
    project.status !== "cancelled";
  const canReopen =
    canPerformAction(currentUser?.role, "projects", "reopen") &&
    project.status === "completed";
  const canStartRenewalPlan =
    currentUser?.role !== "client" && project.status === "completed";

  const handleStartRenewalPlan = async () => {
    handleRenewProject();
  };

  // Get milestone workflow type based on master item
  const getMilestoneWorkflowType = () => {
    const mainMasterItem = project?.masterItemId || (project?.masterItemIds && project.masterItemIds[0]);
    if (!mainMasterItem) return null;
    const masterItemName =
      typeof mainMasterItem === "object"
        ? mainMasterItem.name
        : null;
    if (!masterItemName) return null;

    const name = masterItemName.toLowerCase().trim();
    if (name === "website" || name === "website designing")
      return "website-designing";
    if (name === "seo") return "seo";
    if (name === "digital marketing") return "digital-marketing";
    // Check departments for tech team
    if (
      project.departments &&
      project.departments.some(
        (d) => d === "web-application-development" || d === "tech_team",
      )
    ) {
      return "web-application-development";
    }
    return "website-designing"; // Default
  };

  // Get milestone checklist based on workflow type
  const getMilestoneChecklist = (workflowType) => {
    if (!workflowType) return [];

    let type = workflowType.toLowerCase().trim();
    if (type === "website_team" || type === "website_designing" || type === "website-designing") {
      type = "website_designing";
    } else if (type === "tech_team" || type === "web_application_development" || type === "web-application-development") {
      type = "web_application_development";
    } else if (type === "digital-marketing" || type === "digital_marketing") {
      type = "digital_marketing";
    } else if (type === "seo") {
      type = "seo";
    }

    const checklists = {
      website_designing: [
        "Client Onboarded",
        "Greeting Sent",
        "Requirements Gathered",
        "Theme Selected",
        "Developer Started Working",
        "Phase 1 Demo Shared with Client",
        "Corrections Going On",
        "Client Confirmed Demo to Go Live",
        "Live Work in Progress",
        "Domain Purchased",
        "SSL Installed",
        "Live",
        "Completed",
      ],
      web_application_development: [
        "Client Onboarded",
        "Greeting Sent",
        "Requirements Gathered",
        "Theme Selected",
        "Developer Started Working",
        "Review 1 Demo Shared with Client",
        "Corrections Going On",
        "Review 2",
        "Testing",
        "Bug Fixing",
        "Demo Shared with Client",
        "Client Confirmed Demo to Go Live",
        "Live Work in Progress",
        "Domain Purchased",
        "Server Setup",
        "SSL Installed",
        "Live",
        "Completed",
      ],
      seo: [
        "Content Work",
        "On-page SEO",
        "Technical SEO",
        "Local SEO",
        "Keyword Research",
        "Off-page SEO",
      ],
      digital_marketing: ["Poster Creation", "Video Creation", "Posting"],
    };
    return checklists[type] || [];
  };

  // Calculate milestone progress
  const calculateMilestoneProgress = () => {
    if (!project?.milestones || project.milestones.length === 0) return 0;
    const completed = project.milestones.filter((m) => m.completed).length;
    return Math.round((completed / project.milestones.length) * 100);
  };

  // Handle milestone modal open
  const handleOpenMilestoneModal = () => {
    const workflowType =
      project?.milestoneWorkflowType || getMilestoneWorkflowType();
    if (!workflowType) {
      message.warning(
        "Cannot determine workflow type. Please ensure project has a master item.",
      );
      return;
    }

    const checklist = getMilestoneChecklist(workflowType);

    // Initialize milestones - merge existing with checklist
    let milestones = [];
    if (project?.milestones && project.milestones.length > 0) {
      // Use existing milestones, but ensure all checklist items are present
      const existingSteps = new Set(project.milestones.map((m) => m.step));
      milestones = project.milestones.map((m) => ({
        step: m.step,
        completed: m.completed || false,
        correctionRounds: m.metadata?.correctionRounds || null,
        reviewNumber: m.metadata?.reviewNumber || null,
      }));

      // Add missing checklist items
      checklist.forEach((step) => {
        if (!existingSteps.has(step)) {
          milestones.push({
            step,
            completed: false,
            correctionRounds: null,
            reviewNumber: null,
          });
        }
      });
    } else {
      // Initialize from checklist
      milestones = checklist.map((step) => ({
        step,
        completed: false,
        correctionRounds: null,
        reviewNumber: null,
      }));
    }

    // Sort milestones to match checklist order, then add dynamic reviews at the end
    const sortedMilestones = [];
    const dynamicReviewSteps = [];

    checklist.forEach((step) => {
      const milestone = milestones.find((m) => m.step === step);
      if (milestone) sortedMilestones.push(milestone);
    });

    // Add dynamic reviews (for tech team)
    if (workflowType === "web-application-development") {
      milestones.forEach((m) => {
        if (
          m.step.startsWith("Review ") &&
          m.step.includes("Demo Shared with Client") &&
          !checklist.includes(m.step)
        ) {
          dynamicReviewSteps.push(m.step);
          sortedMilestones.push(m);
        }
      });
      setDynamicReviews(dynamicReviewSteps);
    } else {
      setDynamicReviews([]);
    }

    milestoneForm.setFieldsValue({ milestones: sortedMilestones });
    setIsMilestoneModalVisible(true);
  };

  // Handle milestone submission
  const handleMilestoneSubmit = async (values) => {
    try {
      const workflowType =
        project?.milestoneWorkflowType || getMilestoneWorkflowType();
      const milestones = values.milestones.map((m) => ({
        step: m.step,
        completed: m.completed || false,
        metadata: {
          ...(m.correctionRounds && { correctionRounds: m.correctionRounds }),
          ...(m.reviewNumber && { reviewNumber: m.reviewNumber }),
        },
      }));

      await updateProjectMilestones({
        id,
        milestones,
        milestoneWorkflowType: workflowType,
      }).unwrap();

      message.success("Milestones updated successfully");
      setIsMilestoneModalVisible(false);
      if (typeof refetchProject === 'function') refetchProject();
      if (typeof refetchTimeline === 'function') refetchTimeline();
    } catch (error) {
      message.error(error?.data?.message || "Failed to update milestones");
    }
  };

  // Add dynamic review for tech team
  const handleAddReview = () => {
    const reviewNumber = dynamicReviews.length + 3; // Start from Review 3
    const newReview = `Review ${reviewNumber} Demo Shared with Client`;
    setDynamicReviews([...dynamicReviews, newReview]);

    const currentMilestones = milestoneForm.getFieldValue("milestones") || [];
    milestoneForm.setFieldsValue({
      milestones: [
        ...currentMilestones,
        {
          step: newReview,
          completed: false,
        },
      ],
    });
  };

  // handleSendWorkflow - REMOVED: Send workflow to client functionality has been disabled

  const handleApproveWorkflow = async () => {
    Modal.confirm({
      title: "Approve Workflow",
      content:
        "This will approve the workflow and automatically create tasks for team members. Are you sure?",
      onOk: async () => {
        try {
          await approveWorkflow(id).unwrap();
          message.success("Workflow approved and tasks created successfully");
        } catch (error) {
          message.error(error?.data?.message || "Failed to approve workflow");
        }
      },
    });
  };

  const handleRequestRevision = async (values) => {
    try {
      const requestedByType =
        currentUser.role === "client"
          ? "client"
          : values.requestedByType || "coordinator";
      await requestWorkflowRevision({
        id,
        revisionRequested: values.revisionRequested,
        requestedByType,
      }).unwrap();
      message.success("Workflow revision requested successfully");
      setIsRevisionModalVisible(false);
      revisionForm.resetFields();
    } catch (error) {
      message.error(
        error?.data?.message || "Failed to request workflow revision",
      );
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`${getBaseRoute()}/projects`)}
          >
            Back
          </Button>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>
            {project.name}
          </h1>
        </div>
        {canStartRenewalPlan && (
          <Button
            type="primary"
            icon={<RedoOutlined />}
            onClick={handleStartRenewalPlan}
          >
            Renewal Plan
          </Button>
        )}
      </div>

      {project.clientId?.status === "inactive" && (
        <Alert
          message="Inactive Client"
          description="This project is associated with an inactive client. Some actions may be restricted."
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <Tag
              color={getStatusColor(project.status)}
              style={{ fontSize: 14, padding: "4px 12px" }}
            >
              {project.status?.replace(/_/g, " ").toUpperCase()}
            </Tag>
            <Tag
              color={project.isActive !== false ? "green" : "red"}
              style={{ fontSize: 14, padding: "4px 12px" }}
            >
              {project.isActive !== false ? "ACTIVE" : "INACTIVE"}
            </Tag>
          </div>
          {/* Quick Action Buttons for Active/Inactive */}
          <Space>
            {currentUser?.role !== "client" && project?.isActive === false && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleActivateProject}
                loading={isActivating}
                size="large"
              >
                Activate Project
              </Button>
            )}
            {currentUser?.role !== "client" &&
              project?.isActive !== false &&
              project?.status !== "completed" && (
                <Button
                  danger
                  icon={<CloseOutlined />}
                  onClick={handleDeactivateProject}
                  loading={isDeactivating}
                  size="large"
                >
                  Deactivate Project
                </Button>
              )}
          </Space>
        </div>

        <Steps items={getStatusSteps()} style={{ marginBottom: 32 }} />

        <Tabs defaultActiveKey="overview">
          <TabPane
            tab={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <LayoutDashboard size={22} />
                Overview
              </span>
            }
            key="overview"
          >
            <Card title="Basic Information" style={{ marginBottom: 16 }}>
              <Descriptions
                bordered
                column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }}
                style={{ fontSize: "14px" }}
              >
                <Descriptions.Item label="Project Name">
                  {project.name || "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag
                    color={getStatusColor(project.status)}
                    style={{ fontSize: 14, padding: "4px 12px" }}
                  >
                    {project.status?.replace(/_/g, " ").toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Active Status">
                  <Tag
                    color={project.isActive !== false ? "green" : "red"}
                    style={{ fontSize: 14, padding: "4px 12px" }}
                  >
                    {project.isActive !== false ? "ACTIVE" : "INACTIVE"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Description" span={2}>
                  {project.description || "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Created Date">
                  {project.createdAt
                    ? dayjs(project.createdAt).format("DD/MM/YYYY HH:mm")
                    : "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Created By">
                  {project.createdBy?.name || "N/A"} (
                  {project.createdBy?.email || "N/A"})
                </Descriptions.Item>
                {project.startDate && (
                  <Descriptions.Item label="Start Date">
                    {dayjs(project.startDate).format("DD/MM/YYYY")}
                  </Descriptions.Item>
                )}
                {project.endDate && (
                  <Descriptions.Item label="End Date">
                    {dayjs(project.endDate).format("DD/MM/YYYY")}
                  </Descriptions.Item>
                )}
                {project.completedAt && (
                  <Descriptions.Item label="Completed Date">
                    {dayjs(project.completedAt).format("DD/MM/YYYY HH:mm")}
                  </Descriptions.Item>
                )}
                {project.completedBy && (
                  <Descriptions.Item label="Completed By">
                    {project.completedBy?.name || "N/A"}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            <Card
              title="Client & Invoice Information"
              style={{ marginBottom: 16 }}
            >
              <Descriptions
                bordered
                column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }}
                style={{ fontSize: "14px" }}
              >
                <Descriptions.Item label="Client">
                  {project.clientId?.name || "N/A"}
                  {project.clientId?.email && (
                    <span
                      style={{
                        marginLeft: 8,
                        color: token.colorTextSecondary,
                        fontSize: 12,
                      }}
                    >
                      ({project.clientId.email})
                    </span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Invoice Number">
                  {project.invoiceId?.invoiceNumber ? (
                    <Button
                      type="link"
                      onClick={() =>
                        navigate(`/invoices/${project.invoiceId._id}`)
                      }
                    >
                      {project.invoiceId.invoiceNumber}
                    </Button>
                  ) : (
                    "N/A"
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Invoice Type">
                  <Tag
                    color={project.invoiceType === "final" ? "green" : "blue"}
                  >
                    {project.invoiceType === "final"
                      ? "Final Invoice"
                      : "Proforma Invoice"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Invoice Date">
                  {project.invoiceDate
                    ? dayjs(project.invoiceDate).format("DD/MM/YYYY")
                    : "N/A"}
                </Descriptions.Item>
                {project.proposalId && (
                  <Descriptions.Item label="Proposal" span={2}>
                    <Button
                      type="link"
                      onClick={() =>
                        navigate(`/proposals/${project.proposalId}`)
                      }
                    >
                      View Proposal
                    </Button>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            <Card
              title="Service & Billing Information"
              style={{ marginBottom: 16 }}
            >
              <Descriptions
                bordered
                column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }}
                style={{ fontSize: "14px", marginBottom: 16 }}
              >
                <Descriptions.Item label="Master Item (Service)">
                  {project.masterItemId?.name || project.masterItemIds?.[0]?.name || "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Billing Type">
                  <Tag
                    color={
                      project.billingType === "subscription" ? "blue" : "green"
                    }
                  >
                    {project.billingType === "subscription"
                      ? "Subscription"
                      : "One-Time"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Departments">
                  <Tag color="default">Tasks will be manually assigned</Tag>
                </Descriptions.Item>
              </Descriptions>

              {(project.masterItemId || (project.masterItemIds && project.masterItemIds[0])) && (
                <MasterItemDetailsCard
                  service={project.masterItemId || project.masterItemIds[0]}
                  packageName={project.packageName}
                  isDark={isDark}
                  numberOfPosters={project.numberOfPosters}
                  numberOfVideos={project.numberOfVideos}
                  numberOfShoots={project.numberOfShoots}
                  remainingPosters={project.remainingPosters}
                  remainingVideos={project.remainingVideos}
                  remainingShoots={project.remainingShoots}
                  selectedCategories={project.selectedCategories}
                />
              )}
            </Card>

            <Card title="Correction Tracking">
              <Descriptions
                bordered
                column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }}
                style={{ fontSize: "14px" }}
              >
                <Descriptions.Item label="Client Corrections">
                  {project.clientCorrectionCount || 0} /{" "}
                  {project.maxAllowedCorrections || 2}
                  {project.correctionExceeded && (
                    <Tag color="red" style={{ marginLeft: 8 }}>
                      LIMIT EXCEEDED
                    </Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Total Corrections">
                  {project.correctionCount || 0}
                  {project.correctionCount >
                    (project.clientCorrectionCount || 0) && (
                    <span
                      style={{ marginLeft: 8, fontSize: 12, color: "#666" }}
                    >
                      (includes{" "}
                      {project.correctionCount -
                        (project.clientCorrectionCount || 0)}{" "}
                      coordinator corrections)
                    </span>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Divider />

            <div style={{ marginTop: 24 }}>
              <h3>Actions</h3>
              <Space>
                {/* Send Workflow button - REMOVED: Send workflow to client functionality has been disabled */}
                {canApproveWorkflow && (
                  <>
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={handleApproveWorkflow}
                      loading={isApprovingWorkflow}
                      style={{
                        backgroundColor: token.colorSuccess,
                        borderColor: token.colorSuccess,
                      }}
                    >
                      Approve Workflow
                    </Button>
                    <Button
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => setIsRevisionModalVisible(true)}
                      loading={isRequestingRevision}
                    >
                      Request Revision
                    </Button>
                  </>
                )}
                {canSubmitForReview && (
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSubmitForReview}
                    loading={isSubmitting}
                  >
                    Submit for Client Review
                  </Button>
                )}
                {canApprove && (
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => {
                      Modal.confirm({
                        title: "Approve Project",
                        content: (
                          <Form
                            form={form}
                            layout="vertical"
                            style={{ marginTop: 16 }}
                          >
                            <Form.Item
                              name="reviewNotes"
                              label="Review Notes (Optional)"
                            >
                              <TextArea
                                rows={3}
                                placeholder="Enter review notes"
                              />
                            </Form.Item>
                          </Form>
                        ),
                        onOk: () => {
                          form.validateFields().then((values) => {
                            handleApprove(values);
                          });
                        },
                      });
                    }}
                    loading={isApproving}
                  >
                    Approve Project
                  </Button>
                )}
                {canApprove && (
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => setIsCorrectionModalVisible(true)}
                  >
                    Request Correction
                  </Button>
                )}
                {canComplete && (
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={handleCompleteProject}
                    loading={isCompleting}
                    style={{
                      backgroundColor: "#52c41a",
                      borderColor: "#52c41a",
                    }}
                  >
                    Mark as Completed
                  </Button>
                )}
                {canReopen && (
                  <Button
                    type="default"
                    icon={<RedoOutlined />}
                    onClick={handleReopenProject}
                    loading={isReopening}
                  >
                    Reopen Project
                  </Button>
                )}
                {currentUser?.role !== "client" &&
                  project?.isActive === false && (
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={handleActivateProject}
                      loading={isActivating}
                    >
                      Activate Project
                    </Button>
                  )}
                {currentUser?.role !== "client" &&
                  project?.isActive !== false &&
                  project?.status !== "completed" && (
                    <Button
                      danger
                      icon={<CloseOutlined />}
                      onClick={handleDeactivateProject}
                      loading={isDeactivating}
                    >
                      Deactivate Project
                    </Button>
                  )}
                {isRenewable && (
                  <Button
                    type="primary"
                    icon={<RedoOutlined />}
                    onClick={handleRenewProject}
                    style={{
                      backgroundColor: "#722ed1",
                      borderColor: "#722ed1",
                    }}
                  >
                    Renewal Project
                  </Button>
                )}
              </Space>
            </div>
          </TabPane>

          <TabPane
            tab={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={22} />
                CRM Details
              </span>
            }
            key="crm_workflow"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Proposal Info */}
              {project.proposalId && (
                <Card title="Proposal Details" size="small" type="inner">
                  <Descriptions column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }} bordered>
                    <Descriptions.Item label="Proposal Number">{project.proposalId.proposalNumber}</Descriptions.Item>
                    <Descriptions.Item label="Name">{project.proposalId.name}</Descriptions.Item>
                    <Descriptions.Item label="Status">
                      <Tag color="blue">{project.proposalId.status || 'Sent'}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Grand Total">${project.proposalId.grandTotal}</Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              {/* Invoice Info */}
              {project.invoiceId && (
                <Card title="Invoice Details" size="small" type="inner">
                  <Descriptions column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }} bordered>
                    <Descriptions.Item label="Invoice Number">{project.invoiceId.invoiceNumber}</Descriptions.Item>
                    <Descriptions.Item label="Type">{project.invoiceId.type}</Descriptions.Item>
                    <Descriptions.Item label="Status">
                      <Tag color={project.invoiceId.status === 'Paid' ? 'green' : 'orange'}>{project.invoiceId.status || 'Generated'}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Payment Status">
                      <Tag color={project.invoiceId.paymentStatus === 'Paid' ? 'green' : 'red'}>{project.invoiceId.paymentStatus || 'Pending'}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Grand Total">${project.invoiceId.grandTotal}</Descriptions.Item>
                    <Descriptions.Item label="Date">
                      {project.invoiceId.createdAt ? dayjs(project.invoiceId.createdAt).format('DD/MM/YYYY') : 'N/A'}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              {/* Master Items (New Format) */}
              {project.masterItemIds && project.masterItemIds.length > 0 && (
                <Card title="Services (Master Items)" size="small" type="inner">
                  <Table 
                    dataSource={project.masterItemIds}
                    pagination={false}
                    rowKey="_id"
                    columns={[
                      { title: 'Item Code', dataIndex: 'itemCode', key: 'itemCode' },
                      { 
                        title: 'Name', 
                        dataIndex: 'name', 
                        key: 'name',
                        render: (text, record) => (
                          <div>
                            <div>{text}</div>
                            {record.isCampaign && record.campaignDetails && (
                              <div style={{ fontSize: '12px', marginTop: 8, background: 'var(--bg-secondary)', padding: 8, borderRadius: 4 }}>
                                <strong>Campaign Details:</strong><br/>
                                Days: {record.campaignDetails.numberOfDays} | 
                                Budget: ₹{record.campaignDetails.dailyBudget} | 
                                Total: ₹{record.campaignDetails.campaignAmount}
                              </div>
                            )}
                          </div>
                        )
                      },
                      { title: 'Category', dataIndex: 'category', key: 'category' },
                      { title: 'Price', dataIndex: 'price', key: 'price', render: (val) => `$${val || 0}` },
                      { title: 'Duration', dataIndex: 'duration', key: 'duration' }
                    ]}
                  />
                </Card>
              )}
            </div>
          </TabPane>

          <TabPane
            tab={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <GitMerge size={22} />
                Workflow
              </span>
            }
            key="workflow"
          >
            {currentUser?.role !== "client" && (
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleOpenMilestoneModal}
                  size="large"
                >
                  Project Milestone
                </Button>
              </div>
            )}

            {/* Milestone Progress */}
            {project?.milestones && project.milestones.length > 0 && (
              <Card style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <Title level={4}>Milestone Progress</Title>
                  <div style={{ marginTop: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <span>Overall Progress</span>
                      <strong>{calculateMilestoneProgress()}%</strong>
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: 24,
                        backgroundColor: token.colorFillSecondary,
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${calculateMilestoneProgress()}%`,
                          height: "100%",
                          backgroundColor: token.colorSuccess,
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  </div>
                </div>

                <Timeline>
                  {project.milestones.map((milestone, idx) => (
                    <Timeline.Item
                      key={idx}
                      color={milestone.completed ? "green" : "gray"}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <Checkbox checked={milestone.completed} disabled>
                            <span
                              style={{
                                textDecoration: milestone.completed
                                  ? "line-through"
                                  : "none",
                              }}
                            >
                              {milestone.step}
                            </span>
                          </Checkbox>
                          {milestone.metadata?.correctionRounds && (
                            <Tag color="orange" style={{ marginLeft: 8 }}>
                              Rounds: {milestone.metadata.correctionRounds}
                            </Tag>
                          )}
                          {milestone.metadata?.reviewNumber && (
                            <Tag color="blue" style={{ marginLeft: 8 }}>
                              Review #{milestone.metadata.reviewNumber}
                            </Tag>
                          )}
                        </div>
                        {milestone.completed && milestone.completedAt && (
                          <div
                            style={{
                              fontSize: 12,
                              color: token.colorTextSecondary,
                            }}
                          >
                            {dayjs(milestone.completedAt).format(
                              "DD/MM/YYYY HH:mm",
                            )}
                            {milestone.completedBy &&
                              typeof milestone.completedBy === "object" && (
                                <span style={{ marginLeft: 8 }}>
                                  by {milestone.completedBy.name || "N/A"}
                                </span>
                              )}
                          </div>
                        )}
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            )}

            <Card>
              <Descriptions
                bordered
                column={{ xxl: 2, xl: 2, lg: 1, md: 1, sm: 1, xs: 1 }}
                style={{ fontSize: "14px" }}
              >
                <Descriptions.Item label="Workflow Status">
                  <Tag
                    color={
                      project.status === "workflow_sent"
                        ? "blue"
                        : project.status === "workflow_approved"
                          ? "green"
                          : project.status === "workflow_revision_requested"
                            ? "orange"
                            : "default"
                    }
                  >
                    {project.status === "workflow_sent"
                      ? "Sent for Approval"
                      : project.status === "workflow_approved"
                        ? "Approved"
                        : project.status === "workflow_revision_requested"
                          ? "Revision Requested"
                          : "Not Sent"}
                  </Tag>
                </Descriptions.Item>
                {project.workflowSentAt && (
                  <>
                    <Descriptions.Item label="Workflow Sent Date">
                      {dayjs(project.workflowSentAt).format("DD/MM/YYYY HH:mm")}
                    </Descriptions.Item>
                    {project.workflowSentBy && (
                      <Descriptions.Item label="Sent By">
                        {project.workflowSentBy?.name || "N/A"} (
                        {project.workflowSentBy?.email || "N/A"})
                      </Descriptions.Item>
                    )}
                  </>
                )}
                {project.workflowApprovedAt && (
                  <>
                    <Descriptions.Item label="Workflow Approved Date">
                      {dayjs(project.workflowApprovedAt).format(
                        "DD/MM/YYYY HH:mm",
                      )}
                    </Descriptions.Item>
                    {project.workflowApprovedBy && (
                      <Descriptions.Item label="Approved By">
                        {project.workflowApprovedBy?.name || "N/A"} (
                        {project.workflowApprovedBy?.email || "N/A"})
                      </Descriptions.Item>
                    )}
                  </>
                )}
                {project.workflowRevisionRequestedAt && (
                  <>
                    <Descriptions.Item label="Revision Requested Date">
                      {dayjs(project.workflowRevisionRequestedAt).format(
                        "DD/MM/YYYY HH:mm",
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Revision Requested By">
                      <Tag
                        color={
                          project.workflowRevisionRequestedByType === "client"
                            ? "purple"
                            : "cyan"
                        }
                      >
                        {project.workflowRevisionRequestedByType === "client"
                          ? "Client"
                          : "Coordinator"}
                      </Tag>
                      {project.workflowRevisionRequestedBy && (
                        <span style={{ marginLeft: 8 }}>
                          - {project.workflowRevisionRequestedBy?.name || "N/A"}{" "}
                          ({project.workflowRevisionRequestedBy?.email || "N/A"}
                          )
                        </span>
                      )}
                    </Descriptions.Item>
                    {project.workflowRevisionRequested && (
                      <Descriptions.Item label="Revision Request Details">
                        <div
                          style={{
                            padding: 12,
                            background: token.colorWarningBg,
                            border: `1px solid ${token.colorWarningBorder}`,
                            borderRadius: 4,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {project.workflowRevisionRequested}
                        </div>
                      </Descriptions.Item>
                    )}
                  </>
                )}
                {project.workflow &&
                  typeof project.workflow === "object" &&
                  Object.keys(project.workflow).length > 0 && (
                    <Descriptions.Item label="Workflow Details">
                      <pre
                        style={{
                          padding: 12,
                          background: token.colorFillTertiary,
                          borderRadius: 4,
                          overflow: "auto",
                          maxHeight: 300,
                        }}
                      >
                        {JSON.stringify(project.workflow, null, 2)}
                      </pre>
                    </Descriptions.Item>
                  )}
                {(!project.workflow ||
                  (typeof project.workflow === "object" &&
                    Object.keys(project.workflow).length === 0)) && (
                  <Descriptions.Item label="Workflow Details">
                    <Text type="secondary">No workflow details available</Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          </TabPane>

          <TabPane
            tab={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CheckSquare size={22} />
                Tasks
              </span>
            }
            key="tasks"
          >
            {project.tasks && project.tasks.length > 0 ? (
              <div>
                <div
                  style={{
                    marginBottom: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <h3>Project Tasks ({project.tasks.length})</h3>
                  <Space>
                    <Segmented
                      value={taskViewMode}
                      onChange={setTaskViewMode}
                      options={[
                        { label: "List View", value: "list" },
                        { label: "Calendar View", value: "calendar" },
                      ]}
                    />
                    <Button
                      type="primary"
                      onClick={() => navigate(`/tasks?projectId=${id}`)}
                    >
                      View All Tasks
                    </Button>
                  </Space>
                </div>
                {taskViewMode === "list" ? (
                  project.tasks.map((task) => (
                    <Card key={task._id} style={{ marginBottom: 16 }}>
                      <Descriptions
                        bordered
                        column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }}
                        size="small"
                        style={{ fontSize: "14px" }}
                      >
                        <Descriptions.Item label="Task Title" span={2}>
                          <strong>{task.title || "N/A"}</strong>
                        </Descriptions.Item>
                        <Descriptions.Item label="Status">
                          <Tag
                            color={
                              task.status === "completed"
                                ? "green"
                                : task.status === "in_progress"
                                  ? "blue"
                                  : "default"
                            }
                          >
                            {task.status?.replace(/_/g, " ").toUpperCase() ||
                              "CREATED"}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Priority">
                          <Tag
                            color={
                              task.priority === "high"
                                ? "red"
                                : task.priority === "medium"
                                  ? "orange"
                                  : "default"
                            }
                          >
                            {task.priority?.toUpperCase() || "MEDIUM"}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Assigned To">
                          {task.assignedTo?.name || "Unassigned"}
                          {task.assignedTo?.email && (
                            <span
                              style={{
                                marginLeft: 8,
                                color: token.colorTextSecondary,
                                fontSize: 12,
                              }}
                            >
                              ({task.assignedTo.email})
                            </span>
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Assigned By">
                          {task.assignedBy?.name || "N/A"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Due Date">
                          {task.dueDate ? (
                            <span
                              style={{
                                color: dayjs(task.dueDate).isBefore(
                                  dayjs(),
                                  "day",
                                )
                                  ? token.colorError
                                  : "inherit",
                              }}
                            >
                              {dayjs(task.dueDate).format("DD/MM/YYYY")}
                            </span>
                          ) : (
                            "N/A"
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Task Type">
                          <Tag
                            color={
                              [
                                "Correction",
                                "Internal Correction",
                                "Client Correction",
                                "Hosting",
                              ].includes(task.taskCategory)
                                ? "orange"
                                : task.taskCategory === "Redesign"
                                  ? "purple"
                                  : "blue"
                            }
                          >
                            {task.taskCategory?.toUpperCase() || "NEW"}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Department">
                          {task.department ? (
                            <Tag>
                              {task.department.replace(/_/g, " ").toUpperCase()}
                            </Tag>
                          ) : (
                            "N/A"
                          )}
                        </Descriptions.Item>
                        {isDurationTrackingTask(task) && (
                          <Descriptions.Item label="Duration">
                            {formatMinutesAsDuration(
                              task.workDurationMinutes,
                            ) || "N/A"}
                          </Descriptions.Item>
                        )}
                        {task.description && (
                          <Descriptions.Item label="Description" span={2}>
                            {task.description}
                          </Descriptions.Item>
                        )}
                      </Descriptions>
                      <div style={{ marginTop: 12 }}>
                        <Button
                          type="link"
                          icon={<EyeOutlined />}
                          onClick={() => handleOpenTaskDetails(task)}
                        >
                          {currentUser?.role === "client"
                            ? "View Poster"
                            : "View Task Details"}
                        </Button>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr",
                      gap: 16,
                    }}
                  >
                    <Card
                      bodyStyle={{ paddingTop: 10 }}
                      title="Completed Tasks Calendar"
                    >
                      <Calendar
                        value={taskCalendarPanelDate}
                        onPanelChange={(panelDate) =>
                          setTaskCalendarPanelDate(panelDate)
                        }
                        onSelect={(value) => {
                          setSelectedTaskCalendarDate(value);
                          // Keep calendar on the user-selected month/year instead of jumping back.
                          if (
                            !value.isSame(taskCalendarPanelDate, "month") ||
                            !value.isSame(taskCalendarPanelDate, "year")
                          ) {
                            setTaskCalendarPanelDate(value);
                          }
                        }}
                        dateCellRender={(value) => {
                          const dayKey = value.format("YYYY-MM-DD");
                          const dayCount =
                            completedProjectTasksByDate[dayKey]?.length || 0;
                          if (!dayCount) return null;
                          return (
                            <div
                              style={{
                                marginTop: 4,
                                textAlign: "center",
                              }}
                            >
                              <Tag color="green" style={{ borderRadius: 999 }}>
                                {dayCount} Completed
                              </Tag>
                            </div>
                          );
                        }}
                      />
                    </Card>

                    <Card
                      title={`Completed on ${selectedTaskCalendarDate.format("DD/MM/YYYY")}`}
                    >
                      <List
                        dataSource={selectedTaskCalendarTasks}
                        locale={{
                          emptyText: (
                            <Empty
                              description="No completed tasks on this date"
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                          ),
                        }}
                        renderItem={(task) => (
                          <List.Item
                            style={{ paddingInline: 0, borderBottom: "none" }}
                            onClick={() => handleOpenTaskDetails(task)}
                          >
                            <div
                              style={{
                                width: "100%",
                                cursor: "pointer",
                                borderRadius: 12,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                background: isDark
                                  ? "linear-gradient(135deg, #1f1f1f 0%, #151515 100%)"
                                  : "linear-gradient(135deg, #ffffff 0%, #f7faf7 100%)",
                                padding: 12,
                                marginBottom: 10,
                                boxShadow: isDark
                                  ? "0 4px 14px rgba(0,0,0,0.25)"
                                  : "0 4px 12px rgba(22, 119, 255, 0.08)",
                                transition: "all 0.2s ease",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: 8,
                                  marginBottom: 8,
                                }}
                              >
                                <Text strong style={{ color: token.colorText }}>
                                  {task.title || "Untitled Task"}
                                </Text>
                                <Tag
                                  color="green"
                                  style={{ borderRadius: 999 }}
                                >
                                  {(task.status || "completed")
                                    .replace(/_/g, " ")
                                    .toUpperCase()}
                                </Tag>
                              </div>

                              <Space
                                size={[6, 6]}
                                wrap
                                style={{ marginBottom: 8 }}
                              >
                                <Tag color="blue" style={{ borderRadius: 999 }}>
                                  {task.assignedTo?.name || "Unassigned"}
                                </Tag>
                                {task.department && (
                                  <Tag style={{ borderRadius: 999 }}>
                                    {task.department
                                      .replace(/_/g, " ")
                                      .toUpperCase()}
                                  </Tag>
                                )}
                                {task.priority && (
                                  <Tag
                                    color={
                                      task.priority === "high"
                                        ? "red"
                                        : task.priority === "medium"
                                          ? "orange"
                                          : "default"
                                    }
                                    style={{ borderRadius: 999 }}
                                  >
                                    {task.priority.toUpperCase()}
                                  </Tag>
                                )}
                              </Space>

                              <Text type="secondary">
                                Completed{" "}
                                {dayjs(getTaskCompletionDate(task)).format(
                                  "DD/MM/YYYY HH:mm",
                                )}
                              </Text>
                            </div>
                          </List.Item>
                        )}
                      />
                    </Card>
                  </div>
                )}
              </div>
            ) : (
              <Card>
                <p>No tasks have been created for this project yet.</p>
                <p
                  style={{
                    color: token.colorTextSecondary,
                    fontSize: 12,
                    marginTop: 8,
                  }}
                >
                  Tasks will be automatically created once the workflow is
                  approved.
                </p>
              </Card>
            )}
          </TabPane>

          <TabPane
            tab={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <MessageSquare size={22} />
                Client Review
              </span>
            }
            key="review"
          >
            <Card>
              <Descriptions
                bordered
                column={{ xxl: 2, xl: 2, lg: 1, md: 1, sm: 1, xs: 1 }}
                style={{ fontSize: "14px" }}
              >
                <Descriptions.Item label="Review Status">
                  <Tag
                    color={
                      project.clientReview?.status === "approved"
                        ? "green"
                        : "orange"
                    }
                  >
                    {project.clientReview?.status?.toUpperCase() || "PENDING"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Reviewed At">
                  {project.clientReview?.reviewedAt
                    ? dayjs(project.clientReview.reviewedAt).format(
                        "DD/MM/YYYY HH:mm",
                      )
                    : "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Review Notes">
                  {project.clientReview?.reviewNotes || "N/A"}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </TabPane>

          <TabPane
            tab={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={22} />
                Corrections
              </span>
            }
            key="corrections"
          >
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                onClick={() => {
                  // Find first completed task to auto-select assignee and task
                  const firstCompletedTask = [...(project?.tasks || [])]
                    .filter((t) => t.status === "completed")
                    .sort((a, b) =>
                      dayjs(a.updatedAt).diff(dayjs(b.updatedAt)),
                    )[0];

                  if (firstCompletedTask) {
                    correctionForm.setFieldsValue({
                      taskId: firstCompletedTask._id,
                      assignedPerson:
                        firstCompletedTask.assignedTo?._id ||
                        firstCompletedTask.assignedTo,
                    });
                  }
                  setIsCorrectionModalVisible(true);
                }}
                disabled={
                  project.status !== "sent_for_client_review" &&
                  project.status !== "in_progress"
                }
              >
                Request Correction
              </Button>
            </div>
            <Timeline>
              {corrections.length > 0 ? (
                corrections.map((correction) => {
                  const taskId = correction.taskId?._id || correction.taskId;
                  const linkedTask = (project?.tasks || []).find(
                    (t) => t._id === taskId,
                  );
                  const displayStatus = linkedTask
                    ? linkedTask.status
                    : correction.status;

                  return (
                    <Timeline.Item
                      key={correction._id}
                      color={
                        correction.status === "resolved" ? "green" : "orange"
                      }
                    >
                      <Card size="small">
                        <p>
                          <strong>
                            Correction Task {correction.correctionRound}
                          </strong>{" "}
                          - <Tag>{correction.category}</Tag> -{" "}
                          <Tag
                            color={
                              correction.mistakeBy === "client" ? "blue" : "red"
                            }
                          >
                            {correction.mistakeBy === "client"
                              ? "Client Mistake"
                              : "Internal Mistake"}
                          </Tag>
                          {correction.requestedByType && (
                            <Tag
                              color={
                                correction.requestedByType === "client"
                                  ? "purple"
                                  : "cyan"
                              }
                              style={{ marginLeft: 4 }}
                            >
                              {correction.requestedByType === "client"
                                ? "Client Requested"
                                : "Coordinator Requested"}
                            </Tag>
                          )}
                        </p>
                        <p>{correction.notes}</p>
                        <p
                          style={{
                            fontSize: 12,
                            color: token.colorTextTertiary,
                          }}
                        >
                          {dayjs(correction.createdAt).format(
                            "DD/MM/YYYY HH:mm",
                          )}{" "}
                          -{" "}
                          <Tag
                            color={
                              linkedTask
                                ? getStatusColor(linkedTask.status)
                                : correction.status === "resolved"
                                  ? "green"
                                  : "orange"
                            }
                          >
                            {displayStatus?.toUpperCase()}
                          </Tag>
                        </p>
                        {taskId && (
                          <div style={{ marginTop: 8 }}>
                            <Button
                              type="link"
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={() => {
                                const taskId =
                                  correction.taskId?._id || correction.taskId;
                                const task = (project?.tasks || []).find(
                                  (t) => t._id === taskId,
                                );
                                if (task) {
                                  setSelectedTask(task);
                                  setIsTaskDrawerVisible(true);
                                } else {
                                  message.warning("Task details not found");
                                }
                              }}
                            >
                              View Task Details
                            </Button>
                            <Button
                              type="link"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              loading={isDeletingCorrection}
                              onClick={() =>
                                handleDeleteCorrection(correction._id)
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </Card>
                    </Timeline.Item>
                  );
                })
              ) : (
                <p>No corrections requested yet</p>
              )}
            </Timeline>
          </TabPane>

          <TabPane
            tab={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <DollarSign size={22} />
                Financial
              </span>
            }
            key="financial"
          >
            {plEntry ? (
              <Card>
                <Card type="inner" title="Revenue" style={{ marginBottom: 16 }}>
                  <Descriptions
                    bordered
                    column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }}
                    style={{ fontSize: "14px" }}
                  >
                    <Descriptions.Item label="Invoice Amount">
                      <strong>
                        ₹
                        {plEntry.revenue?.invoiceAmount?.toLocaleString(
                          "en-IN",
                        ) || 0}
                      </strong>
                    </Descriptions.Item>
                    <Descriptions.Item label="Net Revenue">
                      <strong>
                        ₹
                        {plEntry.revenue?.netRevenue?.toLocaleString("en-IN") ||
                          0}
                      </strong>
                    </Descriptions.Item>
                    <Descriptions.Item label="Taxes">
                      ₹{plEntry.revenue?.taxes?.toLocaleString("en-IN") || 0}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
                <Card type="inner" title="Costs" style={{ marginBottom: 16 }}>
                  <Descriptions
                    bordered
                    column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }}
                    style={{ fontSize: "14px" }}
                  >
                    <Descriptions.Item label="Staff Cost">
                      ₹{plEntry.cost?.staffCost?.toLocaleString("en-IN") || 0}
                    </Descriptions.Item>
                    <Descriptions.Item label="Correction Cost">
                      ₹
                      {plEntry.cost?.correctionCost?.toLocaleString("en-IN") ||
                        0}
                    </Descriptions.Item>
                    <Descriptions.Item label="Total Cost" span={2}>
                      <strong>
                        ₹{plEntry.cost?.totalCost?.toLocaleString("en-IN") || 0}
                      </strong>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
                <Card type="inner" title="Profit & Loss">
                  <Descriptions
                    bordered
                    column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }}
                    style={{ fontSize: "14px" }}
                  >
                    <Descriptions.Item label="Gross Profit">
                      <strong style={{ color: "#52c41a" }}>
                        ₹{plEntry.grossProfit?.toLocaleString("en-IN") || 0}
                      </strong>
                    </Descriptions.Item>
                    <Descriptions.Item label="Net Profit">
                      <strong
                        style={{
                          color: plEntry.netProfit >= 0 ? "#52c41a" : "#ff4d4f",
                        }}
                      >
                        ₹{plEntry.netProfit?.toLocaleString("en-IN") || 0}
                      </strong>
                    </Descriptions.Item>
                    <Descriptions.Item label="Profit Margin" span={2}>
                      <Tag
                        color={plEntry.marginPercent >= 0 ? "green" : "red"}
                        style={{ fontSize: 16, padding: "4px 12px" }}
                      >
                        {plEntry.marginPercent?.toFixed(2) || 0}%
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Card>
            ) : (
              <Card>
                <Text type="secondary">
                  P&L data is being calculated. Please check back later.
                </Text>
              </Card>
            )}
          </TabPane>

          <TabPane
            tab={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={22} />
                Timeline & History
              </span>
            }
            key="timeline"
          >
            <Card>
              <Spin spinning={isLoadingTimeline}>
                <TimelineView events={timelineEvents} />
              </Spin>
            </Card>
          </TabPane>
        </Tabs>
      </Card>

      {/* Workflow Revision Request Modal */}
      <Modal
        title="Request Workflow Revision"
        open={isRevisionModalVisible}
        onCancel={() => {
          setIsRevisionModalVisible(false);
          revisionForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={revisionForm}
          layout="vertical"
          onFinish={handleRequestRevision}
          autoComplete="off"
        >
          {canPerformAction(
            currentUser?.role,
            "projects",
            "requestRevision",
          ) && (
            <Form.Item
              name="requestedByType"
              label="Requested By"
              rules={[
                {
                  required: true,
                  message: "Please select who is requesting the revision",
                },
              ]}
            >
              <Select placeholder="Select">
                <Select.Option value="client">Client Requested</Select.Option>
                <Select.Option value="coordinator">
                  Coordinator Requested
                </Select.Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="revisionRequested"
            label="Revision Request Details"
            rules={[
              {
                required: true,
                message: "Please enter revision request details",
              },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Describe what changes you would like in the workflow"
            />
          </Form.Item>

          <Form.Item style={{ textAlign: "end" }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={isRequestingRevision}
              >
                Request Revision
              </Button>
              <Button
                onClick={() => {
                  setIsRevisionModalVisible(false);
                  revisionForm.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Correction Request Modal */}
      <Modal
        title="Request Correction"
        open={isCorrectionModalVisible}
        onCancel={() => {
          setIsCorrectionModalVisible(false);
          correctionForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={correctionForm}
          layout="vertical"
          onFinish={handleRequestCorrection}
          autoComplete="off"
          initialValues={{
            assignedDate: dayjs(),
          }}
        >
          <Form.Item
            name="requestedByType"
            label="Requested By"
            rules={[
              {
                required: true,
                message: "Please select who is requesting the correction",
              },
            ]}
          >
            <Select placeholder="Select">
              <Select.Option value="client">Client Requested</Select.Option>
              <Select.Option value="coordinator">
                Coordinator Requested
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="mistakeBy"
            label="Who Made the Mistake?"
            rules={[
              { required: true, message: "Please select who made the mistake" },
            ]}
          >
            <Select placeholder="Select">
              <Select.Option value="client">
                Client (Wrong content / Unclear brief)
              </Select.Option>
              <Select.Option value="internal_team">
                Internal Team (Design/Content issue)
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="taskId"
            label="Select Task"
            rules={[{ required: true, message: "Please select a task" }]}
          >
            <Select
              placeholder="Select task"
              showSearch
              optionFilterProp="children"
              onChange={(taskId) => {
                const selectedTask = project?.tasks?.find(
                  (t) => t._id === taskId,
                );
                if (selectedTask) {
                  correctionForm.setFieldsValue({
                    assignedPerson:
                      selectedTask.assignedTo?._id || selectedTask.assignedTo,
                  });
                }
              }}
            >
              {(project?.tasks || []).map((t) => (
                <Select.Option key={t._id} value={t._id}>
                  {t.title} ({t.status})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="category"
            label="Task Type"
            rules={[{ required: true, message: "Please select task type" }]}
          >
            <Select placeholder="Select type">
              <Select.Option value="Correction">Correction</Select.Option>
              <Select.Option value="Redesign">Redesign</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="assignedPerson"
            label="Assigned Person"
            rules={[
              { required: true, message: "Please select assigned person" },
            ]}
          >
            <Select
              placeholder="Select assigned person"
              showSearch
              optionFilterProp="children"
            >
              {users.map((user) => (
                <Select.Option key={user._id} value={user._id}>
                  {user.name} ({user.email})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="assignedDate"
            label="Assigned Date"
            rules={[{ required: true, message: "Please select assigned date" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="notes"
            label="Correction Notes"
            rules={[
              { required: true, message: "Please enter correction notes" },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Describe what needs to be corrected"
            />
          </Form.Item>

          <Form.Item style={{ textAlign: "end" }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={isRequestingCorrection}
              >
                Request Correction
              </Button>
              <Button
                onClick={() => {
                  setIsCorrectionModalVisible(false);
                  correctionForm.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reopen Project Modal */}
      <Modal
        title="Reopen Project"
        open={isReopenModalVisible}
        onCancel={() => {
          setIsReopenModalVisible(false);
          reopenForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={reopenForm}
          layout="vertical"
          onFinish={handleReopenSubmit}
          initialValues={{
            status: project?.status === "completed" ? "in_progress" : undefined,
            updateTaskStatus: false,
          }}
        >
          <Form.Item
            name="status"
            label="New Project Status"
            rules={[
              { required: true, message: "Please select project status" },
            ]}
          >
            <Select placeholder="Select status">
              <Select.Option value="created">Created</Select.Option>
              <Select.Option value="workflow_sent">Workflow Sent</Select.Option>
              <Select.Option value="workflow_approved">
                Workflow Approved
              </Select.Option>
              <Select.Option value="in_progress">In Progress</Select.Option>
              <Select.Option value="sent_for_client_review">
                Sent for Client Review
              </Select.Option>
              <Select.Option value="approved">Approved</Select.Option>
              <Select.Option value="on_hold">On Hold</Select.Option>
            </Select>
          </Form.Item>

          <Divider>Additional Payment Details (Optional)</Divider>

          <Form.Item
            name="additionalPaymentAmount"
            label="Additional Payment Amount"
            tooltip="This amount will be automatically included in the next invoice for this client"
          >
            <InputNumber
              style={{ width: "100%" }}
              formatter={(value) =>
                `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) => value.replace(/₹\s?|(,*)/g, "")}
              min={0}
              placeholder="Enter additional payment amount"
            />
          </Form.Item>

          <Form.Item
            name="additionalPaymentReason"
            label="Reason for Additional Payment"
          >
            <TextArea
              rows={3}
              placeholder="Enter reason for additional payment (e.g., scope change, additional work, etc.)"
            />
          </Form.Item>

          <Divider>Task Status Update (Optional)</Divider>

          <Form.Item name="updateTaskStatus" valuePropName="checked">
            <Checkbox>Update related task statuses</Checkbox>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.updateTaskStatus !== currentValues.updateTaskStatus
            }
          >
            {({ getFieldValue }) =>
              getFieldValue("updateTaskStatus") ? (
                <Form.Item
                  name="taskStatus"
                  label="New Task Status"
                  rules={[
                    { required: true, message: "Please select task status" },
                  ]}
                >
                  <Select placeholder="Select task status">
                    <Select.Option value="created">Created</Select.Option>
                    <Select.Option value="assigned">Assigned</Select.Option>
                    <Select.Option value="in_progress">
                      In Progress
                    </Select.Option>
                    <Select.Option value="submitted">Submitted</Select.Option>
                    <Select.Option value="on_hold">On Hold</Select.Option>
                  </Select>
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item style={{ textAlign: "end" }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={isReopening}>
                Reopen Project
              </Button>
              <Button
                onClick={() => {
                  setIsReopenModalVisible(false);
                  reopenForm.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Project Milestone Modal */}
      <Modal
        title="Project Milestones"
        open={isMilestoneModalVisible}
        onCancel={() => setIsMilestoneModalVisible(false)}
        footer={null}
        width={800}
        maskClosable={false}
        destroyOnClose
      >
        <Form
          form={milestoneForm}
          layout="vertical"
          onFinish={handleMilestoneSubmit}
          initialValues={{ milestones: [] }}
        >
          <Form.List name="milestones">
            {(fields, { add }) => {
              const workflowType =
                project?.milestoneWorkflowType || getMilestoneWorkflowType();

              return (
                <div>
                  {fields.map((field) => {
                    const stepValue = milestoneForm.getFieldValue([
                      "milestones",
                      field.name,
                      "step",
                    ]);
                    const isCorrectionsStep =
                      stepValue === "Corrections Going On";
                    const isReviewStep =
                      stepValue &&
                      stepValue.startsWith("Review ") &&
                      stepValue.includes("Demo Shared with Client");

                    return (
                      <div
                        key={field.key}
                        style={{
                          marginBottom: 16,
                          padding: 12,
                          border: `1px solid ${token.colorBorder}`,
                          borderRadius: 4,
                        }}
                      >
                        <Form.Item
                          {...field}
                          name={[field.name, "step"]}
                          hidden
                        >
                          <Input />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, "completed"]}
                          valuePropName="checked"
                          style={{ marginBottom: 8 }}
                        >
                          <Checkbox>
                            <strong>{stepValue}</strong>
                          </Checkbox>
                        </Form.Item>

                        {isCorrectionsStep && (
                          <Form.Item
                            name={[field.name, "correctionRounds"]}
                            label="Correction Task (1-5)"
                            style={{ marginLeft: 24 }}
                          >
                            <Select placeholder="Select rounds" allowClear>
                              {[1, 2, 3, 4, 5].map((round) => (
                                <Select.Option key={round} value={round}>
                                  Correction Task {round}
                                </Select.Option>
                              ))}
                            </Select>
                          </Form.Item>
                        )}

                        {isReviewStep &&
                          (workflowType === "web-application-development" ||
                            workflowType === "tech_team") && (
                            <Form.Item
                              name={[field.name, "reviewNumber"]}
                              label="Review Number"
                              style={{ marginLeft: 24 }}
                            >
                              <InputNumber
                                min={1}
                                placeholder="Review number"
                                style={{ width: "100%" }}
                              />
                            </Form.Item>
                          )}
                      </div>
                    );
                  })}

                  {(workflowType === "web-application-development" ||
                    workflowType === "tech_team") && (
                    <Button
                      type="dashed"
                      onClick={() => {
                        const reviewNumber = dynamicReviews.length + 3;
                        const newReview = `Review ${reviewNumber} Demo Shared with Client`;
                        setDynamicReviews([...dynamicReviews, newReview]);
                        add({
                          step: newReview,
                          completed: false,
                          correctionRounds: null,
                          reviewNumber: reviewNumber,
                        });
                      }}
                      icon={<CheckCircleOutlined />}
                      style={{ width: "100%", marginTop: 16 }}
                    >
                      Add Review Step
                    </Button>
                  )}
                </div>
              );
            }}
          </Form.List>

          <Form.Item
            style={{ marginTop: 24, marginBottom: 0, textAlign: "end" }}
          >
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={isUpdatingMilestones}
              >
                Save Milestones
              </Button>
              <Button onClick={() => setIsMilestoneModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {currentUser?.role === "client" && (
        <Modal
          open={isPosterModalVisible}
          onCancel={() => {
            setIsPosterModalVisible(false);
            setSelectedPosterTask(null);
            setSelectedPosterUrl("");
          }}
          footer={null}
          width={900}
          title={selectedPosterTask?.title || "View Poster"}
        >
          {selectedPosterUrl ? (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <Tag
                  color={
                    String(
                      selectedPosterTask?.clientReviewStatus || "",
                    ).toLowerCase() === "approved"
                      ? "green"
                      : "orange"
                  }
                >
                  {String(
                    selectedPosterTask?.clientReviewStatus || "",
                  ).toLowerCase() === "approved"
                    ? "APPROVED"
                    : "PENDING"}
                </Tag>
                <Button
                  type="primary"
                  onClick={handleClientTaskApprove}
                  loading={isClientTaskApproving}
                  disabled={
                    String(
                      selectedPosterTask?.clientReviewStatus || "",
                    ).toLowerCase() === "approved"
                  }
                  style={
                    String(
                      selectedPosterTask?.clientReviewStatus || "",
                    ).toLowerCase() === "approved"
                      ? { background: "#52c41a", borderColor: "#52c41a" }
                      : {}
                  }
                >
                  {String(
                    selectedPosterTask?.clientReviewStatus || "",
                  ).toLowerCase() === "approved"
                    ? "Client Side Approval: Approved"
                    : "Approve"}
                </Button>
              </div>
              <div style={{ textAlign: "center" }}>
                <Image
                  src={selectedPosterUrl}
                  alt={selectedPosterTask?.title || "Poster"}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "70vh",
                    objectFit: "contain",
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 24 }}>
              <Text type="secondary">No poster image available.</Text>
            </div>
          )}
        </Modal>
      )}
      <TaskDetailDrawer
        task={selectedTask}
        visible={isTaskDrawerVisible}
        onClose={handleCloseTaskDrawer}
        onTaskCompleted={() => {
          if (refetchProject) refetchProject();
        }}
      />
    </div>
  );
};

export default ProjectDetail;
