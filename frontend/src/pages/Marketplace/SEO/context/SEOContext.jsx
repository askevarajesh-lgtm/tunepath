import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { message } from 'antd';
import { seoWorkspaceApi } from '../../../../api/seoWorkspaceApi';
import { useAuth } from '../../../../contexts/AuthContext';

const SEOContext = createContext(null);

export const SEOProvider = ({ children }) => {
  const { user } = useAuth();
  const STORAGE_KEY = `seo_active_project_id_${user?._id || 'default'}`;

  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all projects accessible to the current tenant / agency
  const fetchProjects = useCallback(async (preferredId = null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await seoWorkspaceApi.getProjects();
      const list = res?.data || [];
      setProjects(list);

      const savedId = preferredId || localStorage.getItem(STORAGE_KEY);
      const matched = list.find((p) => String(p._id) === String(savedId));

      if (matched) {
        setActiveProjectId(matched._id);
        localStorage.setItem(STORAGE_KEY, matched._id);
      } else if (list.length > 0) {
        setActiveProjectId(list[0]._id);
        localStorage.setItem(STORAGE_KEY, list[0]._id);
      } else {
        setActiveProjectId(null);
      }
    } catch (err) {
      console.error('Error fetching Workspace SEO projects:', err);
      setError(err?.response?.data?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [STORAGE_KEY]);

  // Handle Account Switch
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    setActiveProjectId(savedId || null);
    setProjects([]); // Clear old projects instantly on account switch
    fetchProjects();
  }, [user?._id, STORAGE_KEY, fetchProjects]);

  useEffect(() => {
    // Listen for storage changes across browser tabs
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY && e.newValue && e.newValue !== activeProjectId) {
        setActiveProjectId(e.newValue);
      }
    };

    // Listen for custom app-wide sync events
    const handleCustomSync = (e) => {
      const newId = e.detail?.projectId;
      if (newId && newId !== activeProjectId) {
        setActiveProjectId(newId);
        localStorage.setItem(STORAGE_KEY, newId);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('seo_project_changed', handleCustomSync);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('seo_project_changed', handleCustomSync);
    };
  }, [fetchProjects, STORAGE_KEY, activeProjectId]);

  const selectProject = useCallback((id) => {
    if (!id) return;
    setActiveProjectId(id);
    localStorage.setItem(STORAGE_KEY, id);
    window.dispatchEvent(new CustomEvent('seo_project_changed', { detail: { projectId: id } }));
  }, [STORAGE_KEY]);

  const createProject = useCallback(async (projectData) => {
    try {
      const res = await seoWorkspaceApi.createProject(projectData);
      message.success('Project created successfully');
      await fetchProjects(res?.data?._id);
      if (res?.data?._id) {
        selectProject(res.data._id);
      }
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to create project';
      message.error(msg);
      throw err;
    }
  }, [fetchProjects, selectProject]);

  const activeProject = useMemo(() => {
    return projects.find((p) => String(p._id) === String(activeProjectId)) || null;
  }, [projects, activeProjectId]);

  const value = useMemo(() => ({
    projects,
    activeProjectId,
    activeProject,
    loading,
    error,
    selectProject,
    refreshProjects: fetchProjects,
    createProject
  }), [projects, activeProjectId, activeProject, loading, error, selectProject, fetchProjects, createProject]);

  return (
    <SEOContext.Provider value={value}>
      {children}
    </SEOContext.Provider>
  );
};

export const useSEO = () => {
  const context = useContext(SEOContext);
  if (!context) {
    throw new Error('useSEO must be used within an SEOProvider');
  }
  return context;
};

export default SEOContext;
