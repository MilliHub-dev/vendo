/** TanStack Query hooks — how screens read and change server data. Things that change on their own are polled. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { ChatMessage, DocumentFile, DocumentKind, RegisterRiderRequest, Rider, WithdrawalRequest } from './types';

export const keys = {
  me: ['me'] as const,
  rider: ['rider'] as const,
  cities: ['cities'] as const,
  offer: ['offer'] as const,
  job: ['job'] as const,
  messages: ['messages'] as const,
  trips: ['trips'] as const,
  trip: (id: string) => ['trip', id] as const,
  earnings: ['earnings'] as const,
  banks: ['banks'] as const,
  withdrawals: ['withdrawals'] as const,
  notifications: ['notifications'] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api.getMe() });
export const useCities = () => useQuery({ queryKey: keys.cities, queryFn: () => api.listCities(), staleTime: Infinity });
/** Polled so an approval (or suspension) made in the admin dashboard shows up without a restart. */
export const useRider = (enabled = true) => useQuery({ queryKey: keys.rider, queryFn: () => api.getRider(), refetchInterval: 15_000, enabled });

function useRiderMutation<T>(fn: (arg: T) => Promise<Rider>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (rider) => client.setQueryData(keys.rider, rider) });
}
export const useRegisterRider = () => useRiderMutation((body: RegisterRiderRequest) => api.registerRider(body));
export const useUploadDocument = () => useRiderMutation((v: { kind: DocumentKind; file: DocumentFile }) => api.uploadDocument(v.kind, v.file));
export const useSetOnline = () => useRiderMutation((online: boolean) => api.setOnline(online));

export const useOffer = (enabled: boolean) => useQuery({ queryKey: keys.offer, queryFn: () => api.getCurrentOffer(), refetchInterval: 4000, enabled });
export const useJob = () => useQuery({ queryKey: keys.job, queryFn: () => api.getJob(), refetchInterval: 8000 });

export function useRespondToOffer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: 'accept' | 'reject' }) => api.respondToOffer(v.id, v.action),
    onSettled: () => client.setQueryData(keys.offer, null),
    onSuccess: (job) => {
      client.setQueryData(keys.job, job);
      client.setQueryData(keys.messages, []);
      client.invalidateQueries({ queryKey: keys.rider });
    },
  });
}

/** Marks a step done, or completes the delivery (with the receiver's code for dispatch). */
export function useAdvanceJob() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { action: 'picked_up' | 'on_the_way' | 'delivered' } | { code: string }) => ('code' in v ? api.confirmDelivery(v.code) : api.updateJob(v.action)),
    onSuccess: (job) => {
      const finished = job.status === 'delivered';
      client.setQueryData(keys.job, finished ? null : job);
      if (finished) for (const key of [keys.trips, keys.earnings, keys.rider, keys.notifications]) client.invalidateQueries({ queryKey: key });
    },
    onError: () => client.invalidateQueries({ queryKey: keys.job }), // refresh attempts left
  });
}

export const useMessages = (enabled: boolean) => useQuery({ queryKey: keys.messages, queryFn: () => api.listMessages(), refetchInterval: 4000, enabled });
export function useSendMessage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.sendMessage(text),
    onSuccess: (message) => client.setQueryData<ChatMessage[]>(keys.messages, (old = []) => (old.some((m) => m.id === message.id) ? old : [...old, message])),
  });
}

export const useTrips = () => useQuery({ queryKey: keys.trips, queryFn: () => api.listTrips() });
export const useTrip = (id: string) => useQuery({ queryKey: keys.trip(id), queryFn: () => api.getTrip(id) });
export const useEarnings = () => useQuery({ queryKey: keys.earnings, queryFn: () => api.getEarnings() });
export const useBanks = () => useQuery({ queryKey: keys.banks, queryFn: () => api.listBanks(), staleTime: Infinity });
export const useWithdrawals = () => useQuery({ queryKey: keys.withdrawals, queryFn: () => api.listWithdrawals(), refetchInterval: 30_000 });
export const usePayoutAccount = () => useQuery({ queryKey: ['payout-account'], queryFn: () => api.getPayoutAccount() });
export const useNotifications = () => useQuery({ queryKey: keys.notifications, queryFn: () => api.listNotifications() });

export function useRequestWithdrawal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: WithdrawalRequest) => api.requestWithdrawal(body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.withdrawals });
      client.invalidateQueries({ queryKey: ['payout-account'] });
      client.invalidateQueries({ queryKey: keys.earnings });
    },
  });
}
