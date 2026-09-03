import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Button, Form, Input, DatePicker, TimePicker, Select, InputNumber, Drawer, 
  Modal, Tabs, Card, Row, Col, Statistic, Space, Tag, Timeline, List, 
  Divider, Popconfirm, Calendar, Tooltip, Badge, Avatar, Progress, Checkbox,
  Upload, message
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, CalendarOutlined, UnorderedListOutlined, 
  BarChartOutlined, PaperClipOutlined, FileTextOutlined, TeamOutlined, 
  UserOutlined, ClockCircleOutlined, LinkOutlined, DeleteOutlined, 
  EditOutlined, CheckCircleOutlined, InfoCircleOutlined, CloseCircleOutlined,
  CalendarTwoTone, WarningOutlined, FileAddOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  useGetMeetingsQuery, useGetMeetingByIdQuery, useGetMeetingAnalyticsQuery, 
  useCreateMeetingMutation, useUpdateMeetingMutation, useDeleteMeetingMutation, 
  useUpdateMeetingStatusMutation, useAddMeetingNoteMutation, 
  useUpdateMeetingNoteMutation, useDeleteMeetingNoteMutation,
  useAddMeetingAttachmentMutation, useRemoveMeetingAttachmentMutation,
  useCreateFollowUpMutation, useUpdateFollowUpMutation,
  useCompleteFollowUpMutation, useDeleteFollowUpMutation
} from '../../api/meetingApi';
import { useGetUsersDropdownQuery } from '../../api/userApi';
import { useGetCompaniesDropdownQuery } from '../../api/companyApi';
import { useGetLeadsQuery } from '../../api/leadApi';
import { useGetProjectsDropdownQuery } from '../../api/projectApi';

const { TextArea } = Input;
const { Option } = Select;

// Custom styling for premium UI feel
const cardStyle = (isDark) => ({
  borderRadius: '12px',
  background: isDark ? '#111c31' : '#ffffff',
  boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.05)',
  border: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
  marginBottom: '24px',
  transition: 'transform 0.2s, box-shadow 0.2s',
});

