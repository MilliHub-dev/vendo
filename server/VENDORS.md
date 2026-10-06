# Vendor registration and webapp API

Migration `202610030012_vendor_registration.sql` introduces private applications, store descriptions/logos and vendor order notifications. Apply it through the normal migration workflow before deploying this API. No hosted migration or webapp deployment was performed during implementation.

## Authentication and registration

The vendor webapp uses existing `/v1/auth/otp/request`, `/v1/auth/otp/verify`, refresh/logout and `/v1/me` onboarding APIs. Phone verification, name and email are required before registration. Email verification follows the existing account policy and is not an additional registration gate. Use bearer access tokens for all portal calls; store management has its own `/v1/vendor/stores` namespace.

An active customer or existing vendor account can submit an application. Rider/admin accounts cannot grant themselves a vendor role through registration. Existing vendors may apply for additional stores; only one pending application per account is allowed. Registration does not create a publicly listed store or grant management access.

`POST /v1/vendor/registration`, with an `Idempotency-Key` header of 8–100 letters/digits/underscores/hyphens:

```json
{
  "name": "Example Kitchen",
  "category": "restaurant",
  "cuisine": "Local meals",
  "city_id": "service-city-uuid",
  "address": "Shop 12, Market Road",
  "location": { "lat": 10.5, "lng": 7.5 },
  "description": "Fresh meals prepared daily",
  "prep_minutes": 20,
  "image_url": null,
  "logo_url": null,
  "document_ids": []
}
```

Use actual configured city IDs/coordinates. Categories are restaurant, fast_food, drinks, groceries and pharmacy. The city must be active with a configured service polygon; location is checked at submission and approval. Registration accepts up to five owner-uploaded private document IDs from `/v1/media`; another account's documents cannot be attached. Required business documents and licensing checks remain an operator/business policy decision. HTTPS image/logo URLs are optional; approved vendors can upload their own assets later.

The response contains the application ID, status, submitted fields and review note. Repeating the same key/body returns the same application, even after review. Changing the body with that key fails with 409. Applications are immutable; withdraw a pending application before correcting and submitting a new request/key.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/v1/vendor/registration` | Latest own application, or null |
| GET | `/v1/vendor/registrations?limit=50&offset=0` | Own application history |
| POST | `/v1/vendor/registrations/:id/withdraw` | Withdraw an own pending application |
| GET | `/v1/admin/vendor-applications?status=pending` | Admin review queue with limit/offset |
| POST | `/v1/admin/vendor-applications/:id/review` | `{ "decision": "approve", "note": "Business and location verified." }` or reject |

Admin approval atomically creates one active but closed store, associates the applicant, grants the trusted `vendor_staff` role and records the decision/audit. Exact review retries return the existing result; changing a terminal decision is rejected. Rejection creates no store and grants no role. Application notifications use the existing durable inbox/outbox. Applicant document downloads use existing owner/admin media access. No publicly readable application data or self-assigned roles are introduced.

## Dedicated store management

`GET /v1/vendor/stores` lists only stores linked to the current vendor account. It supports limit/offset and gives the webapp a store selector. An account may manage multiple associated stores. Every store operation rechecks the trusted role, account status and association; knowing another store's ID is insufficient.

For the table below, prefix every endpoint with `/v1/vendor/stores/:id`:

| Method | Suffix | Purpose |
|---|---|---|
| GET | none | Store details, city, approved/active state, logo/image, preparation time |
| PATCH | none | Update permitted store fields |
| GET | `/summary` | Awaiting confirmation, active, ready, delivered and menu counts |
| PUT | `/availability` | `{ "is_open": true }` or false |
| GET | `/menu` | Menu and option groups |
| POST | `/menu` | Create a menu item using the existing menu contract |
| PUT | `/menu/:itemId` | Replace item details, price/options and availability |
| GET | `/orders?status=awaiting_vendor` | Store-only orders, status filter, limit/offset |
| GET | `/orders/:orderId` | Scoped order detail |
| POST | `/orders/:orderId/action` | `{ "action": "accept" }`, reject or ready |
| POST | `/media` | Upload a logo/image to the public Storage bucket |

Store PATCH accepts name, cuisine, description, HTTPS image/logo URLs, preparation minutes and address/location. It rejects empty updates, privileged fields, city/category/activation/commission changes and changes to someone else's store. Address and coordinates must change together, stay in the approved city and wait until all active/scheduled/unpaid/disputed orders are finished. Existing quote/checkout validation detects pickup changes. Administrative city/category/activation and staff assignment remain in the trusted admin APIs.

Menu items can be removed from sale by setting `is_available: false` through PUT; orders retain their immutable historical item snapshots. This API does not permanently delete items or include a self-service staff invitation system. Order acceptance/rejection/ready actions reuse the existing paid-order transition and refund guards. Store summary counts are lifetime/current counts, not a monetary accounting report.

Upload payload for `/media` is `{ "purpose": "logo", "mime": "image/png", "data_base64": "..." }`; purpose may be logo or image. Save its returned `public_url` through store PATCH or a menu update. Uploading does not automatically overwrite a store image. Supabase credentials and bucket provisioning follow [MEDIA.md](MEDIA.md).

Store branding and menu photos use this two-step flow, with the vendor's bearer token on every request:

1. Upload to `POST /v1/vendor/stores/:id/media`. Use `purpose: "logo"` for a logo and `purpose: "image"` for a store banner or menu photo. Supply JPEG, PNG or WebP bytes as `data_base64` with the matching MIME type (maximum decoded size 2 MiB).
2. Save the returned `public_url` to the appropriate field:

| Image | Save endpoint | Field |
|---|---|---|
| Store logo | `PATCH /v1/vendor/stores/:id` | `logo_url` |
| Store banner/cover | `PATCH /v1/vendor/stores/:id` | `image_url` |
| New menu item photo | `POST /v1/vendor/stores/:id/menu` | `image_url` in the item payload |
| Existing menu item photo | `PUT /v1/vendor/stores/:id/menu/:itemId` | `image_url` with the complete item payload |

For example, store PATCH accepts `{ "logo_url": "https://.../logo.png", "image_url": "https://.../banner.jpg" }`. The store `image_url` is its banner/cover; each menu item's `image_url` is independent. Use `null` to clear an image. Only associated vendor staff or authorized admins can upload store assets; unrelated accounts are denied. Upload first, then create or update the menu item, so the item immediately includes its photo.

Vendor finance remains available through `/v1/earnings/vendor/:storeId`, transactions/export, bank and withdrawal endpoints. Finance policies remain unseeded and Paystack transfer submission disabled by default. Registration never sets commissions or credits earnings.

## Notifications and webapp integration

Register the browser's FCM device token with `platform: "web"` using `/v1/me/devices` after login and remove it before logout/account switching. Paid orders entering vendor confirmation notify associated active vendor staff through the existing inbox/push outbox. Queued alerts recheck order status/staff eligibility and skip orders already accepted or cancelled. Configured confirmation timeouts bound their expiry; FCM includes web TTL/urgency headers. Configure Firebase credentials and deploy notification workers for delivery. See the [FCM cross-platform API](https://firebase.google.com/docs/cloud-messaging/customize-messages/cross-platform). Browser permission/service-worker/token handling belongs to the future webapp; no browser notification code is included here. Poll store orders/inbox for authoritative state after reconnect or a notification.

Add the exact vendor webapp HTTPS origin to `CORS_ORIGINS`; never enable wildcard origins. Reuse existing phone OTP/session recovery and refresh handling. The frontend should display application status until approved, then load stores and choose a store ID for all management calls. Do not trust a cached client role as authorization; `/me` and portal endpoints reflect current permissions without requiring role-bearing custom JWT claims.

Before account deletion, pending applications must be withdrawn/resolved. The last active vendor account must arrange store handover/closure with operations, including unsettled earnings. Account deactivation requests are serialized to avoid simultaneous last-staff departures. Production tests with real database connections, provider/device acceptance, licensing/legal checks and full webapp journeys remain pending.


## Live vendor portal

The `vendors/` webapp now uses `https://api.vendoltd.com` (override `NEXT_PUBLIC_API_URL` at build time). Apply `202610060013_vendor_portal.sql` and deploy the updated API before the portal. Add the vendor web origin to `CORS_ORIGINS`.

