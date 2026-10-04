import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { readEnv } from '../src/config/env.js';
import { ApiError } from '../src/lib/errors.js';
import { fixtures, alice } from './helpers.js';

const env = readEnv({ NODE_ENV: 'test', EMAIL_VERIFICATION_SECRET: 'test-secret-that-is-more-than-32-characters' });
const headers = { authorization: 'Bearer alice' };
async function setup(t: { after(fn: () => Promise<unknown>): void }) {
  const fixture = fixtures();
  const app = await buildApp(env, fixture.dependencies);
  t.after(() => app.close());
  await app.inject({ method: 'PATCH', url: '/v1/me/name', headers, payload: { name: 'Alice Bello' } });
  await app.inject({ method: 'PATCH', url: '/v1/me/email', headers, payload: { email: 'alice@example.com' } });
  return { fixture, app };
}

test('email code verifies only the authenticated account, is hashed, single use and invalidated on change', async (t) => {
  const { fixture, app } = await setup(t);
  const requested = await app.inject({ method: 'POST', url: '/v1/me/email/verification/request', headers });
  assert.equal(requested.statusCode, 202);
  const code = fixture.emails[0]!.text.match(/\b\d{6}\b/)![0];
  const payload = { challenge_id: requested.json().challenge_id, code };
  assert.ok(!requested.body.includes(code));
  assert.equal(fixture.challenges.get(alice.id)!.hash.length, 64);
  assert.ok(!fixture.challenges.get(alice.id)!.hash.includes(code));
  assert.equal((await app.inject({ method: 'POST', url: '/v1/me/email/verification/confirm', headers: { authorization: 'Bearer bob' }, payload })).statusCode, 400);
  const verified = await app.inject({ method: 'POST', url: '/v1/me/email/verification/confirm', headers, payload });
  assert.equal(verified.statusCode, 200);
  assert.equal(verified.json().email_verified, true);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/me/email/verification/confirm', headers, payload })).statusCode, 400);
  await app.inject({ method: 'PATCH', url: '/v1/me/email', headers, payload: { email: 'changed@example.com' } });
  assert.equal(fixture.rows.get(alice.id)!.email_verified, false);
  assert.ok(!fixture.challenges.has(alice.id));
});

test('email attempts, expiry and sending failures fail closed', async (t) => {
  const { fixture, app } = await setup(t);
  const requested = await app.inject({ method: 'POST', url: '/v1/me/email/verification/request', headers });
  assert.equal((await app.inject({ method: 'POST', url: '/v1/me/email/verification/request', headers })).statusCode, 429);
  const code = fixture.emails[0]!.text.match(/\b\d{6}\b/)![0];
  const wrong = code === '000000' ? '111111' : '000000';
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await app.inject({ method: 'POST', url: '/v1/me/email/verification/confirm', headers, payload: { challenge_id: requested.json().challenge_id, code: wrong } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/me/email/verification/confirm', headers, payload: { challenge_id: requested.json().challenge_id, code } })).statusCode, 400);
  const second = await setup(t);
  second.fixture.dependencies.email.send = async () => { throw new ApiError(503, 'EMAIL_UNAVAILABLE', 'Unavailable'); };
  assert.equal((await second.app.inject({ method: 'POST', url: '/v1/me/email/verification/request', headers })).statusCode, 503);
  assert.equal(second.fixture.challenges.size, 0);
  const third = await setup(t);
  const expired = await third.app.inject({ method: 'POST', url: '/v1/me/email/verification/request', headers });
  third.fixture.challenges.get(alice.id)!.expiresAt = new Date(0);
  assert.equal((await third.app.inject({ method: 'POST', url: '/v1/me/email/verification/confirm', headers, payload: { challenge_id: expired.json().challenge_id, code: third.fixture.emails[0]!.text.match(/\b\d{6}\b/)![0] } })).statusCode, 400);
});

test('account preferences persist and do not allow changing account permissions', async (t) => {
  const { app } = await setup(t);
  assert.equal((await app.inject({ url: '/v1/me/preferences', headers })).json().theme, 'system');
  const saved = await app.inject({ method: 'PATCH', url: '/v1/me/preferences', headers, payload: { theme: 'dark', email_enabled: false } });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.json().email_enabled, false);
  assert.equal((await app.inject({ url: '/v1/me/preferences', headers })).json().theme, 'dark');
  assert.equal((await app.inject({ method: 'PATCH', url: '/v1/me/preferences', headers, payload: { role: 'admin' } })).statusCode, 400);
  assert.equal((await app.inject({ url: '/v1/me/preferences', headers: { authorization: 'Bearer bob' } })).json().theme, 'system');
});

test('deletion requires fresh phone proof and blocks profile/login/refresh access after deactivation', async (t) => {
  const { fixture, app } = await setup(t);
  const request = (otp: string) => app.inject({ method: 'POST', url: '/v1/me/deletion-request', headers, payload: { otp, confirmation: 'DELETE' } });
  assert.equal((await request('000000')).statusCode, 401);
  assert.equal(fixture.rows.get(alice.id)!.status, 'active');
  const otherAccount = await app.inject({ method: 'POST', url: '/v1/me/deletion-request', headers: { authorization: 'Bearer bob' }, payload: { otp: '123456', confirmation: 'DELETE' } });
  assert.equal(otherAccount.statusCode, 401);
  assert.equal((await request('123456')).statusCode, 202);
  assert.equal(fixture.rows.get(alice.id)!.status, 'deactivated');
  assert.equal((await app.inject({ url: '/v1/me', headers })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refresh_token: 'test' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { phone: alice.phone, token: '123456' } })).statusCode, 403);
});

test('global logout is delegated and recovery records requests without authenticating or sending email', async (t) => {
  const { fixture, app } = await setup(t);
  let scope: string | undefined;
  fixture.dependencies.auth.logout = async (_token, requestedScope) => { scope = requestedScope; };
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/logout', headers, payload: { scope: 'global' } })).statusCode, 200);
  assert.equal(scope, 'global');
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/logout', headers })).statusCode, 200);
  assert.equal(scope, 'local');
  const recovery = await app.inject({ method: 'POST', url: '/v1/auth/recovery-request', payload: { phone: '08144461726', contact_email: 'contact@example.com', message: 'I no longer have access to my phone.' } });
  assert.equal(recovery.statusCode, 202);
  assert.equal(fixture.recoveries.length, 1);
  assert.equal(fixture.emails.length, 0);
  assert.equal(fixture.rows.get(alice.id)!.phone, alice.phone);
});
