import api from '../services/api';

export const analyticsApi = {
  getAnalytics: async (projectId, dateRange, bypassCache = false) => {
    const response = await api.get('/analytics', {
      params: { 
        projectId, 
        dateRange: dateRange ? JSON.stringify(dateRange) : undefined,
        bypassCache
      }
    });
    return response.data;
  },
  configureGA4Property: async (projectId, ga4PropertyId) => {
    const response = await api.put(`/analytics/projects/${projectId}/ga4`, { ga4PropertyId });
    return response.data;
  },
  getProjects: async () => {
    const response = await api.get('/analytics/projects');
    return response.data;
  },
  createProject: async (data) => {
    const response = await api.post('/analytics/projects', data);
    return response.data;
  },
  sendReportEmail: async (data) => {
    const response = await api.post('/analytics/send-email', data);
    return response.data;
  }
};