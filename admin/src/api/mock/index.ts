/**
 * In-memory stand-in for the admin backend, so the whole dashboard can be used before
 * the server is connected. It enforces the same role rules as the UI and writes an audit
 * entry for every change. State resets when the page reloads. All data is invented.
 */
import { can, type Permission } from "../../lib/permissions.ts";
import type { ApiClient } from "../client";
import type { Admin, Audience, AuditEntry, Broadcast, Order, ReferralConfig, Transaction } from "../types";
import { buildSeed } from "./seed.ts";

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const iso = (msFromNow = 0) => new Date(Date.now() + msFromNow).toISOString();
const DAY = 86_400_000;
const snapshot = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Demo accounts — one per role. Any of them signs in with this password. */
export const MOCK_PASSWORD = "vendo123";
export const ALLOWED_DOMAIN = "vendoltd.com";
export const demoAdmins: Admin[] = [
  { id: "adm-1", name: "Jefferson Ighalo", email: "admin@vendoltd.com", role: "super_admin" },
  { id: "adm-2", name: "Halima Yusuf", email: "ops@vendoltd.com", role: "ops" },
  { id: "adm-3", name: "Chidi Nwosu", email: "finance@vendoltd.com", role: "finance" },
  { id: "adm-4", name: "Grace Audu", email: "support@vendoltd.com", role: "support" },
];

const db = buildSeed();
let current: Admin | null = null;
let referral: ReferralConfig = { enabled: true, referrerRewardKobo: 50_000, refereeDiscountKobo: 50_000 };
let auditSeq = 1;
const audit: AuditEntry[] = [
  { id: "aud-s3", at: iso(-3 * 3_600_000), admin: "Halima Yusuf", role: "ops", action: "Approved rider", target: db.riders[8].name, detail: "Documents verified" },
  { id: "aud-s2", at: iso(-26 * 3_600_000), admin: "Chidi Nwosu", role: "finance", action: "Declined withdrawal", target: db.withdrawals[6].riderName, detail: "Account name didn’t match the rider’s name" },
  { id: "aud-s1", at: iso(-2 * DAY), admin: "Jefferson Ighalo", role: "super_admin", action: "Turned surge on", target: "Abuja", detail: "Multiplier 1.3×" },
];

const reach = (audience: Audience, cityIds: string[]) => {
  const inCity = (x: { cityId: string }) => cityIds.includes(x.cityId);
  // the sample lists are small, so scale them up to look like a real user base
  if (audience === "customers") return db.customers.filter(inCity).length * 137;
  if (audience === "riders") return db.riders.filter((r) => r.approval === "approved" && inCity(r)).length;
  return db.vendors.filter((v) => v.approval === "approved" && inCity(v)).length;
};
const allCities = db.cities.filter((c) => c.isActive).map((c) => c.id);
const broadcasts: Broadcast[] = [
  { id: "push-3", title: "Jollof Friday 🍛", body: "Free delivery on every food order until 9pm tonight.", audience: "customers", cityIds: ["kaduna", "abuja"], link: "food", status: "scheduled", sendAt: iso(2 * DAY), recipients: reach("customers", ["kaduna", "abuja"]), opened: 0, sentBy: "Halima Yusuf" },
  { id: "push-2", title: "Rain in Kaduna today", body: "Ride carefully. A ₦200 bonus is added to every trip until 6pm.", audience: "riders", cityIds: ["kaduna"], link: "home", status: "sent", sendAt: iso(-1 * DAY), recipients: reach("riders", ["kaduna"]), opened: Math.round(reach("riders", ["kaduna"]) * 0.8), sentBy: "Halima Yusuf" },
  { id: "push-1", title: "Send a package from ₦500", body: "Need something delivered across town? A Vendo rider can pick it up in minutes.", audience: "customers", cityIds: allCities, link: "send", status: "sent", sendAt: iso(-6 * DAY), recipients: reach("customers", allCities), opened: Math.round(reach("customers", allCities) * 0.23), sentBy: "Jefferson Ighalo" },
];

