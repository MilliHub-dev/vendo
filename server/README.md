# Vendo server

Authentication/account and Food Court/Dispatch API: Supabase phone authentication, persisted **phone → OTP → name → email** onboarding, Brevo email verification, preferences, global logout, and recovery/deletion requests. Food Court includes discovery, menus, cart validation, quotes, unpaid checkout, order history and vendor actions. Dispatch adds parcel quotes, receiver details, protected delivery codes and send-again drafts. Payments add Paystack checkout/verification, signed webhooks, wallet balances/history, atomic checkout and refunds. Matching, payout settlement and remaining rider/admin workflows are tracked in [plan.md](./plan.md).

## Run locally

Requires Node 24 and npm. From `server/`:

```sh
npm ci
cp .env.example .env
npm run dev
```

The default address is `http://127.0.0.1:4000`; opening the base URL redirects to interactive Swagger documentation at `/docs/`. Without provider credentials, `/health`, `/docs/` and `/openapi.json` work, `/ready` returns 503, and provider-dependent endpoints return a clear 503. There are no fake users, test OTPs or in-memory profile storage in the running API.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run openapi
npm start
```

Tests use API injection, provider transport doubles and a real embedded Postgres engine (PGlite) to exercise migrations, constraints and row-level access policies. They do not send SMS or modify a hosted Supabase project.

## Connect Supabase and SMS

1. Create a development Supabase project and enable phone authentication. Keep automatic phone confirmation off. Disable unused public login providers for this phone-only customer flow.
2. Set `SUPABASE_URL` and its public anon/publishable key in `.env`. A service-role key is not needed for these endpoints.
3. Set `DATABASE_URL` to a privileged Supabase Postgres connection/pooler URL and use verified TLS. Set `DATABASE_CA_PATH` if a private CA is needed. For migrations use a direct or session-pooler connection; keep credentials server-side.
4. Run `npm run db:migrate` against the development database. The runner applies pending SQL atomically, records checksums and rejects edited applied migrations. Do not also apply these files manually or through a second migration runner.
5. Generate a server-only `EMAIL_VERIFICATION_SECRET` of at least 32 characters (see `.env.example`). Set `BREVO_API_KEY`, an approved `BREVO_SMS_SENDER`, a verified `BREVO_EMAIL_SENDER`, and `BREVO_EMAIL_SENDER_NAME`. Obtain `SEND_SMS_HOOK_SECRET` from Supabase's HTTP Send SMS hook configuration.
6. Configure the hook to call the deployed API's HTTPS `/v1/hooks/send-sms` endpoint. Supabase cannot call a localhost URL. Use a development deployment or an explicitly configured local tunnel to test actual SMS.
7. Set `REDIS_URL` for shared rate limits and hook deduplication. Production requires Redis; only development/tests use bounded process-local counters.
8. Configure Supabase's own OTP expiry, resend and verification limits. Its public auth API is independently accessible; API middleware alone cannot protect it. The signed SMS hook also limits sends by phone. CAPTCHA support remains a production-hardening task.

Schema includes profiles, inactive city seed records and saved addresses. Cities have no invented prices and are not activated by default. Active city discovery and saved-address APIs are available; use `/v1/cities` to select the city UUID for discovery and delivery quotes.

## Authentication contract

Mobile should use the API endpoints below for OTP/session operations and securely store returned Supabase tokens. Send the access token as `Authorization: Bearer <access_token>` on profile requests. Do not duplicate OTP requests through both SDK and API. Supabase SDK usage for authorized Realtime subscriptions remains possible later.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/v1/auth/otp/request` | `{ "phone": "08144461726" }`; normalized to Nigerian E.164 |
| POST | `/v1/auth/otp/verify` | `{ "phone": "+2348144461726", "token": "123456" }`; token shown here is illustrative |
| POST | `/v1/auth/refresh` | `{ "refresh_token": "..." }`; returns renewed session tokens |
| POST | `/v1/auth/logout` | Optional `{ "scope": "local" }` (default) or `{ "scope": "global" }`; client removes local tokens |
| GET | `/v1/me` | Idempotently creates/loads the authenticated phone profile |
| PATCH | `/v1/me/name` | `{ "name": "Amina Bello" }` |
| PATCH | `/v1/me/email` | `{ "email": "amina@example.com" }`; requires saved name |
| GET | `/health` | Process liveness |
| GET | `/ready` | Database schema/auth configuration and Redis connectivity |
| GET | `/openapi.json` | Generated API reference; snapshot in `docs/openapi.json` |

After verification, call `/v1/me` and follow `onboarding_step`:

- `name_required`: save the name.
- `email_required`: save the email.
- `complete`: continue into the app.

Returning users resume from persisted data. Email is a profile/contact field; it is not attached as an alternate Supabase login. Collection is required for onboarding. The email verification endpoints below verify ownership through Brevo; verification is separate from login and does not grant email-based account recovery.

Profiles default to `customer`; client payloads cannot choose roles or edit account status, phone, user ID or onboarding flags. The API validates sessions through Supabase Auth rather than trusting client JWT claims or user metadata. Name/email endpoints always operate on the authenticated user's ID. RLS permits client reads of their own records and denies direct business writes.

Logout invalidates the selected refresh sessions. Existing access tokens may remain valid until their configured expiry; mobile must remove both tokens locally. Deactivated/suspended accounts are denied profile access and cannot receive sessions through API verification/refresh. Private profile/address/preference reads are also denied by RLS after deactivation. Immediate revocation of access tokens on normal logout and admin account management are not implemented yet.

## Operational notes

- Configure exact `CORS_ORIGINS`; native mobile clients do not require browser CORS permission.
- Behind a reverse proxy, set `TRUST_PROXY` to trusted proxy addresses/CIDRs so rate limits use the correct client IP. Never trust arbitrary forwarded headers.
- Logs exclude request bodies, query strings, provider error payloads and authorization headers. Error responses carry a request ID.
- SMS hook signatures cover the exact raw JSON payload and timestamp. Successful hook IDs are deduplicated for ten minutes; in-flight duplicates fail so they can be retried. Provider timeouts can leave delivery outcome uncertain, so SMS cannot be guaranteed exactly once across provider failures.
- `/ready` verifies local auth configuration, the profile/account/order/dispatch tables and configured Redis. It does not prove external Supabase or Brevo uptime or SMS deliverability; staging verification remains required.
- Background workers, full business schema, phone changes, support recovery review, permanent deletion/retention processing, admin roles and production deployment are pending. See the task checklist.

