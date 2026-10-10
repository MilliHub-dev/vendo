import { readFileSync } from 'node:fs';
import pg from 'pg';
import type { Env } from '../config/env.js';

export function createPool(env: Env): pg.Pool {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  // pg lets connection-string ssl parameters override the explicit SSL config.
  const url = new URL(env.DATABASE_URL);
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  return new pg.Pool({
    connectionString: url.toString(), max: 10, connectionTimeoutMillis: 5000,
    // Opening a connection costs several round trips (TCP, TLS, sign-in), so quiet periods must not
    // throw them away: the first request after a pause was paying for a brand-new connection.
    idleTimeoutMillis: 600000, keepAlive: true, keepAliveInitialDelayMillis: 30000, statement_timeout: 5000,
    ssl: env.DATABASE_SSL === 'disable' ? false : {
      rejectUnauthorized: true,
      ...(env.DATABASE_CA_PATH ? { ca: readFileSync(env.DATABASE_CA_PATH, 'utf8') } : {}),
    },
  });
}
