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

export const getMonthlyHighlights = async (clientId, month, year, refresh = false) => {
    const params = {};
    if (clientId) params.clientId = clientId;
    if (month) params.month = month;
    if (year) params.year = year;
    if (refresh) params.refresh = 'true';
    const response = await api.get('/reports/monthly-highlights', { params });
    return response.data.data;
};

export const upsertMonthlyHighlights = async (data) => {
    const response = await api.post('/reports/monthly-highlights', data);
    return response.data.data;
};

export const getClientMonthlyReportsList = async (clientId) => {
    const params = {};
    if (clientId) params.clientId = clientId;
    const response = await api.get('/reports/monthly-highlights/client-list', { params });
    return response.data.data;
};


