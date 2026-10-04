import type { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { bounds, type Point } from '../../lib/geo.js';
import { insidePolygon, cityOpen } from '../food/pricing.js';
import type { Routing } from '../food/schema.js';
import type { Identity } from '../auth/schema.js';
import type { ProfileService } from '../users/service.js';
import { polygonSchema, type AddressRepository, type Geocoder, type ServiceCity, type searchSchema } from './schema.js';
export function citySummary(city: ServiceCity) {
  return { id: city.id, name: city.name, country: city.country, is_active: city.is_active, is_open: city.is_active && cityOpen(city), service_area_configured: polygonSchema.safeParse(city.service_polygon).success, opens_at: city.opens_at, closes_at: city.closes_at };
}
export class AddressService {
  constructor(readonly repository: AddressRepository, private readonly profiles: ProfileService, private readonly geocoder: Geocoder, private readonly routing: Routing) {}
  async active(identity: Identity) { await this.profiles.get(identity); }
  async cities() { return (await this.repository.cities()).map(citySummary); }
  async city(id: string) {
    const city = await this.repository.city(id);
    if (!city || !city.is_active) throw new ApiError(404, 'CITY_NOT_FOUND', 'Active service city not found.');
    return city;
  }
  private boundary(city: ServiceCity) {
    const polygon = polygonSchema.safeParse(city.service_polygon);
    if (!polygon.success) throw new ApiError(503, 'SERVICE_AREA_NOT_CONFIGURED', 'City service boundaries are not configured.');
    return polygon.data;
  }
  async check(point: Point, cityId?: string) {
    const cities = cityId ? [await this.repository.city(cityId)].filter((city): city is ServiceCity => Boolean(city?.is_active)) : await this.repository.cities();
    if (cityId && !cities.length) return { serviceable: false, city: null, reason: 'city_unavailable' as const };
    if (cityId && !polygonSchema.safeParse(cities[0]!.service_polygon).success) return { serviceable: false, city: citySummary(cities[0]!), reason: 'service_area_not_configured' as const };
    const matches = cities.filter((city) => { const polygon = polygonSchema.safeParse(city.service_polygon); return polygon.success && insidePolygon(point, polygon.data); });
    if (matches.length > 1) throw new ApiError(409, 'AMBIGUOUS_SERVICE_AREA', 'Choose a city for this location.');
    if (!matches[0]) return { serviceable: false, city: null, reason: 'outside_service_area' as const };
    const city = citySummary(matches[0]);
    return { serviceable: city.is_open, city, reason: city.is_open ? null : 'city_closed' as const };
  }
  async search(identity: Identity, input: z.infer<typeof searchSchema>) {
    await this.active(identity);
    const city = await this.city(input.city_id), polygon = this.boundary(city), bbox = bounds(polygon);
    const bias = input.lat === undefined ? { lat: (bbox[1] + bbox[3]) / 2, lng: (bbox[0] + bbox[2]) / 2 } : { lat: input.lat, lng: input.lng! };
    if (input.lat !== undefined && !insidePolygon(bias, polygon)) throw new ApiError(400, 'OUTSIDE_SERVICE_AREA', 'Search bias must be inside the selected city service area.');
    const places = await this.geocoder.search({ q: input.q, limit: input.limit, bias, bbox });
    return places.filter((place) => insidePolygon(place.location, polygon)).slice(0, input.limit).map((place) => ({ ...place, city_id: city.id }));
  }
  async reverse(identity: Identity, point: Point, cityId: string) {
    await this.active(identity);
    const city = await this.city(cityId), polygon = this.boundary(city);
    if (!insidePolygon(point, polygon)) throw new ApiError(400, 'OUTSIDE_SERVICE_AREA', 'This pin is outside the selected city service area.');
    return (await this.geocoder.reverse(point)).filter((place) => insidePolygon(place.location, polygon)).map((place) => ({ ...place, city_id: city.id }));
  }
  async route(identity: Identity, cityId: string, pickup: Point, dropoff: Point) {
    await this.active(identity);
    const city = await this.city(cityId), polygon = this.boundary(city);
    if (!cityOpen(city)) throw new ApiError(409, 'CITY_UNAVAILABLE', 'This city is not accepting deliveries now.');
    if (!insidePolygon(pickup, polygon) || !insidePolygon(dropoff, polygon)) throw new ApiError(400, 'OUTSIDE_SERVICE_AREA', 'Both pins must be inside the selected city service area.');
    if (pickup.lat === dropoff.lat && pickup.lng === dropoff.lng) throw new ApiError(400, 'SAME_LOCATION', 'Choose different pickup and drop-off locations.');
    return { city_id: cityId, profile: 'driving' as const, ...await this.routing.route(pickup, dropoff) };
  }
  async preferred(identity: Identity) {
    await this.active(identity);
    const id = await this.repository.preferredCity(identity.id), city = id ? await this.repository.city(id) : null;
    return { city_id: id, city: city ? citySummary(city) : null };
  }
}
