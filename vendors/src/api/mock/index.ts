/**
 * In-memory stand-in for the backend so the whole vendor dashboard can be used before the
 * server is connected: a store that gets reviewed, orders that arrive while the store is
 * open and move on once a rider collects them, a menu you can edit, sales that add up.
 * State resets when the app reloads. Names, dishes and amounts are invented sample data.
 */
import type { ApiClient } from '../client';
import type { DayHours, MenuItem, Order, Payout, Review, Store, User } from '../types';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
const iso = (msFromNow = 0) => new Date(Date.now() + msFromNow).toISOString();
const DAY = 86_400_000;
const snapshot = <T>(value: T): T => (value && typeof value === 'object' ? (JSON.parse(JSON.stringify(value)) as T) : value);

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** In the mock, every phone number receives this code. */
export const MOCK_SMS_CODE = '123456';
/** How long a store has to accept or reject a new order. Placeholder — the server sets the real limit. */
const RESPOND_SECONDS = 120;
const COMMISSION_RATE = 0.15; // default from VENDO_DEVELOPMENT.md; set per vendor in the admin dashboard

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const defaultHours = (): DayHours[] => Array.from({ length: 7 }, (_, day) => ({ day, open: day !== 0, from: '08:00', to: '21:00' }));

const demoUser: User = { id: 'vendor-1', name: 'Hauwa Sani', phone: '+2348032222222', email: 'hauwa@example.com' };
const demoStore = (): Store => ({
  id: 'store-1', approval: 'approved', name: 'Arewa Kitchen', category: 'restaurant', cuisine: 'Northern Nigerian',
  description: 'Home-style northern dishes, cooked fresh every day.', cityId: 'kaduna', address: 'Kawo Road, Kaduna', isOpen: false,
  hours: defaultHours(), rating: 4.8, ratingCount: 312, commissionRate: COMMISSION_RATE, tier: 'standard',
});
const demoMenu = (): MenuItem[] => [
  { id: 'm-1', name: 'Tuwo Shinkafa & Miyan Kuka', description: 'Soft rice swallow with baobab-leaf soup and beef.', priceKobo: 250_000, category: 'Popular', isAvailable: true, emoji: '🍲' },
  { id: 'm-2', name: 'Masa (6 pieces)', description: 'Fluffy rice cakes served with spicy yaji.', priceKobo: 120_000, category: 'Popular', isAvailable: true, emoji: '🥞' },
  { id: 'm-3', name: 'Jollof Rice & Chicken', description: 'Smoky party jollof with grilled chicken.', priceKobo: 300_000, category: 'Rice', isAvailable: true, emoji: '🍛' },
  { id: 'm-4', name: 'Fried Rice & Beef', description: 'Vegetable fried rice with peppered beef.', priceKobo: 300_000, category: 'Rice', isAvailable: false, emoji: '🍚' },
  { id: 'm-5', name: 'Kunu Aya', description: 'Chilled tiger-nut drink, 50cl.', priceKobo: 70_000, category: 'Drinks', isAvailable: true, emoji: '🥛' },
];

const cities = [
  { id: 'kaduna', name: 'Kaduna' },
  { id: 'abuja', name: 'Abuja' },
  { id: 'kano', name: 'Kano' },
  { id: 'lagos', name: 'Lagos' },
];
const banks = [
  { code: '044', name: 'Access Bank' },
  { code: '058', name: 'GTBank' },
  { code: '011', name: 'First Bank' },
  { code: '033', name: 'UBA' },
  { code: '057', name: 'Zenith Bank' },
  { code: '999992', name: 'OPay' },
  { code: '999991', name: 'PalmPay' },
];
const customers = ['Amina', 'Tunde', 'Ngozi', 'Zainab', 'Emeka', 'Fatima', 'Ibrahim', 'Chioma'];
const riders = [
  { name: 'Musa Ibrahim', plateNumber: 'KAD 482 QR' },
  { name: 'Sani Abdullahi', plateNumber: 'KAD 221 BW' },
];
const notes = [undefined, undefined, 'No pepper please', undefined, 'Extra sauce'];

// ---- state ----
let user: User = demoUser;
let store: Store | null = demoStore();
let menu: MenuItem[] = demoMenu();
let orders: Order[] = [];
let pendingPhone: string | null = null;
let sequence = 1;
let nextOrderAt = 0;
let account: { bankCode: string; bankName: string; accountNumber: string; accountName: string } | null = { bankCode: '058', bankName: 'GTBank', accountNumber: '0123454821', accountName: 'Arewa Kitchen' };
let payoutHistory: Payout[] = [];
let reviews: Review[] = [];

const money = (subtotalKobo: number) => {
  const commissionKobo = Math.round(subtotalKobo * (store?.commissionRate ?? COMMISSION_RATE));
  return { subtotalKobo, commissionKobo, payoutKobo: subtotalKobo - commissionKobo };
};

