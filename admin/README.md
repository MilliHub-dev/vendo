# Vendo Admin — operations dashboard (web app)

Next.js (App Router) + TypeScript, exported as a static site. For Vendo staff to run the business: orders, riders, vendors, customers, payments, cities, promotions, analytics and an audit log.
**UI only for now:** everything runs against a mock backend in `src/api/mock`; nothing talks to `../server` yet. All names and numbers are invented, and changes reset when the page reloads.

```bash
npm install
npm run dev          # http://localhost:3003
npm run build        # static site -> ./out
npm run typecheck
npm test             # Node's built-in test runner (about 20 seconds; the mock runs on real timers)
```

## Try it

Sign in with one of the demo accounts (password `vendo123`). The login page has a button for each.

| Email | Role | Can change |
| --- | --- | --- |
| `admin@vendoltd.com` | Super admin | Everything |
| `ops@vendoltd.com` | Operations | Orders (assign, cancel, resolve disputes), riders, vendors, cities and pricing, promotions, push notifications; sees the audit log |
| `finance@vendoltd.com` | Finance | Refunds, wallet adjustments, withdrawal approvals; sees the audit log |
| `support@vendoltd.com` | Support | Orders (assign, cancel, resolve disputes) only |

Every role can *see* every page except the audit log; actions a role can't take are replaced with a note saying who to ask. The rules live in `src/lib/permissions.ts`.

## Pages

| Page | What it does |
| --- | --- |
| Overview | Today's numbers, the four work queues (rider and vendor applications, withdrawals, disputes), 14-day revenue, cities, live orders |
| Orders | Filter by status / city / type, search, CSV export. Side panel: details, money breakdown, timeline; assign or reassign a rider, cancel, refund, resolve a dispute |
| Riders | Applications (approve, or reject with a reason), all riders (suspend, lift suspension, adjust wallet), live map |
| Vendors | List, applications, add / edit (commission %, tier), approve, suspend |
| Customers | List with spend and wallet balance; adjust wallet |
| Payments | Rider withdrawals (approve / decline), transactions, commission report by vendor — each with CSV export |
| Cities & pricing | Switch a city on or off, surge on or off, edit base fare, per-km rate, minimum order, surge multiplier, hours |
| Promotions | Home banners, promo codes, referral amounts |
| Notifications | Write a push notification for customers, riders or vendors in chosen cities, preview it, send now or schedule; history with delivered and opened counts; cancel a scheduled one |
| Analytics | Orders and revenue per day, city performance, top vendors and riders, returning customers |
| Audit log | Who did what, when and why. Every change in the dashboard writes an entry |

Any action that moves money or penalises someone asks for a reason, which is saved to the audit log.

## Structure

```
src/
  app/
    login/               email + password, company addresses only
    (app)/               the pages above, inside the sidebar shell
    globals.css          design tokens (light + dark) and every component style (shared base with ../vendors)
  components/
    AppShell.tsx         sidebar (slides in on phones), top bar, sign-in gate
    admin.tsx            shared pieces: tabs, search, city filter, CSV export, status badges,
                         ActionModal (reason / amount dialog), WalletAdjust, Locked (role note)
    ui.tsx               buttons, inputs, modal / side panel
  api/                   types, ApiClient, query hooks, mock backend (seed.ts builds the sample data)
  lib/permissions.ts     role → allowed actions
  store/session.ts       the signed-in admin
tests/                   role rules, CSV, and the mock's money rules
```

## Before this goes live

- **Connect the server.** Add `src/api/http.ts` implementing `ApiClient` (see `src/api/client.ts`) and switch with `NEXT_PUBLIC_API_MODE=http`. The role checks here only hide buttons; the server must enforce the same rules on every request.
- **Sign-in.** The demo keeps the session in `localStorage`. For real use it needs an httpOnly session cookie, a short session lifetime and two-factor sign-in. The dashboard should also sit on its own address (e.g. `admin.vendoltd.com`) behind staff-only access.
- **Push notifications.** The page only records what was "sent". Real delivery needs the server to send through Expo push / FCM, the customer and rider apps to register device tokens, and vendors (a web app) to get browser notifications or SMS instead.
- **Live map.** The riders map is a drawn placeholder with sample positions. Swap in Mapbox with live rider locations.
- **Live updates.** Orders refresh every 15 seconds by polling; use the server's realtime channel instead.
- **Not built yet:** managing staff accounts and roles, viewing rider documents (only their status is shown), vendor menu editing from admin, SMS broadcasts, date-range pickers on analytics (fixed at 14 days).
