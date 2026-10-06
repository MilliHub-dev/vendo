import type pg from 'pg';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { actor,audit,serialize,transaction } from '../../lib/postgres.js';
import { ApiError } from '../../lib/errors.js';
export const broadcastInput=z.strictObject({audience:z.enum(['customers','riders','vendors']),city_ids:z.array(z.uuid()).min(1).max(100).refine(v=>new Set(v).size===v.length),title:z.string().trim().min(1).max(120),body:z.string().trim().min(1).max(1000),send_at:z.iso.datetime({offset:true}).optional()});
export type BroadcastInput=z.infer<typeof broadcastInput>;
const audienceSql=`SELECT p.id FROM public.profiles p LEFT JOIN public.account_preferences prefs ON prefs.profile_id=p.id
 WHERE p.status='active' AND COALESCE(prefs.push_enabled,true) AND EXISTS(SELECT 1 FROM vendo_internal.devices d WHERE d.profile_id=p.id)
 AND (($1='customers' AND p.role='customer' AND p.city_id=ANY($2::uuid[])) OR
 ($1='riders' AND p.role='rider' AND EXISTS(SELECT 1 FROM vendo_internal.riders r WHERE r.profile_id=p.id AND r.city_id=ANY($2::uuid[]))) OR
 ($1='vendors' AND p.role='vendor_staff' AND EXISTS(SELECT 1 FROM vendo_internal.vendor_staff s JOIN public.vendors v ON v.id=s.vendor_id WHERE s.profile_id=p.id AND v.city_id=ANY($2::uuid[]))))`;
export class AdminBroadcasts {
 constructor(private readonly pool:pg.Pool){}
 async count(user:string,audience:string,cities:string[]){return transaction(this.pool,async c=>{await actor(c,user,'admin');return Number((await c.query(`SELECT count(*)::int AS n FROM (${audienceSql}) a`,[audience,cities])).rows[0]!.n);});}
 async list(user:string,limit:number,offset:number){return transaction(this.pool,async c=>{await actor(c,user,'admin');return (await c.query(`SELECT b.id,b.actor_id,b.audience,b.city_ids,b.title,b.body,b.send_at,b.status,b.recipients,b.created_at,
 (SELECT count(*)::int FROM public.notifications n WHERE n.dedupe_key='broadcast:'||b.id::text AND n.read_at IS NOT NULL) AS inbox_reads,
 (SELECT count(*)::int FROM vendo_internal.notification_outbox o JOIN public.notifications n ON n.id=o.notification_id WHERE n.dedupe_key='broadcast:'||b.id::text AND o.status='sent') AS device_sends
 FROM vendo_internal.admin_broadcasts b ORDER BY b.created_at DESC,b.id LIMIT $1 OFFSET $2`,[limit,offset])).rows.map(serialize);});}
 async send(user:string,input:BroadcastInput,key:string){return transaction(this.pool,async c=>{
  await actor(c,user,'admin');const canonical={...input,city_ids:[...input.city_ids].sort()};const digest=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`broadcast:${user}:${key}`]);
  const saved=(await c.query('SELECT * FROM vendo_internal.admin_broadcasts WHERE actor_id=$1 AND idempotency_key=$2',[user,key])).rows[0];
  if(saved){if(saved.digest!==digest)throw new ApiError(409,'IDEMPOTENCY_CONFLICT','This key was used for a different campaign.');return serialize(saved);}
  if(input.send_at && (Date.parse(input.send_at)<Date.now()+60000 || Date.parse(input.send_at)>Date.now()+90*86400000))throw new ApiError(400,'INVALID_SCHEDULE','Choose a time between one minute and 90 days from now.');
  const cities=(await c.query('SELECT id FROM public.cities WHERE is_active AND id=ANY($1::uuid[])',[input.city_ids])).rows;
  if(cities.length!==input.city_ids.length)throw new ApiError(400,'INVALID_CITIES','Select active service cities.');
  const b=(await c.query('INSERT INTO vendo_internal.admin_broadcasts(actor_id,audience,city_ids,title,body,send_at,idempotency_key,digest) VALUES($1,$2,$3,$4,$5,COALESCE($6::timestamptz,now()),$7,$8) RETURNING *',[user,input.audience,input.city_ids,input.title,input.body,input.send_at??null,key,digest])).rows[0]!;
  await audit(c,user,'broadcast_scheduled',b.id);return serialize(b);
 });}
 async cancel(user:string,id:string){return transaction(this.pool,async c=>{await actor(c,user,'admin');const b=(await c.query("SELECT * FROM vendo_internal.admin_broadcasts WHERE id=$1 FOR UPDATE",[id])).rows[0];if(!b)throw new ApiError(404,'BROADCAST_NOT_FOUND','Campaign not found.');if(b.status==='queued')throw new ApiError(409,'ALREADY_QUEUED','This campaign has already been queued.');await c.query("UPDATE vendo_internal.admin_broadcasts SET status='cancelled' WHERE id=$1",[id]);await audit(c,user,'broadcast_cancelled',id);return {ok:true};});}
 async process(limit=5){let processed=0;for(let i=0;i<limit;i++){const done=await transaction(this.pool,async c=>{
  const b=(await c.query("SELECT * FROM vendo_internal.admin_broadcasts WHERE status='scheduled' AND send_at<=now() ORDER BY send_at,id LIMIT 1 FOR UPDATE SKIP LOCKED")).rows[0];if(!b)return false;
  if(!(await c.query("SELECT id FROM public.profiles WHERE id=$1 AND role='admin' AND status='active' FOR SHARE",[b.actor_id])).rows[0]){await c.query("UPDATE vendo_internal.admin_broadcasts SET status='cancelled' WHERE id=$1",[b.id]);return true;}
  await c.query(`INSERT INTO public.notifications(profile_id,dedupe_key,kind,title,body) SELECT id,$3,'admin_push',$4,$5 FROM (${audienceSql}) a`,[b.audience,b.city_ids,`broadcast:${b.id}`,b.title,b.body]);
  await c.query(`INSERT INTO vendo_internal.notification_outbox(notification_id,channel,device_id,target_key)
   SELECT n.id,'push',d.id,d.id::text FROM public.notifications n JOIN vendo_internal.devices d ON d.profile_id=n.profile_id WHERE n.dedupe_key=$1`,[`broadcast:${b.id}`]);
  await c.query("UPDATE vendo_internal.admin_broadcasts SET status='queued',recipients=(SELECT count(*) FROM public.notifications WHERE dedupe_key=$2) WHERE id=$1",[b.id,`broadcast:${b.id}`]);return true;
 });if(!done)break;processed++;}return processed;}
}
