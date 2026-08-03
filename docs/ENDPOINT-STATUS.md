# Endpoint status

This dashboard talks only to `gcr-api-clean`.

The original rebuild changed nothing in that repo. Three route files have since
been **added** to it, on the branch `claude/cybercheck-modular-react-dashboard-7on41c`,
because several screens had no route to call at all — see *Current state* below
and `docs/DEPLOY.md`. Those changes are additive: three new files and three
`mount()` lines, with nothing existing modified.

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

## Current state

After the routes added on the `claude/cybercheck-modular-react-dashboard-7on41c`
branch of `gcr-api-clean`, of 81 sections:

| | Count |
|---|---|
| Wired to routes already live in `gcr-api-clean` | 62 |
| Need that branch merged and deployed | 18 (Booking Platform + Integrations) |
| Depend on a route that exists nowhere | **1** — SMS / Messaging |

That last one is `routes/messaging.js`, which exists but is deliberately
commented out in `server.js` because its tables are not in the live database.

Most of the original gap needed no new tables: `platform_settings` was already
a key/value store, so site config, SMS config, auth config and points config
are four keys in it rather than four endpoints; and `business_leads` was
already being written by `routes/public.js`, so only the admin read side was
missing.

Two things were deliberately **not** rebuilt:

- **`/api/admin/save-api-key`.** Storing provider secrets in a table an admin
  session can read back is worse than the environment variables the API already
  uses. Replaced with `GET /api/admin/provider-status`, which returns booleans
  and the last four characters — enough to tell two accounts apart, useless to
  an attacker.
- **`/api/admin/set-connection`.** Superseded by `/api/admin/connections`
  (Composio). The duplicate panel was removed rather than duplicated.

## Historical: paths with no matching route

| Path the legacy dashboard calls | Used for | What this app does |
|---|---|---|
| `/api/admin/gcr/site-config`, `/api/admin/gcr/site-config/hero` | Homepage hero | **fixed** — now `platform_settings` key `site_hero` via `/api/admin/settings/:key` |
| `/api/admin/gcr/category-cards[/:id]` | Category tiles | **fixed** — route + `category_cards` table added |
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
| `/api/admin/auth-config` | Tourist auth toggles | **fixed** — `platform_settings` key `auth_config` |
| `/api/admin/sms-config` | SMS provider config | **fixed** — `platform_settings` key `sms_config` |
| `/api/admin/sms-campaign-preview` | Blast preview | **corrected** — `POST /api/admin/sms-blast/preview` exists |
| `/api/admin/save-api-key` | Store provider keys | **deliberately not rebuilt** — replaced by read-only `/provider-status` |
| `/api/admin/set-connection` | Integration config | **superseded** by `/api/admin/connections` (Composio) |
| `/api/admin/business-leads[/:id]` | Trip Swipe lead board | **fixed** — admin route added over the existing `business_leads` table |
| `/api/admin/community-photos[/:id]` | Guest photo moderation | **fixed** — route + `community_photos` table added |
| `/api/admin/bookings` | Bookings | **corrected** — mounted at `/api/bookings` |
| `/api/admin/businesses/link-gcr-all` | Bulk link | not surfaced; per-entity linking works |
| `/api/admin/daily-rotation/options/:slug`, `/api/admin/daily-rotation/sections/:slug` | Daily rotation | not surfaced |
| `/api/tourist/points-config` | Points & rewards | **fixed** — `platform_settings` key `points_config` |
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
- **`POST /api/admin/sms-blast` silently ignores unknown filter keys.** It
  destructures `in_town_only`, `tags`, `min_score`, `match_type`, `swiped_right`,
  `saved` and `category`, and drops everything else without a word — so a filter
  named wrong does not narrow the audience, it texts everyone opted in. SMS
  Blasts was sending `city`, `tag` and `min_saves`, none of which the route
  reads; it now sends only keys the route destructures.
- **`saved` and `swiped_right` intersect, they do not union.** Sending both
  means "did both", not "did either". Openings sends one at a time.

## New: admin routes added to gcr-api-clean

Two routers were added on the `claude/cybercheck-modular-react-dashboard-7on41c`
branch of `gcr-api-clean`, because the dashboard could not otherwise reach the
data it needed.

