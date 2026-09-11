import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const createQueryHook = (endpointFn) => {
  return (params, options = {}) => {
    const { skip } = options;
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(!skip);
    const [error, setError] = useState(null);

    const refetch = useCallback(async () => {
      if (skip) return;
      setIsLoading(true);
      try {
        const config = typeof endpointFn === 'function' ? endpointFn(params) : { url: endpointFn };
        const url = typeof config === 'string' ? config : config.url;
        const queryParams = typeof config === 'object' && config.params ? config.params : {};
        
        const response = await api.get(url, { params: queryParams });
        setData(response.data);
        setError(null);
      } catch (err) {
        setError(err);
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
        setError(null);

        const execute = async () => {
          const config = typeof urlFn === 'function' ? urlFn(arg) : { url: urlFn, body: arg };
          const url = typeof config === 'string' ? config : config.url;
          const body = typeof config === 'object' && config.body ? config.body : arg;
          
          let response;
          if (method === 'post') response = await api.post(url, body);
          else if (method === 'put') response = await api.put(url, body);
          else if (method === 'delete') response = await api.delete(url, { data: body });
          
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

export const useGetEventsQuery = createQueryHook((params) => ({ url: '/calendar', params }));
export const useGetEventByIdQuery = (id, options) => createQueryHook(() => `/calendar/${id}`)(null, options);
export const useGetCalendarAnalyticsQuery = createQueryHook((params) => ({ url: '/calendar/analytics', params }));

export const useCreateEventMutation = createMutationHook('post')('/calendar');
export const useUpdateEventMutation = createMutationHook('put')((arg) => {
  const { id, ...rest } = arg;
  return { url: `/calendar/${id}`, body: rest };
});
export const useDeleteEventMutation = createMutationHook('delete')((id) => `/calendar/${id}`);
export const useUpdateEventStatusMutation = createMutationHook('put')(({ id, status }) => ({
  url: `/calendar/${id}/status`,
  body: { status }
}));
export const useAddEventNoteMutation = createMutationHook('post')(({ id, ...body }) => ({
  url: `/calendar/${id}/notes`,
  body
}));
export const useAddEventAttachmentMutation = createMutationHook('post')(({ id, ...body }) => ({
  url: `/calendar/${id}/attachments`,
  body
}));
