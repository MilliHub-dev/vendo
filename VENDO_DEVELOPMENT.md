# Vendo — Developer Guide

> Source of truth for engineers. Derived from **Vendo PRD v1.0 (May 2026)**, with the stack decisions below applied.
> Where this file and the PRD disagree, this file wins (see [§2 Changes from the PRD](#2-changes-from-the-prd)).

---

## 1. What we are building

Three apps on **one backend**:

| App | Users | Tech |
|---|---|---|
| **Vendo** (customer) | Customers | React Native (Expo) — iOS + Android |
| **Vendo Rider** | Delivery riders | React Native (Expo) — Android first, low-end optimised |
| **Vendo Admin** | Ops team | Next.js (TypeScript) web |

Two services: **Food Court** (order from vendors) and **Dispatch** (send a package by bike).
Launch cities: **Abuja, Kaduna, Kano, Lagos** (city-configurable, not hard-coded).

---

## 2. Changes from the PRD

The PRD was written around Firebase. We decided: **Supabase (Postgres) is the main platform; Firebase is used only for push notifications (FCM).**

| Area | PRD v1.0 | This project |
|---|---|---|
| Database | Postgres on Railway | **Supabase Postgres + PostGIS** |
| Real-time (GPS, order status) | Firestore `onSnapshot` | **Supabase Realtime** (Broadcast for GPS, Postgres Changes for order status) |
| Auth | Firebase Auth | **Supabase Auth** (phone OTP, SMS sent via Termii through a Send-SMS hook) |
| File storage | Firebase Storage | **Supabase Storage** (private buckets) |
| Push | FCM | FCM (unchanged) |
| Cache / geo / queues | Redis | Redis (unchanged) — Railway or Upstash |
| API hosting | Railway | Railway (unchanged) |

**Open questions to resolve before Phase 1 ends** (the PRD is silent or ambiguous):

1. **Vendor order confirmation.** The tracker shows "Confirmed" but no one confirms. Vendors have no app. Proposal: a simple vendor view in the admin web app (accept / reject / "ready for pickup") plus a WhatsApp alert. **Needs a decision.**
2. **Vendor payout formula.** PRD says `order total − delivery fee − commission`. Commission should apply to the **food subtotal**, not the total. Proposal: `vendor_payout = subtotal − (subtotal × commission_rate)`. Delivery fee goes to rider + platform. **Confirm with finance.**
3. **OTP on food orders.** PRD requires OTP for dispatch only. Proposal: build it generic, enable per order type via config (`otp_required_food`, default `false`).
4. **Vendor payouts.** No mechanism defined (weekly bank transfer via Paystack Transfers?). Proposal: add a `vendor_wallets` ledger in Phase 3.
5. **Nigerian SMS via Supabase Auth.** Not a built-in provider. Use the **Send SMS Hook** to call Termii/Sendchamp. Spike this in week 1.

---

## 3. Architecture

```
 Customer app ─┐                       ┌─ Supabase Auth (JWT)
 Rider app ────┼── HTTPS ──► Node API ─┼─ Supabase Postgres + PostGIS (source of truth)
 Admin web ────┘        │      │       ├─ Supabase Realtime (Broadcast + Postgres Changes)
        ▲               │      │       └─ Supabase Storage (rider docs, menu images)
        │               │      ├─► Redis (rider geo-index, queues via BullMQ, rate limits)
        │               │      ├─► Paystack (top-ups, transfers) ◄── webhooks
        │               │      ├─► FCM (push)
        └── Realtime ───┘      ├─► Termii/Sendchamp (SMS)
      (subscribe only)         └─► WhatsApp (Twilio / 360dialog)
```

**Golden rules**

1. **Clients never write business data to Supabase directly.** All writes go through the Node API (service-role key, server only). Clients use Supabase only for **auth** and **subscribing to Realtime**.
2. **All money is integer kobo** (`bigint`). Format at the display layer only. Never use floats.
3. **The database is the source of truth.** Redis is a cache/index that can be rebuilt.
4. **Every webhook and job is idempotent.**

---

## 4. Monorepo layout

pnpm + Turborepo.

```
vendo/
├─ apps/
│  ├─ customer/          # Expo app (Vendo)
│  ├─ rider/             # Expo app (Vendo Rider)
│  ├─ admin/             # Next.js dashboard
│  └─ api/               # Node.js + TypeScript (Fastify or Express)
├─ packages/
│  ├─ shared/            # Zod schemas, types, constants, enums, money helpers
│  ├─ api-client/        # Typed client generated from API contracts
│  ├─ ui/                # Shared RN components + design tokens
│  └─ config/            # eslint, tsconfig, prettier
├─ supabase/
│  ├─ migrations/        # SQL migrations (only way to change schema)
│  ├─ seed.sql
│  └─ config.toml
├─ .github/workflows/
└─ turbo.json
```

**API internal structure** (`apps/api/src`): `modules/{auth,users,vendors,menu,orders,dispatch,riders,matching,wallet,payments,payouts,notifications,admin,referrals}/` — each with `routes.ts`, `service.ts`, `schema.ts` (Zod), `repo.ts`. Shared: `lib/{supabase,redis,paystack,fcm,sms,whatsapp,maps}.ts`, `jobs/` (BullMQ workers).

---

## 5. Environment variables

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=               # mobile + admin
SUPABASE_SERVICE_ROLE_KEY=       # API ONLY — never ship to a client
DATABASE_URL=                    # pooled connection string (use the pooler)

# Redis
REDIS_URL=

# Paystack
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=             # mobile inline checkout
PAYSTACK_WEBHOOK_IPS=            # optional allow-list

# Firebase (FCM only)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Maps
GOOGLE_MAPS_API_KEY_SERVER=      # Distance Matrix, Geocoding (restricted by IP)
GOOGLE_MAPS_API_KEY_ANDROID=     # restricted by package + SHA-1
GOOGLE_MAPS_API_KEY_IOS=         # restricted by bundle ID

# SMS / WhatsApp
TERMII_API_KEY=
TERMII_SENDER_ID=
WHATSAPP_PROVIDER=twilio|360dialog
WHATSAPP_API_KEY=

# App
APP_ENV=development|staging|production
JWT_SECRET=                      # only if API mints its own tokens
ADMIN_ALLOWED_EMAIL_DOMAINS=
```

Keep separate Supabase projects for **dev / staging / prod**. Never share keys across environments.

---

## 6. Database

Managed through `supabase/migrations`. Enable extensions: `postgis`, `pgcrypto`, `pg_trgm`.

### 6.1 Enums

```sql
create type order_type        as enum ('food','dispatch');
create type order_status      as enum (
  'scheduled','pending_payment','awaiting_vendor','searching_rider',
  'rider_assigned','picked_up','on_the_way','delivered',
  'cancelled','disputed');
create type rider_presence    as enum ('offline','online','on_trip');
create type approval_status   as enum ('pending','under_review','approved','rejected','suspended');
create type txn_direction     as enum ('credit','debit');
create type txn_status        as enum ('pending','success','failed','reversed');
create type wallet_owner_type as enum ('customer','rider','vendor');
```

### 6.2 Core tables (essentials)

All tables have `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` (trigger-maintained).

```sql
create table cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, country text not null default 'NG',
  is_active boolean not null default false,
  base_fare_kobo bigint not null, per_km_rate_kobo bigint not null,
  min_order_value_kobo bigint not null default 0,
  surge_multiplier numeric(3,2) not null default 1.00,
  opens_at time, closes_at time,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table profiles (               -- 1:1 with auth.users
  id uuid primary key references auth.users(id) on delete cascade,
  name text, phone text unique not null, email text,
  role text not null default 'customer' check (role in ('customer','rider','admin','vendor_staff')),
  city_id uuid references cities(id),
  referral_code text unique, referred_by uuid references profiles(id),
  whatsapp_opt_in boolean not null default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table riders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references profiles(id),
  city_id uuid not null references cities(id),
  presence rider_presence not null default 'offline',
  approval approval_status not null default 'pending',
  approval_note text,
  vehicle_type text, plate_number text,
  rating numeric(3,2) default 0, total_trips int default 0,
  accepted_count int default 0, offered_count int default 0,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table rider_documents (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references riders(id),
  kind text not null check (kind in ('gov_id','bike_registration','photo')),
  storage_path text not null, status text not null default 'pending', reviewed_by uuid, note text
);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text not null,
  city_id uuid not null references cities(id),
  address text, location geography(point,4326) not null,
  is_open boolean not null default false, is_active boolean not null default true,
  commission_rate numeric(5,4) not null default 0.15,   -- 0.15 = 15%
  membership_tier text not null default 'basic' check (membership_tier in ('basic','standard','premium')),
  rating numeric(3,2) default 0,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index on vendors using gist (location);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  name text not null, description text, price_kobo bigint not null check (price_kobo >= 0),
  category text, is_available boolean not null default true, image_url text
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                     -- human-friendly e.g. VD-8F3K2
  type order_type not null, status order_status not null,
  customer_id uuid not null references profiles(id),
  rider_id uuid references riders(id),
  vendor_id uuid references vendors(id),         -- null for dispatch
  city_id uuid not null references cities(id),
  pickup_location geography(point,4326) not null, pickup_address text,
  dropoff_location geography(point,4326) not null, dropoff_address text,
  package_size text, package_note text,          -- dispatch only
  receiver_name text, receiver_phone text,       -- dispatch only
  subtotal_kobo bigint not null default 0,
  delivery_fee_kobo bigint not null,
  discount_kobo bigint not null default 0,
  total_kobo bigint not null,
  commission_kobo bigint not null default 0,
  payment_method text check (payment_method in ('wallet','card','transfer')),
  payment_status text not null default 'unpaid',
  otp_hash text, otp_attempts smallint not null default 0, otp_required boolean not null default false,
  scheduled_for timestamptz,
  distance_m int, route_summary jsonb,           -- written once on completion
  cancelled_reason text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index on orders (customer_id, created_at desc);
create index on orders (rider_id, status);
create index on orders (city_id, status);
create index on orders (scheduled_for) where status = 'scheduled';

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id),
  name_snapshot text not null, unit_price_kobo bigint not null,
  quantity int not null check (quantity > 0), special_note text
);

create table order_events (             -- immutable audit trail / timeline
  id bigserial primary key, order_id uuid not null references orders(id),
  from_status order_status, to_status order_status not null,
  actor_id uuid, actor_role text, meta jsonb, created_at timestamptz default now()
);

create table order_offers (             -- one row per rider offer during matching
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id), rider_id uuid not null references riders(id),
  offered_at timestamptz default now(), expires_at timestamptz not null,
  outcome text check (outcome in ('accepted','rejected','timeout')) 
);
```

### 6.3 Wallet ledger (do not skip this)

Do **not** just increment a `wallet_balance` column. Use a ledger; the balance is a cached sum updated in the **same DB transaction** with a row lock.

```sql
create table wallets (
  id uuid primary key default gen_random_uuid(),
  owner_type wallet_owner_type not null, owner_id uuid not null,
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  unique (owner_type, owner_id)
);

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id),
  direction txn_direction not null, amount_kobo bigint not null check (amount_kobo > 0),
  status txn_status not null default 'pending',
  reference text not null unique,          -- IDEMPOTENCY KEY (Paystack ref, or order:{id}:{purpose})
  channel text,                            -- card | transfer | ussd | wallet | system
  purpose text not null,                   -- topup | order_payment | refund | rider_earning | commission | withdrawal | manual_adjustment
  order_id uuid references orders(id),
  balance_after_kobo bigint, meta jsonb, created_by uuid,
  created_at timestamptz default now()
);

