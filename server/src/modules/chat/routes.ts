import { Readable } from 'node:stream';
import { setTimeout } from 'node:timers/promises';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import type { ProfileService } from '../users/service.js';
import { ApiError, errorResponses } from '../../lib/errors.js';
import { cursor, messageInput, messageSchema, conversationSchema, type ChatRepository } from './schema.js';
export function registerChatRoutes(app: FastifyInstance, auth: AuthGateway, profiles: ProfileService, repo: ChatRepository) {
    const api = app.withTypeProvider<ZodTypeProvider>(), shared = { tags: ['Delivery chat'], security: [{ bearerAuth: [] }] }, params = z.object({ id: z.uuid() }), query = z.strictObject({ after_seq: cursor, limit: z.coerce.number().int().min(1).max(100).default(50) });
    const identity = async (r: FastifyRequest) => { const u = await authenticate(r, auth); await profiles.get(u); return u.id; };
    api.get('/v1/orders/:id/chat', { schema: { ...shared, params, querystring: query, response: { 200: conversationSchema, ...errorResponses } } }, async (r) => repo.list(await identity(r), r.params.id, r.query.after_seq, r.query.limit));
    api.post('/v1/orders/:id/chat/messages', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, schema: { ...shared, params, headers: z.object({ 'idempotency-key': z.string().regex(/^[A-Za-z0-9_-]{8,100}$/) }), body: messageInput, response: { 201: messageSchema, ...errorResponses } } }, async (r, p) => p.code(201).send(await repo.send(await identity(r), r.params.id, r.body.text, r.headers['idempotency-key'])));
    api.post('/v1/orders/:id/chat/read', { schema: { ...shared, params, body: z.strictObject({ seq: cursor }), response: { 200: z.object({ ok: z.literal(true) }), ...errorResponses } } }, async (r) => { await repo.read(await identity(r), r.params.id, r.body.seq); return { ok: true as const }; });
    const streams = new Set<AbortController>(), counts = new Map<string, number>();
    app.addHook('preClose', async () => { for (const s of streams)
        s.abort(); });
    api.get('/v1/orders/:id/chat/stream', { schema: { ...shared, params, querystring: query, description: 'Bearer-authenticated SSE with resumable after_seq cursor. Rechecks access every two seconds; ended deliveries close after backlog is delivered.' } }, async (r, p) => {
        const user = await identity(r);
        if (streams.size >= 200 || (counts.get(user) ?? 0) >= 2)
            throw new ApiError(429, 'STREAM_LIMIT', 'Close an existing chat stream.');
        const first = await repo.list(user, r.params.id, r.query.after_seq, r.query.limit);
        if (streams.size >= 200 || (counts.get(user) ?? 0) >= 2)
            throw new ApiError(429, 'STREAM_LIMIT', 'Close an existing chat stream.');
        const c = new AbortController();
        streams.add(c);
        counts.set(user, (counts.get(user) ?? 0) + 1);
        let closed = false;
        const close = () => { if (closed)
            return; closed = true; c.abort(); streams.delete(c); const n = (counts.get(user) ?? 1) - 1; if (n)
            counts.set(user, n);
        else
            counts.delete(user); };
        p.raw.once('close', close);
        const stream = Readable.from((async function* () { let data = first, after = r.query.after_seq; try {
            while (!c.signal.aborted) {
                if (data.messages.length)
                    after = data.messages.at(-1)!.seq;
                yield `id: ${after}\nevent: chat\ndata: ${JSON.stringify(data)}\n\n`;
                if (!data.can_send && data.messages.length < r.query.limit)
                    break;
                if (data.messages.length < r.query.limit)
                    await setTimeout(2000, undefined, { signal: c.signal });
                await identity(r);
                data = await repo.list(user, r.params.id, after, r.query.limit);
            }
        }
        catch { /* Revocation or disconnection closes the stream. */ }
        finally {
            close();
        } })());
        return p.header('content-type', 'text/event-stream').header('cache-control', 'no-store').header('x-accel-buffering', 'no').send(stream);
    });
}
