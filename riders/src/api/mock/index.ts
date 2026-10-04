/**
 * In-memory stand-in for the backend, so the whole rider app can be used before the
 * server is connected. It behaves like the real thing where screens care: delays, an
 * application that gets reviewed, offers that arrive and expire, a job that moves through
 * its steps, earnings that add up. State resets when the app reloads.
 * Names, places and amounts are invented sample data.
 */
import { distanceMeters } from '@/lib/geo';

import type { ApiClient } from '../client';
import type { ChatMessage, Job, Offer, Place, Rider, Trip, User, Withdrawal } from '../types';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
const iso = (msFromNow = 0) => new Date(Date.now() + msFromNow).toISOString();
const DAY = 86_400_000;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** In the mock, every phone number receives this code, and every dispatch uses this delivery code. */
export const MOCK_SMS_CODE = '123456';
export const MOCK_DELIVERY_CODE = '4729';

const OFFER_SECONDS = 30;
const MIN_WITHDRAWAL_KOBO = 100_000; // ₦1,000 (PRD default)

// ---- people and places ----
const demoUser: User = { id: 'rider-1', name: 'Musa Ibrahim', phone: '+2348031111111', email: 'musa@example.com' };
const approvedDocs = (): Rider['documents'] => [
  { kind: 'gov_id', status: 'approved' },
  { kind: 'bike_registration', status: 'approved' },
  { kind: 'photo', status: 'approved' },
];
const demoRider = (): Rider => ({ approval: 'approved', presence: 'offline', cityId: 'kaduna', vehicleType: 'motorcycle', plateNumber: 'KAD 482 QR', rating: 4.9, totalTrips: 214, acceptanceRate: 0.93, documents: approvedDocs() });

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

const riderSpot = { lat: 10.5264, lng: 7.4388 };
const P = (address: string, lat: number, lng: number, note?: string): Place => ({ address, lat, lng, note });
type Template = Pick<Job, 'type' | 'pickup' | 'dropoff' | 'contact' | 'vendorName' | 'items' | 'package'> & { earningKobo: number };
const templates: Template[] = [
  {
    type: 'food', vendorName: 'Arewa Kitchen', earningKobo: 60_000,
    pickup: P('Arewa Kitchen, Kawo Road', 10.5795, 7.4496), dropoff: P('Ali Akilu Road, Kaduna', 10.5441, 7.4388, 'Blue gate, opposite the pharmacy'),
    contact: { name: 'Amina Bello', phone: '+2348030000000' }, items: [{ name: 'Jollof Rice & Chicken', quantity: 2 }, { name: 'Masa (6 pieces)', quantity: 1 }],
  },
  {
    type: 'dispatch', earningKobo: 95_000,
    pickup: P('Ahmadu Bello Way, Kaduna', 10.5167, 7.4333, '2nd floor, ask for reception'), dropoff: P('Barnawa Shopping Complex', 10.4806, 7.4341, 'Shop 14, call on arrival'),
    contact: { name: 'Ngozi Okafor', phone: '+2348055550123' }, package: { size: 'small', description: 'A pair of shoes', fragile: false },
  },
  {
    type: 'food', vendorName: 'Suya Junction', earningKobo: 50_000,
    pickup: P('Suya Junction, Yakubu Gowon Way', 10.5262, 7.4405), dropoff: P('Independence Way, Kaduna', 10.5354, 7.4279),
    contact: { name: 'Tunde Bako', phone: '+2348037778899' }, items: [{ name: 'Beef Suya', quantity: 2 }],
  },
  {
    type: 'dispatch', earningKobo: 120_000,
    pickup: P('Sabon Tasha, Kaduna', 10.4551, 7.4612), dropoff: P('Kawo Road, Kaduna', 10.5795, 7.4496, 'Opposite the motor park'),
    contact: { name: 'Zainab Musa', phone: '+2348061234567' }, package: { size: 'document', description: 'Signed contract', fragile: false },
  },
];

// ---- state ----
let user: User = demoUser;
let rider: Rider | null = demoRider();
let pendingPhone: string | null = null;
let offer: Offer | null = null;
let offerTemplate = 0;
let nextOfferAt = 0;
let job: Job | null = null;
let chat: ChatMessage[] = [];
let sequence = 1;
let received = 0;
let accepted = 0;