create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id), amount_kobo bigint not null,
  bank_code text not null, account_number text not null, account_name text,
  status text not null default 'pending' check (status in ('pending','approved','processing','completed','failed','declined')),
  paystack_transfer_code text, approved_by uuid, failure_reason text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
```

Also: `notifications`, `device_tokens` (profile_id, fcm_token, platform), `referrals`, `promo_banners`, `ratings`, `app_config` (key/value for thresholds like min withdrawal, matching radius).

### 6.4 Row-Level Security

- **Enable RLS on every table.** Default deny.
- Clients (anon key + user JWT) get **read-only** policies limited to their own rows (e.g. `orders where customer_id = auth.uid()`), which is what makes Realtime **Postgres Changes** safe.
- Writes come from the API using the **service-role key** (bypasses RLS). This key lives only on the server.
- Storage buckets `rider-docs` and `menu-images`: `rider-docs` is **private** (rider uploads own folder; admin reads via signed URLs).

---

## 7. Realtime design

### 7.1 Order status → customer / rider / admin
Use **Supabase Realtime Postgres Changes** on `orders` (RLS-filtered, so a customer only receives their own orders). Every status change also writes an `order_events` row and triggers FCM.

### 7.2 Live GPS
Coordinates are **not** persisted to Postgres during a trip (PRD requirement; protects DB and cost).

1. Rider app (online) sends `POST /riders/me/location {lat,lng,heading,speed,ts}` every **5 s** on trip, **10–15 s** when idle-online.
2. API validates, then:
   - `GEOADD riders:{city_id}` in Redis (used for matching), and `SET rider:{id}:last` with a short TTL.
   - If the rider has an active order → **Broadcast** on private channel `order:{orderId}` event `rider_location`.
3. Customer app subscribes to `order:{orderId}` and animates the marker (interpolate between points; never teleport).
4. **Reconnect recovery:** Broadcast is not stored, so on subscribe the customer app also calls `GET /orders/:id/tracking` to fetch the last known position from Redis.
5. Admin live map: poll `GET /admin/riders/live?city=` every 5 s (served from Redis). Upgrade to a city Broadcast channel if needed.
6. On completion the API writes a **route summary** (distance, duration, downsampled polyline) into `orders.route_summary`.

**Channel authorization:** use *private* Broadcast channels with Realtime RLS on `realtime.messages` so only the order's customer, rider and admins can join `order:{id}`.

**Rider staleness:** a nightly (and 60 s heartbeat) job flips riders to `offline` if no ping for > 60 s and removes them from the Redis geo-index.

---

## 8. Core flows

### 8.1 Order state machine

```
FOOD:     pending_payment → awaiting_vendor → searching_rider → rider_assigned → picked_up → on_the_way → delivered
DISPATCH: pending_payment → searching_rider → rider_assigned → picked_up → on_the_way → delivered
SCHEDULED: scheduled → (T-15 min) → searching_rider → ...
Any pre-pickup state → cancelled ;  delivered/on_the_way → disputed
```

- Transitions live in **one function** (`orders.service.transition(orderId, to, actor)`) that validates legality, writes `order_events`, updates the row, fires notifications. **Nothing else may update `orders.status`.**
- Use `SELECT ... FOR UPDATE` (or an `UPDATE ... WHERE status = $expected`) to prevent races (e.g. two riders accepting).

### 8.2 Pricing

```
distance_m  = Google Distance Matrix (server-side, cached by coord-pair for a few minutes)
delivery_fee = max(city.base_fare + per_km_rate × distance_km, minimum) × surge_multiplier   // all kobo, round up to nearest ₦10
total       = subtotal + delivery_fee − discount
```
Fee is **computed on the server**; the client fare estimate is display-only. Store the final figures on the order.

### 8.3 Rider matching

1. Order reaches `searching_rider` (after payment for prepaid; after vendor accepts for food).
2. `GEOSEARCH riders:{city} FROMLONLAT <pickup> BYRADIUS 5 km ASC` → candidate riders.
3. Filter in Postgres: `approval = approved`, `presence = online` (not `on_trip`), city matches.
4. Offer to the nearest → insert `order_offers` (30 s expiry) → FCM push + Realtime event to the rider.
5. Accept → atomic claim: `UPDATE orders SET rider_id=$r, status='rider_assigned' WHERE id=$o AND status='searching_rider'` — **0 rows = someone else won**, return 409.
6. Reject / timeout (BullMQ delayed job at 30 s) → next candidate; skip riders already offered.
7. Nobody in 5 km → expand to 10 km, notify customer of delay. Nobody in 10 km after N minutes → alert admin queue.

Config in `app_config`: `match_radius_km`, `match_radius_max_km`, `offer_timeout_s`.

### 8.4 OTP delivery confirmation

- Generate a 4-digit OTP on order creation (when `otp_required`). Store **only** `otp_hash` (HMAC with server secret + order id, not bare SHA).
- Customer sees the OTP in tracking; the rider enters it at drop-off → `POST /orders/:id/confirm-delivery`.
- Max **3 attempts** (`otp_attempts`), then lock and route to admin/support. Constant-time comparison.
- Because a 4-digit space is tiny, attempt limiting and the lock are mandatory, not optional.

### 8.5 Payments (Paystack)

**Top-up**
1. `POST /wallet/topup {amount_kobo}` → API creates a `pending` transaction with a unique `reference`, calls Paystack Initialize, returns `access_code`.
2. App opens Paystack checkout (card / bank transfer / USSD).
3. Paystack → `POST /webhooks/paystack`.
4. **Verify `x-paystack-signature` (HMAC-SHA512 of the raw body)** before parsing. Use the raw body, not re-serialised JSON.
5. Handle `charge.success` idempotently: look up by `reference`; if already `success`, return 200 and do nothing. Otherwise credit the wallet and mark `success` in **one DB transaction**.
6. Optionally call Paystack Verify as a second check. Always respond 200 quickly; do heavy work in a queue.

**Checkout**
- Wallet sufficient → debit in one transaction (`reference = order:{id}:payment`).
- Otherwise card/transfer via Paystack with `metadata.order_id`; order stays `pending_payment` until the webhook confirms.

**On delivery (BullMQ job, idempotent per order)**
- Vendor share = `subtotal − commission` → vendor wallet.
- Rider earning = agreed share of `delivery_fee` → rider wallet.
- Platform keeps commission + remaining delivery fee. Store `commission_kobo` on the order.

**Rider withdrawal**
- Rider requests → `withdrawals.pending` (min ₦1,000 default, from `app_config`) → funds are **held** (debit at request time) → admin approves → Paystack Transfers (create recipient → initiate transfer) → webhooks `transfer.success | failed | reversed` update status; **failed/reversed auto-refunds** the wallet.

### 8.6 Scheduled orders
BullMQ repeatable job every minute picks `orders where status='scheduled' and scheduled_for <= now() + interval '15 min'` → moves to `searching_rider`. Push reminder at T-30 min.

### 8.7 Notifications
- One `notify(userId, template, data)` service: inserts into `notifications`, sends FCM to all of the user's `device_tokens`, removes tokens FCM reports as invalid.
- Rider "new order" push must be **high priority / data message** so it wakes a backgrounded app. Test on real low-end Android early.
- WhatsApp (opt-in) for order confirmation; failures must never block order flow.

### 8.8 Auth
- Customer & rider: Supabase phone OTP. Configure the **Send SMS Hook** → API → Termii/Sendchamp. Add WhatsApp OTP as fallback (PRD risk register).
- API validates the Supabase JWT on every request; role comes from `profiles.role`.
- Admin: email login restricted to `ADMIN_ALLOWED_EMAIL_DOMAINS`, with role-based permissions (`super_admin`, `ops`, `finance`, `support`). Finance-only actions: wallet adjustments, withdrawal approvals.

---

## 9. API surface (v1)

Base path `/v1`. JSON. Auth = `Authorization: Bearer <supabase_jwt>`. Validate every body/query with Zod. Errors: `{ error: { code, message, details? } }`.

**Customer**
```
GET   /cities/current                     GET   /vendors?lat&lng&category&q
GET   /vendors/:id (menu)                 POST  /orders/quote {type, pickup, dropoff, items?}
POST  /orders                             GET   /orders?status=active|past
GET   /orders/:id                         GET   /orders/:id/tracking
POST  /orders/:id/cancel                  POST  /orders/:id/rating
GET   /wallet                             POST  /wallet/topup
GET   /wallet/transactions                GET   /notifications
POST  /devices {fcm_token, platform}      POST  /referrals/apply {code}
```
**Rider**
```
POST  /riders/register                    POST  /riders/me/documents
GET   /riders/me                          POST  /riders/me/presence {online|offline}
POST  /riders/me/location                 GET   /riders/me/offers/current
POST  /orders/:id/accept | /reject        POST  /orders/:id/picked-up
POST  /orders/:id/on-the-way              POST  /orders/:id/confirm-delivery {otp?}
GET   /riders/me/earnings?range=          POST  /riders/me/withdrawals
```
**Admin** (`/v1/admin/...`)
```
orders (list/filter/export csv, reassign, cancel, refund)
riders (approval queue, approve/reject, suspend, live map, ledger)
vendors (CRUD, menu CRUD, commission, tier)
payments (transactions, commissions, manual wallet adjust w/ audit, withdrawal approve/decline)
cities (activate, pricing, surge, hours)     banners     referrals config
analytics (kpis, city breakdown, vendor/rider performance, retention)
```
**Webhooks (no JWT, signature-verified):** `POST /webhooks/paystack`, `POST /webhooks/whatsapp`.

Publish an **OpenAPI** spec (generate from Zod) so `packages/api-client` stays typed.

---

## 10. App-specific notes

### Customer app
- Expo (managed + dev client). State: TanStack Query for server data, Zustand for cart/session.
- Map: `react-native-maps`. **Defer map initialisation** until the screen needs it (cold-start target < 3 s on mid-range Android).
- Cart is local until checkout; server re-prices everything on `POST /orders`.
- Layouts must survive **150 % font scale** — no fixed-height containers.

### Rider app
- Background location: `react-native-background-geolocation` (or `expo-location` + foreground service — **spike in week 1**; this is the highest technical risk). Handle Android battery optimisation / OEM killers (Tecno, Infinix, Xiaomi) with an in-app guide.
- Offer screen: 30 s countdown driven by server `expires_at`, not a client timer alone.
- Navigation: deep-link to Google/Apple Maps. In-app map is an overview only.
- Target devices: 2 GB RAM, Android 9+. Keep bundle small, lazy-load screens, avoid heavy animations.

### Admin (Next.js)
- Server components for data tables; client components for the live map and order feed.
- Every mutating action writes to an `audit_log` (who, what, before/after).

---

## 11. Security checklist

- [ ] RLS on every table; service-role key server-side only.
- [ ] Paystack signature verified on the **raw** body; webhook handler idempotent.
- [ ] OTP hashed (HMAC), 3-attempt lock, rate-limited.
- [ ] Rate limiting (Redis) on auth, OTP, location, and payment endpoints.
- [ ] Rider documents in a private bucket; access only via short-lived signed URLs.
- [ ] Google Maps keys restricted (package/SHA-1, bundle ID, server IP).
- [ ] No secrets in the repo or the mobile bundle; use EAS secrets / Railway variables.
- [ ] Server recomputes price, fee and totals — never trust client amounts.
- [ ] Admin actions RBAC-gated and audit-logged; wallet adjustments require a reason.
- [ ] HTTPS everywhere; CORS locked to known origins.
- [ ] Phone numbers and bank details treated as PII (avoid logging; mask in UI).

---

## 12. Build plan

### Phase 0 — Foundations & spikes (week 1–2)
- [ ] Monorepo, CI (lint, typecheck, test), EAS + Railway + Supabase envs (dev/staging/prod)
- [ ] Migrations for core schema + RLS baseline
- [ ] **Spike:** Supabase phone OTP via Send-SMS hook → Termii
- [ ] **Spike:** Android background location on real low-end devices
- [ ] **Spike:** Broadcast latency with 50 simulated riders
- [ ] Decide open questions in §2

### Phase 1 — Food ordering core (8–10 wks)
- [ ] Auth (customer, rider, admin), profiles, city config
- [ ] Vendor + menu CRUD (admin), vendor list / detail in app
- [ ] Cart → quote → checkout → order creation
- [ ] Paystack card & transfer, webhook + idempotency
- [ ] Vendor order confirmation (per §2 decision)
- [ ] Rider onboarding + admin approval queue
- [ ] Rider accept/reject (manual assignment acceptable in P1)
- [ ] Admin: order list, vendor management

### Phase 2 — Real-time & dispatch (4–6 wks)
- [ ] Location ingestion → Redis geo-index → Broadcast
- [ ] Matching engine with offers, timeouts, radius expansion
- [ ] Live tracking screen (customer) + rider status flow
- [ ] Dispatch booking + fare estimate + receiver details
- [ ] OTP delivery confirmation
- [ ] FCM for all status changes; notifications table + in-app list

### Phase 3 — Money & operations (4–5 wks)
- [ ] Wallet ledger, top-up, wallet checkout
- [ ] Commission engine + rider earnings
- [ ] Rider withdrawals via Paystack Transfers + admin approval
- [ ] Admin live rider map, refunds, reassign, wallet adjustments
- [ ] Multi-city pricing config, scheduled deliveries
- [ ] WhatsApp support link / alerts

### Phase 4 — Growth (4+ wks)
- [ ] Referrals, vendor membership tiers, ratings & reviews
- [ ] Analytics dashboard, promo banners, surge toggle
- [ ] Rider photo-on-delivery

**MVP = Phases 0–2 (~14–18 weeks with 1 backend, 1 mobile, 1 frontend engineer).** Admin can be built in parallel against agreed API contracts.

---

## 13. Engineering conventions

- **TypeScript strict** everywhere. Shared Zod schemas in `packages/shared` are the contract.
- **Branches:** `main` (prod) ← `develop` (staging) ← `feat/*`. PRs require review + green CI.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`).
- **DB changes:** migration files only; never edit the schema in the Supabase dashboard on staging/prod.
- **Money:** `bigint` kobo in DB, `number` (integer) in TS, helper `formatNaira(kobo)` in `packages/shared`.
- **Time:** store UTC (`timestamptz`); display in `Africa/Lagos`.
- **Logging:** structured JSON with `order_id`, `user_id`, `request_id`. Never log OTPs, tokens or full phone numbers.
- **Errors/monitoring:** Sentry on all apps + API; uptime check on `/health`.
- **Feature flags** via `app_config` for anything city-specific or risky (surge, OTP-on-food, WhatsApp).

### Testing
- **Unit:** pricing, state machine, commission split, OTP logic, money helpers.
- **Integration:** matching (concurrent accept race), Paystack webhook replay (duplicate events), withdrawal failure/reversal, scheduled-order job.
- **E2E:** Maestro/Detox happy paths — order food, book dispatch, rider completes delivery.
- **Device matrix:** at least one Android Go / 2 GB device, one mid-range Android, one iPhone on iOS 14+.

---

## 14. Definition of done (per feature)

1. Zod schema + OpenAPI updated; typed client regenerated
2. Migration + RLS policy included (if data changes)
3. Unit/integration tests pass; edge cases covered (timeouts, duplicates, offline)
4. Works at 150 % font scale and on the low-end Android device
5. Analytics/log events added; Sentry clean
6. Verified on **staging** with Paystack **test mode** before release

---

## 15. Launch KPIs (from PRD §13)

500+ orders/week · 100+ active riders · 50+ vendors · fulfilment ≥ 85 % · food delivery < 40 min · matching < 3 min avg · payment success ≥ 95 % · crash-free ≥ 99 % · OTP delivery ≥ 97 %.
