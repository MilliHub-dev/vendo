import { broadcastInput,type AdminBroadcasts } from './broadcasts.js';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiError,errorResponses } from '../../lib/errors.js';
import { authenticate } from '../auth/routes.js';
import type { AuthGateway } from '../auth/schema.js';
import type { ProfileService } from '../users/service.js';
import { resources,type AdminPortalRepository } from './repository.js';
export function registerAdminPortalRoutes(app:FastifyInstance,auth:AuthGateway,profiles:ProfileService,repo?:AdminPortalRepository,broadcasts?:AdminBroadcasts) {
 const api=app.withTypeProvider<ZodTypeProvider>();
 const user=async(r:Parameters<typeof authenticate>[0])=>{const identity=await authenticate(r,auth);const p=await profiles.get(identity);if(p.role!=='admin')throw new ApiError(403,'ADMIN_REQUIRED','Administrator access is required.');return p;};
 const repository=()=>{if(!repo)throw new ApiError(503,'DATABASE_UNAVAILABLE','Admin data is temporarily unavailable.');return repo;};
 const shared={tags:['Admin portal'],security:[{bearerAuth:[]}]};
 const row=z.record(z.string(),z.unknown());
 const campaigns=()=>{if(!broadcasts)throw new ApiError(503,'DATABASE_UNAVAILABLE','Campaigns are temporarily unavailable.');return broadcasts;};
 api.get('/v1/admin/broadcasts',{schema:{...shared,querystring:z.strictObject({limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).max(10000).default(0)}),response:{200:z.array(row),...errorResponses}}},async r=>{const p=await user(r);return campaigns().list(p.id,r.query.limit,r.query.offset);});
 api.post('/v1/admin/broadcasts/count',{schema:{...shared,body:broadcastInput.pick({audience:true,city_ids:true}),response:{200:z.object({recipients:z.number()}),...errorResponses}}},async r=>{const p=await user(r);return {recipients:await campaigns().count(p.id,r.body.audience,r.body.city_ids)};});
 api.post('/v1/admin/broadcasts',{schema:{...shared,headers:z.object({'idempotency-key':z.string().regex(/^[A-Za-z0-9_-]{8,100}$/)}),body:broadcastInput,response:{202:row,...errorResponses}}},async(r,p)=>{const u=await user(r);return p.code(202).send(await campaigns().send(u.id,r.body,r.headers['idempotency-key']));});
 api.post('/v1/admin/broadcasts/:id/cancel',{schema:{...shared,params:z.object({id:z.uuid()}),response:{200:z.object({ok:z.boolean()}),...errorResponses}}},async r=>{const p=await user(r);return campaigns().cancel(p.id,r.params.id);});
 api.get('/v1/admin/me' ,{schema:{...shared,response:{200:z.object({id:z.uuid(),name:z.string().nullable(),email:z.string().nullable(),role:z.literal('admin')}),...errorResponses}}},async r=>{const p=await user(r);return {id:p.id,name:p.name,email:p.email,role:'admin' as const};});
 api.get('/v1/admin/portal/overview',{schema:{...shared,response:{200:row,...errorResponses}}},async r=>{const p=await user(r);return repository().overview(p.id);});
 api.get('/v1/admin/portal/data/:resource',{schema:{...shared,params:z.object({resource:z.enum(resources)}),querystring:z.strictObject({limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).max(10000).default(0),id:z.uuid().optional()}),response:{200:z.object({items:z.array(row),limit:z.number(),offset:z.number()}),...errorResponses}}},async r=>{const p=await user(r);return {items:await repository().list(p.id,r.params.resource,r.query.limit,r.query.offset,r.query.id),limit:r.query.limit,offset:r.query.offset};});
 api.post('/v1/admin/balances/adjust',{schema:{...shared,headers:z.object({'idempotency-key':z.string().regex(/^[A-Za-z0-9_-]{8,100}$/)}),body:z.strictObject({kind:z.enum(['customer','rider']),id:z.uuid(),amount_kobo:z.number().int().min(-1000000000).max(1000000000).refine(v=>v!==0),reason:z.string().trim().min(10).max(1000)}),response:{200:z.object({ok:z.literal(true)}),...errorResponses}}},async r=>{const p=await user(r);return repository().adjust(p.id,r.body,r.headers['idempotency-key']);});
 api.post('/v1/admin/vendors/:id/status',{schema:{...shared,params:z.object({id:z.uuid()}),body:z.strictObject({is_active:z.boolean(),reason:z.string().trim().min(10).max(1000)}),response:{200:z.object({ok:z.literal(true)}),...errorResponses}}},async r=>{const p=await user(r);return repository().vendorStatus(p.id,r.params.id,r.body.is_active,r.body.reason);});
}
