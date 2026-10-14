/**
 * The core menu: the entries every business sees before installing anything.
 * Everything else appears once a business installs something that turns it on.
 * Store and Settings are always on (the server enforces that too).
 */

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/paperclip.js';
import { Button, Card, ErrorState, LoadingBlock, PageHeader } from '../../ui/primitives.jsx';
import { useToast } from '../../ui/Toast.jsx';
import PaperclipSignIn from './SignIn.jsx';

const LOCKED = new Set(['store', 'settings']);

export default function CoreMenu() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [core, setCore] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const settings = await adminApi.menuSettings();
      setData(settings);
      setCore(settings.core);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error?.isAuthError) return <PaperclipSignIn onDone={load} />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return <LoadingBlock />;

  const dirty = [...core].sort().join() !== [...data.core].sort().join();

  async function save() {
    setBusy(true);
    try {
      const saved = await adminApi.setCoreMenu(core);
      setData((d) => ({ ...d, core: saved.core }));
      setCore(saved.core);
      toast.success('Core menu saved');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="Core menu"
        description="Every business sees these. Everything else shows up only after a business installs something that turns it on."
        actions={<Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>Save</Button>}
      />
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {data.catalog.map((entry) => (
            <label key={entry.key} className="row" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={core.includes(entry.key)}
                disabled={LOCKED.has(entry.key)}
                onChange={(e) =>
                  setCore((current) => (e.target.checked ? [...current, entry.key] : current.filter((k) => k !== entry.key)))
                }
              />
              {entry.label}
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
