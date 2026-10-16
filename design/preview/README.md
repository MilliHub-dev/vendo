# Vendo screens → Figma

Opens the customer app and the rider app in your browser, already signed in with sample data, so each
screen can be imported into Figma as editable layers with the **html.to.design** plugin.

## One-time setup

1. In Figma, install the **html.to.design** plugin (Plugins → Find more plugins).
2. In Chrome, install the **html.to.design** extension from the Chrome Web Store and sign in with the same account.

## Import screens

1. From the project folder, start the preview:

   ```bash
   node design/preview/server.mjs
   ```

2. In Chrome, open the app and switch to a phone-sized view: press **⌥⌘I** (Mac) or **F12**, click the
   phone/tablet icon, and choose **iPhone 14 Pro Max** (or any 390–430 px wide phone).
   - Customer app: http://localhost:4301
   - Rider app: http://localhost:4302
3. Go to the screen you want, click the **html.to.design** extension and choose **Import**. The screen
   arrives in Figma as a frame with editable text, shapes and images. Repeat for each screen.

Rider screens that depend on an order: open http://localhost:4302/__mode?offer=1 (a new order offer) or
http://localhost:4302/__mode?job=1 (a delivery in progress), then reload the rider app.
Back to normal: http://localhost:4302/__mode?offer=0&job=0

Light or dark: each app follows your computer's appearance, or set it in the app under Profile → Appearance.

## Good to know

- Stores, menus and photos are the real ones from the live API (read-only). Everything about the
  signed-in person — orders, wallet, trips, earnings, names — is sample data. Nothing is sent to the live API.
- Buttons that would change something (placing an order, withdrawing) don't complete; it's for looking, not using.
- The rider home shows a "Keep Vendo Rider open" note that only appears in the browser, where background
  location isn't available. Delete it in Figma.
- After changing the apps, rebuild the preview with `design/preview/build.sh`.

## Hosting on Railway

Run each app as its own Railway service from this folder, so each gets its own web address:

| Setting | Customer preview | Rider preview |
|---|---|---|
| Root directory | `design/preview` | `design/preview` |
| Start command | `npm start` | `npm start` |
| Variable `APP` | `customer` | `rider` |
| Healthcheck path | `/health` | `/health` |

Then **Settings → Networking → Generate Domain** on each. Railway sets `PORT` itself.
On the hosted rider preview, switch screens with `https://<rider domain>/__mode?offer=1` (or `?job=1`, or `?offer=0&job=0`).

Anyone with the address can open it. It only shows sample data and public store listings, and it never
writes to the live API, but the sample-data mode switch is shared by everyone viewing the rider preview.
