import { z } from 'zod';
import { categorySchema, pointSchema, vendorSchema, orderStatusSchema } from '../food/schema.js';
import type { AnyOrder } from '../orders/schema.js';
const image = z.url().refine(v => { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; }).nullable();
export const registrationInput = z.strictObject({ name: z.string().trim().min(2).max(150), category: categorySchema, cuisine: z.string().trim().max(120).default(''), city_id: z.uuid(), address: z.string().trim().min(5).max(500), location: pointSchema, description: z.string().trim().max(2000).default(''), image_url: image.default(null), logo_url: image.default(null), prep_minutes: z.number().int().min(1).max(180).default(20), document_ids: z.array(z.uuid()).max(5).default([]) }).refine(v => new Set(v.document_ids).size === v.document_ids.length, 'Duplicate documents.');
export type RegistrationInput = z.infer<typeof registrationInput>;
export const applicationSchema = z.object({ id: z.uuid(), profile_id: z.uuid(), status: z.enum(['pending', 'approved', 'rejected', 'withdrawn']), input: registrationInput, vendor_id: z.uuid().nullable(), review_note: z.string().nullable(), created_at: z.string(), reviewed_at: z.string().nullable() });
export type Application = z.infer<typeof applicationSchema>;
export const storeSchema = z.object({ ...vendorSchema.shape, description: z.string(), logo_url: image });
export type Store = z.infer<typeof storeSchema>;
export const storePatch = z.strictObject({ name: registrationInput.shape.name, cuisine: z.string().trim().max(120), address: registrationInput.shape.address, location: pointSchema, description: z.string().trim().max(2000), image_url: image, logo_url: image, prep_minutes: z.number().int().min(1).max(180) }).partial().refine(v => Object.keys(v).length > 0, 'Provide at least one field.').refine(v => (v.address === undefined) === (v.location === undefined), 'Change address and location together.');
export type StorePatch = z.infer<typeof storePatch>;
export const page = z.strictObject({ limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).max(10000).default(0) });
export const applicationQuery = page.extend({ status: z.enum(['pending', 'approved', 'rejected', 'withdrawn']).optional() });
export const orderQuery = page.extend({ status: orderStatusSchema.optional() });
export const summarySchema = z.object({ awaiting_vendor: z.number().int(), active_orders: z.number().int(), ready_orders: z.number().int(), delivered_orders: z.number().int(), menu_items: z.number().int(), available_items: z.number().int() });
export interface VendorRepository {
    register(user: string, input: RegistrationInput, key: string): Promise<Application>;
    applications(user: string, limit: number, offset: number, status?: Application['status'], admin?: boolean): Promise<Application[]>;
    review(admin: string, id: string, decision: 'approve' | 'reject', note: string): Promise<Application>;
    withdraw(user: string, id: string): Promise<Application>;
    stores(user: string, limit: number, offset: number): Promise<Store[]>;
    store(user: string, id: string): Promise<Store>;
    update(user: string, id: string, patch: StorePatch): Promise<Store>;
    orders(user: string, id: string, limit: number, offset: number, status?: string): Promise<AnyOrder[]>;
    order(user: string, store: string, id: string): Promise<AnyOrder>;
    summary(user: string, id: string): Promise<z.infer<typeof summarySchema>>;
}
