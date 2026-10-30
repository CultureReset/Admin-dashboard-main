/**
 * Catalog-key ↔ section / entity_modules aliases.
 *
 * Mirrors Dashboards-users- moduleNav.js (and /workspace/reports/moduleNav.js).
 * Aliases only — keys and labels for the Apps UI come from the API catalog,
 * never from a hardcoded app list here.
 *
 * Prefer mappings from the modules / catalog API response when present
 * (applyCatalogFromApi). Local CATALOG_KEY_TO_SECTION is the fallback.
 */

/**
 * Canonical module_catalog key → dashboard section key (API payload / nav).
 * Keys with sectionKey null are profile-level and do not become nav tabs.
 */
export const CATALOG_KEY_TO_SECTION = {
  core: { sectionKey: null, table: 'entity', reason: 'profile_fields' },
  hours: { sectionKey: 'hours', table: 'entity_hours' },
  gallery: { sectionKey: 'photos', table: 'entity_photos' },
  reviews: { sectionKey: 'reviews', table: 'entity_reviews' },
  faqs: { sectionKey: 'faqs', table: 'faqs' },
  team: { sectionKey: 'team', table: 'entity_team_members' },
  policies: { sectionKey: 'policies', table: 'entity_policies' },
  announcements: { sectionKey: 'announcements', table: 'announcements' },
  blog: { sectionKey: 'blog_posts', table: 'entity_blog_posts' },
  booking: { sectionKey: 'bookable_resources', table: 'bookable_resources' },
  pricing: { sectionKey: 'pricing', table: 'pricing_items' },
  schedule: { sectionKey: 'schedules', table: 'activity_schedules' },
  events: { sectionKey: 'events', table: 'entity_events' },
  services: { sectionKey: 'service_menu', table: 'service_menu' },
  menu: { sectionKey: 'menu_sections', table: 'menu_sections' },
  drinks: { sectionKey: 'drink_sections', table: 'drink_sections' },
  happy_hour: { sectionKey: 'happy_hour_sections', table: 'happy_hour_sections' },
  specials: { sectionKey: 'specials', table: 'entity_specials' },
  shop: { sectionKey: 'products', table: 'products' },
  loyalty: { sectionKey: 'loyalty_program', table: 'loyalty_programs' },
  amenities: { sectionKey: 'amenities', table: 'amenities' },
  stay: { sectionKey: 'property_details', table: 'property_details' },
  rooms: { sectionKey: 'room_types', table: 'room_types' },
  park: { sectionKey: 'facilities', table: 'facilities' },
  activity: { sectionKey: 'activity_details', table: 'activity_details' },
  offerings: { sectionKey: 'offerings', table: 'offerings' },
  highlights: { sectionKey: 'about_bullets', table: 'entity_about_bullets' },
  whats_included: { sectionKey: 'whats_included', table: 'whats_included' },
  best_for: { sectionKey: 'perfect_for', table: 'entity_perfect_for' },
};

/** Reverse: section key → preferred catalog key (first match wins). */
export const SECTION_TO_CATALOG_KEY = Object.fromEntries(
  Object.entries(CATALOG_KEY_TO_SECTION)
    .filter(([, v]) => v.sectionKey)
    .map(([catalogKey, v]) => [v.sectionKey, catalogKey]),
);

/**
 * Flat catalog → section aliases for callers that only need the string map.
 * Excludes profile-level keys (sectionKey null).
 */
export const CATALOG_TO_MODULE = Object.fromEntries(
  Object.entries(CATALOG_KEY_TO_SECTION)
    .filter(([, v]) => v.sectionKey)
    .map(([catalogKey, v]) => [catalogKey, v.sectionKey]),
);

/** Reverse of CATALOG_TO_MODULE. */
export const MODULE_TO_CATALOG = { ...SECTION_TO_CATALOG_KEY };

/**
 * Runtime override from the modules / catalog API response.
 * Shape: Map(catalogKey → { sectionKey, table?, label?, icon? })
 */
let apiCatalogOverride = null;

/**
 * Prefer API-provided catalog mappings when present. Accepts several shapes
 * so we adapt without rewriting call sites when Concierge lands the endpoint.
 *
 * Recognized shapes (any one):
 *   { catalog: [{ key, section_key|sectionKey, table, label, icon }] }
 *   { mappings: { gallery: 'photos' | { section_key, table, … } } }
 *   { modules: [{ key, section_key, table, … }] }  // only rows that carry a map
 */
