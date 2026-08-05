# Admin-dashboard-main — The Complete Wiring Blueprint

The CyberCheck operator console. React 19 + react-router 7, zero UI-framework
dependencies. A registry-driven rebuild of the old 23,000-line `admin.html`
(from the dead `cybercheck-login` repo) into 86 independent section modules over
one API client. It is the front end to `gcr-api-clean`'s operator surfaces —
`admin.js` and `admin-platform.js`.

**Scope, on two bases:** **135 files / 26,151 lines** of application code
(`src/**/*.{jsx,js}` — the basis used throughout this paper), or 178 files /
~30,900 lines counting stylesheets, docs and config. 86 section descriptors
across 10 nav groups. A 741-line endpoint registry carrying **275 paths in 43
groups**. 3 Node scripts, 3 docs.

**Provenance.** §0–§6 and Appendices AA–HH are the every-line teardown, read
file-by-file and banked cluster-by-cluster. §7–§10 and the findings in §12 are
added from a verification pass against `gcr-api-clean` at `b75300c` — the
registry and endpoint tables computed mechanically, the scripts and config layer
covered, and every "route not deployed" claim re-checked against the API's
actual mounts. Corrections to earlier drafts are marked ⟲.

Companion papers: `gcr-api-clean/docs/BLUEPRINT.md`,
`Dashboards-users-/docs/BLUEPRINT.md`, `gcr-unified/docs/BLUEPRINT.md`, and
`gcr-api-clean/docs/INTERCONNECTION_MAP.md`.

---

## §0 — What this repo is

**A pure client.** It touches no database; every read and write goes through
`gcr-api-clean` via one API-client module. Signs in against the API's
`admin_users` table (`POST /api/admin/login` → JWT stored client-side).

Its design law, from the README, is **"nothing hardcoded"** — and each half is
enforced somewhere:

| Claim | Enforced by |
|---|---|
| No hostnames in source | `config/env.js` — a three-tier resolution chain; Platform → Settings shows every resolved value *and the variable that set it* |
| No API paths in components | `api/endpoints.js` — 275 paths; `scripts/audit-endpoints.mjs` checks every one against the API's real routers |
| No hand-written nav or routes | `modules/registry.js` — sidebar, router and palette all generated; a duplicate-path guard throws at module load |
| No hand-written forms or tables | `SchemaForm` + `DataTable` from descriptors; `entitySchema.js` mirrors the real `entity` table |
| No hardcoded businesses or slugs | `EntityPicker` — one shared, persisted selection |
| No repeated CRUD plumbing | `createResource` + `useResource` + `CrudSection` |
| No colour literals | `styles/theme.css` tokens; the light/dark toggle is one attribute flip |

**That is why most section modules are 40–80 lines and behave identically.**

The second organising idea, and the one that gives this repo its character:
**a screen that cannot reach its route says so.** Not a spinner, not an empty
table — a named notice with the path it tried.

---

## §1 — The shell + auth (entry → session → chrome)

`main.jsx` mounts `<App/>`. `App.jsx` is a provider stack:

```
ToastProvider → AuthProvider → Gate → EntityProvider → BrowserRouter → AppShell
```

`Gate` applies the persisted theme (`useTheme`), shows a *"Checking your
session…"* block while `AuthContext` validates the stored token, renders
`<LoginPage/>` if unauthenticated, else wraps the app in `EntityProvider` (loads
the business list once, shared everywhere) → `BrowserRouter` → `AppShell`.

**`Gate` is the security boundary and it is strict: the shell never renders
until the server has confirmed the session.** `EntityProvider` sits outside the
router on purpose — the entity list is fetched once for the whole session.

### `auth/tokenStore.js` (103)

Isolated from `AuthContext` *"so the API client can read the token without
importing React."* `safeStorage()` catches the throw that private-mode Safari
and some embedded webviews raise on `localStorage` access, falling back to
module-level `memoryToken`/`memoryUser` — the session still works, it just
doesn't survive a reload.

`decodeToken()` parses a JWT payload **without verifying it**, and draws the
line precisely: *"This is only ever used for UI hints […] Authorization is
decided by the server."*

### `auth/AuthContext.jsx` (159)

Three states: `checking` → `anonymous` | `authenticated`. The guard is
reproduced from the legacy dashboard deliberately: *"a decoded-but-unverified
JWT payload can be forged client-side, so the dashboard stays hidden until an
authenticated request to the API succeeds."*

`verifyToken()` runs three cheap local checks first — no token, expired `exp`,
wrong `role` — then makes the real call (`GET /api/admin/gcr/claims?limit=1`, the
cheapest authenticated admin GET, since no dedicated verify route exists). **The
failure split matters:**

- **401/403** → sign out.
- **network/server error** → **keep the session**, stay `AUTHENTICATED`, surface
  the message. *"a flaky connection doesn't log the user out."*

Subscribes to the client's `onAuthFailure` so a rejected token logs the app out
automatically.

### The chrome

- **`shell/AppShell.jsx` (67)** — sidebar + top bar + the routed section. Routes
  are `modules.map(...)`, each wrapped in `SectionBoundary` then `Suspense`, with
  a catch-all `*` rendering an `EmptyState`. The mobile drawer closes on every
  `location.pathname` change. *"This file never needs to change when a section is
  added."*
- **`shell/Sidebar.jsx` (91)** — generated from `navigation`, grouped by
  `NAV_GROUPS`, with a live filter over label / id / description. The clever
  piece is ⟲ **`PREFIX_PATHS`**: *"'/booking' sits above '/booking/offerings'
  […] Without `end`, NavLink marks the parent active whenever a child is open and
  two items light up at once. **Derived rather than listed**, so a new group gets
  it for free."*
- **`shell/TopBar.jsx` (87)** — mobile toggle, current section title,
  **the API target shown deliberately** *"so an admin editing live data can see
  which backend they're pointed at"*, theme toggle, signed-in account.
  `useCurrentModule()` resolves the title by exact match → dynamic-segment prefix
  → longest static prefix.
- **`shell/SectionBoundary.jsx` (55)** — the per-section error boundary that
  keeps one thrown section from blanking the shell. Logs the stack to console,
  renders a calm card with the message, the first 4 stack lines, and a Retry.
  `componentDidUpdate` clears the error when `moduleId` changes, so navigating
  away recovers.
- **`shell/useTheme.js` (21)** — `data-theme` on the root, persisted through
  `usePersistentState`.

---

## §2 — The registry: structure is data (`src/modules/registry.js`, 901 lines)

The dashboard's entire structure is one list. `NAV_GROUPS` defines 10 sidebar
groups. `definitions` is ⟲ **86** section descriptors, each
`{ id, label, icon, group, path, load: ()=>import(...), description, status,
hidden }`. The sidebar, the router, and the "All Sections" index are all
generated from this one array — **adding a screen is a module file plus one
entry**, with no hand-written `<Route>` or nav item anywhere.

Two flags carry real meaning:

- **`status: 'partial'`** — ⟲ **9** sections. The screen is built but depends on
  a `gcr-api-clean` route that isn't served yet; it renders an honest "endpoint
  unavailable" state instead of failing. The nine, named exactly:
  `gcr-site-editor`, `gcr-messaging`, `tripswipe-points`, `platform-auth`,
  `sms-settings`, `business-leads`, `community-photos`, `integrations`,
  `api-keys`. **See §12.2 — most of these gaps have since closed on the API
  side.**
