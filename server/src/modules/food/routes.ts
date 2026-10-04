import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiError, errorResponses } from '../../lib/errors.js';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import type { ProfileService } from '../users/service.js';
import { cartSchema, categorySchema, listSchema, menuInputSchema, menuSchema, orderInputSchema, orderSchema, pricedCartSchema, quoteInputSchema, quoteSchema, vendorInputSchema, vendorSchema, type FoodRepository } from './schema.js';
import { anyOrderSchema, scheduleSchema } from '../orders/schema.js';
import { dispatchInputSchema, dispatchQuoteSchema } from '../dispatch/schema.js';
import type { DispatchService } from '../dispatch/service.js';
import type { FoodService } from './service.js';

export function registerFoodRoutes(app: FastifyInstance, auth: AuthGateway, profiles: ProfileService, repository: FoodRepository, food: FoodService, dispatch: DispatchService) {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const secured = { tags: ['Food Court'], security: [{ bearerAuth: [] }] };
  const orders = { tags: ['Orders'], security: [{ bearerAuth: [] }] };
  const idParams = z.object({ id: z.uuid() });
  api.get('/v1/vendors', { schema: { tags: ['Food Court'], querystring: listSchema, response: { 200: z.object({ items: z.array(vendorSchema), total: z.number(), limit: z.number(), offset: z.number() }), ...errorResponses } } }, async (request) => ({ ...await food.list(request.query), limit: request.query.limit, offset: request.query.offset }));
  api.get('/v1/vendors/categories', { schema: { tags: ['Food Court'], response: { 200: z.object({ categories: z.array(categorySchema) }) } } }, async () => ({ categories: categorySchema.options }));
  api.get('/v1/vendors/:id', { schema: { tags: ['Food Court'], params: idParams, response: { 200: z.object({ vendor: vendorSchema, menu: z.array(menuSchema) }), ...errorResponses } } }, async (request) => food.vendor(request.params.id));
  api.post('/v1/food/cart/validate', { schema: { ...secured, body: cartSchema, response: { 200: pricedCartSchema, ...errorResponses } } }, async (request) => food.cart(await authenticate(request, auth), request.body));
  api.post('/v1/orders/quote', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, schema: { ...orders, body: z.union([quoteInputSchema, dispatchInputSchema]), response: { 200: z.union([quoteSchema, dispatchQuoteSchema]), ...errorResponses } } }, async (request) => request.body.type === 'dispatch' ? dispatch.quote(await authenticate(request, auth), request.body) : food.quote(await authenticate(request, auth), request.body));
  api.post('/v1/orders', { schema: { ...orders, body: orderInputSchema.extend({ type: z.enum(['food', 'dispatch']).default('food'), scheduled_at: scheduleSchema.optional() }), headers: z.object({ 'idempotency-key': z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/) }).passthrough(), response: { 201: anyOrderSchema, ...errorResponses } } }, async (request, reply) => reply.code(201).send(await (request.body.type === 'dispatch' ? dispatch : food).createOrder(await authenticate(request, auth), request.body.quote_id, request.body.payment_method, request.headers['idempotency-key'], request.body.scheduled_at)));
  api.get('/v1/orders', { schema: { ...orders, querystring: z.object({ status: z.enum(['active', 'past']).default('active'), limit: z.coerce.number().int().min(1).max(50).default(20), offset: z.coerce.number().int().min(0).max(10000).default(0) }), response: { 200: z.object({ items: z.array(anyOrderSchema), limit: z.number(), offset: z.number() }), ...errorResponses } } }, async (request) => ({ items: await food.orders(await authenticate(request, auth), request.query.status, request.query.limit, request.query.offset), limit: request.query.limit, offset: request.query.offset }));
  api.get('/v1/orders/:id', { schema: { ...orders, params: idParams, response: { 200: anyOrderSchema, ...errorResponses } } }, async (request) => food.order(await authenticate(request, auth), request.params.id));
  api.post('/v1/orders/:id/reorder', { schema: { ...secured, params: idParams, response: { 200: pricedCartSchema, ...errorResponses } } }, async (request) => food.reorder(await authenticate(request, auth), request.params.id));
  const admin = async (request: Parameters<typeof authenticate>[0]) => {
    const identity = await authenticate(request, auth);
    if ((await profiles.get(identity)).role !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'Administrator access is required.');
    return identity;
  };
  api.post('/v1/admin/vendors', { schema: { ...secured, body: vendorInputSchema, response: { 201: vendorSchema, ...errorResponses } } }, async (request, reply) => reply.code(201).send(await repository.saveVendor((await admin(request)).id, request.body)));
  api.put('/v1/admin/vendors/:id', { schema: { ...secured, params: idParams, body: vendorInputSchema, response: { 200: vendorSchema, ...errorResponses } } }, async (request) => repository.saveVendor((await admin(request)).id, request.body, request.params.id));
  const menuParams = z.object({ id: z.uuid(), itemId: z.uuid() });
  api.post('/v1/admin/vendors/:id/menu', { schema: { ...secured, params: idParams, body: menuInputSchema, response: { 201: menuSchema, ...errorResponses } } }, async (request, reply) => reply.code(201).send(await repository.saveMenu((await admin(request)).id, request.params.id, request.body)));
  api.put('/v1/admin/vendors/:id/menu/:itemId', { schema: { ...secured, params: menuParams, body: menuInputSchema, response: { 200: menuSchema, ...errorResponses } } }, async (request) => repository.saveMenu((await admin(request)).id, request.params.id, request.body, request.params.itemId));
  api.post('/v1/admin/vendors/:id/staff', { schema: { ...secured, params: idParams, body: z.strictObject({ profile_id: z.uuid() }), response: { 200: z.object({ message: z.string() }), ...errorResponses } } }, async (request) => { await repository.assignStaff((await admin(request)).id, request.params.id, request.body.profile_id); return { message: 'Vendor staff assigned.' }; });
  api.post('/v1/vendor/orders/:id/action', { schema: { ...secured, params: idParams, body: z.strictObject({ action: z.enum(['accept', 'reject', 'ready']) }), response: { 200: orderSchema, ...errorResponses } } }, async (request) => {
    const identity = await authenticate(request, auth); await profiles.get(identity);
    return repository.vendorAction(identity.id, request.params.id, request.body.action);
  });
}
