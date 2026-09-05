import React from 'react';
import { Table, Typography } from 'antd';
import { useOutletContext } from 'react-router-dom';

const { Text } = Typography;

const BacklinksAnchors = ({ localData }) => {
  const { projectData } = useOutletContext();
  const backlinksOverview = localData?.backlinksOverview || projectData?.backlinksOverview || {};
  const anchors = backlinksOverview?.anchors || [];

  const columns = [
    {
      title: 'Anchor Text',
      dataIndex: 'anchor',
      key: 'anchor',
      render: (text) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{text || 'Empty Anchor'}</span>
    },
    {
      title: 'Backlinks',
      dataIndex: 'links',
      key: 'links',
      width: 150,
      align: 'right',
      render: (val) => <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{Number(val).toLocaleString()}</span>
    },
    {
      title: 'Domains',
      dataIndex: 'domains',
      key: 'domains',
      width: 150,
      align: 'right',
      render: (val) => <span>{Number(val).toLocaleString()}</span>
    },
    {
      title: 'First Seen',
      key: 'first_seen',
      width: 150,
      render: () => '-'
    },
    {
      title: 'Last Seen',
      key: 'last_seen',
      width: 150,
      render: () => '-'
    }
  ];

  return (
    <div style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: 8 }}>
       <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <Text strong style={{ fontSize: 16 }}>Anchors 1 - {anchors.length}</Text>
       </div>
       <Table
          dataSource={anchors}
          columns={columns}
          rowKey={(record, idx) => record.anchor + idx}
          pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'], showSizeChanger: false }}
          className="bl-table-minimal"
          scroll={{ x: 1000 }}
       />
    </div>
  );
};

export default BacklinksAnchors;
