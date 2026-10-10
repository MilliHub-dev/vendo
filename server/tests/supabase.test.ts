import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSupabaseAuth } from '../src/integrations/supabase.js';
import { alice } from './helpers.js';

test('Supabase adapter checks verified phone identity and isolates authentication state', async (t) => {
  const requests: { path: string; authorization: string | null; body: unknown }[] = [];
  let phoneConfirmed = true;
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    requests.push({ path, authorization: new Headers(init?.headers).get('authorization'),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : null });
    if (path.endsWith('/user')) {
      if (new Headers(init?.headers).get('authorization') !== 'Bearer legitimate-session') {
        return Response.json({ message: 'bad jwt', code: 'bad_jwt' }, { status: 401 });
      }
      return Response.json({ id: alice.id, aud: 'authenticated', phone: '2348144461726',
        phone_confirmed_at: phoneConfirmed ? new Date().toISOString() : null,
        is_anonymous: false, user_metadata: { role: 'admin' }, app_metadata: {}, created_at: new Date().toISOString() });
    }
    return Response.json({});
  };
  const auth = createSupabaseAuth('https://test.supabase.co', 'public-test-key');
  assert.deepEqual(await auth.authenticate('legitimate-session'), alice);
  await assert.rejects(() => auth.authenticate('forged-session'), /invalid or expired/);
  phoneConfirmed = false;
  await assert.rejects(() => auth.authenticate('legitimate-session'), /Verify your phone/);
  await auth.requestOtp(alice.phone);
  const otp = requests.find((request) => request.path.endsWith('/otp'))!;
  assert.equal(otp.authorization, 'Bearer public-test-key');
  assert.equal((otp.body as { phone: string }).phone, alice.phone);
  await auth.logout('legitimate-session');
  const logout = requests.find((request) => request.path.endsWith('/logout'))!;
  assert.equal(logout.authorization, 'Bearer legitimate-session');
});

test('with the service key and our own sender, the server emails the sign-in code itself and Supabase sends nothing', async (t) => {
  const calls: { path: string; key: string | null; body: Record<string, unknown> | null }[] = [];
  const sent: { email: string; code: string }[] = [];
  let knownUser = true, otp = '482913';
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
    calls.push({ path, key: new Headers(init?.headers).get('apikey'), body });
    if (path.endsWith('/admin/generate_link')) {
      if (!knownUser) return Response.json({ code: 404, error_code: 'user_not_found', msg: 'User not found' }, { status: 404 });
      return Response.json({ id: alice.id, aud: 'authenticated', email: body?.email, action_link: 'https://test.supabase.co/x', email_otp: otp, hashed_token: 'h', verification_type: 'magiclink', redirect_to: '' });
    }
    if (path.endsWith('/admin/users')) { knownUser = true; return Response.json({ id: alice.id, aud: 'authenticated', email: body?.email, created_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} }); }
    return Response.json({});
  };
  const auth = createSupabaseAuth('https://test.supabase.co', 'public-test-key', { serviceRoleKey: 'service-test-key', async send(email, code) { sent.push({ email, code }); } });

  await auth.requestEmailOtp!('amina@example.com');
  assert.deepEqual(sent, [{ email: 'amina@example.com', code: '482913' }]);
  assert.ok(calls.every((c) => !c.path.endsWith('/otp')), 'Supabase must not be asked to send the email');
  assert.equal(calls[0]!.key, 'service-test-key');
  assert.equal(calls[0]!.body?.type, 'magiclink');

  // a new address gets an unconfirmed account first; entering the code is what confirms it
  knownUser = false; calls.length = 0; sent.length = 0;
  await auth.requestEmailOtp!('new@example.com');
  assert.deepEqual(calls.map((c) => c.path.split('/').slice(-2).join('/')), ['admin/generate_link', 'admin/users', 'admin/generate_link']);
  assert.equal(calls[1]!.body?.email_confirm, false);
  assert.deepEqual(sent, [{ email: 'new@example.com', code: '482913' }]);

  // Supabase set to 8-digit codes: fail clearly instead of emailing a code the app can't accept
  otp = '48291377'; sent.length = 0;
  await assert.rejects(() => auth.requestEmailOtp!('amina@example.com'), /not configured correctly/);
  assert.equal(sent.length, 0);
});

test('with AUTH_CACHE_SECONDS a verified token is not re-checked until it expires or is signed out', async (t) => {
  let checks = 0;
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init) => {
    if (!new URL(String(input)).pathname.endsWith('/user')) return Response.json({});
    checks += 1;
    if (new Headers(init?.headers).get('authorization') !== 'Bearer good') return Response.json({ message: 'bad jwt', code: 'bad_jwt' }, { status: 401 });
    return Response.json({ id: alice.id, aud: 'authenticated', phone: '2348144461726', phone_confirmed_at: new Date().toISOString(),
      is_anonymous: false, user_metadata: {}, app_metadata: {}, created_at: new Date().toISOString() });
  };
  const cached = createSupabaseAuth('https://test.supabase.co', 'public-test-key', undefined, 30);
  assert.deepEqual(await cached.authenticate('good'), alice);
  assert.deepEqual(await cached.authenticate('good'), alice);
  assert.equal(checks, 1);
  // a rejected token is never remembered
  await assert.rejects(() => cached.authenticate('bad'), /invalid or expired/);
  await assert.rejects(() => cached.authenticate('bad'), /invalid or expired/);
  assert.equal(checks, 3);
  // signing out forgets the token straight away
  await cached.logout('good');
  await cached.authenticate('good');
  assert.equal(checks, 4);
  // off by default: every request is checked
  const live = createSupabaseAuth('https://test.supabase.co', 'public-test-key');
  await live.authenticate('good'); await live.authenticate('good');
  assert.equal(checks, 6);
});