- **`hidden: true`** — 4 sections. Routable but absent from the sidebar: the
  `:slug` deep-link variants of the entity editor, business profile, and business
  calendar.

⟲ **The duplicate-route guard (the tail of the file)** — not previously
recorded, and the sharpest piece of engineering in the repo:

> Two sections on the same path is not a warning, it is a section that can never
> be reached: the router matches the first and the second is dead. It also
> survives every check we have — the endpoint audit looks at API paths, and the
> route walk navigates each path and finds *something* rendering. So it is
> asserted here, at module load, where it fails immediately and names both
> offenders.

Then: `modules` (with `lazy()` attached), `moduleById`, and `navigation`
(groups filtered to visible items, empty groups dropped).

### ⟲ The full registry, computed

| Group | Sections |
|---|---|
| **home** (2) | Overview `/` · All Sections `/sections` |
| **menu** (7) | Menu Builder · QR Menus · QR Tracker · Reviews · Referral Partners · Daily SMS Links · Menu Editors Hub |
| **directory** (7) | GCR Businesses · Entity Editor (+`:slug` hidden) · Business Profiles (+`:slug` hidden) · Site Editor ⚠ · Claims |
| **booking** (19) | Overview · Offerings · Bookings · Date Claims · Promos · Sources · Feeds · Inventory · Availability · Business Calendar (+`:slug` hidden) · Industries · Industry Calendar · Match · Search · Website Calendar · Openings · Connections · Attributes |
| **content** (11) | Events · Artists · Artist Profiles · Specials · Ads · Rails · AI Config · Coupons · SEO · Bulk Upload · Bulk Events |
| **ai** (4) | Chat · Organize · RAG Index · Settings |
| **engagement** (6) | Analytics · Visitor Behaviour · Reviews · Customers · Messaging ⚠ · Social |
| **tripswipe** (17) | Overview · Businesses · Tourists · Analytics · AI Feedback · Concierge Test · Questions · Sponsored · Tonight · Points ⚠ · SMS QR · Auth Settings ⚠ · Button Config · SMS Settings ⚠ · SMS Blasts · Business Leads ⚠ · Community Photos ⚠ |
| **appstore** (2) | App Manager · Business Apps |
| **platform** (12) | Text the Dashboard · Intake · Businesses · Leads · Bookings · Sales Pages · AR Hunts · Integrations ⚠ · People · Users · API Keys ⚠ · Settings |

---

## §3 — The API layer: one client, one path registry

### `api/client.js` (234) — the only place that calls `fetch`

Knows base URL (from `config/env.js`), auth header (from `tokenStore`), JSON
encode/decode, query building (drops `null`/`''`), timeouts, and error
normalization. Throws a typed `ApiError` with `status`/`path`/`body` and three
helpers:

| Getter | Means |
|---|---|
| `isMissingEndpoint` | 404/405 — an unimplemented API route |
| `isAuthError` | 401/403 |
| `isNetworkError` | status 0 (timeout or unreachable) |

`isMissingEndpoint` is what powers the whole honest-about-gaps behaviour —
`CrudSection` and `ConfigCard` both branch on it.

Exposes `onAuthFailure` (auto-logout on 401), and
**`unwrapList`/`unwrapItem`** to tolerate the API's varying envelope shapes:

> The API is not uniform — some routes return `{entities: []}`, some
> `{rails: []}`, some a bare array — so callers name the keys they expect and
> this walks them in order.

Falls back to the first array-valued property, which is what lets a resource
keep working when a route's wrapper key changes.

⟲ Two deliberate differences from `Dashboards-users-/src/lib/apiClient.js`,
which is otherwise the same file: **no token-refresh retry** (the admin JWT is
7-day and not refreshable) and **no acting-slug injection** (an admin here names
a slug per-call in the path, not via a session).

### `api/endpoints.js` (741) — every API path, once

Each entry a function of its parameters (`seg()` encodes ids/slugs), grouped by
domain. Its header maps every group to the exact `gcr-api-clean` router it hits.
Paths the legacy `admin.html` used that the API doesn't serve are marked
**UNVERIFIED** and wired exactly as the old dashboard called them, *"so they
start working the moment the API grows them."* A route change in the API is a
one-line edit here, never a search across modules.

⟲ **The full group inventory — 43 groups, 275 paths:**

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

Two structural details called out in the file itself:

- **`sections.*` has no `/gcr` segment** — those routes mount directly under
  `/api/admin`, unlike every other entity route.
- **`endpoints.unverified` (11 paths)**: `categoryPageConfig`, `entityPages`,
  `pageAssignments`, `businessData`, `messaging`, `grokChat`,
  `autoActivateTop5`, `dailyRotationOptions`, `dailyRotationSections`,
  `linkGcrAll`, `smsCampaignPreview`.

### `api/createResource.js` + `hooks/useResource.js` — the CRUD factory

A resource declares `listPath`/`createPath`/`itemPath`, the response keys that
hold the array/object, `idField`, `updateMethod`, and optional
`normalize`/`serialize`; it returns `list`/`create`/`update`/`remove` with the
fetch/unwrap/error dance handled once. `requirePath()` throws a named error
rather than calling `undefined`, so an unsupported operation fails legibly.
`save()` dispatches create-vs-update on the presence of `idField` and strips it
from the update body.

> Anything genuinely bespoke (bulk imports, AI calls, uploads) stays a plain
> function in the section module — **this factory covers the repetitive 80%**.

`api/resources.js` (321) + `api/bookingResources.js` (173) hold the ~40 concrete
definitions. `bookingResources` is kept separate *"because these all share one
filter shape — `?slug=` narrows to a business, absent means every business."*

---

## §4 — The descriptor UI kit (why modules are 40–80 lines)

Five pieces do the work; enumerated in full in **Appendix AA**.

- **`ui/CrudSection.jsx`** — a full list+create+edit+delete screen from a
  descriptor (resource + columns + formSchema), providing the toolbar, modal,
  confirm dialog, toasts, and reload-after-write identically everywhere.
- **`ui/SchemaForm.jsx`** — renders/validates/submits from a field-descriptor
  array (or `{groups}`). The Entity Editor's ~40-field Info tab is defined as data
  in `directory/entitySchema.js`, mirroring the real `entity` table.
- **`ui/DataTable.jsx`** — a table from column descriptors with search, sort and
  pagination built in.
- **`components/EntityPicker.jsx`** — the only way a business is chosen; loads
  the entity list once (`EntityProvider`), remembers the selection across
  sections and reloads (`usePersistentState('cc_admin_entity')`). **Nothing else
  in the app names a business or slug in source.**
- **`config/env.js`** — resolves every environment value through
  `window.__ADMIN_CONFIG__` → `import.meta.env` → documented fallback, **so a
  deployment repoints at a different API by dropping a `config.js` next to
  `index.html`, no rebuild.**

> These five are the whole reason the 86 sections are small and uniform:
> structure comes from the registry, paths from `endpoints.js`, data-shape from
> resources, and rendering from CrudSection/SchemaForm/DataTable, with the chosen
> business from EntityPicker.

---

## §5 — Module cluster: BOOKING (19 screens, ~5,900 lines)

