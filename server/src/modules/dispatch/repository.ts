import {applyPromo,redeemPromo} from '../promos/pricing.js';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import { cityOpen } from '../food/pricing.js';
import { dispatchOrderSchema, dispatchSnapshotSchema, packageConfigSchema, type DispatchCity, type DispatchRepository, type DispatchSnapshot, type DispatchQuote, type DispatchOrder, type PackageConfig, type ProtectedCode } from './schema.js';
import { transition, type TransitionRow } from '../orders/transitions.js';
import { planSchedule } from '../orders/scheduling.js';
import { serializeOrder } from '../orders/schema.js';

const versionSql = "md5(concat_ws('|',base_fare_kobo,per_km_rate_kobo,minimum_delivery_fee_kobo,service_polygon::text,opens_at,closes_at,surge_bps))";
const canonical = (value: unknown) => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const packageFromRow = (row: Record<string, unknown>) => packageConfigSchema.strip().parse({ ...row, fee_kobo: Number(row.fee_kobo) });
function changed(): never { throw new ApiError(409, 'CHECKOUT_CHANGED', 'Dispatch pricing, package limits or availability changed. Request a new quote.'); }

export class PostgresDispatchRepository implements DispatchRepository {
  constructor(private readonly pool: pg.Pool) {}
  private async transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async getCity(id: string) {
    const { rows } = await this.pool.query<DispatchCity>(`SELECT *, ${versionSql} AS pricing_version FROM public.cities WHERE id=$1`, [id]);
    return rows[0] ?? null;
  }
  async packages(cityId: string) {
    const { rows } = await this.pool.query('SELECT p.* FROM public.dispatch_packages p JOIN public.cities c ON c.id=p.city_id WHERE p.city_id=$1 AND p.is_active AND c.is_active ORDER BY p.size', [cityId]);
    return rows.map(packageFromRow);
  }
  async savePackage(actorId: string, cityId: string, config: PackageConfig) {
    return this.transaction(async (client) => {
      if (!(await client.query("SELECT id FROM public.profiles WHERE id=$1 AND role='admin' AND status='active' FOR SHARE", [actorId])).rows[0]) throw new ApiError(403, 'FORBIDDEN', 'Administrator access is required.');
      if (!(await client.query('SELECT id FROM public.cities WHERE id=$1 FOR SHARE', [cityId])).rows[0]) throw new ApiError(400, 'CITY_NOT_FOUND', 'Choose an existing service city.');
      const { rows } = await client.query(`INSERT INTO public.dispatch_packages (city_id,size,label,fee_kobo,max_weight_g,max_length_cm,max_width_cm,max_height_cm,is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (city_id,size) DO UPDATE SET label=EXCLUDED.label,fee_kobo=EXCLUDED.fee_kobo,
        max_weight_g=EXCLUDED.max_weight_g,max_length_cm=EXCLUDED.max_length_cm,max_width_cm=EXCLUDED.max_width_cm,max_height_cm=EXCLUDED.max_height_cm,is_active=EXCLUDED.is_active RETURNING *`,
      [cityId, config.size, config.label, config.fee_kobo, config.max_weight_g, config.max_length_cm, config.max_width_cm, config.max_height_cm, config.is_active]);
      await client.query("INSERT INTO vendo_internal.catalog_audit (actor_id,action,target_id) VALUES ($1,'dispatch_package_updated',$2)", [actorId, cityId]);
      return packageFromRow(rows[0]!);
    });
  }
  async saveQuote(userId: string, snapshot: DispatchSnapshot, version: string, config: PackageConfig, promoCode?:string): Promise<DispatchQuote> {
    return this.transaction(async (client) => {
      const city = await client.query<DispatchCity>(`SELECT *,${versionSql} AS pricing_version FROM public.cities WHERE id=$1 AND is_active FOR SHARE`, [snapshot.city_id]);
      const pack = await client.query('SELECT * FROM public.dispatch_packages WHERE city_id=$1 AND size=$2 AND is_active FOR SHARE', [snapshot.city_id, snapshot.package.size]);
      if (!city.rows[0] || !cityOpen(city.rows[0]) || city.rows[0].pricing_version !== version || !pack.rows[0] || canonical(packageFromRow(pack.rows[0])) !== canonical(config)) changed();
      snapshot=await applyPromo(client,userId,promoCode,snapshot,'dispatch');
      const { rows } = await client.query<{ id: string; expires_at: Date }>('INSERT INTO vendo_internal.dispatch_quotes (customer_id,city_id,snapshot,pricing_version,package_config) VALUES ($1,$2,$3,$4,$5) RETURNING id,expires_at', [userId, snapshot.city_id, JSON.stringify(snapshot), version, JSON.stringify(config)]);
      return { ...snapshot, id: rows[0]!.id, expires_at: rows[0]!.expires_at.toISOString(), currency: 'NGN' };
    });
  }
  async createOrder(userId: string, quoteId: string, method: DispatchOrder['payment_method'], key: string, generateCode: (id: string) => ProtectedCode, scheduledAt?: string) {
    return this.transaction(async (client) => {
      if (!(await client.query("SELECT id FROM public.profiles WHERE id=$1 AND status='active' AND onboarding_step='complete' FOR UPDATE", [userId])).rows[0]) throw new ApiError(403, 'ONBOARDING_REQUIRED', 'Complete your active account profile before ordering.');
      const existing = await client.query('SELECT * FROM public.orders WHERE customer_id=$1 AND idempotency_key=$2', [userId, key]);
      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (row.type !== 'dispatch' || row.dispatch_quote_id !== quoteId || row.payment_method !== method || (row.checkout_scheduled_at?.toISOString() ?? null) !== (scheduledAt ? new Date(scheduledAt).toISOString() : null)) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This request key was already used for a different checkout.');
        return dispatchOrderSchema.parse(serializeOrder(row));
      }
      const quotes = await client.query<{ snapshot: DispatchSnapshot; pricing_version: string; package_config: PackageConfig }>('SELECT * FROM vendo_internal.dispatch_quotes WHERE id=$1 AND customer_id=$2 AND expires_at>now() FOR UPDATE', [quoteId, userId]);
      const quote = quotes.rows[0];
      if (!quote) throw new ApiError(409, 'QUOTE_UNAVAILABLE', 'The quote expired or is unavailable. Request a new quote.');
      const snapshot = dispatchSnapshotSchema.parse(quote.snapshot);
      const city = await client.query<DispatchCity>(`SELECT *,${versionSql} AS pricing_version FROM public.cities WHERE id=$1 AND is_active FOR SHARE`, [snapshot.city_id]);
      const pack = await client.query('SELECT * FROM public.dispatch_packages WHERE city_id=$1 AND size=$2 AND is_active FOR SHARE', [snapshot.city_id, snapshot.package.size]);
      if (!city.rows[0] || !cityOpen(city.rows[0]) || city.rows[0].pricing_version !== quote.pricing_version || !pack.rows[0] || canonical(packageFromRow(pack.rows[0])) !== canonical(quote.package_config)) changed();
      if ((await client.query('SELECT id FROM public.orders WHERE dispatch_quote_id=$1', [quoteId])).rows[0]) changed();
      await applyPromo(client,userId,snapshot.promo?.code,snapshot,'dispatch',true);
      const schedule = await planSchedule(client, snapshot.city_id, scheduledAt);
      const id = randomUUID();
      const code = generateCode(id);
      const { rows } = await client.query(`INSERT INTO public.orders (id,code,type,customer_id,dispatch_quote_id,payment_method,quote,idempotency_key,scheduled_at,processing_due_at,checkout_scheduled_at)
        VALUES ($1,$2,'dispatch',$3,$4,$5,$6,$7,$8,$9,$8) RETURNING *`, [id, `VD-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`, userId, quoteId, method, JSON.stringify(snapshot), key, schedule.scheduled_at, schedule.processing_due_at]);
      await redeemPromo(client,userId,id,snapshot);
      await client.query('INSERT INTO vendo_internal.dispatch_delivery_codes (order_id,encrypted_code,code_hash) VALUES ($1,$2,$3)', [id, code.encrypted, code.hash]);
      await client.query("INSERT INTO public.order_events (order_id,actor_id,to_status) VALUES ($1,$2,'pending_payment')", [id, userId]);
      return dispatchOrderSchema.parse(serializeOrder(rows[0]!));
    });
  }
  async getCode(userId: string, orderId: string) {
    const { rows } = await this.pool.query<{ encrypted_code: string; payment_status: string; status: string; locked_at: Date | null; consumed_at: Date | null }>(`SELECT d.encrypted_code,d.locked_at,d.consumed_at,o.payment_status,o.status FROM public.orders o
      JOIN vendo_internal.dispatch_delivery_codes d ON d.order_id=o.id JOIN public.profiles p ON p.id=o.customer_id
      WHERE o.id=$1 AND o.customer_id=$2 AND o.type='dispatch' AND p.status='active'`, [orderId, userId]);
    const row = rows[0];
    if (!row) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    if (row.payment_status !== 'paid' || row.locked_at || row.consumed_at || ['cancelled', 'disputed', 'delivered'].includes(row.status)) throw new ApiError(409, 'DELIVERY_CODE_UNAVAILABLE', 'The delivery code is not available for this order now.');
    return row.encrypted_code;
  }
  async complete(riderId: string, orderId: string, hash: string): Promise<'delivered' | 'incorrect' | 'locked'> {
    return this.transaction(async (client) => {
      if (!(await client.query("SELECT id FROM public.profiles WHERE id=$1 AND status='active' AND role='rider' FOR SHARE", [riderId])).rows[0]) throw new ApiError(403, 'FORBIDDEN', 'Active rider access is required.');
      const orders = await client.query<TransitionRow>("SELECT * FROM public.orders WHERE id=$1 AND type='dispatch' AND assigned_rider_id=$2 FOR UPDATE", [orderId, riderId]);
      const order = orders.rows[0];
      if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
      const codes = await client.query<{ code_hash: string; attempts: number; locked_at: Date | null; consumed_at: Date | null }>('SELECT * FROM vendo_internal.dispatch_delivery_codes WHERE order_id=$1 FOR UPDATE', [orderId]);
      const code = codes.rows[0];
      if (!code) throw new ApiError(409, 'DELIVERY_CODE_UNAVAILABLE', 'Delivery code is unavailable.');
      if (code.locked_at || code.attempts >= 3) return 'locked';
      const correct = timingSafeEqual(Buffer.from(code.code_hash, 'hex'), Buffer.from(hash, 'hex'));
      if (order.status === 'delivered' && code.consumed_at && correct) return 'delivered';
      if (order.payment_status !== 'paid' || order.status !== 'on_the_way' || code.consumed_at) throw new ApiError(409, 'INVALID_ORDER_STATE', 'This order is not ready for delivery confirmation.');
      if (!correct) {
        await client.query('UPDATE vendo_internal.dispatch_delivery_codes SET attempts=attempts+1,locked_at=CASE WHEN attempts=2 THEN now() ELSE NULL END WHERE order_id=$1', [orderId]);
        if (code.attempts < 2) return 'incorrect';
        await transition(client, order, 'disputed', riderId, 'delivery_code_locked');
        return 'locked';
      }
      await client.query('UPDATE vendo_internal.dispatch_delivery_codes SET consumed_at=now() WHERE order_id=$1', [orderId]);
      await transition(client, order, 'delivered', riderId, 'delivery_code_verified');
      return 'delivered';
    });
  }
}
