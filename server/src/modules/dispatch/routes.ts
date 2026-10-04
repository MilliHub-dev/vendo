import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { errorResponses } from '../../lib/errors.js';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import { packageConfigSchema, sendAgainSchema, type DispatchRepository } from './schema.js';
import type { DispatchService } from './service.js';
import type { FoodService } from '../food/service.js';

export function registerDispatchRoutes(app: FastifyInstance, auth: AuthGateway, repository: DispatchRepository, dispatch: DispatchService, food: FoodService) {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const secured = { tags: ['Dispatch'], security: [{ bearerAuth: [] }] };
  const params = z.object({ id: z.uuid() });
  api.get('/v1/dispatch/packages', { schema: { tags: ['Dispatch'], querystring: z.strictObject({ city_id: z.uuid() }), response: { 200: z.object({ items: z.array(packageConfigSchema) }), ...errorResponses } } }, async (request) => ({ items: await dispatch.packages(request.query.city_id) }));
  api.put('/v1/admin/cities/:id/dispatch-packages', { schema: { ...secured, params, body: packageConfigSchema, response: { 200: packageConfigSchema, ...errorResponses } } }, async (request) => repository.savePackage((await authenticate(request, auth)).id, request.params.id, request.body));
  api.get('/v1/orders/:id/delivery-code', { schema: { ...secured, params, response: { 200: z.object({ code: z.string().regex(/^\d{4}$/) }), ...errorResponses } } }, async (request) => dispatch.code(await authenticate(request, auth), request.params.id));
  api.post('/v1/orders/:id/send-again', { schema: { ...secured, params, response: { 200: sendAgainSchema, ...errorResponses } } }, async (request) => dispatch.sendAgain(await food.order(await authenticate(request, auth), request.params.id)));
  api.post('/v1/rider/orders/:id/confirm-delivery', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, schema: { ...secured, params, body: z.strictObject({ code: z.string().regex(/^\d{4}$/) }), response: { 200: z.object({ status: z.literal('delivered') }), ...errorResponses } } }, async (request) => dispatch.complete(await authenticate(request, auth), request.params.id, request.body.code));
}
