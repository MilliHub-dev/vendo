import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { errorResponses } from '../../lib/errors.js';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import { profileSchema } from '../users/schema.js';
import { deletionSchema, preferencesSchema, recoverySchema, updatePreferencesSchema, verificationSchema } from './schema.js';
import type { AccountService } from './service.js';
import type { Preferences } from './schema.js';

export function registerAccountRoutes(app: FastifyInstance, auth: AuthGateway, accounts: AccountService) {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const shared = { tags: ['Account'], security: [{ bearerAuth: [] }] };
  api.post('/v1/me/email/verification/request', { schema: { ...shared, summary: 'Send email verification code through Brevo', response: { 202: z.object({ challenge_id: z.uuid(), expires_at: z.string(), retry_after_seconds: z.number() }), ...errorResponses } } }, async (request, reply) => reply.code(202).send(await accounts.requestEmailVerification(await authenticate(request, auth))));
  api.post('/v1/me/email/verification/confirm', { schema: { ...shared, body: verificationSchema, response: { 200: profileSchema, ...errorResponses } } }, async (request) => accounts.verifyEmail(await authenticate(request, auth), request.body.challenge_id, request.body.code));
  api.get('/v1/me/preferences', { schema: { ...shared, response: { 200: preferencesSchema, ...errorResponses } } }, async (request) => accounts.preferences(await authenticate(request, auth)));
  api.patch('/v1/me/preferences', { schema: { ...shared, body: updatePreferencesSchema, response: { 200: preferencesSchema, ...errorResponses } } }, async (request) => {
    const patch = Object.fromEntries(Object.entries(request.body).filter(([, value]) => value !== undefined)) as Partial<Preferences>;
    return accounts.updatePreferences(await authenticate(request, auth), patch);
  });
  api.post('/v1/me/deletion-request', { schema: { ...shared, summary: 'Confirm fresh phone OTP, deactivate account and request deletion', body: deletionSchema,
    response: { 202: z.object({ request_id: z.uuid(), status: z.literal('pending'), message: z.string() }), ...errorResponses } } }, async (request, reply) => {
    const id = await accounts.requestDeletion(await authenticate(request, auth), request.body.otp, request.body.reason);
    return reply.code(202).send({ request_id: id, status: 'pending', message: 'Account deactivated. Your deletion request is pending processing.' });
  });
  api.post('/v1/auth/recovery-request', { config: { rateLimit: { max: 3, timeWindow: '1 hour' } }, schema: { tags: ['Account'], summary: 'Request support review for a lost phone', body: recoverySchema,
    response: { 202: z.object({ message: z.string() }), ...errorResponses } } }, async (request, reply) => {
    await accounts.requestRecovery(request.body.phone, request.body.contact_email, request.body.message);
    return reply.code(202).send({ message: 'Your request has been recorded for support review. It does not change account access.' });
  });
}
