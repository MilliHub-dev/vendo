import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import { transaction, actor, serialize } from '../../lib/postgres.js';
import { messageSchema, type ChatRepository } from './schema.js';
export class PostgresChatRepository implements ChatRepository {
    constructor(private readonly pool: pg.Pool) { }
    private async own(c: pg.PoolClient, user: string, id: string) { const p = await actor(c, user); const o = (await c.query<{
        id: string;
        customer_id: string;
        assigned_rider_id: string | null;
        status: string;
        payment_status: string;
    }>(`SELECT * FROM public.orders WHERE id=$1 AND (customer_id=$2 OR ( $3='rider' AND (assigned_rider_id=$2 OR EXISTS(SELECT 1 FROM public.order_messages WHERE order_id=$1 AND rider_id=$2)))) FOR SHARE`, [id, user, p.role])).rows[0]; if (!o)
        throw new ApiError(404, 'CHAT_NOT_FOUND', 'Order chat not found.'); return o; }
    async list(user: string, order: string, after: string, limit: number) { return transaction(this.pool, async (c) => { const o = await this.own(c, user, order); const last = (await c.query<{
        last_read_seq: string;
    }>('SELECT last_read_seq FROM vendo_internal.chat_reads WHERE order_id=$1 AND profile_id=$2', [order, user])).rows[0]?.last_read_seq ?? '0'; const rows = await c.query('SELECT * FROM public.order_messages WHERE order_id=$1 AND seq>$3 AND ($2::uuid=$4::uuid OR rider_id=$2) ORDER BY seq LIMIT $5', [order, user, after, o.customer_id, limit]); const unread = (await c.query<{
        n: number;
    }>('SELECT count(*)::int AS n FROM public.order_messages WHERE order_id=$1 AND seq>$3 AND sender_id<>$2 AND ($2::uuid=$4::uuid OR rider_id=$2)', [order, user, last, o.customer_id])).rows[0]!.n; return { order_id: order, current_rider_id: user === o.customer_id || user === o.assigned_rider_id ? o.assigned_rider_id : null, can_send: Boolean(o.assigned_rider_id && o.payment_status === 'paid' && ['rider_assigned', 'picked_up', 'on_the_way'].includes(o.status) && (user === o.customer_id || user === o.assigned_rider_id)), last_read_seq: String(last), unread, messages: rows.rows.map(r => messageSchema.parse({ ...serialize(r), seq: String(r.seq) })) }; }); }
    async send(user: string, order: string, text: string, key: string) { return transaction(this.pool, async (c) => { const o = await this.own(c, user, order); await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${user}:${key}`]); const old = (await c.query('SELECT * FROM public.order_messages WHERE sender_id=$1 AND idempotency_key=$2', [user, key])).rows[0]; if (old) {
        if (old.order_id !== order || old.text !== text)
            throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This request key was already used.');
        return messageSchema.parse({ ...serialize(old), seq: String(old.seq) });
    } if (!o.assigned_rider_id || o.payment_status !== 'paid' || !['rider_assigned', 'picked_up', 'on_the_way'].includes(o.status) || ![o.customer_id, o.assigned_rider_id].includes(user))
        throw new ApiError(409, 'CHAT_CLOSED', 'Chat is available only during an assigned active delivery.'); const rider = (await c.query("SELECT r.profile_id FROM vendo_internal.riders r JOIN public.profiles p ON p.id=r.profile_id WHERE r.profile_id=$1 AND r.approval='approved' AND p.role='rider' AND p.status='active'", [o.assigned_rider_id])).rows[0]; if (!rider)
        throw new ApiError(409, 'CHAT_CLOSED', 'This rider is not available for chat.'); const { rows } = await c.query('INSERT INTO public.order_messages(order_id,customer_id,rider_id,sender_id,text,idempotency_key) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [order, o.customer_id, o.assigned_rider_id, user, text, key]); const recipient = user === o.customer_id ? o.assigned_rider_id : o.customer_id; await c.query("SELECT vendo_internal.notify($1,$2,'chat','New delivery message','You have a new delivery message. Open Vendo to read it.',$3)", [recipient, `chat:${rows[0].id}`, order]); return messageSchema.parse({ ...serialize(rows[0]), seq: String(rows[0].seq) }); }); }
    async read(user: string, order: string, seq: string) { await transaction(this.pool, async (c) => { const o = await this.own(c, user, order); if (!(await c.query('SELECT id FROM public.order_messages WHERE order_id=$1 AND seq=$2 AND ($3::uuid=$4::uuid OR rider_id=$3)', [order, seq, user, o.customer_id])).rows[0])
        throw new ApiError(404, 'MESSAGE_NOT_FOUND', 'Message not found.'); await c.query('INSERT INTO vendo_internal.chat_reads(order_id,profile_id,last_read_seq) VALUES($1,$2,$3) ON CONFLICT(order_id,profile_id) DO UPDATE SET last_read_seq=greatest(chat_reads.last_read_seq,EXCLUDED.last_read_seq)', [order, user, seq]); }); }
}
