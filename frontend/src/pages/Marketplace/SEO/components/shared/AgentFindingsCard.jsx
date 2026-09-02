import React, { useState } from 'react';
import { Card, Button, Table, Space, Typography, message, Popconfirm, Input, Empty, Alert, Collapse } from 'antd';
import { PlayCircle, History as HistoryIcon } from 'lucide-react';
import { ApprovalStatusTag } from './StatusTags';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const AgentFindingsCard = ({
  title,
  runLabel = 'Run Analysis',
  emptyHint = 'Run the agent to see findings here.',
  disabled = false,
  disabledReason,
  findingsKey = 'findings',
  columns,
  onRun,
  onApprove,
  onReject,
  onLoadHistory,
  extraActions,
  historyRenderer,
  doc: controlledDoc,
  onDocChange
}) => {
  const [internalDoc, setInternalDoc] = useState(null);
  const doc = controlledDoc !== undefined ? controlledDoc : internalDoc;
  const setDoc = (updater) => {
    if (onDocChange) {
      onDocChange((prev) => (typeof updater === 'function' ? updater(prev ?? doc) : updater));
    } else {
      setInternalDoc(updater);
    }
  };
  const [running, setRunning] = useState(false);
  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);

  const findings = Array.isArray(doc?.agent?.[findingsKey]) ? doc.agent[findingsKey] : [];
  const approvalStatus = doc?.agent?.approvalStatus || 'Not Requested';

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await onRun();
      setDoc(res.data || res);
      message.success('Run completed');
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  const approve = async () => {
    setActing(true);
    try {
      const res = await onApprove(doc._id);
      setDoc((prev) => ({ ...prev, agent: { ...prev.agent, approvalStatus: 'Approved' }, ...res.data }));
      const createdCount = res.createdTasks?.length;
      message.success(createdCount ? `Approved — ${createdCount} task(s) created` : 'Approved');
    } catch (err) {
      message.error(err?.response?.data?.error || err?.response?.data?.message || 'Approve failed');
    } finally {
      setActing(false);
    }
  };

  const reject = async () => {
    setActing(true);
    try {
      await onReject(doc._id, rejectReason);
      setDoc((prev) => ({ ...prev, agent: { ...prev.agent, approvalStatus: 'Rejected', rejectionReason: rejectReason } }));
      message.success('Rejected');
      setRejectOpen(false);
      setRejectReason('');
    } catch (err) {
      message.error(err?.response?.data?.error || err?.response?.data?.message || 'Reject failed');
    } finally {
      setActing(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await onLoadHistory();
      const list = res.data || res;
      setHistory(Array.isArray(list) ? list : []);
    } catch (err) {
      message.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <Card
      size="small"
      title={title}
      style={{ borderRadius: 12, border: '1px solid var(--border-color)' }}
      extra={
        <Space>
          {extraActions}
          <Button icon={<PlayCircle size={14} />} type="primary" loading={running} disabled={disabled} onClick={run}>
            {runLabel}
          </Button>
        </Space>
      }
    >
      {disabled && disabledReason && <Alert type="info" showIcon message={disabledReason} style={{ marginBottom: 16 }} />}
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />}

      {!doc && !running && !error && (
        <Empty description={emptyHint} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}

      {doc && (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap>
            <ApprovalStatusTag status={approvalStatus} />
            {doc.completedAt && <Text type="secondary">Completed {new Date(doc.completedAt).toLocaleString()}</Text>}
          </Space>

          {doc.agent?.summary && <Paragraph>{doc.agent.summary}</Paragraph>}

          {doc.agent?.rejectionReason && approvalStatus === 'Rejected' && (
            <Alert type="warning" showIcon message={`Rejected: ${doc.agent.rejectionReason}`} />
          )}

          <Table
            rowKey={(r, i) => r._id || i}
            size="small"
            columns={columns}
            dataSource={findings}
            pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
            locale={{ emptyText: <Empty description="No findings on this run" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          />

          {approvalStatus === 'Pending Approval' && (
            <Space>
              <Popconfirm title="Approve these findings? This will generate follow-up tasks." onConfirm={approve}>
                <Button type="primary" loading={acting}>Approve</Button>
              </Popconfirm>
              {rejectOpen ? (
                <Space>
                  <TextArea rows={1} style={{ width: 240 }} placeholder="Reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                  <Button danger loading={acting} onClick={reject}>Confirm Reject</Button>
                </Space>
              ) : (
                <Button danger onClick={() => setRejectOpen(true)}>Reject</Button>
              )}
            </Space>
          )}
        </Space>
      )}

      <Collapse
        style={{ marginTop: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}
        items={[{
          key: 'history',
          label: <Space><HistoryIcon size={14} /> Execution History</Space>,
          children: (
            <>
              {!history && <Button size="small" loading={historyLoading} onClick={loadHistory}>Load history</Button>}
              {history && (historyRenderer ? historyRenderer(history) : (
                <Table
                  rowKey={(r, i) => r._id || i}
                  size="small"
                  pagination={{ defaultPageSize: 5, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
                  dataSource={history || []}
                  locale={{ emptyText: <Empty description="No previous runs" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                  columns={[
                    { title: 'Status', dataIndex: 'status', key: 'status' },
                    { title: 'Started', dataIndex: 'createdAt', key: 'createdAt', render: (d) => d ? new Date(d).toLocaleString() : '-' },
                    { title: 'Duration', dataIndex: 'durationMs', key: 'durationMs', render: (v) => v ? `${(v / 1000).toFixed(1)}s` : '-' },
                    { title: 'Error', dataIndex: 'error', key: 'error', render: (v) => v || '-' }
                  ]}
                />
              ))}
            </>
          )
        }]}
      />
    </Card>
  );
};

export default AgentFindingsCard;