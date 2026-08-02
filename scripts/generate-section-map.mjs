#!/usr/bin/env node
/**
 * Generate the section → endpoints map that powers the Sections index.
 *
 *   node scripts/generate-section-map.mjs
 *
 * Derived from the source, never hand-written, so it cannot drift from what
 * the modules actually call. For each section in the registry it walks that
 * module's imports (depth-first, within src/) and collects every
 * `endpoints.a.b` reference, including ones reached through a shared resource
 * in src/api/resources.js or a shared component.
 *
 * Run it after adding or rewiring a section; `npm run verify` checks it is
 * current.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '..', 'src');
const OUT = join(src, 'modules', 'sectionMap.generated.json');

/** Resolve a relative import to a file on disk. */
function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec);
  const candidates = [base, `${base}.js`, `${base}.jsx`, join(base, 'index.js'), join(base, 'index.jsx')];
  return candidates.find((c) => existsSync(c) && !c.endsWith('.css')) || null;
}

const RESOURCES_FILE = join(src, 'api', 'resources.js');

/**
 * resources.js declares every resource in the app, so recursing into it whole
 * would attribute all 166 endpoints to any section that imports one resource.
 * Parse it once into exportName → endpoints, and credit only what is imported.
 */
function parseResources() {
  const code = readFileSync(RESOURCES_FILE, 'utf8');
  const byExport = {};

  // Split on each `export const NAME =` so every declaration keeps its own body.
  const parts = code.split(/\n(?=export (?:const|function) )/);
  for (const part of parts) {
    const name = part.match(/^export (?:const|function) ([A-Za-z_$][\w$]*)/)?.[1];
    if (!name) continue;
    const found = new Set();
    for (const m of part.matchAll(/\bep\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g)) {
      found.add(`${m[1]}.${m[2]}`);
    }
    // `entityCollectionResource('FAQ', ep.collections.faqs, …)` passes a whole
    // endpoint group; credit the group's members generically.
    for (const m of part.matchAll(/\bep\.collections\.([A-Za-z_$][\w$]*)/g)) {
      found.add(`collections.${m[1]}`);
    }
    byExport[name] = found;
  }
  return byExport;
}

const RESOURCE_ENDPOINTS = parseResources();

/** Named bindings pulled from one import statement. */
function namedImports(statement) {
  const inner = statement.match(/\{([^}]*)\}/)?.[1];
  if (!inner) return [];
  return inner
    .split(',')
    .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
    .filter(Boolean);
}

/**
 * Every `endpoints.a.b` / `ep.a.b` reference reachable from a file.
 * Cycles are handled by the visited set; CSS is skipped.
 */
function collectEndpoints(entryFile, visited = new Set()) {
  if (!entryFile || visited.has(entryFile) || entryFile.endsWith('.css')) return new Set();
  visited.add(entryFile);

  let code;
  try {
    code = readFileSync(entryFile, 'utf8');
  } catch {
    return new Set();
  }

  const found = new Set();
  for (const m of code.matchAll(/\b(?:endpoints|ep)\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g)) {
    found.add(`${m[1]}.${m[2]}`);
  }

  for (const m of code.matchAll(/import\s+([^;]*?)\s+from\s+'([^']+)'/g)) {
    const target = resolveImport(entryFile, m[2]);
    if (!target) continue;

    if (target === RESOURCES_FILE) {
      for (const binding of namedImports(m[1])) {
        for (const value of RESOURCE_ENDPOINTS[binding] || []) found.add(value);
      }
      continue; // never recurse into resources.js wholesale
    }

    for (const value of collectEndpoints(target, visited)) found.add(value);
  }
  return found;
}

/* ── read the registry: id, metadata, and the file each section loads ────── */

const registrySource = readFileSync(join(src, 'modules', 'registry.js'), 'utf8');

const sections = [];
// Each descriptor is a `{ ... }` block containing an `id:` and a `load:`.
for (const block of registrySource.split(/\n\s*\{\n/).slice(1)) {
  const id = block.match(/^\s*id:\s*'([^']+)'/m)?.[1];
  const load = block.match(/load:\s*\(\)\s*=>\s*import\('([^']+)'\)/)?.[1];
  if (!id || !load) continue;
  sections.push({ id, file: resolveImport(join(src, 'modules', 'registry.js'), load) });
}

if (sections.length === 0) {
  console.error('Parsed no sections from the registry — has its shape changed?');
  process.exit(2);
}

const map = {};
for (const section of sections) {
  // Several registry entries can share a component (e.g. the entity editor's
  // bare and :slug routes); merge rather than overwrite.
  const endpoints = [...collectEndpoints(section.file)].sort();
  map[section.id] = [...new Set([...(map[section.id] || []), ...endpoints])].sort();
}

const payload = {
  // Regenerate with `npm run sections:map`.
  generatedFrom: 'src/modules/registry.js + each section\'s import graph',
  sections: map,
};

const next = `${JSON.stringify(payload, null, 2)}\n`;
const previous = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';

if (process.argv.includes('--check')) {
  if (previous !== next) {
    console.error('Section map is out of date. Run: npm run sections:map');
    process.exit(1);
  }
  console.log(`Section map is current (${sections.length} sections).`);
  process.exit(0);
}

writeFileSync(OUT, next);
const total = new Set(Object.values(map).flat()).size;
console.log(`Wrote ${OUT}`);
console.log(`${sections.length} sections, ${total} distinct endpoints referenced.`);
