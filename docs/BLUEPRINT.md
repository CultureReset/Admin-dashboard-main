# Admin-dashboard-main — The Complete Wiring Blueprint

A read-not-remembered teardown of the operator console. Every file, every
module, every API path, every screen that is honest about a route it cannot
reach. Computed from the actual code on `main` (HEAD `66c8ab1`, 2026-08-05),
not from this repo's own docs — which, as §16 records, still describe an API
deployment that has since caught up.

**Scope measured on disk:** 172 files / ~30,851 lines. 84 registered sections
across 10 nav groups, 121 JS/JSX modules under `src/`, a 741-line endpoint
registry carrying **275 paths in 43 groups**, a 9-component UI kit, 3 Node
scripts, and 3 docs.

This is the second of the four papers. Where `Dashboards-users-` is one
business looking at itself, this is **one operator looking at all 4,000** — and
the two are deliberately built from the same parts: `api/client.js` and
`api/endpoints.js` are the same shape in both repos, and `AppStoreView.jsx` is
literally the same file.

---

## 0. What this repo is

A Vite + React 19 single-page app with `react-router-dom`. It replaces a single
**23,000-line `admin.html`** in `cybercheck-login` with 84 independent section
modules, a shared UI kit, and one place that knows every API path.

**The organising idea, from `README.md`: nothing is hardcoded.** That claim is
specific and each half is enforced somewhere:

| Claim | Enforced by |
|---|---|
| No hostnames in source | `src/config/env.js` — three-tier resolution, and Platform → Settings shows every resolved value *and the variable that set it* |
| No API paths in components | `src/api/endpoints.js` — 275 paths, `scripts/audit-endpoints.mjs` checks every one against the API's real routers |
| No hand-written nav or routes | `src/modules/registry.js` — sidebar, router and command palette all read from it; a duplicate-path guard throws at module load |
| No hand-written forms or tables | `SchemaForm` + `DataTable` render from descriptors; `entitySchema.js` mirrors the real `entity` table |
| No hardcoded businesses or slugs | `EntityPicker` — one shared, persisted selection |
| No repeated CRUD plumbing | `createResource` + `useResource` + `CrudSection` — which is why most screens are 40–80 lines |
| No colour literals | `src/styles/theme.css` tokens; the light/dark toggle is one attribute flip |

**The second organising idea, and the one that gives this repo its character:
a screen that cannot reach its route says so.** Not a spinner, not an empty
table — a named notice with the path it tried. There are 8 sections marked
`status: 'partial'` in the registry, each rendering an explicit gap. §16 records
that most of those gaps have since closed on the API side.

### Its place among the four repos

| Repo | Auth | Talks to |
|---|---|---|
| `gcr-api-clean` | — | the only thing touching Postgres |
| **`Admin-dashboard-main`** | **Express JWT, `role=admin`, from `admin_users`** | `/api/admin/*` + a dozen public//api-level routers |
| `Dashboards-users-` | Supabase session → `entity_owners` | `/api/business/*`, `/api/connections`, `/api/gcr/*` |
| `gcr-unified` | tourist Supabase session | `/api/gcr/*`, `/api/platform/*`, `/api/tourist*` |

---

## 1. Entry point & boot

### `src/main.jsx` (10) / `src/App.jsx` (51)

`App` composes four providers in a deliberate order:

```
ToastProvider → AuthProvider → Gate → EntityProvider → BrowserRouter → AppShell
```

`Gate` is the security boundary and it is strict: **the shell never renders
until the server has confirmed the session.** `isChecking` shows a spinner;
`!isAuthenticated` shows `LoginPage`; only then does `EntityProvider` load the
directory once and `BrowserRouter` mount the shell. `useTheme()` is called in
`Gate` so the persisted theme applies on the login screen too, not just after
sign-in.

`EntityProvider` sits *outside* the router on purpose — the entity list is
fetched once for the whole session and shared by every section that scopes work
to a business.

### `vite.config.js`, `vercel.json`, `package.json`, `.env.example`

`vercel.json` is a proper SPA deployment: `rewrites` sends everything except
`/assets/` to `index.html`; `/assets/*` gets `max-age=31536000, immutable`;
`/index.html` gets `no-cache`. That pairing is what makes a hashed-asset build
safe to cache forever.

Runtime dependencies are **three**: `react`, `react-dom`, `react-router-dom`.
No UI library, no charting library, no query library, no HTTP library.

```
"verify": lint && audit:endpoints && sections:check && build
```

Four gates, all offline. `.env.example` documents 8 `VITE_*` variables and one
dev-only proxy, and states the rule up front: *"Nothing in the source tree
hardcodes a hostname, token, business, or entity."*

---

## 2. The HTTP layer

### `src/config/env.js` (87) — the only place environment is read

Resolution order, highest first:

1. **`window.__ADMIN_CONFIG__`** — set by a static `config.js` at deploy time,
   or by hand in the console while debugging.
2. **`import.meta.env.VITE_*`** — baked in at build time.
3. The fallback at the call site.

Tier 1 is the interesting one: **a deployment can be repointed at a different
API with no rebuild**, by serving a `config.js` next to `index.html`.

