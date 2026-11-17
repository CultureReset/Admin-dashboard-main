/**
 * "Open owner dashboard" — view and edit a business exactly as its owner does.
 *
 * POST /api/admin/impersonate { slug } mints a ~15 minute, single-use pass
 * (audited, admin-only). The owner dashboard exchanges it for a session
 * scoped to that one slug, so every edit made there goes through the same
 * owner controls and the same owner routes — nothing is re-implemented here.
 *
 * The tab is opened synchronously on click, before the request, because
 * browsers block a window opened after an await. It is pointed at the
 * dashboard URL once the API answers, and closed again if it fails.
 */

import { useState } from 'react';
import { Button } from '../ui/primitives.jsx';
import { useToast } from '../ui/Toast.jsx';
import { api } from '../api/client.js';
import { endpoints } from '../api/endpoints.js';

export function OpenOwnerDashboard({ slug, name, size, variant = 'default', label = 'Open owner dashboard' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (!slug || busy) return;
    setBusy(true);
    const tab = window.open('', '_blank');
    try {
      const result = await api.post(endpoints.impersonation.mint(), { slug });
      if (!result?.dashboard_url) throw new Error('The API did not return a dashboard link.');
      if (tab) {
        tab.opener = null;
        tab.location.href = result.dashboard_url;
        toast.success(`Opened ${name || slug} as its owner. The link works once, for 15 minutes.`, 'Owner dashboard');
      } else {
        // Pop-up blocked: hand the link over instead of failing silently.
        await navigator.clipboard?.writeText(result.dashboard_url).catch(() => {});
        toast.info('Your browser blocked the new tab. The one-time link is on your clipboard.', 'Owner dashboard');
      }
    } catch (err) {
      tab?.close();
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size={size} variant={variant} onClick={open} loading={busy} disabled={!slug}>
      {label}
    </Button>
  );
}

export default OpenOwnerDashboard;
