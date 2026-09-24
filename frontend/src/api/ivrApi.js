import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook to initiate an Outbound IVR call
 */
export const useInitiateOutboundCallMutation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const trigger = useCallback(async (payload) => {
    setIsLoading(true);
    try {
      const response = await api.post('/ivr/outbound-call', payload);
      setError(null);
      return response.data;
    } catch (err) {
      const formattedError = err.response?.data || { message: err.message || 'Call failed' };
      setError(formattedError);
      throw formattedError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return [trigger, { isLoading, error }];
};

/**
 * Hook to fetch Call History for a specific Lead
 */
export const useGetLeadCallLogsQuery = (leadId, options = {}) => {
  const { skip } = options;
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (skip || !leadId) return { data: null };
    setIsLoading(true);
    try {
      const response = await api.get(`/ivr/leads/${leadId}/calls`);
      setData(response.data);
      setError(null);
      return response.data;
    } catch (err) {
      setError(err);
      return { error: err };
    } finally {
      setIsLoading(false);
    }
  }, [leadId, skip]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
};

/**
 * Hook to fetch all Call History (with pagination & filters)
 */
export const useGetAllCallLogsQuery = (params = {}, options = {}) => {
  const { skip } = options;
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (skip) return { data: null };
    setIsLoading(true);
    try {
      const response = await api.get('/ivr/calls', { params });
      setData(response.data);
      setError(null);
      return response.data;
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