The migration adds weekly `opening_hours` to stores and optional per-order preparation minutes/rejection reasons. Registration accepts `opening_hours`; store PATCH can edit them. Seven unique weekdays (0 Sunday through 6 Saturday), boolean `open`, and 24-hour `from`/`to` values are required. Overnight schedules are supported, using Africa/Lagos time; existing empty schedules preserve previous behavior. Checkout rechecks store hours, so a quote made before closing cannot bypass the schedule.

`GET /v1/vendor/stores/:id/portal` returns scoped reviews (latest 100), total rating count, current configured commission/tier and reporting totals. Seven-day sales count delivered orders by Nigerian delivery date. Today's payout total reflects posted earnings ledger entries, not a promise that all sales have settled. Missing finance policies return an unknown commission rather than inventing a rate.

Order list/detail include the configured response deadline and the order's snapshotted commission when available. Vendor action accepts `prep_minutes` (1–180) for acceptance and a `reason` (up to 500 characters) for rejection. Preparation is an estimate; rider assignment does not wait until that estimate expires. The portal preserves existing menu option groups when editing items; removing an item makes it unavailable. Actual bank verification, withdrawal approval, settlement configuration, SMS credentials and worker delivery remain required for their respective live actions.


## Email sign-in

Vendor portal uses POST /v1/auth/email/otp/request {email} and POST /v1/auth/email/otp/verify {email,token}. PATCH /v1/me/name then PATCH /v1/me/phone {phone} completes onboarding. Contact phone is not proof of phone ownership. Existing phone authentication endpoints remain available for other apps; matching contact information never automatically merges accounts.

Apply migration 014 and redeploy server and vendors. In Supabase Auth, enable Email, configure custom SMTP with Brevo SMTP credentials (SMTP key, not HTTP API key), and change the Magic Link email template to display {{ .Token }} with six-digit OTP length. Configure sender/domain in Brevo. BREVO_API_KEY alone does not configure authentication email delivery. Existing phone-only accounts require verified email linking to the same Supabase identity before email login; a matching profile email alone does not link accounts.
