import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import { insidePolygon } from '../food/pricing.js';
import { distanceMeters, type Point } from '../../lib/geo.js';
import { serializeOrder } from '../orders/schema.js';
import { transition, type TransitionRow } from '../orders/transitions.js';
import { locationSchema, matchingPolicySchema, offerSchema, riderSchema, trackingSchema, type MatchingRepository, type MatchingPolicy, type RiderInput, type LocationInput } from './schema.js';
const busyStatuses = "('rider_assigned','picked_up','on_the_way','disputed')";
const trackingStatuses = ['rider_assigned','picked_up','on_the_way'];
type OrderRow = TransitionRow & Record<string,unknown> & {customer_id:string;assigned_rider_id:string|null;quote:{total_kobo:number;city_id:string;pickup:Point&{address:string};dropoff:Point&{address:string}}};
type RiderRow = {profile_id:string;city_id:string;approval:string;online:boolean;vehicle_type:string;plate_number:string;approval_note:string|null;created_at:Date;updated_at:Date};
type GpsRow = {lat:number;lng:number;accuracy_m:number;heading:number|null;speed_mps:number|null;captured_at:Date;received_at:Date};
const gps = (row:GpsRow) => locationSchema.parse({...row,captured_at:row.captured_at.toISOString(),received_at:row.received_at.toISOString()});
const fresh = (row:GpsRow|undefined,policy:MatchingPolicy,now:Date) => Boolean(row && row.accuracy_m<=policy.max_accuracy_m && row.captured_at.getTime()>=now.getTime()-policy.location_max_age_seconds*1000 && row.captured_at.getTime()<=now.getTime()+15000 && row.received_at.getTime()>=now.getTime()-policy.location_max_age_seconds*1000);
export class PostgresMatchingRepository implements MatchingRepository {
  constructor(private readonly pool:pg.Pool) {}
  private async transaction<T>(run:(client:pg.PoolClient)=>Promise<T>) {
    const client=await this.pool.connect();
    try {await client.query('BEGIN');const result=await run(client);await client.query('COMMIT');return result;}
    catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  private async actor(client:pg.PoolClient,userId:string,role?:string) {
    const row=(await client.query<{role:string;onboarding_step:string}>('SELECT role,onboarding_step FROM public.profiles WHERE id=$1 AND status=\'active\' FOR SHARE',[userId])).rows[0];
    if(!row||row.onboarding_step!=='complete'||(role&&row.role!==role))throw new ApiError(403,'FORBIDDEN','An active completed account with the required role is needed.');return row;
  }
  private async now(client:pg.PoolClient) {return (await client.query<{now:Date}>('SELECT now() AS now')).rows[0]!.now;}
  private async policy(client:pg.PoolClient,cityId:string) {
    const row=(await client.query('SELECT * FROM vendo_internal.matching_policies WHERE city_id=$1 FOR SHARE',[cityId])).rows[0];
    if(!row)throw new ApiError(503,'MATCHING_NOT_CONFIGURED','Matching is not configured for this city.');return matchingPolicySchema.strip().parse(row);
  }
  private async approved(client:pg.PoolClient,userId:string) {
    const row=(await client.query<RiderRow>('SELECT * FROM vendo_internal.riders WHERE profile_id=$1 FOR UPDATE',[userId])).rows[0];
    if(!row||row.approval!=='approved')throw new ApiError(403,'RIDER_NOT_APPROVED','Approved rider access is required.');return row;
  }
  private async busy(client:pg.PoolClient,userId:string) {return (await client.query<OrderRow>(`SELECT * FROM public.orders WHERE assigned_rider_id=$1 AND status IN ${busyStatuses} LIMIT 1`,[userId])).rows[0];}
  private async view(client:pg.PoolClient,row:RiderRow) {
    const policy=(await client.query('SELECT * FROM vendo_internal.matching_policies WHERE city_id=$1',[row.city_id])).rows[0];
    const location=(await client.query<GpsRow>('SELECT * FROM vendo_internal.rider_locations WHERE rider_id=$1',[row.profile_id])).rows[0];
    const online=row.online&&row.approval==='approved'&&Boolean(policy&&fresh(location,matchingPolicySchema.strip().parse(policy),await this.now(client)));
    return riderSchema.parse({...row,online,presence:await this.busy(client,row.profile_id)?'on_trip':online?'online':'offline',created_at:row.created_at.toISOString(),updated_at:row.updated_at.toISOString()});
  }
  async register(userId:string,input:RiderInput) {
    return this.transaction(async(client)=>{
      const profile=await this.actor(client,userId);
      if(!['customer','rider'].includes(profile.role))throw new ApiError(403,'RIDER_REGISTRATION_NOT_ALLOWED','This account cannot register as a rider.');
      if(!(await client.query('SELECT id FROM public.cities WHERE id=$1 AND is_active FOR SHARE',[input.city_id])).rows[0])throw new ApiError(400,'CITY_UNAVAILABLE','Choose an active service city.');
      // Serialize initial registrations without upgrading a held profile share lock.
      await client.query('INSERT INTO vendo_internal.riders(profile_id,city_id,vehicle_type,plate_number) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[userId,input.city_id,input.vehicle_type,input.plate_number]);
      const row=(await client.query<RiderRow>('SELECT * FROM vendo_internal.riders WHERE profile_id=$1 FOR UPDATE',[userId])).rows[0]!;
      if(row.approval==='suspended')throw new ApiError(403,'RIDER_SUSPENDED','Contact support about your rider account.');
      if(row.approval==='approved') {
        if(row.city_id!==input.city_id||row.vehicle_type!==input.vehicle_type||row.plate_number!==input.plate_number)throw new ApiError(409,'RIDER_REVIEW_REQUIRED','Contact support to change approved rider details.');return this.view(client,row);
      }
      const saved=(await client.query<RiderRow>(`UPDATE vendo_internal.riders SET city_id=$2,vehicle_type=$3,plate_number=$4,approval='pending',approval_note=NULL,online=false,updated_at=now() WHERE profile_id=$1 RETURNING *`,[userId,input.city_id,input.vehicle_type,input.plate_number])).rows[0]!;
      await client.query('DELETE FROM vendo_internal.rider_locations WHERE rider_id=$1',[userId]);return this.view(client,saved);
    });
  }
  async rider(userId:string) {return this.transaction(async(client)=>{await this.actor(client,userId);const row=(await client.query<RiderRow>('SELECT * FROM vendo_internal.riders WHERE profile_id=$1',[userId])).rows[0];return row?this.view(client,row):null;});}
  async review(actorId:string,riderId:string,status:'approved'|'rejected'|'suspended',note:string) {
    return this.transaction(async(client)=>{
      await this.actor(client,actorId,'admin');
      const profile=(await client.query<{role:string}>('SELECT role FROM public.profiles WHERE id=$1 AND status=\'active\' AND onboarding_step=\'complete\' FOR NO KEY UPDATE',[riderId])).rows[0];
      if(!profile||!['customer','rider'].includes(profile.role))throw new ApiError(409,'RIDER_REVIEW_NOT_ALLOWED','The applicant account is not eligible.');
      const row=(await client.query<RiderRow>('SELECT * FROM vendo_internal.riders WHERE profile_id=$1 FOR UPDATE',[riderId])).rows[0];
      if(!row)throw new ApiError(404,'RIDER_NOT_FOUND','Rider application not found.');
      if(await this.busy(client,riderId))throw new ApiError(409,'RIDER_HAS_ACTIVE_JOB','Resolve the active job before changing rider approval.');
      if(status==='approved'&&(await client.query("SELECT id FROM vendo_internal.rider_documents WHERE rider_id=$1 AND status<>'approved' LIMIT 1",[riderId])).rows[0])throw new ApiError(409,'RIDER_DOCUMENT_REVIEW_REQUIRED','Review all uploaded documents before approval.');
      if(status==='approved')await client.query("UPDATE public.profiles SET role='rider' WHERE id=$1",[riderId]);
      const saved=(await client.query<RiderRow>('UPDATE vendo_internal.riders SET approval=$2,approval_note=$3,online=false,updated_at=now() WHERE profile_id=$1 RETURNING *',[riderId,status,note])).rows[0]!;
      await client.query('INSERT INTO vendo_internal.catalog_audit(actor_id,action,target_id) VALUES($1,$2,$3)',[actorId,`rider_${status}`,riderId]);return this.view(client,saved);
    });
  }
  async savePolicy(actorId:string,cityId:string,input:MatchingPolicy) {
    return this.transaction(async(client)=>{
      await this.actor(client,actorId,'admin');
      if(!(await client.query('SELECT id FROM public.cities WHERE id=$1 FOR SHARE',[cityId])).rows[0])throw new ApiError(404,'CITY_NOT_FOUND','City not found.');
      const keys=Object.keys(matchingPolicySchema.shape);
      await client.query(`INSERT INTO vendo_internal.matching_policies(city_id,${keys.join(',')}) VALUES($1,${keys.map((_,i)=>`$${i+2}`).join(',')}) ON CONFLICT(city_id) DO UPDATE SET ${keys.map(key=>`${key}=EXCLUDED.${key}`).join(',')}`,[cityId,...keys.map(key=>input[key as keyof MatchingPolicy])]);
      await client.query("INSERT INTO vendo_internal.catalog_audit(actor_id,action,target_id) VALUES($1,'matching_policy_updated',$2)",[actorId,cityId]);return input;
    });
  }
  async presence(userId:string,online:boolean) {
    return this.transaction(async(client)=>{
      await this.actor(client,userId,'rider');const row=await this.approved(client,userId);
      if(online) {
        const city=(await client.query<{service_polygon:Point[]|null}>('SELECT service_polygon FROM public.cities WHERE id=$1 AND is_active FOR SHARE',[row.city_id])).rows[0];
        const location=(await client.query<GpsRow>('SELECT * FROM vendo_internal.rider_locations WHERE rider_id=$1',[userId])).rows[0];
        if(!city?.service_polygon||!fresh(location,await this.policy(client,row.city_id),await this.now(client))||!location||!insidePolygon(location,city.service_polygon))throw new ApiError(409,'FRESH_LOCATION_REQUIRED','Send an accurate current location inside your service city before going online.');
      }
      const saved=(await client.query<RiderRow>('UPDATE vendo_internal.riders SET online=$2,updated_at=now() WHERE profile_id=$1 RETURNING *',[userId,online])).rows[0]!;return this.view(client,saved);
    });
  }
  async locate(userId:string,input:LocationInput) {
    return this.transaction(async(client)=>{
      await this.actor(client,userId,'rider');
      // Order before rider/location locks, matching the assignment lock order.
      const job=await this.busy(client,userId);
      const order=job?(await client.query<OrderRow>('SELECT * FROM public.orders WHERE id=$1 FOR UPDATE',[job.id])).rows[0]:undefined;
      const rider=await this.approved(client,userId),policy=await this.policy(client,rider.city_id),now=await this.now(client);
      const time=new Date(input.captured_at);
      if(time.getTime()<now.getTime()-policy.location_max_age_seconds*1000||time.getTime()>now.getTime()+15000||input.accuracy_m>policy.max_accuracy_m)throw new ApiError(400,'INVALID_LOCATION_SAMPLE','Send a recent accurate location sample.');
      const city=(await client.query<{service_polygon:Point[]|null}>('SELECT service_polygon FROM public.cities WHERE id=$1 AND is_active FOR SHARE',[rider.city_id])).rows[0];
      if(!city?.service_polygon || ((!order||!trackingStatuses.includes(order.status))&&!insidePolygon(input,city.service_polygon)))throw new ApiError(400,'LOCATION_OUTSIDE_CITY','Idle rider location must be inside the active service city.');
      const previous=(await client.query<GpsRow>('SELECT * FROM vendo_internal.rider_locations WHERE rider_id=$1 FOR UPDATE',[userId])).rows[0];
      if(previous&&time<=previous.captured_at) {
        if(time.getTime()===previous.captured_at.getTime()&&input.lat===previous.lat&&input.lng===previous.lng&&input.accuracy_m===previous.accuracy_m&&input.heading===previous.heading&&input.speed_mps===previous.speed_mps)return gps(previous);
        throw new ApiError(409,'OUT_OF_ORDER_LOCATION','A newer location sample has already been received.');
      }
      const values=[userId,input.lat,input.lng,input.accuracy_m,input.heading,input.speed_mps,time];
      const saved=(await client.query<GpsRow>(`INSERT INTO vendo_internal.rider_locations(rider_id,lat,lng,accuracy_m,heading,speed_mps,captured_at) VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(rider_id) DO UPDATE SET lat=$2,lng=$3,accuracy_m=$4,heading=$5,speed_mps=$6,captured_at=$7,received_at=now() RETURNING *`,values)).rows[0]!;
      if(order&&order.assigned_rider_id===userId&&trackingStatuses.includes(order.status))await client.query(`INSERT INTO public.order_tracking(order_id,rider_id,lat,lng,accuracy_m,heading,speed_mps,captured_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(order_id) DO UPDATE SET rider_id=$2,lat=$3,lng=$4,accuracy_m=$5,heading=$6,speed_mps=$7,captured_at=$8,received_at=now()`,[order.id,...values]);
      return gps(saved);
    });
  }
  private async offer(client:pg.PoolClient,id:string) {
    const row=(await client.query('SELECT f.*,o.type,o.quote FROM vendo_internal.rider_offers f JOIN public.orders o ON o.id=f.order_id WHERE f.id=$1',[id])).rows[0]!;
    const quote=row.quote as OrderRow['quote']&{package?:unknown};return offerSchema.parse({...row,package:quote.package??null,expires_at:(row.expires_at as Date).toISOString(),pickup:quote.pickup,dropoff:quote.dropoff});
  }
  async currentOffer(userId:string) {
    return this.transaction(async(client)=>{
      await this.actor(client,userId,'rider');const rider=await this.approved(client,userId);
      const location=(await client.query<GpsRow>('SELECT * FROM vendo_internal.rider_locations WHERE rider_id=$1',[userId])).rows[0];
      if(!rider.online||await this.busy(client,userId)||!fresh(location,await this.policy(client,rider.city_id),await this.now(client)))return null;
      const row=(await client.query<{id:string}>("SELECT f.id FROM vendo_internal.rider_offers f JOIN public.orders o ON o.id=f.order_id WHERE f.rider_id=$1 AND f.status='pending' AND f.expires_at>now() AND o.status='searching_rider' AND o.payment_status='paid'",[userId])).rows[0];return row?this.offer(client,row.id):null;
    });
  }
  async respond(userId:string,offerId:string,action:'accept'|'reject') {
    const found=(await this.pool.query<{order_id:string}>('SELECT order_id FROM vendo_internal.rider_offers WHERE id=$1 AND rider_id=$2',[offerId,userId])).rows[0];
    if(!found)throw new ApiError(404,'OFFER_NOT_FOUND','Offer not found.');
    return this.transaction(async(client)=>{
      await this.actor(client,userId,'rider');const order=(await client.query<OrderRow>('SELECT * FROM public.orders WHERE id=$1 FOR UPDATE',[found.order_id])).rows[0]!;
      const rider=await this.approved(client,userId);
      const offer=(await client.query<{status:string;expires_at:Date}>('SELECT status,expires_at FROM vendo_internal.rider_offers WHERE id=$1 FOR UPDATE',[offerId])).rows[0]!;
      if((action==='accept'&&offer.status==='accepted'&&order.assigned_rider_id===userId)||(action==='reject'&&offer.status==='rejected'))return this.offer(client,offerId);
      if(offer.status!=='pending'||offer.expires_at<=await this.now(client)||order.status!=='searching_rider'||order.payment_status!=='paid')throw new ApiError(409,'OFFER_UNAVAILABLE','This offer expired or is no longer available.');
      if(action==='accept') {
        const location=(await client.query<GpsRow>('SELECT * FROM vendo_internal.rider_locations WHERE rider_id=$1',[userId])).rows[0];
        const city=(await client.query<{service_polygon:Point[]|null}>('SELECT service_polygon FROM public.cities WHERE id=$1 AND is_active FOR SHARE',[rider.city_id])).rows[0];
        const policy=await this.policy(client,rider.city_id);
        if(!rider.online||rider.city_id!==order.quote.city_id||!city?.service_polygon||!location||!insidePolygon(location,city.service_polygon)||!fresh(location,policy,await this.now(client))||distanceMeters(location,order.quote.pickup)>policy.max_radius_m||await this.busy(client,userId))throw new ApiError(409,'RIDER_UNAVAILABLE','Go online with fresh GPS and finish any active job before accepting.');
        await client.query('UPDATE public.orders SET assigned_rider_id=$2 WHERE id=$1',[order.id,userId]);
        await client.query("UPDATE vendo_internal.rider_offers SET status='accepted',responded_at=now() WHERE id=$1",[offerId]);
        await transition(client,{...order,assigned_rider_id:userId},'rider_assigned',userId,'rider_offer_accepted');
        await client.query(`INSERT INTO public.order_tracking(order_id,rider_id,lat,lng,accuracy_m,heading,speed_mps,captured_at,received_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(order_id) DO NOTHING`,[order.id,userId,location.lat,location.lng,location.accuracy_m,location.heading,location.speed_mps,location.captured_at,location.received_at]);
      } else await client.query("UPDATE vendo_internal.rider_offers SET status='rejected',responded_at=now() WHERE id=$1",[offerId]);
      return this.offer(client,offerId);
    });
  }
  async job(userId:string) {return this.transaction(async(client)=>{await this.actor(client,userId,'rider');const row=await this.busy(client,userId);return row?serializeOrder(row):null;});}
  async tracking(userId:string,orderId:string) {
    return this.transaction(async(client)=>{
      const actor=await this.actor(client,userId);
      const order=(await client.query<OrderRow>('SELECT * FROM public.orders WHERE id=$1 AND (customer_id=$2 OR assigned_rider_id=$2 OR $3)',[orderId,userId,actor.role==='admin'])).rows[0];
      if(!order)throw new ApiError(404,'ORDER_NOT_FOUND','Order not found.');
      const search=(await client.query('SELECT * FROM vendo_internal.matching_searches WHERE order_id=$1',[orderId])).rows[0];
      const active=trackingStatuses.includes(order.status)&&order.payment_status==='paid';
      const rider=order.assigned_rider_id?(await client.query('SELECT r.*,p.name,p.phone FROM vendo_internal.riders r JOIN public.profiles p ON p.id=r.profile_id WHERE r.profile_id=$1 AND p.status=\'active\' AND r.approval=\'approved\'',[order.assigned_rider_id])).rows[0]:undefined;
      const location=active?(await client.query<GpsRow>('SELECT * FROM public.order_tracking WHERE order_id=$1 AND rider_id=$2',[orderId,order.assigned_rider_id])).rows[0]:undefined;
      const policy=(await client.query('SELECT * FROM vendo_internal.matching_policies WHERE city_id=$1',[order.quote.city_id])).rows[0];
      const stale=!active||!rider||!policy||!fresh(location,matchingPolicySchema.strip().parse(policy),await this.now(client));
      const stage=order.status==='rider_assigned'?'pickup' as const:'dropoff' as const;
      const phone=active&&rider?rider.phone as string:null;
      return trackingSchema.parse({order_id:order.id,status:order.status,matching:search?{...search,started_at:(search.started_at as Date).toISOString(),deadline_at:(search.deadline_at as Date).toISOString()}:null,
        rider:rider?{id:rider.profile_id,name:rider.name,vehicle_type:rider.vehicle_type,plate_number:rider.plate_number,phone,call_url:phone?`tel:${phone}`:null,whatsapp_url:phone?`https://wa.me/${phone.replace(/\D/g,'')}`:null}:null,
        location:active&&rider&&location?gps(location):null,location_stale:stale,target:active&&rider?{stage,point:stage==='pickup'?order.quote.pickup:order.quote.dropoff}:null,eta:null});
    });
  }
  async retry(userId:string,orderId:string) {
    return this.transaction(async(client)=>{
      const actor=await this.actor(client,userId);
      const order=(await client.query<OrderRow>('SELECT * FROM public.orders WHERE id=$1 AND (customer_id=$2 OR $3) FOR UPDATE',[orderId,userId,actor.role==='admin'])).rows[0];
      if(!order)throw new ApiError(404,'ORDER_NOT_FOUND','Order not found.');
      const search=(await client.query<{state:string}>('SELECT state FROM vendo_internal.matching_searches WHERE order_id=$1 FOR UPDATE',[orderId])).rows[0];
      if(order.status!=='searching_rider'||order.payment_status!=='paid'||!search)throw new ApiError(409,'MATCHING_RETRY_NOT_ALLOWED','This order cannot restart matching.');
      if(search.state==='searching')return;
      if(search.state!=='no_rider')throw new ApiError(409,'MATCHING_RETRY_NOT_ALLOWED','This order cannot restart matching.');
      const policy=await this.policy(client,order.quote.city_id);
      await client.query("UPDATE vendo_internal.matching_searches SET generation=generation+1,state='searching',started_at=now(),deadline_at=now()+make_interval(secs=>$2),radius_m=$3,reason=NULL,updated_at=now() WHERE order_id=$1",[orderId,policy.search_seconds,policy.initial_radius_m]);
      if(actor.role==='admin')await client.query("INSERT INTO vendo_internal.catalog_audit(actor_id,action,target_id) VALUES($1,'matching_retried',$2)",[userId,orderId]);
    });
  }
  async cancelSearch(userId:string,orderId:string) {
    return this.transaction(async(client)=>{
      await this.actor(client,userId);const order=(await client.query<OrderRow>('SELECT * FROM public.orders WHERE id=$1 AND customer_id=$2 FOR UPDATE',[orderId,userId])).rows[0];
      if(!order)throw new ApiError(404,'ORDER_NOT_FOUND','Order not found.');
      if(order.status==='cancelled'&&(await client.query("SELECT order_id FROM vendo_internal.matching_searches WHERE order_id=$1 AND reason='no_rider_cancelled'",[orderId])).rows[0])return serializeOrder(order);
      const search=(await client.query<{state:string}>('SELECT state FROM vendo_internal.matching_searches WHERE order_id=$1 FOR UPDATE',[orderId])).rows[0];
      if(order.status!=='searching_rider'||order.payment_status!=='paid'||search?.state!=='no_rider')throw new ApiError(409,'MATCHING_CANCEL_NOT_ALLOWED','No-rider cancellation is not available now.');
      await transition(client,order,'cancelled',userId,'no_rider_cancelled');
      await client.query("UPDATE vendo_internal.matching_searches SET reason='no_rider_cancelled' WHERE order_id=$1",[orderId]);return serializeOrder((await client.query('SELECT * FROM public.orders WHERE id=$1',[orderId])).rows[0]!);
    });
  }
  async queue(actorId:string,cityId:string,limit:number,offset:number) {
    return this.transaction(async(client)=>{await this.actor(client,actorId,'admin');const {rows}=await client.query<{order_id:string;reason:string|null;started_at:Date}>(`SELECT s.order_id,s.reason,s.started_at FROM vendo_internal.matching_searches s JOIN public.orders o ON o.id=s.order_id WHERE s.state='no_rider' AND o.status='searching_rider' AND o.quote->>'city_id'=$1 ORDER BY s.started_at,s.order_id LIMIT $2 OFFSET $3`,[cityId,limit,offset]);return rows.map(row=>({...row,started_at:row.started_at.toISOString()}));});
  }
  async process(limit:number) {
    // Cleanup commits before taking order locks, avoiding a rider->order lock
    // inversion with concurrent acceptance/location updates.
    const stale=await this.pool.query(`UPDATE vendo_internal.riders r SET online=false,updated_at=now() WHERE online AND EXISTS(SELECT 1 FROM vendo_internal.matching_policies p WHERE p.city_id=r.city_id AND NOT EXISTS(SELECT 1 FROM vendo_internal.rider_locations l WHERE l.rider_id=r.profile_id AND l.captured_at>=now()-make_interval(secs=>p.location_max_age_seconds) AND l.received_at>=now()-make_interval(secs=>p.location_max_age_seconds))) RETURNING profile_id`);
    return this.transaction(async(client)=>{
      const now=await this.now(client),result={offered:0,expired:0,no_rider:0,offline:stale.rows.length};
      const {rows}=await client.query<OrderRow>(`SELECT o.* FROM public.orders o LEFT JOIN vendo_internal.matching_searches rotation ON rotation.order_id=o.id WHERE o.status='searching_rider' AND o.payment_status='paid'
        AND NOT EXISTS(SELECT 1 FROM vendo_internal.matching_searches s WHERE s.order_id=o.id AND s.state='no_rider') ORDER BY COALESCE(rotation.updated_at,o.created_at),o.id LIMIT $1 FOR UPDATE OF o SKIP LOCKED`,[limit]);
      for(const order of rows) {
        const configured=(await client.query('SELECT * FROM vendo_internal.matching_policies WHERE city_id=$1 FOR SHARE',[order.quote.city_id])).rows[0];
        if(!configured) {
          await client.query("UPDATE vendo_internal.rider_offers SET status='cancelled',responded_at=now() WHERE order_id=$1 AND status='pending'",[order.id]);
          await client.query("INSERT INTO vendo_internal.matching_searches(order_id,state,deadline_at,radius_m,reason) VALUES($1,'no_rider',now(),0,'matching_not_configured') ON CONFLICT(order_id) DO UPDATE SET state='no_rider',reason='matching_not_configured',updated_at=now()",[order.id]);
          result.no_rider++;continue;
        }
        const policy=matchingPolicySchema.strip().parse(configured);
        await client.query('INSERT INTO vendo_internal.matching_searches(order_id,deadline_at,radius_m) VALUES($1,now()+make_interval(secs=>$2),$3) ON CONFLICT DO NOTHING',[order.id,policy.search_seconds,policy.initial_radius_m]);
        const search=(await client.query<{generation:number;started_at:Date;deadline_at:Date}>('SELECT * FROM vendo_internal.matching_searches WHERE order_id=$1 FOR UPDATE',[order.id])).rows[0]!;
        await client.query('UPDATE vendo_internal.matching_searches SET updated_at=now() WHERE order_id=$1',[order.id]);
        const pending=(await client.query<{id:string;rider_id:string;expires_at:Date}>('SELECT * FROM vendo_internal.rider_offers WHERE order_id=$1 AND status=\'pending\' FOR UPDATE',[order.id])).rows[0];
        if(pending) {
          const valid=(await client.query(`SELECT r.profile_id FROM vendo_internal.riders r JOIN public.profiles p ON p.id=r.profile_id JOIN vendo_internal.rider_locations l ON l.rider_id=r.profile_id
            WHERE r.profile_id=$1 AND r.online AND r.approval='approved' AND p.status='active' AND p.role='rider' AND r.city_id=$2
            AND l.captured_at>=now()-make_interval(secs=>$3) AND l.received_at>=now()-make_interval(secs=>$3) AND l.accuracy_m<=$4
            AND NOT EXISTS(SELECT 1 FROM public.orders o WHERE o.assigned_rider_id=r.profile_id AND o.status IN ${busyStatuses})`,[pending.rider_id,order.quote.city_id,policy.location_max_age_seconds,policy.max_accuracy_m])).rows[0];
          if(valid&&pending.expires_at>now&&search.deadline_at>now)continue;
          await client.query("UPDATE vendo_internal.rider_offers SET status='expired',responded_at=now() WHERE id=$1",[pending.id]);result.expired++;
        }
        const radius=Math.min(policy.max_radius_m,policy.initial_radius_m+Math.floor((now.getTime()-search.started_at.getTime())/(policy.expansion_seconds*1000))*policy.radius_step_m);
        await client.query('UPDATE vendo_internal.matching_searches SET radius_m=$2,updated_at=now() WHERE order_id=$1',[order.id,radius]);
        const city=(await client.query<{is_active:boolean;service_polygon:Point[]|null}>('SELECT is_active,service_polygon FROM public.cities WHERE id=$1 FOR SHARE',[order.quote.city_id])).rows[0];
        if(search.deadline_at<=now||!city?.is_active||!city.service_polygon) {
          await client.query("UPDATE vendo_internal.matching_searches SET state='no_rider',reason=$2,updated_at=now() WHERE order_id=$1",[order.id,search.deadline_at<=now?'search_timeout':'city_unavailable']);result.no_rider++;continue;
        }
        // Durable Postgres nearest-neighbour search. Row locks and the two
        // partial unique offer indexes reserve each candidate until response.
        const distance=`(6371000 * 2 * asin(sqrt(least(1.0,power(sin(radians(l.lat-$2)/2),2)+cos(radians($2))*cos(radians(l.lat))*power(sin(radians(l.lng-$3)/2),2)))))`;
        const candidates=await client.query<{profile_id:string;lat:number;lng:number;distance_m:number}>(`SELECT r.profile_id,l.lat,l.lng,${distance} AS distance_m FROM vendo_internal.riders r JOIN public.profiles p ON p.id=r.profile_id JOIN vendo_internal.rider_locations l ON l.rider_id=r.profile_id
          WHERE r.city_id=$1 AND r.profile_id<>$9 AND r.approval='approved' AND r.online AND p.status='active' AND p.role='rider' AND p.onboarding_step='complete'
            AND l.captured_at>=now()-make_interval(secs=>$4) AND l.captured_at<=now()+interval '15 seconds' AND l.received_at>=now()-make_interval(secs=>$4) AND l.accuracy_m<=$5 AND ${distance}<=$6
            AND NOT EXISTS(SELECT 1 FROM public.orders o WHERE o.assigned_rider_id=r.profile_id AND o.status IN ${busyStatuses})
            AND NOT EXISTS(SELECT 1 FROM vendo_internal.rider_offers f WHERE f.rider_id=r.profile_id AND (f.status='pending' OR (f.order_id=$7 AND f.generation=$8)))
          ORDER BY distance_m,r.profile_id LIMIT 20 FOR UPDATE OF r SKIP LOCKED`,[order.quote.city_id,order.quote.pickup.lat,order.quote.pickup.lng,policy.location_max_age_seconds,policy.max_accuracy_m,radius,order.id,search.generation,order.customer_id]);
        let candidate:typeof candidates.rows[number]|undefined;
        for(const row of candidates.rows) {
          if(!insidePolygon(row,city.service_polygon!))continue;
          // A concurrent transaction may commit its reservation after the
          // candidate SELECT snapshot but before we acquire the rider lock.
          // Recheck with a new READ COMMITTED snapshot while holding that lock.
          if(await this.busy(client,row.profile_id))continue;
          if((await client.query('SELECT id FROM vendo_internal.rider_offers WHERE rider_id=$1 AND (status=\'pending\' OR (order_id=$2 AND generation=$3)) LIMIT 1',[row.profile_id,order.id,search.generation])).rows[0])continue;
          candidate=row;break;
        }
        if(!candidate)continue;
        // Acceptance rechecks trusted profile and fresh GPS under locks.
        await client.query('INSERT INTO vendo_internal.rider_offers(order_id,rider_id,generation,distance_m,expires_at) VALUES($1,$2,$3,$4,least(now()+make_interval(secs=>$5),$6))',[order.id,candidate.profile_id,search.generation,Math.ceil(candidate.distance_m),policy.offer_seconds,search.deadline_at]);result.offered++;
      }
      return result;
    });
  }
}
