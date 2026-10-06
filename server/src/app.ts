import { registerAdminPortalRoutes } from './modules/admin-portal/routes.js';
import { registerRiderAppRoutes } from './modules/rider-app/routes.js';
import type { AdminPortalRepository } from './modules/admin-portal/repository.js';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { Redis } from 'ioredis';
import type { Env } from './config/env.js';
import { ApiError } from './lib/errors.js';
import type { Limits } from './integrations/limits.js';
import type { SmsSender, EmailSender } from './integrations/brevo.js';
import type { Deliveries } from './integrations/deliveries.js';
import type { AuthGateway } from './modules/auth/schema.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import { registerSmsHook } from './modules/auth/sms-hook.js';
import { registerProfileRoutes } from './modules/users/routes.js';
import type { ProfileRepository } from './modules/users/schema.js';
import { ProfileService } from './modules/users/service.js';
import type { AccountRepository } from './modules/accounts/schema.js';
import { AccountService } from './modules/accounts/service.js';
import { registerAccountRoutes } from './modules/accounts/routes.js';

import type { FoodRepository, Routing } from './modules/food/schema.js';
import { FoodService } from './modules/food/service.js';
import { registerFoodRoutes } from './modules/food/routes.js';

import type { DispatchRepository } from './modules/dispatch/schema.js';
import { DispatchService } from './modules/dispatch/service.js';
import { registerDispatchRoutes } from './modules/dispatch/routes.js';

import type { AddressRepository, Geocoder } from './modules/addresses/schema.js';
import { AddressService } from './modules/addresses/service.js';
import { registerAddressRoutes } from './modules/addresses/routes.js';

import type { OrderRepository } from './modules/orders/schema.js';
import { registerOrderRoutes } from './modules/orders/routes.js';

import type { PaymentGateway, PaymentRepository } from './modules/payments/schema.js';
import { PaymentService } from './modules/payments/service.js';
import { registerPaymentRoutes, registerPaystackHook } from './modules/payments/routes.js';

import type { MatchingRepository } from './modules/matching/schema.js';
import { registerMatchingRoutes } from './modules/matching/routes.js';
import { TrackingService } from './modules/matching/service.js';

import type {ExtrasRepository} from './modules/extras/schema.js';
import {registerExtrasRoutes} from './modules/extras/routes.js';
import type {NotificationRepository,NotificationTransports} from './modules/notifications/schema.js';
import {registerNotificationRoutes} from './modules/notifications/routes.js';
import type {ChatRepository} from './modules/chat/schema.js';
import {registerChatRoutes} from './modules/chat/routes.js';
import type {OperationsRepository} from './modules/operations/schema.js';
import {registerOperationsRoutes} from './modules/operations/routes.js';
import type {FinanceRepository,TransferGateway} from './modules/finance/schema.js';
import {registerFinanceRoutes} from './modules/finance/routes.js';
import {FinanceService} from './modules/finance/service.js';
import type {MediaRepository} from './modules/media/schema.js';
import {registerMediaRoutes} from './modules/media/routes.js';
import type {VendorRepository} from './modules/vendors/schema.js';
import {registerVendorRoutes} from './modules/vendors/routes.js';
export interface Dependencies {
  vendors:VendorRepository;
  media:MediaRepository;
  chat:ChatRepository;
  operations:OperationsRepository;
  finance:FinanceRepository;
  transferGateway:TransferGateway;
  extras:ExtrasRepository;
  notifications:NotificationRepository;
  notificationTransports:NotificationTransports;
  matching: MatchingRepository;
  payments: PaymentRepository;
  paymentGateway: PaymentGateway;
  orders: OrderRepository;
  addresses: AddressRepository;
  adminBroadcasts?: import('./modules/admin-portal/broadcasts.js').AdminBroadcasts;
  riderApp?: import('./modules/rider-app/repository.js').RiderAppRepository;
  payoutBanks?: import('./modules/rider-app/banks.js').PayoutBanks;
  adminPortal?: AdminPortalRepository;
  geocoder: Geocoder;
  dispatch: DispatchRepository;
  food: FoodRepository;
  routing: Routing;
  auth: AuthGateway;
  profiles: ProfileRepository;
  accounts: AccountRepository;
  limits: Limits;
  sms: SmsSender;
  email: EmailSender;
  deliveries: Deliveries;
  redis?: Redis;
  readiness(): Promise<boolean>;
  close(): Promise<void>;
}

