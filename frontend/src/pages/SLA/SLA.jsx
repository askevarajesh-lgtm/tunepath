import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Table, Tag, Button, Input, Progress, Avatar, Drawer, Timeline, Select, message, Space, Modal, Form, DatePicker } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip as RechartsTooltip } from 'recharts';
import { motion } from 'framer-motion';
import { Download, Settings, Search, AlertCircle, Target, CheckCircle, AlertOctagon, AlertTriangle, MessageSquare, ArrowUpRight } from 'lucide-react';
import { slaTrendData } from '../../data/mock'; // keep mock for the trend chart as we don't have historical data yet
import { slaApi } from '../../api/slaApi';
import { exportToCSV } from '../../utils/exportUtils';

const { Title, Text } = Typography;
const { Option } = Select;

const SLA = () => {
  const [slas, setSlas] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ status: 'All', triggerType: 'All', search: '' });
  
  // Drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedSla, setSelectedSla] = useState(null);
  const [noteText, setNoteText] = useState('');

  // Create Modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [creatingSla, setCreatingSla] = useState(false);

  const fetchSlaData = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const [slasRes, statsRes] = await Promise.all([
        slaApi.getSlas({ page, limit: pageSize, status: filters.status, triggerType: filters.triggerType, search: filters.search }),
        slaApi.getSlaDashboardStats()
      ]);
      setSlas(slasRes.data);
      setPagination({ current: slasRes.pagination.page, pageSize, total: slasRes.pagination.total });
      setStats(statsRes.data);
    } catch (error) {
      console.error(error);
      message.error('Failed to load SLA data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlaData(pagination.current, pagination.pageSize);
  }, [filters, pagination.current, pagination.pageSize]);

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleView = async (slaId) => {
    try {
      const res = await slaApi.getSlaById(slaId);
      setSelectedSla(res.data);
      setDrawerVisible(true);
    } catch (error) {
      message.error('Failed to load SLA details');
    }
  };

  const handleEscalate = async (slaId) => {
    try {
      await slaApi.escalateSla(slaId);
      message.success('SLA Escalated successfully');
      fetchSlaData(pagination.current, pagination.pageSize);
      if (selectedSla && selectedSla._id === slaId) handleView(slaId);
    } catch (error) {
      message.error('Failed to escalate SLA');
    }
  };

  const handleResolve = async (slaId) => {
    try {
      await slaApi.updateSla(slaId, { status: 'Resolved' });
      message.success('SLA Resolved successfully');
      fetchSlaData(pagination.current, pagination.pageSize);
      if (selectedSla && selectedSla._id === slaId) handleView(slaId);
    } catch (error) {
      message.error('Failed to resolve SLA');
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedSla) return;
    try {
      await slaApi.addSlaNote(selectedSla._id, noteText);
      message.success('Note added successfully');
      setNoteText('');
      handleView(selectedSla._id);
    } catch (error) {
      message.error('Failed to add note');
    }
  };

  const handleCreateSla = async (values) => {
    setCreatingSla(true);
    try {
      await slaApi.createSla({
        ...values,
        dueDate: values.dueDate.toISOString()
      });
      message.success('SLA Ticket raised successfully');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchSlaData(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('Failed to raise ticket');
    } finally {
      setCreatingSla(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Normal': return 'success';
      case 'At Risk': return 'warning';
      case 'Breached': return 'error';
      case 'Resolved': return 'blue';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'Critical': return 'var(--accent-danger)';
      case 'High': return 'var(--accent-warning)';
      case 'Medium': return 'var(--accent-primary)';
      case 'Low': return 'var(--text-secondary)';
      default: return 'var(--text-primary)';
    }
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } } };

  const handleExport = () => {
    if (!slas || slas.length === 0) {
      message.warning("No data to export");
      return;
    }

    const exportColumns = [
      { title: "SLA ID", getValue: (r) => r.slaId },
      { 
        title: "Client", 
        getValue: (r) => {
          const entity = r.clientId || r.agencyId;
          return entity?.companyName || entity?.name || 'Unknown';
        }
      },
      { title: "Trigger Type", dataIndex: "triggerType" },
      { title: "Due Date", getValue: (r) => new Date(r.dueDate).toLocaleDateString() },
      { title: "Priority", dataIndex: "priority" },
      { title: "Status", dataIndex: "status" },
      { title: "Description", dataIndex: "description" }
    ];

    exportToCSV(slas, exportColumns, `SLA_Report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const columns = [
    { 
      title: 'SLA ID', 
      dataIndex: 'slaId', 
      key: 'slaId',
      render: text => <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{text}</span>
    },
    { 
      title: 'CLIENT', 
      key: 'client', 
      render: (_, r) => {
        const entity = r.clientId || r.agencyId;
        const name = entity?.companyName || entity?.name || 'Unknown';
        const initial = name !== 'Unknown' ? name[0].toUpperCase() : 'U';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar style={{ backgroundColor: 'var(--accent-primary)' }}>{initial}</Avatar>
            <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>
          </div>
        );
      }
    },
    { title: 'TRIGGER TYPE', dataIndex: 'triggerType', key: 'triggerType' },
    { 
      title: 'DUE DATE', 
      dataIndex: 'dueDate', 
      key: 'dueDate', 
      render: text => <span style={{ color: 'var(--text-secondary)' }}>{new Date(text).toLocaleDateString()}</span> 
    },
    { 
      title: 'PRIORITY', 
      dataIndex: 'priority', 
      key: 'priority',
      render: val => <strong style={{ color: getPriorityColor(val) }}>{val}</strong>
    },
    { 
      title: 'STATUS', 
      dataIndex: 'status', 
      key: 'status', 
      render: (val) => {
        let color = getStatusColor(val);
        return <Tag color={color} style={{ borderRadius: 12 }}>{val}</Tag>
      } 
    },
    { 
      title: 'ACTIONS', 
      key: 'actions', 
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" onClick={() => handleView(r._id)} style={{ color: 'var(--text-primary)' }}>View</Button>
          {r.status !== 'Resolved' && (
            <Button type="text" size="small" danger onClick={() => handleEscalate(r._id)}>Escalate</Button>
          )}
        </div>
      ) 
    }
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>SLA & Success</Title>
          <Text type="secondary">Monitor service level compliance and business events.</Text>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>

          <Button icon={<Download size={16} />} onClick={handleExport} style={{ borderRadius: 8, borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-secondary)' }}>Export Report</Button>
        </div>
      </motion.div>

      {stats && (
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'OVERALL COMPLIANCE', val: `${stats.compliance}%`, sub: 'Target 95%', color: 'var(--text-primary)', icon: <Target size={20} />, iconColor: 'var(--accent-primary)', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, transparent 100%)' },
          { label: 'ACTIVE BREACHES', val: stats.stats.breached, sub: 'Needs immediate action', color: 'var(--accent-danger)', isAlert: stats.stats.breached > 0, icon: <AlertOctagon size={20} />, iconColor: 'var(--accent-danger)', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, transparent 100%)' },
          { label: 'AT RISK', val: stats.stats.atRisk, sub: 'Approaching deadline', color: 'var(--accent-warning)', icon: <AlertTriangle size={20} />, iconColor: 'var(--accent-warning)', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, transparent 100%)' },
          { label: 'PAYMENT ISSUES', val: stats.stats.paymentIssues, sub: 'Unpaid/Failed invoices', color: 'var(--accent-danger)', icon: <AlertCircle size={20} />, iconColor: 'var(--accent-danger)', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, transparent 100%)' }
        ].map((kpi, i) => (
          <Col style={{ flex: '1 1 200px', minWidth: 200 }} key={i}>
            <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: '100%' }}>
              <Card 
                className="glassmorphism" 
                bodyStyle={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }} 
                style={{ 
                  borderRadius: 16, height: '100%', border: '1px solid var(--border-color)', 
                  boxShadow: 'var(--shadow-md)', background: 'var(--glass-bg)', position: 'relative', overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: kpi.gradient, pointerEvents: 'none' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, position: 'relative', zIndex: 1 }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5 }}>{kpi.label}</Text>
                  <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'var(--bg-secondary)', color: kpi.iconColor, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    {kpi.icon}
                  </div>
                </div>
                
                <div style={{ marginTop: 'auto', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Title level={2} style={{ margin: '0 0 4px', fontSize: 36, fontWeight: 800, color: kpi.color }}>{kpi.val}</Title>
                  {kpi.isAlert && <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ color: 'var(--accent-danger)', fontSize: 24, lineHeight: 1 }}>●</motion.span>}
                </div>
                <Text style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', position: 'relative', zIndex: 1 }}>{kpi.sub}</Text>
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>
      )}

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={24} xl={24} xxl={17}>
          <motion.div variants={itemVariants} className="glassmorphism" style={{ padding: '20px 24px', borderRadius: 16, marginBottom: 24, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
              <Input.Search 
                placeholder="Search SLAs..." 
                value={filters.search}
                onChange={e => handleFilterChange({ ...filters, search: e.target.value })} 
                onSearch={val => handleFilterChange({ ...filters, search: val })} 
                style={{ width: '100%', maxWidth: 360 }} 
                allowClear
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Select value={filters.triggerType} onChange={val => handleFilterChange({...filters, triggerType: val})} style={{ width: 140 }}>
                  <Option value="All">All Types</Option>
                  <Option value="Due Date">Due Date</Option>
                  <Option value="Payment">Payment</Option>
                  <Option value="Client Issue">Client Issue</Option>
                </Select>
                {['All', 'Normal', 'At Risk', 'Breached'].map(f => (
                  <Button 
                    key={f} 
                    type={filters.status === f ? 'primary' : 'default'} 
                    onClick={() => handleFilterChange({ ...filters, status: f })}
                    style={{ 
                      borderRadius: 20, 
                      background: filters.status === f ? 'var(--text-primary)' : 'transparent',
                      color: filters.status === f ? 'var(--bg-primary)' : 'var(--text-secondary)',
                      borderColor: filters.status === f ? 'var(--text-primary)' : 'var(--border-color)',
                      fontWeight: 600
                    }}
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <Table 
                columns={columns} 
                dataSource={slas} 
                rowKey="_id" 
                pagination={pagination} 
                onChange={handleTableChange}
                loading={loading}
                size="middle" 
                scroll={{ x: 900 }} 
              />
            </div>
          </motion.div>
        </Col>

        <Col xs={24} lg={24} xl={24} xxl={7}>
          {stats && stats.stats.breached > 0 && (
            <motion.div variants={itemVariants} className="glassmorphism" style={{ padding: 24, borderRadius: 16, marginBottom: 24, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(180deg, rgba(239,68,68,0.1) 0%, transparent 100%)', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-danger)', marginBottom: 8, position: 'relative', zIndex: 1 }}>
                <AlertCircle size={22} strokeWidth={2.5} />
                <strong style={{ fontSize: 18, fontWeight: 800 }}>Needs Immediate Action</strong>
              </div>
              <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 24, fontWeight: 500, position: 'relative', zIndex: 1 }}>{stats.stats.breached} records in active breach</Text>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 1 }}>
                {slas.filter(s => s.status === 'Breached').slice(0,3).map(c => (
                  <motion.div key={c._id} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
                    <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                        <strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>{c.title}</strong>
                        <Tag color="error" style={{ margin: 0, borderRadius: 12 }}>BREACHED</Tag>
                      </div>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>{c.description}</Text>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <Button type="primary" onClick={() => handleView(c._id)} style={{ flex: 1, borderRadius: 8 }}>View Details</Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div variants={itemVariants}>
            <Card 
              title={<div style={{ paddingTop: 8 }}><Title level={5} style={{ margin: 0, color: 'var(--text-primary)' }}>SLA Trend</Title></div>} 
              className="glassmorphism" style={{ borderRadius: 16, border: '1px solid var(--border-color)' }}
            >
              <div style={{ height: 200, marginTop: 16 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={slaTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="name" stroke="var(--text-tertiary)" axisLine={false} tickLine={false} />
                    <YAxis domain={[80, 100]} stroke="var(--text-tertiary)" axisLine={false} tickLine={false} />
                    <RechartsTooltip />
                    <ReferenceLine y={95} stroke="var(--accent-danger)" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="val" stroke="var(--accent-primary)" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* SLA Details Drawer */}
      <Drawer
        title={selectedSla ? `${selectedSla.slaId} Details` : 'SLA Details'}
        placement="right"
        width={500}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        className="glassmorphism-drawer"
      >
        {selectedSla && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Card title="Overview" size="small" style={{ borderRadius: 12 }}>
              <p><strong>Title:</strong> {selectedSla.title}</p>
              <p><strong>Trigger:</strong> {selectedSla.triggerType}</p>
              <p><strong>Status:</strong> <Tag color={getStatusColor(selectedSla.status)}>{selectedSla.status}</Tag></p>
              <p><strong>Priority:</strong> <strong style={{ color: getPriorityColor(selectedSla.priority) }}>{selectedSla.priority}</strong></p>
              <p><strong>Due Date:</strong> {new Date(selectedSla.dueDate).toLocaleString()}</p>
              <p><strong>Description:</strong> {selectedSla.description}</p>
              <p><strong>Client:</strong> {selectedSla.clientId ? (selectedSla.clientId.companyName || selectedSla.clientId.name || 'Unknown') : 'N/A'}</p>
              <p><strong>Agency:</strong> {selectedSla.agencyId ? (selectedSla.agencyId.companyName || selectedSla.agencyId.name || 'Unknown') : 'N/A'}</p>
            </Card>
            
            <Card title="Actions" size="small" style={{ borderRadius: 12 }}>
              <Space wrap>
                {selectedSla.status !== 'Resolved' && (
                  <>
                    <Button type="primary" success onClick={() => handleResolve(selectedSla._id)}>Mark Resolved</Button>
                    <Button danger onClick={() => handleEscalate(selectedSla._id)}>Escalate</Button>
                  </>
                )}
              </Space>
            </Card>

            <Card title="Notes" size="small" style={{ borderRadius: 12 }}>
              <div style={{ marginBottom: 16 }}>
                <Input.TextArea 
                  rows={2} 
                  placeholder="Add a note..." 
                  value={noteText} 
                  onChange={e => setNoteText(e.target.value)} 
                />
                <Button type="primary" size="small" style={{ marginTop: 8 }} onClick={handleAddNote}>Add Note</Button>
              </div>
              <Timeline style={{ marginTop: 16 }}>
                {selectedSla.notes?.map((n, i) => (
                  <Timeline.Item key={i} color="blue">
                    <Text strong>{n.createdBy?.name || 'User'}</Text> <Text type="secondary" style={{ fontSize: 12 }}>{new Date(n.createdAt).toLocaleString()}</Text>
                    <p style={{ margin: '4px 0 0' }}>{n.text}</p>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>

            <Card title="Activity Timeline" size="small" style={{ borderRadius: 12 }}>
              <Timeline>
                <Timeline.Item color="gray">
                  <Text strong>Created</Text> <Text type="secondary" style={{ fontSize: 12 }}>{new Date(selectedSla.createdAt).toLocaleString()}</Text>
                </Timeline.Item>
                {selectedSla.activityTimeline?.map((act, i) => (
                  <Timeline.Item key={i} color="blue">
                    <Text strong>{act.action}</Text> - <Text type="secondary" style={{ fontSize: 12 }}>{new Date(act.createdAt).toLocaleString()}</Text>
                    <p style={{ margin: '4px 0 0' }}>{act.details}</p>
                  </Timeline.Item>
                ))}
                {selectedSla.resolvedAt && (
                  <Timeline.Item color="green">
                    <Text strong>Resolved</Text> <Text type="secondary" style={{ fontSize: 12 }}>{new Date(selectedSla.resolvedAt).toLocaleString()}</Text>
                  </Timeline.Item>
                )}
              </Timeline>
            </Card>
          </div>
        )}
      </Drawer>

      {/* Create SLA Modal */}
      <Modal
        title="Raise SLA Ticket"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => createForm.submit()}
        confirmLoading={creatingSla}
        className="glassmorphism-modal"
        okText="Submit"
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateSla}>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Please enter a title' }]}>
            <Input placeholder="E.g., Website down, Urgent content revision" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Provide details about the issue..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dueDate" label="Due Date" rules={[{ required: true, message: 'Please select a due date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Priority" initialValue="Medium">
                <Select>
                  <Option value="Low">Low</Option>
                  <Option value="Medium">Medium</Option>
                  <Option value="High">High</Option>
                  <Option value="Critical">Critical</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </motion.div>
  );
};

export default SLA;
