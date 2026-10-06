import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiError, errorResponses } from '../../lib/errors.js';
import { phoneKey, type Limits } from '../../integrations/limits.js';
import { requestOtpSchema, verifyOtpSchema, refreshSchema, sessionSchema, type AuthGateway, type Identity } from './schema.js';
import type { ProfileService } from '../users/service.js';

export async function authenticate(request: FastifyRequest, auth: AuthGateway): Promise<Identity> {
  const header = request.headers.authorization;
  const match = header?.match(/^Bearer ([^\s]+)$/i);
  if (!match?.[1]) throw new ApiError(401, 'UNAUTHORIZED', 'Provide a valid bearer token.');
  return auth.authenticate(match[1]);
}

export function registerAuthRoutes(app: FastifyInstance, auth: AuthGateway, limits: Limits, profiles: ProfileService): void {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const activeSession = async (session: z.infer<typeof sessionSchema>) => {
    try { await profiles.get(await auth.authenticate(session.access_token)); }
    catch (error) { await auth.logout(session.access_token).catch(() => {}); throw error; }
    return session;
  };
  const emailBody = z.strictObject({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) });
  api.post('/v1/auth/email/otp/request', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    schema: { tags: ['Auth'], summary: 'Request an email sign-in code', body: emailBody,
      response: { 202: z.object({ message: z.string(), retry_after_seconds: z.number() }), ...errorResponses } },
  }, async (request, reply) => {
    const key = phoneKey('email', request.body.email);
    if (!await limits.consume(`${key}:resend`, 1, 60) || !await limits.consume(`${key}:send`, 5, 3600))
      throw new ApiError(429, 'OTP_RATE_LIMITED', 'Please wait before requesting another code.');
    if (!auth.requestEmailOtp) throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Email sign-in is not configured.');
    await auth.requestEmailOtp(request.body.email);
    return reply.code(202).send({ message: 'Verification code requested.', retry_after_seconds: 60 });
  });
  api.post('/v1/auth/email/otp/verify', {
    config: { rateLimit: { max: 20, timeWindow: '5 minutes' } },
    schema: { tags: ['Auth'], summary: 'Verify email code and receive a session', body: emailBody.extend({ token: z.string().regex(/^\d{6}$/) }),
      response: { 200: sessionSchema, ...errorResponses } },
  }, async (request) => {
    if (!await limits.consume(phoneKey('email-verify', request.body.email), 5, 300))
      throw new ApiError(429, 'OTP_RATE_LIMITED', 'Too many verification attempts. Please try again later.');
    if (!auth.verifyEmailOtp) throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Email sign-in is not configured.');
    return activeSession(await auth.verifyEmailOtp(request.body.email, request.body.token));
  });
  api.post('/v1/auth/otp/request', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    schema: { tags: ['Auth'], summary: 'Request a phone verification code', body: requestOtpSchema,
      response: { 202: z.object({ message: z.string(), retry_after_seconds: z.number() }), ...errorResponses } },
  }, async (request, reply) => {
    const phone = request.body.phone;
    if (!await limits.consume(phoneKey('resend', phone), 1, 60)
      || !await limits.consume(phoneKey('send', phone), 5, 3600)) {
      throw new ApiError(429, 'OTP_RATE_LIMITED', 'Please wait before requesting another code.');
    }
    await auth.requestOtp(phone);
    return reply.code(202).send({ message: 'Verification code requested.', retry_after_seconds: 60 });
  });
  api.post('/v1/auth/otp/verify', {
    config: { rateLimit: { max: 20, timeWindow: '5 minutes' } },
    schema: { tags: ['Auth'], summary: 'Verify OTP and receive a session', body: verifyOtpSchema,
      response: { 200: sessionSchema, ...errorResponses } },
  }, async (request) => {
    if (!await limits.consume(phoneKey('verify', request.body.phone), 5, 300)) {
      throw new ApiError(429, 'OTP_RATE_LIMITED', 'Too many verification attempts. Please try again later.');
    }
    return activeSession(await auth.verifyOtp(request.body.phone, request.body.token));
  });
  api.post('/v1/auth/refresh', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: { tags: ['Auth'], summary: 'Refresh a Supabase session', body: refreshSchema,
      response: { 200: sessionSchema, ...errorResponses } },
  }, async (request) => activeSession(await auth.refresh(request.body.refresh_token)));
  api.post('/v1/auth/logout', {
    preValidation: async (request) => { if (request.body === undefined) request.body = { scope: 'local' }; },
    schema: { tags: ['Auth'], security: [{ bearerAuth: [] }], summary: 'Revoke the current refresh session',
      body: z.strictObject({ scope: z.enum(['local', 'global']).default('local') }).default({ scope: 'local' }),
      response: { 200: z.object({ message: z.string() }), ...errorResponses } },
  }, async (request) => {
    await authenticate(request, auth);
    await auth.logout(request.headers.authorization!.split(' ')[1]!, request.body.scope);
    return { message: 'Session ended. Remove stored tokens from this device.' };
  });
}
