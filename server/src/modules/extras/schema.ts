import { z } from 'zod';
export const page = z.strictObject({ limit: z.coerce.number().int().min(1).max(50).default(20), offset: z.coerce.number().int().min(0).max(10000).default(0) });
export const idParams = z.object({ id: z.uuid() });
export const promoCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/);
export const promoInput = z.strictObject({ code: promoCode, active: z.boolean(), starts_at: z.iso.datetime({ offset: true }), ends_at: z.iso.datetime({ offset: true }), scope: z.enum(['all', 'food', 'dispatch']), city_id: z.uuid().nullable(), vendor_id: z.uuid().nullable(), basis: z.enum(['delivery', 'food_subtotal']), kind: z.enum(['fixed', 'percent']), value: z.number().int().positive().max(1000000000), max_discount_kobo: z.number().int().positive().max(1000000000), minimum_total_kobo: z.number().int().nonnegative().max(1000000000), max_uses: z.number().int().min(1).max(1000000), per_customer_limit: z.number().int().min(1).max(1000) })
    .refine(v => Date.parse(v.ends_at) > Date.parse(v.starts_at), 'Invalid dates.').refine(v => v.kind !== 'percent' || v.value <= 10000, 'Percent value is basis points.').refine(v => (!v.vendor_id && v.basis !== 'food_subtotal') || v.scope === 'food', 'Food restrictions require food scope.');
export type PromoInput = z.infer<typeof promoInput>;
export const promoOutput = promoInput.extend({ id: z.uuid(), used_count: z.number().int() });
export const referralPolicy = z.strictObject({ enabled: z.boolean(), referrer_reward_kobo: z.number().int().min(1).max(100000000), referee_reward_kobo: z.number().int().min(1).max(100000000), minimum_order_kobo: z.number().int().min(1).max(1000000000), hold_days: z.number().int().min(1).max(90), expiry_days: z.number().int().min(1).max(365), referrer_cap: z.number().int().min(1).max(1000) }).refine(v => v.expiry_days > v.hold_days, 'Expiry must allow the reward waiting period.');
export type ReferralPolicy = z.infer<typeof referralPolicy>;
export const referralOverview = z.object({ code: promoCode, enabled: z.boolean(), pending: z.number().int(), rewarded: z.number().int(), earned_kobo: z.number().int(), applied: z.boolean() });
export const ticketInput = z.strictObject({ subject: z.string().trim().min(3).max(150), message: z.string().trim().min(10).max(3000), category: z.enum(['order', 'payment', 'account', 'other']), order_id: z.uuid().nullable().default(null) });
export type TicketInput = z.infer<typeof ticketInput>;
export const ticketSchema = z.object({ id: z.uuid(), subject: z.string(), category: z.string(), order_id: z.uuid().nullable(), status: z.enum(['open', 'resolved']), created_at: z.string(), updated_at: z.string() });
export const replyInput = z.strictObject({ message: z.string().trim().min(1).max(3000) });
export const messageSchema = z.object({ id: z.uuid(), message: z.string(), from_support: z.boolean(), created_at: z.string() });
export const legalSlug = z.enum(['terms', 'privacy', 'refund']);
export const legalInput = z.strictObject({ slug: legalSlug, version: z.string().trim().regex(/^[A-Za-z0-9._-]{1,40}$/), title: z.string().trim().min(3).max(150), content: z.string().trim().min(20).max(20000) });
export type LegalInput = z.infer<typeof legalInput>;
export const legalSchema = legalInput.extend({ id: z.uuid(), published_at: z.string() });
export interface ExtrasRepository {
    savePromo(actor: string, input: PromoInput, id?: string): Promise<z.infer<typeof promoOutput>>;
    promos(actor: string): Promise<z.infer<typeof promoOutput>[]>;
    setReferralPolicy(actor: string, input: ReferralPolicy): Promise<ReferralPolicy>;
    referrals(user: string): Promise<z.infer<typeof referralOverview>>;
    applyReferral(user: string, code: string): Promise<void>;
    rewardReferrals(limit: number): Promise<number>;
    createTicket(user: string, input: TicketInput, key: string): Promise<z.infer<typeof ticketSchema>>;
    tickets(user: string, admin: boolean, limit: number, offset: number): Promise<z.infer<typeof ticketSchema>[]>;
    ticket(user: string, id: string, admin: boolean): Promise<{
        ticket: z.infer<typeof ticketSchema>;
        messages: z.infer<typeof messageSchema>[];
    }>;
    reply(user: string, id: string, message: string, admin: boolean): Promise<void>;
    resolve(user: string, id: string): Promise<void>;
    publishLegal(actor: string, input: LegalInput): Promise<z.infer<typeof legalSchema>>;
    legal(slug?: z.infer<typeof legalSlug>): Promise<z.infer<typeof legalSchema>[]>;
    acceptLegal(user: string, id: string): Promise<void>;
}
