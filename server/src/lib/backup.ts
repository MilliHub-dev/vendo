import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
const magic = Buffer.from('VDB1');
export function backupKey(value: string | undefined) { if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value))
    throw new Error('Provide a base64 32-byte backup encryption key.'); const key = Buffer.from(value, 'base64'); if (key.length !== 32)
    throw new Error('Invalid backup key.'); return key; }
export function postgresEnvironment(url: string, ssl: 'verify' | 'disable', ca?: string): NodeJS.ProcessEnv { const db = new URL(url); if (!['postgres:', 'postgresql:'].includes(db.protocol) || db.searchParams.has('options'))
    throw new Error('Use a PostgreSQL URL without runtime options.'); return { ...process.env, PGHOST: db.hostname, PGPORT: db.port || '5432', PGDATABASE: decodeURIComponent(db.pathname.slice(1)), PGUSER: decodeURIComponent(db.username), PGPASSWORD: decodeURIComponent(db.password), PGSSLMODE: ssl === 'verify' ? 'verify-full' : 'disable', ...(ca ? { PGSSLROOTCERT: ca } : {}) }; }
export async function encryptBackup(input: Readable, path: string, key: Buffer) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(magic); const envelope = new Transform({ transform(chunk, _encoding, done) { done(null, chunk); }, flush(done) { this.push(cipher.getAuthTag()); done(); } }); const file = createWriteStream(path, { flags: 'wx', mode: 0o600 }); file.write(Buffer.concat([magic, iv])); await pipeline(input, cipher, envelope, file); }
export async function decryptBackup(path: string, output: string, key: Buffer) { const f = await open(path, 'r'); try {
    const size = (await f.stat()).size;
    if (size < 32)
        throw new Error('Invalid backup.');
    const header = Buffer.alloc(16), tag = Buffer.alloc(16);
    await f.read(header, 0, 16, 0);
    await f.read(tag, 0, 16, size - 16);
    if (!header.subarray(0, 4).equals(magic))
        throw new Error('Invalid backup.');
    const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(4));
    decipher.setAAD(magic);
    decipher.setAuthTag(tag);
    await pipeline(createReadStream(path, { start: 16, end: size - 17 }), decipher, createWriteStream(output, { flags: 'wx', mode: 0o600 }));
}
finally {
    await f.close();
} }
