import { AdminBroadcasts } from './modules/admin-portal/broadcasts.js';
import { PostgresRiderAppRepository } from './modules/rider-app/repository.js';
import { createPaystackBanks } from './modules/rider-app/banks.js';
import { PostgresAdminPortalRepository } from './modules/admin-portal/repository.js';
import type { Env } from './config/env.js';
import { ApiError } from './lib/errors.js';
import { createPool } from './integrations/database.js';
import { createSupabaseAuth, type DirectEmail } from './integrations/supabase.js';
import { signInCodeEmail } from './emails/templates.js';
import { createBrevoWhatsAppSender, createBrevoAlertSender, createBrevoSmsSender, createBrevoEmailSender } from './integrations/brevo.js';
import { createRedis, MemoryLimits, RedisLimits } from './integrations/limits.js';
import { PostgresProfileRepository } from './modules/users/repository.js';
import { MemoryDeliveries, RedisDeliveries } from './integrations/deliveries.js';
import type { Dependencies } from './app.js';
import { PostgresAccountRepository } from './modules/accounts/repository.js';

import { PostgresFoodRepository } from './modules/food/repository.js';
import { createMapboxGeocoder, createMapboxRouting, fallbackGeocoder } from './integrations/mapbox.js';

import { PostgresDispatchRepository } from './modules/dispatch/repository.js';

import { PostgresAddressRepository } from './modules/addresses/repository.js';
import { createPhotonGeocoder } from './integrations/photon.js';
import { cachedRouting } from './integrations/cache.js';

import { PostgresOrderRepository } from './modules/orders/repository.js';

import { PostgresPaymentRepository } from './modules/payments/repository.js';
import { createPaystackGateway } from './integrations/paystack.js';

import { PostgresMatchingRepository } from './modules/matching/repository.js';

import {PostgresExtrasRepository} from './modules/extras/repository.js';
import {PostgresNotificationRepository} from './modules/notifications/repository.js';
import {createFcmSender} from './integrations/fcm.js';
import {PostgresChatRepository} from './modules/chat/repository.js';
import {PostgresOperationsRepository} from './modules/operations/repository.js';
import {PostgresFinanceRepository} from './modules/finance/repository.js';
import {createTransferGateway} from './integrations/transfers.js';
import {createObjectStorage,unavailableStorage} from './integrations/storage.js';
import {PostgresMediaRepository} from './modules/media/repository.js';
import {PostgresVendorRepository} from './modules/vendors/repository.js';
const unavailable = async (): Promise<never> => {
  throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED', 'This service is not configured yet.');
};

