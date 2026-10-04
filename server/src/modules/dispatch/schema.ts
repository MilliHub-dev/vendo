import { z } from 'zod';
import {promoCode} from '../extras/schema.js';
import { money, pointSchema, orderSchema } from '../food/schema.js';
import { phoneSchema } from '../auth/schema.js';

export const sizeSchema = z.enum(['document', 'small', 'large']);
export const addressSchema = pointSchema.extend({ address: z.string().trim().min(1).max(500), landmark: z.string().max(500).default(''), note: z.string().max(500).default('') });
export const packageSchema = z.strictObject({ size: sizeSchema, description: z.string().trim().min(3).max(500), fragile: z.boolean().default(false), fits_size: z.literal(true), prohibited_items_acknowledged: z.literal(true), weight_g: z.number().int().min(1).max(100000).optional(), dimensions_cm: z.strictObject({ length: z.number().positive().max(300), width: z.number().positive().max(300), height: z.number().positive().max(300) }).optional() });
export const receiverSchema = z.strictObject({ name: z.string().trim().min(2).max(100).refine((value) => !Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127), 'Invalid name.'), phone: phoneSchema });
export const receiverOutputSchema = receiverSchema.extend({ phone: z.string().regex(/^\+234[789]\d{9}$/) });
export const dispatchInputSchema = z.strictObject({ type: z.literal('dispatch'), promo_code:promoCode.optional(), city_id: z.uuid(), pickup: addressSchema, dropoff: addressSchema, package: packageSchema, receiver: receiverSchema });
export const sendAgainSchema = dispatchInputSchema.extend({ receiver: receiverOutputSchema, package: packageSchema.omit({ fits_size: true, prohibited_items_acknowledged: true }) });
export type SendAgain = z.infer<typeof sendAgainSchema>;
export type DispatchInput = z.infer<typeof dispatchInputSchema>;
export const dispatchSnapshotSchema = dispatchInputSchema.omit({promo_code:true}).extend({ receiver: receiverOutputSchema, distance_m: z.number().int().min(0), eta_minutes: z.number().int().min(1), base_fare_kobo: money, distance_fee_kobo: money, package_fee_kobo: money, minimum_adjustment_kobo: money, surge_fee_kobo:money.optional(), rounding_kobo: money, delivery_fee_kobo: money, surge_bps:z.number().int().min(10000).max(50000).optional(), discount_kobo: money, promo:z.object({id:z.uuid(),code:promoCode}).nullable().optional(), total_kobo: money });
export type DispatchSnapshot = z.infer<typeof dispatchSnapshotSchema>;
export const dispatchQuoteSchema = dispatchSnapshotSchema.extend({ id: z.uuid(), expires_at: z.string(), currency: z.literal('NGN') });
export type DispatchQuote = z.infer<typeof dispatchQuoteSchema>;
export const dispatchOrderSchema = orderSchema.omit({ type: true, quote: true }).extend({ type: z.literal('dispatch'), quote: dispatchSnapshotSchema });
export type DispatchOrder = z.infer<typeof dispatchOrderSchema>;
export const packageConfigSchema = z.strictObject({ size: sizeSchema, label: z.string().trim().min(1).max(100), fee_kobo: money, max_weight_g: z.number().int().min(1).max(100000), max_length_cm: z.number().positive().max(300), max_width_cm: z.number().positive().max(300), max_height_cm: z.number().positive().max(300), is_active: z.boolean().default(true) });
export type PackageConfig = z.infer<typeof packageConfigSchema>;
export type DispatchCity = { surge_bps?:number; id: string; is_active: boolean; base_fare_kobo: string | null; per_km_rate_kobo: string | null; minimum_delivery_fee_kobo: string; opens_at: string | null; closes_at: string | null; service_polygon: { lat: number; lng: number }[] | null; pricing_version: string };
export type ProtectedCode = { encrypted: string; hash: string };
export interface DispatchRepository {
  getCity(id: string): Promise<DispatchCity | null>;
  packages(cityId: string): Promise<PackageConfig[]>;
  savePackage(actorId: string, cityId: string, config: PackageConfig): Promise<PackageConfig>;
  saveQuote(userId: string, snapshot: DispatchSnapshot, version: string, config: PackageConfig, promoCode?:string): Promise<DispatchQuote>;
  createOrder(userId: string, quoteId: string, method: DispatchOrder['payment_method'], key: string, generateCode: (id: string) => ProtectedCode, scheduledAt?: string): Promise<DispatchOrder>;
  getCode(userId: string, orderId: string): Promise<string>;
  complete(riderId: string, orderId: string, hash: string): Promise<'delivered' | 'incorrect' | 'locked'>;
}
