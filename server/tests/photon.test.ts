import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPhotonGeocoder } from '../src/integrations/photon.js';
import { readEnv } from '../src/config/env.js';
import { BoundedCache, cachedRouting } from '../src/integrations/cache.js';
import { isSimplePolygon } from '../src/lib/geo.js';

test('Photon normalizes GeoJSON, uses city bounds/bias and lon order, caches successes and retries failures', async (t) => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const provider = createPhotonGeocoder('https://photon.example.com/geocoder/');
  const input = { q: 'Kawo Road', limit: 5, bias: { lat: 10.5, lng: 7.5 }, bbox: [7, 10, 8, 11] as [number, number, number, number] };
  const feature = { geometry: { type: 'Point', coordinates: [7.5, 10.5] }, properties: { osm_id: 123, osm_type: 'N', name: 'Shop', street: 'Kawo Road', housenumber: '12', city: 'Kaduna', country: 'Nigeria', countrycode: 'NG' } };
  const calls: URL[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push(new URL(String(url))); assert.equal(init?.redirect, 'error'); assert.ok(init?.signal);
    return Response.json({ features: [feature, feature, { ...feature, properties: { ...feature.properties, osm_id: 456, countrycode: 'DE' } }, { ...feature, geometry: { type: 'Point', coordinates: [500, 10] } }] });
  };
  const places = await provider.search(input);
  assert.equal(places.length, 1); assert.equal(places[0]!.address, 'Shop, 12 Kawo Road, Kaduna, Nigeria');
  assert.deepEqual(places[0]!.location, { lat: 10.5, lng: 7.5 });
  assert.equal(calls[0]!.pathname, '/geocoder/api'); assert.equal(calls[0]!.searchParams.get('bbox'), '7,10,8,11');
  assert.equal(calls[0]!.searchParams.get('countrycode'), 'NG'); assert.equal(calls[0]!.searchParams.get('lon'), '7.5');
  places[0]!.name = 'Mutated'; assert.equal((await provider.search(input))[0]!.name, 'Shop'); assert.equal(calls.length, 1);
  await provider.reverse({ lat: 10.5, lng: 7.5 }); assert.equal(calls[1]!.pathname, '/geocoder/reverse'); assert.equal(calls[1]!.searchParams.get('radius'), '1');
  globalThis.fetch = async () => Response.json({ error: 'private-provider-detail' }, { status: 429 });
  await assert.rejects(() => provider.reverse({ lat: 10.6, lng: 7.6 }), /Address lookup is temporarily unavailable/);
  globalThis.fetch = async () => Response.json({ features: [] });
  assert.deepEqual(await provider.reverse({ lat: 10.6, lng: 7.6 }), []);
  globalThis.fetch = async () => Response.json({ features: 'invalid' });
  await assert.rejects(() => provider.reverse({ lat: 10.7, lng: 7.7 }), /temporarily unavailable/);
  globalThis.fetch = async () => { throw new Error('private-provider-error'); };
  await assert.rejects(() => provider.reverse({ lat: 10.8, lng: 7.8 }), /temporarily unavailable/);
  for (const value of ['file:///tmp/photon', 'https://user:password@example.com', 'https://example.com?q=private']) assert.throws(() => readEnv({ PHOTON_BASE_URL: value }), /PHOTON_BASE_URL/);
});

test('bounded cache expires/evicts, merges in-flight requests and never caches failures; routing preserves coordinate precision', async () => {
  let now = 0, calls = 0;
  const cache = new BoundedCache<number>(10, 1, () => now);
  const fetch = async () => ++calls;
  assert.deepEqual(await Promise.all([cache.load('a', fetch), cache.load('a', fetch)]), [1, 1]);
  assert.equal(await cache.load('a', fetch), 1);
  now = 11; assert.equal(await cache.load('a', fetch), 2);
  await cache.load('b', fetch); assert.equal(await cache.load('a', fetch), 4);
  await assert.rejects(() => cache.load('fail', async () => { throw new Error('Failure'); }));
  assert.equal(await cache.load('fail', fetch), 5);
  let routes = 0;
  const routing = cachedRouting({ async route() { routes++; return { distance_m: 1000, duration_s: 300 }; } });
  const a = { lat: 10.5, lng: 7.5 }, b = { lat: 10.6, lng: 7.6 };
  await routing.route(a, b); await routing.route(a, b); assert.equal(routes, 1);
  await routing.route({ ...a, lat: 10.5000001 }, b); assert.equal(routes, 2);
  await routing.route(b, a); assert.equal(routes, 3);
});

test('service polygons reject crossing edges, duplicates, collinear vertices and dateline spans', () => {
  const polygon = [{ lat: 10, lng: 7 }, { lat: 11, lng: 7 }, { lat: 11, lng: 8 }, { lat: 10, lng: 8 }];
  assert.equal(isSimplePolygon(polygon), true); assert.equal(isSimplePolygon([...polygon, polygon[0]!]), true);
  assert.equal(isSimplePolygon([polygon[0]!, polygon[2]!, polygon[1]!, polygon[3]!]), false);
  assert.equal(isSimplePolygon([polygon[0]!, polygon[0]!, polygon[1]!]), false);
  assert.equal(isSimplePolygon([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }, { lat: 2, lng: 2 }]), false);
  assert.equal(isSimplePolygon([{ lat: 10, lng: -179 }, { lat: 11, lng: 179 }, { lat: 10, lng: 179 }]), false);
});