Config keys: `apiBaseUrl` (empty = same origin), `authTokenKey`
(`cc_admin_token`), the derived `authUserKey` getter, `requiredRole` (`admin`),
`publicSiteUrl` (*"Empty means 'not configured' and the screens that need it say
so rather than guessing"*), `appName`/`appShortName`, `defaultPageSize` (50),
`requestTimeoutMs` (45 s), `isDev`. Plus `apiUrl(path)`.

### `src/api/client.js` (234) — the only place `fetch` is called

Same shape as `Dashboards-users-/src/lib/apiClient.js`, with two deliberate
differences: **no token-refresh retry** (the admin JWT is 7-day and not
refreshable), and **no acting-slug injection** (an admin here names a slug
per-call in the path, not via a session).

`ApiError` carries `status`/`path`/`body`/`cause` and three predicates:
`isMissingEndpoint` (404/405), `isAuthError` (401/403), `isNetworkError`
(status 0). `isMissingEndpoint` is the one that powers the whole
honest-about-gaps behaviour — `CrudSection` and `ConfigCard` both branch on it
to render "this screen's API route is not deployed."

Auth failures notify listeners; `AuthContext` signs out on **401 only**.

**`unwrapList(payload, keys)` / `unwrapItem(payload, keys)`** — the pragmatic
part, and honest about why it exists:

> The API is not uniform — some routes return `{entities: []}`, some
> `{rails: []}`, some a bare array — so callers name the keys they expect and
> this walks them in order.

Falls back to the first array-valued property. That fallback is what lets a
resource keep working when a route's wrapper key changes.

### `src/api/endpoints.js` (741) — 275 paths in 43 groups

The registry's header maps each group to the gcr-api-clean router that serves
it. The groups, with their entry counts:

| Group | n | Group | n | Group | n |
|---|---|---|---|---|---|
| `auth` | 3 | `entities` | 17 | `menu` | 15 |
| `drinks` | 3 | `happyHour` | 3 | `events` | 6 |
| `specials` | 5 | `sections` | 6 | `profile` | 3 |
| `businessProfile` | 5 | `intake` | 7 | `dashboardSms` | 4 |
| `collections` | 10 | `claims` | 3 | `ads` | 4 |
| `rails` | 7 | `coupons` | 3 | `imports` | 10 |
| `ai` | 9 | `analytics` | 7 | `customers` | 1 |
| `socialPosts` | 6 | `tripswipe` | 8 | `tourists` | 7 |
| `setupQuestions` | 5 | `sms` | 7 | `qr` | 19 |
| `arHunts` | 6 | `artists` | 11 | `businesses` | 3 |
| `apps` | 8 | `leads` | 4 | `bookings` | 8 |
| `reviews` | 4 | `updateLinks` | 4 | `photos` | 5 |
| **`bookingPlatform`** | **42** | `embed` | 2 | `connections` | 8 |
| `settings` | 3 | `settingsKeys` | 4 | `categoryCards` | 3 |
| **`unverified`** | **11** | | | | |

Three details worth carrying:

- **`auth.verify()` is `GET /api/admin/gcr/claims?limit=1`.** There is no
  dedicated verify route, so the cheapest authenticated admin GET stands in.
- **`sections.*` has no `/gcr` segment** — those routes mount directly under
  `/api/admin`, unlike every other entity route. Called out in the file.
- **`endpoints.unverified` (11 paths)** is the honesty mechanism: paths the
  legacy `admin.html` called that have no matching route. They are wired exactly
  as the legacy dashboard called them *"so they start working the moment the API
  grows them"*, and the audit script reports them separately rather than
  failing the build.

---

## 3. Authentication

### `src/auth/tokenStore.js` (103)

Isolated from `AuthContext` *"so the API client can read the token without
importing React"*. `safeStorage()` catches the throw that private-mode Safari
and some embedded webviews raise on `localStorage` access, and falls back to
module-level `memoryToken`/`memoryUser` — the session still works, it just
doesn't survive a reload.

`decodeToken()` parses a JWT payload **without verifying it**, and the comment
draws the line precisely:

> This is only ever used for UI hints (showing the signed-in email, an early
> "your session expired" message). Authorization is decided by the server.

### `src/auth/AuthContext.jsx` (159)

Three states: `checking` → `anonymous` | `authenticated`.

**The guard is reproduced from the legacy dashboard deliberately:** *"a
decoded-but-unverified JWT payload can be forged client-side, so the dashboard
stays hidden until an authenticated request to the API succeeds."*

`verifyToken()` runs three cheap local checks first — no token, expired `exp`,
wrong `role` — then makes the real call. The failure split matters:

- **401/403** → sign out, *"Your session is no longer valid."*
- **network/server error** → **keep the session**, set `status: AUTHENTICATED`,
  surface the message. *"a flaky connection doesn't log the user out."*

`signIn()` posts to `/api/admin/login` with `{ auth: false }`, requires a
`token` in the response, and re-checks `role` against `config.requiredRole`
before storing anything.

### `src/auth/LoginPage.jsx` (84) + `.css`

Email + password against `admin_users` (bcrypt, 7-day JWT — `admin.js:87–127`
on the API side).

---

## 4. The module registry — `src/modules/registry.js` (901)

**The dashboard's structure is data.** One file lists every section once; the
sidebar, the router and the section index all read from it.

A descriptor: `{ id, label, icon, group, path, load, description, hidden?,
status? }`. `status: 'partial'` means *"depends on a route the API does not
currently serve"* and drives an amber `!` in the sidebar.

**84 entries across 10 groups.** Full inventory:

| Group | Sections |
|---|---|
| **home** (2) | Overview `/` · All Sections `/sections` |
| **menu** (7) | Menu Builder · QR Menus · QR Tracker · Reviews · Referral Partners · Daily SMS Links · Menu Editors Hub |
| **directory** (7) | GCR Businesses · Entity Editor (+`:slug`, hidden) · Business Profiles (+`:slug`, hidden) · Site Editor **partial** · Claims |
| **booking** (16) | Overview · Offerings · Bookings · Date Claims · Promos · Sources · Feeds · Inventory · Availability · Business Calendar · Industries · Match · Search · Website Calendar · Openings · Connections |
| **content** (11) | Events · Artists · Artist Profiles · Specials · Ads · Rails · AI Config · Coupons · SEO · Bulk Upload · Bulk Events |
| **ai** (4) | Chat · Organize · RAG Index · Settings |
| **engagement** (6) | Analytics · Visitor Behaviour · Reviews · Customers · Messaging **partial** · Social |
| **tripswipe** (17) | Overview · Businesses · Tourists · Analytics · AI Feedback · Concierge Test · Questions · Sponsored · Tonight · Points **partial** · SMS QR · Auth Settings **partial** · Button Config · SMS Settings **partial** · SMS Blasts · Business Leads **partial** · Community Photos **partial** |
| **appstore** (2) | App Manager · Business Apps |
| **platform** (12) | Text the Dashboard · Intake · Businesses · Leads · Bookings · Sales Pages · AR Hunts · Integrations **partial** · People · Users · API Keys **partial** · Settings |

**The duplicate-route guard (the tail of the file)** is the sharpest piece of
engineering in the repo:

> Two sections on the same path is not a warning, it is a section that can never
> be reached: the router matches the first and the second is dead. It also
> survives every check we have — the endpoint audit looks at API paths, and the
> route walk navigates each path and finds *something* rendering. So it is
> asserted here, at module load, where it fails immediately and names both
> offenders.

Then: `modules` (with `lazy()` attached), `moduleById`, and `navigation`
(groups filtered to their visible items, empty groups dropped).

---

## 5. The shell (`src/shell/`)

### `AppShell.jsx` (67)

Routes are `modules.map(...)` — *"this file never needs to change when a section
is added."* Each route is wrapped in `SectionBoundary` then `Suspense`, with a
catch-all `*` rendering an `EmptyState`. Mobile drawer closes on every
`location.pathname` change.

### `Sidebar.jsx` (91)

Generated from `navigation`. The one clever piece is **`PREFIX_PATHS`**:

> "/booking" sits above "/booking/offerings" […] Without `end`, NavLink marks
> the parent active whenever a child is open and two items light up at once.
> **Derived rather than listed**, so a new group gets it for free.

Plus a live filter over label / id / description, and the amber `!` for
`status: 'partial'`.

### `TopBar.jsx` (87)

`useCurrentModule()` resolves the title by exact match → dynamic-segment prefix
→ longest static prefix. **It shows the API base URL** — *"an admin editing live
data should be able to see at a glance which backend they are pointed at."*
Theme toggle, signed-in email, sign out.

### `SectionBoundary.jsx` (55)

A class-component error boundary per section. *"One section throwing must not
blank the whole dashboard."* Logs the stack to console, renders a calm card with
the message, the first 4 stack lines, and a Retry. `componentDidUpdate` clears
the error when `moduleId` changes, so navigating away recovers.

### `useTheme.js` (21) + `AppShell.css`, `Sidebar.css`, `TopBar.css`

`data-theme` on the root, persisted through `usePersistentState`. Two modes here
(dark default), where the business dashboard has three.

---

## 6. The UI kit (`src/ui/`, 9 components + 9 stylesheets)

| File | Lines | What it is |
|---|---|---|
| `CrudSection.jsx` | 225 | **The workhorse.** A complete list + create + edit + delete screen from a descriptor. Owns the toolbar, the modal, the confirm dialog, the toasts, and the reload-after-write, so all of it *"behaves identically everywhere."* Appends the actions column itself; preserves the id across an edit without letting it into the form schema. Exports `ListSection` — the same thing with all three write flags off. |
| `DataTable.jsx` | 229 | Column-descriptor table with client-side search, sort and pagination built in. `value(row)` separates the sort/search key from the rendered cell. |
| `SchemaForm.jsx` | 233 | Renders, validates and submits a field-descriptor array or `{groups}`. Supports `span`, `visible(values)` for conditional fields, `validate`, `transform`. The rationale: *"The Entity Editor's Info tab is ~30 fields; as a descriptor array that stays readable and reorderable, where hand-written JSX would not."* |
| `Field.jsx` | 264 | Every control, selected by `type` from a `CONTROLS` map. `NumberControl` preserves empty as `null` *"so a cleared optional number isn't sent as 0."* |
| `Modal.jsx` | 134 | Portal dialog: Escape, backdrop click, body-scroll lock, focus moved in and **restored on close**. Exports `useConfirm()`. |
| `Toast.jsx` | 102 | *"Every write in the dashboard reports its outcome here, so a save that silently failed is not possible."* Danger toasts last 8 s, others 4 s. `toast.error()` accepts an `ApiError` and pulls the path off it. |
| `Tabs.jsx` | 78 | Descriptor-driven, with `visible(context)`. Exports `TabBar` separately — and says why: screens that hand-wrote the strip never imported `Tabs.css`, *"and the strip rendered as unstyled grey boxes."* |
| `MonthCalendar.jsx` | 185 | Shared by three screens *"so the three cannot end up disagreeing about what a colour means."* Knows nothing about endpoints and does no fetching. **Renders `assumed` days hollow** — see below. |
| `primitives.jsx` | 187 | `Button`, `Card`, `Badge`, `Stat`, `PageHeader`, `EmptyState`, `LoadingBlock`, `ErrorState`, `Notice`, `SearchInput`, `Spinner`. *"no business knowledge and no colour literals."* |

**`MonthCalendar`'s `assumed` flag** is the clearest expression of the
platform's availability thesis inside a UI component:

> a date with no row means nothing has CLAIMED it, not that we counted it.
> Open-because-capacity-says-so and open-because-a-booking-said-so are different
> facts and an operator has to be able to tell them apart at a glance, so
> assumed days are drawn hollow.

That is `lib/availability-engine.js`'s `expand()` rule, rendered.

---

## 7. The data layer

### `src/api/createResource.js` (104)

> Most admin sections are the same shape: list rows, create one, update one,
> delete one. Rather than writing that fetch/unwrap/error dance sixty times, a
> section declares which endpoints it uses and gets a typed-ish resource object
> back.
>
> Anything genuinely bespoke (bulk imports, AI calls, uploads) stays a plain
> function in the section module — **this factory covers the repetitive 80%**.

Spec: `name`, `listPath(params)`, `createPath(params)`, `itemPath(id, params)`,
`listKeys`, `itemKeys`, `idField`, `updateMethod`, `normalize`, `serialize`.
`requirePath()` throws a named error rather than calling `undefined`, so an
unsupported operation fails legibly. `save()` dispatches create-vs-update on the
presence of `idField` and strips it from the update body.

### `src/api/resources.js` (321) + `bookingResources.js` (173)

~40 resource definitions. `bookingResources` is kept separate *"because these
all share one filter shape — `?slug=` narrows to a business, absent means every
business — and because the booking model is worth reading as a unit."*
Each carries the wrapper key the API happens to use (`listKeys: ['sections',
'menu_sections']` — both, because two routes disagree).

### `src/hooks/useAsync.js` (123)

`useAsync` (with a `runId` guard so *"fast typing can't race"*), `useAction`,
`useDebounced`, `usePersistentState`. *"Deliberately small — the dashboard is
read-then-refetch, not a cache-heavy app, so this covers the whole surface
without pulling in a query library."*

### `src/hooks/useResource.js` (107)

Binds a resource to component state: `{ rows, loading, error, saving, reload,
save, remove, setRows }`, with toast reporting built in. `params`/`query` are
JSON-serialised into memo keys *"so object literals passed inline don't
retrigger every render"* — the subtle bug that would otherwise cause an infinite
fetch loop.

> This is why a typical section module is ~40 lines of descriptor instead of a
> few hundred lines of fetch plumbing.

---

## 8. Shared components (`src/components/`)

### `EntityPicker.jsx` (208)

> Many sections operate on "whichever entity the admin chose". This component is
> the single way that choice is made — **nothing in the app names a business or a
> slug in source.**

`EntityProvider` loads the entity list once for the whole session. The selection
lives in `usePersistentState('cc_admin_entity')`, so it survives navigation
*and* reloads: *"moving between the Menu Builder and the Entity Editor keeps you
on the same business."*

### `ConfigCard.jsx` (123)

GET a config object → edit against a schema → PUT it back. The honesty is built
in: when the route is missing it renders *"an explicit notice showing the path it
tried, instead of an empty form that looks editable but saves nowhere"* — and
still shows the empty form, so the shape is visible.

### `SectionedItemsEditor.jsx` (234)

> Menus, drinks, and happy hour are the same structure — named sections, each
> holding priced items — served by three parallel sets of routes. One component
> covers all three; the caller supplies the endpoints and the field schema, so a
> fourth list of this shape needs no new component.

Used by Menu Builder *and* the Entity Editor's Content tab, *"so behaviour
cannot drift between them."*

---

## 9. Shared lib (`src/lib/`)

- **`fields.jsx` (227)** — field-descriptor builders (`fields.text`,
  `.textarea`, `.select`, `.bool`, `.money`, `.date`, `.time`, `.image`,
  `.sortOrder`), formatters, and column renderers. The principle: *"Option lists
  that the API can supply (entity subtypes, taxonomy) are fetched rather than
  typed out. The few genuinely fixed lists — days of the week, claim statuses
  defined by the API's own enum — live here as named constants so a section never
  inlines a magic string."*
- **`contentSchemas.js` (135)** — `eventSchema`, `specialSchema` and friends,
  *"Defined once and reused by the global Events/Specials screens, the Entity
  Editor's Content tab, and the bulk-import previews, so the three can never
  disagree about what a row looks like."*
- **`csv.js` (101)** — a correct quoted-field CSV parser: embedded commas,
  newlines and `""` escapes round-trip. Handles records spanning physical lines,
  *"which a naive `split('\n')` would tear in half."*

---

## 10. The 84 screens

Every module, with what it does and what it calls. Grouped as the sidebar
groups them.

### 10.1 Home (2)

- **`home/Overview.jsx` (189)** — the landing screen. Real counters, not
  placeholders: entity list, pending claims, active ads, analytics payloads.
  *"Each tile fails independently, so one slow or missing route does not blank
  the page."*
- **`home/Sections.jsx` (293)** — the self-documenting index, and the most
  unusual screen here. **Both halves are derived, not written:** the section list
  from `registry.js`, the endpoints each section calls from
  `sectionMap.generated.json`, produced by `scripts/generate-section-map.mjs`
  walking the real import graph. *"So this screen cannot drift from the code."*
  "Probe endpoints" then asks the live API whether each route answers — turning
  it into a health check for the whole dashboard.

### 10.2 Menu & QR (7)

| Module | Lines | What / calls |
|---|---|---|
| `MenuBuilder.jsx` | 121 | Menus/drinks/happy hour for a chosen business, via `SectionedItemsEditor`. Same component as the Content tab. |
| `QrMenus.jsx` | 169 | Public QR menu links; `GET /api/menu-editor/:slug/qr-menu` confirms a slug renders. |
| `QrTracker.jsx` | 193 | QR inventory + scans + locations. `/api/qr`, `/api/qr/:id/scans`, `/api/qr/stats/summary`, `/api/qr/locations`. |
| `Reviews.jsx` | 192 | Per-business public reviews. **Carries a warning worth reading twice** — see below. |
| `ReferralPartners.jsx` | 136 | `/api/qr/partners`, `/:id/stats`, `/partner-portal/:code`. |
| `DailyUpdateLinks.jsx` | 176 | `/api/update/generate` · `/send-sms` · `/status/:token` · `/today`. The texted magic link. |
| `MenuEditorsHub.jsx` | 153 | Every business with a link into the PIN editor, **plus PIN status** *"so it is obvious who can actually get in."* |

**`menu/Reviews.jsx` documents a shadowed-route hazard:**

> The legacy dashboard also drove an SMS review-request flow against
> `/api/reviews/request` […] None of those exist. **Worse, they do not 404** —
> they match the slug routes, so `POST /api/reviews/request` would have created a
> review against a business named "request". That flow is not reproduced here.

That class of bug is exactly what `scripts/audit-endpoints.mjs` was built to
catch.

### 10.3 GCR Directory (7)

- **`Businesses.jsx` (195)** — the directory list; row click opens the editor.
- **`EntityEditor.jsx` (129)** — picks an entity (or reads `:slug` from the
  URL), loads it once, hands the record to the active tab. *"Every tab shares the
  same record and the same `patch` function, so a save on one tab refreshes the
  others."*
- **`useEntityRecord.js` (87)** — `GET`/`PATCH /api/admin/gcr/entities/:slug`.
  **Catches the 207:** *"The PATCH route answers 207 with `{ success: false,
  errors: [...] }` when some parts of a multi-part write fail. A 207 passes
  `response.ok`, so without the check below a partial failure would look like a
  clean save."*
- **`useEntityFull.js` (62)** — reads the *public* model, because *"The admin
  router has write routes for menus, drinks, happy hour, specials, and events,
  but no per-entity GET for them."* Admin routes are the write path, `GET
  /api/gcr/entity/:slug` is the read path. Appends a cache-buster because that
  endpoint is edge-cached 2 minutes.
- **`entitySchema.js` (272)** — mirrors the `entity` table from
  `gcr-api-clean/schema.sql`, *"Grouped the way an admin thinks about a business
  rather than the order the columns happen to appear in."* One source for the
  Info tab, the create modal and the SEO screen.
- **`BusinessProfile.jsx` (967)** — the largest file, and a **dashboard inside
  the dashboard**: pick any business and see what that business's own dashboard
  shows. The contract is stated as a prohibition: *"There is no list of sections
  in this file, and there must never be one. […] the moment this file gains a
  `const SECTIONS = [...]` it is broken."* Two levels of nav — the admin sidebar
  outside, the business's own sections inside, collapsing to a drawer on a phone.
  Calls `GET /api/admin/gcr/profile/:slug` (`business-profile.js:131`).
- **`SiteEditor.jsx` (117)** — **partial.** Hero and category tiles. Two panels
  report honestly that `/gcr/site-config` and `/gcr/category-cards` were legacy
  paths; the third links to Rails, *"the live mechanism for curating what appears
  on each public page."*
- **`Claims.jsx` (192)** — `GET`/`PATCH /api/admin/gcr/claims`. The approval
  step that turns a claim into an account.

**The 11 Entity Editor tabs** (`directory/tabs/`, registered in `index.js`):

| Tab | Lines | Note |
|---|---|---|
| `InfoTab` | 25 | renders `entitySchema`, PATCHes the `entity` block |
| `HoursTab` | 154 | `day_of_week` 0–6; uses the dedicated PUT because *"it replaces the whole week, which is what 'save hours' means to an admin"* |
| `PhotosTab` | 170 | add by URL **and** file upload — *"The legacy dashboard could only add photos by URL. The upload route exists on the API, so file upload is wired here too."* |
| `TagsTab` | 140 | **states a limitation instead of hiding it:** the API only replaces tags when the array is non-empty, so clearing every tag is not something PATCH can express — *"a 'save' that silently kept old tags would be worse"* |
| `ContentTab` | 274 | menus/drinks/HH/events/specials; reads public, writes admin |
| `CollectionsTab` | 226 | a dozen small collections with an identical route shape, declared as descriptors and rendered by one `CrudSection` |
| `SectionsTab` | 305 | `entity_sections` as a whole-collection replace; notes the missing `/gcr` segment |
| `FeaturesTab` | 65 | the boolean columns, from `FEATURE_FLAGS` |
| `PagesTab` | 129 | `entity_type` + `also_appears_on`; **uses the entity columns directly** instead of the two legacy routes that 404 |
| `AttributesTab` | 21 | mounts `AttributesPanel` — same panel as the booking section |
| `CalendarTab` | 24 | mounts `BusinessCalendarPanel` — same panel as `/booking/calendar/:slug` |

The last two are the repo's shared-component discipline in miniature: *"one
component in both places, so a business's calendar cannot look different
depending on how you reached it."*

### 10.4 Booking Platform (16) — the operator face of the universal engine

This group is the front end for `gcr-api-clean/routes/admin-platform.js` (2,224
lines) and the two engines behind it.

| Module | Lines | What it is |
|---|---|---|
| `Overview.jsx` | 173 | one `GET /platform/summary` + the integrations table |
| `Offerings.jsx` | 392 | the catalog. *"`kind` says which app it belongs to and `unit` says how it is priced, so a new product type is data, not a table."* |
| `BookingsLedger.jsx` | 359 | the one `bookings` table across every business |
| `Calendar.jsx` | 273 | **every date claim, whatever made it** — direct, manual block, Airbnb, FareHarbor, iCal, email parser. *"Seeing them side by side is how you find out why a date looks unavailable."* |
| `Promos.jsx` | 130 | `promos` redeemed at booking time — explicitly distinct from Content → Coupons |
| `Sources.jsx` | 432 | **what each business is actually attached to, measured from arrivals.** *"A business shows Peek Pro because Peek Pro emails have landed, not because it was ticked in a form."* Three actionable buckets: sending nothing (BCC never set up), arrived-but-unparsed (a parser gap), and the aggregate. |
| `CalendarFeeds.jsx` | 343 | iCal feeds. *"Between them the two paths cover the whole picture without a single API credential: emails give you WHO booked and WHAT, feeds give you WHICH DATES are gone."* Feed tied to a resource claims one unit; untied blocks the whole business. |
| `Inventory.jsx` | 301 | **`entity.daily_capacity` — "the single most consequential blank field in the system."** *"a business with no capacity on file will happily log bookings forever and never once report an opening."* |
| `Availability.jsx` | 371 | where the pipeline's three writers meet — parser, iCal, admin — with `source_platform` saying which |
| `BusinessCalendar.jsx` (65) + `BusinessCalendarPanel.jsx` (280) | | one business's month, units, feeds, and how much of the month is real rather than inferred |
| `Industries.jsx` | 80 | the index; the list comes from the API because *"hardcoding the list in the dashboard is how the nav ends up offering a page that classifies nothing"* |
| `IndustryCalendar.jsx` | 324 | **counts businesses, not seats:** on the 14th, how many charters have something open |
| `Match.jsx` | 484 | description + dates in one question. **Filter controls generated from the industry blueprint the API serves** — *"Nothing here names a field, so a field added to the blueprint becomes filterable without touching this file."* |
| `AvailabilitySearch.jsx` | 479 | *"the question the whole platform exists to answer, and no single booking system can."* Carries the coverage rule (a condo needs every night, a charter needs one day) and the assumed-vs-confirmed rule as first-class UI. |
| `AttributesPanel.jsx` | 591 | the capability tables. *"ANY business can use ANY capability. That is the whole point and it is why this screen offers all of them to everyone."* Forms built from the API's column map, backed by a build-time check in gcr-api-clean. |
| `WebsiteCalendar.jsx` | 262 | the embeddable widget. Previewed in a **sandboxed iframe** — *"the widget injects a `<style>` tag and defines globals, and running it inside the dashboard would leak both. An iframe is also the honest test."* |
| `Connections.jsx` | 490 | Composio: the catalog (`platform_connections`) and the connections (`entity_connections`) on one screen *"because they only make sense together."* When the server has no key, `/connect` answers 501 and the screen says exactly that. |

### 10.5 Content (11)

`Events` (236) and `Specials` (208) — read from the **public** router because
`admin.js` has no list route; write through admin. `Ads` (72), `Rails` (352,
carousels + pinned slots), `Coupons` (65 — *"The API has no update route for
coupons […] Editing is deliberately absent rather than shown as a button that
would fail"*), `Seo` (154), `Artists` (111), `ArtistProfiles` (148, the live song
queue), `BulkUpload` (385, CSV → 7 import routes), `BulkEvents` (181), and
`AiConfig` (214, filed under content in the nav).

### 10.6 AI Tools (4)

`AiChat` (133) — *"the legacy dashboard also called `/api/admin/ai-chat-history`
[…] That route does not exist, so history here is kept in the browser session
only — and the UI says so rather than implying conversations are saved
server-side."* `AiOrganize` (225), `RagIndex` (165), `AiSettings` (218, photo
backfill/repair/rehost). `AiConfig` (214) reads the provider list from *"the
API's own PROVIDERS constant, so the model options here are whatever the backend
actually supports rather than a list typed into the dashboard."*

### 10.7 Engagement (6)

- **`Behaviour.jsx` (171)** — the best-argued screen in the repo. *"Every number
  comes from a table the front end already fills. Nothing is modelled, estimated
  or extrapolated."* Its coverage panel is *"the point of this screen as much as
  the numbers are. Low traffic and low tracking look identical on a chart, and
  telling them apart is the difference between 'nobody visited' and 'we never
  asked'."*
- `Analytics` (154) — renders whatever scalars and collections come back *"rather
  than assuming a schema that could quietly stop matching."*
- `GcrReviews` (85) — scoped to one business, because there is no directory-wide
  review route *"rather than pretending to show everything."*
- `Customers` (30) — read-only; no write route exists.
- **`Messaging` (100) — partial, and the only section depending on a route that
  exists nowhere.** `routes/messaging.js` is present in the API but explicitly
  unmounted. *"Rather than hide the screen, it is wired to the path the legacy
  dashboard used and states plainly why it is not returning anything."*
- `Social` (207) + `charts.jsx` (72) — two SVG charts with no library.
  *"Deliberately plain […] Anything more elaborate would be a dependency and a
  build-size cost for two screens."*

### 10.8 Trip Swipe (17)

Live: `Overview` (104), `Businesses` (191), `Tourists` (255, full detail + saves
+ itinerary + preference recompute), `Analytics` (59), `AiFeedback` (80),
`ConciergeTest` (163 — impersonates a tourist via `?as_tourist=`),
`SwipeQuestions` (114), `Sponsored` (81), `TonightCards` (48), `SmsQr` (109),
`ButtonConfig` (66, read-only — no PUT exists), **`SmsBlasts` (318)**.

**`SmsBlasts` enforces preview-before-send in the UI** *"because this action
texts real people and cannot be undone."* And it names a real hazard:

> The filters below are exactly the keys `routes/admin.js` destructures. That
> matters more than it looks: the route ignores unknown keys without a word, so a
> filter named something the API doesn't read doesn't narrow the audience — **it
> quietly texts everyone who opted in.**

Partial: `Points` (61), `AuthSettings` (64), `SmsSettings` (68), `BusinessLeads`
(65), `CommunityPhotos` (138). Each names the legacy path and points at what
does work instead.

### 10.9 App Store (2)

`AppManager` (115) and `BusinessApps` (218) — the **legacy** `apps` /
`site_apps` system. The header is candid about the split:

> There is a second, separate catalogue — `platform_apps` […] which the
> owner-facing dashboard's store reads. The two are not the same table and do not
> sync. Which one should be canonical is an open decision.

That is the two-generations app-store split from the API blueprint's §8, visible
in one UI.

### 10.10 Platform (12)

- **`TextTheDashboard` (249)** — SMS Q&A over live data. *"The model never
  produces a number. It chooses which query to run and phrases the result — every
  figure in a reply came out of the database on that request."*
- **`Intake` (303)** — the submission queue plus its webhook destinations,
  deliberately on one screen: *"a queue you are not being told about is just a
  page you forget to check."* Destinations are rows, not config.
- **`People` (276)** — six sources normalised onto one shape, each failing
  independently. *"There is no single 'all people' route, because these are
  genuinely different records in different tables."*
- **`Bookings` (274)** — states plainly that there is no cross-business admin
  booking ledger: `bookings.js` is slug-scoped, rentals/services keep their own
  table, and `platform.js` is owner-scoped so an admin token cannot reach it.
  *"A true admin booking ledger needs an admin-scoped route over the platform
  engine. That is tracked and not faked here."*
- **`ApiKeys` (134) — read-only, and argued:** *"The legacy dashboard posted
  provider secrets to `/api/admin/save-api-key`, which stored them in a table an
  admin session could read back. That is strictly worse than the environment
  variables the API already uses: it turns every admin login into a path to your
  Stripe secret."* Replaced by `GET /provider-status` — booleans plus last four.
- `Businesses` (226, link-user + invite), `Leads` (64), `SalesPages` (150),
  `ArHunts` (136), `Users` (40, read-only), `Integrations` (237, partial —
  probes each integration's own endpoint), `Settings` (143 — configures the
  dashboard, not the API, and shows where every runtime value came from).

---

## 11. Styling

`src/styles/theme.css` (design tokens — the single source of colour, keyed off
`data-theme`) and `global.css`. Every component ships its own stylesheet
(`primitives.css` 441, `DataTable.css`, `Field.css`, `SchemaForm.css`,
`Modal.css`, `Tabs.css`, `Toast.css`, `MonthCalendar.css`, `chips.css`,
`AppShell.css`, `Sidebar.css`, `TopBar.css`, `EntityPicker.css`,
`SectionedItemsEditor.css`, `BusinessProfile.css`, `charts.css`, plus four
tab-specific sheets). No colour literal appears in a component.

---

## 12. Scripts (3, 723 lines) — the verification layer

### `audit-endpoints.mjs` (198) — the one that earns its keep

Checks every path this dashboard can call against the routes gcr-api-clean
actually mounts. It catches **two** classes of defect, and the second is the
reason it exists:

> 1. **NO ROUTE** — the path matches nothing. A 404 at runtime. Loud and easy.
> 2. **SHADOWED** — the path has a literal segment where every candidate route
>    has a parameter, and no route matches the literal exactly. These are the
>    dangerous ones: they do **NOT** 404. Express happily binds the literal to the
>    parameter and the call succeeds against the wrong thing. `POST
>    /api/reviews/request` matching `POST /api/reviews/:slug` would have created a
>    review against a business named "request".

Takes a path to a gcr-api-clean checkout, so it can be run against `origin/main`
and a branch and the results diffed.

### `generate-section-map.mjs` (175)

Walks each module's import graph depth-first within `src/` and collects every
`endpoints.a.b` reference — *including ones reached through a shared resource or
a shared component* — into `sectionMap.generated.json` (628 lines). *"Derived
from the source, never hand-written, so it cannot drift from what the modules
actually call."* `npm run sections:check` fails if it is stale.

### `smoke-test.mjs` (350)

The only script that touches a live API. Read-only, and **conservative about
what that means**:

> An earlier version derived the list from the registry and ended up sending GETs
> at write endpoints — harmless, but it reported "ok" for routes it had not really
> tested. Coverage is explicit now, and anything not covered is reported as such
> rather than silently counted as passing.

Reports `ok` / **`EMPTY`** (answered, but the key the dashboard reads was absent
— *"the most likely cause of a screen that renders but shows nothing"*) / failure.

---

## 13. Docs

- **`docs/ENDPOINT-STATUS.md` (420)** — the audit's written form: 117 legacy
  paths checked, 83 resolving, 34 not; how a missing route surfaces (five
  mechanisms, listed); and two things deliberately **not** rebuilt
  (`/save-api-key` and `/set-connection`). §16 records that its headline table is
  now stale.
- **`docs/DEPLOY.md` (215)** — the deployment path for the API-side branch.
- **`HANDOFF.md`** — the most important file in the repo to read first. See §16.

---

## 14. External connection map

| Service | Reached how |
|---|---|
| **gcr-api-clean** | `api/client.js` → `config.apiBaseUrl`. **The only host.** 275 paths across ~20 routers. |
| Everything else | *transitively* — Composio, Twilio, Anthropic, Supabase Storage, the email parser, the iCal cron. This dashboard holds no third-party credential of any kind, and `ApiKeys.jsx` exists specifically to keep it that way. |

**Zero third-party scripts, fonts, analytics or CDNs.**

---

## 15. Honesty ledger

**Read in full, line by line:** `App.jsx`, `main.jsx`, `config/env.js`,
`api/client.js`, `api/createResource.js`, `auth/tokenStore.js`,
`auth/AuthContext.jsx`, all five `shell/` files, `hooks/useAsync.js`,
`hooks/useResource.js`, `ui/CrudSection.jsx`, `package.json`, `vercel.json`,
`.env.example`.

**Read structurally + header-in-full for every one of the 121 JS/JSX modules:**
the module registry extracted entry by entry (all 84, with group/path/status/
lazy-target); the endpoint registry extracted group by group (all 43, 275
entries); the endpoint usage of every module extracted mechanically; and the
documentation header of every module file read verbatim — which in this codebase
is where the reasoning lives.

**Characterized by role, not read line-by-line:** the internal handler bodies of
the large screens (`BusinessProfile` 967, `Openings` 692, `AttributesPanel` 591,
`Connections` 490, `Match` 484, `AvailabilitySearch` 479, `Sources` 432) beyond
their header, endpoints and structure; `ui/DataTable`, `SchemaForm`, `Field`,
`Modal`, `Toast`, `Tabs`, `MonthCalendar`, `primitives` beyond their headers and
signatures; `resources.js`/`bookingResources.js` past the first ~110 lines (the
remainder is more of the same descriptors); all 20 stylesheets; the bodies of
the three scripts past their headers; `ENDPOINT-STATUS.md` past line 90 and
`DEPLOY.md`.

**Verified against the API, not assumed:** `admin-settings.js` (`/settings`,
`/settings/:key`, `/provider-status`, `/business-leads`, `/community-photos`,
`/gcr/category-cards`), `admin-analytics.js` (`/entity/:slug`, `/platform`,
`/health`), `business-profile.js` (`/profile/:slug`, `/profile-schema`, row
CRUD), `dashboard-sms.js` (`/ask`, `/allowlist`, `/log`), and the full
`server.js` mount map.

---

## 16. Findings

### 16.1 `HANDOFF.md` — read this before trusting any verification claim

The repo's own handoff is blunt, and it is the single most important fact about
this codebase:

> **Nothing in this repo has ever run against the real database.** Every
> verification claim made about it was against one of: a stubbed API returning
> fixed JSON, a fake Supabase query builder running the real route handlers over
> seeded rows, or the wrong database.

What *is* established: 84 sections build and lint clean, all render with no
console errors **against a stub**, no horizontal scroll at 390/820/1440, and the
endpoint audit and duplicate-route guard pass. What is not: that a single screen
works against production.

It also names two sections built on wrong assumptions — **Listing Data**
(`AttributesPanel.jsx` + the Attributes tab) and **Find a Match** (`Match.jsx`)
— both driven by `routes/capabilities.js`, which describes tables that either do
not exist on the real database or exist in a different shape:

| The dashboard expects | The real database has |
|---|---|
| `units` | `bookable_resources` — 1,055 rows |
| `vessels` with `vessel_type`, `max_passengers` | `vessels` — 37 rows, with `vessel_category`, `passenger_max`, `make_model` |
| `amenities` as a catalog + join | `amenities` / `entity_amenities` — 37 and 756 rows, `amenity` as plain text |
| `species` catalog + `entity_species` | `fish_species` — 36 rows, per-entity |

Those are the two largest booking screens (591 + 484 lines) and the two the
gcr-api-clean blueprint calls *"the most thesis-defining engines in the API."*
**This is the highest-priority item in the repo.**

### 16.2 `docs/ENDPOINT-STATUS.md` is now stale in the operator's favour

It reports 58 endpoints across 18 sections returning 404 on `origin/main`,
pending a merge of `claude/cybercheck-modular-react-dashboard-7on41c` in
gcr-api-clean. **That merge has happened.** Verified against gcr-api-clean at
`b75300c`:

| Named as missing | Now on API main |
|---|---|
| the whole capability layer `/api/admin/platform/*` | `server.js:251` → `admin-platform.js` (2,224 lines) |
| Composio `/api/admin/connections/*` | `server.js:254` → `composio.js` |
| `/api/admin/settings`, `/api/admin/provider-status` | `admin-settings.js:44,53,69,107` |
| category cards | `admin-settings.js:214–251` |
| the embed widget `/api/embed/*` | `server.js:298` → `embed.js` |

Also now live and not reflected in the doc: `/api/admin/analytics/{entity,platform,health}`
(`admin-analytics.js`), `/api/admin/gcr/profile/:slug` (`business-profile.js`),
`/api/dashboard-sms/*`, `/api/admin/intake`.

**Action:** re-run `node scripts/audit-endpoints.mjs ../gcr-api-clean` and
rewrite the "Current state" table. Several sections still carrying
`status: 'partial'` in the registry — and therefore an amber `!` and a "route not
deployed" notice — may now be fully live. That is a worse failure mode than the
original: a working screen that tells the operator it is broken.

### 16.3 Sections still genuinely partial

After the merge, these remain honest gaps:

- **Messaging** — `routes/messaging.js` exists but is unmounted in `server.js`
  with the reason *"backing tables don't exist in the live DB"*. The only
  section depending on a route that exists nowhere.
- **Site Editor** — `/gcr/site-config` never existed; category cards now do
  (`admin-settings.js:214`), so this screen is half-recoverable.
- **Points / SMS Settings / Auth Settings** — the API's answer is
  `platform_settings` keys, which `endpoints.settingsKeys` already models
  (`pointsConfig`, `smsConfig`, `authConfig`). These may be one wiring change
  from live.
- **Business Leads** — `admin-settings.js:130` now serves `/business-leads`.
  Likely already fixable.
- **Community Photos** — `admin-settings.js:163` now serves it. Same.
- **API Keys** — partial by design, not by gap. Should arguably not carry the
  `partial` flag at all, since read-only is the intended end state.
- **Integrations** — probes rather than reads; the legacy `/set-connection` was
  deliberately superseded by Composio.

### 16.4 The two app-store catalogues

`AppManager.jsx` names it: `apps`/`site_apps` (this screen) versus
`platform_apps`/`platform_connections` (what `Dashboards-users-` reads through
`/api/connections`). *"The two are not the same table and do not sync."* The
gcr-api-clean blueprint's §8 shows the same split from the API side — `apps.js`
is one of the eight commented-out routers. This dashboard is currently the only
UI for the retired generation.

### 16.5 Smaller notes

- **`auth.verify()` piggybacks on `GET /api/admin/gcr/claims?limit=1`.** It
  works, but it couples session verification to the claims table existing and
  being readable. A dedicated cheap verify route would be more robust.
- **`README.md` says "60+ section modules" and "81 routes"; the registry now
  holds 84.** Minor, but the numbers appear in three docs and disagree with each
  other (`README` 60+/81, `ENDPOINT-STATUS` 81, `HANDOFF` 81, registry 84).
- **No admin booking ledger.** `platform/Bookings.jsx` documents this precisely
  and refuses to fake it — the modern engine is owner-scoped and unreachable
  with an admin token. An admin-scoped route over `platform.js` is the missing
  piece.
- **`endpoints.unverified` still carries 11 paths**, including
  `dailyRotation{Options,Sections}` — which `update-link.js` *does* implement,
  just under `/api/update`, not `/api/admin/daily-rotation`. Worth re-checking
  whether any of the 11 now have a home under a different path.

---

## 17. What this repo is, in one paragraph

`Admin-dashboard-main` is the operator console: one admin, every business, over
275 API paths. It replaced a 23,000-line HTML file with 84 lazy-loaded sections
generated from a single registry, forms and tables generated from descriptors,
and CRUD generated from a resource factory — which is why a typical screen is
forty lines. Its distinguishing quality is not the architecture but the
honesty: a screen whose route does not exist names the path it tried, a preview
is required before a text blast goes out, an availability day that nothing has
claimed is drawn hollow rather than counted as open, provider secrets are
deliberately unreadable, and a script exists specifically to catch the route
that silently binds to the wrong parameter instead of 404ing. The two things to
fix first are both recorded in the repo's own files and neither is a code
defect: the capability-layer screens are built against a schema the live
database does not have, and the endpoint-status doc still tells operators that
eighteen sections are broken when the API has since caught up.

---

*Companion papers: `gcr-api-clean` (the API spine, §0–11 + Appendices A–S, plus
`docs/BLUEPRINT_VERIFICATION.md`); `Dashboards-users-` (`docs/BLUEPRINT.md`).
Still to write: `gcr-unified`, then the four-repo interconnection map.*
