import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Card, Row, Col, Spin, Button, Modal, Tabs, Input, message, DatePicker, Avatar, Progress, List, Tag, Space } from 'antd';
import { motion } from 'framer-motion';
import { CheckSquare, Clock, AlertCircle, FileText, ChevronLeft, ChevronRight, User, Activity, Edit2, RefreshCw, ExternalLink } from 'lucide-react';
import { useGetTasksQuery } from '../../api/taskApi';
import { useGetTodayNoteQuery, useCreateOrUpdateTodayNoteMutation } from '../../api/notepadApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

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
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
    };

    const navigate = useNavigate();
    const { user, setUser } = useAuth();
    const isUserRole = user?.role === 'user';

    const { data: tasksData, isLoading } = useGetTasksQuery({ limit: 1000 });
    const allTasks = tasksData?.data?.data || tasksData?.data?.tasks || [];

    const tasks = useMemo(() => {
        // Filter tasks assigned to the current user just to be safe
        return allTasks.filter(t => {
            const assignedId = t.assignedTo?._id || t.assignedTo;
            return assignedId === user?._id || !assignedId; // If no assignee but returned by API, assume it's theirs
        });
    }, [allTasks, user]);

    const [selectedDate, setSelectedDate] = useState(dayjs());

    // Selected Date Tasks (or All Tasks if selectedDate is cleared/null)
    const tasksForSelectedDate = useMemo(() => {
        if (!selectedDate) return tasks;
        return tasks.filter(t => {
            const taskDate = t.dueDate || t.startDate || t.createdAt;
            if (!taskDate) return false;
            return dayjs(taskDate).isSame(selectedDate, 'day');
        });
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

    const getStatusColor = (status) => {
        if (isCompleted(status)) return 'success';
        if (isInProgress(status)) return 'processing';
        if (isPending(status)) return 'default';
        return 'warning';
    };

    const getPerformanceStatus = (efficiency, total) => {
        // Elegant, deep gradients with lower contrast
        if (total === 0) return { status: 'AVERAGE', gradient: 'linear-gradient(135deg, #e65100 0%, #ef6c00 100%)', shadow: 'rgba(230, 81, 0, 0.3)' };
        if (efficiency >= 100) return { status: 'ELITE', gradient: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)', shadow: 'rgba(27, 94, 32, 0.3)' };
        if (efficiency >= 80) return { status: 'STRONG', gradient: 'linear-gradient(135deg, #0d47a1 0%, #1565c0 100%)', shadow: 'rgba(13, 71, 161, 0.3)' };
        if (efficiency >= 50) return { status: 'AVERAGE', gradient: 'linear-gradient(135deg, #e65100 0%, #ef6c00 100%)', shadow: 'rgba(230, 81, 0, 0.3)' };
        return { status: 'NEEDS WORK', gradient: 'linear-gradient(135deg, #880e4f 0%, #b71c1c 100%)', shadow: 'rgba(183, 28, 28, 0.3)' };
    };

    const perfDisplay = getPerformanceStatus(perfMetrics.efficiency, perfMetrics.assigned);

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ paddingBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <motion.div variants={itemVariants}>
                    <Title level={2} style={{ margin: '0 0 4px 0', fontWeight: 800 }}>Developer Dashboard</Title>
                </motion.div>

                <motion.div variants={itemVariants} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Button type="text" icon={<ChevronLeft size={16} />} onClick={() => setSelectedDate(prev => prev ? prev.subtract(1, 'day') : dayjs().subtract(1, 'day'))} />
                        <DatePicker
                            value={selectedDate}
                            onChange={(date) => setSelectedDate(date)}
                            format="DD MMM YYYY"
                            allowClear={true}
                            placeholder="Select Date"
                            style={{ width: 140 }}
                        />
                        <Button type="text" icon={<ChevronRight size={16} />} onClick={() => setSelectedDate(prev => prev ? prev.add(1, 'day') : dayjs().add(1, 'day'))} />
                    </div>
                    {isUserRole && (
                        <Button
                            type="primary"
                            danger
                            icon={<FileText size={16} />}
                            onClick={() => setIsReportModalVisible(true)}
                            style={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}
                        >
                            Reports
                        </Button>
                    )}
                </motion.div>
            </div>

            {/* TOP METRIC CARDS */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} md={6}>
                    <motion.div variants={itemVariants}>
                        <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12, border: '1px solid var(--border-color)', height: '100%' }}>
                            <Text type="secondary" style={{ fontSize: 13, fontWeight: 600 }}>My Tasks</Text>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <CheckSquare size={18} color="var(--accent-info)" />
                                <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
                                    {isLoading ? <Spin size="small" /> : myTasksCount}
                                </Title>
                            </div>
                        </Card>
                    </motion.div>
                </Col>
                <Col xs={12} md={6}>
                    <motion.div variants={itemVariants}>
                        <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12, border: '1px solid var(--border-color)', height: '100%' }}>
                            <Text type="secondary" style={{ fontSize: 13, fontWeight: 600 }}>In Progress</Text>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <Activity size={18} color="var(--accent-warning)" />
                                <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
                                    {isLoading ? <Spin size="small" /> : inProgressCount}
                                </Title>
                            </div>
                        </Card>
                    </motion.div>
                </Col>
                <Col xs={12} md={6}>
                    <motion.div variants={itemVariants}>
                        <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12, border: '1px solid var(--border-color)', height: '100%' }}>
                            <Text type="secondary" style={{ fontSize: 13, fontWeight: 600 }}>Completed</Text>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <CheckSquare size={18} color="var(--accent-success)" />
                                <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
                                    {isLoading ? <Spin size="small" /> : completedCount}
                                </Title>
                            </div>
                        </Card>
                    </motion.div>
                </Col>
                <Col xs={12} md={6}>
                    <motion.div variants={itemVariants}>
                        <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12, border: '1px solid var(--border-color)', height: '100%' }}>
                            <Text type="secondary" style={{ fontSize: 13, fontWeight: 600 }}>Overdue</Text>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <AlertCircle size={18} color="var(--accent-danger)" />
                                <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
                                    {isLoading ? <Spin size="small" /> : overdueCount}
                                </Title>
                            </div>
                        </Card>
                    </motion.div>
                </Col>
            </Row>

            {/* 2-COLUMN LAYOUT */}
            <Row gutter={[24, 24]}>

                {/* LEFT COLUMN: TASKS ON DATE */}
                <Col xs={24} lg={14}>
                    <motion.div variants={itemVariants} style={{ height: '100%' }}>
                        <Card
                            style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%', minHeight: 400 }}
                            bodyStyle={{ padding: 0 }}
                        >
                            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Title level={5} style={{ margin: 0, fontWeight: 700 }}>
                                    {selectedDate ? `Tasks on ${selectedDate.format('DD MMM YYYY')}` : 'All Tasks'}
                                </Title>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Button type="link" onClick={() => navigate('/user/tasks')}>View All Tasks</Button>
                                </div>
                            </div>

                            <div style={{ padding: 24 }}>
                                {isLoading ? (
                                    <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                                ) : tasksForSelectedDate.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                                        {selectedDate ? `No tasks found for ${selectedDate.format('DD MMM YYYY')}.` : 'No tasks found.'}
                                    </div>
                                ) : (
                                    <List
                                        dataSource={tasksForSelectedDate}
                                        renderItem={item => (
                                            <List.Item
                                                style={{ border: '1px solid var(--border-color)', borderRadius: 8, marginBottom: 12, padding: 16, background: 'var(--bg-container)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                                                className="hover-card"
                                                onClick={() => navigate('/user/tasks')}
                                            >
                                                <List.Item.Meta
                                                    title={<Text style={{ fontWeight: 600, fontSize: 15 }}>{item.title}</Text>}
                                                    description={
                                                        <Space style={{ marginTop: 8 }}>
                                                            <Tag color={getStatusColor(item.status)}>{item.status?.toUpperCase() || 'UNKNOWN'}</Tag>
                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                Due: {dayjs(item.dueDate).format('DD MMM, h:mm A')}
                                                            </Text>
                                                        </Space>
                                                    }
                                                />
                                            </List.Item>
                                        )}
                                    />
                                )}
                            </div>
                        </Card>
                    </motion.div>
                </Col>

                {/* RIGHT COLUMN: PERFORMANCE SCORECARD */}
                <Col xs={24} lg={10}>
                    <motion.div variants={itemVariants}>
                        <div
                            style={{
                                background: perfDisplay.gradient,
                                borderRadius: 20,
                                padding: 24,
                                color: '#fff',
                                boxShadow: `0 10px 30px ${perfDisplay.shadow}`,
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'all 0.5s ease'
                            }}
                        >
                            {/* Decorative top-right glow */}
                            <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', filter: 'blur(30px)' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <Avatar size={64} style={{ backgroundColor: '#fff', color: '#333', fontSize: 24, fontWeight: 'bold' }}>
                                        {user?.firstName?.charAt(0) || 'U'}
                                    </Avatar>
                                    <div>
                                        <Tag color="rgba(255,255,255,0.2)" style={{ color: '#fff', border: 'none', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                                            {perfDisplay.status}
                                        </Tag>
                                        <Title level={4} style={{ color: '#fff', margin: '0 0 2px 0' }}>{user?.firstName} {user?.lastName}</Title>
                                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textTransform: 'uppercase' }}>
                                            {user?.role?.replace(/_/g, ' ') || 'User'}
                                        </Text>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'center' }}>
                                    <Progress
                                        type="circle"
                                        percent={perfMetrics.efficiency}
                                        size={70}
                                        strokeColor="#fff"
                                        trailColor="rgba(255,255,255,0.2)"
                                        format={(percent) => <span style={{ color: '#fff', fontWeight: 800 }}>{percent}%</span>}
                                    />
                                    <div style={{ fontSize: 10, marginTop: 6, fontWeight: 600, letterSpacing: 1, opacity: 0.8 }}>EFFICIENCY</div>
                                </div>
                            </div>

                            <Text style={{ display: 'block', marginBottom: 24, fontStyle: 'italic', color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                                "Every expert started here - keep climbing!"
                            </Text>

                            {/* METRICS GRID */}
                            <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                                <Col span={12}>
                                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ opacity: 0.7 }}><CheckSquare size={18} /></div>
                                        <div>
                                            <Title level={4} style={{ color: '#fff', margin: 0 }}>{perfMetrics.done}</Title>
                                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>DONE</Text>
                                        </div>
                                    </div>
                                </Col>
                                <Col span={12}>
                                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ opacity: 0.7 }}><Clock size={18} /></div>
                                        <div>
                                            <Title level={4} style={{ color: '#fff', margin: 0 }}>{perfMetrics.inProg}</Title>
                                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>IN PROGRESS</Text>
                                        </div>
                                    </div>
                                </Col>
                                <Col span={12}>
                                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ opacity: 0.7 }}><User size={18} /></div>
                                        <div>
                                            <Title level={4} style={{ color: '#fff', margin: 0 }}>{perfMetrics.assigned}</Title>
                                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>ASSIGNED</Text>
                                        </div>
                                    </div>
                                </Col>
                                <Col span={12}>
                                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ opacity: 0.7 }}><AlertCircle size={18} /></div>
                                        <div>
                                            <Title level={4} style={{ color: '#fff', margin: 0 }}>{perfMetrics.pending}</Title>
                                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>PENDING</Text>
                                        </div>
                                    </div>
                                </Col>
                                <Col span={12}>
                                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ opacity: 0.7 }}><Edit2 size={18} /></div>
                                        <div>
                                            <Title level={4} style={{ color: '#fff', margin: 0 }}>{perfMetrics.correction}</Title>
                                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>CORRECTION</Text>
                                        </div>
                                    </div>
                                </Col>
                                <Col span={12}>
                                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ opacity: 0.7 }}><RefreshCw size={18} /></div>
                                        <div>
                                            <Title level={4} style={{ color: '#fff', margin: 0 }}>{perfMetrics.redesign}</Title>
                                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>REDESIGN</Text>
                                        </div>
                                    </div>
                                </Col>
                            </Row>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 600 }}>Overall Progress</Text>
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{perfMetrics.efficiency}% Complete</Text>
                            </div>
                            <Progress
                                percent={perfMetrics.efficiency}
                                showInfo={false}
                                strokeColor="#fff"
                                trailColor="rgba(255,255,255,0.2)"
                                size="small"
                            />

                        </div>
                    </motion.div>
                </Col>

            </Row>

            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
                        <FileText size={18} />
                        <span style={{ fontWeight: 600 }}>Daily Notepad</span>
                    </div>
                }
                open={isReportModalVisible}
                onCancel={() => setIsReportModalVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setIsReportModalVisible(false)} style={{ borderRadius: 6 }}>
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
                            style={{ borderRadius: 6, display: 'inline-flex', alignItems: 'center' }}
                        >
                            Save Note
                        </Button>
                    ) : (
                        <>
                            {googleSheetUrl && (
                                <Button
                                    key="open-tab"
                                    onClick={() => window.open(googleSheetUrl, '_blank')}
                                    icon={<ExternalLink size={14} />}
                                    style={{ borderRadius: 6, display: 'inline-flex', alignItems: 'center' }}
                                >
                                    Open in New Tab
                                </Button>
                            )}
                            <Button
                                key="submit-url"
                                type="primary"
                                danger
                                loading={isSavingUrl}
                                onClick={handleSaveUrl}
                                icon={<CheckSquare size={14} />}
                                style={{ borderRadius: 6, display: 'inline-flex', alignItems: 'center' }}
                            >
                                Save Link
                            </Button>
                        </>
                    ),
                ]}
                width={700}
                styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
            >
                <Tabs activeKey={activeTab} onChange={setActiveTab} tabBarStyle={{ marginBottom: 16 }}>
                    <TabPane
                        tab={
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <FileText size={16} /> Today's Note
                            </span>
                        }
                        key="note"
                    >
                        <Spin spinning={isNoteLoading}>
                            <TextArea
                                rows={12}
                                placeholder="What did you work on today?"
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                maxLength={5000}
                                showCount
                                style={{ borderRadius: 8, marginTop: 8 }}
                            />
                        </Spin>
                    </TabPane>
                    <TabPane
                        tab={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CheckSquare size={16} /> Google Sheet
                            </span>
                        }
                        key="sheet"
                    >
                        <div style={{ padding: '20px 0' }}>
                            <div style={{ marginBottom: 16 }}>
                                <Text strong>Google Sheet Link</Text>
                                <Input
                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                    value={googleSheetUrl}
                                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                                    style={{ marginTop: 8, borderRadius: 8 }}
                                    size="large"
                                />
                            </div>
                            {googleSheetUrl && googleSheetUrl.includes('docs.google.com') && (
                                <div style={{ marginTop: 16, height: 400, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
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
