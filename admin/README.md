# Vendo Admin

The admin dashboard uses the live backend at `https://api.vendoltd.com`. No demo accounts, fabricated statistics or mock API remain. Next.js exports the client app into `out/` for the existing Railway/Caddy service.

```bash
npm ci
npm run dev         # localhost:3003
npm run typecheck
npm test
npm run build
```

Set `NEXT_PUBLIC_API_URL` at build time to override the API origin. It is public configuration; never put provider or database credentials in the frontend.

## Authentication and authorization

Email code login uses `/v1/auth/email/otp/request` and `/verify`. Supabase Email Auth needs Brevo custom SMTP and an OTP email template. After verifying, `/v1/admin/me` must confirm an active administrator profile. An email domain alone never grants access. The shell rechecks access every 30 seconds; every backend action also checks authorization.

The deployed backend has one trusted `admin` role. Earlier demo-only Operations/Finance/Support roles have been removed; separate staff permissions and staff administration are not implemented. Tokens use per-tab sessionStorage, with automatic refresh, logout revocation and account-separated query caches. This static deployment does not use httpOnly cookies; a server-rendered session proxy is needed if that becomes a requirement.

To provision the first administrator, a trusted database operator must assign `public.profiles.role='admin'` to the correct verified Supabase user ID. The dashboard never creates admin privileges. Complete the account name/contact information through the existing profile APIs. Existing phone-only identities need verified email linking to the same Supabase account before email login; profile email matching does not merge identities.

## Live workflows

- Overview: Lagos-day order counts, paid order totals and operational queues/worker health. Paid totals are not commission revenue.
- Orders: paginated feed, actual quote details and timeline, eligible rider reassignment, pre-custody cancellation, dispute and custody resolution.
- Riders: real GPS/staleness and earnings, application/document review, audited document download, suspension/reinstatement via review, immutable balance adjustments.
- Vendors: application review, store creation/editing/suspension, staff assignment, menu editing, membership tiers and memberships.
- Customers: actual order/payment totals and wallets; audited signed balance adjustments.
- Payments: payment intents, wallet ledger, withdrawal review, refund requests and provider refund reconciliation. External refunds must be processed in Paystack first; the dashboard never pretends to issue an arbitrary refund. Withdrawal approval queues provider processing; bank success comes from verification.
- Cities: service activation, full delivery pricing/hours, boundaries, matching and finance policies. Monetary policy fields require the operator's agreed values.
- Promotions: dated banners, capped/scoped promo codes and complete referral policy. Referral rewards are wallet credits, not an invented checkout discount.
- Notifications: customer/rider/vendor audiences by city, immediate/scheduled campaigns and cancellation before queueing. Recipients are reevaluated at send time. Device sends count provider acknowledgements; inbox reads are not push-open analytics.
- Analytics: selectable order-report windows up to 90 days and city filter; exports contain the visible page.
- Support: ticket messages, replies and resolution.
- Audit: persisted actor/action/target, with reasons for balance and store status changes.

List screens have pagination, page search, CSV export, live polling, loading/error states and mutation errors. Money is displayed in integer kobo. Blank data is never replaced with sample values. Backend business rules remain authoritative.

## Deploy

Apply migrations through `202610060015_admin_portal.sql`; deploy the server, notification/finance workers and admin service. Add the exact admin HTTPS origin to server `CORS_ORIGINS`. Keep FCM/device registration and Paystack transfer settings configured on the backend. Scheduled campaigns require the notification worker; bank transfers require enabled transfer processing and configured policies. Storage buckets must be provisioned for document/media workflows.

No live OTP, bank payout, customer balance adjustment or push campaign was sent during local tests. Validate the complete deployed journey with intended test accounts before release. Staff permission splits, retention cohorts and push tap analytics are not part of the current backend.

Provision an administrator with the dedicated script (never the demo catalog seed):

```bash
cd server
npm run db:seed-admin -- owner@vendoltd.com "Owner Name"
```

This creates or promotes the exact active customer identity to `admin`, preserves existing contact information and records provisioning. Rider/vendor and inactive identities require separate review. No fixed login code or password is seeded; login sends a fresh OTP through Supabase/Brevo SMTP.
