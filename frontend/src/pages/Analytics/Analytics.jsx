import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Typography, message } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, PieChart as PieChartIcon, Sparkles, LineChart as LineChartIcon } from 'lucide-react';
import dayjs from 'dayjs';


import { useAuth } from '../../contexts/AuthContext';
import { useAnalyticsData } from './hooks/useAnalyticsData';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { downloadAnalyticsPdf } from './utils/pdfExport';

import DashboardFilters from './components/DashboardFilters';
import DashboardSkeleton from './components/DashboardSkeleton';
import ErrorState from './components/ErrorState';
import AnalyticsTab from './tabs/AnalyticsTab';
import InsightsTab from './tabs/InsightsTab';
import PerformanceTab from './tabs/PerformanceTab';

const { Title, Text } = Typography;

const TABS = [
  { key: 'analytics', label: 'Analytics', icon: BarChart2, title: 'Analytics', description: 'Unified performance data across all channels and domains.' },
  { key: 'insights', label: 'Insights', icon: Sparkles, title: 'Insights', description: 'Google Search Console insights showing your top and trending content.' },
  { key: 'performance', label: 'Performance', icon: LineChartIcon, title: 'Performance', description: 'Google Search Console performance metrics.' }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

const Analytics = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics');
  const [selectedProject, setSelectedProject] = useState('');
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 250);

  const [projects, setProjects] = useState([]);

  const fetchProjects = useCallback(() => {
    import('../../api/analyticsApi').then(({ analyticsApi }) => {
      analyticsApi.getProjects().then(res => {
        if (res.success) {
          const fetchedProjects = res.data || [];
          setProjects(fetchedProjects);
          setSelectedProject(prev => prev || (fetchedProjects.length > 0 ? fetchedProjects[0]._id : ''));
        }
      });
    });
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const { data, loading, refreshing, error, lastUpdatedAt, refresh, retry } = useAnalyticsData({
    projectId: selectedProject,
    dateRange
  });

  const handleExport = useCallback(() => {
    if (!data) return message.warning('No data to export');
    try {
      const currentProject = projects.find(p => p._id === selectedProject);
      const companyName = user?.companyName || user?.agencyName || user?.brandName || user?.name || 'Tunepath';
      downloadAnalyticsPdf({
        data,
        projectInfo: currentProject,
        companyName,
        dateRange
      });
      message.success('Analytics PDF report downloaded successfully');
    } catch (err) {
      console.error('Export PDF error:', err);
      message.error('Failed to export PDF report');
    }
  }, [data, projects, selectedProject, dateRange, user]);

  const activeTabMeta = TABS.find(t => t.key === activeTab);

  const renderBody = () => {
    if (error) return <ErrorState message={error} onRetry={retry} retrying={loading} />;
    if (loading) return <DashboardSkeleton />;
    if (!data) return <ErrorState message="No analytics data was returned." onRetry={retry} retrying={loading} />;

    if (activeTab === 'analytics') return <AnalyticsTab data={data} searchTerm={debouncedSearch} />;
    if (activeTab === 'insights') return <InsightsTab data={data} />;
    return <PerformanceTab data={data} />;
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>{activeTabMeta.title}</Title>
          <Text type="secondary">{activeTabMeta.description}</Text>
          {lastUpdatedAt && !loading && (
            <div><Text type="secondary" style={{ fontSize: 12 }}>Last updated {dayjs(lastUpdatedAt).format('HH:mm:ss')}{data?.meta?.cache?.hit ? ' · cached' : ''}</Text></div>
          )}
        </div>

        <DashboardFilters
          projects={projects}
          selectedProject={selectedProject}
          onProjectChange={setSelectedProject}
          dateRange={dateRange}
          onDateRangeChange={(val) => val && setDateRange(val)}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onRefresh={refresh}
          onProjectsRefresh={fetchProjects}
          refreshing={refreshing}
          onExport={handleExport}
          showExport={activeTab === 'analytics'}
          previousDateRange={data?.meta?.previousDateRange}
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        role="tablist"
        aria-label="Analytics dashboard sections"
        style={{ display: 'flex', gap: 32, borderBottom: '1px solid var(--border-color)', marginBottom: 32, overflowX: 'auto', paddingBottom: 2 }}
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            role="tab"
            tabIndex={0}
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(key); } }}
            style={{
              paddingBottom: 16,
              borderBottom: activeTab === key ? '3px solid var(--accent-secondary)' : '3px solid transparent',
              fontWeight: activeTab === key ? 700 : 600,
              color: activeTab === key ? 'var(--text-primary)' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
            }}
          >
            <Icon size={18} color={activeTab === key ? 'var(--accent-secondary)' : 'var(--text-secondary)'} aria-hidden="true" /> {label}
          </div>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, y: -10 }}
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.2, staggerChildren: 0.05 } }
          }}
          role="tabpanel"
        >
          {renderBody()}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

export default Analytics;