/**
 * One run, step by step. Shared by the Run log section, the builder's test
 * panel and the builder's Runs tab, so a run reads the same everywhere.
 */

import { useState } from 'react';
import { Badge } from '../../ui/primitives.jsx';
import { formatDateTime } from '../../lib/fields.jsx';
import './automations.css';

export const RUN_TONES = { ok: 'success', failed: 'danger', skipped: 'warning' };
export const STEP_TONES = { ok: 'success', failed: 'danger', stopped: 'warning', dry_run: 'info' };

export function RunStatus({ status }) {
  return <Badge tone={RUN_TONES[status] || 'neutral'}>{status || '—'}</Badge>;
}

export function RunSteps({ steps = [], output }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (i) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  });

  return (
    <div className="au__runsteps">
      {steps.length === 0 && <p className="muted">No steps ran.</p>}
      {steps.map((s, i) => (
        <div className="au__runstep" key={`${s.id}-${i}`}>
          <Badge tone={STEP_TONES[s.status] || 'neutral'}>{s.status}</Badge>
          <div>
            <div>
              <b>{s.name || s.id}</b>{' '}
              <span className="faint mono">{s.type} · {s.id}</span>
            </div>
            {s.error && <div className="au__runstep-err">{s.error}</div>}
            {s.output !== undefined && (
              <>
                <button type="button" className="ui-btn ui-btn--link ui-btn--sm" onClick={() => toggle(i)}>
                  {open.has(i) ? 'Hide output' : 'Show output'}
                </button>
                {open.has(i) && <pre>{JSON.stringify(s.output, null, 2)}</pre>}
              </>
            )}
          </div>
          <span className="faint">{s.ms} ms</span>
        </div>
      ))}
      {output?.notices?.length > 0 && (
        <div className="au__runstep">
          <Badge tone="info">notes</Badge>
          <div>
            {output.notices.map((n, i) => (
              <div key={i}><b>{n.title}</b> <span className="muted">{n.message}</span></div>
            ))}
          </div>
          <span />
        </div>
      )}
      {output?.logs?.length > 0 && (
        <div className="au__runstep">
          <Badge>console</Badge>
          <pre style={{ marginTop: 0 }}>{output.logs.join('\n')}</pre>
          <span />
        </div>
      )}
    </div>
  );
}

/** A compact run row that expands into its steps. */
export function RunRow({ run, showAutomation = false, showBusiness = true }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="au__step" data-disabled={String(run.dry_run && !open)}>
      <div className="au__step-head" onClick={() => setOpen((v) => !v)} role="button" tabIndex={0}>
        <RunStatus status={run.status} />
        <div className="au__step-title">
          <b>
            {showAutomation && (run.automation_name || run.automation_id)}
            {showAutomation && showBusiness && ' · '}
            {showBusiness && (run.entity_slug || <span className="faint">no business</span>)}
          </b>
          <span>
            {formatDateTime(run.started_at)} · {run.trigger}
            {run.version != null && ` · v${run.version}`}
            {run.dry_run && ' · dry run'}
            {run.duration_ms != null && ` · ${run.duration_ms} ms`}
            {run.error && <> · <span style={{ color: 'var(--danger)' }}>{run.error}</span></>}
          </span>
        </div>
        <span className="faint">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className="au__step-body">
          <RunSteps steps={run.steps_log || []} output={run.output} />
        </div>
      )}
    </div>
  );
}
