/**
 * Invented sample data for the admin mock. Generated from a fixed seed so every reload
 * shows the same people and numbers. None of it is real.
 */
import type { Banner, City, Customer, Order, OrderStatus, PromoCode, Rider, Transaction, Vendor, Withdrawal } from "../types";

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Small deterministic random generator. */
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const first = ["Amina", "Tunde", "Ngozi", "Zainab", "Emeka", "Fatima", "Ibrahim", "Chioma", "Musa", "Sani", "Hauwa", "Bola", "Yusuf", "Kemi", "Aliyu", "Blessing", "Garba", "Funmi", "Usman", "Ada"];
const last = ["Bello", "Bako", "Okafor", "Musa", "Obi", "Sani", "Adeyemi", "Abdullahi", "Lawal", "Eze", "Danjuma", "Okoro", "Yakubu", "Balogun"];
const streets: Record<string, string[]> = {
  kaduna: ["Kawo Road", "Ali Akilu Road", "Ahmadu Bello Way", "Independence Way", "Barnawa", "Sabon Tasha", "Yakubu Gowon Way"],
  abuja: ["Wuse 2", "Garki Area 11", "Gwarinpa", "Maitama", "Jabi", "Utako"],
  kano: ["Zoo Road", "Bompai Road", "Sabon Gari", "Nassarawa GRA", "Zaria Road"],
  lagos: ["Ikeja GRA", "Yaba", "Lekki Phase 1", "Surulere", "Victoria Island", "Ikoyi"],
};
const vendorNames: [string, Vendor["category"]][] = [
  ["Arewa Kitchen", "restaurant"], ["Suya Junction", "fast_food"], ["Mama Put Express", "restaurant"], ["Chill Spot Drinks", "drinks"], ["FreshMart Groceries", "groceries"],
  ["Bola’s Buka", "restaurant"], ["Capital Shawarma", "fast_food"], ["Zobo & Co", "drinks"], ["Kano Spice House", "restaurant"], ["HealthPlus Pharmacy", "pharmacy"],
  ["Island Grill", "fast_food"], ["Yaba Rice Bowl", "restaurant"], ["Wuse Smoothies", "drinks"], ["Sabon Gari Mart", "groceries"],
];

export const cities: City[] = [
  { id: "kaduna", name: "Kaduna", isActive: true, baseFareKobo: 50_000, perKmKobo: 15_000, minOrderKobo: 100_000, surgeOn: false, surgeMultiplier: 1.2, opensAt: "07:00", closesAt: "22:00" },
  { id: "abuja", name: "Abuja", isActive: true, baseFareKobo: 70_000, perKmKobo: 18_000, minOrderKobo: 150_000, surgeOn: true, surgeMultiplier: 1.3, opensAt: "07:00", closesAt: "23:00" },
  { id: "kano", name: "Kano", isActive: true, baseFareKobo: 50_000, perKmKobo: 14_000, minOrderKobo: 100_000, surgeOn: false, surgeMultiplier: 1.2, opensAt: "08:00", closesAt: "21:00" },
  { id: "lagos", name: "Lagos", isActive: false, baseFareKobo: 80_000, perKmKobo: 20_000, minOrderKobo: 200_000, surgeOn: false, surgeMultiplier: 1.5, opensAt: "07:00", closesAt: "23:00" },
];
const cityWeights = ["kaduna", "kaduna", "kaduna", "abuja", "abuja", "kano", "lagos"];

