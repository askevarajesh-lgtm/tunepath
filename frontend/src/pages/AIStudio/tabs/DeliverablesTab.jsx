import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Tag, Modal, Form, Input, DatePicker, Select, message, Space } from 'antd';
import { Plus, Eye, Send } from 'lucide-react';
import api from '../../../services/api';
import dayjs from 'dayjs';
import { useAIStudio } from '../context/AIStudioContext';
import { useAuth } from '../../../contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

const DeliverablesTab = () => {
  const { assets } = useAIStudio();
  const { user } = useAuth();
  const canCreate = ['supreme_super_admin', 'superadmin', 'commander_admin', 'agency_super_admin', 'agency_manager', 'brand_super_admin', 'brand_manager'].includes(user?.role) || user?.permissions?.['Workspace-AI Studio']?.Create;
  const canView = ['supreme_super_admin', 'superadmin', 'commander_admin', 'agency_super_admin', 'agency_manager', 'brand_super_admin', 'brand_manager'].includes(user?.role) || user?.permissions?.['Workspace-AI Studio']?.View;
  
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [clients, setClients] = useState([]);
  const [form] = Form.useForm();

  const fetchDeliverables = async () => {
    try {
      setLoading(true);
      const res = await api.get('/deliverables');
      if (res.data.success) {
        setDeliverables(res.data.data.deliverables || res.data.data);
      }
    } catch (error) {
      console.error('Error fetching deliverables:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get('/brands');
      if (res.data.success) {
        setClients(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  useEffect(() => {
    fetchDeliverables();
    fetchClients();
  }, []);

  const handleCreate = async (values) => {
    try {
      // Find the selected asset to get its URL
      const selectedAsset = assets.find(a => a._id === values.assetId);
      const assetUrl = selectedAsset ? selectedAsset.url : '';

      const payload = {
        title: values.title,
        deliverableType: values.deliverableType,
        clientId: values.clientId,
        dueDate: values.dueDate.format('YYYY-MM-DD'),
        description: `AI Generated Asset Link: ${assetUrl}`,
        assetUrl: assetUrl
      };
      
      const res = await api.post('/deliverables', payload);
      if (res.data.success) {
        message.success('Deliverable created and sent to client');
        setIsModalVisible(false);
        form.resetFields();
        fetchDeliverables();
      }
    } catch (error) {
      console.error(error);
      message.error(error.response?.data?.message || 'Failed to create deliverable');
    }
  };

  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState(null);

  const columns = [
    {
      title: 'Item',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'deliverableType',
      key: 'type',
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date) => dayjs(date).format('MMM D, YYYY'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'default';
        const normalized = (status || '').toLowerCase();
        let displayStatus = status || 'Pending';
        if (normalized === 'approved') color = 'success';
        else if (normalized === 'revisions' || normalized === 'rejected') color = 'error';
        else if (normalized === 'in_review' || normalized === 'pending' || normalized === 'backlog') {
          color = 'warning';
          if (normalized === 'backlog') displayStatus = 'pending';
        }
        return <Tag color={color}>{displayStatus}</Tag>;
      },
    },
    ...(canView ? [{
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="link" 
          size="small"
          onClick={() => {
            setSelectedDeliverable(record);
            setViewModalVisible(true);
          }}
        >
          View
        </Button>
      ),
    }] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4}>Deliverables</Title>
          <Text type="secondary">Send AI-generated work to clients for approval.</Text>
        </div>
        {canCreate && (
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setIsModalVisible(true)}>
            New Deliverable
          </Button>
        )}
      </div>

      <Card bordered={false} className="glassmorphism" style={{ borderRadius: 12 }}>
        <Table scroll={{ x: 800 }}  
          columns={columns} 
          dataSource={deliverables} 
          rowKey="_id" 
          loading={loading}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
        />
      </Card>

      <Modal
        title="Send AI Asset to Client"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="Deliverable Title" rules={[{ required: true }]}>
            <Input placeholder="e.g., Q3 Instagram Ad Image" />
          </Form.Item>
          <Form.Item name="clientId" label="Client" rules={[{ required: true }]}>
            <Select placeholder="Select client">
              {clients.map(c => <Option key={c._id} value={c._id}>{c.brandName || c.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="deliverableType" label="Asset Type" rules={[{ required: true }]}>
            <Select placeholder="Select type">
              <Option value="social_post">Social Media</Option>
              <Option value="ad_creative">Ad Creative</Option>
              <Option value="video_creative">Video</Option>
              <Option value="website_design">Web Design</Option>
            </Select>
          </Form.Item>
          <Form.Item name="dueDate" label="Due Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="assetId" label="Select AI Asset" rules={[{ required: true }]}>
            <Select placeholder="Choose an asset from your library">
              {assets.map(asset => (
                <Option key={asset._id} value={asset._id}>
                  {asset.type === 'video' ? '🎬' : '🖼️'} {asset.prompt ? asset.prompt.substring(0, 40) : 'AI Asset'}...
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" icon={<Send size={16} />}>
                Create & Send
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="View Deliverable"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            Close
          </Button>
        ]}
      >
        {selectedDeliverable && (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 350px', minWidth: 350 }}>
              {selectedDeliverable.assetUrl ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-start' }}>
                  {selectedDeliverable.assetUrl.startsWith('data:image') || selectedDeliverable.assetUrl.match(/\.(jpeg|jpg|gif|png)$/i) != null ? (
                    <img 
                      src={selectedDeliverable.assetUrl} 
                      alt="Deliverable Asset" 
                      style={{ width: '100%', borderRadius: 8, border: '1px solid #eee' }} 
                    />
                  ) : (
                    <a href={selectedDeliverable.assetUrl} target="_blank" rel="noreferrer">
                      View Asset
                    </a>
                  )}
                </div>
              ) : (
                <div style={{ width: '100%', height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: 8, border: '1px dashed #d9d9d9' }}>
                  <Text type="secondary">No Asset Attached</Text>
                </div>
              )}
            </div>
            <div style={{ flex: '1 1 350px', minWidth: 350 }}>
              <div style={{ marginBottom: 16 }}>
                <Text strong>Title: </Text>
                <Text>{selectedDeliverable.title}</Text>
              </div>
              <div style={{ marginBottom: 16 }}>
                <Text strong>Type: </Text>
                <Text style={{ textTransform: 'capitalize' }}>
                  {selectedDeliverable.deliverableType ? selectedDeliverable.deliverableType.replace('_', ' ') : 'N/A'}
                </Text>
              </div>
              <div style={{ marginBottom: 16 }}>
                <Text strong>Status: </Text>
                <Tag color={selectedDeliverable.status === 'approved' ? 'success' : selectedDeliverable.status === 'revisions' ? 'error' : (selectedDeliverable.status === 'in_review' || selectedDeliverable.status === 'backlog') ? 'warning' : 'default'}>
                  {selectedDeliverable.status === 'backlog' ? 'pending' : (selectedDeliverable.status || 'Pending')}
                </Tag>
              </div>
              {selectedDeliverable.status === 'revisions' && selectedDeliverable.approvalHistory && selectedDeliverable.approvalHistory.some(h => h.action === 'revision_requested') && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ color: 'var(--accent-danger)' }}>Rejection Reason: </Text>
                  <Text style={{ color: 'var(--accent-danger)' }}>
                    {selectedDeliverable.approvalHistory.filter(h => h.action === 'revision_requested').pop().remarks || 'No reason provided.'}
                  </Text>
                </div>
              )}
              {selectedDeliverable.description && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Description: </Text>
                  <p style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                    {selectedDeliverable.assetUrl && selectedDeliverable.description.includes(selectedDeliverable.assetUrl)
                      ? selectedDeliverable.description.replace(selectedDeliverable.assetUrl, '(Asset Attached)')
                      : selectedDeliverable.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DeliverablesTab;
