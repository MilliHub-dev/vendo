import { mkdir, writeFile } from 'node:fs/promises';
import { verificationEmail, notificationEmail } from '../src/emails/templates.js';
const directory = new URL('../docs/email-previews/', import.meta.url);
await mkdir(directory, { recursive: true });
const samples = [
  ['verification', verificationEmail('123456')],
  ...Object.entries({ welcome: ['Welcome to Vendo', 'Your account is ready. Explore Vendo to get started.'], order: ['Order ready', 'Your order is ready for pickup.'], payment: ['Payment confirmed', 'Your payment was confirmed.'], refund: ['Refund processed', 'Your refund was processed.'], reminder: ['Scheduled delivery reminder', 'Your scheduled delivery is coming up.'], vendor: ['Vendor application approved', 'Your store application has been approved.'], vendor_order: ['New store order', 'A paid order needs your store confirmation.'], rider_offer: ['New delivery offer', 'Open Vendo to review your delivery offer.'], support: ['Support update', 'There is an update on your support request.'], no_rider: ['No rider available', 'We could not find a rider. Open Vendo to review your options.'] }).map(([kind, [title = 'Vendo update', body = 'Open Vendo for details.']]) => [kind, notificationEmail({ kind, title, body, order_id: ['order', 'payment', 'refund', 'reminder', 'vendor_order', 'rider_offer', 'no_rider'].includes(kind) ? '11111111-1111-4111-8111-111111111111' : null })] as const),
] as const;
for (const [name, email] of samples) await writeFile(new URL(`${name}.html`, directory), email.html);
console.info(`Generated ${samples.length} sample emails with fictional data in docs/email-previews.`);
