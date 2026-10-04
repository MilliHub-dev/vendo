import { z } from 'zod';
import { isSimplePolygon } from '../../lib/geo.js';
import { ApiError } from '../../lib/errors.js';
import type { Identity } from '../auth/schema.js';
import { requireCompleteProfile, type ProfileService } from '../users/service.js';
import { priceCart, deliveryFee, insidePolygon, cityOpen } from './pricing.js';
import { pointSchema, quoteSnapshotSchema, type Cart, type FoodRepository, type QuoteInput, type Routing, type VendorSearch } from './schema.js';

export class FoodService {
  constructor(private readonly repository: FoodRepository, private readonly profiles: ProfileService, private readonly routing: Routing) {}
  async list(search: VendorSearch) { return this.repository.listVendors(search); }
  async vendor(id: string) {
    const details = await this.repository.getVendor(id);
    if (!details) throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found.');
    return details;
  }
  async cart(identity: Identity, input: Cart) {
    await this.profiles.get(identity);
    const details = await this.vendor(input.vendor_id);
    if (!details.vendor.is_open) throw new ApiError(409, 'VENDOR_CLOSED', 'This vendor is not accepting orders.');
    return priceCart(input, details.menu);
  }
  async quote(identity: Identity, input: QuoteInput) {
    requireCompleteProfile(await this.profiles.get(identity));
    const details = await this.vendor(input.vendor_id);
    if (!details.vendor.is_open) throw new ApiError(409, 'VENDOR_CLOSED', 'This vendor is not accepting orders.');
    const city = await this.repository.getCity(details.vendor.city_id);
    if (!city || !city.is_active || !cityOpen(city)) throw new ApiError(409, 'CITY_UNAVAILABLE', 'This city is not accepting deliveries now.');
    const boundary = z.array(pointSchema).min(3).max(500).refine(isSimplePolygon).safeParse(city.service_polygon);
    if (!boundary.success) throw new ApiError(503, 'SERVICE_AREA_NOT_CONFIGURED', 'Delivery service boundaries are not configured for this city.');
    if (!insidePolygon(details.vendor.location, boundary.data) || !insidePolygon(input.dropoff, boundary.data)) throw new ApiError(400, 'OUTSIDE_SERVICE_AREA', 'Pickup and delivery must be inside the vendor city service area.');
    const cart = priceCart(input, details.menu);
    if (BigInt(cart.subtotal_kobo) < BigInt(city.minimum_food_subtotal_kobo)) throw new ApiError(400, 'MINIMUM_ORDER_REQUIRED', 'The cart is below this city’s minimum food order value.');
    // Validate price configuration before making a paid routing request.
    deliveryFee(city, 0);
    const route = await this.routing.route(details.vendor.location, input.dropoff);
    const fee = deliveryFee(city, route.distance_m);
    const snapshot = quoteSnapshotSchema.safeParse({ ...cart, city_id: city.id, vendor_name: details.vendor.name,
      pickup: { ...details.vendor.location, address: details.vendor.address }, dropoff: input.dropoff, distance_m: route.distance_m,
      eta_minutes: details.vendor.prep_minutes + Math.max(1, Math.ceil(route.duration_s / 60)), delivery_fee_kobo: fee, surge_bps:city.surge_bps??10000, discount_kobo: 0, total_kobo: cart.subtotal_kobo + fee });
    if (!snapshot.success) throw new ApiError(400, 'AMOUNT_TOO_LARGE', 'The order amount or route is outside supported limits.');
    return this.repository.saveQuote(identity.id, snapshot.data, city.pricing_version, input.promo_code);
  }
  async createOrder(identity: Identity, quoteId: string, method: 'wallet' | 'card' | 'transfer' | 'ussd', key: string, scheduledAt?: string) {
    requireCompleteProfile(await this.profiles.get(identity));
    return this.repository.createOrder(identity.id, quoteId, method, key, scheduledAt);
  }
  async orders(identity: Identity, filter: 'active' | 'past', limit: number, offset: number) { await this.profiles.get(identity); return this.repository.listOrders(identity.id, filter, limit, offset); }
  async order(identity: Identity, id: string) {
    await this.profiles.get(identity);
    const order = await this.repository.getOrder(identity.id, id);
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    return order;
  }
  async reorder(identity: Identity, id: string) {
    const order = await this.order(identity, id);
    if (order.type !== 'food') throw new ApiError(409, 'WRONG_ORDER_TYPE', 'Use send-again for dispatch orders.');
    if (order.status !== 'delivered' && order.status !== 'cancelled') throw new ApiError(409, 'ORDER_ACTIVE', 'Only past orders can be reordered.');
    return this.cart(identity, { vendor_id: order.quote.vendor_id, items: order.quote.items.map((item) => ({ menu_item_id: item.menu_item_id, quantity: item.quantity, option_ids: item.options.map((option) => option.id), note: item.note })) });
  }
}
