import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { ApiError, errorResponses } from '../../lib/errors.js';
import type { Limits } from '../../integrations/limits.js';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import { pointSchema, routeGeometrySchema } from '../food/schema.js';
import { addressInputSchema, addressPatchSchema, addressSchema, citySchema, placeSchema, polygonSchema, reverseSchema, searchSchema } from './schema.js';
import { citySummary, type AddressService } from './service.js';
export function registerAddressRoutes(app: FastifyInstance, auth: AuthGateway, service: AddressService, limits: Limits) {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const secured = { tags: ['Addresses & maps'], security: [{ bearerAuth: [] }] };
  const idParams = z.object({ id: z.uuid() });
  const identity = async (request: FastifyRequest) => { const user = await authenticate(request, auth); await service.active(user); return user; };
  const lookupUser = async (request: FastifyRequest) => {
    const user = await identity(request);
    if (!await limits.consume(`vendo:maps:${createHash('sha256').update(user.id).digest('hex')}`, 60, 60)) throw new ApiError(429, 'RATE_LIMITED', 'Too many map requests. Please try again later.');
    return user;
  };
  api.get('/v1/cities', { schema: { tags: ['Addresses & maps'], response: { 200: z.object({ items: z.array(citySchema) }), ...errorResponses } } }, async () => ({ items: await service.cities() }));
  api.get('/v1/cities/:id', { schema: { tags: ['Addresses & maps'], params: idParams, response: { 200: citySchema, ...errorResponses } } }, async (request) => citySummary(await service.city(request.params.id)));
  api.post('/v1/maps/service-area', { schema: { tags: ['Addresses & maps'], body: pointSchema.extend({ city_id: z.uuid().optional() }), response: { 200: z.object({ serviceable: z.boolean(), city: citySchema.nullable(), reason: z.enum(['city_unavailable', 'outside_service_area', 'city_closed', 'service_area_not_configured']).nullable() }), ...errorResponses } } }, async (request) => service.check(request.body, request.body.city_id));
  api.get('/v1/maps/search', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } }, schema: { ...secured, querystring: searchSchema, response: { 200: z.object({ items: z.array(placeSchema), attribution: z.string() }), ...errorResponses } } }, async (request) => ({ items: await service.search(await lookupUser(request), request.query), attribution: '© OpenStreetMap contributors' }));
  api.get('/v1/maps/reverse', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } }, schema: { ...secured, querystring: reverseSchema, response: { 200: z.object({ items: z.array(placeSchema), attribution: z.string() }), ...errorResponses } } }, async (request) => ({ items: await service.reverse(await lookupUser(request), request.query, request.query.city_id), attribution: '© OpenStreetMap contributors' }));
  api.post('/v1/maps/route', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, schema: { ...secured, body: z.strictObject({ city_id: z.uuid(), pickup: pointSchema, dropoff: pointSchema }), response: { 200: z.object({ city_id: z.uuid(), profile: z.literal('driving'), distance_m: z.number().int().min(0), duration_s: z.number().int().min(0), geometry: routeGeometrySchema.optional() }), ...errorResponses } } }, async (request) => service.route(await lookupUser(request), request.body.city_id, request.body.pickup, request.body.dropoff));
  api.put('/v1/admin/cities/:id/service-area', { schema: { ...secured, params: idParams, body: z.strictObject({ polygon: polygonSchema }), response: { 200: citySchema, ...errorResponses } } }, async (request) => citySummary(await service.repository.saveBoundary((await identity(request)).id, request.params.id, request.body.polygon)));
  api.get('/v1/me/addresses', { schema: { ...secured, response: { 200: z.object({ items: z.array(addressSchema) }), ...errorResponses } } }, async (request) => ({ items: await service.repository.list((await identity(request)).id) }));
  api.get('/v1/me/addresses/:id', { schema: { ...secured, params: idParams, response: { 200: addressSchema, ...errorResponses } } }, async (request) => {
    const row = await service.repository.get((await identity(request)).id, request.params.id);
    if (!row) throw new ApiError(404, 'ADDRESS_NOT_FOUND', 'Address not found.'); return row;
  });
  api.post('/v1/me/addresses', { schema: { ...secured, body: addressInputSchema, response: { 201: addressSchema, ...errorResponses } } }, async (request, reply) => reply.code(201).send(await service.repository.save((await identity(request)).id, request.body)));
  api.patch('/v1/me/addresses/:id', { schema: { ...secured, params: idParams, body: addressPatchSchema, response: { 200: addressSchema, ...errorResponses } } }, async (request) => service.repository.save((await identity(request)).id, request.body, request.params.id));
  api.delete('/v1/me/addresses/:id', { schema: { ...secured, params: idParams, response: { 200: z.object({ message: z.string() }), ...errorResponses } } }, async (request) => { await service.repository.delete((await identity(request)).id, request.params.id); return { message: 'Address deleted.' }; });
  const preferred = z.object({ city_id: z.uuid().nullable(), city: citySchema.nullable() });
  api.get('/v1/me/city', { schema: { ...secured, response: { 200: preferred, ...errorResponses } } }, async (request) => service.preferred(await identity(request)));
  api.patch('/v1/me/city', { schema: { ...secured, body: z.strictObject({ city_id: z.uuid().nullable() }), response: { 200: preferred, ...errorResponses } } }, async (request) => { const user = await identity(request); await service.repository.setCity(user.id, request.body.city_id); return service.preferred(user); });
}
