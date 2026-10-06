import type { Store, User, MenuItem, Order } from './types';
export type Row = Record<string, unknown>;
export const object = (value: unknown): Row => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected API response.'); return value as Row; };
export const string = (value: unknown) => typeof value === 'string' ? value : '';
export const number = (value: unknown) => { const n = Number(value); if (!Number.isFinite(n)) throw new Error('Invalid numeric API response.'); return n; };
export const array = (value: unknown) => { if (!Array.isArray(value)) throw new Error('Unexpected API list response.'); return value; };
export const user = (r: Row): User => ({ id: string(r.id), name: string(r.name), phone: string(r.phone), email: string(r.email) });
export function store(r: Row): Store {
 return { id: string(r.id), approval: r.is_active === false ? 'suspended' : 'approved', name: string(r.name), category: r.category as Store['category'], cuisine: string(r.cuisine), description: string(r.description), cityId: string(r.city_id), address: string(r.address), isOpen: r.is_open === true, hours: array(r.opening_hours ?? []) as Store['hours'], rating: number(r.rating ?? 0), ratingCount: 0, commissionRate: null, tier: 'Not assigned', logoUrl: string(r.logo_url) || undefined, bannerUrl: string(r.image_url) || undefined, location: object(r.location) as Store['location'], prepMinutes: number(r.prep_minutes) };
}
export function application(r: Row): Store | null {
 if (r.status === 'withdrawn') return null;
 const input = object(r.input);
 return { ...store({ ...input, id: r.id, is_active: true, is_open: false, rating: 0, opening_hours: input.opening_hours ?? [] }), approval: r.status === 'rejected' ? 'rejected' : 'under_review', approvalNote: string(r.review_note) || undefined };
}
export const item = (r: Row): MenuItem => ({ id: string(r.id), name: string(r.name), description: string(r.description), priceKobo: number(r.price_kobo), category: string(r.category), isAvailable: r.is_available === true, emoji: '🍽️', imageUrl: string(r.image_url) || undefined });
export function order(r: Row): Order {
 const quote = object(r.quote), status = string(r.status);
 const states: Record<string, Order['status']> = { awaiting_vendor: 'new', searching_rider: 'preparing', rider_assigned: 'preparing', picked_up: 'picked_up', on_the_way: 'picked_up', delivered: 'delivered', cancelled: 'cancelled', disputed: 'disputed' };
 return { id: string(r.id), code: string(r.code), status: r.vendor_ready_at && ['searching_rider','rider_assigned'].includes(status) ? 'ready' : states[status] ?? 'pending', customerName: 'Customer', items: array(quote.items).map(v => { const i=object(v); return {name:string(i.name),quantity:number(i.quantity),unitPriceKobo:number(i.unit_price_kobo),note:string(i.note)}; }), subtotalKobo:number(quote.subtotal_kobo), commissionKobo:r.vendor_commission_kobo==null?null:number(r.vendor_commission_kobo),payoutKobo:r.vendor_commission_kobo==null?null:number(quote.subtotal_kobo)-number(r.vendor_commission_kobo),respondBy:string(r.vendor_response_due_at)||undefined,createdAt:string(r.created_at),prepMinutes:r.vendor_prep_minutes == null ? undefined : number(r.vendor_prep_minutes),readyBy:r.vendor_prep_minutes&&r.vendor_accepted_at?new Date(Date.parse(string(r.vendor_accepted_at))+number(r.vendor_prep_minutes)*60000).toISOString():undefined,rejectReason:string(r.vendor_rejection_reason) || undefined };
}
