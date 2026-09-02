import React, { useState, useEffect } from 'react';
import { Table, Tag, Typography, Button } from 'antd';
import { FileText, Download } from 'lucide-react';
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
      const res = await fetch(`/api/invoices?clientId=${clientId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setInvoices(data.data || data.invoices || []);
      }
    } catch (error) {
      console.error('Failed to fetch invoices', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'Paid') return 'success';
    if (status === 'Pending') return 'warning';
    if (status === 'Overdue') return 'error';
    return 'default';
  };

  const columns = [
    {
      title: 'Invoice',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      render: (text) => <Text style={{ fontWeight: 600 }}>{text}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'invoiceDate',
      key: 'invoiceDate',
      render: (date) => date ? dayjs(date).format('MMM DD, YYYY') : 'N/A',
    },
    {
      title: 'Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount, record) => <Text style={{ fontWeight: 700 }}>{record.currency || '$'}{amount?.toLocaleString()}</Text>,
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
            try {
              const res = await fetch(`/api/invoices/${record._id}/pdf`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
              });
              const data = await res.json();
              if (data.success && data.url) {
                window.open(data.url, '_blank');
              } else {
                console.error('Failed to get PDF URL');
              }
            } catch (err) {
              console.error('Error fetching PDF', err);
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
