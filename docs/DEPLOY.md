# Deploying this dashboard

Four steps. After the third you can prove it works in one command.

Both repos use the same branch name: `claude/cybercheck-modular-react-dashboard-7on41c`.

---

## 1 · Database

Three SQL files, all re-runnable. Run them against the **GCR Supabase** project
(the one behind `GCR_SUPABASE_URL`).

```bash
psql "$GCR_DATABASE_URL" -f sql/admin_dashboard_gaps.sql
psql "$GCR_DATABASE_URL" -f sql/composio_connections.sql
psql "$GCR_DATABASE_URL" -f sql/booking_ingestion.sql
psql "$GCR_DATABASE_URL" -f sql/capability_tables.sql
psql "$GCR_DATABASE_URL" -f sql/capability_seed.sql
psql "$GCR_DATABASE_URL" -f sql/menu_normalization.sql
```

Or paste each into the Supabase SQL editor.

| File | Creates |
|---|---|
| `admin_dashboard_gaps.sql` | `community_photos`, `category_cards`, and makes sure `platform_settings` and `business_leads` exist |
| `composio_connections.sql` | `platform_connections`, `platform_connection_categories`, `entity_connections` |
| `booking_ingestion.sql` | `entity.daily_capacity` / `entity.capacity_per_slot`, then reports any ingestion table that is absent |
| `capability_tables.sql` | 18 tables of structured listing data — `units`, `boats`, `trips`, `gear`, `packages`, `spaces`, `entity_operations` and their joins. Named after the thing, not the industry; any slug can use any of them |
| `capability_seed.sql` | the catalogs they join to — 128 amenities, 20 fish species, 20 activities |
| `menu_normalization.sql` | `service_periods`, `menu_item_prices`, `dietary_tags` + `menu_item_dietary`, and a nullable `menu_sections.service_period_id`. **Additive only** — it touches live menu tables and drops nothing |

Every SQL file is checked by `npm run check:sql` in gcr-api-clean, which fails
on a `drop table`, `drop column`, `truncate` or `delete from` anywhere in
`sql/`. These tables hold live menus and bookings; the rule is add, never
replace.

`booking_ingestion.sql` deliberately creates no tables. The ingestion views read
`email_parser_log`, `business_availability`, `booking_calendar`,
`entity_external_calendars` and `gcr_deals` — all of which the live pipeline
already writes daily, and none of which has a definition in this repo. It adds
the two capacity columns and then *prints* anything missing rather than guessing
a shape for a table that is already in production.

Both use `create table if not exists` and `add column if not exists`, so running
them twice is harmless, and running them after the owner-dashboard package's
`owner_dashboard.sql` is fine — the overlapping tables are defined compatibly.

**Check it worked:**

```sql
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('community_photos','category_cards','platform_settings',
                      'business_leads','platform_connections','entity_connections')
 order by table_name;
-- expect 6 rows
```

---

## 2 · API

Merge and deploy `gcr-api-clean`. Three new route files, three `mount()` lines
in `server.js`; nothing existing is modified.

| Router | Mounted at | Gives you |
|---|---|---|
| `routes/admin-platform.js` | `/api/admin/platform` | bookings, offerings, calendar, promos, waivers, integrations, plus the ingestion views: parser sources, capacity, availability, openings, iCal feeds, deals, the cross-industry date search, and the per-business and per-industry month calendars |
| `routes/embed.js` | `/api/embed` | the availability calendar businesses embed on their own sites, and its JSON — **public, no auth** |
| `routes/composio.js` | `/api/admin/connections` | Composio catalog and connections |
| `routes/admin-settings.js` | `/api/admin` | settings, provider status, business leads, guest photos, category cards |

`mount()` already skips a route file that fails to load rather than taking the
API down, so a bad deploy degrades instead of going dark.

`routes/availability-engine.js` is a shared module, not a router — the
three-source merge, so the admin search and the embed widget cannot disagree.

One existing file changed, by one line: `routes/email-parser.js` now also
exports `syncExternalCalendar`, so `POST /api/admin/platform/calendars/:id/sync`
can run a feed in-process instead of making an HTTP call back to the same
server. Nothing in that module's behaviour changed.

### Environment

Only one variable is genuinely new:

