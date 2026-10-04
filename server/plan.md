# Vendo server — build plan

Backend for the customer app (`mobile/`), rider app (`riders/`) and operations dashboard (`admin/`).

Sources: `../VENDO_DEVELOPMENT.md` and `../mobile/plan.md`. This checklist tracks server work; unchecked items remain wholly or partly outstanding.

### Implementation progress — 3 October 2026

The first API slice is implemented: Fastify foundation, generated OpenAPI, profile/city/address migration, read-only RLS, Supabase OTP/session adapter, signed Brevo SMS hook, and phone → name → email profile onboarding. Local API/database tests cover this slice. Provider setup, hosted migrations and real SMS/staging verification remain pending; Phases 0–2 are not fully complete. Setup and endpoint usage are in `README.md`.

Account controls added: Brevo email verification with expiry/attempt limits, saved notification/appearance preferences, global refresh-session logout, login/refresh blocking for inactive accounts, support recovery requests, and OTP-confirmed deletion requests with immediate deactivation. Permanent purge/retention and support review tools remain pending.

Food Court API slice added: vendor/category/dish discovery, menus and required options, single-vendor cart validation, Mapbox road quotes, city boundaries/hours/minimums, idempotent unpaid checkout, customer order history/reorder, and audited administrator/vendor-staff actions. Tests use embedded Postgres and transport doubles. Live catalog/provider setup, hosted worker deployment and mobile integration remain pending.

Dispatch API slice added: same-city map-pin pickup/drop-off, notes/landmarks, Document/Small/Large package configuration and surcharge, receiver validation, authoritative quotes, idempotent unpaid orders, shared history, send-again drafts, encrypted customer-only handover codes, assigned-rider confirmation and three-attempt support lockout. Hosted rider/notification integration, support UI and live integration remain pending; scheduling/payment APIs are documented below.

Addresses/maps API slice added: active city discovery, GPS/map-pin service-area resolution, saved-address CRUD with defaults/landmarks/notes and ownership checks, selected city updates, Photon search/reverse lookup with polygon filtering, audited boundary management, same-city routing, bounded provider caches and lookup rate limits. Client GPS permissions/map rendering/debounce/wiring, production Photon hosting, launch-city coverage and hosted staging checks remain pending.

Orders API slice added: central guarded transitions/timestamps, owner-only timelines and paid JSON receipts, cancellation eligibility/fee confirmation and atomic pending refund requests, policy-driven schedules/rescheduling/due processing, unpaid/vendor timeouts, disputes with audited support resolution, delivered-order ratings and assigned-rider lifecycle updates. Automated external refund submission, hosted workers, production concurrency tests and mobile wiring remain pending. Audited disputed-custody resolution is now implemented.

Payments/wallet API slice added: Paystack card/bank-transfer/USSD initialization, server verification, raw signed durable charge hooks, missing-hook reconciliation, owner-only wallet balance/history, immutable ledger, atomic checkout, exact-once wallet refunds, late-success pending refunds, audited external refund reconciliation and money-aware deletion guards. Hosted Paystack/Supabase verification, true multi-connection race tests, processor deployment, mobile checkout wiring, intent replacement/review tooling, automated external refund submission and chargebacks/reversals remain pending.

Rider matching/tracking API slice added: reviewed rider/vehicle applications, approved presence and validated latest GPS, configured same-city nearest offers with expiry/rejection/radius expansion, locked assignment and reservation indexes, stale cleanup and restart recovery, no-rider queue/retry/full-refund cancellation, assigned-job retrieval, private GPS/contact/road-ETA snapshots and authenticated SSE reconnects. Postgres is authoritative for this slice; Redis geo/BullMQ and Supabase private Broadcast remain scaling follow-ups. Private documents, offer notifications, audited admin reassignment/live map and disputed-custody resolution are now implemented. Route history, real-device background GPS and hosted concurrency/load checks remain pending.

