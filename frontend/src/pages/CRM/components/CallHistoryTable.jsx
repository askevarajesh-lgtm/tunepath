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
  CopyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetLeadCallLogsQuery } from '../../../api/ivrApi';

const { Text } = Typography;

const getStatusTag = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'answered' || normalized === 'completed') {
    return (
      <Tag
        color="success"
        icon={<CheckCircleOutlined />}
        style={{ borderRadius: 6, fontWeight: 600, padding: '2px 8px' }}
      >
        {(status || 'ANSWERED').toUpperCase()}
      </Tag>
    );
  }
  if (normalized === 'missed' || normalized === 'busy' || normalized === 'no answer') {
    return (
      <Tag
        color="warning"
        icon={<ClockCircleOutlined />}
        style={{ borderRadius: 6, fontWeight: 600, padding: '2px 8px' }}
      >
        {(status || 'MISSED').toUpperCase()}
      </Tag>
    );
  }
  if (normalized === 'failed' || normalized === 'rejected') {
    return (
      <Tag
        color="error"
        icon={<CloseCircleOutlined />}
        style={{ borderRadius: 6, fontWeight: 600, padding: '2px 8px' }}
      >
        {(status || 'FAILED').toUpperCase()}
      </Tag>
    );
  }
  return (
    <Tag
      color="processing"
      style={{ borderRadius: 6, fontWeight: 600, padding: '2px 8px' }}
    >
      {(status || 'INITIATED').toUpperCase()}
    </Tag>
  );
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
      width: 200,
      render: (id) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <Text
            copyable={{ text: id, tooltips: ['Copy Call ID', 'Copied!'] }}
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              background: '#f8fafc',
              padding: '3px 6px',
              borderRadius: 4,
              border: '1px solid #e2e8f0',
              color: '#334155',
              fontWeight: 600,
            }}
          >
            {id}
          </Text>
        </div>
      ),
    },
    {
      title: 'Date & Time',
      key: 'dateTime',
      width: 170,
      render: (_, record) => {
        let displayTime = '—';
        if (record.date && record.time) {
          displayTime = `${record.date} ${record.time}`;
        } else if (record.createdAt) {
          displayTime = dayjs(record.createdAt).format('DD-MM-YYYY HH:mm');
        }
        return <span style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{displayTime}</span>;
      },
    },
    {
      title: 'Direction',
      dataIndex: 'direction',
      key: 'direction',
      width: 120,
      render: (dir) => (
        <Tag
          color={dir === 'inbound' ? 'purple' : 'cyan'}
          style={{ borderRadius: 6, fontWeight: 700, padding: '2px 8px' }}
        >
          {(dir || 'OUTBOUND').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Agent',
      key: 'agent',
      width: 180,
      render: (_, record) => {
        const agentName =
          record.agentId?.name ||
          (record.calledAgents && record.calledAgents[0]?.agentName) ||
          record.agentPhone ||
          '—';
        return (
          <Space direction="vertical" size={1} style={{ whiteSpace: 'nowrap' }}>
            <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
              {agentName}
            </Text>
            {record.agentPhone && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.agentPhone}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 110,
      render: (_, record) => (
        <Tooltip title={`Call Duration: ${record.callDuration || 0}s | Total Connection: ${record.totalCallDuration || 0}s`}>
          <Tag color="default" style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}>
            {formatSeconds(record.callDuration)}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Virtual DID',
      dataIndex: 'did',
      key: 'did',
      width: 140,
      render: (did) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
          {did || '—'}
        </span>
      ),
    },
    {
      title: 'Recording',
      key: 'recording',
      width: 140,
      render: (_, record) => {
        const recordingUrl = record.callRecordingUrl || (record.callRecording?.startsWith('http') ? record.callRecording : null);

        if (!recordingUrl) {
          if (record.callRecording) {
            return (
              <Tooltip title={`File: ${record.callRecording}`}>
                <Tag color="default" style={{ fontSize: 11, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {record.callRecording}
                </Tag>
              </Tooltip>
            );
          }
          return <Text type="secondary" style={{ fontSize: 12 }}>No Recording</Text>;
        }

        return (
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => setActiveAudioUrl(recordingUrl)}
            style={{
              background: '#10b981',
              borderColor: '#10b981',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Play Audio
          </Button>
        );
      },
    },
    {
      title: 'Payload',
      key: 'raw',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="View Webhook Payload JSON">
          <Button
            type="text"
            size="small"
            icon={<FileTextOutlined style={{ fontSize: 16, color: '#64748b' }} />}
            onClick={() => setSelectedPayload(record.rawPayload || record)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: '8px 0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          background: '#f8fafc',
          padding: '10px 16px',
          borderRadius: 8,
          border: '1px solid #f1f5f9',
        }}
      >
        <Space size="middle">
          <PhoneOutlined style={{ color: '#10b981', fontSize: 18 }} />
          <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
            Sollu Telephony Call Records
          </Text>
          <Badge
            count={callLogs.length}
            style={{ backgroundColor: '#10b981', fontWeight: 600 }}
          />
        </Space>
        <Button
          icon={<ReloadOutlined />}
          size="middle"
          loading={isLoading}
          onClick={() => refetch()}
          style={{ borderRadius: 6, fontWeight: 600 }}
        >
          Refresh Calls
        </Button>
      </div>

      <Table
        dataSource={callLogs}
        rowKey="_id"
        columns={columns}
        loading={isLoading}
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 5, showSizeChanger: true }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No call records found for this lead yet. Click 'Call' to initiate an outbound call."
              style={{ margin: '32px 0' }}
            />
          ),
        }}
        size="middle"
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
          <Button key="close" type="primary" onClick={() => setActiveAudioUrl(null)}>
            Close
          </Button>,
        ]}
        width={500}
        destroyOnClose
      >
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          {activeAudioUrl && (
            <audio controls autoPlay style={{ width: '100%', outline: 'none' }}>
              <source src={activeAudioUrl} type="audio/mpeg" />
              <source src={activeAudioUrl} type="audio/wav" />
              Your browser does not support the audio element.
            </audio>
          )}
          <div style={{ marginTop: 16 }}>
            <Text
              type="secondary"
              copyable={{ text: activeAudioUrl }}
              style={{ fontSize: 12, wordBreak: 'break-all' }}
            >
              {activeAudioUrl}
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
        width={650}
      >
        <pre
          style={{
            background: '#0f172a',
            color: '#38bdf8',
            padding: 16,
            borderRadius: 8,
            maxHeight: 450,
            overflow: 'auto',
            fontSize: 12,
            fontFamily: 'Consolas, Monaco, monospace',
          }}
        >
          {JSON.stringify(selectedPayload, null, 2)}
        </pre>
      </Modal>
    </div>
  );
};

export default CallHistoryTable;