export async function buildApp(env: Env, dependencies: Dependencies) {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : {
      level: env.LOG_LEVEL,
      // Do not log bodies, query strings, provider errors or tokens.
      serializers: {
        req: (req) => ({ method: req.method, path: String(req.url).split('?')[0], remoteAddress: req.ip }),
      },
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    },
    genReqId: () => randomUUID(),
    bodyLimit: 32 * 1024, requestTimeout: 15000, connectionTimeout: 10000,
    trustProxy: env.TRUST_PROXY?.split(',').map((proxy) => proxy.trim()) ?? false,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
    reply.header('cache-control', 'no-store');
  });
  app.setErrorHandler((error, request, reply) => {
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';
    if (error instanceof ApiError) ({ statusCode: status, code, message } = error);
    else if (hasZodFastifySchemaValidationErrors(error) || (error instanceof Error && 'validation' in error)) {
      status = 400; code = 'VALIDATION_ERROR'; message = 'Check the request fields and try again.';
    } else if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500) {
      status = error.statusCode; code = status === 429 ? 'RATE_LIMITED' : 'INVALID_REQUEST';
      message = status === 429 ? 'Too many requests. Please try again later.' : 'The request could not be processed.';
    }
    if (status >= 500) request.log.error({ error_code: code }, 'Request failed');
    void reply.code(status).send({ error: { code, message, request_id: request.id } });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found.', request_id: request.id } }));
  await app.register(cors, { origin: env.CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean), credentials: false, methods:['GET','HEAD','POST','PUT','PATCH','DELETE'] });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: 120, timeWindow: '1 minute', ...(dependencies.redis ? { redis: dependencies.redis } : {}), skipOnError: false,
  });
  await app.register(swagger, {
    openapi: { info: { title: 'Vendo API', version: '0.1.0', description: 'Authentication, accounts, Food Court, Dispatch, addresses, maps, orders, payments, wallets, rider matching, tracking, notifications, promotions and customer extras.' },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } } },
    transform: jsonSchemaTransform,
    transformObject: (document) => {
      if (!('openapiObject' in document)) return document.swaggerObject;
      const body = document.openapiObject.paths?.['/v1/auth/logout']?.post?.requestBody;
      if (body && !('$ref' in body)) body.required = false;
      return document.openapiObject;
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs', staticCSP: true, uiConfig: { docExpansion: 'list', deepLinking: true, persistAuthorization: false } });
  app.get('/', { schema: { hide: true } }, async (_request, reply) => reply.redirect('/docs/'));
  app.get('/health', { schema: { hide: true } }, async () => ({ status: 'ok' }));
  app.get('/ready', { schema: { hide: true } }, async (_request, reply) => {
    let ready = false;
    try { ready = await dependencies.readiness(); } catch { /* dependencies unavailable */ }
    return reply.code(ready ? 200 : 503).send({ status: ready ? 'ready' : 'not_ready' });
  });
  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
  const profiles = new ProfileService(dependencies.profiles);
  registerAdminPortalRoutes(app,dependencies.auth,profiles,dependencies.adminPortal,dependencies.adminBroadcasts);
  registerRiderAppRoutes(app, dependencies.auth, profiles, dependencies.riderApp, dependencies.payoutBanks);
  registerVendorRoutes(app,dependencies.auth,profiles,dependencies.vendors,dependencies.operations,dependencies.food,dependencies.media);
  registerMediaRoutes(app,dependencies.auth,profiles,dependencies.media);
  registerChatRoutes(app,dependencies.auth,profiles,dependencies.chat);
  registerOperationsRoutes(app,dependencies.auth,profiles,dependencies.operations);
  registerFinanceRoutes(app,dependencies.auth,profiles,dependencies.finance,new FinanceService(dependencies.finance,dependencies.transferGateway,env.PAYSTACK_TRANSFERS_ENABLED==='true'));
  registerExtrasRoutes(app,dependencies.auth,profiles,dependencies.extras,{phone:env.SUPPORT_PHONE??null,email:env.SUPPORT_EMAIL??null});
  registerNotificationRoutes(app,dependencies.auth,profiles,dependencies.notifications);
  registerAuthRoutes(app, dependencies.auth, dependencies.limits, profiles);
  registerProfileRoutes(app, dependencies.auth, profiles);
  registerAccountRoutes(app, dependencies.auth, new AccountService(dependencies.accounts, profiles, dependencies.auth, dependencies.email, dependencies.limits, env.EMAIL_VERIFICATION_SECRET));
  const food = new FoodService(dependencies.food, profiles, dependencies.routing);
  const dispatch = new DispatchService(dependencies.dispatch, profiles, dependencies.routing, env.DISPATCH_DELIVERY_CODE_SECRET);
  registerFoodRoutes(app, dependencies.auth, profiles, dependencies.food, food, dispatch);
  registerDispatchRoutes(app, dependencies.auth, dependencies.dispatch, dispatch, food);
  registerAddressRoutes(app, dependencies.auth, new AddressService(dependencies.addresses, profiles, dependencies.geocoder, dependencies.routing), dependencies.limits);
  registerOrderRoutes(app, dependencies.auth, profiles, dependencies.orders);
  registerMatchingRoutes(app, dependencies.auth, profiles, dependencies.matching, new TrackingService(dependencies.matching, dependencies.routing));
  registerPaymentRoutes(app, dependencies.auth, profiles, dependencies.payments, new PaymentService(dependencies.payments, dependencies.paymentGateway));
  await registerPaystackHook(app, env.PAYSTACK_SECRET_KEY, dependencies.payments,dependencies.finance);
  await registerSmsHook(app, env.SEND_SMS_HOOK_SECRET, dependencies.sms, dependencies.deliveries, dependencies.limits);
  app.addHook('onClose', async () => dependencies.close());
  return app;
}
