import React from 'react';
import { Table, Tag, Button, Typography } from 'antd';

const { Text } = Typography;

const IssueList = ({ projectId }) => {
  // Mock data for the scaffolding
  const issues = [
    {
      id: '1',
      category: 'core_web_vitals',
      severity: 'critical',
      issue: 'LCP is 3200ms (Poor)',
      aiFix: 'Optimize images in hero section and preload LCP element.',
      status: 'Open'
    },
    {
      id: '2',
      category: 'indexability',
      severity: 'high',
      issue: 'Indexable page is missing canonical',
      aiFix: '<link rel="canonical" href="https://example.com/current" />',
      status: 'Open'
    }
  ];

  const columns = [
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (text) => <Tag color="blue">{text.toUpperCase()}</Tag>
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (sev) => {
        const colors = { critical: 'red', high: 'volcano', medium: 'orange', low: 'green', info: 'default' };
        return <Tag color={colors[sev] || 'default'}>{sev.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Issue',
      dataIndex: 'issue',
      key: 'issue'
    },
    {
      title: 'AI Recommendation / Fix',
      dataIndex: 'aiFix',
      key: 'aiFix',
      render: (fix) => <Text type="secondary">{fix}</Text>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag>{status}</Tag>
    },
    {
      title: 'Action',
      key: 'action',
      render: () => <Button size="small" type="primary">Auto-Fix</Button>
    }
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      <Table 
        columns={columns} 
        dataSource={issues} 
        rowKey="id"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
      />
    </div>
  );
};

export default IssueList;
