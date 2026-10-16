// Local preview of the Vendo customer and rider apps, signed in with sample data, for importing
// screens into Figma with the html.to.design Chrome extension.
//
//   node design/preview/server.mjs   then open http://localhost:4300 (on Railway: the service's address)
//
// One address for both apps: the first page asks which app to open and remembers the choice. Each app's
// sample-data API is on the same address (the builds call /v1/… on whatever site they are opened from).
//
// Stores, menus and photos come from the live API (read-only, public); everything about the signed-in
// person (orders, wallet, trips, earnings…) is invented here. Nothing is ever sent to the live API.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIVE = "https://api.vendoltd.com";
const ABUJA = "249ca746-2706-4f90-9b8e-f958ba7afed8";
const uid = (n) => `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const live = async (p) => (await fetch(LIVE + p)).json();

// What the rider app shows on its home screen: switch with <rider site>/__mode?offer=1 or ?job=1, then reload.
const mode = { offer: false, job: false };

// ---------------------------------------------------------------- sample data
const home = { lat: 9.0765, lng: 7.4951, address: "12 Aminu Kano Crescent, Wuse 2, Abuja" };
const list = (await live(`/v1/vendors?city_id=${ABUJA}&limit=50`)).items;
const pick = list.filter((v) => v.is_open && v.image_url && v.category === "restaurant").sort((a, b) => b.rating - a.rating)[0] ?? list[0];
const { vendor, menu } = await live(`/v1/vendors/${pick.id}`);
const items = menu.filter((m) => m.is_available).slice(0, 3);
const quote = {
  id: uid(50), vendor_id: vendor.id, vendor_name: vendor.name, pickup: { ...vendor.location, address: vendor.address }, dropoff: home,
  items: items.map((m, i) => ({ menu_item_id: m.id, name: m.name, quantity: i === 0 ? 2 : 1, unit_price_kobo: m.price_kobo, options: [], note: null })),
  subtotal_kobo: items.reduce((n, m, i) => n + m.price_kobo * (i === 0 ? 2 : 1), 0), distance_m: 3400, eta_minutes: 28, delivery_fee_kobo: 80000, discount_kobo: 0, promo: null,
};
quote.total_kobo = quote.subtotal_kobo + quote.delivery_fee_kobo;
const order = (n, status, minutes, type = "food") => ({
  id: uid(60 + n), code: `VD-${["7K2QX", "4M9TB", "8P3WN", "2H6RC"][n]}`, type, status, payment_status: "paid", payment_method: "wallet", created_at: ago(minutes), scheduled_at: null,
  quote: type === "food" ? quote : { type: "dispatch", pickup: home, dropoff: { lat: 9.05, lng: 7.47, address: "Plot 4 Garki Area 11, Abuja" }, package: { size: "small", description: "Documents and a phone charger" }, receiver: { name: "Chidi Okafor", phone: "+2348035551234" }, distance_m: 5200, eta_minutes: 22, delivery_fee_kobo: 120000, discount_kobo: 0, total_kobo: 120000 },
});
const orders = [order(0, "on_the_way", 21), order(1, "delivered", 60 * 26), order(2, "delivered", 60 * 50, "dispatch"), order(3, "delivered", 60 * 75)];
const mid = { lat: (vendor.location.lat + home.lat) / 2, lng: (vendor.location.lng + home.lng) / 2 + 0.004 };
const tracking = { status: "on_the_way", rider: { id: uid(9), name: "Musa Ibrahim", plate_number: "KAD 482 QR", phone: "+2348035550101" }, location: { ...mid, heading: 40 }, eta: { distance_m: 1300, duration_s: 420 } };

const customer = (p, u) => {
  if (p === "/v1/me") return { id: uid(1), phone: "+2348031234567", name: "Amina Bello", email: "amina@example.com", onboarding_step: "complete", role: "customer" };
  if (p === "/v1/me/referrals") return { code: "K7PQ", enabled: true, referrer_reward_kobo: 100000, referee_reward_kobo: 50000, minimum_order_kobo: 300000, pending: 1, rewarded: 3, earned_kobo: 300000, applied: false };
  if (p === "/v1/me/city") return { city: { id: ABUJA, name: "Abuja", is_active: true, is_open: true, service_area_configured: true } };
  if (p === "/v1/me/addresses") return { items: [{ id: uid(20), label: "Home", address: home.address, location: { lat: home.lat, lng: home.lng }, landmark: null, note: null }, { id: uid(21), label: "Work", address: "Central Business District, Abuja", location: { lat: 9.058, lng: 7.489 }, landmark: null, note: null }] };
  if (p === "/v1/wallet") return { balance_kobo: 2845000 };
  if (p === "/v1/wallet/transactions") return { items: [["top_up", 1000000, 40], ["checkout", -625000, 60 * 15], ["referral", 50000, 60 * 19], ["checkout", -120000, 60 * 41], ["top_up", 2000000, 60 * 66], ["refund", 340000, 60 * 89]].map(([kind, amount_kobo, min], i) => ({ id: uid(30 + i), kind, reference: `VW${1000 + i}`, amount_kobo, created_at: ago(min) })) };
  if (p === "/v1/me/notifications") return { items: [{ id: uid(40), title: "Your rider is on the way", body: `Musa has picked up your order from ${vendor.name}.`, order_id: orders[0].id, created_at: ago(6) }], unread: 1 };
  if (p === "/v1/maps/reverse") return { items: [{ id: "osm:1", name: "Aminu Kano Crescent", address: "Aminu Kano Crescent, Wuse 2, Abuja, Federal Capital Territory, Nigeria", location: { lat: home.lat, lng: home.lng } }], attribution: "" };
  if (p === "/v1/maps/search") return { items: [{ id: "osm:2", name: "Wuse Market", address: "Wuse Market, Wuse, Abuja", location: { lat: 9.065, lng: 7.468 } }, { id: "osm:3", name: "Jabi Lake Mall", address: "Jabi Lake Mall, Jabi, Abuja", location: { lat: 9.071, lng: 7.423 } }], attribution: "" };
  if (p === "/v1/maps/route") return { city_id: ABUJA, profile: "driving", distance_m: 3400, duration_s: 600, geometry: { type: "LineString", coordinates: [[vendor.location.lng, vendor.location.lat], [mid.lng, mid.lat], [home.lng, home.lat]] } };
  if (p === "/v1/orders/quote") return quote;
  if (p === "/v1/orders") return { items: u.searchParams.get("status") === "past" ? orders.slice(1) : orders.slice(0, 1) };
  const o = p.match(/^\/v1\/orders\/([^/]+)(\/.*)?$/);
  if (o) {
    const found = orders.find((x) => x.id === o[1]) ?? orders[0];
    if (!o[2]) return found;
    if (o[2] === "/tracking") return tracking;
    if (o[2] === "/chat") return { messages: [{ id: uid(90), seq: "1", sender_id: uid(9), text: "I’m at the gate, coming up now.", created_at: ago(2) }] };
    if (o[2] === "/cancellation") return { eligible: false, fee_kobo: 0, refund_amount_kobo: 0, reason: null };
    if (o[2] === "/rating") return { service_rating: 5 };
    return {};
  }
  return {};
};

const pickup = { lat: 9.0765, lng: 7.4951, address: "Jollof Republic, Aminu Kano Crescent, Wuse 2" }, dropoff = { lat: 9.052, lng: 7.471, address: "Plot 4 Garki Area 11, Abuja" };
const jobOrder = { id: uid(70), code: "VD-7K2QX", type: "dispatch", status: "on_the_way", created_at: ago(18), status_updated_at: ago(9), quote: { pickup: { ...pickup, address: "Shop 12, Wuse Market, Abuja" }, dropoff, distance_m: 5200, package: { size: "small", description: "Shoes in a box", fragile: false }, receiver: { name: "Chidi Okafor", phone: "+2348035551234" } } };
const earn = [[12, 95000], [70, 120000], [150, 80000], [240, 110000], [876, 90000], [954, 130000], [1038, 85000], [1152, 105000], [2304, 140000], [2406, 75000], [2562, 99000], [3732, 125000], [3930, 88000], [5178, 150000], [5328, 92000], [5424, 70000], [6636, 115000], [6786, 98000], [8094, 132000], [8232, 81000]];
const titles = ["Jollof Republic", "Package for Chidi", "Chicken Hub", "Arewa Kitchen", "Package for Ngozi", "Slice Pizza Co.", "Zobo & Co."];
const rider = (p) => {
  if (p === "/v1/me") return { id: uid(2), phone: "+2348035550101", name: "Musa Ibrahim", email: "musa@example.com", onboarding_step: "complete", role: "rider" };
  if (p === "/v1/riders/me") return { city_id: ABUJA, vehicle_type: "motorcycle", plate_number: "KAD 482 QR", approval: "approved", presence: mode.job ? "busy" : "online", approval_note: null };
  if (p === "/v1/riders/me/documents") return ["identity", "license", "vehicle"].map((kind) => ({ kind, status: "approved", review_note: null, created_at: ago(9000) }));
  if (p === "/v1/riders/me/summary") return { rating: 4.9, total_trips: 312, acceptance_rate: 0.96, minimum_withdrawal_kobo: 100000, offer: mode.offer ? { id: uid(80), earning_kobo: 120000, trip_distance_m: 5200, summary: "2 items · Jollof Republic" } : null, job: mode.job ? { order_id: jobOrder.id, earning_kobo: 120000, code_attempts_left: 3 } : null };
  if (p === "/v1/riders/me/offers/current") return mode.offer ? { id: uid(80), order_id: uid(71), type: "food", status: "pending", distance_m: 900, package: null, expires_at: new Date(Date.now() + 28000).toISOString(), pickup, dropoff } : null;
  if (p === "/v1/riders/me/job") return mode.job ? jobOrder : null;
  if (p === "/v1/riders/me/trips") return { items: earn.map(([min, kobo], i) => ({ order_id: uid(100 + i), code: `VD-${(7891011 + i * 104729).toString(36).toUpperCase().slice(-5)}`, type: titles[i % 7].startsWith("Package") ? "dispatch" : "food", title: titles[i % 7], pickup, dropoff, distance_m: 2100 + ((i * 713) % 4200), earning_kobo: kobo, completed_at: ago(min) })) };
  if (p.endsWith("/transactions")) return earn.map(([min, kobo], i) => ({ id: uid(200 + i), reference: `E${i}`, kind: "earning", available_delta: kobo, order_id: uid(100 + i), created_at: ago(min) }));
  if (p.endsWith("/bank")) return { bank_code: "058", last_four: "4821", account_name: "MUSA IBRAHIM" };
  if (p.endsWith("/withdrawals")) return [{ id: uid(300), amount_kobo: 1500000, status: "succeeded", review_note: null, created_at: ago(60 * 17) }, { id: uid(301), amount_kobo: 2000000, status: "succeeded", review_note: null, created_at: ago(60 * 100) }];
  if (/^\/v1\/earnings\/rider\/[^/]+$/.test(p)) return { available_kobo: 2315000, held_kobo: 215000 };
  if (p === "/v1/payout-banks") return { items: [{ code: "058", name: "GTBank" }, { code: "044", name: "Access Bank" }] };
  if (p === "/v1/me/notifications") return { items: [{ id: uid(41), title: "You’ve been paid", body: "₦15,000 was sent to your GTBank account.", created_at: ago(60 * 17) }], unread: 0 };
  if (p.endsWith("/chat")) return { messages: [{ id: uid(91), seq: "1", sender_id: uid(1), text: "Please call when you arrive.", created_at: ago(3) }] };
  return {};
};

// ---------------------------------------------------------------- servers
// signed in from the first load: the session is put in place before the app starts
const seeds = {
  "customer-app": { "vendo.tokens": { access: "preview", refresh: "preview" }, "vendo-session": { state: { token: "preview", user: { id: uid(1), name: "Amina Bello", phone: "+2348031234567", email: "amina@example.com", cityId: ABUJA, referralCode: "K7PQ" } }, version: 0 }, "vendo-city": { state: { city: { id: ABUJA, name: "Abuja" } }, version: 0 }, "vendo-addresses-v2": { state: { addresses: [{ id: uid(20), label: "Home", ...home }, { id: uid(21), label: "Work", address: "Central Business District, Abuja", lat: 9.058, lng: 7.489 }] }, version: 0 }, "vendo-cart": { state: { vendorId: vendor.id, vendorName: vendor.name, promo: null, lines: items.map((m, i) => ({ key: `${m.id}:`, menuItemId: m.id, vendorId: vendor.id, name: m.name, unitPriceKobo: m.price_kobo, quantity: i === 0 ? 2 : 1, imageUrl: m.image_url ?? undefined })) }, version: 2 } },
  "rider-app": { "vendo.rider.tokens": { access: "preview", refresh: "preview" }, "vendo-rider-session": { state: { token: "preview", user: { id: uid(2), name: "Musa Ibrahim", phone: "+2348035550101", email: "musa@example.com" } }, version: 0 } },
};
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".ico": "image/x-icon", ".webp": "image/webp" };

/** Sample-data API for one app. */
async function api(app, req, res, u) {
  const p = u.pathname;
  try {
    // stores and menus are public, so they come from the live API; the rest is sample data
    const open = req.method === "GET" && (p === "/v1/cities" || p.startsWith("/v1/vendors"));
    let body;
    if (open) {
      const d = await live(p + u.search);
      if (p === "/v1/vendors") d.items = d.items.filter((v) => v.is_open && v.rating >= 4).sort((a, b) => b.rating - a.rating);
      body = d;
    } else body = app === "rider-app" ? rider(p, u) : customer(p, u);
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(body));
  } catch {
    res.writeHead(503, { "content-type": "application/json" }).end("{}");
  }
}

const CHOOSER = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vendo preview</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0064ff;font-family:-apple-system,system-ui,sans-serif;color:#fff}main{text-align:center;padding:24px}h1{font-size:28px;margin:0 0 8px}p{opacity:.85;margin:0 0 28px}a{display:block;margin:12px auto;width:260px;padding:16px;border-radius:99px;background:#fff;color:#0a1633;font-weight:700;text-decoration:none}a.r{background:#0a1633;color:#fff}</style></head>
<body><main><h1>Vendo app preview</h1><p>Sample data — nothing here is real or sent anywhere.</p><a href="/__app/customer">Customer app</a><a class="r" href="/__app/rider">Rider app</a></main></body></html>`;
const appOf = (req) => (/(?:^|;\s*)vendo_app=(customer-app|rider-app)/.exec(req.headers.cookie ?? "") ?? [])[1];

