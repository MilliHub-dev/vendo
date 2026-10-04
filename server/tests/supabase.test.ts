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