Operations additions: customer–rider order chat, encrypted document review, vendor menu/availability tools, admin custody controls, immutable settlement/withdrawal ledgers, verified payouts, membership placements, banners, surge, city reports, worker heartbeats, containers and encrypted backup scripts. All 45 local tests, typecheck, lint, build and OpenAPI generation pass. Finance policies remain unset and transfers disabled; live provider/deployment and client integration remain pending.

Auth transport decision: clients use API OTP/verify/refresh/logout endpoints, backed by Supabase Auth. The API owns profile operations; clients can use Supabase for authorized Realtime subscriptions later.

## 1. Scope and working decisions

- One API for Food Court, Dispatch, accounts, wallets and operations.
- Authentication: **phone number → verify OTP → add name → add email**. Phone is the login identity; name and email complete the profile.
- Node.js + TypeScript strict, Fastify, Zod validation and generated OpenAPI contracts.
- Supabase Auth, Postgres + PostGIS, Storage and Realtime. Redis + BullMQ for matching, rate limits and background work.
- Paystack for payments and transfers; FCM for push; Brevo for SMS (through the Supabase Send SMS Hook for phone OTP) and transactional email.
- Use Mapbox Directions for routes and Photon for address search/reverse lookup, following the mobile plan. This differs from the older guide's Google Maps proposal and must be reconciled before implementation.
- Keep the API self-contained in `server/` initially. Extract shared packages when another app needs them; no repository restructuring is required to begin.
- Launch cities: Abuja, Kaduna, Kano and Lagos, controlled by database configuration and service boundaries.
- Working launch assumptions: same-city dispatch, prepaid orders, no cash on delivery, delivery-code confirmation required for dispatch and configurable for food.
- Provider versions, compatibility, quotas and deployment settings must be verified against official documentation during setup.

## 2. Rules every module follows

- Business writes go through the API. Client Supabase access is limited to authentication, authorized subscriptions and explicitly permitted storage uploads.
- Postgres is the source of truth. Redis data is disposable and rebuildable.
- Store money as integer kobo. Define safe integer limits for JSON/TypeScript; never calculate prices with floating-point currency amounts.
- Server calculates prices, commissions and earnings. Client totals are never authoritative.
- All order transitions go through one validated transition service and produce immutable order events.
- Financial changes are atomic, audited and idempotent. Use a ledger, row locks and unique references.
- Store timestamps in UTC; use Africa/Lagos for customer-facing schedules and operating hours.
- Jobs, webhooks and retried requests must tolerate duplicate delivery and concurrent execution.
- Never expose secrets, OTPs, other users' orders, documents or financial information.

## 3. Phone authentication and onboarding

### Customer flow

1. Enter phone number. Normalize Nigerian local/international inputs to E.164 and validate the supported country.
2. Request SMS OTP through Supabase Auth. Apply resend cooldowns, attempt limits and abuse controls.
3. Verify OTP. Supabase issues the session; the API validates its token and idempotently creates or loads the customer profile.
4. New user adds their name. Persist it and return the next onboarding step.
5. User adds their email. Validate and persist it, then mark the profile complete.
6. App continues to city/location selection and normal use. Location permission is not an authentication requirement.

Existing users log in with phone + OTP and resume any unfinished onboarding. They do not re-enter name/email on every login.

**Working interpretation:** both name and email are required to complete onboarding. Email is profile/contact information, not a password or alternate login. Email ownership verification is a separate task; an unverified email must not be used for account recovery or sensitive notifications.

### Tasks

