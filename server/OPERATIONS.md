# Operations backend and release runbook

This extends existing matching, fulfillment, payments, notifications and support APIs. Migration `202610030010_operations_finance_chat.sql` is required. The customer, rider, vendor and administrator screens still need client integration.

## Rider documents and delivery chat

Set `RIDER_DOCUMENT_SECRET` to a separate random secret of at least 32 characters. Keep a secure backup of this key; replacing it makes existing documents unreadable. Riders register through the existing application API, then upload bounded JPEG, PNG, PDF or DOCX documents with `POST /v1/riders/me/documents` (`kind`, `mime`, `data_base64`). Maximum decoded size is 2 MiB. New documents use private Supabase Storage; legacy documents remain encrypted in PostgreSQL. Responses contain metadata only. See [MEDIA.md](MEDIA.md) for setup and DOCX support. Admin content access is audited. Admins review uploaded documents before approving the rider. Replacing a document returns the application to pending/offline and is blocked during an active job. Required document types, malware scanning and retention/deletion policy still require production decisions.

Customer-to-rider chat now exists independently of support tickets:

- `GET /v1/orders/:id/chat`: paginated messages, read cursor, unread count and `can_send`.
- `POST /v1/orders/:id/chat/messages`: `{ "text": "Use the front gate." }`, with an `Idempotency-Key` header.
- `POST /v1/orders/:id/chat/read`: `{ "seq": "123" }` advances a visible message cursor.
- `GET /v1/orders/:id/chat/stream?after_seq=123`: bearer-authenticated SSE, reconnectable by cursor; access is checked every two seconds.

Sending requires a paid, assigned, active delivery and an approved rider. Delivered/cancelled chats become read-only. A replacement rider cannot see messages exchanged with the former rider; customers retain their complete conversation. Former riders can read their own segment. Other users and admins cannot read delivery chat through these APIs. Notifications carry generic text, never message content. Native clients must support bearer headers on SSE. Streams poll PostgreSQL and have per-process limits; load testing and cross-instance limits remain required.

## Vendor, administrator and growth APIs

Vendor staff must have a trusted role and a matching vendor association. `/v1/vendor/vendors/:id/orders`, `/menu` and `/availability` provide scoped management alongside existing accept/reject/ready actions. Staff cannot manage another vendor.

Admins can list/filter orders, inspect detail, view rider locations and stale flags, reassign before pickup, cancel before custody and resolve disputed custody explicitly. Reassignment validates city, GPS freshness, service radius, approval, online status and job availability. It closes previous offers and records an audit reason. Custody resolution requires verified handover evidence, `custody_confirmed: true` and a reason; it is not a routine cancellation endpoint. External refunds still use the existing verified refund workflow.

`/v1/admin/cities/:id/pricing` configures fares, paired operating hours and `surge_bps` (10000 means normal fare). Existing service-area endpoints configure boundaries. Fare changes invalidate existing quotes at checkout. Membership tiers and dated vendor memberships can affect sponsored placements and future order commission terms. Public placements are explicitly marked sponsored. Dated city-filtered banners use HTTPS images and validated actions.

`GET /v1/admin/reports/orders?from=...&to=...` supports windows up to 90 days and optional city filtering. It reports order counts, paid totals, refunds and delivery duration by Lagos calendar day, city and order type. Totals are attributed to orders created in the chosen window, not a cash-flow accounting period. Advanced retention/cohort, matching latency and provider settlement reports remain pending. Audits and `/v1/admin/operations/health` expose operational history, queues and worker heartbeats.

## Settlement and withdrawals

No finance policy is seeded. Agree commission, rider share/fixed earnings, holding period, withdrawal minimum and vendor payout schedule before enabling a city policy through `POST /v1/admin/cities/:id/finance-policies`.

A policy is snapshotted when an order is created, including any applicable membership commission. Later changes affect future orders. Historical orders without terms require an explicit audited policy attachment; existing agreed terms cannot be overwritten. Delivered, paid orders settle after the agreed holding period only when the current city policy is enabled, with no refund or open dispute. Immutable rider/vendor ledger credits and platform accounting conserve the paid total. Promotions can produce a negative platform share; the business funds that expense. Post-settlement chargeback/clawback handling requires an operator workflow before production rollout.

Riders own their earnings accounts. Associated vendor staff share vendor account permissions. `/v1/earnings/:kind/:entityId` supplies balance, transactions, masked bank information and withdrawal history. `export.csv` exports the latest 1000 entries; it is not a complete archival export. Bank resolution and recipient creation use Paystack; only a hash, last four digits and recipient metadata are stored locally. Requests require idempotency keys and atomically move available funds into held funds. Admin review approves or rejects; rejection releases held funds exactly once.

