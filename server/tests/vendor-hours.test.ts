import assert from 'node:assert/strict';
import { test } from 'node:test';
import { vendorHoursOpen } from '../src/modules/food/pricing.js';

test('Vendor hours enforce Nigerian local time, closed days and overnight handover', () => {
 const hours=Array.from({length:7},(_,day)=>({day,open:day===1,from:'22:00',to:'06:00'}));
 assert.equal(vendorHoursOpen(hours,new Date('2026-10-05T21:00:00Z')),true);
 assert.equal(vendorHoursOpen(hours,new Date('2026-10-06T04:59:00Z')),true);
 assert.equal(vendorHoursOpen(hours,new Date('2026-10-06T05:00:00Z')),false);
 assert.equal(vendorHoursOpen(hours,new Date('2026-10-05T12:00:00Z')),false);
 assert.equal(vendorHoursOpen([],new Date()),true);
});
