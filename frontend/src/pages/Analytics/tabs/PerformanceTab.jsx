import React, { useState } from 'react';
import { Card, Typography, Row, Col, Tabs, Table } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

import GscNotConnected from '../components/GscNotConnected';

const { Title, Text } = Typography;

const StatCard = ({ title, value, color, isActive }) => (
  <Card 
    bordered={false} 
    style={{ 
      borderRadius: 8, 
      backgroundColor: isActive ? color : 'var(--bg-primary)', 
      color: isActive ? '#fff' : 'inherit',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      cursor: 'pointer',
      height: '100%'
    }}
    bodyStyle={{ padding: '16px 20px' }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 16, height: 16, backgroundColor: isActive ? '#fff' : color, borderRadius: 2 }} />
      <Text style={{ color: isActive ? '#fff' : 'var(--text-secondary)' }}>{title}</Text>
    </div>
    <Title level={2} style={{ margin: '8px 0 0', color: isActive ? '#fff' : 'inherit', fontWeight: 500 }}>
      {value}
    </Title>
  </Card>
);

const PerformanceTable = ({ data, dimensionLabel }) => {
  const columns = [
    {
      title: dimensionLabel,
      dataIndex: 'dimension',
      key: 'dimension',
      render: (text) => <Text strong>{text || '(not set)'}</Text>
    },
    {
      title: 'Clicks',
      dataIndex: 'clicks',
      key: 'clicks',
      align: 'right',
      sorter: (a, b) => a.clicks - b.clicks,
      defaultSortOrder: 'descend',
      render: (val) => val.toLocaleString()
    },
    {
      title: 'Impressions',
      dataIndex: 'impressions',
      key: 'impressions',
      align: 'right',
      sorter: (a, b) => a.impressions - b.impressions,
      render: (val) => val.toLocaleString()
    }
  ];

  return (
    <Table 
      dataSource={data} 
      columns={columns} 
      rowKey="dimension"
      size="middle"
      pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'], showSizeChanger: true }}
    />
  );
};

const PerformanceTab = ({ data }) => {
  const { metrics, searchTraffic, gscPerformance, meta } = data;
  const [activeTab, setActiveTab] = useState('queries');

  const isGscConnected = meta?.connections?.gsc?.connectedClients > 0;

  if (!isGscConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
        <GscNotConnected />
      </div>
    );
  }

  if (!gscPerformance) return null;

  // Format searchTraffic for DAYS tab
  const daysData = (searchTraffic || []).map(d => ({
    dimension: d.day,
    clicks: d.clicks,
    impressions: d.impressions
  })).sort((a, b) => new Date(b.dimension) - new Date(a.dimension)); // newest first for table

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Top Stat Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <StatCard title="Total clicks" value={metrics.clicks.toLocaleString()} color="#4285f4" isActive={true} />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="Total impressions" value={metrics.impressions.toLocaleString()} color="#5e35b1" isActive={true} />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="Average CTR" value={metrics.ctr} color="#0f9d58" isActive={false} />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="Average position" value={metrics.averagePosition} color="#f4b400" isActive={false} />
        </Col>
      </Row>

      {/* Chart Section */}
      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ height: 350, marginTop: 20 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={searchTraffic} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis 
                dataKey="day" 
                tickFormatter={(val) => {
                  const d = new Date(val);
                  return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`;
                }}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                yAxisId="left" 
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}K` : val}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}K` : val}
              />
              <RechartsTooltip 
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                labelFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              />
              <Legend verticalAlign="top" height={36} iconType="plainline" />
              <Line yAxisId="left" type="monotone" dataKey="clicks" name="Clicks" stroke="#4285f4" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="impressions" name="Impressions" stroke="#5e35b1" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Tables Section */}
      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} bodyStyle={{ padding: '0 24px 24px' }}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          size="large"
          items={[
            { key: 'queries', label: 'QUERIES', children: <PerformanceTable data={gscPerformance.queries} dimensionLabel="Top queries" /> },
            { key: 'pages', label: 'PAGES', children: <PerformanceTable data={gscPerformance.pages} dimensionLabel="Top pages" /> },
            { key: 'countries', label: 'COUNTRIES', children: <PerformanceTable data={gscPerformance.countries} dimensionLabel="Country" /> },
            { key: 'devices', label: 'DEVICES', children: <PerformanceTable data={gscPerformance.devices} dimensionLabel="Device" /> },
            { key: 'search-appearance', label: 'SEARCH APPEARANCE', children: <PerformanceTable data={gscPerformance.searchAppearances} dimensionLabel="Search Appearance" /> },
            { key: 'days', label: 'DAYS', children: <PerformanceTable data={daysData} dimensionLabel="Date" /> },
          ]}
        />
      </Card>
    </div>
  );
};

export default PerformanceTab;
