/**
 * The Vendo API (EXPO_PUBLIC_API_URL, https://api.vendoltd.com), implementing ApiClient.
 * Each function translates between the app's shapes (camelCase) and the server's (snake_case);
 * the server's contract is in server/docs/openapi.json.
 */
import { openPaymentPage } from '@/lib/pay';
import { unregisterPush } from '@/lib/push';
import { useCity } from '@/store/city';

import type { ApiClient } from '../client';
import type { AppNotification, CancellationTerms, ChatMessage, City, MenuItem, MenuItemWithVendor, Order, OrderStatus, Place, Quote, QuoteRequest, ReferralSummary, SavedAddress, Tracking, User, Vendor, VendorCategory, Wallet, WalletTransaction } from '../types';
import { ApiError, request } from './request';
import { saveTokens } from './tokens';

// ---- server shapes (only the fields the app reads) ----
type SMe = { id: string; phone: string | null; name: string | null; email: string | null; onboarding_step: 'name_required' | 'email_required' | 'phone_required' | 'complete' };
type SCity = { id: string; name: string; is_active: boolean; is_open: boolean; service_area_configured: boolean };
type SVendor = { id: string; name: string; category: VendorCategory; cuisine: string; city_id: string; address: string; location: { lat: number; lng: number }; is_open: boolean; image_url: string | null; prep_minutes: number; rating: number };
type SOption = { id: string; name: string; price_kobo: number };
type SMenuItem = { id: string; vendor_id: string; name: string; description: string; price_kobo: number; category: string; is_available: boolean; image_url: string | null; option_groups: { id: string; name: string; min: number; max: number; options: SOption[] }[] };
type SPoint = { lat: number; lng: number; address: string; note?: string | null; landmark?: string | null };
type SQuote = {
  id?: string; type?: 'dispatch'; vendor_id?: string; vendor_name?: string; pickup: SPoint; dropoff: SPoint;
  items?: { menu_item_id: string; name: string; quantity: number; unit_price_kobo: number; options: SOption[]; note: string | null }[];
  package?: { size: 'document' | 'small' | 'large'; description: string }; receiver?: { name: string; phone: string };
  subtotal_kobo?: number; distance_m: number; eta_minutes: number; delivery_fee_kobo: number; discount_kobo: number; promo?: { code: string } | null; total_kobo: number;
};
type SOrder = { id: string; code: string; type: 'food' | 'dispatch'; status: OrderStatus; payment_status: 'unpaid' | 'paid'; payment_method: 'wallet' | 'card' | 'transfer' | 'ussd'; quote: SQuote; created_at: string; scheduled_at: string | null };
type STracking = { status: OrderStatus; rider: { id: string; name: string; plate_number: string | null; phone: string | null } | null; location: { lat: number; lng: number; heading: number | null } | null; eta: { distance_m: number; duration_s: number } | null };
type SPayment = { reference: string; status: 'initializing' | 'pending' | 'succeeded' | 'review'; authorization_url: string | null };
type SPage<T> = { items: T[] };
type SAddress = { id: string; label: string; address: string; location: { lat: number; lng: number }; landmark: string | null; note: string | null };

// ---- helpers ----
const cityId = () => {
  const id = useCity.getState().city?.id;
  if (!id) throw new ApiError('NO_CITY', 'Choose your city first.');
  return id;
};
let myId: string | null = null;
const place = (p: SPoint): Place => ({ lat: p.lat, lng: p.lng, address: p.address, note: p.note || p.landmark || undefined });
const toAddress = (a: SAddress): SavedAddress => ({ id: a.id, label: a.label, address: a.address, lat: a.location.lat, lng: a.location.lng, note: a.note || a.landmark || undefined });
const point = (p: Place) => ({ lat: p.lat, lng: p.lng, address: p.address, ...(p.note ? { note: p.note } : {}) });

