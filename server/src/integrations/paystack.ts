import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { channels, type PaymentGateway } from '../modules/payments/schema.js';
const id = z.union([z.string().regex(/^\d+$/),z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).transform(String)]);
const verified = z.object({id,reference:z.string(),status:z.string(),amount:z.number().int().nonnegative().max(1000000000),currency:z.string(),domain:z.enum(['test','live']),channel:z.string(),customer:z.object({email:z.email()}),metadata:z.preprocess((value)=>{if(typeof value==='string'){try{return JSON.parse(value) as unknown;}catch{return value;}}return value;},z.object({payment_id:z.uuid(),customer_id:z.uuid(),order_id:z.uuid().nullable(),purpose:z.string()}))});
export function createPaystackGateway(secret:string,callbackUrl?:string):PaymentGateway {
  const request = async(path:string,body?:unknown):Promise<unknown>=>{
    try {
      const response=await fetch(`https://api.paystack.co${path}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000),redirect:'error'});
      if(!response.ok) throw new Error('Provider unavailable');
      const result=z.object({status:z.literal(true),data:z.unknown()}).parse(await response.json());
      return result.data;
    } catch {throw new ApiError(503,'PAYMENT_PROVIDER_UNAVAILABLE','Payment verification is temporarily unavailable. Retry verification using the same reference.');}
  };
  return {
    async initialize(intent) {
      const result=await request('/transaction/initialize',{reference:intent.reference,email:intent.email,amount:String(intent.amount_kobo),currency:'NGN',channels:[channels[intent.method]],metadata:JSON.stringify({payment_id:intent.id,customer_id:intent.customer_id,order_id:intent.order_id,purpose:intent.purpose}),...(callbackUrl?{callback_url:callbackUrl}:{})});
      const parsed=z.object({reference:z.string(),access_code:z.string().min(1),authorization_url:z.url().refine((url)=>new URL(url).protocol==='https:')}).safeParse(result);
      if(!parsed.success||parsed.data.reference!==intent.reference) throw new ApiError(503,'INVALID_PAYMENT_RESPONSE','The provider returned an invalid checkout. Verify the existing reference before retrying.');
      return parsed.data;
    },
    async verifyRefund(refundId) {
      const parsed=z.object({id,transaction:z.union([id,z.object({id}).transform((value)=>value.id)]),amount:z.number().int().nonnegative().max(1000000000),currency:z.string(),domain:z.enum(['test','live']),status:z.string()}).safeParse(await request(`/refund/${encodeURIComponent(refundId)}`));
      if(!parsed.success || parsed.data.id!==refundId || parsed.data.domain!==(secret.startsWith('sk_live_')?'live':'test'))throw new ApiError(503,'INVALID_REFUND_RESPONSE','The provider returned an invalid refund response.');
      return parsed.data;
    },
    async verify(reference) {
      const parsed=verified.safeParse(await request(`/transaction/verify/${encodeURIComponent(reference)}`));
      if(!parsed.success) throw new ApiError(503,'INVALID_PAYMENT_RESPONSE','The provider returned an invalid verification response.');
      if(parsed.data.domain!==(secret.startsWith('sk_live_')?'live':'test')) throw new ApiError(503,'PAYMENT_MODE_MISMATCH','Payment environment does not match the configured provider.');
      return parsed.data;
    },
  };
}
