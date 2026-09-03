import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const createQueryHook = (endpointFn) => {
  return (params, options = {}) => {
    const { skip } = options;
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(!skip);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
      if (skip) return;
      setIsLoading(true);
      try {
        const route = typeof endpointFn === 'function' ? endpointFn(params) : endpointFn;
        const config = typeof route === 'object' ? route : { url: route };
        const response = await api.request({ method: 'GET', ...config });
        setData(response.data?.data || response.data || []);
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    }, [params, skip]);

    useEffect(() => { fetchData(); }, [fetchData]);

    return { data, isLoading, error, refetch: fetchData };
  };
};

const createMutationHook = (endpointFn) => {
  return () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const mutate = async (params) => {
      setIsLoading(true);
      setError(null);
      try {
        const config = endpointFn(params);
        const response = await api.request(config);
        const resObj = { data: response.data };
        resObj.unwrap = () => response.data;
        return resObj;
      } catch (err) {
        setError(err);
        const errObj = { error: err };
        errObj.unwrap = () => { throw err; };
        return errObj;
      } finally {
        setIsLoading(false);
      }
    };
    return [mutate, { isLoading, error }];
  };
};

export const useGetCorrectionsQuery = createQueryHook((params) => ({ url: '/corrections', params }));
export const useAddCorrectionMessageMutation = createMutationHook(({ id, ...data }) => ({ url: `/corrections/${id}/message`, method: 'POST', data }));
export const useUpdateCorrectionStatusMutation = createMutationHook(({ id, ...data }) => ({ url: `/corrections/${id}/status`, method: 'PUT', data }));
export const useRequestCorrectionMutation = createMutationHook((data) => ({ url: '/corrections', method: 'POST', data }));
export const useDeleteCorrectionMutation = createMutationHook((id) => ({ url: `/corrections/${id}`, method: 'DELETE' }));

export const useGetCorrectionsByProjectQuery = createQueryHook((id) => `/projects/${id}/corrections`);
