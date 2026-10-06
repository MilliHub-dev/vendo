import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Webhook } from 'standardwebhooks';
import { buildApp } from '../src/app.js';
import { readEnv } from '../src/config/env.js';
import { createDependencies } from '../src/dependencies.js';
import { ApiError } from '../src/lib/errors.js';
import { requireCompleteProfile } from '../src/modules/users/service.js';
import { fixtures, alice, bob } from './helpers.js';

const env = readEnv({ NODE_ENV: 'test' });
const headers = { authorization: 'Bearer alice' };

test('phone OTP then name/email onboarding resumes without resetting profile', async (t) => {
  const fixture = fixtures();
  const app = await buildApp(env, fixture.dependencies);
  t.after(() => app.close());
  let response = await app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone: '0814 446 1726' } });
  assert.equal(response.statusCode, 202);
  assert.deepEqual(fixture.requested, [alice.phone]);
  response = await app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { phone: alice.phone, token: '123456' } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().access_token, 'alice');
  response = await app.inject({ url: '/v1/me', headers });
  assert.equal(response.json().onboarding_step, 'name_required');
  assert.throws(() => requireCompleteProfile(fixture.rows.get(alice.id)!), /Complete your name/);
  response = await app.inject({ method: 'PATCH', url: '/v1/me/email', headers, payload: { email: 'alice@example.com' } });
  assert.equal(response.statusCode, 409);
  response = await app.inject({ method: 'PATCH', url: '/v1/me/name', headers, payload: { name: '  Alice Bello  ' } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().name, 'Alice Bello');
  assert.equal(response.json().onboarding_step, 'email_required');
  response = await app.inject({ url: '/v1/me', headers });
  assert.equal(response.json().onboarding_step, 'email_required');
  response = await app.inject({ method: 'PATCH', url: '/v1/me/email', headers, payload: { email: ' Alice@Example.com ' } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().email, 'alice@example.com');
  assert.equal(response.json().email_verified, false);
  assert.equal(response.json().onboarding_step, 'complete');
  requireCompleteProfile(fixture.rows.get(alice.id)!);
  response = await app.inject({ url: '/v1/me', headers });
  assert.equal(response.json().onboarding_step, 'complete');
});

test('sessions, user boundaries, input validation and role escalation are enforced', async (t) => {
  const fixture = fixtures();
  const app = await buildApp(env, fixture.dependencies);
  t.after(() => app.close());
  for (const authorization of ['', 'Bearer invented', 'Bearer alice extra']) {
    const response = await app.inject({ url: '/v1/me', headers: { authorization } });
    assert.equal(response.statusCode, 401);
  }
  for (const payload of [{ name: 'Alice', role: 'admin' }, { name: '' }, { name: 'a\nname' }, { name: 'Alice', id: bob.id }]) {
    const response = await app.inject({ method: 'PATCH', url: '/v1/me/name', headers, payload });
    assert.equal(response.statusCode, 400);
  }
  await app.inject({ method: 'PATCH', url: '/v1/me/name', headers, payload: { name: 'Alice' } });
  const response = await app.inject({ url: '/v1/me', headers: { authorization: 'Bearer bob' } });
  assert.equal(response.json().id, bob.id);
  assert.equal(response.json().name, null);
  assert.equal(response.json().role, 'customer');
  fixture.rows.get(alice.id)!.status = 'suspended';
  assert.equal((await app.inject({ url: '/v1/me', headers })).statusCode, 403);
});

test('normalized phone cooldown and verification attempt limits cannot be bypassed by formatting', async (t) => {
  const fixture = fixtures();
  const app = await buildApp(env, fixture.dependencies);
  t.after(() => app.close());
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone: '08144461726' } })).statusCode, 202);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone: '+234 814 446 1726' } })).statusCode, 429);
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { phone: alice.phone, token: '999999' } })).statusCode, 401);
  }
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { phone: alice.phone, token: '123456' } })).statusCode, 429);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone: '+15551234567' } })).statusCode, 400);
});

