import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readEnv } from '../src/config/env.js';
import { normalizePhone } from '../src/modules/auth/schema.js';

test('configuration rejects incomplete/unsafe production settings without exposing secrets', () => {
  assert.equal(readEnv({}).PORT, 4000);
  assert.throws(() => readEnv({ NODE_ENV: 'production' }), /Required in production/);
  assert.throws(() => readEnv({ SUPABASE_ANON_KEY: 'secret-value' }), (error: Error) => !error.message.includes('secret-value'));
  assert.throws(() => readEnv({ TRUST_PROXY: 'true' }), /trusted proxy addresses/);
  assert.throws(() => readEnv({ CORS_ORIGINS: '*' }), /exact comma-separated/);
});

test('Nigerian phone normalization preserves identity and rejects malformed numbers', () => {
  for (const phone of ['08144461726', '+2348144461726', '2348144461726', '+234 (814) 446-1726']) {
    assert.equal(normalizePhone(phone), '+2348144461726');
  }
  for (const phone of ['123', '+15551234567', '081444617260', 'phone', '+2340144461726']) assert.throws(() => normalizePhone(phone));
});