- [x] Define Zod contracts for phone input, OTP verification, profile name and profile email.
- [ ] Verify current Supabase OTP/session behavior and configure the SMS hook with Brevo.
- [x] Implement and authenticate the SMS hook; prevent it becoming an unrestricted SMS endpoint. Live provider configuration/verification remains pending.
- [x] Decide the exact auth transport contract: API endpoints wrapping Supabase OTP/session operations, API for profile operations. Document one consistent flow for both mobile apps.
- [ ] Add OTP cooldowns, expiry handling, request/verification limits and generic errors that avoid account enumeration.
- [x] Validate sessions through Supabase Auth's authenticated user lookup; never trust locally decoded claims alone.
- [x] Implement idempotent profile bootstrap from the authenticated Supabase user, including concurrent first-login protection.
- [x] Store onboarding progress (`name_required`, `email_required`, `complete`) and return it from `GET /v1/me`.
- [x] Implement `PATCH /v1/me/name` and `PATCH /v1/me/email`; prevent skipping required steps and disallow client changes to role, phone or completion flags.
- [ ] Gate order creation, wallet actions and rider onboarding on profile completion; allow profile completion and basic discovery before that.
- [x] Add a Brevo transactional email adapter and sender configuration.
- [ ] Configure verified email domain/sender and approved SMS sender in Brevo; test Nigerian SMS and email delivery in staging.
- [x] Add email ownership verification using Brevo and safe email-change handling. Keep phone as the login identity.
- [ ] Define phone-change flow requiring reauthentication and verification of the new number; do not automatically merge accounts.
- [ ] Document session refresh, logout, session revocation, suspended accounts and account deletion behavior.
- [x] Add same-phone OTP recovery and support request intake; do not allow recovery using an unverified email.
- [ ] Build privileged recovery review tools and finalize identity-proof procedures.
- [x] Add account preferences and OTP-confirmed deletion request/deactivation.
- [ ] Add permanent deletion processing and finalize business-record retention/anonymization.
- [ ] Test expired/wrong OTP, resend abuse, returning users, interrupted onboarding, invalid JWTs and concurrent bootstrap.

Riders use the same phone → OTP → name → email flow, then submit rider details/documents for approval. Admin access is invite-only with separate role checks and stronger authentication; a public signup can never grant admin or finance permissions.

**Done when:** a new user can authenticate, add name then email, resume after interruption and access protected endpoints only with the correct session and onboarding state.

## 4. Proposed layout

```text
server/
  src/
    app.ts                 # Fastify app factory
    index.ts               # API startup
    worker.ts              # Background worker startup
    config/                # Validated environment and runtime config
    plugins/               # Auth, database, rate limits, errors
    modules/               # Each: routes, schema, service, repository
      auth/ users/ cities/ addresses/ vendors/ menu/
      orders/ dispatch/ riders/ matching/ tracking/
      wallet/ payments/ payouts/ notifications/ admin/ referrals/
    integrations/          # Supabase, Redis, Paystack, FCM, SMS, maps
    jobs/                  # Matching, scheduling, settlement, notifications
    lib/                   # Money, time, idempotency, logging
  supabase/
    migrations/
    seed.sql
  tests/
    unit/ integration/ contracts/
  docs/                    # OpenAPI, setup and operational runbooks
  .env.example             # Names and placeholders only
  package.json
  plan.md
```

## 5. Build phases and task checklist

### Phase 0 — Server foundation

- [x] Initialize package, strict TypeScript, supported runtime and reproducible lockfile.
- [ ] Add development, build, start, worker, lint, typecheck and test commands.
- [x] Create Fastify app factory, versioned `/v1` routes and standardized error responses.
- [x] Add environment validation and `.env.example` without credentials.
- [ ] Configure Postgres/Supabase and Redis connections with clean shutdown.
- [x] Add `/health` and readiness checks, request IDs and structured logs with PII redaction.
- [x] Add body size limits, timeouts, CORS configuration and route-specific rate limiting.
- [ ] Configure local development/test dependencies and separate dev/staging/production environments.
- [x] Establish CI for typecheck, lint, tests, build and migration checks.
- [ ] Generate OpenAPI from route schemas and document authentication/errors/pagination. Auth/profile contracts are generated; pagination belongs to later list endpoints.

**Done when:** the API and worker run locally, configuration fails clearly when invalid, and CI passes.

### Phase 1 — Database and access controls

