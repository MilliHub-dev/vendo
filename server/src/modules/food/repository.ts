import {applyPromo,redeemPromo} from '../promos/pricing.js';
import { transition } from '../orders/transitions.js';
import { planSchedule } from '../orders/scheduling.js';
import { serializeOrder } from '../orders/schema.js';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import { priceCart, cityOpen } from './pricing.js';
import { menuSchema, orderSchema, quoteSnapshotSchema, type Vendor, type MenuItem, type FoodRepository, type VendorSearch, type CityPricing, type QuoteSnapshot, type Quote, type FoodOrder, type vendorInputSchema, type menuInputSchema } from './schema.js';
import type { z } from 'zod';

type VendorRow = Omit<Vendor, 'location'> & { latitude: number; longitude: number; distance_m?: number };
type OrderRow = Omit<FoodOrder, 'created_at' | 'vendor_ready_at' | 'scheduled_at'> & { created_at: Date; vendor_ready_at: Date | null; scheduled_at: Date | null; checkout_scheduled_at: Date | null };
const vendorColumns = 'v.id, v.name, v.category, v.cuisine, v.city_id, v.address, v.latitude, v.longitude, v.is_open, v.is_active, v.image_url, v.prep_minutes, v.rating, v.description, v.logo_url';
function vendor(row: VendorRow): Vendor {
  const { latitude, longitude, ...rest } = row;
  return { ...rest, location: { lat: latitude, lng: longitude } };
}
function menu(row: Record<string, unknown>): MenuItem { return menuSchema.parse({ ...row, price_kobo: Number(row.price_kobo) }); }
function order(row: OrderRow): FoodOrder { return orderSchema.parse(serializeOrder(row)); }
function conflict(message: string): never { throw new ApiError(409, 'CHECKOUT_CHANGED', message); }
const pricingVersion = "md5(concat_ws('|',base_fare_kobo,per_km_rate_kobo,minimum_delivery_fee_kobo,minimum_food_subtotal_kobo,service_polygon::text,opens_at,closes_at,surge_bps))";
function canonical(value: unknown) { return JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item); }

