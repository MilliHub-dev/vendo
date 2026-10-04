import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { readEnv } from '../src/config/env.js';
import { createDependencies } from '../src/dependencies.js';
import { fixtures } from './helpers.js';

type Operation = { security?: Record<string, unknown>[]; requestBody?: unknown };

test('Every documented protected endpoint rejects requests without authentication or required input', async (t) => {
  const app = await buildApp(readEnv({ NODE_ENV: 'test' }), fixtures().dependencies);
  t.after(() => app.close());
  await app.ready();
  const document = app.swagger() as { paths: Record<string, Record<string, Operation>> };
  let checked = 0, authRejected = 0, validationRejected = 0;
  for (const [path, operations] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method) || !operation.security?.some(s => 'bearerAuth' in s)) continue;
      const url = path.replace(/\{[^}]+\}/g, '11111111-1111-4111-8111-111111111111');
      const response = await app.inject({ method: method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url,
        remoteAddress: `192.0.${Math.floor(checked / 250)}.${checked % 250 + 1}`,
        ...(operation.requestBody ? { payload: {} } : {}) });
      assert.ok([400, 401].includes(response.statusCode), `${method.toUpperCase()} ${path}: expected input/auth rejection, received ${response.statusCode}: ${response.body}`);
      if (response.statusCode === 401) authRejected++; else validationRejected++;
      checked++;
    }
  }
  assert.ok(checked > 0, 'The protected endpoint inventory must not be empty.');
  t.diagnostic(`${checked} protected operations checked: ${authRejected} rejected missing authentication, ${validationRejected} rejected missing/invalid input before authentication. Functional authorization is covered in the feature integration tests.`);
});

test('Every documented public endpoint responds without an internal server error', async (t) => {
  const env = readEnv({ NODE_ENV: 'test' });
  const app = await buildApp(env, await createDependencies(env));
  t.after(() => app.close());
  await app.ready();
  const document = app.swagger() as { paths: Record<string, Record<string, Operation>> };
  let checked = 0;
  for (const [path, operations] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method) || operation.security?.some(s => 'bearerAuth' in s)) continue;
      const response = await app.inject({ method: method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        url: path.replace(/\{[^}]+\}/g, '11111111-1111-4111-8111-111111111111'),
        remoteAddress: `198.51.100.${++checked}`,
        ...(operation.requestBody ? { payload: {} } : {}) });
      assert.ok(response.statusCode < 500 || response.statusCode === 503, `${method.toUpperCase()} ${path}: unexpected ${response.statusCode}: ${response.body}`);
    }
  }
  assert.ok(checked > 0);
  t.diagnostic(`${checked} public operations checked with test fixtures; unconfigured providers may return 503. Success and webhook signature flows are covered in the feature tests.`);
});
