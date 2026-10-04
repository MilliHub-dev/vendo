import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { createTransferGateway } from '../src/integrations/transfers.js';
import { backupKey, encryptBackup, decryptBackup, postgresEnvironment } from '../src/lib/backup.js';
import { readEnv } from '../src/config/env.js';
test('Paystack payouts bind bank/recipient/reference/amount/environment and redact provider failures', async (t) => {
    const original = globalThis.fetch;
    t.after(() => { globalThis.fetch = original; });
    let wrong = false, httpFailure = false;
    const calls: {
        url: string;
        body: Record<string, unknown> | null;
    }[] = [];
    globalThis.fetch = async (input, init) => {
        const url = String(input), body = init?.body ? JSON.parse(String(init.body)) : null;
        calls.push({ url, body });
        assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer sk_test_mock');
        let data: unknown;
        if (url.includes('/bank/resolve?'))
            data = { account_number: wrong ? '9999999999' : '0000001111', account_name: 'Mock Holder' };
        else if (url.endsWith('/transferrecipient'))
            data = { active: true, currency: 'NGN', domain: 'test', recipient_code: 'RCP_mock', details: { account_number: '0000001111', bank_code: '044' } };
        else if (url.endsWith('/transfer'))
            data = { status: 'pending' };
        else
            data = { reference: 'vd-w-00000000-0000-4000-8000-000000000001', amount: wrong ? 1 : 10000, currency: 'NGN', status: 'success', domain: wrong ? 'live' : 'test', transfer_code: 'TRF_mock', recipient: { recipient_code: 'RCP_mock' } };
        return new Response(JSON.stringify(httpFailure ? { secret: 'provider-account-data' } : { status: true, data }), { status: httpFailure ? 500 : 200 });
    };
    const g = createTransferGateway('sk_test_mock'), bank = { bank_code: '044', account_number: '0000001111' }, reference = 'vd-w-00000000-0000-4000-8000-000000000001';
    assert.equal((await g.resolve(bank)).account_name, 'Mock Holder');
    assert.equal(await g.recipient(bank, 'Mock Holder'), 'RCP_mock');
    await g.submit({ id: '00000000-0000-4000-8000-000000000001', account_id: '00000000-0000-4000-8000-000000000002', reference, amount_kobo: 10000, status: 'submitting', recipient_code: 'RCP_mock', fresh: true, review_note: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    assert.equal(calls[2]!.body!.amount, 10000);
    assert.equal(calls[2]!.body!.reference, reference);
    assert.equal((await g.verify(reference)).recipient_code, 'RCP_mock');
    wrong = true;
    await assert.rejects(() => g.resolve(bank), /verification failed/);
    await assert.rejects(() => g.verify(reference), /verification failed/);
    wrong = false;
    httpFailure = true;
    await assert.rejects(() => g.verify(reference), e => e instanceof Error && !e.message.includes('provider-account-data'));
    assert.throws(() => readEnv({ PAYSTACK_TRANSFERS_ENABLED: 'true' }), /configured Paystack/);
});
test('Backups stream authenticated encryption, reject tampering/wrong keys and keep connection secrets out of argv', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'vendo-backup-test-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const key = randomBytes(32), encrypted = join(dir, 'archive.vdb'), decrypted = join(dir, 'restored.dump'), data = Buffer.from('PGDMP\nTest-only backup bytes.');
    assert.equal(backupKey(key.toString('base64')).length, 32);
    assert.throws(() => backupKey('short'), /32-byte/);
    await encryptBackup(Readable.from([data.subarray(0, 8), data.subarray(8)]), encrypted, key);
    assert.ok(!(await readFile(encrypted)).includes(data));
    assert.equal((await stat(encrypted)).mode & 0o777, 0o600);
    await decryptBackup(encrypted, decrypted, key);
    assert.deepEqual(await readFile(decrypted), data);
    await assert.rejects(() => encryptBackup(Readable.from([data]), encrypted, key));
    assert.deepEqual(await readFile(decrypted), data);
    await assert.rejects(() => decryptBackup(encrypted, join(dir, 'wrong-key'), randomBytes(32)));
    const tampered = await readFile(encrypted);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 1;
    await writeFile(join(dir, 'tampered.vdb'), tampered);
    await assert.rejects(() => decryptBackup(join(dir, 'tampered.vdb'), join(dir, 'tampered.dump'), key));
    const env = postgresEnvironment('postgresql://mock_user:mock_password@db.example.test:5432/mock_database?sslmode=disable', 'verify', '/test/ca.pem');
    assert.equal(env.PGPASSWORD, 'mock_password');
    assert.equal(env.PGSSLMODE, 'verify-full');
    assert.equal(env.PGDATABASE, 'mock_database');
    assert.equal(env.PGSSLROOTCERT, '/test/ca.pem');
    assert.throws(() => postgresEnvironment('https://example.test', 'verify'), /PostgreSQL/);
});
