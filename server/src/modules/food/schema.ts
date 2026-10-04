import { z } from 'zod';
import {promoCode} from '../extras/schema.js';
import type { AnyOrder } from '../orders/schema.js';

export const money = z.number().int().min(0).max(1000000000);
export const pointSchema = z.strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export const categorySchema = z.enum(['restaurant', 'fast_food', 'drinks', 'groceries', 'pharmacy']);
export const optionGroupSchema = z.strictObject({ id: z.uuid(), name: z.string().trim().min(1).max(80), min: z.number().int().min(0).max(20), max: z.number().int().min(1).max(20), options: z.array(z.strictObject({ id: z.uuid(), name: z.string().trim().min(1).max(80), price_kobo: money })).min(1).max(20) }).refine((group) => group.min <= group.max && group.max <= group.options.length && new Set(group.options.map((option) => option.id)).size === group.options.length, 'Invalid option group limits or IDs.');
export const menuInputSchema = z.strictObject({ name: z.string().trim().min(1).max(150), description: z.string().max(1000).default(''), price_kobo: money, category: z.string().trim().min(1).max(80), is_available: z.boolean().default(true), image_url: z.url().nullable().default(null), option_groups: z.array(optionGroupSchema).max(10).default([]) }).refine((item) => new Set(item.option_groups.flatMap((group) => group.options.map((option) => option.id))).size === item.option_groups.reduce((sum, group) => sum + group.options.length, 0) && new Set(item.option_groups.map((group) => group.id)).size === item.option_groups.length, 'Option IDs must be unique.');
export const menuSchema = z.object({ id: z.uuid(), vendor_id: z.uuid(), ...menuInputSchema.shape });
export type MenuItem = z.infer<typeof menuSchema>;
export const vendorInputSchema = z.strictObject({ name: z.string().trim().min(1).max(150), category: categorySchema, cuisine: z.string().max(120).default(''), city_id: z.uuid(), address: z.string().trim().min(1).max(500), location: pointSchema, is_open: z.boolean().default(false), is_active: z.boolean().default(true), image_url: z.url().nullable().default(null), prep_minutes: z.number().int().min(1).max(180).default(20) });
export const vendorSchema = vendorInputSchema.extend({ id: z.uuid(), description:z.string().optional(),logo_url:z.url().nullable().optional(), rating: z.number().min(0).max(5), distance_m: z.number().nullable().optional() });
export type Vendor = z.infer<typeof vendorSchema>;
export const listSchema = z.strictObject({ city_id: z.uuid(), q: z.string().trim().max(100).default(''), category: categorySchema.optional(), lat: z.coerce.number().min(-90).max(90).optional(), lng: z.coerce.number().min(-180).max(180).optional(), limit: z.coerce.number().int().min(1).max(50).default(20), offset: z.coerce.number().int().min(0).max(10000).default(0) }).refine((value) => (value.lat === undefined) === (value.lng === undefined), 'Provide both latitude and longitude.');
export type VendorSearch = z.infer<typeof listSchema>;
export const cartSchema = z.strictObject({ vendor_id: z.uuid(), items: z.array(z.strictObject({ menu_item_id: z.uuid(), quantity: z.number().int().min(1).max(99), option_ids: z.array(z.uuid()).max(100).default([]), note: z.string().max(500).default('') })).min(1).max(50) });
export type Cart = z.infer<typeof cartSchema>;
export const pricedItemSchema = z.object({ menu_item_id: z.uuid(), name: z.string(), quantity: z.number().int(), unit_price_kobo: money, options: z.array(z.object({ id: z.uuid(), name: z.string(), price_kobo: money })), note: z.string() });
export const pricedCartSchema = z.object({ vendor_id: z.uuid(), items: z.array(pricedItemSchema), subtotal_kobo: money });
export type PricedCart = z.infer<typeof pricedCartSchema>;
export const quoteInputSchema = cartSchema.extend({ type: z.literal('food'), promo_code:promoCode.optional(), dropoff: pointSchema.extend({ address: z.string().trim().min(1).max(500), note: z.string().max(500).default('') }) });
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export const quoteSnapshotSchema = pricedCartSchema.extend({ city_id: z.uuid(), vendor_name: z.string(), pickup: pointSchema.extend({ address: z.string() }), dropoff: quoteInputSchema.shape.dropoff, distance_m: z.number().int().min(0), eta_minutes: z.number().int().min(1), delivery_fee_kobo: money, surge_bps:z.number().int().min(10000).max(50000).optional(), discount_kobo: money, promo:z.object({id:z.uuid(),code:promoCode}).nullable().optional(), total_kobo: money });
export type QuoteSnapshot = z.infer<typeof quoteSnapshotSchema>;
export const quoteSchema = quoteSnapshotSchema.extend({ id: z.uuid(), expires_at: z.string(), currency: z.literal('NGN') });
export type Quote = z.infer<typeof quoteSchema>;
export const orderInputSchema = z.strictObject({ quote_id: z.uuid(), payment_method: z.enum(['wallet', 'card', 'transfer', 'ussd']) });
export const orderStatusSchema = z.enum(['pending_payment', 'scheduled', 'awaiting_vendor', 'searching_rider', 'rider_assigned', 'picked_up', 'on_the_way', 'delivered', 'cancelled', 'disputed']);
export const orderSchema = z.object({ id: z.uuid(), code: z.string(), type: z.literal('food'), status: orderStatusSchema, payment_status: z.enum(['unpaid', 'paid']), payment_method: orderInputSchema.shape.payment_method, refund_status: z.enum(['none', 'pending', 'refunded']), quote: quoteSnapshotSchema, created_at: z.string(), vendor_ready_at: z.string().nullable(), scheduled_at: z.string().nullable().default(null), processing_due_at: z.string().nullable().default(null), picked_up_at: z.string().nullable().default(null), delivered_at: z.string().nullable().default(null), cancelled_at: z.string().nullable().default(null), status_updated_at: z.string().optional() });
export type FoodOrder = z.infer<typeof orderSchema>;
export type CityPricing = { surge_bps?:number; id: string; is_active: boolean; base_fare_kobo: string | null; per_km_rate_kobo: string | null; minimum_delivery_fee_kobo: string; minimum_food_subtotal_kobo: string; service_polygon: { lat: number; lng: number }[] | null; opens_at: string | null; closes_at: string | null; pricing_version: string };
export const routeGeometrySchema = z.object({ type: z.literal('LineString'), coordinates: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(2).max(10000) });
export interface Routing { route(pickup: z.infer<typeof pointSchema>, dropoff: z.infer<typeof pointSchema>): Promise<{ distance_m: number; duration_s: number; geometry?: z.infer<typeof routeGeometrySchema> }> }
export interface FoodRepository {
  listVendors(search: VendorSearch): Promise<{ items: Vendor[]; total: number }>;
  getVendor(id: string): Promise<{ vendor: Vendor; menu: MenuItem[] } | null>;
  getCity(id: string): Promise<CityPricing | null>;
  saveVendor(actorId: string, input: z.infer<typeof vendorInputSchema>, id?: string): Promise<Vendor>;
  saveMenu(actorId: string, vendorId: string, input: z.infer<typeof menuInputSchema>, id?: string): Promise<MenuItem>;
  assignStaff(actorId: string, vendorId: string, staffId: string): Promise<void>;
  saveQuote(userId: string, snapshot: QuoteSnapshot, pricingVersion: string, promoCode?:string): Promise<Quote>;
  createOrder(userId: string, quoteId: string, method: FoodOrder['payment_method'], key: string, scheduledAt?: string): Promise<FoodOrder>;
  listOrders(userId: string, filter: 'active' | 'past', limit: number, offset: number): Promise<AnyOrder[]>;
  getOrder(userId: string, id: string): Promise<AnyOrder | null>;
  vendorAction(actorId: string, id: string, action: 'accept' | 'reject' | 'ready'): Promise<FoodOrder>;
}
