import api from '../services/api';

export const slaApi = {
  getSlas: async (params) => {
    const response = await api.get('/sla-success', { params });
    return response.data;
  },

  getSlaDashboardStats: async (params) => {
    const response = await api.get('/sla-success/dashboard-stats', { params });
    return response.data;
  },

  createSla: async (data) => {
    const response = await api.post('/sla-success', data);
    return response.data;
  },

  getSlaById: async (id) => {
    const response = await api.get(`/sla-success/${id}`);
    return response.data;
  },

  updateSla: async (id, data) => {
    const response = await api.put(`/sla-success/${id}`, data);
    return response.data;
  },

  addSlaNote: async (id, text) => {
    const response = await api.post(`/sla-success/${id}/notes`, { text });
    return response.data;
  },

  escalateSla: async (id) => {
    const response = await api.post(`/sla-success/${id}/escalate`);
    return response.data;
  }
};
