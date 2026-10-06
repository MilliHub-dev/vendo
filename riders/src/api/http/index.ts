/**
 * The Vendo API (EXPO_PUBLIC_API_URL, https://api.vendoltd.com) for riders, implementing ApiClient.
 * Each function translates between the app's shapes and the server's; the contract is server/docs/openapi.json.
 */
import { bankName, banks } from '@/lib/banks';
import { distanceMeters } from '@/lib/geo';
import { currentPosition, startTracking, stopTracking } from '@/lib/location';
import { registerForPush, unregisterPush } from '@/lib/push';

import type { ApiClient } from '../client';
import type { AppNotification, ChatMessage, DocumentKind, Earnings, Job, JobStatus, Offer, PayoutAccount, Place, Rider, RiderDocument, Trip, User, Withdrawal } from '../types';
import { ApiError, request } from './request';
import { saveTokens } from './tokens';

type SMe = { id: string; phone: string | null; name: string | null; email: string | null; onboarding_step: 'name_required' | 'email_required' | 'phone_required' | 'complete' };
type SRider = { city_id: string; vehicle_type: Rider['vehicleType']; plate_number: string; approval: 'pending' | 'approved' | 'rejected' | 'suspended'; presence: Rider['presence']; approval_note: string | null };
type SDocument = { kind: DocumentKind | 'insurance'; status: 'pending' | 'approved' | 'rejected'; review_note: string | null; created_at: string };
type SPoint = { lat: number; lng: number; address: string; note?: string | null; landmark?: string | null };
type SPackage = { size: 'document' | 'small' | 'large'; description: string; fragile: boolean };
type SOffer = { id: string; order_id: string; type: 'food' | 'dispatch'; status: string; distance_m: number; package: SPackage | null; expires_at: string; pickup: SPoint; dropoff: SPoint };
type SOrder = {
  id: string; code: string; type: 'food' | 'dispatch'; status: string; created_at: string; status_updated_at?: string | null;
  quote: { vendor_name?: string; pickup: SPoint; dropoff: SPoint; distance_m: number; items?: { name: string; quantity: number }[]; package?: SPackage; receiver?: { name: string; phone: string } };
};
type STransaction = { id: string; reference: string; kind: 'earning' | 'hold' | 'release' | 'payout' | 'reversal'; available_delta: number; order_id: string | null; created_at: string };
type SSummary = {
  rating: number | null; total_trips: number; acceptance_rate: number | null; minimum_withdrawal_kobo: number | null;
  offer: { id: string; earning_kobo: number | null; trip_distance_m: number; summary: string } | null;
  job: { order_id: string; earning_kobo: number | null; code_attempts_left: number | null } | null;
};
type STrip = { order_id: string; code: string; type: 'food' | 'dispatch'; title: string; pickup: SPoint; dropoff: SPoint; distance_m: number; earning_kobo: number | null; completed_at: string };
type SWithdrawal = { id: string; amount_kobo: number; status: string; review_note: string | null; created_at: string };

export const REQUIRED_DOCUMENTS: DocumentKind[] = ['identity', 'license', 'vehicle'];
const DAY = 86_400_000;
let me: SMe | null = null;
/** The delivery in hand, kept so actions and chat know which order they are about. */
let currentJob: Job | null = null;
let pushRegistered = false;
let liveBanks: { code: string; name: string }[] | null = null;
const nameOfBank = (code: string) => liveBanks?.find((b) => b.code === code)?.name ?? bankName(code);

/** Rating, counts and pay. Null if the server can't say (older server, or the rider isn't registered yet); screens then leave those figures out. */
const summary = () => request<SSummary>('GET', '/v1/riders/me/summary').catch(() => null);
const place = (p: SPoint): Place => ({ lat: p.lat, lng: p.lng, address: p.address, note: p.note || p.landmark || undefined });
const toUser = (m: SMe): User => ({ id: m.id, name: m.name ?? '', phone: m.phone ?? '', email: m.email ?? '' });
async function loadMe(): Promise<SMe> {
  me = await request<SMe>('GET', '/v1/me');
  return me;
}
const myId = async () => (me ?? (await loadMe())).id;
const earningsPath = async (rest = '') => `/v1/earnings/rider/${await myId()}${rest}`;

