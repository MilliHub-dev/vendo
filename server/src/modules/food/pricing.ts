import { ApiError } from '../../lib/errors.js';
import type { Cart, MenuItem, PricedCart, CityPricing } from './schema.js';

export function priceCart(cart: Cart, menu: MenuItem[]): PricedCart {
  const items = cart.items.map((line) => {
    const item = menu.find((candidate) => candidate.id === line.menu_item_id && candidate.vendor_id === cart.vendor_id);
    if (!item || !item.is_available) throw new ApiError(409, 'ITEM_UNAVAILABLE', 'A cart item is unavailable or belongs to another vendor.');
    if (new Set(line.option_ids).size !== line.option_ids.length) throw new ApiError(400, 'INVALID_OPTIONS', 'Option selections must be unique.');
    const possible = item.option_groups.flatMap((group) => group.options);
    const options = line.option_ids.map((id) => {
      const option = possible.find((candidate) => candidate.id === id);
      if (!option) throw new ApiError(400, 'INVALID_OPTIONS', 'An item option is invalid.');
      return option;
    });
    for (const group of item.option_groups) {
      const selected = options.filter((option) => group.options.some((candidate) => candidate.id === option.id)).length;
      if (selected < group.min || selected > group.max) throw new ApiError(400, 'INVALID_OPTIONS', 'Choose the required number of item options.');
    }
    const unit = item.price_kobo + options.reduce((sum, option) => sum + option.price_kobo, 0);
    if (!Number.isSafeInteger(unit) || unit > 1000000000) throw new ApiError(400, 'AMOUNT_TOO_LARGE', 'The cart amount is too large.');
    return { menu_item_id: item.id, name: item.name, quantity: line.quantity, unit_price_kobo: unit, options, note: line.note };
  });
  const subtotal = items.reduce((sum, item) => sum + item.unit_price_kobo * item.quantity, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal > 1000000000) throw new ApiError(400, 'AMOUNT_TOO_LARGE', 'The cart amount is too large.');
  return { vendor_id: cart.vendor_id, items, subtotal_kobo: subtotal };
}

export function deliveryFee(city: Pick<CityPricing, 'base_fare_kobo' | 'per_km_rate_kobo' | 'minimum_delivery_fee_kobo'> & {surge_bps?:number}, distance: number): number {
  if (city.base_fare_kobo === null || city.per_km_rate_kobo === null) throw new ApiError(503, 'PRICING_NOT_CONFIGURED', 'Delivery pricing is not configured for this city.');
  const amount = BigInt(city.base_fare_kobo) + (BigInt(city.per_km_rate_kobo) * BigInt(distance) + 999n) / 1000n;
  const surged=(amount*BigInt(city.surge_bps??10000)+9999n)/10000n;
  const minimum = BigInt(city.minimum_delivery_fee_kobo);
  const rounded = ((surged > minimum ? surged : minimum) + 999n) / 1000n * 1000n; // Round up to ₦10.
  if (rounded > 1000000000n) throw new ApiError(400, 'AMOUNT_TOO_LARGE', 'Delivery amount is too large.');
  return Number(rounded);
}

export function insidePolygon(point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!; const b = polygon[j]!;
    const cross = (point.lng - a.lng) * (b.lat - a.lat) - (point.lat - a.lat) * (b.lng - a.lng);
    if (Math.abs(cross) < 1e-10 && point.lng >= Math.min(a.lng, b.lng) && point.lng <= Math.max(a.lng, b.lng) && point.lat >= Math.min(a.lat, b.lat) && point.lat <= Math.max(a.lat, b.lat)) return true;
    if ((a.lat > point.lat) !== (b.lat > point.lat) && point.lng < (b.lng - a.lng) * (point.lat - a.lat) / (b.lat - a.lat) + a.lng) inside = !inside;
  }
  return inside;
}

export function cityOpen(city: Pick<CityPricing, 'opens_at' | 'closes_at'>, now = new Date()): boolean {
  if (!city.opens_at || !city.closes_at) return true;
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
  return city.opens_at < city.closes_at ? time >= city.opens_at && time < city.closes_at : time >= city.opens_at || time < city.closes_at;
}

/** Stored weekly schedules use Nigerian local time; an empty schedule preserves existing stores. */
export function vendorHoursOpen(hours?: {day:number;open:boolean;from:string;to:string}[], now = new Date()): boolean {
  if (!hours?.length) return true;
  const local = new Date(now.getTime()+3600000), day=local.getUTCDay(), minute=local.getUTCHours()*60+local.getUTCMinutes();
  const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
  const current=hours.find(h=>h.day===day), previous=hours.find(h=>h.day===(day+6)%7);
  return Boolean(current?.open && (minutes(current.from)<minutes(current.to) ? minute>=minutes(current.from)&&minute<minutes(current.to) : minute>=minutes(current.from)) || previous?.open && minutes(previous.from)>minutes(previous.to) && minute<minutes(previous.to));
}
