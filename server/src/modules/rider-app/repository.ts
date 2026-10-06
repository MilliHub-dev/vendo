import type pg from 'pg';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';

/**
 * Read-only views for the rider app: what a delivery pays, the rider's own record, and
 * their completed trips. Everything here is derived from tables other modules own; it
 * never changes an order, an offer or a balance.
 */
const point = z.object({ lat: z.number(), lng: z.number(), address: z.string() });
export const riderSummarySchema = z.object({
  /** average of customers' rider ratings, null until there is one */
  rating: z.number().nullable(), rating_count: z.number().int(), total_trips: z.number().int(),
  /** offers accepted ÷ offers answered or expired, null until there is one */
  acceptance_rate: z.number().nullable(),
  /** from the city's finance policy; null when payouts aren't configured */
  minimum_withdrawal_kobo: z.number().int().nullable(),
  offer: z.object({ id: z.uuid(), earning_kobo: z.number().int().nullable(), trip_distance_m: z.number().int(), summary: z.string() }).nullable(),
  job: z.object({ order_id: z.uuid(), earning_kobo: z.number().int().nullable(), code_attempts_left: z.number().int().nullable() }).nullable(),
});
export type RiderSummary = z.infer<typeof riderSummarySchema>;
export const riderTripSchema = z.object({
  order_id: z.uuid(), code: z.string(), type: z.enum(['food', 'dispatch']), title: z.string(), pickup: point, dropoff: point,
  distance_m: z.number().int(), earning_kobo: z.number().int().nullable(), completed_at: z.string(),
});
export type RiderTrip = z.infer<typeof riderTripSchema>;
export interface RiderAppRepository { summary(riderId: string): Promise<RiderSummary>; trips(riderId: string, limit: number, offset: number): Promise<RiderTrip[]>; }

type Terms = { enabled?: boolean; rider_delivery_bps?: number; rider_fixed_kobo?: number; minimum_withdrawal_kobo?: number } | null;
type Quote = { delivery_fee_kobo?: number; distance_m?: number; vendor_name?: string; items?: { quantity: number }[]; package?: { description?: string; fragile?: boolean }; pickup: unknown; dropoff: unknown; city_id?: string };
const DELIVERY_CODE_ATTEMPTS = 3; // dispatch_delivery_codes.attempts is capped at 3

/** The same sum the settlement uses (finance repository): a share of the delivery fee plus a fixed amount. */
export function riderEarning(quote: Pick<Quote, 'delivery_fee_kobo'>, terms: Terms): number | null {
  if (!terms || terms.rider_delivery_bps === undefined || terms.rider_fixed_kobo === undefined || quote.delivery_fee_kobo === undefined) return null;
  return Math.floor(Number(quote.delivery_fee_kobo) * terms.rider_delivery_bps / 10000) + terms.rider_fixed_kobo;
}
const title = (type: string, quote: Quote) => type === 'food' ? (quote.vendor_name ?? 'Food order') : (quote.package?.description ?? 'Package');
function offerSummary(type: string, quote: Quote): string {
  if (type !== 'food') return `${quote.package?.description ?? 'Package'}${quote.package?.fragile ? ' · fragile' : ''}`;
  const count = (quote.items ?? []).reduce((n, i) => n + i.quantity, 0);
  return `${quote.vendor_name ?? 'Food order'}${count ? ` · ${count} item${count === 1 ? '' : 's'}` : ''}`;
}

export class PostgresRiderAppRepository implements RiderAppRepository {
  constructor(private readonly pool: pg.Pool) {}

  private async rider(riderId: string) {
    const row = (await this.pool.query<{ city_id: string }>("SELECT r.city_id FROM vendo_internal.riders r JOIN public.profiles p ON p.id=r.profile_id WHERE r.profile_id=$1 AND p.status='active'", [riderId])).rows[0];
    if (!row) throw new ApiError(404, 'RIDER_NOT_FOUND', 'Rider profile not found.');
    return row;
  }
  /** The terms frozen on the order when it was placed, or the city's current policy for an order placed before one existed. */
  private terms(orderTerms: Terms, cityPolicy: Terms): Terms { return orderTerms ?? (cityPolicy?.enabled === false ? null : cityPolicy); }

