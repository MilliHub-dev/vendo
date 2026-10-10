import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { routeGeometrySchema, type Routing } from '../modules/food/schema.js';
import type { Geocoder, Place } from '../modules/addresses/schema.js';
import { BoundedCache } from './cache.js';

export function createMapboxRouting(token: string): Routing {
  return { async route(pickup, dropoff) {
    try {
      const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`);
      url.searchParams.set('access_token', token); url.searchParams.set('overview', 'simplified'); url.searchParams.set('geometries', 'geojson');
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data: unknown = await response.json();
      const parsed = z.object({ code: z.literal('Ok'), routes: z.array(z.object({ distance: z.number().min(0).max(1000000), duration: z.number().min(0).max(86400), geometry: routeGeometrySchema.optional() })).min(1) }).safeParse(data);
      if (!response.ok || !parsed.success) throw new Error('Routing unavailable');
      return { distance_m: Math.ceil(parsed.data.routes[0]!.distance), duration_s: Math.ceil(parsed.data.routes[0]!.duration), ...(parsed.data.routes[0]!.geometry ? { geometry: parsed.data.routes[0]!.geometry } : {}) };
    } catch { throw new ApiError(503, 'ROUTING_UNAVAILABLE', 'Delivery routes are temporarily unavailable.'); }
  } };
}

const mapboxFeature = z.object({ geometry: z.object({ coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) }), properties: z.object({ mapbox_id: z.string().max(200), name: z.string().max(500).optional(), full_address: z.string().max(1000).optional(), place_formatted: z.string().max(1000).optional() }) });

/**
 * Address lookup on Mapbox. Used as the stand-in when the OpenStreetMap service (Photon) cannot be
 * reached, so search keeps working. Its coverage of Nigerian landmarks is thinner than Photon's.
 */
export function createMapboxGeocoder(token: string): Geocoder {
  const cache = new BoundedCache<Place[]>(300000);
  const request = (path: string, params: Record<string, string>): Promise<Place[]> => cache.load([path, params], async () => {
    try {
      const url = new URL(`https://api.mapbox.com/search/geocode/v6/${path}`);
      for (const [name, value] of Object.entries({ ...params, country: 'ng', language: 'en', access_token: token })) url.searchParams.set(name, value);
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`Mapbox answered HTTP ${response.status}`);
      const result = z.object({ features: z.array(z.unknown()).max(50) }).parse(await response.json());
      const places: Place[] = [];
      for (const feature of result.features) {
        const parsed = mapboxFeature.safeParse(feature);
        if (!parsed.success) continue;
        const { properties: p, geometry } = parsed.data, address = p.full_address ?? [p.name, p.place_formatted].filter(Boolean).join(', ');
        if (!address || places.some((place) => place.id === `mapbox:${p.mapbox_id}`)) continue;
        places.push({ id: `mapbox:${p.mapbox_id}`, name: p.name || address.split(',')[0]!, address, location: { lat: geometry.coordinates[1], lng: geometry.coordinates[0] } });
      }
      return places;
    } catch (error) {
      console.error(`Mapbox address lookup failed (${path}): ${error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : 'unknown'}`);
      throw new ApiError(503, 'GEOCODING_UNAVAILABLE', 'Address lookup is temporarily unavailable.');
    }
  });
  return {
    search: (input) => request('forward', { q: input.q, limit: String(Math.min(input.limit, 10)), proximity: `${input.bias.lng},${input.bias.lat}`, bbox: input.bbox.join(',') }),
    reverse: (point) => request('reverse', { longitude: String(point.lng), latitude: String(point.lat) }),
  };
}

/** Try the first lookup service; if it cannot be reached, use the second. */
export function fallbackGeocoder(first: Geocoder, second: Geocoder): Geocoder {
  const either = <A>(run: (g: Geocoder) => (input: A) => Promise<Place[]>) => async (input: A) => {
    try { return await run(first)(input); }
    catch (error) { if (error instanceof ApiError && error.code === 'GEOCODING_UNAVAILABLE') return run(second)(input); throw error; }
  };
  return { search: either((g) => g.search), reverse: either((g) => g.reverse) };
}
