import React, { useState, useEffect } from 'react';
import {
  Typography, Row, Col, Card, Button, Table, Tag, Avatar,
  message, Spin, Modal, Form, Select, InputNumber, Switch,
  Input, Popconfirm, Tabs, DatePicker
} from 'antd';
import { motion } from 'framer-motion';
import {
  Plus, Edit3, Trash2, CheckCircle2, AlertCircle, Clock,
  Target, PlayCircle, CalendarX2, ChevronLeft, ChevronRight,
  Building2, Users, BarChart2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { timeTrackingService } from '../../services/timeTracking.service';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const TimeTracking = () => {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState(null);
  const [kpis, setKpis] = useState({
    totalHours: 0, billableHours: 0, nonBillableHours: 0,
    utilizationRate: 0, capacity: null, billablePercent: 0,
    nonBillablePercent: 0, activeTimersCount: 0, activeTimersRunningTime: 0,
    capacityRemaining: null, missingTimesheetsCount: 0, missingTimesheetsMessage: '—'
  });
  const [timesheetData, setTimesheetData] = useState([]);
  const [timeByClient, setTimeByClient] = useState([]);
  const [timeByDepartment, setTimeByDepartment] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [deptPerformance, setDeptPerformance] = useState([]);
  const [formOptions, setFormOptions] = useState({ employees: [], clients: [], tasks: [], departments: [] });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchData = async (dateStr) => {
    setLoading(true);
    try {
      const targetDate = dateStr || selectedDate;
      const queryParams = {};
      if (dateRange && dateRange.length === 2) {
        queryParams.startDate = dateRange[0].format('YYYY-MM-DD');
        queryParams.endDate = dateRange[1].format('YYYY-MM-DD');
      } else {
        queryParams.date = targetDate;
      }
      
      const [dashRes, recentRes, optRes, perfRes] = await Promise.all([
        timeTrackingService.getDashboardData(queryParams),
        timeTrackingService.getRecentEntries(),
        timeTrackingService.getFormOptions(),
        timeTrackingService.getTeamTaskPerformance(queryParams)
      ]);

      if (dashRes.success) {
        setKpis(dashRes.kpis);
        setTimesheetData(dashRes.timesheet);
        setTimeByClient(dashRes.timeByClient);
        setTimeByDepartment(dashRes.timeByDepartment || []);
      }
      if (recentRes.success) setRecentEntries(recentRes.data);
      if (optRes.success) setFormOptions(optRes.data);
      if (perfRes.success) {
        setTeamPerformance(perfRes.data);
        setDeptPerformance(perfRes.byDepartment || []);
      }
    } catch (error) {
      console.error('Failed to fetch time tracking data', error);
      message.error('Failed to load time tracking data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedDate, dateRange]);

  const handlePrevWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d.toISOString().split('T')[0]);
  };
  const handleNextWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d.toISOString().split('T')[0]);
  };
  const handleCurrentWeek = () => setSelectedDate(new Date().toISOString().split('T')[0]);

  const handleAddSubmit = async (values) => {
    try {
      const res = await timeTrackingService.logTime(values);
      if (res.success) { message.success('Time logged successfully'); setIsAddModalOpen(false); form.resetFields(); fetchData(); }
    } catch { message.error('Failed to log time'); }
  };

  const handleEditOpen = (record) => {
    setEditingEntry(record);
    editForm.setFieldsValue({
      employee: record.employeeId, client: record.clientId, task: record.taskId,
      department: record.departmentId, moduleName: record.module,
      description: record.rawDescription,
      date: new Date(record.rawDate).toISOString().split('T')[0],
      hours: record.hours, isBillable: record.billable
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (values) => {
    try {
      const res = await timeTrackingService.updateTimeEntry(editingEntry.id, values);
      if (res.success) { message.success('Time entry updated'); setIsEditModalOpen(false); setEditingEntry(null); fetchData(); }
    } catch { message.error('Failed to update time entry'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await timeTrackingService.deleteTimeEntry(id);
      if (res.success) { message.success('Time entry deleted'); fetchData(); }
    } catch { message.error('Failed to delete time entry'); }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const itemVariants = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } } };

  const formatTime = (h, allowZero = false) => {
    if (h === undefined || h === null || h === '-') return allowZero ? '0h' : '—';
    const numH = parseFloat(h);
    if (isNaN(numH) || numH < 0) return allowZero ? '0h' : '—';
    if (numH === 0) return allowZero ? '0h' : '—';
    const totalSeconds = Math.round(numH * 3600);
    if (numH < 1) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return minutes === 0 ? `${seconds}s` : `${minutes}m`;
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  };

  const getHourTag = (h) => {
    if (h === '-' || h === 0) return <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>—</span>;
    const formatted = formatTime(h);
    const color = h >= 7 && h <= 8 ? 'var(--accent-primary)' : h < 7 ? 'var(--accent-warning)' : 'var(--accent-danger)';
    return <Tag style={{ margin: 0, borderRadius: 16, color, border: `1px solid ${color}`, background: 'transparent', fontWeight: 600 }}>{formatted}</Tag>;
  };

  const deptTag = (dept) => dept && dept !== '—'
    ? <Tag icon={<Building2 size={10} style={{ marginRight: 3 }} />} style={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--accent-info)', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>{dept}</Tag>
    : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;

  // ─── Table Columns ────────────────────────────────────────────────────────────

  const tsCols = [
    {
      title: 'DEPARTMENT MEMBER', dataIndex: 'name', key: 'name', width: 200,
      render: (text, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size="small" style={{ backgroundColor: r.color || 'var(--accent-primary)', fontWeight: 700 }}>{r.initials}</Avatar>
          <div>
            <strong style={{ display: 'block', fontSize: 13, color: 'var(--text-primary)' }}>{text}</strong>
            {deptTag(r.department)}
          </div>
        </div>
      )
    },
    { title: 'MON', dataIndex: 'mon', key: 'mon', render: getHourTag },
    { title: 'TUE', dataIndex: 'tue', key: 'tue', render: getHourTag },
    { title: 'WED', dataIndex: 'wed', key: 'wed', render: getHourTag },
    { title: 'THU', dataIndex: 'thu', key: 'thu', render: getHourTag },
    { title: 'FRI', dataIndex: 'fri', key: 'fri', render: getHourTag },
    { title: 'SAT', dataIndex: 'sat', key: 'sat', render: getHourTag },
    { title: 'SUN', dataIndex: 'sun', key: 'sun', render: getHourTag },
    { title: 'TOTAL', dataIndex: 'total', key: 'total', render: val => <strong style={{ color: 'var(--text-primary)' }}>{formatTime(val)}</strong> },
  ];

  const entryCols = [
    { title: 'DATE', dataIndex: 'date', key: 'date', render: text => <Text type="secondary" style={{ fontWeight: 500 }}>{text}</Text> },
    {
      title: 'MEMBER', dataIndex: 'member', key: 'member',
      render: (text, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size="small" style={{ fontSize: 10, fontWeight: 700, backgroundColor: 'var(--accent-secondary)' }}>{r.memberInit}</Avatar>
          <div>
            <strong style={{ display: 'block', fontSize: 13, color: 'var(--text-primary)' }}>{text}</strong>
            {deptTag(r.department)}
          </div>
        </div>
      )
    },
    { title: 'CLIENT', dataIndex: 'client', key: 'client', render: text => text ? <Text style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{text}</Text> : <Text type="secondary">—</Text> },
    { title: 'MODULE', dataIndex: 'module', key: 'module', render: text => <Tag style={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--accent-info)', fontSize: 10, fontWeight: 600 }}>{text}</Tag> },
    { title: 'TASK/DESC', dataIndex: 'task', key: 'task', render: text => <Text style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{text}</Text> },
    { title: 'HOURS', dataIndex: 'hours', key: 'hours', render: text => <strong style={{ color: 'var(--text-primary)' }}>{formatTime(text)}</strong> },
    { title: 'BILLABLE', dataIndex: 'billable', key: 'billable', render: val => val ? <CheckCircle2 size={18} color="var(--accent-primary)" /> : <AlertCircle size={18} color="var(--text-tertiary)" /> },
    {
      title: 'ACTIONS', key: 'actions', render: (_, record) => (
        <div style={{ display: 'flex', gap: 16 }}>
          <a onClick={() => handleEditOpen(record)} style={{ color: 'var(--text-tertiary)' }}><Edit3 size={16} /></a>
          <Popconfirm title="Delete this entry?" onConfirm={() => handleDelete(record.id)} okText="Yes" cancelText="No">
            <a style={{ color: 'var(--text-tertiary)' }}><Trash2 size={16} /></a>
          </Popconfirm>
        </div>
      )
    }
  ];

  // Department performance columns
  const deptPerfCols = [
    {
      title: 'DEPARTMENT', dataIndex: 'department', key: 'department',
      render: text => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
            <Building2 size={14} color="var(--accent-primary)" />
          </div>
          <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{text || 'No Department'}</strong>
        </div>
      )
    },
    { title: 'MEMBERS', dataIndex: 'members', key: 'members', render: v => <Tag style={{ borderRadius: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', fontWeight: 600 }}><Users size={10} style={{ marginRight: 4 }} />{v}</Tag> },
    { title: 'TASKS COMPLETED', dataIndex: 'tasksCompleted', key: 'tasksCompleted', render: v => <strong style={{ color: 'var(--text-primary)' }}>{v}</strong> },
    { title: 'TOTAL HOURS', dataIndex: 'totalTimeSpent', key: 'totalTimeSpent', render: v => <strong style={{ color: 'var(--text-primary)' }}>{formatTime(v)}</strong> },
  ];

  // Individual member performance columns (with department column)
  const perfCols = [
    {
      title: 'MEMBER', dataIndex: 'name', key: 'name',
      render: (text, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size="small" style={{ backgroundColor: 'var(--accent-primary)', fontWeight: 700 }}>{text ? text.substring(0, 2).toUpperCase() : 'UN'}</Avatar>
          <div>
            <strong style={{ display: 'block', fontSize: 13, color: 'var(--text-primary)' }}>{text}</strong>
            {deptTag(r.department)}
          </div>
        </div>
      )
    },
    { title: 'TASKS COMPLETED', dataIndex: 'tasksCompleted', key: 'tasksCompleted', render: v => <strong style={{ color: 'var(--text-primary)' }}>{v}</strong> },
    { title: 'TOTAL WORK TIME', dataIndex: 'totalTimeSpent', key: 'totalTimeSpent', render: v => <strong style={{ color: 'var(--text-primary)' }}>{formatTime(v)}</strong> },
  ];

  if (loading && timesheetData.length === 0 && recentEntries.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><Spin size="large" /></div>;
  }

  // Shared form fields for Add/Edit modals
  const formFields = (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="employee" label="Member" rules={[{ required: true, message: 'Required' }]}>
            <Select showSearch optionFilterProp="children" placeholder="Select department member">
              {formOptions.employees?.map(e => (
                <Option key={e._id} value={e._id}>
                  {e.name}
                  {(e.departmentName || e.departmentId) && (
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>({e.departmentName || 'Dept'})</Text>
                  )}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Required' }]}>
            <Input type="date" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="department" label="Department (Optional)">
            <Select showSearch optionFilterProp="children" placeholder="Select department" allowClear>
              {formOptions.departments?.map(d => <Option key={d._id} value={d._id}>{d.name}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="client" label="Client (Optional)">
            <Select showSearch optionFilterProp="children" placeholder="Select client" allowClear>
              {formOptions.clients?.map(c => <Option key={c._id} value={c._id}>{c.companyName || c.name}</Option>)}
            </Select>
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="task" label="Task (Optional)">
            <Select showSearch optionFilterProp="children" placeholder="Select task" allowClear>
              {formOptions.tasks?.map(t => <Option key={t._id} value={t._id}>{t.title}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="hours" label="Duration (Hours)" rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={0.1} step={0.5} style={{ width: '100%' }} placeholder="e.g. 1.5" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="moduleName" label="Module (Optional)">
            <Input placeholder="e.g. SEO, Development" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="isBillable" label="Billable" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="description" label="Description (Optional)">
        <Input.TextArea rows={2} placeholder="What did you work on?" />
      </Form.Item>
    </>
  );

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>Time Tracking</Title>
          <Text type="secondary" style={{ fontWeight: 500 }}>Log billable and non-billable hours by department, client and task.</Text>
        </div>
        <div>
          <RangePicker 
            value={dateRange} 
            onChange={(dates) => setDateRange(dates)} 
            style={{ borderRadius: 8, height: 40 }} 
          />
        </div>
      </motion.div>

      {/* ─── KPI Cards ──────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
          {[
            {
              label: 'TOTAL HOURS LOGGED',
              val: formatTime(kpis.totalHours, true),
              sub: kpis.nonBillableHours > 0
                ? `${formatTime(kpis.nonBillableHours, true)} non-billable`
                : `${formatTime(kpis.billableHours, true)} billable`,
              msg: dateRange ? 'Custom date range' : 'Selected week',
              color: 'var(--accent-info)',
              icon: <Clock size={20} />
            },
            {
              label: 'ACTIVE TIMERS',
              val: kpis.activeTimersCount || 0,
              sub: kpis.activeTimersCount > 0
                ? `${kpis.activeTimersCount} member${kpis.activeTimersCount > 1 ? 's' : ''} active`
                : 'No active timers',
              msg: 'Running right now',
              color: 'var(--accent-primary)',
              pos: kpis.activeTimersCount > 0,
              icon: <PlayCircle size={20} />
            },
            {
              label: 'BILLABLE UTILIZATION',
              val: `${kpis.utilizationRate || 0}%`,
              sub: `${formatTime(kpis.billableHours, true)} billable`,
              msg: 'Out of total logged hours',
              color: 'var(--accent-warning)',
              icon: <Target size={20} />
            },
            {
              label: 'AVG HOURS PER MEMBER',
              val: formatTime(kpis.avgHoursPerMember || (kpis.totalHours / (kpis.totalEligibleMembers || timesheetData.length || 1)), true),
              sub: `Across ${kpis.totalEligibleMembers || timesheetData.length || 0} members`,
              msg: 'Average logged per member',
              color: 'var(--accent-secondary)',
              icon: <Users size={20} />
            },
          ].map((kpi, i) => (
            <Col style={{ flex: '1 1 200px', minWidth: 200 }} key={i}>
              <motion.div whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: '100%' }}>
                <Card className="glassmorphism hover-bg" style={{ borderRadius: 16, border: '1px solid var(--border-color)', height: '100%', position: 'relative', overflow: 'hidden' }} bodyStyle={{ padding: '24px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: kpi.color }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5 }}>{kpi.label}</Text>
                    <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'var(--bg-secondary)', color: kpi.color, border: '1px solid var(--border-color)' }}>{kpi.icon}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 'auto' }}>
                    <Title level={2} style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 800, lineHeight: 1 }}>{kpi.val}</Title>
                    {kpi.sub && <Text style={{ color: kpi.alert ? 'var(--accent-warning)' : kpi.pos ? 'var(--accent-primary)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 700 }}>{kpi.sub}</Text>}
                  </div>
                  <Text style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginTop: 8, fontWeight: 500 }}>{kpi.msg}</Text>
                </Card>
              </motion.div>
            </Col>
          ))}
        </Row>
      </motion.div>

      {/* ─── Weekly Department Timesheet ─────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card
          title={
            <div style={{ paddingTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={16} color="var(--accent-primary)" />
                <Title level={5} style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Department Timesheet</Title>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Button size="small" type="text" icon={<ChevronLeft size={16} />} onClick={handlePrevWeek} />
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Week of {selectedDate}</Text>
                <Button size="small" type="text" icon={<ChevronRight size={16} />} onClick={handleNextWeek} />
                <Button size="small" type="link" onClick={handleCurrentWeek}>Today</Button>
              </div>
            </div>
          }
          className="glassmorphism"
          style={{ borderRadius: 16, marginBottom: 32, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}
          bodyStyle={{ padding: 0 }}
        >
          <Table
            columns={tsCols} dataSource={timesheetData} pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
            rowKey={(r) => r.name + r.department} size="middle" scroll={{ x: 1100 }}
            rowClassName={() => 'hover-bg'} loading={loading}
            locale={{ emptyText: 'No department members found. Add team members with agencyId linked to this company.' }}
          />
        </Card>
      </motion.div>

      {/* ─── Dept Time Chart + Dept Performance side-by-side ─────────────────── */}
      <motion.div variants={itemVariants}>
        <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
          {/* Hours by Department */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <div style={{ paddingTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart2 size={16} color="var(--accent-primary)" />
                    <Title level={5} style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Hours by Department</Title>
                  </div>
                  <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Billable vs non-billable — this week</Text>
                </div>
              }
              className="glassmorphism"
              style={{ borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', height: '100%' }}
            >
              <div style={{ height: 300 }}>
                {timeByDepartment.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeByDepartment} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                      <XAxis type="number" stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500 }} />
                      <YAxis dataKey="department" type="category" stroke="var(--text-secondary)" axisLine={false} tickLine={false} width={110} tick={{ fontSize: 12, fontWeight: 600 }} />
                      <Tooltip cursor={{ fill: 'var(--bg-tertiary)' }} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                      <Legend wrapperStyle={{ paddingTop: 12, fontWeight: 500, color: 'var(--text-secondary)' }} />
                      <Bar dataKey="billable" name="Billable" stackId="a" fill="var(--accent-secondary)" maxBarSize={28} />
                      <Bar dataKey="nonBillable" name="Non-billable" stackId="a" fill="var(--bg-tertiary)" radius={[0, 4, 4, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Text type="secondary">No department time logged this week</Text>
                  </div>
                )}
              </div>
            </Card>
          </Col>

          {/* Time by Client */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <div style={{ paddingTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart2 size={16} color="var(--accent-warning)" />
                    <Title level={5} style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Time by Client</Title>
                  </div>
                  <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Hours logged this month — billable vs non-billable</Text>
                </div>
              }
              className="glassmorphism"
              style={{ borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', height: '100%' }}
            >
              <div style={{ height: 300 }}>
                {timeByClient.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeByClient} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                      <XAxis type="number" stroke="var(--text-tertiary)" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500 }} />
                      <YAxis dataKey="client" type="category" stroke="var(--text-secondary)" axisLine={false} tickLine={false} width={110} tick={{ fontSize: 12, fontWeight: 600 }} />
                      <Tooltip cursor={{ fill: 'var(--bg-tertiary)' }} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                      <Legend wrapperStyle={{ paddingTop: 12, fontWeight: 500, color: 'var(--text-secondary)' }} />
                      <Bar dataKey="billable" name="Billable" stackId="a" fill="var(--accent-secondary)" maxBarSize={28} />
                      <Bar dataKey="nonBillable" name="Non-billable" stackId="a" fill="var(--bg-tertiary)" radius={[0, 4, 4, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Text type="secondary">No client time logged this month</Text>
                  </div>
                )}
              </div>
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* ─── Department + Member Performance ──────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card
          title={
            <div style={{ paddingTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="var(--accent-primary)" />
                <Title level={5} style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Department Task Performance</Title>
              </div>
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Completed tasks and hours logged this week — by department and member</Text>
            </div>
          }
          className="glassmorphism"
          style={{ borderRadius: 16, marginBottom: 32, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}
          bodyStyle={{ padding: 0 }}
        >
          <Tabs
            defaultActiveKey="department"
            style={{ padding: '0 16px' }}
            items={[
              {
                key: 'department',
                label: <span><Building2 size={12} style={{ marginRight: 6 }} />By Department</span>,
                children: (
                  <Table
                    columns={deptPerfCols} dataSource={deptPerformance} pagination={false}
                    rowKey="department" size="middle" scroll={{ x: 700 }} rowClassName={() => 'hover-bg'}
                    locale={{ emptyText: 'No department data for this week' }}
                  />
                )
              },
              {
                key: 'members',
                label: <span><Users size={12} style={{ marginRight: 6 }} />By Member</span>,
                children: (
                  <Table
                    columns={perfCols} dataSource={teamPerformance} pagination={false}
                    rowKey="userId" size="middle" scroll={{ x: 700 }} rowClassName={() => 'hover-bg'}
                    locale={{ emptyText: 'No member data for this week' }}
                  />
                )
              }
            ]}
          />
        </Card>
      </motion.div>

      {/* ─── Recent Time Entries ───────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card
          title={
            <div style={{ paddingTop: 8 }}>
              <Title level={5} style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Recent time entries</Title>
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Last 20 entries across all departments</Text>
            </div>
          }
          className="glassmorphism"
          style={{ borderRadius: 16, marginBottom: 40, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}
          bodyStyle={{ padding: 0 }}
        >
          <Table
            columns={entryCols} dataSource={recentEntries} pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
            rowKey="id" size="middle" scroll={{ x: 1100 }} rowClassName={() => 'hover-bg'}
          />
        </Card>
      </motion.div>

      {/* ─── Log Time Modal ────────────────────────────────────────────────────── */}
      <Modal title="Log Time" open={isAddModalOpen} onCancel={() => setIsAddModalOpen(false)} onOk={() => form.submit()} okText="Save Entry" width={640} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleAddSubmit}>{formFields}</Form>
      </Modal>

      {/* ─── Edit Time Entry Modal ────────────────────────────────────────────── */}
      <Modal title="Edit Time Entry" open={isEditModalOpen} onCancel={() => setIsEditModalOpen(false)} onOk={() => editForm.submit()} okText="Update Entry" width={640} destroyOnClose>
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>{formFields}</Form>
      </Modal>
    </motion.div>
  );
};

export default TimeTracking;
