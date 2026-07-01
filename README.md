# Timber Fuel — Drinks Done Bold

Online ordering site for **Timber Fuel**, a coffee and energy-refresher stand in Cass Lake, Minnesota.

> Fuel for the Northwoods · Northwoods Crafted · Est. 2024

## Stack
Static front end (plain HTML/CSS/vanilla JS, no build step) **plus a Vercel serverless backend and Vercel KV (Redis) storage**. Deployed to Vercel as project `drink-timber-fuel`.

- `index.html` — customer site: hero, tab nav, Hot / Cold / Refresher menus, the full-screen drink builder, cart, and checkout (Square card payment + cash/pay-at-pickup).
- `admin.html` — password-protected order console (hidden from search engines). Live orders + contact messages, a store open/closed toggle, and a **Flavors** editor.
- `api/` — Vercel serverless functions (CommonJS; all use global `fetch`, only `upload.js` has a dependency):
  - `store.js` — store open/closed flag (GET public, POST admin toggle).
  - `order.js` — place a cash / pay-at-pickup order (public; bot defenses + rate limit).
  - `charge.js` — charge a card via **Square** (Web Payments SDK token → server-side `/v2/payments`), then save the order.
  - `orders.js` — admin: list active orders, mark done / cancel.
  - `contact.js` — contact form submit (public) + admin list / dismiss.
  - `square-config.js` — returns the public Square app/location config (secret token stays server-side).
  - `flavors.js` — flavor + drink config: GET (public) returns the current config, POST (admin) saves edits.
  - `upload.js` — admin: uploads a drink image to **Vercel Blob** and returns its public URL (uses `@vercel/blob`).
- `assets/` — logo, illustrated hero background, drink photos, and section icons.
- `package.json` — one dependency (`@vercel/blob`) used only by `upload.js`.

Fonts: Anton (display), Oswald (subheads/labels), Barlow Condensed (body) via Google Fonts.

## Data & storage (Vercel KV)
All persistence is Vercel KV (Upstash Redis) via its REST API. Keys:

- `orders` — JSON array of active orders (newest first, capped 100).
- `messages` — JSON array of contact messages (capped 100).
- `store_open` — `'1'` / `'0'` flag (defaults **open** unless explicitly closed).
- `flavors` — the editable flavors config (see below); falls back to seeded defaults if unset.
- `rl:*` — per-IP rate-limit counters.

If the KV env vars are absent, the functions degrade gracefully (reads return sensible defaults, writes no-op).

## Flavors & drinks (admin-editable, no code changes)
The client changes drinks and flavors often, so this data lives in KV, not hardcoded arrays:

```jsonc
{
  "pumpPrice": 0.25,
  "builderFlavors":  [ { "name": "Chocolate", "sugarFree": false, "soldOut": false }, ... ],
  "refresherFlavors":[ { "name": "Mango", "soldOut": false }, ... ],   // refreshers' own fruit/candy list
  "specialtyDrinks": {                                                 // keyed by a STABLE id so drinks can be renamed
    "campfire-mocha": {
      "section": "hot", "group": "Mochas",                            // organization + which flavor pool it uses
      "name": "Campfire Mocha",
      "desc": "Deep chocolate and sweet marshmallow…",
      "image": "assets/campfire-mocha.png",                           // asset path or a Vercel Blob URL
      "flavors": ["Chocolate","Toasted Marshmallow"]                  // signature/included pumps
    }, ...
  }
}
```

- **Admin → Flavors tab** edits the builder flavor list (add/rename/remove, sugar-free, sold-out), the refresher flavor list, the pump price, and **every drink** — Hot, Cold, and Refresher — organized by section like the menu. Each drink has an **Edit** button to change its **name, description, photo, and signature flavors**. Photos upload to Vercel Blob (`POST /api/upload`) and are stored small; the config only holds the resulting URL. Save → `POST /api/flavors`.
- Drinks are keyed by a **stable id**; each menu card in `index.html` carries a matching `data-spec-id`. On load the site fetches `GET /api/flavors` and overlays each card's name, description, image, `data-drink` (cart name) and signature recipe — so admin edits show live. Cold-drink prices are looked up by the stable id, so renaming never breaks pricing. If the fetch fails, hardcoded defaults (mirrored in `api/flavors.js`) keep the site working. Sold-out flavors are hidden from customers.
- The admin has three tabs — **Orders**, **Messages**, **Flavors**.

## Environment variables (set in Vercel, not committed)
`KV_REST_API_URL`, `KV_REST_API_TOKEN`, `ADMIN_PASSWORD`, `SQUARE_ENV` (`sandbox`|`production`), `SQUARE_APP_ID`, `SQUARE_ACCESS_TOKEN`, and `BLOB_READ_WRITE_TOKEN` (for drink-image uploads — create a Vercel Blob store, which sets this automatically).

Admin auth is a single shared password (`ADMIN_PASSWORD`) sent as the `x-admin-pass` header.

## Deploy
Zero-config Vercel: static HTML + `/api` functions + Vercel KV. Local preview: open `index.html` (the front end degrades gracefully when the API isn't reachable).