const toVendor = (v: SVendor): Vendor => ({
  id: v.id, name: v.name, category: v.category, cuisine: v.cuisine, cityId: v.city_id, address: v.address, location: v.location, isOpen: v.is_open, rating: v.rating,
  // rider pickup and the ride come on top of the kitchen's preparation time
  etaMinutes: [v.prep_minutes + 10, v.prep_minutes + 25],
  imageUrl: v.image_url ?? undefined,
});
const toMenuItem = (m: SMenuItem): MenuItem => ({
  id: m.id, vendorId: m.vendor_id, name: m.name, description: m.description, priceKobo: m.price_kobo, category: m.category, isAvailable: m.is_available, imageUrl: m.image_url ?? undefined,
  optionGroups: m.option_groups.map((g) => ({ id: g.id, name: g.name, min: g.min, max: g.max, options: g.options.map((o) => ({ id: o.id, name: o.name, priceKobo: o.price_kobo })) })),
});
const toQuote = (q: SQuote): Quote => ({
  id: q.id, distanceMeters: q.distance_m, etaMinutes: q.eta_minutes, subtotalKobo: q.subtotal_kobo ?? 0, deliveryFeeKobo: q.delivery_fee_kobo, discountKobo: q.discount_kobo, totalKobo: q.total_kobo,
  discountLabel: q.discount_kobo > 0 ? (q.promo ? `Promo ${q.promo.code}` : 'Discount') : undefined,
});
function toOrder(o: SOrder): Order {
  const q = o.quote;
  return {
    id: o.id, code: o.code, type: o.type, status: o.status, createdAt: o.created_at, scheduledFor: o.scheduled_at ?? undefined,
    pickup: place(q.pickup), dropoff: place(q.dropoff),
    vendor: q.vendor_id ? { id: q.vendor_id, name: q.vendor_name ?? 'Vendor' } : undefined,
    items: (q.items ?? []).map((i) => ({ menuItemId: i.menu_item_id, name: i.name, unitPriceKobo: i.unit_price_kobo, quantity: i.quantity, note: i.note || undefined, options: i.options.map((x) => x.name).join(', ') || undefined })),
    packageSize: q.package?.size, packageNote: q.package?.description, receiver: q.receiver,
    subtotalKobo: q.subtotal_kobo ?? 0, deliveryFeeKobo: q.delivery_fee_kobo, discountKobo: q.discount_kobo, totalKobo: q.total_kobo,
    paymentMethod: o.payment_method === 'ussd' ? 'transfer' : o.payment_method, isPaid: o.payment_status === 'paid',
  };
}
const quoteBody = (body: QuoteRequest) =>
  body.type === 'food'
    ? { type: 'food', vendor_id: body.vendorId, items: body.items.map((i) => ({ menu_item_id: i.menuItemId, quantity: i.quantity, option_ids: i.optionIds ?? [], ...(i.note ? { note: i.note } : {}) })), dropoff: point(body.dropoff), ...(body.promoCode ? { promo_code: body.promoCode } : {}) }
    : {
        type: 'dispatch', city_id: cityId(), pickup: point(body.pickup), dropoff: point(body.dropoff),
        // the Send form states the size limits and the prohibited-items rule before the customer books
        package: { size: body.packageSize, description: body.packageNote?.trim() || 'Package', fragile: !!body.fragile, fits_size: true, prohibited_items_acknowledged: true },
        receiver: body.receiver,
      };

async function getMe(): Promise<{ me: SMe; user: User }> {
  const me = await request<SMe>('GET', '/v1/me');
  myId = me.id;
  const referral = me.onboarding_step === 'complete' ? await request<{ code: string }>('GET', '/v1/me/referrals').catch(() => null) : null;
  return { me, user: { id: me.id, name: me.name ?? '', phone: me.phone ?? '', email: me.email ?? '', cityId: useCity.getState().city?.id ?? '', referralCode: referral?.code ?? '' } };
}

/** Pays for an order: from the wallet straight away, otherwise on Paystack's page, then confirms with the server. */
async function pay(orderId: string, method: SOrder['payment_method']): Promise<void> {
  if (method === 'wallet') return void (await request('POST', `/v1/orders/${orderId}/pay/wallet`));
  const payment = await request<SPayment>('POST', '/v1/payments/orders', { body: { order_id: orderId }, idempotent: `pay-${orderId}` });
  if (payment.status === 'succeeded') return;
  if (!payment.authorization_url) throw new ApiError('PAYMENT_UNAVAILABLE', 'We couldn’t start the payment. Try again, or pay from your wallet.');
  await openPaymentPage(payment.authorization_url);
  const checked = await request<SPayment>('POST', `/v1/payments/${payment.reference}/verify`);
  if (checked.status !== 'succeeded') throw new ApiError('PAYMENT_PENDING', 'We haven’t received your payment yet. If you paid, it will show here shortly.');
}

