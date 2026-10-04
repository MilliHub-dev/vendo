import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPairSync, verify, randomUUID } from 'node:crypto';
import { createFcmSender } from '../src/integrations/fcm.js';
import { createBrevoAlertSender, createBrevoWhatsAppSender } from '../src/integrations/brevo.js';
import { readEnv } from '../src/config/env.js';
import type { DeliveryTarget } from '../src/modules/notifications/schema.js';
test('FCM uses signed short-lived OAuth, caches tokens, sets offer TTL and removes only UNREGISTERED devices', async (t) => {
    const original = globalThis.fetch;
    t.after(() => { globalThis.fetch = original; });
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const calls: {
        url: string;
        body: unknown;
    }[] = [];
    let failure: unknown = null, status = 200;
    globalThis.fetch = async (input, init) => {
        const url = String(input);
        if (url === 'https://oauth2.googleapis.com/token') {
            const form = new URLSearchParams(String(init?.body));
            assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
            const assertion = form.get('assertion')!, [header, claims, signature] = assertion.split('.');
            assert.ok(verify('RSA-SHA256', Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature!, 'base64url')));
            const c = JSON.parse(Buffer.from(claims!, 'base64url').toString());
            assert.equal(c.iss, 'test@project.iam.gserviceaccount.com');
            assert.equal(c.scope, 'https://www.googleapis.com/auth/firebase.messaging');
            assert.equal(c.aud, url);
            assert.equal(c.exp - c.iat, 3600);
            calls.push({ url, body: c });
            return new Response(JSON.stringify({ access_token: 'mock-access-token', token_type: 'Bearer', expires_in: 3600 }), { status: 200 });
        }
        assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer mock-access-token');
        calls.push({ url, body: JSON.parse(String(init?.body)) });
        return new Response(JSON.stringify(failure ?? { name: 'projects/test-project/messages/one' }), { status });
    };
    const sender = createFcmSender('test-project', 'test@project.iam.gserviceaccount.com', privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
    const target: DeliveryTarget = { destination: 'fake-registration-token', device_id: randomUUID(), urgent: true, notification: { id: randomUUID(), kind: 'rider_offer', title: 'Delivery offer', body: 'Open Vendo for details.', order_id: randomUUID(), expires_at: new Date(Date.now() + 30000).toISOString(), read_at: null, created_at: new Date().toISOString() } };
    assert.equal(await sender.send(target), 'sent');
    assert.equal(await sender.send(target), 'sent');
    assert.equal(calls.filter(c => c.url.includes('oauth2')).length, 1);
    const payload = calls[1]!.body as {
        message: {
            android: {
                priority: string;
                ttl: string;
                notification: {
                    channel_id: string;
                };
            };
            data: {
                notification_id: string;
            };
        };
    };
    assert.equal(payload.message.android.priority, 'HIGH');
    assert.match(payload.message.android.ttl, /^(29|30)s$/);
    assert.equal(payload.message.data.notification_id, target.notification.id);
    assert.equal(payload.message.android.notification.channel_id, 'rider-offers');
    const web=(calls[1]!.body as {message:{webpush:{headers:{TTL:string;Urgency:string}}}}).message.webpush;assert.match(web.headers.TTL,/^(29|30)$/);assert.equal(web.headers.Urgency,'high');
    assert.equal(await sender.send({...target,notification:{...target.notification,kind:'vendor_order'}}),'sent');assert.equal((calls.at(-1)!.body as {message:{android:{notification?:unknown}}}).message.android.notification,undefined);
    const countBeforeExpiry=calls.length;assert.equal(await sender.send({...target,notification:{...target.notification,expires_at:new Date(Date.now()-1000).toISOString()}}),'expired');assert.equal(calls.length,countBeforeExpiry);
    status = 404;
    failure = { error: { details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }] } };
    assert.equal(await sender.send(target), 'invalid');
    failure = { error: { details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'INVALID_ARGUMENT' }] } };
    await assert.rejects(() => sender.send(target), /Push delivery is temporarily unavailable/);
    failure = { error: { message: 'mock provider secret' } };
    await assert.rejects(() => sender.send(target), e => e instanceof Error && !e.message.includes('secret'));
});
test('Brevo general alerts preserve OTP separation and WhatsApp uses configured approved templates', async (t) => {
    const original = globalThis.fetch;
    t.after(() => { globalThis.fetch = original; });
    const calls: {
        url: string;
        body: Record<string, unknown>;
    }[] = [];
    globalThis.fetch = async (input, init) => { assert.equal(new Headers(init?.headers).get('api-key'), 'mock-key'); calls.push({ url: String(input), body: JSON.parse(String(init?.body)) }); return new Response(JSON.stringify({ messageId: 'mock-message-id' }), { status: 201 }); };
    await createBrevoAlertSender('mock-key', 'Vendo').sendText('+2348144461726', 'Your order status changed. Open Vendo.');
    assert.equal(calls[0]!.body.content, 'Your order status changed. Open Vendo.');
    assert.equal(calls[0]!.body.recipient, '2348144461726');
    assert.equal(calls[0]!.body.type, 'transactional');
    await createBrevoWhatsAppSender('mock-key', '+2348011111111', 123456).sendText('+2348144461726', 'Open Vendo for details.');
    assert.equal(calls[1]!.url, 'https://api.brevo.com/v3/whatsapp/sendMessage');
    assert.deepEqual(calls[1]!.body, { senderNumber: '2348011111111', contactNumbers: ['2348144461726'], templateId: 123456, params: { MESSAGE: 'Open Vendo for details.' } });
    assert.throws(() => readEnv({ FCM_PROJECT_ID: 'test-project' }), /all three/);
    assert.throws(() => readEnv({ BREVO_WHATSAPP_SENDER: '+2348011111111' }), /approved template/);
});
