import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';

export const payoutBankSchema = z.object({ code: z.string(), name: z.string() });
export type PayoutBank = z.infer<typeof payoutBankSchema>;
export interface PayoutBanks { list(): Promise<PayoutBank[]>; }

const DAY_MS = 86_400_000;
/** Nigerian banks from Paystack, so the codes always match what payouts use. Cached for a day; the list rarely changes. */
export function createPaystackBanks(secret: string, fetcher: typeof fetch = fetch): PayoutBanks {
  let cache: { at: number; banks: PayoutBank[] } | null = null;
  return {
    async list() {
      if (cache && Date.now() - cache.at < DAY_MS) return cache.banks;
      try {
        const response = await fetcher('https://api.paystack.co/bank?country=nigeria&currency=NGN&perPage=100', { headers: { authorization: `Bearer ${secret}` }, redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Provider failed');
        const body = z.object({ status: z.literal(true), data: z.array(z.object({ code: z.string(), name: z.string(), active: z.boolean().optional(), is_deleted: z.boolean().nullable().optional() })) }).parse(await response.json());
        const seen = new Set<string>();
        const banks = body.data.filter((b) => b.active !== false && !b.is_deleted && /^\d{3,12}$/.test(b.code) && !seen.has(b.code) && seen.add(b.code)).map((b) => ({ code: b.code, name: b.name })).sort((a, b) => a.name.localeCompare(b.name));
        if (banks.length === 0) throw new Error('Empty list');
        cache = { at: Date.now(), banks };
        return banks;
      } catch {
        if (cache) return cache.banks; // a stale list is better than none
        throw new ApiError(503, 'BANK_LIST_UNAVAILABLE', 'The bank list is temporarily unavailable.');
      }
    },
  };
}
