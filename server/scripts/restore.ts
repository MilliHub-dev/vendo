import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readEnv } from '../src/config/env.js';
import { backupKey, decryptBackup, postgresEnvironment } from '../src/lib/backup.js';
const path = process.argv[2];
if (!path || !process.argv.includes('--confirm-database-restore') || !process.env.RESTORE_DATABASE_URL)
    throw new Error('Specify backup path, RESTORE_DATABASE_URL and --confirm-database-restore for a separate restore target.');
const env = readEnv(), key = backupKey(process.env.BACKUP_ENCRYPTION_KEY);
if (env.DATABASE_URL && new URL(process.env.RESTORE_DATABASE_URL).hostname === new URL(env.DATABASE_URL).hostname && new URL(process.env.RESTORE_DATABASE_URL).pathname === new URL(env.DATABASE_URL).pathname)
    throw new Error('Restore requires a different database from the configured application database.');
const directory = await mkdtemp(join(tmpdir(), 'vendo-restore-')), file = join(directory, 'verified.dump');
try {
    await decryptBackup(path, file, key);
    const child = spawn('pg_restore', ['--dbname=' + decodeURIComponent(new URL(process.env.RESTORE_DATABASE_URL).pathname.slice(1)), '--single-transaction', '--exit-on-error', '--no-owner', file], { env: postgresEnvironment(process.env.RESTORE_DATABASE_URL, env.DATABASE_SSL, env.DATABASE_CA_PATH), stdio: 'ignore' });
    const [code] = await once(child, 'close');
    if (code !== 0)
        throw new Error('Restore failed');
    console.info('Database restore completed. Verify application data, identity mappings, roles, RLS and providers before routing traffic.');
}
catch {
    process.exitCode = 1;
    console.error('Database restore failed. No restore is attempted before backup authentication. Check tools, target privileges and compatibility.');
}
finally {
    await rm(directory, { recursive: true, force: true });
}