The heaviest cluster, and a 1:1 front end to
`gcr-api-clean/routes/admin-platform.js` (API Appendix J) plus `email-parser`,
`availability-engine` and `embed`. Behaviour in **Appendix DD**; the endpoint
map:

`Match` (484) → `POST /platform/match` + `GET /platform/blueprint/:vertical` ·
`AttributesPanel` (591) → `/platform/listing/:slug` + `/capabilities` +
`/catalog/:name`, `PUT …/operations`, `POST …/:capability` ·
`AvailabilitySearch` (479) → `/platform/search` + `/verticals` ·
`Openings` (692) → `/platform/openings`, `PATCH /platform/deals`,
`POST /admin/sms-blast(+/preview)` · `Inventory` → `/platform/capacity` ·
`Availability` → `/platform/availability` · `Offerings` → `/platform/offerings`
+ `/prices` · `BookingsLedger` → `/platform/bookings` · `Promos` →
`/platform/promos` · `Sources` (432) → `/platform/parser/sources` + `/log` ·
`Industries` → `/platform/verticals` · `Overview` → `/platform/summary` ·
`Calendar` → `/platform/calendar` · `CalendarFeeds` → `/platform/calendars` +
`/email-parser/ical-import/run` · `BusinessCalendarPanel` →
`/platform/business-calendar/:slug` · `IndustryCalendar` →
`/platform/industry-calendar` · `WebsiteCalendar` → `/embed/availability` ·
`Connections` (490) → `/admin/connections…/connect`.

**Takeaway:** the booking module is a faithful, descriptor-driven skin over the
universal booking engine; because both the filter forms (Match) and the editor
forms (AttributesPanel) are generated from the API's capability/blueprint maps,
**the UI inherits the "capabilities not verticals" property for free** — a new
industry or column needs no dashboard change.

---

## §6 — The remaining module clusters

Every screen self-documents its endpoints in its header; all confirmed to map
onto routers from the `gcr-api-clean` paper. Behaviour in Appendices BB–HH.

- **MENU & QR (7)** → `update-link.js` + `menu-editor.js` + `qr.js` + `reviews.js`
- **GCR DIRECTORY (7)** → `gcr.js` + `business-profile.js` + business-auth claims
- **CONTENT (11)** → `admin.js` content CRUD + the import engine (`upload-processor`)
- **AI TOOLS (4)** → `admin.js` AI + `ai-provider` + `rehost-photos`
- **ENGAGEMENT (6)** → `admin-analytics.js` + `analytics.js` + meta social
- **TRIP SWIPE (17)** → `tourist.js` + `admin-tourists.js` + `sms.js` + `setup-questions.js`
- **APP STORE (2)** → `admin.js` legacy app catalog
- **PLATFORM (12)** → `admin.js` + `admin-settings.js` + `dashboard-sms.js` + `ar-hunts.js` + `intake.js`
- **HOME (2)** → Overview + Sections (the self-documenting map)

---

## §7 — ⟲ Scripts: the verification layer (3 files, 723 lines)

Previously mentioned only in passing. All three are offline; `npm run verify`
runs the first two plus lint and build.

### `scripts/audit-endpoints.mjs` (198) — the one that earns its keep

Checks every path this dashboard can call against the routes `gcr-api-clean`
actually mounts. It catches **two** classes of defect, and the second is the
reason it exists:

> 1. **NO ROUTE** — the path matches nothing. A 404 at runtime. Loud and easy.
> 2. **SHADOWED** — the path has a literal segment where every candidate route
>    has a parameter, and no route matches the literal exactly. These are the
>    dangerous ones: they do **NOT** 404. Express happily binds the literal to the
>    parameter and the call succeeds against the wrong thing. `POST
>    /api/reviews/request` matching `POST /api/reviews/:slug` would have created a
>    review against a business named "request".

Takes a path to a `gcr-api-clean` checkout, so it can be run against
`origin/main` and a branch and the results diffed. Paths in
`endpoints.unverified` are reported separately rather than failing the run.

### `scripts/generate-section-map.mjs` (175)

Walks each module's import graph depth-first within `src/` and collects every
`endpoints.a.b` reference — *including ones reached through a shared resource or
a shared component* — into `sectionMap.generated.json` (628 lines). *"Derived
from the source, never hand-written, so it cannot drift from what the modules
actually call."* `npm run sections:check` fails if it is stale.

### `scripts/smoke-test.mjs` (350)

The only script that touches a live API. Read-only, and **conservative about
what that means**:

> An earlier version derived the list from the registry and ended up sending GETs
> at write endpoints — harmless, but it reported "ok" for routes it had not really
> tested. Coverage is explicit now, and anything not covered is reported as such
> rather than silently counted as passing.

Reports `ok` / **`EMPTY`** (answered, but the key the dashboard reads was absent
— *"the most likely cause of a screen that renders but shows nothing"*) /
failure.

---

## §8 — ⟲ Build & deployment

**`package.json`** — runtime dependencies are **three**: `react`, `react-dom`,
`react-router-dom`. No UI library, no charting library, no query library, no HTTP
library.

```
verify: lint && audit:endpoints && sections:check && build
```

**`vercel.json`** — a proper SPA deployment: `rewrites` sends everything except
`/assets/` to `index.html`; `/assets/*` gets `max-age=31536000, immutable`;
`/index.html` gets `no-cache`. That pairing is what makes a hashed-asset build
safe to cache forever.

**`.env.example`** — 8 `VITE_*` variables plus one dev-only proxy, and states the
rule up front: *"Nothing in the source tree hardcodes a hostname, token,
business, or entity."*

---

## §9 — ⟲ Styling

`src/styles/theme.css` (design tokens — the single source of colour, keyed off
`data-theme`) and `global.css`. Every component ships its own stylesheet
(`primitives.css` 441, `DataTable.css`, `Field.css`, `SchemaForm.css`,
`Modal.css`, `Tabs.css`, `Toast.css`, `MonthCalendar.css`, `chips.css`,
`AppShell.css`, `Sidebar.css`, `TopBar.css`, `EntityPicker.css`,
`SectionedItemsEditor.css`, `BusinessProfile.css`, `charts.css`, plus four
tab-specific sheets). **No colour literal appears in a component.**

---

## §9b — ⟲ The stylesheets, read (27 files, 3,139 lines)

Previously listed by name only. Read in full; the result is a clean bill, and
worth recording as the contrast case.

