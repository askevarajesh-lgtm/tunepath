import React, { useState, useEffect, useMemo } from 'react';
import {
  Table, Button, Form, Input, DatePicker, Select, InputNumber, Drawer,
  Modal, Tabs, Card, Row, Col, Statistic, Space, Tag, Timeline, List,
  Divider, Popconfirm, Calendar, Tooltip, Badge, Avatar, Progress, Checkbox,
  message
} from 'antd';
import {
  PlusOutlined, SearchOutlined, CalendarOutlined, UnorderedListOutlined,
  BarChartOutlined, PaperClipOutlined, FileTextOutlined, TeamOutlined,
  UserOutlined, ClockCircleOutlined, LinkOutlined, DeleteOutlined,
  EditOutlined, CheckCircleOutlined, InfoCircleOutlined, CloseCircleOutlined,
  CalendarTwoTone, WarningOutlined, FileAddOutlined, EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientContext } from '../../contexts/ClientContext';
import {
  useGetEventsQuery, useGetEventByIdQuery, useGetCalendarAnalyticsQuery,
  useCreateEventMutation, useUpdateEventMutation, useDeleteEventMutation,
  useUpdateEventStatusMutation, useAddEventNoteMutation,
  useAddEventAttachmentMutation
} from '../../api/calendarApi';
import { useGetUsersDropdownQuery } from '../../api/userApi';
import { useGetCompaniesDropdownQuery } from '../../api/companyApi';
import { useGetLeadsQuery } from '../../api/leadApi';
import { useGetProjectsDropdownQuery } from '../../api/projectApi';

const { TextArea } = Input;
const { Option } = Select;

// Custom styling for premium UI feel
const cardStyle = (isDark) => ({
  borderRadius: '12px',
  background: isDark ? '#1f1f1f' : '#ffffff',
  boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.05)',
  border: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
  marginBottom: '24px',
  transition: 'transform 0.2s, box-shadow 0.2s',
});

