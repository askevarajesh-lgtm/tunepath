import { createQueryHook, createMutationHook } from './baseApi';

export const useGetCampaignsQuery = createQueryHook((params) => ({ url: '/campaign-expenses', params }));

export const useGetCampaignsDropdownQuery = createQueryHook((params) => ({ 
  url: '/campaign-expenses/dropdown', 
  params: { limit: 1000, ...params } 
}));

export const useGetCampaignByIdQuery = createQueryHook((id) => `/campaign-expenses/${id}`);

export const useGetClientCampaignSummaryQuery = createQueryHook((clientId) => `/campaign-expenses/client-summary/${clientId}`);

export const useCreateCampaignMutation = createMutationHook((data) => ({
  url: '/campaign-expenses',
  method: 'POST',
  body: data,
}));

export const useAddDailyDataMutation = createMutationHook(({ id, ...data }) => ({
  url: `/campaign-expenses/${id}/daily-data`,
  method: 'POST',
  body: data,
}));

export const useUpdatePaymentMutation = createMutationHook(({ id, ...data }) => ({
  url: `/campaign-expenses/${id}/payment`,
  method: 'PUT',
  body: data,
}));

export const useReconcilePaymentMutation = createMutationHook(({ id, ...data }) => ({
  url: `/campaign-expenses/${id}/reconcile-payment`,
  method: 'POST',
  body: data,
}));

export const useAddRechargeMutation = createMutationHook(({ id, ...data }) => ({
  url: `/campaign-expenses/${id}/recharge`,
  method: 'POST',
  body: data,
}));

export const useGetGlobalRechargesQuery = createQueryHook((params) => ({
  url: '/campaign-expenses/recharges',
  params,
}));

export const useAddGlobalRechargeMutation = createMutationHook((data) => ({
  url: '/campaign-expenses/recharges',
  method: 'POST',
  body: data,
}));

export const useUpdateGlobalRechargeMutation = createMutationHook(({ id, ...data }) => ({
  url: `/campaign-expenses/recharges/${id}`,
  method: 'PUT',
  body: data,
}));

export const useUpdateRechargeMutation = createMutationHook(({ campaignId, rechargeId, ...data }) => ({
  url: `/campaign-expenses/${campaignId}/recharge/${rechargeId}`,
  method: 'PUT',
  body: data,
}));

export const useDeleteGlobalRechargeMutation = createMutationHook((id) => ({
  url: `/campaign-expenses/recharges/${id}`,
  method: 'DELETE',
}));

export const useDeleteCampaignMutation = createMutationHook((id) => ({
  url: `/campaign-expenses/${id}`,
  method: 'DELETE',
}));

export const useUpdateCampaignMutation = createMutationHook(({ id, ...data }) => ({
  url: `/campaign-expenses/${id}`,
  method: 'PUT',
  body: data,
}));
