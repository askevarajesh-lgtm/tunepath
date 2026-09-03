import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Table, Button, Tag, Modal, Form, Input, Select, message, Drawer, Space, Card, Timeline } from 'antd';
import { ArrowUpRight, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import SlabCard from '../../../components/SlabCard';
import { slaApi } from '../../../api/slaApi';
import { supportApi } from '../../../api/supportApi';

const { Title, Text } = Typography;
const { TextArea } = Input;

const SupportTab = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const [tickets, setTickets] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [noteText, setNoteText] = useState('');

  const getStatusColor = (status) => {
    switch(status) {
      case 'Normal': return 'success';
      case 'At Risk': return 'warning';
      case 'Breached': return 'error';
      case 'Resolved': return 'blue';
      default: return 'default';
    }
  };

  const handleView = async (slaId) => {
    try {
      const res = await slaApi.getSlaById(slaId);
      setSelectedTicket(res.data);
      setDrawerVisible(true);
    } catch (error) {
      message.error('Failed to load ticket details');
    }
  };

  const handleEscalate = async (slaId) => {
    try {
      await slaApi.escalateSla(slaId);
      message.success('Ticket escalated successfully');
      fetchSupportTickets();
      if (selectedTicket && selectedTicket._id === slaId) handleView(slaId);
    } catch (error) {
      message.error('Failed to escalate ticket');
    }
  };

  const handleResolve = async (slaId) => {
    try {
      await slaApi.updateSla(slaId, { status: 'Resolved' });
      message.success('Ticket resolved successfully');
      fetchSupportTickets();
      if (selectedTicket && selectedTicket._id === slaId) handleView(slaId);
    } catch (error) {
      message.error('Failed to resolve ticket');
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedTicket) return;
    try {
      await slaApi.addSlaNote(selectedTicket._id, noteText);
      message.success('Note added successfully');
      setNoteText('');
      handleView(selectedTicket._id);
    } catch (error) {
      message.error('Failed to add note');
    }
  };
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const selectedRequestType = Form.useWatch('typeOfRequest', form);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await supportApi.getAssignableUsers();
        if (res && res.data) {
          setAssignableUsers(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch assignable users', err);
      }
    };
    fetchUsers();
  }, []);

  const fetchSupportTickets = async () => {
    try {
      const res = await slaApi.getSlas({ triggerType: 'Client Issue' });
      if (res && res.data) {
        const fetchedTickets = res.data.map((item, index) => {
          let type = 'General';
          if (item.description && item.description.startsWith('[')) {
            type = item.description.split(']')[0].substring(1);
          }

          const days = Math.floor((new Date() - new Date(item.createdAt)) / (1000 * 60 * 60 * 24));
          const openedStr = days === 0 ? 'Today' : `${days} days`;

          return {
            id: item._id || index,
            client: item.clientId?.companyName || item.clientId?.name || 'Unknown',
            subject: item.title,
            type: type,
            priority: item.priority || 'Medium',
            am: item.assignedTo?.name || 'Unassigned',
            opened: openedStr,
            status: item.status || 'Open',
            action: 'View',
            original: item
          };
        });

        setTickets(fetchedTickets);
      }
    } catch (error) {
      console.error('Failed to fetch support tickets', error);
    }
  };

  useEffect(() => {
    fetchSupportTickets();
  }, []);

  const handleSubmitTicket = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        typeOfRequest: values.typeOfRequest === 'Other' && values.otherRequestDetails
          ? `Other: ${values.otherRequestDetails}`
          : values.typeOfRequest,
      };
      await supportApi.createSupportTicket(payload);
      message.success('Ticket raised successfully!');
      setIsModalVisible(false);
      form.resetFields();
      fetchSupportTickets();
    } catch (err) {
      message.error('Failed to raise ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityColor = (priority) => {
    if (priority === 'Critical' || priority === 'Urgent') return 'var(--accent-danger)';
    if (priority === 'High') return 'var(--accent-warning)';
    return 'var(--text-secondary)';
  };

  const columns = [
    { title: 'CLIENT', dataIndex: 'client', key: 'client', render: (val) => <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{val}</span> },
    { title: 'SUBJECT', dataIndex: 'subject', key: 'subject', render: (val) => <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{val}</span> },
    { title: 'TYPE', dataIndex: 'type', key: 'type', render: (val) => <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{val}</span> },
    { title: 'PRIORITY', dataIndex: 'priority', key: 'priority', render: (val) => <span style={{ color: getPriorityColor(val), fontWeight: 800 }}>{val}</span> },
    { title: 'AM', dataIndex: 'am', key: 'am', render: (val) => <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{val}</span> },
    { title: 'OPENED', dataIndex: 'opened', key: 'opened', render: (val) => <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{val}</span> },
    { 
      title: 'STATUS', 
      dataIndex: 'status', 
      key: 'status', 
      render: (val) => (
        <Tag style={{ 
          margin: 0, 
          border: '1px solid var(--border-color)', 
          background: 'var(--bg-tertiary)', 
          color: 'var(--text-secondary)', 
          fontWeight: 700, 
          borderRadius: 12, 
          padding: '2px 10px' 
        }}>
          {val}
        </Tag>
      ) 
    },
    { 
      title: 'ACTION', 
      key: 'action', 
      render: (_, record) => (
        <Button 
          type="text" 
          style={{ color: 'var(--accent-secondary)', fontWeight: 700, padding: 0 }}
          onClick={() => {
            handleView(record.original._id);
          }}
        >
          {record.action}
        </Button>
      ) 
    },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" >
      
      <motion.div variants={itemVariants} style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Client Support</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>All open support tickets and escalations across all clients</Text>
        </div>
        <Button 
          type="primary" 
          icon={<Plus size={16} />} 
          style={{ fontWeight: 800, borderRadius: 8, height: 40 }}
          onClick={() => setIsModalVisible(true)}
        >
          Raise Ticket
        </Button>
      </motion.div>



      <motion.div variants={itemVariants} style={{ marginBottom: 32 }}>
        <SlabCard bodyStyle={{ padding: 0 }}>
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)' }}>
            <Text style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Open Support Tickets</Text>
          </div>
          <Table 
            dataSource={tickets} 
            columns={columns} 
            pagination={false} 
            rowKey="id"
            style={{ width: '100%' }}
            
          />
        </SlabCard>
      </motion.div>



      <Modal
        title={<span style={{ fontWeight: 800, fontSize: 18 }}>Raise Support Ticket</span>}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitTicket} style={{ marginTop: 24 }}>
          <Form.Item name="subject" label={<span style={{ fontWeight: 600 }}>Subject</span>} rules={[{ required: true }]}>
            <Input placeholder="E.g., Need help with billing..." size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="typeOfRequest" label={<span style={{ fontWeight: 600 }}>Type of Request</span>} rules={[{ required: true }]}>
                <Select size="large" style={{ borderRadius: 8 }}>
                  <Select.Option value="Technical">Technical Issue</Select.Option>
                  <Select.Option value="Billing">Billing/Invoice</Select.Option>
                  <Select.Option value="Strategy">Strategy Review</Select.Option>
                  <Select.Option value="Content">Content Update</Select.Option>
                  <Select.Option value="Other">Other</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="priority" label={<span style={{ fontWeight: 600 }}>Priority Level</span>} rules={[{ required: true }]}>
                <Select size="large" style={{ borderRadius: 8 }}>
                  <Select.Option value="Medium">Normal (24h SLA)</Select.Option>
                  <Select.Option value="High">High (8h SLA)</Select.Option>
                  <Select.Option value="Critical">Critical (1h SLA)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {selectedRequestType === 'Other' && (
            <Form.Item 
              name="otherRequestDetails" 
              label={<span style={{ fontWeight: 600 }}>Specify Request Details</span>} 
              rules={[{ required: true, message: 'Please enter details for your request' }]}
            >
              <Input placeholder="E.g., Custom Integration, Feature Request..." size="large" style={{ borderRadius: 8 }} />
            </Form.Item>
          )}

          <Form.Item name="assignedToUserId" label={<span style={{ fontWeight: 600 }}>Assign To</span>} rules={[{ required: true, message: 'Please select an assignee' }]}>
            <Select size="large" placeholder="Select a manager or admin" loading={assignableUsers.length === 0} style={{ borderRadius: 8 }}>
              {assignableUsers.map(user => (
                <Select.Option key={user._id} value={user._id}>
                  {user.name} ({user.role})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="details" label={<span style={{ fontWeight: 600 }}>Details</span>} rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="Please describe your issue in detail..." style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 32 }}>
            <Button type="primary" htmlType="submit" size="large" loading={submitting} block style={{ borderRadius: 8, fontWeight: 800 }}>
              Submit Ticket
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={selectedTicket ? `${selectedTicket.slaId || 'Ticket'} Details` : 'Ticket Details'}
        placement="right"
        width={500}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        className="glassmorphism-drawer"
      >
        {selectedTicket && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Card title="Overview" size="small" style={{ borderRadius: 12 }}>
              <p><strong>Title:</strong> {selectedTicket.title}</p>
              <p><strong>Trigger:</strong> {selectedTicket.triggerType}</p>
              <p><strong>Status:</strong> <Tag color={getStatusColor(selectedTicket.status)}>{selectedTicket.status}</Tag></p>
              <p><strong>Priority:</strong> <strong style={{ color: getPriorityColor(selectedTicket.priority) }}>{selectedTicket.priority}</strong></p>
              <p><strong>Due Date:</strong> {new Date(selectedTicket.dueDate).toLocaleString()}</p>
              <p><strong>Description:</strong> {selectedTicket.description}</p>
              <p><strong>Client:</strong> {selectedTicket.clientId?.name || 'N/A'}</p>
              <p><strong>Agency:</strong> {selectedTicket.agencyId?.name || 'N/A'}</p>
            </Card>
            
            <Card title="Actions" size="small" style={{ borderRadius: 12 }}>
              <Space wrap>
                {selectedTicket.status !== 'Resolved' && (
                  <>
                    <Button type="primary" style={{ background: 'var(--accent-success)', borderColor: 'var(--accent-success)' }} onClick={() => handleResolve(selectedTicket._id)}>Mark Resolved</Button>
                    <Button danger onClick={() => handleEscalate(selectedTicket._id)}>Escalate</Button>
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
                {selectedTicket.notes?.map((n, i) => (
                  <Timeline.Item key={i} color="blue">
                    <Typography.Text strong>{n.createdBy?.name || 'User'}</Typography.Text> <Typography.Text type="secondary" style={{ fontSize: 12 }}>{new Date(n.createdAt).toLocaleString()}</Typography.Text>
                    <p style={{ margin: '4px 0 0' }}>{n.text}</p>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>

            <Card title="Activity Timeline" size="small" style={{ borderRadius: 12 }}>
              <Timeline>
                <Timeline.Item color="gray">
                  <Typography.Text strong>Created</Typography.Text> <Typography.Text type="secondary" style={{ fontSize: 12 }}>{new Date(selectedTicket.createdAt).toLocaleString()}</Typography.Text>
                </Timeline.Item>
                {selectedTicket.activityTimeline?.map((act, i) => (
                  <Timeline.Item key={i} color="blue">
                    <Typography.Text strong>{act.action}</Typography.Text> - <Typography.Text type="secondary" style={{ fontSize: 12 }}>{new Date(act.createdAt).toLocaleString()}</Typography.Text>
                    <p style={{ margin: '4px 0 0' }}>{act.details}</p>
                  </Timeline.Item>
                ))}
                {selectedTicket.resolvedAt && (
                  <Timeline.Item color="green">
                    <Typography.Text strong>Resolved</Typography.Text> <Typography.Text type="secondary" style={{ fontSize: 12 }}>{new Date(selectedTicket.resolvedAt).toLocaleString()}</Typography.Text>
                  </Timeline.Item>
                )}
              </Timeline>
            </Card>
          </div>
        )}
      </Drawer>
    </motion.div>
  );
};

export default SupportTab;
