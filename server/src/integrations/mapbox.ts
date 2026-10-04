import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { routeGeometrySchema, type Routing } from '../modules/food/schema.js';

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
