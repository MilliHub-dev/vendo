import { z } from 'zod';
import { orderSchema } from '../food/schema.js';
import { dispatchOrderSchema } from '../dispatch/schema.js';
export const anyOrderSchema = z.discriminatedUnion('type', [orderSchema, dispatchOrderSchema]);
export type AnyOrder = z.infer<typeof anyOrderSchema>;
export function serializeOrder(row: Record<string, unknown>): AnyOrder {
  const data = { ...row };
  for (const key of ['created_at','vendor_ready_at','scheduled_at','processing_due_at','picked_up_at','delivered_at','cancelled_at','status_updated_at']) if (data[key] instanceof Date) data[key] = data[key].toISOString();
  return anyOrderSchema.parse(data);
}

import { money, orderStatusSchema } from '../food/schema.js';
export const scheduleSchema = z.iso.datetime({ offset: true });
export const policySchema = z.strictObject({ assigned_cancellation_fee_kobo: money, food_cancel_after_accept: z.boolean(), schedule_min_lead_minutes: z.number().int().min(15).max(1440), schedule_max_days: z.number().int().min(1).max(30), schedule_edit_cutoff_minutes: z.number().int().min(1).max(1440), schedule_activation_lead_minutes: z.number().int().min(1).max(1440), unpaid_timeout_minutes: z.number().int().min(5).max(1440), vendor_timeout_minutes: z.number().int().min(1).max(120), dispute_window_hours: z.number().int().min(1).max(720) }).refine((p) => p.schedule_min_lead_minutes >= p.schedule_activation_lead_minutes && p.schedule_activation_lead_minutes >= p.schedule_edit_cutoff_minutes, 'Invalid scheduling windows.');
export type OrderPolicy = z.infer<typeof policySchema>;
export const eventSchema = z.object({ id: z.uuid(), from_status: orderStatusSchema.nullable(), to_status: orderStatusSchema, reason: z.string().nullable(), created_at: z.string() });
export type OrderEvent = z.infer<typeof eventSchema>;
export const cancellationSchema = z.object({ eligible: z.boolean(), fee_kobo: money, refund_amount_kobo: money, reason: z.string().nullable() });
export type Cancellation = z.infer<typeof cancellationSchema>;
export const disputeInputSchema = z.strictObject({ category: z.enum(['delivery','items','payment','other']), message: z.string().trim().min(10).max(2000) });
export const disputeSchema = disputeInputSchema.extend({ id: z.uuid(), order_id: z.uuid(), status: z.enum(['open','resolved']), resolution: z.string().nullable(), created_at: z.string(), resolved_at: z.string().nullable() });
export type Dispute = z.infer<typeof disputeSchema>;
export const ratingInputSchema = z.strictObject({ service_rating: z.number().int().min(1).max(5), vendor_rating: z.number().int().min(1).max(5).optional(), rider_rating: z.number().int().min(1).max(5).optional(), comment: z.string().trim().max(1000).default('') });
export const ratingSchema = z.object({ id: z.uuid(), order_id: z.uuid(), service_rating: z.number().int(), vendor_rating: z.number().int().nullable(), rider_rating: z.number().int().nullable(), comment: z.string(), created_at: z.string() });
export type Rating = z.infer<typeof ratingSchema>;
export const receiptSchema = z.object({ currency: z.literal('NGN'), order: anyOrderSchema, cancellation_fee_kobo: money, refund: z.object({ id: z.uuid(), amount_kobo: money, status: z.enum(['pending','processed']), created_at: z.string() }).nullable() });
export type Receipt = z.infer<typeof receiptSchema>;
export interface OrderRepository {
  events(userId: string, id: string, limit: number, offset: number): Promise<OrderEvent[]>;
  receipt(userId: string, id: string): Promise<Receipt>;
  cancellation(userId: string, id: string): Promise<Cancellation>;
  cancel(userId: string, id: string, reason: string, acceptedFee: number): Promise<AnyOrder>;
  reschedule(userId: string, id: string, scheduledAt: string): Promise<AnyOrder>;
  dispute(userId: string, id: string, input?: z.infer<typeof disputeInputSchema>): Promise<Dispute | null>;
  resolveDispute(actorId: string, id: string, resolution: string): Promise<Dispute>;
  rating(userId: string, id: string, input?: z.infer<typeof ratingInputSchema>): Promise<Rating | null>;
  savePolicy(actorId: string, cityId: string, input: OrderPolicy): Promise<OrderPolicy>;
  policy(cityId: string): Promise<OrderPolicy | null>;
  riderAction(actorId: string, id: string, action: 'picked_up' | 'on_the_way' | 'delivered'): Promise<AnyOrder>;
  processDue(limit: number): Promise<{ expired: number; activated: number; cancelled: number }>;
}
