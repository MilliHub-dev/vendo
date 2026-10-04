# Vendo — customer app

Expo (React Native) + TypeScript. The build plan is in [plan.md](plan.md).

```bash
npm install
npm start            # dev server; press w for the browser preview
npm run typecheck
npm run lint
npm test
```

The map screens (Phase 2 onward) use Mapbox, which needs a development build made with EAS — they won't run in Expo Go. Everything built so far runs in Expo Go and in the browser.

## Structure

```
src/
  app/                 screens — every file is a route (Expo Router)
    _layout.tsx        fonts, providers, sign-in gate, header title of every screen
    (auth)/            welcome → phone → otp → details (new users only)
    (tabs)/            Home · Send · Orders · Profile   (the cart is the raised button)
    search  vendor/[id]  cart  checkout
    dispatch/review
    order/[id]/        placed · track · details
    wallet/  addresses/  notifications  profile-edit  settings/appearance
  api/                 types, the ApiClient interface, query hooks, and the mock backend
  components/
    ui/                Text, Button, Input, Card, Screen, Sheet (bottom-sheet modal), chips, stepper…
    sheets.tsx         item, payment, address, schedule and rating sheets
    Tiles.tsx          vendor / dish cards and rows     PromoCarousel, OrderCard, TabBar
    RouteMap.tsx       drawn stand-in for the live map — replace with Mapbox
    ConfirmHost.tsx    the app-wide "are you sure?" sheet (store/confirm.ts)
  lib/                 money (kobo), cart totals, order-status rules, dates, Photon search + tests
  store/               cart, session, addresses, dispatch draft, settings
  theme/               colour, type, spacing and shadow tokens — light + dark
assets/images/         app icon, splash, logos, illustrations (art-*.png, rendered from web/)
reference/             the design references
```

## Still placeholders

- **Map**: `RouteMap` is a diagram, not real streets. Mapbox (`@rnmapbox/maps`) needs an access token and a development build; dropping a pin to choose an address comes with it.
- **Photos**: vendors and dishes show emoji tiles until real photos exist (`imageUrl` is already in the types).
- **Payments**: card, transfer and top-ups succeed instantly in the mock. The real flow opens Paystack and waits for the server.
- **Saved addresses** live on the device only; **push notifications** are not wired.
- **Chat with the rider** (`order/[id]/chat`) runs against the mock: the rider's replies are canned and messages are polled every 2 s. The server needs `listMessages` / `sendMessage` with realtime delivery, and the rider app needs the matching screen.

## Working without a backend

Screens only use `src/api/queries.ts`. Today `client.ts` points at the mock; when `server/` exists, add `src/api/http/` implementing the same `ApiClient` and switch with `EXPO_PUBLIC_API_MODE=http`.

Mock sign-in: any valid Nigerian number, code `123456`. The number `+2348030000000` is an existing user; any other number goes through sign-up.

Vendor names and menus in `src/api/mock/data.ts` are invented placeholders.

Mock promo codes: `VENDO10` (10% off food, up to ₦1,000) and `FREEDEL` (free delivery). Mock referral codes: `AMINA24` and `VENDO2026`; a referred customer gets ₦500 off their first order and the referrer earns ₦500. These rules and amounts are placeholders in `src/api/mock/index.ts` — the real ones belong to the server and admin dashboard, which have no promo or referral endpoints yet (`checkPromo`, `promoCode` on quotes, `getReferrals`, `applyReferralCode` in `src/api/client.ts` are the contract to build).
