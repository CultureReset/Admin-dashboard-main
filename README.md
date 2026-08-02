# CyberCheck Admin Dashboard

A modular React rebuild of the CyberCheck admin dashboard, wired to the
`gcr-api-clean` API.

This replaces the single 23,000-line `admin.html` in `cybercheck-login` with 60+
independent section modules, a shared UI kit, and one place that knows every API
path. Nothing in `gcr-api-clean` was changed, and nothing in `cybercheck-login`
was removed — this is a new application alongside them.

## Running it

```bash
npm install
cp .env.example .env      # set VITE_API_BASE_URL
npm run dev               # http://localhost:5173
npm run build             # production build to dist/
npm run preview           # serve the build
npm run lint
```

Sign in with an admin account from the `admin_users` table —
`POST /api/admin/login` returns the JWT the dashboard stores.

## Nothing is hardcoded

That was the point of the rebuild, so it is worth being specific about what it
means here.

**No hostnames in source.** Every environment value resolves through
`src/config/env.js`, in this order: `window.__ADMIN_CONFIG__` → `import.meta.env`
→ a documented fallback. A deployment can be repointed at a different API by
defining `window.__ADMIN_CONFIG__` in a `config.js` served next to `index.html`,
with no rebuild. Platform → Settings shows every resolved value and the variable
that set it.

**No API paths in components.** All 200+ paths live in `src/api/endpoints.js` as
functions of their parameters. A route change in `gcr-api-clean` is a one-line
edit there, not a search across sixty files.

**No hand-written navigation or routes.** `src/modules/registry.js` lists every
section once; the sidebar, the router, and the Overview page's index are all
generated from it. Adding a section is a file plus one entry.

**No hand-written forms or tables.** Fields and columns are descriptors.
The Entity Editor's Info tab is ~40 fields defined as data in
`src/modules/directory/entitySchema.js`, mirroring the real `entity` table;
`SchemaForm` renders, validates, and submits them. `DataTable` works the same
way for columns, with search, sort, and pagination built in.

**No hardcoded businesses, slugs, or IDs.** Every screen that operates on a
business gets it from `EntityPicker`, which loads the directory once and shares
the selection across sections and across reloads.

**No repeated CRUD plumbing.** `createResource` + `useResource` + `CrudSection`
turn "list, create, edit, delete" into a descriptor. That is why most section
modules are 40–80 lines and behave identically.

**No colour literals in components.** Everything routes through the design
tokens in `src/styles/theme.css`, which is also what makes the light/dark toggle
a single attribute flip.

## Layout

```
src/
├── config/env.js            runtime configuration — the only place env is read
├── api/
│   ├── endpoints.js         every API path, once
│   ├── client.js            fetch wrapper: auth, JSON, timeouts, typed errors
│   ├── createResource.js    generic CRUD factory
│   └── resources.js         resource definitions per domain
├── auth/                    token store, AuthContext, login screen
├── ui/                      DataTable, SchemaForm, Modal, Tabs, Toast, CrudSection…
├── hooks/                   useAsync, useAction, useResource, usePersistentState
├── components/              EntityPicker, ConfigCard, SectionedItemsEditor
├── lib/                     field/column helpers, content schemas, CSV parser
├── shell/                   sidebar, top bar, routing, error boundary, theme
└── modules/
    ├── registry.js          the one list of sections
    ├── home/ menu/ directory/ content/ ai/ engagement/ tripswipe/ appstore/ platform/
    └── directory/tabs/      the Entity Editor's nine tabs, themselves a registry
```

## Sections

All 62 nav entries from the legacy dashboard, in the same nine groups:

- **Overview**
- **Menu & QR** — Menu Builder, QR Menus, QR Tracker, Reviews, Referral
  Partners, Daily SMS Links, Menu Editors Hub
- **GCR Directory** — Businesses, Entity Editor, Site Editor, Claims
- **Content** — Events, Artists, Song Requests & Tips, Specials, Ad Network,
  Page Rails, AI Config, Coupons, Tags & SEO, Bulk Upload, Bulk Events
- **AI Tools** — AI Chat, AI Data Organizer, AI Index / RAG, AI Settings
- **Engagement** — Analytics, Reviews, Customers, SMS / Messaging, Social
- **Trip Swipe** — Overview, Businesses, Tourists, Swipe Analytics, AI Feedback,
  Concierge Test, Swipe Questions, Sponsored, Tonight Cards, Points & Rewards,
  Text Sign-Up QR Codes, Auth Settings, Button Config, SMS Settings, SMS Blasts,
  Business Leads, Guest Photos
- **App Store** — App Manager, Business Apps
- **Platform** — Businesses, Leads, Bookings, Sales Pages, AR Hunts,
  Integrations, Users, API Keys, Settings

The Entity Editor carries nine tabs: Info, Hours, Photos, Tags, Features,
Content (menu / drinks / happy hour / events / specials), Sections, Details (ten
per-entity collections), and Pages.

## Honest failure

Read `docs/ENDPOINT-STATUS.md` before assuming a screen is broken.

Of the 117 API paths the legacy dashboard calls, 34 have no matching route in
`gcr-api-clean`. Where a working route existed, this app uses it. Where none
does, the screen is wired to the same path the old dashboard used and **says on
screen** that the route is not deployed, naming the path — rather than showing a
form that appears to save and does not. Those sections carry an amber `!` in the
sidebar and are listed in Platform → Settings.

The API client distinguishes a missing endpoint (404/405) from a network failure
from a server error, because those need different fixes. `PATCH` responses that
return `207 { success: false }` are treated as failures, not successes — a 207
passes `response.ok` and would otherwise look like a clean save.

## Verification

`npm run build` and `npm run lint` both pass clean. All 61 routes were walked in
headless Chromium against a stubbed API: every section mounted and rendered with
zero page errors and zero console errors.

Live API calls could not be exercised from the build environment — outbound
network access is sandboxed — so request/response shapes were derived from
`gcr-api-clean`'s route handlers and `schema.sql` rather than from live traffic.
Worth a pass against the real API before relying on the less-trafficked screens.
