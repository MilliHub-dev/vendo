import assert from 'node:assert/strict';
import { test } from 'node:test';
import { application, cities, item, order, store } from '../src/api/dto.ts';
const base = {id:'store-id',name:'Kitchen',category:'restaurant',city_id:'city-id',address:'Pickup address',location:{lat:10.5,lng:7.5},prep_minutes:20,is_open:false,is_active:true,rating:0,opening_hours:[]};
test('Stores map active and suspended accounts, while applications never approve themselves',()=>{
 assert.equal(store(base).approval,'approved');assert.equal(store({...base,is_active:false}).approval,'suspended');
 assert.equal(store(base).commissionRate,null);
 assert.equal(application({id:'application',status:'pending',input:base})?.approval,'under_review');
 assert.equal(application({id:'application',status:'rejected',review_note:'Needs changes',input:base})?.approval,'rejected');
 assert.equal(application({status:'withdrawn'}),null);
});
test('Menu and order mappings preserve images, money, readiness and unknown finance values',()=>{
 assert.equal(item({id:'item',name:'Rice',price_kobo:250000,is_available:true,image_url:'https://example.com/rice.jpg'}).imageUrl,'https://example.com/rice.jpg');
 const original={id:'order',code:'V-100',status:'rider_assigned',quote:{subtotal_kobo:250000,items:[{name:'Rice',quantity:1,unit_price_kobo:250000}]},created_at:'2026-10-06T10:00:00Z',vendor_ready_at:null,vendor_response_due_at:null,vendor_commission_kobo:null};
 assert.equal(order(original).status,'preparing');assert.equal(order(original).payoutKobo,null);
 const ready=order({...original,vendor_ready_at:'2026-10-06T10:05:00Z',vendor_commission_kobo:25000});
 assert.equal(ready.status,'ready');assert.equal(ready.payoutKobo,225000);
 assert.equal(order({...original,vendor_commission_kobo:0}).payoutKobo,250000);
 assert.equal(order({...original,status:'disputed'}).status,'disputed');
});

test('cities come from the server’s { items } envelope, and only ones a store can register in are offered', () => {
  const live = { items: [
    { id: 'a', name: 'Abuja', is_active: true, service_area_configured: true },
    { id: 'k', name: 'Kaduna', is_active: true, service_area_configured: true },
    { id: 'l', name: 'Lagos', is_active: false, service_area_configured: true },
    { id: 'n', name: 'Kano', is_active: true, service_area_configured: false },
  ] };
  assert.deepEqual(cities(live), [{ id: 'a', name: 'Abuja' }, { id: 'k', name: 'Kaduna' }]);
  assert.deepEqual(cities([{ id: 'a', name: 'Abuja' }]), [{ id: 'a', name: 'Abuja' }]); // a plain list still works
  assert.throws(() => cities({ nope: true }), /Unexpected API list response/);
});
