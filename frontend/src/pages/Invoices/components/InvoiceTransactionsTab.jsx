import React, { useState } from 'react';
import { Card, Row, Col, Typography, Button, Table, Tag, Modal, Form, Input, DatePicker, Select, Upload, message, Space, Image } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetPaymentsByInvoiceQuery, useRecordPaymentMutation, useVerifyPaymentMutation } from '../../../api/paymentApi';
const { Title, Text } = Typography;
const { Option } = Select;

const InvoiceTransactionsTab = ({ invoice, isClientRole }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState([]);

  // Fetch transactions for this specific invoice
  const { data: response, isLoading: loadingTransactions, refetch } = useGetPaymentsByInvoiceQuery(invoice?._id);
  const [recordPayment, { isLoading: isRecording }] = useRecordPaymentMutation();
  const [verifyPayment, { isLoading: isVerifying }] = useVerifyPaymentMutation();
  const transactions = response?.data || [];

  const handleVerify = async (paymentId) => {
    try {
      await verifyPayment({ id: paymentId }).unwrap();
      message.success('Payment verified successfully');
      refetch();
    } catch (error) {
      message.error(error?.data?.message || 'Failed to verify payment');
    }
  };

  const handleRecordPayment = async (values) => {
    try {
      const formData = new FormData();
      formData.append('invoiceId', invoice._id);
      
      const compId = invoice.clientId?._id || invoice.clientId || invoice.companyId?._id || invoice.companyId;
      formData.append('companyId', compId);
      
      formData.append('amount', values.amount);
      formData.append('paymentDate', values.paymentDate.toISOString());
      if (values.closingInvoiceDate) {
        formData.append('closingInvoiceDate', values.closingInvoiceDate.toISOString());
      }
      formData.append('paymentMethod', values.paymentMethod);
      if (values.referenceNumber) {
        formData.append('referenceNumber', values.referenceNumber);
      }
      if (fileList.length > 0) {
        const fileToUpload = fileList[0].originFileObj || fileList[0];
        formData.append('screenshot', fileToUpload);
      }

      const res = await recordPayment(formData);
      if (res.data?.success) {
        message.success('Payment recorded successfully. It is pending verification.');
        setIsModalVisible(false);
        form.resetFields();
        setFileList([]);
        refetch();
      } else {
        message.error(res.error?.message || res.data?.message || 'Failed to record payment');
      }
    } catch (error) {
      console.error(error);
      message.error('An error occurred');
    }
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'paymentDate',
      render: (date) => dayjs(date).format('DD MMM YYYY')
    },
    {
      title: 'Closing Invoice Date',
      dataIndex: 'closingInvoiceDate',
      render: (date) => date ? dayjs(date).format('DD MMM YYYY') : '-'
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      render: (val) => `₹${Number(val).toLocaleString()}`
    },
    {
      title: 'Mode',
      dataIndex: 'paymentMethod'
    },
    {
      title: 'Reference',
      dataIndex: 'referenceNumber',
      render: (ref) => ref || '-'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status) => {
        let color = 'default';
        if (status === 'Verified' || status === 'Successful') color = 'green';
        if (status === 'Pending') color = 'orange';
        if (status === 'Rejected' || status === 'Failed') color = 'red';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    {
      title: 'Screenshot',
      dataIndex: 'screenshotUrl',
      render: (url) => url ? <Image src={url} width={50} height={50} style={{ objectFit: 'cover', borderRadius: '4px' }} /> : '-'
    },
    ...(!isClientRole ? [{
      title: 'Action',
      key: 'action',
      render: (_, record) => {
        if (record.status === 'Pending') {
          return (
            <Button 
              type="link" 
              style={{ color: '#52c41a', padding: 0 }} 
              onClick={() => handleVerify(record._id)}
              loading={isVerifying}
            >
              Verify
            </Button>
          );
        }
        return '-';
      }
    }] : [])
  ];

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString()}`;

  const masterItems = invoice?.proposalId?.masterItems || [];
  const computedCampaignAmount = masterItems.reduce((acc, item) => acc + (item.isCampaign ? (item.campaignDetails?.campaignAmount || 0) : 0), 0);
  const computedHandlingAmount = (invoice?.grandTotal || 0) - computedCampaignAmount;


  return (
    <div className="invoice-transactions-tab">
      {!isClientRole && (
        <div style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Card size="small" bordered>
                <Text type="secondary">Invoice Total</Text>
                <Title level={4} style={{ margin: 0 }}>{formatCurrency(invoice?.grandTotal)}</Title>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card size="small" bordered>
                <Text type="secondary">Handling Amount</Text>
                <Title level={4} style={{ margin: 0, color: 'var(--accent-primary)' }}>{formatCurrency(computedHandlingAmount)}</Title>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card size="small" bordered>
                <Text type="secondary">Campaign Amount</Text>
                <Title level={4} style={{ margin: 0 }}>{formatCurrency(computedCampaignAmount)}</Title>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card size="small" bordered>
                <Text type="secondary">Total Paid</Text>
                <Title level={4} style={{ margin: 0 }}>{formatCurrency(invoice?.totalPaid)}</Title>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card size="small" bordered>
                <Text type="secondary">Pending Amount</Text>
                <Title level={4} style={{ margin: 0 }}>{formatCurrency(invoice?.pendingAmount)}</Title>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card size="small" bordered>
                <Text type="secondary">Payments</Text>
                <Title level={4} style={{ margin: 0 }}>{transactions.length} transaction(s)</Title>
              </Card>
            </Col>
          </Row>
        </div>
      )}

      <Card
        title="Payment Transactions"
        extra={!isClientRole && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
            Record Payment
          </Button>
        )}
      >
        <Table
          dataSource={transactions}
          columns={columns}
          rowKey="_id"
          loading={loadingTransactions}
          pagination={false}
          locale={{ emptyText: "No payments recorded yet" }}
        />
      </Card>

      <Modal
        title="Record Payment"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" form={form} onFinish={handleRecordPayment}>
          <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true, message: 'Please enter amount' }]}>
            <Input type="number" placeholder="Enter payment amount" />
          </Form.Item>
          <Form.Item name="paymentDate" label="Payment Date" rules={[{ required: true, message: 'Please select date' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="closingInvoiceDate" label="Closing Invoice Date">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Select date" />
          </Form.Item>
          <Form.Item name="paymentMethod" label="Payment Method" rules={[{ required: true, message: 'Please select method' }]}>
            <Select placeholder="Select payment method">
              <Option value="Bank Transfer">Bank Transfer</Option>
              <Option value="Cash">Cash</Option>
              <Option value="Cheque">Cheque</Option>
              <Option value="UPI">UPI</Option>
              <Option value="Other">Other</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Payment Screenshot">
            <Upload
              beforeUpload={(file) => {
                setFileList([file]);
                return false;
              }}
              onRemove={() => setFileList([])}
              fileList={fileList}
              maxCount={1}
              accept="image/*"
            >
              <Button icon={<UploadOutlined />}>Upload Max: 1MB</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="referenceNumber" label="Reference Number (Optional)">
            <Input placeholder="Enter reference number" />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={isRecording} danger>
                Record Payment
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InvoiceTransactionsTab;
