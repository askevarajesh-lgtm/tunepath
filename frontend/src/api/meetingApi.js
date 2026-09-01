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

export const useGetMeetingsQuery = createQueryHook((params) => ({ url: '/meetings', params }));
export const useGetMeetingByIdQuery = (id, options) => createQueryHook(() => `/meetings/${id}`)(null, options);
export const useGetMeetingAnalyticsQuery = createQueryHook('/meetings/analytics');

export const useCreateMeetingMutation = createMutationHook('post')('/meetings');
export const useUpdateMeetingMutation = createMutationHook('put')((arg) => {
  const { id, ...rest } = arg;
  return { url: `/meetings/${id}`, body: rest };
});
export const useDeleteMeetingMutation = createMutationHook('delete')((id) => ({ url: `/meetings/${id}`, body: {} }));
export const useUpdateMeetingStatusMutation = createMutationHook('put')(({ id, status }) => ({
  url: `/meetings/${id}/status`,
  body: { status }
}));
export const useAddMeetingNoteMutation = createMutationHook('post')(({ id, ...body }) => ({
  url: `/meetings/${id}/notes`,
  body
}));
export const useUpdateMeetingNoteMutation = createMutationHook('put')(({ id, noteId, ...body }) => ({
  url: `/meetings/${id}/notes/${noteId}`,
  body
}));
export const useDeleteMeetingNoteMutation = createMutationHook('delete')(({ id, noteId }) => ({
  url: `/meetings/${id}/notes/${noteId}`
}));

export const useAddMeetingAttachmentMutation = createMutationHook('post')(({ id, ...body }) => ({
  url: `/meetings/${id}/attachments`,
  body
}));
export const useRemoveMeetingAttachmentMutation = createMutationHook('delete')(({ id, attachmentId }) => ({
  url: `/meetings/${id}/attachments/${attachmentId}`
}));

export const useCreateFollowUpMutation = createMutationHook('post')(({ id, ...body }) => ({
  url: `/meetings/${id}/followups`,
  body
}));
export const useUpdateFollowUpMutation = createMutationHook('put')(({ id, followUpId, ...body }) => ({
  url: `/meetings/${id}/followups/${followUpId}`,
  body
}));
export const useCompleteFollowUpMutation = createMutationHook('put')(({ id, followUpId }) => ({
  url: `/meetings/${id}/followups/${followUpId}/complete`
}));
export const useDeleteFollowUpMutation = createMutationHook('delete')(({ id, followUpId }) => ({
  url: `/meetings/${id}/followups/${followUpId}`
}));