const CalendarPage = () => {
  const { user: currentUser } = useAuth();
  const { isDark } = useTheme();
  const { selectedClient } = useClientContext();
  const userRole = currentUser?.role;

  // Tabs state
  const [activeTab, setActiveTab] = useState('calendar');

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  // Auto-apply global client context — when a client is switched via the top bar,
  // the calendar should show only that client's activities.
  const effectiveClientId = selectedClient?._id || clientFilter || '';

  // When selectedClient changes, clear the manual client filter to avoid conflicts
  useEffect(() => {
    if (selectedClient?._id) {
      setClientFilter('');
    }
  }, [selectedClient?._id]);

  // Calendar dates range
  const [dateRange, setDateRange] = useState({
    startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
    endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
  });

  // Drawers and Modals state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  // selectedEvent holds the full event object so the detail modal can render
  // immediately without an API call for system-generated activities
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  // Helper: open the detail modal for any event object
  const openDetailModal = (item) => {
    setSelectedEvent(item);
    // Only trigger the API lookup for custom calendar events (need notes/attachments)
    setSelectedEventId(item.source === 'custom' || item.source === 'meeting' || item.source === 'task' ? item._id : null);
    setDetailModalVisible(true);
  };

  // Note/Attachment inputs
  const [noteContent, setNoteContent] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  const [form] = Form.useForm();

  // Queries
  const { data: eventsResponse, refetch: refetchEvents, isLoading: isLoadingEvents } = useGetEventsQuery({
    search,
    eventType: typeFilter,
    clientId: effectiveClientId,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  });

  const { data: analyticsResponse, refetch: refetchAnalytics } = useGetCalendarAnalyticsQuery({});

  const { data: detailResponse, refetch: refetchDetail } = useGetEventByIdQuery(selectedEventId, {
    skip: !selectedEventId
  });

  // Dropdowns lists
  const { data: usersData } = useGetUsersDropdownQuery({});
  const { data: companiesData } = useGetCompaniesDropdownQuery({});
  const { data: leadsData } = useGetLeadsQuery({ limit: 500 });
  const { data: projectsData } = useGetProjectsDropdownQuery({});

  // Mutations
  const [createEvent, { isLoading: isCreating }] = useCreateEventMutation();
  const [updateEvent, { isLoading: isUpdating }] = useUpdateEventMutation();
  const [deleteEvent] = useDeleteEventMutation();
  const [updateEventStatus] = useUpdateEventStatusMutation();
  const [addEventNote, { isLoading: isAddingNote }] = useAddEventNoteMutation();
  const [addEventAttachment] = useAddEventAttachmentMutation();

  const events = eventsResponse?.data?.events || [];
  const analytics = analyticsResponse?.data?.analytics || null;
  const detailData = detailResponse?.data || null;

  const users = usersData?.data?.users || usersData?.data || [];
  const clients = companiesData?.data?.companies || companiesData?.data || [];
  const leads = leadsData?.data?.leads || leadsData?.data || [];
  const projects = projectsData?.data?.projects || projectsData?.data || [];

  // Re-fetch on filter changes (including global client switch)
  useEffect(() => {
    refetchEvents();
  }, [search, statusFilter, typeFilter, effectiveClientId, dateRange]);

  // Handle drawer close
  const closeDrawer = () => {
    setDrawerVisible(false);
    setEditingEvent(null);
    form.resetFields();
  };

  // Open drawer for creating
  const openCreateDrawer = () => {
    setEditingEvent(null);
    form.resetFields();
    setDrawerVisible(true);
  };

  // Open drawer for editing
  const openEditDrawer = (event) => {
    if (event.source !== 'custom') {
      message.warning('This event is linked to another module (Meeting/Task/Lead) and must be modified there.');
      return;
    }
    setEditingEvent(event);
    form.setFieldsValue({
      title: event.title,
      dateRange: [dayjs(event.startDateTime), dayjs(event.endDateTime)],
      eventType: event.eventType,
      location: event.location,
      meetingLink: event.meetingLink,
      notes: event.notes,
      clientId: event.clientId?._id || event.clientId,
      leadId: event.leadId?._id || event.leadId,
      projectId: event.projectId?._id || event.projectId,
      attendees: event.attendees?.map(a => a._id || a)
    });
    setDrawerVisible(true);
  };

  // Handle submit create / edit form
  const handleFormSubmit = async (values) => {
    try {
      const payload = {
        title: values.title,
        eventType: values.eventType,
        startDateTime: values.dateRange[0].toISOString(),
        endDateTime: values.dateRange[1].toISOString(),
        location: values.location,
        meetingLink: values.meetingLink,
        notes: values.notes,
        clientId: values.clientId,
        leadId: values.leadId,
        projectId: values.projectId,
        attendees: values.attendees
      };

      if (editingEvent) {
        await updateEvent({ id: editingEvent._id, ...payload }).unwrap();
        message.success('Event updated successfully');
      } else {
        await createEvent(payload).unwrap();
        message.success('Event created successfully');
      }
      refetchEvents();
      refetchAnalytics();
      closeDrawer();
    } catch (err) {
      message.error(err.data?.message || 'Failed to save event');
    }
  };

  // Handle delete event
  const handleDeleteEvent = async (id, source) => {
    if (source !== 'custom') {
      message.warning('Only custom events can be deleted from Calendar. Tasks and Meetings should be deleted in their respective modules.');
      return;
    }
    try {
      await deleteEvent(id).unwrap();
      message.success('Event deleted successfully');
      refetchEvents();
      refetchAnalytics();
    } catch (err) {
      message.error(err.data?.message || 'Failed to delete event');
    }
  };

  // Handle status update
  const handleStatusUpdate = async (id, status, source) => {
    if (source !== 'custom') {
      message.warning('Status for Meetings and Tasks must be updated in their respective modules.');
      return;
    }
    try {
      await updateEventStatus({ id, status }).unwrap();
      message.success(`Event status updated to ${status}`);
      refetchEvents();
      refetchAnalytics();
      if (selectedEventId === id) {
        refetchDetail();
      }
    } catch (err) {
      message.error(err.data?.message || 'Failed to update status');
    }
  };

  // Add Note
  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    try {
      await addEventNote({ id: selectedEventId, content: noteContent }).unwrap();
      setNoteContent('');
      message.success('Note added');
      refetchDetail();
    } catch (err) {
      message.error('Failed to add note');
    }
  };

  // Add Attachment
  const handleAddAttachment = async () => {
    if (!attachmentUrl.trim() || !attachmentName.trim()) return;
    try {
      await addEventAttachment({
        id: selectedEventId,
        url: attachmentUrl,
        fileName: attachmentName,
        fileType: 'link'
      }).unwrap();
      setAttachmentUrl('');
      setAttachmentName('');
      message.success('Attachment added');
      refetchDetail();
    } catch (err) {
      message.error('Failed to add attachment');
    }
  };

  // Status rendering helpers
  const getStatusTag = (status) => {
    const statusMap = {
      upcoming: { color: 'blue', label: 'Upcoming' },
      awaiting_confirmation: { color: 'orange', label: 'Awaiting Confirm' },
      completed: { color: 'green', label: 'Completed' },
      cancelled: { color: 'red', label: 'Cancelled' },
      rescheduled: { color: 'purple', label: 'Rescheduled' },
      missed: { color: 'default', label: 'Missed' }
    };
    const { color, label } = statusMap[status] || { color: 'default', label: status };
    return <Tag color={color}>{label}</Tag>;
  };

  // Render Calendar events
  const getCalendarListData = (value) => {
    const dateStr = value.format('YYYY-MM-DD');
    return events.filter(e => dayjs(e.startDateTime).format('YYYY-MM-DD') === dateStr);
  };

  const calendarDateCellRender = (value) => {
    const listData = getCalendarListData(value);

    // Color map per source: [background, text, border]
    const sourceColors = {
      meeting:              ['#dbeafe', '#1d4ed8', '#93c5fd'],
      task:                 ['#fef3c7', '#b45309', '#fcd34d'],
      lead:                 ['#fee2e2', '#b91c1c', '#fca5a5'],
      client_creation:      ['#e0f2fe', '#0369a1', '#7dd3fc'],
      proposal_created:     ['#ede9fe', '#6d28d9', '#c4b5fd'],
      invoice_created:      ['#d1fae5', '#065f46', '#6ee7b7'],
      project_created:      ['#ecfccb', '#3f6212', '#a3e635'],
      transaction_recorded: ['#fef9c3', '#854d0e', '#fde047'],
      seo_project_created:  ['#ffedd5', '#9a3412', '#fb923c'],
      task_created:         ['#fce7f3', '#9d174d', '#f9a8d4'],
      campaign_created:     ['#fee2e2', '#991b1b', '#f87171'],
      deal_created:         ['#f3e8ff', '#6b21a8', '#d8b4fe'],
      custom:               ['#dcfce7', '#14532d', '#86efac'],
    };

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '90px', overflowY: 'auto' }}>
        {listData.map(item => {
          const [bg, text, border] = sourceColors[item.source] || ['#f3f4f6', '#374151', '#d1d5db'];
          // Strip the bracket prefix like "[Proposal Created] " → keep just the name
          const cleanTitle = item.title.replace(/^\[[^\]]+\]\s*/, '');
          return (
            <li key={item._id} style={{ marginBottom: '3px' }}>
              <Tooltip title={`${item.title} · ${dayjs(item.startDateTime).format('h:mm a')}`}>
                <div
                  onClick={(e) => { e.stopPropagation(); openDetailModal(item); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: '4px',
                    padding: '1px 6px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: text,
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '110px',
                  }}>
                    {cleanTitle}
                  </span>
                </div>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    );
  };

  // Handle month range changes
  const handlePanelChange = (value) => {
    setDateRange({
      startDate: value.startOf('month').format('YYYY-MM-DD'),
      endDate: value.endOf('month').format('YYYY-MM-DD'),
    });
  };

  const handleDateSelect = (value, selectInfo) => {
    if (selectInfo && selectInfo.source !== 'date') return;
    
    const dateStr = value.format('YYYY-MM-DD');
    const listData = getCalendarListData(value);
    if (listData.length > 0) {
      setSelectedDate(dateStr);
      setDayModalVisible(true);
    }
  };

  // Table Columns config
  const columns = [
    {
      title: 'Event Title',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <span
            style={{ fontWeight: 600, color: 'var(--accent-primary)', cursor: 'pointer' }}
            onClick={() => openDetailModal(record)}
          >
            {text}
          </span>
          <div style={{ fontSize: '12px', color: '#8c8c8c', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {record.notes || 'No description provided'}
          </div>
        </div>
      )
    },
    {
      title: 'Timeline',
      dataIndex: 'startDateTime',
      key: 'startDateTime',
      render: (start, record) => (
        <div>
          <Space direction="vertical" size={0}>
            <span><CalendarOutlined style={{ marginRight: 6 }} />{dayjs(start).format('MMM DD, YYYY')}</span>
            <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
              <ClockCircleOutlined style={{ marginRight: 6 }} />
              {dayjs(start).format('h:mm a')} - {dayjs(record.endDateTime).format('h:mm a')}
            </span>
          </Space>
        </div>
      )
    },
    {
      title: 'Event Type',
      dataIndex: 'eventType',
      key: 'eventType',
      render: (type) => (
        <span style={{ textTransform: 'capitalize' }}>
          {type ? type.replace('_', ' ') : 'N/A'}
        </span>
      )
    },
    {
      title: 'Origin Module',
      dataIndex: 'source',
      key: 'source',
      render: (source) => {
        const sourceMap = {
          meeting:              { color: 'blue',    label: 'Meeting' },
          task:                 { color: 'purple',  label: 'Task (Due Date)' },
          lead:                 { color: 'orange',  label: 'CRM Lead Followup' },
          client_creation:      { color: 'cyan',    label: 'Client Created' },
          proposal_created:     { color: 'geekblue',label: 'Proposal Created' },
          invoice_created:      { color: 'green',   label: 'Invoice Created' },
          project_created:      { color: 'lime',    label: 'Project Created' },
          transaction_recorded: { color: 'gold',    label: 'Transaction Recorded' },
          seo_project_created:  { color: 'volcano', label: 'SEO Project Created' },
          task_created:         { color: 'magenta', label: 'Task Created' },
          campaign_created:     { color: 'red',     label: 'Campaign Created' },
          deal_created:         { color: 'purple',  label: 'Deal Created' },
          custom:               { color: 'green',   label: 'Calendar Custom' },
        };
        const item = sourceMap[source] || { color: 'default', label: source || 'Custom' };
        return <Tag color={item.color}>{item.label}</Tag>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status)
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          {/* View button — always visible for every activity */}
          <Tooltip title="View Details">
            <Button
              type="link"
              icon={<EyeOutlined />}
              style={{ color: 'var(--accent-primary)' }}
              onClick={() => openDetailModal(record)}
            />
          </Tooltip>

          {/* Join meeting link */}
          {record.meetingLink && (
            <Tooltip title="Join Meeting">
              <Button
                type="link"
                icon={<LinkOutlined />}
                href={record.meetingLink}
                target="_blank"
                style={{ color: '#52c41a' }}
              />
            </Tooltip>
          )}

          {/* Edit / Delete only for custom calendar events */}
          {record.source === 'custom' && ['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'agency_manager'].includes(userRole) && (
            <>
              <Tooltip title="Edit">
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => openEditDrawer(record)}
                />
              </Tooltip>
              <Popconfirm
                title="Are you sure to delete this event?"
                onConfirm={() => handleDeleteEvent(record._id, record.source)}
                okText="Yes"
                cancelText="No"
              >
                <Tooltip title="Delete">
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ minHeight: '100vh', background: isDark ? '#0d1526' : '#f5f7fa' }}>

      {/* Top Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: isDark ? '#ffffff' : '#1f1f1f' }}>
            Calendar Dashboard
          </h1>
          <p style={{ margin: 0, color: '#8c8c8c' }}>
            Centralized schedule system monitoring Tasks, Client reviews, Campaigns, and Meetings.
          </p>
        </div>
        {['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'agency_manager'].includes(userRole) && (
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={openCreateDrawer}
            style={{ borderRadius: '8px', background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary) 100%)', border: 'none' }}
          >
            Create Event
          </Button>
        )}
      </div>

      {/* KPI Stats Cards */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24, marginTop: 16 }}>
        <Col xs={12} sm={6}>
          <Card bodyStyle={{ padding: '30px 24px 24px', textAlign: 'center', position: 'relative' }} style={{ borderRadius: 16, background: isDark ? '#111c31' : '#ffffff', boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.08)', border: 'none', marginTop: 15 }}>
            <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(67, 56, 202, 0.4)' }}>
              <CalendarTwoTone style={{ fontSize: 24 }} twoToneColor="#ffffff" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 12 }}>Total Events</div>
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: isDark ? '#fff' : '#111c31' }}>{analytics?.totalEvents || events.length}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bodyStyle={{ padding: '30px 24px 24px', textAlign: 'center', position: 'relative' }} style={{ borderRadius: 16, background: isDark ? '#111c31' : '#ffffff', boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.08)', border: 'none', marginTop: 15 }}>
            <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #115e59 0%, #0d9488 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(13, 148, 136, 0.4)' }}>
              <ClockCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 12 }}>Upcoming</div>
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: isDark ? '#fff' : '#111c31' }}>{analytics?.statusStats?.upcoming || events.filter(e => e.status === 'upcoming').length}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bodyStyle={{ padding: '30px 24px 24px', textAlign: 'center', position: 'relative' }} style={{ borderRadius: 16, background: isDark ? '#111c31' : '#ffffff', boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.08)', border: 'none', marginTop: 15 }}>
            <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #701a75 0%, #a21caf 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(162, 28, 175, 0.4)' }}>
              <TeamOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 12 }}>Meetings</div>
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: isDark ? '#fff' : '#111c31' }}>{analytics?.meetingsCount || 0}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bodyStyle={{ padding: '30px 24px 24px', textAlign: 'center', position: 'relative' }} style={{ borderRadius: 16, background: isDark ? '#111c31' : '#ffffff', boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.08)', border: 'none', marginTop: 15 }}>
            <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #831843 0%, #be123c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(190, 18, 60, 0.4)' }}>
              <CheckCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 12 }}>Task Deadlines</div>
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: isDark ? '#fff' : '#111c31' }}>{analytics?.tasksCount || 0}</div>
          </Card>
        </Col>
      </Row>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        style={{ marginBottom: '24px' }}
        items={[
          {
            key: 'calendar',
            label: <span><CalendarOutlined />Calendar View</span>,
            children: (
              <Card style={{ borderRadius: '12px', padding: '16px' }}>
                {/* Search & Filters */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  <Input
                    placeholder="Search event title, details..."
                    prefix={<SearchOutlined />}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: 280, borderRadius: '8px' }}
                  />
                  <Select
                    placeholder="Filter by Type"
                    value={typeFilter}
                    onChange={setTypeFilter}
                    style={{ width: 180 }}
                    allowClear
                  >
                    <Option value="client_review">Client Review</Option>
                    <Option value="strategy_call">Strategy Call</Option>
                    <Option value="campaign_launch">Campaign Launch</Option>
                    <Option value="content_approval">Content Approval</Option>
                    <Option value="internal_sync">Internal Sync</Option>
                    <Option value="sales_call">Sales Call</Option>
                    <Option value="client_creation">Client Creation</Option>
                    <Option value="proposal_review">Proposal Review</Option>
                    <Option value="retainer_renewal">Retainer Renewal</Option>
                    <Option value="performance_review">Performance Review</Option>
                    <Option value="team_meeting">Team Meeting</Option>
                  </Select>
                  <Select
                    placeholder="Filter by Client"
                    value={clientFilter}
                    onChange={setClientFilter}
                    style={{ width: 200 }}
                    allowClear
                  >
                    {clients.map(c => (
                      <Option key={c._id} value={c._id}>{c.companyName || c.name}</Option>
                    ))}
                  </Select>
                </div>

                <Calendar
                  dateCellRender={calendarDateCellRender}
                  onPanelChange={handlePanelChange}
                  onSelect={handleDateSelect}
                />
              </Card>
            )
          },
          {
            key: 'list',
            label: <span><UnorderedListOutlined />Agenda View</span>,
            children: (
              <Card style={{ borderRadius: '12px', padding: '16px' }}>
                <Table
                  columns={columns}
                  dataSource={events}
                  rowKey="_id"
                  loading={isLoadingEvents}
                  pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                />
              </Card>
            )
          },
          {
            key: 'analytics',
            label: <span><BarChartOutlined />Analytics</span>,
            children: (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Card title="Event Categories Distribution" style={cardStyle(isDark)}>
                    <List
                      dataSource={Object.keys(analytics?.typeStats || {})}
                      renderItem={type => (
                        <List.Item>
                          <span style={{ textTransform: 'capitalize' }}>{type.replace('_', ' ')}</span>
                          <strong>{analytics.typeStats[type]}</strong>
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="Activity Summary Breakdown" style={cardStyle(isDark)}>
                    <p>Custom Events: <strong>{analytics?.customEventsCount || 0}</strong></p>
                    <p>Meetings: <strong>{analytics?.meetingsCount || 0}</strong></p>
                    <p>Tasks (by due date): <strong>{analytics?.tasksCount || 0}</strong></p>
                    <p>Proposals Created: <strong>{analytics?.proposalsCount || 0}</strong></p>
                    <p>Invoices Created: <strong>{analytics?.invoicesCount || 0}</strong></p>
                    <p>Projects Created: <strong>{analytics?.projectsCount || 0}</strong></p>
                    <p>Transactions Recorded: <strong>{analytics?.transactionsCount || 0}</strong></p>
                    <p>SEO Projects Created: <strong>{analytics?.seoProjectsCount || 0}</strong></p>
                    <p>Campaigns Created: <strong>{analytics?.campaignsCount || 0}</strong></p>
                    <p>Sales Deals Created: <strong>{analytics?.dealsCount || 0}</strong></p>
                  </Card>
                </Col>
              </Row>
            )
          }
        ]}
      />

      {/* Create/Edit Drawer */}
      <Drawer
        title={editingEvent ? "Modify Custom Event" : "Create Custom Event"}
        width={560}
        onClose={closeDrawer}
        open={drawerVisible}
        styles={{ body: { paddingBottom: 80 } }}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button onClick={closeDrawer} style={{ marginRight: 8 }}>
              Cancel
            </Button>
            <Button
              onClick={() => form.submit()}
              type="primary"
              loading={isCreating || isUpdating}
            >
              {editingEvent ? "Save Changes" : "Create Event"}
            </Button>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
        >
          <Form.Item
            name="title"
            label="Event Title"
            rules={[{ required: true, message: 'Please enter event title' }]}
          >
            <Input placeholder="Enter title" />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="Timing (Start & End Date/Time)"
            rules={[{ required: true, message: 'Please select start and end time' }]}
          >
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="eventType"
            label="Event Category"
            rules={[{ required: true, message: 'Please select category' }]}
          >
            <Select placeholder="Select category">
              <Option value="client_review">Client Review</Option>
              <Option value="strategy_call">Strategy Call</Option>
              <Option value="campaign_launch">Campaign Launch</Option>
              <Option value="content_approval">Content Approval</Option>
              <Option value="internal_sync">Internal Sync</Option>
              <Option value="sales_call">Sales Call</Option>
              <Option value="proposal_review">Proposal Review</Option>
              <Option value="retainer_renewal">Retainer Renewal</Option>
              <Option value="performance_review">Performance Review</Option>
              <Option value="team_meeting">Team Meeting</Option>
              <Option value="other">Other</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="location"
            label="Location"
          >
            <Input placeholder="e.g. Conf Room A or Google Meet" />
          </Form.Item>

          <Form.Item
            name="meetingLink"
            label="Meeting Link"
          >
            <Input prefix={<LinkOutlined />} placeholder="https://..." />
          </Form.Item>

          <Form.Item
            name="notes"
            label="Agenda & Notes"
          >
            <TextArea rows={3} placeholder="Event description details..." />
          </Form.Item>

          <Form.Item
            name="attendees"
            label="Attendees"
          >
            <Select mode="multiple" placeholder="Select attendees" filterOption={(input, option) => option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0}>
              {users.map(u => (
                <Option key={u._id} value={u._id}>{u.name} ({u.role})</Option>
              ))}
            </Select>
          </Form.Item>

          <Divider>Associated Items (Optional)</Divider>

          <Form.Item
            name="clientId"
            label="Client / Brand Account"
          >
            <Select placeholder="Select client" allowClear>
              {clients.map(c => (
                <Option key={c._id} value={c._id}>{c.companyName || c.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="leadId"
            label="CRM Lead"
          >
            <Select placeholder="Select lead" allowClear>
              {leads.map(l => (
                <Option key={l._id} value={l._id}>{l.fullName} ({l.companyName})</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="projectId"
            label="Linked Project"
          >
            <Select placeholder="Select project" allowClear>
              {projects.map(p => (
                <Option key={p._id} value={p._id}>{p.name}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail Modal — renders directly from selectedEvent; no API call needed for system activities */}
      <Modal
        title={
          selectedEvent ? (
            <div>
              <span style={{ fontSize: '18px', fontWeight: 600 }}>{selectedEvent.title}</span>
              <div style={{ marginTop: 4 }}>{getStatusTag(selectedEvent.status)}</div>
            </div>
          ) : null
        }
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedEventId(null);
          setSelectedEvent(null);
        }}
        footer={null}
        width={720}
        styles={{ body: { padding: '0 24px 24px 24px' } }}
      >
        {selectedEvent ? (() => {
          // Use full selectedEvent for immediate rendering
          const ev = detailData?.event || selectedEvent;
          const isCustom = selectedEvent.source === 'custom';

          // Source label map
          const sourceLabels = {
            meeting: 'Meeting',
            task: 'Task (Due Date)',
            lead: 'CRM Lead Followup',
            client_creation: 'Client Created',
            proposal_created: 'Proposal Created',
            invoice_created: 'Invoice Created',
            project_created: 'Project Created',
            transaction_recorded: 'Transaction Recorded',
            seo_project_created: 'SEO Project Created',
            task_created: 'Task Created',
            campaign_created: 'Campaign Created',
            deal_created: 'Deal Created',
            custom: 'Calendar Custom',
          };

          return (
            <Tabs
              defaultActiveKey="overview"
              style={{ marginTop: '16px' }}
              items={[
                {
                  key: 'overview',
                  label: 'Overview',
                  children: (
                    <Row gutter={16}>
                      <Col span={14}>
                        <p><strong>Description / Notes:</strong></p>
                        <p style={{ color: '#555', lineHeight: 1.7 }}>{ev.notes || 'No additional notes.'}</p>

                        <p style={{ marginTop: 16 }}>
                          <strong>Date:</strong>{' '}
                          {ev.startDateTime ? dayjs(ev.startDateTime).format('MMMM DD, YYYY') : 'N/A'}
                        </p>
                        <p>
                          <strong>Time:</strong>{' '}
                          {ev.startDateTime ? dayjs(ev.startDateTime).format('h:mm a') : ''}{' — '}
                          {ev.endDateTime ? dayjs(ev.endDateTime).format('h:mm a') : ''}
                        </p>

                        {ev.location && ev.location !== 'System' && (
                          <p><strong>Location:</strong> {ev.location}</p>
                        )}

                        {ev.meetingLink && (
                          <Button
                            type="primary"
                            icon={<LinkOutlined />}
                            href={ev.meetingLink}
                            target="_blank"
                            style={{ marginBottom: '16px' }}
                          >
                            Join Meeting Link
                          </Button>
                        )}

                        {(ev.host?.name || (Array.isArray(ev.attendees) && ev.attendees.length > 0)) && (
                          <>
                            <Divider />
                            {ev.host?.name && <p><strong>Host / Created By:</strong> {ev.host.name}</p>}
                            {Array.isArray(ev.attendees) && ev.attendees.length > 0 && (
                              <>
                                <p><strong>Attendees:</strong></p>
                                <List
                                  size="small"
                                  dataSource={ev.attendees}
                                  renderItem={p => (
                                    <List.Item key={p._id || p}>
                                      <Space>
                                        <Avatar size="small" icon={<UserOutlined />} src={p.logo} />
                                        <span>{p.name || p}</span>
                                      </Space>
                                    </List.Item>
                                  )}
                                />
                              </>
                            )}
                          </>
                        )}
                      </Col>

                      <Col span={10}>
                        <Card
                          title="Activity Details"
                          size="small"
                          style={{ borderRadius: 8 }}
                          bodyStyle={{ padding: '12px 16px' }}
                        >
                          <p style={{ marginBottom: 8 }}>
                            <strong>Module:</strong>{' '}
                            <Tag color="geekblue" style={{ marginLeft: 4 }}>
                              {sourceLabels[selectedEvent.source] || selectedEvent.source}
                            </Tag>
                          </p>
                          <p style={{ marginBottom: 8 }}>
                            <strong>Status:</strong> {getStatusTag(ev.status)}
                          </p>
                          {ev.clientId && (
                            <p style={{ marginBottom: 8 }}>
                              <strong>Client:</strong>{' '}
                              {ev.clientId?.companyName || ev.clientId?.name || 'N/A'}
                            </p>
                          )}
                          {ev.projectId && (
                            <p style={{ marginBottom: 8 }}>
                              <strong>Project:</strong>{' '}
                              {ev.projectId?.name || 'N/A'}
                            </p>
                          )}
                        </Card>
                      </Col>
                    </Row>
                  ),
                },
                // Notes & Attachments tabs only for custom calendar events
                ...(isCustom ? [
                  {
                    key: 'notes',
                    label: 'Event Notes',
                    children: (
                      <>
                        <List
                          dataSource={Array.isArray(detailData?.notes) ? detailData.notes : []}
                          style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}
                          renderItem={note => (
                            <List.Item key={note._id}>
                              <List.Item.Meta
                                avatar={<Avatar icon={<UserOutlined />} />}
                                title={<span>{note.createdBy?.name || 'User'} <span style={{ fontSize: '11px', color: '#bfbfbf' }}>{dayjs(note.createdAt).format('MMM D, h:mm a')}</span></span>}
                                description={note.content}
                              />
                            </List.Item>
                          )}
                        />
                        <Divider />
                        <Form.Item label="Add note / comment">
                          <TextArea
                            rows={3}
                            value={noteContent}
                            onChange={e => setNoteContent(e.target.value)}
                            placeholder="Type details or discussions..."
                          />
                          <Button
                            type="primary"
                            style={{ marginTop: 12 }}
                            onClick={handleAddNote}
                            loading={isAddingNote}
                          >
                            Post Note
                          </Button>
                        </Form.Item>
                      </>
                    ),
                  },
                  {
                    key: 'attachments',
                    label: 'Attachments',
                    children: (
                      <>
                        <List
                          dataSource={Array.isArray(detailData?.attachments) ? detailData.attachments : []}
                          renderItem={att => (
                            <List.Item key={att._id}>
                              <Space>
                                <PaperClipOutlined />
                                <a href={att.url} target="_blank" rel="noreferrer">{att.fileName}</a>
                              </Space>
                            </List.Item>
                          )}
                        />
                        <Divider />
                        <h4>Link Proposal / Doc Link</h4>
                        <Form layout="vertical">
                          <Form.Item label="Document Name" required>
                            <Input value={attachmentName} onChange={e => setAttachmentName(e.target.value)} placeholder="e.g. SEO Campaign Proposal" />
                          </Form.Item>
                          <Form.Item label="Document URL" required>
                            <Input value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} placeholder="https://drive.google.com/..." />
                          </Form.Item>
                          <Button type="primary" onClick={handleAddAttachment}>
                            Add Document
                          </Button>
                        </Form>
                      </>
                    ),
                  },
                ] : []),
              ]}
            />
          );
        })() : (
          <div style={{ textAlign: 'center', padding: '24px' }}>Select an activity to view details.</div>
        )}
      </Modal>

      {/* Day Events Modal */}
      <Modal
        title={`Activities for ${dayjs(selectedDate).format('MMMM DD, YYYY')}`}
        open={dayModalVisible}
        onCancel={() => {
          setDayModalVisible(false);
          setSelectedDate(null);
        }}
        footer={null}
        width={600}
      >
        <List
          itemLayout="horizontal"
          style={{ maxHeight: '60vh', overflowY: 'auto' }}
          dataSource={selectedDate ? events.filter(e => dayjs(e.startDateTime).format('YYYY-MM-DD') === selectedDate) : []}
          renderItem={item => (
            <List.Item
              actions={[
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    setDayModalVisible(false);
                    openDetailModal(item);
                  }}
                >
                  View Details
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={getStatusTag(item.status)}
                title={<span>{item.title}</span>}
                description={
                  <Space direction="vertical" size={0}>
                    <span style={{ fontSize: '12px' }}>
                      <ClockCircleOutlined style={{ marginRight: 6 }} />
                      {dayjs(item.startDateTime).format('h:mm a')} - {dayjs(item.endDateTime).format('h:mm a')}
                    </span>
                    <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                      {item.notes || 'No additional details provided.'}
                    </span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

    </div>
  );
};

export default CalendarPage;
