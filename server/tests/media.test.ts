import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateFile } from '../src/modules/media/validation.js';
import { docxMime, uploadSchema } from '../src/modules/media/schema.js';
import { createObjectStorage } from '../src/integrations/storage.js';
import { readEnv } from '../src/config/env.js';
import { docxFixture } from './docx-fixture.js';
test('Media rejects type spoofing, unsafe DOCX packages, oversized and noncanonical input', () => {
    const doc = docxFixture();
    assert.deepEqual(validateFile(doc.toString('base64'), docxMime), doc);
    for (const data of [Buffer.from('PK fake zip'), docxFixture({ 'word/document.xml': '<!DOCTYPE doc [<!ENTITY x SYSTEM "file:///etc/passwd">]><w:document/>' }), docxFixture({ 'word/vbaProject.bin': 'macro' }), docxFixture({ '../outside.xml': 'bad' })])
        assert.throws(() => validateFile(data.toString('base64'), docxMime), /valid/);
    assert.throws(() => validateFile(doc.toString('base64'), 'image/png'));
    assert.throws(() => validateFile(Buffer.alloc(2097153).toString('base64'), 'image/png'));
    assert.throws(() => validateFile('YQ==\n', 'application/pdf'));
    assert.equal(uploadSchema.safeParse({ purpose: 'image', mime: docxMime, data_base64: doc.toString('base64') }).success, false);
    assert.throws(() => readEnv({ SUPABASE_SERVICE_ROLE_KEY: 'server-secret' }), /Supabase/);
});
test('Storage adapter uses server credentials, distinct buckets, immutable uploads and short-lived signed downloads', async (t) => {
    const previous = globalThis.fetch;
    t.after(() => { globalThis.fetch = previous; });
    const calls: {
        url: string;
        init: RequestInit | undefined;
    }[] = [];
    let fail = false, expose = false;
    globalThis.fetch = async (input, init) => { const url = String(input); calls.push({ url, init }); if (fail)
        return new Response(JSON.stringify({ message: 'private provider error' }), { status: 500 }); if (url.includes('/bucket/'))
        return Response.json({ id: url.split('/').at(-1), public: expose || url.endsWith('vendo-public') }); if (url.includes('/object/sign/'))
        return Response.json({ signedURL: '/object/sign/vendo-documents/document/user/file.docx?token=private' }); if (init?.method === 'POST')
        return Response.json({ Key: 'uploaded' }); return new Response(Buffer.from('%PDF-test'), { headers: { 'content-type': 'application/pdf' } }); };
    const storage = createObjectStorage('https://project.supabase.co', 'service-role-test', 'vendo-public', 'vendo-documents');
    await storage.put('logo/user/id.png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png', false);
    await storage.put('document/user/file.docx', docxFixture(), docxMime, true);
    assert.match(calls[1]!.url, /\/object\/vendo-public\//);
    assert.match(calls[3]!.url, /\/object\/vendo-documents\//);
    const headers = new Headers(calls[1]!.init?.headers);
    assert.equal(headers.get('authorization'), 'Bearer service-role-test');
    assert.equal(headers.get('x-upsert'), 'false');
    assert.match(await storage.signed('document/user/file.docx'), /^https:\/\/project.supabase.co\/storage\/v1\/object\/sign\//);
    assert.equal(JSON.parse(String(calls[5]!.init?.body)).expiresIn, 60);
    assert.match(storage.publicUrl('logo/user/id.png'), /\/object\/public\/vendo-public\//);
    assert.equal((await storage.download('riders/user/id.pdf')).toString(), '%PDF-test');
    expose = true;
    await assert.rejects(() => storage.signed('private.docx'));
    expose = false;
    fail = true;
    await assert.rejects(() => storage.signed('private.docx'), e => e instanceof Error && !e.message.includes('private provider'));
});
