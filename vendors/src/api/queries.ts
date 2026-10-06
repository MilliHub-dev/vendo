/** TanStack Query hooks — how screens read and change server data. Polling becomes realtime with the real backend. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { BankAccount, ImageKind, MenuItemInput, Order, RegisterStoreRequest, Store, StoreUpdate } from './types';

export const keys = {
  me: ['me'] as const,
  store: ['store'] as const,
  cities: ['cities'] as const,
  orders: ['orders'] as const,
  menu: ['menu'] as const,
  dashboard: ['dashboard'] as const,
  payouts: ['payouts'] as const,
  banks: ['banks'] as const,
  reviews: ['reviews'] as const,
  notifications: ['notifications'] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api.getMe() });
export const useCities = () => useQuery({ queryKey: keys.cities, queryFn: () => api.listCities(), staleTime: Infinity });
/** Polled so an approval made in the admin dashboard shows up without a restart. */
export const useStore = (enabled = true) => useQuery({ queryKey: keys.store, queryFn: () => api.getStore(), refetchInterval: 3000, enabled });

function useStoreMutation<T>(fn: (arg: T) => Promise<Store>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (store) => client.setQueryData(keys.store, store) });
}
export const useRegisterStore = () => useStoreMutation((body: RegisterStoreRequest) => api.registerStore(body));
export const useUpdateStore = () => useStoreMutation((body: StoreUpdate) => api.updateStore(body));
export const useSetOpen = () => useStoreMutation((open: boolean) => api.setOpen(open));

/** One list for every orders view; screens filter it. Polled every 2 s so new orders appear promptly. */
export const useOrders = (enabled = true) => useQuery({ queryKey: keys.orders, queryFn: () => api.listOrders(), refetchInterval: 2000, enabled });
export const useOrder = (id: string) => {
  const orders = useOrders();
  return { ...orders, data: orders.data?.find((o) => o.id === id) };
};

export function useOrderAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: 'accept'; prepMinutes: number } | { id: string; action: 'reject'; reason: string } | { id: string; action: 'ready' }) =>
      v.action === 'accept' ? api.acceptOrder(v.id, v.prepMinutes) : v.action === 'reject' ? api.rejectOrder(v.id, v.reason) : api.markReady(v.id),
    onSuccess: (order) => {
      client.setQueryData<Order[]>(keys.orders, (old = []) => old.map((o) => (o.id === order.id ? order : o)));
      client.invalidateQueries({ queryKey: keys.dashboard });
    },
    onError: () => client.invalidateQueries({ queryKey: keys.orders }),
  });
}

export const useUploadImage = () => useMutation({ mutationFn: (v: { file: Blob; kind: ImageKind }) => api.uploadImage(v.file, v.kind) });

export const useMenu = () => useQuery({ queryKey: keys.menu, queryFn: () => api.listMenu() });
export function useSaveMenuItem() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (v: { item: MenuItemInput; id?: string }) => api.saveMenuItem(v.item, v.id), onSuccess: () => client.invalidateQueries({ queryKey: keys.menu }) });
}
export function useSetItemAvailable() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; available: boolean }) => api.setItemAvailable(v.id, v.available), onSettled: () => client.invalidateQueries({ queryKey: keys.menu }) });
}
export function useDeleteMenuItem() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.deleteMenuItem(id), onSuccess: () => client.invalidateQueries({ queryKey: keys.menu }) });
}

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: () => api.getDashboard(), refetchInterval: 10_000 });
export const useBanks = () => useQuery({ queryKey: ['banks'], queryFn: () => api.listBanks(), staleTime: Infinity });
export const usePayouts = () => useQuery({ queryKey: keys.payouts, queryFn: () => api.getPayouts(), refetchInterval: 10000 });
export const useReviews = () => useQuery({ queryKey: keys.reviews, queryFn: () => api.listReviews() });
export const useNotifications = () => useQuery({ queryKey: keys.notifications, queryFn: () => api.listNotifications() });
export function useSaveBankAccount() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (account: Omit<BankAccount, 'bankName'>) => api.saveBankAccount(account), onSuccess: (payouts) => client.setQueryData(keys.payouts, payouts) });
}