const MeetingsPage = () => {
  const { user: currentUser } = useAuth();
  const { isDark } = useTheme();
  const userRole = currentUser?.role;

  const isClientRole = ['client', 'agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user'].includes(userRole);
  const canManageMeetings = ['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'agency_manager'].includes(userRole);
  const canCreateMeeting = canManageMeetings || isClientRole;

  // Tabs state
  const [activeTab, setActiveTab] = useState('list');

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Drawers and Modals state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  
  // Note/Followup/Attachment inputs
  const [noteContent, setNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);

  const [followUpDescription, setFollowUpDescription] = useState('');
  const [followUpAssignedTo, setFollowUpAssignedTo] = useState('');
  const [followUpDueDate, setFollowUpDueDate] = useState(null);
  const [followUpCreateTask, setFollowUpCreateTask] = useState(false);
  const [editingFollowUpId, setEditingFollowUpId] = useState(null);
  
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  const [form] = Form.useForm();

  // Queries
  const { data: meetingsResponse, refetch: refetchMeetings, isLoading: isLoadingMeetings } = useGetMeetingsQuery({
    search,
    status: statusFilter,
    meetingType: typeFilter
  });
  
  const { data: analyticsResponse, refetch: refetchAnalytics } = useGetMeetingAnalyticsQuery({});
  
  const { data: detailResponse, refetch: refetchDetail } = useGetMeetingByIdQuery(selectedMeetingId, {
    skip: !selectedMeetingId
  });

  // Dropdown lists
  const { data: usersData } = useGetUsersDropdownQuery({});
  const { data: companiesData } = useGetCompaniesDropdownQuery({});
  const { data: leadsData } = useGetLeadsQuery({ limit: 500 });
  const { data: projectsData } = useGetProjectsDropdownQuery({});

  // Mutations
  const [createMeeting, { isLoading: isCreating }] = useCreateMeetingMutation();
  const [updateMeeting, { isLoading: isUpdating }] = useUpdateMeetingMutation();
  const [deleteMeeting] = useDeleteMeetingMutation();
  const [updateMeetingStatus] = useUpdateMeetingStatusMutation();
  const [addMeetingNote, { isLoading: isAddingNote }] = useAddMeetingNoteMutation();
  const [updateMeetingNote, { isLoading: isUpdatingNote }] = useUpdateMeetingNoteMutation();
  const [deleteMeetingNote] = useDeleteMeetingNoteMutation();

  const [addMeetingAttachment] = useAddMeetingAttachmentMutation();
  const [removeMeetingAttachment] = useRemoveMeetingAttachmentMutation();

  const [createFollowUp, { isLoading: isCreatingFollowUp }] = useCreateFollowUpMutation();
  const [updateFollowUp, { isLoading: isUpdatingFollowUp }] = useUpdateFollowUpMutation();
  const [completeFollowUp] = useCompleteFollowUpMutation();
  const [deleteFollowUp] = useDeleteFollowUpMutation();

  const meetings = meetingsResponse?.data?.meetings || [];
  const analytics = analyticsResponse?.data?.analytics || null;
  const detailData = detailResponse?.data || null;

  const users = usersData?.data?.users || usersData?.data || [];
  const clients = companiesData?.data?.companies || companiesData?.data || [];
  const leads = leadsData?.data?.leads || leadsData?.data || [];
  const projects = projectsData?.data?.projects || projectsData?.data || [];

  // Re-fetch on filter changes
  useEffect(() => {
    refetchMeetings();
  }, [search, statusFilter, typeFilter]);

  // Handle drawer close
  const closeDrawer = () => {
    setDrawerVisible(false);
    setEditingMeeting(null);
    form.resetFields();
  };

  // Open drawer for creating
  const openCreateDrawer = () => {
    setEditingMeeting(null);
    form.resetFields();
    setDrawerVisible(true);
  };

  // Open drawer for editing
  const openEditDrawer = (meeting) => {
    setEditingMeeting(meeting);
    form.setFieldsValue({
      title: meeting.title,
      date: meeting.date ? dayjs(meeting.date) : null,
      time: meeting.time ? (dayjs.isDayjs(meeting.time) ? meeting.time : dayjs(meeting.time, ['HH:mm', 'h:mm A', 'hh:mm A', 'HH:mm:ss'])) : null,
      duration: meeting.duration,
      meetingType: meeting.meetingType,
      agenda: meeting.agenda,
      meetingLink: meeting.meetingLink,
      clientId: meeting.clientId?._id || meeting.clientId,
      leadId: meeting.leadId?._id || meeting.leadId,
      projectId: meeting.projectId?._id || meeting.projectId,
      participants: meeting.participants?.map(p => p._id || p)
    });
    setDrawerVisible(true);
  };

  // Handle submit create / edit form
  const handleFormSubmit = async (values) => {
    try {
      let finalParticipants = values.participants;
      if (isClientRole && finalParticipants && !Array.isArray(finalParticipants)) {
        finalParticipants = [finalParticipants];
      }

      const payload = {
        ...values,
        participants: finalParticipants,
        date: values.date ? values.date.format('YYYY-MM-DD') : '',
        time: values.time ? (typeof values.time === 'string' ? values.time : values.time.format('HH:mm')) : '',
      };

      if (editingMeeting) {
        await updateMeeting({ id: editingMeeting._id, ...payload }).unwrap();
        message.success('Meeting updated successfully');
      } else {
        await createMeeting(payload).unwrap();
        message.success('Meeting scheduled successfully');
      }
      refetchMeetings();
      refetchAnalytics();
      closeDrawer();
    } catch (err) {
      message.error(err.data?.message || 'Failed to save meeting');
    }
  };

  // Handle delete meeting
  const handleDeleteMeeting = async (id) => {
    try {
      await deleteMeeting(id).unwrap();
      message.success('Meeting deleted successfully');
      refetchMeetings();
      refetchAnalytics();
    } catch (err) {
      message.error(err.data?.message || 'Failed to delete meeting');
    }
  };

  // Handle status update
  const handleStatusUpdate = async (id, status) => {
    try {
      await updateMeetingStatus({ id, status }).unwrap();
      message.success(`Meeting marked as ${status}`);
      refetchMeetings();
      refetchAnalytics();
      if (selectedMeetingId === id) {
        refetchDetail();
      }
    } catch (err) {
      message.error(err.data?.message || 'Failed to update meeting status');
    }
  };

  // Add or Save an edited Note
  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    try {
      if (editingNoteId) {
        await updateMeetingNote({ id: selectedMeetingId, noteId: editingNoteId, content: noteContent }).unwrap();
        message.success('Note updated');
      } else {
        await addMeetingNote({ id: selectedMeetingId, content: noteContent }).unwrap();
        message.success('Note added');
      }
      setNoteContent('');
      setEditingNoteId(null);
      refetchDetail();
    } catch (err) {
      message.error(editingNoteId ? 'Failed to update note' : 'Failed to add note');
    }
  };

  // Populate the note form for editing
  const handleEditNote = (note) => {
    setEditingNoteId(note._id);
    setNoteContent(note.content);
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setNoteContent('');
  };

  // Delete Note
  const handleDeleteNote = async (noteId) => {
    try {
      await deleteMeetingNote({ id: selectedMeetingId, noteId }).unwrap();
      message.success('Note deleted');
      if (editingNoteId === noteId) handleCancelEditNote();
      refetchDetail();
    } catch (err) {
      message.error('Failed to delete note');
    }
  };

  // Add Attachment
  const handleAddAttachment = async () => {
    if (!attachmentUrl.trim() || !attachmentName.trim()) return;
    try {
      await addMeetingAttachment({
        id: selectedMeetingId,
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

  // Remove Attachment
  const handleRemoveAttachment = async (attachmentId) => {
    try {
      await removeMeetingAttachment({ id: selectedMeetingId, attachmentId }).unwrap();
      message.success('Attachment removed');
      refetchDetail();
    } catch (err) {
      message.error('Failed to remove attachment');
    }
  };

  // Create or Save an edited Follow Up
  const handleCreateFollowUp = async () => {
    if (!followUpDescription.trim() || !followUpAssignedTo || !followUpDueDate) return;
    try {
      if (editingFollowUpId) {
        await updateFollowUp({
          id: selectedMeetingId,
          followUpId: editingFollowUpId,
          description: followUpDescription,
          assignedTo: followUpAssignedTo,
          dueDate: followUpDueDate.format('YYYY-MM-DD')
        }).unwrap();
        message.success('Follow-up updated successfully');
      } else {
        await createFollowUp({
          id: selectedMeetingId,
          description: followUpDescription,
          assignedTo: followUpAssignedTo,
          dueDate: followUpDueDate.format('YYYY-MM-DD'),
          createTask: followUpCreateTask
        }).unwrap();
        message.success('Follow-up created successfully');
      }
      
      setFollowUpDescription('');
      setFollowUpAssignedTo('');
      setFollowUpDueDate(null);
      setFollowUpCreateTask(false);
      setEditingFollowUpId(null);
      
      refetchDetail();
    } catch (err) {
      message.error(editingFollowUpId ? 'Failed to update follow-up' : 'Failed to create follow-up action');
    }
  };

  // Populate the follow-up form for editing
  const handleEditFollowUp = (followUp) => {
    setEditingFollowUpId(followUp._id);
    setFollowUpDescription(followUp.description);
    setFollowUpAssignedTo(followUp.assignedTo?._id || followUp.assignedTo);
    setFollowUpDueDate(dayjs(followUp.dueDate));
  };

  const handleCancelEditFollowUp = () => {
    setEditingFollowUpId(null);
    setFollowUpDescription('');
    setFollowUpAssignedTo('');
    setFollowUpDueDate(null);
    setFollowUpCreateTask(false);
  };

  // Mark Follow Up Completed
  const handleCompleteFollowUp = async (followUpId) => {
    try {
      await completeFollowUp({ id: selectedMeetingId, followUpId }).unwrap();
      message.success('Follow-up marked as completed');
      refetchDetail();
    } catch (err) {
      message.error('Failed to complete follow-up');
    }
  };

  // Delete Follow Up
  const handleDeleteFollowUp = async (followUpId) => {
    try {
      await deleteFollowUp({ id: selectedMeetingId, followUpId }).unwrap();
      message.success('Follow-up deleted');
      if (editingFollowUpId === followUpId) handleCancelEditFollowUp();
      refetchDetail();
    } catch (err) {
      message.error('Failed to delete follow-up');
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
    return meetings.filter(m => dayjs(m.date).format('YYYY-MM-DD') === dateStr);
  };

  const calendarDateCellRender = (value) => {
    const listData = getCalendarListData(value);
    return (
      <ul className="events" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {listData.map(item => (
          <li key={item._id} style={{ margin: '2px 0' }}>
            <Tooltip title={`${item.title} (${item.time})`}>
              <Badge 
                status={item.status === 'completed' ? 'success' : item.status === 'cancelled' ? 'error' : 'processing'} 
                text={<span style={{ fontSize: '11px', display: 'inline-block', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>} 
              />
            </Tooltip>
          </li>
        ))}
      </ul>
    );
  };

  // Table Columns config
  const columns = [
    {
      title: 'Title & Agenda',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <span 
            style={{ fontWeight: 600, color: 'var(--accent-primary)', cursor: 'pointer' }}
            onClick={() => {
              setSelectedMeetingId(record._id);
              setDetailModalVisible(true);
            }}
          >
            {text}
          </span>
          <div style={{ fontSize: '12px', color: '#8c8c8c', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {record.agenda || 'No agenda provided'}
          </div>
        </div>
      )
    },
    {
      title: 'Meeting Date & Time',
      dataIndex: 'date',
      key: 'date',
      render: (date, record) => (
        <div>
          <Space direction="vertical" size={0}>
            <span><CalendarOutlined style={{ marginRight: 6 }} />{dayjs(date).format('MMM DD, YYYY')}</span>
            <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
              <ClockCircleOutlined style={{ marginRight: 6 }} />
              {record.time} ({record.duration} mins)
            </span>
          </Space>
        </div>
      )
    },
    {
      title: 'Type',
      dataIndex: 'meetingType',
      key: 'meetingType',
      render: (type) => (
        <span style={{ textTransform: 'capitalize' }}>
          {type ? type.replace('_', ' ') : 'N/A'}
        </span>
      )
    },
    {
      title: 'Host & Participants',
      key: 'people',
      render: (_, record) => (
        <div>
          <div style={{ fontSize: '12px', marginBottom: 4 }}>
            Host: <strong>{record.host?.name || 'Unknown'}</strong>
          </div>
          <Avatar.Group maxCount={3} size="small">
            {record.participants?.map(p => (
              <Tooltip title={p.name} key={p._id || p}>
                <Avatar icon={<UserOutlined />} src={p.logo} />
              </Tooltip>
            ))}
          </Avatar.Group>
        </div>
      )
    },
    {
      title: 'Linked Items',
      key: 'linked',
      render: (_, record) => (
        <div style={{ fontSize: '12px' }}>
          {record.clientId && <div>Client: {record.clientId.companyName || record.clientId.name}</div>}
          {record.projectId && <div>Proj: {record.projectId.name}</div>}
        </div>
      )
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
          {((record.host?._id || record.host) === currentUser._id || ['supreme_super_admin'].includes(userRole)) && (
            <>
              <Tooltip title="Edit">
                <Button 
                  type="link" 
                  icon={<EditOutlined />} 
                  onClick={() => openEditDrawer(record)} 
                />
              </Tooltip>
              {record.status !== 'completed' && record.status !== 'cancelled' && (
                <Tooltip title="Mark Completed">
                  <Button 
                    type="link" 
                    icon={<CheckCircleOutlined />} 
                    onClick={() => handleStatusUpdate(record._id, 'completed')}
                    style={{ color: '#52c41a' }}
                  />
                </Tooltip>
              )}
              <Popconfirm
                title="Are you sure to delete this meeting?"
                onConfirm={() => handleDeleteMeeting(record._id)}
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
    <div style={{minHeight: '100vh', background: isDark ? '#0b1220' : '#f5f7fa' }}>
      
      {/* Top Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: isDark ? '#ffffff' : '#111c31' }}>
            Meetings Hub
          </h1>
          <p style={{ margin: 0, color: '#8c8c8c' }}>
            Schedule, manage, and trace meeting outcomes with notes, tasks, and follow-ups.
          </p>
        </div>
        {canCreateMeeting && (
          <Button 
            type="primary" 
            size="large" 
            icon={<PlusOutlined />} 
            onClick={openCreateDrawer}
            style={{ borderRadius: '8px', background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary) 100%)', border: 'none' }}
          >
            Schedule Meeting
          </Button>
        )}
      </div>

      {/* KPI Stats Cards */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bodyStyle={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }} style={{ borderRadius: 16, border: 'none', borderLeft: '6px solid var(--accent-primary)', background: isDark ? '#111c31' : '#ffffff', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.05)', color: isDark ? '#fff' : '#000' }}>
            <div style={{ padding: '16px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', display: 'flex', flexShrink: 0 }}>
              <CalendarTwoTone style={{ fontSize: 28 }} twoToneColor="var(--accent-primary)" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Total Meetings</div>
              <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: isDark ? '#fff' : '#111c31' }}>{analytics?.total || meetings.length}</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bodyStyle={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }} style={{ borderRadius: 16, border: 'none', borderLeft: '6px solid #14b8a6', background: isDark ? '#111c31' : '#ffffff', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.05)', color: isDark ? '#fff' : '#000' }}>
            <div style={{ padding: '16px', borderRadius: '50%', background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6', display: 'flex', flexShrink: 0 }}>
              <ClockCircleOutlined style={{ fontSize: 28 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Upcoming</div>
              <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: isDark ? '#fff' : '#111c31' }}>{analytics?.statusStats?.upcoming || meetings.filter(m => m.status === 'upcoming').length}</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bodyStyle={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }} style={{ borderRadius: 16, border: 'none', borderLeft: '6px solid #f59e0b', background: isDark ? '#111c31' : '#ffffff', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.05)', color: isDark ? '#fff' : '#000' }}>
            <div style={{ padding: '16px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', flexShrink: 0 }}>
              <CheckCircleOutlined style={{ fontSize: 28 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Completed</div>
              <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: isDark ? '#fff' : '#111c31' }}>{analytics?.statusStats?.completed || meetings.filter(m => m.status === 'completed').length}</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bodyStyle={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }} style={{ borderRadius: 16, border: 'none', borderLeft: '6px solid #d946ef', background: isDark ? '#111c31' : '#ffffff', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.05)', color: isDark ? '#fff' : '#000' }}>
            <div style={{ flexShrink: 0 }}>
              <Progress type="circle" percent={analytics?.followUpCompletionRate || 0} width={60} strokeColor="#d946ef" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Action Item Rate</div>
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: isDark ? '#fff' : '#111c31' }}>{analytics?.followUpCompletionRate || 0}%</div>
            </div>
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
            key: 'list',
            label: <span><UnorderedListOutlined />List View</span>,
            children: (
              <Card style={{ borderRadius: '12px', padding: '16px' }}>
                {/* Search & Filters */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  <Input
                    placeholder="Search by title, agenda..."
                    prefix={<SearchOutlined />}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: 280, borderRadius: '8px' }}
                  />
                  <Select
                    placeholder="Filter by Status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    style={{ width: 180 }}
                    allowClear
                  >
                    <Option value="upcoming">Upcoming</Option>
                    <Option value="awaiting_confirmation">Awaiting Confirmation</Option>
                    <Option value="completed">Completed</Option>
                    <Option value="cancelled">Cancelled</Option>
                    <Option value="rescheduled">Rescheduled</Option>
                    <Option value="missed">Missed</Option>
                  </Select>
                  <Select
                    placeholder="Filter by Type"
                    value={typeFilter}
                    onChange={setTypeFilter}
                    style={{ width: 180 }}
                    allowClear
                  >
                    <Option value="client_review">Client Review</Option>
                    <Option value="internal_meeting">Internal Meeting</Option>
                    <Option value="prospect_meeting">Prospect Meeting</Option>
                    <Option value="campaign_planning">Campaign Planning</Option>
                    <Option value="seo_review">SEO Review</Option>
                    <Option value="content_review">Content Review</Option>
                    <Option value="sales_call">Sales Call</Option>
                  </Select>
                </div>

                <Table
                  columns={columns}
                  dataSource={meetings}
                  rowKey="_id"
                  loading={isLoadingMeetings}
                  pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                />
              </Card>
            )
          },
          {
            key: 'calendar',
            label: <span><CalendarOutlined />Calendar</span>,
            children: (
              <Card style={{ borderRadius: '12px', padding: '16px' }}>
                <Calendar 
                  dateCellRender={calendarDateCellRender}
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
                  <Card title="Meeting Types Distribution" style={cardStyle(isDark)}>
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
                  <Card title="Meeting Host Distribution" style={cardStyle(isDark)}>
                    <List
                      dataSource={analytics?.employeeBreakdown || []}
                      renderItem={item => (
                        <List.Item>
                          <span>{item.name} ({item.email})</span>
                          <strong>{item.count}</strong>
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              </Row>
            )
          }
        ]}
      />

      {/* Schedule/Edit Drawer */}
      <Drawer
        title={editingMeeting ? "Reschedule / Edit Meeting" : "Schedule New Meeting"}
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
              {editingMeeting ? "Save Changes" : "Create Meeting"}
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
            label="Meeting Title"
            rules={[{ required: true, message: 'Please enter meeting title' }]}
          >
            <Input placeholder="Enter title" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="date"
                label="Date"
                rules={[{ required: true, message: 'Please select date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="time"
                label="Time"
                rules={[{ required: true, message: 'Please select time' }]}
              >
                <TimePicker 
                  format="hh:mm A" 
                  use12Hours 
                  style={{ width: '100%' }} 
                  placeholder="Select time" 
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="duration"
                label="Duration (minutes)"
                initialValue={30}
                rules={[{ required: true }]}
              >
                <InputNumber min={5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="meetingType"
                label="Meeting Type"
                rules={[{ required: true, message: 'Please select type' }]}
              >
                <Select placeholder="Select type">
                  <Option value="client_review">Client Review</Option>
                  <Option value="internal_meeting">Internal Meeting</Option>
                  <Option value="prospect_meeting">Prospect Meeting</Option>
                  <Option value="campaign_planning">Campaign Planning</Option>
                  <Option value="seo_review">SEO Review</Option>
                  <Option value="content_review">Content Review</Option>
                  <Option value="sales_call">Sales Call</Option>
                  <Option value="other">Other</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="meetingLink"
            label="Meeting Link / Location"
            rules={[{ required: true, message: 'Please provide a meeting link or location' }]}
          >
            <Input prefix={<LinkOutlined />} placeholder="https://meet.google.com/..." />
          </Form.Item>

          <Form.Item
            name="agenda"
            label="Agenda"
            rules={[{ required: true, message: 'Please provide a meeting agenda or description' }]}
          >
            <TextArea rows={3} placeholder="Provide meeting description/agenda" />
          </Form.Item>

          {isClientRole ? (
            <Form.Item
              name="participants"
              label="Agency Manager / Agency Admin"
              rules={[{ required: true, message: 'Please select at least one Agency Manager or Agency Admin' }]}
            >
              <Select mode="multiple" placeholder="Select Agency Manager / Agency Admin">
                {users.filter(u => u.role === 'agency_manager' || u.role === 'agency_super_admin').map(u => (
                  <Option key={u._id} value={u._id}>{u.name} ({u.role})</Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <Form.Item
              name="participants"
              label="Participants"
              rules={[{ required: true, message: 'Please select at least one participant' }]}
            >
              <Select mode="multiple" placeholder="Select participants" filterOption={(input, option) => option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0}>
                {users.map(u => (
                  <Option key={u._id} value={u._id}>{u.name} ({u.role})</Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {!isClientRole && (
            <>
              <Divider>Associated Items (Optional)</Divider>

              <Form.Item
                name="clientId"
                label="Client / Brand"
              >
                <Select placeholder="Select client" allowClear>
                  {clients.map(c => (
                    <Option key={c._id} value={c._id}>{c.companyName || c.name}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="projectId"
                label="Project"
              >
                <Select placeholder="Select project" allowClear>
                  {projects.map(p => (
                    <Option key={p._id} value={p._id}>{p.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}
        </Form>
      </Drawer>

      {/* Detail & Workspace Modal */}
      <Modal
        title={
          <div>
            <span style={{ fontSize: '18px', fontWeight: 600 }}>{detailData?.meeting?.title}</span>
            <div style={{ marginTop: 4 }}>
              {detailData?.meeting && getStatusTag(detailData.meeting.status)}
            </div>
          </div>
        }
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedMeetingId(null);
        }}
        footer={null}
        width={720}
        styles={{ body: { padding: '0 24px 24px 24px' } }}
      >
        {detailData ? (
          <Tabs defaultActiveKey="overview" style={{ marginTop: '16px' }}>
            <Tabs.TabPane tab="Overview & Timeline" key="overview">
              <Row gutter={16}>
                <Col span={14}>
                  <p><strong>Agenda:</strong></p>
                  <p>{detailData.meeting.agenda || 'No agenda detailed.'}</p>
                  
                  <p><strong>Schedule:</strong> {dayjs(detailData.meeting.date).format('MMMM DD, YYYY')} at {detailData.meeting.time} ({detailData.meeting.duration} minutes)</p>
                  
                  {detailData.meeting.meetingLink && (
                    <Button 
                      type="primary" 
                      icon={<LinkOutlined />} 
                      href={detailData.meeting.meetingLink} 
                      target="_blank"
                      style={{ marginBottom: '16px' }}
                    >
                      Join Virtual Meeting
                    </Button>
                  )}

                  <Divider />
                  
                  <p><strong>Host:</strong> {detailData.meeting.host?.name}</p>
                  <p><strong>Invited Team / Clients:</strong></p>
                  <List
                    size="small"
                    dataSource={detailData.meeting.participants}
                    renderItem={p => (
                      <List.Item key={p._id}>
                        <Space>
                          <Avatar size="small" icon={<UserOutlined />} src={p.logo} />
                          <span>{p.name} ({p.role})</span>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Col>

                <Col span={10}>
                  <Card title="Activity History Logs" size="small" style={{ maxHeight: 350, overflowY: 'auto' }}>
                    <Timeline>
                      {detailData.meeting.history?.map((log, index) => (
                        <Timeline.Item key={index} color="blue">
                          <p style={{ margin: 0, fontSize: '12px' }}><strong>{log.action.replace('_', ' ')}</strong></p>
                          <p style={{ margin: 0, fontSize: '11px', color: '#8c8c8c' }}>{log.details}</p>
                          <p style={{ margin: 0, fontSize: '10px', color: '#bfbfbf' }}>{dayjs(log.timestamp).format('MMM D, h:mm a')}</p>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  </Card>
                </Col>
              </Row>
            </Tabs.TabPane>

            <Tabs.TabPane tab="Meeting Notes" key="notes">
              <List
                dataSource={detailData.notes}
                style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}
                renderItem={note => (
                  <List.Item
                    key={note._id}
                    actions={[
                      <Tooltip title="Edit" key="edit">
                        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditNote(note)} />
                      </Tooltip>,
                      <Popconfirm
                        key="delete"
                        title="Delete this note?"
                        onConfirm={() => handleDeleteNote(note._id)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Tooltip title="Delete">
                          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} />}
                      title={<span>{note.createdBy?.name || 'User'} <span style={{ fontSize: '11px', color: '#bfbfbf' }}>{dayjs(note.createdAt).format('MMM D, h:mm a')}</span></span>}
                      description={note.content}
                    />
                  </List.Item>
                )}
              />
              <Divider />
              <Form.Item label={editingNoteId ? "Edit Meeting Note" : "Add Meeting Note"}>
                <TextArea 
                  rows={3} 
                  value={noteContent} 
                  onChange={e => setNoteContent(e.target.value)} 
                  placeholder="Type important items, decisions or notes discussed..."
                />
                <Space style={{ marginTop: 12 }}>
                  <Button 
                    type="primary" 
                    onClick={handleAddNote}
                    loading={editingNoteId ? isUpdatingNote : isAddingNote}
                  >
                    {editingNoteId ? "Save Changes" : "Post Note"}
                  </Button>
                  {editingNoteId && (
                    <Button onClick={handleCancelEditNote}>Cancel</Button>
                  )}
                </Space>
              </Form.Item>
            </Tabs.TabPane>

            <Tabs.TabPane tab="Action Items & Tasks" key="followups">
              <h3>Arising Deliverables</h3>
              <List
                dataSource={detailData.followUps}
                style={{ marginBottom: 24 }}
                renderItem={item => (
                  <List.Item
                    key={item._id}
                    actions={[
                      item.status !== 'completed' && (
                        <Tooltip title="Mark Completed" key="complete">
                          <Button type="link" size="small" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }} onClick={() => handleCompleteFollowUp(item._id)} />
                        </Tooltip>
                      ),
                      <Tooltip title="Edit" key="edit">
                        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditFollowUp(item)} />
                      </Tooltip>,
                      <Popconfirm
                        key="delete"
                        title="Delete this follow-up?"
                        onConfirm={() => handleDeleteFollowUp(item._id)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Tooltip title="Delete">
                          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    ].filter(Boolean)}
                  >
                    <Checkbox checked={item.status === 'completed'} disabled>
                      {item.description}
                    </Checkbox>
                    <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                      Assignee: {item.assignedTo?.name || 'N/A'} | Due: {dayjs(item.dueDate).format('MMM D, YYYY')}
                      {item.taskId && (
                        <div>
                          Linked Task: <Tag color="blue">{item.taskId.title} ({item.taskId.status})</Tag>
                        </div>
                      )}
                    </div>
                  </List.Item>
                )}
              />
              
              {['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'agency_manager'].includes(userRole) && (
                <>
                  <Divider />
                  <h4>{editingFollowUpId ? "Edit Follow-Up / Action Item" : "Add Follow-Up / Action Item"}</h4>
                  <Form layout="vertical">
                    <Form.Item label="Description" required>
                      <Input 
                        value={followUpDescription} 
                        onChange={e => setFollowUpDescription(e.target.value)} 
                        placeholder="Action item / task to assign..."
                      />
                    </Form.Item>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Assign To" required>
                          <Select 
                            value={followUpAssignedTo} 
                            onChange={setFollowUpAssignedTo} 
                            placeholder="Select assignee"
                          >
                            {users.map(u => (
                              <Option key={u._id} value={u._id}>{u.name}</Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Due Date" required>
                          <DatePicker 
                            value={followUpDueDate} 
                            onChange={setFollowUpDueDate} 
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    
                    {/* {!editingFollowUpId && (
                      <Form.Item>
                        <Checkbox 
                          checked={followUpCreateTask} 
                          onChange={e => setFollowUpCreateTask(e.target.checked)}
                        >
                          Auto-generate and link with Task Management module (assigned user gets notified)
                        </Checkbox>
                      </Form.Item>
                    )} */}

                    <Space>
                      <Button 
                        type="primary" 
                        onClick={handleCreateFollowUp}
                        loading={editingFollowUpId ? isUpdatingFollowUp : isCreatingFollowUp}
                      >
                        {editingFollowUpId ? "Save Changes" : "Assign Action Item"}
                      </Button>
                      {editingFollowUpId && (
                        <Button onClick={handleCancelEditFollowUp}>Cancel</Button>
                      )}
                    </Space>
                  </Form>
                </>
              )}
            </Tabs.TabPane>

            <Tabs.TabPane tab="Attachments" key="attachments">
              <List
                dataSource={detailData.attachments}
                renderItem={att => (
                  <List.Item
                    key={att._id}
                    actions={[
                      <Popconfirm
                        key="remove"
                        title="Remove this attachment?"
                        onConfirm={() => handleRemoveAttachment(att._id)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Tooltip title="Remove">
                          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    ]}
                  >
                    <Space>
                      <PaperClipOutlined />
                      <a href={att.url} target="_blank" rel="noreferrer">{att.fileName}</a>
                      <span style={{ fontSize: '11px', color: '#bfbfbf' }}>Uploaded by: {att.uploadedBy?.name || 'User'}</span>
                    </Space>
                  </List.Item>
                )}
              />
              <Divider />
              <h4>Link Reference / Document</h4>
              <Form layout="vertical">
                <Form.Item label="Document Name" required>
                  <Input value={attachmentName} onChange={e => setAttachmentName(e.target.value)} placeholder="e.g. SEO Campaign Proposal" />
                </Form.Item>
                <Form.Item label="Document / File URL" required>
                  <Input value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} placeholder="https://drive.google.com/..." />
                </Form.Item>
                <Button type="primary" onClick={handleAddAttachment}>
                  Add Document
                </Button>
              </Form>
            </Tabs.TabPane>
          </Tabs>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px' }}>Loading meeting metadata...</div>
        )}
      </Modal>
    </div>
  );
};

export default MeetingsPage;