export function buildSeed(now = Date.now()) {
  const rnd = mulberry(20261003);
  const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const name = () => `${pick(first)} ${pick(last)}`;
  const phone = () => `+23480${Math.floor(10_000_000 + rnd() * 89_999_999)}`;
  const iso = (ms: number) => new Date(ms).toISOString();
  const code = (i: number) => `VD-${(60_466_176 + i * 7919 + Math.floor(rnd() * 5000)).toString(36).toUpperCase().slice(-5)}`;

  const vendors: Vendor[] = vendorNames.map(([vname, category], i) => {
    const cityId = ["kaduna", "kaduna", "kaduna", "kaduna", "kaduna", "kaduna", "abuja", "abuja", "kano", "kano", "lagos", "lagos", "abuja", "kano"][i];
    const orders30d = i === 5 ? 0 : Math.floor(40 + rnd() * 380);
    return {
      id: `vendor-${i + 1}`, name: vname, category, cityId, address: `${pick(streets[cityId])}, ${cities.find((c) => c.id === cityId)!.name}`, ownerName: name(), phone: phone(),
      approval: i === 5 || i === 12 ? "under_review" : i === 13 ? "suspended" : "approved", isOpen: i !== 5 && i !== 12 && i !== 13 && rnd() > 0.25,
      commissionRate: [0.15, 0.15, 0.12, 0.15, 0.1][i % 5], tier: (["standard", "basic", "premium", "basic", "standard"] as const)[i % 5],
      rating: i === 5 ? 0 : Math.round((3.9 + rnd() * 1) * 10) / 10, menuItems: i === 5 ? 0 : Math.floor(6 + rnd() * 30), orders30d, revenue30dKobo: orders30d * Math.floor(250_000 + rnd() * 250_000),
    };
  });

  const riders: Rider[] = Array.from({ length: 26 }, (_, i) => {
    const cityId = cityWeights[i % cityWeights.length];
    const approval: Rider["approval"] = i < 4 ? "pending" : i === 4 ? "rejected" : i === 5 ? "suspended" : "approved";
    const presence: Rider["presence"] = approval !== "approved" ? "offline" : (["online", "on_trip", "online", "offline", "on_trip", "online"] as const)[i % 6];
    const docStatus = approval === "approved" || approval === "suspended" ? "approved" : approval === "rejected" ? "rejected" : "submitted";
    const trips = approval === "pending" ? 0 : Math.floor(20 + rnd() * 600);
    return {
      id: `rider-${i + 1}`, name: name(), phone: phone(), cityId, vehicle: i % 9 === 8 ? "Electric motorcycle" : "Motorcycle",
      plateNumber: `${cityId.slice(0, 3).toUpperCase()} ${Math.floor(100 + rnd() * 899)} ${pick(["QR", "BW", "AA", "KD", "XA"])}`, approval,
      note: approval === "rejected" ? "ID photo is blurred — asked to re-upload" : approval === "suspended" ? "Three customer complaints about late deliveries" : undefined,
      presence, rating: trips ? Math.round((4.2 + rnd() * 0.8) * 10) / 10 : 0, trips, acceptanceRate: trips ? Math.round((0.72 + rnd() * 0.27) * 100) / 100 : 1,
      balanceKobo: trips ? Math.floor(rnd() * 40) * 50_000 : 0, joinedAt: iso(now - Math.floor(rnd() * 200) * DAY),
      documents: (["gov_id", "bike_registration", "photo"] as const).map((kind, d) => ({ kind, status: approval === "rejected" && d === 0 ? "rejected" : docStatus === "rejected" ? "submitted" : docStatus })),
      position: { x: 0.08 + rnd() * 0.84, y: 0.1 + rnd() * 0.8 },
    };
  });

  const customers: Customer[] = Array.from({ length: 36 }, (_, i) => {
    const orders = Math.floor(rnd() * 40);
    return { id: `cust-${i + 1}`, name: name(), phone: phone(), cityId: cityWeights[i % cityWeights.length], orders, spentKobo: orders * Math.floor(300_000 + rnd() * 300_000), walletKobo: Math.floor(rnd() * 30) * 50_000, joinedAt: iso(now - Math.floor(rnd() * 300) * DAY) };
  });

  // ---- orders: 14 days of history plus a few live ones ----
  const orders: Order[] = [];
  const approvedRiders = riders.filter((r) => r.approval === "approved");
  const liveVendors = vendors.filter((v) => v.approval === "approved");
  const make = (i: number, createdMs: number, status: OrderStatus): Order => {
    const food = rnd() > 0.35;
    const vendor = pick(liveVendors);
    const cityId = food ? vendor.cityId : pick(cityWeights.filter((c) => c !== "lagos"));
    const customer = pick(customers);
    const rider = pick(approvedRiders.filter((r) => r.cityId === cityId).length ? approvedRiders.filter((r) => r.cityId === cityId) : approvedRiders);
    const hasRider = !["awaiting_vendor", "searching_rider"].includes(status) && !(status === "cancelled" && rnd() > 0.5);
    const subtotalKobo = food ? Math.floor(4 + rnd() * 18) * 50_000 : 0;
    const deliveryFeeKobo = Math.floor(5 + rnd() * 12) * 10_000;
    const commissionKobo = food ? Math.round(subtotalKobo * vendor.commissionRate) : Math.round(deliveryFeeKobo * 0.2);
    const cityName = cities.find((c) => c.id === cityId)!.name;
    const steps: [string, number][] = [["Order placed", 0]];
    if (food && status !== "awaiting_vendor") steps.push(["Vendor accepted", 3]);
    if (hasRider) steps.push([`Rider assigned — ${rider.name}`, 6]);
    if (["picked_up", "on_the_way", "delivered", "disputed"].includes(status)) steps.push(["Picked up", 18]);
    if (["on_the_way", "delivered", "disputed"].includes(status)) steps.push(["On the way", 20]);
    if (status === "delivered" || status === "disputed") steps.push(["Delivered", 34]);
    if (status === "cancelled") steps.push(["Cancelled by customer", 5]);
    if (status === "disputed") steps.push(["Customer opened a dispute", 50]);
    return {
      id: `order-${i}`, code: code(i), type: food ? "food" : "dispatch", status, cityId, customer: { id: customer.id, name: customer.name, phone: customer.phone },
      vendorName: food ? vendor.name : undefined, riderId: hasRider ? rider.id : undefined, riderName: hasRider ? rider.name : undefined,
      pickup: food ? vendor.address : `${pick(streets[cityId])}, ${cityName}`, dropoff: `${pick(streets[cityId])}, ${cityName}`,
      subtotalKobo, deliveryFeeKobo, commissionKobo, totalKobo: subtotalKobo + deliveryFeeKobo, paymentMethod: pick(["wallet", "wallet", "card", "transfer"] as const), refundedKobo: 0,
      createdAt: iso(createdMs), timeline: steps.map(([label, min]) => ({ label, at: iso(createdMs + min * 60_000), by: "System" })),
      issue: status === "disputed" ? pick(["Customer says an item was missing", "Customer says the order never arrived", "Receiver says the package was damaged"]) : undefined,
    };
  };
  let n = 1;
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  for (let d = 13; d >= 1; d--) {
    const count = Math.floor(9 + rnd() * 9) + (d % 7 === 5 || d % 7 === 6 ? 5 : 0);
    for (let k = 0; k < count; k++) {
      const roll = rnd();
      orders.push(make(n++, startOfToday - d * DAY + Math.floor(8 * HOUR + rnd() * 13 * HOUR), roll < 0.86 ? "delivered" : roll < 0.97 ? "cancelled" : "disputed"));
    }
  }
  const sinceMidnight = Math.max(HOUR, now - startOfToday);
  for (let k = 0; k < 11; k++) orders.push(make(n++, startOfToday + Math.floor(rnd() * sinceMidnight * 0.8), k < 9 ? "delivered" : "cancelled"));
  (["awaiting_vendor", "searching_rider", "searching_rider", "rider_assigned", "picked_up", "on_the_way", "on_the_way"] as const).forEach((status, k) => orders.push(make(n++, now - (25 - k * 3) * 60_000, status)));
  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const withdrawals: Withdrawal[] = approvedRiders.slice(0, 7).map((r, i) => ({
    id: `wd-${i + 1}`, riderId: r.id, riderName: r.name, amountKobo: Math.floor(4 + rnd() * 30) * 50_000, bankName: pick(["GTBank", "Access Bank", "OPay", "UBA", "Zenith Bank"]),
    accountNumber: `••••••${Math.floor(1000 + rnd() * 8999)}`, status: i < 4 ? "pending" : i === 6 ? "declined" : "paid", createdAt: iso(now - (i < 4 ? i * 2 + 1 : 30 + i * 20) * HOUR),
    note: i === 6 ? "Account name didn’t match the rider’s name" : undefined,
  }));

  const transactions: Transaction[] = [];
  orders.slice(0, 40).forEach((o, i) => {
    const at = new Date(o.createdAt).getTime();
    transactions.push({ id: `txn-p${i}`, reference: `PSK-${(at % 1e9).toString(36).toUpperCase()}${i}`, kind: "order_payment", party: o.customer.name, direction: "debit", amountKobo: o.totalKobo, channel: o.paymentMethod === "wallet" ? "wallet" : o.paymentMethod, status: "success", createdAt: o.createdAt });
    if (o.status === "delivered") {
      transactions.push({ id: `txn-c${i}`, reference: `COM-${o.code}`, kind: "commission", party: "Vendo", direction: "credit", amountKobo: o.commissionKobo, channel: "system", status: "success", createdAt: iso(at + 35 * 60_000) });
      if (o.riderName) transactions.push({ id: `txn-e${i}`, reference: `ERN-${o.code}`, kind: "rider_earning", party: o.riderName, direction: "credit", amountKobo: Math.round(o.deliveryFeeKobo * 0.8), channel: "system", status: "success", createdAt: iso(at + 35 * 60_000) });
    }
  });
  customers.slice(0, 8).forEach((c, i) => transactions.push({ id: `txn-t${i}`, reference: `PSK-TOP${1000 + i}`, kind: "topup", party: c.name, direction: "credit", amountKobo: [200_000, 500_000, 1_000_000][i % 3], channel: (["card", "transfer", "ussd"] as const)[i % 3], status: i === 5 ? "failed" : "success", createdAt: iso(now - (i * 5 + 2) * HOUR) }));
  transactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const banners: Banner[] = [
    { id: "ban-1", title: "Free delivery this weekend", cityIds: ["kaduna", "abuja"], active: true, startsAt: iso(now - 2 * DAY), endsAt: iso(now + 3 * DAY) },
    { id: "ban-2", title: "Send a package from ₦500", cityIds: ["kaduna", "abuja", "kano"], active: true, startsAt: iso(now - 10 * DAY), endsAt: iso(now + 20 * DAY) },
    { id: "ban-3", title: "Sallah specials", cityIds: ["kano"], active: false, startsAt: iso(now - 40 * DAY), endsAt: iso(now - 33 * DAY) },
  ];
  const promoCodes: PromoCode[] = [
    { id: "promo-1", code: "VENDO10", description: "10% off food, up to ₦1,000", kind: "percent", value: 10, active: true, uses: 214, maxUses: 1000 },
    { id: "promo-2", code: "FREEDEL", description: "Free delivery", kind: "free_delivery", value: 0, active: true, uses: 88, maxUses: 500 },
    { id: "promo-3", code: "WELCOME500", description: "₦500 off", kind: "amount", value: 50_000, active: false, uses: 300, maxUses: 300 },
  ];

  return { cities: cities.map((c) => ({ ...c })), vendors, riders, customers, orders, withdrawals, transactions, banners, promoCodes };
}
