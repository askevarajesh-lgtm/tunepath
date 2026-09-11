import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, Space, message, Popconfirm, Input, Select, DatePicker, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { useActionPermissions } from '../../hooks/useActionPermissions';
import api from '../../services/api';

const { Title, Text } = Typography;

const InvoicesList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [searchText, setSearchText] = useState('');
  const [selectedClient, setSelectedClient] = useState(undefined);
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState(undefined);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState(undefined);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const { canAdd, canEdit, canDelete, canView } = useActionPermissions('/invoices');

  const handleView = (invoice) => {
    navigate(`${getBaseRoute()}/invoices/${invoice._id}/view`);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [searchText, selectedClient, selectedInvoiceStatus, selectedPaymentStatus, selectedMonth]);

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

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchText.trim()) params.search = searchText.trim();
      if (selectedClient && selectedClient !== 'all') params.clientId = selectedClient;
      if (selectedInvoiceStatus && selectedInvoiceStatus !== 'all') params.invoiceStatus = selectedInvoiceStatus;
      if (selectedPaymentStatus && selectedPaymentStatus !== 'all') params.paymentStatus = selectedPaymentStatus;
      if (selectedMonth) params.month = dayjs(selectedMonth).format('YYYY-MM');

      const res = await api.get('/invoices', { params });
      if (res.data?.success) {
        setInvoices(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      message.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchText('');
    setSelectedClient(undefined);
    setSelectedInvoiceStatus(undefined);
    setSelectedPaymentStatus(undefined);
    setSelectedMonth(null);
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/invoices/${id}`);
      if (res.data?.success) {
        message.success('Invoice deleted successfully');
        fetchInvoices();
      } else {
        message.error(res.data?.message || 'Failed to delete invoice');
      }
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      message.error('Failed to delete invoice');
    }
  };

  const getBaseRoute = () => {
    if (location.pathname.startsWith("/client")) return "/client/workspace";
    if (location.pathname.startsWith("/agency")) return "/agency";
    if (location.pathname.startsWith("/user")) return "/user/workspace";
    return "/workspace";
  };

  const getInvoiceStatusColor = (status) => {
    switch (status) {
      case 'Paid':
        return 'green';
      case 'Sent':
        return 'cyan';
      case 'Pending':
        return 'orange';
      case 'Cancelled':
        return 'red';
      case 'Draft':
      default:
        return 'blue';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'Paid':
        return 'green';
      case 'Partially Paid':
        return 'orange';
      case 'Pending':
      default:
        return 'red';
    }
  };

  const hasActiveFilters = Boolean(
    searchText ||
    (selectedClient && selectedClient !== 'all') ||
    (selectedInvoiceStatus && selectedInvoiceStatus !== 'all') ||
    (selectedPaymentStatus && selectedPaymentStatus !== 'all') ||
    selectedMonth
  );

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Invoices</Title>
          <Text type="secondary">Manage client invoices and payments</Text>
        </div>
        {canAdd && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`${getBaseRoute()}/invoices/new`)}>
            Create Invoice
          </Button>
        )}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={5}>
            <Input
              placeholder="Search Invoice #..."
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
          <Col xs={24} sm={12} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Invoice Status"
              value={selectedInvoiceStatus}
              onChange={(val) => setSelectedInvoiceStatus(val)}
              allowClear
            >
              <Select.Option value="all">All Invoice Statuses</Select.Option>
              <Select.Option value="Draft">Draft</Select.Option>
              <Select.Option value="Sent">Sent</Select.Option>
              <Select.Option value="Pending">Pending</Select.Option>
              <Select.Option value="Paid">Paid</Select.Option>
              <Select.Option value="Cancelled">Cancelled</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Payment Status"
              value={selectedPaymentStatus}
              onChange={(val) => setSelectedPaymentStatus(val)}
              allowClear
            >
              <Select.Option value="all">All Payment Statuses</Select.Option>
              <Select.Option value="Pending">Pending</Select.Option>
              <Select.Option value="Partially Paid">Partially Paid</Select.Option>
              <Select.Option value="Paid">Paid</Select.Option>
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
          <Col xs={24} sm={12} md={2}>
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
            { title: 'Invoice #', dataIndex: 'invoiceNumber', key: 'invoiceNumber' },
            { title: 'Client', dataIndex: 'clientId', key: 'client', render: (client) => client?.name || client?.companyName || 'Unknown' },
            { title: 'Amount', dataIndex: 'grandTotal', key: 'grandTotal', render: (val) => `₹${val?.toLocaleString()}` },
            { title: 'Status', dataIndex: 'invoiceStatus', key: 'status', render: (status) => <Tag color={getInvoiceStatusColor(status)}>{status}</Tag> },
            { title: 'Payment', dataIndex: 'paymentStatus', key: 'paymentStatus', render: (status) => <Tag color={getPaymentStatusColor(status)}>{status}</Tag> },
            { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', render: (date) => date ? dayjs(date).format('DD MMM YYYY') : '-' },
            { title: 'Created By', dataIndex: 'createdBy', key: 'createdBy', render: (user) => user?.name || 'Unknown' },
            { title: 'Actions', key: 'actions', render: (_, record) => (
              <Space>
                {canView && <Button type="text" icon={<EyeOutlined />} onClick={() => handleView(record)} title="View Invoice" />}
                {canEdit && <Button type="text" icon={<EditOutlined />} onClick={() => navigate(`${getBaseRoute()}/invoices/${record._id}`)} title="Edit Invoice" />}
                {canDelete && (
                  <Popconfirm title="Delete Invoice" onConfirm={() => handleDelete(record._id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} title="Delete Invoice" />
                  </Popconfirm>
                )}
              </Space>
            )}
          ]} 
          dataSource={invoices} 
        />
      </Card>
    </div>
  );
};

export default InvoicesList;
