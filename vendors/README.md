# Vendo Vendor — store dashboard (web app)

Next.js (App Router) + TypeScript, exported as a static site. For vendors to run their store on Vendo from a computer, tablet or phone browser.
**UI only for now:** everything runs against a mock backend in `src/api/mock`; nothing talks to `../server` yet.

```bash
npm install
npm run dev          # http://localhost:3002
npm run build        # static site -> ./out
npm run typecheck
npm test             # Node's built-in test runner; takes about a minute (the mock runs on real timers)
```

## Try it

Sign in with code `123456`.
- `0803 222 2222` — the demo store (Arewa Kitchen): approved, with a menu, a week of orders, payouts and reviews.
- Any other Nigerian number — a new vendor: name and email, then store registration. The mock "approves" about 9 seconds after you submit.

Switch the store to **Open** (top bar) and an order arrives after ~5 seconds, then about every 25 seconds.

## Structure

```
src/
  app/
    layout.tsx           fonts, theme script, providers
    login/               phone → code → (new vendors) name + email
    register/            your store → location & hours → under review
    (app)/               the dashboard, inside the sidebar shell
      page.tsx           Dashboard: open/closed, today's numbers, sales chart, best sellers, recent orders
      orders/  menu/  payouts/  reviews/  store/
    globals.css          design tokens (light + dark) and every component style
  components/
    AppShell.tsx         sidebar, top bar, mobile bottom bar, and the stage gate (login / register / dashboard)
    OrderAlert.tsx       new-order alert with countdown and chime, shown on every page
    OrderPanel.tsx       order side panel: accept (prep time) / reject (reason) / mark ready
    HoursEditor.tsx  OrderActions.tsx  ThemeToggle.tsx  ui.tsx
  api/                   types, ApiClient, query hooks, mock backend
  lib/  store/           helpers; saved session + small UI state
tests/                   money formatting and the vendor flow, run against the mock
```

## Placeholders and open points

- **Self-registration** has no server endpoint yet — the server creates vendors from the admin side (`POST /v1/admin/vendors`). `registerStore` in `src/api/client.ts` is the contract to add.
- **Commission and payout** use `payout = food subtotal − 15% commission`, the proposal in `VENDO_DEVELOPMENT.md` §2 that still says "confirm with finance". Weekly payouts are an assumption.
- **Time to answer an order** (2 minutes) and the prep-time choices are placeholders; the server owns the real timeout.
- **Pictures** (store logo, banner, menu item photos) are shrunk in the browser (`src/lib/image.ts`) and sent through `uploadImage`. The mock keeps them in memory as data URLs, so they vanish on reload; the real backend should store the file and return a URL. Items without a photo show an icon.
- **Order alerts** only work while the dashboard is open in a browser tab, and the chime only plays after the vendor has clicked something on the page (a browser rule). Alerts to a closed browser need push notifications, SMS or WhatsApp from the server.
- **Session** is kept in the browser's localStorage for now; with the real backend use an httpOnly cookie.
- **Not built**: staff accounts (the server has them), item options / variants, promo banners.

Names, dishes, orders and amounts in the mock are invented sample data.
