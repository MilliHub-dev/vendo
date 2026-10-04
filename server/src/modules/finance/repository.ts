import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import { transaction, actor, audit, serialize } from '../../lib/postgres.js';
import { earningsSchema, earningsEntry, bankSchema, withdrawalSchema, type FinanceRepository, type FinancePolicy, type AccountKind, type BankInput, type TransferIntent, type VerifiedTransfer } from './schema.js';
const payout = (r: Record<string, unknown>) => withdrawalSchema.parse({ ...serialize(r), amount_kobo: Number(r.amount_kobo) });
export class PostgresFinanceRepository implements FinanceRepository {
    constructor(private readonly pool: pg.Pool) { }
    private async owner(c: pg.PoolClient, user: string, kind: AccountKind, entity: string) { const p = await actor(c, user); if (p.role !== 'admin' && (kind === 'rider' ? (entity !== user || p.role !== 'rider' || !(await c.query("SELECT profile_id FROM vendo_internal.riders WHERE profile_id=$1", [user])).rows[0]) : p.role !== 'vendor_staff' || !(await c.query('SELECT 1 FROM vendo_internal.vendor_staff WHERE profile_id=$1 AND vendor_id=$2', [user, entity])).rows[0]))
        throw new ApiError(404, 'EARNINGS_NOT_FOUND', 'Earnings account not found.'); if (!(await c.query(kind === 'rider' ? 'SELECT profile_id FROM vendo_internal.riders WHERE profile_id=$1' : 'SELECT id FROM public.vendors WHERE id=$1', [entity])).rows[0])
        throw new ApiError(404, 'EARNINGS_NOT_FOUND', 'Earnings account not found.'); await c.query('INSERT INTO vendo_internal.earnings_accounts(kind,entity_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [kind, entity]); return (await c.query<{
        id: string;
        available_kobo: string;
        held_kobo: string;
        kind: AccountKind;
        entity_id: string;
    }>('SELECT * FROM vendo_internal.earnings_accounts WHERE kind=$1 AND entity_id=$2 FOR UPDATE', [kind, entity])).rows[0]!; }
    private async move(c: pg.PoolClient, id: string, reference: string, kind: string, available: number, held: number, order: string | null, withdrawal: string | null) { if ((await c.query('SELECT id FROM vendo_internal.earnings_ledger WHERE reference=$1', [reference])).rows[0])
        return; const a = (await c.query<{
        available_kobo: string;
        held_kobo: string;
    }>('SELECT available_kobo,held_kobo FROM vendo_internal.earnings_accounts WHERE id=$1 FOR UPDATE', [id])).rows[0]!; const next = BigInt(a.available_kobo) + BigInt(available), nextHeld = BigInt(a.held_kobo) + BigInt(held); if (next < 0n || nextHeld < 0n || next > 9000000000000n || nextHeld > 9000000000000n)
        throw new ApiError(409, 'EARNINGS_LIMIT', 'Insufficient earnings or balance limit reached.'); await c.query('UPDATE vendo_internal.earnings_accounts SET available_kobo=$2,held_kobo=$3 WHERE id=$1', [id, next.toString(), nextHeld.toString()]); await c.query('INSERT INTO vendo_internal.earnings_ledger(account_id,reference,kind,available_delta,held_delta,available_after,held_after,order_id,withdrawal_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, reference, kind, available, held, next.toString(), nextHeld.toString(), order, withdrawal]); }
    async savePolicy(user: string, city: string, input: FinancePolicy) { return transaction(this.pool, async (c) => { await actor(c, user, 'admin'); await c.query('SELECT pg_advisory_xact_lock(91003010)'); if (!(await c.query('SELECT id FROM public.cities WHERE id=$1', [city])).rows[0])
        throw new ApiError(404, 'CITY_NOT_FOUND', 'City not found.'); const r = (await c.query('INSERT INTO vendo_internal.finance_policies(city_id,enabled,config) VALUES($1,$2,$3) RETURNING id', [city, input.enabled, JSON.stringify(input)])).rows[0]!; await audit(c, user, 'finance_policy_created', r.id); return { id: r.id as string, policy: input }; }); }
    async attachPolicy(user: string, order: string, policy: string) { await transaction(this.pool, async (c) => { await actor(c, user, 'admin'); const o = (await c.query('SELECT * FROM public.orders WHERE id=$1 FOR UPDATE', [order])).rows[0]; const p = (await c.query('SELECT * FROM vendo_internal.finance_policies WHERE id=$1', [policy])).rows[0]; if (!o || !p || p.city_id !== o.quote.city_id || !p.enabled)
        throw new ApiError(409, 'FINANCE_POLICY_INELIGIBLE', 'Choose an enabled policy for this order city.'); if ((await c.query('SELECT order_id FROM vendo_internal.settlements WHERE order_id=$1', [order])).rows[0])
        throw new ApiError(409, 'ORDER_SETTLED', 'Settled terms cannot change.'); const old = (await c.query('SELECT terms FROM vendo_internal.order_finance_terms WHERE order_id=$1', [order])).rows[0]; if (old?.terms)
        throw new ApiError(409, 'FINANCE_TERMS_EXISTS', 'This order already has agreed terms.'); await c.query('INSERT INTO vendo_internal.order_finance_terms(order_id,policy_id,terms) VALUES($1,$2,$3) ON CONFLICT(order_id) DO UPDATE SET policy_id=EXCLUDED.policy_id,terms=EXCLUDED.terms', [order, policy, JSON.stringify(p.config)]); await audit(c, user, 'historical_settlement_policy_attached', order); }); }
    async settle(limit: number) {
        return transaction(this.pool, async (c) => {
            await c.query('SELECT pg_advisory_xact_lock(91003010)');
            const rows = (await c.query(`SELECT o.*,t.terms FROM public.orders o JOIN vendo_internal.order_finance_terms t ON t.order_id=o.id WHERE o.status='delivered' AND o.payment_status='paid' AND o.refund_status='none' AND o.assigned_rider_id IS NOT NULL AND t.terms IS NOT NULL AND o.delivered_at+make_interval(hours=>(t.terms->>'settlement_hold_hours')::integer)<=now() AND NOT EXISTS(SELECT 1 FROM vendo_internal.settlements WHERE order_id=o.id) AND NOT EXISTS(SELECT 1 FROM public.order_disputes WHERE order_id=o.id AND status='open') AND NOT EXISTS(SELECT 1 FROM vendo_internal.order_refunds WHERE order_id=o.id) AND COALESCE((SELECT enabled FROM vendo_internal.finance_policies WHERE city_id=(o.quote->>'city_id')::uuid ORDER BY created_at DESC,id DESC LIMIT 1),false) ORDER BY o.id LIMIT $1 FOR UPDATE OF o SKIP LOCKED`, [limit])).rows;
            // Lock all balance rows in a stable order across batches and recipients.
            const beneficiaries = new Map<string, {
                kind: AccountKind;
                entity: string;
            }>();
            for (const o of rows) {
                beneficiaries.set(`rider:${o.assigned_rider_id}`, { kind: 'rider', entity: o.assigned_rider_id });
                if (o.vendor_id)
                    beneficiaries.set(`vendor:${o.vendor_id}`, { kind: 'vendor', entity: o.vendor_id });
            }
            const accounts = new Map<string, string>();
            for (const [key, b] of [...beneficiaries.entries()].sort(([a], [b]) => a.localeCompare(b))) {
                await c.query('INSERT INTO vendo_internal.earnings_accounts(kind,entity_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [b.kind, b.entity]);
                const a = (await c.query('SELECT id FROM vendo_internal.earnings_accounts WHERE kind=$1 AND entity_id=$2 FOR UPDATE', [b.kind, b.entity])).rows[0]!;
                accounts.set(key, a.id);
            }
            for (const o of rows) {
                const p = o.terms as FinancePolicy, subtotal = Number(o.quote.subtotal_kobo ?? 0), vendor = o.vendor_id ? subtotal - Math.floor(subtotal * p.vendor_commission_bps / 10000) : 0, rider = Math.floor(Number(o.quote.delivery_fee_kobo) * p.rider_delivery_bps / 10000) + p.rider_fixed_kobo, paid = Number(o.quote.total_kobo);
                await c.query('INSERT INTO vendo_internal.settlements(order_id,rider_id,vendor_id,rider_kobo,vendor_kobo,platform_kobo,paid_kobo) VALUES($1,$2,$3,$4,$5,$6,$7)', [o.id, o.assigned_rider_id, o.vendor_id, rider, vendor, paid - rider - vendor, paid]);
                await this.move(c, accounts.get(`rider:${o.assigned_rider_id}`)!, `earning:rider:${o.id}`, 'earning', rider, 0, o.id, null);
                if (o.vendor_id)
                    await this.move(c, accounts.get(`vendor:${o.vendor_id}`)!, `earning:vendor:${o.id}`, 'earning', vendor, 0, o.id, null);
                await c.query("SELECT vendo_internal.notify($1,$2,'earning','Delivery earnings available','Delivery earnings are now available. Open Vendo for details.',$3)", [o.assigned_rider_id, `earning:${o.id}`, o.id]);
            }
            return rows.length;
        });
    }
    async account(user: string, kind: AccountKind, entity: string) { return transaction(this.pool, async (c) => { const a = await this.owner(c, user, kind, entity); return earningsSchema.parse({ ...a, available_kobo: Number(a.available_kobo), held_kobo: Number(a.held_kobo), currency: 'NGN' }); }); }
    async history(user: string, kind: AccountKind, entity: string, limit: number, offset: number) { return transaction(this.pool, async (c) => { const a = await this.owner(c, user, kind, entity); return (await c.query('SELECT * FROM vendo_internal.earnings_ledger WHERE account_id=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3', [a.id, limit, offset])).rows.map(r => earningsEntry.parse({ ...serialize(r), available_delta: Number(r.available_delta), held_delta: Number(r.held_delta), available_after: Number(r.available_after), held_after: Number(r.held_after) })); }); }
    async bank(user: string, kind: AccountKind, entity: string) { return transaction(this.pool, async (c) => { const a = await this.owner(c, user, kind, entity), r = (await c.query('SELECT * FROM vendo_internal.payout_banks WHERE account_id=$1', [a.id])).rows[0]; return r ? bankSchema.parse(serialize(r)) : null; }); }
    async saveBank(user: string, kind: AccountKind, entity: string, input: BankInput, name: string, recipient: string) { return transaction(this.pool, async (c) => { const a = await this.owner(c, user, kind, entity); if ((await c.query("SELECT id FROM vendo_internal.withdrawals WHERE account_id=$1 AND status IN('requested','approved','submitting','pending','review') LIMIT 1", [a.id])).rows[0])
        throw new ApiError(409, 'PAYOUT_BANK_LOCKED', 'Resolve pending withdrawals before changing banks.'); const hash = createHash('sha256').update(`${input.bank_code}:${input.account_number}`).digest('hex'); await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [hash]); if ((await c.query('SELECT account_id FROM vendo_internal.payout_banks WHERE bank_hash=$1 AND account_id<>$2', [hash, a.id])).rows[0])
        throw new ApiError(409, 'BANK_REVIEW_REQUIRED', 'This payout bank requires support review.'); const r = (await c.query('INSERT INTO vendo_internal.payout_banks(account_id,bank_code,last_four,account_name,recipient_code,bank_hash) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(account_id) DO UPDATE SET bank_code=EXCLUDED.bank_code,last_four=EXCLUDED.last_four,account_name=EXCLUDED.account_name,recipient_code=EXCLUDED.recipient_code,bank_hash=EXCLUDED.bank_hash,updated_at=now() RETURNING *', [a.id, input.bank_code, input.account_number.slice(-4), name, recipient, hash])).rows[0]!; await audit(c, user, 'payout_bank_saved', a.id); return bankSchema.parse(serialize(r)); }); }
    async withdraw(user: string, kind: AccountKind, entity: string, amount: number, key: string) { return transaction(this.pool, async (c) => { const a = await this.owner(c, user, kind, entity), old = (await c.query('SELECT * FROM vendo_internal.withdrawals WHERE account_id=$1 AND idempotency_key=$2', [a.id, key])).rows[0]; if (old) {
        if (Number(old.amount_kobo) !== amount || old.requested_by !== user)
            throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This withdrawal key was already used.');
        return payout(old);
    } const city = (await c.query(kind === 'rider' ? 'SELECT city_id FROM vendo_internal.riders WHERE profile_id=$1' : 'SELECT city_id FROM public.vendors WHERE id=$1', [entity])).rows[0]!.city_id; const policy = (await c.query<{
        enabled: boolean;
        config: FinancePolicy;
    }>('SELECT * FROM vendo_internal.finance_policies WHERE city_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1', [city])).rows[0]; if (!policy?.enabled || amount < policy.config.minimum_withdrawal_kobo)
        throw new ApiError(409, 'WITHDRAWAL_UNAVAILABLE', 'Withdrawals are disabled or the minimum amount is not met.'); const bank = (await c.query('SELECT recipient_code FROM vendo_internal.payout_banks WHERE account_id=$1', [a.id])).rows[0]; if (!bank)
        throw new ApiError(409, 'PAYOUT_BANK_REQUIRED', 'Resolve a payout bank first.'); const id = randomUUID(), r = (await c.query('INSERT INTO vendo_internal.withdrawals(id,account_id,requested_by,reference,idempotency_key,amount_kobo,recipient_code) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [id, a.id, user, `vd-w-${id}`, key, amount, bank.recipient_code])).rows[0]!; await this.move(c, a.id, `hold:${id}`, 'hold', -amount, amount, null, id); return payout(r); }); }
    async withdrawals(user: string, kind: AccountKind | undefined, entity: string | undefined, limit: number, offset: number) { return transaction(this.pool, async (c) => { const id = kind && entity ? (await this.owner(c, user, kind, entity)).id : null; if (!id)
        await actor(c, user, 'admin'); return (await c.query('SELECT * FROM vendo_internal.withdrawals WHERE ($1::uuid IS NULL OR account_id=$1) ORDER BY created_at DESC,id LIMIT $2 OFFSET $3', [id, limit, offset])).rows.map(payout); }); }
    async review(user: string, id: string, decision: 'approve' | 'reject', note: string) { return transaction(this.pool, async (c) => { await actor(c, user, 'admin'); const initial = (await c.query('SELECT account_id FROM vendo_internal.withdrawals WHERE id=$1', [id])).rows[0]; if (!initial)
        throw new ApiError(404, 'WITHDRAWAL_NOT_FOUND', 'Withdrawal not found.'); await c.query('SELECT id FROM vendo_internal.earnings_accounts WHERE id=$1 FOR UPDATE', [initial.account_id]); const w = (await c.query('SELECT * FROM vendo_internal.withdrawals WHERE id=$1 FOR UPDATE', [id])).rows[0]!; const target = decision === 'approve' ? 'approved' : 'rejected'; if (w.status === target)
        return payout(w); if (w.status !== 'requested')
        throw new ApiError(409, 'WITHDRAWAL_ALREADY_REVIEWED', 'This withdrawal cannot be reviewed again.'); if (decision === 'reject')
        await this.move(c, w.account_id, `release:${id}`, 'release', Number(w.amount_kobo), -Number(w.amount_kobo), null, id); const r = (await c.query('UPDATE vendo_internal.withdrawals SET status=$2,review_note=$3,updated_at=now() WHERE id=$1 RETURNING *', [id, target, note])).rows[0]!; await audit(c, user, `withdrawal_${target}`, id); return payout(r); }); }
    async claim(): Promise<TransferIntent | null> { return transaction(this.pool, async (c) => { const w = (await c.query("SELECT w.* FROM vendo_internal.withdrawals w JOIN vendo_internal.earnings_accounts a ON a.id=w.account_id WHERE w.status='approved' AND COALESCE((SELECT p.enabled FROM vendo_internal.finance_policies p WHERE p.city_id=CASE WHEN a.kind='rider' THEN (SELECT city_id FROM vendo_internal.riders WHERE profile_id=a.entity_id) ELSE (SELECT city_id FROM public.vendors WHERE id=a.entity_id) END ORDER BY p.created_at DESC,p.id DESC LIMIT 1),false) ORDER BY w.created_at,w.id LIMIT 1 FOR UPDATE OF w SKIP LOCKED")).rows[0]; if (!w)
        return null; await c.query("UPDATE vendo_internal.withdrawals SET status='submitting',updated_at=now(),last_checked_at=now() WHERE id=$1", [w.id]); return { ...payout({ ...w, status: 'submitting' }), recipient_code: w.recipient_code as string, fresh: true }; }); }
    async pending(limit: number) { return (await this.pool.query<{
        reference: string;
    }>("SELECT w.reference FROM vendo_internal.withdrawals w WHERE w.status IN('submitting','pending','review','succeeded') AND (w.status<>'submitting' OR w.updated_at<now()-interval '60 seconds') AND (w.status<>'succeeded' OR w.updated_at>now()-interval '30 days' OR EXISTS(SELECT 1 FROM vendo_internal.transfer_events e WHERE e.reference=w.reference AND e.processed_at IS NULL)) ORDER BY EXISTS(SELECT 1 FROM vendo_internal.transfer_events e WHERE e.reference=w.reference AND e.processed_at IS NULL) DESC,w.last_checked_at ASC NULLS FIRST,w.created_at,w.id LIMIT $1", [limit])).rows.map(r => r.reference); }
    async apply(reference: string, t: VerifiedTransfer) { await transaction(this.pool, async (c) => { const initial = (await c.query('SELECT account_id FROM vendo_internal.withdrawals WHERE reference=$1', [reference])).rows[0]; if (!initial)
        return; await c.query('SELECT id FROM vendo_internal.earnings_accounts WHERE id=$1 FOR UPDATE', [initial.account_id]); const w = (await c.query('SELECT * FROM vendo_internal.withdrawals WHERE reference=$1 FOR UPDATE', [reference])).rows[0]!; if (t.reference !== reference || t.amount !== Number(w.amount_kobo) || t.currency !== 'NGN' || t.recipient_code !== w.recipient_code || w.provider_code && w.provider_code !== t.transfer_code)
        throw new ApiError(409, 'TRANSFER_MISMATCH', 'Transfer verification does not match this withdrawal.'); if (['rejected', 'failed', 'reversed', 'requested', 'approved'].includes(w.status))
        return; let target = w.status; const amount = Number(w.amount_kobo); if (t.status === 'success') {
        if (w.status !== 'succeeded')
            await this.move(c, w.account_id, `payout:${w.id}`, 'payout', 0, -amount, null, w.id);
        target = 'succeeded';
    }
    else if (t.status === 'failed' || t.status === 'reversed') {
        if (w.status === 'succeeded') {
            if (t.status !== 'reversed')
                throw new ApiError(409, 'TRANSFER_MISMATCH', 'A settled transfer cannot become failed.');
            await this.move(c, w.account_id, `reversal:${w.id}`, 'reversal', amount, 0, null, w.id);
        }
        else
            await this.move(c, w.account_id, `release:${w.id}`, 'release', amount, -amount, null, w.id);
        target = t.status;
    }
    else if (w.status !== 'succeeded')
        target = t.status === 'pending' || t.status === 'ongoing' ? 'pending' : 'review'; await c.query('UPDATE vendo_internal.withdrawals SET status=$2,provider_code=$3,last_checked_at=now(),updated_at=CASE WHEN status<>$2 THEN now() ELSE updated_at END WHERE id=$1', [w.id, target, t.transfer_code]); await c.query('UPDATE vendo_internal.transfer_events SET processed_at=now() WHERE reference=$1', [reference]); if (target !== w.status)
        await c.query("SELECT vendo_internal.notify($1,$2,'payout','Withdrawal update','Your withdrawal status changed. Open Vendo for details.')", [w.requested_by, `withdrawal:${w.id}:${target}`]); }); }
    async uncertain(id: string) { await this.pool.query("UPDATE vendo_internal.withdrawals SET status=CASE WHEN status='submitting' THEN 'review' ELSE status END,last_checked_at=now() WHERE id::text=$1 OR reference=$1", [id]); }
    async enqueue(digest: string, event: string, reference: string) { await this.pool.query('INSERT INTO vendo_internal.transfer_events(digest,event,reference) SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM vendo_internal.withdrawals WHERE reference=$3) ON CONFLICT DO NOTHING', [digest, event, reference]); }
}
