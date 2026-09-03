import React, { useState, useEffect } from 'react';
import { Typography, Tabs, Button, Select, Space, Badge, message, Spin } from 'antd';
import { ShareAltOutlined, ReloadOutlined, ExportOutlined, EllipsisOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { semrushApi } from '../../api/semrushApi';
import './components/DashboardTab.css';

const { Title, Text } = Typography;
const { Option } = Select;

const Semrush = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState(null);
    const [projectData, setProjectData] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('dashboard');

    const [selectedDatabase, setSelectedDatabase] = useState('us');

    useEffect(() => {
        if (projectId) {
            fetchProjectData();
        }
    }, [projectId]);

    useEffect(() => {
        // Update active tab based on current route
        const path = location.pathname;
        if (path.includes('/domain-overview')) setActiveTab('domain-overview');
        else if (path.includes('/keyword-research')) setActiveTab('keyword-research');
        else if (path.includes('/keyword-magic-tool')) setActiveTab('keyword-magic-tool');
        else if (path.includes('/backlinks')) setActiveTab('backlinks');
        else if (path.includes('/organic-keywords')) setActiveTab('organic-keywords');
        else if (path.includes('/site-health')) setActiveTab('site-health');
        else if (path.includes('/position-tracking')) setActiveTab('position-tracking');
        else if (path.includes('/competitor-analysis')) setActiveTab('competitor-analysis');
        else if (path.includes('/traffic-analytics')) setActiveTab('traffic-analytics');
        else if (path.includes('/reports')) setActiveTab('reports');
        else if (path.includes('/activity')) setActiveTab('activity');
        else setActiveTab('dashboard');
    }, [location]);

    const getBasePath = () => {
        const match = location.pathname.match(/^(.*\/seo-aeo-geo)/);
        return match ? match[1] : '/intelligence/seo-aeo-geo';
    };

    const fetchProjectData = async () => {
        try {
            const res = await semrushApi.getProject(projectId);
            if (res.data.success) {
                setProject(res.data.project);
                setProjectData(res.data.data);
            }
        } catch (error) {
            console.error(error);
            message.error('Failed to load project data');
            navigate(getBasePath());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let interval;
        if (projectData?.activeJob && ['QUEUED', 'RUNNING'].includes(projectData.activeJob.status)) {
            setRefreshing(true);
            interval = setInterval(() => {
                semrushApi.getProject(projectId).then(res => {
                    if (res.data.success) {
                        setProject(res.data.project);
                        setProjectData(res.data.data);
                        const status = res.data.data?.activeJob?.status;
                        if (!status || !['QUEUED', 'RUNNING'].includes(status)) {
                            setRefreshing(false);
                            message.success('Intelligence refresh completed!');
                            clearInterval(interval);
                        }
                    }
                });
            }, 5000);
        } else {
            setRefreshing(false);
        }
        return () => clearInterval(interval);
    }, [projectData?.activeJob?.status, projectId]);

    const handleDatabaseChange = async (val) => {
        setSelectedDatabase(val);
    };

    const triggerRefresh = async () => {
        try {
            setRefreshing(true);
            const res = await semrushApi.refreshProject(projectId, selectedDatabase.toLowerCase());
            if (res.data.success) {
                message.info(`Refresh queued. Analyzing intelligence...`);
                // Immediately fetch to get the new activeJob state
                fetchProjectData();
            }
        } catch (error) {
            console.error(error);
            message.error('Failed to queue refresh');
            setRefreshing(false);
        }
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        message.success('Dashboard link copied to clipboard!');
    };

    const handleExport = () => {
        window.print();
    };

    const handleTabChange = (key) => {
        setActiveTab(key);
        const base = getBasePath();
        if (key === 'dashboard') navigate(`${base}/${projectId}`);
        else navigate(`${base}/${projectId}/${key}`);
    };

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' }}>
                <Spin size="large" tip="Loading project workspace..." />
            </div>
        );
    }

    if (!project) return null;

    return (
        <div className="semrush-workspace-container">
            {/* Premium Header */}
            <div className="semrush-header-container">
                <div className="semrush-header-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <Button
                            type="text"
                            icon={<ArrowLeftOutlined style={{ fontSize: '18px' }} />}
                            onClick={() => navigate(getBasePath())}
                            style={{ padding: '4px 8px' }}
                        />
                        <div className="semrush-domain-info">
                            <div className="semrush-domain-icon-box">
                                <span style={{ fontSize: '28px' }}>🌐</span>
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                                    <h1 className="semrush-domain-name">
                                        {project.domain}
                                    </h1>
                                    <Badge status="success" text="Active" style={{ background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--border-color)', fontWeight: 600, fontSize: '12px' }} />
                                </div>
                                <div className="semrush-domain-meta">
                                    <span style={{ fontWeight: 600 }}>{project.name}</span>
                                    <span>•</span>
                                    <span>Last updated: {
                                         (project.lastRefresh || project.latestSnapshot?.collectedAt || projectData?.snapshot?.collectedAt || project.latestSnapshot?.createdAt || project.updatedAt || project.createdAt)
                                             ? new Date(project.lastRefresh || project.latestSnapshot?.collectedAt || projectData?.snapshot?.collectedAt || project.latestSnapshot?.createdAt || project.updatedAt || project.createdAt).toLocaleString()
                                             : 'Never'
                                     }</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="semrush-header-actions">
                        <Button
                            type="primary"
                            icon={<ReloadOutlined spin={refreshing} />}
                            style={{ fontWeight: 600, borderRadius: 8, background: refreshing ? 'var(--accent-warning)' : 'var(--accent-primary)' }}
                            onClick={triggerRefresh}
                            disabled={refreshing}
                        >
                            {refreshing ? 'Analyzing...' : 'Refresh Intelligence'}
                        </Button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="semrush-premium-tabs">
                    <Tabs
                        activeKey={activeTab}
                        onChange={handleTabChange}
                        items={[
                            { key: 'dashboard', label: 'Dashboard' },
                            { key: 'domain-overview', label: 'Domain Overview' },
                            { key: 'organic-keywords', label: 'Organic Research' },
                            // { key: 'keyword-magic-tool', label: 'Keyword Magic' },
                            { key: 'position-tracking', label: 'Position Tracking' },
                            { key: 'competitor-analysis', label: 'Competitor Analysis' },
                            { key: 'backlinks', label: 'Backlinks' },
                            { key: 'site-health', label: 'Site Audit' },
                            // { key: 'traffic-analytics', label: 'Traffic Analytics' },
                            { key: 'reports', label: 'Reports' },
                            { key: 'activity', label: 'Activity' },
                        ]}
                    />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="semrush-content-area">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Outlet context={{ project, projectData, setProjectData, fetchProjectData, triggerRefresh }} />
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Semrush;
