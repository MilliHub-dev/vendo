import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import { promoOutput, ticketSchema, messageSchema, legalSchema, type ExtrasRepository, type PromoInput, type ReferralPolicy, type TicketInput, type LegalInput } from './schema.js';
const serialize = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]));
const canonical = (v: unknown) => JSON.stringify(v, (_k, x: unknown) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
export class PostgresExtrasRepository implements ExtrasRepository {
    constructor(private readonly pool: pg.Pool) { }
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
    private async actor(c: pg.PoolClient, id: string, admin = false, lock = 'SHARE') {
        const { rows } = await c.query(`SELECT * FROM public.profiles WHERE id=$1 AND status='active' ${admin ? "AND role='admin'" : ''} FOR ${lock}`, [id]);
        if (!rows[0])
            throw new ApiError(403, 'FORBIDDEN', 'Active authorized account access is required.');
        return rows[0];
    }
    private async audit(c: pg.PoolClient, actor: string, action: string, id: string) { await c.query('INSERT INTO vendo_internal.catalog_audit(actor_id,action,target_id) VALUES ($1,$2,$3)', [actor, action, id]); }
    async savePromo(actor: string, input: PromoInput, id?: string) {
        return this.transaction(async (c) => {
            await this.actor(c, actor, true);
            if (input.city_id && !(await c.query('SELECT id FROM public.cities WHERE id=$1', [input.city_id])).rows[0])
                throw new ApiError(400, 'CITY_NOT_FOUND', 'Choose an existing city.');
            if (input.vendor_id && !(await c.query('SELECT id FROM public.vendors WHERE id=$1 AND ($2::uuid IS NULL OR city_id=$2)', [input.vendor_id, input.city_id])).rows[0])
                throw new ApiError(400, 'VENDOR_NOT_FOUND', 'Choose a vendor in this city.');
            if ((await c.query('SELECT id FROM vendo_internal.promos WHERE code=$1 AND id IS DISTINCT FROM $2::uuid', [input.code, id ?? null])).rows[0])
                throw new ApiError(409, 'PROMO_CODE_EXISTS', 'This promo code already exists.');
            const values = Object.values(input), columns = Object.keys(input);
            const { rows } = id ? await c.query(`UPDATE vendo_internal.promos SET ${columns.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING *`, [id, ...values]) : await c.query(`INSERT INTO vendo_internal.promos (${columns.join(',')}) VALUES (${columns.map((_k, i) => `$${i + 1}`).join(',')}) RETURNING *`, values);
            if (!rows[0])
                throw new ApiError(404, 'PROMO_NOT_FOUND', 'Promo not found.');
            await this.audit(c, actor, 'promo_saved', rows[0].id);
            return promoOutput.parse(serialize(rows[0]));
        });
    }
    async promos(actor: string) { return this.transaction(async (c) => { await this.actor(c, actor, true); return (await c.query('SELECT * FROM vendo_internal.promos ORDER BY starts_at DESC LIMIT 100')).rows.map(r => promoOutput.parse(serialize(r))); }); }
    async setReferralPolicy(actor: string, input: ReferralPolicy) { return this.transaction(async (c) => { await this.actor(c, actor, true); await c.query('SELECT pg_advisory_xact_lock(91003009)'); const { rows } = await c.query('INSERT INTO vendo_internal.referral_policies(enabled,config) VALUES ($1,$2) RETURNING id', [input.enabled, JSON.stringify(input)]); await this.audit(c, actor, 'referral_policy_saved', rows[0].id); return input; }); }
    async referrals(user: string) {
        return this.transaction(async (c) => {
            await this.actor(c, user, false, 'UPDATE');
            // 64 random bits; collision is a safe transaction retry, never a code takeover.
            await c.query('INSERT INTO vendo_internal.referral_codes(profile_id,code) VALUES ($1,$2) ON CONFLICT(profile_id) DO NOTHING', [user, randomBytes(8).toString('hex').toUpperCase()]);
            const { rows } = await c.query(`SELECT rc.code,COALESCE((SELECT enabled FROM vendo_internal.referral_policies ORDER BY created_at DESC,id DESC LIMIT 1),false) AS enabled,
    (SELECT count(*)::int FROM vendo_internal.referrals WHERE referrer_id=$1 AND status='pending') AS pending,
    (SELECT count(*)::int FROM vendo_internal.referrals WHERE referrer_id=$1 AND status='rewarded') AS rewarded,
    (SELECT COALESCE(sum(amount_kobo),0)::bigint FROM public.wallet_transactions WHERE customer_id=$1 AND kind='referral') AS earned_kobo,
    EXISTS(SELECT 1 FROM vendo_internal.referrals WHERE referee_id=$1) AS applied FROM vendo_internal.referral_codes rc WHERE profile_id=$1`, [user]);
            return { ...rows[0], earned_kobo: Number(rows[0].earned_kobo) };
        });
    }
    async applyReferral(user: string, code: string) {
        await this.transaction(async (c) => {
            // Lock both profiles in stable order before reading orders; matches checkout/deletion lock order.
            const ref = (await c.query<{
                profile_id: string;
            }>('SELECT profile_id FROM vendo_internal.referral_codes WHERE code=$1', [code])).rows[0];
            if (!ref || ref.profile_id === user)
                throw new ApiError(409, 'REFERRAL_INELIGIBLE', 'This referral cannot be applied.');
            const profiles = await c.query("SELECT id,email,email_verified,role,onboarding_step FROM public.profiles WHERE id=ANY($1::uuid[]) AND status='active' ORDER BY id FOR UPDATE", [[user, ref.profile_id]]);
            if (profiles.rows.length !== 2 || profiles.rows[0]?.email === profiles.rows[1]?.email || profiles.rows.some(p => p.role !== 'customer' || p.onboarding_step !== 'complete' || !p.email_verified))
                throw new ApiError(409, 'REFERRAL_INELIGIBLE', 'Both customer accounts must have verified emails and complete profiles.');
            const prior = (await c.query('SELECT referrer_id FROM vendo_internal.referrals WHERE referee_id=$1', [user])).rows[0];
            if (prior) {
                if (prior.referrer_id === ref.profile_id)
                    return;
                throw new ApiError(409, 'REFERRAL_ALREADY_APPLIED', 'A referral was already applied.');
            }
            if ((await c.query('SELECT id FROM public.orders WHERE customer_id=$1 LIMIT 1', [user])).rows[0])
                throw new ApiError(409, 'REFERRAL_INELIGIBLE', 'Apply a referral before placing your first order.');
            await c.query('SELECT pg_advisory_xact_lock(91003009)');
            if ((await c.query(`WITH RECURSIVE chain AS (SELECT referrer_id FROM vendo_internal.referrals WHERE referee_id=$1 UNION SELECT r.referrer_id FROM vendo_internal.referrals r JOIN chain c ON r.referee_id=c.referrer_id) SELECT 1 FROM chain WHERE referrer_id=$2`, [ref.profile_id, user])).rows[0])
                throw new ApiError(409, 'REFERRAL_INELIGIBLE', 'Circular referrals cannot be applied.');
            const policy = (await c.query<{
                id: string;
                enabled: boolean;
                config: ReferralPolicy;
            }>('SELECT * FROM vendo_internal.referral_policies ORDER BY created_at DESC,id DESC LIMIT 1')).rows[0];
            if (!policy?.enabled)
                throw new ApiError(409, 'REFERRALS_DISABLED', 'Referrals are not available now.');
            const count = (await c.query<{
                n: number;
            }>("SELECT count(*)::int AS n FROM vendo_internal.referrals WHERE referrer_id=$1 AND status IN ('pending','rewarded')", [ref.profile_id])).rows[0]!.n;
            if (count >= policy.config.referrer_cap)
                throw new ApiError(409, 'REFERRAL_LIMIT_REACHED', 'This referral limit has been reached.');
            await c.query('INSERT INTO vendo_internal.referrals(referrer_id,referee_id,policy_id,terms) VALUES ($1,$2,$3,$4)', [ref.profile_id, user, policy.id, JSON.stringify(policy.config)]);
        });
    }
    async rewardReferrals(limit: number) {
        const candidates = (await this.pool.query<{
            id: string;
            referrer_id: string;
            referee_id: string;
        }>("SELECT id,referrer_id,referee_id FROM vendo_internal.referrals WHERE status='pending' ORDER BY last_checked_at ASC NULLS FIRST,created_at,id LIMIT $1", [limit])).rows;
        let rewarded = 0;
        for (const r of candidates)
            rewarded += await this.transaction(async (c) => {
                const profiles = await c.query("SELECT id,email_verified,role FROM public.profiles WHERE id=ANY($1::uuid[]) AND status='active' ORDER BY id FOR NO KEY UPDATE", [[r.referrer_id, r.referee_id]]);
                const row = (await c.query<{
                    terms: ReferralPolicy;
                    created_at: Date;
                    status: string;
                    checked_at: Date;
                }>('SELECT *,now() AS checked_at FROM vendo_internal.referrals WHERE id=$1 FOR UPDATE', [r.id])).rows[0];
                if (!row || row.status !== 'pending')
                    return 0;
                await c.query('UPDATE vendo_internal.referrals SET last_checked_at=now() WHERE id=$1', [r.id]);
                if (row.checked_at.getTime() > row.created_at.getTime() + row.terms.expiry_days * 86400000) {
                    await c.query("UPDATE vendo_internal.referrals SET status='expired' WHERE id=$1", [r.id]);
                    return 0;
                }
                if (profiles.rows.length !== 2 || profiles.rows.some(p => !p.email_verified || p.role !== 'customer'))
                    return 0;
                // Kill switch; policy changes do not change promised amounts for attached referrals.
                await c.query('SELECT pg_advisory_xact_lock(91003009)');
                if (!(await c.query('SELECT enabled FROM vendo_internal.referral_policies ORDER BY created_at DESC,id DESC LIMIT 1')).rows[0]?.enabled)
                    return 0;
                const o = (await c.query(`SELECT * FROM public.orders WHERE customer_id=$1 AND created_at >= $2 ORDER BY created_at,id LIMIT 1 FOR SHARE`, [r.referee_id, row.created_at])).rows[0];
                if (!o || o.status !== 'delivered' || o.payment_status !== 'paid' || o.refund_status !== 'none' || Number(o.quote.total_kobo) < row.terms.minimum_order_kobo || !o.delivered_at || row.checked_at.getTime() < o.delivered_at.getTime() + row.terms.hold_days * 86400000)
                    return 0;
                if ((await c.query("SELECT order_id FROM vendo_internal.order_refunds WHERE order_id=$1 UNION ALL SELECT order_id FROM public.order_disputes WHERE order_id=$1 AND status='open'", [o.id])).rows[0])
                    return 0;
                for (const p of profiles.rows) {
                    const amount = p.id === r.referrer_id ? row.terms.referrer_reward_kobo : row.terms.referee_reward_kobo;
                    await c.query('INSERT INTO public.wallets(customer_id) VALUES ($1) ON CONFLICT DO NOTHING', [p.id]);
                    const wallet = (await c.query<{
                        balance_kobo: string;
                    }>('SELECT balance_kobo FROM public.wallets WHERE customer_id=$1 FOR UPDATE', [p.id])).rows[0]!;
                    const balance = BigInt(wallet.balance_kobo) + BigInt(amount);
                    if (balance > 9000000000000n)
                        throw new ApiError(409, 'WALLET_LIMIT', 'Wallet balance limit reached.');
                    await c.query('UPDATE public.wallets SET balance_kobo=$2,updated_at=now() WHERE customer_id=$1', [p.id, balance.toString()]);
                    await c.query("INSERT INTO public.wallet_transactions(customer_id,kind,reference,amount_kobo,balance_after_kobo,order_id,referral_id) VALUES ($1,'referral',$2,$3,$4,$5,$6)", [p.id, `referral:${r.id}:${p.id}`, amount, balance.toString(), o.id, r.id]);
                    await c.query("SELECT vendo_internal.notify($1,$2,'referral','Referral reward received','Your referral reward was added to your wallet. Open Vendo for details.')", [p.id, `referral:${r.id}`]);
                }
                await c.query("UPDATE vendo_internal.referrals SET status='rewarded',qualifying_order_id=$2,rewarded_at=now() WHERE id=$1", [r.id, o.id]);
                return 1;
            }).catch(async error=>{
                if(error instanceof ApiError&&error.code==='WALLET_LIMIT')await this.pool.query('UPDATE vendo_internal.referrals SET last_checked_at=now() WHERE id=$1',[r.id]);
                throw error;
            });
        return rewarded;
    }
    async createTicket(user: string, input: TicketInput, key: string) {
        return this.transaction(async (c) => {
            await this.actor(c, user, false, 'UPDATE');
            const old = (await c.query('SELECT * FROM public.support_tickets WHERE customer_id=$1 AND idempotency_key=$2', [user, key])).rows[0];
            if (old) {
                if (canonical(old.input) !== canonical(input))
                    throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This request key was already used.');
                return ticketSchema.parse(serialize(old));
            }
            if (input.order_id && !(await c.query('SELECT id FROM public.orders WHERE id=$1 AND customer_id=$2', [input.order_id, user])).rows[0])
                throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
            const { rows } = await c.query('INSERT INTO public.support_tickets(customer_id,subject,category,order_id,idempotency_key,input) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [user, input.subject, input.category, input.order_id, key, JSON.stringify(input)]);
            await c.query('INSERT INTO public.support_messages(ticket_id,actor_id,message,from_support) VALUES ($1,$2,$3,false)', [rows[0].id, user, input.message]);
            return ticketSchema.parse(serialize(rows[0]));
        });
    }
    async tickets(user: string, admin: boolean, limit: number, offset: number) { return this.transaction(async (c) => { await this.actor(c, user, admin); return (await c.query('SELECT * FROM public.support_tickets WHERE ($2::boolean OR customer_id=$1) ORDER BY updated_at DESC,id LIMIT $3 OFFSET $4', [user, admin, limit, offset])).rows.map(r => ticketSchema.parse(serialize(r))); }); }
    private async authorizedTicket(c: pg.PoolClient, user: string, id: string, admin: boolean) { await this.actor(c, user, admin); const row = (await c.query('SELECT * FROM public.support_tickets WHERE id=$1 AND ($3::boolean OR customer_id=$2) FOR UPDATE', [id, user, admin])).rows[0]; if (!row)
        throw new ApiError(404, 'TICKET_NOT_FOUND', 'Support ticket not found.'); return row; }
    async ticket(user: string, id: string, admin: boolean) { return this.transaction(async (c) => { const row = await this.authorizedTicket(c, user, id, admin); return { ticket: ticketSchema.parse(serialize(row)), messages: (await c.query('SELECT * FROM public.support_messages WHERE ticket_id=$1 ORDER BY created_at,id LIMIT 200', [id])).rows.map(r => messageSchema.parse(serialize(r))) }; }); }
    async reply(user: string, id: string, message: string, admin: boolean) {
        await this.transaction(async (c) => {
            const row = await this.authorizedTicket(c, user, id, admin);
            if (row.status !== 'open')
                throw new ApiError(409, 'TICKET_CLOSED', 'This support ticket is resolved.');
            const count = (await c.query<{
                n: number;
            }>('SELECT count(*)::int AS n FROM public.support_messages WHERE ticket_id=$1', [id])).rows[0]!.n;
            if (count >= 200)
                throw new ApiError(409, 'TICKET_LIMIT', 'Start a new support ticket.');
            const inserted = await c.query('INSERT INTO public.support_messages(ticket_id,actor_id,message,from_support) VALUES ($1,$2,$3,$4) RETURNING id', [id, user, message, admin]);
            await c.query('UPDATE public.support_tickets SET updated_at=now() WHERE id=$1', [id]);
            if (admin) {
                await this.audit(c, user, 'support_replied', id);
                await c.query("SELECT vendo_internal.notify($1,$2,'support','Support replied','You have a new support reply. Open Vendo for details.')", [row.customer_id, `support:${inserted.rows[0].id}`]);
            }
        });
    }
    async resolve(user: string, id: string) { await this.transaction(async (c) => { await this.authorizedTicket(c, user, id, true); await c.query("UPDATE public.support_tickets SET status='resolved',updated_at=now() WHERE id=$1", [id]); await this.audit(c, user, 'support_resolved', id); }); }
    async publishLegal(actor: string, input: LegalInput) { return this.transaction(async (c) => { await this.actor(c, actor, true); if ((await c.query('SELECT id FROM public.legal_pages WHERE slug=$1 AND version=$2', [input.slug, input.version])).rows[0])
        throw new ApiError(409, 'LEGAL_VERSION_EXISTS', 'Publish a new legal version.'); const { rows } = await c.query('INSERT INTO public.legal_pages(slug,version,title,content) VALUES ($1,$2,$3,$4) RETURNING *', [input.slug, input.version, input.title, input.content]); await this.audit(c, actor, 'legal_published', rows[0].id); return legalSchema.parse(serialize(rows[0])); }); }
    async legal(slug?: LegalInput['slug']) { return (await this.pool.query('SELECT DISTINCT ON (slug) * FROM public.legal_pages WHERE ($1::text IS NULL OR slug=$1) ORDER BY slug,published_at DESC,id DESC', [slug ?? null])).rows.map(r => legalSchema.parse(serialize(r))); }
    async acceptLegal(user: string, id: string) { await this.transaction(async (c) => { await this.actor(c, user); if (!(await c.query('SELECT id FROM public.legal_pages WHERE id=$1', [id])).rows[0])
        throw new ApiError(404, 'LEGAL_NOT_FOUND', 'Legal page not found.'); await c.query('INSERT INTO public.legal_acceptances(profile_id,legal_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [user, id]); }); }
}
