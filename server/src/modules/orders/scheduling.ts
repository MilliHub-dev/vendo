import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import { cityOpen } from '../food/pricing.js';
export async function planSchedule(client: pg.PoolClient, cityId: string, scheduledAt?: string) {
  if (!scheduledAt) return { scheduled_at: null, processing_due_at: null };
  const result = await client.query<{ schedule_min_lead_minutes: number; schedule_max_days: number; schedule_activation_lead_minutes: number }>('SELECT * FROM vendo_internal.city_order_policies WHERE city_id=$1 FOR SHARE', [cityId]);
  const policy = result.rows[0];
  if (!policy) throw new ApiError(503, 'SCHEDULING_NOT_CONFIGURED', 'Scheduling is not configured for this city.');
  const now = (await client.query<{ now: Date }>('SELECT now() AS now')).rows[0]!.now;
  const date = new Date(scheduledAt), delta = date.getTime() - now.getTime();
  if (!Number.isFinite(delta) || delta < policy.schedule_min_lead_minutes*60000 || delta > policy.schedule_max_days*86400000) throw new ApiError(400, 'INVALID_SCHEDULE', 'Choose a time within this city’s scheduling window.');
  const city = (await client.query<{ opens_at: string | null; closes_at: string | null }>('SELECT opens_at,closes_at FROM public.cities WHERE id=$1', [cityId])).rows[0]!;
  if (!cityOpen(city, date)) throw new ApiError(400, 'CITY_CLOSED_AT_SCHEDULE', 'This city is closed at the requested time.');
  return { scheduled_at: date, processing_due_at: new Date(date.getTime()-policy.schedule_activation_lead_minutes*60000) };
}
