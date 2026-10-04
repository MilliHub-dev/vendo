import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { errorResponses } from '../../lib/errors.js';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import { emailSchema, nameSchema, profileSchema } from './schema.js';
import type { ProfileService } from './service.js';

export function registerProfileRoutes(app: FastifyInstance, auth: AuthGateway, profiles: ProfileService): void {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const shared = { tags: ['Profile'], security: [{ bearerAuth: [] }], response: { 200: profileSchema, ...errorResponses } };
  api.get('/v1/me', { schema: { ...shared, summary: 'Load or create the verified phone profile' } }, async (request) => {
    return profiles.get(await authenticate(request, auth));
  });
  api.patch('/v1/me/name', { schema: { ...shared, summary: 'Add or update your name', body: nameSchema } }, async (request) => {
    return profiles.addName(await authenticate(request, auth), request.body.name);
  });
  api.patch('/v1/me/email', { schema: { ...shared, summary: 'Add email after name; email remains unverified', body: emailSchema } }, async (request) => {
    return profiles.addEmail(await authenticate(request, auth), request.body.email);
  });
}
