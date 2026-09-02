import React, { useEffect, useState } from 'react';
import { Card, Table, Select, Space, Button, Drawer, Typography, message, Popconfirm, Input, Tag, Empty } from 'antd';
import WorkflowStatusBadge from './WorkflowStatusBadge';
import QualityScoreCard from './QualityScoreCard';
import { useSEO } from '../../context/SEOContext';
import { contentAiApi } from '../../../../../api/contentAiApi';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const STATUS_OPTIONS = ['Draft', 'In Review', 'Approved', 'Rejected', 'Published'];

// Library + Review Queue in one panel — a status filter of 'In Review'
// IS the review queue, so this isn't split into two separate components/API
// calls for what's really one list with a filter.
const LibraryPanel = () => {
  const { activeProjectId } = useSEO();
  const [pieces, setPieces] = useState([]);
  const [statusFilter, setStatusFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // full piece detail, incl. currentVersion
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpenFor, setRejectOpenFor] = useState(null);

  const load = async (status) => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (activeProjectId) params.projectId = activeProjectId;
      const res = await contentAiApi.getContentPieces(params);
      setPieces(res.data || []);
    } catch (err) {
      message.error('Failed to load content pieces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(statusFilter); }, [statusFilter, activeProjectId]);

  const openDetail = async (id) => {
    setDetailLoading(true);
    try {
      const res = await contentAiApi.getContentPiece(id);
      setSelected(res.data);
    } catch (err) {
      message.error('Failed to load content piece');
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshSelected = async () => {
    if (selected?._id) await openDetail(selected._id);
    load(statusFilter);
  };

  const act = async (fn, successMsg) => {
    try {
      await fn();
      message.success(successMsg);
      await refreshSelected();
    } catch (err) {
      message.error(err?.response?.data?.error || 'Action failed');
    }
  };

  const columns = [
    { title: 'Generator', dataIndex: 'generatorType', key: 'generatorType' },
    { title: 'Target', dataIndex: 'targetType', key: 'targetType' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <WorkflowStatusBadge status={s} /> },
    { title: 'Updated', dataIndex: 'updatedAt', key: 'updatedAt', render: (d) => new Date(d).toLocaleString() },
    {
      title: '', key: 'actions',
      render: (_, record) => <Button size="small" onClick={() => openDetail(record._id)}>View</Button>
    }
  ];

  return (
    <Card
      size="small"
      title="Content Library"
      style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}
      extra={
        <Select
          allowClear
          placeholder="Filter by status"
          style={{ width: 180 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
        />
      }
    >
      <Table
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={pieces}
        size="small"
        locale={{ emptyText: <Empty description="No content pieces yet — generate something in the Generate tab." /> }}
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
      />

      <Drawer
        title="Content Piece"
        width={640}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        loading={detailLoading}
      >
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Space>
              <WorkflowStatusBadge status={selected.status} />
              <Tag>{selected.generatorType}</Tag>
              <Tag>{selected.targetType}</Tag>
              {selected.currentVersion && <Tag>v{selected.currentVersion.versionNumber}</Tag>}
            </Space>

            {selected.status === 'Rejected' && selected.rejectionReason && (
              <Paragraph type="danger">Rejected: {selected.rejectionReason}</Paragraph>
            )}

            <Paragraph copyable={{ text: JSON.stringify(selected.currentVersion?.payload, null, 2) }}>
              <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto', margin: 0 }}>
                {JSON.stringify(selected.currentVersion?.payload, null, 2)}
              </pre>
            </Paragraph>

            <QualityScoreCard score={selected.currentVersion?.qualityScore} />

            <Space wrap>
              {selected.status === 'Draft' && (
                <Button type="primary" onClick={() => act(() => contentAiApi.submitForReview(selected._id), 'Submitted for review')}>
                  Submit for Review
                </Button>
              )}

              {selected.status === 'In Review' && (
                <>
                  <Popconfirm title="Approve this content?" onConfirm={() => act(() => contentAiApi.approveContent(selected._id), 'Approved')}>
                    <Button type="primary">Approve</Button>
                  </Popconfirm>
                  {rejectOpenFor === selected._id ? (
                    <Space>
                      <TextArea
                        rows={2}
                        style={{ width: 240 }}
                        placeholder="Reason for rejection"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <Button
                        danger
                        onClick={() => act(() => contentAiApi.rejectContent(selected._id, rejectReason), 'Rejected').then(() => { setRejectOpenFor(null); setRejectReason(''); })}
                      >
                        Confirm Reject
                      </Button>
                    </Space>
                  ) : (
                    <Button danger onClick={() => setRejectOpenFor(selected._id)}>Reject</Button>
                  )}
                </>
              )}

              {selected.status === 'Approved' && (
                <Popconfirm title="Publish this content live?" onConfirm={() => act(() => contentAiApi.publishContent(selected._id), 'Published')}>
                  <Button type="primary">Publish</Button>
                </Popconfirm>
              )}

              {selected.status === 'Published' && (
                <Text type="secondary">Published {selected.publishedAt ? new Date(selected.publishedAt).toLocaleString() : ''}</Text>
              )}
            </Space>
          </Space>
        )}
      </Drawer>
    </Card>
  );
};

export default LibraryPanel;
