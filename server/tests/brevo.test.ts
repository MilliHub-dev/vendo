import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrevoSmsSender, createBrevoEmailSender } from '../src/integrations/brevo.js';
import { readEnv } from '../src/config/env.js';

test('Brevo sends SMS and email with API authentication and provider-specific payloads', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return Response.json({ messageId: String(input).includes('transactionalSMS') ? 12345 : '<email-id@brevo>' }, { status: 201 });
  };
  await createBrevoSmsSender('test-api-key', 'Vendo').send('+2348144461726', '123456');
  await createBrevoEmailSender('test-api-key', 'hello@example.com', 'Vendo').send({ to: 'customer@example.com', subject: 'Welcome', text: 'Welcome to Vendo.' });
  assert.equal(calls[0]?.url, 'https://api.brevo.com/v3/transactionalSMS/send');
  assert.equal(calls[0]?.headers.get('api-key'), 'test-api-key');
  assert.equal(calls[0]?.body.recipient, '2348144461726');
  assert.equal(calls[0]?.body.type, 'transactional');
  assert.ok(String(calls[0]?.body.content).includes('123456'));
  assert.equal(calls[0]?.body.api_key, undefined);
  assert.equal(calls[1]?.url, 'https://api.brevo.com/v3/smtp/email');
  assert.deepEqual(calls[1]?.body.sender, { email: 'hello@example.com', name: 'Vendo' });
  assert.deepEqual(calls[1]?.body.to, [{ email: 'customer@example.com' }]);
  assert.equal(calls[1]?.body.textContent, 'Welcome to Vendo.');
});

test('Brevo failures and malformed success responses fail without leaking provider details', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const sms = createBrevoSmsSender('secret-key', 'Vendo');
  const email = createBrevoEmailSender('secret-key', 'hello@example.com', 'Vendo');
  for (const status of [201, 400, 429, 500]) {
    globalThis.fetch = async () => Response.json({ message: 'secret-provider-response' }, { status });
    await assert.rejects(() => sms.send('+2348144461726', '123456'), /Verification messages are temporarily unavailable/);
    await assert.rejects(() => email.send({ to: 'customer@example.com', subject: 'Welcome', text: 'Hello' }), /Email delivery is temporarily unavailable/);
  }
  globalThis.fetch = async () => { throw new Error('secret-network-details'); };
  await assert.rejects(() => sms.send('+2348144461726', '123456'), /Verification messages are temporarily unavailable/);
  await assert.rejects(() => email.send({ to: 'bad-email', subject: 'Welcome', text: 'Hello' }), /Invalid email message/);
});

test('Brevo configuration validates sender fields', () => {
  assert.equal(readEnv({ BREVO_SMS_SENDER: 'Vendo', BREVO_EMAIL_SENDER: 'hello@example.com' }).BREVO_EMAIL_SENDER_NAME, 'Vendo');
  assert.throws(() => readEnv({ BREVO_EMAIL_SENDER: 'not-an-email' }));
  assert.throws(() => readEnv({ BREVO_SMS_SENDER: 'SenderTooLong' }));
});
