/**
 * Helpers for public.module_catalog rows returned by
 * GET /api/admin/businesses/:id/modules (catalog | module_catalog).
 * Catalog is global; the business id is only needed to hit that route.
 */

export function extractCatalog(data) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.catalog)) return data.catalog;
  if (Array.isArray(data.module_catalog)) return data.module_catalog;
  return [];
}

export function extractModules(data) {
  if (Array.isArray(data?.modules)) return data.modules;
  if (Array.isArray(data)) return data;
  return [];
}

export function catalogKey(app) {
  return app?.key || app?.module_key || app?.app_id || app?.id || '';
}

export function catalogLabel(app) {
  return app?.name || app?.label || catalogKey(app) || 'App';
}

/** Normalize GET /api/admin/businesses rows (site_id / subdomain aliases). */
export function normalizeBusiness(row) {
  if (!row || typeof row !== 'object') return null;
  const id = row.id || row.site_id || row.slug || row.subdomain || '';
  const slug = row.slug || row.subdomain || row.entity_slug || '';
  return {
    ...row,
    id,
    site_id: row.site_id || row.id || id,
    slug,
    subdomain: row.subdomain || slug,
    name: row.name || slug || id || 'Business',
  };
}

/**
 * Load module_catalog via the live modules route.
 * Needs any resolvable business id/slug (catalog does not vary by business).
 */
export async function fetchModuleCatalog(api, endpoints, businessId) {
  if (!businessId) return [];
  const data = await api.get(endpoints.businesses.modules(businessId));
  return extractCatalog(data).map((row) => {
    const key = catalogKey(row);
    return {
      ...row,
      key,
      app_id: row.app_id || key,
      name: catalogLabel(row),
      description: row.description || row.tagline || null,
      active: row.active !== false,
      is_core: row.is_core === true,
    };
  });
}
