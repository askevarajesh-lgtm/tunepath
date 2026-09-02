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
          const body = typeof config === 'object' && config.body ? config.body : arg;
          
          let response;
          if (method === 'post') response = await api.post(url, body);
          else if (method === 'put') response = await api.put(url, body);
          else if (method === 'delete') response = await api.delete(url, { data: typeof body === 'object' ? body : undefined });
          
          setError(null);
          return response.data;
        };

        const promise = execute().finally(() => setIsLoading(false));
        
        // Create a custom promise that resolves gracefully but throws on unwrap if needed
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

export const useGetLeadsQuery = createQueryHook((params) => ({ url: '/leads', params }));
export const useGetAssignableBdeUsersQuery = createQueryHook('/leads/assignable-bde');
export const useGetLeadNotesQuery = createQueryHook((leadId) => `/leads/${leadId}/notes`);

export const useCreateLeadMutation = createMutationHook('post')('/leads');
export const useUpdateLeadMutation = createMutationHook('put')((arg) => {
  const { id, ...rest } = arg;
  return { url: `/leads/${id}`, body: rest };
});
export const useDeleteLeadMutation = createMutationHook('delete')((id) => `/leads/${id}`);

export const useBulkDeleteLeadsMutation = createMutationHook('post')((leadIds) => ({
  url: '/leads/bulk-delete',
  body: { leadIds }
}));

export const useAddLeadNoteMutation = () => {
  const [isLoading, setIsLoading] = useState(false);
  
  const trigger = useCallback((arg) => {
    setIsLoading(true);
    const { leadId, noteType, content, file } = arg;
    
    const execute = async () => {
      const body = new FormData();
      body.append("noteType", noteType);
      if (content) body.append("content", content);
      if (file) body.append("file", file);
      const response = await api.post(`/leads/${leadId}/notes`, body);
      return response.data;
    };

    const promise = execute().finally(() => setIsLoading(false));
    const resultPromise = promise.catch(err => ({ error: err }));
    resultPromise.unwrap = () => promise.catch(err => Promise.reject(err.response?.data || err));
    return resultPromise;
  }, []);
  
  return [trigger, { isLoading }];
};

export const useDeleteLeadNoteMutation = createMutationHook('delete')(({ leadId, noteId }) => `/leads/${leadId}/notes/${noteId}`);

export const useAddLeadReminderMutation = createMutationHook('post')(({ leadId, ...payload }) => ({
  url: `/leads/${leadId}/reminders`,
  data: payload
}));

export const useLazyExportLeadsCsvQuery = () => {
  const [isFetching, setIsFetching] = useState(false);

  const trigger = useCallback((arg) => {
      setIsFetching(true);
      
      const execute = async () => {
        const filter = typeof arg === "string" ? arg : arg?.filter;
        const ids = typeof arg === "object" && arg !== null && Array.isArray(arg.ids) ? arg.ids : [];
        const params = {
          filter: filter === "reminder" ? "reminder" : "all",
          ...(arg?.companyId ? { companyId: arg.companyId } : {}),
          ...(typeof arg === "object" && arg?.startDate ? { startDate: arg.startDate } : {}),
          ...(typeof arg === "object" && arg?.endDate ? { endDate: arg.endDate } : {}),
          ...(typeof arg === "object" && arg?.formName ? { formName: arg.formName } : {}),
        };
        if (ids.length) {
          params.ids = ids.join(",");
        }

        const response = await api.get('/leads/export', { params, responseType: 'blob' });
        
        let filename = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
        const disposition = response.headers && response.headers['content-disposition'];
        if (disposition && disposition.indexOf('filename=') !== -1) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }
        
        return { data: { blob: response.data, filename } };
      };

      const promise = execute().finally(() => setIsFetching(false));
      const resultPromise = promise.catch(err => ({ error: err }));
      resultPromise.unwrap = () => promise.catch(err => Promise.reject(err.response?.data || err));
      return resultPromise;
  }, []);

  return [trigger, { isFetching }];
};

export const useImportLeadsCsvMutation = () => {
  const [isLoading, setIsLoading] = useState(false);
  
  const trigger = useCallback((file) => {
      setIsLoading(true);
      
      const execute = async () => {
        const body = new FormData();
        body.append("file", file);
        const response = await api.post('/leads/import', body);
        return response.data;
      };

      const promise = execute().finally(() => setIsLoading(false));
      const resultPromise = promise.catch(err => ({ error: err }));
      resultPromise.unwrap = () => promise.catch(err => Promise.reject(err.response?.data || err));
      return resultPromise;
  }, []);

  return [trigger, { isLoading }];
};