function serve(port) {
  http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://localhost"), p = decodeURIComponent(u.pathname);
    if (p === "/health") return res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    // choosing an app (or switching): remember it and open it
    if (p === "/__app/customer" || p === "/__app/rider") return res.writeHead(302, { "set-cookie": `vendo_app=${p.endsWith("rider") ? "rider-app" : "customer-app"}; Path=/; SameSite=Lax`, location: "/" }).end();
    if (p === "/__switch") return res.writeHead(302, { "set-cookie": "vendo_app=; Path=/; Max-Age=0", location: "/" }).end();
    const app = appOf(req);
    if (!app) return res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(CHOOSER);
    if (p.startsWith("/v1/")) return api(app, req, res, u);
    if (p === "/__mode") {
      for (const key of ["offer", "job"]) if (u.searchParams.has(key)) mode[key] = u.searchParams.get(key) === "1";
      return res.writeHead(302, { location: "/" }).end();
    }
    const root = path.join(HERE, app);
    const seed = `<script>(function(){var s=${JSON.stringify(seeds[app])};for(var k in s)if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify(s[k]));})();</script>`;
    const file = [path.join(root, p), path.join(root, p + ".html"), path.join(root, p, "index.html")].find((f) => f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile()) ?? path.join(root, "index.html");
    const ext = path.extname(file);
    let body = fs.readFileSync(file);
    if (ext === ".html") body = body.toString().replace("<head>", "<head>" + seed);
    // the same file names exist in both apps, so nothing is cached across a switch
    res.writeHead(200, { "content-type": types[ext] ?? "application/octet-stream", "cache-control": "no-cache", vary: "Cookie" }).end(body);
  }).listen(port, "0.0.0.0");
}

const port = Number(process.env.PORT ?? 4300);
serve(port);
console.log(`Vendo app preview: http://localhost:${port}
  Switch app:                     http://localhost:${port}/__switch
  Rider app with a new order:     http://localhost:${port}/__mode?offer=1
  Rider app with a delivery:      http://localhost:${port}/__mode?job=1
  Rider app back to waiting:      http://localhost:${port}/__mode?offer=0&job=0
Press Ctrl+C to stop.`);
