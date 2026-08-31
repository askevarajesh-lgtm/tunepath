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
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  useGetTaskByIdQuery,
  useCreateTaskMutation,
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

const TaskForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
    const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
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
  const inferredTaskTarget = isEdit
    ? (locationTaskTarget || (task_raw && !task_raw.companyId ? 'own_brand' : 'client'))
    : (locationTaskTarget || 'client');
  const taskTarget = inferredTaskTarget;
  const hideClientDropdown =
    userRole === 'commander_admin' ||
    userRole === 'brand_manager' ||
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

  const websiteDeptId = useMemo(() => {
    return departments.find((d) => d.slug === "website-designing")?._id;
  }, [departments]);

  const webAppDeptId = useMemo(() => {
    return departments.find((d) => d.slug === "web-application-development")
      ?._id;
  }, [departments]);

  const isFixedWatcher = (u) => {
    if (!u || !currentUser) return false;
    const currentUserCompanyId =
      currentUser?.companyId?._id || currentUser?.companyId;
    const uCompanyId = u.companyId?._id || u.companyId;

    // 1. Tenant Admin is always fixed
    const isTenantAdmin =
      u.role === "admin" && String(uCompanyId) === String(currentUserCompanyId);
    if (isTenantAdmin) return true;

    // 2. Lekashri is fixed for Website/Web App departments
    const isWebsiteDept =
      (websiteDeptId && selectedDepartment === websiteDeptId) ||
      (webAppDeptId && selectedDepartment === webAppDeptId) ||
      selectedDepartment === "website-designing" ||
      selectedDepartment === "web-application-development";
    if (isWebsiteDept && u.email?.toLowerCase() === "leka@tunepath.com")
      return true;

    return false;
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

      // Special handling for Leka: she should be removed if NOT in a website department
      const lekaUser = allAvailableUsers.find(
        (u) => u.email?.toLowerCase() === "leka@tunepath.com",
      );
      const lekaId = lekaUser?._id;
      const isWebsiteDept =
        selectedDepartment === "website-designing" ||
        selectedDepartment === "web-application-development";
      const shouldRemoveLeka =
        !isWebsiteDept && lekaId && currentWatchers.includes(lekaId);

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
  }, [allAvailableUsers, isEdit, form, currentUser, selectedDepartment]);

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

  const onFinish = async (values) => {
    try {
      // Resolve department ObjectId to slug (backend stores department as slug string)
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
      <Card>
        {(selectedProjectData?.data?.project?.clientId?.status === "inactive" ||
          selectedProjectData?.data?.project?.clientId?.status ===
            "closed") && (
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
                  notFoundContent={
                    isLoadingDepartments
                      ? "Loading..."
                      : isDepartmentsError
                        ? "Error loading departments"
                        : "No departments found"
                  }
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
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Assigned To"
                name="assignedTo"
                rules={[{ required: true, message: "Please select a user" }]}
              >
                <Select
                  placeholder="Select user"
                  loading={isLoadingUsers}
                  showSearch
                  notFoundContent={
                    isLoadingUsers
                      ? "Loading..."
                      : isUsersError
                        ? "Error loading users"
                        : "No users found"
                  }
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
                    tooltip={
                      selectedProject
                        ? "Client is pre-filled from selected project. You can change it if needed."
                        : "Select a client. Or select a project first to auto-fill the client."
                    }
                  >
                    <Select
                      placeholder={
                        selectedProject
                          ? "Client (pre-filled from project)"
                          : "Select client"
                      }
                  loading={isLoadingCompanies}
                  showSearch
                  allowClear
                  disabled={!!selectedProject?.clientId} // Disable if pre-filled from project
                  onChange={(value) => {
                    setSelectedCompanyId(value);
                    // Clear project selection when company changes (if not pre-filled from project)
                    if (!selectedProject?.clientId) {
                      form.setFieldsValue({ projectId: undefined });
                      setSelectedProjectId(null);
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
                  tooltip="Select a project first to automatically filter and prefill the client. Or select client first to filter projects."
                >
                <Select
                  placeholder="Select project (optional - will auto-fill client)"
                  loading={
                    selectedCompanyId ? isLoadingProjects : isLoadingAllProjects
                  }
                  allowClear
                  showSearch
                  onChange={(value) => {
                    setSelectedProjectId(value);
                    if (!value) {
                      // Clear client when project is cleared
                      setSelectedCompanyId(null);
                      form.setFieldsValue({ companyId: undefined });
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
                  notFoundContent={
                    (
                      selectedCompanyId
                        ? isLoadingProjects
                        : isLoadingAllProjects
                    )
                      ? "Loading projects..."
                      : (selectedCompanyId ? projects : allProjects).length ===
                          0
                        ? "No active projects available for the selected client."
                        : "No projects found"
                  }
                >
                  {(() => {
                    let displayProjects = selectedCompanyId
                      ? projects
                      : allProjects;
                    if (taskTarget === 'own_brand') {
                      displayProjects = displayProjects?.filter(p => !p.clientId) || [];
                    }
                    return displayProjects && displayProjects.length > 0
                      ? displayProjects.map((project) => {
                          const projectId = project._id || project.id;
                          const projectName = project.name || "Unnamed Project";
                          const clientName = project.clientId?.name || "";
                          return (
                            <Option key={projectId} value={projectId}>
                              {projectName} {clientName && `(${clientName})`}{" "}
                              {project.status &&
                                `- ${project.status.replace(/_/g, " ")}`}
                            </Option>
                          );
                        })
                      : null;
                  })()}
                </Select>
              </Form.Item>
            </Col>
            )}

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.projectId !== currentValues.projectId
              }
            >
              {({ getFieldValue }) => {
                const projectId = getFieldValue("projectId");
                const rawCategories =
                  selectedProjectWithCounts?.selectedCategories ||
                  selectedProjectWithCounts?.masterItemId?.selectedCategories ||
                  selectedProjectWithCounts?.masterItemIds?.[0]?.selectedCategories ||
                  [];
                const selectedCategories = rawCategories.map((cat, idx) => {
                  if (typeof cat === "string") {
                    return { name: cat, value: cat, remaining: 1 };
                  }
                  const name = cat.name || cat.categoryName || cat.label || `Item ${idx + 1}`;
                  return {
                    ...cat,
                    name,
                    value: cat.value || name,
                    remaining: cat.remaining !== undefined ? cat.remaining : (cat.quantity || 0),
                  };
                });
                const hasDynamicCategories = selectedCategories.length > 0;
                const hasLegacyDeliverables =
                  (selectedProjectWithCounts?.numberOfPosters || 0) > 0 ||
                  (selectedProjectWithCounts?.numberOfVideos || 0) > 0 ||
                  (selectedProjectWithCounts?.numberOfShoots || 0) > 0;

                if (projectId && (hasDynamicCategories || hasLegacyDeliverables)) {
                  return (
                    <Col xs={24} md={8}>
                      <Form.Item
                        label="Project Category"
                        name="serviceType"
                        rules={[
                          {
                            required: true,
                            message: "Please select a category",
                          },
                        ]}
                        tooltip="Available categories based on project deliverables."
                        >
                        <Select
                          placeholder="Select category"
                          showSearch
                          optionFilterProp="children"
                        >
                          {(() => {
                            const dynamicOptions = selectedCategories.map(
                              (opt, idx) => ({
                                label: opt.name,
                                value: opt.value,
                                remaining: Number(opt.remaining ?? opt.quantity ?? 0),
                                id: opt._id || `cat-${idx}`,
                              }),
                            );

                            if (dynamicOptions.length > 0) {
                              return dynamicOptions.map((opt, idx) => (
                                <Option
                                  key={opt.id || `opt-${idx}`}
                                  value={opt.value}
                                  disabled={opt.remaining <= 0 && opt.value !== task?.serviceType}
                                >
                                  {opt.label} {`(Remaining: ${opt.remaining})`}
                                </Option>
                              ));
                            }

                            const legacyOptions = [];
                            if ((selectedProjectWithCounts?.numberOfPosters || 0) > 0) {
                              legacyOptions.push({
                                label: "Poster",
                                value: "poster",
                                remaining:
                                  selectedProjectWithCounts?.remainingPosters || 0,
                              });
                            }
                            if ((selectedProjectWithCounts?.numberOfVideos || 0) > 0) {
                              legacyOptions.push({
                                label: "Video",
                                value: "video",
                                remaining:
                                  selectedProjectWithCounts?.remainingVideos || 0,
                              });
                            }
                            if ((selectedProjectWithCounts?.numberOfShoots || 0) > 0) {
                              legacyOptions.push({
                                label: "Shoot",
                                value: "shoot",
                                remaining:
                                  selectedProjectWithCounts?.remainingShoots || 0,
                              });
                            }

                            return legacyOptions.map((opt, idx) => (
                              <Option
                                key={opt.id || `opt-${idx}`}
                                value={opt.value}
                                disabled={opt.remaining <= 0}
                              >
                                {opt.label} {`(Remaining: ${opt.remaining})`}
                              </Option>
                            ));
                          })()}
                        </Select>
                      </Form.Item>
                    </Col>
                  );
                }
                return null;
              }}
            </Form.Item>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    alignItems: "center",
                  }}
                >
                  <label
                    style={{
                      fontSize: "14px",
                      color: "hsl(var(--foreground))",
                    }}
                  >
                    <span style={{ color: "#ff4d4f", marginRight: 4 }}>*</span>
                    Start Date
                  </label>
                </div>
                <Form.Item
                  name="startDate"
                  rules={[
                    { required: true, message: "Please select start date" },
                  ]}
                  style={{ marginBottom: 0 }}
                >
                  <DatePicker
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </div>

              <Form.Item
                label="Due Date"
                name="dueDate"
                rules={[{ required: true, message: "Please select due date" }]}
              >
                <DatePicker
                  style={{ width: "100%" }}
                  disabledDate={(current) => {
                    const startDate = form.getFieldValue("startDate");
                    return (
                      current && startDate && current < startDate.startOf("day")
                    );
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Priority" name="priority">
                <Select
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
                  {priorityLevels.map((level) => (
                    <Option key={level.value} value={level.value}>
                      {level.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Task Category"
                name="taskCategory"
                rules={[
                  { required: true, message: "Please select a category" },
                ]}
              >
                <Select placeholder="Select category">
                  {(() => {
                    if (
                      selectedDepartment === "digital-marketing" ||
                      selectedDepartment === "seo" ||
                      selectedDepartment === digitalMarketingDeptId ||
                      selectedDepartment === seoDeptId
                    ) {
                      return [
                        <Option key="New" value="New">
                          New
                        </Option>,
                        <Option key="Correction" value="Correction">
                          Correction
                        </Option>,
                        <Option key="ReDesign" value="ReDesign">
                          ReDesign
                        </Option>,
                      ];
                    }
                    const isWebsiteOrWebApp =
                      (websiteDeptId && selectedDepartment === websiteDeptId) ||
                      (webAppDeptId && selectedDepartment === webAppDeptId) ||
                      [
                        "website-designing",
                        "web-application-development",
                      ].includes(selectedDepartment);
                    if (isWebsiteOrWebApp) {
                      return [
                        <Option key="New" value="New">
                          New
                        </Option>,
                        <Option
                          key="Internal Correction"
                          value="Internal Correction"
                        >
                          Internal Correction
                        </Option>,
                        <Option
                          key="Client Correction"
                          value="Client Correction"
                        >
                          Client Correction
                        </Option>,
                        <Option key="Hosting" value="Hosting">
                          Hosting
                        </Option>,
                        <Option key="SEO Site Content Update" value="SEO Site Content Update">
                          SEO Site Content Update
                        </Option>,
                      ];
                    }
                    return [
                      <Option key="New" value="New">
                        New
                      </Option>,
                      <Option key="Correction" value="Correction">
                        Correction
                      </Option>,
                      <Option key="Redesign" value="Redesign">
                        Redesign
                      </Option>,
                    ];
                  })()}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Description" name="description">
            <TextArea rows={4} placeholder="Enter task description" />
          </Form.Item>

          <Form.Item
            label="Watchers"
            name="watchers"
            tooltip="Controls task visibility: only users listed here (and the assigned user) can see this task. Assigned users are added automatically."
          >
            <Select
              mode="multiple"
              placeholder="Select watchers (optional)"
              loading={isLoadingUsers}
              showSearch
              optionFilterProp="label"
              tagRender={tagRender}
              filterOption={(input, option) => {
                const label =
                  typeof option?.label === "string"
                    ? option.label
                    : String(option?.label || "");
                return label.toLowerCase().includes(input.toLowerCase());
              }}
              onChange={(values) => {
                // Prevent manual removal of fixed admins
                const fixedWatchers = allAvailableUsers.filter(isFixedWatcher);
                const fixedIds = fixedWatchers.map((a) => a._id);
                const currentValues = values || [];

                // Ensure all fixed IDs are present
                const finalValues = [
                  ...fixedIds,
                  ...currentValues.filter((id) => !fixedIds.includes(id)),
                ];
                form.setFieldsValue({ watchers: finalValues });
              }}
              options={allAvailableUsersSorted.map((u) => {
                const disabled = isAbsentUser(u);
                const isFixed = isFixedWatcher(u);
                return {
                  value: u._id,
                  label: `${u.name} (${u.email})${disabled ? " - Absent" : ""}`,
                  disabled: isFixed || disabled,
                };
              })}
            />
          </Form.Item>

          {isEdit && (
            <Form.Item label="Status" name="status">
              <Select>
                <Option value="backlog">Hold</Option>
                <Option value="to_do">To Do</Option>
                <Option value="in_progress">In Progress</Option>
                <Option value="hold">Hold</Option>
                <Option value="review">Review</Option>
                <Option value="Rejected">Rejected</Option>
                <Option
                  value="done"
                  disabled={
                    selectedDepartment === "digital-marketing" &&
                    task?.status === "to_do"
                  }
                >
                  Done
                </Option>
                <Option value="created">Created</Option>
                <Option value="assigned">Assigned</Option>
                <Option value="submitted">Submitted</Option>
                <Option
                  value="validated"
                  disabled={
                    selectedDepartment === "digital-marketing" &&
                    task?.status === "to_do"
                  }
                >
                  Validated
                </Option>
                <Option value="rejected">Rejected</Option>
                <Option
                  value="completed"
                  disabled={
                    selectedDepartment === "digital-marketing" &&
                    task?.status === "to_do"
                  }
                >
                  Completed
                </Option>
              </Select>
            </Form.Item>
          )}

          {isEdit && (
            <Form.Item
              noStyle
              shouldUpdate={(prev, curr) => prev.status !== curr.status}
            >
              {({ getFieldValue }) =>
                getFieldValue("status") === "hold" ? (
                  <Form.Item
                    label="Hold Reason"
                    name="holdReason"
                    rules={[
                      {
                        required: true,
                        message: "Please enter the hold reason",
                      },
                    ]}
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder="Enter reason for putting this task on hold"
                    />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          )}

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={isCreating || isUpdating}
              >
                {isEdit ? "Update Task" : "Create Task"}
              </Button>
              <Button onClick={() => navigate(`${getBaseRoute()}/tasks`)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default TaskForm;