async function documents(): Promise<RiderDocument[]> {
  const list = await request<SDocument[]>('GET', '/v1/riders/me/documents').catch(() => [] as SDocument[]);
  return REQUIRED_DOCUMENTS.map((kind) => {
    // the newest upload of each kind is the one that counts
    const latest = list.filter((d) => d.kind === kind).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return { kind, status: !latest ? 'missing' : latest.status === 'pending' ? 'submitted' : latest.status, note: latest?.review_note ?? undefined };
  });
}
async function toRider(r: SRider): Promise<Rider> {
  const [docs, stats] = await Promise.all([documents(), r.approval === 'approved' ? summary() : null]);
  const complete = docs.every((d) => d.status === 'submitted' || d.status === 'approved');
  // going offline or being suspended must also stop location reporting
  if (r.approval !== 'approved' || r.presence === 'offline') void stopTracking();
  else void startTracking();
  if (r.approval === 'approved' && !pushRegistered) {
    pushRegistered = true;
    void registerForPush();
  }
  return {
    approval: r.approval === 'pending' && complete ? 'under_review' : r.approval, approvalNote: r.approval_note ?? undefined, presence: r.presence, cityId: r.city_id, vehicleType: r.vehicle_type, plateNumber: r.plate_number, documents: docs,
    ...(stats ? { rating: stats.rating ?? undefined, totalTrips: stats.total_trips, acceptanceRate: stats.acceptance_rate ?? undefined } : {}),
  };
}
async function rider(): Promise<Rider | null> {
  // null until the rider has registered a vehicle
  const r = await request<SRider | null>('GET', '/v1/riders/me').catch((error) => (error instanceof ApiError && error.status === 404 ? null : Promise.reject(error)));
  return r ? toRider(r) : null;
}

const jobStatuses: JobStatus[] = ['rider_assigned', 'picked_up', 'on_the_way', 'delivered', 'cancelled'];
function toJob(o: SOrder): Job {
  const q = o.quote;
  return {
    id: o.id, code: o.code, type: o.type, status: jobStatuses.includes(o.status as JobStatus) ? (o.status as JobStatus) : 'cancelled',
    pickup: place(q.pickup), dropoff: place(q.dropoff), contact: q.receiver, vendorName: q.vendor_name,
    items: q.items?.map((i) => ({ name: i.name, quantity: i.quantity })), package: q.package && { size: q.package.size, description: q.package.description, fragile: q.package.fragile },
    tripDistanceM: q.distance_m, requiresCode: o.type === 'dispatch', acceptedAt: o.status_updated_at ?? o.created_at,
  };
}
async function job(): Promise<Job | null> {
  const order = await request<SOrder | null>('GET', '/v1/riders/me/job');
  if (!order) return (currentJob = null);
  const pay = (await summary())?.job;
  currentJob = { ...toJob(order), ...(pay?.order_id === order.id ? { earningKobo: pay.earning_kobo ?? undefined, codeAttemptsLeft: pay.code_attempts_left ?? undefined } : {}) };
  return currentJob;
}
const needJob = () => {
  if (!currentJob) throw new ApiError('NO_JOB', 'You don’t have a delivery in progress.');
  return currentJob;
};

const withdrawalStatus = (s: string): Withdrawal['status'] => (s === 'succeeded' ? 'completed' : ['failed', 'rejected', 'reversed'].includes(s) ? 'failed' : 'pending');
async function payoutAccount(): Promise<PayoutAccount | null> {
  const b = await request<{ bank_code: string; last_four: string; account_name: string } | null>('GET', await earningsPath('/bank')).catch((e) => (e instanceof ApiError && e.status === 404 ? null : Promise.reject(e)));
  return b ? { bankCode: b.bank_code, bankName: nameOfBank(b.bank_code), lastFour: b.last_four, accountName: b.account_name } : null;
}
const earningRows = async () => (await request<STransaction[]>('GET', await earningsPath('/transactions'), { query: { limit: 100 } })).filter((t) => t.kind === 'earning' && t.available_delta > 0);

