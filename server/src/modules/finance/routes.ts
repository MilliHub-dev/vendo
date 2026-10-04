import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import type { ProfileService } from '../users/service.js';
import { ApiError, errorResponses } from '../../lib/errors.js';
import { page, idParams } from '../extras/schema.js';
import { financePolicy, accountParams, earningsSchema, earningsEntry, bankInput, bankSchema, withdrawalSchema, type FinanceRepository } from './schema.js';
import type { FinanceService } from './service.js';
export function registerFinanceRoutes(app: FastifyInstance, auth: AuthGateway, profiles: ProfileService, repo: FinanceRepository, service: FinanceService) {
    const api = app.withTypeProvider<ZodTypeProvider>(), shared = { tags: ['Earnings & payouts'], security: [{ bearerAuth: [] }] };
    const user = async (r: FastifyRequest, admin = false) => { const u = await authenticate(r, auth), p = await profiles.get(u); if (admin && p.role !== 'admin')
        throw new ApiError(403, 'FORBIDDEN', 'Administrator access required.'); return u.id; };
    api.post('/v1/admin/cities/:id/finance-policies', { schema: { ...shared, params: idParams, body: financePolicy, response: { 201: z.object({ id: z.uuid(), policy: financePolicy }), ...errorResponses } } }, async (r, p) => p.code(201).send(await repo.savePolicy(await user(r, true), r.params.id, r.body)));
    api.post('/v1/admin/orders/:id/settlement-policy', { schema: { ...shared, params: idParams, body: z.strictObject({ policy_id: z.uuid() }), response: { 200: z.object({ ok: z.literal(true) }), ...errorResponses } } }, async (r) => { await repo.attachPolicy(await user(r, true), r.params.id, r.body.policy_id); return { ok: true as const }; });
    const prefix = '/v1/earnings/:kind/:entityId';
    api.get(prefix, { schema: { ...shared, params: accountParams, response: { 200: earningsSchema, ...errorResponses } } }, async (r) => repo.account(await user(r), r.params.kind, r.params.entityId));
    api.get(`${prefix}/transactions`, { schema: { ...shared, params: accountParams, querystring: page, response: { 200: z.array(earningsEntry), ...errorResponses } } }, async (r) => repo.history(await user(r), r.params.kind, r.params.entityId, r.query.limit, r.query.offset));
    api.get(`${prefix}/export.csv`, { schema: { ...shared, params: accountParams, description: 'Authenticated CSV export of the latest 1000 settlement/withdrawal ledger entries.' } }, async (r, p) => { const rows = await repo.history(await user(r), r.params.kind, r.params.entityId, 1000, 0); return p.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="vendo-earnings.csv"').send(['reference,kind,available_delta_kobo,held_delta_kobo,available_after_kobo,held_after_kobo,created_at', ...rows.map(v => [v.reference, v.kind, v.available_delta, v.held_delta, v.available_after, v.held_after, v.created_at].join(','))].join('\r\n')); });
    api.get(`${prefix}/bank`, { schema: { ...shared, params: accountParams, response: { 200: bankSchema.nullable(), ...errorResponses } } }, async (r) => repo.bank(await user(r), r.params.kind, r.params.entityId));
    api.put(`${prefix}/bank`, { config: { rateLimit: { max: 5, timeWindow: '1 hour' } }, schema: { ...shared, params: accountParams, body: bankInput, response: { 200: bankSchema, ...errorResponses } } }, async (r) => service.bank(await user(r), r.params.kind, r.params.entityId, r.body));
    api.post(`${prefix}/withdrawals`, { config: { rateLimit: { max: 10, timeWindow: '1 hour' } }, schema: { ...shared, params: accountParams, headers: z.object({ 'idempotency-key': z.string().regex(/^[A-Za-z0-9_-]{8,100}$/) }), body: z.strictObject({ amount_kobo: z.number().int().min(1).max(1000000000) }), response: { 201: withdrawalSchema, ...errorResponses } } }, async (r, p) => p.code(201).send(await repo.withdraw(await user(r), r.params.kind, r.params.entityId, r.body.amount_kobo, r.headers['idempotency-key'])));
    api.get(`${prefix}/withdrawals`, { schema: { ...shared, params: accountParams, querystring: page, response: { 200: z.array(withdrawalSchema), ...errorResponses } } }, async (r) => repo.withdrawals(await user(r), r.params.kind, r.params.entityId, r.query.limit, r.query.offset));
    api.get('/v1/admin/withdrawals', { schema: { ...shared, querystring: page, response: { 200: z.array(withdrawalSchema), ...errorResponses } } }, async (r) => repo.withdrawals(await user(r, true), undefined, undefined, r.query.limit, r.query.offset));
    api.post('/v1/admin/withdrawals/:id/review', { schema: { ...shared, params: idParams, body: z.strictObject({ decision: z.enum(['approve', 'reject']), note: z.string().trim().min(10).max(1000) }), response: { 200: withdrawalSchema, ...errorResponses } } }, async (r) => repo.review(await user(r, true), r.params.id, r.body.decision, r.body.note));
}
