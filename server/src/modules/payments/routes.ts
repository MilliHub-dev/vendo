import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiError, errorResponses } from '../../lib/errors.js';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import { requireCompleteProfile, type ProfileService } from '../users/service.js';
import { anyOrderSchema } from '../orders/schema.js';
import { ledgerSchema, methodSchema, paymentSchema, walletSchema, type PaymentRepository } from './schema.js';
import type {FinanceRepository} from '../finance/schema.js';
import type { PaymentService } from './service.js';
export function registerPaymentRoutes(app:FastifyInstance,auth:AuthGateway,profiles:ProfileService,repository:PaymentRepository,service:PaymentService) {
  const api=app.withTypeProvider<ZodTypeProvider>();
  const secured={tags:['Payments & wallet'],security:[{bearerAuth:[]}]};
  const identity=async(request:FastifyRequest)=>{const user=await authenticate(request,auth);requireCompleteProfile(await profiles.get(user));return user;};
  const key=z.object({'idempotency-key':z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/)});
  const reference=z.object({reference:z.string().regex(/^VD-P-[0-9a-f-]{36}$/)});
  api.post('/v1/payments/orders', {config:{rateLimit:{max:20,timeWindow:'1 minute'}},schema:{...secured,headers:key,body:z.strictObject({order_id:z.uuid()}),response:{200:paymentSchema,...errorResponses}}},async(request)=>service.initialize((await identity(request)).id,request.headers['idempotency-key'],request.body));
  api.post('/v1/wallet/top-ups', {config:{rateLimit:{max:10,timeWindow:'1 minute'}},schema:{...secured,headers:key,body:z.strictObject({amount_kobo:z.number().int().min(1).max(1000000000),method:methodSchema}),response:{200:paymentSchema,...errorResponses}}},async(request)=>service.initialize((await identity(request)).id,request.headers['idempotency-key'],request.body));
  api.get('/v1/payments/:reference', {schema:{...secured,params:reference,response:{200:paymentSchema,...errorResponses}}},async(request)=>{const saved=await repository.find(request.params.reference,(await identity(request)).id);if(!saved)throw new ApiError(404,'PAYMENT_NOT_FOUND','Payment not found.');return paymentSchema.parse(saved);});
  api.post('/v1/payments/:reference/verify', {config:{rateLimit:{max:20,timeWindow:'1 minute'}},schema:{...secured,params:reference,response:{200:paymentSchema,...errorResponses}}},async(request)=>service.verify(request.params.reference,(await identity(request)).id));
  api.get('/v1/wallet', {schema:{...secured,response:{200:walletSchema,...errorResponses}}},async(request)=>repository.wallet((await identity(request)).id));
  api.get('/v1/wallet/transactions', {schema:{...secured,querystring:z.strictObject({limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).max(10000).default(0)}),response:{200:z.object({items:z.array(ledgerSchema),limit:z.number(),offset:z.number()}),...errorResponses}}},async(request)=>({items:await repository.history((await identity(request)).id,request.query.limit,request.query.offset),...request.query}));
  api.post('/v1/admin/refunds/:id/reconcile', {schema:{...secured,params:z.object({id:z.uuid()}),body:z.strictObject({provider_refund_id:z.string().regex(/^[0-9]{1,20}$/)}),response:{200:z.object({status:z.enum(['pending','processed'])}),...errorResponses}}},async(request)=>{const user=await authenticate(request,auth);if((await profiles.get(user)).role!=='admin')throw new ApiError(403,'ADMIN_REQUIRED','Administrator access is required.');return service.reconcileRefund(user.id,request.params.id,request.body.provider_refund_id);});
  // The order ID itself is the debit's idempotency reference.
  api.post('/v1/orders/:id/pay/wallet', {config:{rateLimit:{max:20,timeWindow:'1 minute'}},schema:{...secured,params:z.object({id:z.uuid()}),response:{200:anyOrderSchema,...errorResponses}}},async(request)=>repository.checkout((await identity(request)).id,request.params.id));
}
export async function registerPaystackHook(app:FastifyInstance,secret:string|undefined,repository:PaymentRepository,finance?:FinanceRepository) {
  await app.register(async(scope)=>{
    scope.removeContentTypeParser('application/json');
    scope.addContentTypeParser('application/json',{parseAs:'buffer',bodyLimit:128*1024},(_request,body,done)=>done(null,body));
    scope.post('/v1/hooks/paystack',{bodyLimit:128*1024,config:{rateLimit:{max:300,timeWindow:'1 minute'}},schema:{tags:['Payment hooks'],summary:'Signed Paystack webhook; saves payment and transfer events for durable verification.'}},async(request)=>{
      if(!secret)throw new ApiError(503,'PAYMENTS_NOT_CONFIGURED','Payments are not configured.');
      const raw=request.body as Buffer,signature=request.headers['x-paystack-signature'];
      if(typeof signature!=='string'||! /^[0-9a-f]{128}$/i.test(signature)||!timingSafeEqual(createHmac('sha512',secret).update(raw).digest(),Buffer.from(signature,'hex')))throw new ApiError(401,'INVALID_HOOK_SIGNATURE','Invalid hook signature.');
      let body:unknown;try{body=JSON.parse(raw.toString('utf8')) as unknown;}catch{throw new ApiError(400,'INVALID_HOOK_PAYLOAD','Invalid payment hook payload.');}
      const parsed=z.object({event:z.string(),data:z.unknown()}).safeParse(body);
      if(!parsed.success)throw new ApiError(400,'INVALID_HOOK_PAYLOAD','Invalid payment hook payload.');
      if(parsed.data.event==='charge.success') {
        const charge=z.object({reference:z.string().max(100)}).safeParse(parsed.data.data);
        if(!charge.success)throw new ApiError(400,'INVALID_HOOK_PAYLOAD','Invalid payment reference.');
        if(await repository.find(charge.data.reference))await repository.enqueue(createHash('sha256').update(raw).digest('hex'),parsed.data.event,charge.data.reference);
      }
      if(['transfer.success','transfer.failed','transfer.reversed'].includes(parsed.data.event)&&finance){
        const transfer=z.object({reference:z.string().regex(/^vd-w-[0-9a-f-]{36}$/)}).safeParse(parsed.data.data);
        if(!transfer.success)throw new ApiError(400,'INVALID_HOOK_PAYLOAD','Invalid transfer reference.');
        await finance.enqueue(createHash('sha256').update(raw).digest('hex'),parsed.data.event,transfer.data.reference);
      }
      // No card authorization, account details or complete payload stored/logged.
      return {received:true};
    });
  });
}
