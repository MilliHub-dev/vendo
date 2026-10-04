import { z } from 'zod';
import { pointSchema } from '../food/schema.js';
import { isSimplePolygon, type Point } from '../../lib/geo.js';

export const polygonSchema = z.array(pointSchema).min(3).max(500).refine(isSimplePolygon, 'Use a simple, nonzero-area polygon without crossing edges.');
export type ServiceCity = { id: string; name: string; country: string; is_active: boolean; opens_at: string | null; closes_at: string | null; service_polygon: Point[] | null };
export const citySchema = z.object({ id: z.uuid(), name: z.string(), country: z.string(), is_active: z.boolean(), is_open: z.boolean(), service_area_configured: z.boolean(), opens_at: z.string().nullable(), closes_at: z.string().nullable() });
export const addressInputSchema = z.strictObject({ city_id: z.uuid(), label: z.string().trim().min(1).max(80), address: z.string().trim().min(1).max(500), location: pointSchema, landmark: z.string().max(500).default(''), note: z.string().max(500).default(''), is_default: z.boolean().default(false) });
export type AddressInput = z.infer<typeof addressInputSchema>;
export const addressPatchSchema = addressInputSchema.omit({ landmark: true, note: true, is_default: true }).partial().extend({ landmark: z.string().max(500).optional(), note: z.string().max(500).optional(), is_default: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0, 'Provide at least one field.');
export type AddressPatch = z.infer<typeof addressPatchSchema>;
export const addressSchema = addressInputSchema.extend({ city_id: z.uuid().nullable(), id: z.uuid(), created_at: z.string(), updated_at: z.string() });
export type SavedAddress = z.infer<typeof addressSchema>;
export const searchSchema = z.strictObject({ city_id: z.uuid(), q: z.string().trim().min(3).max(120), lat: z.coerce.number().min(-90).max(90).optional(), lng: z.coerce.number().min(-180).max(180).optional(), limit: z.coerce.number().int().min(1).max(10).default(5) }).refine((value) => (value.lat === undefined) === (value.lng === undefined), 'Provide both coordinates.');
export const reverseSchema = z.strictObject({ city_id: z.uuid(), lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });
export const placeSchema = z.object({ id: z.string(), name: z.string(), address: z.string(), location: pointSchema, city_id: z.uuid().optional() });
export type Place = z.infer<typeof placeSchema>;
export interface Geocoder {
  search(input: { q: string; limit: number; bias: Point; bbox: [number, number, number, number] }): Promise<Place[]>;
  reverse(point: Point): Promise<Place[]>;
}
export interface AddressRepository {
  cities(): Promise<ServiceCity[]>;
  city(id: string): Promise<ServiceCity | null>;
  saveBoundary(actorId: string, cityId: string, polygon: Point[]): Promise<ServiceCity>;
  list(userId: string): Promise<SavedAddress[]>;
  get(userId: string, id: string): Promise<SavedAddress | null>;
  save(userId: string, input: AddressInput | AddressPatch, id?: string): Promise<SavedAddress>;
  delete(userId: string, id: string): Promise<void>;
  preferredCity(userId: string): Promise<string | null>;
  setCity(userId: string, cityId: string | null): Promise<void>;
}
