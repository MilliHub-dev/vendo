# Vendo app preview (for Figma)

Both apps, signed in with sample data, at one address. Open it, pick **Customer app** or **Rider app**.

## Put it on Railway

1. In your Railway project: **New → GitHub Repo →** the Vendo repo.
2. **Settings → Root Directory:** `design/preview`
3. **Settings → Networking → Generate Domain**, then open that address.

## Or run it on your computer

```bash
node design/preview/server.mjs
```

Then open http://localhost:4300

## Get a screen into Figma

1. Install the **html.to.design** plugin in Figma and its extension in Chrome.
2. Open the preview in Chrome in phone size (**⌥⌘I**, then the phone icon).
3. Go to a screen, click the extension, choose **Import**.

## Handy links (add them to the address)

- `/__switch` — choose the other app
- `/__mode?offer=1` — rider app shows a new order
- `/__mode?job=1` — rider app shows a delivery in progress
- `/__mode?offer=0&job=0` — rider app back to normal

Nothing is real: names, orders and money are made up, and nothing is ever sent to the live app.
Store names and photos are the real public listings.
After changing the apps, rebuild the preview with `design/preview/build.sh`.
