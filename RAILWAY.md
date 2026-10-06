# Railway deployment

The repo contains deployment files for four public apps and one background worker. Supabase remains the database, authentication and storage provider. Add Railway Redis for the backend's production rate limits. Both vendor and admin portals use the live API.

## Services

Create one Railway project, add Redis, then add five services from `MilliHub-dev/vendo`:

| Service | Root Directory | Config file path | Public domain |
|---|---|---|---|
| server | `/server` | `/server/railway.toml` | Yes |
| worker | `/server` | `/server/railway-worker.toml` | No |
| admin | `/admin` | `/admin/railway.toml` | Yes |
| vendors | `/vendors` | `/vendors/railway.toml` | Yes |
| web | `/web` | `/web/railway.toml` | Yes |

Set Root Directory and the explicit config file path in each service's settings. Use the matching directory's Dockerfile; do not set a frontend `npm start` override. The frontend containers build Next.js exports and serve them through Caddy, including direct visits to nested routes. Containers listen on Railway's `PORT`. Health checks are `/health` for frontends and `/ready` for the API. The worker runs `node dist/worker.js`; leave its HTTP health check unset.

Railway monorepo/config guidance: https://docs.railway.com/builds/build-configuration

## API and worker variables

Import the required backend values from your local `server/.env` into Railway Variables privately. Do not commit `.env` or put backend secrets in frontend services. Override local settings:

```env
NODE_ENV=production
HOST=0.0.0.0
DATABASE_SSL=verify
DATABASE_CA_PATH=certs/supabase-root-2021.crt
REDIS_URL=${{Redis.REDIS_URL}}
WORKER_KIND=all
```

Use the actual Redis service name in the reference. Railway sets `PORT`; do not copy a local port override. The public Supabase root certificate is included in the API image. Keep your Supabase session pooler URL for `DATABASE_URL`. Preserve all generated application secrets across deployments so encrypted documents and codes remain readable.

Production startup requires `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `REDIS_URL`, `SEND_SMS_HOOK_SECRET`, `BREVO_API_KEY`, `BREVO_SMS_SENDER`, `BREVO_EMAIL_SENDER` and `EMAIL_VERIFICATION_SECRET`. Copy other configured values for payments, FCM, maps, delivery codes, document encryption and Supabase Storage from `.env.example` as applicable. API and worker share the same provider credentials and application secrets. Keep `PAYSTACK_TRANSFERS_ENABLED=false` until transfers are intentionally enabled.

Once domains exist, set the API's `CORS_ORIGINS` to the exact comma-separated HTTPS origins for admin, vendors and web. No trailing slash. Leave `TRUST_PROXY` unset unless you have verified the proxy configuration to trust; do not use `*`.

The existing migrations were applied previously. New migrations should run through `npm run db:migrate` from a trusted local/CI environment before deploying code that needs them. The runtime Docker image excludes migration tooling; do not configure that command as a Railway pre-deploy command. Provision the Supabase buckets with `npm run storage:setup` if not already provisioned.

## Frontend variables and integration

For web, set `NEXT_PUBLIC_SITE_URL=https://your-web-domain` before the build. Rebuild after changing it: static SEO metadata embeds the build-time URL. Its Dockerfile declares this public build argument.

Set admin and vendor `NEXT_PUBLIC_API_URL` at build time (default `https://api.vendoltd.com`). Deploy backend migrations through 015 and the portal endpoints first. Notification workers also process scheduled admin campaigns. Never expose FCM private keys, database passwords or Supabase service-role credentials as `NEXT_PUBLIC_*` variables.

## Deployment checks

1. Deploy Redis, API and worker with the configured variables. Check API `/ready` and worker logs for successful job processing.
2. Generate public domains for all four apps and update `CORS_ORIGINS`; rebuild web with its final site URL.
3. Set Supabase's Send SMS HTTP hook URL to `https://<api-domain>/v1/hooks/send-sms` with the matching hook secret. Update Paystack callback/webhook URLs if payments are enabled.
4. Verify the web homepage, nested admin/vendor routes and an API authenticated request. Test real OTP and push delivery only with intended test accounts.

No Railway resources are created by these files. Connect the repository, configure services/variables and deploy through your Railway account. Docker is required to validate the container builds locally.
