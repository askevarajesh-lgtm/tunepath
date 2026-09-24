import React, { useState } from 'react';
import { Table, Tag, Button, Space, Typography, Tooltip, Empty, Modal, Badge } from 'antd';
import {
  ReloadOutlined,
  PlayCircleOutlined,
  PhoneOutlined,
  CustomerServiceOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetLeadCallLogsQuery } from '../../../api/ivrApi';

const { Text } = Typography;

const getStatusTag = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'answered' || normalized === 'completed') {
    return <Tag color="success" icon={<CheckCircleOutlined />}>{(status || 'ANSWERED').toUpperCase()}</Tag>;
  }
  if (normalized === 'missed' || normalized === 'busy' || normalized === 'no answer') {
    return <Tag color="warning" icon={<ClockCircleOutlined />}>{(status || 'MISSED').toUpperCase()}</Tag>;
  }
  if (normalized === 'failed' || normalized === 'rejected') {
    return <Tag color="error" icon={<CloseCircleOutlined />}>{(status || 'FAILED').toUpperCase()}</Tag>;
  }
  return <Tag color="processing">{(status || 'INITIATED').toUpperCase()}</Tag>;
};

const formatSeconds = (sec) => {
  const s = parseInt(sec, 10) || 0;
  if (s === 0) return '0s';
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  if (mins > 0) {
    return `${mins}m ${rem}s`;
  }
  return `${rem}s`;
};

const CallHistoryTable = ({ leadId, onRefreshTrigger }) => {
  const { data, isLoading, refetch } = useGetLeadCallLogsQuery(leadId, { skip: !leadId });
  const [selectedPayload, setSelectedPayload] = useState(null);
  const [activeAudioUrl, setActiveAudioUrl] = useState(null);

  const callLogs = data?.data || [];

  const columns = [
    {
      title: 'Call ID',
      dataIndex: 'callId',
      key: 'callId',
      render: (id) => <Text copyable={{ text: id }} strong style={{ fontSize: 12 }}>{id}</Text>,
    },
    {
      title: 'Date & Time',
      key: 'dateTime',
      render: (_, record) => {
        if (record.date && record.time) {
          return `${record.date} ${record.time}`;
        }
        return record.createdAt ? dayjs(record.createdAt).format('DD-MM-YYYY HH:mm') : '—';
      },
    },
    {
      title: 'Direction',
      dataIndex: 'direction',
      key: 'direction',
      render: (dir) => (
        <Tag color={dir === 'inbound' ? 'purple' : 'cyan'} style={{ borderRadius: 4, fontWeight: 600 }}>
          {(dir || 'OUTBOUND').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Agent',
      key: 'agent',
      render: (_, record) => {
        const agentName =
          record.agentId?.name ||
          (record.calledAgents && record.calledAgents[0]?.agentName) ||
          record.agentPhone ||
          '—';
        return (
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 13 }}>{agentName}</Text>
            {record.agentPhone && <Text type="secondary" style={{ fontSize: 11 }}>{record.agentPhone}</Text>}
          </Space>
        );
      },
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_, record) => (
        <Tooltip title={`Call Duration: ${record.callDuration || 0}s | Total: ${record.totalCallDuration || 0}s`}>
          <span>{formatSeconds(record.callDuration)}</span>
        </Tooltip>
      ),
    },
    {
      title: 'DID',
      dataIndex: 'did',
      key: 'did',
      render: (did) => did || '—',
    },
    {
      title: 'Recording',
      key: 'recording',
      render: (_, record) => {
        const recordingUrl = record.callRecordingUrl || (record.callRecording?.startsWith('http') ? record.callRecording : null);

        if (!recordingUrl) {
          if (record.callRecording) {
            return (
              <Tooltip title={`File: ${record.callRecording} (Awaiting audio CDN setup)`}>
                <Tag color="default" style={{ fontSize: 11 }}>{record.callRecording}</Tag>
              </Tooltip>
            );
          }
          return <Text type="secondary" style={{ fontSize: 12 }}>No Recording</Text>;
        }

        return (
          <Space size="small">
            <Button
              type="primary"
              ghost
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => setActiveAudioUrl(recordingUrl)}
              style={{ borderRadius: 6, fontSize: 12 }}
            >
              Play
            </Button>
          </Space>
        );
      },
    },
    {
      title: 'Raw Data',
      key: 'raw',
      render: (_, record) => (
        <Tooltip title="View Sollu Webhook Payload">
          <Button
            type="text"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => setSelectedPayload(record.rawPayload || record)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <PhoneOutlined style={{ color: '#10b981', fontSize: 16 }} />
          <Text strong style={{ fontSize: 15 }}>Sollu Telephony Call Records ({callLogs.length})</Text>
        </Space>
        <Button
          icon={<ReloadOutlined />}
          size="small"
          loading={isLoading}
          onClick={() => refetch()}
        >
          Refresh Calls
        </Button>
      </div>

      <Table
        dataSource={callLogs}
        rowKey="_id"
        columns={columns}
        loading={isLoading}
        pagination={{ pageSize: 5 }}
        locale={{ emptyText: <Empty description="No call history found for this lead yet. Click 'Call' to initiate." /> }}
        size="small"
      />

      {/* Audio Playback Modal */}
      <Modal
        title={
          <Space>
            <CustomerServiceOutlined style={{ color: '#10b981' }} />
            <span>Call Recording Playback</span>
          </Space>
        }
        open={!!activeAudioUrl}
        onCancel={() => setActiveAudioUrl(null)}
        footer={[
          <Button key="close" onClick={() => setActiveAudioUrl(null)}>
            Close
          </Button>,
        ]}
        width={480}
        destroyOnClose
      >
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          {activeAudioUrl && (
            <audio controls autoPlay style={{ width: '100%' }}>
              <source src={activeAudioUrl} type="audio/mpeg" />
              <source src={activeAudioUrl} type="audio/wav" />
              Your browser does not support the audio element.
            </audio>
          )}
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" copyable={{ text: activeAudioUrl }} style={{ fontSize: 12 }}>
              Recording URL
            </Text>
          </div>
        </div>
      </Modal>

      {/* Raw Payload Inspection Modal */}
      <Modal
        title="Sollu Telephony Payload Data"
        open={!!selectedPayload}
        onCancel={() => setSelectedPayload(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedPayload(null)}>
            Close
          </Button>,
        ]}
        width={600}
      >
        <pre
          style={{
            background: '#0f172a',
            color: '#38bdf8',
            padding: 16,
            borderRadius: 8,
            maxHeight: 400,
            overflow: 'auto',
            fontSize: 12,
          }}
        >
          {JSON.stringify(selectedPayload, null, 2)}
        </pre>
      </Modal>
    </div>
  );
};

export default CallHistoryTable;
