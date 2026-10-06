import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { readEnv } from '../src/config/env.js';
import { createPaystackBanks } from '../src/modules/rider-app/banks.js';
import { riderEarning, type RiderSummary, type RiderTrip } from '../src/modules/rider-app/repository.js';
import { fixtures, alice } from './helpers.js';

const headers = { authorization: 'Bearer alice' };
const env = readEnv({ NODE_ENV: 'test' });

test('rider earning matches the settlement sum: a share of the delivery fee plus a fixed amount', () => {
  assert.equal(riderEarning({ delivery_fee_kobo: 80_000 }, { rider_delivery_bps: 8000, rider_fixed_kobo: 5_000 }), 69_000);
  assert.equal(riderEarning({ delivery_fee_kobo: 99_999 }, { rider_delivery_bps: 3333, rider_fixed_kobo: 0 }), 33_329); // rounds down, like the settlement
  assert.equal(riderEarning({ delivery_fee_kobo: 80_000 }, null), null); // no policy: say nothing rather than guess
  assert.equal(riderEarning({}, { rider_delivery_bps: 8000, rider_fixed_kobo: 0 }), null);
});

test('rider summary and trips need a signed-in, complete profile and return the repository’s view', async () => {
  const fixture = fixtures();
  const summary: RiderSummary = { rating: 4.8, rating_count: 12, total_trips: 40, acceptance_rate: 0.9, minimum_withdrawal_kobo: 100_000, offer: { id: randomUUID(), earning_kobo: 69_000, trip_distance_m: 4200, summary: 'Arewa Kitchen · 2 items' }, job: null };
  const trip: RiderTrip = { order_id: randomUUID(), code: 'VD-1', type: 'food', title: 'Arewa Kitchen', pickup: { lat: 10.5, lng: 7.4, address: 'A' }, dropoff: { lat: 10.6, lng: 7.5, address: 'B' }, distance_m: 4200, earning_kobo: 69_000, completed_at: new Date().toISOString() };
  const asked: string[] = [];
  fixture.dependencies.riderApp = { async summary(id) { asked.push(id); return summary; }, async trips(id, limit, offset) { asked.push(`${id}:${limit}:${offset}`); return [trip]; } };
  const app = await buildApp(env, fixture.dependencies);
  try {
    assert.equal((await app.inject({ url: '/v1/riders/me/summary' })).statusCode, 401);
    // signed in but name/email/phone not finished
    assert.equal((await app.inject({ url: '/v1/riders/me/summary', headers })).statusCode, 403);
    await app.inject({ method: 'PATCH', url: '/v1/me/name', headers, payload: { name: 'Alice Bello' } });
    await app.inject({ method: 'PATCH', url: '/v1/me/email', headers, payload: { email: 'alice@example.com' } });
    let response = await app.inject({ url: '/v1/riders/me/summary', headers });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json(), summary);
    response = await app.inject({ url: '/v1/riders/me/trips?limit=5', headers });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json(), { items: [trip] });
    assert.deepEqual(asked, [alice.id, `${alice.id}:5:0`]); // always the caller's own record
    assert.equal((await app.inject({ url: '/v1/riders/me/trips?limit=500', headers })).statusCode, 400);
    // no Paystack key in this app: the bank list says so instead of inventing one
    assert.equal((await app.inject({ url: '/v1/payout-banks', headers })).statusCode, 503);
  } finally { await app.close(); }
});

test('payout banks come from Paystack, cleaned and cached, and a stale list survives an outage', async () => {
  let calls = 0, fail = false;
  const fetcher = (async () => {
    calls++;
    if (fail) throw new Error('down');
    return new Response(JSON.stringify({ status: true, data: [
      { code: '058', name: 'Guaranty Trust Bank', active: true }, { code: '044', name: 'Access Bank', active: true },
      { code: '058', name: 'GTBank duplicate', active: true }, { code: '999', name: 'Closed Bank', active: false }, { code: 'ABC', name: 'Bad code', active: true },
    ] }), { status: 200 });
  }) as typeof fetch;
  const banks = createPaystackBanks('sk_test_x', fetcher);
  assert.deepEqual(await banks.list(), [{ code: '044', name: 'Access Bank' }, { code: '058', name: 'Guaranty Trust Bank' }]);
  await banks.list();
  assert.equal(calls, 1); // cached
  fail = true;
  const broken = createPaystackBanks('sk_test_x', fetcher);
  await assert.rejects(() => broken.list(), /temporarily unavailable/);
});

test('an admin without a contact phone is not treated as an unfinished sign-up', async () => {
  const { requireCompleteProfile } = await import('../src/modules/users/service.js');
  const base = { id: randomUUID(), phone: null, name: 'Ops Admin', email: 'ops@vendoltd.com', email_verified: true, status: 'active' as const, created_at: '', updated_at: '' };
  assert.doesNotThrow(() => requireCompleteProfile({ ...base, role: 'admin', onboarding_step: 'phone_required' }));
  // customers, riders and vendors still have to finish; and a suspended admin is still refused
  assert.throws(() => requireCompleteProfile({ ...base, role: 'customer', onboarding_step: 'phone_required' }), /Complete your name/);
  assert.throws(() => requireCompleteProfile({ ...base, role: 'admin', name: null, onboarding_step: 'name_required' }), /Complete your name/);
  assert.throws(() => requireCompleteProfile({ ...base, role: 'admin', status: 'suspended', onboarding_step: 'phone_required' }), /cannot access/);
});