**`/api/admin/platform`** (57 routes) — an admin view over the universal booking
engine. `routes/platform.js` owns the model but resolves the business from
`entity_owners` using the signed-in user, so an admin token cannot read any of
it. These routes use the same tables (`offerings`, `offering_prices`,
`bookings`, `booking_calendar`, `promos`, `waivers`, `integrations`) and take
the slug as a *filter* rather than a security boundary. Every route is
`adminRequired` — they must never become reachable with an owner token.

The later additions cover the ingestion pipeline rather than the booking model:

| Routes | Tables | Answers |
|---|---|---|
| `/parser/{sources,log,platforms}` | `email_parser_log` | which booking system each business is on |
| `/capacity`, `/capacity/:slug` | `entity`, `offerings` | what each business has |
| `/availability` | `business_availability` | what is left, per date |
| `/openings` | `business_availability` + `entity` + `gcr_deals` | what is still sellable |
| `/calendars/*` | `entity_external_calendars` | external iCal feeds, and a manual sync |
| `/deals` | `gcr_deals` | what is being promoted |
| `/search`, `/verticals` | all three availability sources + `entity` | what is open on a given date, across every industry |
| `/business-calendar/:slug` | the three sources + `entity` + `entity_external_calendars` | one business's month, with its units and the feeds that claimed dates |
| `/industry-calendar` | the three sources + `entity` | one industry's month — how many of its businesses are open each day |
| `/blueprints`, `/blueprint/:vertical` | code, describing the SQL | which tables and columns an industry has |
| `/listing/:slug` (+ `/amenities`, `/tags/:catalog`, `/collection/:table`) | the industry tables | one listing's real row, its amenities, its lists, its units |
| `/collection/:table/:id` | the collection tables | edit or remove a bed, a trip, a package |
| `/amenities` | `amenity_sections` + `amenities` | the shared catalog, grouped |
| `/match` | the industry tables + the three availability sources | description AND dates in one question |

`POST /calendars/:id/sync` lazily requires `routes/email-parser.js` and calls
`syncExternalCalendar` in-process. That module is 1,400 lines and holds all 24
extractors, so requiring it at boot would let a fault in it take the whole admin
router down; requiring it inside the handler keeps the blast radius to one
route. The only change made to `email-parser.js` was exporting that function.

**`/api/embed`** (2 routes, public) — the availability calendar a business
embeds on its own website, and the JSON it reads. Unauthenticated by design:
it loads in anonymous visitors' browsers on other people's domains. Only
counts and statuses are returned — never a guest, an email or a booking row —
and `visible_on_profile = false` rows are excluded so a business can keep a
date off its public calendar without deleting it.

**`routes/availability-engine.js`** — not a router. The three-source merge,
extracted so the admin search and the embed widget cannot drift apart.
`routes/gcr.js` still does its own inline merge for the public search and was
deliberately left alone.

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

## How availability is actually computed

Worth stating plainly, because several screens only make sense against it and
it is deliberately not an API integration:

1. A business forwards or BCCs its booking confirmations to
   `gcr-<slug>@parse.gulfcoastradar.com`. `routes/email-parser.js` recognises 24
   platforms — FareHarbor, Peek Pro, Rezdy, Bókun, Airbnb, VRBO, OpenTable,
   Toast and the rest — and extracts date, time, party size and guest.
2. That parsed booking is subtracted from `entity.daily_capacity` into a
   `business_availability` row, and mirrored into `booking_calendar`.
3. Separately, an external iCal feed (`entity_external_calendars`) is polled
   hourly and every date it claims is blocked in both tables.
4. A date in the next few days with spots left is an **opening**, which can be
   published as a `gcr_deals` row or texted to guests who already saved that
   business.

The consequence worth knowing: **a business with no `daily_capacity` can never
report an opening**, however many confirmations it forwards — the parser has
nothing to subtract from, so `remaining_spots` stays null. Booking Platform →
Inventory & Capacity exists to make that blank visible.

There is deliberately no live API integration with Peek Pro, FareHarbor or
Thoroughbred, and none is needed for this. Booking Platform → Booking Sources
answers "what is this business on?" from the emails that actually arrived,
which is a stronger signal than a field someone remembered to set.

## The three rules the availability model turns on

Each of these is easy to get backwards, and each was a real bug caught in
testing rather than a hypothetical:

