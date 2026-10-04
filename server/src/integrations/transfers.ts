import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import type { TransferGateway } from '../modules/finance/schema.js';
export function createTransferGateway(secret: string): TransferGateway {
    const call = async (path: string, body?: unknown) => { try {
        const r = await fetch(`https://api.paystack.co${path}`, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(8000) });
        if (!r.ok)
            throw new Error('Provider failed');
        return z.object({ status: z.literal(true), data: z.unknown() }).parse(await r.json()).data;
    }
    catch {
        throw new ApiError(503, 'TRANSFER_PROVIDER_UNAVAILABLE', 'Payout processing is temporarily unavailable.');
    } };
    return { configured: true, async resolve(input) { const r = z.object({ account_number: z.string(), account_name: z.string().min(1).max(200) }).safeParse(await call(`/bank/resolve?${new URLSearchParams(input)}`)); if (!r.success || r.data.account_number !== input.account_number)
            throw new ApiError(503, 'INVALID_BANK_RESPONSE', 'Bank verification failed.'); return r.data; }, async recipient(input, name) { const r = z.object({ active: z.literal(true), currency: z.literal('NGN'), domain: z.enum(['test', 'live']), recipient_code: z.string().regex(/^RCP_[A-Za-z0-9]+$/), details: z.object({ account_number: z.string(), bank_code: z.string() }) }).safeParse(await call('/transferrecipient', { type: 'nuban', name, account_number: input.account_number, bank_code: input.bank_code, currency: 'NGN' })); if (!r.success || r.data.details.account_number !== input.account_number || r.data.details.bank_code !== input.bank_code || r.data.domain !== (secret.startsWith('sk_live_') ? 'live' : 'test'))
            throw new ApiError(503, 'INVALID_RECIPIENT_RESPONSE', 'Payout recipient verification failed.'); return r.data.recipient_code; }, async submit(intent) { await call('/transfer', { source: 'balance', amount: intent.amount_kobo, currency: 'NGN', recipient: intent.recipient_code, reference: intent.reference, reason: 'Vendo withdrawal' }); }, async verify(reference) { const r = z.object({ reference: z.string(), amount: z.number().int().positive().max(1000000000), currency: z.literal('NGN'), status: z.string(), domain: z.enum(['test', 'live']), transfer_code: z.string().regex(/^TRF_[A-Za-z0-9]+$/), recipient: z.object({ recipient_code: z.string().regex(/^RCP_[A-Za-z0-9]+$/) }) }).safeParse(await call(`/transfer/verify/${encodeURIComponent(reference)}`)); if (!r.success || r.data.reference !== reference || r.data.domain !== (secret.startsWith('sk_live_') ? 'live' : 'test'))
            throw new ApiError(503, 'INVALID_TRANSFER_RESPONSE', 'Payout verification failed.'); const { recipient, ...rest } = r.data; return { ...rest, recipient_code: recipient.recipient_code }; } };
}
