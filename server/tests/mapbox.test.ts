import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMapboxRouting } from '../src/integrations/mapbox.js';

test('Mapbox uses longitude/latitude and road routing; no-route, HTTP and malformed responses fail closed', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const routing = createMapboxRouting('test-token');
  const pickup = { lat: 10.5, lng: 7.5 }, dropoff = { lat: 10.6, lng: 7.6 };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/directions/v5/mapbox/driving/7.5,10.5;7.6,10.6');
    assert.equal(url.searchParams.get('access_token'), 'test-token');
    assert.equal(url.searchParams.get('geometries'), 'geojson');
    assert.equal(url.searchParams.get('overview'), 'simplified');
    assert.ok(init?.signal);
    return Response.json({ code: 'Ok', routes: [{ distance: 1500.2, duration: 300.1 }] });
  };
  assert.deepEqual(await routing.route(pickup, dropoff), { distance_m: 1501, duration_s: 301 });
  const geometry = { type: 'LineString', coordinates: [[7.5,10.5],[7.6,10.6]] };
  globalThis.fetch = async () => Response.json({ code: 'Ok', routes: [{ distance: 1500, duration: 300, geometry }] });
  assert.deepEqual((await routing.route(pickup, dropoff)).geometry, geometry);
  for (const response of [Response.json({ code: 'NoRoute', routes: [] }), Response.json({ code: 'Ok', routes: [] }), Response.json({ code: 'Ok', routes: [{ distance: -1, duration: 5 }] }), Response.json({ message: 'private-error' }, { status: 500 })]) {
    globalThis.fetch = async () => response;
    await assert.rejects(() => routing.route(pickup, dropoff), /Delivery routes are temporarily unavailable/);
  }
  globalThis.fetch = async () => { throw new Error('secret-token'); };
  await assert.rejects(() => routing.route(pickup, dropoff), /Delivery routes are temporarily unavailable/);
});