| Variable | Needed for | If unset |
|---|---|---|
| `COMPOSIO_API_KEY` | starting a Composio connection | catalog and existing connections still work; `/connect` answers 501 with a clear reason |
| `COMPOSIO_REDIRECT_URL` | where Composio returns the owner after they authorise | Composio uses its own default |
| `COMPOSIO_BASE_URL`, `COMPOSIO_API_VERSION` | pinning a different Composio API | defaults to `https://backend.composio.dev` / `v1` |

**Check it worked:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://YOUR-API/api/admin/platform/summary
# expect 401 — the route exists and is correctly refusing an unauthenticated call

curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://YOUR-API/api/embed/availability.js
# expect 200 application/javascript — the embed widget is public on purpose
```

A `404` on either means the deploy did not pick up the new routers.

### The embed widget is public

`/api/embed/*` has no auth and must not get any — it runs in anonymous
visitors' browsers on customers' own websites. What protects it is what it
returns: counts and statuses only, with `visible_on_profile = false` rows
excluded. No guest name, email, phone, confirmation number or booking row is
reachable through it. Keep it that way if you extend it.

The widget bakes in the origin it was fetched from, so moving the API to
another host needs no change on any customer site — but a snippet already
pasted on a customer site points at the old host, so keep the old origin
answering or reissue the snippets from Booking Platform → Website Calendar.

---

## 3 · Dashboard

```bash
npm install
cp .env.example .env      # set VITE_API_BASE_URL
npm run build             # → dist/
```

Deploy `dist/` as a static site. Set `VITE_PUBLIC_SITE_URL` too if you want the
claim, preview and QR-menu links on Sales Pages / QR Menus / Menu Editors Hub.

You can also repoint a built bundle with no rebuild — define
`window.__ADMIN_CONFIG__ = { apiBaseUrl: '…' }` in a `config.js` served next to
`index.html`. Platform → Settings shows every resolved value and which variable
set it.

---

## 4 · Prove it

This is the step that matters, because nothing in this repo has been run
against your live database.

```bash
npm run smoke -- --base https://YOUR-API --email you@example.com --password '…'
```

It signs in, calls every read endpoint it has a declared expectation for, and
reports three things per endpoint:

- **ok** — answered, and the response contained the key the dashboard reads
- **EMPTY** — answered, but that key was missing. This is the one to care
  about: the screen will render and show nothing, and no status code would
  have told you
- **404 / 401 / error** — with the sections each failure breaks, by name

Exit code is non-zero if anything fails, so it can run in CI.

It is read-only and covers ~50 endpoints. The ~135 it skips are writes and
reads that need a real id; it says so rather than counting them as passing.
Those get exercised by using the dashboard.

There is also a live check inside the app: **All Sections → "Probe routes"**
does the same thing from the browser, with the results grouped by section.

---

## What still will not work

**SMS / Messaging.** `routes/messaging.js` exists in `gcr-api-clean` but is
commented out in `server.js`, with a note that its tables are not in the live
database. Making it work means creating those tables and mounting it — a
feature build, not a gap-fill, so it was left alone. The screen says so.

**A business with no capacity on file.** It will forward confirmations, they
will parse, and it will still never appear under Openings — the parser has
nothing to subtract from, so `remaining_spots` stays null. Booking Platform →
Inventory & Capacity lists exactly those businesses; that list should be empty
before anyone judges Openings as broken.

**Live API integrations with Peek Pro, FareHarbor and the rest.** There aren't
any, and for availability there don't need to be — those platforms are read
through the email parser, which recognises 24 of them. Booking Platform →
Booking Sources shows which one each business is actually on, derived from the
emails that arrived. `routes/fareharbor.js` is the template if a real API
connection is ever wanted for something the parser can't give you.

**The booking tables.** `offerings`, `bookings`, `booking_calendar`, `promos`
and `waivers` are written by `routes/platform.js` but are not in `schema.sql`,
so they were presumably created directly in Supabase. `/summary` returns `null`
rather than `0` for a table that is absent, and Booking Platform → Overview
shows "table not present" — so the first load tells you the truth.

---

## Rollback

The API changes are three new files, three `mount()` lines, and one added
`module.exports` line in `routes/email-parser.js`. Reverting the merge removes
them; no existing behaviour was modified and no migration drops or alters an
existing column. The SQL only adds tables and columns, so it can be left in
place safely even if the API is rolled back.
