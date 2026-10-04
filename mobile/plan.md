# Vendo customer app — build plan

The plan for the **Vendo customer app** (iOS + Android) in this `mobile/` folder.
The rider app (`riders/`) gets its own plan afterwards; it reuses the design system and API layer built here.

Sources: `Vendo_PRD_v1_0.docx`, `VENDO_DEVELOPMENT.md`, the three reference designs in this folder, and the finished website in `web/` (brand, colours, illustrations).

---

## 1. What we're building

One app, two services:

- **Food Court** — browse vendors near you, add to cart, pay, track the rider live.
- **Dispatch** — send a document or parcel: pickup, drop-off, package size, fare shown upfront, delivery confirmed with a one-time code.

Plus: wallet, scheduled deliveries, order history and re-order, notifications, profile, dark mode.

## 2. Where things stand

| | Status |
|---|---|
| Website (`web/`) | Done — brand, tokens, illustrations ready to reuse |
| Backend (`server/`) | **Empty.** No API, database or auth yet |
| Admin (`admin/`), Rider app (`riders/`) | Empty |
| This machine | macOS 13.7, Xcode 15.2, Node 24. **No Android SDK or Java.** |

Two consequences shape the plan:

1. **There is no backend to talk to.** The app is built against a typed API layer with a mock implementation first (section 6), then switched to the real API when `server/` exists. Nothing is thrown away.
2. **This Mac is too old to compile current iOS apps locally** (recent Expo versions need a newer Xcode than macOS 13 can install — to be confirmed in Phase 0). Builds come from **EAS Build** (Expo's cloud build service) and are installed on real phones. Because Mapbox is native code, the ready-made Expo Go app can't run the map screens, so we test with our own **development build** of Vendo instead (section 7). No local Xcode or Android Studio needed.

## 3. Design direction

The references are used for **layout and flow**, restyled as Vendo — not copied. (They are another designer's concept with KFC branding, so their imagery and brand content can't be reused.)

**Keep from the references**
- Home: location selector, search, promo banner, category chips, "Popular near you" and "Picks for you" rows, raised cart button in the tab bar.
- Vendor page: hero photo, rating / time / fee line, menu category tabs, item rows with a "+" button, sticky quantity + Add to cart bar.
- Cart: item rows with quantity steppers, promo code, big bottom button.
- Checkout: address, delivery method, order summary, payment method; payment picker as a bottom sheet.
- Tracking: map with route, live status banner, four-step progress, distance / ETA row, rider card with call and chat.

**Change for Vendo**
| Reference | Vendo |
|---|---|
| Red, mint background | Vendo blue `#0064FF`, white / navy; same tokens as the website, light + dark |
| Dollars | Naira (stored as kobo, shown as ₦) |
| Drone / Standard delivery | Bike delivery only; "Deliver now" or "Schedule" |
| Cash, PayPal, Apple Pay | Vendo Wallet, card, bank transfer, USSD (Paystack) |
| Tabs: Home · Offers · Orders · Profile | **Home · Send · (Cart) · Orders · Profile** — "Send" is the dispatch service |
| "View Pickup Station" | One-time delivery code (dispatch), call / WhatsApp rider |
| No dispatch, wallet or onboarding screens | Designed new, in the same style |

Font: **Outfit** (same as the website). Empty states and onboarding reuse the website's isometric illustrations.

## 4. Screens

| Area | Screens |
|---|---|
| Sign-up & login | Splash · 3 intro slides · **Phone number → SMS code** (the same two steps for sign-up and login) · **Name and email** (new users only) · Location permission |
| Home | Home · Search (vendors, dishes) · Category list · Notifications |
| Food | Vendor page · Item options sheet · Cart · Checkout · Payment method sheet · Address picker (map + search) · Order placed |
| Dispatch | Pickup · Drop-off · Item size and description · Receiver details · Now or schedule · Fare review · Pay · Finding a rider · Tracking with delivery code — see section 5 |
| Orders | Active / Past tabs · Order detail (receipt) · Live tracking · Rate order · Re-order |
| Wallet | Balance · Top up · Transactions |
| Profile | Profile · Saved addresses · Referral code · Appearance (light / dark) · Support (WhatsApp) · Legal · Log out |

About 30 screens. The six in the references are built first because they set the visual language for the rest.

## 5. Dispatch — sending an item

This is the "I want to send something somewhere" service. A customer books a rider to collect an item from one address and deliver it to another. It gets its own **Send** tab and a card on Home, so it is never more than one tap away.

**Where it starts**
- The **Send** tab in the bottom bar.
- A "Send a package" card on the Home screen, next to Food Court.
- "Send again" on a past dispatch order (pre-fills the same addresses and receiver).

**The flow**

| Step | What the customer does | What the app shows |
|---|---|---|
| 1. Pickup | Uses current location, a saved address, searches for a place, or **drops a pin on the map**. Adds a landmark or note for the rider ("blue gate, opposite the mosque") | Map with the pickup pin and the address found for it |
| 2. Drop-off | Searches or pins the destination | Both pins and the route between them |
| 3. The item | Picks a size — **Document**, **Small parcel**, **Large parcel** — and describes it in a few words ("shoes", "signed contract"). Optional: marks it fragile | What fits each size, with examples |
| 4. Receiver | Enters the receiver's name and phone number (or picks from contacts). "I'm the receiver" shortcut for sending to yourself | — |
| 5. When | **Send now**, or **Schedule** a date and time | Earliest available time |
| 6. Price | Reviews the fare | Fare from distance and size, with the breakdown (base fare + distance), estimated pickup and delivery time. **Nothing is charged before this screen** |
| 7. Pay | Chooses Vendo Wallet, card, transfer or USSD and confirms | Same payment sheet as food orders |
| 8. Finding a rider | Waits | "Finding the nearest rider…" then the rider's name, photo, bike plate and rating |
| 9. Tracking | Follows the delivery | Live map and the steps: Rider assigned → Picked up → On the way → Delivered. Call or WhatsApp the rider |
| 10. Handover | Shares the **delivery code** with the receiver | The 4-digit code is shown on the tracking screen with a "Share code" button (WhatsApp / SMS). The rider must enter it to complete the delivery |
| 11. Done | Rates the rider | Receipt with route, fare and time; "Send again" |

**Rules the app enforces**
- Pickup and drop-off must both be inside a city Vendo serves, and in the same city. The PRD prices per city and doesn't cover inter-city trips, so I've assumed none at launch — see decision 6.
- A short "what you can't send" notice before the first booking: illegal items, cash, weapons, live animals, anything that doesn't fit the delivery box (same list as the website's Terms).
- The fare shown in step 6 is an estimate from the app; **the server calculates the final price**, and that is what is charged. If they differ, the customer sees the updated price before paying.
- The delivery code belongs to the order, not the rider: three wrong attempts locks it and sends the order to support (PRD §6.3).
- Cancelling is possible until the rider has picked the item up. It is free while a rider is still being found; once a rider is on the way a cancellation fee may apply (as the website's Terms say). After pickup the customer contacts support.

**States that need their own screens** (easy to forget, common in real use)
- No rider available nearby → "Still looking — we've widened the search", then an option to keep waiting, schedule for later, or cancel with no charge.
- Address outside the service area → clear message with the cities served.
- Receiver unreachable / wrong code → rider and customer both see a "contact support" path.
- Scheduled order → appears in Orders as "Scheduled" with the option to edit or cancel until matching begins (15 minutes before).

**What the receiver experiences** — they don't need the app. They get the code from the sender, the rider arrives, they read out the code, done. (An SMS to the receiver with a tracking link is a good later addition; not in the launch scope.)

## 6. Technical approach

Follows `VENDO_DEVELOPMENT.md` §10 unless noted.

- **Expo (React Native) + TypeScript strict**, Expo Router for navigation (file-based, like Next.js in `web/`).
- **Server data:** TanStack Query. **Local state:** Zustand (cart, session, theme), persisted to device storage.
- **Forms / validation:** Zod schemas, shared later with the API.
- **Maps and addresses:** Mapbox and Photon, not Google — details in section 7. Maps load only on screens that need them (PRD: cold start under 3 s).
- **Payments:** Paystack checkout in a WebView. The app never decides an order is paid — the server confirms it.
- **Money:** integer kobo everywhere; one `formatNaira()` helper.
- **Accessibility:** layouts survive 150 % font scale (PRD); no fixed-height text containers.

**The API layer (how we work without a backend)**

```
src/api/
  types.ts      // Vendor, MenuItem, Order, Wallet… from the dev guide's schema
  client.ts     // interface: getVendors(), createOrder(), getTracking()…  (dev guide §9)
  mock/         // in-memory data, realistic delays, a fake rider that moves along a route
  http/         // real implementation — added when server/ exists
```

Screens only call `client.ts`. Switching from mock to real is one config value, so the whole app is demoable end to end before the backend is written, and the mock doubles as the spec for the backend.

**Folder layout**

```
mobile/
  app/            // screens (Expo Router)
  src/
    api/          // above
    components/   // Button, Card, Sheet, Stepper, VendorCard…
    theme/        // colours, type, spacing — light + dark
    store/        // cart, session, settings
    lib/          // money, dates, location helpers
  assets/         // logo, illustrations, fonts
  reference/      // the three design images (moved out of the root)
```

`VENDO_DEVELOPMENT.md` describes a single monorepo (`apps/customer`, shared packages). The repo currently has separate top-level folders, so this plan keeps `mobile/` self-contained. Shared code can be extracted into packages when the rider app starts — cheap to do then, premature now.

## 7. Maps and addresses — Mapbox + Photon

No Google Maps anywhere in the app.

| Job | Tool | Where it runs |
|---|---|---|
| Showing the map, pins, the route line, the moving rider | **Mapbox** (`@rnmapbox/maps`), with a light and a dark map style to match the app themes | In the app |
| Address search as you type ("Kawo Road…") | **Photon** (open-source search on OpenStreetMap data), biased to the customer's city | App → our server → Photon |
| Turning a dropped pin into an address | **Photon** reverse lookup | App → our server → Photon |
| Route, distance and travel time (for the fare and the ETA) | **Mapbox Directions** | **Our server only** — the fare must never be calculated on the phone |

**What this changes**

1. **We need a development build from Phase 0.** Mapbox is native code, so the generic Expo Go app can't show the map. We build a "Vendo (dev)" app once with EAS and install it on the test phones; after that, code changes still reload instantly. The Android build is free to install. The **iPhone build needs the Apple Developer account ($99/yr) up front**, not at release time.
2. **Photon needs a home before launch.** The public Photon server (`photon.komoot.io`) is a free demo with no uptime guarantee and fair-use limits — fine for development, not for a live delivery business. For launch we either host our own Photon (one small server loaded with Nigeria's map data) or pay a hosted provider. This is a `server/` task; the app only ever talks to our API, so it can change without an app update.
3. **Address data in Nigeria is thin.** OpenStreetMap has roads and landmarks for the four cities but few house numbers, so typed search will often find the street and not the building. The app is designed around that: **dropping a pin is a first-class way to set an address, not a fallback**, every address has a landmark / note field for the rider, and saved addresses keep the exact pin. Phase 0 includes testing real Kaduna, Abuja, Kano and Lagos addresses in Photon so we know how good it is before building on it.
4. **`VENDO_DEVELOPMENT.md` still says Google** (Distance Matrix for fares, Places for address autocomplete, Google Maps keys). Those parts need updating to Mapbox Directions and Photon so the backend is built to match. The website also mentions Google Maps in a few places (Download page, Privacy Policy, the Contact page map).

**In the mock phase** the app calls the public Photon server directly and draws straight-line routes, so nothing here blocks Phases 1–5. Only the map display needs a Mapbox token from day one.

## 8. Phases

Each phase ends with something you can open on your phone.

**Phase 0 — Setup and risk checks**
- Create the Expo project and a development build with EAS; install it on the test phones.
- Confirm the minimum iOS version the current Expo supports (PRD says iOS 14; current Expo likely needs newer — decide).
- Mapbox: a map renders in light and dark style, with a pin and a route line.
- Photon: test real addresses and landmarks in Kaduna, Abuja, Kano and Lagos — search and pin-to-address — and record how well it does.
- Confirm the Paystack WebView works.
- *Done when:* a Vendo-branded app with a working Mapbox map opens on a real Android phone (and a real iPhone once the Apple account exists).

**Phase 1 — Foundation**
- Theme (light / dark), Outfit font, core components, tab bar with raised cart button.
- API types, client interface and mock data (vendors, menus, a user, a wallet).
- *Done when:* the tab shell works in both themes with placeholder screens.

**Phase 2 — Food ordering** *(the reference screens)*
- Home, search, vendor page, cart, checkout, payment sheet, address picker, order placed.
- *Done when:* you can order a meal start to finish against mock data.

**Phase 3 — Orders and live tracking**
- Orders list, order detail, tracking screen with the moving rider, status steps, rider contact, rating, re-order.
- *Done when:* a placed order appears in Orders and the rider moves on the map to "Delivered".

**Phase 4 — Dispatch** *(section 5)*
- The full send-an-item flow: pickup, drop-off, item size, receiver, now or scheduled, fare review, payment.
- Rider matching and tracking screens, the delivery code with "Share code", rating and "Send again".
- The no-rider, out-of-area and scheduled states.
- *Done when:* you can book a dispatch, watch it delivered, and the order only completes with the right code.

**Phase 5 — Account**
- Sign-up and login: phone number → SMS code → name and email for new users; returning users skip the last step.
- Profile, saved addresses, wallet, notifications list, referral, appearance, support.
- *Done when:* a new user can go from first launch to a completed order.

**Phase 6 — Real backend** *(needs `server/`)*
- Swap mock for HTTP client; Supabase phone auth; realtime order status and rider location; Paystack test mode; push notifications.
- *Done when:* the same flows work against staging with Paystack test payments.

**Phase 7 — Release**
- Low-end Android pass (2 GB RAM), 150 % font scale pass, offline / poor network states, crash reporting, app icons and splash, store listings, TestFlight and Play internal testing.

Phases 1–5 need nothing from the backend. Phase 6 is blocked until the API exists, so **`server/` should be built in parallel from about Phase 3 onward**.

## 9. How each phase is checked

- TypeScript strict and lint clean.
- Unit tests for the logic that handles money and orders: cart totals, kobo formatting, fare maths, order status steps.
- Every screen checked in light and dark mode, at 150 % font scale, on a small phone and a large one.
- I can render screens in a browser for quick checks here, but **real-device testing on your phones is the real check** — especially maps, keyboard behaviour and performance.

## 10. Decisions needed from you

| # | Question | My recommendation |
|---|---|---|
| 1 | Build the app against mock data first, backend in parallel later? | **Yes** — fastest route to something you can show, and it defines the API |
| 2 | Tabs: Home · Send · Cart · Orders · Profile? | **Yes** — puts dispatch one tap away |
| 3 | Is **cash on delivery** wanted? The PRD has only wallet, card and transfer; the reference shows cash | **No for launch** — cash complicates rider payouts and fraud control |
| 4 | Food and vendor photos: do you have real vendor photos, or placeholders for now? | Placeholders now, real photos before launch |
| 5 | Minimum iOS version, if current Expo can't support iOS 14 | Accept the newer minimum — iOS 14 phones are a small share |
| 6 | Dispatch within one city only (e.g. Kaduna → Kaduna), or between cities too (Kaduna → Abuja)? | **Same city only for launch** — inter-city needs different pricing, timing and rider rules |
| 7 | Cancellation fee once a rider is already on the way to pickup: how much? | A small flat fee, set per city in the admin dashboard |
| 8 | Photon for launch: host our own, or pay a hosted provider? | **Host our own** — one small server, no per-search cost; decide by Phase 6 |
| 9 | Shall I update `VENDO_DEVELOPMENT.md` and the website wording from Google to Mapbox / Photon? | **Yes** — so the backend is built to match |

## 11. What I need from you

- A phone or two for testing — ideally one **low-end Android**. I'll give you a link to install the Vendo development build.
- A **Mapbox account** (free tier) and its access token — needed in Phase 0.
- To test on iPhone: the **Apple Developer account ($99/yr)**, needed from Phase 0 because of the development build. Android testing needs nothing.
- An **Expo account** (free) for cloud builds.
- Later, for Phase 6–7: Paystack test keys, a decision on Photon hosting (section 7), and a Google Play Console account ($25 one-off).

## 12. Not in this plan

- Rider app, admin dashboard, backend — separate plans.
- Vendor-facing app (the PRD has vendors managed through the admin dashboard).
- Photo-on-delivery, surge pricing, promo banners management — PRD Phase 4 items, handled on the backend / admin side.
