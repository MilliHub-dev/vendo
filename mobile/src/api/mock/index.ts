/**
 * In-memory stand-in for the backend. It behaves like the real thing in the ways screens
 * care about: network delay, server-side pricing, and orders that progress on their own.
 * State resets when the app reloads.
 */
import type { ApiClient } from '../client';
import type { AppNotification, ChatMessage, CreateOrderRequest, Order, OrderStatus, Promo, Quote, QuoteRequest, ReferralSummary, Tracking, User, WalletTransaction } from '../types';
import { distanceMeters } from '@/lib/geo';

import { me, menuItems, savedAddresses, vendors } from './data';

const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- pricing (the real server owns this; numbers here are placeholders) ----
const BASE_FARE_KOBO = 50_000;
const PER_KM_KOBO = 15_000;
const SIZE_SURCHARGE = { document: 0, small: 20_000, large: 50_000 } as const;

/** Fare rounded up to the nearest ₦10, as the dev guide specifies. */
const roundUpTo10Naira = (kobo: number) => Math.ceil(kobo / 1000) * 1000;

// ---- promo codes and referrals (placeholder rules — the real ones are set in the admin dashboard) ----
type PromoRule = Promo & { discount: (subtotalKobo: number, deliveryFeeKobo: number) => number };
const promos: PromoRule[] = [
  { code: 'VENDO10', description: '10% off your food, up to ₦1,000', discount: (subtotal) => Math.min(Math.round(subtotal * 0.1), 100_000) },
  { code: 'FREEDEL', description: 'Free delivery on this order', discount: (_subtotal, fee) => fee },
];
const findPromo = (code: string) => promos.find((p) => p.code === code.trim().toUpperCase());

const REFERRER_REWARD_KOBO = 50_000; // ₦500 wallet credit
const REFEREE_DISCOUNT_KOBO = 50_000; // ₦500 off the first order
const knownReferralCodes = new Set(['AMINA24', 'VENDO2026']);
/** user id → the referral code they signed up with */
const referredBy = new Map<string, string>();
const hasOrdered = () => orders.some((o) => o.status !== 'cancelled');

/** One discount per order: a promo code if given, otherwise the referral welcome discount on a first order. */
function discountFor(promoCode: string | undefined, subtotalKobo: number, deliveryFeeKobo: number): { discountKobo: number; discountLabel?: string } {
  if (promoCode) {
    const promo = findPromo(promoCode);
    if (!promo) throw new ApiError('invalid_promo', 'That promo code isn’t valid');
    return { discountKobo: promo.discount(subtotalKobo, deliveryFeeKobo), discountLabel: `Promo ${promo.code}` };
  }
  if (referredBy.has(currentUser.id) && !hasOrdered()) {
    return { discountKobo: Math.min(REFEREE_DISCOUNT_KOBO, subtotalKobo + deliveryFeeKobo), discountLabel: 'Referral welcome discount' };
  }
  return { discountKobo: 0 };
}