async function menusOf(vendors: SVendor[], count: number) {
  const details = await Promise.all(vendors.slice(0, count).map((v) => request<{ vendor: SVendor; menu: SMenuItem[] }>('GET', `/v1/vendors/${v.id}`, { auth: false }).catch(() => null)));
  return details.filter((d) => d !== null);
}
const withVendor = (m: SMenuItem, vendor: SVendor): MenuItemWithVendor => ({ ...toMenuItem(m), vendorName: vendor.name });

async function referrals(): Promise<ReferralSummary> {
  const r = await request<{ code: string; enabled: boolean; pending: number; rewarded: number; earned_kobo: number; applied: boolean }>('GET', '/v1/me/referrals');
  return {
    code: r.code, shareUrl: `https://vendoltd.com/download/?ref=${encodeURIComponent(r.code)}`,
    // the server doesn't publish the reward amounts yet, so the screen leaves them out when they are 0
    referrerRewardKobo: 0, refereeDiscountKobo: 0, earnedKobo: r.earned_kobo,
    appliedCode: r.applied ? 'applied' : null, canApply: r.enabled && !r.applied, friends: [], pendingCount: r.pending, rewardedCount: r.rewarded,
  };
}

const walletLabel: Record<string, [WalletTransaction['purpose'], string]> = { top_up: ['topup', 'Wallet top-up'], checkout: ['order_payment', 'Order payment'], refund: ['refund', 'Refund'], referral: ['referral', 'Referral reward'] };
async function wallet(): Promise<Wallet> {
  const [balance, history] = await Promise.all([
    request<{ balance_kobo: number }>('GET', '/v1/wallet'),
    request<SPage<{ id: string; kind: string; reference: string; amount_kobo: number; created_at: string }>>('GET', '/v1/wallet/transactions', { query: { limit: 50 } }),
  ]);
  return {
    balanceKobo: balance.balance_kobo,
    transactions: history.items.map((t) => {
      const [purpose, label] = walletLabel[t.kind] ?? ['topup', 'Wallet'];
      return { id: t.id, direction: t.kind === 'checkout' || t.amount_kobo < 0 ? 'debit' : 'credit', amountKobo: Math.abs(t.amount_kobo), purpose, label, reference: t.reference, createdAt: t.created_at };
    }),
  };
}

