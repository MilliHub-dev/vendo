import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiError, errorResponses } from '../../lib/errors.js';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import { requireCompleteProfile, type ProfileService } from '../users/service.js';
import { payoutBankSchema, type PayoutBanks } from './banks.js';
import { riderSummarySchema, riderTripSchema, type RiderAppRepository } from './repository.js';

export function registerRiderAppRoutes(app: FastifyInstance, auth: AuthGateway, profiles: ProfileService, repository: RiderAppRepository | undefined, banks: PayoutBanks | undefined): void {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const secured = { tags: ['Rider app'], security: [{ bearerAuth: [] }] };
  const identity = async (request: FastifyRequest) => { const user = await authenticate(request, auth); requireCompleteProfile(await profiles.get(user)); return user; };
  // always after the sign-in check, so an unauthenticated caller learns nothing about what is configured
  const need = <T>(value: T | undefined): T => { if (!value) throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED', 'This service is not configured yet.'); return value; };

  api.get('/v1/riders/me/summary', { schema: { ...secured, summary: 'The rider’s rating and counts, and what the current offer or delivery pays', response: { 200: riderSummarySchema, ...errorResponses } } },
    async (request) => { const user = await identity(request); return need(repository).summary(user.id); });
  api.get('/v1/riders/me/trips', { schema: { ...secured, summary: 'The rider’s completed deliveries, newest first', querystring: z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).max(100000).default(0) }), response: { 200: z.object({ items: z.array(riderTripSchema) }), ...errorResponses } } },
    async (request) => { const user = await identity(request); return { items: await need(repository).trips(user.id, request.query.limit, request.query.offset) }; });
  api.get('/v1/payout-banks', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } }, schema: { ...secured, tags: ['Earnings & payouts'], summary: 'Banks a payout account can be held at', response: { 200: z.object({ items: z.array(payoutBankSchema) }), ...errorResponses } } },
    async (request) => { await identity(request); return { items: await need(banks).list() }; });
}
