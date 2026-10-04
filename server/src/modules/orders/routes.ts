import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { errorResponses } from '../../lib/errors.js';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import type { ProfileService } from '../users/service.js';
import { anyOrderSchema, cancellationSchema, disputeInputSchema, disputeSchema, eventSchema, policySchema, ratingInputSchema, ratingSchema, receiptSchema, scheduleSchema, type OrderRepository } from './schema.js';
export function registerOrderRoutes(app: FastifyInstance, auth: AuthGateway, profiles: ProfileService, repository: OrderRepository) {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const secured = { tags: ['Orders'], security: [{ bearerAuth: [] }] };
  const params = z.object({ id: z.uuid() });
  const identity = async (request: FastifyRequest) => { const user = await authenticate(request,auth); await profiles.get(user); return user; };
  api.get('/v1/orders/:id/timeline', { schema: { ...secured, params, querystring: z.strictObject({ limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).max(10000).default(0) }), response: { 200: z.object({ items: z.array(eventSchema), limit: z.number(), offset: z.number() }), ...errorResponses } } }, async (request) => ({ items: await repository.events((await identity(request)).id,request.params.id,request.query.limit,request.query.offset), ...request.query }));
  api.get('/v1/orders/:id/receipt', { schema: { ...secured, params, response: { 200: receiptSchema, ...errorResponses } } }, async (request) => repository.receipt((await identity(request)).id,request.params.id));
  api.get('/v1/orders/:id/cancellation', { schema: { ...secured, params, response: { 200: cancellationSchema, ...errorResponses } } }, async (request) => repository.cancellation((await identity(request)).id,request.params.id));
  api.post('/v1/orders/:id/cancel', { schema: { ...secured, params, body: z.strictObject({ reason: z.string().trim().min(3).max(500), accepted_fee_kobo: z.number().int().min(0).max(1000000000).default(0) }), response: { 200: anyOrderSchema, ...errorResponses } } }, async (request) => repository.cancel((await identity(request)).id,request.params.id,request.body.reason,request.body.accepted_fee_kobo));
  api.patch('/v1/orders/:id/schedule', { schema: { ...secured, params, body: z.strictObject({ scheduled_at: scheduleSchema }), response: { 200: anyOrderSchema, ...errorResponses } } }, async (request) => repository.reschedule((await identity(request)).id,request.params.id,request.body.scheduled_at));
  api.get('/v1/orders/:id/dispute', { schema: { ...secured, params, response: { 200: disputeSchema.nullable(), ...errorResponses } } }, async (request) => repository.dispute((await identity(request)).id,request.params.id));
  api.post('/v1/orders/:id/dispute', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, schema: { ...secured, params, body: disputeInputSchema, response: { 200: disputeSchema, ...errorResponses } } }, async (request) => (await repository.dispute((await identity(request)).id,request.params.id,request.body))!);
  api.post('/v1/admin/orders/:id/dispute/resolve', { schema: { ...secured, params, body: z.strictObject({ resolution: z.string().trim().min(10).max(2000) }), response: { 200: disputeSchema, ...errorResponses } } }, async (request) => repository.resolveDispute((await identity(request)).id,request.params.id,request.body.resolution));
  api.get('/v1/orders/:id/rating', { schema: { ...secured, params, response: { 200: ratingSchema.nullable(), ...errorResponses } } }, async (request) => repository.rating((await identity(request)).id,request.params.id));
  api.post('/v1/orders/:id/rating', { schema: { ...secured, params, body: ratingInputSchema, response: { 200: ratingSchema, ...errorResponses } } }, async (request) => (await repository.rating((await identity(request)).id,request.params.id,request.body))!);
  api.put('/v1/admin/cities/:id/order-policy', { schema: { ...secured, params, body: policySchema, response: { 200: policySchema, ...errorResponses } } }, async (request) => repository.savePolicy((await identity(request)).id,request.params.id,request.body));
  api.get('/v1/cities/:id/order-policy', { schema: { tags: ['Orders'], params, response: { 200: policySchema.nullable(), ...errorResponses } } }, async (request) => repository.policy(request.params.id));
  api.post('/v1/rider/orders/:id/status', { schema: { ...secured, params, body: z.strictObject({ action: z.enum(['picked_up','on_the_way','delivered']) }), response: { 200: anyOrderSchema, ...errorResponses } } }, async (request) => repository.riderAction((await identity(request)).id,request.params.id,request.body.action));
}
