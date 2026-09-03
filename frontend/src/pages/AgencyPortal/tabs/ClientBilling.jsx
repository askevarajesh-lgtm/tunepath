import React, { useState, useEffect } from 'react';
import { Table, Tag, Typography, Button, message } from 'antd';
import { FileText, Download } from 'lucide-react';
import api from '../../../services/api';
import dayjs from 'dayjs';

const { Text } = Typography;

const ClientBilling = ({ clientId }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (clientId) {
      fetchInvoices();
    }
  }, [clientId]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/invoices/client/${clientId}`);
      if (res.data?.success) {
        setInvoices(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch invoices', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'green';
      case 'Overdue': return 'red';
      case 'Issued': return 'orange';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: 'Invoice #',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      render: (text) => <Text style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{text}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Amount',
      dataIndex: 'grandTotal',
      key: 'grandTotal',
      render: (val) => <Text style={{ fontWeight: 700 }}>₹{(val || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      render: (status) => <Tag color={getStatusColor(status)} style={{ borderRadius: 12, fontWeight: 600 }}>{status}</Tag>,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="text" 
          icon={<Download size={16} />} 
          onClick={async () => {
            const hide = message.loading('Generating invoice PDF...', 0);
            try {
              const response = await api.get(`/invoices/${record._id}/pdf`, {
                responseType: 'blob'
              });
              
              const blob = new Blob([response.data], { type: 'application/pdf' });
              const downloadUrl = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = downloadUrl;
              link.setAttribute('download', `${record.invoiceNumber || 'Invoice'}.pdf`);
              document.body.appendChild(link);
              link.click();
              link.remove();
              window.URL.revokeObjectURL(downloadUrl);
              message.success('PDF downloaded successfully');
            } catch (err) {
              console.error('Error downloading PDF', err);
              message.error('Failed to download invoice PDF');
            } finally {
              hide();
            }
          }}
        />
      ),
    },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <Table 
        columns={columns} 
        dataSource={invoices} 
        rowKey="_id" 
        loading={loading}
        pagination={{ defaultPageSize: 5, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
        locale={{ emptyText: 'No invoices found for this client.' }}
      />
    </div>
  );
};

export default ClientBilling;
