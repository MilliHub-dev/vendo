import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiError, errorResponses } from '../../lib/errors.js';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import type { ProfileService } from '../users/service.js';
import { page, idParams } from '../extras/schema.js';
import { adminPushInput, adminPushResult, notificationSchema, deviceInput, deviceSchema, type NotificationRepository } from './schema.js';
export function registerNotificationRoutes(app: FastifyInstance, auth: AuthGateway, profiles: ProfileService, repo: NotificationRepository) {
    const api = app.withTypeProvider<ZodTypeProvider>(), shared = { tags: ['Notifications'], security: [{ bearerAuth: [] }] }, ok = z.object({ status: z.literal('ok') });
    const user = async (r: Parameters<typeof authenticate>[0]) => { const identity = await authenticate(r, auth); await profiles.get(identity); return identity.id; };
    api.post('/v1/admin/notifications/push', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } }, schema: { ...shared, headers: z.object({ 'idempotency-key': z.string().regex(/^[A-Za-z0-9_-]{8,100}$/) }), body: adminPushInput, response: { 202: adminPushResult, ...errorResponses } } }, async (r, p) => {
        const identity = await authenticate(r, auth), profile = await profiles.get(identity);
        if (profile.role !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'Administrator access is required.');
        return p.code(202).send(await repo.sendAdminPush(identity.id, r.body, r.headers['idempotency-key']));
    });
    api.get('/v1/me/notifications', { schema: { ...shared, querystring: page, response: { 200: z.object({ items: z.array(notificationSchema), unread: z.number().int() }), ...errorResponses } } }, async (r) => repo.inbox(await user(r), r.query.limit, r.query.offset));
    api.post('/v1/me/notifications/read-all', { schema: { ...shared, response: { 200: ok, ...errorResponses } } }, async (r) => { await repo.read(await user(r)); return { status: 'ok' as const }; });
    api.post('/v1/me/notifications/:id/read', { schema: { ...shared, params: idParams, response: { 200: ok, ...errorResponses } } }, async (r) => { await repo.read(await user(r), r.params.id); return { status: 'ok' as const }; });
    api.get('/v1/me/devices', { schema: { ...shared, response: { 200: z.array(deviceSchema), ...errorResponses } } }, async (r) => repo.devices(await user(r)));
    api.post('/v1/me/devices', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } }, schema: { ...shared, body: deviceInput, response: { 200: deviceSchema, ...errorResponses } } }, async (r) => repo.register(await user(r), r.body));
    api.delete('/v1/me/devices/:id', { schema: { ...shared, params: idParams, response: { 200: ok, ...errorResponses } } }, async (r) => { await repo.remove(await user(r), r.params.id); return { status: 'ok' as const }; });
}
