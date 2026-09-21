import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Row, Col, Spin, Button, Modal, Tabs, Input, message, DatePicker, Avatar, Progress, List, Tag, Space } from 'antd';
import { motion } from 'framer-motion';
import { 
    CheckSquare, Clock, AlertCircle, FileText, ChevronLeft, ChevronRight, 
    User, Activity, Edit2, RefreshCw, ExternalLink, Calendar, Sparkles, 
    CheckCircle2, ArrowRight, Zap, Award, Flame
} from 'lucide-react';
import { useGetTasksQuery } from '../../api/taskApi';
import { useGetTodayNoteQuery, useCreateOrUpdateTodayNoteMutation } from '../../api/notepadApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { taskMatchesKanbanDay } from '../Tasks/taskKanbanDateUtils';
import './DashboardTab.css';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;

const isCompleted = (status) => ["review", "completed", "validated", "approved"].includes(status?.toLowerCase());
const isInProgress = (status) => ["in_progress", "submitted"].includes(status?.toLowerCase());
const isPending = (status) => ["created", "assigned", "backlog", "to_do"].includes(status?.toLowerCase());

const CORRECTION_CATEGORIES = ["Correction", "Internal Correction", "Client Correction", "Hosting"];
const REDESIGN_CATEGORIES = ["Redesign"];

const isCorrectionTask = (task) => CORRECTION_CATEGORIES.includes(task?.taskCategory);
const isRedesignTask = (task) => REDESIGN_CATEGORIES.includes(task?.taskCategory);