`PAYSTACK_TRANSFERS_ENABLED=false` is the default. Do not enable transfers until Paystack transfer access and production business rules are confirmed. Settlement may run with configured policies while transfer submission is disabled. Provider verification checks reference, NGN amount, recipient, environment and transfer code. Verified success consumes held funds; failure releases them; reversal returns funds once. Signed transfer webhooks are durable reconciliation hints, not sufficient proof to alter balances.

An approved withdrawal is marked submitting before the HTTP request. A timeout/crash produces a review state; the worker verifies the same reference and never automatically resubmits an uncertain transfer. Operators must compare Paystack records against the ledger before any manual action. Never create a second payout to resolve uncertainty. Disabling transfers stops submission and reconciliation; resume reconciliation promptly after resolving an incident. Vendor payout scheduling, bulk bank reconciliation, dual approval and true multi-connection concurrency tests remain production work.

## Workers, deployment and monitoring

Build with `npm run build`. Run the API with `npm start` and compiled workers with `npm run worker`. `WORKER_KIND` selects `all`, `matching`, `orders`, `payments`, `notifications` or `finance`. Finance workers also process referrals independently so a referral failure does not block settlement. Jobs persist their state in PostgreSQL; Redis is used by existing rate limits/caches. Graceful shutdown stops taking new work and closes dependencies. Heartbeats record last success/failure and duration without storing provider secrets or request bodies.

`Dockerfile` supplies a non-root Node 24 image. `compose.yaml` runs separate API and worker services, supplies environment at runtime and binds the API to localhost. Configure externally reachable Supabase/PostgreSQL and Redis URLs for containers. An HTTPS reverse proxy, production secrets manager, backups, alerts and resource sizing must be supplied by deployment. Docker/Compose deployment has not been executed locally. Migrations are an explicit release step, not container startup behavior.

Before release: provision staging providers, apply migrations once, configure cities/policies, deploy workers, check readiness and heartbeats, run test-mode food/dispatch/payment/withdrawal journeys, test retry/outage/restart behavior and load-test GPS/SSE/matching. Alert on stale heartbeats, failed notifications, unsettled deliveries, pending refunds, payout review and reconciliation mismatches. Error tracking and alert delivery still need hosting configuration.

## Encrypted logical backup and isolated restore

Operator scripts require installed `pg_dump`/`pg_restore`, compatible with the database version. Set `BACKUP_ENCRYPTION_KEY` to a base64-encoded random 32-byte key held separately from backups. `npm run db:backup -- /secure/path/backup.vdb` streams a custom-format database dump into AES-256-GCM encryption; the final archive is published only after dump success, with restrictive file permissions and no overwrite. Database credentials are passed through subprocess environment, not command arguments.

For a restore rehearsal, configure `RESTORE_DATABASE_URL` to a separate disposable database, then run `npm run db:restore -- /secure/path/backup.vdb --confirm-database-restore`. Check the script's usage before execution. The archive is authenticated before `pg_restore` runs; temporary decrypted data is private and removed afterward. Restore runs in one transaction and does not automatically clean an existing database. Never point it at production.

Logical dumps preserve database grants but do not include global roles, object-storage files or provider-managed recovery configuration. Supabase roles, extensions and managed schemas require compatible staging prerequisites. Configure provider backups/PITR and storage backups separately. No live backup, restore or migration was performed during implementation. Schedule encrypted backups, rehearse restoration and record recovery time/objectives before release.

For rollback, pause affected workers and transfer submission, deploy the previous compatible application, and retain additive tables/ledgers. Do not delete financial history or blindly reverse migrations. Investigate an unhealthy migration in staging and use a reviewed forward fix.
# Admin push notifications

`POST /v1/admin/notifications/push` requires an active admin bearer token and an `Idempotency-Key` header (8–100 letters, digits, underscores or hyphens).

```json
{
  "profile_ids": ["recipient-profile-uuid"],
  "title": "Service update",
  "body": "New stores are available."
}
```

Select 1–100 unique active account IDs, including customers, riders or vendor staff. The title is limited to 120 characters and the body to 1,000. Invalid recipients reject the entire request. The `202` response includes `notification_ids`, `recipients` and `queued_pushes`: these are accepted inbox messages and queued device deliveries, not proof of delivery. An account without a registered device still receives an inbox message. Push-disabled accounts are not queued, and consent/account/device ownership is checked again by the worker before delivery. This endpoint queues only push; it does not send SMS or email.

Retry the same request with the same key to return its original result without duplicating deliveries. Changing recipients or content while reusing the key returns `409`. New messages require a new key. Admin submissions are audited. Configure FCM credentials and registered device tokens, then run the notification worker for delivery. The endpoint supports selected recipients; it does not broadcast automatically to every account.