function makeOrder(seed: number, status: Order['status'], createdAt: string): Order {
  const available = menu.filter((m) => m.isAvailable);
  const pool = available.length ? available : menu;
  const count = 1 + (seed % 3);
  const items = Array.from({ length: Math.min(count, pool.length) }, (_, i) => {
    const m = pool[(seed + i * 2) % pool.length];
    return { name: m.name, quantity: 1 + ((seed + i) % 2), unitPriceKobo: m.priceKobo, note: i === 0 ? notes[seed % notes.length] : undefined };
  }).filter((line, i, all) => all.findIndex((x) => x.name === line.name) === i);
  return {
    id: `order-${sequence++}`, code: `VD-${(46_656 + seed * 7919).toString(36).toUpperCase().slice(-5)}`, status,
    customerName: customers[seed % customers.length], items, ...money(items.reduce((n, i) => n + i.unitPriceKobo * i.quantity, 0)), createdAt,
  };
}

/** A believable week of completed orders for the demo store (none today, so today's numbers start at zero). */
function seedHistory() {
  orders = [];
  [1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 5, 5, 5, 6, 6].forEach((daysAgo, i) => {
    const at = new Date(Date.now() - daysAgo * DAY);
    at.setHours(11 + ((i * 2) % 9), (i * 13) % 60, 0, 0);
    orders.push({ ...makeOrder(i + 3, 'delivered', at.toISOString()), rider: riders[i % riders.length], prepMinutes: 20 });
  });
  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  payoutHistory = [
    { id: 'po-2', amountKobo: 4_862_000, status: 'paid', date: iso(-3 * DAY), orders: 21 },
    { id: 'po-1', amountKobo: 5_317_500, status: 'paid', date: iso(-10 * DAY), orders: 24 },
  ];
  reviews = [
    { id: 'r-1', customerName: 'Amina', rating: 5, comment: 'The masa was still warm. Will order again.', createdAt: iso(-1 * DAY) },
    { id: 'r-2', customerName: 'Emeka', rating: 4, comment: 'Tasty jollof, portion could be a bit bigger.', createdAt: iso(-2 * DAY) },
    { id: 'r-3', customerName: 'Zainab', rating: 5, comment: 'Best miyan kuka in Kaduna.', createdAt: iso(-4 * DAY) },
    { id: 'r-4', customerName: 'Tunde', rating: 3, comment: 'Food was good but it took a while to be ready.', createdAt: iso(-6 * DAY) },
  ];
}
seedHistory();

function loadDemo() {
  user = demoUser;
  store = demoStore();
  menu = demoMenu();
  account = { bankCode: '058', bankName: 'GTBank', accountNumber: '0123454821', accountName: 'Arewa Kitchen' };
  seedHistory();
}
function loadEmpty() {
  store = null;
  menu = [];
  orders = [];
  account = null;
  payoutHistory = [];
  reviews = [];
}

const requireStore = () => {
  if (!store) throw new ApiError('no_store', 'Register your store first');
  return store;
};
const findOrder = (id: string) => {
  const order = orders.find((o) => o.id === id);
  if (!order) throw new ApiError('not_found', 'Order not found');
  return order;
};

/** Moves time-driven things along: new orders arrive, unanswered ones expire, riders collect ready ones. */
function tick() {
  if (!store) return;
  const now = Date.now();
  for (const o of orders) {
    if (o.status === 'new' && o.respondBy && new Date(o.respondBy).getTime() <= now) {
      o.status = 'cancelled';
      o.rejectReason = 'Not answered in time';
    }
  }
  const waiting = orders.filter((o) => o.status === 'new').length;
  if (store.approval === 'approved' && store.isOpen && menu.some((m) => m.isAvailable) && waiting < 2 && now >= nextOrderAt) {
    const order = makeOrder(sequence + 1, 'new', iso());
    order.respondBy = iso(RESPOND_SECONDS * 1000);
    orders.unshift(order);
    nextOrderAt = now + 25_000;
  }
}

const startOfDay = (daysAgo = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - daysAgo * DAY;
};
const sold = (o: Order) => ['preparing', 'ready', 'picked_up', 'delivered'].includes(o.status);

