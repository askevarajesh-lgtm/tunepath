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

export const useGetUnassignedDeliverablesSummaryQuery = createQueryHook(() => '/projects/unassigned-summary');
export const useGetDeliverablesClientSummaryQuery = createQueryHook((params) => ({ url: '/projects/deliverables-client-summary', params }));
export const useGetProjectsQuery = createQueryHook((params) => ({ url: '/projects', params }));
export const useGetProjectsDropdownQuery = createQueryHook((params) => ({ url: '/projects/dropdown', params }));
export const useGetProjectByIdQuery = createQueryHook((id) => `/projects/${id}`);

const createMutationHook = (endpointFn) => {
  return () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const mutate = useCallback((params) => {
      setIsLoading(true);
      setError(null);
      const promise = (async () => {
        try {
          const config = endpointFn(params);
          const response = await api.request(config);
          return { data: response.data };
        } catch (err) {
          const formattedError = {
            status: err.response?.status || 500,
            data: err.response?.data || { message: err.message }
          };
          setError(formattedError);
          return { error: formattedError };
        } finally {
          setIsLoading(false);
        }
      })();

      promise.unwrap = async () => {
        const result = await promise;
        if (result.error) {
          throw result.error;
        }
        return result.data;
      };

      return promise;
    }, []);

    return [mutate, { isLoading, error }];
  };
};

const createLazyQueryHook = (endpointFn) => {
  return () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const trigger = useCallback((params) => {
      setIsLoading(true);
      const promise = (async () => {
        try {
          const config = typeof endpointFn === 'function' ? endpointFn(params) : { url: endpointFn };
          const url = typeof config === 'string' ? config : config.url;
          const queryParams = typeof config === 'object' && config.params ? config.params : {};
          
          const response = await api.get(url, { params: queryParams });
          setData(response.data);
          return { data: response.data };
        } catch (err) {
          const formattedError = {
            status: err.response?.status || 500,
            data: err.response?.data || { message: err.message }
          };
          setError(formattedError);
          return { error: formattedError };
        } finally {
          setIsLoading(false);
        }
      })();

      promise.unwrap = async () => {
        const result = await promise;
        if (result.error) {
          throw result.error;
        }
        return result.data;
      };

      return promise;
    }, []);

    return [trigger, { data, isLoading, error }];
  };
};

export const useGetProjectListSummaryStatsQuery = createQueryHook((params) => ({ url: '/projects/summary-stats', params }));
export const useLazyGetProjectReportQuery = createLazyQueryHook((params) => ({ url: '/projects/report', params }));
export const useDeleteProjectMutation = createMutationHook((id) => ({ url: `/projects/${id}`, method: 'DELETE' }));
export const useBulkDeleteProjectsMutation = createMutationHook((data) => ({ url: '/projects/bulk-delete', method: 'POST', data }));
export const useRenewProjectMutation = createMutationHook((id) => ({ url: `/projects/${id}/renew`, method: 'POST' }));
export const useUpdateProjectMutation = createMutationHook(({ id, ...data }) => ({ url: `/projects/${id}`, method: 'PUT', data }));
export const useCreateProjectMutation = createMutationHook((data) => ({ url: '/projects', method: 'POST', data }));

export const useSubmitForClientReviewMutation = createMutationHook((id) => ({ url: `/projects/${id}/submit-review`, method: 'POST' }));
export const useClientApproveMutation = createMutationHook((id) => ({ url: `/projects/${id}/client-approve`, method: 'POST' }));
export const useApproveWorkflowMutation = createMutationHook((id) => ({ url: `/projects/${id}/approve-workflow`, method: 'POST' }));
export const useRequestWorkflowRevisionMutation = createMutationHook((id) => ({ url: `/projects/${id}/request-revision`, method: 'POST' }));
export const useCompleteProjectMutation = createMutationHook((id) => ({ url: `/projects/${id}/complete`, method: 'POST' }));
export const useReopenProjectMutation = createMutationHook((id) => ({ url: `/projects/${id}/reopen`, method: 'POST' }));
export const useActivateProjectMutation = createMutationHook((id) => ({ url: `/projects/${id}/activate`, method: 'POST' }));
export const useDeactivateProjectMutation = createMutationHook((id) => ({ url: `/projects/${id}/deactivate`, method: 'POST' }));
export const useUpdateProjectMilestonesMutation = createMutationHook(({ id, ...data }) => ({ url: `/projects/${id}/milestones`, method: 'PUT', data }));
