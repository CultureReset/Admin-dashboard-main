# Endpoint status

This dashboard talks only to `gcr-api-clean`. Nothing was changed in that repo.

While rebuilding, every API path the legacy `cybercheck-login/admin.html` calls
was checked against the routers actually mounted in `gcr-api-clean/server.js`.
Of **117 distinct paths** the old dashboard calls, **83 resolve** to a real
route and **34 do not**.

That is a property of the API as it stands in the checkout, not a gap
introduced by this rebuild. The React app is wired to the same paths so each
one starts working the moment the route exists — but the screens that depend on
a missing route **say so on screen** instead of showing a form that silently
fails to save.

## How a missing route surfaces

- The section is marked `status: 'partial'` in `src/modules/registry.js`.
- The sidebar shows a small amber `!` next to its name.
- The screen renders an explicit notice naming the path it tried.
- `ApiError.isMissingEndpoint` (404/405) is distinguished from a network error
  and from a genuine server failure, so the three never get conflated.
- Platform → Settings lists every partial section in one place.

## Paths with no matching route

| Path the legacy dashboard calls | Used for | What this app does |
|---|---|---|
| `/api/admin/gcr/site-config`, `/api/admin/gcr/site-config/hero` | Homepage hero | Site Editor — wired, reports the gap |
| `/api/admin/gcr/category-cards[/:id]` | Category tiles | Site Editor — wired, reports the gap |
| `/api/admin/gcr/category-page-config/:category` | Category page config | not surfaced; Page Rails covers the need |
| `/api/admin/gcr/entity-pages/:slug`, `/api/admin/gcr/page-assignments/:slug` | Page placement | **replaced** — the Pages tab writes the real `entity_type` / `also_appears_on` columns |
| `/api/admin/gcr/messaging/:slug` | Message threads | Messaging — wired, reports the gap |
| `/api/admin/gcr/import-csv` | CSV import | **replaced** — Bulk Upload uses the real `import-*` routes |
| `/api/admin/gcr/business-data/:slug` | Business data blob | not surfaced; the entity read model covers it |
| `/api/admin/gcr/grok-chat` | AI chat | **replaced** — AI Chat uses `POST /api/admin/gcr/ask` |
| `/api/admin/gcr/auto-activate-top5` | Bulk activate | not surfaced |
| `/api/admin/ai-chat-history[/save]` | Chat transcripts | AI Chat keeps history in the tab and says it is not saved |
| `/api/admin/ai-chat-organizer`, `/api/admin/ai-save-business` | AI organizer | **replaced** — uses `ai-organize`, `parse-raw-data`, `save-parsed-items` |
| `/api/admin/ai-provider` | Provider registry | **corrected** — mounted at `/api/ai-provider` |
| `/api/admin/auth-config` | Tourist auth toggles | Auth Settings — wired, reports the gap |
| `/api/admin/sms-config` | SMS provider config | SMS Settings — wired, reports the gap |
| `/api/admin/sms-campaign-preview` | Blast preview | **corrected** — `POST /api/admin/sms-blast/preview` exists |
| `/api/admin/save-api-key` | Store provider keys | API Keys — wired, reports the gap |
| `/api/admin/set-connection` | Integration config | Integrations — wired, reports the gap |
| `/api/admin/business-leads[/:id]` | Trip Swipe lead board | Business Leads — wired, reports the gap |
| `/api/admin/community-photos[/:id]` | Guest photo moderation | Guest Photos — wired, reports the gap |
| `/api/admin/bookings` | Bookings | **corrected** — mounted at `/api/bookings` |
| `/api/admin/businesses/link-gcr-all` | Bulk link | not surfaced; per-entity linking works |
| `/api/admin/daily-rotation/options/:slug`, `/api/admin/daily-rotation/sections/:slug` | Daily rotation | not surfaced |
| `/api/tourist/points-config` | Points & rewards | Points — wired, reports the gap |
| `/api/gcr/ask` | Public AI ask | **corrected** — `POST /api/admin/gcr/ask` exists |
| `/api/gcr/claims/:id` | Claim decisions | **corrected** — `PATCH /api/admin/gcr/claims/:id` |
| `/api/admin/gcr/sections/:id/...` | Section content | **corrected** — `/api/admin/entities/:slug/sections` (note: no `/gcr` segment) |

"**corrected**" means the legacy dashboard was calling a path that does not
exist while a working route was available; this app uses the working one.
"**replaced**" means the same outcome is achieved through routes that do exist.

## Notable API behaviours this app accounts for

- **`PATCH /api/admin/gcr/entities/:slug` can answer `207`** with
  `{ success: false, errors: [...] }` when part of a multi-part write fails.
  A 207 passes `response.ok`, so without an explicit check a partial failure
  looks like a clean save. `useEntityRecord` checks for it and reports the
  failure.
- **Tags cannot be cleared via PATCH.** The route only replaces `entity_tags`
  when the array is non-empty. The Tags tab states this rather than offering a
  save that would appear to work.
