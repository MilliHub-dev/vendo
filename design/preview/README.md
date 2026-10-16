# Vendo app screens

A board of every screen of both apps, in light and dark, like a Figma canvas. Designers can view each
screen large and download it as a full iPhone screen (1179 × 2556 px, iPhone 15 / 16 Pro) for mockups,
or download them all at once. The board also links into both apps, running with sample data.

## Put it on Railway

1. In your Railway project: **New → GitHub Repo →** the Vendo repo.
2. **Settings → Root Directory:** `design/preview`
3. **Settings → Networking → Generate Domain**, then share that address with the designers.

## Or run it on your computer

```bash
node design/preview/server.mjs
```

Then open http://localhost:4300

## Using the board

- **Light / Dark** switches every screen; **− / +** (or Ctrl + scroll) zooms.
- Click a screen to see it large, then **Download PNG**. Or hover a screen and click **Download**.
- **Download all (PNG)** saves a zip of every screen in both themes.
- **Open customer app / Open rider app** opens the app itself. Go back to the board with `/__switch`.
- In the rider app, add `/__mode?offer=1` (new order), `/__mode?job=1` (delivery in progress) or
  `/__mode?offer=0&job=0` (normal) to the address, then reload.

Names, orders and money are sample data; store names and photos are the real public listings. Nothing is
sent to the live app.

The screen images are in `screens/`. They show the apps as they were when the images were made — ask for
them to be re-shot after the apps change. After changing the apps, rebuild the live preview with
`design/preview/build.sh`.
