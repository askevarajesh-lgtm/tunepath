import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Input, Select, Button, Space, Tag, Empty, message } from 'antd';
import { SearchOutlined, DownloadOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { semrushApi } from '../../../api/semrushApi';
import { useOutletContext } from 'react-router-dom';

const { Title, Text } = Typography;
const { Option } = Select;

const KeywordMagicToolTab = () => {
  const { project } = useOutletContext();
  const domain = project?.domain;
  const projectId = project?._id;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [query, setQuery] = useState(domain || '');
  const [matchType, setMatchType] = useState('broad');
  const [database, setDatabase] = useState('us');
  const [hasSearched, setHasSearched] = useState(false);
  const [configStatus, setConfigStatus] = useState('available');

  useEffect(() => {
    if (query) handleSearch();
  }, [projectId]);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setHasSearched(true);
    
    try {
      const res = await semrushApi.getKeywordMagicTool(projectId, { keyword: query, database, matchType });
      if (res && res.data) {
        setConfigStatus(res.data.status || 'available');
        setData(res.data.data || []);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error(err);
      setConfigStatus('failed');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!query || data.length === 0) return;
    setLoading(true);
    try {
      const res = await semrushApi.getKeywordMagicTool(projectId, { keyword: query, database, matchType });
      if (res && res.data && res.data.success && res.data.data) {
        setData(res.data.data);
        message.success('Results updated successfully');
      } else {
        message.error(res?.data?.errorCode || 'Failed to refresh results');
      }
    } catch (err) {
      message.error('An error occurred during refresh');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Keyword',
      dataIndex: 'Keyword',
      key: 'Keyword',
      render: (text, record) => <Text strong>{text || record.Ph}</Text>
    },
    {
      title: 'Intent',
      dataIndex: 'Intent',
      key: 'Intent',
      render: (text, record) => {
        const val = text || record.In || '';
        let intent = 'I';
        let color = 'blue';
        if (val.includes('0')) { intent = 'C'; color = 'orange'; }
        else if (val.includes('1')) { intent = 'I'; color = 'blue'; }
        else if (val.includes('2')) { intent = 'N'; color = 'purple'; }
        else if (val.includes('3')) { intent = 'T'; color = 'green'; }
        return <Tag color={color}>{intent}</Tag>;
      }
    },
    {
      title: 'Volume',
      dataIndex: 'Search Volume',
      key: 'Volume',
      render: (text, record) => {
        const val = text ?? record.Nq ?? null;
        return <Text>{val !== null ? Number(val).toLocaleString() : 'Unavailable'}</Text>;
      }
    },
    {
      title: 'Trend',
      key: 'Trend',
      render: () => <Text type="secondary">N/A</Text> // Add small sparkline chart here if available
    },
    {
      title: 'KD %',
      dataIndex: 'Keyword Difficulty Index',
      key: 'KD',
      render: (text, record) => {
        const val = text ?? record.Kd ?? null;
        if (val === null) return <Text type="secondary">Unavailable</Text>;
        const kd = Number(val);
        let color = kd > 70 ? 'red' : kd > 40 ? 'orange' : 'green';
        return <Tag color={color}>{kd.toFixed(1)}%</Tag>;
      }
    },
    {
      title: 'CPC (USD)',
      dataIndex: 'CPC',
      key: 'CPC',
      render: (text, record) => {
        const val = text ?? record.Cp ?? null;
        return <Text>{val !== null ? `$${Number(val).toFixed(2)}` : 'Unavailable'}</Text>;
      }
    }
  ];

  const getEmptyDescription = () => {
    if (!hasSearched) return "Enter a seed keyword to get started";
    if (configStatus === 'not_configured') return "Keyword Magic — SEO API not configured";
    if (configStatus === 'unavailable') return "Keyword Magic — Temporarily unavailable";
    if (configStatus === 'failed') return "Keyword Magic — Provider error";
    if (configStatus === 'rate_limited') return "Keyword Magic — Rate limited";
    return "No results found for this keyword.";
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Keyword Magic Tool</Title>
      </div>

      <Card>
        <Space style={{ marginBottom: 24, width: '100%' }} size="middle">
          <Input 
            placeholder="Enter keyword" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 300 }}
            onPressEnter={handleSearch}
          />
          <Select value={matchType} onChange={setMatchType} style={{ width: 120 }}>
            <Option value="broad">Broad Match</Option>
            <Option value="phrase">Phrase Match</Option>
            <Option value="exact">Exact Match</Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={loading}>
            Search
          </Button>
          <Button 
            type="default" 
            icon={<ReloadOutlined spin={loading} />} 
            onClick={handleRefresh} 
            loading={loading}
          >
            Refresh Results
          </Button>
          <Button icon={<FilterOutlined />}>Filters</Button>
          <Button icon={<DownloadOutlined />}>Export</Button>
        </Space>

        {data && data.length > 0 ? (
          <Table 
            dataSource={data} 
            columns={columns} 
            loading={loading}
            rowKey={(record) => record.Keyword || record.Ph}
            pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
            scroll={{ x: 'max-content' }}
          />
        ) : (
          <Empty description={getEmptyDescription()} />
        )}
      </Card>
    </div>
  );
};

export default KeywordMagicToolTab;
