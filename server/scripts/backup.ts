import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { rm, link } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { readEnv } from '../src/config/env.js';
import { backupKey, encryptBackup, postgresEnvironment } from '../src/lib/backup.js';
const output = process.argv[2];
if (!output)
    throw new Error('Usage: npm run db:backup -- /secure/path/backup.vdb');
const env = readEnv();
if (!env.DATABASE_URL)
    throw new Error('Database configuration required.');
const key = backupKey(process.env.BACKUP_ENCRYPTION_KEY), file = resolve(output);
const child = spawn('pg_dump', ['--format=custom', '--no-owner'], { env: postgresEnvironment(env.DATABASE_URL, env.DATABASE_SSL, env.DATABASE_CA_PATH), stdio: ['ignore', 'pipe', 'ignore'] });
const completed = once(child, 'close').then(([code]) => code, () => -1), partial = `${file}.partial-${randomUUID()}`;
try {
    await encryptBackup(child.stdout, partial, key);
    const code = await completed;
    if (code !== 0)
        throw new Error('Database backup failed.');
    await link(partial, file);
    await rm(partial);
    console.info('Encrypted database backup completed.');
}
catch {
    child.kill();
    await rm(partial, { force: true });
    process.exitCode = 1;
    console.error('Database backup failed. Check PostgreSQL tools, permissions, TLS and backup configuration.');
}
