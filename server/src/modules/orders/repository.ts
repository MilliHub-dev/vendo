import type pg from 'pg';
import type { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { cityOpen } from '../food/pricing.js';
import { transition, type TransitionRow } from './transitions.js';
import { planSchedule } from './scheduling.js';
import { serializeOrder, policySchema, eventSchema, disputeSchema, ratingSchema, type OrderRepository, type OrderPolicy, type Cancellation, type disputeInputSchema, type ratingInputSchema } from './schema.js';
type Row = TransitionRow & Record<string, unknown> & { customer_id: string; vendor_id: string | null; quote: TransitionRow['quote'] & { city_id: string }; scheduled_at: Date | null; delivered_at: Date | null; cancelled_at: Date | null };
const policyFromRow = (row: Record<string, unknown>) => policySchema.strip().parse({ ...row, assigned_cancellation_fee_kobo: Number(row.assigned_cancellation_fee_kobo) });
function disputeFromRow(row: Record<string, unknown>) { return disputeSchema.strip().parse({ ...row, created_at: (row.created_at as Date).toISOString(), resolved_at: (row.resolved_at as Date | null)?.toISOString() ?? null }); }
function ratingFromRow(row: Record<string, unknown>) { return ratingSchema.parse({ ...row, created_at: (row.created_at as Date).toISOString() }); }
export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly pool: pg.Pool) {}
  private async transaction<T>(work: (client: pg.PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  private async actor(client: pg.PoolClient, id: string, role?: string) {
    const row = (await client.query<{ role: string }>("SELECT role FROM public.profiles WHERE id=$1 AND status='active' FOR SHARE", [id])).rows[0];
    if (!row || (role && row.role !== role)) throw new ApiError(403, 'FORBIDDEN', 'This account cannot perform this action.');
  }
  private async own(client: pg.PoolClient, userId: string, id: string) {
    await this.actor(client, userId);
    const row = (await client.query<Row>('SELECT * FROM public.orders WHERE id=$1 AND customer_id=$2 FOR UPDATE', [id, userId])).rows[0];
    if (!row) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.'); return row;
  }
  async policy(cityId: string) { const row = (await this.pool.query('SELECT * FROM vendo_internal.city_order_policies WHERE city_id=$1', [cityId])).rows[0]; return row ? policyFromRow(row) : null; }
  async savePolicy(actorId: string, cityId: string, input: OrderPolicy) {
    return this.transaction(async (client) => {
      await this.actor(client, actorId, 'admin');
      if (!(await client.query('SELECT id FROM public.cities WHERE id=$1 FOR SHARE', [cityId])).rows[0]) throw new ApiError(404, 'CITY_NOT_FOUND', 'City not found.');
      const keys = Object.keys(policySchema.shape), values = keys.map((key) => input[key as keyof OrderPolicy]);
      const { rows } = await client.query(`INSERT INTO vendo_internal.city_order_policies (city_id,${keys.join(',')}) VALUES ($1,${keys.map((_,i) => `$${i+2}`).join(',')})
        ON CONFLICT(city_id) DO UPDATE SET ${keys.map((key) => `${key}=EXCLUDED.${key}`).join(',')} RETURNING *`, [cityId, ...values]);
      await client.query("INSERT INTO vendo_internal.catalog_audit (actor_id,action,target_id) VALUES ($1,'order_policy_updated',$2)", [actorId, cityId]);
      return policyFromRow(rows[0]!);
    });
  }
  async events(userId: string, id: string, limit: number, offset: number) {
    return this.transaction(async (client) => {
      await this.own(client, userId, id);
      const { rows } = await client.query('SELECT id,from_status,to_status,reason,created_at FROM public.order_events WHERE order_id=$1 ORDER BY created_at,id LIMIT $2 OFFSET $3', [id, limit, offset]);
      return rows.map((row) => eventSchema.parse({ ...row, created_at: row.created_at.toISOString() }));
    });
  }
  async receipt(userId: string, id: string) {
    return this.transaction(async (client) => {
      const row = await this.own(client, userId, id);
      if (row.payment_status !== 'paid') throw new ApiError(409, 'PAYMENT_REQUIRED', 'A receipt is available after verified payment.');
      const refund = (await client.query('SELECT id,amount_kobo,status,created_at FROM vendo_internal.order_refunds WHERE order_id=$1', [id])).rows[0];
      return { currency: 'NGN' as const, order: serializeOrder(row), cancellation_fee_kobo: Number(row.cancellation_fee_kobo), refund: refund ? { id: refund.id as string, amount_kobo: Number(refund.amount_kobo), status: refund.status as 'pending' | 'processed', created_at: (refund.created_at as Date).toISOString() } : null };
    });
  }
  private async cancellationFor(client: pg.PoolClient, row: Row): Promise<Cancellation> {
    const deny = (reason: string) => ({ eligible: false, fee_kobo: 0, refund_amount_kobo: 0, reason });
    if (!['pending_payment','scheduled','awaiting_vendor','searching_rider','rider_assigned'].includes(row.status)) return deny('CANCELLATION_NOT_ALLOWED');
    if (row.payment_status !== 'paid') return { eligible: true, fee_kobo: 0, refund_amount_kobo: 0, reason: null };
    const policies = await client.query('SELECT * FROM vendo_internal.city_order_policies WHERE city_id=$1 FOR SHARE', [row.quote.city_id]);
    const policy = policies.rows[0] ? policyFromRow(policies.rows[0]) : null;
    if (row.scheduled_at) {
      if (!policy) return deny('ORDER_POLICY_NOT_CONFIGURED');
      const now = (await client.query<{ now: Date }>('SELECT now() AS now')).rows[0]!.now;
      if (row.scheduled_at.getTime()-now.getTime() <= policy.schedule_edit_cutoff_minutes*60000) return deny('SCHEDULE_CUTOFF_REACHED');
    }
    if (row.type==='food' && ['searching_rider','rider_assigned'].includes(row.status) && !policy?.food_cancel_after_accept) return deny('FOOD_ALREADY_ACCEPTED');
    if (row.status==='rider_assigned' && !policy) return deny('ORDER_POLICY_NOT_CONFIGURED');
    const fee = row.status==='rider_assigned' ? Math.min(policy!.assigned_cancellation_fee_kobo, row.quote.total_kobo) : 0;
    return { eligible: true, fee_kobo: fee, refund_amount_kobo: row.quote.total_kobo-fee, reason: null };
  }
  async cancellation(userId: string, id: string) { return this.transaction(async (client) => this.cancellationFor(client, await this.own(client,userId,id))); }
  async cancel(userId: string, id: string, reason: string, acceptedFee: number) {
    return this.transaction(async (client) => {
      const row = await this.own(client,userId,id);
      if (row.status==='cancelled') return serializeOrder(row);
      const review = await this.cancellationFor(client,row);
      if (!review.eligible) throw new ApiError(409, review.reason!, 'This order cannot be cancelled now. Contact support.');
      if (acceptedFee !== review.fee_kobo) throw new ApiError(409, 'CANCELLATION_FEE_CHANGED', 'Review and accept the current cancellation fee.');
      await transition(client,row,'cancelled',userId,'customer_cancelled',review.fee_kobo);
      await client.query('UPDATE public.orders SET cancellation_reason=$2 WHERE id=$1',[id,reason]);
      return serializeOrder((await client.query('SELECT * FROM public.orders WHERE id=$1',[id])).rows[0]!);
    });
  }
  async reschedule(userId: string,id: string,scheduledAt: string) {
    return this.transaction(async (client) => {
      const row = await this.own(client,userId,id);
      if (!row.scheduled_at || !['pending_payment','scheduled'].includes(row.status)) throw new ApiError(409,'INVALID_ORDER_STATE','Only waiting scheduled orders can be rescheduled.');
      const policy = (await client.query('SELECT * FROM vendo_internal.city_order_policies WHERE city_id=$1 FOR SHARE',[row.quote.city_id])).rows[0];
      if (!policy) throw new ApiError(503,'SCHEDULING_NOT_CONFIGURED','Scheduling is not configured.');
      const now = (await client.query<{ now: Date }>('SELECT now() AS now')).rows[0]!.now;
      if (row.scheduled_at.getTime()-now.getTime() <= Number(policy.schedule_edit_cutoff_minutes)*60000) throw new ApiError(409,'SCHEDULE_CUTOFF_REACHED','This order is too close to its scheduled time.');
      const city = (await client.query<{ is_active: boolean }>('SELECT is_active FROM public.cities WHERE id=$1 FOR SHARE',[row.quote.city_id])).rows[0];
      if (!city?.is_active) throw new ApiError(409,'CITY_UNAVAILABLE','This city is unavailable.');
      const schedule = await planSchedule(client,row.quote.city_id,scheduledAt);
      if (row.scheduled_at.toISOString() === schedule.scheduled_at!.toISOString()) return serializeOrder(row);
      await client.query('UPDATE public.orders SET scheduled_at=$2,processing_due_at=$3 WHERE id=$1',[id,schedule.scheduled_at,schedule.processing_due_at]);
      await client.query("INSERT INTO public.order_events(order_id,actor_id,from_status,to_status,reason) VALUES($1,$2,$3,$3,'customer_rescheduled')",[id,userId,row.status]);
      return serializeOrder((await client.query('SELECT * FROM public.orders WHERE id=$1',[id])).rows[0]!);
    });
  }
  async dispute(userId: string,id: string,input?: z.infer<typeof disputeInputSchema>) {
    return this.transaction(async (client) => {
      const row = await this.own(client,userId,id);
      const existing = (await client.query('SELECT * FROM public.order_disputes WHERE order_id=$1',[id])).rows[0];
      if (!input) return existing ? disputeFromRow(existing) : null;
      if (existing) { if (existing.category!==input.category || existing.message!==input.message) throw new ApiError(409,'DISPUTE_EXISTS','A dispute already exists for this order.'); return disputeFromRow(existing); }
      if (row.payment_status!=='paid' && input.category!=='payment') throw new ApiError(409,'PAYMENT_REQUIRED','Only paid orders can have delivery/item disputes.');
      const completedAt = row.delivered_at ?? row.cancelled_at;
      if (completedAt) {
        const policy = (await client.query('SELECT * FROM vendo_internal.city_order_policies WHERE city_id=$1 FOR SHARE',[row.quote.city_id])).rows[0];
        if (!policy) throw new ApiError(503,'ORDER_POLICY_NOT_CONFIGURED','The dispute window is not configured.');
        const now = (await client.query<{ now: Date }>('SELECT now() AS now')).rows[0]!.now;
        if (now.getTime()-completedAt.getTime()>Number(policy.dispute_window_hours)*3600000) throw new ApiError(409,'DISPUTE_WINDOW_CLOSED','The dispute window has closed. Contact support.');
      }
      const saved = (await client.query('INSERT INTO public.order_disputes(order_id,customer_id,category,message) VALUES($1,$2,$3,$4) RETURNING *',[id,userId,input.category,input.message])).rows[0]!;
      if (['picked_up','on_the_way'].includes(row.status)) await transition(client,row,'disputed',userId,'customer_dispute');
      return disputeFromRow(saved);
    });
  }
  async resolveDispute(actorId: string,id: string,resolution: string) {
    return this.transaction(async (client) => {
      await this.actor(client,actorId,'admin');
      if (!(await client.query('SELECT id FROM public.orders WHERE id=$1 FOR UPDATE',[id])).rows[0]) throw new ApiError(404,'ORDER_NOT_FOUND','Order not found.');
      const existing = (await client.query('SELECT * FROM public.order_disputes WHERE order_id=$1 FOR UPDATE',[id])).rows[0];
      if (!existing) throw new ApiError(404,'DISPUTE_NOT_FOUND','Dispute not found.');
      if (existing.status==='resolved') { if(existing.resolution!==resolution) throw new ApiError(409,'DISPUTE_RESOLVED','This dispute is already resolved.'); return disputeFromRow(existing); }
      const saved = (await client.query("UPDATE public.order_disputes SET status='resolved',resolution=$2,resolved_at=now() WHERE order_id=$1 RETURNING *",[id,resolution])).rows[0]!;
      await client.query("INSERT INTO vendo_internal.catalog_audit(actor_id,action,target_id) VALUES($1,'dispute_resolved',$2)",[actorId,id]);
      return disputeFromRow(saved);
    });
  }
  async rating(userId: string,id: string,input?: z.infer<typeof ratingInputSchema>) {
    return this.transaction(async (client) => {
      const row = await this.own(client,userId,id);
      const existing = (await client.query('SELECT * FROM public.order_ratings WHERE order_id=$1',[id])).rows[0];
      if (!input) return existing ? ratingFromRow(existing) : null;
      if (row.status!=='delivered' || row.payment_status!=='paid' || row.refund_status==='pending' || (await client.query("SELECT id FROM public.order_disputes WHERE order_id=$1 AND status='open'",[id])).rows[0]) throw new ApiError(409,'RATING_NOT_ALLOWED','Only delivered, paid orders without unresolved disputes can be rated.');
      if ((input.vendor_rating!==undefined && row.type!=='food') || (input.rider_rating!==undefined && !row.assigned_rider_id)) throw new ApiError(400,'INVALID_RATING_TARGET','The order does not have the selected rating target.');
      if (existing) { if(existing.service_rating!==input.service_rating || existing.vendor_rating!==(input.vendor_rating??null) || existing.rider_rating!==(input.rider_rating??null) || existing.comment!==input.comment) throw new ApiError(409,'RATING_EXISTS','This order was already rated.'); return ratingFromRow(existing); }
      if (input.vendor_rating!==undefined) await client.query('SELECT id FROM public.vendors WHERE id=$1 FOR UPDATE',[row.vendor_id]);
      const saved = (await client.query('INSERT INTO public.order_ratings(order_id,customer_id,service_rating,vendor_rating,rider_rating,comment) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[id,userId,input.service_rating,input.vendor_rating??null,input.rider_rating??null,input.comment])).rows[0]!;
      if(input.vendor_rating!==undefined) await client.query(`UPDATE public.vendors SET rating=(SELECT avg(r.vendor_rating)::double precision FROM public.order_ratings r JOIN public.orders o ON o.id=r.order_id WHERE o.vendor_id=$1 AND r.vendor_rating IS NOT NULL) WHERE id=$1`,[row.vendor_id]);
      return ratingFromRow(saved);
    });
  }
  async riderAction(actorId: string,id: string,action: 'picked_up'|'on_the_way'|'delivered') {
    return this.transaction(async (client) => {
      await this.actor(client,actorId,'rider');
      const row = (await client.query<Row>('SELECT * FROM public.orders WHERE id=$1 AND assigned_rider_id=$2 FOR UPDATE',[id,actorId])).rows[0];
      if (!row) throw new ApiError(404,'ORDER_NOT_FOUND','Order not found.');
      if (action==='delivered' && row.type==='dispatch') throw new ApiError(409,'DELIVERY_CODE_REQUIRED','Confirm Dispatch delivery with the handover code endpoint.');
      await transition(client,row,action,actorId,'rider_update');
      return serializeOrder((await client.query('SELECT * FROM public.orders WHERE id=$1',[id])).rows[0]!);
    });
  }
  async processDue(limit: number) {
    return this.transaction(async (client) => {
      const { rows } = await client.query<Row>(`SELECT o.* FROM public.orders o JOIN vendo_internal.city_order_policies p ON p.city_id=(o.quote->>'city_id')::uuid
        WHERE (o.status='pending_payment' AND o.created_at+make_interval(mins=>p.unpaid_timeout_minutes)<=now()) OR
          (o.status='awaiting_vendor' AND o.payment_status='paid' AND o.status_updated_at+make_interval(mins=>p.vendor_timeout_minutes)<=now()) OR
          (o.status='scheduled' AND o.payment_status='paid' AND o.processing_due_at<=now())
        ORDER BY o.created_at,o.id LIMIT $1 FOR UPDATE OF o SKIP LOCKED`,[limit]);
      const result = { expired: 0, activated: 0, cancelled: 0 };
      for (const row of rows) {
        if (row.status==='pending_payment') { if(row.payment_status!=='unpaid') continue; await transition(client,row,'cancelled',row.customer_id,'unpaid_expired'); result.expired++; continue; }
        if (row.status==='awaiting_vendor') { await transition(client,row,'cancelled',row.customer_id,'vendor_timeout'); result.cancelled++; continue; }
        const city = (await client.query<{ is_active: boolean; opens_at: string|null; closes_at: string|null }>('SELECT is_active,opens_at,closes_at FROM public.cities WHERE id=$1 FOR SHARE',[row.quote.city_id])).rows[0];
        const vendor = row.type==='food' ? (await client.query<{ is_active: boolean; is_open: boolean }>('SELECT is_active,is_open FROM public.vendors WHERE id=$1 FOR SHARE',[row.vendor_id])).rows[0] : null;
        if (!city?.is_active || !cityOpen(city) || (row.type==='food' && (!vendor?.is_active || !vendor.is_open))) { await transition(client,row,'cancelled',row.customer_id,'scheduled_unavailable'); result.cancelled++; continue; }
        await transition(client,row,row.type==='food'?'awaiting_vendor':'searching_rider',row.customer_id,'schedule_released'); result.activated++;
      }
      return result;
    });
  }
}
