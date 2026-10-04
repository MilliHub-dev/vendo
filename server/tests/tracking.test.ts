import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../src/lib/errors.js';
import { TrackingService } from '../src/modules/matching/service.js';
import type { Tracking } from '../src/modules/matching/schema.js';
import { fixtures,alice } from './helpers.js';
const snapshot=():Tracking=>({order_id:randomUUID(),status:'rider_assigned',matching:null,rider:{id:randomUUID(),name:'Rider',vehicle_type:'motorcycle',plate_number:'TEST-1',phone:null,call_url:null,whatsapp_url:null},location:{lat:10.5,lng:7.5,accuracy_m:10,heading:null,speed_mps:null,captured_at:new Date().toISOString(),received_at:new Date().toISOString()},location_stale:false,target:{stage:'pickup',point:{lat:10.6,lng:7.6}},eta:null});
test('tracking rechecks authorization after road routing before returning coordinates/contact/ETA',async()=>{
  const repo=fixtures().dependencies.matching,first=snapshot();let reads=0;
  repo.tracking=async()=>{if(++reads>1)throw new ApiError(404,'ORDER_NOT_FOUND','Order not found.');return first;};
  const service=new TrackingService(repo,{async route(){return {distance_m:1000,duration_s:200};}});
  await assert.rejects(()=>service.get(alice.id,first.order_id),(error:unknown)=>error instanceof ApiError&&error.statusCode===404);
});
test('tracking discards an ETA when GPS or pickup/drop-off stage changes during routing, and suppresses stale estimates',async()=>{
  const repo=fixtures().dependencies.matching,first=snapshot();let reads=0,routes=0;
  const changed:Tracking={...first,status:'picked_up',target:{stage:'dropoff',point:{lat:10.7,lng:7.7}}};
  repo.tracking=async()=>++reads===1?first:changed;
  const service=new TrackingService(repo,{async route(){routes++;return {distance_m:1000,duration_s:200};}});
  const result=await service.get(alice.id,first.order_id);assert.equal(result.status,'picked_up');assert.equal(result.eta,null);
  repo.tracking=async()=>({...first,location_stale:true});await service.get(alice.id,first.order_id);assert.equal(routes,1);
  repo.tracking=async()=>first;await service.get(alice.id,first.order_id,false);assert.equal(routes,1);
});
