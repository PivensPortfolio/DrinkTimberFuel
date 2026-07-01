# Timber Fuel — Drinks Done Bold

Online ordering site for **Timber Fuel**, a coffee and energy-refresher stand in Cass Lake, Minnesota.

> Fuel for the Northwoods · Northwoods Crafted · Est. 2024

## Stack
Static front end (plain HTML/CSS/vanilla JS, no build step) **plus a Vercel serverless backend and Vercel KV (Redis) storage**. Deployed to Vercel as project `drink-timber-fuel`.

- `index.html` — customer site: hero, tab nav, Hot / Cold / Refresher menus, the full-screen drink builder, cart, and checkout (Square card payment + cash/pay-at-pickup).
- `admin.html` — password-protected order console (hidden from search engines). Live orders + contact messages, a store open/closed toggle, and a **Flavors** editor.
- `api/` — Vercel serverless functions (CommonJS, dependency-free — global `fetch` only):
  - `store.js` — store open/closed flag (GET public, POST admin toggle).
  - `order.js` — place a cash / pay-at-pickup order (public; bot defenses + rate limit).
  - `charge.js` — charge a card via **Square** (Web Payments SDK token → server-side `/v2/payments`), then save the order.
  - `orders.js` — admin: list active orders, mark done / cancel.
  - `contact.js` — contact form submit (public) + admin list / dismiss.
  - `square-config.js` — returns the public Square app/location config (secret token stays server-side).
  - `flavors.js` — flavor config: GET (public) returns the current flavors, POST (admin) saves edits.
- `assets/` — logo, illustrated hero background, drink photos, and section icons.

Fonts: Anton (display), Oswald (subheads/labels), Barlow Condensed (body) via Google Fonts.

## Data & storage (Vercel KV)
All persistence is Vercel KV (Upstash Redis) via its REST API. Keys:

- `orders` — JSON array of active orders (newest first, capped 100).
- `messages` — JSON array of contact messages (capped 100).
- `store_open` — `'1'` / `'0'` flag (defaults **open** unless explicitly closed).
- `flavors` — the editable flavors config (see below); falls back to seeded defaults if unset.
- `rl:*` — per-IP rate-limit counters.

If the KV env vars are absent, the functions degrade gracefully (reads return sensible defaults, writes no-op).

## Flavors (admin-editable, no code changes)
The client changes flavors often, so flavor data lives in KV, not hardcoded arrays:

```jsonc
{
  "pumpPrice": 0.25,
  "builderFlavors":  [ { "name": "Chocolate", "sugarFree": false, "soldOut": false }, ... ],
  "refresherFlavors":[ { "name": "Mango", "soldOut": false }, ... ],   // refreshers' own fruit/candy list
  "specialtyDrinks": {                                                 // keyed by a STABLE id so drinks can be renamed
    "campfire-mocha": { "name": "Campfire Mocha", "flavors": ["Chocolate","Toasted Marshmallow"] }, ...
  }
}
```

- **Admin → Flavors tab** edits the builder list (add/rename/remove, sugar-free, sold-out), the separate refresher list, the pump price, and each **specialty drink** — a compact per-drink card with an **Edit** button to rename the drink and pick its signature (included) flavors. Save → `POST /api/flavors`.
- **`index.html`** fetches `GET /api/flavors` at load and sources all flavor-pump lists, the pump price, and the specialty drink **names** from it — each specialty menu card carries a `data-spec-id`, so renaming a drink in the admin updates its card name (and cart name/recipe) live. If the fetch fails it falls back to hardcoded defaults (mirrored in `api/flavors.js`), so the site never breaks. Sold-out flavors are hidden from customers.
- The admin has three tabs — **Orders**, **Messages**, **Flavors**.

## Environment variables (set in Vercel, not committed)
`KV_REST_API_URL`, `KV_REST_API_TOKEN`, `ADMIN_PASSWORD`, `SQUARE_ENV` (`sandbox`|`production`), `SQUARE_APP_ID`, `SQUARE_ACCESS_TOKEN`.

Admin auth is a single shared password (`ADMIN_PASSWORD`) sent as the `x-admin-pass` header.

## Deploy
Zero-config Vercel: static HTML + `/api` functions + Vercel KV. Local preview: open `index.html` (the front end degrades gracefully when the API isn't reachable).
