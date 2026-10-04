# Vendo Rider — rider app

Expo (React Native) + TypeScript. Same design system as the customer app in `../mobile`.
**UI only for now:** everything runs against a mock backend in `src/api/mock`; nothing talks to `../server` yet.

```bash
npm install
npm start            # dev server; press w for the browser preview
npm run typecheck && npm run lint && npm test
```

## Try it

Sign in with code `123456`.
- `0803 111 1111` — the demo rider: already approved, with a week of trips and a balance.
- Any other Nigerian number — a new rider: name and email, then the application. The mock "approves" about 9 seconds after you submit.

Go online on Home and an order arrives after ~5 seconds (food and dispatch alternate). The delivery code for dispatch orders is `4729`.

## Structure

```
src/
  app/
    _layout.tsx        providers and the three stages: signed out → applying → working
    (auth)/            welcome → phone → otp → details
    application.tsx    vehicle → documents → under review (until approved)
    (tabs)/            Home (online switch) · Trips · Earnings · Profile
    job  job-done      the delivery in progress, and the "you earned" screen
    chat               chat with the customer / receiver
    trip/[id]  withdraw  vehicle  notifications  settings/appearance
  api/                 types (matching server/docs/openapi.json rider endpoints), ApiClient, hooks, mock
  components/          OfferHost (incoming-order popup), TabBar, TripRow, RouteMap, ui/
  lib/  store/  theme/ shared helpers, session + settings, design tokens
```

## Not built yet (needs more than UI)

- **Real location.** No GPS is read or sent. Background location on low-end Android is the biggest technical risk in the PRD and needs a development build and real devices.
- **Map.** `RouteMap` is a drawn diagram; "Navigate" opens the phone's own maps app. Mapbox comes with the development build.
- **Document upload.** Tapping a document marks it as added; the camera / file picker isn't wired.
- **Offer alerts.** The popup vibrates on a phone, but there is no push notification or sound to wake a backgrounded app.
- **Server connection.** Add `src/api/http/` implementing `ApiClient` and set `EXPO_PUBLIC_API_MODE=http`.

Names, places, earnings and bank list in the mock are invented sample data.
