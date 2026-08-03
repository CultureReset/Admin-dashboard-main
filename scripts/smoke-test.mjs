#!/usr/bin/env node
/**
 * Live smoke test.
 *
 * Everything else in this repo checks the dashboard against the API's *source*.
 * This checks it against the API's *behaviour* — the thing no amount of reading
 * route handlers can tell you.
 *
 *   node scripts/smoke-test.mjs --base https://gcr-api-clean.vercel.app \
 *                               --email you@example.com --password '…'
 *
 *   # or skip the login and pass a token you already have
 *   node scripts/smoke-test.mjs --base … --token eyJ…
 *
 * Options:
 *   --section <id>   only test one section (ids from the Sections screen)
 *   --json           machine-readable output
 *   --timeout <ms>   per-request timeout, default 20000
 *
 * It is READ-ONLY, and deliberately conservative about what that means: it
 * probes ONLY the endpoints listed in EXPECTED_KEYS / READ_ONLY below. An
 * earlier version derived the list from the registry and ended up sending GETs
 * at write endpoints — harmless, but it reported "ok" for routes it had not
 * really tested. Coverage is explicit now, and anything not covered is
 * reported as such rather than silently counted as passing.
 *
 * For each one it reports:
 *   ok        answered 2xx
 *   EMPTY     answered, but the key the dashboard reads was absent — the most
 *             likely cause of a screen that renders but shows nothing
 *   404       no such route
 *   401/403   the token was rejected
 *   error     anything else
 *
 * Exit code is non-zero if any endpoint fails, so CI can run it.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/* ── arguments ───────────────────────────────────────────────────────── */

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const BASE = String(arg('base', process.env.VITE_API_BASE_URL || '')).replace(/\/+$/, '');
const TIMEOUT = Number(arg('timeout', 20000));
const ONLY = arg('section');
const AS_JSON = Boolean(arg('json', false));

if (!BASE) {
  console.error('Pass --base <api-url>, or set VITE_API_BASE_URL.');
  process.exit(2);
}

/* ── what the dashboard expects back ─────────────────────────────────── */
//
// Endpoint key → the response property each section reads. If the call
// succeeds but this key is missing, the screen renders empty and looks broken
// for a reason no status code would reveal. That is exactly the class of bug
// a source-level check cannot find, so it is the point of this script.

const EXPECTED_KEYS = {
  'entities.list': 'entities',
  'entities.publicList': 'entities',
  'claims.list': 'claims',
  'events.list': 'events',
  'specials.list': 'specials',
  'ads.list': 'ads',
  'rails.list': 'rails',
  'coupons.list': 'coupons',
  'artists.list': 'artists',
  'artists.publicList': 'artists',
  'customers.list': 'customers',
  'tourists.list': 'tourists',
  'socialPosts.list': 'posts',
  'setupQuestions.list': 'questions',
  'sms.blasts': 'blasts',
  'sms.qrCodes': 'qr_codes',
  'apps.list': 'apps',
  'businesses.list': 'businesses',
  'auth.users': 'users',
  'leads.salesLeads': 'leads',
  'leads.businessLeads': 'leads',
  'arHunts.list': 'hunts',
  'qr.list': 'qr_codes',
  'qr.partners': 'partners',
  'qr.locations': 'locations',
  'tripswipe.sponsored': 'sponsored',
  'tripswipe.promoCards': 'cards',
  'tripswipe.settings': 'settings',
  'photos.community': 'photos',
  'ai.config': 'configs',
  'bookingPlatform.bookings': 'bookings',
  'bookingPlatform.offerings': 'offerings',
  'bookingPlatform.calendar': 'entries',
  'bookingPlatform.promos': 'promos',
  'bookingPlatform.waivers': 'waivers',
  'bookingPlatform.integrations': 'integrations',
  'bookingPlatform.parserSources': 'sources',
  'bookingPlatform.parserLog': 'logs',
  'bookingPlatform.capacity': 'businesses',
  'bookingPlatform.availability': 'availability',
  'bookingPlatform.openings': 'openings',
  'bookingPlatform.icalFeeds': 'calendars',
  'bookingPlatform.deals': 'deals',
  'bookingPlatform.search': 'results',
  'bookingPlatform.industryCalendar': 'days',
  'connections.list': 'connections',
  'connections.catalog': 'tools',
  'categoryCards.list': 'cards',
  'settings.providerStatus': 'providers',
};

