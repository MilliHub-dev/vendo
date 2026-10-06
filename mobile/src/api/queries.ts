/** TanStack Query hooks — the way screens read and change server data. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCity } from '@/store/city';

import { api } from './client';
import type { ChatMessage, City, CreateOrderRequest, ProfileDetails, QuoteRequest, TopUpChannel, VendorCategory } from './types';

export const keys = {
  me: ['me'] as const,
  cities: ['cities'] as const,
  vendors: (cityId: string | undefined, category?: VendorCategory) => ['vendors', cityId ?? 'none', category ?? 'all'] as const,
  vendor: (id: string) => ['vendor', id] as const,
  picks: (cityId: string | undefined) => ['picks', cityId ?? 'none'] as const,
  search: (cityId: string | undefined, q: string) => ['search', cityId ?? 'none', q] as const,
  orders: (filter: 'active' | 'past') => ['orders', filter] as const,
  order: (id: string) => ['order', id] as const,
  tracking: (id: string) => ['tracking', id] as const,
  wallet: ['wallet'] as const,
  notifications: ['notifications'] as const,
  referrals: ['referrals'] as const,
  messages: (orderId: string) => ['messages', orderId] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api.getMe() });
const useCityId = () => useCity((s) => s.city?.id);
/** Nothing can be listed until a city is chosen. */
const cityReady = (cityId: string | undefined) => !!cityId;

export const useCities = () => useQuery({ queryKey: keys.cities, queryFn: () => api.listCities(), staleTime: 10 * 60_000 });
export function useSetCity() {
  return useMutation({
    mutationFn: (city: Pick<City, 'id' | 'name'>) => {
      useCity.getState().setCity({ id: city.id, name: city.name }); // takes effect straight away; saving to the account is best-effort
      return api.setCity(city);
    },
  });
}

export function useVendors(category?: VendorCategory) {
  const cityId = useCityId();
  return useQuery({ queryKey: keys.vendors(cityId, category), queryFn: () => api.listVendors({ category }), enabled: cityReady(cityId) });
}
export const useVendor = (id: string) => useQuery({ queryKey: keys.vendor(id), queryFn: () => api.getVendor(id) });
export function usePicks() {
  const cityId = useCityId();
  return useQuery({ queryKey: keys.picks(cityId), queryFn: () => api.listPicks(), enabled: cityReady(cityId), staleTime: 5 * 60_000 });
}
export function useSearch(q: string) {
  const cityId = useCityId();
  return useQuery({ queryKey: keys.search(cityId, q), queryFn: () => api.search(q), enabled: q.trim().length > 1 && cityReady(cityId) });
}

export const useOrders = (filter: 'active' | 'past') => useQuery({ queryKey: keys.orders(filter), queryFn: () => api.listOrders(filter), refetchInterval: 15_000 });
export const useOrder = (id: string) => useQuery({ queryKey: keys.order(id), queryFn: () => api.getOrder(id), refetchInterval: 8000 });
/** Polled every few seconds. TODO: use the server's tracking stream (/v1/orders/:id/tracking/stream). */
export const useTracking = (orderId: string) => useQuery({ queryKey: keys.tracking(orderId), queryFn: () => api.getTracking(orderId), refetchInterval: 6000 });

export const useWallet = () => useQuery({ queryKey: keys.wallet, queryFn: () => api.getWallet() });
export const useNotifications = () => useQuery({ queryKey: keys.notifications, queryFn: () => api.listNotifications() });
export const useQuote = (body: QuoteRequest | null) => useQuery({ queryKey: ['quote', body], queryFn: () => api.quote(body!), enabled: body !== null, retry: false, staleTime: 60_000 });

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

/** Pays for an order that was placed but not paid (the payment page was closed, or the wallet was short). */
export function usePayOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.payOrder(id),
    onSuccess: (order) => {
      client.setQueryData(keys.order(order.id), order);
      client.invalidateQueries({ queryKey: ['orders'] });
      client.invalidateQueries({ queryKey: keys.wallet });
    },
  });
}

/** Asked for at the moment the customer taps Cancel, so the fee shown is current. */
export const useCancellationTerms = () => useMutation({ mutationFn: (id: string) => api.getCancellationTerms(id) });

export function useCancelOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; acceptedFeeKobo: number }) => api.cancelOrder(v.id, v.acceptedFeeKobo),
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

/** Polled every few seconds. TODO: use the server's chat stream (/v1/orders/:id/chat/stream). */
export const useMessages = (orderId: string, enabled = true) => useQuery({ queryKey: keys.messages(orderId), queryFn: () => api.listMessages(orderId), refetchInterval: 4000, enabled });

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
