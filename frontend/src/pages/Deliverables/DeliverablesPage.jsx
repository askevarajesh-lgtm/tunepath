import React, { useMemo, useState } from 'react';
import {
  Table, Typography, Card, Progress, Tag, Space, Tooltip, Row, Col, Statistic, Button, Drawer, Input, Empty
} from 'antd';
import {
  ProjectOutlined, CheckCircleOutlined, ClockCircleOutlined, ProfileOutlined, EyeOutlined, 
  HourglassOutlined, FilterOutlined, CloseCircleOutlined, SearchOutlined, CheckOutlined, ReloadOutlined
} from '@ant-design/icons';
import { useGetProjectsQuery } from '../../api/projectApi';
import { useGetTasksByProjectQuery } from '../../api/taskApi';
import TaskDetailDrawer from '../Tasks/TaskDetailDrawer';
import TaskCompletionCelebrate from '../Tasks/TaskCompletionCelebrate';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const DeliverablesPage = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [selectedProjectForTasks, setSelectedProjectForTasks] = useState(null);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Filter and Search State
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'pending' | 'completed' | 'remaining'
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all projects (populated with clientId)
  const { data: projectsResponse, isLoading, refetch: refetchProjects } = useGetProjectsQuery({ limit: 1000 });
  const projects = projectsResponse?.data?.data || projectsResponse?.data?.projects || [];

  // Fetch tasks for the selected project in Drawer
  const { data: tasksData, isLoading: isLoadingTasks, refetch: refetchTasks } = useGetTasksByProjectQuery(
    selectedProjectForTasks?._id,
    { skip: !selectedProjectForTasks?._id }
  );
  const projectTasks = tasksData?.data?.tasks || tasksData?.data?.data || (Array.isArray(tasksData?.data) ? tasksData.data : []);

  // Group by client and aggregate deliverables
  const clientData = useMemo(() => {
    const clientsMap = {};

    projects.forEach(project => {
      const clientId = project.clientId?._id || project.clientId;
      if (!clientId) return;

      const clientName = project.clientId?.name || project.clientId?.companyName || 'Unknown Client';
      const clientEmail = project.clientId?.email || '';

      if (!clientsMap[clientId]) {
        clientsMap[clientId] = {
          clientId,
          clientName,
          clientEmail,
          projects: [],
          totalDeliverables: 0,
          completedDeliverables: 0,
          pendingApprovalDeliverables: 0,
          remainingDeliverables: 0
        };
      }

      // Aggregate core project specific deliverable fields
      const pTotal = (project.numberOfPosters || 0) + (project.numberOfVideos || 0) + (project.numberOfShoots || 0);

      const pPostersComp = (project.completedPosters !== undefined && project.completedPosters !== null)
        ? Math.max(project.completedPosters || 0, project.approvedPosters || 0)
        : (project.approvedPosters || 0);

      const pVideosComp = (project.completedVideos !== undefined && project.completedVideos !== null)
        ? Math.max(project.completedVideos || 0, project.approvedVideos || 0)
        : (project.approvedVideos || 0);

      const pShootsComp = (project.completedShoots !== undefined && project.completedShoots !== null)
        ? Math.max(project.completedShoots || 0, project.approvedShoots || 0)
        : (project.approvedShoots || 0);

      const pCompleted = pPostersComp + pVideosComp + pShootsComp;

      // Pending approval represents deliverables completed by the team that are awaiting client approval
      const pPostersPending = Math.max(0, (project.completedPosters || 0) - (project.approvedPosters || 0));
      const pVideosPending = Math.max(0, (project.completedVideos || 0) - (project.approvedVideos || 0));
      const pShootsPending = Math.max(0, (project.completedShoots || 0) - (project.approvedShoots || 0));

      let extraTotal = 0;
      let extraCompleted = 0;
      let extraPending = 0;

      // Also check selectedCategories for custom deliverables
      if (project.selectedCategories && Array.isArray(project.selectedCategories)) {
        project.selectedCategories.forEach(cat => {
          const rawName = cat.name || cat.categoryName || "";
          const isStandard = ["poster", "video", "shoot"].some(k => rawName.toLowerCase().includes(k));
          if (!isStandard) {
            const catComp = (cat.completed !== undefined && cat.completed !== null)
              ? Math.max(cat.completed || 0, cat.approved || 0)
              : (cat.approved || 0);
            extraTotal += (cat.quantity || cat.count || 0);
            extraCompleted += catComp;
            extraPending += Math.max(0, (cat.completed || 0) - (cat.approved || 0));
          }
        });
      }

      const calculatedPending = pPostersPending + pVideosPending + pShootsPending + extraPending;
      // Project is pending review only when its status explicitly requires client review
      const isProjectPendingReview = ['workflow_sent', 'sent_for_client_review', 'workflow_revision_requested'].includes(project.status);
      const pPending = calculatedPending > 0 ? calculatedPending : (isProjectPendingReview ? 1 : 0);

      const totalD = pTotal + extraTotal;
      const compD = pCompleted + extraCompleted;
      const remD = Math.max(0, totalD - compD);

      clientsMap[clientId].totalDeliverables += totalD;
      clientsMap[clientId].completedDeliverables += compD;
      clientsMap[clientId].pendingApprovalDeliverables += pPending;
      clientsMap[clientId].remainingDeliverables += remD;

      clientsMap[clientId].projects.push({
        ...project,
        projectTotal: totalD,
        projectCompleted: compD,
        projectPending: pPending,
        projectRemaining: remD
      });
    });

    return Object.values(clientsMap);
  }, [projects]);

  const totalGlobal = clientData.reduce((acc, curr) => acc + curr.totalDeliverables, 0);
  const pendingGlobal = clientData.reduce((acc, curr) => acc + (curr.pendingApprovalDeliverables || 0), 0);
  const completedGlobal = clientData.reduce((acc, curr) => acc + curr.completedDeliverables, 0);
  const remainingGlobal = clientData.reduce((acc, curr) => acc + curr.remainingDeliverables, 0);

  // Filtered Client Data according to active KPI card / Filter Bar selection + search query
  const filteredClientData = useMemo(() => {
    let result = clientData;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c => 
        (c.clientName && c.clientName.toLowerCase().includes(q)) ||
        (c.clientEmail && c.clientEmail.toLowerCase().includes(q)) ||
        (c.projects && c.projects.some(p => p.name && p.name.toLowerCase().includes(q)))
      );
    }

    if (activeFilter === 'pending') {
      result = result.filter(c => c.pendingApprovalDeliverables > 0);
    } else if (activeFilter === 'completed') {
      result = result.filter(c => c.completedDeliverables > 0);
    } else if (activeFilter === 'remaining') {
      result = result.filter(c => c.remainingDeliverables > 0);
    }

    return result;
  }, [clientData, activeFilter, searchQuery]);

  const handleKpiCardClick = (filterKey) => {
    if (activeFilter === filterKey && filterKey !== 'all') {
      setActiveFilter('all');
    } else {
      setActiveFilter(filterKey);
    }
  };

  const columns = [
    {
      title: 'Client',
      dataIndex: 'clientName',
      key: 'clientName',
      render: (text, record) => (
        <Space>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontWeight: 'bold'
          }}>
            {text.charAt(0).toUpperCase()}
          </div>
          <div>
            <Text strong style={{ fontSize: 14 }}>{text}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.clientEmail}</Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Active Projects',
      dataIndex: 'projects',
      key: 'projects',
      align: 'center',
      render: (projs) => (
        <Tag color="blue" icon={<ProjectOutlined />} style={{ borderRadius: 6, padding: '2px 8px' }}>
          {projs.length} Project{projs.length !== 1 ? 's' : ''}
        </Tag>
      )
    },
    {
      title: 'Total Deliverables',
      dataIndex: 'totalDeliverables',
      key: 'totalDeliverables',
      align: 'center',
      render: (val) => (
        <Space>
          <ProfileOutlined style={{ color: 'var(--accent-primary)' }} />
          <Text strong style={{ fontSize: 15 }}>{val}</Text>
        </Space>
      )
    },
    {
      title: 'Pending Approvals',
      dataIndex: 'pendingApprovalDeliverables',
      key: 'pendingApprovalDeliverables',
      align: 'center',
      render: (val) => (
        <Space>
          <HourglassOutlined style={{ color: '#d97706' }} />
          <Text strong style={{ fontSize: 15, color: val > 0 ? '#d97706' : undefined }}>{val}</Text>
        </Space>
      )
    },
    {
      title: 'Completed',
      dataIndex: 'completedDeliverables',
      key: 'completedDeliverables',
      align: 'center',
      render: (val) => (
        <Space>
          <CheckCircleOutlined style={{ color: '#10b981' }} />
          <Text type="success" strong style={{ fontSize: 15, color: '#10b981' }}>{val}</Text>
        </Space>
      )
    },
    {
      title: 'Remaining',
      dataIndex: 'remainingDeliverables',
      key: 'remainingDeliverables',
      align: 'center',
      render: (val) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#ea580c' }} />
          <Text strong style={{ fontSize: 15, color: '#ea580c' }}>{val}</Text>
        </Space>
      )
    },
    {
      title: 'Overall Progress',
      key: 'progress',
      width: '20%',
      render: (_, record) => {
        const percent = record.totalDeliverables > 0 ? Math.round((record.completedDeliverables / record.totalDeliverables) * 100) : 0;
        return (
          <Tooltip title={`${record.completedDeliverables} / ${record.totalDeliverables} Completed (${percent}%)`}>
            <Progress
              percent={percent}
              size="small"
              strokeColor={{
                '0%': '#3b82f6',
                '100%': '#10b981',
              }}
            />
          </Tooltip>
        );
      }
    }
  ];

  const expandedRowRender = (record) => {
    let projectsToShow = record.projects;
    if (activeFilter === 'pending') {
      projectsToShow = record.projects.filter(p => p.projectPending > 0);
    } else if (activeFilter === 'completed') {
      projectsToShow = record.projects.filter(p => p.projectCompleted > 0);
    } else if (activeFilter === 'remaining') {
      projectsToShow = record.projects.filter(p => p.projectRemaining > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matched = projectsToShow.filter(p => p.name && p.name.toLowerCase().includes(q));
      if (matched.length > 0) {
        projectsToShow = matched;
      }
    }

    const projectCols = [
      {
        title: 'Project Name',
        dataIndex: 'name',
        key: 'name',
        render: (text) => <Text strong>{text}</Text>
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (status, pRecord) => {
          const percent = pRecord?.projectTotal > 0 ? Math.round((pRecord.projectCompleted / pRecord.projectTotal) * 100) : 0;
          let effectiveStatus = status;
          if ((percent >= 100 || (pRecord?.projectRemaining === 0 && pRecord?.projectTotal > 0)) && (status || '').toLowerCase() !== 'cancelled') {
            effectiveStatus = 'completed';
          }

          let color = 'default';
          if (effectiveStatus === 'completed' || effectiveStatus === 'approved') color = 'success';
          else if (effectiveStatus === 'in_progress') color = 'processing';
          else if (effectiveStatus === 'workflow_sent' || effectiveStatus === 'sent_for_client_review' || effectiveStatus === 'project_near_due_date') color = 'warning';

          return (
            <Tag color={color} style={{ borderRadius: 6 }}>
              {effectiveStatus?.replace(/_/g, ' ')?.toUpperCase() || 'UNKNOWN'}
            </Tag>
          );
        }
      },
      {
        title: 'Total',
        dataIndex: 'projectTotal',
        key: 'projectTotal',
        align: 'center',
        render: (val) => <Text strong>{val}</Text>
      },
      {
        title: 'Pending Approval',
        dataIndex: 'projectPending',
        key: 'projectPending',
        align: 'center',
        render: (val) => <Text style={{ color: val > 0 ? '#d97706' : undefined, fontWeight: val > 0 ? 'bold' : 'normal' }}>{val}</Text>
      },
      {
        title: 'Completed',
        dataIndex: 'projectCompleted',
        key: 'projectCompleted',
        align: 'center',
        render: (val) => <Text type="success" style={{ color: '#10b981', fontWeight: 600 }}>{val}</Text>
      },
      {
        title: 'Remaining',
        dataIndex: 'projectRemaining',
        key: 'projectRemaining',
        align: 'center',
        render: (val) => <Text type="warning" style={{ color: '#ea580c', fontWeight: 600 }}>{val}</Text>
      },
      {
        title: 'Completion',
        key: 'completion',
        render: (_, pRecord) => {
          const percent = pRecord.projectTotal > 0 ? Math.round((pRecord.projectCompleted / pRecord.projectTotal) * 100) : 0;
          return <Progress type="circle" percent={percent} size={30} strokeColor="#10b981" />;
        }
      },
      {
        title: 'Action',
        key: 'action',
        align: 'center',
        render: (_, pRecord) => (
          <Button
            type="primary"
            icon={<EyeOutlined />}
            size="small"
            style={{ borderRadius: 6 }}
            onClick={() => setSelectedProjectForTasks(pRecord)}
          >
            Tasks
          </Button>
        )
      }
    ];

    return (
      <div style={{ padding: '16px 24px', background: isDark ? '#111c31' : '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text strong style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Client Projects Breakdown ({projectsToShow.length})
          </Text>
          {activeFilter !== 'all' && (
            <Tag color="orange" style={{ borderRadius: 12 }}>
              Filtered by: {activeFilter.toUpperCase()}
            </Tag>
          )}
        </div>
        <Table
          columns={projectCols}
          dataSource={projectsToShow}
          pagination={false}
          rowKey="_id"
          size="small"
          bordered
          style={{ background: isDark ? '#0b1220' : '#ffffff', borderRadius: 8, overflow: 'hidden' }}
        />
      </div>
    );
  };

  const getFilterLabel = (key) => {
    switch (key) {
      case 'pending': return 'Pending Approvals';
      case 'completed': return 'Completed Deliverables';
      case 'remaining': return 'Remaining Deliverables';
      default: return 'All Deliverables';
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800 }}>Client Deliverables</Title>
          <Text type="secondary">Overview of deliverable commitments and progress across all your clients.</Text>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => refetchProjects()} 
            loading={isLoading}
            style={{ borderRadius: 8 }}
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {/* KPI Cards Row - Interactive & Clickable */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        {/* Total Deliverables */}
        <Col xs={24} sm={12} lg={6}>
          <div
            onClick={() => handleKpiCardClick('all')}
            style={{
              cursor: 'pointer',
              borderRadius: 16,
              overflow: 'hidden',
              background: isDark ? '#111c31' : '#ffffff',
              border: activeFilter === 'all' 
                ? '2px solid #3b82f6' 
                : `1px solid ${isDark ? '#22324b' : '#e5ebf3'}`,
              boxShadow: activeFilter === 'all' 
                ? '0 0 0 3px rgba(59, 130, 246, 0.25), 0 12px 28px rgba(59, 130, 246, 0.15)' 
                : '0 8px 20px rgba(0,0,0,0.04)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: activeFilter === 'all' ? 'translateY(-3px)' : 'none',
              position: 'relative',
              display: 'flex',
              height: 100
            }}
          >
            {activeFilter === 'all' && (
              <div style={{
                position: 'absolute', top: 8, right: 10,
                background: '#3b82f6', color: '#fff', fontSize: 10, fontWeight: 800,
                padding: '2px 8px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4
              }}>
                <CheckOutlined style={{ fontSize: 9 }} /> ACTIVE
              </div>
            )}
            <div style={{ width: '32%', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ProfileOutlined style={{ fontSize: 32, color: '#fff' }} />
            </div>
            <div style={{ width: '68%', padding: '16px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                Total Global Deliverables
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, color: isDark ? '#fff' : '#071733' }}>
                {totalGlobal}
              </div>
            </div>
          </div>
        </Col>

        {/* Global Pending Approvals */}
        <Col xs={24} sm={12} lg={6}>
          <div
            onClick={() => handleKpiCardClick('pending')}
            style={{
              cursor: 'pointer',
              borderRadius: 16,
              overflow: 'hidden',
              background: isDark ? '#111c31' : '#ffffff',
              border: activeFilter === 'pending' 
                ? '2px solid #d97706' 
                : `1px solid ${isDark ? '#22324b' : '#e5ebf3'}`,
              boxShadow: activeFilter === 'pending' 
                ? '0 0 0 3px rgba(217, 119, 6, 0.25), 0 12px 28px rgba(217, 119, 6, 0.15)' 
                : '0 8px 20px rgba(0,0,0,0.04)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: activeFilter === 'pending' ? 'translateY(-3px)' : 'none',
              position: 'relative',
              display: 'flex',
              height: 100
            }}
          >
            {activeFilter === 'pending' && (
              <div style={{
                position: 'absolute', top: 8, right: 10,
                background: '#d97706', color: '#fff', fontSize: 10, fontWeight: 800,
                padding: '2px 8px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4
              }}>
                <CheckOutlined style={{ fontSize: 9 }} /> FILTERED
              </div>
            )}
            <div style={{ width: '32%', background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HourglassOutlined style={{ fontSize: 32, color: '#fff' }} />
            </div>
            <div style={{ width: '68%', padding: '16px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                Global Pending Approvals
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, color: isDark ? '#fff' : '#071733' }}>
                {pendingGlobal}
              </div>
            </div>
          </div>
        </Col>

        {/* Global Completed */}
        <Col xs={24} sm={12} lg={6}>
          <div
            onClick={() => handleKpiCardClick('completed')}
            style={{
              cursor: 'pointer',
              borderRadius: 16,
              overflow: 'hidden',
              background: isDark ? '#111c31' : '#ffffff',
              border: activeFilter === 'completed' 
                ? '2px solid #10b981' 
                : `1px solid ${isDark ? '#22324b' : '#e5ebf3'}`,
              boxShadow: activeFilter === 'completed' 
                ? '0 0 0 3px rgba(16, 185, 129, 0.25), 0 12px 28px rgba(16, 185, 129, 0.15)' 
                : '0 8px 20px rgba(0,0,0,0.04)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: activeFilter === 'completed' ? 'translateY(-3px)' : 'none',
              position: 'relative',
              display: 'flex',
              height: 100
            }}
          >
            {activeFilter === 'completed' && (
              <div style={{
                position: 'absolute', top: 8, right: 10,
                background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 800,
                padding: '2px 8px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4
              }}>
                <CheckOutlined style={{ fontSize: 9 }} /> FILTERED
              </div>
            )}
            <div style={{ width: '32%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: 32, color: '#fff' }} />
            </div>
            <div style={{ width: '68%', padding: '16px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                Global Completed
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, color: isDark ? '#fff' : '#071733' }}>
                {completedGlobal}
              </div>
            </div>
          </div>
        </Col>

        {/* Global Remaining */}
        <Col xs={24} sm={12} lg={6}>
          <div
            onClick={() => handleKpiCardClick('remaining')}
            style={{
              cursor: 'pointer',
              borderRadius: 16,
              overflow: 'hidden',
              background: isDark ? '#111c31' : '#ffffff',
              border: activeFilter === 'remaining' 
                ? '2px solid #ea580c' 
                : `1px solid ${isDark ? '#22324b' : '#e5ebf3'}`,
              boxShadow: activeFilter === 'remaining' 
                ? '0 0 0 3px rgba(234, 88, 12, 0.25), 0 12px 28px rgba(234, 88, 12, 0.15)' 
                : '0 8px 20px rgba(0,0,0,0.04)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: activeFilter === 'remaining' ? 'translateY(-3px)' : 'none',
              position: 'relative',
              display: 'flex',
              height: 100
            }}
          >
            {activeFilter === 'remaining' && (
              <div style={{
                position: 'absolute', top: 8, right: 10,
                background: '#ea580c', color: '#fff', fontSize: 10, fontWeight: 800,
                padding: '2px 8px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4
              }}>
                <CheckOutlined style={{ fontSize: 9 }} /> FILTERED
              </div>
            )}
            <div style={{ width: '32%', background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClockCircleOutlined style={{ fontSize: 32, color: '#fff' }} />
            </div>
            <div style={{ width: '68%', padding: '16px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                Global Remaining
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, color: isDark ? '#fff' : '#071733' }}>
                {remainingGlobal}
              </div>
            </div>
          </div>
        </Col>
      </Row>

      {/* FILTER BUTTONS & SEARCH BAR */}
      <div style={{
        background: isDark ? '#111c31' : '#ffffff',
        padding: '14px 20px',
        borderRadius: 14,
        marginBottom: 20,
        border: `1px solid ${isDark ? '#22324b' : '#e5ebf3'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14
      }}>
        {/* Filter Quick Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FilterOutlined style={{ color: '#3b82f6' }} /> Filters:
          </span>

          <Button
            type={activeFilter === 'all' ? 'primary' : 'default'}
            onClick={() => setActiveFilter('all')}
            style={{ borderRadius: 8, fontWeight: 600, fontSize: 12, height: 34 }}
          >
            All Clients ({clientData.length})
          </Button>

          <Button
            type={activeFilter === 'pending' ? 'primary' : 'default'}
            onClick={() => setActiveFilter('pending')}
            style={{
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 12,
              height: 34,
              background: activeFilter === 'pending' ? '#d97706' : undefined,
              borderColor: activeFilter === 'pending' ? '#d97706' : undefined,
              color: activeFilter === 'pending' ? '#fff' : '#d97706'
            }}
          >
            <HourglassOutlined /> Pending Approvals ({clientData.filter(c => c.pendingApprovalDeliverables > 0).length})
          </Button>

          <Button
            type={activeFilter === 'completed' ? 'primary' : 'default'}
            onClick={() => setActiveFilter('completed')}
            style={{
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 12,
              height: 34,
              background: activeFilter === 'completed' ? '#10b981' : undefined,
              borderColor: activeFilter === 'completed' ? '#10b981' : undefined,
              color: activeFilter === 'completed' ? '#fff' : '#10b981'
            }}
          >
            <CheckCircleOutlined /> Completed ({clientData.filter(c => c.completedDeliverables > 0).length})
          </Button>

          <Button
            type={activeFilter === 'remaining' ? 'primary' : 'default'}
            onClick={() => setActiveFilter('remaining')}
            style={{
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 12,
              height: 34,
              background: activeFilter === 'remaining' ? '#ea580c' : undefined,
              borderColor: activeFilter === 'remaining' ? '#ea580c' : undefined,
              color: activeFilter === 'remaining' ? '#fff' : '#ea580c'
            }}
          >
            <ClockCircleOutlined /> Remaining ({clientData.filter(c => c.remainingDeliverables > 0).length})
          </Button>
        </div>

        {/* Search & Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 260px', maxWidth: 360 }}>
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
            placeholder="Search clients or projects..."
            allowClear
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ borderRadius: 8, height: 34 }}
          />

          {(activeFilter !== 'all' || searchQuery) && (
            <Button
              type="text"
              icon={<CloseCircleOutlined />}
              onClick={() => {
                setActiveFilter('all');
                setSearchQuery('');
              }}
              style={{ borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Active Filter Info Notice */}
      {activeFilter !== 'all' && (
        <div style={{
          marginBottom: 16,
          padding: '8px 16px',
          borderRadius: 8,
          background: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: 13, color: '#2563eb', fontWeight: 600 }}>
            Showing <strong>{filteredClientData.length}</strong> client{filteredClientData.length !== 1 ? 's' : ''} matching <strong>"{getFilterLabel(activeFilter)}"</strong>
          </span>
          <Button 
            size="small" 
            type="link" 
            onClick={() => setActiveFilter('all')}
            style={{ padding: 0, fontWeight: 600, color: '#2563eb' }}
          >
            Show All Clients
          </Button>
        </div>
      )}

      {/* Main Deliverables Table */}
      <Card
        style={{
          borderRadius: 16,
          background: isDark ? '#0b1220' : '#ffffff',
          borderColor: isDark ? '#22324b' : '#e5ebf3',
          boxShadow: '0 8px 24px rgba(0,0,0,0.03)',
          overflow: 'hidden'
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          loading={isLoading}
          columns={columns}
          dataSource={filteredClientData}
          rowKey="clientId"
          expandable={{ expandedRowRender }}
          pagination={{ 
            defaultPageSize: 15, 
            showSizeChanger: true, 
            pageSizeOptions: ['10', '20', '50', '100', '200'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} clients`
          }}
          locale={{
            emptyText: (
              <div style={{ padding: '36px 0', textAlign: 'center' }}>
                <HourglassOutlined style={{ fontSize: 32, color: 'var(--text-tertiary)', marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  No clients found matching the selected filter
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                  Try resetting your filter or searching for another keyword.
                </div>
                <Button type="primary" onClick={() => { setActiveFilter('all'); setSearchQuery(''); }}>
                  Reset Filters
                </Button>
              </div>
            )
          }}
          className="deliverables-table"
        />
      </Card>

      {/* Drawer for Project Tasks */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ProjectOutlined style={{ color: '#3b82f6' }} />
            <span>Tasks for {selectedProjectForTasks?.name || 'Project'}</span>
          </div>
        }
        placement="right"
        width={850}
        open={!!selectedProjectForTasks}
        onClose={() => setSelectedProjectForTasks(null)}
      >
        <Table
          loading={isLoadingTasks}
          dataSource={projectTasks}
          rowKey="_id"
          size="small"
          locale={{
            emptyText: (
              <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: 'var(--text-secondary)' }}>
                    No tasks created for this project yet.
                  </span>
                } 
              />
            )
          }}
          columns={[
            {
              title: 'Title',
              dataIndex: 'title',
              key: 'title',
              render: (text, record) => <a onClick={() => setSelectedTaskDetails(record)} style={{ fontWeight: 600 }}>{text}</a>
            },
            {
              title: 'Deliverable Type',
              dataIndex: 'serviceType',
              key: 'serviceType',
              render: (type) => (
                <Tag style={{ borderRadius: 6, fontSize: 11 }}>
                  {type ? type.replace(/_/g, ' ').toUpperCase() : 'GENERAL'}
                </Tag>
              )
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              render: (status, record) => {
                const isPendingClientApproval = ['review', 'in_review', 'workflow_sent', 'sent_for_client_review', 'complete', 'completed', 'done'].includes(status?.toLowerCase()) && record?.clientReviewStatus !== 'approved';
                let color = 'default';
                if (isPendingClientApproval) color = 'warning';
                else if (status === 'completed' || status === 'approved' || status === 'validated' || status === 'done' || record?.clientReviewStatus === 'approved') color = 'success';
                else if (status === 'in_progress') color = 'processing';
                else if (status === 'workflow_sent' || status === 'sent_for_client_review' || status === 'review' || status === 'in_review') color = 'warning';

                const displayStatus = isPendingClientApproval
                  ? 'PENDING APPROVAL'
                  : (status?.replace(/_/g, ' ')?.toUpperCase() || 'UNKNOWN');

                return (
                  <Tag color={color} style={{ borderRadius: 6 }}>
                    {displayStatus}
                  </Tag>
                );
              }
            },
            {
              title: 'Assigned To',
              dataIndex: 'assignedTo',
              key: 'assignedTo',
              render: (user) => user?.name || 'Unassigned'
            },
            {
              title: 'Due Date',
              dataIndex: 'dueDate',
              key: 'dueDate',
              render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : 'N/A'
            },
            {
              title: 'Action',
              key: 'action',
              render: (_, record) => (
                <Button size="small" type="primary" onClick={() => setSelectedTaskDetails(record)} style={{ borderRadius: 6 }}>
                  View Task
                </Button>
              )
            }
          ]}
        />
      </Drawer>

      <TaskDetailDrawer
        task={selectedTaskDetails}
        visible={!!selectedTaskDetails}
        onClose={() => setSelectedTaskDetails(null)}
        isDeliverablesModule={true}
        onTaskCompleted={() => {
          setShowCelebration(true);
          if (refetchProjects) refetchProjects();
          if (refetchTasks) refetchTasks();
        }}
      />

      <TaskCompletionCelebrate
        isActive={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />
    </div>
  );
};

export default DeliverablesPage;
