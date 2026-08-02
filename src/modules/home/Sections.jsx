/**
 * Sections index — every screen in the dashboard, what it does, and exactly
 * which API routes it depends on.
 *
 * Both halves are derived, not written by hand:
 *   - the section list comes from src/modules/registry.js
 *   - the endpoints each section calls come from
 *     src/modules/sectionMap.generated.json, produced by
 *     scripts/generate-section-map.mjs walking the real import graph
 *
 * So this screen cannot drift from the code. "Probe endpoints" then asks the
 * live API whether each route answers, which turns it into a health check for
 * the whole dashboard rather than a static list.
 */

import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, PageHeader, SearchInput, Spinner, Stat } from '../../ui/primitives.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { navigation, modules } from '../registry.js';
import generated from '../sectionMap.generated.json';
import './Sections.css';

/** Placeholder arguments, so a path builder yields a readable shape. */
const ARGS = [':slug', ':kind', ':id'];

/** Resolve "entities.list" to its path, or null if the key has gone stale. */
function pathFor(key) {
  const [group, name] = key.split('.');
  const builder = endpoints?.[group]?.[name];
  if (typeof builder !== 'function') return null;
  try {
    return builder(...ARGS);
  } catch {
    return null;
  }
}

/** An endpoint is probeable only if it needs no real id to answer. */
const isProbeable = (path) => path && !path.includes(':');