/** Restores the signed-in admin after a page reload (mock only). */
export function hydrateMock(admin: Admin | null) {
  current = admin;
}

function need(permission: Permission): Admin {
  if (!current) throw new ApiError("unauthorised", "Sign in again");
  if (!can(current.role, permission)) throw new ApiError("forbidden", "Your role can’t do this");
  return current;
}
function log(admin: Admin, action: string, target: string, detail: string) {
  audit.unshift({ id: `aud-${auditSeq++}`, at: iso(), admin: admin.name, role: admin.role, action, target, detail });
}
const reason = (text: string) => {
  const t = text.trim();
  if (t.length < 4) throw new ApiError("reason_required", "Give a reason — it goes in the audit log");
  return t;
};
const find = <T extends { id: string }>(list: T[], id: string, what: string): T => {
  const item = list.find((x) => x.id === id);
  if (!item) throw new ApiError("not_found", `${what} not found`);
  return item;
};
const stamp = (order: Order, label: string, by: string) => order.timeline.push({ label, at: iso(), by });
const txn = (t: Omit<Transaction, "id" | "createdAt" | "status">) => db.transactions.unshift({ ...t, id: `txn-m${db.transactions.length}`, status: "success", createdAt: iso() });
const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

export const mockApi: ApiClient = {
  async login(email, password) {
    await delay(500);
    const address = email.trim().toLowerCase();
    if (!address.endsWith(`@${ALLOWED_DOMAIN}`)) throw new ApiError("domain", `Use your @${ALLOWED_DOMAIN} email address`);
    const admin = demoAdmins.find((a) => a.email === address);
    if (!admin || password !== MOCK_PASSWORD) throw new ApiError("credentials", "That email and password don’t match");
    current = admin;
    return { token: "mock-admin-token", admin };
  },

  async getOverview() {
    await delay();
    const startToday = new Date().setHours(0, 0, 0, 0);
    const on = (o: Order, from: number, to: number) => {
      const t = new Date(o.createdAt).getTime();
      return t >= from && t < to;
    };
    const revenue = (list: Order[]) => list.filter((o) => o.status === "delivered").reduce((n, o) => n + o.totalKobo - o.refundedKobo, 0);
    const rate = (list: Order[]) => {
      const closed = list.filter((o) => ["delivered", "cancelled", "disputed"].includes(o.status));
      return closed.length ? closed.filter((o) => o.status !== "cancelled").length / closed.length : 1;
    };
    const today = db.orders.filter((o) => on(o, startToday, startToday + DAY));
    const month = db.orders;
    const count = (key: (o: Order) => string | undefined) => {
      const m = new Map<string, Order[]>();
      for (const o of month.filter((x) => x.status === "delivered")) {
        const k = key(o);
        if (k) m.set(k, [...(m.get(k) ?? []), o]);
      }
      return [...m].sort((a, b) => b[1].length - a[1].length).slice(0, 5);
    };
    const ordersPerCustomer = new Map<string, number>();
    for (const o of month) ordersPerCustomer.set(o.customer.id, (ordersPerCustomer.get(o.customer.id) ?? 0) + 1);
    return {
      today: {
        orders: today.length,
        revenueKobo: revenue(today),
        commissionKobo: today.filter((o) => o.status === "delivered").reduce((n, o) => n + o.commissionKobo, 0),
        activeRiders: db.riders.filter((r) => r.presence !== "offline").length,
        activeCustomers: new Set(today.map((o) => o.customer.id)).size,
        fulfilmentRate: rate(today),
      },
      days: Array.from({ length: 14 }, (_, i) => {
        const from = startToday - (13 - i) * DAY;
        const list = db.orders.filter((o) => on(o, from, from + DAY));
        return { date: new Date(from).toISOString(), orders: list.length, revenueKobo: revenue(list) };
      }),
      cities: db.cities.map((c) => {
        const list = month.filter((o) => o.cityId === c.id);
        return { cityId: c.id, name: c.name, orders: list.length, revenueKobo: revenue(list), onlineRiders: db.riders.filter((r) => r.cityId === c.id && r.presence !== "offline").length, fulfilmentRate: rate(list) };
      }),
      topVendors: count((o) => o.vendorName).map(([name, list]) => ({ name, orders: list.length, revenueKobo: list.reduce((n, o) => n + o.subtotalKobo, 0) })),
      topRiders: count((o) => o.riderName).map(([name, list]) => ({ name, trips: list.length, rating: db.riders.find((r) => r.name === name)?.rating ?? 0 })),
      retention: { newCustomers: [...ordersPerCustomer.values()].filter((n) => n === 1).length, returningCustomers: [...ordersPerCustomer.values()].filter((n) => n > 1).length },
      queues: {
        riderApprovals: db.riders.filter((r) => r.approval === "pending").length,
        vendorApprovals: db.vendors.filter((v) => v.approval === "under_review").length,
        withdrawals: db.withdrawals.filter((w) => w.status === "pending").length,
        disputes: db.orders.filter((o) => o.status === "disputed").length,
      },
    };
  },

  // ---- orders ----
  async listOrders() {
    await delay();
    return snapshot(db.orders);
  },
  async reassignOrder(id, riderId) {
    await delay(400);
    const admin = need("orders.manage");
    const order = find(db.orders, id, "Order");
    const rider = find(db.riders, riderId, "Rider");
    if (["delivered", "cancelled", "disputed"].includes(order.status)) throw new ApiError("closed", "This order is already closed");
    if (rider.approval !== "approved" || rider.presence === "offline") throw new ApiError("rider_unavailable", "That rider isn’t online");
    const from = order.riderName;
    order.riderId = rider.id;
    order.riderName = rider.name;
    if (["awaiting_vendor", "searching_rider"].includes(order.status)) order.status = "rider_assigned";
    stamp(order, `Rider ${from ? "changed to" : "assigned:"} ${rider.name}`, admin.name);
    log(admin, from ? "Reassigned rider" : "Assigned rider", order.code, `${from ?? "No rider"} → ${rider.name}`);
    return snapshot(order);
  },
  async cancelOrder(id, why) {
    await delay(400);
    const admin = need("orders.manage");
    const order = find(db.orders, id, "Order");
    if (["delivered", "cancelled"].includes(order.status)) throw new ApiError("closed", "This order is already closed");
    const text = reason(why);
    order.status = "cancelled";
    stamp(order, `Cancelled by admin — ${text}`, admin.name);
    log(admin, "Cancelled order", order.code, text);
    return snapshot(order);
  },
  async refundOrder(id, amountKobo, why) {
    await delay(500);
    const admin = need("orders.refund");
    const order = find(db.orders, id, "Order");
    const text = reason(why);
    const left = order.totalKobo - order.refundedKobo;
    if (!Number.isInteger(amountKobo) || amountKobo <= 0) throw new ApiError("invalid_amount", "Enter an amount to refund");
    if (amountKobo > left) throw new ApiError("too_much", `Only ${naira(left)} is left to refund on this order`);
    order.refundedKobo += amountKobo;
    stamp(order, `Refunded ${naira(amountKobo)} — ${text}`, admin.name);
    txn({ reference: `RFD-${order.code}-${order.timeline.length}`, kind: "refund", party: order.customer.name, direction: "credit", amountKobo, channel: "wallet", note: text });
    log(admin, "Issued refund", order.code, `${naira(amountKobo)} — ${text}`);
    return snapshot(order);
  },
  async resolveDispute(id, note) {
    await delay(400);
    const admin = need("orders.manage");
    const order = find(db.orders, id, "Order");
    if (order.status !== "disputed") throw new ApiError("not_disputed", "This order isn’t disputed");
    const text = reason(note);
    order.status = "delivered";
    order.issue = undefined;
    stamp(order, `Dispute resolved — ${text}`, admin.name);
    log(admin, "Resolved dispute", order.code, text);
    return snapshot(order);
  },

  // ---- riders ----
  async listRiders() {
    await delay();
    return snapshot(db.riders);
  },
  async reviewRider(id, decision, note) {
    await delay(400);
    const admin = need("riders.review");
    const rider = find(db.riders, id, "Rider");
    if (rider.approval !== "pending" && rider.approval !== "rejected") throw new ApiError("already_reviewed", "This rider has already been reviewed");
    if (decision === "reject") {
      rider.note = reason(note);
      rider.approval = "rejected";
    } else {
      rider.approval = "approved";
      rider.note = undefined;
      rider.documents = rider.documents.map((d) => ({ ...d, status: "approved" }));
    }
    log(admin, decision === "approve" ? "Approved rider" : "Rejected rider", rider.name, decision === "approve" ? "Documents verified" : rider.note!);
    return snapshot(rider);
  },
  async setRiderSuspended(id, suspended, why) {
    await delay(400);
    const admin = need("riders.review");
    const rider = find(db.riders, id, "Rider");
    if (suspended) {
      rider.note = reason(why);
      rider.approval = "suspended";
      rider.presence = "offline";
    } else {
      rider.approval = "approved";
      rider.note = undefined;
    }
    log(admin, suspended ? "Suspended rider" : "Reinstated rider", rider.name, suspended ? rider.note! : "Suspension lifted");
    return snapshot(rider);
  },

  // ---- vendors ----
  async listVendors() {
    await delay();
    return snapshot(db.vendors);
  },
  async saveVendor(input, id) {
    await delay(500);
    const admin = need("vendors.manage");
    if (input.name.trim().length < 2) throw new ApiError("invalid_name", "Enter the vendor’s name");
    if (!(input.commissionRate >= 0 && input.commissionRate <= 0.5)) throw new ApiError("invalid_rate", "Commission must be between 0% and 50%");
    if (id) {
      const vendor = find(db.vendors, id, "Vendor");
      const before = `${Math.round(vendor.commissionRate * 100)}% · ${vendor.tier}`;
      Object.assign(vendor, input, { name: input.name.trim() });
      log(admin, "Edited vendor", vendor.name, `${before} → ${Math.round(vendor.commissionRate * 100)}% · ${vendor.tier}`);
      return snapshot(vendor);
    }
    const vendor = { ...input, name: input.name.trim(), id: `vendor-${db.vendors.length + 1}`, approval: "approved" as const, isOpen: false, rating: 0, menuItems: 0, orders30d: 0, revenue30dKobo: 0 };
    db.vendors.unshift(vendor);
    log(admin, "Added vendor", vendor.name, `${Math.round(vendor.commissionRate * 100)}% · ${vendor.tier}`);
    return snapshot(vendor);
  },
  async reviewVendor(id, decision) {
    await delay(400);
    const admin = need("vendors.manage");
    const vendor = find(db.vendors, id, "Vendor");
    if (vendor.approval !== "under_review") throw new ApiError("already_reviewed", "This vendor has already been reviewed");
    if (decision === "approve") vendor.approval = "approved";
    else db.vendors.splice(db.vendors.indexOf(vendor), 1);
    log(admin, decision === "approve" ? "Approved vendor" : "Rejected vendor", vendor.name, decision === "approve" ? "Store can now go live" : "Application declined");
    return snapshot(vendor);
  },
  async setVendorSuspended(id, suspended, why) {
    await delay(400);
    const admin = need("vendors.manage");
    const vendor = find(db.vendors, id, "Vendor");
    const text = suspended ? reason(why) : "Suspension lifted";
    vendor.approval = suspended ? "suspended" : "approved";
    if (suspended) vendor.isOpen = false;
    log(admin, suspended ? "Suspended vendor" : "Reinstated vendor", vendor.name, text);
    return snapshot(vendor);
  },

  // ---- customers and wallets ----
  async listCustomers() {
    await delay();
    return snapshot(db.customers);
  },
  async adjustWallet(party, id, direction, amountKobo, why) {
    await delay(500);
    const admin = need("wallet.adjust");
    const text = reason(why);
    if (!Number.isInteger(amountKobo) || amountKobo <= 0) throw new ApiError("invalid_amount", "Enter an amount");
    const sign = direction === "credit" ? 1 : -1;
    let name: string;
    if (party === "customer") {
      const c = find(db.customers, id, "Customer");
      if (c.walletKobo + sign * amountKobo < 0) throw new ApiError("insufficient", "That would take the wallet below zero");
      c.walletKobo += sign * amountKobo;
      name = c.name;
    } else {
      const r = find(db.riders, id, "Rider");
      if (r.balanceKobo + sign * amountKobo < 0) throw new ApiError("insufficient", "That would take the wallet below zero");
      r.balanceKobo += sign * amountKobo;
      name = r.name;
    }
    txn({ reference: `ADJ-${Date.now().toString(36).toUpperCase()}`, kind: "adjustment", party: name, direction, amountKobo, channel: "system", note: text });
    log(admin, direction === "credit" ? "Credited wallet" : "Debited wallet", name, `${naira(amountKobo)} — ${text}`);
  },

  // ---- payments ----
  async listTransactions() {
    await delay();
    return snapshot(db.transactions);
  },
  async listWithdrawals() {
    await delay();
    return snapshot(db.withdrawals);
  },
  async decideWithdrawal(id, decision, note) {
    await delay(500);
    const admin = need("withdrawals.decide");
    const w = find(db.withdrawals, id, "Withdrawal");
    if (w.status !== "pending") throw new ApiError("already_decided", "This withdrawal has already been decided");
    if (decision === "decline") {
      w.note = reason(note);
      w.status = "declined";
      const rider = db.riders.find((r) => r.id === w.riderId);
      if (rider) rider.balanceKobo += w.amountKobo; // the held amount goes back
    } else {
      w.status = "paid";
      txn({ reference: `WDL-${w.id.toUpperCase()}`, kind: "withdrawal", party: w.riderName, direction: "debit", amountKobo: w.amountKobo, channel: "transfer" });
    }
    log(admin, decision === "approve" ? "Approved withdrawal" : "Declined withdrawal", w.riderName, `${naira(w.amountKobo)}${w.note ? ` — ${w.note}` : ""}`);
    return snapshot(w);
  },

  // ---- cities ----
  async listCities() {
    await delay();
    return snapshot(db.cities);
  },
  async updateCity(id, update) {
    await delay(400);
    const admin = need("cities.manage");
    const city = find(db.cities, id, "City");
    for (const key of ["baseFareKobo", "perKmKobo", "minOrderKobo"] as const) {
      const v = update[key];
      if (v !== undefined && (!Number.isInteger(v) || v < 0)) throw new ApiError("invalid_price", "Prices can’t be negative");
    }
    if (update.surgeMultiplier !== undefined && !(update.surgeMultiplier >= 1 && update.surgeMultiplier <= 3)) throw new ApiError("invalid_surge", "Surge must be between 1× and 3×");
    const changed = Object.entries(update).filter(([k, v]) => v !== undefined && city[k as keyof typeof city] !== v).map(([k, v]) => `${k}: ${String(city[k as keyof typeof city])} → ${String(v)}`);
    Object.assign(city, update);
    if (changed.length) log(admin, "Updated city", city.name, changed.join(", "));
    return snapshot(city);
  },

  // ---- promotions ----
  async listBanners() {
    await delay();
    return snapshot(db.banners);
  },
  async saveBanner(banner, id) {
    await delay(400);
    const admin = need("promos.manage");
    if (banner.title.trim().length < 3) throw new ApiError("invalid_title", "Enter the banner text");
    if (banner.cityIds.length === 0) throw new ApiError("no_city", "Choose at least one city");
    const saved = { ...banner, title: banner.title.trim(), id: id ?? `ban-${db.banners.length + 1}` };
    if (id) db.banners.splice(db.banners.indexOf(find(db.banners, id, "Banner")), 1, saved);
    else db.banners.unshift(saved);
    log(admin, id ? "Edited banner" : "Added banner", saved.title, saved.active ? "Active" : "Inactive");
    return snapshot(saved);
  },
  async listPromoCodes() {
    await delay();
    return snapshot(db.promoCodes);
  },
  async savePromoCode(promo, id) {
    await delay(400);
    const admin = need("promos.manage");
    const code = promo.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(code)) throw new ApiError("invalid_code", "Codes are 4–16 letters and numbers");
    if (db.promoCodes.some((p) => p.code === code && p.id !== id)) throw new ApiError("duplicate", "That code already exists");
    if (promo.kind === "percent" && !(promo.value > 0 && promo.value <= 100)) throw new ApiError("invalid_value", "Percent must be between 1 and 100");
    const existing = id ? find(db.promoCodes, id, "Promo code") : undefined;
    const saved = { ...promo, code, id: id ?? `promo-${db.promoCodes.length + 1}`, uses: existing?.uses ?? 0 };
    if (existing) db.promoCodes.splice(db.promoCodes.indexOf(existing), 1, saved);
    else db.promoCodes.unshift(saved);
    log(admin, id ? "Edited promo code" : "Added promo code", code, saved.active ? "Active" : "Inactive");
    return snapshot(saved);
  },
  async getReferralConfig() {
    await delay();
    return snapshot(referral);
  },
  async updateReferralConfig(config) {
    await delay(400);
    const admin = need("promos.manage");
    if (config.referrerRewardKobo < 0 || config.refereeDiscountKobo < 0) throw new ApiError("invalid_amount", "Amounts can’t be negative");
    referral = { ...config };
    log(admin, "Updated referrals", "Referral programme", `${config.enabled ? "On" : "Off"} · give ${naira(config.refereeDiscountKobo)}, get ${naira(config.referrerRewardKobo)}`);
    return snapshot(referral);
  },

  // ---- push notifications ----
  async listBroadcasts() {
    await delay();
    return snapshot(broadcasts);
  },
  async countAudience(audience, cityIds) {
    await delay(150);
    return reach(audience, cityIds);
  },
  async sendBroadcast(input) {
    await delay(700);
    const admin = need("notifications.send");
    const title = input.title.trim();
    const body = input.body.trim();
    if (title.length < 3 || title.length > 50) throw new ApiError("invalid_title", "The title must be 3–50 characters");
    if (body.length < 10 || body.length > 160) throw new ApiError("invalid_body", "The message must be 10–160 characters");
    if (input.cityIds.length === 0) throw new ApiError("no_city", "Choose at least one city");
    if (input.sendAt && new Date(input.sendAt).getTime() < Date.now() + 60_000) throw new ApiError("past", "Choose a time in the future");
    const recipients = reach(input.audience, input.cityIds);
    if (recipients === 0) throw new ApiError("nobody", "Nobody matches that audience");
    const b: Broadcast = { id: `push-${broadcasts.length + 1}`, title, body, audience: input.audience, cityIds: [...input.cityIds], link: input.audience === "customers" ? input.link : "home", status: input.sendAt ? "scheduled" : "sent", sendAt: input.sendAt ?? iso(), recipients, opened: 0, sentBy: admin.name };
    broadcasts.unshift(b);
    log(admin, input.sendAt ? "Scheduled push notification" : "Sent push notification", `“${title}”`, `${recipients.toLocaleString("en-NG")} ${input.audience} · ${input.cityIds.join(", ")}`);
    return snapshot(b);
  },
  async cancelBroadcast(id) {
    await delay(400);
    const admin = need("notifications.send");
    const b = find(broadcasts, id, "Notification");
    if (b.status !== "scheduled") throw new ApiError("already_sent", "This notification has already gone out");
    b.status = "cancelled";
    log(admin, "Cancelled push notification", `“${b.title}”`, "Was scheduled, not sent");
    return snapshot(b);
  },

  async listAudit() {
    await delay();
    need("audit.view");
    return snapshot(audit);
  },
};