/**
 * Read endpoints with no wrapper key — the response is the payload itself, so
 * a 2xx is the whole check.
 */
const READ_ONLY = new Set([
  'analytics.gcr',
  'analytics.platform',
  'analytics.tripswipe',
  'analytics.stats',
  'ai.ragStatus',
  'ai.providers',
  'bookingPlatform.summary',
  'bookingPlatform.offeringMeta',
  'bookingPlatform.parserPlatforms',
  'bookingPlatform.verticals',
  'connections.status',
  'photos.repairStatus',
  'qr.statsSummary',
  'reviews.stats',
  'tripswipe.buttonConfig',
  'settings.all',
  'updateLinks.today',
]);

/**
 * Endpoints that answer 400 without a query parameter, and the one to send.
 *
 * Without this the search route reports as a failure on every run — which is
 * worse than not covering it, because a harness that cries wolf gets ignored.
 */
const QUERY = {
  'bookingPlatform.industryCalendar': () => '?vertical=charter',
  'bookingPlatform.search': () => {
    const today = new Date().toISOString().slice(0, 10);
    return `?from=${today}&to=${today}&limit=50`;
  },
};

/* ── load the registry and the section map ───────────────────────────── */

const { endpoints } = await import(pathToFileURL(join(here, '..', 'src', 'api', 'endpoints.js')).href);
const sectionMap = JSON.parse(
  readFileSync(join(here, '..', 'src', 'modules', 'sectionMap.generated.json'), 'utf8'),
).sections;

const registry = readFileSync(join(here, '..', 'src', 'modules', 'registry.js'), 'utf8');
const sectionLabels = {};
for (const block of registry.split(/\n\s*\{\n/).slice(1)) {
  const id = block.match(/^\s*id:\s*'([^']+)'/m)?.[1];
  const label = block.match(/^\s*label:\s*'([^']+)'/m)?.[1];
  if (id) sectionLabels[id] = label || id;
}

/** Which sections use an endpoint, so a failure names the screens it breaks. */
const usedBy = {};
for (const [section, keys] of Object.entries(sectionMap)) {
  for (const key of keys) (usedBy[key] ||= []).push(section);
}

/** Resolve a key to a path, but only if it needs no parameters. */
function pathFor(key) {
  const [group, name] = key.split('.');
  const builder = endpoints?.[group]?.[name];
  if (typeof builder !== 'function') return null;
  let path;
  try {
    path = builder();
  } catch {
    return null;
  }
  if (typeof path !== 'string') return null;
  // A builder that needs an id yields "undefined" or an empty segment.
  if (path.includes('undefined') || /\/\/|\/$/.test(path.split('?')[0])) return null;
  return path;
}

/* ── auth ────────────────────────────────────────────────────────────── */

