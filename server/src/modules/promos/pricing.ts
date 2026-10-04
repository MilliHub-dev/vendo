import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import type { PromoInput } from '../extras/schema.js';
type Snapshot = {
    city_id: string;
    vendor_id?: string | undefined;
    subtotal_kobo?: number | undefined;
    delivery_fee_kobo: number;
    total_kobo: number;
    discount_kobo: number;
    promo?: {
        id: string;
        code: string;
    } | null | undefined;
};
type Promotion = PromoInput & {
    id: string;
    used_count: number;
};
export function calculateDiscount(p: Promotion, s: Snapshot, type: 'food' | 'dispatch'): number {
    if ((p.scope !== 'all' && p.scope !== type) || (p.city_id && p.city_id !== s.city_id) || (p.vendor_id && p.vendor_id !== s.vendor_id) || s.total_kobo < p.minimum_total_kobo)
        throw new ApiError(409, 'PROMO_INELIGIBLE', 'This promo does not apply to this order.');
    const basis = p.basis === 'delivery' ? s.delivery_fee_kobo : (s.subtotal_kobo ?? 0);
    const amount = p.kind === 'fixed' ? p.value : Math.floor(basis * p.value / 10000);
    const discount = Math.min(amount, p.max_discount_kobo, basis, s.total_kobo - 1);
    if (discount <= 0)
        throw new ApiError(409, 'PROMO_INELIGIBLE', 'This promo does not apply to this order.');
    return discount;
}
export async function applyPromo<T extends Snapshot>(client: pg.PoolClient, user: string, code: string | undefined, snapshot: T, type: 'food' | 'dispatch', checkout = false): Promise<T> {
    if (!code)
        return snapshot;
    const { rows } = await client.query<Promotion>(`SELECT * FROM vendo_internal.promos WHERE code=$1 AND active AND starts_at<=now() AND ends_at>now() FOR ${checkout ? 'UPDATE' : 'SHARE'}`, [code]);
    const p = rows[0];
    if (!p)
        throw new ApiError(409, 'PROMO_UNAVAILABLE', 'This promo is expired or unavailable.');
    const count = await client.query<{
        n: number;
    }>('SELECT count(*)::int AS n FROM vendo_internal.promo_redemptions WHERE promo_id=$1 AND customer_id=$2', [p.id, user]);
    if (p.used_count >= p.max_uses || count.rows[0]!.n >= p.per_customer_limit)
        throw new ApiError(409, 'PROMO_LIMIT_REACHED', 'This promo usage limit has been reached.');
    const gross = { ...snapshot, total_kobo: snapshot.total_kobo + (checkout ? snapshot.discount_kobo : 0) };
    const discount = calculateDiscount(p, gross, type);
    if (checkout && (snapshot.promo?.id !== p.id || discount !== snapshot.discount_kobo))
        throw new ApiError(409, 'PROMO_CHANGED', 'This promo changed. Request a new quote.');
    return { ...snapshot, discount_kobo: discount, total_kobo: gross.total_kobo - discount, promo: { id: p.id, code: p.code } };
}
export async function redeemPromo(client: pg.PoolClient, user: string, order: string, snapshot: Snapshot) {
    if (!snapshot.promo)
        return;
    await client.query('INSERT INTO vendo_internal.promo_redemptions (promo_id,customer_id,order_id,discount_kobo) VALUES ($1,$2,$3,$4)', [snapshot.promo.id, user, order, snapshot.discount_kobo]);
    await client.query('UPDATE vendo_internal.promos SET used_count=used_count+1 WHERE id=$1', [snapshot.promo.id]);
}
