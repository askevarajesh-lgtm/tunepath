import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { seoWorkspaceApi } from '../../../../../api/seoWorkspaceApi';
import { message } from 'antd';
import { useSEO } from '../../../../Marketplace/SEO/context/SEOContext';

const MonitoringContext = createContext(null);

export const MonitoringProvider = ({ children, project }) => {
  // Prefer the explicit `project` prop (passed down from a parent route),
  // otherwise fall back to the global SEO active project.
  const { activeProjectId: globalProjectId, selectProject, projects: globalProjects } = useSEO();

  const [selectedProjectId, setSelectedProjectId] = useState(
    project?._id || globalProjectId || null
  );
  
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [scanStatus, setScanStatus] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // Sync when global active project changes (tab switch, selector, etc.)
  useEffect(() => {
    const incoming = project?._id || globalProjectId;
    if (incoming && incoming !== selectedProjectId) {
      setSelectedProjectId(incoming);
    }
  }, [globalProjectId, project?._id]);

  const fetchSnapshot = useCallback(async () => {
    const targetId = selectedProjectId;
    if (!targetId) return;
    try {
      setLoading(true);
      const data = await seoWorkspaceApi.getMonitoringDashboard(targetId);
      setSnapshot(data.data || data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch monitoring snapshot:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  const triggerScan = async () => {
    const targetId = selectedProjectId;
    if (!targetId) {
      message.warning('Please select a Workspace Project before triggering a scan.');
      return;
    }
    try {
      setIsScanning(true);
      const res = await seoWorkspaceApi.triggerMonitoringScan(targetId);
      if (res.data?.alreadyRunning) {
        message.info(`Scan already in progress. Progress: ${res.data.progress || 0}%`);
        setScanStatus(res.data);
      } else {
        message.success('11-Plugin SEO Monitoring scan initiated');
        setScanStatus(res.data);
      }
      
      if (res.data?.scanId) {
        pollScanStatus(res.data.scanId);
      } else {
        setTimeout(() => {
          setIsScanning(false);
          fetchSnapshot();
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Failed to trigger scan');
      setIsScanning(false);
    }
  };

  const pollScanStatus = async (scanId) => {
    const targetId = selectedProjectId;
    const interval = setInterval(async () => {
      try {
        const res = await seoWorkspaceApi.getMonitoringScanStatus(targetId, scanId);
        setScanStatus(res.data);
        if (res.data?.status === 'Completed' || res.data?.status === 'Failed') {
          clearInterval(interval);
          setIsScanning(false);
          if (res.data?.status === 'Completed') {
            message.success('11-Plugin SEO Scan completed successfully');
            fetchSnapshot();
          } else {
            message.error(`Scan failed: ${res.data?.error || 'Unknown error'}`);
          }
        }
      } catch (e) {
        clearInterval(interval);
        setIsScanning(false);
      }
    }, 3000);
  };

  // When internal project selection changes, sync back to global context so all tabs stay in sync
  const handleSetProjectId = (id) => {
    setSelectedProjectId(id);
    if (id && id !== globalProjectId) {
      selectProject(id);
    }
  };

  const value = {
    activeProjectId: selectedProjectId,
    setProjectId: handleSetProjectId,
    projects: globalProjects,
    snapshot,
    loading,
    error,
    refresh: fetchSnapshot,
    triggerScan,
    isScanning,
    scanStatus
  };

  return (
    <MonitoringContext.Provider value={value}>
      {children}
    </MonitoringContext.Provider>
  );
};

export const useMonitoring = () => {
  const context = useContext(MonitoringContext);
  if (!context) {
    return {
      activeProjectId: null,
      setProjectId: () => {},
      projects: [],
      snapshot: null,
      loading: false,
      error: null,
      refresh: () => {},
      triggerScan: () => {},
      isScanning: false,
      scanStatus: null
    };
  }
  return context;
};