function price(body: QuoteRequest): Quote {
  if (body.type === 'food') {
    const vendor = vendors.find((v) => v.id === body.vendorId);
    if (!vendor) throw new ApiError('not_found', 'Vendor not found');
    const subtotalKobo = body.items.reduce((sum, line) => {
      const item = menuItems.find((m) => m.id === line.menuItemId && m.vendorId === vendor.id);
      if (!item || !item.isAvailable) throw new ApiError('item_unavailable', 'An item in your cart is no longer available');
      return sum + item.priceKobo * line.quantity;
    }, 0);
    const meters = distanceMeters(vendor.location, body.dropoff);
    const discount = discountFor(body.promoCode, subtotalKobo, vendor.deliveryFeeKobo);
    return { distanceMeters: meters, etaMinutes: vendor.etaMinutes[1], subtotalKobo, deliveryFeeKobo: vendor.deliveryFeeKobo, ...discount, totalKobo: subtotalKobo + vendor.deliveryFeeKobo - discount.discountKobo };
  }
  const meters = distanceMeters(body.pickup, body.dropoff);
  const deliveryFeeKobo = roundUpTo10Naira(BASE_FARE_KOBO + (PER_KM_KOBO * meters) / 1000 + SIZE_SURCHARGE[body.packageSize]);
  const discount = discountFor(undefined, 0, deliveryFeeKobo);
  return { distanceMeters: meters, etaMinutes: Math.max(10, Math.round(meters / 400)), subtotalKobo: 0, deliveryFeeKobo, ...discount, totalKobo: deliveryFeeKobo - discount.discountKobo };
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// ---- state ----
const orders: Order[] = [];
let walletBalanceKobo = 1_500_000; // ₦15,000
let sequence = 1;
const transactions: WalletTransaction[] = [
  { id: 'txn-0', direction: 'credit', amountKobo: 1_500_000, purpose: 'topup', label: 'Wallet top-up', reference: 'VD-TOPUP-0001', createdAt: new Date(Date.now() - 86_400_000).toISOString() },
];
const record = (direction: 'credit' | 'debit', amountKobo: number, purpose: WalletTransaction['purpose'], label: string) => {
  walletBalanceKobo += direction === 'credit' ? amountKobo : -amountKobo;
  transactions.unshift({ id: `txn-${transactions.length}`, direction, amountKobo, purpose, label, reference: `VD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`, createdAt: new Date().toISOString() });
};

const rider = { id: 'rider-1', name: 'Musa Ibrahim', phone: '+2348031111111', rating: 4.9, plateNumber: 'KAD 482 QR' };

/** After payment an order walks through its statuses so tracking screens have something to show. */
const timeline: { after: number; status: OrderStatus }[] = [
  { after: 0, status: 'searching_rider' },
  { after: 6_000, status: 'rider_assigned' },
  { after: 20_000, status: 'picked_up' },
  { after: 26_000, status: 'on_the_way' },
  { after: 60_000, status: 'delivered' },
];
const startedAt = new Map<string, number>();

function refresh(order: Order): Order {
  const start = startedAt.get(order.id);
  if (start === undefined || order.status === 'cancelled') return order;
  const elapsed = Date.now() - start;
  const step = [...timeline].reverse().find((t) => elapsed >= t.after);
  if (step) order.status = step.status;
  if (order.status !== 'searching_rider') order.rider = rider;
  return order;
}

/** Responses are copies, like JSON from a real server — the stored order keeps changing underneath. */
const snapshot = (order: Order): Order => ({ ...order });

const find = (id: string) => {
  const order = orders.find((o) => o.id === id);
  if (!order) throw new ApiError('not_found', 'Order not found');
  return refresh(order);
};

// ---- chat with the rider ----
const chats = new Map<string, ChatMessage[]>();
const riderReplies = ['Okay, noted 👍', 'No problem, I’ll call when I’m outside.', 'Alright. I’m on my way.', 'Got it, thank you.'];
const chatOpen = (status: OrderStatus) => ['rider_assigned', 'picked_up', 'on_the_way'].includes(status);
const addMessage = (orderId: string, from: ChatMessage['from'], text: string): ChatMessage => {
  const list = chats.get(orderId) ?? [];
  const message = { id: `msg-${orderId}-${list.length}`, orderId, from, text, createdAt: new Date().toISOString() };
  chats.set(orderId, [...list, message]);
  return message;
};
/** The thread for an order; the rider says hello once they're assigned. */
function thread(order: Order): ChatMessage[] {
  if (order.rider && !chats.has(order.id)) addMessage(order.id, 'rider', `Hello, I’m ${order.rider.name.split(' ')[0]}, your Vendo rider. Message me here if there’s anything I should know.`);
  return chats.get(order.id) ?? [];
}

/** In the mock, every phone number receives this code. */
export const MOCK_SMS_CODE = '123456';
let pendingPhone: string | null = null;
let currentUser: User = me;

export const mockApi: ApiClient = {
  async requestCode(phone) {
    await delay(600);
    if (!/^\+234[789]\d{9}$/.test(phone)) throw new ApiError('invalid_phone', 'Enter a valid Nigerian phone number');
    pendingPhone = phone;
  },

  async verifyCode(phone, code) {
    await delay(600);
    if (phone !== pendingPhone) throw new ApiError('no_code_requested', 'Request a new code');
    if (code !== MOCK_SMS_CODE) throw new ApiError('wrong_code', 'That code is not correct');
    // a number we know logs straight in; any other number is a new sign-up
    return { token: 'mock-token', user: phone === me.phone ? me : null };
  },

  async completeSignUp({ name, email, referralCode }) {
    await delay(600);
    if (!pendingPhone) throw new ApiError('not_verified', 'Verify your phone number first');
    const friendCode = referralCode?.trim().toUpperCase();
    if (friendCode && !knownReferralCodes.has(friendCode)) throw new ApiError('invalid_referral', 'That referral code isn’t valid');
    currentUser = { id: 'user-new', name: name.trim(), email: email.trim().toLowerCase(), phone: pendingPhone, cityId: me.cityId, referralCode: 'VENDO' + pendingPhone.slice(-4) };
    if (friendCode) referredBy.set(currentUser.id, friendCode);
    return currentUser;
  },

  async getMe() {
    await delay();
    return currentUser;
  },

  async updateProfile({ name, email }) {
    await delay(500);
    currentUser = { ...currentUser, name: name.trim(), email: email.trim().toLowerCase() };
    return currentUser;
  },

  async listVendors({ category } = {}) {
    await delay();
    return vendors.filter((v) => v.cityId === currentUser.cityId && (!category || v.category === category));
  },

  async listPicks() {
    await delay();
    return ['m-6', 'm-3', 'm-15', 'm-11', 'm-2', 'm-7'].map((id) => {
      const m = menuItems.find((x) => x.id === id)!;
      return { ...m, vendorName: vendors.find((v) => v.id === m.vendorId)!.name };
    });
  },

  async search(query) {
    await delay(250);
    const q = query.trim().toLowerCase();
    if (!q) return { vendors: [], items: [] };
    return {
      vendors: vendors.filter((v) => v.name.toLowerCase().includes(q) || v.cuisine.toLowerCase().includes(q)),
      items: menuItems
        .filter((m) => m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q))
        .map((m) => ({ ...m, vendorName: vendors.find((v) => v.id === m.vendorId)!.name })),
    };
  },

  async getVendor(id) {
    await delay();
    const vendor = vendors.find((v) => v.id === id);
    if (!vendor) throw new ApiError('not_found', 'Vendor not found');
    return { vendor, menu: menuItems.filter((m) => m.vendorId === id) };
  },

  async checkPromo(code) {
    await delay(400);
    const promo = findPromo(code);
    if (!promo) throw new ApiError('invalid_promo', 'That promo code isn’t valid');
    return { code: promo.code, description: promo.description };
  },

  async quote(body) {
    await delay();
    return price(body);
  },

  async createOrder(body: CreateOrderRequest) {
    await delay(700);
    const quote = price(body); // the server always re-prices; client totals are never trusted
    if (body.paymentMethod === 'wallet') {
      if (walletBalanceKobo < quote.totalKobo) throw new ApiError('insufficient_funds', 'Your wallet balance is too low for this order');
      record('debit', quote.totalKobo, 'order_payment', body.type === 'food' ? 'Food order' : 'Dispatch');
    }
    const id = `order-${sequence++}`;
    const vendor = body.type === 'food' ? vendors.find((v) => v.id === body.vendorId)! : undefined;
    const order: Order = {
      id,
      code: `VD-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      type: body.type,
      status: body.scheduledFor ? 'scheduled' : 'searching_rider',
      createdAt: new Date().toISOString(),
      scheduledFor: body.scheduledFor,
      pickup: body.type === 'food' ? { ...vendor!.location, address: vendor!.address } : body.pickup,
      dropoff: body.dropoff,
      vendor: vendor && { id: vendor.id, name: vendor.name },
      items:
        body.type === 'food'
          ? body.items.map((line) => {
              const m = menuItems.find((x) => x.id === line.menuItemId)!;
              return { menuItemId: m.id, name: m.name, unitPriceKobo: m.priceKobo, quantity: line.quantity };
            })
          : [],
      packageSize: body.type === 'dispatch' ? body.packageSize : undefined,
      packageNote: body.packageNote,
      receiver: body.receiver,
      subtotalKobo: quote.subtotalKobo,
      deliveryFeeKobo: quote.deliveryFeeKobo,
      discountKobo: quote.discountKobo,
      totalKobo: quote.totalKobo,
      paymentMethod: body.paymentMethod,
      deliveryCode: body.type === 'dispatch' ? String(Math.floor(1000 + Math.random() * 9000)) : undefined,
    };
    orders.unshift(order);
    if (!body.scheduledFor) startedAt.set(id, Date.now());
    return snapshot(order);
  },

  async listOrders(filter) {
    await delay();
    const active = (s: OrderStatus) => !['delivered', 'cancelled', 'disputed'].includes(s);
    return orders.map(refresh).filter((o) => (filter === 'active' ? active(o.status) : !active(o.status))).map(snapshot);
  },

  async getOrder(id) {
    await delay();
    return snapshot(find(id));
  },

  async getTracking(orderId): Promise<Tracking> {
    await delay(150);
    const order = find(orderId);
    const start = startedAt.get(orderId);
    if (!order.rider || start === undefined) return { status: order.status };
    // the rider glides from pickup to drop-off between "picked up" and "delivered"
    const t = Math.min(1, Math.max(0, (Date.now() - start - 20_000) / 40_000));
    const lat = order.pickup.lat + (order.dropoff.lat - order.pickup.lat) * t;
    const lng = order.pickup.lng + (order.dropoff.lng - order.pickup.lng) * t;
    const remaining = distanceMeters({ lat, lng }, order.dropoff);
    return { status: order.status, rider: { lat, lng, heading: 0 }, distanceMeters: remaining, etaMinutes: Math.ceil(remaining / 400) };
  },

  async cancelOrder(id) {
    await delay();
    const order = find(id);
    if (['picked_up', 'on_the_way', 'delivered'].includes(order.status)) throw new ApiError('too_late', 'This order can no longer be cancelled');
    order.status = 'cancelled';
    if (order.paymentMethod === 'wallet') record('credit', order.totalKobo, 'refund', `Refund · ${order.code}`);
    return snapshot(order);
  },

  async rateOrder(id, rating) {
    await delay();
    const order = find(id);
    if (order.status !== 'delivered') throw new ApiError('not_delivered', 'You can rate an order once it is delivered');
    order.rating = Math.min(5, Math.max(1, Math.round(rating)));
    return snapshot(order);
  },

  async listMessages(orderId) {
    await delay(150);
    return thread(find(orderId));
  },

  async sendMessage(orderId, text) {
    await delay(200);
    const order = find(orderId);
    const body = text.trim();
    if (!body) throw new ApiError('empty_message', 'Type a message first');
    if (!order.rider || !chatOpen(order.status)) throw new ApiError('chat_closed', 'This chat is closed');
    thread(order);
    const message = addMessage(orderId, 'customer', body.slice(0, 500));
    // the stand-in rider answers a moment later
    setTimeout(() => addMessage(orderId, 'rider', riderReplies[(chats.get(orderId)?.length ?? 0) % riderReplies.length]), 2500);
    return message;
  },

  async getWallet() {
    await delay();
    return { balanceKobo: walletBalanceKobo, transactions: [...transactions] };
  },

  async topUp(amountKobo) {
    await delay(900); // stands in for the Paystack checkout + webhook
    if (!Number.isInteger(amountKobo) || amountKobo < 10_000) throw new ApiError('invalid_amount', 'The minimum top-up is ₦100');
    record('credit', amountKobo, 'topup', 'Wallet top-up');
    return { balanceKobo: walletBalanceKobo, transactions: [...transactions] };
  },

  async getReferrals() {
    await delay();
    return referralSummary();
  },

  async applyReferralCode(code) {
    await delay(500);
    const friendCode = code.trim().toUpperCase();
    if (referredBy.has(currentUser.id)) throw new ApiError('already_referred', 'You’ve already used a referral code');
    if (hasOrdered()) throw new ApiError('too_late', 'Referral codes can only be added before your first order');
    if (friendCode === currentUser.referralCode) throw new ApiError('own_code', 'You can’t use your own code');
    if (!knownReferralCodes.has(friendCode)) throw new ApiError('invalid_referral', 'That referral code isn’t valid');
    referredBy.set(currentUser.id, friendCode);
    return referralSummary();
  },

  async listNotifications() {
    await delay();
    const fromOrders: AppNotification[] = orders.map(refresh).map((o) => ({
      id: `n-${o.id}`,
      title: o.status === 'delivered' ? 'Delivered' : o.status === 'cancelled' ? 'Order cancelled' : 'Order update',
      body: `${o.vendor?.name ?? 'Your dispatch'} (${o.code}) — ${o.status.replace(/_/g, ' ')}.`,
      createdAt: o.createdAt,
      orderId: o.id,
    }));
    return [...fromOrders, { id: 'n-welcome', title: 'Welcome to Vendo 👋', body: 'Order food or send a package — and track every delivery live.', createdAt: new Date(Date.now() - 3_600_000).toISOString() }];
  },
};

function referralSummary(): ReferralSummary {
  // the demo account has two sample friends; new accounts start empty
  const friends: ReferralSummary['friends'] =
    currentUser.id === me.id
      ? [
          { name: 'Zainab M.', status: 'rewarded', joinedAt: new Date(Date.now() - 6 * 86_400_000).toISOString() },
          { name: 'Emeka O.', status: 'joined', joinedAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
        ]
      : [];
  return {
    code: currentUser.referralCode,
    shareUrl: `https://vendoltd.com/download/?ref=${currentUser.referralCode}`,
    referrerRewardKobo: REFERRER_REWARD_KOBO,
    refereeDiscountKobo: REFEREE_DISCOUNT_KOBO,
    earnedKobo: friends.filter((f) => f.status === 'rewarded').length * REFERRER_REWARD_KOBO,
    appliedCode: referredBy.get(currentUser.id) ?? null,
    canApply: !referredBy.has(currentUser.id) && !hasOrdered(),
    friends,
  };
}

/** Mock only: lets the saved session put its user back after an app reload. */
export function hydrateMockUser(user: User) {
  currentUser = user;
}

export { savedAddresses };
