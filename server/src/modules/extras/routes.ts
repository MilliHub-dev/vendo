import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiError, errorResponses } from '../../lib/errors.js';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import { requireCompleteProfile, type ProfileService } from '../users/service.js';
import { page, idParams, promoCode, promoInput, promoOutput, referralPolicy, referralOverview, ticketInput, ticketSchema, replyInput, messageSchema, legalSlug, legalInput, legalSchema, type ExtrasRepository } from './schema.js';
export function registerExtrasRoutes(app: FastifyInstance, auth: AuthGateway, profiles: ProfileService, repo: ExtrasRepository, contact: {
    phone: string | null;
    email: string | null;
}) {
    const api = app.withTypeProvider<ZodTypeProvider>(), shared = { tags: ['Customer extras'], security: [{ bearerAuth: [] }] }, ok = z.object({ status: z.literal('ok') });
    const user = async (request: Parameters<typeof authenticate>[0], admin = false, complete = false) => { const identity = await authenticate(request, auth), profile = await profiles.get(identity); if (complete)
        requireCompleteProfile(profile); if (admin && profile.role !== 'admin')
        throw new ApiError(403, 'FORBIDDEN', 'Administrator access is required.'); return identity.id; };
    api.get('/v1/admin/promos', { schema: { ...shared, response: { 200: z.array(promoOutput), ...errorResponses } } }, async (r) => repo.promos(await user(r, true)));
    api.post('/v1/admin/promos', { schema: { ...shared, body: promoInput, response: { 201: promoOutput, ...errorResponses } } }, async (r, p) => p.code(201).send(await repo.savePromo(await user(r, true), r.body)));
    api.put('/v1/admin/promos/:id', { schema: { ...shared, params: idParams, body: promoInput, response: { 200: promoOutput, ...errorResponses } } }, async (r) => repo.savePromo(await user(r, true), r.body, r.params.id));
    api.put('/v1/admin/referrals/policy', { schema: { ...shared, body: referralPolicy, response: { 200: referralPolicy, ...errorResponses } } }, async (r) => repo.setReferralPolicy(await user(r, true), r.body));
    api.get('/v1/me/referrals', { schema: { ...shared, response: { 200: referralOverview, ...errorResponses } } }, async (r) => repo.referrals(await user(r, false, true)));
    api.post('/v1/me/referrals/apply', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } }, schema: { ...shared, body: z.strictObject({ code: promoCode }), response: { 200: ok, ...errorResponses } } }, async (r) => { await repo.applyReferral(await user(r, false, true), r.body.code); return { status: 'ok' as const }; });
    api.post('/v1/me/support/tickets', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } }, schema: { ...shared, headers: z.object({ 'idempotency-key': z.string().regex(/^[A-Za-z0-9_-]{8,100}$/) }), body: ticketInput, response: { 201: ticketSchema, ...errorResponses } } }, async (r, p) => p.code(201).send(await repo.createTicket(await user(r), r.body, r.headers['idempotency-key'])));
    for (const admin of [false, true]) {
        const prefix = admin ? '/v1/admin/support/tickets' : '/v1/me/support/tickets';
        api.get(prefix, { schema: { ...shared, querystring: page, response: { 200: z.array(ticketSchema), ...errorResponses } } }, async (r) => repo.tickets(await user(r, admin), admin, r.query.limit, r.query.offset));
        api.get(`${prefix}/:id`, { schema: { ...shared, params: idParams, response: { 200: z.object({ ticket: ticketSchema, messages: z.array(messageSchema) }), ...errorResponses } } }, async (r) => repo.ticket(await user(r, admin), r.params.id, admin));
        api.post(`${prefix}/:id/messages`, { config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, schema: { ...shared, params: idParams, body: replyInput, response: { 200: ok, ...errorResponses } } }, async (r) => { await repo.reply(await user(r, admin), r.params.id, r.body.message, admin); return { status: 'ok' as const }; });
    }
    api.post('/v1/admin/support/tickets/:id/resolve', { schema: { ...shared, params: idParams, response: { 200: ok, ...errorResponses } } }, async (r) => { await repo.resolve(await user(r, true), r.params.id); return { status: 'ok' as const }; });
    api.get('/v1/customer/config', { schema: { tags: ['Customer extras'], response: { 200: z.object({ support: z.object({ phone: z.string().nullable(), email: z.string().nullable(), whatsapp_url: z.url().nullable() }), themes: z.array(z.enum(['system', 'light', 'dark'])) }), ...errorResponses } } }, async () => ({ support: { ...contact, whatsapp_url: contact.phone ? `https://wa.me/${contact.phone.slice(1)}` : null }, themes: ['system', 'light', 'dark'] as ('system' | 'light' | 'dark')[] }));
    api.get('/v1/legal', { schema: { tags: ['Legal'], response: { 200: z.array(legalSchema), ...errorResponses } } }, async () => repo.legal());
    api.get('/v1/legal/:slug', { schema: { tags: ['Legal'], params: z.object({ slug: legalSlug }), response: { 200: legalSchema, ...errorResponses } } }, async (r) => { const result = (await repo.legal(r.params.slug))[0]; if (!result)
        throw new ApiError(404, 'LEGAL_NOT_FOUND', 'Legal page not published.'); return result; });
    api.post('/v1/admin/legal', { schema: { ...shared, body: legalInput, response: { 201: legalSchema, ...errorResponses } } }, async (r, p) => p.code(201).send(await repo.publishLegal(await user(r, true), r.body)));
    api.post('/v1/me/legal/:id/accept', { schema: { ...shared, params: idParams, response: { 200: ok, ...errorResponses } } }, async (r) => { await repo.acceptLegal(await user(r), r.params.id); return { status: 'ok' as const }; });
}