- [ ] Add migration workflow and PostGIS/pgcrypto/pg_trgm extensions.
- [ ] Create profiles, cities, service boundaries, saved addresses and app configuration.
- [ ] Create riders, rider documents, vendors and menu items.
- [ ] Create orders, item snapshots, order events, rider offers and ratings.
- [ ] Create wallets, ledger transactions, withdrawals and settlement records.
- [ ] Create notifications, device tokens, referrals, promo banners and admin audit logs.
- [ ] Add constraints, foreign keys, timestamps, monetary checks and query/spatial indexes.
- [ ] Resolve schema gaps: USSD payment representation, package-size pricing, cancellation fees, admin permissions, vendor staff ownership and onboarding progress.
- [ ] Enable default-deny RLS and scoped read policies for all client-accessible tables.
- [ ] Configure private Realtime channel authorization and storage bucket policies.
- [ ] Ensure delivery-code hashes and internal payment fields are excluded from public subscriptions/responses; use separate protected storage or safe event projections.
- [ ] Seed the four cities, configurable rates, test vendors/menu items and development accounts without production data.
- [ ] Verify migrations from a fresh database and document safe production migration/rollback procedures.
- [ ] Test cross-user access, role escalation, storage ownership and unauthorized subscriptions.

**Done when:** a fresh database can be created reproducibly and access-control tests pass.

### Phase 2 — Authentication and profiles

- [ ] Complete every task in section 3.
- [ ] Add customer/rider/admin authorization middleware and explicit finance/support/ops permissions.
- [x] Implement name/email updates, account preferences and account deactivation/deletion requests.
- [x] Implement city preference updates with active-city validation and an explicit clear option.
- [ ] Define retention/anonymization for financial records that cannot be immediately deleted.
- [x] Implement saved-address CRUD with exact coordinates, landmarks/notes, default selection, ownership and service-boundary checks.
- [ ] Provide app configuration, service cities and supported capabilities to clients.

**Done when:** customer and rider onboarding works end to end in staging; admin access is restricted and audited.

### Phase 3 — Discovery, addresses and pricing

- [x] Implement city/service-area resolution using validated simple polygons and operating hours; PostGIS/multipolygon support remains pending.
- [x] Implement vendor list/search/category filters, pagination, availability and vendor/menu detail. Hosted catalog setup remains pending.
- [x] Add scoped public logo/image and private document uploads through Supabase Storage, with DOCX structure checks, private metadata and authorized downloads. Hosted bucket setup and client upload screens remain pending.
- [ ] Complete client debounce/API wiring; Photon search/reverse proxy, coordinate checks, city bias/bounds, polygon filtering, cache and request limits are implemented.
- [ ] Verify production motorcycle route suitability; Mapbox driving routing, timeouts and bounded distance caches are implemented.
- [ ] Decide production Photon hosting and verify address coverage in all four cities.
- [ ] Implement quotes for food/dispatch with distance, size, base fare, minimums, discounts and configured rounding.
- [ ] Reject unsupported routes, same-city violations, closed vendors and unavailable menu items.
- [ ] Return quote ID, expiry, currency, breakdown and estimated times; revalidate at checkout and require acceptance of changed prices before charge.
- [ ] Test pricing boundaries, integer rounding, expired quotes and provider failures. Never silently charge using a straight-line mock fare.

**Done when:** clients can browse real seeded menus, resolve addresses and obtain authoritative quotes.

### Phase 4 — Orders and vendor fulfillment

