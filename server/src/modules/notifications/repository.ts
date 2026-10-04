import { createHash } from 'node:crypto';
import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import { actor, audit } from '../../lib/postgres.js';
import type { adminPushInput } from './schema.js';
import { deviceSchema, notificationSchema, type NotificationRepository, type DeliveryJob, type DeliveryTarget, type deviceInput } from './schema.js';
import type { z } from 'zod';
const serialize = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]));
export class PostgresNotificationRepository implements NotificationRepository {
    constructor(private readonly pool: pg.Pool) { }
    async sendAdminPush(admin: string, input: z.infer<typeof adminPushInput>, key: string) {
        return this.transaction(async c => {
            await actor(c, admin, 'admin');
            const dedupe = `admin_push:${admin}:${key}`, recipients = input.profile_ids.map(id => id.toLowerCase()).sort();
            await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [dedupe]);
            let rows = (await c.query('SELECT id,profile_id,title,body FROM public.notifications WHERE dedupe_key=$1 ORDER BY profile_id', [dedupe])).rows;
            if (rows.length) {
                if (JSON.stringify(rows.map(r => r.profile_id)) !== JSON.stringify(recipients) || rows.some(r => r.title !== input.title || r.body !== input.body)) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This key was used for a different notification.');
            } else {
                const active = (await c.query("SELECT id FROM public.profiles WHERE id=ANY($1::uuid[]) AND status='active' ORDER BY id FOR SHARE", [recipients])).rows;
                if (active.length !== recipients.length) throw new ApiError(400, 'INVALID_RECIPIENTS', 'Recipients must be active accounts.');
                rows = (await c.query("INSERT INTO public.notifications(profile_id,dedupe_key,kind,title,body) SELECT id,$2,'admin_push',$3,$4 FROM public.profiles WHERE id=ANY($1::uuid[]) RETURNING id,profile_id,title,body", [recipients, dedupe, input.title, input.body])).rows.sort((a, b) => String(a.profile_id).localeCompare(String(b.profile_id)));
                await c.query("INSERT INTO vendo_internal.notification_outbox(notification_id,channel,device_id,target_key) SELECT n.id,'push',d.id,d.id::text FROM public.notifications n JOIN vendo_internal.devices d ON d.profile_id=n.profile_id LEFT JOIN public.account_preferences p ON p.profile_id=n.profile_id WHERE n.dedupe_key=$1 AND COALESCE(p.push_enabled,true)", [dedupe]);
                await audit(c, admin, 'admin_push_queued', rows[0]!.id);
            }
            const ids = rows.map(r => String(r.id));
            const count = (await c.query('SELECT count(*)::int AS n FROM vendo_internal.notification_outbox WHERE notification_id=ANY($1::uuid[]) AND channel=\'push\'', [ids])).rows[0]!.n;
            return { notification_ids: ids, recipients: rows.length, queued_pushes: Number(count) };
        });
    }
    private async transaction<T>(work: (c: pg.PoolClient) => Promise<T>): Promise<T> { const c = await this.pool.connect(); try {
        await c.query('BEGIN');
        const result = await work(c);
        await c.query('COMMIT');
        return result;
    }
    catch (e) {
        await c.query('ROLLBACK');
        throw e;
    }
    finally {
        c.release();
    } }
    async inbox(user: string, limit: number, offset: number) { const rows = await this.pool.query(`SELECT n.* FROM public.notifications n JOIN public.profiles p ON p.id=n.profile_id WHERE profile_id=$1 AND p.status='active' ORDER BY n.created_at DESC,n.id DESC LIMIT $2 OFFSET $3`, [user, limit, offset]); const count = await this.pool.query<{
        n: number;
    }>("SELECT count(*)::int AS n FROM public.notifications WHERE profile_id=$1 AND read_at IS NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=$1 AND status='active')", [user]); return { items: rows.rows.map(r => notificationSchema.parse(serialize(r))), unread: count.rows[0]!.n }; }
    async read(user: string, id?: string) { const result = await this.pool.query(`UPDATE public.notifications SET read_at=COALESCE(read_at,now()) WHERE profile_id=$1 AND ($2::uuid IS NULL OR id=$2) AND EXISTS(SELECT 1 FROM public.profiles WHERE id=$1 AND status='active') RETURNING id`, [user, id ?? null]); if (id && !result.rows[0])
        throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.'); }
    async devices(user: string) { return (await this.pool.query("SELECT d.* FROM vendo_internal.devices d JOIN public.profiles p ON p.id=d.profile_id WHERE profile_id=$1 AND p.status='active' ORDER BY d.created_at,d.id", [user])).rows.map(r => deviceSchema.parse(serialize(r))); }
    async register(user: string, input: z.infer<typeof deviceInput>) {
        return this.transaction(async (c) => {
            if (!(await c.query("SELECT id FROM public.profiles WHERE id=$1 AND status='active' FOR UPDATE", [user])).rows[0])
                throw new ApiError(403, 'ACCOUNT_INACTIVE', 'Active account required.');
            const hash = createHash('sha256').update(input.token).digest('hex');
            // Global token lock closes ownership races across different account profile locks.
            await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [hash]);
            const existing = (await c.query('SELECT * FROM vendo_internal.devices WHERE token_hash=$1', [hash])).rows[0];
            if (existing && existing.profile_id !== user)
                throw new ApiError(409, 'DEVICE_ALREADY_REGISTERED', 'Remove this device from its previous account first.');
            const count = (await c.query<{
                n: number;
            }>('SELECT count(*)::int AS n FROM vendo_internal.devices WHERE profile_id=$1', [user])).rows[0]!.n;
            if (!existing && count >= 10)
                throw new ApiError(409, 'DEVICE_LIMIT', 'Remove an unused device before registering another.');
            const { rows } = await c.query('INSERT INTO vendo_internal.devices(profile_id,token,token_hash,platform) VALUES ($1,$2,$3,$4) ON CONFLICT(token_hash) DO UPDATE SET token=EXCLUDED.token,platform=EXCLUDED.platform,updated_at=now() RETURNING *', [user, input.token, hash, input.platform]);
            return deviceSchema.parse(serialize(rows[0]));
        });
    }
    async remove(user: string, id: string) { if (!(await this.pool.query('DELETE FROM vendo_internal.devices WHERE id=$1 AND profile_id=$2 RETURNING id', [id, user])).rows[0])
        throw new ApiError(404, 'DEVICE_NOT_FOUND', 'Device not found.'); }
    async reminders(limit: number, minutes: number) {
        const candidates = await this.pool.query<{
            id: string;
            customer_id: string;
            scheduled_at: Date;
        }>(`SELECT o.id,o.customer_id,o.scheduled_at FROM public.orders o WHERE payment_status='paid' AND status='scheduled' AND scheduled_at>now() AND scheduled_at<=now()+$1*interval '1 minute'
  AND NOT EXISTS(SELECT 1 FROM public.notifications WHERE profile_id=o.customer_id AND dedupe_key='reminder:'||o.id||':'||o.scheduled_at::text) ORDER BY scheduled_at,id LIMIT $2`, [minutes, limit]);
        for (const o of candidates.rows)
            await this.pool.query(`SELECT vendo_internal.notify(customer_id,'reminder:'||id||':'||scheduled_at::text,'reminder','Scheduled delivery reminder','Your scheduled delivery is coming up. Open Vendo for details.',id,scheduled_at) FROM public.orders WHERE id=$1 AND status='scheduled' AND payment_status='paid' AND scheduled_at=$2`, [o.id, o.scheduled_at]);
        return candidates.rows.length;
    }
    async claim(limit: number) {
        return this.transaction(async (c) => {
            // Finalize exhausted leases separately so abandoned attempt five does not stay stuck.
            await c.query("UPDATE vendo_internal.notification_outbox SET status='failed',lease_id=NULL,lease_until=NULL,last_error='lease_exhausted' WHERE status='sending' AND lease_until<now() AND attempts>=5");
            const { rows } = await c.query<DeliveryJob>(`WITH due AS (SELECT q.id FROM vendo_internal.notification_outbox q JOIN public.notifications n ON n.id=q.notification_id WHERE q.attempts<5 AND ((q.status='pending' AND q.available_at<=now()) OR (q.status='sending' AND q.lease_until<now())) ORDER BY (n.kind IN('rider_offer','vendor_order') AND q.channel='push') DESC,(q.channel='push') DESC,n.expires_at ASC NULLS LAST,q.available_at,q.id LIMIT $1 FOR UPDATE OF q SKIP LOCKED)
   UPDATE vendo_internal.notification_outbox q SET status='sending',attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '60 seconds' FROM due WHERE q.id=due.id RETURNING q.id,q.lease_id,q.notification_id,q.channel,q.attempts`, [limit]);
            return rows;
        });
    }
    async target(job: DeliveryJob): Promise<DeliveryTarget | null> {
        const r = (await this.pool.query(`SELECT n.*,p.phone,p.email,p.email_verified,COALESCE(a.push_enabled,true) AS push_enabled,COALESCE(a.email_enabled,true) AS email_enabled,COALESCE(a.sms_enabled,false) AS sms_enabled,COALESCE(a.whatsapp_opt_in,false) AS whatsapp_opt_in,COALESCE(a.reminders_enabled,true) AS reminders_enabled,d.token,d.id AS device_id
   FROM vendo_internal.notification_outbox q JOIN public.notifications n ON n.id=q.notification_id JOIN public.profiles p ON p.id=n.profile_id LEFT JOIN public.account_preferences a ON a.profile_id=p.id LEFT JOIN vendo_internal.devices d ON d.id=q.device_id AND d.profile_id=p.id
   WHERE q.id=$1 AND q.lease_id=$2 AND q.status='sending' AND q.lease_until>now() AND p.status='active' AND (n.expires_at IS NULL OR n.expires_at>now())`, [job.id, job.lease_id])).rows[0];
        if (!r || (r.kind === 'reminder' && !r.reminders_enabled))
            return null;
        if (r.kind === 'rider_offer' && !(await this.pool.query("SELECT id FROM vendo_internal.rider_offers WHERE id=$1 AND rider_id=$2 AND status='pending' AND expires_at>now()", [r.dedupe_key.slice(6), r.profile_id])).rows[0])
            return null;
        if (r.kind==='vendor_order' && !(await this.pool.query("SELECT o.id FROM public.orders o JOIN vendo_internal.vendor_staff s ON s.vendor_id=o.vendor_id JOIN public.profiles p ON p.id=s.profile_id WHERE o.id=$1 AND s.profile_id=$2 AND o.status='awaiting_vendor' AND o.payment_status='paid' AND p.status='active' AND p.role='vendor_staff'",[r.order_id,r.profile_id])).rows[0]) return null;
        if (r.kind === 'reminder' && !(await this.pool.query("SELECT id FROM public.orders WHERE id=$1 AND status='scheduled' AND payment_status='paid' AND 'reminder:'||id||':'||scheduled_at::text=$2", [r.order_id, r.dedupe_key])).rows[0])
            return null;
        const destination = job.channel === 'push' ? (r.push_enabled ? r.token : null) : job.channel === 'email' ? (r.email_enabled && r.email_verified ? r.email : null) : job.channel === 'sms' ? (r.sms_enabled ? r.phone : null) : (r.whatsapp_opt_in ? r.phone : null);
        return destination ? { notification: notificationSchema.parse(serialize(r)), destination, device_id: r.device_id ?? null, urgent: ['rider_offer','vendor_order'].includes(r.kind) } : null;
    }
    async finish(job: DeliveryJob, status: 'sent' | 'skipped' | 'failed', error?: string) { await this.pool.query(`UPDATE vendo_internal.notification_outbox SET status=CASE WHEN $3='failed' AND attempts<5 THEN 'pending' ELSE $3 END,available_at=CASE WHEN $3='failed' THEN now()+least(3600,power(2,attempts)*30)*interval '1 second' ELSE available_at END,lease_id=NULL,lease_until=NULL,last_error=$4 WHERE id=$1 AND lease_id=$2 AND status='sending'`, [job.id, job.lease_id, status, error ?? null]); }
    async invalidateDevice(id: string, destination: string) { await this.pool.query('DELETE FROM vendo_internal.devices WHERE id=$1 AND token=$2', [id, destination]); }
}
