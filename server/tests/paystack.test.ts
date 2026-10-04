import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createPaystackGateway } from '../src/integrations/paystack.js';
import { readEnv } from '../src/config/env.js';
import type { Intent } from '../src/modules/payments/schema.js';
const makeIntent=():Intent=>({id:randomUUID(),reference:`VD-P-${randomUUID()}`,purpose:'top_up',order_id:null,method:'transfer',amount_kobo:100000,currency:'NGN',status:'initializing',authorization_url:null,access_code:null,created_at:new Date().toISOString(),verified_at:null,customer_id:randomUUID(),email:'alice@example.com',idempotency_key:'test_payment_key'});
test('Paystack transport: server amounts/channels/metadata and minimal verified transaction/refund records',async(t)=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  const intent=makeIntent(),requests:{url:string;init:RequestInit|undefined}[]=[];
  globalThis.fetch=async(input,init)=>{
    const url=String(input);requests.push({url,init});
    const data=url.endsWith('/initialize')?{reference:intent.reference,authorization_url:'https://checkout.paystack.com/example',access_code:'test_access'}:url.includes('/refund/')?{id:42,transaction:123,amount:100000,currency:'NGN',domain:'test',status:'processed'}:{id:123,reference:intent.reference,status:'success',amount:100000,currency:'NGN',domain:'test',channel:'bank_transfer',customer:{email:intent.email},metadata:{payment_id:intent.id,customer_id:intent.customer_id,order_id:null,purpose:'top_up'},authorization:{authorization_code:'AUTH_private'}};
    return Response.json({status:true,data});
  };
  const gateway=createPaystackGateway('sk_test_example','https://vendo.example/payment-return');
  await gateway.initialize(intent);
  const body=JSON.parse(String(requests[0]!.init?.body));assert.equal(body.amount,'100000');assert.deepEqual(body.channels,['bank_transfer']);assert.equal(body.email,intent.email);assert.equal(body.callback_url,'https://vendo.example/payment-return');assert.equal(JSON.parse(body.metadata).payment_id,intent.id);
  assert.equal((requests[0]!.init?.headers as Record<string,string>).authorization,'Bearer sk_test_example');
  const paid=await gateway.verify(intent.reference);assert.equal(paid.id,'123');assert.equal('authorization' in paid,false);assert.equal(paid.reference,intent.reference);
  assert.equal(requests[1]!.url,`https://api.paystack.co/transaction/verify/${intent.reference}`);
  const refund=await gateway.verifyRefund('42');assert.equal(refund.transaction,'123');assert.equal(refund.status,'processed');
});
test('Paystack rejects HTTP errors, redirect/invalid checkout, unsafe IDs and environment mismatch without leaking secrets',async(t)=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});const intent=makeIntent(),gateway=createPaystackGateway('sk_test_secret');
  globalThis.fetch=async()=>Response.json({message:'sk_test_secret provider details'},{status:500});
  await assert.rejects(()=>gateway.initialize(intent),(error:Error)=>!error.message.includes('sk_test_secret')&&error.message.includes('temporarily unavailable'));
  globalThis.fetch=async()=>Response.json({status:true,data:{reference:'other',authorization_url:'http://checkout.example',access_code:'code'}});
  await assert.rejects(()=>gateway.initialize(intent),/invalid checkout/);
  const data={id:12,reference:intent.reference,status:'success',amount:100000,currency:'NGN',domain:'live',channel:'bank_transfer',customer:{email:intent.email},metadata:{payment_id:intent.id,customer_id:intent.customer_id,order_id:null,purpose:'top_up'}};
  globalThis.fetch=async()=>Response.json({status:true,data});await assert.rejects(()=>gateway.verify(intent.reference),/environment/);
  globalThis.fetch=async()=>Response.json({status:true,data:{...data,domain:'test',id:Number.MAX_SAFE_INTEGER+1}});await assert.rejects(()=>gateway.verify(intent.reference),/invalid verification/);
  globalThis.fetch=async()=>Response.json({status:true,data:{...data,domain:'test',metadata:'not JSON'}});await assert.rejects(()=>gateway.verify(intent.reference),/invalid verification/);
  globalThis.fetch=async()=>Response.json({status:true,data:{id:43,transaction:12,currency:'NGN',amount:1,domain:'test',status:'processed'}});await assert.rejects(()=>gateway.verifyRefund('42'),/invalid refund/);
});
test('Paystack settings keep secrets optional and callbacks HTTPS-only',()=>{
  assert.equal(readEnv({NODE_ENV:'test',PAYSTACK_SECRET_KEY:''}).PAYSTACK_SECRET_KEY,undefined);
  assert.throws(()=>readEnv({NODE_ENV:'test',PAYSTACK_SECRET_KEY:'pk_test_example'}),/PAYSTACK_SECRET_KEY/);
  assert.throws(()=>readEnv({NODE_ENV:'test',PAYSTACK_CALLBACK_URL:'http://example.com'}),/PAYSTACK_CALLBACK_URL/);
  assert.throws(()=>readEnv({NODE_ENV:'test',PAYSTACK_CALLBACK_URL:'https://user:pass@example.com'}),/PAYSTACK_CALLBACK_URL/);
});