- [x] Implement food/dispatch creation with idempotency keys and immutable item/price snapshots; orders remain unpaid until verified payment integration.
- [x] Enforce one-vendor food carts initially and validate item quantities/options against the menu.
- [x] Validate dispatch receiver, package description/size, notes and prohibited-item acknowledgment; configured limits and optional measurements are enforced.
- [x] Implement central guarded order transitions, endpoint authorization, row locks and event history; real payment/matching integrations must use these guards.
- [ ] Deliver vendor view/dashboard; authenticated, scoped accept/reject/ready APIs are implemented.
- [ ] Deploy due processor and notifications; vendor timeouts/rejection record atomic full pending refunds. External refund submission remains operator-driven, with verified settlement reconciliation.
- [x] Implement customer-owned active/past orders, detail, timelines, paid JSON receipts and reorder/send-again.
- [ ] Complete refund settlement and operational disputed-order recovery; cancellation review/fee consent/pending refunds and owner disputes/admin resolution records are implemented.
- [x] Add policy-driven scheduled orders, timezone-aware input, booking windows and rescheduling/cancellation cutoffs; hosted due-job deployment remains pending.
- [x] Guard schedule activation with verified payment and retain Food Court vendor confirmation; activation lead is configurable.
- [ ] Test legal/illegal transitions, concurrent cancellation/payment/assignment and repeated order requests.

**Done when:** both order types have a tested lifecycle, including failure and cancellation paths.

### Phase 5 — Payments and wallet correctness

- [x] Implement Paystack initialization for order payments and wallet top-ups.
- [x] Verify webhook signatures against the raw body; persist/deduplicate events before durable processing.
- [x] Match payment reference, amount, currency and customer/order before applying credits.
- [x] Keep orders unpaid until verified server confirmation; add reconciliation for missing/delayed webhooks.
- [x] Implement wallet balance/history and atomic wallet checkout with row locks and ledger references.
- [ ] Complete automatic external refund submission and chargeback/reversal recovery; wallet refunds, verified external settlement and idempotent provider/database retry recovery are implemented.
- [x] Add consistent card/transfer/USSD channel representation to API and database contracts.
- [ ] Add operator review/intent replacement and terminal failed-attempt policies. Insufficient funds, stable-reference initialization timeouts, city-policy expiry and late-success refund handling are implemented.
- [ ] Run true multi-connection concurrent-debit/provider race tests and hosted test-mode checks; isolated duplicate hooks, mismatches, retries, late success and atomic rollback tests are implemented.

**Done when:** test payments and wallet checkout produce correct balances exactly once under retries.

### Phase 6 — Riders, matching and tracking

- [ ] Complete rider review UI, required-document policy, scanning and retention; encrypted private document upload/admin review and application approval APIs are implemented.
- [x] Implement presence transitions; only approved eligible riders can go online/accept jobs.
- [ ] Add Redis geo acceleration and retention processing; Postgres latest GPS, coordinate/timestamp/accuracy validation and effective TTL exclusion are implemented.
- [ ] Spike real-device background location with the rider app before committing to location assumptions.
- [x] Implement sequential nearest-rider offers, expiry, rejection, radius expansion and operations escalation.
- [x] Atomically claim order and rider availability so two orders cannot assign the same rider concurrently.
- [x] Add stale-rider cleanup and recovery of jobs interrupted by worker restarts.
- [ ] Configure/verify Supabase private Broadcast at scale; private API SSE and authorized reconnect snapshots are implemented.
- [ ] Add completion route summaries/history; guarded pickup/on-the-way/delivery endpoints and matched Food Court/Dispatch flows are implemented.
- [ ] Complete support override tooling/audit; four-digit Dispatch codes, encrypted customer retrieval, HMAC verification and three-attempt lockout are implemented.
- [x] Resolve secure customer code retrieval: separately encrypted private storage, order-bound HMAC and an authenticated owner-only endpoint; no rider code retrieval. Key rotation remains pending.
- [ ] Complete unreachable-receiver custody/support flows; no-rider state/queue, retry and full-refund cancellation are implemented.
- [ ] Run real multi-connection simultaneous accept/job races, active-stream interruption and device checks; local unique reservation guards, retries, expiry, stale GPS, terminal reconnect and delivery-code tests are implemented.

**Done when:** a paid order is matched, tracked and delivered by an authorized rider with validated handover.

### Phase 7 — Settlement, withdrawals and operations

