import api from '../services/api';

export const semrushApi = {


  getProjects: async (params) => {
    const response = await api.get('/semrush/projects', { params });
    return response;
  },

  createProject: async (data) => {
    const response = await api.post('/semrush/projects', data);
    return response;
  },

  getProject: async (id) => {
    const response = await api.get(`/semrush/projects/${id}`);
    return response;
  },

  updateProject: async (id, data) => {
    const response = await api.put(`/semrush/projects/${id}`, data);
    return response;
  },

  deleteProject: async (id) => {
    const response = await api.delete(`/semrush/projects/${id}`);
    return response;
  },

  refreshProject: async (id, database = 'us') => {
    const response = await api.post(`/semrush/projects/${id}/refresh`, {}, {
      params: { database }
    });
    return response;
  },

  getLatestSnapshot: async (id) => {
    const response = await api.get(`/semrush/projects/${id}/snapshots/latest`);
    return response;
  },

  getSnapshotById: async (id, snapshotId) => {
    const response = await api.get(`/semrush/projects/${id}/snapshots/${snapshotId}`);
    return response;
  },

  getHistoricalSnapshots: async (id) => {
    const response = await api.get(`/semrush/projects/${id}/snapshots`);
    return response;
  },

  getActivitySnapshots: async (id) => {
    const response = await api.get(`/semrush/projects/${id}/activity/snapshots`);
    return response;
  },

  getActivityComparison: async (id, params = {}) => {
    const response = await api.get(`/semrush/projects/${id}/activity/compare`, { params });
    return response;
  },

  getDomainOverview: async (id, force = false) => {
    const response = await api.get(`/semrush/projects/${id}/domain-overview`, { params: { force } });
    return response;
  },

  getOrganicResearch: async (id, force = false) => {
    const response = await api.get(`/semrush/projects/${id}/organic-research`, { params: { force } });
    return response;
  },

  getCompetitorAnalysis: async (id, force = false) => {
    const response = await api.get(`/semrush/projects/${id}/competitor-analysis`, { params: { force } });
    return response;
  },

  getBacklinks: async (id, force = false) => {
    const response = await api.get(`/semrush/projects/${id}/backlinks`, { params: { force } });
    return response;
  },

  getSiteAudit: async (id, force = false) => {
    const response = await api.get(`/semrush/projects/${id}/site-audit`, { params: { force } });
    return response;
  },

  getGeoAeo: async (id, force = false) => {
    const response = await api.get(`/semrush/projects/${id}/geo-aeo`, { params: { force } });
    return response;
  },

  getKeywordMagicTool: async (id, params) => {
    const response = await api.get(`/semrush/projects/${id}/keyword-magic-tool`, { params });
    return response;
  },

  getTrafficAnalytics: async (id, force = false) => {
    const response = await api.get(`/semrush/projects/${id}/traffic-analytics`, { params: { force } });
    return response;
  },

  getPositionTracking: async (id, force = false) => {
    const response = await api.get(`/semrush/projects/${id}/position-tracking`, { params: { force } });
    return response;
  },

  configureTracking: async (id, data) => {
    const response = await api.post(`/semrush/projects/${id}/tracking-config`, data);
    return response;
  }};
