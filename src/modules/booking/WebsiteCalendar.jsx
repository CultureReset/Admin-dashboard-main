/**
 * The calendar a business puts on its own website.
 *
 * Two lines of HTML give a business a live calendar of what it has open —
 * assembled here from its forwarded confirmation emails and its connected
 * iCal feeds, which is to say from every platform it uses at once. Neither
 * FareHarbor nor Airbnb will show that, because neither can see the other.
 *
 * This screen picks the business, sets the options, shows the real widget
 * running against the real data, and hands over the snippet to paste.
 *
 * The preview is a sandboxed iframe rather than a mount into this page. That
 * is deliberate: the widget injects a <style> tag and defines globals, and
 * running it inside the dashboard would leak both. An iframe is also the
 * honest test — it shows what a visitor to the business's site will see, not
 * what it looks like with the dashboard's CSS underneath it.
 *
 * GET /api/embed/availability.js
 * GET /api/embed/availability/:slug
 */

import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { config } from '../../config/env.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';

/** Same origin the widget calls back to, so the snippet is copy-paste correct. */
function scriptUrl() {
  return `${String(config.apiBaseUrl).replace(/\/$/, '')}${endpoints.embed.script()}`;
}

function snippetFor(slug, { showBook, month }) {
  const attrs = [`data-gcr-availability="${slug}"`];
  if (!showBook) attrs.push('data-gcr-book="off"');
  if (month) attrs.push(`data-gcr-month="${month}"`);
  return `<div ${attrs.join(' ')}></div>\n<script src="${scriptUrl()}" async></script>`;
}

