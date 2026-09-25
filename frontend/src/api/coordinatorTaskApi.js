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

const createMutationHook = (endpointFn) => {
  return () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const mutate = (params) => {
      const executionPromise = (async () => {
        setIsLoading(true);
        try {
          const config = typeof endpointFn === 'function' ? endpointFn(params) : { url: endpointFn };
          const url = typeof config === 'string' ? config : config.url;
          const method = typeof config === 'object' && config.method ? config.method : 'POST';
          const body = typeof config === 'object' ? config.body : undefined;
          const formData = typeof config === 'object' ? config.formData : undefined;
          
          const response = await api({ 
            url, 
            method, 
            data: formData || body 
          });
          
          if (response.data?.success === false) {
            const errorObj = { data: response.data, status: response.status };
            setError(errorObj);
            throw errorObj;
          }
          setError(null);
          return response.data;
        } catch (err) {
          const errorObj = err.response ? { data: err.response.data, status: err.response.status } : err;
          setError(errorObj);
          throw errorObj;
        } finally {
          setIsLoading(false);
        }
      })();

      executionPromise.unwrap = async () => {
        return await executionPromise;
      };

      return executionPromise;
    };
    return [mutate, { isLoading, error }];
  };
};

export const useUpdateCoordinatorTaskMutation = createMutationHook(({ id, ...data }) => ({ url: `/coordinator-tasks/${id}`, method: 'PUT', body: data }));
export const useGetCoordinatorTasksQuery = createQueryHook((params) => ({ url: '/coordinator-tasks', params }));
export const useCreateCoordinatorTaskMutation = createMutationHook((data) => ({ url: '/coordinator-tasks', method: 'POST', body: data }));
export const useDeleteCoordinatorTaskMutation = createMutationHook((id) => ({ url: `/coordinator-tasks/${id}`, method: 'DELETE' }));
export const useGetCoordinatorTaskByIdQuery = createQueryHook((id) => ({ url: `/coordinator-tasks/${id}` }));
export const useGetTodayCoordinatorTaskStatsQuery = createQueryHook(() => ({ url: '/coordinator-tasks/today-stats' }));