- [ ] Agree vendor commission basis, rider earnings split and payout schedule with the business.
- [x] Implement policy-snapshotted, idempotent delivered-order settlement to immutable vendor/rider ledgers and platform accounting; hosted validation remains pending.
- [x] Implement verified bank resolution, masked payout recipients and policy-controlled withdrawal minimums.
- [x] Hold funds atomically on idempotent withdrawal requests; implement audited review and disabled-by-default Paystack transfer submission.
- [x] Persist signed transfer hooks and reconcile verified success/failure/reversal; uncertain submissions enter review without automatic resubmission.
- [ ] Agree automated vendor payout cadence; vendor earnings, reviewed withdrawal payouts, verified reconciliation and latest-1000-entry CSV export are implemented.
- [x] Implement scoped admin order filters, pre-custody reassignment/cancellation, explicit disputed-custody resolution, rider review/live map and vendor management.
- [x] Implement city fares/hours/boundaries, configurable surge, policy snapshots and audited finance actions.
- [x] Add delivered-order rating eligibility and duplicate protection.
- [x] Test isolated payout retries, rejected withdrawals, failed/reversed transfers and permissions; real provider and multi-connection checks remain pending.

**Done when:** money earned, held, paid and refunded reconciles with provider and internal records.

### Phase 8 — Notifications, promo codes and customer extras

- [x] Implement private FCM device registration/removal and persisted owner-only notification inbox/read state.
- [x] Add transactional notifications for onboarding, orders, rider offers, no-rider handling, payments, refunds, support and referral rewards; chat, earnings and withdrawal updates are included.
- [x] Add FCM HTTP v1, UNREGISTERED cleanup, durable deduplicated outbox, fenced leases and bounded retries; live delivery validation remains pending.
- [ ] Test high-priority rider offers on real low-end Android devices with the rider app.
- [x] Add optional approved-template Brevo WhatsApp alerts with opt-in and provider-independent order transactions.
- [x] Add paid scheduled reminders with cancellation/reschedule checks and persisted channel/reminder/theme preferences.
- [x] Add disabled-until-configured referral campaigns, first-order eligibility/holding periods, caps, basic abuse checks and atomic idempotent wallet rewards. Advanced fraud/chargeback/clawback controls remain pending.
- [x] Add audited promo-code campaigns with server quote discounts, locked checkout eligibility/usage limits and exact-once redemptions.
- [x] Add private support tickets/conversations, audited admin replies/resolution, public support configuration and versioned legal publishing/acceptance.
- [x] Add dated membership tiers/sponsored placement, promotional banners and city surge controls. Broader feature flags remain pending.
- [ ] Complete matching latency/retention/provider reports; bounded city/day/type order, paid/refund and fulfillment-duration reporting is implemented.

**Done when:** critical updates arrive reliably; optional growth features can be enabled independently.

### Phase 9 — Integration and production release

- [ ] Publish API contracts and connect customer/rider/admin clients to staging.
- [ ] Replace mobile mock calls incrementally and run food/dispatch/payment/payout journeys end to end.
- [ ] Test poor networks, retry storms, expired sessions, provider outages and worker/database restarts.
- [ ] Load-test quotes, concurrent matching, location ingestion and Realtime delivery at expected launch volume.
- [ ] Configure deployment, worker scaling, secrets, HTTPS, monitoring and alerting.
- [ ] Configure backups and test restore; verify Redis loss recovery and queue replay.
- [ ] Add Sentry/error tracking and alerts for payment failures, matching backlog, stale riders and reconciliation discrepancies.
- [ ] Write operational runbooks for refunds, disputed delivery codes, provider outages, account recovery and incident response.
- [ ] Confirm legal/privacy wording, retention and production provider credentials with the business.
- [ ] Run staging acceptance with Paystack test mode; use a controlled live-payment smoke test before launch.
- [ ] Document release/rollback procedure and confirm migrations are compatible with deployed clients.

**Done when:** complete journeys pass in staging and production operations have monitoring and recovery procedures.

## 6. API contract checklist

All business routes use `/v1`, typed JSON, scoped authorization and standardized errors. Define request/response schemas and pagination before client integration.

