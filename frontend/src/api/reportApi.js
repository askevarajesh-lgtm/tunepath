import api from '../services/api';

export const getReportSchedules = async () => {
    const response = await api.get('/reports/schedules');
    return response.data.data;
};

export const createReportSchedule = async (scheduleData) => {
    const response = await api.post('/reports/schedules', scheduleData);
    return response.data.data;
};

export const updateScheduleStatus = async (id, status) => {
    const response = await api.put(`/reports/schedules/${id}/status`, { status });
    return response.data.data;
};

export const deleteReportSchedule = async (id) => {
    const response = await api.delete(`/reports/schedules/${id}`);
    return response.data.data;
};

export const getRecentSentReports = async () => {
    const response = await api.get('/reports/history');
    return response.data.data;
};

export const generateReport = async (reportData) => {
    const response = await api.post('/reports/generate', reportData);
    return response.data.data;
};

export const generateReportApi = generateReport;

const sanitizeParam = (val) => {
    if (!val || val === 'all' || val === '[object Object]') return undefined;
    if (typeof val === 'object' && val._id) return String(val._id);
    return typeof val === 'string' ? val : undefined;
};

export const getMonthlyHighlights = async (clientId, month, year, refresh = false, projectId = null) => {
    const params = {};
    const cleanClientId = sanitizeParam(clientId);
    const cleanProjectId = sanitizeParam(projectId);
    if (cleanClientId) params.clientId = cleanClientId;
    if (month) params.month = month;
    if (year) params.year = year;
    if (refresh) params.refresh = 'true';
    if (cleanProjectId) params.projectId = cleanProjectId;
    const response = await api.get('/reports/monthly-highlights', { params });
    return response.data.data;
};

export const upsertMonthlyHighlights = async (data) => {
    const response = await api.post('/reports/monthly-highlights', data);
    return response.data.data;
};

export const getClientMonthlyReportsList = async (clientId) => {
    const params = {};
    const cleanClientId = sanitizeParam(clientId);
    if (cleanClientId) params.clientId = cleanClientId;
    const response = await api.get('/reports/monthly-highlights/client-list', { params });
    return response.data.data;
};

export const getMetaLeadCampaigns = async (clientId) => {
    const params = {};
    const cleanClientId = sanitizeParam(clientId);
    if (cleanClientId) params.clientId = cleanClientId;
    const response = await api.get('/performance-ads/meta-lead-reports', { params });
    return response.data.data;
};

export const getMetaReachCampaigns = async (clientId) => {
    const params = {};
    const cleanClientId = sanitizeParam(clientId);
    if (cleanClientId) params.clientId = cleanClientId;
    const response = await api.get('/performance-ads/meta-reach-reports', { params });
    return response.data.data;
};
