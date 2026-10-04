import { z } from 'zod';
export const financePolicy = z.strictObject({ enabled: z.boolean(), vendor_commission_bps: z.number().int().min(0).max(10000), rider_delivery_bps: z.number().int().min(0).max(10000), rider_fixed_kobo: z.number().int().min(0).max(100000000), settlement_hold_hours: z.number().int().min(1).max(720), minimum_withdrawal_kobo: z.number().int().min(1).max(1000000000) });
export type FinancePolicy = z.infer<typeof financePolicy>;
export const accountParams = z.object({ kind: z.enum(['rider', 'vendor']), entityId: z.uuid() });
export type AccountKind = 'rider' | 'vendor';
export const earningsSchema = z.object({ id: z.uuid(), kind: z.enum(['rider', 'vendor']), entity_id: z.uuid(), available_kobo: z.number().int(), held_kobo: z.number().int(), currency: z.literal('NGN') });
export type Earnings = z.infer<typeof earningsSchema>;
export const earningsEntry = z.object({ id: z.uuid(), reference: z.string(), kind: z.enum(['earning', 'hold', 'release', 'payout', 'reversal']), available_delta: z.number().int(), held_delta: z.number().int(), available_after: z.number().int(), held_after: z.number().int(), order_id: z.uuid().nullable(), withdrawal_id: z.uuid().nullable(), created_at: z.string() });
export const bankInput = z.strictObject({ bank_code: z.string().regex(/^\d{3,12}$/), account_number: z.string().regex(/^\d{10}$/) });
export type BankInput = z.infer<typeof bankInput>;
export const bankSchema = z.object({ bank_code: z.string(), last_four: z.string(), account_name: z.string(), updated_at: z.string() });
export const withdrawalSchema = z.object({ id: z.uuid(), account_id: z.uuid(), reference: z.string(), amount_kobo: z.number().int(), status: z.enum(['requested', 'approved', 'rejected', 'submitting', 'pending', 'succeeded', 'failed', 'review', 'reversed']), review_note: z.string().nullable(), created_at: z.string(), updated_at: z.string() });
export type Withdrawal = z.infer<typeof withdrawalSchema>;
export type TransferIntent = Withdrawal & {
    recipient_code: string;
    fresh: boolean;
};
export type VerifiedTransfer = {
    reference: string;
    amount: number;
    currency: string;
    status: string;
    domain: 'test' | 'live';
    transfer_code: string;
    recipient_code: string;
};
export interface TransferGateway {
    configured: boolean;
    resolve(input: BankInput): Promise<{
        account_name: string;
        account_number: string;
    }>;
    recipient(input: BankInput, name: string): Promise<string>;
    submit(intent: TransferIntent): Promise<void>;
    verify(reference: string): Promise<VerifiedTransfer>;
}
export interface FinanceRepository {
    savePolicy(actor: string, city: string, input: FinancePolicy): Promise<{
        id: string;
        policy: FinancePolicy;
    }>;
    attachPolicy(actor: string, order: string, policy: string): Promise<void>;
    settle(limit: number): Promise<number>;
    account(actor: string, kind: AccountKind, entity: string): Promise<Earnings>;
    history(actor: string, kind: AccountKind, entity: string, limit: number, offset: number): Promise<z.infer<typeof earningsEntry>[]>;
    bank(actor: string, kind: AccountKind, entity: string): Promise<z.infer<typeof bankSchema> | null>;
    saveBank(actor: string, kind: AccountKind, entity: string, input: BankInput, name: string, recipient: string): Promise<z.infer<typeof bankSchema>>;
    withdraw(actor: string, kind: AccountKind, entity: string, amount: number, key: string): Promise<Withdrawal>;
    withdrawals(actor: string, kind: AccountKind | undefined, entity: string | undefined, limit: number, offset: number): Promise<Withdrawal[]>;
    review(actor: string, id: string, decision: 'approve' | 'reject', note: string): Promise<Withdrawal>;
    claim(): Promise<TransferIntent | null>;
    pending(limit: number): Promise<string[]>;
    apply(reference: string, input: VerifiedTransfer): Promise<void>;
    uncertain(id: string): Promise<void>;
    enqueue(digest: string, event: string, reference: string): Promise<void>;
}
