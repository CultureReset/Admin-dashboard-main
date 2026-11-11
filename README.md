# CyberCheck Admin

The operator console for Gulf Coast Radar and CyberCheck: one place to see and manage every business on the platform. It is a modular React app with about a hundred routed sections, a shared UI kit, and a single file that knows every API path. It talks only to [gcr-api-clean](https://github.com/CultureReset/gcr-api-clean) and holds no database key.

Production: `https://admin-dashboard-main.vercel.app`. The screen a business owner signs in to is a separate app, [Dashboards-users-](https://github.com/CultureReset/Dashboards-users-).

![Overview](docs/images/overview.png)

## What you can do with it

- **Directory.** Edit any business in the Entity Editor (info, hours, photos, tags, features, menus, sections, pages, listing data, calendar), review claims and sign-ups, and open a business's own dashboard as that business.
- **Menus and QR.** Menu builder, QR menus and scan tracking, referral partners, daily SMS update links.
- **Booking platform.** Offerings, bookings, promos, booking sources, calendar feeds, capacity, availability search and the embeddable website calendar.
- **Content.** Events, artists, song requests and tips, specials, the ad network, page rails, coupons, tags and bulk uploads.
- **AI tools, engagement and Trip Swipe.** AI settings and test chat, visitor analytics, reviews, customers, messaging, and the tourist app's cards, rewards and SMS settings.
- **Automations.** Build a trigger and steps once, test against one business, publish a version, and push it to every business or an audience. Rollouts and a run log show what happened.
- **Store.** The App Store control panel: add an item (app, module, map, parser, automation, box release, integration), publish versions, decide who gets it (free, in a plan, or granted to one business), and push it as a release, an offer, an install or a forced update, with a preview of who would receive it.
- **Ghost boxes.** A read-only fleet view: every on-site box at every business, the release it runs, and whether it is online.
- **NEXT GENT.** Paperclip screens for store publishing, the core menu, platform businesses and platform users, served through this site's `/api/paperclip` proxy.

| Store | Ghost boxes |
| --- | --- |
| ![Store: items](docs/images/store.png) | ![Ghost boxes](docs/images/ghost-boxes.png) |

## Getting started

```bash
git clone https://github.com/CultureReset/Admin-dashboard-main.git
cd Admin-dashboard-main
npm install
cp .env.example .env
npm run dev                # http://localhost:5173
```

Sign in with an admin account. The login screen calls `POST /api/admin/login` on gcr-api-clean and stores the returned token.

To work against a local API without changing any code, proxy `/api` through the dev server:

```bash
VITE_DEV_API_PROXY=http://localhost:3000 VITE_API_BASE_URL= npm run dev
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server. |
| `npm run build` | Production build into `dist/`. |
| `npm run preview` | Serve the build. |
| `npm run lint` | oxlint on `src/`. |
| `npm run audit:endpoints` | Check every path the dashboard can call against the routes gcr-api-clean actually mounts. |
| `npm run sections:map` | Regenerate `src/modules/sectionMap.generated.json`, the section-to-endpoints map behind the Sections index. |
| `npm run sections:check` | Fail if that map is out of date. |
| `npm run verify` | Lint, endpoint audit, section-map check and build. |

The endpoint audit reads a gcr-api-clean checkout. Pass its path if it is not a sibling folder:

```console
$ node scripts/audit-endpoints.mjs ../gcr-api-clean
  resolve cleanly     360
  known missing       10  (declared, surfaced in the UI)
  UNEXPECTED missing  0
  SHADOWED            0

OK — every endpoint resolves to the handler it names.
```

It fails on two kinds of defect: a path that matches no route (a 404 at runtime), and a path that is *shadowed*, where a literal segment would be bound to a route parameter and silently hit the wrong handler.

To test against the live API's behaviour instead of its source, run the read-only smoke test:

```bash
node scripts/smoke-test.mjs --base https://gcr-api-clean.vercel.app --email you@example.com --password '…'
node scripts/smoke-test.mjs --base https://gcr-api-clean.vercel.app --token <admin token> --section <id> --json
```

## Configuration

Every value resolves through `src/config/env.js`, in this order: `window.__ADMIN_CONFIG__` at runtime, then the `VITE_*` build variable, then the default. Platform → Settings shows every resolved value and where it came from.

| Runtime key | Build variable | Default |
| --- | --- | --- |
| `apiBaseUrl` | `VITE_API_BASE_URL` | `https://gcr-api-clean.vercel.app` |
| `authTokenKey` | `VITE_AUTH_TOKEN_KEY` | `cc_admin_token` (the `localStorage` key for the session) |
| `requiredRole` | `VITE_REQUIRED_ROLE` | `admin` |
| `publicSiteUrl` | `VITE_PUBLIC_SITE_URL` | none; used for claim and preview links |
| `businessDashboardUrl` | `VITE_BUSINESS_DASHBOARD_URL` | `https://dashboards-users.vercel.app` |
| `appName`, `appShortName` | `VITE_APP_NAME`, `VITE_APP_SHORT_NAME` | `CyberCheck Admin`, `CyberCheck` |
| `defaultPageSize` | `VITE_DEFAULT_PAGE_SIZE` | `50` |
| `requestTimeoutMs` | `VITE_REQUEST_TIMEOUT_MS` | `45000` |

Repoint a built deployment at another API with no rebuild by defining the runtime object before the app loads. `index.html` already initialises it to `{}`:

```html
<script>
  window.__ADMIN_CONFIG__ = { apiBaseUrl: 'https://api.example.com' };
</script>
```

On Vercel, the NEXT GENT screens also need `PAPERCLIP_SERVER_URL`, read by `api/paperclip/[...path].js`. Locally, the dev server proxies `/api/paperclip` to `PAPERCLIP_DEV_SERVER` (default `http://localhost:3100`).

## How it is built

**One list of sections.** `src/modules/registry.js` declares every section once, with its group, path, lazy-loaded component, description, whether it is hidden from the sidebar, and its status. The sidebar, the router and the Overview index are all generated from it. Adding a section is a file and one entry:

```js
{
  id: 'gcr-events',
  label: 'Events',
  icon: '📅',
  group: 'content',
  path: '/content/events',
  description: 'Events across every entity — create, edit, and remove.',
  load: () => import('./content/Events.jsx'),
},
```

Add `hidden: true` to keep a section routable but out of the sidebar, and `status: 'partial'` when it depends on a route the API does not serve.

**One list of API paths.** Every path lives in `src/api/endpoints.js` as a function of its parameters. A route change in gcr-api-clean is a one-line edit there.

**Forms and tables are data.** `SchemaForm` renders, validates and submits field descriptors; the Entity Editor's Info tab is defined in `src/modules/directory/entitySchema.js`, mirroring the `entity` table. `DataTable` does the same for columns, with search, sort and pagination. `createResource`, `useResource` and `CrudSection` turn list, create, edit and delete into a descriptor.

**No hardcoded businesses.** Every screen that works on one business gets it from `EntityPicker`, which loads the directory once and keeps the selection across sections and reloads.

**Theme tokens.** Colours come from `src/styles/theme.css`, which is what makes the light and dark toggle a single attribute flip.

### Honest failure

Where gcr-api-clean has no route for a screen, the screen is wired to the path the legacy dashboard used and says on screen that the route is not deployed, naming it, instead of showing a form that appears to save. Those sections are marked `partial` in the registry, carry an amber `!` in the sidebar, and are listed in Platform → Settings. See [`docs/ENDPOINT-STATUS.md`](docs/ENDPOINT-STATUS.md).

The API client (`src/api/client.js`) tells a missing endpoint (404 or 405) apart from a network failure and a server error, and treats a `207 { success: false }` response as a failure even though it passes `response.ok`.

## Project layout

```
src/
├── config/env.js            runtime configuration, the only place env is read
├── api/
│   ├── endpoints.js         every API path, once
│   ├── client.js            fetch wrapper: auth, JSON, timeouts, typed errors
│   ├── createResource.js    generic CRUD factory
│   └── resources.js         resource definitions per domain
├── auth/                    token store, AuthContext, login screen
├── ui/                      DataTable, SchemaForm, Modal, Tabs, Toast, CrudSection
├── hooks/                   useAsync, useAction, useResource, usePersistentState
├── components/              EntityPicker, ConfigCard, SectionedItemsEditor
├── lib/                     field and column helpers, content schemas, CSV parser
├── shell/                   sidebar, top bar, routing, error boundary, theme
└── modules/
    ├── registry.js          the one list of sections
    ├── sectionMap.generated.json
    └── home/ menu/ directory/ booking/ content/ ai/ engagement/ tripswipe/
        automations/ appstore/ store/ platform/ nextgent/
api/paperclip/               Vercel edge function forwarding /api/paperclip/* to PAPERCLIP_SERVER_URL
scripts/                     audit-endpoints, generate-section-map, smoke-test, test-form-values
docs/                        DEPLOY.md, ENDPOINT-STATUS.md, screenshots
```

## Deployment

`vercel.json` builds with `npm run build`, serves `dist/`, rewrites every non-asset, non-API path to `index.html`, and caches hashed assets for a year. [`docs/DEPLOY.md`](docs/DEPLOY.md) walks through the database SQL the screens expect, the API deployment, and a one-command check that the deployed pair works.

## Branches

The default branch carries the Store, Ghost boxes, Automations and NEXT GENT screens. `main` has two later merges that are not on the default branch yet: the Business logins screen and a `/node` proxy rewrite. Bring the two lines together before treating either as the whole app.
