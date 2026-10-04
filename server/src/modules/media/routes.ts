import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import type { ProfileService } from '../users/service.js';
import { errorResponses } from '../../lib/errors.js';
import { uploadSchema, assetSchema, type MediaRepository } from './schema.js';
export function registerMediaRoutes(app: FastifyInstance, auth: AuthGateway, profiles: ProfileService, repo: MediaRepository) {
    const api = app.withTypeProvider<ZodTypeProvider>(), shared = { tags: ['Media storage'], security: [{ bearerAuth: [] }] }, params = z.object({ id: z.uuid() });
    api.post('/v1/media', { bodyLimit: 3 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: '1 hour' } }, schema: { ...shared, body: uploadSchema, response: { 201: assetSchema, ...errorResponses } } }, async (r, p) => { const u = await authenticate(r, auth); await profiles.get(u); return p.code(201).send(await repo.upload(u.id, r.body)); });
    api.get('/v1/media/:id', { schema: { ...shared, params, response: { 200: assetSchema, ...errorResponses } } }, async (r) => { const u = await authenticate(r, auth); await profiles.get(u); return repo.get(u.id, r.params.id); });
    api.post('/v1/media/:id/download', { schema: { ...shared, params, response: { 200: z.object({ url: z.url(), expires_in: z.number().int() }), ...errorResponses } } }, async (r) => { const u = await authenticate(r, auth); await profiles.get(u); return repo.download(u.id, r.params.id); });
}