const trip = (i: number, daysAgo: number, hour: number): Trip => {
  const t = templates[i % templates.length];
  const done = new Date(Date.now() - daysAgo * DAY);
  done.setHours(hour, (i * 17) % 60, 0, 0);
  return {
    id: `trip-seed-${i}`, code: `VD-${(4096 + i * 977).toString(36).toUpperCase().padStart(5, '0')}`, type: t.type,
    title: t.vendorName ?? `Package for ${t.contact.name}`, pickup: t.pickup.address, dropoff: t.dropoff.address,
    earningKobo: t.earningKobo, distanceM: distanceMeters(t.pickup, t.dropoff), completedAt: done.toISOString(),
  };
};
// a believable week of history for the demo rider (none today, so today's numbers start at zero)
const seedTrips = (): Trip[] => [1, 1, 1, 2, 2, 3, 3, 3, 3, 4, 5, 5, 6, 6, 6].map((daysAgo, i) => trip(i, daysAgo, 9 + ((i * 3) % 10))).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
const seedWithdrawals = (): Withdrawal[] => [{ id: 'wd-0', amountKobo: 1_000_000, bankName: 'GTBank', accountNumber: '••••••4821', status: 'completed', createdAt: iso(-4 * DAY) }];
let trips: Trip[] = seedTrips();
let balanceKobo = 1_245_000;
let withdrawals: Withdrawal[] = seedWithdrawals();

/** Signs the demo rider in with their sample history and balance. */
function loadDemoRider() {
  user = demoUser;
  rider = demoRider();
  trips = seedTrips();
  balanceKobo = 1_245_000;
  withdrawals = seedWithdrawals();
  offer = null;
  job = null;
}

const snapshot = <T>(value: T): T => (value && typeof value === 'object' ? (JSON.parse(JSON.stringify(value)) as T) : value);
const requireRider = () => {
  if (!rider) throw new ApiError('not_registered', 'Register as a rider first');
  return rider;
};
const requireJob = () => {
  if (!job) throw new ApiError('no_job', 'You have no active delivery');
  return job;
};

function finishJob() {
  const j = requireJob();
  const r = requireRider();
  j.status = 'delivered';
  trips.unshift({ id: `trip-${j.id}`, code: j.code, type: j.type, title: j.vendorName ?? `Package for ${j.contact.name}`, pickup: j.pickup.address, dropoff: j.dropoff.address, earningKobo: j.earningKobo, distanceM: j.tripDistanceM, completedAt: iso() });
  balanceKobo += j.earningKobo;
  r.totalTrips += 1;
  r.presence = 'online';
  nextOfferAt = Date.now() + 12_000;
  const done = snapshot(j);
  job = null;
  return done;
}

