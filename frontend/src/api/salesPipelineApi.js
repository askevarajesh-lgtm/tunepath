import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const createQueryHook = (endpointFn) => {
  return (params, options = {}) => {
    const { skip } = options;
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(!skip);
    const [error, setError] = useState(null);

    const refetch = useCallback(async () => {
      if (skip) return { data: null };
      setIsLoading(true);
      try {
        const config = typeof endpointFn === 'function' ? endpointFn(params) : { url: endpointFn };
        const url = typeof config === 'string' ? config : config.url;
        const queryParams = typeof config === 'object' && config.params ? config.params : {};
        
        const response = await api.get(url, { params: queryParams });
        
        const resultData = response.data;
        setData(resultData);
        setError(null);
        return { data: resultData };
      } catch (err) {
        setError(err);
        return { error: err };
      } finally {
        setIsLoading(false);
      }
    }, [JSON.stringify(params), skip]);

    useEffect(() => {
      refetch();
    }, [refetch]);

    return { data, isLoading, error, refetch };
  };
};

const createMutationHook = (method) => {
  return (urlFn) => {
    return () => {
      const [isLoading, setIsLoading] = useState(false);
      const [error, setError] = useState(null);

      const trigger = useCallback((arg) => {
        setIsLoading(true);
        
        const execute = async () => {
          const config = typeof urlFn === 'function' ? urlFn(arg) : { url: urlFn, body: arg };
          const url = typeof config === 'string' ? config : config.url;
          
          let body = arg;
          if (typeof config === 'object' && 'body' in config) {
            body = config.body;
          } else if (typeof config === 'string' && method === 'delete') {
            body = undefined;
          }
          
          let response;
          if (method === 'post') response = await api.post(url, body);
          else if (method === 'put') response = await api.put(url, body);
          else if (method === 'delete') response = await api.delete(url, { data: body });
          
          setError(null);
          return response.data;
        };

        const promise = execute().finally(() => setIsLoading(false));
        
        const resultPromise = promise.catch(err => {
          setError(err);
          return { error: err };
        });
        
        resultPromise.unwrap = () => promise.catch(err => Promise.reject(err.response?.data || err));
        
        return resultPromise;
      }, []);

      return [trigger, { isLoading, error }];
    };
  };
};

export const useGetDealsQuery = createQueryHook((params) => ({ url: '/sales-pipeline', params }));
export const useGetPipelineAnalyticsQuery = createQueryHook('/sales-pipeline/analytics');
export const useGetSalesRepsQuery = createQueryHook('/sales-pipeline/reps');

export const useCreateDealMutation = createMutationHook('post')('/sales-pipeline');
export const useUpdateDealMutation = createMutationHook('put')((arg) => {
  const { id, ...rest } = arg;
  return { url: `/sales-pipeline/${id}`, body: rest };
});
export const useDeleteDealMutation = createMutationHook('delete')((id) => `/sales-pipeline/${id}`);
export const useAddDealNoteMutation = createMutationHook('post')(({ dealId, content }) => ({
  url: `/sales-pipeline/${dealId}/notes`,
  body: { content }
}));
export const useConvertDealToClientMutation = createMutationHook('post')(({ id, email, password, phone }) => ({
  url: `/sales-pipeline/${id}/convert`,
  body: { email, password, phone }
}));
