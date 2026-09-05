import React from 'react';
import { Table, Typography, Tag } from 'antd';
import { ExternalLink } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

const { Text } = Typography;

const BacklinksPages = ({ localData }) => {
  const { projectData } = useOutletContext();
  const backlinksOverview = localData?.backlinksOverview || projectData?.backlinksOverview || {};
  const pages = backlinksOverview?.indexedPages || backlinksOverview?.pages || [];

  const columns = [
    {
      title: 'Title and URL',
      dataIndex: 'url',
      key: 'url',
      width: 400,
      render: (text, record) => {
        const displayTitle = record?.title || record?.source_title || record?.target_title || text;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', paddingRight: 20 }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {displayTitle}
            </span>
            <a href={text} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontSize: 13, wordBreak: 'break-all', marginTop: 4, textDecoration: 'none' }}>
              {text} <ExternalLink size={12} style={{ marginLeft: 4 }} />
            </a>
            <div style={{ marginTop: 8 }}>
               <Tag color="#ffe8e6" style={{ color: '#ff7a45', border: 'none', fontWeight: 500 }}>200</Tag>
            </div>
          </div>
        );
      }
    },
    {
      title: 'Backlinks',
      dataIndex: 'links',
      key: 'links',
      width: 120,
      align: 'right',
      render: (val) => <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{Number(val || 0).toLocaleString()}</span>
    },
    {
      title: 'Domains',
      dataIndex: 'domains',
      key: 'domains',
      width: 120,
      align: 'right',
      render: (val) => <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{Number(val || 0).toLocaleString()}</span>
    },
    {
      title: 'External Links',
      dataIndex: 'external',
      key: 'external',
      width: 120,
      align: 'right',
      render: (val) => <span>{val ?? 'Unavailable'}</span>
    },
    {
      title: 'Internal Links',
      dataIndex: 'internal',
      key: 'internal',
      width: 120,
      align: 'right',
      render: (val) => <span>{val ?? 'Unavailable'}</span>
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
          <Text strong style={{ fontSize: 16 }}>Indexed Pages 1 - {pages.length}</Text>
       </div>
       <Table
          dataSource={pages}
          columns={columns}
          rowKey={(record, idx) => (record.url || '') + idx}
          pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'], showSizeChanger: false }}
          className="bl-table-minimal"
          scroll={{ x: 1300 }}
       />
    </div>
  );
};

export default BacklinksPages;
