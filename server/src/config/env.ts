import { z } from 'zod';

const optionalText = z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional());
const optionalUrl = z.preprocess((value) => value === '' ? undefined : value, z.url().optional());
const schema = z.object({
  RIDER_DOCUMENT_SECRET:z.preprocess(v=>v===''?undefined:v,z.string().min(32).optional()),
  PAYSTACK_TRANSFERS_ENABLED:z.enum(['true','false']).default('false'),
  WORKER_KIND:z.enum(['all','matching','orders','payments','notifications','finance']).default('all'),
  SUPPORT_PHONE:z.preprocess(v=>v===''?undefined:v,z.string().regex(/^\+[1-9][0-9]{7,14}$/).optional()),
  SUPPORT_EMAIL:z.preprocess(v=>v===''?undefined:v,z.email().optional()),
  BREVO_WHATSAPP_SENDER:z.preprocess(v=>v===''?undefined:v,z.string().regex(/^\+?[1-9][0-9]{7,14}$/).optional()),
  BREVO_WHATSAPP_TEMPLATE_ID:z.preprocess(v=>v===''?undefined:v,z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional()),
  FCM_PROJECT_ID:z.preprocess(v=>v===''?undefined:v,z.string().regex(/^[a-z][a-z0-9-]{4,62}$/).optional()),
  FCM_CLIENT_EMAIL:z.preprocess(v=>v===''?undefined:v,z.email().optional()),
  FCM_PRIVATE_KEY:optionalText,
  NOTIFICATION_REMINDER_MINUTES:z.coerce.number().int().min(1).max(1440).default(30),
  PAYSTACK_SECRET_KEY: z.preprocess((value) => value === '' ? undefined : value, z.string().regex(/^sk_(test|live)_[A-Za-z0-9]+$/).optional()),
  PAYSTACK_CALLBACK_URL: z.preprocess((value) => value === '' ? undefined : value, z.url().refine((value) => new URL(value).protocol === 'https:' && !new URL(value).username && !new URL(value).password).optional()),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default(''),
  TRUST_PROXY: optionalText,
  AUTH_CACHE_SECONDS: z.coerce.number().int().min(0).max(60).default(0),
  SUPABASE_URL: optionalUrl,
  SUPABASE_ANON_KEY: optionalText,
  SUPABASE_SERVICE_ROLE_KEY: optionalText,
  DATABASE_URL: optionalUrl,
  DATABASE_SSL: z.enum(['verify', 'disable']).default('verify'),
  DATABASE_CA_PATH: optionalText,
  DISPATCH_DELIVERY_CODE_SECRET: z.preprocess((value) => value === '' ? undefined : value, z.string().min(32).optional()),
  PHOTON_BASE_URL: optionalUrl,
  MAPBOX_ACCESS_TOKEN_SERVER: optionalText,
  REDIS_URL: optionalUrl,
  SEND_SMS_HOOK_SECRET: optionalText,
  BREVO_API_KEY: optionalText,
  BREVO_SMS_SENDER: z.preprocess((value) => value === '' ? undefined : value, z.string().regex(/^(?:[A-Za-z0-9]{1,11}|[0-9]{1,15})$/).optional()),
  BREVO_EMAIL_SENDER: z.preprocess((value) => value === '' ? undefined : value, z.email().optional()),
  BREVO_EMAIL_SENDER_NAME: z.string().min(1).max(100).default('Vendo'),
  EMAIL_VERIFICATION_SECRET: z.preprocess((value) => value === '' ? undefined : value, z.string().min(32).optional()),
}).superRefine((env, ctx) => {
  if(env.SUPABASE_SERVICE_ROLE_KEY&&!env.SUPABASE_URL)ctx.addIssue({code:'custom',path:['SUPABASE_SERVICE_ROLE_KEY'],message:'Storage requires the Supabase URL.'});
  if(env.PAYSTACK_TRANSFERS_ENABLED==='true'&&!env.PAYSTACK_SECRET_KEY)ctx.addIssue({code:'custom',path:['PAYSTACK_TRANSFERS_ENABLED'],message:'Transfers require a configured Paystack key.'});
  if(Boolean(env.BREVO_WHATSAPP_SENDER)!==Boolean(env.BREVO_WHATSAPP_TEMPLATE_ID)||(env.BREVO_WHATSAPP_SENDER&&!env.BREVO_API_KEY))ctx.addIssue({code:'custom',path:['BREVO_WHATSAPP_SENDER'],message:'Configure API key, sender and approved template together.'});
  const fcm=[env.FCM_PROJECT_ID,env.FCM_CLIENT_EMAIL,env.FCM_PRIVATE_KEY].filter(Boolean).length;
  if(fcm!==0&&fcm!==3)ctx.addIssue({code:'custom',path:['FCM_PROJECT_ID'],message:'Configure all three FCM service-account fields.'});
  if (Boolean(env.SUPABASE_URL) !== Boolean(env.SUPABASE_ANON_KEY)) {
    ctx.addIssue({ code: 'custom', path: ['SUPABASE_URL'], message: 'Configure both Supabase URL and public key.' });
  }
  if (env.PHOTON_BASE_URL) {
    const url = new URL(env.PHOTON_BASE_URL);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) ctx.addIssue({ code: 'custom', path: ['PHOTON_BASE_URL'], message: 'Use an HTTP(S) base URL without credentials, query or fragment.' });
  }
  if (env.TRUST_PROXY === '*' || env.TRUST_PROXY === 'true') {
    ctx.addIssue({ code: 'custom', path: ['TRUST_PROXY'], message: 'Specify trusted proxy addresses, not all proxies.' });
  }
  for (const origin of env.CORS_ORIGINS.split(',').filter(Boolean)) {
    try {
      const parsed = new URL(origin.trim());
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin.trim()) throw new Error('Invalid origin');
    } catch {
      ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'Use exact comma-separated HTTP(S) origins.' });
    }
  }
  if (env.NODE_ENV === 'production') {
    for (const key of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'REDIS_URL', 'SEND_SMS_HOOK_SECRET', 'BREVO_API_KEY', 'BREVO_SMS_SENDER', 'BREVO_EMAIL_SENDER', 'EMAIL_VERIFICATION_SECRET'] as const) {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production.' });
    }
    if (env.DATABASE_SSL !== 'verify') ctx.addIssue({ code: 'custom', path: ['DATABASE_SSL'], message: 'Production requires verified TLS.' });
    if (env.SUPABASE_URL && !env.SUPABASE_URL.startsWith('https://')) ctx.addIssue({ code: 'custom', path: ['SUPABASE_URL'], message: 'Production requires HTTPS.' });
  }
});

export type Env = z.infer<typeof schema>;

export function readEnv(input: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Print field names and safe messages only, never values containing credentials.
    throw new Error(`Invalid configuration: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  return result.data;
}
