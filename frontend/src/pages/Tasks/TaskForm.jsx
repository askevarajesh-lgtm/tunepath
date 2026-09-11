import { useAuth } from "../../contexts/AuthContext";
import React, { useEffect, useMemo, useState } from "react";
import {
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  message,
  Card,
  Spin,
  Tag,
  Row,
  Col,
  Alert,
  Switch,
  Segmented,
  Table,
  InputNumber,
  Divider,
  Tooltip,
  Popconfirm,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  useGetTaskByIdQuery,
  useCreateTaskMutation,
  useCreateBulkTasksMutation,
  useUpdateTaskMutation,
  taskApi,
} from "../../api/taskApi";
import { notifyLoading, notifySuccess, notifyError } from '../../utils/notify';
import {
  useGetIntegrationsQuery,
  useSyncEktaStaffMutation,
  useSyncEktaAttendanceMutation,
} from "../../api/integrationApi";
import { useGetCompaniesDropdownQuery } from "../../api/companyApi";
import {
  useGetProjectsDropdownQuery,
  useGetProjectByIdQuery,
} from "../../api/projectApi";
import { useGetUsersDropdownQuery } from "../../api/userApi";
import { useGetPriorityLevelsQuery } from "../../api/settingsApi";
import { useGetDepartmentsDynamicQuery } from "../../api/accessControlApi";
import dayjs from "dayjs";
// import { isPresentAttendanceStatus } from "../../utils/ektaAttendanceStatus";
import { useActionPermissions } from "../../hooks/useActionPermissions";
import { PERMISSION_ACTIONS } from "../../utils/actionPermissions";
import { ensureNamedCategories } from "../../utils/categoryUtils";

const { TextArea } = Input;
const { Option } = Select;

const filterOptionByChildrenOrLabel = (input, option) => {
  if (!input) return true;
  const search = input.toLowerCase().trim();
  if (option?.label && typeof option.label === "string") {
    return option.label.toLowerCase().includes(search);
  }
  if (option?.children !== undefined && option?.children !== null) {
    if (Array.isArray(option.children)) {
      const text = option.children
        .filter(Boolean)
        .map((c) => (typeof c === "object" ? "" : String(c)))
        .join(" ");
      return text.toLowerCase().includes(search);
    }
    return String(option.children).toLowerCase().includes(search);
  }
  return false;
};

const extractProjectCategoriesWithCounts = (proj) => {
  if (!proj) return [];
  const list = [];
  const addedNames = new Set();

  const rawCategories =
    proj.selectedCategories ||
    proj.masterItemId?.selectedCategories ||
    proj.masterItemIds?.[0]?.selectedCategories ||
    [];

  if (Array.isArray(rawCategories) && rawCategories.length > 0) {
    rawCategories.forEach((cat, idx) => {
      if (typeof cat === "string") {
        const name = cat;
        if (!addedNames.has(name.toLowerCase())) {
          addedNames.add(name.toLowerCase());
          list.push({ name, value: cat, remaining: 1, total: 1 });
        }
      } else if (typeof cat === "object" && cat !== null) {
        const name = cat.name || cat.categoryName || cat.label || `Item ${idx + 1}`;
        if (!addedNames.has(name.toLowerCase())) {
          addedNames.add(name.toLowerCase());
          const total = cat.quantity !== undefined ? Number(cat.quantity) : (cat.count !== undefined ? Number(cat.count) : (cat.total !== undefined ? Number(cat.total) : undefined));
          const remaining = cat.remaining !== undefined ? Number(cat.remaining) : (total !== undefined ? total : undefined);
          list.push({
            ...cat,
            name,
            value: cat.value || cat.name || name,
            remaining,
            total,
          });
        }
      }
    });
  }

  // Standard deliverables (Poster, Video, Shoot) if not in list
  if ((proj.numberOfPosters || 0) > 0 && !addedNames.has("poster") && !addedNames.has("posters")) {
    const total = Number(proj.numberOfPosters) || 0;
    const remaining = proj.remainingPosters !== undefined ? Number(proj.remainingPosters) : total;
    list.push({ name: "Poster", value: "Poster", remaining, total });
    addedNames.add("poster");
  }

  if ((proj.numberOfVideos || 0) > 0 && !addedNames.has("video") && !addedNames.has("videos")) {
    const total = Number(proj.numberOfVideos) || 0;
    const remaining = proj.remainingVideos !== undefined ? Number(proj.remainingVideos) : total;
    list.push({ name: "Videos", value: "Videos", remaining, total });
    addedNames.add("video");
  }

  if ((proj.numberOfShoots || 0) > 0 && !addedNames.has("shoot") && !addedNames.has("shoots")) {
    const total = Number(proj.numberOfShoots) || 0;
    const remaining = proj.remainingShoots !== undefined ? Number(proj.remainingShoots) : total;
    list.push({ name: "Shoots", value: "Shoots", remaining, total });
    addedNames.add("shoot");
  }

  return list;
};

const TaskForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
    const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [taskBlocks, setTaskBlocks] = useState([
    {
      id: 1,
      department: undefined,
      companyId: undefined,
      projectId: undefined,
      serviceType: undefined,
      assignedTo: undefined,
      title: "",
      startDate: dayjs(),
      dueDate: null,
      priority: "medium",
      taskCategory: "New",
      description: "",
      watchers: [],
    },
  ]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [prevCompanyId, setPrevCompanyId] = useState(null);
  const [
    shouldApplyWebsiteDefaultCompany,
    setShouldApplyWebsiteDefaultCompany,
  ] = useState(false);

  const getBaseRoute = () => {
    if (location.pathname.startsWith("/client")) return "/client/workspace";
    if (location.pathname.startsWith("/agency")) return "/agency/workspace";
    if (location.pathname.startsWith("/user")) return "/user/workspace";
    return "/workspace";
  };

  // Get current user for role-based restrictions
  const { user: currentUser } = useAuth();
  const userRole = currentUser?.role;
  // When creating: read taskTarget from navigation state (set by the Create Task button).
  // When editing: infer from the task data after it loads (see below, after taskData is declared).
  const locationTaskTarget = location.state?.taskTarget;

  const { canAdd: canCreate, canEdit: canEditTaskDetails } = useActionPermissions("/tasks");
  const isSEOUser = false; // Default-Allow: do not restrict project dropdowns
  const adminRoles = [
    "supreme_super_admin",
    "commander_admin",
    "agency_super_admin",
    "brand_super_admin",
    "agency_manager",
    "brand_manager"
  ];
  const isAdmin = adminRoles.includes(userRole);
  const isRestricted = isEdit ? !canEditTaskDetails : !canCreate;

  useEffect(() => {
    if (isRestricted) {
      notifyError('permission', 'global', "You do not have permission to perform this action");
      navigate(`${getBaseRoute()}/tasks`);
    }
  }, [isRestricted, navigate]);

  useEffect(() => {
    if (isEdit && !canEditTaskDetails) {
      notifyError('permission', 'global', "Task detail editing is not allowed for your role");
      navigate(`${getBaseRoute()}/tasks`);
    }
  }, [isEdit, canEditTaskDetails, navigate]);

  const { data: taskData, isLoading: isLoadingTask } = useGetTaskByIdQuery(id, {
    skip: !isEdit,
  });

  useEffect(() => {
    if (isEdit && taskData?.data?.task) {
      const task = taskData.data.task;
      const isCreator = task.createdBy && (task.createdBy._id === currentUser?._id || task.createdBy === currentUser?._id);
      if (!isCreator) {
        notifyError('permission', 'global', "Only the creator of this task can edit its details.");
        navigate(`${getBaseRoute()}/tasks`);
      }
    }
  }, [isEdit, taskData, currentUser, navigate]);

  // Compute taskTarget and hideCompanyProject after taskData is available.
  // When creating: use navigation state (set by Create Task button choosing 'own_brand').
  // When editing: infer from the loaded task — no companyId means it's an Own Brand task.
  const task_raw = taskData?.data?.task;
  const isBrandPortal = location.pathname.startsWith('/client') ||
    ['brand_admin', 'brand_manager', 'brand_super_admin', 'brand_team_user', 'client', 'agency_client'].includes(userRole) ||
    userRole?.startsWith('brand');

  const inferredTaskTarget = isEdit
    ? (locationTaskTarget || (task_raw && !task_raw.companyId ? 'own_brand' : 'client'))
    : (locationTaskTarget || (isBrandPortal ? 'own_brand' : 'client'));
  const taskTarget = inferredTaskTarget;
  const hideClientDropdown =
    userRole === 'commander_admin' ||
    isBrandPortal ||
    taskTarget === 'own_brand';
  const selectedDepartment = Form.useWatch("department", form);
  const watchedCompanyId = Form.useWatch("companyId", form);

  const {
    data: usersData,
    isLoading: isLoadingUsers,
    isError: isUsersError,
  } = useGetUsersDropdownQuery({});

  // Fetch users specifically for the selected company to find the admin
  const { data: companyUsersData } = useGetUsersDropdownQuery(
    { companyId: watchedCompanyId },
    { skip: !watchedCompanyId || isEdit },
  );

  const {
    data: departmentsResp,
    isLoading: isLoadingDepartments,
    isError: isDepartmentsError,
  } = useGetDepartmentsDynamicQuery();
  const departments = departmentsResp?.data?.departments || [];

  const users = usersData?.data?.users || usersData?.data?.data || [];
  const companyUsers =
    companyUsersData?.data?.users || companyUsersData?.data?.data || [];

  // Combine users for the watchers dropdown (main company users + client company users)
  const allAvailableUsers = useMemo(() => {
    const combined = [...users, ...companyUsers];
    const unique = new Map();
    combined.forEach((u) => unique.set(u._id, u));
    return Array.from(unique.values());
  }, [users, companyUsers]);

  const selectedDeptObj = useMemo(() => {
    if (!selectedDepartment || !departments) return null;
    return departments.find(
      (d) =>
        d._id === selectedDepartment ||
        d.slug === selectedDepartment ||
        d.name?.toLowerCase() === String(selectedDepartment).toLowerCase()
    );
  }, [departments, selectedDepartment]);

  const isProjectsDeptCheck = (deptVal) => {
    if (!deptVal) return false;
    const deptObj = departments?.find(
      (d) =>
        d._id === deptVal ||
        d.slug === deptVal ||
        d.name?.toLowerCase() === String(deptVal).toLowerCase()
    );
    const slug = deptObj?.slug?.toLowerCase() || (typeof deptVal === "string" ? deptVal.toLowerCase() : "");
    const name = deptObj?.name?.toLowerCase() || "";
    const raw = String(deptVal).toLowerCase();

    return (
      slug === "projects" ||
      slug === "project" ||
      name === "projects" ||
      name === "project" ||
      raw === "projects" ||
      raw === "project" ||
      raw.includes("project")
    );
  };

  const isProjectsDepartment = useMemo(() => {
    return isProjectsDeptCheck(selectedDepartment);
  }, [selectedDepartment, departments]);

  const websiteDeptId = useMemo(() => {
    return departments.find((d) => d.slug === "website-designing")?._id;
  }, [departments]);

  const webAppDeptId = useMemo(() => {
    return departments.find((d) => d.slug === "web-application-development")
      ?._id;
  }, [departments]);

  const isFixedWatcher = (u, deptVal = selectedDepartment) => {
    if (!u || !currentUser) return false;
    const currentUserCompanyId =
      currentUser?.companyId?._id || currentUser?.companyId;
    const uCompanyId = u.companyId?._id || u.companyId;

    // 1. Tenant Admin is always fixed
    const isTenantAdmin =
      u.role === "admin" && String(uCompanyId) === String(currentUserCompanyId);
    if (isTenantAdmin) return true;

    // 2. Agency Manager is fixed / default watcher
    const isAgencyManager =
      u.role === "agency_manager" ||
      u.roleName === "agency_manager" ||
      (typeof u.roleName === "string" && u.roleName.toLowerCase().includes("agency manager")) ||
      (typeof u.designation === "string" && u.designation.toLowerCase().includes("agency manager")) ||
      (typeof u.name === "string" && u.name.toLowerCase().includes("agency manager")) ||
      u.email?.toLowerCase() === "agencymanager@gmail.com";
    if (isAgencyManager) return true;

    // 3. Lekashri is fixed ONLY for Projects department
    const isProjDept = isProjectsDeptCheck(deptVal);
    if (isProjDept && u.email?.toLowerCase() === "leka@tunepath.com")
      return true;

    return false;
  };

  const getFixedWatcherIds = (deptVal) => {
    if (!allAvailableUsers || allAvailableUsers.length === 0) return [];
    return allAvailableUsers
      .filter((u) => isFixedWatcher(u, deptVal))
      .map((u) => u._id);
  };

  const tagRender = (props) => {
    const { label, value, closable, onClose } = props;
    const onPreventMouseDown = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const userObj = allAvailableUsers.find((u) => u._id === value);
    const isFixed = isFixedWatcher(userObj);

    return (
      <Tag
        onMouseDown={onPreventMouseDown}
        closable={isFixed ? false : closable}
        onClose={onClose}
        style={{ marginRight: 3 }}
      >
        {label}
      </Tag>
    );
  };

  const seoDeptId = useMemo(() => {
    return departments.find((d) => d.slug === "seo")?._id;
  }, [departments]);

  const digitalMarketingDeptId = useMemo(() => {
    return departments.find((d) => d.slug === "digital-marketing")?._id;
  }, [departments]);

  // Get companies - Fetch all available clients
  const companyFilter = {};
  const { data: companiesData, isLoading: isLoadingCompanies } =
    useGetCompaniesDropdownQuery(companyFilter);

  // Get all projects (for project-first selection)
  // Filter for SEO users unless they have full access
  const projectFilter =
    isSEOUser && !hasFullProjectAccess ? { milestoneWorkflowType: "seo" } : {};

  const { data: allProjectsData, isLoading: isLoadingAllProjects } =
    useGetProjectsDropdownQuery(projectFilter, { skip: false });

  // Get project details when a project is selected
  const { data: selectedProjectData } = useGetProjectByIdQuery(
    selectedProjectId,
    {
      skip: !selectedProjectId,
    },
  );

  // Pass companyId to filter projects by selected company (for client-first selection)
  const { data: projectsData, isLoading: isLoadingProjects } =
    useGetProjectsDropdownQuery(
      {
        ...(selectedCompanyId ? { companyId: selectedCompanyId } : {}),
        ...projectFilter,
      },
      { skip: !selectedCompanyId && !isEdit && !selectedProjectId }, // Skip if no company selected (unless editing or project selected)
    );
  const { data: integrationsData } = useGetIntegrationsQuery();
  const [syncEktaStaff] = useSyncEktaStaffMutation();
  const [syncEktaAttendance] = useSyncEktaAttendanceMutation();
  const { data: priorityLevelsData } = useGetPriorityLevelsQuery();

  const [createTask, { isLoading: isCreating }] = useCreateTaskMutation();
  const [createBulkTasks, { isLoading: isCreatingBulk }] = useCreateBulkTasksMutation();
  const [updateTask, { isLoading: isUpdating }] = useUpdateTaskMutation();

  const task = taskData?.data?.task;
  // Handle paginated response (data?.data?.data) or legacy format
  // Dropdown API returns { data: { companies: [...] } }
  const companies =
    companiesData?.data?.companies ||
    companiesData?.data?.data ||
    companiesData?.data ||
    [];
  // Dropdown API returns { data: { projects: [...] } } format from controller
  // The service returns an array, controller wraps it in { projects: [...] }
  const projects = (
    projectsData?.data?.projects ||
    projectsData?.data?.data ||
    []
  ).filter(
    (p) =>
      p.clientId?.status !== "inactive" ||
      (isEdit && p._id === (task?.projectId?._id || task?.projectId)),
  );
  const allProjects = (
    allProjectsData?.data?.projects ||
    allProjectsData?.data?.data ||
    []
  ).filter(
    (p) =>
      p.clientId?.status !== "inactive" ||
      (isEdit && p._id === (task?.projectId?._id || task?.projectId)),
  );

  const ektaIntegration = useMemo(() => {
    return (
      integrationsData?.data?.integrations?.find((i) => i.type === "ekta") ||
      null
    );
  }, [integrationsData]);

  const staffConfig = ektaIntegration?.config?.staff || {};
  const attendanceConfig = ektaIntegration?.config?.attendance || {};
  const apiConnected = Boolean(ektaIntegration?.config?.api?.apiKey);
  const staffEnabled = Boolean(staffConfig?.enabled);
  const attendanceEnabled = Boolean(attendanceConfig?.enabled);
  const staffEndpoint = staffConfig?.endpoint || "";
  const attendanceEndpoint = attendanceConfig?.endpoint || "";

  const startDateValue = Form.useWatch("startDate", form);
  const attendanceCheckDate = startDateValue;
  // If user hasn't selected any date yet, default to today.
  // This matches the requirement: "Today, Parvez is on leave..."
  const attendanceDateKey = attendanceCheckDate
    ? dayjs(attendanceCheckDate).format("YYYY-MM-DD")
    : dayjs().format("YYYY-MM-DD");

  const [absentEmails, setAbsentEmails] = useState([]);

  // For SEO members creating/editing tasks: show only SEO users in Assigned To (so they can assign to other SEOs or interns)
  // Filter users by department for "Assigned To" field, excluding admins and managers
  const usersForAssignees = useMemo(() => {
    const excludedRoles = [
      "supreme_super_admin",
      "commander_admin",
      "agency_super_admin",
      "brand_super_admin",
      "agency_manager",
      "brand_manager",
      "admin",
      "super_admin"
    ];
    return (users || []).filter(u => !excludedRoles.includes(u.role));
  }, [users]);

  const absentEmailSet = useMemo(() => {
    return new Set(
      (absentEmails || [])
        .map((e) => (typeof e === "string" ? e.toLowerCase() : ""))
        .filter(Boolean),
    );
  }, [absentEmails]);

  const isAbsentUser = (u) => {
    const email = u?.email;
    if (!email) return false;
    return absentEmailSet.has(String(email).toLowerCase());
  };

  const usersForAssigneesSorted = useMemo(() => {
    const list = Array.isArray(usersForAssignees) ? [...usersForAssignees] : [];
    list.sort((a, b) => Number(isAbsentUser(a)) - Number(isAbsentUser(b)));
    return list;
  }, [usersForAssignees, absentEmailSet]);

  const allAvailableUsersSorted = useMemo(() => {
    const list = [...allAvailableUsers];
    list.sort((a, b) => Number(isAbsentUser(a)) - Number(isAbsentUser(b)));
    return list;
  }, [allAvailableUsers, absentEmailSet]);

  const staffEmployeeCode = (staff) =>
    staff?.employeeId?.employeeId ||
    staff?.employeeId ||
    staff?.employeeCode ||
    staff?._id ||
    "";

  const attendanceEmployeeCode = (record) => {
    const empId = record?.employeeId;
    if (!empId) return record?.employeeCode || "";
    if (typeof empId === "string") return empId;
    if (typeof empId === "object") return empId.employeeId || empId.code || "";
    return record?.employeeCode || "";
  };

  useEffect(() => {
    const run = async () => {
      // Only apply the logic if Ekta integration is configured
      if (
        !ektaIntegration ||
        !apiConnected ||
        !staffEnabled ||
        !staffEndpoint ||
        !attendanceEnabled ||
        !attendanceEndpoint
      ) {
        setAbsentEmails([]);
        return;
      }

      try {
        // Fetch staff (email mapping is needed to disable User Management users)
        const staffRes = await syncEktaStaff({
          id: ektaIntegration._id,
          endpoint: staffEndpoint,
        }).unwrap();

        const staffArr = Array.isArray(staffRes?.data?.staff)
          ? staffRes.data.staff
          : [];

        const codeToEmail = new Map(
          staffArr
            .map((s) => [String(staffEmployeeCode(s) || ""), s?.email])
            .filter(([code, email]) => code && email),
        );
        const staffCodes = Array.from(codeToEmail.keys());

        // Fetch attendance for exactly the selected assigned date
        const attendanceRes = await syncEktaAttendance({
          id: ektaIntegration._id,
          endpoint: attendanceEndpoint,
          fromDate: attendanceDateKey,
          toDate: attendanceDateKey,
        }).unwrap();

        const attendanceArr = Array.isArray(attendanceRes?.data?.attendance)
          ? attendanceRes.data.attendance
          : [];

        // Same rule as Attendance module grid: absent = no row for that date, or status is on leave
        // (everything else — e.g. Pending after check-in — counts as present).
        const dateKey = (value) => {
          if (!value) return null;
          const d = dayjs(value);
          return d.isValid() ? d.format("YYYY-MM-DD") : null;
        };

        const recordByCodeForDay = new Map();
        for (const rec of attendanceArr) {
          const code = String(attendanceEmployeeCode(rec) || "");
          if (!code) continue;
          if (dateKey(rec?.date) !== attendanceDateKey) continue;
          recordByCodeForDay.set(code, rec);
        }

        const todayKey = dayjs().format("YYYY-MM-DD");
        const isFutureDate = attendanceDateKey > todayKey;

        const absentEmailsComputed = staffCodes
          .filter((code) => {
            const rec = recordByCodeForDay.get(code);
            if (isFutureDate) {
              if (!rec) return false;
            } else {
              if (!rec) return true;
            }
            return !isPresentAttendanceStatus(rec?.status);
          })
          .map((code) => codeToEmail.get(code))
          .filter(Boolean);

        setAbsentEmails(Array.from(new Set(absentEmailsComputed)));
      } catch (error) {
        console.error("[TaskForm][attendance-disable]", error);
        setAbsentEmails([]);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    attendanceDateKey,
    ektaIntegration?._id,
    apiConnected,
    staffEnabled,
    staffEndpoint,
    attendanceEnabled,
    attendanceEndpoint,
  ]);

  // Get selected project details from API (for client autofill, etc.)
  const selectedProject = selectedProjectData?.data?.project;

  // Also get selected project counts directly from the already-loaded dropdown data
  // This avoids waiting for the separate getProjectById API call to complete
  const selectedProjectFromDropdown = allProjects.find(
    (p) => (p._id || p.id) === selectedProjectId,
  );
  // Merge: dropdown data has counts now, API data has full details (client, etc.)
  const selectedProjectWithCounts =
    selectedProject || selectedProjectFromDropdown;

  // Filter companies based on selected project
  const availableCompanies = (
    selectedProject?.clientId
      ? companies.filter((c) => {
          const clientId =
            selectedProject.clientId?._id || selectedProject.clientId;
          return (
            (c._id || c.id || "").toString() === (clientId || "").toString()
          );
        })
      : companies
  ).filter((c) => {
    const companyId = (c._id || c.id || "").toString();
    const taskCompanyId = (
      task?.companyId?._id ||
      task?.companyId ||
      ""
    ).toString();

    return c.status !== "inactive" || (isEdit && companyId === taskCompanyId);
  });

  // Ensure the task's current company is ALWAYS in the list if editing,
  // even if it's missing from the fetched companies dropdown (e.g. filtered out by department or status)
  const finalAvailableCompanies = [...availableCompanies];

  const addCompanyIfNeeded = (tCompany) => {
    if (!tCompany) return;
    const compId = (tCompany._id || tCompany).toString();
    if (!compId || compId === "[object Object]") return;
    const isAlreadyIncluded = finalAvailableCompanies.some(
      (c) => (c._id || c.id || "").toString() === compId,
    );
    if (!isAlreadyIncluded) {
      finalAvailableCompanies.push({
        _id: compId,
        name: tCompany.name || "Selected Client",
        status: tCompany.status || "active",
      });
    }
  };

  if (isEdit && task?.companyId) {
    addCompanyIfNeeded(task.companyId);
  }

  if (selectedProjectWithCounts?.clientId) {
    addCompanyIfNeeded(selectedProjectWithCounts.clientId);
  }

  // Fallback: populate clients from the loaded projects (useful if companies API returns 403)
  if (allProjects && allProjects.length > 0) {
    allProjects.forEach((p) => {
      if (p.clientId && p.clientId.name) {
        addCompanyIfNeeded(p.clientId);
      }
    });
  }
  // Debug: Log projects data to help diagnose
  React.useEffect(() => {
    if (projectsData && !isLoadingProjects) {
      console.log("[TaskForm] Projects dropdown response:", {
        rawData: projectsData,
        extractedProjects: projects,
        count: projects.length,
        firstProject: projects[0],
        isLoading: isLoadingProjects,
      });
    }
    if (!isLoadingProjects && projects.length === 0 && projectsData) {
      console.log("[TaskForm] No projects found for filter");
    }
  }, [projectsData, projects, isLoadingProjects]);

  const defaultPriorityLevels = [
    { label: "Low", value: "low" },
    { label: "Medium", value: "medium" },
    { label: "High", value: "high" },
  ];
  const fetchedPriorities = priorityLevelsData?.data?.priorityLevels || [];
  const priorityLevels = fetchedPriorities.length > 0 ? fetchedPriorities : defaultPriorityLevels;

  // Debug logging
  React.useEffect(() => {
    if (isUsersError) {
      console.error("Error fetching users:", isUsersError);
    }
  }, [
    isUsersError,
    usersData,
    users,
    projectsData,
    projects,
    isLoadingProjects,
  ]);

  useEffect(() => {
    if (isEdit && task) {
      // Set selected company ID for project filtering
      const taskCompanyId = task.companyId?._id || task.companyId;
      const taskProjectId = task.projectId?._id || task.projectId;
      if (taskCompanyId) {
        setSelectedCompanyId(taskCompanyId);
      }
      if (taskProjectId) {
        setSelectedProjectId(taskProjectId);
      }

      // Find the department _id that matches the slug from backend
      let departmentIdForForm = task.department;
      if (departments && departments.length > 0) {
        const matchingDept = departments.find(
          (d) => d.slug === task.department || d._id === task.department,
        );
        if (matchingDept) {
          departmentIdForForm = matchingDept._id;
        }
      }

      if (departmentIdForForm) {
        // Form.useWatch('department', form) handles selectedDepartment automatically
        // when we call setFieldsValue below.
      }

      form.setFieldsValue({
        title: task.title,
        description: task.description,
        holdReason: task.holdReason || "",
        department: departmentIdForForm,
        projectId: taskProjectId,
        companyId: taskCompanyId,
        assignedTo: task.assignedTo?._id || task.assignedTo,
        priority: task.priority || "medium",
        taskCategory: task.taskCategory || "New",
        status: task.status,
        startDate: task.startDate ? dayjs(task.startDate) : null,
        dueDate: task.dueDate ? dayjs(task.dueDate) : null,
        watchers: task.watchers?.map((w) => w._id || w) || [],
        serviceType: task.serviceType || null,
      });
    } else if (location.state?.initialStatus) {
      form.setFieldsValue({
        status: location.state.initialStatus,
      });
    }
  }, [isEdit, task, departments, location.state?.initialStatus]);

  useEffect(() => {
    if (isEdit) return;
    const isWebsiteOrWebApp =
      (websiteDeptId && selectedDepartment === websiteDeptId) ||
      (webAppDeptId && selectedDepartment === webAppDeptId) ||
      ["website-designing", "web-application-development"].includes(
        selectedDepartment,
      );
    setShouldApplyWebsiteDefaultCompany(isWebsiteOrWebApp);
  }, [isEdit, selectedDepartment, websiteDeptId, webAppDeptId]);

  useEffect(() => {
    if (isEdit || !shouldApplyWebsiteDefaultCompany) return;
    if (selectedProject?.clientId) return; // Project-first flow controls company
    if (
      !Array.isArray(finalAvailableCompanies) ||
      finalAvailableCompanies.length === 0
    ) {
      return;
    }

    const askevaCompany = finalAvailableCompanies.find(
      (company) =>
        String(company?.name || "")
          .trim()
          .toLowerCase() === "askeva",
    );

    if (askevaCompany?._id) {
      const askevaId = askevaCompany._id;
      form.setFieldsValue({ companyId: askevaId });
      setSelectedCompanyId(askevaId);
    }

    setShouldApplyWebsiteDefaultCompany(false);
  }, [
    isEdit,
    shouldApplyWebsiteDefaultCompany,
    selectedProject,
    finalAvailableCompanies,
    form,
  ]);

  // Set default watchers based on company contact when company changes
  useEffect(() => {
    if (!isEdit && allAvailableUsers.length > 0 && watchedCompanyId) {
      if (watchedCompanyId !== prevCompanyId) {
        const currentWatchers = form.getFieldValue("watchers") || [];

        // Find the admin/contact of the selected client company
        const clientAdmin = allAvailableUsers.find((u) => {
          const uClientId = u.clientId?._id || u.clientId;
          const uCompanyId = u.companyId?._id || u.companyId;
          return (
            // User linked to this client
            (u.clientId && String(uClientId) === String(watchedCompanyId)) ||
            // Or admin with this companyId (if company is a tenant)
            (u.role === "admin" &&
              String(uCompanyId) === String(watchedCompanyId))
          );
        });

        if (clientAdmin && !currentWatchers.includes(clientAdmin._id)) {
          form.setFieldsValue({
            watchers: [...currentWatchers, clientAdmin._id],
          });
        }
        setPrevCompanyId(watchedCompanyId);
      }
    }
  }, [
    isEdit,
    allAvailableUsers,
    watchedCompanyId,
    form,
    prevCompanyId,
    currentUser,
  ]);

  // Ensure fixed admins (Tenant Admins) are always present and "inbuilt"
  useEffect(() => {
    if (!isEdit && allAvailableUsers.length > 0 && currentUser) {
      const currentWatchers = form.getFieldValue("watchers") || [];
      const fixedWatchers = allAvailableUsers.filter(isFixedWatcher);
      const fixedIds = fixedWatchers.map((a) => a._id);

      // Special handling for Leka: she should be removed from default watchers if NOT in Projects department
      const lekaUser = allAvailableUsers.find(
        (u) => u.email?.toLowerCase() === "leka@tunepath.com",
      );
      const lekaId = lekaUser?._id;
      const shouldRemoveLeka =
        !isProjectsDepartment && lekaId && currentWatchers.includes(lekaId);

      if (fixedIds.length > 0 || shouldRemoveLeka) {
        const missingFixedIds = fixedIds.filter(
          (id) => !currentWatchers.includes(id),
        );

        if (missingFixedIds.length > 0 || shouldRemoveLeka) {
          let newWatchers = [...new Set([...fixedIds, ...currentWatchers])];
          if (shouldRemoveLeka) {
            newWatchers = newWatchers.filter((id) => id !== lekaId);
          }

          form.setFieldsValue({
            watchers: newWatchers,
          });
        }
      }
    }
  }, [allAvailableUsers, isEdit, form, currentUser, selectedDepartment, isProjectsDepartment]);

  // Set defaults for SEO users
  useEffect(() => {
    if (!isEdit && isSEOUser && seoDeptId) {
      form.setFieldsValue({
        department: seoDeptId,
        priority: "medium",
        taskCategory: "New",
      });
    }
  }, [isEdit, isSEOUser, seoDeptId, form]);

  // When project is selected, prefill client
  useEffect(() => {
    if (selectedProject?.clientId && !isEdit) {
      const clientId =
        selectedProject.clientId?._id || selectedProject.clientId;
      setSelectedCompanyId(clientId);
      form.setFieldsValue({ companyId: clientId });
    }
  }, [selectedProject, isEdit, form]);

  // Synchronize taskBlocks default watchers when allAvailableUsers or departments load
  useEffect(() => {
    if (isEdit || !allAvailableUsers || allAvailableUsers.length === 0) return;

    setTaskBlocks((prevBlocks) => {
      let changed = false;
      const newBlocks = prevBlocks.map((block) => {
        const fixedIds = getFixedWatcherIds(block.department);
        const lekaUser = allAvailableUsers.find(
          (u) => u.email?.toLowerCase() === "leka@tunepath.com"
        );
        const lekaId = lekaUser?._id;
        const isProj = isProjectsDeptCheck(block.department);

        let currentWatchers = block.watchers || [];
        const missingFixed = fixedIds.filter((id) => !currentWatchers.includes(id));
        const shouldRemoveLeka = !isProj && lekaId && currentWatchers.includes(lekaId);

        if (missingFixed.length > 0 || shouldRemoveLeka) {
          changed = true;
          let updatedWatchers = [...new Set([...currentWatchers, ...fixedIds])];
          if (shouldRemoveLeka) {
            updatedWatchers = updatedWatchers.filter((id) => id !== lekaId);
          }
          return { ...block, watchers: updatedWatchers };
        }
        return block;
      });

      return changed ? newBlocks : prevBlocks;
    });
  }, [allAvailableUsers, departments, isEdit]);

  const handleAddTaskBlock = () => {
    const nextId = Date.now();
    const defaultWatchers = getFixedWatcherIds(undefined);

    setTaskBlocks((prev) => [
      ...prev,
      {
        id: nextId,
        department: undefined,
        companyId: undefined,
        projectId: undefined,
        serviceType: undefined,
        assignedTo: undefined,
        title: "",
        startDate: dayjs(),
        dueDate: null,
        priority: "medium",
        taskCategory: "New",
        description: "",
        watchers: defaultWatchers,
      },
    ]);
  };

  const handleUpdateTaskBlock = (index, field, value) => {
    setTaskBlocks((prev) =>
      prev.map((block, idx) => {
        if (idx !== index) return block;
        const updated = { ...block, [field]: value };
        if (field === "projectId" && value) {
          const projObj = allProjects.find((p) => (p._id || p.id) === value);
          if (projObj?.clientId) {
            updated.companyId = projObj.clientId._id || projObj.clientId;
          }
        }
        if (field === "department") {
          const fixedIds = getFixedWatcherIds(value);
          const lekaUser = allAvailableUsers.find(
            (u) => u.email?.toLowerCase() === "leka@tunepath.com"
          );
          const lekaId = lekaUser?._id;
          const isProj = isProjectsDeptCheck(value);

          let currentWatchers = block.watchers || [];
          let newWatchers = [...new Set([...currentWatchers, ...fixedIds])];
          if (!isProj && lekaId) {
            newWatchers = newWatchers.filter((id) => id !== lekaId);
          }
          updated.watchers = newWatchers;
        }
        return updated;
      })
    );
  };

  const handleRemoveTaskBlock = (index) => {
    if (taskBlocks.length <= 1) return;
    setTaskBlocks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitAllTasks = async () => {
    for (let i = 0; i < taskBlocks.length; i++) {
      const b = taskBlocks[i];
      const num = i + 1;
      if (!b.department) {
        notifyError('save', 'validation', `Please select a Department for Task #${num}`);
        return;
      }
      if (!b.assignedTo) {
        notifyError('save', 'validation', `Please select Assigned To user for Task #${num}`);
        return;
      }
      if (!hideClientDropdown && !b.companyId && !b.projectId) {
        notifyError('save', 'validation', `Please select a Client or Project for Task #${num}`);
        return;
      }
      if (!b.title || !b.title.trim()) {
        notifyError('save', 'validation', `Please enter Task Title for Task #${num}`);
        return;
      }
      if (!b.startDate) {
        notifyError('save', 'validation', `Please select Start Date for Task #${num}`);
        return;
      }
      if (!b.dueDate) {
        notifyError('save', 'validation', `Please select Due Date for Task #${num}`);
        return;
      }
    }

    const bulkPayload = taskBlocks.map((b) => {
      const selectedDeptObj = departments.find(
        (d) => d._id === b.department || d.slug === b.department,
      );
      const departmentSlug = selectedDeptObj?.slug || b.department;

      return {
        title: b.title.trim(),
        description: b.description || "",
        department: departmentSlug,
        projectId: b.projectId || null,
        companyId: b.companyId,
        assignedTo: b.assignedTo,
        priority: b.priority || "medium",
        taskCategory: b.taskCategory || "New",
        startDate: b.startDate ? dayjs(b.startDate).startOf('day').toISOString() : null,
        dueDate: b.dueDate ? dayjs(b.dueDate).endOf('day').toISOString() : null,
        watchers: b.watchers || [],
        status: location.state?.initialStatus || "created",
        taskType: taskTarget,
        serviceType: b.serviceType || undefined,
      };
    });

    const keyId = 'create-bulk';
    notifyLoading('save', keyId, `Creating ${bulkPayload.length} task(s)...`);
    try {
      const res = await createBulkTasks({ tasks: bulkPayload }).unwrap();
      notifySuccess('save', keyId, `Successfully created ${res.successCount || bulkPayload.length} task(s)!`);
      navigate(`${getBaseRoute()}/tasks`);
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.data?.message || error?.message || "Operation failed";
      notifyError('save', keyId, errorMessage);
    }
  };

  const onFinish = async (values) => {
    try {
      const selectedDeptObj = departments.find(
        (d) => d._id === values.department || d.slug === values.department,
      );
      const departmentSlug = selectedDeptObj?.slug || values.department;

      const startDate = values.startDate;
      const dueDate = values.dueDate;

      const taskData = {
        title: values.title,
        description: values.description,
        department: departmentSlug,
        projectId: values.projectId || null,
        companyId: values.companyId,
        assignedTo: values.assignedTo,
        priority: values.priority || "medium",
        taskCategory: values.taskCategory || values.taskType || "New",
        startDate: startDate ? startDate.startOf('day').toISOString() : null,
        dueDate: dueDate ? dueDate.endOf('day').toISOString() : null,
        watchers: values.watchers || [],
        status: values.status || location.state?.initialStatus || "created",
        taskType: taskTarget,
      };
      if ((values.status || taskData.status) === "hold") {
        taskData.holdReason = values.holdReason || "";
      }

      if (values.serviceType) {
        taskData.serviceType = values.serviceType;
      }

      const isCompleted = ["review", "done", "completed", "validated"].includes(
        taskData.status,
      );
      const isAlreadyCompleted =
        isEdit &&
        ["review", "done", "completed", "validated"].includes(task?.status);
      const isNewlyCompleted = isCompleted && !isAlreadyCompleted;
      const isAssignedToMe =
        taskData.assignedTo === currentUser?._id ||
        taskData.assignedTo?._id === currentUser?._id;

      const keyId = isEdit ? id : 'create';
      notifyLoading('save', keyId, isEdit ? 'Updating task...' : 'Creating task...');
      if (isEdit) {
        await updateTask({ id, ...taskData }).unwrap();
        notifySuccess('save', keyId, 'Task updated successfully');
      } else {
        await createTask(taskData).unwrap();
        notifySuccess('save', keyId, 'Task created successfully');
      }

      if (isNewlyCompleted && isAssignedToMe) {
        navigate(`${getBaseRoute()}/tasks`, { state: { triggerCelebration: true } });
      } else {
        navigate(`${getBaseRoute()}/tasks`);
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.data?.message || error?.message || "Operation failed";
      notifyError('save', isEdit ? id : 'create', errorMessage);
    }
  };

  if (isEdit && isLoadingTask) {
    return (
      <Spin
        size="large"
        style={{ display: "flex", justifyContent: "center", marginTop: "50px" }}
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 24,
          gap: 16,
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`${getBaseRoute()}/tasks`)}>
          Back
        </Button>
        <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "12px" }}>
          {isEdit ? "Edit Task" : "Create Task"}
          <Tag color={taskTarget === 'own_brand' ? 'purple' : 'blue'} style={{ fontSize: '14px', padding: '2px 8px', borderRadius: '6px', margin: 0 }}>
            {taskTarget === 'own_brand' ? 'Own Brand' : 'Client'}
          </Tag>
        </h2>
      </div>

      {isEdit ? (
        <Card>
          {(selectedProjectData?.data?.project?.clientId?.status === "inactive" ||
            selectedProjectData?.data?.project?.clientId?.status === "closed") && (
            <Alert
              message={`The client for this project is ${selectedProjectData.data.project.clientId.status}.`}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
            initialValues={{
              priority: "medium",
              taskType: "New",
              taskCategory: "New",
              status: "created",
              startDate: dayjs(),
            }}
          >
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  label="Department"
                  name="department"
                  rules={[
                    { required: true, message: "Please select a department" },
                  ]}
                >
                  <Select
                    placeholder="Select department"
                    loading={isLoadingDepartments}
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) => {
                      const label = Array.isArray(option?.children)
                        ? option.children.join(" ")
                        : option?.children || "";
                      return String(label)
                        .toLowerCase()
                        .includes(input.toLowerCase());
                    }}
                  >
                    {departments.map((department) => (
                      <Option key={department._id} value={department._id}>
                        {department.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  label="Assigned To"
                  name="assignedTo"
                  rules={[
                    { required: true, message: "Please select an assigned user" },
                  ]}
                >
                  <Select
                    placeholder="Select user"
                    loading={isLoadingUsers}
                    showSearch
                    optionFilterProp="children"
                    onChange={(value) => {
                      const selectedUser = users.find((u) => u._id === value);
                      if (selectedUser && isAbsentUser(selectedUser)) {
                        notifyError(
                          "attendance",
                          "assignedTo",
                          `${selectedUser.name} is on leave today. Please select another team member.`
                        );
                      }
                    }}
                    filterOption={(input, option) => {
                      const label = Array.isArray(option?.children)
                        ? option.children.join(" ")
                        : option?.children || "";
                      return String(label)
                        .toLowerCase()
                        .includes(input.toLowerCase());
                    }}
                  >
                    {usersForAssigneesSorted && usersForAssigneesSorted.length > 0
                      ? usersForAssigneesSorted.map((user) => {
                          const disabled = isAbsentUser(user);
                          return (
                            <Option
                              key={user._id}
                              value={user._id}
                              disabled={disabled}
                            >
                              {user.name} ({user.email})
                              {user.type ? ` - ${user.type}` : ""}
                              {disabled ? " - Absent" : ""}
                            </Option>
                          );
                        })
                      : null}
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  label="Task Title"
                  name="title"
                  rules={[{ required: true, message: "Please enter task title" }]}
                >
                  <Input placeholder="Enter task title" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              {!hideClientDropdown && (
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Client"
                    name="companyId"
                    rules={[{ required: true, message: "Please select a client" }]}
                  >
                    <Select
                      placeholder="Select client"
                      loading={isLoadingCompanies}
                      showSearch
                      allowClear
                      disabled={!!selectedProject?.clientId}
                      filterOption={filterOptionByChildrenOrLabel}
                      onChange={(value) => {
                        setSelectedCompanyId(value);
                        if (!selectedProject?.clientId) {
                          form.setFieldsValue({ projectId: undefined });
                          setSelectedProjectId(null);
                        }
                      }}
                    >
                      {finalAvailableCompanies.map((company) => (
                        <Option key={company._id} value={company._id}>
                          {company.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              )}

              {!hideClientDropdown && (
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Project"
                    name="projectId"
                    rules={[{ required: true, message: "Please select a project" }]}
                  >
                    <Select
                      placeholder="Select project"
                      loading={selectedCompanyId ? isLoadingProjects : isLoadingAllProjects}
                      allowClear
                      showSearch
                      filterOption={filterOptionByChildrenOrLabel}
                      onChange={(value) => {
                        setSelectedProjectId(value);
                        if (!value) {
                          setSelectedCompanyId(null);
                          form.setFieldsValue({ companyId: undefined });
                        }
                      }}
                    >
                      {(() => {
                        let displayProjects = selectedCompanyId ? projects : allProjects;
                        if (taskTarget === 'own_brand') {
                          displayProjects = displayProjects?.filter(p => !p.clientId) || [];
                        }
                        return displayProjects && displayProjects.length > 0
                          ? displayProjects.map((project) => (
                              <Option key={project._id || project.id} value={project._id || project.id}>
                                {project.name || "Unnamed Project"} {project.clientId?.name && `(${project.clientId.name})`}
                              </Option>
                            ))
                          : null;
                      })()}
                    </Select>
                  </Form.Item>
                </Col>
              )}
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  label="Start Date"
                  name="startDate"
                  rules={[{ required: true, message: "Please select start date" }]}
                >
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  label="Due Date"
                  name="dueDate"
                  rules={[{ required: true, message: "Please select due date" }]}
                >
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item label="Priority" name="priority">
                  <Select>
                    {priorityLevels.map((level) => (
                      <Option key={level.value} value={level.value}>
                        {level.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Description" name="description">
              <TextArea rows={3} placeholder="Enter task description" />
            </Form.Item>

            <Form.Item style={{ marginTop: 24 }}>
              <Space>
                <Button type="primary" htmlType="submit" loading={isUpdating}>
                  Update Task
                </Button>
                <Button onClick={() => navigate(`${getBaseRoute()}/tasks`)}>Cancel</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      ) : (
        <div>
          {taskBlocks.map((block, index) => {
            const currentCompanyId = block.companyId;
            const currentProjectId = block.projectId;

            let availableProjects = currentCompanyId
              ? allProjects.filter(
                  (p) =>
                    (p.clientId?._id || p.clientId) === currentCompanyId ||
                    String(p.clientId) === String(currentCompanyId)
                )
              : allProjects;

            if (taskTarget === "own_brand") {
              availableProjects = availableProjects.filter((p) => !p.clientId);
            }

            const selectedProjObj = allProjects.find(
              (p) => (p._id || p.id) === currentProjectId
            );
            const selectedCategories = extractProjectCategoriesWithCounts(selectedProjObj);

            return (
              <Card
                key={block.id || index}
                title={
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: "bold", fontSize: "16px", color: "#1890ff" }}>
                      Task #{index + 1}
                    </span>
                    {taskBlocks.length > 1 && (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveTaskBlock(index)}
                      >
                        Remove Task #{index + 1}
                      </Button>
                    )}
                  </div>
                }
                style={{ marginBottom: 20, borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                        <span style={{ color: "#ff4d4f", marginRight: 4 }}>*</span>Department
                      </label>
                      <Select
                        placeholder="Select department"
                        value={block.department}
                        onChange={(val) => handleUpdateTaskBlock(index, "department", val)}
                        style={{ width: "100%" }}
                        showSearch
                        filterOption={filterOptionByChildrenOrLabel}
                      >
                        {departments.map((d) => (
                          <Option key={d._id} value={d._id}>
                            {d.name}
                          </Option>
                        ))}
                      </Select>
                    </div>
                  </Col>

                  <Col xs={24} md={8}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                        <span style={{ color: "#ff4d4f", marginRight: 4 }}>*</span>Assigned To
                      </label>
                      <Select
                        placeholder="Select user"
                        value={block.assignedTo}
                        onChange={(val) => handleUpdateTaskBlock(index, "assignedTo", val)}
                        style={{ width: "100%" }}
                        showSearch
                        filterOption={filterOptionByChildrenOrLabel}
                      >
                        {usersForAssigneesSorted.map((u) => (
                          <Option key={u._id} value={u._id} disabled={isAbsentUser(u)}>
                            {u.name} ({u.email}) {isAbsentUser(u) ? " - Absent" : ""}
                          </Option>
                        ))}
                      </Select>
                    </div>
                  </Col>

                  {!hideClientDropdown && (
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                          <span style={{ color: "#ff4d4f", marginRight: 4 }}>*</span>Client
                        </label>
                        <Select
                          placeholder="Select client"
                          value={block.companyId}
                          onChange={(val) => {
                            handleUpdateTaskBlock(index, "companyId", val);
                            handleUpdateTaskBlock(index, "projectId", undefined);
                          }}
                          style={{ width: "100%" }}
                          showSearch
                          allowClear
                          filterOption={filterOptionByChildrenOrLabel}
                        >
                          {finalAvailableCompanies.map((c) => (
                            <Option key={c._id} value={c._id}>
                              {c.name}
                            </Option>
                          ))}
                        </Select>
                      </div>
                    </Col>
                  )}

                  {!hideClientDropdown && (
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                          <span style={{ color: "#ff4d4f", marginRight: 4 }}>*</span>Project
                        </label>
                        <Select
                          placeholder="Select project"
                          value={block.projectId}
                          onChange={(val) => handleUpdateTaskBlock(index, "projectId", val)}
                          style={{ width: "100%" }}
                          showSearch
                          allowClear
                          filterOption={filterOptionByChildrenOrLabel}
                        >
                          {availableProjects.map((p) => (
                            <Option key={p._id || p.id} value={p._id || p.id}>
                              {p.name} {p.clientId?.name && `(${p.clientId.name})`}
                            </Option>
                          ))}
                        </Select>
                      </div>
                    </Col>
                  )}

                  {selectedCategories.length > 0 && (
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                          <span style={{ color: "#ff4d4f", marginRight: 4 }}>*</span>Project Category
                        </label>
                        <Select
                          placeholder="Select category"
                          value={block.serviceType}
                          onChange={(val) => handleUpdateTaskBlock(index, "serviceType", val)}
                          style={{ width: "100%" }}
                        >
                          {selectedCategories.map((cat, catIdx) => {
                            const countText = cat.remaining !== undefined && cat.remaining !== null
                              ? ` (Remaining: ${cat.remaining}${cat.total ? ` / ${cat.total}` : ""})`
                              : (cat.total !== undefined && cat.total !== null ? ` (Count: ${cat.total})` : "");
                            return (
                              <Option key={catIdx} value={cat.value}>
                                {cat.name}{countText}
                              </Option>
                            );
                          })}
                        </Select>
                      </div>
                    </Col>
                  )}

                  <Col xs={24} md={8}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                        <span style={{ color: "#ff4d4f", marginRight: 4 }}>*</span>Task Title
                      </label>
                      <Input
                        placeholder="Enter task title"
                        value={block.title}
                        onChange={(e) => handleUpdateTaskBlock(index, "title", e.target.value)}
                      />
                    </div>
                  </Col>

                  <Col xs={24} md={8}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                        <span style={{ color: "#ff4d4f", marginRight: 4 }}>*</span>Start Date
                      </label>
                      <DatePicker
                        value={block.startDate ? dayjs(block.startDate) : null}
                        onChange={(date) => handleUpdateTaskBlock(index, "startDate", date)}
                        style={{ width: "100%" }}
                      />
                    </div>
                  </Col>

                  <Col xs={24} md={8}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                        <span style={{ color: "#ff4d4f", marginRight: 4 }}>*</span>Due Date
                      </label>
                      <DatePicker
                        value={block.dueDate ? dayjs(block.dueDate) : null}
                        onChange={(date) => handleUpdateTaskBlock(index, "dueDate", date)}
                        style={{ width: "100%" }}
                      />
                    </div>
                  </Col>

                  <Col xs={24} md={8}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                        Priority
                      </label>
                      <Select
                        value={block.priority}
                        onChange={(val) => handleUpdateTaskBlock(index, "priority", val)}
                        style={{ width: "100%" }}
                      >
                        {priorityLevels.map((lvl) => (
                          <Option key={lvl.value} value={lvl.value}>
                            {lvl.label}
                          </Option>
                        ))}
                      </Select>
                    </div>
                  </Col>

                  <Col xs={24} md={8}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                        <span style={{ color: "#ff4d4f", marginRight: 4 }}>*</span>Task Category
                      </label>
                      <Select
                        value={block.taskCategory}
                        onChange={(val) => handleUpdateTaskBlock(index, "taskCategory", val)}
                        style={{ width: "100%" }}
                      >
                        <Option value="New">New</Option>
                        <Option value="Correction">Correction</Option>
                        <Option value="ReDesign">ReDesign</Option>
                      </Select>
                    </div>
                  </Col>

                  <Col xs={24} md={16}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                        Watchers
                      </label>
                      <Select
                        mode="multiple"
                        placeholder="Select watchers"
                        showSearch
                        filterOption={filterOptionByChildrenOrLabel}
                        value={block.watchers}
                        onChange={(vals) => handleUpdateTaskBlock(index, "watchers", vals)}
                        style={{ width: "100%" }}
                        options={allAvailableUsersSorted.map((u) => ({
                          value: u._id,
                          label: `${u.name} (${u.email})`,
                          disabled: isFixedWatcher(u, block.department) || isAbsentUser(u),
                        }))}
                      />
                    </div>
                  </Col>

                  <Col xs={24}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                        Description
                      </label>
                      <TextArea
                        rows={3}
                        placeholder="Enter task description"
                        value={block.description}
                        onChange={(e) => handleUpdateTaskBlock(index, "description", e.target.value)}
                      />
                    </div>
                  </Col>
                </Row>
              </Card>
            );
          })}

          <div style={{ marginBottom: 24 }}>
            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              onClick={handleAddTaskBlock}
              style={{ height: "45px", fontSize: "15px", fontWeight: "600", borderColor: "#1890ff", color: "#1890ff" }}
            >
              + Add Task
            </Button>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
            <Button
              type="primary"
              size="large"
              loading={isCreating || isCreatingBulk}
              onClick={handleSubmitAllTasks}
            >
              {taskBlocks.length > 1 ? `Create ${taskBlocks.length} Tasks` : "Create Task"}
            </Button>
            <Button size="large" onClick={() => navigate(`${getBaseRoute()}/tasks`)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskForm;
