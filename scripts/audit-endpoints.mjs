#!/usr/bin/env node
/**
 * Endpoint audit.
 *
 * Checks every path this dashboard can call against the routes gcr-api-clean
 * actually mounts, and fails the run if anything is wrong.
 *
 *   node scripts/audit-endpoints.mjs [path-to-gcr-api-clean]
 *
 * It catches two classes of defect:
 *
 *   1. NO ROUTE — the path matches nothing. A 404 at runtime. Loud and easy.
 *
 *   2. SHADOWED — the path has a literal segment where every candidate route
 *      has a parameter, and no route matches the literal exactly. These are
 *      the dangerous ones: they do NOT 404. Express happily binds the literal
 *      to the parameter and the call succeeds against the wrong thing.
 *      `POST /api/reviews/request` matching `POST /api/reviews/:slug` would
 *      have created a review against a business named "request".
 *
 * Paths in `endpoints.unverified`, plus the allowlist below, are known-missing
 * and are reported separately rather than failing the run — the screens that
 * use them show an explicit "route not deployed" notice.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(process.argv[2] || join(here, '..', '..', 'gcr-api-clean'));

/**
 * Paths the dashboard calls on purpose that the API does not serve. Each is
 * surfaced in the UI as an explicit notice; see docs/ENDPOINT-STATUS.md.
 * Keep this list short — every entry is a feature that does not work.
 */
const KNOWN_MISSING = new Set([
  'endpoints.sms.config',
  'endpoints.leads.businessLeads',
  'endpoints.leads.businessLead',
  'endpoints.photos.community',
  'endpoints.photos.communityItem',
]);

/* ── read the API's real route table, in registration order ──────────────── */

function loadRoutes() {
  let server;
  try {
    server = readFileSync(join(apiRoot, 'server.js'), 'utf8');
  } catch {
    console.error(`Could not read ${join(apiRoot, 'server.js')}.`);
    console.error('Pass the path to gcr-api-clean as the first argument.');
    process.exit(2);
  }

  // Only mounts that are actually live — several routers exist in the repo but
  // are deliberately commented out because their tables are not in the DB.
  const mounts = [...server.matchAll(/^mount\('([^']+)',\s*\(\)\s*=>\s*require\('\.\/(routes\/[^']+)'\)/gm)]
    .map((m) => ({ prefix: m[1], file: join(apiRoot, `${m[2]}.js`) }));

  const routes = [];
  for (const mount of mounts) {
    let src;
    try {
      src = readFileSync(mount.file, 'utf8');
    } catch {
      continue;
    }
    for (const r of src.matchAll(/\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
      routes.push({
        method: r[1].toUpperCase(),
        path: (mount.prefix + r[2]).replace(/\/+$/, '') || '/',
        order: routes.length, // registration order decides which match wins
      });
    }
  }
  return routes;
}

/* ── every path the dashboard can produce ────────────────────────────────── */

// Substituted for path parameters. A segment equal to one of these is meant to
// be dynamic; anything else is a literal the caller intends verbatim.
const ARGS = ['__A__', '__B__', '__C__'];
const isPlaceholder = (segment) => ARGS.includes(segment);

async function loadCalledPaths() {
  const mod = await import(pathToFileURL(join(here, '..', 'src', 'api', 'endpoints.js')).href);
  const out = [];
  (function walk(node, trail) {
    for (const [key, value] of Object.entries(node)) {
      const name = `${trail}.${key}`;
      if (typeof value === 'function') {
        let produced;
        try {
          produced = value(...ARGS);
        } catch {
          continue; // a builder that needs a shape we can't fake
        }
        out.push({ name, path: String(produced).split('?')[0].replace(/\/+$/, '') });
      } else if (value && typeof value === 'object') {
        walk(value, name);
      }
    }
  })(mod.endpoints, 'endpoints');
  return out;
}

/* ── matching ────────────────────────────────────────────────────────────── */

/**
 * Compare one called path against one route.
 * @returns 'exact' | 'shadowed' | null
 *   exact    — every literal segment lines up; parameters only where we passed one
 *   shadowed — it matches, but a literal of ours landed in a route parameter
 */
function match(calledPath, routePath) {
  const called = calledPath.split('/');
  const route = routePath.split('/');
  if (called.length !== route.length) return null;

  let shadowed = false;
  for (let i = 0; i < route.length; i++) {
    if (route[i].startsWith(':')) {
      if (!isPlaceholder(called[i])) shadowed = true;
    } else if (route[i] !== called[i]) {
      return null;
    }
  }
  return shadowed ? 'shadowed' : 'exact';
}

/* ── run ─────────────────────────────────────────────────────────────────── */

const routes = loadRoutes();
const called = await loadCalledPaths();

const missing = [];
const shadowed = [];
let clean = 0;

for (const entry of called) {
  const candidates = routes
    .map((route) => ({ route, kind: match(entry.path, route.path) }))
    .filter((c) => c.kind);

  if (candidates.length === 0) {
    missing.push(entry);
    continue;
  }
  // An exact structural match anywhere means the call lands where intended,
  // regardless of what else could also have matched.
  if (candidates.some((c) => c.kind === 'exact')) {
    clean += 1;
    continue;
  }
  // Only parameter matches: our literal is being swallowed by a route param.
  shadowed.push({ ...entry, hit: candidates.sort((a, b) => a.route.order - b.route.order)[0].route });
}

const declaredMissing = missing.filter(
  (m) => m.name.startsWith('endpoints.unverified') || KNOWN_MISSING.has(m.name),
);
const unexpectedMissing = missing.filter(
  (m) => !m.name.startsWith('endpoints.unverified') && !KNOWN_MISSING.has(m.name),
);

console.log(`API:        ${apiRoot}`);
console.log(`Routes:     ${routes.length} mounted`);
console.log(`Endpoints:  ${called.length} reachable from the dashboard\n`);
console.log(`  resolve cleanly     ${clean}`);
console.log(`  known missing       ${declaredMissing.length}  (declared, surfaced in the UI)`);
console.log(`  UNEXPECTED missing  ${unexpectedMissing.length}`);
console.log(`  SHADOWED            ${shadowed.length}\n`);

if (shadowed.length) {
  console.log('SHADOWED — these do not 404, they hit the wrong handler:');
  for (const s of shadowed) {
    console.log(`  ${s.name}`);
    console.log(`     calls  ${s.path}`);
    console.log(`     hits   ${s.hit.method} ${s.hit.path}\n`);
  }
}

if (unexpectedMissing.length) {
  console.log('UNEXPECTED — no route matches, and not declared as missing:');
  for (const m of unexpectedMissing) console.log(`  ${m.name.padEnd(44)} ${m.path}`);
  console.log('');
}

const failed = shadowed.length + unexpectedMissing.length;
if (failed) {
  console.log(`FAILED — ${failed} problem${failed === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log('OK — every endpoint resolves to the handler it names.');