  async summary(riderId: string): Promise<RiderSummary> {
    const rider = await this.rider(riderId);
    const [stats, policy, offer, job] = await Promise.all([
      this.pool.query<{ rating: string | null; rating_count: number; total_trips: number; accepted: number; answered: number }>(`SELECT
        (SELECT avg(g.rider_rating) FROM public.order_ratings g JOIN public.orders o ON o.id=g.order_id WHERE o.assigned_rider_id=$1 AND g.rider_rating IS NOT NULL) AS rating,
        (SELECT count(*)::int FROM public.order_ratings g JOIN public.orders o ON o.id=g.order_id WHERE o.assigned_rider_id=$1 AND g.rider_rating IS NOT NULL) AS rating_count,
        (SELECT count(*)::int FROM public.orders WHERE assigned_rider_id=$1 AND status='delivered') AS total_trips,
        (SELECT count(*)::int FROM vendo_internal.rider_offers WHERE rider_id=$1 AND status='accepted') AS accepted,
        (SELECT count(*)::int FROM vendo_internal.rider_offers WHERE rider_id=$1 AND status IN ('accepted','rejected','expired')) AS answered`, [riderId]),
      this.pool.query<{ enabled: boolean; config: Terms }>('SELECT enabled,config FROM vendo_internal.finance_policies WHERE city_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1', [rider.city_id]),
      this.pool.query<{ id: string; type: string; quote: Quote; terms: Terms }>(`SELECT f.id,o.type,o.quote,t.terms FROM vendo_internal.rider_offers f JOIN public.orders o ON o.id=f.order_id
        LEFT JOIN vendo_internal.order_finance_terms t ON t.order_id=o.id WHERE f.rider_id=$1 AND f.status='pending' AND f.expires_at>now() AND o.status='searching_rider'`, [riderId]),
      this.pool.query<{ id: string; type: string; quote: Quote; terms: Terms; attempts: number | null; locked_at: Date | null }>(`SELECT o.id,o.type,o.quote,t.terms,c.attempts,c.locked_at FROM public.orders o
        LEFT JOIN vendo_internal.order_finance_terms t ON t.order_id=o.id LEFT JOIN vendo_internal.dispatch_delivery_codes c ON c.order_id=o.id
        WHERE o.assigned_rider_id=$1 AND o.status IN ('rider_assigned','picked_up','on_the_way')`, [riderId]),
    ]);
    const s = stats.rows[0]!, p = policy.rows[0], cityTerms: Terms = p ? { ...p.config, enabled: p.enabled } : null, o = offer.rows[0], j = job.rows[0];
    return riderSummarySchema.parse({
      rating: s.rating === null ? null : Math.round(Number(s.rating) * 10) / 10, rating_count: s.rating_count, total_trips: s.total_trips,
      acceptance_rate: s.answered ? Math.round(s.accepted / s.answered * 100) / 100 : null,
      minimum_withdrawal_kobo: p?.enabled && p.config?.minimum_withdrawal_kobo ? p.config.minimum_withdrawal_kobo : null,
      offer: o ? { id: o.id, earning_kobo: riderEarning(o.quote, this.terms(o.terms, cityTerms)), trip_distance_m: Math.round(Number(o.quote.distance_m ?? 0)), summary: offerSummary(o.type, o.quote) } : null,
      job: j ? { order_id: j.id, earning_kobo: riderEarning(j.quote, this.terms(j.terms, cityTerms)), code_attempts_left: j.attempts === null ? null : j.locked_at ? 0 : Math.max(0, DELIVERY_CODE_ATTEMPTS - j.attempts) } : null,
    });
  }

  async trips(riderId: string, limit: number, offset: number): Promise<RiderTrip[]> {
    await this.rider(riderId);
    const { rows } = await this.pool.query<{ id: string; code: string; type: string; quote: Quote; terms: Terms; rider_kobo: string | null; delivered_at: Date | null; status_updated_at: Date }>(`SELECT o.id,o.code,o.type,o.quote,t.terms,s.rider_kobo,o.delivered_at,o.status_updated_at
      FROM public.orders o LEFT JOIN vendo_internal.order_finance_terms t ON t.order_id=o.id LEFT JOIN vendo_internal.settlements s ON s.order_id=o.id AND s.rider_id=$1
      WHERE o.assigned_rider_id=$1 AND o.status='delivered' ORDER BY COALESCE(o.delivered_at,o.status_updated_at) DESC,o.id LIMIT $2 OFFSET $3`, [riderId, limit, offset]);
    return rows.map((r) => riderTripSchema.parse({
      order_id: r.id, code: r.code, type: r.type, title: title(r.type, r.quote), pickup: r.quote.pickup, dropoff: r.quote.dropoff, distance_m: Math.round(Number(r.quote.distance_m ?? 0)),
      // what was actually settled once it exists; before that, what the order's terms say it will be
      earning_kobo: r.rider_kobo !== null ? Number(r.rider_kobo) : riderEarning(r.quote, r.terms), completed_at: (r.delivered_at ?? r.status_updated_at).toISOString(),
    }));
  }
}