export function applyCatalogFromApi(payload) {
  if (!payload || typeof payload !== 'object') {
    apiCatalogOverride = null;
    return null;
  }
  const map = new Map();

  const rows = Array.isArray(payload.catalog)
    ? payload.catalog
    : Array.isArray(payload.module_catalog)
      ? payload.module_catalog
      : null;

  if (rows) {
    for (const row of rows) {
      const key = row?.key || row?.module_key;
      if (!key) continue;
      const sectionKey = row.section_key ?? row.sectionKey ?? row.nav_key ?? null;
      map.set(String(key), {
        sectionKey: sectionKey || null,
        table: row.table || row.table_name || null,
        label: row.label || row.name || null,
        icon: row.icon || null,
      });
    }
  }

  if (payload.mappings && typeof payload.mappings === 'object' && !Array.isArray(payload.mappings)) {
    for (const [key, value] of Object.entries(payload.mappings)) {
      if (typeof value === 'string') {
        map.set(key, { sectionKey: value, table: null, label: null, icon: null });
      } else if (value && typeof value === 'object') {
        map.set(key, {
          sectionKey: value.section_key ?? value.sectionKey ?? value.key ?? null,
          table: value.table || null,
          label: value.label || value.name || null,
          icon: value.icon || null,
        });
      }
    }
  }

  if (Array.isArray(payload.modules)) {
    for (const row of payload.modules) {
      const key = row?.key || row?.module_key;
      const sectionKey = row?.section_key ?? row?.sectionKey;
      if (!key || sectionKey == null || sectionKey === '') continue;
      if (!map.has(String(key))) {
        map.set(String(key), {
          sectionKey: String(sectionKey),
          table: row.table || null,
          label: row.label || row.name || null,
          icon: row.icon || null,
        });
      }
    }
  }

  apiCatalogOverride = map.size ? map : null;
  return apiCatalogOverride;
}

export function clearCatalogFromApi() {
  apiCatalogOverride = null;
}

/** Resolve one catalog key through API override, else local fallback. */
export function resolveCatalogKey(catalogKey) {
  const key = String(catalogKey || '');
  if (apiCatalogOverride?.has(key)) return apiCatalogOverride.get(key);
  return CATALOG_KEY_TO_SECTION[key] || null;
}

export function sectionKeyForCatalog(catalogKey) {
  const resolved = resolveCatalogKey(catalogKey);
  return resolved?.sectionKey ?? null;
}

/**
 * Resolve a catalog key to the section / entity_modules form.
 * API override wins over the local fallback map.
 */
export function canonicalModuleKey(key) {
  if (key == null || key === '') return key;
  const k = String(key);
  const fromApi = apiCatalogOverride?.get(k);
  if (fromApi) {
    return fromApi.sectionKey != null && fromApi.sectionKey !== ''
      ? fromApi.sectionKey
      : k;
  }
  const local = CATALOG_KEY_TO_SECTION[k];
  if (local) return local.sectionKey != null ? local.sectionKey : k;
  return k;
}

/** Resolve a section / module key back to the catalog form when aliased. */
export function catalogKeyForModule(moduleKey) {
  if (moduleKey == null || moduleKey === '') return moduleKey;
  const k = String(moduleKey);
  if (apiCatalogOverride) {
    for (const [catalogKey, meta] of apiCatalogOverride) {
      if (meta?.sectionKey === k) return catalogKey;
    }
  }
  return SECTION_TO_CATALOG_KEY[k] || k;
}

/** True when a catalog app_id and a modules[].key name the same app. */
export function keysMatch(catalogKey, moduleKey) {
  if (!catalogKey || !moduleKey) return false;
  if (catalogKey === moduleKey) return true;
  const a = canonicalModuleKey(catalogKey);
  const b = canonicalModuleKey(moduleKey);
  if (a && b && a === b) return true;
  // Also match when one side is already the section key for the other.
  if (a === moduleKey || catalogKey === b) return true;
  return false;
}

export default {
  CATALOG_KEY_TO_SECTION,
  SECTION_TO_CATALOG_KEY,
  CATALOG_TO_MODULE,
  MODULE_TO_CATALOG,
  applyCatalogFromApi,
  clearCatalogFromApi,
  resolveCatalogKey,
  sectionKeyForCatalog,
  canonicalModuleKey,
  catalogKeyForModule,
  keysMatch,
};
