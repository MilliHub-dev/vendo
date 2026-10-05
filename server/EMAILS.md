# Transactional email templates

`src/emails/templates.ts` renders the shared Vendo email design and action-specific content. Account email verification includes a six-digit code and its existing ten-minute expiry. The notification worker renders welcome, order/status, payment, refund, scheduled reminder, no-rider, vendor application, vendor order, rider offer and support updates from the existing event title/body. Unrecognized event kinds use the same design with a generic update label.

Messages use table layout and inline styling for email clients, readable text and accessible document metadata. All dynamic content is escaped. Order references come from the notification record. There are no invented amounts, statuses, destination links or external image dependencies. Open the app to act on a notification; authenticated deep links can be added when the application URLs are finalized.

Each renderer returns subject, plain text and HTML. Brevo sends `htmlContent` when HTML is present and retains its existing `textContent` path for text-only callers. This follows the documented body selection at https://developers.brevo.com/docs/send-a-transactional-email. No Brevo dashboard template IDs are required.

Regenerate fictional HTML previews with:

```sh
node --import tsx scripts/preview-emails.ts
```

Open files in `docs/email-previews/` to review them. Verification previews use a fictional code. Preview generation never sends email.

Delivery still uses existing verified-email and notification-preference rules, retry/outbox processing and Brevo credentials. Admin push remains push-only. These templates do not introduce new event triggers, password reset flows or changes to notification consent. New withdrawal/security events can use the shared renderer when their event flows exist. Preview files are examples; application data supplies the actual notification content.
