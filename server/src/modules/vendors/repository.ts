import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import { actor, audit, serialize, transaction } from '../../lib/postgres.js';
import { insidePolygon } from '../food/pricing.js';
import { serializeOrder } from '../orders/schema.js';
import { portalSchema, applicationSchema, storeSchema, summarySchema, type RegistrationInput, type Application, type StorePatch, type VendorRepository } from './schema.js';
const application = (r: Record<string, unknown>) => applicationSchema.parse(serialize(r));
const store = (r: Record<string, unknown>) => storeSchema.parse({ ...r, location: { lat: r.latitude, lng: r.longitude } });
const canonical = (input: unknown) => JSON.stringify(input, (_k, v: unknown) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
export class PostgresVendorRepository implements VendorRepository {
    constructor(private readonly pool: pg.Pool) { }
    private async applicant(c: pg.PoolClient, user: string) { const p = (await c.query<{
        role: string;
        status: string;
        onboarding_step: string;
    }>('SELECT role,status,onboarding_step FROM public.profiles WHERE id=$1 FOR UPDATE', [user])).rows[0]; if (!p || p.status !== 'active' || !['customer', 'vendor_staff'].includes(p.role))
        throw new ApiError(403, 'VENDOR_APPLICANT_INELIGIBLE', 'An active customer or vendor account is required.'); if (p.onboarding_step !== 'complete')
        throw new ApiError(403, 'ONBOARDING_REQUIRED', 'Complete phone, name and email onboarding.'); return p; }
    private async city(c: pg.PoolClient, id: string, point: {
        lat: number;
        lng: number;
    }) { const r = (await c.query('SELECT service_polygon,is_active FROM public.cities WHERE id=$1 FOR SHARE', [id])).rows[0]; if (!r?.is_active || !r.service_polygon)
        throw new ApiError(409, 'CITY_UNAVAILABLE', 'Choose a configured active service city.'); if (!insidePolygon(point, r.service_polygon))
        throw new ApiError(400, 'STORE_OUTSIDE_SERVICE_AREA', 'The store must be inside its service city.'); }
    private async access(c: pg.PoolClient, user: string, id: string) { const p = await actor(c, user); if (p.role !== 'admin' && (p.role !== 'vendor_staff' || !(await c.query('SELECT 1 FROM vendo_internal.vendor_staff WHERE vendor_id=$1 AND profile_id=$2 FOR SHARE', [id, user])).rows[0]))
        throw new ApiError(404, 'STORE_NOT_FOUND', 'Store not found.'); const r = (await c.query('SELECT * FROM public.vendors WHERE id=$1 FOR UPDATE', [id])).rows[0]; if (!r)
        throw new ApiError(404, 'STORE_NOT_FOUND', 'Store not found.'); return r; }
    async register(user: string, input: RegistrationInput, key: string) { return transaction(this.pool, async (c) => { await this.applicant(c, user); const old = (await c.query('SELECT * FROM vendo_internal.vendor_applications WHERE profile_id=$1 AND idempotency_key=$2', [user, key])).rows[0]; if (old) {
        if (canonical(old.input) !== canonical(input))
            throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This registration key was already used.');
        return application(old);
    } if ((await c.query("SELECT id FROM vendo_internal.vendor_applications WHERE profile_id=$1 AND status='pending'", [user])).rows[0])
        throw new ApiError(409, 'APPLICATION_PENDING', 'You already have a pending application.'); await this.city(c, input.city_id, input.location); for (const id of input.document_ids)
        if (!(await c.query("SELECT id FROM vendo_internal.media_assets WHERE id=$1 AND owner_id=$2 AND purpose='document' FOR SHARE", [id, user])).rows[0])
            throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Attach only your own uploaded private documents.'); const r = (await c.query('INSERT INTO vendo_internal.vendor_applications(profile_id,input,idempotency_key) VALUES($1,$2,$3) RETURNING *', [user, JSON.stringify(input), key])).rows[0]!; await audit(c, user, 'vendor_application_submitted', r.id); await c.query("SELECT vendo_internal.notify($1,$2,'vendor','Vendor application received','Your application is awaiting review. Open Vendo for details.')", [user, `vendor-application:${r.id}:pending`]); return application(r); }); }
    async applications(user: string, limit: number, offset: number, status?: Application['status'], admin = false) { return transaction(this.pool, async (c) => { await actor(c, user, admin ? 'admin' : undefined); return (await c.query('SELECT * FROM vendo_internal.vendor_applications WHERE ($1::uuid IS NULL OR profile_id=$1) AND ($2::text IS NULL OR status=$2) ORDER BY created_at DESC,id LIMIT $3 OFFSET $4', [admin ? null : user, status ?? null, limit, offset])).rows.map(application); }); }
    async review(user: string, id: string, decision: 'approve' | 'reject', note: string) { return transaction(this.pool, async (c) => { await actor(c, user, 'admin'); const initial = (await c.query('SELECT profile_id FROM vendo_internal.vendor_applications WHERE id=$1', [id])).rows[0]; if (!initial)
        throw new ApiError(404, 'APPLICATION_NOT_FOUND', 'Application not found.'); const owner = (await c.query('SELECT * FROM public.profiles WHERE id=$1 FOR UPDATE', [initial.profile_id])).rows[0]!; const r = (await c.query('SELECT * FROM vendo_internal.vendor_applications WHERE id=$1 FOR UPDATE', [id])).rows[0]!; const target = decision === 'approve' ? 'approved' : 'rejected'; if (r.status === target)
        return application(r); if (r.status !== 'pending')
        throw new ApiError(409, 'APPLICATION_ALREADY_REVIEWED', 'This application is no longer pending.'); let vendor: string | null = null; if (decision === 'approve') {
        if (owner.status !== 'active' || !['customer', 'vendor_staff'].includes(owner.role) || owner.onboarding_step !== 'complete')
            throw new ApiError(409, 'VENDOR_APPLICANT_INELIGIBLE', 'Applicant account is no longer eligible.');
        const i = r.input as RegistrationInput;
        await this.city(c, i.city_id, i.location);
        for (const file of i.document_ids)
            if (!(await c.query("SELECT id FROM vendo_internal.media_assets WHERE id=$1 AND owner_id=$2 AND purpose='document'", [file, owner.id])).rows[0])
                throw new ApiError(409, 'DOCUMENT_NOT_FOUND', 'Review documents before approval.');
        vendor = randomUUID();
        await c.query('INSERT INTO public.vendors(id,name,category,cuisine,city_id,address,latitude,longitude,image_url,logo_url,description,prep_minutes,is_open,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,true)', [vendor, i.name, i.category, i.cuisine, i.city_id, i.address, i.location.lat, i.location.lng, i.image_url, i.logo_url, i.description, i.prep_minutes]);
        await c.query("UPDATE public.profiles SET role='vendor_staff' WHERE id=$1", [owner.id]);
        await c.query('UPDATE public.vendors SET opening_hours=$2 WHERE id=$1', [vendor, JSON.stringify(i.opening_hours ?? [])]);
        await c.query('INSERT INTO vendo_internal.vendor_staff(vendor_id,profile_id) VALUES($1,$2)', [vendor, owner.id]);
    } const updated = (await c.query('UPDATE vendo_internal.vendor_applications SET status=$2,vendor_id=$3,review_note=$4,reviewed_at=now(),reviewed_by=$5 WHERE id=$1 RETURNING *', [id, target, vendor, note, user])).rows[0]!; await audit(c, user, `vendor_application_${target}`, id); await c.query("SELECT vendo_internal.notify($1,$2,'vendor','Vendor application update','Your application review is complete. Open Vendo for details.')", [owner.id, `vendor-application:${id}:${target}`]); return application(updated); }); }
    async withdraw(user: string, id: string) { return transaction(this.pool, async (c) => { await this.applicant(c, user); const r = (await c.query('SELECT * FROM vendo_internal.vendor_applications WHERE id=$1 AND profile_id=$2 FOR UPDATE', [id, user])).rows[0]; if (!r)
        throw new ApiError(404, 'APPLICATION_NOT_FOUND', 'Application not found.'); if (r.status === 'withdrawn')
        return application(r); if (r.status !== 'pending')
        throw new ApiError(409, 'APPLICATION_ALREADY_REVIEWED', 'Only pending applications can be withdrawn.'); const row = (await c.query("UPDATE vendo_internal.vendor_applications SET status='withdrawn',reviewed_at=now() WHERE id=$1 RETURNING *", [id])).rows[0]!; await audit(c, user, 'vendor_application_withdrawn', id); return application(row); }); }
    async stores(user: string, limit: number, offset: number) { return transaction(this.pool, async (c) => { await actor(c, user, 'vendor_staff'); return (await c.query('SELECT v.* FROM public.vendors v JOIN vendo_internal.vendor_staff s ON s.vendor_id=v.id WHERE s.profile_id=$1 ORDER BY v.name,v.id LIMIT $2 OFFSET $3', [user, limit, offset])).rows.map(store); }); }
    async store(user: string, id: string) { return transaction(this.pool, async (c) => store(await this.access(c, user, id))); }
    async update(user: string, id: string, patch: StorePatch) { return transaction(this.pool, async (c) => { const current = await this.access(c, user, id); if (!current.is_active)
        throw new ApiError(409, 'STORE_INACTIVE', 'Contact operations about this store.'); if (patch.location) {
        await this.city(c, current.city_id, patch.location);
        if ((await c.query("SELECT id FROM public.orders WHERE vendor_id=$1 AND status NOT IN('delivered','cancelled') LIMIT 1", [id])).rows[0])
            throw new ApiError(409, 'STORE_HAS_ACTIVE_ORDERS', 'Complete active orders before moving the store.');
    } const { location, ...fields } = patch; const values: Record<string, unknown> = { ...fields, ...(fields.opening_hours ? { opening_hours: JSON.stringify(fields.opening_hours) } : {}), ...(location ? { latitude: location.lat, longitude: location.lng } : {}) }; const keys = Object.keys(values), r = (await c.query(`UPDATE public.vendors SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING *`, [id, ...Object.values(values)])).rows[0]!; await audit(c, user, 'vendor_store_updated', id); return store(r); }); }
    private async orderDetails(c: pg.PoolClient, rows: Record<string, unknown>[]) {
        const extra = (await c.query(`SELECT o.id,(SELECT min(e.created_at) FROM public.order_events e WHERE e.order_id=o.id AND e.reason='vendor_accepted') AS accepted_at,CASE WHEN o.status='awaiting_vendor' THEN o.status_updated_at+make_interval(mins=>p.vendor_timeout_minutes) END AS due,CASE WHEN t.terms->>'enabled'='true' THEN floor((o.quote->>'subtotal_kobo')::numeric*(t.terms->>'vendor_commission_bps')::numeric/10000) END AS commission FROM public.orders o LEFT JOIN vendo_internal.city_order_policies p ON p.city_id=(o.quote->>'city_id')::uuid LEFT JOIN vendo_internal.order_finance_terms t ON t.order_id=o.id WHERE o.id=ANY($1::uuid[])`,[rows.map(r=>r.id)])).rows;
        return rows.map(r=>{const e=extra.find(v=>v.id===r.id);return serializeOrder({...r,vendor_accepted_at:e?.accepted_at instanceof Date?e.accepted_at.toISOString():null,vendor_response_due_at:e?.due instanceof Date?e.due.toISOString():null,vendor_commission_kobo:e?.commission==null?null:Number(e.commission)});});
    }
    async orders(user: string, id: string, limit: number, offset: number, status?: string) { return transaction(this.pool, async (c) => { await this.access(c, user, id); return this.orderDetails(c, (await c.query('SELECT * FROM public.orders WHERE vendor_id=$1 AND ($2::text IS NULL OR status=$2) ORDER BY created_at DESC,id LIMIT $3 OFFSET $4', [id, status ?? null, limit, offset])).rows); }); }
    async order(user: string, id: string, orderId: string) { return transaction(this.pool, async (c) => { await this.access(c, user, id); const r = (await c.query('SELECT * FROM public.orders WHERE id=$1 AND vendor_id=$2', [orderId, id])).rows[0]; if (!r)
        throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.'); return (await this.orderDetails(c,[r]))[0]!; }); }
    async portal(user: string, id: string) { return transaction(this.pool, async c => {
        const vendor = await this.access(c, user, id);
        const reviews = (await c.query("SELECT r.id,r.vendor_rating AS rating,r.comment,r.created_at FROM public.order_ratings r JOIN public.orders o ON o.id=r.order_id WHERE o.vendor_id=$1 AND r.vendor_rating IS NOT NULL ORDER BY r.created_at DESC,r.id LIMIT 100", [id])).rows;
        const count = (await c.query("SELECT count(*)::int AS n FROM public.order_ratings r JOIN public.orders o ON o.id=r.order_id WHERE o.vendor_id=$1 AND r.vendor_rating IS NOT NULL", [id])).rows[0]!.n;
        const config = (await c.query("SELECT config FROM vendo_internal.finance_policies WHERE city_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1", [vendor.city_id])).rows[0]?.config;
        const membership = (await c.query("SELECT t.name,t.commission_bps FROM vendo_internal.vendor_memberships m JOIN vendo_internal.membership_tiers t ON t.id=m.tier_id WHERE m.vendor_id=$1 AND m.starts_at<=now() AND m.ends_at>now() AND t.active ORDER BY m.starts_at DESC LIMIT 1", [id])).rows[0];
        const sales = (await c.query(`SELECT (delivered_at AT TIME ZONE 'Africa/Lagos')::date::text AS date,count(*)::int AS orders,sum((quote->>'subtotal_kobo')::bigint)::text AS sales FROM public.orders WHERE vendor_id=$1 AND status='delivered' AND (delivered_at AT TIME ZONE 'Africa/Lagos')::date >= (now() AT TIME ZONE 'Africa/Lagos')::date-6 GROUP BY 1`, [id])).rows;
        const today = (await c.query("SELECT (now() AT TIME ZONE 'Africa/Lagos')::date::text AS date")).rows[0]!.date as string;
        const days = Array.from({length:7}, (_,i) => { const date = new Date(`${today}T00:00:00Z`); date.setUTCDate(date.getUTCDate()-6+i); const label=date.toISOString().slice(0,10), row=sales.find(r=>r.date===label); return {date:label,orders:Number(row?.orders ?? 0),salesKobo:Number(row?.sales ?? 0)}; });
        const earnings = (await c.query(`SELECT COALESCE(sum(l.available_delta+l.held_delta),0)::text AS n FROM vendo_internal.earnings_ledger l JOIN vendo_internal.earnings_accounts a ON a.id=l.account_id WHERE a.kind='vendor' AND a.entity_id=$1 AND l.kind='earning' AND (l.created_at AT TIME ZONE 'Africa/Lagos')::date=(now() AT TIME ZONE 'Africa/Lagos')::date`,[id])).rows[0]!.n;
        const top = (await c.query(`SELECT item->>'name' AS name,sum((item->>'quantity')::int)::int AS quantity FROM public.orders o CROSS JOIN LATERAL jsonb_array_elements(o.quote->'items') item WHERE o.vendor_id=$1 AND o.status='delivered' AND o.delivered_at>=now()-interval '7 days' GROUP BY 1 ORDER BY quantity DESC,name LIMIT 5`,[id])).rows;
        return portalSchema.parse({ commission_rate: config?.enabled ? Number(membership?.commission_bps ?? config.vendor_commission_bps)/10000 : null, tier:membership?.name ?? null, rating_count:count, dashboard:{today:{...days[6],payoutKobo:Number(earnings)},week:{orders:days.reduce((n,d)=>n+d.orders,0),salesKobo:days.reduce((n,d)=>n+d.salesKobo,0)},days,topItems:top},reviews:reviews.map(r=>({id:r.id,customerName:'Customer',rating:Number(r.rating),comment:r.comment,createdAt:(r.created_at as Date).toISOString()})) });
    }); }
    async summary(user: string, id: string) { return transaction(this.pool, async (c) => { await this.access(c, user, id); const r = (await c.query(`SELECT count(*) FILTER(WHERE status='awaiting_vendor')::int AS awaiting_vendor,count(*) FILTER(WHERE status IN('awaiting_vendor','searching_rider','rider_assigned','picked_up','on_the_way','disputed'))::int AS active_orders,count(*) FILTER(WHERE vendor_ready_at IS NOT NULL AND status IN('searching_rider','rider_assigned'))::int AS ready_orders,count(*) FILTER(WHERE status='delivered')::int AS delivered_orders,(SELECT count(*)::int FROM public.menu_items WHERE vendor_id=$1) AS menu_items,(SELECT count(*)::int FROM public.menu_items WHERE vendor_id=$1 AND is_available) AS available_items FROM public.orders WHERE vendor_id=$1`, [id])).rows[0]; return summarySchema.parse(r); }); }
}