Provider references used for implementation: [Supabase phone login](https://supabase.com/docs/guides/auth/phone-login), [server-side getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [signed Auth hooks](https://supabase.com/docs/guides/auth/auth-hooks), and [Brevo SMS](https://developers.brevo.com/docs/transactional-sms-endpoints) and [Brevo email](https://developers.brevo.com/docs/send-a-transactional-email).

## Brevo email

The internal email adapter uses Brevo transactional email with the same API key as SMS. It is available to backend services; no public arbitrary-send endpoint is exposed. Verify the sending domain/address in Brevo before live testing. Email verification is explicitly requested after collecting the profile email; saving the email does not send a message or mark it verified. Notifications and delivery-event processing remain separate tasks in the plan.

## Account endpoints

All `/me` endpoints require the phone session. These are backend contracts; mobile screens must call them before device testing.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/v1/me/email/verification/request` | Send a six-digit code to the saved profile email; returns `challenge_id`, expiry and resend cooldown |
| POST | `/v1/me/email/verification/confirm` | `{ "challenge_id": "uuid", "code": "123456" }`; sets `email_verified` only after validation |
| GET | `/v1/me/preferences` | Theme, push/email notification preferences and WhatsApp opt-in |
| PATCH | `/v1/me/preferences` | Partial preference update, e.g. `{ "theme": "dark", "email_enabled": false }` |
| POST | `/v1/me/deletion-request` | `{ "otp": "123456", "confirmation": "DELETE", "reason": "optional" }`; verifies fresh phone OTP, deactivates and records pending deletion |
| POST | `/v1/auth/recovery-request` | `{ "phone": "08144461726", "contact_email": "contact@example.com", "message": "I cannot access my phone anymore." }`; support review only |

Email codes are HMAC-hashed using the server secret, bound to user/challenge/email, valid for ten minutes, single use and locked after five wrong attempts. Resends replace the previous challenge; changing email removes it and resets verification. Failed sending removes the challenge. Codes are never returned by the API or written to logs. Code verification does not create a login session.

For deletion, request a new SMS code for the account phone through `/auth/otp/request`, then submit that code directly to `/me/deletion-request`. Do not consume it through `/auth/otp/verify` first. The explicit `DELETE` confirmation and code are required. The request transaction deactivates the account and records the request atomically; existing account data is not yet physically purged.

Same-phone recovery is normal OTP login and resumes the existing profile. Lost-phone recovery records a request without looking up or disclosing an account, sending email, authenticating the caller or replacing a phone number. An unverified contact address supplied on this endpoint is only a way to contact the requester, never proof of account ownership.

Operational follow-up: privileged support staff review `vendo_internal.account_recovery_requests` and verify identity before any administrative change. Deletion requests live in `vendo_internal.account_deletion_requests`; permanent deletion must remove/anonymize business data and the Supabase identity according to the agreed retention policy. No automatic recovery or purge worker is shipped in this milestone. Notification preferences are persisted, but future notification services must honor them; verification messages are essential account messages.

Session-scope behavior follows [Supabase sign-out documentation](https://supabase.com/docs/guides/auth/signout).


## Food Court

Apply the new `202610030003_food_court.sql` migration using `npm run db:migrate` before using these endpoints. Configure `MAPBOX_ACCESS_TOKEN_SERVER` in the server environment. No live database migration or provider request is made by the test suite.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/v1/vendors?city_id=<uuid>` | Public discovery; optional `q` (vendor/cuisine/dish), `category`, paired `lat`/`lng`, `limit` and `offset` |
| GET | `/v1/vendors/categories` | Supported vendor categories |
| GET | `/v1/vendors/:id` | Active vendor and menu, including option groups and availability |
| POST | `/v1/food/cart/validate` | Authenticate and validate a single-vendor cart; calculate prices from the menu |
| POST | `/v1/orders/quote` | Food quote with delivery breakdown, route, ETA and five-minute expiry |
| POST | `/v1/orders` | Create an unpaid order from an owned, valid quote; requires `Idempotency-Key` |
| GET | `/v1/orders?status=active` | Customer's own orders; `past`, `limit` and `offset` supported |
| GET | `/v1/orders/:id` | Customer's own order and stored price/item snapshot |
| POST | `/v1/orders/:id/reorder` | Revalidate a past order against the current menu; returns a cart |
| POST / PUT | `/v1/admin/vendors` / `/v1/admin/vendors/:id` | Create/update vendor; administrator only |
| POST / PUT | `/v1/admin/vendors/:id/menu` / `/v1/admin/vendors/:id/menu/:itemId` | Create/update menu item and options; administrator only |
| POST | `/v1/admin/vendors/:id/staff` | Assign an existing active vendor-staff profile using `profile_id` |
| POST | `/v1/vendor/orders/:id/action` | Assigned staff/admin: `accept`, `reject` or `ready`; verified payment required |

Cart body:

```json
{
  "vendor_id": "<vendor UUID>",
  "items": [{ "menu_item_id": "<item UUID>", "quantity": 2, "option_ids": [], "note": "Less spicy" }]
}
```

For a quote, add `"type": "food"` and `"dropoff": { "lat": 10.6, "lng": 7.6, "address": "Delivery address", "note": "Gate instructions" }`. For checkout send only `{ "quote_id": "<quote UUID>", "payment_method": "card" }` and a stable `Idempotency-Key` header (8–100 letters/digits/underscores/hyphens). Other recognized methods are `wallet`, `transfer` and `ussd`; these record the selection and do not initiate payment. Retry the same key/body to retrieve the same order, including after quote expiry. A changed request under that key returns 409.

Quotes and checkout require completed name/email onboarding; email verification is separate. The API enforces vendor/item availability, required option limits, per-city minimum order value, service area and operating hours. Price/configuration changes require a new quote. Amounts are integer kobo, with delivery fees rounded upward to ₦10. Discovery proximity uses straight-line distance only for sorting; delivery fees use the road route.

Before activation, operators must configure each city's `base_fare_kobo`, `per_km_rate_kobo`, `minimum_delivery_fee_kobo`, `minimum_food_subtotal_kobo`, `opens_at`/`closes_at` (Africa/Lagos, null means unrestricted), and `service_polygon` (JSON array of `{lat,lng}` vertices). Boundaries currently support a simple polygon without holes; use local city polygons and verify them before activation. Missing rates/boundaries/token or unavailable routing block quotes. No fictitious vendors, menu items, rates or boundaries are seeded. Provision admin/vendor-staff roles through a trusted database operator; public onboarding cannot grant these roles. Admin catalog mutations and staff assignment are audited. Image URLs and scoped Supabase Storage uploads are supported; see [MEDIA.md](MEDIA.md).

Routing uses [Mapbox Directions](https://docs.mapbox.com/api/navigation/directions/) with the `driving` profile and a five-second timeout. Motorcycle suitability and launch-city route coverage require staging verification. Vendors are manually marked open/closed; city hours apply separately.

Orders start `pending_payment`/`unpaid`. The payments module verifies payment and transitions to `awaiting_vendor` before staff can accept/reject. Acceptance records `searching_rider`; the matching processor then offers the job to eligible nearby riders. Rejection records a pending refund. Wallet refunds are settled by `payments:process`; external refunds require operator submission and verified reconciliation. Notifications and client tracking screens remain pending. Cancellation, deadlines, schedules, receipts, ratings and rider status updates are documented in the Orders section below. The Food Court slice does not offer a public payment bypass. Deletion is blocked while any order is active or a refund is pending. Reorder rechecks today's menu and requires a fresh quote and checkout.

These APIs are ready for mobile integration; the existing mobile mock data/screens have not been connected in this change. Hosted migrations, real catalogs, city configuration and Mapbox staging checks remain necessary before live use.


## Dispatch

Apply `202610030004_dispatch.sql` using `npm run db:migrate`. Keep the server-only `DISPATCH_DELIVERY_CODE_SECRET` stable and set it to at least 32 random characters, for example generated with `openssl rand -hex 32`. Missing configuration blocks Dispatch checkout. Do not reuse the email secret. Mapbox and approved city pricing/hours/service boundaries are required as for Food Court.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/v1/dispatch/packages?city_id=<uuid>` | Public list of configured package sizes, fees, weight and dimension limits |
| PUT | `/v1/admin/cities/:id/dispatch-packages` | Admin-only per-city package configuration; audited |
| POST | `/v1/orders/quote` | `type: dispatch`; same-city road quote with package fee and fare breakdown |
| POST | `/v1/orders` | `type: dispatch`, owned `quote_id`, `payment_method`, and `Idempotency-Key`; creates unpaid order |
| GET | `/v1/orders` / `/v1/orders/:id` | Shared customer-owned Food Court/Dispatch history and details |
| GET | `/v1/orders/:id/delivery-code` | Customer-only four-digit handover code for a paid, unlocked Dispatch order |
| POST | `/v1/rider/orders/:id/confirm-delivery` | Assigned active rider submits `{ "code": "0123" }` while paid order is `on_the_way` |
| POST | `/v1/orders/:id/send-again` | Prefill draft from own delivered/cancelled Dispatch order; fresh confirmations and quote required |

Quote example (coordinates are illustrative, not a configured launch boundary):

```json
{
  "type": "dispatch",
  "city_id": "<city UUID>",
  "pickup": { "lat": 10.5, "lng": 7.5, "address": "Pickup address", "landmark": "Blue gate", "note": "Call on arrival" },
  "dropoff": { "lat": 10.6, "lng": 7.6, "address": "Delivery address" },
  "package": { "size": "small", "description": "Shoes", "fragile": false, "fits_size": true, "prohibited_items_acknowledged": true, "weight_g": 1000 },
  "receiver": { "name": "Amina Bello", "phone": "08140454988" }
}
```

Sizes are `document`, `small`, and `large`. Both confirmation flags must explicitly be true; clients should display the prohibited-items notice and the chosen package limits. Optional `weight_g` and `dimensions_cm: {length,width,height}` are validated against those limits when provided. Receiver phones normalize to Nigerian E.164. Pickup/drop-off accept exact map-pin coordinates, address, landmark and instructions. Both must lie in the selected city's simple service polygon and must differ; inter-city requests are rejected. Add `scheduled_at` to order creation rather than the quote body to request scheduling. Address search/reverse lookup and saved-address APIs are documented below.

Admin package configuration body contains `size`, `label`, `fee_kobo`, `max_weight_g`, `max_length_cm`, `max_width_cm`, `max_height_cm`, and `is_active`. Configure business-approved values for each city/size; no fees or physical package limits are fabricated or seeded. Inactive package sizes are hidden and invalidate outstanding quotes. City base/per-km/minimum fees are shared with the existing delivery configuration; a package surcharge is added before applying the minimum and rounding upward to ₦10.

Dispatch quotes expire after five minutes and include base fare, distance fee, package fee, minimum adjustment, rounding, final kobo total and travel ETA. ETA describes road travel and excludes rider matching/pickup wait. Checkout rechecks city hours, active status, rates, service boundaries and package configuration under locks. It snapshots receiver, package, pickup/drop-off and prices. Reusing a checkout key returns the same order even after quote expiry; changing order type/quote/payment method under the same key returns 409. Food checkout still defaults to `type: food` for existing clients.

Codes are randomly generated on successful order creation, stored only in private storage as an AES-256-GCM encrypted value and an order-bound HMAC hash. Code storage, attempts and assignment fields are excluded from order API responses. Codes are retrieved through a separate customer-only endpoint and never sent to the rider. Public/client Supabase roles cannot read code/quote storage or alter orders. There is no automatic SMS/email send or public rider assignment endpoint in this slice. Payment endpoints are documented below.

Delivery confirmation locks the order and code, checks active rider identity, trusted assignment, verified payment and `on_the_way` status, then consumes the code and records a delivered event atomically. Retries of a successful confirmation with the same code do not duplicate events. Wrong codes consume an attempt; the third locks confirmation, moves the order to `disputed` and records an event for support review. Lockout cannot be bypassed by changing riders or retrying the correct code. Support review/unlock tooling and customer notifications remain pending. Keep the encryption secret backed up; changing it makes existing codes unavailable. Versioned key rotation remains future operational work.

Dispatch orders start `pending_payment`/`unpaid`. The payments module verifies payment and moves them directly to `searching_rider`; Food Court continues through vendor confirmation first. Matching/approved-rider assignment and tracking APIs are documented below; client tracking screens and automated external refund submission remain pending. Order lifecycle APIs, cancellation, schedules, receipts and ratings are documented below. Integration tests simulate payment/assignment/state updates through trusted local SQL; the API exposes no bypass. Hosted migration, real city/package configuration and real-device integration remain necessary before launch.


## Addresses and maps

Apply `202610030005_addresses_maps.sql` with `npm run db:migrate`. Set `PHOTON_BASE_URL` to your configured Photon HTTP(S) instance; it must have no embedded credentials, query string or fragment. There is no automatic public-demo endpoint fallback. `MAPBOX_ACCESS_TOKEN_SERVER` remains required for routing. No hosted migration or live map request is made by local tests.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/v1/cities` / `/v1/cities/:id` | Public active-city IDs, hours, current open state and boundary-configuration status |
| POST | `/v1/maps/service-area` | Public `{lat,lng,city_id?}`; resolve/check a GPS or map-pin location |
| GET | `/v1/maps/search?city_id=<uuid>&q=Kawo` | Authenticated city-scoped search; optional paired `lat`/`lng` bias and `limit` (1–10) |
| GET | `/v1/maps/reverse?city_id=<uuid>&lat=10.5&lng=7.5` | Authenticated reverse lookup near a supported pin |
| POST | `/v1/maps/route` | Authenticated `{city_id,pickup:{lat,lng},dropoff:{lat,lng}}`; same-city road distance/duration and GeoJSON route shape |
| PUT | `/v1/admin/cities/:id/service-area` | Administrator-only `{polygon:[{lat,lng},...]}`; boundary mutation is audited |
| GET / POST | `/v1/me/addresses` | List/create owned saved addresses |
| GET / PATCH / DELETE | `/v1/me/addresses/:id` | Read/edit/delete an owned saved address |
| GET / PATCH | `/v1/me/city` | Read/set selected city with `{city_id: "uuid"}`; use `null` to clear |

Saved-address example:

```json
{
  "city_id": "<active city UUID>",
  "label": "Home",
  "address": "Kawo Road",
  "location": { "lat": 10.5, "lng": 7.5 },
  "landmark": "Blue gate",
  "note": "Call before arrival",
  "is_default": true
}
```

An active phone session is required for private address/maps operations; name/email onboarding can still be incomplete. Addresses are owned by the authenticated account and never accept a client-supplied owner ID. Saved-address creation/edits require a configured active city and an in-boundary pin, independently of operating hours. Partial edits preserve omitted fields, and choosing a new default clears the previous default in the same transaction. Each account can save up to 50 addresses. Deleting a default does not automatically select another. Existing addresses without a city remain readable/deletable; select a valid `city_id` when editing them. Saved-address changes do not change existing order snapshots.

Clients obtain device location using their GPS permission flow, then submit coordinates to `/maps/service-area`; the server does not detect device GPS. With `city_id`, the response distinguishes an unavailable city, unconfigured boundary, outside location and closed city. Without a selected city, it resolves against active configured boundaries; overlapping matches require explicit city selection. Hours use Africa/Lagos. Cities and saved addresses may be selected while closed, but route/checkout eligibility is checked again when booking. If coverage changes, existing saved addresses are retained and delivery quotes revalidate coordinates.

Service boundaries support one simple polygon per city, 3–500 vertices, with optional repeated closing vertex. Self-crossings, repeated interior vertices, zero-area polygons and dateline-spanning shapes are rejected. Holes/multipolygons/PostGIS geofencing remain future work. This endpoint updates the boundary only; activating cities and changing rates/hours still requires trusted operator configuration until the admin configuration module is built.

Photon search uses Nigeria country filtering, the selected city's bounding box and a supplied/default location bias. Returned search/reverse candidates are checked against the actual polygon; results outside it are removed. Reverse lookup searches within one kilometre and returns candidates rather than asserting an exact house address. Empty results are valid: clients can keep an exact map pin and enter the address/landmark manually. Responses include OpenStreetMap attribution, which clients should display with a link to the contributors' copyright page.

Lookup endpoints enforce IP and shared account rate limits, a minimum search length and five-second provider timeouts. Successful Photon results are cached for five minutes and Mapbox distance results for two minutes, with bounded process-local storage and in-flight request coalescing. Failures are not cached. Route cache keys use exact coordinate values and direction; fare/configuration revalidation still occurs independently. Clients should debounce typing (~300 ms) and cancel stale requests before displaying results; backend API limits do not implement mobile UI debounce. Route responses give `driving` distance/duration and, when supplied by the provider, simplified GeoJSON `LineString` geometry with `[longitude,latitude]` pairs, not a fare or booking; use `/orders/quote` for an authoritative price. Map rendering of the returned geometry, device permissions and mobile API wiring remain client work.

Provider references: [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md), [Photon hosting/demo policy](https://github.com/komoot/photon#demo-server), and [OpenStreetMap attribution](https://www.openstreetmap.org/copyright). Before launch, verify address coverage and road routing in Abuja, Kaduna, Kano and Lagos and provide production Photon hosting. Photon’s public demo has no availability guarantee and may throttle extensive use; this implementation requires explicit endpoint configuration.


## Orders

Apply `202610030006_orders.sql` using `npm run db:migrate`. Orders retain the existing quote/creation/list/detail APIs. This slice adds guarded lifecycle transitions, timestamps, timelines, receipts, cancellation/refund requests, schedules, disputes and ratings. Customer endpoints require an active phone session and always operate on the caller’s own order.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/v1/orders/:id/timeline?limit=50&offset=0` | Ordered status events, time and reason; no other actor’s profile details |
| GET | `/v1/orders/:id/receipt` | Paid order snapshot and pending/processed refund breakdown; unpaid orders return 409 |
| GET | `/v1/orders/:id/cancellation` | Current eligibility, fee and expected refund |
| POST | `/v1/orders/:id/cancel` | `{reason,accepted_fee_kobo}`; recheck current fee/state under lock |
| PATCH | `/v1/orders/:id/schedule` | `{scheduled_at}`; reschedule a waiting scheduled order before cutoff |
| GET / POST | `/v1/orders/:id/dispute` | Read/submit `{category,message}`; one dispute per order |
| GET / POST | `/v1/orders/:id/rating` | Read/submit `{service_rating,vendor_rating?,rider_rating?,comment?}`; one rating per delivered order |
| POST | `/v1/admin/orders/:id/dispute/resolve` | Admin-only `{resolution}`; record support resolution with audit |
| GET | `/v1/cities/:id/order-policy` | Configured approved policy, or `null` when absent |
| PUT | `/v1/admin/cities/:id/order-policy` | Admin-only full policy update; audited |
| POST | `/v1/rider/orders/:id/status` | Assigned active rider: `{action: "picked_up" | "on_the_way" | "delivered"}` |

Cancellation before pickup is available for unpaid orders, paid orders awaiting vendor confirmation, and Dispatch orders searching for a rider. Paid Food Court orders after vendor acceptance require an explicit `food_cancel_after_accept` policy. Assigned-rider cancellations require configured fees. Review `/cancellation`, then send that exact fee in `accepted_fee_kobo`; fee changes return 409 so the client can ask the customer again. After pickup, delivered/cancelled/disputed states, or the paid schedule cutoff, cancellation is refused. Repeated cancellation returns the existing cancelled order without another event or refund. Paid cancellations atomically record a pending refund for `total - fee`; unpaid cancellations record no refund. No money is moved or claimed refunded by this API. Account deletion stays blocked while a refund is pending.

Receipts are authenticated JSON order/payment summaries using the stored item/route/receiver/price snapshot, not tax invoices or PDF documents. They include cancellation fees and pending refund details without exposing delivery codes or provider secrets. Mobile can render/share them. Refund settlement and updated settlement receipts require the payments/ledger module.

For scheduling, first obtain a fresh quote, then create the order with an additional timezone-aware ISO `scheduled_at`, e.g. `"2026-10-05T12:00:00+01:00"`. Store UTC and evaluate city hours in Africa/Lagos. Scheduling is unavailable until the city policy is configured; lead time, booking horizon, activation lead and edit/cancel cutoff come from that policy. Quotes/checkout still require current vendor/city availability as well as city opening hours at the requested schedule; future vendor availability is rechecked at release. An accepted quote’s price snapshot is retained. Retrying the original creation request returns the same order even after it is rescheduled.

Scheduled orders start `pending_payment`. The future verified-payment worker must atomically mark payment and use the internal transition helper to enter `scheduled`; it cannot send them directly to fulfillment. The due processor releases paid scheduled Food Court orders to `awaiting_vendor` and paid scheduled Dispatch orders to `searching_rider`. It never releases unpaid orders or bypasses vendor confirmation. Closed/unavailable cities or vendors at release cancel the order and record a full pending refund. Waiting schedules can change time before cutoff; price, address, receiver, items and payment method cannot be edited through rescheduling. Other booking edits require cancellation and a fresh quote.

Configure approved city policy values for every field below; none are seeded:

```text
assigned_cancellation_fee_kobo
food_cancel_after_accept
schedule_min_lead_minutes
schedule_max_days
schedule_edit_cutoff_minutes
schedule_activation_lead_minutes
unpaid_timeout_minutes
vendor_timeout_minutes
dispute_window_hours
```

The minimum booking lead must be at least the activation lead, which must be at least the edit cutoff. Run `npm run orders:process` from `server/` against the intended database to process up to 100 due orders. Configure your deployment to run it repeatedly (for example, once a minute), monitor failures/backlog and provide capacity for the booking volume. This command applies mutations; it was exercised only against the embedded test database during this change, not your `.env` database. The processor uses row locks and `SKIP LOCKED`, expires configured unpaid orders, handles vendor-confirmation timeouts with full refund requests and tolerates repeated execution. Without a configured policy and deployed processor, time-based actions do not run automatically. Durable hosted cron/worker deployment and notifications remain pending.

Disputes use `delivery`, `items`, `payment` or `other`, with a 10–2000 character message. Payment complaints can be recorded for an unpaid order; other complaints require recorded payment. Completed/cancelled orders require an approved dispute window. An in-transit dispute halts normal fulfillment by moving the order to `disputed`; completed-order complaints retain their completion history. Repeating the same complaint retrieves it; a different complaint under the same order returns 409. Admin resolution records support findings, without automatically unlocking a handover code, completing delivery or paying a refund. Financial resolutions, delivery-code overrides, operational recovery of disputed orders and support UI remain pending.

Ratings require a delivered, paid order without an open dispute or pending refund. Ratings are 1–5; vendor scores apply only to Food Court and rider scores require a stored assignment. Targets are derived from the order, never client-supplied IDs. Same-body retries return the original rating; changed submissions return 409. Valid vendor scores update the vendor’s aggregate rating under a lock. Public reviews, moderation and rider aggregate reporting remain later work.

Rider status updates require active rider role, trusted assignment and verified payment. Food pickup additionally requires vendor readiness. Dispatch completion always uses `/v1/rider/orders/:id/confirm-delivery`; the generic status endpoint cannot bypass its code. The shared transition helper guards legal steps and records each state change atomically. Matching/approval/assignment APIs are documented below. Payout settlement, push/SMS/email notifications, hosted concurrency checks and mobile integration remain pending.


## Payments & wallet

Apply `202610030007_payments_wallet.sql` using `npm run db:migrate`. All amounts are integer kobo in NGN. Payment and wallet endpoints require an active phone session and completed name/email onboarding. Billing email is snapshotted from the profile; it is never used as authentication. There is no client endpoint for setting a balance or marking an order paid.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/v1/payments/orders` | `{ "order_id": "UUID" }` with `Idempotency-Key`; initialize card/transfer/USSD for an owned unpaid order |
| POST | `/v1/wallet/top-ups` | `{ "amount_kobo": 100000, "method": "card" }` with `Idempotency-Key`; initialize a wallet top-up |
| GET | `/v1/payments/:reference` | Read an owned payment without contacting Paystack |
| POST | `/v1/payments/:reference/verify` | Verify with Paystack and atomically apply a successful payment |
| GET | `/v1/wallet` | NGN balance; an unused wallet has zero balance |
| GET | `/v1/wallet/transactions` | Owner-only ledger, `limit` (1–100) and `offset` (0–10000) |
| POST | `/v1/orders/:id/pay/wallet` | Atomic wallet checkout; order ID makes retries idempotent |
| POST | `/v1/hooks/paystack` | Raw-body HMAC-SHA512 signed provider webhook; persist known `charge.success` events |
| POST | `/v1/admin/refunds/:id/reconcile` | Admin-only `{ "provider_refund_id": "12345" }`; verify an externally submitted refund against the original transaction/amount/currency |

Choose the payment method when creating an order. The payment initializer derives the amount and channel from that owned order, never from a caller-supplied total. `transfer` maps to Paystack `bank_transfer`; `card` and `ussd` retain their channel names. Top-ups accept 1–1,000,000,000 kobo; provider minimums/channel availability can further restrict checkout. Wallet balances are capped at 9,000,000,000,000 kobo and each ledger mutation is bounded by the payment/order amount limit.

Initialization returns a payment record containing a stable reference, `authorization_url` and `access_code` when available. Open Paystack's hosted checkout using that URL. Callbacks/redirects never prove payment. A verification must match reference, amount, NGN currency, saved billing email, selected channel and server-generated payment/customer/order/purpose metadata. The adapter also checks test/live mode and rejects unsafe numeric provider IDs. Inconsistent responses enter `review` without fulfilling an order or crediting money. Provider errors expose no credentials or card authorization data.

Keep the same idempotency key (8–100 letters/digits/underscores/hyphens) for top-up retries. A changed top-up under the key returns 409. An order has one external payment intent and one provider reference across all initialization retries. After an initialization timeout, the intent enters `review`; retries return that reference without sending a second initialization. Verify/reconcile it and have support investigate an uncertain or abandoned initialization before attempting replacement. There is currently no public payment-method switch, automatic replacement attempt, or automatic terminal closure of unsuccessful intents.

Verified immediate Food Court payments enter `awaiting_vendor`; Dispatch payments enter `searching_rider`. Scheduled orders enter `scheduled`. Payment confirmation rechecks order state, configured unpaid timeout, schedule activation deadline, city activity and vendor availability under locks. A successful charge arriving after cancellation/expiry or when fulfillment is unavailable records a paid, cancelled order and a pending full refund; it never restarts delivery. Wallet checkout rejects unavailable orders or insufficient balance without debiting anything.

Profile, order, intent and wallet locks serialize money mutations. A top-up credit, checkout debit and wallet cancellation refund each has a unique immutable ledger reference. The balance update, ledger entry, payment state and fulfillment transition commit together. Cancellation refunds subtract the accepted cancellation fee. Wallet refunds settle through the processor exactly once; external refunds remain pending until verified as `processed`. Account deletion is blocked by a nonzero wallet, unsettled payment intent, active order or pending refund.

### Provider setup and processing

1. Set `PAYSTACK_SECRET_KEY` to a test secret in your local environment. Keep it server-only. Optionally set an HTTPS `PAYSTACK_CALLBACK_URL` that your app can handle.
2. Configure `https://<your-api-host>/v1/hooks/paystack` in the matching Paystack dashboard environment. The exact raw request body is authenticated using `x-paystack-signature` before parsing. Known charge events are persisted/deduplicated without storing card/account details; unknown references and unrelated event types are acknowledged without applying funds.
3. Deploy a scheduled worker running `npm run payments:process` about once a minute alongside `npm run orders:process`. The payment worker polls up to 100 unsettled references per invocation, reserves polling slots before network requests, and settles up to 100 wallet refunds. Run enough batches for your traffic. Polling recovers missing/delayed webhooks and database/provider failures; all effects remain idempotent. Without Paystack configuration the command can still settle wallet refunds.
4. For an external pending order refund, an authorized operator submits the exact stored amount against the original transaction in Paystack, then calls the admin reconciliation endpoint using the internal refund UUID (available on the customer receipt) and provider refund ID. Pending/processing/failed provider responses do not mark the order refunded. Amount/currency/original transaction must match. Reconciliation is audited and repeatable. Automatic refund submission, refund-event processing, chargebacks/reversals, operational review queues, intent replacement and payouts remain follow-up work.

The processor runs from server environment settings and performs real provider/database operations: deploy it only after staging verification. Use separate staging/live databases and keys. No hosted migration, provider configuration, actual charge/refund or worker deployment was performed by this implementation. See the [Paystack transaction API](https://paystack.com/docs/api/transaction/), [webhook documentation](https://paystack.com/docs/payments/webhooks/) and [refund API](https://paystack.com/docs/api/refund/) for provider contracts.

Tests use embedded Postgres, injected provider doubles and mocked HTTP. They cover owned records, onboarding, fixed totals/channels, raw signatures, duplicate events, amount/customer/metadata mismatches, exact-once credits/debits/refunds, atomic rollback, initialization/verification failures, late success, missed-hook reconciliation, refund verification, ledger immutability and RLS. True multi-connection Postgres race tests, hosted Supabase/Paystack test-mode verification, mobile checkout wiring and production deployment remain outstanding.


## Rider matching & tracking

Apply `202610030008_matching_tracking.sql` with the existing migration runner. It adds private rider applications, latest idle GPS, city matching policies, durable searches/offers, and a participant-readable latest-trip tracking row. Before applying it to existing data, operators must resolve any duplicate active rider assignments: the new unique index rejects multiple `rider_assigned`/`picked_up`/`on_the_way`/`disputed` jobs for one rider. The migration does not silently release custody or reassign jobs.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/v1/riders/register` | Completed customer/rider account submits `city_id`, `vehicle_type` (`motorcycle`, `bicycle`, `car`) and `plate_number`; application starts pending |
| GET | `/v1/riders/me` | Own application, approval, effective presence and vehicle details |
| POST | `/v1/admin/riders/:id/review` | Audited approval/rejection/suspension using the applicant's profile UUID; `{ "approval": "approved", "note": "Verified by operations" }` |
| PUT | `/v1/admin/cities/:id/matching-policy` | Configure radii, expansion/offer/search windows and GPS quality/age limits |
| POST | `/v1/riders/me/location` | `{ "lat": 10.5, "lng": 7.5, "accuracy_m": 10, "heading": 90, "speed_mps": 2, "captured_at": "2026-10-03T12:00:00Z" }` |
| POST | `/v1/riders/me/presence` | `{ "online": true }` or false; going online requires approved status and fresh GPS inside the active service city |
| GET | `/v1/riders/me/offers/current` | Own unexpired eligible offer or null; limited pickup/drop-off/package preview |
| POST | `/v1/riders/offers/:id/respond` | `{ "action": "accept" }` or `reject`; own offer only, idempotent same-action response |
| GET | `/v1/riders/me/job` | Assigned active/disputed job or null; includes directions/receiver details but never the delivery code |
| GET | `/v1/orders/:id/tracking` | Owner/assigned rider/admin snapshot: search state, rider/contact, latest GPS, staleness and optional road ETA; `include_route=false` skips routing |
| GET | `/v1/orders/:id/tracking/stream` | Authenticated SSE snapshots every five seconds; bearer header required; reconnect starts with a full snapshot |
| POST | `/v1/orders/:id/matching/retry` | Owner/admin restarts a no-rider search with a new offer generation |
| POST | `/v1/orders/:id/matching/cancel` | Owner cancels a no-rider search for a full pending refund, including already-accepted Food Court orders |
| GET | `/v1/admin/matching/queue` | Admin no-rider queue; required `city_id`, optional `limit` and `offset` |

Operations can use the private document upload/review backend before approving a rider; the review UI remains pending. Public registration cannot assign a role or approve itself. Approval grants the trusted rider role. Approved vehicle/city changes require support; suspended riders cannot resubmit themselves to reset approval. Review refuses active/disputed jobs, so custody must be resolved before approval changes. Existing trusted rider-role lifecycle endpoints continue to handle pickup, on-the-way and delivery; Dispatch completion still requires the customer's separate four-digit code.

No business matching policy is seeded. Configure each city with:

```json
{
  "initial_radius_m": 5000,
  "max_radius_m": 10000,
  "radius_step_m": 5000,
  "expansion_seconds": 30,
  "offer_seconds": 30,
  "search_seconds": 180,
  "location_max_age_seconds": 60,
  "max_accuracy_m": 100
}
```

These values are an example for review, not automatically applied launch rules. Eligibility includes active completed profile, approved rider, online flag, same city, fresh accurate GPS, service boundary, no active/disputed job and no other pending offer. Own-customer orders are excluded. Candidate distance is great-circle distance to pickup; ETA uses the road-routing provider. Offers are sequential and nearest-first within the current radius. Rejected/expired riders are skipped for that search generation. Radius expands with elapsed search time up to the configured maximum. Missing configuration, exhausted searches and unavailable cities enter the admin no-rider queue instead of silently assigning or cancelling; customers can retry after configuration/recovery or request a full refund cancellation.

Offers persist across worker restarts. Order and rider row locks plus unique pending-offer and active-assignment indexes prevent duplicate reservations. Acceptance rechecks expiry, paid/searching order state, trusted profile, rider approval, availability, GPS and maximum radius before assigning and recording a guarded order event in one transaction. Same-offer retries return the accepted result. Cancellation/state changes invalidate pending offers. Delivered/cancelled jobs release availability through their order state; disputed custody remains reserved for operations. No-rider cancellation records a full refund that the payment processor settles according to the payment method.

Run `npm run matching:process` for one batch of up to 100 searches, or deploy `npm run matching:work` for a continuous worker with a five-second polling interval, restart recovery and graceful SIGINT/SIGTERM shutdown. Older polls rotate behind untouched searches so active offers cannot starve the backlog. Offer deadlines are checked at acceptance even if a worker is delayed. Worker cleanup makes stale riders offline; a fresh sample does not automatically opt them back online. Existing order/payment processors remain required.

Location ingestion rejects invalid coordinates, poor accuracy, samples older than the city TTL, samples more than 15 seconds in the future and out-of-order timestamps. An identical replay does not refresh server receipt time. Idle samples must be inside the active city; assigned trips can follow roads outside the polygon. Idle coordinates stay private. Only the assigned rider can update their current trip, and trip location is removed at delivery, cancellation or dispute. Retained idle coordinates are latest-only and remain private; matching and tracking exclude stale records.

Tracking exposes rider name/vehicle and call/WhatsApp links only to authorized participants; phone links and GPS are removed after the trip ends. A stale snapshot is labelled and has no ETA. ETA describes road travel to pickup before collection, and to drop-off after collection; it excludes vendor wait, handover and traffic assumptions. Routing failure preserves GPS with a null ETA. Ownership, assignment, GPS freshness and stage are rechecked after provider calls. Streams revalidate the token/account/authorization per snapshot and close on revocation, terminal state, database failure or shutdown. Streams are capped at two per account and 200 per API instance. Browser/mobile clients need a streaming HTTP client supporting authorization headers; tokens must not be placed in URLs.

The first matching implementation deliberately uses authoritative Postgres GPS and durable polling rather than an additional Redis geo cache/queue. Live updates use private API SSE; a read-only `public.order_tracking` RLS policy also supports participant snapshots. Supabase publication/channels were not configured, and Supabase private Broadcast, Redis geo acceleration/BullMQ, push offer notifications, admin live-map/reassignment tools, unreachable-receiver support flows, complete route history, device background GPS and production load/race verification remain future work. No hosted migration, rider approval, provider call or worker deployment was performed during implementation.

Local tests cover unpaid/vendor gating, role/approval/city eligibility, timestamp/accuracy validation, nearest and expanded offers, rejection/expiry/restart retries, stale cleanup, unique offer/job reservations, no-rider retry/cancel/refund, owner/rider/admin tracking boundaries, direct RLS, live position snapshots, routing outage, stale ETA suppression, terminal SSE reconnect and matched Food Court/Dispatch delivery. Multi-connection Postgres contention, active-stream interruption, real GPS/Mapbox, notifications and client wiring still require staging/device checks.

## Notifications, promo codes and customer extras

Migration `202610030009_notifications_extras.sql` adds the inbox, private FCM devices/outbox,
private promotion/referral campaigns, support conversations and versioned legal pages. Apply
all migrations using `npm run db:migrate` on the intended database. These changes have only
been verified locally; this task does not run hosted migrations or send real messages.

Authenticated customer endpoints:

- `GET /v1/me/notifications?limit=20&offset=0`, `POST /v1/me/notifications/:id/read`,
  `POST /v1/me/notifications/read-all`.
- `GET/POST /v1/me/devices`, `DELETE /v1/me/devices/:id`. Register a **native FCM token**
  with `platform: android|ios|web`; an Expo push token is not interchangeable. Responses never
  expose tokens. At most ten devices per account; tokens cannot silently move between users.
  Remove the device while authenticated before logout/account switching, then register the
  new account token. Tokens remain private; invalid-token cleanup removes only FCM `UNREGISTERED`.
- `GET /v1/me/referrals`, `POST /v1/me/referrals/apply` with `{ "code": "..." }`.
- `POST /v1/me/support/tickets` with `subject`, `message`, `category: order|payment|account|other`
  and optional `order_id`, plus an `idempotency-key` header. `GET /v1/me/support/tickets`,
  `GET /v1/me/support/tickets/:id`, `POST /v1/me/support/tickets/:id/messages` with `message`.
- Existing `GET/PATCH /v1/me/preferences` includes `theme: system|light|dark`, `push_enabled`,
  `email_enabled`, `sms_enabled`, `whatsapp_opt_in`, `reminders_enabled`. SMS and WhatsApp
  default off; inbox records remain available independently of external-delivery preferences.
- Public `GET /v1/customer/config` exposes configured support contacts and themes.
  Public `GET /v1/legal` and `GET /v1/legal/:slug` (`terms|privacy|refund`) return the latest
  published versions. `POST /v1/me/legal/:id/accept` records exact-version acceptance once.
  No legal wording or support phone/email is invented; empty setup yields no published pages
  and null contacts. Render legal Markdown safely in clients; it is text, not trusted HTML.

Trusted active administrators can `GET/POST /v1/admin/promos`, `PUT /v1/admin/promos/:id`,
`PUT /v1/admin/referrals/policy`, `POST /v1/admin/legal`, and use `/v1/admin/support/tickets`
(list/detail/messages) plus `POST /v1/admin/support/tickets/:id/resolve`. Writes are audited.
Roles are checked again inside database transactions; clients cannot grant themselves access.
Legal versions are published as new records; existing accepted versions are not edited by APIs.

### Promo pricing

Add optional `promo_code` to Food Court or Dispatch `POST /v1/orders/quote`.
The response includes server-calculated `discount_kobo`, net `total_kobo` and applied promo ID/code.
Food subtotals remain intact for vendor accounting; promotions are funded by the platform.
Clients cannot submit arbitrary discounts. Payment, wallet checkout and refunds use the net
order total. Reordering/send-again does not carry an old discount into a new checkout.

Campaigns require a unique uppercase code (3–32 letters/digits/underscore/hyphen), active flag,
`starts_at`/`ends_at` ISO timestamps, `scope: all|food|dispatch`, nullable `city_id`/`vendor_id`,
`basis: delivery|food_subtotal`, `kind: fixed|percent`, `value`, `max_discount_kobo`,
`minimum_total_kobo`, `max_uses` and `per_customer_limit`. Percent `value` is basis points:
`2500` means 25%. Vendor/food-subtotal restrictions require food scope. Discounts cannot exceed
their eligible component or leave a zero payable amount. All other money fields are NGN kobo.
No campaign is seeded or automatically enabled.

Quotes do not reserve a campaign use. Checkout locks/revalidates the campaign, limits and
quoted discount, records one redemption in the order transaction and rejects expired/changed
or exhausted codes. An idempotent checkout retry consumes no extra use. A use is consumed when
an **unpaid order is created**, and stays consumed after cancellation/expiry; this prevents
repeated abandoned orders recycling limited campaigns. Enable campaigns only with agreed rules
and monitor their funding budget. A discounted quote can become unavailable before checkout.

### Delivery worker and providers

Run `npm run notifications:process` for one batch, or supervise `npm run notifications:work`
for continuous processing. The worker also settles referral rewards; a settlement failure does not stop notification delivery. Database rows persist
across restarts; multiple processes claim outbox jobs with `SKIP LOCKED`, UUID leases/fencing,
five attempts and bounded exponential backoff. Timed rider-offer push jobs are prioritized
ahead of other messages. Provider calls occur after commit. Retried
external delivery is **at least once**, so the app must deduplicate by `notification_id` and
fetch authoritative order/offer state on tap. Provider acceptance (`sent`) is not proof of
handset receipt. Failed/skipped rows remain available for operator inspection; there is no
provider delivery-receipt webhook or admin replay UI yet. Unconfigured channels are skipped;
configure providers before issuing events you expect to deliver externally.

Notifications are generated atomically for onboarding completion, order timeline changes,
wallet/Paystack payments, processed refunds, vendor-ready updates, timed rider offers,
no-rider outcomes, support replies and referral rewards. Payout events remain pending until
payouts exist. Messages contain generic text and links through app IDs, without handover codes,
addresses, receiver details or payment credentials. Read state and preferences do not affect
OTP/email-verification security messages. Outbox delivery rechecks account status, current
preferences and verified email ownership. Expired/responded rider offers and canceled or
rescheduled reminders are skipped; push offer TTL is bounded by its expiry. A successful
inbox event cannot guarantee background push delivery on a specific device.

- SMS/email use the existing `BREVO_API_KEY`, `BREVO_SMS_SENDER`, `BREVO_EMAIL_SENDER` settings.
- FCM HTTP v1 needs `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` together. Supply a
  Firebase service-account RSA key only on the server, enable the messaging API and grant the
  account messaging permission. PEM values support literal `\n`. The adapter exchanges a
  signed JWT for a cached short-lived access token. Native Android must create the
  `rider-offers` notification channel; native iOS needs APNs configured in Firebase. See
  [Firebase HTTP v1 setup](https://firebase.google.com/docs/cloud-messaging/send/v1-api).
- Optional WhatsApp uses `BREVO_WHATSAPP_SENDER` and `BREVO_WHATSAPP_TEMPLATE_ID` together with
  the Brevo API key. Activate WhatsApp in Brevo and use an approved utility template with a
  `MESSAGE` attribute matching this adapter. Alerts require `whatsapp_opt_in`; there is no
  unrestricted first-contact plain-text send. See
  [Brevo transactional WhatsApp](https://developers.brevo.com/docs/whatsapp-messages).
- `NOTIFICATION_REMINDER_MINUTES` defaults to 30, accepts 1–1440. Paid scheduled orders inside
  the upcoming window get one reminder per schedule; late-running workers do not send past-due
  reminders. `SUPPORT_PHONE` and `SUPPORT_EMAIL` are optional public business contacts.

For operations, inspect private outbox aggregate counts and generic error codes through the
server database (never expose raw device tokens or destinations to analytics/logs):

```sql
SELECT channel,status,count(*) FROM vendo_internal.notification_outbox GROUP BY channel,status;
```

### Referral rules

Referrals stay disabled until an administrator publishes a policy. Required fields are
`enabled`, `referrer_reward_kobo`, `referee_reward_kobo`, `minimum_order_kobo`, `hold_days`,
`expiry_days` (greater than hold days) and `referrer_cap`. Policy versions are immutable records;
attachments snapshot amounts and eligibility rules. The latest policy's enabled flag is a
kill switch. There are no default reward values or production reward seeds.

An active complete customer with a verified email can apply one other customer's code before
**any** order exists. Self referrals, the same verified email, circular referral chains,
repeat attachments and referrer lifetime pending/rewarded caps are rejected. Random codes
expose counts and the owner's aggregate earned balance, without referred customers' identities.
The referee's first order after attachment must be paid, delivered, large enough, free of
refunds/open disputes and beyond its holding period. Later orders do not replace a failed first
order. Both accounts must remain active verified customers at settlement. Pending records
expire after the configured eligibility window; scan timestamps prevent ineligible early
records starving newer referrals.

Both rewards and immutable wallet ledger entries commit together with unique per-recipient
references. Retrying a worker cannot credit twice; ledger history reports `kind: referral`.
Pending rewards and nonzero wallets block account deletion until resolved with support.
These rules are basic abuse controls, not a full fraud system: payment/device fingerprinting,
manual campaign review, chargeback monitoring and post-reward clawbacks remain follow-ups.
Do not launch a funded campaign without business approval of these limits and operations.

Local tests cover promotion repricing/caps/net checkout, support ownership, legal acceptance,
notification privacy/consent/retries/leases, referral waiting/kill-switch/atomic wallet credits,
and mocked OAuth/FCM/Brevo transports. Hosted multi-connection races, real delivery receipts,
low-end Android/iOS/background permissions and worker deployment need staging verification.

## Rider, vendor, operations, growth and infrastructure

Migration 010 adds private rider documents, customer/rider delivery chat, scoped vendor management, admin operations, policy-snapshotted settlement and earnings/withdrawals, membership placements, banners, surge fares and reporting. See [OPERATIONS.md](OPERATIONS.md) for endpoint behavior, configuration, worker/deployment setup, payout incident handling and encrypted backup/restore instructions. Finance policies are unseeded and transfers default to disabled. Client screens and hosted acceptance remain pending.

## Supabase Storage

Logos/images and private documents now support server-mediated Supabase Storage uploads, including structurally validated DOCX. New rider documents use the private bucket; legacy encrypted database documents remain readable. See [MEDIA.md](MEDIA.md) for the API, credentials, bucket setup, access rules and retention/backup considerations.

## Vendor registration and dedicated portal

Vendor self-service applications, reviewed account/store linking and dedicated `/v1/vendor/stores/...` management APIs are implemented. See [VENDORS.md](VENDORS.md) for registration, approval, store/menu/order/media contracts, finance links and the future webapp authentication/CORS setup. Migration 012 and hosted acceptance are required before deployment.
