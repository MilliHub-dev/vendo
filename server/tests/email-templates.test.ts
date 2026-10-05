import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verificationEmail, notificationEmail } from '../src/emails/templates.js';

test('Verification email keeps its code, expiry and safety instructions in HTML and plain text', () => {
  const email = verificationEmail('123456');
  assert.match(email.html, /123456/);
  assert.match(email.text, /123456/);
  assert.match(email.html, /10 minutes/);
  assert.match(email.text, /Do not share/);
  assert.throws(() => verificationEmail('<script>'));
});

test('Notification emails escape content, preserve newlines and use authoritative event details', () => {
  const email = notificationEmail({ kind: 'refund', title: '<img src=x onerror=alert(1)>', body: 'Refund approved & recorded.\n<script>alert(1)</script>', order_id: 'order-reference' });
  assert.ok(!email.html.includes('<script>'));
  assert.ok(!email.html.includes('<img'));
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /&amp;/);
  assert.match(email.html, /<br>/);
  assert.match(email.html, /order-reference/);
  assert.match(email.text, /order-reference/);
  assert.match(email.html, /REFUND UPDATE/);
  const unknown = notificationEmail({ kind: 'future_event', title: 'Update', body: 'Details', order_id: null });
  assert.match(unknown.html, /VENDO UPDATE/);
  assert.ok(!unknown.html.includes('Order reference'));
});
