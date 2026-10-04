/** TanStack Query hooks — how pages read and change server data. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { Audience } from "./types";

const key = {
  overview: ["overview"],
  orders: ["orders"],
  riders: ["riders"],
  vendors: ["vendors"],
  customers: ["customers"],
  transactions: ["transactions"],
  withdrawals: ["withdrawals"],
  cities: ["cities"],
  banners: ["banners"],
  promos: ["promos"],
  referral: ["referral"],
  broadcasts: ["broadcasts"],
  audit: ["audit"],
} as const;

export const useOverview = () => useQuery({ queryKey: key.overview, queryFn: () => api.getOverview(), refetchInterval: 30_000 });
export const useOrders = () => useQuery({ queryKey: key.orders, queryFn: () => api.listOrders(), refetchInterval: 15_000 });
export const useRiders = () => useQuery({ queryKey: key.riders, queryFn: () => api.listRiders() });
export const useVendors = () => useQuery({ queryKey: key.vendors, queryFn: () => api.listVendors() });
export const useCustomers = () => useQuery({ queryKey: key.customers, queryFn: () => api.listCustomers() });
export const useTransactions = () => useQuery({ queryKey: key.transactions, queryFn: () => api.listTransactions() });
export const useWithdrawals = () => useQuery({ queryKey: key.withdrawals, queryFn: () => api.listWithdrawals() });
export const useCities = () => useQuery({ queryKey: key.cities, queryFn: () => api.listCities() });
export const useBanners = () => useQuery({ queryKey: key.banners, queryFn: () => api.listBanners() });
export const usePromoCodes = () => useQuery({ queryKey: key.promos, queryFn: () => api.listPromoCodes() });
export const useReferralConfig = () => useQuery({ queryKey: key.referral, queryFn: () => api.getReferralConfig() });
export const useBroadcasts = () => useQuery({ queryKey: key.broadcasts, queryFn: () => api.listBroadcasts() });
export const useAudienceCount = (audience: Audience, cityIds: string[]) => useQuery({ queryKey: ["audience", audience, [...cityIds].sort().join()], queryFn: () => api.countAudience(audience, cityIds), enabled: cityIds.length > 0 });
export const useAudit = (enabled: boolean) => useQuery({ queryKey: key.audit, queryFn: () => api.listAudit(), enabled });

/**
 * One mutation hook for every admin action: pass the API call, and the lists it affects
 * are refreshed afterwards (plus the overview and audit log, which any change can touch).
 */
export function useAction<T, R>(fn: (arg: T) => Promise<R>, refresh: (keyof typeof key)[]) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of [...refresh, "overview", "audit"] as const) client.invalidateQueries({ queryKey: key[k] });
    },
  });
}
