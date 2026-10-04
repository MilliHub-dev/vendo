import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import type { Geocoder, Place } from '../modules/addresses/schema.js';
import { BoundedCache } from './cache.js';

const featureSchema = z.object({ geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) }), properties: z.object({ osm_id: z.union([z.number().int().nonnegative(), z.string().max(80)]), osm_type: z.string().max(20), name: z.string().max(500).optional(), street: z.string().max(500).optional(), housenumber: z.string().max(80).optional(), city: z.string().max(200).optional(), district: z.string().max(200).optional(), state: z.string().max(200).optional(), country: z.string().max(200).optional(), countrycode: z.string().max(3).optional(), postcode: z.string().max(80).optional() }) });
export function createPhotonGeocoder(baseUrl: string): Geocoder {
  const cache = new BoundedCache<Place[]>(300000);
  async function request(path: string, params: Record<string, string>): Promise<Place[]> {
    return cache.load([path, params], async () => {
      try {
        const url = new URL(baseUrl); url.pathname = `${url.pathname.replace(/\/$/, '')}/${path}`;
        for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
        const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error('Geocoding unavailable');
        const text = await response.text();
        if (Buffer.byteLength(text) > 512000) throw new Error('Geocoding response too large');
        const result = z.object({ features: z.array(z.unknown()).max(100) }).parse(JSON.parse(text));
        const places: Place[] = [];
        for (const feature of result.features) {
          const parsed = featureSchema.safeParse(feature);
          if (!parsed.success) continue;
          const { properties: p, geometry } = parsed.data;
          if (p.countrycode?.toUpperCase() !== 'NG') continue;
          const street = [p.housenumber, p.street].filter(Boolean).join(' ');
          const components = [...new Set([p.name, street, p.district, p.city, p.state, p.postcode, p.country].filter((value): value is string => Boolean(value)))];
          if (!components.length) continue;
          const id = `osm:${p.osm_type}:${p.osm_id}`;
          if (places.some((place) => place.id === id)) continue;
          places.push({ id, name: p.name || street || components[0]!, address: components.join(', '), location: { lat: geometry.coordinates[1], lng: geometry.coordinates[0] } });
        }
        return places;
      } catch { throw new ApiError(503, 'GEOCODING_UNAVAILABLE', 'Address lookup is temporarily unavailable.'); }
    });
  }
  return {
    search: (input) => request('api', { q: input.q, limit: String(input.limit), lang: 'en', countrycode: 'NG', lat: String(input.bias.lat), lon: String(input.bias.lng), bbox: input.bbox.join(',') }),
    reverse: (point) => request('reverse', { lat: String(point.lat), lon: String(point.lng), radius: '1', limit: '5', lang: 'en' }),
  };
}
