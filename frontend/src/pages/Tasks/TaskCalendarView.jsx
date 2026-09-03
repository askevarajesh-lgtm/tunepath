import { useAuth } from "../../contexts/AuthContext";
import React, { useMemo, useState } from "react";
import {
    Calendar,
    Card,
    Select,
    Button,
    Spin,
    Modal,
    List,
    Tag,
    Typography,
    Space,
    DatePicker,
    Empty,
    Row,
    Col,
    Form,
    Input,
    message,
} from "antd";
import { notifyLoading, notifySuccess, notifyError } from '../../utils/notify';
import {
    BellOutlined,
    CalendarOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
    useGetTasksForKanbanQuery,
    useGetScheduledNotesQuery,
    useCreateScheduledNoteMutation,
} from "../../api/taskApi";
import { useGetProjectsDropdownQuery } from "../../api/projectApi";
import { useGetUsersDropdownQuery } from "../../api/userApi";
import { useTheme } from "../../contexts/ThemeContext";
import {
    taskMatchesKanbanDay,
    taskScheduledForKanbanDay,
    taskCompletedOnDay,
} from "./taskKanbanDateUtils";
import "./TaskCalendarView.css";

const { Option } = Select;
const { Text, Title } = Typography;
const { TextArea } = Input;

const flattenKanbanTasks = (tasksObj) => {
    if (!tasksObj) return [];
    if (Array.isArray(tasksObj)) return tasksObj;
    return Object.values(tasksObj).flat();
};

const dedupeTasks = (tasks) => {
    const map = new Map();
    tasks.forEach((task) => {
        if (task?._id) map.set(task._id, task);
    });
    return Array.from(map.values());
};

const getEntityId = (value) => (value?._id || value || "").toString();

