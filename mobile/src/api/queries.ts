/** TanStack Query hooks — the way screens read and change server data. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { ChatMessage, CreateOrderRequest, ProfileDetails, QuoteRequest, TopUpChannel, VendorCategory } from './types';

export const keys = {
  me: ['me'] as const,
  vendors: (category?: VendorCategory) => ['vendors', category ?? 'all'] as const,
  vendor: (id: string) => ['vendor', id] as const,
  picks: ['picks'] as const,
  search: (q: string) => ['search', q] as const,
  orders: (filter: 'active' | 'past') => ['orders', filter] as const,
  order: (id: string) => ['order', id] as const,
  tracking: (id: string) => ['tracking', id] as const,
  wallet: ['wallet'] as const,
  notifications: ['notifications'] as const,
  referrals: ['referrals'] as const,
  messages: (orderId: string) => ['messages', orderId] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api.getMe() });
export const useVendors = (category?: VendorCategory) => useQuery({ queryKey: keys.vendors(category), queryFn: () => api.listVendors({ category }) });
export const useVendor = (id: string) => useQuery({ queryKey: keys.vendor(id), queryFn: () => api.getVendor(id) });
export const usePicks = () => useQuery({ queryKey: keys.picks, queryFn: () => api.listPicks() });
export const useSearch = (q: string) => useQuery({ queryKey: keys.search(q), queryFn: () => api.search(q), enabled: q.trim().length > 1 });

export const useOrders = (filter: 'active' | 'past') => useQuery({ queryKey: keys.orders(filter), queryFn: () => api.listOrders(filter), refetchInterval: 5000 });
export const useOrder = (id: string) => useQuery({ queryKey: keys.order(id), queryFn: () => api.getOrder(id), refetchInterval: 3000 });
/** Polls while mocked; becomes a realtime subscription with the real backend. */
export const useTracking = (orderId: string) => useQuery({ queryKey: keys.tracking(orderId), queryFn: () => api.getTracking(orderId), refetchInterval: 2000 });

export const useWallet = () => useQuery({ queryKey: keys.wallet, queryFn: () => api.getWallet() });
export const useNotifications = () => useQuery({ queryKey: keys.notifications, queryFn: () => api.listNotifications() });
export const useQuote = (body: QuoteRequest | null) => useQuery({ queryKey: ['quote', body], queryFn: () => api.quote(body!), enabled: body !== null });

export function useCreateOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrderRequest) => api.createOrder(body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['orders'] });
      client.invalidateQueries({ queryKey: keys.wallet });
      client.invalidateQueries({ queryKey: keys.notifications });
      client.invalidateQueries({ queryKey: keys.referrals });
    },
  });
}

export function useCancelOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelOrder(id),
    onSuccess: (order) => {
      client.setQueryData(keys.order(order.id), order);
      client.invalidateQueries({ queryKey: ['orders'] });
      client.invalidateQueries({ queryKey: keys.wallet });
    },
  });
}

export function useRateOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; rating: number; comment?: string }) => api.rateOrder(v.id, v.rating, v.comment),
    onSuccess: (order) => {
      client.setQueryData(keys.order(order.id), order);
      client.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

/** Polls while mocked; becomes a realtime subscription with the real backend. */
export const useMessages = (orderId: string, enabled = true) => useQuery({ queryKey: keys.messages(orderId), queryFn: () => api.listMessages(orderId), refetchInterval: 2000, enabled });

export function useSendMessage(orderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.sendMessage(orderId, text),
    // show the message straight away; the next poll confirms it
    onSuccess: (message) => client.setQueryData<ChatMessage[]>(keys.messages(orderId), (old = []) => (old.some((m) => m.id === message.id) ? old : [...old, message])),
  });
}

export const useReferrals = () => useQuery({ queryKey: keys.referrals, queryFn: () => api.getReferrals() });

export function useApplyReferralCode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.applyReferralCode(code),
    onSuccess: (summary) => {
      client.setQueryData(keys.referrals, summary);
      client.invalidateQueries({ queryKey: ['quote'] }); // the welcome discount now applies
    },
  });
}

export const useCheckPromo = () => useMutation({ mutationFn: (code: string) => api.checkPromo(code) });

export function useTopUp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { amountKobo: number; channel: TopUpChannel }) => api.topUp(v.amountKobo, v.channel),
    onSuccess: (wallet) => client.setQueryData(keys.wallet, wallet),
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (details: ProfileDetails) => api.updateProfile(details),
    onSuccess: (user) => client.setQueryData(keys.me, user),
  });
}
