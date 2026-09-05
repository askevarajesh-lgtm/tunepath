import React from 'react';
import { Table, Tag, Typography } from 'antd';
import { ExternalLink } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

const { Text } = Typography;

const BacklinksList = ({ localData }) => {
  const { projectData } = useOutletContext();
  const backlinksOverview = localData?.backlinksOverview || projectData?.backlinksOverview || {};
  const rawBacklinks = backlinksOverview?.rawBacklinks || [];

  const columns = [
    {
      title: 'Page AS',
      dataIndex: 'page_as',
      key: 'page_as',
      width: 100,
      align: 'center',
      render: (val) => <span style={{ fontWeight: 600 }}>{val}</span>
    },
    {
      title: 'Source page Title and URL',
      dataIndex: 'source_title',
      key: 'source_title',
      width: 350,
      render: (text, record) => (
        <div style={{ display: 'flex', flexDirection: 'column', paddingRight: 20 }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{text || record.source_url}</span>
          <a href={record.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontSize: 13, wordBreak: 'break-all', marginTop: 4, textDecoration: 'none' }}>
            {record.source_url} <ExternalLink size={12} style={{ marginLeft: 4 }} />
          </a>
        </div>
      )
    },
    {
      title: 'Ext. Links',
      dataIndex: 'external',
      key: 'external',
      width: 120,
      align: 'right'
    },
    {
      title: 'Int. Links',
      dataIndex: 'internal',
      key: 'internal',
      width: 120,
      align: 'right'
    },
    {
      title: 'Anchor and Target URL',
      dataIndex: 'anchor',
      key: 'anchor',
      width: 300,
      render: (text, record) => (
        <div style={{ display: 'flex', flexDirection: 'column', paddingRight: 20 }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{text || 'Empty Anchor'}</span>
          <a href={record.target_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontSize: 13, wordBreak: 'break-all', marginTop: 4, textDecoration: 'none' }}>
            {record.target_url} <ExternalLink size={12} style={{ marginLeft: 4 }} />
          </a>
          <div style={{ marginTop: 8 }}>
             <Tag color="default" style={{ fontSize: 11, background: 'var(--border-color)', border: 'none', color: 'var(--text-secondary)' }}>Text</Tag>
          </div>
        </div>
      )
    },
    {
      title: 'First Seen',
      dataIndex: 'first_seen',
      key: 'first_seen',
      width: 120,
      render: (val) => {
          if (!val) return '-';
          const d = new Date(val * 1000);
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    },
    {
      title: 'Last Seen',
      dataIndex: 'last_seen',
      key: 'last_seen',
      width: 120,
      render: (val) => {
          if (!val) return '-';
          const d = new Date(val * 1000);
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
  ];

  return (
    <div style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: 8 }}>
       <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <Text strong style={{ fontSize: 16 }}>Backlinks 1 - {rawBacklinks.length}</Text>
       </div>
       <Table
          dataSource={rawBacklinks}
          columns={columns}
          rowKey={(record, idx) => record.source_url + idx}
          pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'], showSizeChanger: false }}
          className="bl-table-minimal"
          scroll={{ x: 1400 }}
       />
    </div>
  );
};

export default BacklinksList;