export default function Sections() {
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [probes, setProbes] = useState({});
  const [probing, setProbing] = useState(false);
  const [expanded, setExpanded] = useState({});

  const sectionMap = generated.sections || {};

  /** Registry + generated map, joined. */
  const rows = useMemo(
    () =>
      modules
        .filter((m) => !m.hidden)
        .map((m) => {
          const keys = sectionMap[m.id] || [];
          const calls = keys
            .map((key) => ({ key, path: pathFor(key) }))
            .filter((c) => c.path);
          return {
            ...m,
            calls,
            stale: keys.filter((key) => !pathFor(key)),
            group: navigation.find((g) => g.key === m.group),
          };
        }),
    [sectionMap],
  );

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.label.toLowerCase().includes(needle) ||
        r.id.toLowerCase().includes(needle) ||
        (r.description || '').toLowerCase().includes(needle) ||
        r.calls.some((c) => c.key.toLowerCase().includes(needle) || c.path.toLowerCase().includes(needle)),
    );
  }, [rows, filter]);

  const byGroup = useMemo(() => {
    const out = new Map();
    for (const row of filtered) {
      const key = row.group?.key || 'other';
      if (!out.has(key)) out.set(key, { label: row.group?.label || 'Other', items: [] });
      out.get(key).items.push(row);
    }
    return [...out.values()];
  }, [filtered]);

  /** Distinct probeable paths across every section, so nothing is hit twice. */
  const probeTargets = useMemo(() => {
    const seen = new Map();
    for (const row of rows) {
      for (const call of row.calls) {
        if (isProbeable(call.path) && !seen.has(call.path)) seen.set(call.path, call.key);
      }
    }
    return [...seen.keys()];
  }, [rows]);

  const probeAll = useCallback(async () => {
    setProbing(true);
    const results = {};
    // Small concurrency — this is a health check, not a load test.
    const queue = [...probeTargets];
    const workers = Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const path = queue.shift();
        try {
          await api.get(path);
          results[path] = { state: 'ok' };
        } catch (err) {
          if (err.isAuthError) results[path] = { state: 'ok', note: 'auth' };
          else if (err.isMissingEndpoint) results[path] = { state: 'missing' };
          else if (err.isNetworkError) results[path] = { state: 'unreachable' };
          else results[path] = { state: 'error', note: String(err.status) };
        }
      }
    });
    await Promise.all(workers);
    setProbes(results);
    setProbing(false);

    const missing = Object.values(results).filter((r) => r.state === 'missing').length;
    const errored = Object.values(results).filter((r) => r.state === 'error').length;
    if (missing || errored) {
      toast.warning(
        `${probeTargets.length} routes checked · ${missing} not deployed · ${errored} errored.`,
        'Probe finished',
      );
    } else {
      toast.success(`All ${probeTargets.length} probeable routes answered.`, 'Probe finished');
    }
  }, [probeTargets, toast]);

  const counts = useMemo(() => {
    const live = rows.filter((r) => r.status !== 'partial').length;
    const endpointCount = new Set(rows.flatMap((r) => r.calls.map((c) => c.key))).size;
    const probed = Object.keys(probes).length;
    const failing = Object.values(probes).filter((p) => p.state !== 'ok').length;
    return { total: rows.length, live, partial: rows.length - live, endpointCount, probed, failing };
  }, [rows, probes]);

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <PageHeader
        title="All sections"
        description="Every screen in this dashboard, what it does, and the API routes behind it."
        actions={
          <Button variant="primary" loading={probing} onClick={probeAll}>
            Probe {probeTargets.length} routes
          </Button>
        }
      />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Sections" value={counts.total} tone="primary" />
        <Stat label="Fully backed" value={counts.live} tone="success" />
        <Stat
          label="Depend on a missing route"
          value={counts.partial}
          tone={counts.partial ? 'warning' : 'neutral'}
        />
        <Stat label="Distinct endpoints" value={counts.endpointCount} />
        {counts.probed > 0 && (
          <Stat
            label="Probe failures"
            value={counts.failing}
            tone={counts.failing ? 'danger' : 'success'}
            hint={`${counts.probed} routes checked`}
          />
        )}
      </div>

      <div style={{ marginBottom: 'var(--space-4)', maxWidth: 460 }}>
        <SearchInput
          value={filter}
          onChange={setFilter}
          placeholder="Filter by name, purpose, or endpoint…"
        />
      </div>

      <div className="stack">
        {byGroup.map((group) => (
          <Card key={group.label} title={group.label || 'Overview'} padded={false}>
            <div className="sections-list">
              {group.items.map((row) => {
                const open = expanded[row.id];
                const failures = row.calls.filter(
                  (c) => probes[c.path] && probes[c.path].state !== 'ok',
                );
                return (
                  <div className="sections-row" key={row.id}>
                    <button
                      type="button"
                      className="sections-row__head"
                      onClick={() => toggle(row.id)}
                      aria-expanded={Boolean(open)}
                    >
                      <span className="sections-row__icon" aria-hidden="true">{row.icon}</span>
                      <span className="sections-row__body">
                        <span className="sections-row__name">
                          {row.label}
                          {row.status === 'partial' && <Badge tone="warning">route missing</Badge>}
                          {failures.length > 0 && (
                            <Badge tone="danger">{failures.length} failing</Badge>
                          )}
                          {row.stale.length > 0 && (
                            <Badge tone="danger">{row.stale.length} stale keys</Badge>
                          )}
                        </span>
                        <span className="sections-row__desc">{row.description}</span>
                      </span>
                      <span className="sections-row__count">{row.calls.length} endpoints</span>
                      <span className="sections-row__caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
                    </button>

                    {open && (
                      <div className="sections-row__detail">
                        <div className="sections-row__meta mono">
                          <span>id: {row.id}</span>
                          <span>route: {row.path}</span>
                        </div>

                        <ul className="sections-endpoints">
                          {row.calls.map((call) => {
                            const probe = probes[call.path];
                            return (
                              <li key={call.key}>
                                <span className="sections-endpoints__key mono">{call.key}</span>
                                <span className="sections-endpoints__path mono">{call.path}</span>
                                {probe ? (
                                  <Badge
                                    tone={
                                      probe.state === 'ok'
                                        ? 'success'
                                        : probe.state === 'missing'
                                          ? 'warning'
                                          : 'danger'
                                    }
                                  >
                                    {probe.state}
                                    {probe.note ? ` · ${probe.note}` : ''}
                                  </Badge>
                                ) : isProbeable(call.path) ? (
                                  <Badge>not checked</Badge>
                                ) : (
                                  <Badge tone="info">needs an id</Badge>
                                )}
                              </li>
                            );
                          })}
                          {row.calls.length === 0 && (
                            <li className="muted">No API calls — this screen is presentational.</li>
                          )}
                        </ul>

                        <div className="sections-row__actions">
                          <Link to={row.path} className="ui-btn ui-btn--sm ui-btn--primary">
                            Open {row.label}
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}

        {byGroup.length === 0 && (
          <Card>
            <p className="muted">Nothing matches “{filter}”.</p>
          </Card>
        )}
      </div>

      {probing && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Spinner label="Probing routes…" />
        </div>
      )}
    </>
  );
}