const TaskCalendarView = ({ onTaskClick, departmentFilter }) => {
    const { isDark } = useTheme();
    const [calendarMonth, setCalendarMonth] = useState(() => dayjs());
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedCreator, setSelectedCreator] = useState(null);
    const [selectedPriority, setSelectedPriority] = useState(null);
    const [selectedTaskType, setSelectedTaskType] = useState(null);
    const [detailDay, setDetailDay] = useState(() => dayjs());
    const [isCreateNoteModalOpen, setIsCreateNoteModalOpen] = useState(false);
    const [selectedScheduledNote, setSelectedScheduledNote] = useState(null);
    const [isDayNotesModalOpen, setIsDayNotesModalOpen] = useState(false);
    const [noteForm] = Form.useForm();

    const { user: user } = useAuth();
    const selectedClientId = null;
    const userRole = user?.role;
    const isAdmin = true; // Default-Allow model
    const canUseClientScope = true; // Default-Allow model
    const canManageScheduledNotes = true; // Default-Allow model

    const monthAnchor = useMemo(
        () => calendarMonth.startOf("month").valueOf(),
        [calendarMonth.year(), calendarMonth.month()],
    );

    const kanbanQueryParams = useMemo(() => {
        const m = dayjs(monthAnchor);
        // Pad by one week so leading/trailing calendar cells (adjacent month) still resolve tasks.
        const rangeStart = m.startOf("month").subtract(7, "day").startOf("day");
        const rangeEnd = m.endOf("month").add(7, "day").endOf("day");
        return {
            projectId: selectedProject,
            assignedTo: selectedUser,
            createdBy: selectedCreator,
            priority: selectedPriority,
            department: departmentFilter !== "all" ? departmentFilter : undefined,
            startDate: rangeStart.toISOString(),
            endDate: rangeEnd.toISOString(),
            dateField: "dueDate",
            taskCategory: selectedTaskType,
            ...(canUseClientScope && selectedClientId
                ? { companyId: selectedClientId }
                : {}),
        };
    }, [
        monthAnchor,
        selectedProject,
        selectedUser,
        selectedCreator,
        selectedPriority,
        selectedTaskType,
        departmentFilter,
        canUseClientScope,
        selectedClientId,
    ]);

    const { data: kanbanData, isLoading } = useGetTasksForKanbanQuery(
        kanbanQueryParams,
        {
            refetchOnMountOrArgChange: true,
        },
    );
    const noteQueryParams = useMemo(
        () => ({
            startDate: calendarMonth.startOf("month").format("YYYY-MM-DD"),
            endDate: calendarMonth.endOf("month").format("YYYY-MM-DD"),
        }),
        [calendarMonth],
    );
    const { data: scheduledNotesData, isLoading: isScheduledNotesLoading } =
        useGetScheduledNotesQuery(noteQueryParams);
    const [createScheduledNote, { isLoading: isCreatingScheduledNote }] =
        useCreateScheduledNoteMutation();

    const [pendingModalOpen, setPendingModalOpen] = useState(false);
    const { data: pendingKanbanData, isLoading: isPendingLoading } =
        useGetTasksForKanbanQuery(
            { showPendingOnly: true },
            { skip: !pendingModalOpen },
        );

    const { data: projectsData } = useGetProjectsDropdownQuery();
    const { data: usersData } = useGetUsersDropdownQuery();

    const allProjects =
        projectsData?.data?.data || projectsData?.data?.projects || [];
    const users = (usersData?.data?.data || usersData?.data?.users || []).filter(u => u.role !== 'client');

    const flatTasks = useMemo(
        () => flattenKanbanTasks(kanbanData?.data?.tasks),
        [kanbanData],
    );

    // Client-side safeguard filter so calendar/list always honor UI filters,
    // even if any server-side filtering is missed for an edge case.
    const filteredTasks = useMemo(() => {
        return flatTasks.filter((task) => {
            if (
                departmentFilter &&
                departmentFilter !== "all" &&
                task.department !== departmentFilter
            ) {
                return false;
            }
            if (
                selectedProject &&
                getEntityId(task.projectId) !== selectedProject.toString()
            ) {
                return false;
            }
            if (selectedUser && selectedUser !== "unassigned") {
                if (getEntityId(task.assignedTo) !== selectedUser.toString())
                    return false;
            }
            if (selectedUser === "unassigned") {
                if (getEntityId(task.assignedTo)) return false;
            }
            if (
                selectedCreator &&
                getEntityId(task.createdBy) !== selectedCreator.toString()
            ) {
                return false;
            }
            if (selectedPriority && task.priority !== selectedPriority) return false;
            if (selectedTaskType && task.taskCategory !== selectedTaskType)
                return false;
            return true;
        });
    }, [
        flatTasks,
        departmentFilter,
        selectedProject,
        selectedUser,
        selectedCreator,
        selectedPriority,
        selectedTaskType,
    ]);
    const scheduledNotes = scheduledNotesData?.data?.notes || [];
    const scheduledNotesByDate = useMemo(() => {
        const grouped = {};
        scheduledNotes.forEach((note) => {
            const key = dayjs(note.scheduledDate).format("YYYY-MM-DD");
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(note);
        });
        return grouped;
    }, [scheduledNotes]);

    const projects = useMemo(() => {
        if (isAdmin) return allProjects;
        const projectIds = new Set(
            flatTasks
                .map((task) => task.projectId?._id || task.projectId)
                .filter(Boolean),
        );
        return allProjects.filter((project) => projectIds.has(project._id));
    }, [allProjects, flatTasks, isAdmin]);

    const scheduledCountsByDate = useMemo(() => {
        const map = {};
        const days = calendarMonth.daysInMonth();
        for (let i = 1; i <= days; i++) {
            const day = calendarMonth.date(i);
            const key = day.format("YYYY-MM-DD");
            map[key] = filteredTasks.filter((task) =>
                taskMatchesKanbanDay(task, day),
            ).length;
        }
        return map;
    }, [filteredTasks, calendarMonth]);

    const selectStyle = useMemo(
        () => ({
            backgroundColor: isDark ? "#141416" : "#ffffff",
            color: isDark ? "rgba(255,255,255,0.88)" : undefined,
        }),
        [isDark],
    );

    const scheduledForDetail = useMemo(() => {
        return filteredTasks.filter((task) =>
            taskMatchesKanbanDay(task, detailDay),
        );
    }, [filteredTasks, detailDay]);

    const completedForDetail = useMemo(() => {
        return filteredTasks.filter((task) => {
            const status = (task?.status || "").toLowerCase();
            const isCompletedStatus = ["completed", "complete", "validated", "done", "review"].includes(status);
            return isCompletedStatus && taskMatchesKanbanDay(task, detailDay);
        });
    }, [filteredTasks, detailDay]);

    const dayTasks = useMemo(() => {
        return dedupeTasks(
            filteredTasks.filter((task) => taskMatchesKanbanDay(task, detailDay)),
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [filteredTasks, detailDay]);
    const detailDayNotes = useMemo(() => {
        const key = detailDay.format("YYYY-MM-DD");
        return scheduledNotesByDate[key] || [];
    }, [detailDay, scheduledNotesByDate]);

    const pendingTasksFlat = useMemo(
        () => flattenKanbanTasks(pendingKanbanData?.data?.tasks),
        [pendingKanbanData],
    );

    const openTaskFromList = (task) => {
        onTaskClick?.(task);
        setPendingModalOpen(false);
    };

    const dateCellRender = (value, info) => {
        if (info?.type && info.type !== "date") return info.originNode;
        if (!value || !value.isSame(calendarMonth, "month"))
            return info?.originNode ?? null;
        const key = value.format("YYYY-MM-DD");
        const n = scheduledCountsByDate[key] || 0;
        const notesForDay = scheduledNotesByDate[key] || [];
        return (
            <div className="task-calendar-cell-inner">
                {n > 0 ? (
                    <span className="task-calendar-count-pill" aria-label={`${n} tasks`}>
                        {n}
                    </span>
                ) : null}
                {notesForDay.length > 0 ? (
                    <div
                        style={{
                            marginTop: 6,
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                        }}
                    >
                        {notesForDay.slice(0, 2).map((note) => (
                            <button
                                key={note._id}
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedScheduledNote(note);
                                }}
                                style={{
                                    border: "none",
                                    background: isDark ? "var(--accent-primary)" : "#eff6ff",
                                    color: isDark ? "#dbeafe" : "var(--accent-primary)",
                                    borderRadius: 999,
                                    padding: "2px 8px",
                                    fontSize: 11,
                                    lineHeight: 1.4,
                                    cursor: "pointer",
                                    textAlign: "left",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {note.notes}
                            </button>
                        ))}
                        {notesForDay.length > 2 ? (
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setDetailDay(value);
                                    setIsDayNotesModalOpen(true);
                                }}
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    color: isDark ? "#cbd5e1" : "#64748b",
                                    fontSize: 11,
                                    padding: 0,
                                    textAlign: "left",
                                    cursor: "pointer",
                                }}
                            >
                                +{notesForDay.length - 2} more
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </div>
        );
    };

    const getStatusColor = (status) => {
        const s = (status || "").toLowerCase();
        if (["completed", "validated", "done"].includes(s)) return "success";
        if (s === "in_progress") return "processing";
        if (s === "assigned") return "blue";
        if (s === "pending") return "warning";
        if (s === "review") return "purple";
        if (s === "rejected") return "error";
        return "default";
    };

    const renderTaskRow = (task) => {
        const title = task.title || "Untitled";
        const projectName = task.projectId?.name || "—";
        const assignee = task.assignedTo?.name || "Unassigned";
        const dueText = task.dueDate
            ? dayjs(task.dueDate).format("DD MMM YYYY")
            : "No due";
        const statusText = task.status ? task.status.replace(/_/g, " ") : "unknown";
        return (
            <List.Item
                key={task._id}
                className="task-calendar-task-item"
                style={{ cursor: "pointer" }}
                onClick={() => openTaskFromList(task)}
            >
                <List.Item.Meta
                    title={
                        <Space direction="vertical" size={6} style={{ width: "100%" }}>
                            <Space
                                wrap
                                size={6}
                                style={{ justifyContent: "space-between", width: "100%" }}
                            >
                                <Text strong className="task-card-title">
                                    {title}
                                </Text>
                                <Tag color={getStatusColor(task.status)}>{statusText}</Tag>
                            </Space>
                            <Space wrap size={6}>
                                <Tag className="task-chip">Project: {projectName}</Tag>
                                <Tag className="task-chip">Due: {dueText}</Tag>
                            </Space>
                            {task.priority ? (
                                <Tag color="gold">{String(task.priority).toUpperCase()}</Tag>
                            ) : null}
                        </Space>
                    }
                    description={
                        <Space direction="vertical" size={2} style={{ marginTop: 4 }}>
                            <Text type="secondary">Assigned to: {assignee}</Text>
                        </Space>
                    }
                />
            </List.Item>
        );
    };

    const handleCreateNote = async () => {
        try {
            const values = await noteForm.validateFields();
            await createScheduledNote({
                scheduledDate: values.scheduledDate.format("YYYY-MM-DD"),
                notes: values.notes,
            }).unwrap();
            notifySuccess('note', 'create', "Scheduled note created successfully");
            setIsCreateNoteModalOpen(false);
            setDetailDay(values.scheduledDate);
            noteForm.resetFields();
        } catch (error) {
            if (error?.errorFields) return;
            notifyError('note', 'create', error?.data?.message || error?.message || "Failed to create scheduled note");
        }
    };

    return (
        <div
            className={`task-calendar-view task-calendar-view--${isDark ? "dark" : "light"}`}
        >
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
                                        value={selectedProject}
                                        onChange={setSelectedProject}
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
                                        value={selectedUser}
                                        onChange={setSelectedUser}
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
                                        value={selectedCreator}
                                        onChange={setSelectedCreator}
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
                            value={selectedPriority}
                            onChange={setSelectedPriority}
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
                            value={selectedTaskType}
                            onChange={setSelectedTaskType}
                        >
                            <Option value="New">New</Option>
                            <Option value="Correction">Correction</Option>
                            <Option value="Redesign">Redesign</Option>
                        </Select>

                        <DatePicker
                            picker="month"
                            allowClear={false}
                            value={calendarMonth}
                            onChange={(d) => {
                                if (!d) return;
                                setCalendarMonth(d);
                                // Keep right panel in sync when browsing past/future months.
                                setDetailDay(d.startOf("month"));
                            }}
                            style={{ width: 160, height: 36 }}
                        />

                        <button
                            type="button"
                            onClick={() => {
                                setSelectedProject(null);
                                setSelectedUser(null);
                                setSelectedCreator(null);
                                setSelectedPriority(null);
                                setSelectedTaskType(null);
                                setCalendarMonth(dayjs());
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
                            }}
                        >
                            Reset Filters
                        </button>
                    </div>

                    {(userRole === "admin" ||
                        userRole === "super_admin" ||
                        userRole === "digital_marketing_manager" ||
                        userRole === "digital_marketing_coordinator" ||
                        userRole === "website_coordinator") && (
                            <Space>
                                <Button
                                    type="primary"
                                    icon={<BellOutlined />}
                                    onClick={() => setPendingModalOpen(true)}
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
                            </Space>
                        )}
                </div>
            </div>

            <Text
                type="secondary"
                style={{ display: "block", marginBottom: 14, fontSize: 13 }}
            >
                Numbers show tasks scheduled for that day (same rules as Kanban’s
                due-date filter). Click a date to see scheduled work and completions for
                that day.
            </Text>

            {canManageScheduledNotes && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginBottom: 12,
                    }}
                >
                    <Button
                        icon={<PlusOutlined />}
                        onClick={() => {
                            noteForm.setFieldsValue({ scheduledDate: detailDay });
                            setIsCreateNoteModalOpen(true);
                        }}
                        style={{
                            height: 36,
                            borderRadius: 9,
                            fontWeight: 600,
                            fontSize: 13,
                            paddingInline: 16,
                        }}
                    >
                        Add Scheduled Notes
                    </Button>
                </div>
            )}

            <Spin spinning={isLoading || isScheduledNotesLoading}>
                <Row gutter={[16, 16]} align="stretch">
                    <Col xs={24} lg={18}>
                        <Card
                            bordered
                            className="task-calendar-inner task-calendar-main-card"
                            styles={{
                                body: {
                                    padding: isDark ? 12 : 16,
                                    background: isDark ? "hsl(var(--background))" : "#fff",
                                },
                            }}
                        >
                            <Calendar
                                value={calendarMonth}
                                mode="month"
                                onSelect={(d) => {
                                    setDetailDay(d);
                                    setCalendarMonth(d);
                                }}
                                onPanelChange={(d) => {
                                    if (!d) return;
                                    setCalendarMonth(d);
                                    if (!detailDay.isSame(d, "month")) {
                                        setDetailDay(d.startOf("month"));
                                    }
                                }}
                                cellRender={dateCellRender}
                                fullscreen
                            />
                        </Card>
                    </Col>

                    <Col xs={24} lg={6}>
                        <Card
                            className="task-calendar-side-card"
                            styles={{
                                body: {
                                    padding: 14,
                                    background: isDark ? "#101012" : "#ffffff",
                                },
                            }}
                        >
                            <div className="task-calendar-side-header">
                                <div>
                                    <Text type="secondary" className="task-calendar-side-kicker">
                                        Selected date
                                    </Text>
                                    <Title level={5} style={{ margin: 0 }}>
                                        {detailDay.format("DD MMM YYYY")}
                                    </Title>
                                </div>
                                <CalendarOutlined />
                            </div>

                            <div className="task-calendar-side-stats">
                                <div className="task-side-stat-card">
                                    <span className="task-side-stat-icon">
                                        <ClockCircleOutlined />
                                    </span>
                                    <div className="task-side-stat-content">
                                        <Text type="secondary" className="task-side-stat-label">
                                            Total Tasks
                                        </Text>
                                        <Title level={4} className="task-side-stat-value">
                                            {dayTasks.length}
                                        </Title>
                                    </div>
                                </div>
                                <div className="task-side-stat-card">
                                    <span className="task-side-stat-icon">
                                        <CheckCircleOutlined />
                                    </span>
                                    <div className="task-side-stat-content">
                                        <Text type="secondary" className="task-side-stat-label">
                                            Completed Tasks
                                        </Text>
                                        <Title level={4} className="task-side-stat-value">
                                            {completedForDetail.length}
                                        </Title>
                                    </div>
                                </div>
                            </div>

                            <div className="task-side-list-section">
                                <Text strong>Scheduled Notes</Text>
                                {detailDayNotes.length === 0 ? (
                                    <Empty
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        description="No scheduled notes for selected date"
                                    />
                                ) : (
                                    <List
                                        style={{ marginBottom: 16 }}
                                        dataSource={detailDayNotes}
                                        renderItem={(note) => (
                                            <List.Item
                                                style={{ cursor: "pointer", paddingInline: 0 }}
                                                onClick={() => setSelectedScheduledNote(note)}
                                            >
                                                <Card size="small" style={{ width: "100%" }}>
                                                    <Text ellipsis>{note.notes}</Text>
                                                </Card>
                                            </List.Item>
                                        )}
                                    />
                                )}
                            </div>

                            <div className="task-side-list-section">
                                <Text strong>Tasks</Text>
                                <Text type="secondary" style={{ marginLeft: 6 }}>
                                    (Assigned, In Progress, Pending, Completed and more)
                                </Text>
                                {dayTasks.length === 0 ? (
                                    <Empty
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        description="No tasks for selected date"
                                    />
                                ) : (
                                    <List
                                        className="task-side-list"
                                        dataSource={dayTasks}
                                        renderItem={renderTaskRow}
                                    />
                                )}
                            </div>
                        </Card>
                    </Col>
                </Row>
            </Spin>

            <Modal
                title={
                    <div className="task-notes-modal-title-wrap">
                        <Text className="task-notes-modal-kicker">Plan ahead</Text>
                        <Title level={4} className="task-notes-modal-title">
                            Add Scheduled Notes
                        </Title>
                    </div>
                }
                open={isCreateNoteModalOpen}
                className={`task-notes-modal task-notes-modal--composer ${isDark ? "task-notes-modal--dark" : "task-notes-modal--light"
                    }`}
                onCancel={() => {
                    setIsCreateNoteModalOpen(false);
                    noteForm.resetFields();
                }}
                onOk={handleCreateNote}
                okText="Create Notes"
                confirmLoading={isCreatingScheduledNote}
                destroyOnClose
            >
                <Form form={noteForm} layout="vertical">
                    <Form.Item
                        name="scheduledDate"
                        label="Select Date"
                        rules={[{ required: true, message: "Please select a date" }]}
                    >
                        <DatePicker style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item
                        name="notes"
                        label="Notes"
                        rules={[{ required: true, message: "Please enter notes" }]}
                    >
                        <TextArea rows={4} placeholder="Enter scheduled notes" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={
                    <div className="task-notes-modal-title-wrap">
                        <Text className="task-notes-modal-kicker">Scheduled note</Text>
                        <Title level={4} className="task-notes-modal-title">
                            Scheduled Note
                        </Title>
                    </div>
                }
                open={Boolean(selectedScheduledNote)}
                className={`task-notes-modal ${isDark ? "task-notes-modal--dark" : "task-notes-modal--light"
                    }`}
                footer={null}
                onCancel={() => setSelectedScheduledNote(null)}
            >
                {selectedScheduledNote ? (
                    <Space direction="vertical" size={14} style={{ width: "100%" }}>
                        <Text className="task-notes-date-label">
                            {dayjs(selectedScheduledNote.scheduledDate).format("DD MMM YYYY")}
                        </Text>
                        <Card size="small" className="task-note-preview-card">
                            <Text className="task-note-preview-text">
                                {selectedScheduledNote.notes}
                            </Text>
                        </Card>
                        <Text className="task-note-preview-meta">
                            Created by {selectedScheduledNote.createdBy?.name || "N/A"}
                        </Text>
                    </Space>
                ) : null}
            </Modal>

            <Modal
                title={
                    <div className="task-notes-modal-title-wrap">
                        <Text className="task-notes-modal-kicker">
                            Daily note collection
                        </Text>
                        <Title level={4} className="task-notes-modal-title">
                            Scheduled Notes - {detailDay.format("DD MMM YYYY")}
                        </Title>
                    </div>
                }
                open={isDayNotesModalOpen}
                className={`task-notes-modal task-notes-modal--list ${isDark ? "task-notes-modal--dark" : "task-notes-modal--light"
                    }`}
                footer={null}
                onCancel={() => setIsDayNotesModalOpen(false)}
            >
                {detailDayNotes.length === 0 ? (
                    <Empty description="No scheduled notes for selected date" />
                ) : (
                    <List
                        dataSource={detailDayNotes}
                        renderItem={(note) => (
                            <List.Item
                                className="task-note-list-item"
                                onClick={() => {
                                    setSelectedScheduledNote(note);
                                    setIsDayNotesModalOpen(false);
                                }}
                            >
                                <Card size="small" className="task-note-list-card">
                                    <Space
                                        direction="vertical"
                                        size={6}
                                        style={{ width: "100%" }}
                                    >
                                        <Text className="task-note-list-text">{note.notes}</Text>
                                        <Text className="task-note-list-meta">
                                            Created by {note.createdBy?.name || "N/A"}
                                        </Text>
                                    </Space>
                                </Card>
                            </List.Item>
                        )}
                    />
                )}
            </Modal>

            <Modal
                title="Overdue pending tasks"
                open={pendingModalOpen}
                onCancel={() => setPendingModalOpen(false)}
                footer={null}
                width={640}
                destroyOnClose
            >
                <Spin spinning={isPendingLoading}>
                    {pendingTasksFlat.length === 0 ? (
                        <Empty description="No overdue pending tasks" />
                    ) : (
                        <List dataSource={pendingTasksFlat} renderItem={renderTaskRow} />
                    )}
                </Spin>
            </Modal>
        </div>
    );
};

export default TaskCalendarView;