1. **A missing row means unclaimed, not unavailable.** Rows are only written
   when something CLAIMS a date. So no row means nothing has taken it: open
   with the full capacity free if a capacity is on file, genuinely unknown if
   not. Reading absence as "full" showed every boat as sold out on every day
   nobody had booked yet.
2. **Unknown is not available.** With no capacity and nothing claiming a date
   there is no basis for saying it is free. Counting unknown as open put the
   businesses we know least about at the top of a search for what is open.
3. **An entity-wide block beats everything.** A condo with a capacity row
   saying "1 unit free" and an Airbnb iCal block on the same night is not
   free. The block is applied last so nothing can overwrite it.

A fourth, smaller one: the limited/available threshold has to be proportional.
A flat "3 or fewer is limited" paints a two-unit building amber when both
units are free.

## Structured listing data

`entity` holds what every business has — name, phone, hours, hero image. It does
not hold "3 bedrooms, 3 baths, gulf front" or "48ft with a head and AC", so two
perfectly ordinary questions had no answer:

    "a two bedroom two bath at Phoenix West on these nights"
    "a charter for eight, at least eight hours, a 45ft boat with AC and a head"

`sql/industry_tables.sql` answers them with **27 real tables and real typed
columns** — what each industry would store if you rebuilt its platform from
scratch, following what Airbnb, VRBO and FareHarbor actually collect so a
business can transcribe an existing listing rather than invent answers:

| Industry | Tables |
|---|---|
| Stays | `stay_properties`, `stay_units`, `stay_unit_beds`, + amenity joins |
| Charters | `charter_operators`, `charter_boats`, `charter_trips`, `fish_species`, `charter_species` |
| Cruises | `cruise_operators`, `cruise_vessels`, `cruise_trips` |
| Rentals | `rental_operators`, `rental_items` |
| Watersports | `watersport_operators`, `watersport_activities` + join |
| Sessions | `session_providers`, `session_packages`, `session_locations` |
| Venues | `venue_spaces`, `venue_space_event_types`, + amenity join |
| Shared | `amenity_sections`, `amenities` (172 seeded rows across 15 sections) |

`bedrooms` is an `integer`, `bathrooms` a `numeric(3,1)` because 2.5 is a real
answer, `length_ft` a `numeric(5,1)`. Amenities and species are catalogs joined
through real join tables, never free text, so "who targets red snapper" is an
index lookup rather than a LIKE over a comma-separated string.

`routes/industry-blueprints.js` does not store anything — it *describes* those
tables so a form and a search can be generated from them without a second,
hand-kept field list. `scripts/check-blueprint-columns.mjs` parses the SQL and
fails the build if the description ever names a column the schema does not
create, which is the failure that would otherwise show up as a Postgres error
in production, per business, at write time.

**The building and the unit are separate on purpose.** A condo complex is one
`entity`; each unit is its own `entity` with `parent_entity_slug` set. The
building has the pool and the lazy river (`stay_properties`); the unit has two
bedrooms (`stay_units`). That is why `/match` classifies a matched child by its
PARENT's industry — otherwise "2 bed 2 bath" finds unit 1204 and then discards
it because a `condo_unit` is not a `condo`.

**A name can live on two tables.** `max_anglers` is on both `charter_boats` (what
the boat holds) and `charter_trips` (what this trip takes). Left alone, which one
a filter hits would depend on loop order, so duplicates collapse to the first
occurrence — listing, then its collections, then unit — and the rest are reported
on `also_on`. For `max_anglers` that resolves to the trip, which is right: "a
charter for eight" is a question about the trip you can book.

## Industries

An industry is derived from `entity_type` / `entity_subtype` by the patterns in
`routes/availability-engine.js`, not stored on a row, so a new subtype lands in
the right bucket without a migration. `GET /api/admin/platform/verticals` is the
single source of truth — the dashboard's Industry Calendars index reads it
rather than hardcoding a list, because a page that classifies nothing is the
predictable result of the two drifting apart.

Condos and hotels are separate industries rather than one "stays" bucket: they
are run by different people and searched separately, and each gets its own
page. They share the coverage rule (`all` — a stay has to cover every night),
which is what actually distinguishes them from a charter.

Order matters in the pattern list: `rental` would swallow "vacation rental" and
"condo rental" if it ran before the stay types, so entity_type is matched
first and the patterns second.

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
