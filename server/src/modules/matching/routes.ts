import { Readable } from 'node:stream';
import { setTimeout } from 'node:timers/promises';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiError, errorResponses } from '../../lib/errors.js';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import { requireCompleteProfile, type ProfileService } from '../users/service.js';
import { anyOrderSchema } from '../orders/schema.js';
import { locationInputSchema, locationSchema, matchingPolicySchema, offerSchema, riderInputSchema, riderSchema, trackingSchema, type MatchingRepository } from './schema.js';
import { TrackingService } from './service.js';
export function registerMatchingRoutes(app:FastifyInstance,auth:AuthGateway,profiles:ProfileService,repository:MatchingRepository,tracking:TrackingService) {
  const api=app.withTypeProvider<ZodTypeProvider>();
  const secured={tags:['Rider matching & tracking'],security:[{bearerAuth:[]}]},params=z.object({id:z.uuid()});
  const identity=async(request:FastifyRequest)=>{const user=await authenticate(request,auth);requireCompleteProfile(await profiles.get(user));return user;};
  api.post('/v1/riders/register',{schema:{...secured,body:riderInputSchema,response:{200:riderSchema,...errorResponses}}},async(request)=>repository.register((await identity(request)).id,request.body));
  api.get('/v1/riders/me',{schema:{...secured,response:{200:riderSchema.nullable(),...errorResponses}}},async(request)=>repository.rider((await identity(request)).id));
  api.post('/v1/admin/riders/:id/review',{schema:{...secured,params,body:z.strictObject({approval:z.enum(['approved','rejected','suspended']),note:z.string().trim().min(5).max(1000)}),response:{200:riderSchema,...errorResponses}}},async(request)=>repository.review((await identity(request)).id,request.params.id,request.body.approval,request.body.note));
  api.put('/v1/admin/cities/:id/matching-policy',{schema:{...secured,params,body:matchingPolicySchema,response:{200:matchingPolicySchema,...errorResponses}}},async(request)=>repository.savePolicy((await identity(request)).id,request.params.id,request.body));
  api.post('/v1/riders/me/presence',{schema:{...secured,body:z.strictObject({online:z.boolean()}),response:{200:riderSchema,...errorResponses}}},async(request)=>repository.presence((await identity(request)).id,request.body.online));
  api.post('/v1/riders/me/location',{config:{rateLimit:{max:30,timeWindow:'1 minute'}},schema:{...secured,body:locationInputSchema,response:{200:locationSchema,...errorResponses}}},async(request)=>repository.locate((await identity(request)).id,request.body));
  api.get('/v1/riders/me/offers/current',{schema:{...secured,response:{200:offerSchema.nullable(),...errorResponses}}},async(request)=>repository.currentOffer((await identity(request)).id));
  api.post('/v1/riders/offers/:id/respond',{schema:{...secured,params,body:z.strictObject({action:z.enum(['accept','reject'])}),response:{200:offerSchema,...errorResponses}}},async(request)=>repository.respond((await identity(request)).id,request.params.id,request.body.action));
  api.get('/v1/riders/me/job',{schema:{...secured,response:{200:anyOrderSchema.nullable(),...errorResponses}}},async(request)=>repository.job((await identity(request)).id));
  api.get('/v1/orders/:id/tracking',{schema:{...secured,params,querystring:z.strictObject({include_route:z.enum(['true','false']).default('true').transform(value=>value==='true')}),response:{200:trackingSchema,...errorResponses}}},async(request)=>tracking.get((await identity(request)).id,request.params.id,request.query.include_route));
  api.post('/v1/orders/:id/matching/retry',{config:{rateLimit:{max:5,timeWindow:'1 minute'}},schema:{...secured,params,response:{200:z.object({ok:z.literal(true)}),...errorResponses}}},async(request)=>{await repository.retry((await identity(request)).id,request.params.id);return {ok:true as const};});
  api.post('/v1/orders/:id/matching/cancel',{schema:{...secured,params,response:{200:anyOrderSchema,...errorResponses}}},async(request)=>repository.cancelSearch((await identity(request)).id,request.params.id));
  api.get('/v1/admin/matching/queue',{schema:{...secured,querystring:z.strictObject({city_id:z.uuid(),limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).max(10000).default(0)}),response:{200:z.object({items:z.array(z.object({order_id:z.uuid(),reason:z.string().nullable(),started_at:z.string()})),limit:z.number(),offset:z.number()}),...errorResponses}}},async(request)=>({items:await repository.queue((await identity(request)).id,request.query.city_id,request.query.limit,request.query.offset),limit:request.query.limit,offset:request.query.offset}));

  const streams=new Set<AbortController>();
  const userStreams=new Map<string,number>();
  app.addHook('preClose',async()=>{for(const controller of streams)controller.abort();});
  api.get('/v1/orders/:id/tracking/stream',{schema:{...secured,params,description:'Authenticated SSE snapshots every five seconds. Authorization is rechecked per snapshot; GPS/contacts disappear after completion. Use tracking GET for road ETA. Last-Event-ID is a hint: reconnect always starts with a full current snapshot.'}},async(request,reply)=>{
    const user=await identity(request);
    if((userStreams.get(user.id)??0)>=2||streams.size>=200)throw new ApiError(429,'TRACKING_STREAM_LIMIT','Close an existing tracking stream before opening another.');
    const first=await repository.tracking(user.id,request.params.id);
    // Recheck after the snapshot await so concurrent opens cannot bypass caps.
    if((userStreams.get(user.id)??0)>=2||streams.size>=200)throw new ApiError(429,'TRACKING_STREAM_LIMIT','Close an existing tracking stream before opening another.');
    const controller=new AbortController();streams.add(controller);
    userStreams.set(user.id,(userStreams.get(user.id)??0)+1);
    let closed=false;
    const close=()=>{if(closed)return;closed=true;controller.abort();streams.delete(controller);const count=(userStreams.get(user.id)??1)-1;if(count)userStreams.set(user.id,count);else userStreams.delete(user.id);};reply.raw.once('close',close);
    const stream=Readable.from((async function*(){
      let snapshot=first;
      try {
        while(!controller.signal.aborted) {
          yield `id: ${snapshot.location?.captured_at??snapshot.status}\nevent: tracking\ndata: ${JSON.stringify(snapshot)}\n\n`;
          if(['delivered','cancelled','disputed'].includes(snapshot.status))break;
          await setTimeout(5000,undefined,{signal:controller.signal});
          await identity(request);
          snapshot=await repository.tracking(user.id,request.params.id);
        }
      } catch { /* Revocation, disconnection and database outage close the stream. */ }
      finally {close();}
    })());
    return reply.header('content-type','text/event-stream').header('cache-control','no-store').header('x-accel-buffering','no').send(stream);
  });
}
