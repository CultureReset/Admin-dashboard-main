/**
 * Catalog-key ↔ entity_modules / table-key aliases.
 *
 * Keys and labels themselves come from the API catalog — never invent a full
 * list here. User Dashboard Specialist owns the canonical map in
 * Dashboards-users- moduleNav.js; keep this file small so we can sync later.
 *
 * Temporary aliases until that file lands:
 *   gallery → photos
 *   menu    → menu_sections
 */

/** Catalog app key → module / table key used in entity_modules. */
export const CATALOG_TO_MODULE = {
  gallery: 'photos',
  menu: 'menu_sections',
};

/** Reverse of CATALOG_TO_MODULE. */
export const MODULE_TO_CATALOG = Object.fromEntries(
  Object.entries(CATALOG_TO_MODULE).map(([catalog, module]) => [module, catalog]),
);

/** Resolve a catalog or module key to the entity_modules / table form. */
export function canonicalModuleKey(key) {
  if (key == null || key === '') return key;
  const k = String(key);
  return CATALOG_TO_MODULE[k] || k;
}

/** Resolve a module key back to the catalog app_id form when aliased. */
export function catalogKeyForModule(moduleKey) {
  if (moduleKey == null || moduleKey === '') return moduleKey;
  const k = String(moduleKey);
  return MODULE_TO_CATALOG[k] || k;
}

/** True when a catalog app_id and a modules[].key name the same app. */
export function keysMatch(catalogKey, moduleKey) {
  if (!catalogKey || !moduleKey) return false;
  if (catalogKey === moduleKey) return true;
  return canonicalModuleKey(catalogKey) === canonicalModuleKey(moduleKey);
}

export default {
  CATALOG_TO_MODULE,
  MODULE_TO_CATALOG,
  canonicalModuleKey,
  catalogKeyForModule,
  keysMatch,
};
