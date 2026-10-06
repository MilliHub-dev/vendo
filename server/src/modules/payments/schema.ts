import { z } from 'zod';
import type { AnyOrder } from '../orders/schema.js';
export const methodSchema = z.enum(['card','transfer','ussd']);
export type PaymentMethod = z.infer<typeof methodSchema>;
export const paymentSchema = z.object({ id:z.uuid(), reference:z.string(), purpose:z.enum(['order','top_up']), order_id:z.uuid().nullable(), method:methodSchema, amount_kobo:z.number().int(), currency:z.literal('NGN'), status:z.enum(['initializing','pending','succeeded','review']), authorization_url:z.url().nullable(), access_code:z.string().nullable(), created_at:z.string(), verified_at:z.string().nullable() });
export type Payment = z.infer<typeof paymentSchema>;
export type Intent = Payment & { customer_id:string; email:string; idempotency_key:string };
export const walletSchema = z.object({ currency:z.literal('NGN'), balance_kobo:z.number().int().nonnegative(), updated_at:z.string().nullable() });
export type Wallet = z.infer<typeof walletSchema>;
export const ledgerSchema = z.object({ id:z.uuid(), kind:z.enum(['top_up','checkout','refund','referral','adjustment']), reference:z.string(), amount_kobo:z.number().int(), balance_after_kobo:z.number().int(), order_id:z.uuid().nullable(), payment_id:z.uuid().nullable(), created_at:z.string() });
export type LedgerEntry = z.infer<typeof ledgerSchema>;
export interface PaymentRepository {
  prepare(userId:string,key:string,input:{order_id:string}|{amount_kobo:number;method:PaymentMethod}):Promise<{intent:Intent;fresh:boolean}>;
  initialized(id:string,result:{reference:string;authorization_url:string;access_code:string}):Promise<Payment>;
  review(id:string,reason:string):Promise<void>;
  find(reference:string,userId?:string):Promise<Intent|null>;
  apply(reference:string,transaction:VerifiedTransaction):Promise<Payment>;
  wallet(userId:string):Promise<Wallet>;
  history(userId:string,limit:number,offset:number):Promise<LedgerEntry[]>;
  checkout(userId:string,orderId:string):Promise<AnyOrder>;
  enqueue(digest:string,event:string,reference:string):Promise<void>;
  pending(limit:number):Promise<string[]>;
  finishEvents(reference:string):Promise<void>;
  refundWallets(limit:number):Promise<number>;
  reconcileRefund(actorId:string,id:string,data:VerifiedRefund):Promise<{status: 'pending'|'processed'}>;
}
export interface VerifiedTransaction {
  id:string; reference:string; status:string; amount:number; currency:string; domain:'test'|'live'; channel:string;
  customer:{email:string}; metadata:{payment_id:string;customer_id:string;order_id:string|null;purpose:string};
}
export interface VerifiedRefund { id:string; transaction:string; amount:number; currency:string; domain:'test'|'live'; status:string }
export interface PaymentGateway {
  configured?:boolean;
  initialize(intent:Intent):Promise<{reference:string;authorization_url:string;access_code:string}>;
  verify(reference:string):Promise<VerifiedTransaction>;
  verifyRefund(id:string):Promise<VerifiedRefund>;
}
export const channels:Record<PaymentMethod,string> = {card:'card',transfer:'bank_transfer',ussd:'ussd'};