**`src/styles/theme.css` (119)** defines **72 tokens** and handles both themes
through a three-tier cascade: `:root` (dark, *"matching the existing
dashboard"*), then `:root[data-theme='light']`, then
`@media (prefers-color-scheme: light) { :root:not([data-theme]) }` — so an
explicit choice always beats the OS preference, in both directions.

**No colliding `:root` blocks.** One file owns the tokens; nothing else opens
`:root`. Compare `gcr-unified`, where six files do and eight tokens collide
(that paper's Appendix H.1).

**36 raw hex values across every component stylesheet combined**, against 34
inside `theme.css` itself. So roughly 5% of colour escapes the token system —
against 71% in `gcr-unified`.

**One `!important` in 3,139 lines.**

The per-component sheets (`primitives.css` 441, `DataTable.css`, `Field.css`,
`SchemaForm.css`, `Modal.css`, `Tabs.css`, `Toast.css`, `MonthCalendar.css`,
`chips.css`, `AppShell.css`, `Sidebar.css`, `TopBar.css`, `EntityPicker.css`,
`SectionedItemsEditor.css`, `BusinessProfile.css`, `charts.css`, and four
tab-specific sheets) each style only their own component's namespace. The
README's claim — *"No colour literals in components. Everything routes through
the design tokens in `src/styles/theme.css`, which is also what makes the
light/dark toggle a single attribute flip"* — **holds up on inspection.**

## §10 — ⟲ Docs in this repo

- **`docs/ENDPOINT-STATUS.md` (420)** — the audit's written form: 117 legacy
  paths checked, 83 resolving, 34 not; the five mechanisms by which a missing
  route surfaces; and two things deliberately **not** rebuilt
  (`/save-api-key` and `/set-connection`). **Now stale — see §12.2.**
- **`docs/DEPLOY.md` (215)** — the deployment path for the API-side branch.
- **`HANDOFF.md`** — the most important file in the repo to read first. §12.1.

---

# EVERY-LINE PASS — Appendices

Reading the actual component code, not just headers.

## APPENDIX AA — the shared kit (`ui/` + `hooks/` + `lib/`), read line-by-line

**`ui/primitives.jsx` (187)** — `Button` (variant/size/loading, forwardRef),
`Card`, `Badge`, `Stat`, `Spinner`, `LoadingBlock`, `EmptyState`, **`ErrorState`
(renders an `ApiError` honestly: a missing endpoint says "the dashboard is wired
to this path but gcr-api-clean does not serve it yet — nothing was saved,"
distinct from a network failure or a generic error)**, `PageHeader`, `Notice`,
`Toolbar`, `SearchInput`. No colour literals — everything is a design token.

**`ui/DataTable.jsx` (229)** — the column-descriptor table: client-side search
(or external/server search via `onExternalSearchChange`), **tri-state sort
(asc→desc→none)**, pagination (`config.defaultPageSize`), **`hideOn:'narrow'` to
drop detail columns on a phone instead of side-scrolling**, `formatCell` for
null/boolean/array/object. Actions column appended by the caller.
`value(row)` separates the sort/search key from the rendered cell.

**`ui/SchemaForm.jsx` (233)** — renders/validates/submits from a field-descriptor
array or `{groups}`. **`buildInitial` seeds from defaults + the edited row and
re-seeds when the caller swaps rows (deep-compare via a JSON key)**; conditional
`visible(values)`; `validate` (required + custom + JSON parse check); `collect`
applies per-field `transform` and drops `omitWhenEmpty`; **headless mode renders
just the fields.**

**`ui/Field.jsx` (264)** — the control registry `CONTROLS`:
`text` / `email` / `url` / `tel` / `password` / `date` / `time` / `datetime` /
`color` / `number` / `textarea` / `select` / `boolean` (switch) / `tags`
(CSV↔array) / `multiselect` (chips) / `image` (URL+preview) / `json` (pretty
textarea), **plus custom `render` and `registerControl(type, component)` so a
section can add a control at runtime.** Number preserves empty-as-null *"so a
cleared optional number isn't sent as 0."*

**`ui/CrudSection.jsx` (225)** — list+create+edit+delete from a descriptor
(toolbar, modal, confirm, toasts, reload-after-write), the workhorse behind the
40–80-line modules. Preserves the id across an edit without letting it into the
form schema. Exports `ListSection` — the same thing with all three write flags
off.

**`ui/Modal.jsx` (134)** — portal dialog (Escape, backdrop close, **focus
trap + restore**, body-scroll lock) + **`useConfirm()`, an imperative awaitable
confirm used on every destructive action — "a stray click never deletes a
record."**

**`ui/Tabs.jsx` (78)** — descriptor-driven `Tabs` (with `visible(context)`) + a
standalone `TabBar`. The comment records a real bug: *hand-written strips missed
the CSS import and rendered as grey boxes, so this guarantees the styles ship
with the strip.*

**`ui/Toast.jsx` (102)** — `ToastProvider`/`useToast`; every write reports
success or failure here (danger toasts persist 8 s vs 4 s; `error()` accepts an
`ApiError` and appends its path) — **a silent failed save is structurally
impossible.**

**`ui/MonthCalendar.jsx` (185)** — the availability month grid shared by all
three calendar screens *"so they can't disagree on what a colour means"*; knows
nothing about endpoints and does no fetching. **Renders `assumed` days hollow
with the tooltip "nothing has claimed this date, open because capacity says so"
— the `availability-engine.js` rule (API Appendix K) made visible.** Plus
`MonthNav`, `monthLabel`, `shiftMonth`, `thisMonth`.

**`hooks/useAsync.js` (123)** — `useAsync` (mount fetch + reload, **race-guarded
by a `runId` so fast typing can't show a stale result**), `useAction` (one-shot
saves/deletes), `useDebounced`, `usePersistentState` (localStorage — theme,
filters, selected entity).

**`hooks/useResource.js` (107)** — binds a `createResource` resource to component
state (`rows`/`loading`/`error`/`saving`/`reload`/`save`/`remove`) with automatic
toast reporting. `params`/`query` are JSON-serialised into memo keys *"so object
literals passed inline don't retrigger every render"* — the subtle bug that would
otherwise cause an infinite fetch loop. **The reason a section is ~40 lines of
descriptor.**

**`lib/`** — `fields.jsx` (227, shared cell renderers/formatters: `formatMoney`,
dates, badges, plus the few genuinely fixed lists — days of the week, the claim
statuses the API's own enum defines), `contentSchemas.js` (135, the SchemaForm
field-schemas for the content CRUD screens, *"defined once and reused by the
global Events/Specials screens, the Entity Editor's Content tab, and the
bulk-import previews"*), `csv.js` (101, a correct quoted-field parser —
embedded commas, newlines and `""` escapes round-trip, and records spanning
physical lines survive, *"which a naive `split('\n')` would tear in half"*).

**`components/`** — `EntityPicker.jsx` (208), `ConfigCard.jsx` (123, a labelled
settings card that renders *"an explicit notice showing the path it tried,
instead of an empty form that looks editable but saves nowhere"*),
`SectionedItemsEditor.jsx` (234, a reusable sections→items editor: *"Menus,
drinks, and happy hour are the same structure […] so a fourth list of this shape
needs no new component."*).

## APPENDIX BB — MENU & QR cluster (7 files), read line-by-line

**`MenuBuilder.jsx` (121)** — food / drinks / happy-hour as a `TabBar`, each
rendered by the shared `SectionedItemsEditor` (the same component as the Entity
Editor's Content tab, **so the two can't drift**), with live item counts as tab
badges; data from `useEntityFull(slug)`, business chosen via `EntityPicker`
persisted as `cc_admin_entity`.

**`MenuEditorsHub.jsx` (153)** — lists every business with a deep link into the
standalone PIN editor (`menu-editor.js`); a **"Check" button probes `GET
/menu-editor/:slug/data` and reports how many sections loaded**; explains the PIN
is the `menu_pin` column set on the Info tab. Builds the editor URL from
`config.publicSiteUrl` — **and says so when that env var is unset.**

**`QrMenus.jsx` (169)** — the public QR menu per business (`/m/:slug`),
copy-to-clipboard link, and a preview modal that reads `GET
/menu-editor/:slug/qr-menu` (the modern slug-native QR read path from API
Appendix I) and renders sections/items with market-vs-fixed price.

**`QrTracker.jsx` (193)** — QR codes + locations as two `CrudSection`s over
`qrCodesResource`/`qrLocationsResource`, a stats-summary strip
(`/qr/stats/summary`), and a per-code scans modal (`/qr/:id/scans`).

**`ReferralPartners.jsx` (136)** — partners CRUD with commission-rate/per-scan
payout, and a per-partner performance modal (`/qr/partners/:id/stats`) that
money-formats any earnings-like key.

**`Reviews.jsx` (192)** — the public read model for one business (`/reviews/:slug`
+ `/stats`), average + star breakdown (prefers the API's breakdown, falls back to
counting loaded rows). **Its notice documents a real legacy hazard:** the old SMS
review-request flow hit `/api/reviews/request`, which **doesn't 404** — it
matches the slug route, so it would have created a review against a business
named "request". The rebuild refuses to reproduce it and points moderation to
Engagement → Reviews.

**`DailyUpdateLinks.jsx` (176)** — mint a one-time magic link
(`/update/generate`), text it to the owner (`/update/send-sms`, defaulting to the
entity's phone), copy it, and see what came in today (`/update/today`) — the
operator side of `update-link.js` (API Appendix H).

*Cluster note: every screen is the kit + a resource/endpoint; the only bespoke
logic is preview/stats modals and the honest notices about flows the API doesn't
(or shouldn't) serve.*

## APPENDIX CC — GCR DIRECTORY cluster (5 screens + 11 editor tabs + supports)

### Screens

**`Businesses.jsx` (195)** — the directory list; **filter options are built from
the data itself (a new subtype appears without a code change)**; create via
`SchemaForm(entityInfoSchema)` (POSTs `{entity: pickEntityFields(values)}`),
delete behind `useConfirm`, row-click → Entity Editor.

**`Claims.jsx` (192)** — the counterfeit-gate approval UI: `GET
/admin/gcr/claims`, `PATCH /claims/:id {status,notes}`; pending/approved/rejected
stat strip, quick Approve/Reject + a full review modal. **This is the operator
half of `business-auth.js`'s claim flow.**

**`EntityEditor.jsx` (129)** — the tabbed editor shell: **the URL slug wins over
the shared selection and keeps `EntityProvider` in sync** (so other sections open
on the same business); loads once via `useEntityRecord`, hands
`{slug, entity, record, reload, patch, saving}` to every tab; a "Reindex for AI"
button hits the RAG stub.

**`SiteEditor.jsx` (117)** — homepage hero (a `platform_settings` row under
`site_hero`, edited via `ConfigCard`) + `category_cards` CRUD + a link to Page
Rails; honestly notes the legacy site-config route doesn't exist.

**`BusinessProfile.jsx` (967)** — Appendix CC-2.

### Supports

**`useEntityRecord.js` (87)** — load+patch via `/admin/gcr/entities/:slug`.
**Handles the 207 partial-failure response** — *"a 207 passes `response.ok`, so
it explicitly checks `{success:false, errors}` so a partial write can't look like
a clean save."*

**`useEntityFull.js` (62)** — reads via `GET /api/gcr/entity/:slug` =
`buildFullEntity`, the API's single source of truth, *"because the admin router
has writes but no per-entity GET"*; **appends a cache-buster to defeat the 2-min
edge cache after a write.**

**`entitySchema.js` (272)** — the ~40-field `entityInfoSchema` mirroring the
`entity` table + `ENTITY_TYPES` = **the DB CHECK-constraint values**; one source
shared by the Info tab, the create modal, and the SEO screen.

### The 11 Entity Editor tabs (registry in `tabs/index.js`)

| Tab | Lines | Behaviour |
|---|---|---|
| `InfoTab` | 25 | `SchemaForm(entityInfoSchema)`, patches only the `entity` block |
| `SectionsTab` | 305 | `entity_sections` universal content blocks; **whole-collection-replace write model** (each edit re-sends every section — the only write the API offers); routes mounted at `/api/admin/entities/...` with **no `/gcr` segment** |
| `CollectionsTab` ("Details") | 226 | a dozen small per-entity collections declared as descriptors and rendered by **one `CrudSection` behind a `TabBar`**, because they all share an identical route shape |
| `AttributesTab` | 21 | **reuses the booking `AttributesPanel`** so listing data edits identically via profile or booking |
| `CalendarTab` | 24 | **reuses `BusinessCalendarPanel`** so the calendar is identical however reached |
| `ContentTab` | 274 | menus/drinks/happy-hour via the shared `SectionedItemsEditor` |
| `HoursTab` | 154 | `day_of_week` 0–6; uses the dedicated PUT because *"it replaces the whole week, which is what 'save hours' means to an admin"* |
| `PhotosTab` | 170 | add by URL **and** file upload — *"The legacy dashboard could only add photos by URL."* |
| `TagsTab` | 140 | **states a limitation instead of hiding it:** the API only replaces tags when the array is non-empty, so clearing every tag is not something PATCH can express — *"a 'save' that silently kept old tags would be worse"* |
| `FeaturesTab` | 65 | the boolean columns, from `FEATURE_FLAGS` |
| `PagesTab` | 129 | `entity_type` + `also_appears_on`; **uses the entity columns directly** instead of the two legacy routes that 404 |

## APPENDIX CC-2 — `BusinessProfile.jsx` (967 lines), read in full

A schema-discovery **"dashboard inside the dashboard"**: pick any business and
see exactly what its own dashboard would show — every table in the DB carrying
its `entity_slug`, grouped into sections with its own side-nav.

**Its contract, stated loudly in the header:** there is no `SECTIONS` list **and
there must never be one** — the API (`GET /admin/gcr/profile/:slug`,
`business-profile.js`, API Appendix R) discovers tables from the live schema on
every request, so a restaurant lights up Menu/Hours/Happy-Hour and a marina
lights up Slips/Bait/Vessels/Charter-trips **from the same code**; add a row to a
new table tomorrow and it becomes a section here with no deploy.

**Fully generic rendering:**

- `columnsOf`/`columnsFor` build table columns from whatever keys the rows carry,
  skipping a `DULL` set of system columns (`id`/`entity_slug`/`created_at`/…) and
  **ranking identity columns (`name`/`title`/`label`/`slug`) first**.
- `renderValue` formats any value type; `SingleRow` handles single-row sections
  (like `operations`); `fieldFor` **infers a form field type from the column
  name/value**; `splitFields` separates filled vs empty columns.
- **`RowEditor`** — a generic create/edit form for any discovered table, with an
  **"add more fields" picker that surfaces columns not yet filled**, so an
  operator can populate a column the row didn't have without a schema-specific
  form.
- **`IngestPanel`** — the AI ingest surface embedded per section: paste
  URLs/notes → `POST /admin/gcr/ingest/:slug/:table` (`ingest.js`, API Appendix
  Q) → the model proposes row values the operator can accept (**writes nothing on
  its own**).
- **`AnalyticsPane`** — a 30-day stat block
  (`/admin/gcr/analytics/entity/:slug?days=30`).

**Shell:** four `useAsync` loads — the entity list (when no slug), the profile
(discovered non-empty sections), the catalogue (`?include_empty=true`, to reveal
empty sections on demand), and stats; generic CRUD keyed by the discovered
`section.table`; and **a two-level nav** (a second in-page hamburger/drawer for
the business's own sections, *because a phone can't show the admin sidebar and
the business nav at once*).

**Why it matters:** BusinessProfile is the operator's mirror of the business
dashboard (repo #3, `Dashboards-users-`) and the purest UI expression of the
platform's "universal schema, no hardcoded industry" thesis — **the screen
literally cannot name a business type, so it can never fall out of step with the
database.**

## APPENDIX DD — BOOKING cluster (19 screens), read line-by-line

### The two generated-form screens

**`Match.jsx` (484)** — description + dates → intersect structured listing data
with availability; **filter controls generated from `GET
/platform/blueprint/:vertical`, so a new column is filterable with no code
change.**

**`AttributesPanel.jsx` (591)** — the capability editor; *"ANY business can use
ANY capability"*; forms built from the API's column map (also mounted as the
Entity Editor's Listing-Data tab). *"No jsonb, no key/value rows, no
comma-separated lists."*

### Openings / deals / bookings — the payoff of the pipeline

**`Openings.jsx` (692)** — near-term dates that still have spots; two actions from
one page: **Post a deal** (`PATCH /platform/deals` → `gcr_deals`, which the public
deals feed and Trip Swipe cards read) and **Text guests**
(`/admin/sms-blast/preview`→count, `/admin/sms-blast`→sent — SMS the tourists who
saved/swiped-right on that business and are in town). **Openings that already
have a live deal are flagged so they aren't marketed twice.** *"This is what the
whole ingestion pipeline is for."*

**`Offerings.jsx` (392)** — the booking catalog; charter/cruise/rental/condo/add-on
are all `offerings` rows (`kind` = which app, `unit` = how priced — *"a new
product type is data, not a table"*); offering CRUD + a per-offering prices
sub-editor.

**`BookingsLedger.jsx` (359)** — the cross-business ledger over the one `bookings`
table (unit is data on the row); CRUD + status transitions.

**`Promos.jsx` (130)** — `promos` (redeemed at booking time), explicitly distinct
from Content → Coupons.

### Availability + capacity + sources — where the two ingestion halves meet

**`Availability.jsx` (371)** — `business_availability`, **the one place all three
writers are visible at once** (email parser subtracts, iCal blocks, admin
hand-edits — `source_platform` says which); a null `total_capacity` = no capacity
on file, so remaining is null and the date can't be marketed.

**`Inventory.jsx` (301)** — sets `entity.daily_capacity`/`capacity_per_slot` —
**"the single most consequential blank field in the system"** (no capacity → logs
bookings forever, never reports an opening) — plus the itemised resource catalog.

**`Sources.jsx` (432)** — what each business is attached to, **derived from emails
that actually arrived**, not a form field. Three actionable buckets: businesses
sending nothing (BCC never set up at `gcr-<slug>@parse.gulfcoastradar.com`),
emails no extractor understood (a parser gap), and the aggregate.

**`AvailabilitySearch.jsx` (479)** — cross-board "what's open on the 15th
everywhere," assembled from emails + iCal *because no single platform can answer
it*; honors coverage (`all` for stays, `any` for charters) and vertical, and
flags a business showing "open" purely on capacity.

### Calendars — all reuse `MonthCalendar` so colours can't disagree

**`Calendar.jsx` (273)** — `booking_calendar`, every date claim whatever made it,
side by side (**the debugging view for "why is this date unavailable"**).

**`CalendarFeeds.jsx` (343)** — iCal feeds + the hourly
`/email-parser/ical-import/run`; a resource-tied feed claims just one unit; **the
"second way a date gets claimed."** *"emails give you WHO booked and WHAT, feeds
give you WHICH DATES are gone."*

**`BusinessCalendarPanel.jsx` (280) + `BusinessCalendar.jsx` (65)** — one
business's calendar, mounted both as the Entity Editor Calendar tab and as
`/booking/calendar/:slug` (**one component, can't diverge**); shows per-unit
months, attached feeds, and **how much of the month is real vs
inferred-from-capacity.**

**`IndustryCalendar.jsx` (324) + `Industries.jsx` (80)** — per-industry calendar
**counting businesses** ("how many charters have something open on the 14th"),
the industry list itself coming from `/platform/verticals` (never hardcoded).

**`WebsiteCalendar.jsx` (262)** — generates the two-line embed snippet and
previews the real widget in a **sandboxed iframe** — deliberate, *because the
widget injects a `<style>` tag and globals that would leak if mounted directly,
and an iframe is also the honest test.*

### Other

**`Connections.jsx` (490)** — the Composio catalog (`platform_connections`) +
per-business connections (`entity_connections`); **when the server has no Composio
key, `/connect` answers 501 and the screen says so instead of showing a failing
button.**

**`Overview.jsx` (173)** — `/platform/summary` headline counts + an integrations
table.

*Cluster note: every availability screen surfaces the exact
`availability-engine.js` semantics from API Appendix K — coverage any/all,
capacity-derived remaining, the iCal veto, and assumed/hollow days — proving the
UI and the engine share one mental model.*

## APPENDIX EE — CONTENT (11) + AI (4) clusters, read line-by-line

### CONTENT

**`Events.jsx` (236) / `Specials.jsx` (208)** — read from the public
`/gcr/events|specials` (**admin.js has no list route**), write via
`/admin/gcr/...`; `entity_slug` chosen with the shared picker (it's required on
every row). Events has a "backfill types" admin action.

**`Ads.jsx` (72) / `Coupons.jsx` (65) / `Artists.jsx` (111)** — `CrudSection` over
resources. **Coupons deliberately omits an edit button because the API has only
create/delete** — *"editing is absent rather than shown as a button that would
fail."*

**`ArtistProfiles.jsx` (148)** — live-music song-request queue management
(`/artists/:slug/queue` + `PATCH .../:id`).

**`Rails.jsx` (352)** — the homepage/curated-page carousels: `page_rails` +
`page_rail_items` CRUD, **manual (pin businesses) and algorithmic (self-filling)
rails**, per public page. The live curation mechanism SiteEditor points to.

**`Seo.jsx` (154)** — per-entity SEO fields via the entity PATCH, plus a
directory-wide "which listings are missing search-critical fields" view.

**`BulkUpload.jsx` (385)** — CSV parsed in the browser (`lib/csv.js`), previewed,
then each row POSTed to the right import route; **target descriptors own the
body-shape mapping** for `import-entity|master|menu|events|specials|photos|
gcr-items` (the `upload-processor.js` front end).

**`BulkEvents.jsx` (181)** — CSV/paste → preview → one `import-events` request.

### AI

**`AiChat.jsx` (133)** — RAG Q&A: `POST /admin/gcr/ask {question}→{answer,sources}`;
**transcript kept browser-only and the UI says so** (the legacy
`/admin/ai-chat-history` route doesn't exist).

**`AiOrganize.jsx` (225)** — two "get a blob of text into the database" flows:
`/admin/ai-organize` and `parse-raw-data` → `save-parsed-items`.

**`AiConfig.jsx` (214)** — per-task provider/model routing; **model options come
from the API's own `PROVIDERS` constant, not a hardcoded list.**

**`AiSettings.jsx` (218)** — provider registry + photo repair/rehost/backfill.

**`RagIndex.jsx` (165)** — `/admin/rag-status` + `reindex/:slug`, surfacing
`chunks_indexed` (**the RAG reindex the API paper flagged as a stub returning
0**).

## APPENDIX FF — ENGAGEMENT (6) + APP STORE (2) + HOME (2) + SHELL (4)

### ENGAGEMENT

**`Analytics.jsx` (154)** — renders whatever scalar counters and row collections
come back *"rather than assuming a fixed shape that could silently stop
matching."*

**`Behaviour.jsx` (171)** — platform-wide visitor behaviour, every number from a
table the front end already fills (*"nothing modelled, estimated, or
extrapolated"*); **its coverage panel exists to distinguish low traffic from low
tracking, which look identical on a chart** — *"the difference between 'nobody
visited' and 'we never asked'."*

**`Customers.jsx` (30)** — read-only (no write route exists).

**`GcrReviews.jsx` (85)** — per-entity review moderation; scopes to one business
because there's no directory-wide review route (the write/moderation counterpart
to `menu/Reviews.jsx`'s public read).

**`Messaging.jsx` (100)** — wired to the legacy `/admin/gcr/messaging/:slug` path,
**which is unmounted in `server.js`** (its tables aren't in the live DB); shown
with an honest "unavailable" state rather than hidden.

**`Social.jsx` (207)** + `charts.jsx` (73) — `social_posts` CRUD + `/scrape`
turning Meta posts into home-feed cards. The charts are two SVGs with no library:
*"Anything more elaborate would be a dependency and a build-size cost for two
screens."*

### APP STORE

**`AppManager.jsx` (115)** — the `apps` table CRUD. **Documents a real
divergence:** the owner-facing dashboard's store reads a separate
`platform_apps` table; *"the two catalogs are different tables and do not sync"*
— an open "which is canonical" question.

**`BusinessApps.jsx` (218)** — which apps each business has installed.

### HOME

**`Overview.jsx` (189)** — the landing screen; real counters, **each tile failing
independently so one slow/missing route doesn't blank the page.**

**`Sections.jsx` (293)** — **the self-documenting map.** The section list comes
from `registry.js`; the endpoints each section calls come from
`sectionMap.generated.json` (produced by `generate-section-map.mjs` walking the
real import graph); then it **live-probes each route**. *"The dashboard documents
and tests itself."*

### SHELL CHROME

All generated from the registry, so adding a section changes none of them —
`AppShell` (67), `Sidebar` (91), `TopBar` (87), `SectionBoundary` (55). Detail in
§1.

## APPENDIX GG — PLATFORM cluster (12 screens), read line-by-line

**`Businesses.jsx` (226)** — CyberCheck business accounts and their links to GCR
listings: `/admin/businesses`, `/admin/link-user` (GET/POST/DELETE — **the
owner-link "Assign" flow**), `/admin/invite-business`.

**`People.jsx` (276)** — a unified index of every human the platform knows,
**because there's no single "all people" route**: loads six sources in parallel
from different tables, normalizes them to one shape, and filters by kind. **Each
source fails independently.**

**`Users.jsx` (40)** — read-only (no admin write route).

**`ApiKeys.jsx` (134)** — **read-only, deliberately, on security grounds.** The
header explains the legacy `/admin/save-api-key` stored provider secrets in a
table an admin session could read back — *"strictly worse than the env vars the
API already uses; it turns every admin login into a path to your Stripe secret."*
So this only shows `/admin/provider-status` (booleans + last four). **A genuine
security-posture improvement.**

**`ArHunts.jsx` (136)** — AR scavenger hunts CRUD + captures + redeem.

**`Bookings.jsx` (274)** — **documents the four-booking-systems fragmentation
honestly**: no cross-business list exists; `bookings.js` is slug-scoped over
`entity_availability`, rentals/services keep their own `booking_events`, and the
canonical `platform.js` engine is owner-scoped **so an admin token can't reach
it** — the screen shows only what's genuinely reachable. *"A true admin booking
ledger needs an admin-scoped route over the platform engine. That is tracked and
not faked here."*

**`Intake.jsx` (303)** — the link-handover queue: a business submits
site/Google/booking/socials → a request is created → every `webhook_endpoints`
fires (`webhook_deliveries`) → the operator opens one, jumps to the profile, runs
extraction, marks done. **The webhook half is on this screen deliberately:** *"a
queue you are not being told about is just a page you forget to check."*

**`Integrations.jsx` (237)** — probes each integration router's real availability
(the legacy `/admin/set-connection` is gone) and is honest that credentials live
in the server's environment.

**`Leads.jsx` (64)** — sales-leads CRUD. **`SalesPages.jsx` (150)** — per-listing
pages built from the entity list + `/admin/invite-business`.

**`Settings.jsx` (143)** — configures the dashboard itself, not the API; **shows
exactly where every runtime value resolves from** (the `env.js` chain — the point
of the config layer).

**`TextTheDashboard.jsx` (249)** — the owner-texts-a-question AI. **The rule its
header states:** *"The model never produces a number. It chooses which query to
run and phrases the result — every figure in a reply came out of the database on
that request."* Asked something no tool covers, it is required to say so rather
than estimate.

## APPENDIX HH — TRIP SWIPE cluster (17 screens), read line-by-line

**`Overview.jsx` (104)** — headline numbers + shortcuts.
**`Businesses.jsx` (191)** — per-entity Trip Swipe settings.
**`Tourists.jsx` (255)** — the tourist admin: list, detail with saves + itinerary,
preferences, recompute-preferences, delete.

**`ConciergeTest.jsx` (163)** — the modern-concierge test harness: `POST
/tourist/ai-chat?as_tourist=<id>` lets an admin ask the concierge **as a specific
tourist** so recommendations reflect that person's saved preferences (the
operator's window into `tourist.js`'s modern AI, API Appendix F).

**`SwipeQuestions.jsx` (114)** — onboarding questions CRUD + reorder.

**`SmsBlasts.jsx` (318)** — **preview-before-send enforced in the UI** (the send
button stays disabled until `/preview` returns an audience count) *"because this
action texts real people and cannot be undone."* And it names a real hazard:

> The filters below are exactly the keys `routes/admin.js` destructures. That
> matters more than it looks: the route ignores unknown keys without a word, so a
> filter named something the API doesn't read doesn't narrow the audience — **it
> quietly texts everyone who opted in.**

**`SmsQr.jsx` (109)** · **`Sponsored.jsx` (81)** · **`TonightCards.jsx` (48)** ·
**`Analytics.jsx` (59)** · **`ButtonConfig.jsx` (66)** — read-only, no PUT route.

**The honest "partial" screens** (wired to the path the legacy dashboard used,
reporting the gap rather than faking data): `CommunityPhotos`, `Points`,
`BusinessLeads` (points to the working Platform → Leads), `AuthSettings` (notes
`tourist-auth` handles sign-in), `SmsSettings` (notes `/sms/send` + blasts work),
and `AiFeedback` (**no feedback route — composes the analytics payload + RAG
status instead of implying a feedback log exists**).

---

## §11 — What the every-line read established

1. **The kit enforces honesty structurally** — `ErrorState`/toasts distinguish
   "the API doesn't serve this yet" from real failures; a silent failed save is
   impossible; `MonthCalendar` renders assumed days hollow, carrying the
   availability-engine "a blank ≠ full" rule into the UI.
2. **One component per concept, reused everywhere** — `AttributesPanel` and
   `BusinessCalendarPanel` appear both as booking pages and Entity Editor tabs;
   `SectionedItemsEditor` backs both MenuBuilder and the Content tab — **so a
   business's data can't look different depending on the route taken.**
3. **The dashboard refuses to lie** — Coupons hides an edit button the API can't
   back; `Reviews.jsx` refuses the legacy `/reviews/request` flow that would
   create a review against a business named "request"; `ApiKeys` is read-only on
   purpose; 9 screens degrade to an explicit "endpoint unavailable."
4. **Schema-discovery all the way down** — `BusinessProfile` has no section list
   and forbids one; filter lists (Businesses, Sources, Industries) come from the
   data/API, not constants.
5. **Open threads it surfaced** — two non-syncing app catalogs; the
   four-booking-systems fragmentation visible from Platform → Bookings; the RAG
   reindex is a stub.

---

## §12 — ⟲ Findings added by the verification pass

### 12.1 `HANDOFF.md` — read this before trusting any verification claim

> **Nothing in this repo has ever run against the real database.** Every
> verification claim made about it was against one of: a stubbed API returning
> fixed JSON, a fake Supabase query builder running the real route handlers over
> seeded rows, or the wrong database.

What *is* established: 86 sections build and lint clean, all render with no
console errors **against a stub**, no horizontal scroll at 390/820/1440, and the
endpoint audit and duplicate-route guard pass. What is not: that a single screen
works against production.

It also names **two sections built on wrong assumptions** — **Listing Data**
(`AttributesPanel.jsx` + the Attributes tab) and **Find a Match** (`Match.jsx`),
both driven by `routes/capabilities.js`, which describes tables that either do
not exist on the real database or exist in a different shape:

| The dashboard expects | The real database has |
|---|---|
| `units` | `bookable_resources` — 1,055 rows |
| `vessels` with `vessel_type`, `max_passengers` | `vessels` — 37 rows, with `vessel_category`, `passenger_max`, `make_model` |
| `amenities` as a catalog + join | `amenities` / `entity_amenities` — 37 and 756 rows, `amenity` as plain text |
| `species` catalog + `entity_species` | `fish_species` — 36 rows, per-entity |

Those are the two screens Appendix DD calls the cluster's signature work, and the
two the API paper calls *"the most thesis-defining engines."*
**`scripts/check-capability-columns.mjs` in `gcr-api-clean` checks
`capabilities.js` against `sql/capability_tables.sql` — not against the live
database — which is why the build passes.** Highest-priority item in the repo.

### 12.2 `docs/ENDPOINT-STATUS.md` is now stale in the operator's favour

It reports 58 endpoints across 18 sections returning 404 on `origin/main`,
pending a merge of `claude/cybercheck-modular-react-dashboard-7on41c` in
`gcr-api-clean`. **That merge has happened.** Verified route by route at
`b75300c`:

| Named as missing | Now on API main |
|---|---|
| the capability layer `/api/admin/platform/*` | `server.js:251` → `admin-platform.js` (2,224 lines) |
| Composio `/api/admin/connections/*` | `server.js:254` → `composio.js` |
| `/api/admin/settings`, `/api/admin/provider-status` | `admin-settings.js:44,53,69,107` |
| category cards | `admin-settings.js:214–251` |
| the embed widget `/api/embed/*` | `server.js:298` → `embed.js` |

Also now live and not reflected: `/api/admin/analytics/{entity,platform,health}`,
`/api/admin/gcr/profile/:slug`, `/api/dashboard-sms/*`, `/api/admin/intake`.

**Consequence:** sections still carrying `status: 'partial'` show an amber `!`
and a "route not deployed" notice **on screens that now work**. That is a worse
failure mode than the original gap — a working screen telling the operator it is
broken.

**Fix:** `node scripts/audit-endpoints.mjs ../gcr-api-clean`, then clear the
stale flags.

### 12.3 Which of the nine `partial` flags are still true

| Section | Verdict |
|---|---|
| **Messaging** | **still true** — `routes/messaging.js` exists but is unmounted with the reason *"backing tables don't exist in the live DB"*. The only section depending on a route that exists nowhere. |
| Site Editor | **half-recoverable** — `/gcr/site-config` never existed; category cards now do (`admin-settings.js:214`) |
| Points · SMS Settings · Auth Settings | **likely fixable now** — the API's answer is `platform_settings` keys, which `endpoints.settingsKeys` already models (`pointsConfig`, `smsConfig`, `authConfig`) |
| Business Leads | **now served** — `admin-settings.js:130` |
| Community Photos | **now served** — `admin-settings.js:163` |
| API Keys | **partial by design, not by gap** — read-only is the intended end state; arguably shouldn't carry the flag |
| Integrations | probes rather than reads; the legacy `/set-connection` was deliberately superseded by Composio |

### 12.4 Smaller notes

- **`auth.verify()` piggybacks on `GET /api/admin/gcr/claims?limit=1`.** It
  works, but couples session verification to the claims table existing and being
  readable. A dedicated cheap verify route would be more robust.
- **The doc counts disagree with each other and with the code.** `README` says
  "60+ modules"; `ENDPOINT-STATUS` and `HANDOFF` say 81 sections; the registry
  holds **86**. ⟲ Earlier drafts of this paper said 84/8 — both wrong; the
  measured values are **86 descriptors, 9 partial, 4 hidden**.
- **No admin booking ledger** (Appendix GG) — the modern engine is owner-scoped
  and unreachable with an admin token. An admin-scoped route over `platform.js`
  is the missing piece.
- **`endpoints.unverified` still carries 11 paths**, including
  `dailyRotation{Options,Sections}` — which `update-link.js` *does* implement,
  just under `/api/update`, not `/api/admin/daily-rotation`. Worth re-checking
  whether any of the 11 now have a home under a different path.
- **Cross-repo:** `AppStoreView.jsx` + `.css` in `src/components/` is **literally
  the same file** as `Dashboards-users-/src/components/AppStoreView.jsx` — two
  copies, no sync mechanism. See `INTERCONNECTION_MAP.md` §4.

---

## What this repo is, in one paragraph

`Admin-dashboard-main` is the operator console — a pure React client, no
database, that talks only to `gcr-api-clean`. Its defining trait is that **its
own structure is data**: one registry generates the nav/router/palette, one
endpoints file holds all 275 API paths, one resource factory +
CrudSection/SchemaForm/DataTable render every list/form/table from descriptors,
and one EntityPicker is the only place a business is chosen — so 86 screens stay
40–80 lines and behave identically, and a screen that outruns the API degrades to
an honest "endpoint unavailable" instead of breaking. It is the human control
surface for everything the API paper described: the universal booking engine
(booking → `admin-platform.js`, forms auto-generated from the capability/blueprint
maps so new industries need no UI change), the directory + counterfeit-gate
approvals (directory → `business-profile.js` + claims), content + bulk import
(content → `upload-processor`), the AI tools, the tourist product including a live
concierge test harness, and platform ops including owner-link minting and the
text-the-dashboard AI. **The two things to fix first are both recorded in the
repo's own files and neither is a code defect:** the capability-layer screens are
built against a schema the live database does not have, and the endpoint-status
doc still tells operators that eighteen sections are broken when the API has
since caught up.