- **There is no update route for coupons.** The Coupons screen offers create
  and delete only — no Edit button that would 404.
- **There is no per-entity GET for menus, drinks, or happy hour** on the admin
  router. The public read model `GET /api/gcr/entity/:slug` returns all of it
  already, so that is the read path and the admin routes are the write path.
  That endpoint is edge-cached for two minutes, so reads after a write append a
  cache-buster.
- **Events and specials have no admin list route.** They are read from
  `GET /api/gcr/events` and `GET /api/gcr/specials`.
- **`entity` exposes `parent_slug` on the API but stores `parent_entity_slug`.**
  The API translates between them; this app uses the API's field name.

## New: admin routes added to gcr-api-clean

Two routers were added on the `claude/cybercheck-modular-react-dashboard-7on41c`
branch of `gcr-api-clean`, because the dashboard could not otherwise reach the
data it needed.

**`/api/admin/platform`** (24 routes) — an admin view over the universal booking
engine. `routes/platform.js` owns the model but resolves the business from
`entity_owners` using the signed-in user, so an admin token cannot read any of
it. These routes use the same tables (`offerings`, `offering_prices`,
`bookings`, `booking_calendar`, `promos`, `waivers`, `integrations`) and take
the slug as a *filter* rather than a security boundary. Every route is
`adminRequired` — they must never become reachable with an owner token.

**`/api/admin/connections`** (10 routes) — Composio. Nothing existed. Adds the
curated tool catalog, per-business connection records, the OAuth handshake,
a status refresh, and disconnect. Requires `sql/composio_connections.sql`.

### Three booking models

Worth knowing, because it explains why this was needed:

| Model | Tables | Routes |
|---|---|---|
| 1 | `entity_availability` | `/api/bookings/:slug/*` |
| 2 | `bookable_resources`, `booking_events` | `/api/rentals`, `/api/services` |
| 3 | `offerings`, `bookings`, `booking_calendar`, `promos` | `/api/platform`, and now `/api/admin/platform` |

Model 3 is the one the codebase declares canonical — `routes/platform.js` says
*"ONE universal booking: every booking-type app writes the same `bookings`
table; the unit is DATA, never a separate table."* The Booking Platform section
group is built on model 3. Platform → Bookings still shows models 1 and 2,
because live data may exist in them.

## Open question: two app catalogues

There are two separate app catalogues in the platform and they do not sync.

| | Admin dashboard (this app) | Owner dashboard |
|---|---|---|
| Table | `apps` | `platform_apps` |
| Route | `GET/POST/PUT/DELETE /api/admin/apps` | `GET /api/owner/apps` |
| Source | edited by hand in App Manager | seeded from the 69 JSON manifests in `cybercheck-login/apps/` |
| Status | live in `gcr-api-clean` | route not deployed; table not created |

An app added in this dashboard's **App Manager** therefore does **not** appear
in a business's store, and vice versa. Installs are also split: this app writes
`site_apps` via `POST /api/admin/site-apps`, while the owner dashboard writes
`entity_modules`.

Decision taken for now: **leave App Manager on `/api/admin/apps`**, because it
is the catalogue the deployed API actually serves. The App Manager screen shows
a notice making the split visible, so nobody wonders why an app they added
never reached a store.

This needs resolving before the owner dashboard ships. Rewiring App Manager to
`platform_apps` is not currently possible from here — there is no `/api/admin/*`
route against that table, and adding one means changing `gcr-api-clean`.

## Related: the owner dashboard

A separate owner-facing dashboard exists as its own package (`dashboard-shell`,
`routes/owner.js`, `sql/owner_dashboard.sql`, `scripts/seed-app-catalog.mjs`).
It is a different product from this admin dashboard and is **deliberately not
part of this repo**. Notes relevant here:

- It mounts at `/api/owner`, which does not exist in `gcr-api-clean` today
  (`routes/owner.js` is absent and nothing is mounted at that prefix).
- It reads the whole business in one call, `GET /api/owner/business`, sweeping
  every table with an `entity_slug` column server-side. The table list comes
  from an `owner_schema()` SQL function rather than a hardcoded list.
- It covers writes with three generic routes — `POST/PATCH/DELETE
  /api/owner/data/:table` — scoping every one by a slug taken off the JWT, never
  off the request.

That last pattern is a reasonable model if this admin dashboard ever needs
generic table access. It is not adopted here, because the admin API exposes
specific, differently-shaped routes per resource and this app is wired to those.

## Re-running the check

The analysis compares paths extracted from `admin.html` against routes
extracted from the mounted routers. To repeat it after the API changes, point a
short script at `gcr-api-clean/server.js` and the route files it mounts — the
mount table is the authority, since several routers exist in the repo but are
deliberately commented out (`messaging`, `modules`, `google-business`,
`whatsapp`, and others whose backing tables are not in the live database).