export class PostgresFoodRepository implements FoodRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listVendors(search: VendorSearch) {
    const q = `%${search.q.replace(/[\\%_]/g, '\\$&')}%`;
    const filters = `v.city_id = $1 AND v.is_active AND c.is_active AND ($2::text IS NULL OR v.category = $2)
      AND (v.name ILIKE $3 OR v.cuisine ILIKE $3 OR EXISTS (SELECT 1 FROM public.menu_items m WHERE m.vendor_id = v.id AND m.is_available AND m.name ILIKE $3))`;
    const params = [search.city_id, search.category ?? null, q];
    const count = await this.pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM public.vendors v JOIN public.cities c ON c.id = v.city_id WHERE ${filters}`, params);
    const { rows } = await this.pool.query<VendorRow>(`SELECT ${vendorColumns},
      CASE WHEN $4::double precision IS NULL THEN NULL ELSE
      6371000 * 2 * asin(sqrt(least(1, power(sin(radians(v.latitude - $4) / 2), 2) + cos(radians($4)) * cos(radians(v.latitude)) * power(sin(radians(v.longitude - $5) / 2), 2)))) END AS distance_m
      FROM public.vendors v JOIN public.cities c ON c.id = v.city_id WHERE ${filters}
      ORDER BY distance_m ASC NULLS LAST, v.name, v.id LIMIT $6 OFFSET $7`, [...params, search.lat ?? null, search.lng ?? null, search.limit, search.offset]);
    return { items: rows.map(vendor), total: count.rows[0]!.total };
  }
  async getVendor(id: string) {
    const { rows } = await this.pool.query<VendorRow>(`SELECT ${vendorColumns} FROM public.vendors v JOIN public.cities c ON c.id = v.city_id WHERE v.id = $1 AND v.is_active AND c.is_active`, [id]);
    if (!rows[0]) return null;
    const items = await this.pool.query('SELECT id, vendor_id, name, description, price_kobo, category, is_available, image_url, option_groups FROM public.menu_items WHERE vendor_id = $1 ORDER BY category, name, id', [id]);
    return { vendor: vendor(rows[0]), menu: items.rows.map(menu) };
  }
  async getCity(id: string): Promise<CityPricing | null> {
    const { rows } = await this.pool.query<CityPricing>(`SELECT id, is_active, base_fare_kobo, per_km_rate_kobo, minimum_delivery_fee_kobo,
      minimum_food_subtotal_kobo, service_polygon, opens_at, closes_at, surge_bps, ${pricingVersion} AS pricing_version FROM public.cities WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }
  private async transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  private async requireAdmin(client: pg.PoolClient, actorId: string) {
    const { rows } = await client.query("SELECT id FROM public.profiles WHERE id = $1 AND role = 'admin' AND status = 'active' FOR SHARE", [actorId]);
    if (!rows[0]) throw new ApiError(403, 'FORBIDDEN', 'Administrator access is required.');
  }
  async saveVendor(actorId: string, input: z.infer<typeof vendorInputSchema>, id?: string) {
    return this.transaction(async (client) => {
      await this.requireAdmin(client, actorId);
      if (!(await client.query('SELECT id FROM public.cities WHERE id=$1 FOR SHARE', [input.city_id])).rows[0]) throw new ApiError(400, 'CITY_NOT_FOUND', 'Choose an existing service city.');
      const values = [id ?? randomUUID(), input.name, input.category, input.cuisine, input.city_id, input.address, input.location.lat, input.location.lng, input.is_open, input.is_active, input.image_url, input.prep_minutes];
      const result = id ? await client.query<VendorRow>(`UPDATE public.vendors v SET name=$2, category=$3, cuisine=$4, city_id=$5, address=$6, latitude=$7, longitude=$8, is_open=$9, is_active=$10, image_url=$11, prep_minutes=$12 WHERE id=$1 RETURNING ${vendorColumns}`, values)
        : await client.query<VendorRow>(`INSERT INTO public.vendors AS v (id,name,category,cuisine,city_id,address,latitude,longitude,is_open,is_active,image_url,prep_minutes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${vendorColumns}`, values);
      if (!result.rows[0]) throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found.');
      await client.query('INSERT INTO vendo_internal.catalog_audit (actor_id,action,target_id) VALUES ($1,$2,$3)', [actorId, id ? 'vendor_updated' : 'vendor_created', result.rows[0].id]);
      return vendor(result.rows[0]);
    });
  }
  async saveMenu(actorId: string, vendorId: string, input: z.infer<typeof menuInputSchema>, id?: string) {
    return this.transaction(async (client) => {
      await this.requireAdmin(client, actorId);
      if (!(await client.query('SELECT id FROM public.vendors WHERE id=$1 FOR SHARE', [vendorId])).rows[0]) throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found.');
      const values = [id ?? randomUUID(), vendorId, input.name, input.description, input.price_kobo, input.category, input.is_available, input.image_url, JSON.stringify(input.option_groups)];
      const result = id ? await client.query(`UPDATE public.menu_items SET name=$3, description=$4, price_kobo=$5, category=$6, is_available=$7, image_url=$8, option_groups=$9 WHERE id=$1 AND vendor_id=$2 RETURNING *`, values)
        : await client.query('INSERT INTO public.menu_items (id,vendor_id,name,description,price_kobo,category,is_available,image_url,option_groups) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', values);
      if (!result.rows[0]) throw new ApiError(404, 'ITEM_NOT_FOUND', 'Menu item not found.');
      await client.query('INSERT INTO vendo_internal.catalog_audit (actor_id,action,target_id) VALUES ($1,$2,$3)', [actorId, id ? 'menu_updated' : 'menu_created', result.rows[0].id]);
      return menu(result.rows[0]);
    });
  }
  async assignStaff(actorId: string, vendorId: string, staffId: string) {
    await this.transaction(async (client) => {
      await this.requireAdmin(client, actorId);
      const staff = await client.query("SELECT id FROM public.profiles WHERE id=$1 AND role='vendor_staff' AND status='active' FOR SHARE", [staffId]);
      if (!staff.rows[0]) throw new ApiError(409, 'STAFF_NOT_ELIGIBLE', 'An active vendor staff account is required.');
      if (!(await client.query('SELECT id FROM public.vendors WHERE id=$1', [vendorId])).rows[0]) throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found.');
      await client.query('INSERT INTO vendo_internal.vendor_staff (vendor_id,profile_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [vendorId, staffId]);
      await client.query("INSERT INTO vendo_internal.catalog_audit (actor_id,action,target_id) VALUES ($1,'staff_assigned',$2)", [actorId, vendorId]);
    });
  }
  async saveQuote(userId: string, snapshot: QuoteSnapshot, version: string, promoCode?:string): Promise<Quote> {
    return this.transaction(async client=>{
    snapshot=await applyPromo(client,userId,promoCode,snapshot,'food');
    const { rows } = await client.query<{ id: string; expires_at: Date }>(`INSERT INTO vendo_internal.food_quotes (customer_id,vendor_id,snapshot,pricing_version)
      SELECT $1,$2,$3,$4 FROM public.cities WHERE id=$5 AND is_active AND ${pricingVersion}=$4 RETURNING id,expires_at`, [userId, snapshot.vendor_id, JSON.stringify(snapshot), version, snapshot.city_id]);
    if (!rows[0]) conflict('City pricing changed. Request a new quote.');
    return { ...snapshot, id: rows[0]!.id, expires_at: rows[0]!.expires_at.toISOString(), currency: 'NGN' };
    });
  }
  async createOrder(userId: string, quoteId: string, method: FoodOrder['payment_method'], key: string, scheduledAt?: string) {
    return this.transaction(async (client) => {
      const profile = await client.query("SELECT id FROM public.profiles WHERE id=$1 AND status='active' AND onboarding_step='complete' FOR UPDATE", [userId]);
      if (!profile.rows[0]) throw new ApiError(403, 'ONBOARDING_REQUIRED', 'Complete your active account profile before ordering.');
      const existing = await client.query<OrderRow>('SELECT * FROM public.orders WHERE customer_id=$1 AND idempotency_key=$2', [userId, key]);
      if (existing.rows[0]) {
        const row = existing.rows[0] as OrderRow & { quote_id: string };
        if (row.type !== 'food' || row.quote_id !== quoteId || row.payment_method !== method || (row.checkout_scheduled_at?.toISOString() ?? null) !== (scheduledAt ? new Date(scheduledAt).toISOString() : null)) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This request key was already used for a different checkout.');
        return order(row);
      }
      const quotes = await client.query<{ vendor_id: string; snapshot: QuoteSnapshot }>('SELECT vendor_id,snapshot FROM vendo_internal.food_quotes WHERE id=$1 AND customer_id=$2 AND expires_at>now() FOR UPDATE', [quoteId, userId]);
      if (!quotes.rows[0]) throw new ApiError(409, 'QUOTE_UNAVAILABLE', 'The quote expired or is unavailable. Request a new quote.');
      const snapshot = quoteSnapshotSchema.parse(quotes.rows[0].snapshot);
      const vendors = await client.query<VendorRow>('SELECT * FROM public.vendors WHERE id=$1 AND is_open AND is_active FOR SHARE', [snapshot.vendor_id]);
      const city = await client.query<CityPricing>('SELECT * FROM public.cities WHERE id=$1 AND is_active FOR SHARE', [snapshot.city_id]);
      if (!vendors.rows[0] || !city.rows[0] || !cityOpen(city.rows[0])) conflict('The vendor or city is no longer accepting orders.');
      const v = vendors.rows[0];
      if (v.city_id !== snapshot.city_id || v.latitude !== snapshot.pickup.lat || v.longitude !== snapshot.pickup.lng || v.name !== snapshot.vendor_name || v.address !== snapshot.pickup.address) conflict('Vendor details changed. Request a new quote.');
      const items = await client.query('SELECT * FROM public.menu_items WHERE vendor_id=$1 ORDER BY id FOR SHARE', [snapshot.vendor_id]);
      const repriced = priceCart({ vendor_id: snapshot.vendor_id, items: snapshot.items.map((item) => ({ menu_item_id: item.menu_item_id, quantity: item.quantity, option_ids: item.options.map((option) => option.id), note: item.note })) }, items.rows.map(menu));
      if (canonical(repriced.items) !== canonical(snapshot.items)) conflict('Menu prices or options changed. Request a new quote.');
      // Quotes also snapshot city configuration; compare the current fingerprint before charging later.
      const fingerprint = await client.query<{ pricing_version: string }>('SELECT pricing_version FROM vendo_internal.food_quotes WHERE id=$1', [quoteId]);
      const current = await client.query<{ version: string }>("SELECT md5(concat_ws('|',base_fare_kobo,per_km_rate_kobo,minimum_delivery_fee_kobo,minimum_food_subtotal_kobo,service_polygon::text,opens_at,closes_at,surge_bps)) AS version FROM public.cities WHERE id=$1", [snapshot.city_id]);
      if (fingerprint.rows[0]?.pricing_version !== current.rows[0]?.version) conflict('Delivery pricing or service area changed. Request a new quote.');
      if ((await client.query('SELECT id FROM public.orders WHERE quote_id=$1', [quoteId])).rows[0]) conflict('This quote has already been used.');
      await applyPromo(client,userId,snapshot.promo?.code,snapshot,'food',true);
      const schedule = await planSchedule(client, snapshot.city_id, scheduledAt);
      const created = await client.query<OrderRow>(`INSERT INTO public.orders (code,customer_id,vendor_id,quote_id,payment_method,quote,idempotency_key,scheduled_at,processing_due_at,checkout_scheduled_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$8) RETURNING *`, [`VD-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`, userId, snapshot.vendor_id, quoteId, method, JSON.stringify(snapshot), key, schedule.scheduled_at, schedule.processing_due_at]);
      await redeemPromo(client,userId,created.rows[0]!.id,snapshot);
      await client.query("INSERT INTO public.order_events (order_id,actor_id,to_status) VALUES ($1,$2,'pending_payment')", [created.rows[0]!.id, userId]);
      return order(created.rows[0]!);
    });
  }
  async listOrders(userId: string, filter: 'active' | 'past', limit: number, offset: number) {
    const { rows } = await this.pool.query<OrderRow>(`SELECT * FROM public.orders WHERE customer_id=$1 AND
      CASE WHEN $2='past' THEN status IN ('delivered','cancelled') ELSE status NOT IN ('delivered','cancelled') END
      ORDER BY created_at DESC,id LIMIT $3 OFFSET $4`, [userId, filter, limit, offset]);
    return rows.map((row) => serializeOrder(row));
  }
  async getOrder(userId: string, id: string) {
    const { rows } = await this.pool.query<OrderRow>('SELECT * FROM public.orders WHERE id=$1 AND customer_id=$2', [id, userId]);
    return rows[0] ? serializeOrder(rows[0]) : null;
  }
  async vendorAction(actorId: string, id: string, action: 'accept' | 'reject' | 'ready') {
    return this.transaction(async (client) => {
      const actor = await client.query<{ role: string }>("SELECT role FROM public.profiles WHERE id=$1 AND status='active' FOR SHARE", [actorId]);
      if (!actor.rows[0] || !['admin', 'vendor_staff'].includes(actor.rows[0].role)) throw new ApiError(403, 'FORBIDDEN', 'Vendor staff access is required.');
      const result = await client.query<OrderRow & { vendor_id: string }>("SELECT * FROM public.orders WHERE id=$1 AND type='food' FOR UPDATE", [id]);
      const row = result.rows[0];
      if (!row) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
      if (actor.rows[0].role !== 'admin' && !(await client.query('SELECT 1 FROM vendo_internal.vendor_staff WHERE vendor_id=$1 AND profile_id=$2', [row.vendor_id, actorId])).rows[0]) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
      if (row.payment_status !== 'paid') throw new ApiError(409, 'PAYMENT_REQUIRED', 'Payment must be verified before vendor fulfillment.');
      if (action === 'ready') {
        if (!['searching_rider', 'rider_assigned'].includes(row.status)) conflict('The order cannot be marked ready in its current state.');
        if (row.vendor_ready_at) return order(row);
        const ready = await client.query<OrderRow>('UPDATE public.orders SET vendor_ready_at=COALESCE(vendor_ready_at,now()) WHERE id=$1 RETURNING *', [id]);
        await client.query("INSERT INTO vendo_internal.catalog_audit (actor_id,action,target_id) VALUES ($1,'order_ready',$2)", [actorId, id]);
        return order(ready.rows[0]!);
      }
      const target = action === 'accept' ? 'searching_rider' : 'cancelled';
      if (row.status === target) return order(row);
      if (row.status !== 'awaiting_vendor') conflict('The order cannot be confirmed in its current state.');
      await transition(client, row, target, actorId, action === 'reject' ? 'vendor_rejected' : 'vendor_accepted');
      const updated = await client.query<OrderRow>('SELECT * FROM public.orders WHERE id=$1', [id]);
      return order(updated.rows[0]!);
    });
  }
}