const UserDashboard = () => {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
    };

    const itemVariants = {
        hidden: { y: 16, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 350, damping: 26 } }
    };

    const navigate = useNavigate();
    const { user, setUser } = useAuth();
    const isUserRole = user?.role === 'user';

    const { data: tasksData, isLoading } = useGetTasksQuery({ limit: 1000 });
    const allTasks = tasksData?.data?.data || tasksData?.data?.tasks || [];

    const tasks = useMemo(() => {
        if (!user?._id) return [];
        const userIdStr = String(user._id);
        return allTasks.filter(t => {
            const assignedIdStr = String(t.assignedTo?._id || t.assignedTo || "");
            const creatorIdStr = String(t.createdBy?._id || t.createdBy || "");
            return assignedIdStr === userIdStr || creatorIdStr === userIdStr || (!assignedIdStr && !creatorIdStr);
        });
    }, [allTasks, user]);

    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedDate]);

    // Selected Date Tasks (or All Tasks if selectedDate is cleared/null)
    const tasksForSelectedDate = useMemo(() => {
        if (!selectedDate) return tasks;
        return tasks.filter(t => taskMatchesKanbanDay(t, selectedDate));
    }, [tasks, selectedDate]);

    // Metrics for Top Cards (for selected date or all tasks if cleared)
    const myTasksCount = tasksForSelectedDate.length;
    const inProgressCount = tasksForSelectedDate.filter(t => isInProgress(t.status)).length;
    const completedCount = tasksForSelectedDate.filter(t => isCompleted(t.status)).length;
    const overdueCount = tasksForSelectedDate.filter(t => {
        if (!t.dueDate) return false;
        return dayjs(t.dueDate).isBefore(dayjs(), 'day') && !isCompleted(t.status);
    }).length;

    // Performance Score Card Metrics (For Selected Date or All Tasks if cleared)
    const perfMetrics = useMemo(() => {
        const targetTasks = tasksForSelectedDate;
        const assigned = targetTasks.length;
        const done = targetTasks.filter(t => isCompleted(t.status)).length;
        const inProg = targetTasks.filter(t => isInProgress(t.status)).length;
        const pending = targetTasks.filter(t => isPending(t.status)).length;
        const correction = targetTasks.filter(t => isCorrectionTask(t)).length;
        const redesign = targetTasks.filter(t => isRedesignTask(t)).length;

        let efficiency = 0;
        if (assigned > 0) {
            efficiency = Math.round((done / assigned) * 100);
        }

        return { assigned, done, inProg, pending, correction, redesign, efficiency };
    }, [tasksForSelectedDate]);

    // Daily Reports State
    const [isReportModalVisible, setIsReportModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState("note");
    const [noteContent, setNoteContent] = useState("");
    const [googleSheetUrl, setGoogleSheetUrl] = useState(user?.googleSheetUrl || "");
    const [isSavingUrl, setIsSavingUrl] = useState(false);

    const { data: noteData, isLoading: isNoteLoading, refetch: refetchNote } = useGetTodayNoteQuery();
    const [createOrUpdateNote, { isLoading: isSavingNote }] = useCreateOrUpdateTodayNoteMutation();

    useEffect(() => {
        if (isReportModalVisible && noteData?.data?.note?.content) {
            setNoteContent(noteData.data.note.content);
        }
    }, [isReportModalVisible, noteData]);

    const handleSaveNote = async () => {
        const { error } = await createOrUpdateNote({ content: noteContent });
        if (error) {
            message.error(error.message || "Failed to save note");
        } else {
            message.success("Daily report saved successfully!");
            setIsReportModalVisible(false);
            refetchNote();
        }
    };

    const handleSaveUrl = async () => {
        setIsSavingUrl(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/users/${user._id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token ? `Bearer ${token}` : ""
                },
                body: JSON.stringify({ googleSheetUrl })
            });
            const data = await res.json();
            if (data.success) {
                message.success("Google Sheet link saved successfully!");
                if (data.data && data.data.googleSheetUrl !== undefined) {
                    const updatedUser = { ...user, googleSheetUrl: data.data.googleSheetUrl };
                    setUser(updatedUser);
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                }
            } else {
                message.error(data.message || "Failed to save Google Sheet link");
            }
        } catch (error) {
            console.error(error);
            message.error("An error occurred while saving the Google Sheet link");
        } finally {
            setIsSavingUrl(false);
        }
    };

    const getStatusStyle = (status) => {
        const s = status?.toLowerCase() || '';
        if (isCompleted(s)) {
            return {
                bg: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                border: 'rgba(16, 185, 129, 0.25)',
                dot: '#10b981'
            };
        }
        if (isInProgress(s)) {
            return {
                bg: 'rgba(245, 158, 11, 0.12)',
                color: '#f59e0b',
                border: 'rgba(245, 158, 11, 0.25)',
                dot: '#f59e0b'
            };
        }
        if (isPending(s)) {
            return {
                bg: 'rgba(99, 102, 241, 0.12)',
                color: '#6366f1',
                border: 'rgba(99, 102, 241, 0.25)',
                dot: '#6366f1'
            };
        }
        return {
            bg: 'rgba(100, 116, 139, 0.12)',
            color: '#64748b',
            border: 'rgba(100, 116, 139, 0.25)',
            dot: '#64748b'
        };
    };

    const getPerformanceStatus = (efficiency, total) => {
        if (total === 0) {
            return { 
                status: 'AVERAGE', 
                icon: <Activity size={12} />,
                tagBg: 'rgba(245, 158, 11, 0.12)',
                tagColor: '#d97706',
                tagBorder: 'rgba(245, 158, 11, 0.25)',
                topBarGradient: 'linear-gradient(90deg, #f59e0b, #ea580c)',
                progressStroke: '#f59e0b',
                quote: "Every expert started here - keep climbing!"
            };
        }
        if (efficiency >= 100) {
            return { 
                status: 'ELITE', 
                icon: <Zap size={12} />,
                tagBg: 'rgba(16, 185, 129, 0.12)',
                tagColor: '#059669',
                tagBorder: 'rgba(16, 185, 129, 0.25)',
                topBarGradient: 'linear-gradient(90deg, #10b981, #059669)',
                progressStroke: '#10b981',
                quote: "Flawless execution! You are setting the gold standard."
            };
        }
        if (efficiency >= 80) {
            return { 
                status: 'STRONG', 
                icon: <Award size={12} />,
                tagBg: 'rgba(59, 130, 246, 0.12)',
                tagColor: '#2563eb',
                tagBorder: 'rgba(59, 130, 246, 0.25)',
                topBarGradient: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                progressStroke: '#3b82f6',
                quote: "High momentum! Consistently crushing deliverables."
            };
        }
        if (efficiency >= 50) {
            return { 
                status: 'AVERAGE', 
                icon: <Activity size={12} />,
                tagBg: 'rgba(245, 158, 11, 0.12)',
                tagColor: '#d97706',
                tagBorder: 'rgba(245, 158, 11, 0.25)',
                topBarGradient: 'linear-gradient(90deg, #f59e0b, #ea580c)',
                progressStroke: '#f59e0b',
                quote: "Solid progress. Push a little further to hit elite status!"
            };
        }
        return { 
            status: 'NEEDS WORK', 
            icon: <Flame size={12} />,
            tagBg: 'rgba(239, 68, 68, 0.12)',
            tagColor: '#dc2626',
            tagBorder: 'rgba(239, 68, 68, 0.25)',
            topBarGradient: 'linear-gradient(90deg, #ef4444, #b91c1c)',
            progressStroke: '#ef4444',
            quote: "Focus on closing pending tasks to elevate your score."
        };
    };

    const perfDisplay = getPerformanceStatus(perfMetrics.efficiency, perfMetrics.assigned);

    const kpiCards = [
        {
            label: 'My Tasks',
            value: myTasksCount,
            sub: selectedDate ? `Scheduled on ${selectedDate.format('DD MMM')}` : 'All active tasks',
            icon: <CheckSquare size={20} color="#ffffff" />,
            iconBg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            glow: '#3b82f6',
            borderColor: 'rgba(59, 130, 246, 0.2)'
        },
        {
            label: 'In Progress',
            value: inProgressCount,
            sub: 'Currently active',
            icon: <Activity size={20} color="#ffffff" />,
            iconBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            glow: '#f59e0b',
            borderColor: 'rgba(245, 158, 11, 0.2)'
        },
        {
            label: 'Completed',
            value: completedCount,
            sub: 'Delivered & verified',
            icon: <CheckCircle2 size={20} color="#ffffff" />,
            iconBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            glow: '#10b981',
            borderColor: 'rgba(16, 185, 129, 0.2)'
        },
        {
            label: 'Overdue',
            value: overdueCount,
            sub: overdueCount > 0 ? 'Action required' : 'Zero backlog',
            icon: <AlertCircle size={20} color="#ffffff" />,
            iconBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            glow: '#ef4444',
            borderColor: overdueCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.15)',
            isAlert: overdueCount > 0
        }
    ];

    return (
        <motion.div 
            className="user-dashboard-wrapper"
            variants={containerVariants} 
            initial="hidden" 
            animate="visible"
        >
            {/* TOP HEADER & NAVIGATION BAR */}
            <motion.div variants={itemVariants} className="ud-header">
                <div className="ud-title-group">
                    <div className="ud-badge-pill">
                        <span className="ud-badge-dot"></span>
                        <span>Personal Workspace</span>
                    </div>
                    <Title level={2} className="ud-title">
                        {user?.roleName ? `${user.roleName} Dashboard` : 'Developer Dashboard'}
                    </Title>
                </div>

                <div className="ud-controls">
                    {/* Date Navigation Widget */}
                    <div className="ud-date-nav">
                        <button 
                            type="button"
                            className="ud-nav-btn"
                            title="Previous Day"
                            onClick={() => setSelectedDate(prev => prev ? prev.subtract(1, 'day') : dayjs().subtract(1, 'day'))}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        
                        <DatePicker
                            value={selectedDate}
                            onChange={(date) => setSelectedDate(date)}
                            format="DD MMM YYYY"
                            allowClear={true}
                            placeholder="All Dates"
                            bordered={false}
                            style={{ width: 125, fontWeight: 600, textAlign: 'center', cursor: 'pointer' }}
                        />

                        <button 
                            type="button"
                            className="ud-nav-btn"
                            title="Next Day"
                            onClick={() => setSelectedDate(prev => prev ? prev.add(1, 'day') : dayjs().add(1, 'day'))}
                        >
                            <ChevronRight size={16} />
                        </button>

                        {(!selectedDate || !selectedDate.isSame(dayjs(), 'day')) && (
                            <button
                                type="button"
                                className="ud-today-btn"
                                onClick={() => setSelectedDate(dayjs())}
                            >
                                Today
                            </button>
                        )}
                    </div>

                    {/* Reports Action */}
                    {isUserRole && (
                        <button
                            type="button"
                            className="ud-reports-btn"
                            onClick={() => setIsReportModalVisible(true)}
                        >
                            <FileText size={16} />
                            <span>Reports</span>
                        </button>
                    )}
                </div>
            </motion.div>

            {/* TOP 4 KPI CARDS */}
            <Row gutter={[18, 18]} style={{ marginBottom: 26 }}>
                {kpiCards.map((kpi, idx) => (
                    <Col xs={12} sm={12} lg={6} key={idx}>
                        <motion.div variants={itemVariants} style={{ height: '100%' }}>
                            <div 
                                className="ud-kpi-card"
                                style={{ borderColor: kpi.borderColor }}
                            >
                                <div 
                                    className="ud-kpi-glow" 
                                    style={{ background: kpi.glow }}
                                />
                                
                                <div>
                                    <div className="ud-kpi-header">
                                        <span className="ud-kpi-label">{kpi.label}</span>
                                        <div 
                                            className="ud-kpi-icon-box"
                                            style={{ background: kpi.iconBg }}
                                        >
                                            {kpi.icon}
                                        </div>
                                    </div>
                                    
                                    <Title 
                                        level={2} 
                                        className="ud-kpi-value"
                                        style={kpi.isAlert ? { color: '#ef4444' } : undefined}
                                    >
                                        {isLoading ? <Spin size="small" /> : kpi.value}
                                    </Title>
                                </div>

                                <div className="ud-kpi-footer">
                                    <span style={{ 
                                        width: 6, 
                                        height: 6, 
                                        borderRadius: '50%', 
                                        backgroundColor: kpi.glow,
                                        display: 'inline-block' 
                                    }} />
                                    <span>{kpi.sub}</span>
                                </div>
                            </div>
                        </motion.div>
                    </Col>
                ))}
            </Row>

            {/* MAIN 2-COLUMN SECTION: TASKS ON DATE + PERFORMANCE SCORECARD */}
            <Row gutter={[24, 24]}>

                {/* LEFT COLUMN: TASKS FOR SELECTED DATE */}
                <Col xs={24} lg={14}>
                    <motion.div variants={itemVariants} style={{ height: '100%' }}>
                        <div className="ud-panel-card">
                            <div className="ud-panel-header">
                                <div className="ud-panel-title-wrapper">
                                    <Title level={4} className="ud-panel-title">
                                        {selectedDate ? `Tasks on ${selectedDate.format('DD MMM YYYY')}` : 'All Assigned Tasks'}
                                    </Title>
                                    <span className="ud-count-badge">
                                        {tasksForSelectedDate.length} {tasksForSelectedDate.length === 1 ? 'task' : 'tasks'}
                                    </span>
                                </div>

                                <button 
                                    type="button" 
                                    className="ud-view-all-btn"
                                    onClick={() => navigate('/user/tasks')}
                                >
                                    <span>View All Tasks</span>
                                    <ArrowRight size={14} />
                                </button>
                            </div>

                            <div className="ud-panel-body">
                                {isLoading ? (
                                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                                        <Spin size="large" />
                                    </div>
                                ) : tasksForSelectedDate.length === 0 ? (
                                    <div className="ud-empty-state">
                                        <div className="ud-empty-icon-wrap">
                                            <Calendar size={32} />
                                        </div>
                                        <div className="ud-empty-title">
                                            {selectedDate ? `No tasks found for ${selectedDate.format('DD MMM YYYY')}` : 'No tasks assigned'}
                                        </div>
                                        <div className="ud-empty-sub">
                                            Everything looks clean for this schedule. Switch dates to inspect other days or view your full task board.
                                        </div>
                                    </div>
                                ) : (
                                    <List
                                        pagination={{
                                            current: currentPage,
                                            pageSize: pageSize,
                                            onChange: (page, size) => {
                                                setCurrentPage(page);
                                                setPageSize(size);
                                            },
                                            pageSizeOptions: ['5', '10', '15', '20'],
                                            showSizeChanger: true,
                                            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} tasks`,
                                            size: 'small',
                                            style: { marginTop: 'auto', paddingTop: 16, textAlign: 'right' }
                                        }}
                                        dataSource={tasksForSelectedDate}
                                        renderItem={item => {
                                            const statusStyle = getStatusStyle(item.status);
                                            return (
                                                <div
                                                    key={item._id || item.id}
                                                    className="ud-task-item"
                                                    onClick={() => navigate('/user/tasks')}
                                                >
                                                    <div className="ud-task-top">
                                                        <span className="ud-task-title">{item.title}</span>
                                                        <div 
                                                            className="ud-status-pill"
                                                            style={{
                                                                background: statusStyle.bg,
                                                                color: statusStyle.color,
                                                                border: `1px solid ${statusStyle.border}`
                                                            }}
                                                        >
                                                            <span style={{ 
                                                                width: 6, 
                                                                height: 6, 
                                                                borderRadius: '50%', 
                                                                background: statusStyle.dot 
                                                            }} />
                                                            {item.status?.replace(/_/g, ' ') || 'UNKNOWN'}
                                                        </div>
                                                    </div>

                                                    <div className="ud-task-meta">
                                                        {item.dueDate && (
                                                            <span className="ud-due-date">
                                                                <Clock size={13} />
                                                                Due: {dayjs(item.dueDate).format('DD MMM, h:mm A')}
                                                            </span>
                                                        )}
                                                        {item.taskCategory && (
                                                            <Tag style={{ 
                                                                borderRadius: 6, 
                                                                fontSize: 11, 
                                                                margin: 0,
                                                                border: '1px solid var(--border-color)',
                                                                background: 'var(--bg-secondary)',
                                                                color: 'var(--text-secondary)'
                                                            }}>
                                                                {item.taskCategory}
                                                            </Tag>
                                                        )}
                                                        {item.priority && (
                                                            <Tag 
                                                                color={item.priority === 'urgent' || item.priority === 'high' ? 'error' : item.priority === 'medium' ? 'warning' : 'default'}
                                                                style={{ borderRadius: 6, fontSize: 11, margin: 0 }}
                                                            >
                                                                {item.priority?.toUpperCase()}
                                                            </Tag>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </motion.div>
                </Col>

                {/* RIGHT COLUMN: ELEGANT & CLEAN PERFORMANCE SCORECARD */}
                <Col xs={24} lg={10}>
                    <motion.div variants={itemVariants} style={{ height: '100%' }}>
                        <div className="ud-perf-card">
                            {/* Decorative top tier bar */}
                            <div 
                                className="ud-perf-top-bar"
                                style={{ background: perfDisplay.topBarGradient }}
                            />

                            {/* Header: User details + Efficiency Gauge */}
                            <div className="ud-perf-header">
                                <div className="ud-perf-user-info">
                                    <div className="ud-perf-avatar-wrap">
                                        <Avatar 
                                            size={52} 
                                            className="ud-perf-avatar"
                                        >
                                            {user?.firstName?.charAt(0) || 'U'}
                                        </Avatar>
                                    </div>
                                    <div>
                                        <div 
                                            className="ud-perf-status-tag"
                                            style={{
                                                background: perfDisplay.tagBg,
                                                color: perfDisplay.tagColor,
                                                border: `1px solid ${perfDisplay.tagBorder}`
                                            }}
                                        >
                                            {perfDisplay.icon}
                                            <span>{perfDisplay.status}</span>
                                        </div>
                                        <Title level={4} className="ud-perf-name">
                                            {user?.firstName} {user?.lastName}
                                        </Title>
                                        <div className="ud-perf-role">
                                            {user?.roleName || user?.role?.replace(/_/g, ' ') || 'USER'}
                                        </div>
                                    </div>
                                </div>

                                <div className="ud-perf-gauge">
                                    <Progress
                                        type="circle"
                                        percent={perfMetrics.efficiency}
                                        size={54}
                                        strokeColor={perfDisplay.progressStroke}
                                        trailColor="var(--border-color)"
                                        strokeWidth={8}
                                        format={(percent) => (
                                            <span style={{ 
                                                color: 'var(--text-primary)', 
                                                fontWeight: 900, 
                                                fontSize: 13 
                                            }}>
                                                {percent}%
                                            </span>
                                        )}
                                    />
                                    <span className="ud-perf-gauge-label">EFFICIENCY</span>
                                </div>
                            </div>

                            {/* Motivational quote box */}
                            <div 
                                className="ud-perf-quote-box"
                                style={{ borderLeftColor: perfDisplay.progressStroke }}
                            >
                                <Sparkles size={16} color={perfDisplay.progressStroke} style={{ flexShrink: 0 }} />
                                <span>"{perfDisplay.quote}"</span>
                            </div>

                            {/* 6-Tile Performance Metrics Grid */}
                            <div className="ud-metrics-grid">
                                <div className="ud-metric-tile">
                                    <div 
                                        className="ud-tile-icon"
                                        style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}
                                    >
                                        <CheckSquare size={18} />
                                    </div>
                                    <div>
                                        <Title level={4} className="ud-tile-val">{perfMetrics.done}</Title>
                                        <div className="ud-tile-label">DONE</div>
                                    </div>
                                </div>

                                <div className="ud-metric-tile">
                                    <div 
                                        className="ud-tile-icon"
                                        style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}
                                    >
                                        <Clock size={18} />
                                    </div>
                                    <div>
                                        <Title level={4} className="ud-tile-val">{perfMetrics.inProg}</Title>
                                        <div className="ud-tile-label">IN PROGRESS</div>
                                    </div>
                                </div>

                                <div className="ud-metric-tile">
                                    <div 
                                        className="ud-tile-icon"
                                        style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}
                                    >
                                        <User size={18} />
                                    </div>
                                    <div>
                                        <Title level={4} className="ud-tile-val">{perfMetrics.assigned}</Title>
                                        <div className="ud-tile-label">ASSIGNED</div>
                                    </div>
                                </div>

                                <div className="ud-metric-tile">
                                    <div 
                                        className="ud-tile-icon"
                                        style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}
                                    >
                                        <AlertCircle size={18} />
                                    </div>
                                    <div>
                                        <Title level={4} className="ud-tile-val">{perfMetrics.pending}</Title>
                                        <div className="ud-tile-label">PENDING</div>
                                    </div>
                                </div>

                                <div className="ud-metric-tile">
                                    <div 
                                        className="ud-tile-icon"
                                        style={{ background: 'rgba(249, 115, 22, 0.12)', color: '#f97316' }}
                                    >
                                        <Edit2 size={18} />
                                    </div>
                                    <div>
                                        <Title level={4} className="ud-tile-val">{perfMetrics.correction}</Title>
                                        <div className="ud-tile-label">CORRECTION</div>
                                    </div>
                                </div>

                                <div className="ud-metric-tile">
                                    <div 
                                        className="ud-tile-icon"
                                        style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' }}
                                    >
                                        <RefreshCw size={18} />
                                    </div>
                                    <div>
                                        <Title level={4} className="ud-tile-val">{perfMetrics.redesign}</Title>
                                        <div className="ud-tile-label">REDESIGN</div>
                                    </div>
                                </div>
                            </div>

                            {/* Progress Footer */}
                            <div className="ud-perf-progress-wrap">
                                <div className="ud-progress-header">
                                    <span className="ud-progress-title">Overall Completion</span>
                                    <span className="ud-progress-pct">{perfMetrics.efficiency}% Complete</span>
                                </div>
                                <Progress
                                    percent={perfMetrics.efficiency}
                                    showInfo={false}
                                    strokeColor={perfDisplay.progressStroke}
                                    trailColor="var(--border-color)"
                                    size="small"
                                />
                            </div>
                        </div>
                    </motion.div>
                </Col>

            </Row>

            {/* DAILY REPORTS MODAL */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                            <FileText size={18} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Daily Activity Report</div>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>Log today's accomplishments and external resources</div>
                        </div>
                    </div>
                }
                open={isReportModalVisible}
                onCancel={() => setIsReportModalVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setIsReportModalVisible(false)} style={{ borderRadius: 8 }}>
                        Cancel
                    </Button>,
                    activeTab === 'note' ? (
                        <Button
                            key="submit"
                            type="primary"
                            danger
                            loading={isSavingNote}
                            onClick={handleSaveNote}
                            icon={<FileText size={14} />}
                            style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', fontWeight: 600 }}
                        >
                            Save Note
                        </Button>
                    ) : (
                        <React.Fragment key="sheet-actions">
                            {googleSheetUrl && (
                                <Button
                                    key="open-tab"
                                    onClick={() => window.open(googleSheetUrl, '_blank')}
                                    icon={<ExternalLink size={14} />}
                                    style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center' }}
                                >
                                    Open Sheet
                                </Button>
                            )}
                            <Button
                                key="submit-url"
                                type="primary"
                                danger
                                loading={isSavingUrl}
                                onClick={handleSaveUrl}
                                icon={<CheckSquare size={14} />}
                                style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', fontWeight: 600 }}
                            >
                                Save Link
                            </Button>
                        </React.Fragment>
                    ),
                ]}
                width={720}
                styles={{ header: { borderBottom: '1px solid var(--border-color)', paddingBottom: 12 } }}
            >
                <Tabs activeKey={activeTab} onChange={setActiveTab} tabBarStyle={{ marginBottom: 16 }}>
                    <TabPane
                        tab={
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <FileText size={15} /> Today's Note
                            </span>
                        }
                        key="note"
                    >
                        <Spin spinning={isNoteLoading}>
                            <TextArea
                                rows={12}
                                placeholder="What did you work on today? Document deliverables, blockers, and achievements..."
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                maxLength={5000}
                                showCount
                                style={{ borderRadius: 10, marginTop: 8, padding: 12, fontSize: 14 }}
                            />
                        </Spin>
                    </TabPane>
                    <TabPane
                        tab={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                                <CheckSquare size={15} /> Google Sheet
                            </span>
                        }
                        key="sheet"
                    >
                        <div style={{ padding: '12px 0' }}>
                            <div style={{ marginBottom: 16 }}>
                                <Text strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>Google Sheet URL</Text>
                                <Input
                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                    value={googleSheetUrl}
                                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                                    style={{ marginTop: 8, borderRadius: 8 }}
                                    size="large"
                                />
                            </div>
                            {googleSheetUrl && googleSheetUrl.includes('docs.google.com') && (
                                <div style={{ marginTop: 16, height: 380, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                                    <iframe
                                        src={googleSheetUrl.includes('?') ? googleSheetUrl + '&widget=true&headers=false' : googleSheetUrl + '?widget=true&headers=false'}
                                        width="100%"
                                        height="100%"
                                        frameBorder="0"
                                        title="Google Sheet View"
                                    ></iframe>
                                </div>
                            )}
                        </div>
                    </TabPane>
                </Tabs>
            </Modal>

        </motion.div>
    );
};

export default UserDashboard;
