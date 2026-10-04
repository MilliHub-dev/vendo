import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import { requireCompleteProfile, type ProfileService } from '../users/service.js';
import { errorResponses, ApiError } from '../../lib/errors.js';
import { menuInputSchema, menuSchema, orderSchema, type FoodRepository } from '../food/schema.js';
import { anyOrderSchema } from '../orders/schema.js';
import type { OperationsRepository } from '../operations/schema.js';
import type { MediaRepository } from '../media/schema.js';
import { mimeSchema, assetSchema } from '../media/schema.js';
import { registrationInput, applicationSchema, applicationQuery, page, orderQuery, storeSchema, storePatch, summarySchema, type VendorRepository } from './schema.js';
export function registerVendorRoutes(app: FastifyInstance, auth: AuthGateway, profiles: ProfileService, repo: VendorRepository, operations: OperationsRepository, food: FoodRepository, media: MediaRepository) {
    const api = app.withTypeProvider<ZodTypeProvider>(), shared = { tags: ['Vendor portal'], security: [{ bearerAuth: [] }] }, params = z.object({ id: z.uuid() }), itemParams = params.extend({ itemId: z.uuid() }), orderParams = params.extend({ orderId: z.uuid() }), ok = z.object({ ok: z.literal(true) });
    const user = async (r: FastifyRequest, admin = false) => { const u = await authenticate(r, auth), p = await profiles.get(u); requireCompleteProfile(p); if (admin && p.role !== 'admin')
        throw new ApiError(403, 'FORBIDDEN', 'Administrator access required.'); return u.id; };
    api.post('/v1/vendor/registration', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } }, schema: { ...shared, headers: z.object({ 'idempotency-key': z.string().regex(/^[A-Za-z0-9_-]{8,100}$/) }), body: registrationInput, response: { 201: applicationSchema, ...errorResponses } } }, async (r, p) => p.code(201).send(await repo.register(await user(r), r.body, r.headers['idempotency-key'])));
    api.get('/v1/vendor/registration', { schema: { ...shared, response: { 200: applicationSchema.nullable(), ...errorResponses } } }, async (r) => (await repo.applications(await user(r), 1, 0))[0] ?? null);
    api.get('/v1/vendor/registrations', { schema: { ...shared, querystring: page, response: { 200: z.array(applicationSchema), ...errorResponses } } }, async (r) => repo.applications(await user(r), r.query.limit, r.query.offset));
    api.post('/v1/vendor/registrations/:id/withdraw', { schema: { ...shared, params, response: { 200: applicationSchema, ...errorResponses } } }, async (r) => repo.withdraw(await user(r), r.params.id));
    api.get('/v1/admin/vendor-applications', { schema: { ...shared, querystring: applicationQuery, response: { 200: z.array(applicationSchema), ...errorResponses } } }, async (r) => repo.applications(await user(r, true), r.query.limit, r.query.offset, r.query.status, true));
    api.post('/v1/admin/vendor-applications/:id/review', { schema: { ...shared, params, body: z.strictObject({ decision: z.enum(['approve', 'reject']), note: z.string().trim().min(10).max(1000) }), response: { 200: applicationSchema, ...errorResponses } } }, async (r) => repo.review(await user(r, true), r.params.id, r.body.decision, r.body.note));
    api.get('/v1/vendor/stores', { schema: { ...shared, querystring: page, response: { 200: z.array(storeSchema), ...errorResponses } } }, async (r) => repo.stores(await user(r), r.query.limit, r.query.offset));
    const prefix = '/v1/vendor/stores/:id';
    api.get(prefix, { schema: { ...shared, params, response: { 200: storeSchema, ...errorResponses } } }, async (r) => repo.store(await user(r), r.params.id));
    api.patch(prefix, { schema: { ...shared, params, body: storePatch, response: { 200: storeSchema, ...errorResponses } } }, async (r) => repo.update(await user(r), r.params.id, r.body));
    api.get(`${prefix}/summary`, { schema: { ...shared, params, response: { 200: summarySchema, ...errorResponses } } }, async (r) => repo.summary(await user(r), r.params.id));
    api.put(`${prefix}/availability`, { schema: { ...shared, params, body: z.strictObject({ is_open: z.boolean() }), response: { 200: ok, ...errorResponses } } }, async (r) => { const u = await user(r); await repo.store(u, r.params.id); await operations.vendorOpen(u, r.params.id, r.body.is_open); return { ok: true as const }; });
    api.get(`${prefix}/menu`, { schema: { ...shared, params, response: { 200: z.array(menuSchema), ...errorResponses } } }, async (r) => operations.vendorMenu(await user(r), r.params.id));
    api.post(`${prefix}/menu`, { schema: { ...shared, params, body: menuInputSchema, response: { 201: menuSchema, ...errorResponses } } }, async (r, p) => p.code(201).send(await operations.saveMenu(await user(r), r.params.id, undefined, r.body)));
    api.put(`${prefix}/menu/:itemId`, { schema: { ...shared, params: itemParams, body: menuInputSchema, response: { 200: menuSchema, ...errorResponses } } }, async (r) => operations.saveMenu(await user(r), r.params.id, r.params.itemId, r.body));
    api.get(`${prefix}/orders`, { schema: { ...shared, params, querystring: orderQuery, response: { 200: z.array(anyOrderSchema), ...errorResponses } } }, async (r) => repo.orders(await user(r), r.params.id, r.query.limit, r.query.offset, r.query.status));
    api.get(`${prefix}/orders/:orderId`, { schema: { ...shared, params: orderParams, response: { 200: anyOrderSchema, ...errorResponses } } }, async (r) => repo.order(await user(r), r.params.id, r.params.orderId));
    api.post(`${prefix}/orders/:orderId/action`, { schema: { ...shared, params: orderParams, body: z.strictObject({ action: z.enum(['accept', 'reject', 'ready']) }), response: { 200: orderSchema, ...errorResponses } } }, async (r) => { const u = await user(r); await repo.order(u, r.params.id, r.params.orderId); return food.vendorAction(u, r.params.orderId, r.body.action); });
    api.post(`${prefix}/media`, { bodyLimit: 3 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: '1 hour' } }, schema: { ...shared, params, body: z.strictObject({ purpose: z.enum(['logo', 'image']), mime: mimeSchema, data_base64: z.string().min(4).max(2796204) }).refine(v => v.mime.startsWith('image/'), 'Use an image.'), response: { 201: assetSchema, ...errorResponses } } }, async (r, p) => p.code(201).send(await media.upload(await user(r), { ...r.body, vendor_id: r.params.id })));
}