const sumSince = (ms: number) => {
  const list = trips.filter((t) => new Date(t.completedAt).getTime() >= ms);
  return { trips: list.length, earnedKobo: list.reduce((n, t) => n + t.earningKobo, 0) };
};
const startOfDay = (daysAgo = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - daysAgo * DAY;
};

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
      loadDemoRider();
      return { token: 'mock-token', user };
    }
    return { token: 'mock-token', user: null };
  },
  async completeSignUp({ name, email }) {
    await delay(500);
    if (!pendingPhone) throw new ApiError('not_verified', 'Verify your phone number first');
    user = { id: 'rider-new', name: name.trim(), email: email.trim().toLowerCase(), phone: pendingPhone };
    rider = null;
    trips = [];
    balanceKobo = 0;
    withdrawals = [];
    offer = null;
    job = null;
    return user;
  },
  async getMe() {
    await delay();
    return user;
  },

  // ---- application ----
  async listCities() {
    await delay();
    return cities;
  },
  async getRider() {
    await delay(150);
    return snapshot(rider);
  },
  async registerRider({ cityId, vehicleType, plateNumber }) {
    await delay(600);
    if (plateNumber.trim().length < 5) throw new ApiError('invalid_plate', 'Enter the plate number on your vehicle');
    rider = {
      approval: 'pending', presence: 'offline', cityId, vehicleType, plateNumber: plateNumber.trim().toUpperCase(), rating: 0, totalTrips: 0, acceptanceRate: 1,
      documents: [{ kind: 'gov_id', status: 'missing' }, { kind: 'bike_registration', status: 'missing' }, { kind: 'photo', status: 'missing' }],
    };
    return snapshot(rider);
  },
  async uploadDocument(kind) {
    await delay(900); // stands in for the upload
    const r = requireRider();
    r.documents = r.documents.map((d) => (d.kind === kind ? { kind, status: 'submitted' } : d));
    return snapshot(r);
  },
  async submitApplication() {
    await delay(600);
    const r = requireRider();
    if (r.documents.some((d) => d.status === 'missing' || d.status === 'rejected')) throw new ApiError('documents_missing', 'Add all three documents first');
    r.approval = 'under_review';
    // an ops reviewer approves from the admin dashboard; the mock does it after a few seconds
    setTimeout(() => {
      if (rider?.approval === 'under_review') rider = { ...rider, approval: 'approved', documents: approvedDocs() };
    }, 9000);
    return snapshot(r);
  },

  // ---- working ----
  async setOnline(online) {
    await delay(400);
    const r = requireRider();
    if (r.approval !== 'approved') throw new ApiError('not_approved', 'Your account isn’t approved yet');
    if (!online && job) throw new ApiError('on_trip', 'Finish your current delivery before going offline');
    r.presence = job ? 'on_trip' : online ? 'online' : 'offline';
    if (online) nextOfferAt = Date.now() + 5000;
    else offer = null;
    return snapshot(r);
  },
  async getCurrentOffer() {
    await delay(120);
    if (!rider || rider.presence !== 'online' || job) return null;
    if (offer && new Date(offer.expiresAt).getTime() <= Date.now()) {
      offer = null; // timed out: it goes to the next rider
      nextOfferAt = Date.now() + 10_000;
    }
    if (!offer && Date.now() >= nextOfferAt) {
      const t = templates[offerTemplate++ % templates.length];
      received += 1;
      offer = {
        id: `offer-${sequence}`, orderId: `order-${sequence++}`, type: t.type, expiresAt: iso(OFFER_SECONDS * 1000),
        distanceToPickupM: distanceMeters(riderSpot, t.pickup), tripDistanceM: distanceMeters(t.pickup, t.dropoff),
        pickup: t.pickup, dropoff: t.dropoff, earningKobo: t.earningKobo,
        summary: t.type === 'food' ? `${t.vendorName} · ${t.items!.reduce((n, i) => n + i.quantity, 0)} items` : `${t.package!.description}${t.package!.fragile ? ' · fragile' : ''}`,
      };
    }
    return snapshot(offer);
  },
  async respondToOffer(id, action) {
    await delay(400);
    const r = requireRider();
    if (!offer || offer.id !== id) throw new ApiError('offer_gone', 'This order is no longer available');
    if (new Date(offer.expiresAt).getTime() <= Date.now()) {
      offer = null;
      throw new ApiError('offer_expired', 'This order timed out and went to another rider');
    }
    const current = offer;
    offer = null;
    if (action === 'reject') {
      nextOfferAt = Date.now() + 10_000;
      r.acceptanceRate = accepted / Math.max(1, received);
      return null;
    }
    accepted += 1;
    const t = templates[(offerTemplate - 1) % templates.length];
    job = {
      id: current.orderId, code: `VD-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, type: t.type, status: 'rider_assigned',
      pickup: t.pickup, dropoff: t.dropoff, contact: t.contact, vendorName: t.vendorName, items: t.items, package: t.package,
      earningKobo: t.earningKobo, tripDistanceM: current.tripDistanceM, requiresCode: t.type === 'dispatch', codeAttemptsLeft: 3, acceptedAt: iso(),
    };
    chat = [];
    r.presence = 'on_trip';
    return snapshot(job);
  },
  async getJob() {
    await delay(120);
    return snapshot(job);
  },
  async updateJob(action) {
    await delay(500);
    const j = requireJob();
    const expected = { picked_up: 'rider_assigned', on_the_way: 'picked_up', delivered: 'on_the_way' }[action];
    if (j.status !== expected) throw new ApiError('wrong_step', 'That step isn’t available yet');
    if (action === 'delivered') {
      if (j.requiresCode) throw new ApiError('code_required', 'Enter the receiver’s delivery code to complete this delivery');
      return finishJob();
    }
    j.status = action;
    return snapshot(j);
  },
  async confirmDelivery(code) {
    await delay(600);
    const j = requireJob();
    if (j.status !== 'on_the_way') throw new ApiError('wrong_step', 'Start the delivery before confirming it');
    if (j.codeAttemptsLeft <= 0) throw new ApiError('code_locked', 'Too many wrong codes. Contact Vendo support to complete this delivery');
    if (code.trim() !== MOCK_DELIVERY_CODE) {
      j.codeAttemptsLeft -= 1;
      throw new ApiError(j.codeAttemptsLeft ? 'wrong_code' : 'code_locked', j.codeAttemptsLeft ? `Wrong code. ${j.codeAttemptsLeft} attempt${j.codeAttemptsLeft === 1 ? '' : 's'} left` : 'Too many wrong codes. Contact Vendo support to complete this delivery');
    }
    return finishJob();
  },
  async listMessages() {
    await delay(120);
    return snapshot(chat);
  },
  async sendMessage(text) {
    await delay(200);
    const j = requireJob();
    const body = text.trim();
    if (!body) throw new ApiError('empty_message', 'Type a message first');
    const message: ChatMessage = { id: `msg-${chat.length}`, from: 'rider', text: body.slice(0, 500), createdAt: iso() };
    chat = [...chat, message];
    const replies = ['Okay, thank you.', 'Alright, I’ll be waiting outside.', 'Please call when you’re close.', 'No problem 👍'];
    setTimeout(() => {
      if (job?.id === j.id) chat = [...chat, { id: `msg-${chat.length}`, from: 'customer', text: replies[chat.length % replies.length], createdAt: iso() }];
    }, 2500);
    return message;
  },

  // ---- money and history ----
  async listTrips() {
    await delay();
    return snapshot(trips);
  },
  async getTrip(id) {
    await delay();
    const t = trips.find((x) => x.id === id);
    if (!t) throw new ApiError('not_found', 'Trip not found');
    return snapshot(t);
  },
  async getEarnings() {
    await delay();
    const days = Array.from({ length: 7 }, (_, i) => {
      const from = startOfDay(6 - i);
      const list = trips.filter((t) => {
        const at = new Date(t.completedAt).getTime();
        return at >= from && at < from + DAY;
      });
      return { date: new Date(from).toISOString(), earnedKobo: list.reduce((n, t) => n + t.earningKobo, 0) };
    });
    return { balanceKobo, today: sumSince(startOfDay()), week: sumSince(startOfDay(6)), days, minWithdrawalKobo: MIN_WITHDRAWAL_KOBO };
  },
  async listBanks() {
    await delay();
    return banks;
  },
  async listWithdrawals() {
    await delay();
    return snapshot(withdrawals);
  },
  async requestWithdrawal({ amountKobo, bankCode, accountNumber, accountName }) {
    await delay(800);
    const bank = banks.find((b) => b.code === bankCode);
    if (!bank) throw new ApiError('invalid_bank', 'Choose your bank');
    if (!/^\d{10}$/.test(accountNumber)) throw new ApiError('invalid_account', 'Account numbers have 10 digits');
    if (accountName.trim().length < 3) throw new ApiError('invalid_name', 'Enter the name on the account');
    if (!Number.isInteger(amountKobo) || amountKobo < MIN_WITHDRAWAL_KOBO) throw new ApiError('below_minimum', 'The minimum withdrawal is ₦1,000');
    if (amountKobo > balanceKobo) throw new ApiError('insufficient_funds', 'That’s more than your balance');
    balanceKobo -= amountKobo; // held as soon as it's requested
    const w: Withdrawal = { id: `wd-${withdrawals.length}`, amountKobo, bankName: bank.name, accountNumber: `••••••${accountNumber.slice(-4)}`, status: 'pending', createdAt: iso() };
    withdrawals = [w, ...withdrawals];
    // finance approves and Paystack pays out; the mock completes it after a few seconds
    setTimeout(() => {
      withdrawals = withdrawals.map((x) => (x.id === w.id ? { ...x, status: 'completed' } : x));
    }, 10_000);
    return snapshot(w);
  },
  async listNotifications() {
    await delay();
    return [
      ...withdrawals.slice(0, 2).map((w) => ({ id: `n-${w.id}`, title: w.status === 'completed' ? 'Withdrawal paid' : 'Withdrawal requested', body: `${w.bankName} ${w.accountNumber}`, createdAt: w.createdAt })),
      ...trips.slice(0, 3).map((t) => ({ id: `n-${t.id}`, title: 'Delivery completed', body: `${t.title} (${t.code})`, createdAt: t.completedAt })),
      { id: 'n-welcome', title: 'Welcome to Vendo Rider 👋', body: 'Go online to start receiving delivery requests near you.', createdAt: iso(-7 * DAY) },
    ];
  },
};

/** Mock only: puts the saved session back after an app reload. */
export function hydrateMock(savedUser: User, savedRider: Rider | null) {
  user = savedUser;
  if (savedUser.id === demoUser.id) return;
  rider = savedRider ? { ...savedRider, presence: 'offline' } : null;
  trips = [];
  balanceKobo = 0;
  withdrawals = [];
}
