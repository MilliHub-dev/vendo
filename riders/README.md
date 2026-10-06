# Vendo Rider — rider app

Expo (React Native) + TypeScript. Same design system as the customer app in `../mobile`.
It runs against the live Vendo API (see **Backend** below).

```bash
npm install
npm start            # dev server; press w for the browser preview
npm run typecheck && npm run lint && npm test
```

## Backend

The app talks to the Vendo API. Screens only use `src/api/queries.ts`; `src/api/client.ts` is the contract and `src/api/http/` implements it. The address is `EXPO_PUBLIC_API_URL` in `.env` and `eas.json` (`https://api.vendoltd.com`). There is no demo or sample-data mode.

- **Sign-in**: email → 6-digit emailed code → (new riders) name and phone number. Tokens are kept in the device keychain.
- **Application**: city, vehicle and plate; then three documents (government ID, rider's licence, vehicle papers) photographed or picked from the gallery and uploaded to private storage. Once all three are in, the application is under review; an admin approves it.
- **Going online** needs the phone's location. The server only accepts a fresh, accurate position inside the rider's city, and takes a rider offline when updates stop. `src/lib/location.ts` sends the position every few seconds, in the background too when the rider allows "all the time" location.
- **Deliveries**: the current offer is polled every 4 seconds; accept, pick up, start delivery, deliver (with the receiver's 4-digit code for dispatch), and chat with the customer.
- **Money**: balance and earnings history, payout bank account (checked by the server with the bank), withdrawals.

### Never run end to end

Only these were checked, in a browser against the live API: the welcome and email screens, the vehicle step loading the real city list, the home screen, and the location-permission message. Everything else needs a signed-in, approved rider and a real phone, and has not been exercised: sign-in, document upload, going online, receiving and completing a delivery, chat, earnings, withdrawals. Expect fixes on the first real run.

### What the server and operations still need

- **Deploy the server's rider-app module** (`server/src/modules/rider-app`, not pushed yet). It adds `GET /v1/riders/me/summary` (rating, trip count, acceptance rate, minimum withdrawal, and what the current offer or delivery pays), `GET /v1/riders/me/trips` (completed deliveries with route and pay) and `GET /v1/payout-banks` (Paystack's bank list). Until it is live the app still works: it leaves the pay off offers, shows history from the earnings ledger, and uses the bundled bank list.
- **A matching policy and a finance policy for each city.** None exist. Without a matching policy no rider can go online; without a finance policy offers can't show pay, nothing is settled and withdrawals are refused. Set them from the admin dashboard, or run `npm run db:test-policies -- --apply` in `server/` for placeholder values.
- **The Paystack key on the server**, for the bank list, account checks and payouts.
- **Supabase set up to email the sign-in code** (template showing `{{ .Token }}`, custom SMTP).
- An admin approves riders from the admin dashboard.

Done: email sign-in is deployed, and the private `vendo-documents` bucket for rider documents exists.

### Push notifications

`src/lib/push.ts` registers an approved rider's phone with the server (`POST /v1/me/devices`) and removes it on sign-out; the server already pushes new offers through Firebase. To make it work in a build:

1. Download `google-services.json` for the Android app `com.vendoltd.rider` from the Firebase project the server uses (`FCM_PROJECT_ID`, currently `vendo-83f99`), put it in `riders/`, and add `"googleServicesFile": "./google-services.json"` under `android` in `app.json`.
2. Build with EAS (it doesn't work in Expo Go or the browser).

iPhones aren't covered: the server sends through Firebase and can't use Apple's tokens directly. Without push, a rider only sees an offer while the app is open (it checks every 4 seconds).

### Still not shown

- **The customer's name and phone on food orders** (by design: riders use the in-app chat).

### Before a store release

- **Background location review**: Google Play and the App Store both review "always" location. The permission texts are in `app.json`; the store listings need a matching explanation.
- **Map**: `components/RouteMap.tsx` is a drawn stand-in; "Navigate" opens the phone's maps app.
- **A build on a real phone**: location, the camera, push and background tasks only work in a development or release build, not in the browser preview. No EAS build has completed yet.
- **A first real run.** Nothing past the sign-in screen has been exercised with a real rider account.
