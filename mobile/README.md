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
  api/                 types, the ApiClient interface, query hooks, and the API client (api/http)
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

## Backend

The app talks to the Vendo API. Screens only use `src/api/queries.ts`; `src/api/client.ts` is the contract and `src/api/http/` implements it. The address is `EXPO_PUBLIC_API_URL` in `.env` and `eas.json` (`https://api.vendoltd.com`). There is no demo or sample-data mode.

Sign-in tokens are kept in the device keychain (`expo-secure-store`). An expired session is renewed automatically; if it can't be, the app returns to sign-in.

### Verified against the live API

In a browser: choosing a city, vendor lists and menus with photos, item options, cart, and the home "Picks for you" row.

### Not yet run end to end

Everything that needs a signed-in account was written against the server's contract (`server/docs/openapi.json`) and has not been exercised with a real account: sign-in and sign-up, profile, saved addresses and address search, delivery quotes, placing and paying for orders, order list, tracking, cancelling, rating, dispatch, rider chat, wallet and top-up, notifications, referrals. Expect fixes on the first real run.

### What the server and accounts still need

- **Email sign-in routes deployed** (`/v1/auth/email/otp/*`, `PATCH /v1/me/phone`).
- **Supabase email**: the "Magic Link" template must show the 6-digit code (`{{ .Token }}`), and custom SMTP must be set for real volumes.
- **Paystack**: `PAYSTACK_SECRET_KEY` on the server. Without it card, transfer and top-up can't start.
- **Real city settings**: the service areas and fares in the database are test values.
- **Real vendors**: the vendors and menus in the database are seeded test data.

### Before a store release

- **Map**: `components/RouteMap.tsx` is a drawn stand-in. Mapbox needs a token and a development build.
- **Push notifications**: the app doesn't register the device with the server yet (`POST /v1/me/devices`).
- **Live updates**: orders, tracking and chat are polled every few seconds; the server's streams aren't used.
- **Store listing items**: app icons and splash are in place; privacy policy and terms on vendoltd.com are still drafts.
- **A build on a real phone**: so far the app has only been run in a browser. No EAS build has completed.

### Known gaps

- A promo code is only checked at checkout, as part of pricing the order.
- Vendor cards don't show a delivery fee or review count; the server prices delivery per address and doesn't send review counts.
- Referral reward amounts and friends' names aren't sent by the server, so the Referrals screen shows counts and generic wording.
- "Order again" for dishes with options reopens the vendor's menu instead of refilling the cart.
- The home banners are fixed artwork, not the server's `/v1/growth/banners`.
