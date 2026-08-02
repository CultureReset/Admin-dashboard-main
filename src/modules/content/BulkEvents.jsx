/**
 * Bulk events for one entity.
 *
 * Accepts a CSV file or pasted text, previews the parsed rows, then sends them
 * in one request to POST /api/admin/gcr/import-events.
 */

import { useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Notice, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { parseCsv, compactRow, toBoolean, readFileText } from '../../lib/csv.js';
import { columns } from '../../lib/fields.jsx';

const TEMPLATE = `event_name,description,event_date,start_time,end_time,artist_name,cover_charge,recurring
Live Music Friday,Acoustic set on the deck,2026-08-14,19:00,22:00,The Sandbars,0,false
Trivia Night,Teams of up to six,2026-08-18,19:30,21:30,,5,true`;

export default function BulkEvents() {
  const toast = useToast();
  const fileInput = useRef(null);
  const [slug, setSlug] = useState(null);
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const parsed = useMemo(() => (text.trim() ? parseCsv(text) : null), [text]);

  const validation = useMemo(() => {
    if (!parsed) return { valid: [], invalid: [] };
    const valid = [];
    const invalid = [];
    parsed.rows.forEach((row, index) => {
      if (!row.event_name) invalid.push({ line: index + 2, problem: 'event_name is required' });
      else
        valid.push(
          compactRow({
            ...row,
            recurring: toBoolean(row.recurring),
            cover_charge: row.cover_charge ? Number(row.cover_charge) : undefined,
          }),
        );
    });
    return { valid, invalid };
  }, [parsed]);

  const pickFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setText(await readFileText(file));
      setResult(null);
    } catch (err) {
      toast.error(err.message || 'Could not read the file');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const run = async () => {
    if (!slug) {
      toast.warning('Pick a business first.');
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const response = await api.post(endpoints.imports.events(), {
        entity_slug: slug,
        events: validation.valid,
      });
      const count = response?.count ?? validation.valid.length;
      setResult({ count });
      toast.success(`${count} events imported.`);
    } catch (err) {
      toast.error(err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Bulk events"
        description="Add many events to one business at once, from a CSV file or pasted text."
      />

      <div className="stack">
        <Card title="Business">
          <EntityPicker value={slug} onChange={setSlug} label="Events will be attached to" />
        </Card>

        <Card
          title="Event data"
          subtitle="First row is the header."
          actions={
            <>
              <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={pickFile} />
              <Button size="sm" onClick={() => fileInput.current?.click()}>Upload CSV</Button>
              <Button size="sm" onClick={() => setText(TEMPLATE)}>Insert template</Button>
              {text && <Button size="sm" onClick={() => { setText(''); setResult(null); }}>Clear</Button>}
            </>
          }
        >
          <textarea
            className="ui-input ui-input--area mono"
            rows={10}
            spellCheck={false}
            value={text}
            placeholder={TEMPLATE}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
          />
        </Card>

        {parsed && (
          <Card
            title="Preview"
            actions={
              <Button
                variant="primary"
                loading={running}
                disabled={!slug || validation.valid.length === 0}
                onClick={run}
              >
                Import {validation.valid.length || ''} events
              </Button>
            }
          >
            <div className="stack">
              <div className="row-wrap">
                <Badge tone="success">{validation.valid.length} valid</Badge>
                {validation.invalid.length > 0 && (
                  <Badge tone="danger">{validation.invalid.length} skipped</Badge>
                )}
              </div>

              {validation.invalid.length > 0 && (
                <Notice tone="warning" title="Rows that will be skipped">
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {validation.invalid.slice(0, 8).map((item) => (
                      <li key={item.line}>Line {item.line}: {item.problem}</li>
                    ))}
                  </ul>
                </Notice>
              )}

              <DataTable
                columns={[
                  columns.text('event_name', 'Event'),
                  columns.text('event_date', 'Date'),
                  columns.text('start_time', 'Start'),
                  columns.text('end_time', 'End'),
                  columns.text('artist_name', 'Artist'),
                  columns.text('cover_charge', 'Cover'),
                ]}
                rows={validation.valid}
                rowKey={(_, index) => index}
                searchable={false}
                paginate={false}
                dense
              />

              {result && (
                <Notice tone="success" title="Imported">
                  {result.count} events were added to this business.
                </Notice>
              )}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