export default function WebsiteCalendar() {
  const toast = useToast();
  const [slug, setSlug] = useState(null);
  const [showBook, setShowBook] = useState(true);
  const [dark, setDark] = useState(false);
  const [copied, setCopied] = useState(false);
  const frame = useRef(null);

  // Fetched so the screen can say what the calendar will actually show before
  // anyone pastes it anywhere — an empty calendar on a customer's live site is
  // a bad way to find out the business has no capacity on file.
  const dataQuery = useAsync(
    async () => (slug ? api.get(endpoints.embed.availability(slug)) : null),
    [slug],
    { initialData: null },
  );

  const data = dataQuery.data;
  const snippet = slug ? snippetFor(slug, { showBook }) : '';

  const days = useMemo(() => (Array.isArray(data?.days) ? data.days : []), [data]);
  const openDays = days.filter((d) => d.status === 'available' || d.status === 'limited').length;
  const unknownDays = days.filter((d) => d.status === 'unknown').length;

  // srcDoc rather than a URL: no route to add, and the preview cannot outlive
  // this screen or be linked to by accident.
  const previewDoc = useMemo(() => {
    if (!slug) return '';
    return `<!doctype html><html><head><meta charset="utf-8">
<style>
  body { margin:0; padding:16px; font-family: system-ui, -apple-system, sans-serif;
         background:${dark ? '#14161a' : '#ffffff'}; color:${dark ? '#e8eaed' : '#16181d'}; }
</style></head><body>
${snippetFor(slug, { showBook })}
</body></html>`;
  }, [slug, showBook, dark]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.warning('Your browser blocked clipboard access. Select the snippet and copy it.');
    }
  };

  return (
    <>
      <PageHeader
        title="Website calendar"
        description="The live availability calendar a business embeds on its own site."
        actions={
          slug && (
            <Button onClick={() => { dataQuery.reload(); if (frame.current) frame.current.srcdoc = previewDoc; }}>
              Reload preview
            </Button>
          )
        }
      />

      <Notice tone="info" title="One calendar across every platform they use">
        <p>
          A business on FareHarbor and Airbnb has two calendars and no way to show a guest one
          combined view. This is that view — built from the confirmation emails they forward and
          the <Link to="/booking/feeds">iCal feeds</Link> they connect, so it covers every platform
          at once without a single API credential.
        </p>
        <p style={{ marginTop: 8 }}>
          Only counts and colours leave the server. No guest name, no email, no booking ever
          appears in the widget or its data.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card>
        <div className="row-wrap" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
          <div style={{ minWidth: 240, flex: 1, maxWidth: 320 }}>
            <EntityPicker value={slug} onChange={setSlug} label={null} placeholder="Pick a business…" />
          </div>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={showBook} onChange={(e) => setShowBook(e.target.checked)} />
            <span>Show the book / call link</span>
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />
            <span>Preview on a dark site</span>
          </label>
        </div>
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      {!slug && (
        <Card>
          <p className="muted">Pick a business to generate its snippet and see the calendar.</p>
        </Card>
      )}

      {slug && (
        <>
          {dataQuery.loading && <LoadingBlock />}
          {dataQuery.error && <ErrorState error={dataQuery.error} onRetry={dataQuery.reload} />}

          {!dataQuery.loading && data && (
            <>
              <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
                <Stat label="Industry" value={data.vertical} hint={`counts shown as “${data.unit_word}”`} />
                <Stat
                  label="Open days this month"
                  value={openDays}
                  tone={openDays ? 'success' : 'warning'}
                />
                <Stat
                  label="Unknown days"
                  value={unknownDays}
                  tone={unknownDays ? 'warning' : 'success'}
                  hint={data.capacity_known ? 'nothing claimed them' : 'no capacity on file'}
                />
                {data.unit_count ? <Stat label="Units" value={data.unit_count} tone="primary" /> : null}
              </div>

              {!data.capacity_known && (
                <>
                  <Notice tone="warning" title="This calendar will look mostly empty">
                    No capacity is on file for this business, so every day it has not been told
                    about shows as unknown rather than open. The widget says &ldquo;call to
                    confirm&rdquo; instead of implying seats. Set the number in{' '}
                    <Link to="/booking/inventory">Inventory &amp; Capacity</Link> and it fills in.
                  </Notice>
                  <div style={{ height: 'var(--space-4)' }} />
                </>
              )}
            </>
          )}

          {/* Not `grid-auto` — its narrow tracks squeeze the snippet into a
              two-word-per-line column. Two wide columns that collapse to one. */}
          <div
            style={{
              display: 'grid',
              gap: 'var(--space-5)',
              alignItems: 'start',
              gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
            }}
          >
            <Card
              title="Paste this into their website"
              subtitle="Anywhere in the page body. It inherits the site's font and colour."
              actions={
                <Button size="sm" variant="primary" onClick={copy}>
                  {copied ? 'Copied' : 'Copy snippet'}
                </Button>
              }
            >
              <pre
                className="mono"
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  fontSize: 12,
                  margin: 0,
                  padding: 'var(--space-3)',
                  background: 'var(--bg)',
                  borderRadius: 6,
                  border: '1px solid var(--card-border)',
                }}
              >
                {snippet}
              </pre>

              <div style={{ marginTop: 'var(--space-4)' }}>
                <p className="muted" style={{ fontSize: 13 }}>
                  The script tag can go in once for the whole site; add a{' '}
                  <code className="mono">div</code> per calendar. Extra attributes:
                </p>
                <ul className="muted" style={{ fontSize: 13, marginTop: 6, paddingLeft: 18 }}>
                  <li>
                    <code className="mono">data-gcr-month=&quot;2026-09&quot;</code> — open on a
                    specific month instead of the current one
                  </li>
                  <li>
                    <code className="mono">data-gcr-book=&quot;off&quot;</code> — hide the booking
                    link, for a page that already has its own
                  </li>
                </ul>
                <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                  Data is cached for five minutes at the edge, so a booking parsed now shows up
                  within a few minutes rather than instantly.
                </p>
              </div>
            </Card>

            <Card
              title="Live preview"
              subtitle="The real widget, the real data, in a sandboxed frame."
              actions={data && <Badge tone="info">{data.name}</Badge>}
            >
              <iframe
                ref={frame}
                title="Availability calendar preview"
                srcDoc={previewDoc}
                sandbox="allow-scripts allow-popups"
                style={{
                  width: '100%',
                  height: 520,
                  border: '1px solid var(--card-border)',
                  borderRadius: 8,
                  background: dark ? '#14161a' : '#fff',
                }}
              />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
