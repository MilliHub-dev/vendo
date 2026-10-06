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

- **Email sign-in routes deployed** (`/v1/auth/email/otp/*`, `PATCH /v1/me/phone`), and Supabase set up to email the code.
- **A matching policy per city** (`PUT /v1/admin/cities/:id/matching-policy`). Without one no rider can go online.
- **A finance policy per city** (rider pay rules, minimum withdrawal) and the Paystack key, or earnings and withdrawals won't work.
- **Private storage bucket** `vendo-documents` (`npm run storage:setup` in `server/`), or document uploads fail.
- **An admin to approve riders.** The admin dashboard isn't connected to the server yet.

### Things the screens can't show yet because the server doesn't send them

- **What a delivery pays, on the offer and during the job.** The rider only sees the amount after delivery, in Earnings. This should be fixed on the server before launch: riders need to know the pay before accepting.
- **Trip details in history** (pickup, drop-off, distance): history is built from the earnings ledger, which has the amount and time only.
- **Rating, total trips, acceptance rate.**
- **The customer's name and phone on food orders** (by design: riders use the in-app chat).
- **The minimum withdrawal** and **how many delivery-code tries are left**: the server enforces both and returns a message.
- **The bank list**: `src/lib/banks.ts` is a fixed list of major banks with Paystack codes. Check it against Paystack's list, or have the server serve it.

### Before a store release

- **Push notifications**: without them a rider only hears about an offer while the app is open. Register the device (`POST /v1/me/devices`) and have the server push new offers.
- **Background location review**: Google Play and the App Store both review "always" location. The permission texts are in `app.json`; the store listings need a matching explanation.
- **Map**: `components/RouteMap.tsx` is a drawn stand-in; "Navigate" opens the phone's maps app.
- **A build on a real phone**: location, the camera and background tasks only work in a development or release build, not in the browser preview. No EAS build has completed yet.