export const mockApi: ApiClient = {
  // ---- auth ----
  async requestCode(phone) {
    await delay(500);
    if (!/^\+234[789]\d{9}$/.test(phone)) throw new ApiError('invalid_phone', 'Enter a valid Nigerian phone number');
    pendingPhone = phone;
  },
  async verifyCode(phone, code) {
    await delay(500);
    if (phone !== pendingPhone) throw new ApiError('no_code_requested', 'Request a new code');
    if (code !== MOCK_SMS_CODE) throw new ApiError('wrong_code', 'That code is not correct');
    if (phone === demoUser.phone) {
      loadDemo();
      return { token: 'mock-token', user };
    }
    return { token: 'mock-token', user: null };
  },
  async completeSignUp({ name, email }) {
    await delay(500);
    if (!pendingPhone) throw new ApiError('not_verified', 'Verify your phone number first');
    user = { id: 'vendor-new', name: name.trim(), email: email.trim().toLowerCase(), phone: pendingPhone };
    loadEmpty();
    return user;
  },
  async getMe() {
    await delay();
    return user;
  },

  // ---- store ----
  async listCities() {
    await delay();
    return cities;
  },
  async getStore() {
    await delay(150);
    return snapshot(store);
  },
  async registerStore(body) {
    await delay(700);
    if (body.name.trim().length < 2) throw new ApiError('invalid_name', 'Enter your store name');
    if (body.address.trim().length < 5) throw new ApiError('invalid_address', 'Enter your store address');
    store = { ...body, id: 'store-new', name: body.name.trim(), address: body.address.trim(), approval: 'under_review', isOpen: false, rating: 0, ratingCount: 0, commissionRate: COMMISSION_RATE, tier: 'basic' };
    // the Vendo partnerships team approves stores from the admin dashboard; the mock does it after a few seconds
    setTimeout(() => {
      if (store?.approval === 'under_review') store = { ...store, approval: 'approved' };
    }, 9000);
    return snapshot(store);
  },
  async updateStore(body) {
    await delay(500);
    const s = requireStore();
    if (body.name !== undefined && body.name.trim().length < 2) throw new ApiError('invalid_name', 'Enter your store name');
    const { logoUrl, bannerUrl, ...rest } = body;
    store = { ...s, ...rest };
    // undefined leaves an image as it is; null removes it
    if (logoUrl !== undefined) store.logoUrl = logoUrl ?? undefined;
    if (bannerUrl !== undefined) store.bannerUrl = bannerUrl ?? undefined;
    return snapshot(store);
  },
  async setOpen(open) {
    await delay(400);
    const s = requireStore();
    if (s.approval !== 'approved') throw new ApiError('not_approved', 'Your store isn’t approved yet');
    if (open && !menu.some((m) => m.isAvailable)) throw new ApiError('empty_menu', 'Add at least one available menu item before opening');
    s.isOpen = open;
    if (open) nextOrderAt = Date.now() + 5000;
    return snapshot(s);
  },

  async uploadImage(file) {
    await delay(700); // stands in for the upload
    if (!IMAGE_TYPES.includes(file.type)) throw new ApiError('invalid_image', 'Use a JPEG, PNG or WebP picture');
    if (file.size > MAX_IMAGE_BYTES) throw new ApiError('image_too_large', 'Pictures can be up to 5 MB');
    // no file storage in the mock: the picture is kept inline as a data URL
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${file.type};base64,${btoa(binary)}`;
  },

  // ---- orders ----
  async listOrders() {
    await delay(150);
    tick();
    return snapshot(orders);
  },
  async getOrder(id) {
    await delay(150);
    tick();
    return snapshot(findOrder(id));
  },
  async acceptOrder(id, prepMinutes) {
    await delay(500);
    tick();
    const o = findOrder(id);
    if (o.status !== 'new') throw new ApiError('not_new', o.status === 'cancelled' ? 'This order timed out and was cancelled' : 'This order has already been answered');
    o.status = 'preparing';
    o.prepMinutes = prepMinutes;
    o.readyBy = iso(prepMinutes * 60_000);
    o.respondBy = undefined;
    return snapshot(o);
  },
  async rejectOrder(id, reason) {
    await delay(500);
    const o = findOrder(id);
    if (o.status !== 'new') throw new ApiError('not_new', 'This order has already been answered');
    o.status = 'rejected';
    o.rejectReason = reason;
    o.respondBy = undefined;
    return snapshot(o);
  },
  async markReady(id) {
    await delay(500);
    const o = findOrder(id);
    if (o.status !== 'preparing') throw new ApiError('not_preparing', 'Only orders being prepared can be marked ready');
    o.status = 'ready';
    o.rider = riders[sequence % riders.length];
    // a rider collects it, then delivers it
    setTimeout(() => {
      if (o.status === 'ready') o.status = 'picked_up';
    }, 12_000);
    setTimeout(() => {
      if (o.status === 'picked_up') o.status = 'delivered';
    }, 24_000);
    return snapshot(o);
  },

  // ---- menu ----
  async listMenu() {
    await delay();
    return snapshot(menu);
  },
  async saveMenuItem(item, id) {
    await delay(500);
    requireStore();
    if (item.name.trim().length < 2) throw new ApiError('invalid_name', 'Enter the item name');
    if (!Number.isInteger(item.priceKobo) || item.priceKobo < 5_000) throw new ApiError('invalid_price', 'Enter a price of at least ₦50');
    if (!item.category.trim()) throw new ApiError('invalid_category', 'Choose a category');
    const clean = { ...item, name: item.name.trim(), description: item.description.trim(), category: item.category.trim() };
    if (id) {
      if (!menu.some((m) => m.id === id)) throw new ApiError('not_found', 'Item not found');
      menu = menu.map((m) => (m.id === id ? { ...clean, id } : m));
      return snapshot(menu.find((m) => m.id === id)!);
    }
    const created = { ...clean, id: `m-new-${sequence++}` };
    menu = [...menu, created];
    return snapshot(created);
  },
  async setItemAvailable(id, available) {
    await delay(250);
    const item = menu.find((m) => m.id === id);
    if (!item) throw new ApiError('not_found', 'Item not found');
    item.isAvailable = available;
    return snapshot(item);
  },
  async deleteMenuItem(id) {
    await delay(400);
    menu = menu.filter((m) => m.id !== id);
  },

  // ---- business ----
  async getDashboard() {
    await delay();
    tick();
    const sales = orders.filter(sold);
    const since = (ms: number) => sales.filter((o) => new Date(o.createdAt).getTime() >= ms);
    const sum = (list: Order[], key: 'subtotalKobo' | 'payoutKobo') => list.reduce((n, o) => n + o[key], 0);
    const today = since(startOfDay());
    const week = since(startOfDay(6));
    const days = Array.from({ length: 7 }, (_, i) => {
      const from = startOfDay(6 - i);
      const list = sales.filter((o) => {
        const at = new Date(o.createdAt).getTime();
        return at >= from && at < from + DAY;
      });
      return { date: new Date(from).toISOString(), salesKobo: sum(list, 'subtotalKobo'), orders: list.length };
    });
    const counts = new Map<string, number>();
    for (const o of week) for (const i of o.items) counts.set(i.name, (counts.get(i.name) ?? 0) + i.quantity);
    const topItems = [...counts].map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 4);
    return { today: { orders: today.length, salesKobo: sum(today, 'subtotalKobo'), payoutKobo: sum(today, 'payoutKobo') }, week: { orders: week.length, salesKobo: sum(week, 'subtotalKobo') }, days, topItems };
  },
  async getPayouts() {
    await delay();
    // delivered orders since the last payout are owed to the store
    const lastPaid = payoutHistory.length ? new Date(payoutHistory[0].date).getTime() : 0;
    const owed = orders.filter((o) => o.status === 'delivered' && new Date(o.createdAt).getTime() > lastPaid);
    const next = new Date();
    next.setDate(next.getDate() + ((8 - next.getDay()) % 7 || 7)); // next Monday
    return { balanceKobo: owed.reduce((n, o) => n + o.payoutKobo, 0), nextPayoutDate: next.toISOString(), account: snapshot(account), history: snapshot(payoutHistory) };
  },
  async listBanks() {
    await delay();
    return banks;
  },
  async saveBankAccount({ bankCode, accountNumber, accountName }) {
    await delay(700);
    const bank = banks.find((b) => b.code === bankCode);
    if (!bank) throw new ApiError('invalid_bank', 'Choose your bank');
    if (!/^\d{10}$/.test(accountNumber)) throw new ApiError('invalid_account', 'Account numbers have 10 digits');
    if (accountName.trim().length < 3) throw new ApiError('invalid_name', 'Enter the name on the account');
    account = { bankCode, bankName: bank.name, accountNumber, accountName: accountName.trim() };
    return mockApi.getPayouts();
  },
  async listReviews() {
    await delay();
    return snapshot(reviews);
  },
  async listNotifications() {
    await delay();
    return [
      ...orders.filter((o) => o.status === 'cancelled' && o.rejectReason === 'Not answered in time').slice(0, 2).map((o) => ({ id: `n-${o.id}`, title: 'Order missed', body: `${o.code} wasn’t answered in time and was cancelled.`, createdAt: o.createdAt })),
      ...payoutHistory.slice(0, 1).map((p) => ({ id: `n-${p.id}`, title: 'Payout sent', body: `${p.orders} orders paid to your bank account.`, createdAt: p.date })),
      { id: 'n-welcome', title: 'Welcome to Vendo 👋', body: 'Open your store to start receiving orders.', createdAt: iso(-7 * DAY) },
    ];
  },
};

/** Mock only: puts the saved session back after an app reload. */
export function hydrateMock(savedUser: User, savedStore: Store | null) {
  user = savedUser;
  if (savedUser.id === demoUser.id) return;
  loadEmpty();
  store = savedStore ? { ...savedStore, isOpen: false } : null;
}
