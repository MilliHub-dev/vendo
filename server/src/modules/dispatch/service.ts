import { z } from 'zod';
import { isSimplePolygon } from '../../lib/geo.js';
import { ApiError } from '../../lib/errors.js';
import type { Identity } from '../auth/schema.js';
import { requireCompleteProfile, type ProfileService } from '../users/service.js';
import { cityOpen, insidePolygon, deliveryFee } from '../food/pricing.js';
import { pointSchema, type Routing } from '../food/schema.js';
import { dispatchSnapshotSchema, type DispatchInput, type DispatchRepository, type DispatchOrder, type SendAgain } from './schema.js';
import { DeliveryCodes } from './codes.js';
import type { AnyOrder } from '../orders/schema.js';

export class DispatchService {
  private readonly codes: DeliveryCodes;
  constructor(private readonly repository: DispatchRepository, private readonly profiles: ProfileService, private readonly routing: Routing, secret?: string) { this.codes = new DeliveryCodes(secret); }
  async packages(cityId: string) { return this.repository.packages(cityId); }
  async quote(identity: Identity, input: DispatchInput) {
    requireCompleteProfile(await this.profiles.get(identity));
    const city = await this.repository.getCity(input.city_id);
    if (!city || !city.is_active || !cityOpen(city)) throw new ApiError(409, 'CITY_UNAVAILABLE', 'This city is not accepting deliveries now.');
    const polygon = z.array(pointSchema).min(3).max(500).refine(isSimplePolygon).safeParse(city.service_polygon);
    if (!polygon.success) throw new ApiError(503, 'SERVICE_AREA_NOT_CONFIGURED', 'City service boundaries are not configured.');
    if (!insidePolygon(input.pickup, polygon.data) || !insidePolygon(input.dropoff, polygon.data)) throw new ApiError(400, 'OUTSIDE_SERVICE_AREA', 'Pickup and drop-off must be inside the same city service area.');
    if (input.pickup.lat === input.dropoff.lat && input.pickup.lng === input.dropoff.lng) throw new ApiError(400, 'SAME_LOCATION', 'Choose different pickup and drop-off locations.');
    const config = (await this.repository.packages(city.id)).find((item) => item.size === input.package.size);
    if (!config) throw new ApiError(503, 'PACKAGE_NOT_CONFIGURED', 'This package size is not available in this city.');
    const dimensions = input.package.dimensions_cm;
    if ((input.package.weight_g && input.package.weight_g > config.max_weight_g) || (dimensions && (dimensions.length > config.max_length_cm || dimensions.width > config.max_width_cm || dimensions.height > config.max_height_cm))) throw new ApiError(400, 'PACKAGE_TOO_LARGE', 'The package exceeds the selected size limits.');
    const pricing = { ...city, base_fare_kobo: city.base_fare_kobo === null ? null : (BigInt(city.base_fare_kobo) + BigInt(config.fee_kobo)).toString() };
    deliveryFee(pricing, 0);
    const route = await this.routing.route(input.pickup, input.dropoff);
    const fee = deliveryFee(pricing, route.distance_m);
    const base = BigInt(city.base_fare_kobo!);
    const distance = (BigInt(city.per_km_rate_kobo!) * BigInt(route.distance_m) + 999n) / 1000n;
    const raw = base + distance + BigInt(config.fee_kobo), minimum = BigInt(city.minimum_delivery_fee_kobo);
    const surged=(raw*BigInt(city.surge_bps??10000)+9999n)/10000n;
    const adjusted = surged > minimum ? surged : minimum;
    const {promo_code,...draft}=input;
    const snapshot = dispatchSnapshotSchema.safeParse({ ...draft, distance_m: route.distance_m, eta_minutes: Math.max(1, Math.ceil(route.duration_s / 60)), base_fare_kobo: Number(base), distance_fee_kobo: Number(distance), package_fee_kobo: config.fee_kobo, minimum_adjustment_kobo: Number(adjusted - surged), surge_fee_kobo:Number(surged-raw), rounding_kobo: fee - Number(adjusted), surge_bps:city.surge_bps??10000, delivery_fee_kobo: fee, discount_kobo: 0, total_kobo: fee });
    if (!snapshot.success) throw new ApiError(400, 'AMOUNT_TOO_LARGE', 'The dispatch amount or route is outside supported limits.');
    return this.repository.saveQuote(identity.id, snapshot.data, city.pricing_version, config, promo_code);
  }
  async createOrder(identity: Identity, quoteId: string, method: DispatchOrder['payment_method'], key: string, scheduledAt?: string) {
    requireCompleteProfile(await this.profiles.get(identity));
    return this.repository.createOrder(identity.id, quoteId, method, key, (id) => this.codes.generate(id), scheduledAt);
  }
  async code(identity: Identity, orderId: string) { await this.profiles.get(identity); return { code: this.codes.decrypt(orderId, await this.repository.getCode(identity.id, orderId)) }; }
  async complete(identity: Identity, orderId: string, code: string) {
    await this.profiles.get(identity);
    const result = await this.repository.complete(identity.id, orderId, this.codes.hash(orderId, code));
    if (result === 'locked') throw new ApiError(409, 'DELIVERY_CODE_LOCKED', 'Delivery confirmation is locked. Contact support.');
    if (result === 'incorrect') throw new ApiError(400, 'INVALID_DELIVERY_CODE', 'The delivery code is incorrect.');
    return { status: 'delivered' as const };
  }
  sendAgain(order: AnyOrder): SendAgain {
    if (order.type !== 'dispatch') throw new ApiError(409, 'WRONG_ORDER_TYPE', 'Use food reorder for this order.');
    if (!['delivered', 'cancelled'].includes(order.status)) throw new ApiError(409, 'ORDER_ACTIVE', 'Only past orders can be sent again.');
    const { city_id, pickup, dropoff, package: parcel, receiver } = order.quote;
    const packageDraft = { size: parcel.size, description: parcel.description, fragile: parcel.fragile, ...(parcel.weight_g ? { weight_g: parcel.weight_g } : {}), ...(parcel.dimensions_cm ? { dimensions_cm: parcel.dimensions_cm } : {}) };
    return { type: 'dispatch', city_id, pickup, dropoff, package: packageDraft, receiver };
  }
}
