# Deploying this dashboard

Four steps. After the third you can prove it works in one command.

Both repos use the same branch name: `claude/cybercheck-modular-react-dashboard-7on41c`.

---

## 1 · Database

Two SQL files, both re-runnable. Run them against the **GCR Supabase** project
(the one behind `GCR_SUPABASE_URL`).

```bash
psql "$GCR_DATABASE_URL" -f sql/admin_dashboard_gaps.sql
psql "$GCR_DATABASE_URL" -f sql/composio_connections.sql
```

Or paste each into the Supabase SQL editor.

| File | Creates |
|---|---|
| `admin_dashboard_gaps.sql` | `community_photos`, `category_cards`, and makes sure `platform_settings` and `business_leads` exist |
| `composio_connections.sql` | `platform_connections`, `platform_connection_categories`, `entity_connections` |

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
| `routes/admin-platform.js` | `/api/admin/platform` | bookings, offerings, calendar, promos, waivers, integrations |
| `routes/composio.js` | `/api/admin/connections` | Composio catalog and connections |
| `routes/admin-settings.js` | `/api/admin` | settings, provider status, business leads, guest photos, category cards |

`mount()` already skips a route file that fails to load rather than taking the
API down, so a bad deploy degrades instead of going dark.

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
```

A `404` there means the deploy did not pick up the new routers.

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

**Peek Pro.** No integration exists anywhere in the API. `routes/fareharbor.js`
is the template if you want one; it would write to the same `integrations`
table the dashboard already reads.

**The booking tables.** `offerings`, `bookings`, `booking_calendar`, `promos`
and `waivers` are written by `routes/platform.js` but are not in `schema.sql`,
so they were presumably created directly in Supabase. `/summary` returns `null`
rather than `0` for a table that is absent, and Booking Platform → Overview
shows "table not present" — so the first load tells you the truth.

---

## Rollback

The API changes are three new files and three `mount()` lines. Reverting the
merge removes them; nothing existing was modified, and no migration drops or
alters an existing column. The SQL only adds tables, so it can be left in place
safely even if the API is rolled back.
