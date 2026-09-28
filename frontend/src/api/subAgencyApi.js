import api from '../services/api';

export const getSubAgencies = async (params) => {
  const response = await api.get('/sub-agencies', { params });
  return response.data;
};

export const createSubAgency = async (data) => {
  const response = await api.post('/sub-agencies', data);
  return response.data;
};

export const getSubAgencyUsers = async () => {
  const response = await api.get('/sub-agencies/users');
  return response.data;
};

export const createSubAgencyUser = async (data) => {
  const response = await api.post('/sub-agencies/users', data);
  return response.data;
};