export const httpApi: ApiClient = {
  // ---- account ----
  async requestCode(email) {
    await request('POST', '/v1/auth/email/otp/request', { auth: false, body: { email: email.trim().toLowerCase() } });
  },
  async verifyCode(email, code) {
    const t = await request<{ access_token: string; refresh_token: string }>('POST', '/v1/auth/email/otp/verify', { auth: false, body: { email: email.trim().toLowerCase(), token: code } });
    await saveTokens({ access: t.access_token, refresh: t.refresh_token });
    const m = await loadMe();
    return { token: t.access_token, user: m.onboarding_step === 'complete' ? toUser(m) : null };
  },
  async completeSignUp({ name, phone }) {
    await request('PATCH', '/v1/me/name', { body: { name: name.trim() } });
    await request('PATCH', '/v1/me/phone', { body: { phone } });
    return toUser(await loadMe());
  },
  getMe: async () => toUser(await loadMe()),
  async signOut() {
    await stopTracking();
    await unregisterPush();
    await request('POST', '/v1/riders/me/presence', { body: { online: false } }).catch(() => {});
    await request('POST', '/v1/auth/logout', { body: { scope: 'local' } }).catch(() => {});
    me = null;
    currentJob = null;
    pushRegistered = false;
    await saveTokens(null);
  },

  // ---- application ----
  async listCities() {
    const { items } = await request<{ items: { id: string; name: string; is_active: boolean }[] }>('GET', '/v1/cities', { auth: false });
    return items.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name }));
  },
  getRider: rider,
  async registerRider(body) {
    return toRider(await request<SRider>('POST', '/v1/riders/register', { body: { city_id: body.cityId, vehicle_type: body.vehicleType, plate_number: body.plateNumber.trim().toUpperCase() } }));
  },
  async uploadDocument(kind, file) {
    await request('POST', '/v1/riders/me/documents', { body: { kind, mime: file.mime, data_base64: file.base64 } });
    return (await rider())!;
  },

  // ---- working ----
  async setOnline(online) {
    if (online) {
      // the server only lets a rider go online from a fresh, accurate position inside their city
      const here = await currentPosition();
      await request('POST', '/v1/riders/me/location', { body: here });
    }
    const r = await request<SRider>('POST', '/v1/riders/me/presence', { body: { online } });
    return toRider(r);
  },
  async getCurrentOffer(): Promise<Offer | null> {
    const o = await request<SOffer | null>('GET', '/v1/riders/me/offers/current');
    if (!o || o.status !== 'pending') return null;
    const pay = (await summary())?.offer;
    const known = pay?.id === o.id ? pay : null;
    return {
      id: o.id, orderId: o.order_id, type: o.type, expiresAt: o.expires_at, distanceToPickupM: o.distance_m,
      tripDistanceM: known?.trip_distance_m ?? Math.round(distanceMeters(o.pickup, o.dropoff)), pickup: place(o.pickup), dropoff: place(o.dropoff),
      earningKobo: known?.earning_kobo ?? undefined, summary: known?.summary ?? (o.package ? `${o.package.description}${o.package.fragile ? ' · fragile' : ''}` : 'Food order'),
    };
  },
  async respondToOffer(id, action) {
    await request('POST', `/v1/riders/offers/${id}/respond`, { body: { action } });
    return action === 'accept' ? job() : null;
  },
  getJob: job,
  async updateJob(action) {
    const before = needJob();
    // keep the pay shown on the job: the order itself doesn't carry it
    currentJob = { ...toJob(await request<SOrder>('POST', `/v1/rider/orders/${before.id}/status`, { body: { action } })), earningKobo: before.earningKobo, codeAttemptsLeft: before.codeAttemptsLeft };
    return currentJob;
  },
  async confirmDelivery(code) {
    const done = needJob();
    await request('POST', `/v1/rider/orders/${done.id}/confirm-delivery`, { body: { code } });
    return { ...done, status: 'delivered' };
  },
  async listMessages() {
    if (!currentJob) return [];
    const mine = await myId();
    const chat = await request<{ messages: { id: string; seq: string; sender_id: string; text: string; created_at: string }[] }>('GET', `/v1/orders/${currentJob.id}/chat`, { query: { limit: 100 } });
    const last = chat.messages.at(-1);
    if (last) void request('POST', `/v1/orders/${currentJob.id}/chat/read`, { body: { seq: last.seq } }).catch(() => {});
    return chat.messages.map((m): ChatMessage => ({ id: m.id, from: m.sender_id === mine ? 'rider' : 'customer', text: m.text, createdAt: m.created_at }));
  },
  async sendMessage(text) {
    const m = await request<{ id: string; text: string; created_at: string }>('POST', `/v1/orders/${needJob().id}/chat/messages`, { idempotent: true, body: { text: text.trim() } });
    return { id: m.id, from: 'rider', text: m.text, createdAt: m.created_at };
  },

  // ---- money and history ----
  async listTrips() {
    try {
      const { items } = await request<{ items: STrip[] }>('GET', '/v1/riders/me/trips', { query: { limit: 50 } });
      return items.map((t): Trip => ({ id: t.order_id, code: t.code, type: t.type, title: t.title, pickup: t.pickup.address, dropoff: t.dropoff.address, distanceM: t.distance_m, earningKobo: t.earning_kobo ?? 0, completedAt: t.completed_at }));
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      // a server without the trips route: fall back to the earnings ledger (amount and time only)
      return (await earningRows()).map((t): Trip => ({ id: t.order_id ?? t.id, code: t.reference, title: 'Delivery', earningKobo: t.available_delta, completedAt: t.created_at }));
    }
  },
  async getTrip(id) {
    const trip = (await this.listTrips()).find((t) => t.id === id);
    if (!trip) throw new ApiError('NOT_FOUND', 'Trip not found.', 404);
    return trip;
  },
  async getEarnings(): Promise<Earnings> {
    const [account, rows, stats] = await Promise.all([request<{ available_kobo: number; held_kobo: number }>('GET', await earningsPath()), earningRows(), summary()]);
    const startToday = new Date().setHours(0, 0, 0, 0);
    const since = (from: number) => rows.filter((t) => new Date(t.created_at).getTime() >= from);
    const sum = (list: STransaction[]) => ({ trips: list.length, earnedKobo: list.reduce((n, t) => n + t.available_delta, 0) });
    return {
      balanceKobo: account.available_kobo, heldKobo: account.held_kobo, minWithdrawalKobo: stats?.minimum_withdrawal_kobo ?? undefined, today: sum(since(startToday)), week: sum(since(startToday - 6 * DAY)),
      days: Array.from({ length: 7 }, (_, i) => {
        const from = startToday - (6 - i) * DAY;
        return { date: new Date(from).toISOString(), earnedKobo: sum(rows.filter((t) => { const at = new Date(t.created_at).getTime(); return at >= from && at < from + DAY; })).earnedKobo };
      }),
    };
  },
  async listBanks() {
    // Paystack's own list, through our server; the bundled list covers the major banks if that isn't available
    const live = await request<{ items: { code: string; name: string }[] }>('GET', '/v1/payout-banks').catch(() => null);
    if (live?.items.length) liveBanks = live.items;
    return liveBanks ?? banks;
  },
  getPayoutAccount: payoutAccount,
  async listWithdrawals() {
    const [list, account] = await Promise.all([request<SWithdrawal[]>('GET', await earningsPath('/withdrawals'), { query: { limit: 50 } }), payoutAccount()]);
    return list.map((w): Withdrawal => ({ id: w.id, amountKobo: w.amount_kobo, bankName: account?.bankName ?? 'Bank account', accountNumber: account ? `••••••${account.lastFour}` : '', status: withdrawalStatus(w.status), createdAt: w.created_at, note: w.review_note ?? undefined }));
  },
  async requestWithdrawal({ amountKobo, bankCode, accountNumber }) {
    // a new or changed payout account is saved first; the server checks it with the bank
    if (bankCode && accountNumber) await request('PUT', await earningsPath('/bank'), { body: { bank_code: bankCode, account_number: accountNumber } });
    const w = await request<SWithdrawal>('POST', await earningsPath('/withdrawals'), { idempotent: true, body: { amount_kobo: amountKobo } });
    const account = await payoutAccount();
    return { id: w.id, amountKobo: w.amount_kobo, bankName: account?.bankName ?? 'Bank account', accountNumber: account ? `••••••${account.lastFour}` : '', status: withdrawalStatus(w.status), createdAt: w.created_at };
  },
  async listNotifications() {
    const { items } = await request<{ items: { id: string; title: string; body: string; created_at: string }[] }>('GET', '/v1/me/notifications', { query: { limit: 50 } });
    return items.map((n): AppNotification => ({ id: n.id, title: n.title, body: n.body, createdAt: n.created_at }));
  },
};