export async function createDependencies(env: Env): Promise<Dependencies> {
  const pool = env.DATABASE_URL ? createPool(env) : undefined;
  const redis = env.REDIS_URL ? createRedis(env.REDIS_URL) : undefined;
  pool?.on('error', () => { console.error('Database connection unavailable.'); });
  redis?.on('error', () => { console.error('Redis connection unavailable.'); });
  if (redis) {
    try { await redis.connect(); }
    catch (error) { redis.disconnect(); await pool?.end(); throw error; }
  }
  // With the service key and Brevo both set, sign-in codes are emailed by this server instead of by Supabase.
  const brevoKey = env.BREVO_API_KEY, brevoSender = env.BREVO_EMAIL_SENDER;
  const signInEmail: DirectEmail | undefined = env.SUPABASE_SERVICE_ROLE_KEY && brevoKey && brevoSender
    ? { serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY, send: async (email, code) => createBrevoEmailSender(brevoKey, brevoSender, env.BREVO_EMAIL_SENDER_NAME).send({ to: email, ...signInCodeEmail(code) }) }
    : undefined;
  const storage=env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY?createObjectStorage(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,'vendo-public','vendo-documents'):unavailableStorage;
  return {
    vendors:pool?new PostgresVendorRepository(pool):{portal:unavailable,register:unavailable,applications:unavailable,review:unavailable,withdraw:unavailable,stores:unavailable,store:unavailable,update:unavailable,orders:unavailable,order:unavailable,summary:unavailable},
    media:pool?new PostgresMediaRepository(pool,storage):{upload:unavailable,get:unavailable,download:unavailable},
    chat:pool?new PostgresChatRepository(pool):{list:unavailable,send:unavailable,read:unavailable},
    operations:pool?new PostgresOperationsRepository(pool,env.RIDER_DOCUMENT_SECRET,storage):{adminOrders:unavailable,adminOrder:unavailable,cities:unavailable,saveCity:unavailable,riders:unavailable,reassign:unavailable,cancel:unavailable,custody:unavailable,vendorOrders:unavailable,vendorMenu:unavailable,saveMenu:unavailable,vendorOpen:unavailable,documents:unavailable,upload:unavailable,document:unavailable,reviewDocument:unavailable,saveTier:unavailable,tiers:unavailable,membership:unavailable,saveBanner:unavailable,banners:unavailable,placements:unavailable,report:unavailable,audits:unavailable,health:unavailable,heartbeat:unavailable},
    finance:pool?new PostgresFinanceRepository(pool):{savePolicy:unavailable,attachPolicy:unavailable,settle:unavailable,account:unavailable,history:unavailable,bank:unavailable,saveBank:unavailable,withdraw:unavailable,withdrawals:unavailable,review:unavailable,claim:unavailable,pending:unavailable,apply:unavailable,uncertain:unavailable,enqueue:unavailable},
    transferGateway:env.PAYSTACK_SECRET_KEY?createTransferGateway(env.PAYSTACK_SECRET_KEY):{configured:false,resolve:unavailable,recipient:unavailable,submit:unavailable,verify:unavailable},
    extras:pool?new PostgresExtrasRepository(pool):{savePromo:unavailable,promos:unavailable,setReferralPolicy:unavailable,referrals:unavailable,applyReferral:unavailable,rewardReferrals:unavailable,createTicket:unavailable,tickets:unavailable,ticket:unavailable,reply:unavailable,resolve:unavailable,publishLegal:unavailable,legal:unavailable,acceptLegal:unavailable},
    notifications:pool?new PostgresNotificationRepository(pool):{sendAdminPush:unavailable,inbox:unavailable,read:unavailable,devices:unavailable,register:unavailable,remove:unavailable,reminders:unavailable,claim:unavailable,target:unavailable,finish:unavailable,invalidateDevice:unavailable},
    notificationTransports:{
      ...(env.BREVO_API_KEY&&env.BREVO_WHATSAPP_SENDER&&env.BREVO_WHATSAPP_TEMPLATE_ID?{whatsapp:createBrevoWhatsAppSender(env.BREVO_API_KEY,env.BREVO_WHATSAPP_SENDER,env.BREVO_WHATSAPP_TEMPLATE_ID)}:{}),
      ...(env.FCM_PROJECT_ID&&env.FCM_CLIENT_EMAIL&&env.FCM_PRIVATE_KEY?{push:createFcmSender(env.FCM_PROJECT_ID,env.FCM_CLIENT_EMAIL,env.FCM_PRIVATE_KEY)}:{}),
      ...(env.BREVO_API_KEY&&env.BREVO_SMS_SENDER?{sms:createBrevoAlertSender(env.BREVO_API_KEY,env.BREVO_SMS_SENDER)}:{}),
      ...(env.BREVO_API_KEY&&env.BREVO_EMAIL_SENDER?{email:createBrevoEmailSender(env.BREVO_API_KEY,env.BREVO_EMAIL_SENDER,env.BREVO_EMAIL_SENDER_NAME)}:{}),
    },
    matching: pool ? new PostgresMatchingRepository(pool) : { register: unavailable, rider: unavailable, review: unavailable, presence: unavailable, locate: unavailable, currentOffer: unavailable, respond: unavailable, job: unavailable, savePolicy: unavailable, tracking: unavailable, retry: unavailable, cancelSearch: unavailable, queue: unavailable, process: unavailable },
    payments: pool ? new PostgresPaymentRepository(pool) : { prepare: unavailable, initialized: unavailable, review: unavailable, find: unavailable, apply: unavailable, wallet: unavailable, history: unavailable, checkout: unavailable, enqueue: unavailable, pending: unavailable, finishEvents: unavailable, refundWallets: unavailable, reconcileRefund: unavailable },
    paymentGateway: env.PAYSTACK_SECRET_KEY ? createPaystackGateway(env.PAYSTACK_SECRET_KEY, env.PAYSTACK_CALLBACK_URL) : { configured: false, initialize: unavailable, verify: unavailable, verifyRefund: unavailable },
    ...(pool ? {adminPortal: new PostgresAdminPortalRepository(pool),adminBroadcasts:new AdminBroadcasts(pool)} : {}),
    ...(pool ? { riderApp: new PostgresRiderAppRepository(pool) } : {}),
    ...(env.PAYSTACK_SECRET_KEY ? { payoutBanks: createPaystackBanks(env.PAYSTACK_SECRET_KEY) } : {}),
    orders: pool ? new PostgresOrderRepository(pool) : { events: unavailable, receipt: unavailable, cancellation: unavailable, cancel: unavailable, reschedule: unavailable, dispute: unavailable, resolveDispute: unavailable, rating: unavailable, savePolicy: unavailable, policy: unavailable, riderAction: unavailable, processDue: unavailable },
    addresses: pool ? new PostgresAddressRepository(pool) : { cities: unavailable, city: unavailable, saveBoundary: unavailable, list: unavailable, get: unavailable, save: unavailable, delete: unavailable, preferredCity: unavailable, setCity: unavailable },
    // Photon (OpenStreetMap) first; Mapbox takes over whenever Photon cannot be reached.
    geocoder: env.PHOTON_BASE_URL && env.MAPBOX_ACCESS_TOKEN_SERVER ? fallbackGeocoder(createPhotonGeocoder(env.PHOTON_BASE_URL), createMapboxGeocoder(env.MAPBOX_ACCESS_TOKEN_SERVER))
      : env.PHOTON_BASE_URL ? createPhotonGeocoder(env.PHOTON_BASE_URL)
      : env.MAPBOX_ACCESS_TOKEN_SERVER ? createMapboxGeocoder(env.MAPBOX_ACCESS_TOKEN_SERVER) : { search: unavailable, reverse: unavailable },
    dispatch: pool ? new PostgresDispatchRepository(pool) : { getCity: unavailable, packages: unavailable, savePackage: unavailable, saveQuote: unavailable, createOrder: unavailable, getCode: unavailable, complete: unavailable },
    food: pool ? new PostgresFoodRepository(pool) : { listVendors: unavailable, getVendor: unavailable, getCity: unavailable, saveVendor: unavailable, saveMenu: unavailable, assignStaff: unavailable, saveQuote: unavailable, createOrder: unavailable, listOrders: unavailable, getOrder: unavailable, vendorAction: unavailable },
    routing: env.MAPBOX_ACCESS_TOKEN_SERVER ? cachedRouting(createMapboxRouting(env.MAPBOX_ACCESS_TOKEN_SERVER)) : { route: unavailable },
    auth: env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? createSupabaseAuth(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, signInEmail, env.AUTH_CACHE_SECONDS)
      : { requestOtp: unavailable, verifyOtp: unavailable, refresh: unavailable, authenticate: unavailable, logout: unavailable },
    profiles: pool ? new PostgresProfileRepository(pool) : { bootstrap: unavailable, setName: unavailable, setEmail: unavailable },
    accounts: pool ? new PostgresAccountRepository(pool) : { issueVerification: unavailable, discardVerification: unavailable, verifyEmail: unavailable, getPreferences: unavailable, updatePreferences: unavailable, requestDeletion: unavailable, requestRecovery: unavailable },
    sms: env.BREVO_API_KEY && env.BREVO_SMS_SENDER ? createBrevoSmsSender(env.BREVO_API_KEY, env.BREVO_SMS_SENDER) : { send: unavailable },
    email: env.BREVO_API_KEY && env.BREVO_EMAIL_SENDER ? createBrevoEmailSender(env.BREVO_API_KEY, env.BREVO_EMAIL_SENDER, env.BREVO_EMAIL_SENDER_NAME) : { send: unavailable },
    limits: redis ? new RedisLimits(redis) : new MemoryLimits(),
    deliveries: redis ? new RedisDeliveries(redis) : new MemoryDeliveries(),
    ...(redis ? { redis } : {}),
    async readiness() {
      if (!pool || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;
      // one round trip for every table the API depends on, rather than one each
      await pool.query([
        'SELECT id FROM public.profiles LIMIT 0',
        'SELECT id FROM vendo_internal.email_verifications LIMIT 0',
        'SELECT id FROM public.orders LIMIT 0',
        'SELECT order_id FROM vendo_internal.dispatch_delivery_codes LIMIT 0',
        'SELECT note,is_default FROM public.saved_addresses LIMIT 0',
        'SELECT id FROM public.order_ratings LIMIT 0',
        'SELECT id FROM vendo_internal.payment_intents LIMIT 0',
        'SELECT id FROM public.wallet_transactions LIMIT 0',
        'SELECT id FROM vendo_internal.rider_offers LIMIT 0',
        'SELECT id FROM public.notifications LIMIT 0',
        'SELECT id FROM vendo_internal.promos LIMIT 0',
        'SELECT id FROM vendo_internal.vendor_applications LIMIT 0',
        'SELECT id FROM vendo_internal.media_assets LIMIT 0',
        'SELECT storage_path FROM vendo_internal.rider_documents LIMIT 0',
        'SELECT id FROM public.order_messages LIMIT 0',
        'SELECT id FROM vendo_internal.admin_actions LIMIT 0',
        'SELECT id FROM vendo_internal.admin_broadcasts LIMIT 0',
        'SELECT id FROM vendo_internal.withdrawals LIMIT 0',
      ].join('; '));
      if (redis) await redis.ping();
      return true;
    },
    async close() {
      await pool?.end();
      if (redis) redis.disconnect();
    },
  };
}
