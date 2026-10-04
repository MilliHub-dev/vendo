import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { readEnv } from '../src/config/env.js';
import { createPool } from '../src/integrations/database.js';

const pool = createPool(readEnv());
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(76341003)");
    await client.query(`CREATE SCHEMA IF NOT EXISTS vendo_internal;
      REVOKE ALL ON SCHEMA vendo_internal FROM PUBLIC, anon, authenticated;
      CREATE TABLE IF NOT EXISTS vendo_internal.migrations (
        name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    const directory = new URL('../supabase/migrations/', import.meta.url);
    const files = (await readdir(directory)).filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file)).sort();
    for (const file of files) {
      const sql = await readFile(new URL(file, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const applied = await client.query<{ checksum: string }>('SELECT checksum FROM vendo_internal.migrations WHERE name = $1', [file]);
      if (applied.rows[0]) {
        if (applied.rows[0].checksum !== checksum) throw new Error(`Applied migration was changed: ${file}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO vendo_internal.migrations (name, checksum) VALUES ($1, $2)', [file, checksum]);
      console.info(`Applied ${file}`);
    }
    await client.query('COMMIT');
    console.info('Database migrations are up to date.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
} catch (error) {
  // Database connection errors may contain credentials; avoid printing them.
  console.error(error instanceof Error && error.message.startsWith('Applied migration was changed:')
    ? error.message : 'Migration failed. Check database connectivity and migration SQL. No pending changes were committed.');
  process.exitCode = 1;
} finally { await pool.end(); }
