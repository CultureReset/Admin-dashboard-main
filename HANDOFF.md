# Handoff — read before trusting anything in this repo

> **Status, 2026-11-02 (commit a7add43).** Nothing in this repo has been verified
> against production. What was run on this date, offline: `npm run lint` (passes),
> `npm run audit:endpoints` against gcr-api-clean `main` (passes; it reads route
> source and sends no request), `npm run build` (passes). `npm run sections:check`
> **fails** until `npm run sections:map` is run, so `npm run verify` is red as
> committed.

The full account is in **`gcr-api-clean/HANDOFF.md`**. This file covers what it
means for the dashboard.

## The short version

A schema migration was applied to the **wrong Supabase project**. That project
has been fully reverted and verified clean. **The real database
(`cyber check` / `mkepugvdlktfsossumox`) was never written to** — only read.

No data was lost anywhere.

## What that means here

**Nothing in this repo has ever run against the real database.** Every
verification claim made about it was against one of:

- a stubbed API returning fixed JSON,
- a fake Supabase query builder running the real route handlers over seeded
  rows, or
- the wrong database.

So the following are true, and are also the *limit* of what is known:

- the 101 routes in `src/modules/registry.js` (95 in the sidebar, 6 hidden) build, and lint reports no errors
- an earlier pass rendered 61 routes with no console errors **against a stub**; it predates the current registry and has not been repeated
- no horizontal scroll at 390 / 820 / 1440
- the endpoint audit and the duplicate-route guard pass

None of that establishes that a single screen works against production.

## Sections that are known to be built on wrong assumptions

**Listing Data** (`src/modules/booking/AttributesPanel.jsx`, the Attributes tab)
and **Find a Match** (`src/modules/booking/Match.jsx`) are driven by
`routes/capabilities.js` in the API, which describes tables that either do not
exist on the real database or exist there in a different shape:

| The dashboard expects | The real database has |
|---|---|
| `units` | `bookable_resources` — 1,055 rows |
| `vessels` with `vessel_type`, `max_passengers` | `vessels` — 37 rows, with `vessel_category`, `passenger_max`, `make_model` |
| `amenities` as a catalog + join | `amenities` / `entity_amenities` — 37 and 756 rows, `amenity` as plain text |
| `species` catalog + `entity_species` | `fish_species` — 36 rows, per-entity |

These two sections need rebuilding against the real schema before they are
usable. Everything else in the sidebar is untested rather than known-wrong.

## Do not

- Run the files in `gcr-api-clean/sql/` that carry the DO NOT RUN banner (nine at the
  top level on its `main`, including every file `docs/DEPLOY.md` names). Check each
  file's header and the live database first.
- Assume a section works because it renders. The stub returns whatever shape
  the component asked for.

## Repository state

Branch `claude/cybercheck-modular-react-dashboard-7on41c`, committed and pushed.
React 19, Vite 8, React Router 7, no TypeScript, oxlint. `npm run verify` =
lint + endpoint audit + section-map check + build (all offline).
