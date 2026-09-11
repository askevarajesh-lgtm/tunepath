import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, Space, message, Popconfirm, Input, Select, DatePicker, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { useActionPermissions } from '../../hooks/useActionPermissions';
import api from '../../services/api';

const { Title, Text } = Typography;

const ProposalsList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [proposals, setProposals] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [searchText, setSearchText] = useState('');
  const [selectedClient, setSelectedClient] = useState(undefined);
  const [selectedStatus, setSelectedStatus] = useState(undefined);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const { canAdd, canEdit, canDelete, canView } = useActionPermissions('/proposals');

  const handleView = (proposal) => {
    navigate(`${getBaseRoute()}/proposals/${proposal._id}/view`);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [searchText, selectedClient, selectedStatus, selectedMonth]);

  const fetchClients = async () => {
    try {
      const res = await api.get('/brands');
      if (res.data?.success) {
        setClients(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchText.trim()) params.search = searchText.trim();
      if (selectedClient && selectedClient !== 'all') params.clientId = selectedClient;
      if (selectedStatus && selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedMonth) params.month = dayjs(selectedMonth).format('YYYY-MM');

      const res = await api.get('/proposals', { params });
      if (res.data?.success) {
        setProposals(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch proposals:', error);
      message.error('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchText('');
    setSelectedClient(undefined);
    setSelectedStatus(undefined);
    setSelectedMonth(null);
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/proposals/${id}`);
      if (res.data?.success) {
        message.success('Proposal deleted successfully');
        fetchProposals();
      } else {
        message.error(res.data?.message || 'Failed to delete proposal');
      }
    } catch (error) {
      console.error('Failed to delete proposal:', error);
      message.error('Failed to delete proposal');
    }
  };

  const getBaseRoute = () => {
    if (location.pathname.startsWith("/client")) return "/client/workspace";
    if (location.pathname.startsWith("/agency")) return "/agency";
    if (location.pathname.startsWith("/user")) return "/user/workspace";
    return "/workspace";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved':
        return 'green';
      case 'Sent':
        return 'cyan';
      case 'Converted to Invoice':
        return 'purple';
      case 'Rejected':
        return 'red';
      case 'Draft':
      default:
        return 'blue';
    }
  };

  const hasActiveFilters = Boolean(
    searchText || 
    (selectedClient && selectedClient !== 'all') || 
    (selectedStatus && selectedStatus !== 'all') || 
    selectedMonth
  );

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Proposals</Title>
          <Text type="secondary">Manage client proposals</Text>
        </div>
        {canAdd && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('new')}>
            Create Proposal
          </Button>
        )}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={7}>
            <Input
              placeholder="Search Proposal #, Name..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filter by Client"
              value={selectedClient}
              onChange={(val) => setSelectedClient(val)}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              <Select.Option value="all">All Clients</Select.Option>
              {clients.map((client) => (
                <Select.Option key={client._id} value={client._id}>
                  {client.name || client.companyName || 'Unknown Client'}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filter by Status"
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val)}
              allowClear
            >
              <Select.Option value="all">All Statuses</Select.Option>
              <Select.Option value="Draft">Draft</Select.Option>
              <Select.Option value="Sent">Sent</Select.Option>
              <Select.Option value="Approved">Approved</Select.Option>
              <Select.Option value="Rejected">Rejected</Select.Option>
              <Select.Option value="Converted to Invoice">Converted to Invoice</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <DatePicker
              picker="month"
              style={{ width: '100%' }}
              placeholder="Filter by Month"
              value={selectedMonth}
              onChange={(date) => setSelectedMonth(date)}
              format="MMM YYYY"
            />
          </Col>
          <Col xs={24} sm={12} md={3}>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              style={{ width: '100%' }}
            >
              Reset
            </Button>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table 
          loading={loading}
          rowKey="_id"
          columns={[
            { title: 'Proposal #', dataIndex: 'proposalNumber', key: 'proposalNumber' },
            { title: 'Name', dataIndex: 'name', key: 'name' },
            { title: 'Client', dataIndex: 'clientId', key: 'client', render: (client) => client?.name || client?.companyName || 'Unknown' },
            { 
              title: 'Campaign Amount', 
              key: 'campaignAmount', 
              render: (_, record) => {
                const campAmt = record.masterItems?.reduce((acc, item) => acc + (item.isCampaign ? (item.campaignDetails?.campaignAmount || 0) : 0), 0) || 0;
                return `₹${campAmt.toLocaleString()}`;
              } 
            },
            { 
              title: 'Service Amount', 
              key: 'serviceAmount', 
              render: (_, record) => {
                const campAmt = record.masterItems?.reduce((acc, item) => acc + (item.isCampaign ? (item.campaignDetails?.campaignAmount || 0) : 0), 0) || 0;
                const total = record.grandTotal || 0;
                return `₹${(total - campAmt).toLocaleString()}`;
              } 
            },
            { title: 'Total Amount', dataIndex: 'grandTotal', key: 'grandTotal', render: (val) => `₹${val?.toLocaleString()}` },
            { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag> },
            { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', render: (date) => date ? dayjs(date).format('DD MMM YYYY') : '-' },
            { title: 'Created By', dataIndex: 'createdBy', key: 'createdBy', render: (user) => user?.name || 'Unknown' },
            { title: 'Actions', key: 'actions', render: (_, record) => (
              <Space>
                {canView && <Button type="text" icon={<EyeOutlined />} onClick={() => handleView(record)} title="View Proposal" />}
                {canEdit && <Button type="text" icon={<EditOutlined />} onClick={() => navigate(`${getBaseRoute()}/proposals/${record._id}`)} title="Edit Proposal" />}
                {canDelete && (
                  <Popconfirm title="Delete Proposal" onConfirm={() => handleDelete(record._id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} title="Delete Proposal" />
                  </Popconfirm>
                )}
              </Space>
            )}
          ]} 
          dataSource={proposals} 
        />
      </Card>
    </div>
  );
};

export default ProposalsList;
