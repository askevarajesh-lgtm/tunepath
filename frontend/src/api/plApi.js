import { createQueryHook, createMutationHook } from './baseApi';

export const useGetProjectPLQuery = createQueryHook((projectId) => `/pl-analytics/project/${projectId}`);

export const useGetPLSummaryQuery = createQueryHook((params) => ({
  url: '/pl-analytics/summary',
  params,
}));

export const useCalculateProjectPLMutation = createMutationHook((projectId) => ({
  url: `/pl-analytics/project/${projectId}/calculate`,
  method: 'POST',
}));
