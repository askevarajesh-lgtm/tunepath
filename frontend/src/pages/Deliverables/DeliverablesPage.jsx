import React, { useMemo, useState } from 'react';
import {
  Table, Typography, Card, Progress, Tag, Space, Tooltip, Row, Col, Statistic, Button, Drawer
} from 'antd';
import {
  ProjectOutlined, CheckCircleOutlined, ClockCircleOutlined, ProfileOutlined, EyeOutlined
} from '@ant-design/icons';
import { useGetProjectsQuery } from '../../api/projectApi';
import { useGetTasksQuery } from '../../api/taskApi';
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

  // Fetch all projects (populated with clientId)
  const { data: projectsResponse, isLoading, refetch: refetchProjects } = useGetProjectsQuery({ limit: 1000 });
  const projects = projectsResponse?.data?.data || projectsResponse?.data?.projects || [];

  const { data: tasksData, isLoading: isLoadingTasks, refetch: refetchTasks } = useGetTasksQuery(
    { projectId: selectedProjectForTasks?._id, limit: 1000 },
    { skip: !selectedProjectForTasks }
  );
  const projectTasks = tasksData?.data?.data || tasksData?.data?.tasks || [];

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
          remainingDeliverables: 0
        };
      }

      // Aggregate core project specific deliverable fields
      const pTotal = (project.numberOfPosters || 0) + (project.numberOfVideos || 0) + (project.numberOfShoots || 0);
      const pCompleted = (project.approvedPosters || 0) + (project.approvedVideos || 0) + (project.approvedShoots || 0);

      let extraTotal = 0;
      let extraCompleted = 0;

      // also check selectedCategories for custom deliverables
      if (project.selectedCategories && Array.isArray(project.selectedCategories)) {
        project.selectedCategories.forEach(cat => {
          const rawName = cat.name || cat.categoryName || "";
          const isStandard = ["poster", "video", "shoot"].some(k => rawName.toLowerCase().includes(k));
          if (!isStandard) {
            extraTotal += (cat.quantity || cat.count || 0);
            extraCompleted += (cat.approved || 0);
          }
        });
      }

      const totalD = pTotal + extraTotal;
      const compD = pCompleted + extraCompleted;
      const remD = totalD - compD;

      clientsMap[clientId].totalDeliverables += totalD;
      clientsMap[clientId].remainingDeliverables += remD;
      clientsMap[clientId].completedDeliverables += compD;

      clientsMap[clientId].projects.push({
        ...project,
        projectTotal: totalD,
        projectRemaining: remD,
        projectCompleted: compD
      });
    });

    return Object.values(clientsMap);
  }, [projects]);

  const columns = [
    {
      title: 'Client',
      dataIndex: 'clientName',
      key: 'clientName',
      render: (text, record) => (
        <Space>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: '#e6f7ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', fontWeight: 'bold'
          }}>
            {text.charAt(0).toUpperCase()}
          </div>
          <div>
            <Text strong>{text}</Text>
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
        <Tag color="blue" icon={<ProjectOutlined />}>
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
          <Text strong style={{ fontSize: 16 }}>{val}</Text>
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
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <Text type="success" strong style={{ fontSize: 16 }}>{val}</Text>
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
          <ClockCircleOutlined style={{ color: '#faad14' }} />
          <Text type="warning" strong style={{ fontSize: 16 }}>{val}</Text>
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
          <Tooltip title={`${record.completedDeliverables} / ${record.totalDeliverables} Completed`}>
            <Progress
              percent={percent}
              size="small"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </Tooltip>
        );
      }
    }
  ];

  const expandedRowRender = (record) => {
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
        render: (status) => {
          let color = 'default';
          if (status === 'completed' || status === 'approved') color = 'success';
          else if (status === 'in_progress') color = 'processing';
          else if (status === 'workflow_sent' || status === 'sent_for_client_review' || status === 'project_near_due_date') color = 'warning';

          return (
            <Tag color={color}>
              {status?.replace(/_/g, ' ')?.toUpperCase() || 'UNKNOWN'}
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
        title: 'Completed',
        dataIndex: 'projectCompleted',
        key: 'projectCompleted',
        align: 'center',
        render: (val) => <Text type="success">{val}</Text>
      },
      {
        title: 'Remaining',
        dataIndex: 'projectRemaining',
        key: 'projectRemaining',
        align: 'center',
        render: (val) => <Text type="warning">{val}</Text>
      },
      {
        title: 'Completion',
        key: 'completion',
        render: (_, pRecord) => {
          const percent = pRecord.projectTotal > 0 ? Math.round((pRecord.projectCompleted / pRecord.projectTotal) * 100) : 0;
          return <Progress type="circle" percent={percent} size={30} />;
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
            onClick={() => setSelectedProjectForTasks(pRecord)}
          >
            Tasks
          </Button>
        )
      }
    ];

    return (
      <div style={{ padding: '16px 24px', background: isDark ? '#111c31' : '#f9f9f9', borderRadius: '8px' }}>
        <Text strong style={{ marginBottom: 16, display: 'block' }}>Client Projects Breakdown</Text>
        <Table
          columns={projectCols}
          dataSource={record.projects}
          pagination={false}
          rowKey="_id"
          size="small"
          bordered
          style={{ background: isDark ? '#0b1220' : '#ffffff' }}
        />
      </div>
    );
  };

  const totalGlobal = clientData.reduce((acc, curr) => acc + curr.totalDeliverables, 0);
  const completedGlobal = clientData.reduce((acc, curr) => acc + curr.completedDeliverables, 0);
  const remainingGlobal = clientData.reduce((acc, curr) => acc + curr.remainingDeliverables, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Client Deliverables</Title>
          <Text type="secondary">Overview of deliverable commitments and progress across all your clients.</Text>
        </div>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card bodyStyle={{ padding: 0, display: 'flex', height: '100%' }} style={{ borderRadius: 16, border: 'none', background: isDark ? '#111c31' : '#ffffff', boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ width: '35%', background: 'linear-gradient(135deg, var(--accent-primary) 0%, #0284c7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <ProfileOutlined style={{ fontSize: 40, color: '#fff' }} />
            </div>
            <div style={{ width: '65%', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Total Global Deliverables</div>
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color: isDark ? '#fff' : '#111c31' }}>{totalGlobal}</div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card bodyStyle={{ padding: 0, display: 'flex', height: '100%' }} style={{ borderRadius: 16, border: 'none', background: isDark ? '#111c31' : '#ffffff', boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ width: '35%', background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <CheckCircleOutlined style={{ fontSize: 40, color: '#fff' }} />
            </div>
            <div style={{ width: '65%', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Global Completed</div>
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color: isDark ? '#fff' : '#111c31' }}>{completedGlobal}</div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card bodyStyle={{ padding: 0, display: 'flex', height: '100%' }} style={{ borderRadius: 16, border: 'none', background: isDark ? '#111c31' : '#ffffff', boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ width: '35%', background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <ClockCircleOutlined style={{ fontSize: 40, color: '#fff' }} />
            </div>
            <div style={{ width: '65%', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Global Remaining</div>
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color: isDark ? '#fff' : '#111c31' }}>{remainingGlobal}</div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        style={{
          borderRadius: 12,
          background: isDark ? '#0b1220' : '#ffffff',
          borderColor: isDark ? '#303030' : '#f0f0f0'
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          loading={isLoading}
          columns={columns}
          dataSource={clientData}
          rowKey="clientId"
          expandable={{ expandedRowRender }}
          pagination={{ pageSize: 15 }}
          className="deliverables-table"
        />
      </Card>

      <Drawer
        title={`Tasks for ${selectedProjectForTasks?.name || 'Project'}`}
        placement="right"
        width={800}
        open={!!selectedProjectForTasks}
        onClose={() => setSelectedProjectForTasks(null)}
      >
        <Table
          loading={isLoadingTasks}
          dataSource={projectTasks}
          rowKey="_id"
          size="small"
          columns={[
            {
              title: 'Title',
              dataIndex: 'title',
              key: 'title',
              render: (text, record) => <a onClick={() => setSelectedTaskDetails(record)}>{text}</a>
            },
            {
              title: 'Deliverable Type',
              dataIndex: 'serviceType',
              key: 'serviceType',
              render: (type) => type ? type.toUpperCase() : 'N/A'
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              render: (status) => {
                let color = 'default';
                if (status === 'completed' || status === 'approved' || status === 'validated' || status === 'done') color = 'success';
                else if (status === 'in_progress') color = 'processing';
                else if (status === 'workflow_sent' || status === 'sent_for_client_review' || status === 'review' || status === 'in_review') color = 'warning';

                return (
                  <Tag color={color}>
                    {status?.replace(/_/g, ' ')?.toUpperCase() || 'UNKNOWN'}
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
                <Button size="small" type="primary" onClick={() => setSelectedTaskDetails(record)}>
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
