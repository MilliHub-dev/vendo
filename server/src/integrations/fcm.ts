import { createPrivateKey, sign } from 'node:crypto';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import type { NotificationTransports } from '../modules/notifications/schema.js';
const tokenSchema = z.object({ access_token: z.string().min(1), token_type: z.string(), expires_in: z.number().int().positive() });
export function createFcmSender(project: string, email: string, pem: string): NonNullable<NotificationTransports['push']> {
    const key = createPrivateKey(pem.replaceAll('\\n', '\n'));
    if (key.asymmetricKeyType !== 'rsa')
        throw new Error('FCM_PRIVATE_KEY must be an RSA private key.');
    let cached: {
        token: string;
        expires: number;
    } | undefined, inflight: Promise<string> | undefined;
    async function accessToken() {
        if (cached && cached.expires > Date.now() + 120000)
            return cached.token;
        if (inflight)
            return inflight;
        inflight = (async () => {
            const now = Math.floor(Date.now() / 1000), header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url'), claims = Buffer.from(JSON.stringify({ iss: email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })).toString('base64url'), unsigned = `${header}.${claims}`, assertion = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`;
            const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', signal: AbortSignal.timeout(5000), headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
            const token = tokenSchema.parse(await response.json());
            if (!response.ok || token.token_type.toLowerCase() !== 'bearer')
                throw new Error('OAuth rejected');
            cached = { token: token.access_token, expires: Date.now() + token.expires_in * 1000 };
            return token.access_token;
        })();
        try {
            return await inflight;
        }
        finally {
            inflight = undefined;
        }
    }
    return { async send(target) {
            try {
                const token = await accessToken(), n = target.notification;
                const ttl = n.expires_at ? Math.max(0, Math.floor((Date.parse(n.expires_at) - Date.now()) / 1000)) : 86400;
                if (n.expires_at && ttl === 0)
                    return 'expired';
                const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`, { method: 'POST', signal: AbortSignal.timeout(5000), headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ message: { token: target.destination, notification: { title: n.title, body: n.body }, data: { notification_id: n.id, ...(n.order_id ? { order_id: n.order_id } : {}) }, android: { priority: target.urgent ? 'HIGH' : 'NORMAL', ttl: `${ttl}s`, ...(target.urgent && n.kind==='rider_offer' ? { notification: { channel_id: 'rider-offers' } } : {}) }, webpush:{headers:{TTL:String(ttl),Urgency:target.urgent?'high':'normal'}}, apns: { headers: { 'apns-expiration': String(Math.floor(Date.now() / 1000) + ttl), 'apns-priority': target.urgent ? '10' : '5' } } } }) });
                const payload: unknown = await response.json();
                if (response.ok && z.object({ name: z.string().min(1) }).safeParse(payload).success)
                    return 'sent';
                const failure = z.object({ error: z.object({ details: z.array(z.object({ '@type': z.string(), errorCode: z.string().optional() })).optional() }) }).safeParse(payload);
                if (failure.success && failure.data.error.details?.some(d => d['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError' && d.errorCode === 'UNREGISTERED'))
                    return 'invalid';
                if (response.status === 401)
                    cached = undefined;
                throw new Error('Push rejected');
            }
            catch {
                throw new ApiError(503, 'PUSH_UNAVAILABLE', 'Push delivery is temporarily unavailable.');
            }
        } };
}
