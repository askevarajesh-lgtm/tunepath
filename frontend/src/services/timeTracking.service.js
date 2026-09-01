import api from './api';

const PREFIX = '/time-tracking';

export const timeTrackingService = {
  logTime: async (data) => {
    const response = await api.post(`${PREFIX}/`, data);
    return response.data;
  },
  updateTimeEntry: async (id, data) => {
    const response = await api.put(`${PREFIX}/${id}`, data);
    return response.data;
  },
  deleteTimeEntry: async (id) => {
    const response = await api.delete(`${PREFIX}/${id}`);
    return response.data;
  },
  getRecentEntries: async () => {
    const response = await api.get(`${PREFIX}/recent`);
    return response.data;
  },
  getDashboardData: async (params) => {
    let qs = '';
    if (typeof params === 'object') {
      const p = new URLSearchParams();
      if (params.date) p.append('date', params.date);
      if (params.startDate) p.append('startDate', params.startDate);
      if (params.endDate) p.append('endDate', params.endDate);
      qs = `?${p.toString()}`;
    } else if (params) {
      qs = `?date=${encodeURIComponent(params)}`;
    }
    const response = await api.get(`${PREFIX}/dashboard${qs}`);
    return response.data;
  },
  getFormOptions: async () => {
    const response = await api.get(`${PREFIX}/options`);
    return response.data;
  },
  getTeamTaskPerformance: async (params) => {
    let qs = '';
    if (typeof params === 'object') {
      const p = new URLSearchParams();
      if (params.date) p.append('date', params.date);
      if (params.startDate) p.append('startDate', params.startDate);
      if (params.endDate) p.append('endDate', params.endDate);
      qs = `?${p.toString()}`;
    } else if (params) {
      qs = `?date=${encodeURIComponent(params)}`;
    }
    const response = await api.get(`${PREFIX}/performance${qs}`);
    return response.data;
  }
};
