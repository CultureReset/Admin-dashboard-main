# Handoff — read before trusting anything in this repo

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

- 88 sections build and lint clean
- every route renders with no console errors **against a stub**
- no horizontal scroll at 390 / 820 / 1440
- `npm run verify` passes: lint, endpoint audit, section map, build

None of that establishes that a single screen works against production.

## Sections that are known to be built on wrong assumptions

**Listing Data** (`src/modules/booking/AttributesPanel.jsx`, the Attributes
tab) and **Find a Match** (`src/modules/booking/Match.jsx`) are driven by
`routes/capabilities.js` in the API, which describes tables that either do not
exist on the real database or exist there in a different shape:

| The dashboard expects | The real database has |
|---|---|
| `units` | `bookable_resources` — 1,055 rows |
| `vessels` with `vessel_type`, `max_passengers` | `vessels` — 37 rows, with `vessel_category`, `passenger_max`, `make_model` |
| `amenities` as a catalog + join | `amenities` / `entity_amenities` — 37 and 756 rows, `amenity` as plain text |
| `species` catalog + `entity_species` | `fish_species` — 36 rows, per-entity |

These two sections need rebuilding against the real schema before they are
usable. **This is still open** — see `gcr-api-clean/HANDOFF.md` §5.1, which
also explains why the API's own `check:columns` gate cannot detect the
mismatch. Everything else in the sidebar is untested rather than known-wrong.

## Do not

- Run the eight banner-marked files in `gcr-api-clean/sql/`. (Four others there
  are fine — the banners say which.)
- Assume a section works because it renders. The stub returns whatever shape
  the component asked for.

## Endpoint status

`docs/ENDPOINT-STATUS.md` has the detail. Current state: **316 endpoints
resolve, 0 unexpected missing, 11 declared missing.** The 58-endpoint gap the
earlier version of this file described is closed.

The 11 remaining are declared, surfaced on screen, and listed in
Platform → Settings: SMS config, business leads (2), community photos (2).
SMS / Messaging is the one section whose route exists nowhere.

## Repository state

Branch `claude/admin-dashboard-repo-review-47q2vc`, committed and pushed.
React 19, Vite 8, React Router 7, no TypeScript, oxlint.
`npm run verify` = lint + endpoint audit + section-map check + build.

The endpoint audit reads `gcr-api-clean/server.js` directly, so it needs that
repo checked out alongside this one — pass its path as the first argument if it
is not at `../gcr-api-clean`.