export const httpApi: ApiClient = {
  // ---- account ----
  async requestCode(email) {
    await request('POST', '/v1/auth/email/otp/request', { auth: false, body: { email: email.trim().toLowerCase() } });
  },
  async verifyCode(email, code) {
    const t = await request<{ access_token: string; refresh_token: string }>('POST', '/v1/auth/email/otp/verify', { auth: false, body: { email: email.trim().toLowerCase(), token: code } });
    await saveTokens({ access: t.access_token, refresh: t.refresh_token });
    const { me, user } = await getMe();
    if (me.onboarding_step !== 'complete') return { token: t.access_token, user: null };
    // a returning customer: carry on in the city they used last
    const saved = await request<{ city: SCity | null }>('GET', '/v1/me/city').catch(() => null);
    if (saved?.city && !useCity.getState().city) useCity.getState().setCity({ id: saved.city.id, name: saved.city.name });
    return { token: t.access_token, user: { ...user, cityId: useCity.getState().city?.id ?? '' } };
  },
  async completeSignUp({ name, phone, referralCode }) {
    await request('PATCH', '/v1/me/name', { body: { name: name.trim() } });
    await request('PATCH', '/v1/me/phone', { body: { phone } });
    // a mistyped friend's code shouldn't stop the account being created; it can be added later from Referrals
    if (referralCode) await request('POST', '/v1/me/referrals/apply', { body: { code: referralCode.trim().toUpperCase() } }).catch(() => {});
    return (await getMe()).user;
  },
  getMe: async () => (await getMe()).user,
  async updateProfile({ name, phone }) {
    const { user } = await getMe();
    if (name.trim() !== user.name) await request('PATCH', '/v1/me/name', { body: { name: name.trim() } });
    if (phone !== user.phone) await request('PATCH', '/v1/me/phone', { body: { phone } });
    return (await getMe()).user;
  },
  async signOut() {
    await unregisterPush();
    await request('POST', '/v1/auth/logout', { body: { scope: 'local' } }).catch(() => {});
    myId = null;
    await saveTokens(null);
  },

  // ---- cities ----
  async listCities() {
    const { items } = await request<SPage<SCity>>('GET', '/v1/cities', { auth: false });
    return items.filter((c) => c.is_active && c.service_area_configured).map((c): City => ({ id: c.id, name: c.name, isActive: true, isOpen: c.is_open }));
  },
  async setCity(city) {
    await request('PATCH', '/v1/me/city', { body: { city_id: city.id } }).catch(() => {}); // remembered on the server for next sign-in; not needed to browse
  },

  // ---- places ----
  async searchPlaces(query) {
    const { items } = await request<SPage<{ name: string; address: string; location: { lat: number; lng: number } }>>('GET', '/v1/maps/search', { query: { city_id: cityId(), q: query.trim(), limit: 8 } });
    return items.map((p) => ({ address: p.address.toLowerCase().startsWith(p.name.toLowerCase()) ? p.address : `${p.name}, ${p.address}`, lat: p.location.lat, lng: p.location.lng }));
  },
  async listAddresses() {
    const { items } = await request<SPage<SAddress>>('GET', '/v1/me/addresses');
    return items.map(toAddress);
  },
  async saveAddress(label, p) {
    return toAddress(await request<SAddress>('POST', '/v1/me/addresses', { body: { city_id: cityId(), label, address: p.address, location: { lat: p.lat, lng: p.lng }, ...(p.note ? { note: p.note } : {}) } }));
  },
  async deleteAddress(id) {
    await request('DELETE', `/v1/me/addresses/${id}`);
  },

  // ---- food court ----
  async listVendors({ category } = {}) {
    const { items } = await request<SPage<SVendor>>('GET', '/v1/vendors', { auth: false, query: { city_id: cityId(), category, limit: 50 } });
    return items.map(toVendor);
  },
  async getVendor(id) {
    const d = await request<{ vendor: SVendor; menu: SMenuItem[] }>('GET', `/v1/vendors/${id}`, { auth: false });
    return { vendor: toVendor(d.vendor), menu: d.menu.map(toMenuItem) };
  },
  async listPicks() {
    const { items } = await request<SPage<SVendor>>('GET', '/v1/vendors', { auth: false, query: { city_id: cityId(), limit: 20 } });
    const open = items.filter((v) => v.is_open).sort((a, b) => b.rating - a.rating);
    return (await menusOf(open, 4)).flatMap((d) => d.menu.filter((m) => m.is_available).slice(0, 2).map((m) => withVendor(m, d.vendor)));
  },
  async search(query) {
    const q = query.trim();
    const { items } = await request<SPage<SVendor>>('GET', '/v1/vendors', { auth: false, query: { city_id: cityId(), q, limit: 20 } });
    const dishes = (await menusOf(items, 5)).flatMap((d) => d.menu.filter((m) => m.is_available && m.name.toLowerCase().includes(q.toLowerCase())).map((m) => withVendor(m, d.vendor)));
    return { vendors: items.map(toVendor), items: dishes };
  },

  // ---- ordering ----
  async checkPromo(code) {
    const tidy = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(tidy)) throw new ApiError('INVALID_PROMO', 'That doesn’t look like a promo code');
    // the server checks a code as part of pricing an order, so it is confirmed on the checkout screen
    return { code: tidy, description: 'We’ll check it when you check out' };
  },
  async quote(body) {
    return toQuote(await request<SQuote>('POST', '/v1/orders/quote', { body: quoteBody(body) }));
  },
  async createOrder(body) {
    const quote = await request<SQuote>('POST', '/v1/orders/quote', { body: quoteBody(body) });
    const order = await request<SOrder>('POST', '/v1/orders', { idempotent: true, body: { quote_id: quote.id, type: body.type, payment_method: body.paymentMethod, ...(body.scheduledFor ? { scheduled_at: body.scheduledFor } : {}) } });
    // The order now exists. If paying fails or is abandoned it stays "awaiting payment" and can be paid from its page.
    await pay(order.id, order.payment_method).catch(() => {});
    return this.getOrder(order.id);
  },
  async payOrder(id) {
    const order = await request<SOrder>('GET', `/v1/orders/${id}`);
    if (order.payment_status !== 'paid') await pay(id, order.payment_method);
    return this.getOrder(id);
  },
  async listOrders(filter) {
    const { items } = await request<SPage<SOrder>>('GET', '/v1/orders', { query: { status: filter, limit: 50 } });
    return items.map(toOrder);
  },
  async getOrder(id) {
    const raw = await request<SOrder>('GET', `/v1/orders/${id}`);
    const order = toOrder(raw);
    const withRider = ['rider_assigned', 'picked_up', 'on_the_way'].includes(raw.status);
    const [tracking, code, rating] = await Promise.all([
      withRider ? request<STracking>('GET', `/v1/orders/${id}/tracking`).catch(() => null) : null,
      raw.type === 'dispatch' && raw.payment_status === 'paid' && !['delivered', 'cancelled'].includes(raw.status) ? request<{ code: string }>('GET', `/v1/orders/${id}/delivery-code`).catch(() => null) : null,
      raw.status === 'delivered' ? request<{ service_rating: number }>('GET', `/v1/orders/${id}/rating`).catch(() => null) : null,
    ]);
    if (tracking?.rider) order.rider = { id: tracking.rider.id, name: tracking.rider.name, phone: tracking.rider.phone ?? '', plateNumber: tracking.rider.plate_number ?? '' };
    if (code) order.deliveryCode = code.code;
    if (rating) order.rating = rating.service_rating;
    return order;
  },
  async getTracking(orderId): Promise<Tracking> {
    const t = await request<STracking>('GET', `/v1/orders/${orderId}/tracking`);
    return { status: t.status, rider: t.location ? { lat: t.location.lat, lng: t.location.lng, heading: t.location.heading ?? 0 } : undefined, etaMinutes: t.eta ? Math.max(1, Math.ceil(t.eta.duration_s / 60)) : undefined, distanceMeters: t.eta?.distance_m };
  },
  async getCancellationTerms(id): Promise<CancellationTerms> {
    const t = await request<{ eligible: boolean; fee_kobo: number; refund_amount_kobo: number; reason: string | null }>('GET', `/v1/orders/${id}/cancellation`);
    return { canCancel: t.eligible, feeKobo: t.fee_kobo, refundKobo: t.refund_amount_kobo, reason: t.reason ?? undefined };
  },
  async cancelOrder(id, acceptedFeeKobo) {
    await request('POST', `/v1/orders/${id}/cancel`, { body: { reason: 'Cancelled by customer in the app', accepted_fee_kobo: acceptedFeeKobo } });
    return this.getOrder(id);
  },
  async rateOrder(id, rating, comment) {
    await request('POST', `/v1/orders/${id}/rating`, { body: { service_rating: rating, ...(comment?.trim() ? { comment: comment.trim() } : {}) } });
    return this.getOrder(id);
  },

  // ---- chat ----
  async listMessages(orderId) {
    if (!myId) await getMe();
    const chat = await request<{ messages: { id: string; seq: string; sender_id: string; text: string; created_at: string }[] }>('GET', `/v1/orders/${orderId}/chat`, { query: { limit: 100 } });
    const last = chat.messages.at(-1);
    if (last) void request('POST', `/v1/orders/${orderId}/chat/read`, { body: { seq: last.seq } }).catch(() => {});
    return chat.messages.map((m): ChatMessage => ({ id: m.id, orderId, from: m.sender_id === myId ? 'customer' : 'rider', text: m.text, createdAt: m.created_at }));
  },
  async sendMessage(orderId, text) {
    const m = await request<{ id: string; text: string; created_at: string }>('POST', `/v1/orders/${orderId}/chat/messages`, { idempotent: true, body: { text: text.trim() } });
    return { id: m.id, orderId, from: 'customer', text: m.text, createdAt: m.created_at };
  },

  // ---- wallet, notifications, referrals ----
  getWallet: wallet,
  async topUp(amountKobo, channel) {
    const payment = await request<SPayment>('POST', '/v1/wallet/top-ups', { idempotent: true, body: { amount_kobo: amountKobo, method: channel } });
    if (!payment.authorization_url) throw new ApiError('PAYMENT_UNAVAILABLE', 'We couldn’t start the payment. Please try again.');
    await openPaymentPage(payment.authorization_url);
    const checked = await request<SPayment>('POST', `/v1/payments/${payment.reference}/verify`);
    if (checked.status !== 'succeeded') throw new ApiError('PAYMENT_PENDING', 'We haven’t received your payment yet. If you paid, your balance will update shortly.');
    return wallet();
  },
  async listNotifications() {
    const { items } = await request<SPage<{ id: string; title: string; body: string; order_id: string | null; created_at: string }>>('GET', '/v1/me/notifications', { query: { limit: 50 } });
    return items.map((n): AppNotification => ({ id: n.id, title: n.title, body: n.body, createdAt: n.created_at, orderId: n.order_id ?? undefined }));
  },
  getReferrals: referrals,
  async applyReferralCode(code) {
    await request('POST', '/v1/me/referrals/apply', { body: { code: code.trim().toUpperCase() } });
    return referrals();
  },
};