test('health, unavailable providers, request IDs and error redaction', async (t) => {
  const app = await buildApp(env, await createDependencies(env));
  t.after(() => app.close());
  const root = await app.inject('/');
  assert.equal(root.statusCode, 302);
  assert.equal(root.headers.location, '/docs/');
  const docs = await app.inject('/docs/');
  assert.equal(docs.statusCode, 200);
  assert.match(docs.body, /swagger-ui/i);
  assert.equal((await app.inject('/docs/static/swagger-ui-bundle.js')).statusCode, 200);
  assert.ok((await app.inject('/docs/json')).json().paths['/v1/me']);
  assert.equal((await app.inject('/health')).statusCode, 200);
  assert.equal((await app.inject('/ready')).statusCode, 503);
  const response = await app.inject({ url: '/v1/me', headers });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.request_id, response.headers['x-request-id']);
  assert.equal(response.headers['cache-control'], 'no-store');
  const notFound = await app.inject('/missing');
  assert.equal(notFound.statusCode, 404);
  const broken = fixtures();
  broken.dependencies.auth.authenticate = async () => { throw new Error('secret-database-password'); };
  const brokenApp = await buildApp(env, broken.dependencies);
  t.after(() => brokenApp.close());
  const failure = await brokenApp.inject({ url: '/v1/me', headers });
  assert.equal(failure.statusCode, 500);
  assert.ok(!failure.body.includes('secret-database-password'));
});

test('SMS hook verifies raw payload and timestamp, deduplicates success and retries failure', async (t) => {
  const fixture = fixtures();
  const secret = Buffer.alloc(32, 42).toString('base64');
  const app = await buildApp({ ...env, SEND_SMS_HOOK_SECRET: `v1,whsec_${secret}` }, fixture.dependencies);
  t.after(() => app.close());
  const payload = JSON.stringify({ user: { phone: alice.phone }, sms: { otp: '123456' } });
  const signed = (id: string, time = new Date()) => ({
    'content-type': 'application/json', 'webhook-id': id,
    'webhook-timestamp': Math.floor(time.getTime() / 1000).toString(),
    'webhook-signature': new Webhook(secret).sign(id, time, payload),
  });
  assert.equal((await app.inject({ method: 'POST', url: '/v1/hooks/send-sms', payload, headers: { 'content-type': 'application/json' } })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/hooks/send-sms', payload: `${payload} `, headers: signed('tampered') })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/hooks/send-sms', payload, headers: signed('old', new Date(Date.now() - 600000)) })).statusCode, 401);
  for (let retry = 0; retry < 2; retry++) {
    assert.equal((await app.inject({ method: 'POST', url: '/v1/hooks/send-sms', payload, headers: signed('good') })).statusCode, 200);
  }
  assert.equal(fixture.sms.length, 1);
  const original = fixture.dependencies.sms.send;
  fixture.dependencies.sms.send = async () => { throw new ApiError(503, 'SMS_UNAVAILABLE', 'Unavailable'); };
  assert.equal((await app.inject({ method: 'POST', url: '/v1/hooks/send-sms', payload, headers: signed('retry') })).statusCode, 503);
  fixture.dependencies.sms.send = original;
  assert.equal((await app.inject({ method: 'POST', url: '/v1/hooks/send-sms', payload, headers: signed('retry') })).statusCode, 200);
  assert.equal(fixture.sms.length, 2);
});

test('OpenAPI contains onboarding schemas and bearer security', async (t) => {
  const app = await buildApp(env, fixtures().dependencies);
  t.after(() => app.close());
  const response = await app.inject('/openapi.json');
  assert.equal(response.statusCode, 200);
  const document = response.json();
  assert.ok(document.paths['/v1/auth/otp/request']);
  assert.ok(document.paths['/v1/me/email'].patch.security[0].bearerAuth);
  assert.equal(document.paths['/v1/me/name'].patch.requestBody.content['application/json'].schema.additionalProperties, false);
  assert.equal(document.paths['/v1/auth/logout'].post.requestBody.required, false);
});

test('email OTP normalizes addresses, rate limits resends and verifies sessions', async (t) => {
  const fixture = fixtures();
  const requested: string[] = [];
  fixture.dependencies.auth.requestEmailOtp = async email => { requested.push(email); };
  fixture.dependencies.auth.verifyEmailOtp = async (email, token) => {
    assert.equal(email, 'owner@example.com');
    if (token !== '123456') throw new ApiError(401, 'AUTH_FAILED', 'Invalid code.');
    return { access_token: 'alice', refresh_token: 'refresh-alice', expires_in: 3600, token_type: 'bearer' };
  };
  const app = await buildApp(env, fixture.dependencies); t.after(() => app.close());
  const send = (email: string) => app.inject({ method: 'POST', url: '/v1/auth/email/otp/request', payload: { email } });
  assert.equal((await send(' Owner@Example.com ')).statusCode, 202);
  assert.deepEqual(requested, ['owner@example.com']);
  assert.equal((await send('owner@example.com')).statusCode, 429);
  assert.equal((await send('invalid')).statusCode, 400);
  const verify = (token: string) => app.inject({ method: 'POST', url: '/v1/auth/email/otp/verify', payload: { email: 'owner@example.com', token } });
  assert.equal((await verify('999999')).statusCode, 401);
  assert.equal((await verify('123456')).json().access_token, 'alice');
});
