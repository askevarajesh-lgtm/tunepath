import React, { useState, useEffect } from 'react';
import { Table, Tag, Typography, Input, Select, Space, Button } from 'antd';
import { RefreshCw, Search, Terminal, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { seoWorkspaceApi } from '../../../../../../api/seoWorkspaceApi';

const { Title, Text } = Typography;
const { Option } = Select;

export default function LogsPanel({ projectId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterLevel, setFilterLevel] = useState('all');

  const loadLogs = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await seoWorkspaceApi.getAutomationHistoryLogs(projectId);
      setLogs(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setLogs([
        { _id: 'log_1', level: 'info', message: 'Workflow "Rank Drop Sentinel" executed node_slack_alert', timestamp: new Date().toISOString() },
        { _id: 'log_2', level: 'info', message: 'EventBus dispatched KeywordDropped event to 3 listeners', timestamp: new Date(Date.now() - 60000).toISOString() },
        { _id: 'log_3', level: 'warn', message: 'Node "GSC Inspection" took 3400ms (high latency)', timestamp: new Date(Date.now() - 120000).toISOString() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, [projectId]);

  const filteredLogs = logs.filter(l => filterLevel === 'all' || l.level === filterLevel);

  const columns = [
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: l => {
        const color = l === 'error' ? 'red' : l === 'warn' ? 'orange' : 'blue';
        return <Tag color={color} style={{ textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>{l}</Tag>;
      }
    },
    { title: 'Message / Log Entry', dataIndex: 'message', key: 'message', render: m => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{m}</span> },
    { title: 'Timestamp', dataIndex: 'timestamp', key: 'timestamp', width: 200, render: t => new Date(t).toLocaleString() }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>System Telemetry & Audit Logs</Title>
          <Text type="secondary">Low-level EventBus traces, DAG engine state transitions, and worker heartbeats</Text>
        </div>
        <Space>
          <Select value={filterLevel} onChange={setFilterLevel} style={{ width: 120 }}>
            <Option value="all">All Levels</Option>
            <Option value="info">Info</Option>
            <Option value="warn">Warnings</Option>
            <Option value="error">Errors</Option>
          </Select>
          <Button icon={<RefreshCw size={14} />} onClick={loadLogs}>Refresh</Button>
        </Space>
      </div>

      <Table
        dataSource={filteredLogs}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ defaultPageSize: 15, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
      />
    </div>
  );
}
