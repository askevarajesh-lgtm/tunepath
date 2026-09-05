import React, { useState, useEffect } from 'react';
import { Tabs, Button, Space, message } from 'antd';
import { semrushApi } from '../../../api/semrushApi';
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import BacklinksOverview from './backlinks/BacklinksOverview';
import BacklinksList from './backlinks/BacklinksList';
import BacklinksAnchors from './backlinks/BacklinksAnchors';
import BacklinksPages from './backlinks/BacklinksPages';
import BacklinksNetworkGraph from './backlinks/BacklinksNetworkGraph';
import SnapshotSelector from './SnapshotSelector';

const BacklinksTab = () => {
  const { project, projectData, fetchProjectData } = useOutletContext();
  const domain = project?.domain;
  const [activeKey, setActiveKey] = useState('overview');
  const [localData, setLocalData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (projectData) {
      setLocalData((prev) => prev || {
        overview: projectData.overview,
        backlinksOverview: projectData.backlinksOverview
      });
    }
  }, [projectData]);

  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState(false);

  const handleSnapshotSelect = async (snapshotId) => {
    if (snapshotId === 'latest') {
      setLocalData({
        overview: projectData?.overview || {},
        backlinksOverview: projectData?.backlinksOverview || {}
      });
      setSnapshotError(false);
      return;
    }
    
    setSnapshotLoading(true);
    setSnapshotError(false);
    try {
      const res = await semrushApi.getSnapshotById(project._id, snapshotId);
      if (res.data.success && res.data.data) {
        const blData = res.data.data.backlinksOverview;
        if (!blData || Object.keys(blData).length === 0) {
          setSnapshotError(true);
        } else {
          setLocalData({
            overview: res.data.data.overview || {},
            backlinksOverview: blData
          });
        }
      }
    } catch (err) {
      console.error(err);
      setSnapshotError(true);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!project?._id) return;
    setRefreshing(true);
    try {
      const res = await semrushApi.getBacklinks(project._id, true);
      if (res.data.success && res.data.data) {
        setLocalData({
           ...localData,
           backlinksOverview: {
             total: res.data.data.backlinks?.value,
             score: res.data.data.authorityScore?.value,
             ...(res.data.data.backlinksDetails || {})
           }
        });
        message.success('Backlinks updated successfully');
        if (fetchProjectData) fetchProjectData();
      } else {
        message.error(res.data.errorCode || 'Failed to refresh Backlinks');
      }
    } catch (err) {
      message.error('An error occurred during refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const handleTabChange = (key) => {
    setActiveKey(key);
  };

  const handleExport = () => {
    try {
      const backlinks = localData?.backlinksOverview || projectData?.backlinksOverview || {};
      const rawBacklinks = backlinks.rawBacklinks || [];
      
      if (rawBacklinks.length === 0) {
        message.warning('No backlink data available to export.');
        return;
      }

      // Map data for Excel
      const exportData = rawBacklinks.map(row => ({
        'Page AS': row.page_as || row.pageAs || '-',
        'Source Title': row.source_title || '-',
        'Source URL': row.source_url || '-',
        'Target URL': row.target_url || '-',
        'External Links': row.external || 0,
        'Internal Links': row.internal || 0,
        'Anchor': row.anchor || 'Empty Anchor',
        'Follow': row.isFollow === false ? 'No' : 'Yes',
        'First Seen': row.first_seen ? new Date(row.first_seen * 1000).toLocaleDateString() : '-'
      }));

      // Create workbook
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Backlinks');

      // Export
      const filename = `${domain?.replace(/\./g, '_') || 'project'}_Backlinks.xlsx`;
      XLSX.writeFile(workbook, filename);
      
      message.success('Backlink report exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      message.error('Failed to export backlink report.');
    }
  };

  const EmptyState = ({ message }) => (
    <div style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: 8, padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
      {message}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
       
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <SnapshotSelector 
          projectId={project?._id} 
          tabKey="backlinks" 
          onSnapshotSelect={handleSnapshotSelect} 
        />
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button 
            type="primary" 
            icon={<ReloadOutlined spin={refreshing} />} 
            onClick={handleRefresh} 
            loading={refreshing}
            style={{ borderRadius: 8, fontWeight: 600, background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Backlinks'}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} style={{ borderRadius: 8, fontWeight: 600 }}>
            Export
          </Button>
        </div>
      </div>

      {snapshotError ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)' }}>Historical data not available for this snapshot.</div>
        </div>
      ) : snapshotLoading ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)' }}>Loading historical data...</div>
        </div>
      ) : (
        <>
          <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
            <Tabs 
              activeKey={activeKey} 
              onChange={handleTabChange}
              items={[
                { key: 'overview', label: 'Overview' },
                { key: 'backlinks', label: 'Backlinks' },
                { key: 'network-graph', label: 'Network Graph' },
                { key: 'anchors', label: 'Anchors' },
                { key: 'indexed-pages', label: 'Indexed Pages' }
              ]}
              style={{ flex: 1 }}
            />
          </div>
          <div>
            {activeKey === 'overview' && <BacklinksOverview setActiveTab={setActiveKey} localData={localData} />}
            {activeKey === 'backlinks' && <BacklinksList localData={localData} />}
            {activeKey === 'anchors' && <BacklinksAnchors localData={localData} />}
            {activeKey === 'indexed-pages' && <BacklinksPages localData={localData} />}
            {activeKey === 'network-graph' && <BacklinksNetworkGraph localData={localData} />}
          </div>
        </>
      )}
    </div>
  );
};

export default BacklinksTab;
