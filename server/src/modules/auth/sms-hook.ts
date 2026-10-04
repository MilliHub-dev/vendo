import type { FastifyInstance } from 'fastify';
import { Webhook } from 'standardwebhooks';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { phoneSchema } from './schema.js';
import type { SmsSender } from '../../integrations/brevo.js';
import type { Deliveries } from '../../integrations/deliveries.js';
import { createHash } from 'node:crypto';
import { phoneKey, type Limits } from '../../integrations/limits.js';

const payloadSchema = z.object({ user: z.object({ phone: phoneSchema }), sms: z.object({ otp: z.string().regex(/^\d{6}$/) }) });

export async function registerSmsHook(app: FastifyInstance, secret: string | undefined, sender: SmsSender, deliveries: Deliveries, limits: Limits): Promise<void> {
  // Encapsulation keeps raw-body parsing specific to the signed webhook.
  await app.register(async (scope) => {
    scope.removeContentTypeParser('application/json');
    scope.addContentTypeParser('application/json', { parseAs: 'string', bodyLimit: 20 * 1024 }, (_request, body, done) => done(null, body));
    scope.setErrorHandler((error, request, reply) => {
      const status = error instanceof ApiError ? error.statusCode
        : error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500 ? error.statusCode : 503;
      const message = error instanceof ApiError ? error.message : 'Verification messages are temporarily unavailable.';
      if (status >= 500) request.log.error({ error_code: 'SMS_HOOK_FAILURE' }, 'SMS hook failed');
      void reply.code(status).send({ error: { http_code: status, message } });
    });
    scope.post('/v1/hooks/send-sms', {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      schema: { tags: ['Auth hooks'], summary: 'Signed Supabase Send SMS hook',
        description: 'Supabase only. Requires webhook-id, webhook-timestamp and webhook-signature over the exact raw JSON body. Payload: {user: {phone}, sms: {otp}}.' },
    }, async (request, reply) => {
      if (!secret) throw new ApiError(503, 'SMS_NOT_CONFIGURED', 'SMS hook is not configured.');
      const headers: Record<string, string> = {};
      for (const key of ['webhook-id', 'webhook-timestamp', 'webhook-signature']) {
        const value = request.headers[key];
        if (typeof value !== 'string' || value.length > 1024) throw new ApiError(401, 'INVALID_HOOK_SIGNATURE', 'Invalid hook signature.');
        headers[key] = value;
      }
      let verified: unknown;
      try {
        verified = new Webhook(secret.replace(/^v1,whsec_/, '')).verify(request.body as string, headers);
      } catch { throw new ApiError(401, 'INVALID_HOOK_SIGNATURE', 'Invalid hook signature.'); }
      const parsed = payloadSchema.safeParse(verified);
      if (!parsed.success) throw new ApiError(400, 'INVALID_HOOK_PAYLOAD', 'Invalid SMS hook payload.');
      const deliveryKey = `vendo:sms:${createHash('sha256').update(headers['webhook-id']!).digest('hex')}`;
      const claim = await deliveries.claim(deliveryKey);
      if (claim.state === 'done') return reply.code(200).send({});
      if (claim.state === 'busy') throw new ApiError(503, 'SMS_IN_PROGRESS', 'Message delivery is already in progress.');
      try {
        // Supabase's public auth API can be called without passing through our API.
        // Apply sending limits at the signed delivery boundary too.
        if (!await limits.consume(phoneKey('hook-send', parsed.data.user.phone), 5, 3600)) {
          throw new ApiError(429, 'SMS_RATE_LIMITED', 'Please try again later.');
        }
        await sender.send(parsed.data.user.phone, parsed.data.sms.otp);
        await deliveries.complete(deliveryKey, claim.token);
      } catch (error) {
        await deliveries.release(deliveryKey, claim.token);
        throw error;
      }
      return reply.code(200).send({});
    });
  });
}
