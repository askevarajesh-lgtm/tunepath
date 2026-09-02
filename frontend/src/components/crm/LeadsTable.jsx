import React from 'react';
import { Table, Tag, Button, Input, Space } from 'antd';
import { Search, Filter, MoreHorizontal, Download } from 'lucide-react';
import { leadsData } from '../../data/mock';

const LeadsTable = () => {
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong>,
    },
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
    },
    {
      title: 'Status',
      key: 'status',
      dataIndex: 'status',
      render: (status) => {
        let color = status === 'New' ? 'blue' : status === 'Contacted' ? 'orange' : status === 'Qualified' ? 'green' : 'red';
        return <Tag color={color} style={{ borderRadius: 12 }}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Health Score',
      dataIndex: 'score',
      key: 'score',
      sorter: (a, b) => a.score - b.score,
      render: (score) => {
        let color = score > 80 ? 'var(--accent-secondary)' : score > 50 ? 'var(--accent-warning)' : 'var(--accent-danger)';
        return <strong style={{ color }}>{score}</strong>;
      }
    },
    {
      title: 'Owner',
      dataIndex: 'owner',
      key: 'owner',
    },
    {
      title: 'Last Contact',
      dataIndex: 'lastContact',
      key: 'lastContact',
    },
    {
      title: 'Action',
      key: 'action',
      render: () => (
        <Button type="text" icon={<MoreHorizontal size={16} />} />
      ),
    },
  ];

  return (
    <div className="glassmorphism" style={{ padding: 24, borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Input 
            placeholder="Search leads..." 
            prefix={<Search size={16} />} 
            style={{ width: 250, borderRadius: 8, background: 'var(--bg-primary)' }}
          />
          <Button icon={<Filter size={16} />} style={{ borderRadius: 8 }}>Filter</Button>
        </Space>
        <Button type="primary" icon={<Download size={16} />} style={{ borderRadius: 8 }}>
          Export
        </Button>
      </div>
      <Table 
        columns={columns} 
        dataSource={leadsData} 
        rowKey="id"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
        style={{ background: 'transparent' }}
      />
    </div>
  );
};

export default LeadsTable;
