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
        // Treat { success: false } 200 responses as errors (backend business logic errors)
        if (response.data?.success === false) {
          const errorObj = { data: response.data, status: response.status };
          setError(errorObj);
          return { error: errorObj };
        }
        setData(response.data);
        setError(null);
        return { data: response.data };
      } catch (err) {
        const errorObj = err.response ? { data: err.response.data, status: err.response.status } : err;
        setError(errorObj);
        return { error: errorObj };
      } finally {
        setIsLoading(false);
      }
    }, [JSON.stringify(params), skip]);

    useEffect(() => {
      refetch();
    }, [refetch]);
    const isError = !!error;
    const isSuccess = !error && !isLoading && data !== null;
    const isFetching = isLoading;

    return { data, isLoading, error, refetch, isError, isSuccess, isFetching };
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
          
          // Treat { success: false } 200 responses as errors (backend business logic errors)
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

// Queries
export const useGetTasksQuery = createQueryHook((params) => ({ url: '/tasks', params }));
export const useGetTasksDropdownQuery = createQueryHook((params) => ({ url: '/tasks/dropdown', params: { ...params, limit: params?.limit || 20 } }));
export const useGetTaskByIdQuery = createQueryHook((id) => `/tasks/${id}`);
export const useGetTasksByProjectQuery = createQueryHook((projectId) => `/tasks/project/${projectId}`);
export const useGetTasksByDepartmentQuery = createQueryHook((department) => `/tasks/department/${department}`);
export const useGetTasksForKanbanQuery = createQueryHook((params) => ({ url: '/tasks/kanban', params }));
export const useGetScheduledNotesQuery = createQueryHook((params) => ({ url: '/tasks/scheduled-notes', params }));
export const useGetTaskCommentsQuery = createQueryHook((taskId) => `/tasks/${taskId}/comments`);
export const useGetTaskActivityQuery = createQueryHook((taskId) => `/tasks/${taskId}/activity`);
export const useGetWorkflowConfigQuery = createQueryHook((params) => ({ url: '/tasks/workflow-config', params }));
export const useGetAllWorkflowConfigsQuery = createQueryHook((params) => ({ url: '/tasks/workflow-configs', params }));
export const useGetNotificationSettingsQuery = createQueryHook(() => '/tasks/notification-settings');
export const useGetNotificationsQuery = createQueryHook((params) => ({ url: '/tasks/notifications', params }));
export const useGetTodayTaskStatsQuery = createQueryHook(() => '/tasks/today-stats');
export const useGetTodayAssignedDMSummaryQuery = createQueryHook(() => '/tasks/today-assigned-dm-summary');

// Mutations
export const useCreateTaskMutation = createMutationHook((data) => ({ url: '/tasks', method: 'POST', body: data }));
export const useUpdateTaskMutation = createMutationHook(({ id, ...data }) => ({ url: `/tasks/${id}`, method: 'PUT', body: data }));
export const useHoldTaskMutation = createMutationHook(({ id, holdReason }) => ({ url: `/tasks/${id}/hold`, method: 'PUT', body: { holdReason } }));
export const useSubmitTaskMutation = createMutationHook(({ id, deliverables }) => ({ url: `/tasks/${id}/submit`, method: 'POST', body: { deliverables } }));
export const useApproveTaskMutation = createMutationHook((id) => ({ url: `/tasks/${id}/approve`, method: 'POST' }));
export const useClientApproveTaskMutation = createMutationHook((id) => ({ url: `/tasks/${id}/client-approve`, method: 'POST' }));
export const useRequestReworkMutation = createMutationHook(({ id, feedback }) => ({ url: `/tasks/${id}/rework`, method: 'POST', body: { feedback } }));
export const useValidateTaskMutation = createMutationHook(({ id, isValid, remarks }) => ({ url: `/tasks/${id}/validate`, method: 'POST', body: { isValid, remarks } }));
export const useDeleteTaskMutation = createMutationHook((taskId) => ({ url: `/tasks/${taskId}`, method: 'DELETE' }));
export const useCreateScheduledNoteMutation = createMutationHook((data) => ({ url: '/tasks/scheduled-notes', method: 'POST', body: data }));
export const useUpdateTaskStatusAndOrderMutation = createMutationHook(({ id, status, order, command, screenshot, formData, boardStartDate, boardEndDate, boardDateField }) => {
  if (formData instanceof FormData) {
    return { url: `/tasks/${id}/status-order`, method: 'PUT', formData };
  }
  return { url: `/tasks/${id}/status-order`, method: 'PUT', body: { status, order, command, screenshot, boardStartDate, boardEndDate, boardDateField } };
});
export const useUpdateTaskScreenshotMutation = createMutationHook(({ taskId, attachmentId, formData }) => ({ url: `/tasks/${taskId}/screenshot/${attachmentId}`, method: 'PUT', formData }));
export const useUpdateTasksOrderMutation = createMutationHook((updates) => ({ url: '/tasks/order/bulk', method: 'PUT', body: { updates } }));
export const useAddCommentMutation = createMutationHook(({ taskId, ...data }) => ({ url: `/tasks/${taskId}/comments`, method: 'POST', body: data }));
export const useCreateOrUpdateWorkflowConfigMutation = createMutationHook((data) => ({ url: '/tasks/workflow-config', method: 'POST', body: data }));
export const useUpdateNotificationSettingsMutation = createMutationHook((data) => ({ url: '/tasks/notification-settings', method: 'PUT', body: data }));
export const useMarkNotificationAsReadMutation = createMutationHook((id) => ({ url: `/tasks/notifications/${id}/read`, method: 'PUT' }));
export const useMarkAllNotificationsAsReadMutation = createMutationHook(() => ({ url: '/tasks/notifications/read-all', method: 'PUT' }));
export const useDeleteNotificationMutation = createMutationHook((id) => ({ url: `/tasks/notifications/${id}`, method: 'DELETE' }));
export const useDeleteNotificationsMutation = createMutationHook((notificationIds) => ({ url: '/tasks/notifications/bulk', method: 'DELETE', body: { notificationIds } }));
export const useSendTaskReminderMutation = createMutationHook((taskId) => ({ url: `/tasks/${taskId}/reminder`, method: 'POST' }));
export const useReopenTaskMutation = createMutationHook(({ id, ...data }) => ({ url: `/tasks/${id}/reopen`, method: 'POST', body: data }));

// Named export so components can import { taskApi } from this file
export const taskApi = {
  useGetTasksQuery,
  useGetTaskByIdQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
};