async function signIn() {
  const token = arg('token');
  if (token && token !== true) return token;

  const email = arg('email', process.env.ADMIN_EMAIL);
  const password = arg('password', process.env.ADMIN_PASSWORD);
  if (!email || !password) {
    console.error('Pass --token, or --email and --password (or set ADMIN_EMAIL / ADMIN_PASSWORD).');
    process.exit(2);
  }

  const response = await fetch(`${BASE}${endpoints.auth.login()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.token) {
    console.error(`Login failed (${response.status}): ${body?.error || 'no token returned'}`);
    process.exit(1);
  }
  if (body.admin?.role && body.admin.role !== 'admin') {
    console.error(`Signed in, but role is "${body.admin.role}" — these routes need admin.`);
    process.exit(1);
  }
  return body.token;
}

/* ── run ─────────────────────────────────────────────────────────────── */

const token = await signIn();

const covered = new Set([...Object.keys(EXPECTED_KEYS), ...READ_ONLY]);

const targets = [];
const skipped = [];
for (const key of Object.keys(usedBy).sort()) {
  if (ONLY && !usedBy[key].includes(ONLY)) continue;
  if (!covered.has(key)) { skipped.push(key); continue; }
  const path = pathFor(key);
  // A read endpoint that still needs an id can't be probed blind.
  if (!path) { skipped.push(key); continue; }
  const query = QUERY[key] ? QUERY[key]() : '';
  targets.push({ key, path: path + query, sections: usedBy[key] });
}

async function probe({ key, path, sections }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  const started = Date.now();
  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    const ms = Date.now() - started;
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* not JSON */
    }

    if (!response.ok) {
      return {
        key, path, sections, ms,
        state: String(response.status),
        detail: body?.error || text.slice(0, 120),
      };
    }

    const expected = EXPECTED_KEYS[key];
    if (expected && body && typeof body === 'object' && !Array.isArray(body)) {
      if (!(expected in body)) {
        return {
          key, path, sections, ms,
          state: 'EMPTY',
          detail: `expected "${expected}", got: ${Object.keys(body).slice(0, 6).join(', ') || 'no keys'}`,
        };
      }
      const value = body[expected];
      return {
        key, path, sections, ms,
        state: 'ok',
        detail: Array.isArray(value) ? `${value.length} rows` : typeof value,
      };
    }
    return { key, path, sections, ms, state: 'ok', detail: Array.isArray(body) ? `${body.length} rows` : 'ok' };
  } catch (err) {
    return {
      key, path, sections, ms: Date.now() - started,
      state: 'error',
      detail: err.name === 'AbortError' ? `timed out after ${TIMEOUT}ms` : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Modest concurrency — this points at production.
const results = [];
const queue = [...targets];
await Promise.all(
  Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) results.push(await probe(queue.shift()));
  }),
);
results.sort((a, b) => a.key.localeCompare(b.key));

const ok = results.filter((r) => r.state === 'ok');
const empty = results.filter((r) => r.state === 'EMPTY');
const failed = results.filter((r) => r.state !== 'ok' && r.state !== 'EMPTY');

if (AS_JSON) {
  console.log(JSON.stringify({ base: BASE, results, skipped }, null, 2));
} else {
  console.log(`\nAPI: ${BASE}`);
  console.log(`Tested ${results.length} read endpoints\n`);
  for (const r of results) {
    const mark = r.state === 'ok' ? '  ok  ' : r.state === 'EMPTY' ? ' EMPTY' : ` ${r.state.padEnd(5)}`;
    console.log(`${mark} ${r.key.padEnd(32)} ${String(r.ms).padStart(5)}ms  ${r.detail}`);
  }

  if (empty.length) {
    console.log('\nRESPONDED BUT THE EXPECTED KEY WAS MISSING:');
    console.log('(these screens will render empty and look broken)');
    for (const r of empty) {
      console.log(`  ${r.key}  →  ${r.detail}`);
      console.log(`     breaks: ${r.sections.map((s) => sectionLabels[s] || s).join(', ')}`);
    }
  }

  if (failed.length) {
    console.log('\nFAILED:');
    for (const r of failed) {
      console.log(`  ${r.state}  ${r.key}  ${r.path}`);
      console.log(`     ${r.detail}`);
      console.log(`     breaks: ${r.sections.map((s) => sectionLabels[s] || s).join(', ')}`);
    }
  }

  console.log(`\n${ok.length} ok · ${empty.length} shape mismatch · ${failed.length} failed`);
  console.log(
    `${skipped.length} endpoints not covered — writes, and reads that need a real id. ` +
      'Those are exercised by using the dashboard, not by this script.',
  );
}

process.exit(empty.length + failed.length ? 1 : 0);
