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
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const mutate = (params) => {
      setIsLoading(true);
      const promise = (async () => {
        try {
          const config = typeof endpointFn === 'function' ? endpointFn(params) : { url: endpointFn };
          const url = typeof config === 'string' ? config : config.url;
          const method = typeof config === 'object' && config.method ? config.method : 'POST';
          const body = typeof config === 'object' ? config.body : undefined;
          const formData = typeof config === 'object' ? config.formData : undefined;
          
          const response = await api({ url, method, data: formData || body });
          setData(response.data);
          setError(null);
          setIsLoading(false);
          return { data: response.data };
        } catch (err) {
          setError(err);
          setIsLoading(false);
          return { error: err };
        }
      })();
      
      promise.unwrap = async () => {
        const res = await promise;
        if (res.error) throw res.error;
        return res.data;
      };
      
      return promise;
    };
    return [mutate, { data, isLoading, error, isFetching: isLoading }];
  };
};

export const useGetIntegrationsQuery = createQueryHook(() => "/integrations");
export const useCreateIntegrationMutation = createMutationHook((data) => ({ url: "/integrations", method: "POST", body: data }));
export const useUpdateIntegrationMutation = createMutationHook(({ id, ...data }) => ({ url: `/integrations/${id}`, method: "PUT", body: data }));
export const useSendMessageMutation = createMutationHook(({ id, ...data }) => ({ url: `/integrations/${id}/send`, method: "POST", body: data }));
export const useFetchWhatsAppTemplatesQuery = createQueryHook((id) => `/integrations/${id}/whatsapp/templates`);
export const useValidateEktaApiMutation = createMutationHook((data) => ({ url: `/integrations/ekta/validate`, method: "POST", body: data }));
export const useSyncEktaStaffMutation = createMutationHook(({ id, ...data }) => ({ url: `/integrations/${id}/ekta/sync/staff`, method: "POST", body: data }));
export const useSyncEktaAttendanceMutation = createMutationHook(({ id, ...data }) => ({ url: `/integrations/${id}/ekta/sync/attendance`, method: "POST", body: data }));
export const useFetchWhatsAppLeadsMutation = createMutationHook(({ id, ...data }) => ({ url: `/integrations/${id}/whatsapp-leads/fetch`, method: "POST", body: data }));
export const useGetFacebookIntegrationsQuery = createQueryHook((clientId) => `/facebook/integrations${clientId ? `?clientId=${clientId}` : ""}`);
export const useEnableFacebookSyncMutation = createMutationHook((data) => ({ url: "/facebook/integrations/subscribe", method: "POST", body: data }));
export const useDisableFacebookSyncMutation = createMutationHook((data) => ({ url: "/facebook/integrations/unsubscribe", method: "POST", body: data }));
export const useDisconnectFacebookPageMutation = createMutationHook(({ pageId, clientId }) => ({ url: `/facebook/integrations/${pageId}${clientId ? `?clientId=${clientId}` : ""}`, method: "DELETE" }));
export const useGetFacebookAdAccountsQuery = createQueryHook(() => `/facebook/integrations/assets/ad-accounts`);
export const useGetFacebookCampaignsQuery = createQueryHook((params) => ({ url: `/facebook/integrations/assets/campaigns`, params }));
export const useGetFacebookAdSetsQuery = createQueryHook((params) => ({ url: `/facebook/integrations/assets/adsets`, params }));
export const useGetFacebookAdsQuery = createQueryHook((params) => ({ url: `/facebook/integrations/assets/ads`, params }));
export const useGetFacebookFormsQuery = createQueryHook((params) => ({ url: `/facebook/integrations/assets/forms`, params }));
export const useLazyGetFacebookFormsQuery = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const trigger = useCallback(async (params) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/facebook/integrations/assets/forms', { params: params || {} });
      setData(response.data);
      return response.data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return [trigger, { data, isLoading, error, isFetching: isLoading }];
};

export const useGetFacebookSyncLogsQuery = createQueryHook(({ pageId, clientId }) => `/facebook/integrations/${pageId}/logs${clientId ? `?clientId=${clientId}` : ""}`);
export const useLazyGetFacebookSyncLogsQuery = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const trigger = useCallback(async (params) => {
    setIsLoading(true);
    setError(null);
    try {
      const { pageId, clientId } = params || {};
      const response = await api.get(`/facebook/integrations/${pageId}/logs`, {
        params: clientId ? { clientId } : {}
      });
      setData(response.data);
      return response.data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return [trigger, { data, isLoading, error, isFetching: isLoading }];
};
export const useSyncFacebookLeadsMutation = createMutationHook((data) => ({ url: "/facebook/integrations/sync-leads", method: "POST", body: data }));
export const useTestTwilioConnectionMutation = createMutationHook((data) => ({ url: "/integrations/twilio/test", method: "POST", body: data }));
export const useSaveTwilioIntegrationMutation = createMutationHook((data) => ({ url: "/integrations/twilio/save", method: "POST", body: data }));
export const useGetTwilioIntegrationQuery = createQueryHook(() => "/integrations/twilio");
export const useSyncWhatsAppLeadsMutation = createMutationHook('/integrations/whatsapp-leads/sync');
export const useGetPaymentIntegrationQuery = createQueryHook(companyId => `/integrations/payment/${companyId}`);
export const useGetSmsLogsQuery = createQueryHook((params) => ({ url: "/sms/logs", params }));

// Event Config Hooks
export const useGetEventConfigsQuery = createQueryHook((integrationId) => `/integrations/${integrationId}/events`);
export const useUpsertEventConfigMutation = createMutationHook((data) => ({ url: `/integrations/${data.integrationId}/events`, method: "POST", body: data }));
export const useTestEmailConnectionMutation = createMutationHook((data) => ({ url: `/integrations/email/test-connection`, method: "POST", body: data }));
export const useSendTestEmailMutation = createMutationHook((data) => ({ url: `/integrations/email/test-send`, method: "POST", body: data }));
export const useConnectFacebookManualPageMutation = createMutationHook((data) => ({ url: "/facebook/integrations/manual-page", method: "POST", body: data }));