| Area | Planned endpoints/capabilities |
|---|---|
| Auth | Supabase phone OTP/session flow; authenticated SMS hook; documented refresh/logout |
| Profile | `GET /me`, `PATCH /me/name`, `PATCH /me/email`, profile preferences, deletion request |
| Discovery | Cities/config, vendor list/detail/menu, categories |
| Addresses | Saved-address CRUD, address search/reverse lookup, service-area validation |
| Orders | Quote, create, list/detail, cancel, schedule/edit, rating, receipt |
| Payments | Initialize checkout/top-up, payment status, signed Paystack webhook |
| Wallet | Balance, paginated transactions, withdrawals |
| Riders | Register/documents, profile, presence, location, current offers, earnings |
| Fulfillment | Accept/reject, picked-up, on-the-way, confirm-delivery |
| Delivery chat | Private persisted customer/rider messages, read cursors, idempotent sends and resumable SSE |
| Tracking | Authorized snapshot and private location/status subscriptions |
| Vendor operations | Scoped accept/reject/ready actions and menu availability |
| Notifications | Device registration, inbox/read status and preferences |
| Admin | Orders, riders, vendors, cities, finance, config, audits and analytics |
| Growth | Referral application/config, ratings, tiers and banners |

## 7. Decisions and external setup

These do not block writing the foundation; resolve each before its dependent phase.

- [ ] Confirm required profile email and whether email verification blocks ordering (default: collect email, verify separately).
- [ ] Confirm the Mapbox/Photon proposal and reconcile the older development guide.
- [ ] Confirm same-city dispatch, package limits and no cash on delivery.
- [ ] Confirm vendor confirmation mechanism and acceptance timeout before food fulfillment.
- [ ] Agree cancellation fees per city, refund rules, commission basis, rider split and vendor payout schedule.
- [ ] Decide production Photon hosting and routing travel mode suitable for motorcycle deliveries.
- [ ] Obtain separate Supabase environments, Redis and API/worker hosting.
- [ ] Obtain Brevo sender setup, Paystack test credentials, Mapbox access and FCM credentials.
- [ ] Obtain production payment/transfer approvals and messaging-provider setup before release.
- [ ] Invite initial admin/finance operators; credentials are supplied through secret configuration, never committed.

## 8. First implementation milestone

Start with **Phases 0–2**: runnable server, migrations/access controls, and phone → OTP → name → email onboarding. Then build discovery/quotes and orders before integrating payments and matching.

Every completed feature must include validation, authorization, appropriate tests, updated OpenAPI contracts, safe logs and staging verification. Do not mark provider-dependent tasks complete using mocks alone.

## Operations implementation — October 2026

Migration 010 and the operations modules implement the backend additions above. Customer/rider delivery chat is now separate from support conversations. Docker/Compose, compiled dedicated workers/heartbeats and encrypted logical backup/isolated restore scripts are provided. See [OPERATIONS.md](OPERATIONS.md) for setup and production gaps. No hosted migration, deployment, backup/restore or live payout was performed. Business finance rules remain unset; transfers remain disabled. Client integration, real-device/provider acceptance, production monitoring, recovery rehearsals and chargeback/clawback controls remain pending.

Storage implementation: migration 011, server-only Storage credentials, explicit bucket setup, restrictive access policies, public vendor/branding assets and owner/admin private downloads are implemented. New rider documents use the private bucket; legacy encryption remains readable. See [MEDIA.md](MEDIA.md). Retention/scanning/cleanup, object backups and hosted acceptance remain pending.

Vendor registration implementation: migration 012 adds private idempotent applications, admin approval/rejection, owner withdrawals/reapplication, automatic trusted store/account linkage and paid-order staff notifications. Dedicated `/v1/vendor/stores` APIs provide scoped store/profile, menu, orders, summary, media and availability management. See [VENDORS.md](VENDORS.md). Hosted migrations, webapp screens, browser FCM setup and real provider/concurrency acceptance remain pending.
