/**
 * Open the business-owner dashboard for one slug as an admin.
 *
 * Calls POST /api/admin/impersonate { slug }, then opens the returned
 * dashboard_url (business dashboard + one-time pass) in a new tab.
 * Falls back to the legacy ?business= URL only if the API is unavailable
 * (501 / missing route) so Matt can still navigate while the migration
 * is pending — the business dashboard will not auto-sign-in in that case.
 */

import { api, ApiError } from '../api/client.js';
import { endpoints } from '../api/endpoints.js';
import { businessDashboardViewUrl } from '../config/env.js';

/**
 * @param {string} slug
 * @returns {Promise<{ ok: true, url: string, via: 'pass'|'legacy' } | { ok: false, error: string }>}
 */
export async function openDashboardAsAdmin(slug) {
  const clean = String(slug || '').trim();
  if (!clean) return { ok: false, error: 'Missing business slug.' };

  try {
    const data = await api.post(endpoints.admin.impersonate(), { slug: clean });
    const url = data?.dashboard_url || null;
    if (!url || !data?.pass) {
      return { ok: false, error: 'The API did not return a dashboard pass.' };
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return { ok: true, url, via: 'pass' };
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    // Migration not applied yet, or older API without the route.
    if (status === 501 || status === 404 || status === 405) {
      const legacy = businessDashboardViewUrl(clean);
      if (legacy) {
        window.open(legacy, '_blank', 'noopener,noreferrer');
        return {
          ok: true,
          url: legacy,
          via: 'legacy',
          warning:
            status === 501
              ? 'Impersonation audit table is not set up yet — opened without a signed-in pass.'
              : 'Impersonation endpoint not available — opened without a signed-in pass.',
        };
      }
    }
    const message =
      (err instanceof ApiError && err.message) ||
      err?.message ||
      'Could not open the business dashboard.';
    return { ok: false, error: message };
  }
}
