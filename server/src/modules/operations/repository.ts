import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import type { ObjectStorage } from '../media/schema.js';
import { validateFile, extension } from '../media/validation.js';
import { ApiError } from '../../lib/errors.js';
import { actor, audit, serialize, transaction } from '../../lib/postgres.js';
import { serializeOrder } from '../orders/schema.js';
import { transition, type TransitionRow } from '../orders/transitions.js';
import { insidePolygon } from '../food/pricing.js';
import { distanceMeters, type Point } from '../../lib/geo.js';
import { menuSchema, menuInputSchema } from '../food/schema.js';
import { adminCitySchema, documentSchema, tierSchema, bannerSchema, reportRow, riderListSchema, auditSchema, healthSchema, placementSchema, type OperationsRepository, type ListQuery, type CityInput, type DocumentInput, type TierInput, type MembershipInput, type BannerInput, type ReportQuery } from './schema.js';
export class PostgresOperationsRepository implements OperationsRepository {
    constructor(private readonly pool: pg.Pool, private readonly secret?: string, private readonly storage?: ObjectStorage) { }
    private key() {
        if (!this.secret)
            throw new ApiError(503, 'DOCUMENTS_NOT_CONFIGURED', 'Private document encryption is not configured.');
        return createHash('sha256').update(this.secret).digest();
    }
    private async vendor(c: pg.PoolClient, user: string, id: string) {
        const p = await actor(c, user);
        if (!['admin', 'vendor_staff'].includes(p.role) || p.role !== 'admin' && !(await c.query('SELECT 1 FROM vendo_internal.vendor_staff WHERE profile_id=$1 AND vendor_id=$2', [user, id])).rows[0])
            throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found.');
        if (!(await c.query('SELECT id FROM public.vendors WHERE id=$1', [id])).rows[0])
            throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found.');
    }
    async adminOrders(user: string, input: ListQuery) { return transaction(this.pool, async (c) => { await actor(c, user, 'admin'); return (await c.query('SELECT * FROM public.orders WHERE ($1::text IS NULL OR quote->>\'city_id\'=$1) AND ($2::text IS NULL OR status=$2) ORDER BY created_at DESC,id LIMIT $3 OFFSET $4', [input.city_id ?? null, input.status ?? null, input.limit, input.offset])).rows.map(serializeOrder); }); }
    async adminOrder(user: string, id: string) {
        return transaction(this.pool, async (c) => {
            await actor(c, user, 'admin');
            const r = (await c.query('SELECT * FROM public.orders WHERE id=$1', [id])).rows[0];
            if (!r)
                throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
            return serializeOrder(r);
        });
    }
    async cities(user: string) { return transaction(this.pool, async (c) => { await actor(c, user, 'admin'); return (await c.query('SELECT * FROM public.cities ORDER BY name,id')).rows.map(r => adminCitySchema.parse({ ...r, base_fare_kobo: r.base_fare_kobo === null ? null : Number(r.base_fare_kobo), per_km_rate_kobo: r.per_km_rate_kobo === null ? null : Number(r.per_km_rate_kobo), minimum_delivery_fee_kobo: Number(r.minimum_delivery_fee_kobo), minimum_food_subtotal_kobo: Number(r.minimum_food_subtotal_kobo) })); }); }
    async saveCity(user: string, id: string, input: CityInput) {
        return transaction(this.pool, async (c) => {
            await actor(c, user, 'admin');
            const keys = Object.keys(input), values = Object.values(input);
            const r = (await c.query(`UPDATE public.cities SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING *`, [id, ...values])).rows[0];
            if (!r)
                throw new ApiError(404, 'CITY_NOT_FOUND', 'City not found.');
            await audit(c, user, 'city_pricing_hours_updated', id);
            return adminCitySchema.parse({ ...r, ...input });
        });
    }
    async riders(user: string, city: string | undefined, limit: number, offset: number) { return transaction(this.pool, async (c) => { await actor(c, user, 'admin'); const rows = await c.query(`SELECT p.id,p.name,r.city_id,r.approval,r.online,r.vehicle_type,r.plate_number,l.lat,l.lng,l.captured_at,COALESCE(l.captured_at<now()-make_interval(secs=>m.location_max_age_seconds) OR l.received_at<now()-make_interval(secs=>m.location_max_age_seconds) OR l.accuracy_m>m.max_accuracy_m,true) AS location_stale FROM vendo_internal.riders r JOIN public.profiles p ON p.id=r.profile_id LEFT JOIN vendo_internal.rider_locations l ON l.rider_id=r.profile_id LEFT JOIN vendo_internal.matching_policies m ON m.city_id=r.city_id WHERE ($1::uuid IS NULL OR r.city_id=$1) ORDER BY p.id LIMIT $2 OFFSET $3`, [city ?? null, limit, offset]); await audit(c, user, 'rider_map_viewed', city ?? user); return rows.rows.map(r => riderListSchema.parse(serialize(r))); }); }
    async reassign(user: string, id: string, rider: string, reason: string) {
        return transaction(this.pool, async (c) => {
            await actor(c, user, 'admin');
            const o = (await c.query<TransitionRow & {
                assigned_rider_id: string | null;
                customer_id: string;
                quote: {
                    city_id: string;
                    pickup: Point;
                    total_kobo: number;
                };
            }>('SELECT * FROM public.orders WHERE id=$1 FOR UPDATE', [id])).rows[0];
            if (!o)
                throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
            if (o.assigned_rider_id === rider && o.status === 'rider_assigned')
                return serializeOrder((await c.query('SELECT * FROM public.orders WHERE id=$1', [id])).rows[0]!);
            if (!['searching_rider', 'rider_assigned'].includes(o.status) || o.payment_status !== 'paid')
                throw new ApiError(409, 'CUSTODY_REASSIGNMENT_FORBIDDEN', 'Reassignment is permitted only before pickup.');
            await c.query('SELECT profile_id FROM vendo_internal.riders WHERE profile_id=ANY($1::uuid[]) ORDER BY profile_id FOR UPDATE', [[o.assigned_rider_id, rider].filter(Boolean)]);
            const target = (await c.query(`SELECT r.*,l.lat,l.lng,l.captured_at,l.received_at,l.accuracy_m,m.max_radius_m,m.location_max_age_seconds,m.max_accuracy_m,ct.service_polygon,now() AS now FROM vendo_internal.riders r JOIN public.profiles p ON p.id=r.profile_id JOIN vendo_internal.rider_locations l ON l.rider_id=r.profile_id JOIN vendo_internal.matching_policies m ON m.city_id=r.city_id JOIN public.cities ct ON ct.id=r.city_id WHERE r.profile_id=$1 AND r.city_id=$2 AND r.approval='approved' AND r.online AND p.status='active' AND p.role='rider' AND ct.is_active`, [rider, o.quote.city_id])).rows[0];
            if (!target || target.captured_at.getTime() < target.now.getTime() - target.location_max_age_seconds * 1000 || target.received_at.getTime() < target.now.getTime() - target.location_max_age_seconds * 1000 || target.captured_at.getTime() > target.now.getTime() + 15000 || target.accuracy_m > target.max_accuracy_m || !target.service_polygon || !insidePolygon(target, target.service_polygon) || distanceMeters(target, o.quote.pickup) > target.max_radius_m)
                throw new ApiError(409, 'RIDER_INELIGIBLE', 'Choose an approved available rider with fresh nearby GPS.');
            if ((await c.query("SELECT id FROM public.orders WHERE assigned_rider_id=$1 AND status IN('rider_assigned','picked_up','on_the_way','disputed') AND id<>$2 UNION ALL SELECT id FROM vendo_internal.rider_offers WHERE rider_id=$1 AND status='pending'", [rider, id])).rows[0])
                throw new ApiError(409, 'RIDER_BUSY', 'This rider has a job or pending offer.');
            await c.query("UPDATE vendo_internal.rider_offers SET status='cancelled',responded_at=now() WHERE order_id=$1 AND status='pending'", [id]);
            await c.query('UPDATE public.orders SET assigned_rider_id=$2 WHERE id=$1', [id, rider]);
            if (o.status === 'searching_rider')
                await transition(c, { ...o, assigned_rider_id: rider }, 'rider_assigned', user, 'admin_reassigned');
            else
                await c.query("INSERT INTO public.order_events(order_id,actor_id,from_status,to_status,reason) VALUES($1,$2,'rider_assigned','rider_assigned','admin_reassigned')", [id, user]);
            await c.query('DELETE FROM public.order_tracking WHERE order_id=$1', [id]);
            await c.query("UPDATE vendo_internal.matching_searches SET state='assigned',updated_at=now() WHERE order_id=$1", [id]);
            if (o.assigned_rider_id)
                await c.query("SELECT vendo_internal.notify($1,$2,'order','Delivery reassigned','This delivery was reassigned. Open Vendo for details.',$3)", [o.assigned_rider_id, `reassign:${id}:${randomUUID()}`, id]);
            await audit(c, user, 'order_reassigned', id);
            await c.query('INSERT INTO vendo_internal.reassignment_notes(order_id,actor_id,reason) VALUES($1,$2,$3)', [id, user, reason]);
            return serializeOrder((await c.query('SELECT * FROM public.orders WHERE id=$1', [id])).rows[0]!);
        });
    }
    async cancel(user: string, id: string, reason: string) {
        return transaction(this.pool, async (c) => {
            await actor(c, user, 'admin');
            const o = (await c.query<TransitionRow>('SELECT * FROM public.orders WHERE id=$1 FOR UPDATE', [id])).rows[0];
            if (!o)
                throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
            if (!['pending_payment', 'scheduled', 'awaiting_vendor', 'searching_rider', 'rider_assigned', 'cancelled'].includes(o.status))
                throw new ApiError(409, 'CUSTODY_CANCEL_FORBIDDEN', 'Resolve delivery custody before cancellation.');
            await transition(c, o, 'cancelled', user, 'admin_cancelled');
            await c.query('UPDATE public.orders SET cancellation_reason=$2 WHERE id=$1', [id, reason]);
            await audit(c, user, 'order_cancelled', id);
            return serializeOrder((await c.query('SELECT * FROM public.orders WHERE id=$1', [id])).rows[0]!);
        });
    }
    async custody(user: string, id: string, outcome: 'delivered' | 'cancelled', reason: string) {
        return transaction(this.pool, async (c) => {
            await actor(c, user, 'admin');
            const o = (await c.query('SELECT * FROM public.orders WHERE id=$1 FOR UPDATE', [id])).rows[0];
            if (!o)
                throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
            if (o.status !== 'disputed' || o.payment_status !== 'paid')
                throw new ApiError(409, 'CUSTODY_NOT_DISPUTED', 'Only paid disputed deliveries can be resolved.');
            await c.query(`UPDATE public.orders SET status=$2,delivered_at=CASE WHEN $2='delivered' THEN now() ELSE delivered_at END,cancelled_at=CASE WHEN $2='cancelled' THEN now() ELSE cancelled_at END,refund_status=CASE WHEN $2='cancelled' THEN 'pending' ELSE refund_status END,cancellation_reason=$3 WHERE id=$1`, [id, outcome, reason]);
            if (outcome === 'cancelled')
                await c.query('INSERT INTO vendo_internal.order_refunds(order_id,amount_kobo) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, o.quote.total_kobo]);
            else
                await c.query('UPDATE vendo_internal.dispatch_delivery_codes SET consumed_at=now() WHERE order_id=$1', [id]);
            await c.query("UPDATE public.order_disputes SET status='resolved',resolution=$2,resolved_at=now() WHERE order_id=$1 AND status='open'", [id, reason]);
            await c.query("INSERT INTO public.order_events(order_id,actor_id,from_status,to_status,reason) VALUES($1,$2,'disputed',$3,'admin_custody_resolved')", [id, user, outcome]);
            await audit(c, user, `custody_${outcome}`, id);
            return serializeOrder((await c.query('SELECT * FROM public.orders WHERE id=$1', [id])).rows[0]!);
        });
    }
    async vendorOrders(user: string, id: string, limit: number, offset: number) { return transaction(this.pool, async (c) => { await this.vendor(c, user, id); return (await c.query('SELECT * FROM public.orders WHERE vendor_id=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3', [id, limit, offset])).rows.map(serializeOrder); }); }
    async vendorMenu(user: string, id: string) { return transaction(this.pool, async (c) => { await this.vendor(c, user, id); return (await c.query('SELECT * FROM public.menu_items WHERE vendor_id=$1 ORDER BY name,id', [id])).rows.map(r => menuSchema.parse({ ...r, price_kobo: Number(r.price_kobo) })); }); }
    async saveMenu(user: string, vendor: string, item: string | undefined, input: z.infer<typeof menuInputSchema>) {
        return transaction(this.pool, async (c) => {
            await this.vendor(c, user, vendor);
            const id = item ?? randomUUID(), values = [id, vendor, input.name, input.description, input.price_kobo, input.category, input.is_available, input.image_url, JSON.stringify(input.option_groups)];
            const r = (await c.query(item ? 'UPDATE public.menu_items SET name=$3,description=$4,price_kobo=$5,category=$6,is_available=$7,image_url=$8,option_groups=$9 WHERE id=$1 AND vendor_id=$2 RETURNING *' : 'INSERT INTO public.menu_items(id,vendor_id,name,description,price_kobo,category,is_available,image_url,option_groups) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', values)).rows[0];
            if (!r)
                throw new ApiError(404, 'ITEM_NOT_FOUND', 'Menu item not found.');
            await audit(c, user, 'vendor_menu_saved', id);
            return menuSchema.parse({ ...r, price_kobo: Number(r.price_kobo) });
        });
    }
    async vendorOpen(user: string, id: string, open: boolean) { await transaction(this.pool, async (c) => { await this.vendor(c, user, id); await c.query('UPDATE public.vendors SET is_open=$2 WHERE id=$1', [id, open]); await audit(c, user, 'vendor_availability_updated', id); }); }
    async documents(user: string, rider: string) {
        return transaction(this.pool, async (c) => {
            const p = await actor(c, user);
            if (user !== rider && p.role !== 'admin')
                throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
            return (await c.query('SELECT * FROM vendo_internal.rider_documents WHERE rider_id=$1 ORDER BY kind', [rider])).rows.map(r => documentSchema.parse(serialize(r)));
        });
    }
    async upload(user: string, input: DocumentInput) {
        const data = validateFile(input.data_base64, input.mime);
        let encrypted: string | null = null;
        const storagePath = this.storage ? `riders/${user}/${randomUUID()}.${extension(input.mime)}` : null;
        if (!this.storage) {
            const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key(), iv);
            cipher.setAAD(Buffer.from(`${user}:${input.kind}`));
            encrypted = Buffer.concat([iv, cipher.update(data), cipher.final(), cipher.getAuthTag()]).toString('base64');
        }
        return transaction(this.pool, async (c) => {
            await actor(c, user);
            const r = (await c.query('SELECT approval FROM vendo_internal.riders WHERE profile_id=$1 FOR UPDATE', [user])).rows[0];
            if ((await c.query("SELECT id FROM public.orders WHERE assigned_rider_id=$1 AND status IN('rider_assigned','picked_up','on_the_way','disputed')", [user])).rows[0])
                throw new ApiError(409, 'RIDER_HAS_ACTIVE_JOB', 'Finish the active delivery before changing documents.');
            if (!r || r.approval === 'suspended')
                throw new ApiError(403, 'RIDER_APPLICATION_REQUIRED', 'Register an eligible rider application first.');
            if (this.storage && storagePath)
                await this.storage.put(storagePath, data, input.mime, true);
            const row = (await c.query("INSERT INTO vendo_internal.rider_documents(rider_id,kind,mime,encrypted,sha256,bytes,storage_path) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(rider_id,kind) DO UPDATE SET mime=EXCLUDED.mime,encrypted=EXCLUDED.encrypted,storage_path=EXCLUDED.storage_path,sha256=EXCLUDED.sha256,bytes=EXCLUDED.bytes,status='pending',review_note=NULL,reviewed_at=NULL,reviewed_by=NULL,created_at=now() RETURNING *", [user, input.kind, input.mime, encrypted, createHash('sha256').update(data).digest('hex'), data.length, storagePath])).rows[0];
            await c.query("UPDATE vendo_internal.riders SET approval='pending',online=false,updated_at=now() WHERE profile_id=$1", [user]);
            return documentSchema.parse(serialize(row));
        });
    }
    async document(user: string, id: string) {
        return transaction(this.pool, async (c) => {
            await actor(c, user, 'admin');
            const r = (await c.query('SELECT * FROM vendo_internal.rider_documents WHERE id=$1', [id])).rows[0];
            if (!r)
                throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
            if (r.storage_path) {
                if (!this.storage)
                    throw new ApiError(503, 'STORAGE_NOT_CONFIGURED', 'File storage is not configured.');
                await audit(c, user, 'rider_document_viewed', id);
                const data = await this.storage.download(r.storage_path);
                if (createHash('sha256').update(data).digest('hex') !== r.sha256)
                    throw new ApiError(503, 'DOCUMENT_INTEGRITY_ERROR', 'Document integrity verification failed.');
                return { mime: r.mime as string, data_base64: data.toString('base64') };
            }
            const data = Buffer.from(r.encrypted, 'base64'), decipher = createDecipheriv('aes-256-gcm', this.key(), data.subarray(0, 12));
            decipher.setAAD(Buffer.from(`${r.rider_id}:${r.kind}`));
            decipher.setAuthTag(data.subarray(-16));
            await audit(c, user, 'rider_document_viewed', id);
            return { mime: r.mime as string, data_base64: Buffer.concat([decipher.update(data.subarray(12, -16)), decipher.final()]).toString('base64') };
        });
    }
    async reviewDocument(user: string, id: string, status: 'approved' | 'rejected', note: string) {
        await transaction(this.pool, async (c) => {
            await actor(c, user, 'admin');
            const r = (await c.query('SELECT rider_id FROM vendo_internal.rider_documents WHERE id=$1', [id])).rows[0];
            if (!r)
                throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
            await c.query('SELECT profile_id FROM vendo_internal.riders WHERE profile_id=$1 FOR UPDATE', [r.rider_id]);
            await c.query('UPDATE vendo_internal.rider_documents SET status=$2,review_note=$3,reviewed_at=now(),reviewed_by=$4 WHERE id=$1', [id, status, note, user]);
            await audit(c, user, 'rider_document_reviewed', id);
        });
    }
    async saveTier(user: string, input: TierInput, id?: string) {
        return transaction(this.pool, async (c) => {
            await actor(c, user, 'admin');
            const r = (await c.query(id ? 'UPDATE vendo_internal.membership_tiers SET name=$2,active=$3,placement_rank=$4,commission_bps=$5 WHERE id=$1 RETURNING *' : 'INSERT INTO vendo_internal.membership_tiers(id,name,active,placement_rank,commission_bps) VALUES($1,$2,$3,$4,$5) RETURNING *', [id ?? randomUUID(), input.name, input.active, input.placement_rank, input.commission_bps])).rows[0];
            if (!r)
                throw new ApiError(404, 'TIER_NOT_FOUND', 'Tier not found.');
            await audit(c, user, 'membership_tier_saved', r.id);
            return tierSchema.parse(r);
        });
    }
    async tiers(user: string) { return transaction(this.pool, async (c) => { await actor(c, user, 'admin'); return (await c.query('SELECT * FROM vendo_internal.membership_tiers ORDER BY name,id')).rows.map(r => tierSchema.parse(r)); }); }
    async membership(user: string, vendor: string, input: MembershipInput) {
        await transaction(this.pool, async (c) => {
            await actor(c, user, 'admin');
            if (!(await c.query('SELECT id FROM public.vendors WHERE id=$1', [vendor])).rows[0] || !(await c.query('SELECT id FROM vendo_internal.membership_tiers WHERE id=$1', [input.tier_id])).rows[0])
                throw new ApiError(404, 'MEMBERSHIP_TARGET_NOT_FOUND', 'Vendor or membership tier not found.');
            await c.query('INSERT INTO vendo_internal.vendor_memberships(vendor_id,tier_id,starts_at,ends_at) VALUES($1,$2,$3,$4) ON CONFLICT(vendor_id) DO UPDATE SET tier_id=EXCLUDED.tier_id,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at', [vendor, input.tier_id, input.starts_at, input.ends_at]);
            await audit(c, user, 'vendor_membership_saved', vendor);
        });
    }
    async saveBanner(user: string, input: BannerInput, id?: string) {
        return transaction(this.pool, async (c) => {
            await actor(c, user, 'admin');
            if (input.vendor_id && !(await c.query('SELECT id FROM public.vendors WHERE id=$1 AND ($2::uuid IS NULL OR city_id=$2)', [input.vendor_id, input.city_id])).rows[0])
                throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found.');
            const keys = Object.keys(input), values = Object.values(input);
            const r = (await c.query(id ? `UPDATE public.promo_banners SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING *` : `INSERT INTO public.promo_banners(id,${keys.join(',')}) VALUES($1,${keys.map((_k, i) => `$${i + 2}`).join(',')}) RETURNING *`, [id ?? randomUUID(), ...values])).rows[0];
            if (!r)
                throw new ApiError(404, 'BANNER_NOT_FOUND', 'Banner not found.');
            await audit(c, user, 'promo_banner_saved', r.id);
            return bannerSchema.parse(serialize(r));
        });
    }
    async banners(city: string) { return (await this.pool.query(`SELECT b.* FROM public.promo_banners b JOIN public.cities c ON c.id=$1 AND c.is_active WHERE b.active AND b.starts_at<=now() AND b.ends_at>now() AND (b.city_id IS NULL OR b.city_id=$1) AND (b.vendor_id IS NULL OR EXISTS(SELECT 1 FROM public.vendors WHERE id=b.vendor_id AND is_active AND city_id=$1)) ORDER BY b.priority DESC,b.id LIMIT 20`, [city])).rows.map(r => bannerSchema.parse(serialize(r))); }
    async placements(city: string) { return (await this.pool.query(`SELECT v.id AS vendor_id,v.name,t.name AS tier,t.placement_rank,true AS sponsored FROM public.vendors v JOIN public.cities c ON c.id=v.city_id JOIN vendo_internal.vendor_memberships m ON m.vendor_id=v.id JOIN vendo_internal.membership_tiers t ON t.id=m.tier_id WHERE v.city_id=$1 AND v.is_active AND c.is_active AND t.active AND t.placement_rank>0 AND m.starts_at<=now() AND m.ends_at>now() ORDER BY t.placement_rank DESC,v.id LIMIT 20`, [city])).rows.map(r => placementSchema.parse(r)); }
    async report(user: string, input: ReportQuery) { return transaction(this.pool, async (c) => { await actor(c, user, 'admin'); return (await c.query(`SELECT to_char(o.created_at AT TIME ZONE 'Africa/Lagos','YYYY-MM-DD') AS day,(o.quote->>'city_id')::uuid AS city_id,o.type,count(*)::int AS orders,count(*) FILTER(WHERE o.payment_status='paid')::int AS paid_orders,count(*) FILTER(WHERE o.status='delivered')::int AS delivered,count(*) FILTER(WHERE o.status='cancelled')::int AS cancelled,COALESCE(sum((o.quote->>'total_kobo')::bigint) FILTER(WHERE o.payment_status='paid'),0) AS paid_kobo,COALESCE(sum(r.amount_kobo) FILTER(WHERE r.status='processed'),0) AS refunded_kobo,avg(extract(epoch FROM o.delivered_at-o.picked_up_at))::double precision AS avg_delivery_seconds FROM public.orders o LEFT JOIN vendo_internal.order_refunds r ON r.order_id=o.id WHERE o.created_at>=$1 AND o.created_at<$2 AND ($3::text IS NULL OR o.quote->>'city_id'=$3) GROUP BY day,city_id,o.type ORDER BY day,city_id,o.type`, [input.from, input.to, input.city_id ?? null])).rows.map(r => reportRow.parse({ ...r, paid_kobo: Number(r.paid_kobo), refunded_kobo: Number(r.refunded_kobo) })); }); }
    async audits(user: string, limit: number, offset: number) { return transaction(this.pool, async (c) => { await actor(c, user, 'admin'); return (await c.query('SELECT * FROM vendo_internal.catalog_audit ORDER BY created_at DESC,id LIMIT $1 OFFSET $2', [limit, offset])).rows.map(r => auditSchema.parse(serialize(r))); }); }
    async health(user: string) { return transaction(this.pool, async (c) => { await actor(c, user, 'admin'); const r = (await c.query(`SELECT (SELECT count(*)::int FROM public.orders WHERE status IN('pending_payment','awaiting_vendor','searching_rider','scheduled')) AS orders_waiting,(SELECT count(*)::int FROM vendo_internal.rider_offers WHERE status='pending') AS offers_pending,(SELECT count(*)::int FROM vendo_internal.notification_outbox WHERE status IN('pending','sending')) AS notifications_pending,(SELECT count(*)::int FROM vendo_internal.notification_outbox WHERE status='failed') AS notifications_failed,(SELECT count(*)::int FROM vendo_internal.withdrawals WHERE status='review') AS withdrawals_review,(SELECT count(*)::int FROM public.orders o WHERE o.status='delivered' AND o.payment_status='paid' AND NOT EXISTS(SELECT 1 FROM vendo_internal.settlements WHERE order_id=o.id)) AS unsettled_deliveries`)).rows[0]; return healthSchema.parse({ ...r, workers: (await c.query('SELECT * FROM vendo_internal.worker_runs ORDER BY kind')).rows.map(serialize) }); }); }
    async heartbeat(kind: string, success: boolean, duration: number) { await this.pool.query('INSERT INTO vendo_internal.worker_runs(kind,last_success_at,last_failure_at,last_duration_ms) VALUES($1,CASE WHEN $2 THEN now() END,CASE WHEN NOT $2 THEN now() END,$3) ON CONFLICT(kind) DO UPDATE SET last_success_at=COALESCE(EXCLUDED.last_success_at,worker_runs.last_success_at),last_failure_at=COALESCE(EXCLUDED.last_failure_at,worker_runs.last_failure_at),last_duration_ms=EXCLUDED.last_duration_ms', [kind, success, Math.min(duration, 2147483647)]); }
}
