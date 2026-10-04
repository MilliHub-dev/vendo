import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import type { orderStatusSchema } from '../food/schema.js';
import type { z } from 'zod';
type Status = z.infer<typeof orderStatusSchema>;
export type TransitionRow = { id: string; type: string; status: Status; payment_status: string; quote: { total_kobo: number }; assigned_rider_id?: string | null; vendor_ready_at?: Date | null; scheduled_at?: Date | null };
const allowed: Record<Status, Status[]> = {
  pending_payment: ['scheduled','awaiting_vendor','searching_rider','cancelled'], scheduled: ['awaiting_vendor','searching_rider','cancelled'],
  awaiting_vendor: ['searching_rider','cancelled'], searching_rider: ['rider_assigned','cancelled'], rider_assigned: ['picked_up','cancelled'],
  picked_up: ['on_the_way','disputed'], on_the_way: ['delivered','disputed'], delivered: [], cancelled: [], disputed: [],
};
export async function transition(client: pg.PoolClient, row: TransitionRow, target: Status, actorId: string, reason: string | null = null, fee = 0) {
  if (row.status !== target && !allowed[row.status].includes(target)) throw new ApiError(409, 'INVALID_ORDER_STATE', 'This order cannot move to the requested state.');
  if (target !== 'cancelled' && row.payment_status !== 'paid') throw new ApiError(409, 'PAYMENT_REQUIRED', 'Verified payment is required for fulfillment.');
  if ((target === 'awaiting_vendor' && row.type !== 'food') || (target === 'searching_rider' && row.type === 'food' && !['awaiting_vendor','searching_rider'].includes(row.status)) || (target === 'scheduled' && !row.scheduled_at)) throw new ApiError(409, 'INVALID_ORDER_STATE', 'This transition is not valid for this order type.');
  if (row.status === 'pending_payment' && row.scheduled_at && target !== 'scheduled' && target !== 'cancelled') throw new ApiError(409, 'SCHEDULE_REQUIRED', 'Scheduled orders must wait for their fulfillment window.');
  if (['rider_assigned','picked_up','on_the_way','delivered'].includes(target) && !row.assigned_rider_id) throw new ApiError(409, 'RIDER_REQUIRED', 'A trusted rider assignment is required.');
  if (target === 'picked_up' && row.type === 'food' && !row.vendor_ready_at) throw new ApiError(409, 'VENDOR_NOT_READY', 'The vendor must mark the order ready before pickup.');
  if (!Number.isSafeInteger(fee) || fee < 0 || fee > row.quote.total_kobo) throw new ApiError(409, 'INVALID_CANCELLATION_FEE', 'The cancellation fee is invalid.');
  if (row.status === target) return;
  await client.query(`UPDATE public.orders SET status=$2,
    picked_up_at=CASE WHEN $2='picked_up' THEN now() ELSE picked_up_at END,
    delivered_at=CASE WHEN $2='delivered' THEN now() ELSE delivered_at END,
    cancelled_at=CASE WHEN $2='cancelled' THEN now() ELSE cancelled_at END,
    cancellation_fee_kobo=CASE WHEN $2='cancelled' THEN $3 ELSE cancellation_fee_kobo END,
    refund_status=CASE WHEN $2='cancelled' AND payment_status='paid' AND ($4::bigint-$3::bigint)>0 THEN 'pending' ELSE refund_status END WHERE id=$1`, [row.id, target, fee, row.quote.total_kobo]);
  if (target === 'cancelled' && row.payment_status === 'paid' && row.quote.total_kobo > fee) await client.query('INSERT INTO vendo_internal.order_refunds (order_id,amount_kobo) VALUES ($1,$2) ON CONFLICT(order_id) DO NOTHING', [row.id, row.quote.total_kobo-fee]);
  await client.query('INSERT INTO public.order_events (order_id,actor_id,from_status,to_status,reason) VALUES ($1,$2,$3,$4,$5)', [row.id, actorId, row.status, target, reason]);
}
