/**
 * Bulk upload.
 *
 * Parses a CSV in the browser, previews it, then posts each row to the import
 * route for the chosen target. The API's import routes each take a specific
 * body shape, so the target descriptors below own that mapping.
 *
 * POST /api/admin/gcr/import-entity | import-master | import-menu |
 *      import-events | import-specials | import-photos | import-gcr-items
 */

import { useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { parseCsv, compactRow, toBoolean, readFileText } from '../../lib/csv.js';

/**
 * Each target says where rows go and how a CSV row becomes a request body.
 * `perRow: false` means the whole file is sent in one request.
 */
const TARGETS = [
  {
    id: 'entities',
    label: 'Businesses',
    path: () => endpoints.imports.entity(),
    requiresEntity: false,
    perRow: true,
    columnsHint: 'slug, name, entity_type, entity_subtype, description, phone, website_url, city, state, hero_image_url',
    build: (row) => ({
      entity: compactRow({
        ...row,
        is_active: row.is_active === '' ? true : toBoolean(row.is_active),
        featured: toBoolean(row.featured),
        rating: row.rating ? Number(row.rating) : undefined,
      }),
    }),
    validate: (row) => (!row.slug || !row.name ? 'slug and name are required' : null),
  },
  {
    id: 'menu',
    label: 'Menu items',
    path: () => endpoints.imports.menu(),
    requiresEntity: true,
    perRow: false,
    columnsHint: 'section_name, item_name, description, price',
    // import-menu takes { entity_slug, sections: [{ section_name, items: [] }] }
    buildBatch: (rows, slug) => {
      const bySection = new Map();
      for (const row of rows) {
        const name = row.section_name || 'Menu';
        if (!bySection.has(name)) bySection.set(name, []);
        bySection.get(name).push(
          compactRow({
            item_name: row.item_name,
            description: row.description,
            price: row.price ? Number(row.price) : undefined,
          }),
        );
      }
      return {
        entity_slug: slug,
        sections: [...bySection.entries()].map(([section_name, items], index) => ({
          section_name,
          sort_order: index,
          items,
        })),
      };
    },
    validate: (row) => (!row.item_name ? 'item_name is required' : null),
  },
  {
    id: 'drinks',
    label: 'Drinks',
    path: () => endpoints.imports.drinks(),
    requiresEntity: true,
    perRow: false,
    columnsHint: 'section_name, item_name, description, price',
    buildBatch: (rows, slug) => {
      const bySection = new Map();
      for (const row of rows) {
        const name = row.section_name || 'Drinks';
        if (!bySection.has(name)) bySection.set(name, []);
        bySection.get(name).push(
          compactRow({
            item_name: row.item_name,
            description: row.description,
            price: row.price ? Number(row.price) : undefined,
          }),
        );
      }
      return {
        entity_slug: slug,
        sections: [...bySection.entries()].map(([section_name, items], index) => ({
          section_name,
          sort_order: index,
          items,
        })),
      };
    },
    validate: (row) => (!row.item_name ? 'item_name is required' : null),
  },
  {
    id: 'events',
    label: 'Events',
    path: () => endpoints.imports.events(),
    requiresEntity: true,
    perRow: false,
    columnsHint: 'event_name, description, event_date, start_time, end_time, artist_name, cover_charge',
    buildBatch: (rows, slug) => ({
      entity_slug: slug,
      events: rows.map((row) =>
        compactRow({
          ...row,
          recurring: toBoolean(row.recurring),
          cover_charge: row.cover_charge ? Number(row.cover_charge) : undefined,
        }),
      ),
    }),
    validate: (row) => (!row.event_name ? 'event_name is required' : null),
  },
  {
    id: 'specials',
    label: 'Specials',
    path: () => endpoints.imports.specials(),
    requiresEntity: true,
    perRow: false,
    columnsHint: 'special_name, description, discount_text, days, start_time, end_time',
    buildBatch: (rows, slug) => ({
      entity_slug: slug,
      specials: rows.map((row) => compactRow(row)),
    }),
    validate: (row) => (!row.special_name ? 'special_name is required' : null),
  },
  {
    id: 'photos',
    label: 'Photos',
    path: () => endpoints.imports.photos(),
    requiresEntity: true,
    perRow: false,
    columnsHint: 'url, caption, is_cover, sort_order',
    buildBatch: (rows, slug) => ({
      entity_slug: slug,
      photos: rows.map((row, index) =>
        compactRow({
          url: row.url,
          caption: row.caption,
          is_cover: toBoolean(row.is_cover),
          sort_order: row.sort_order ? Number(row.sort_order) : index,
        }),
      ),
    }),
    validate: (row) => (!row.url ? 'url is required' : null),
  },
];

export default function BulkUpload() {
  const toast = useToast();
  const fileInput = useRef(null);
  const [targetId, setTargetId] = useState(TARGETS[0].id);
  const [slug, setSlug] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const target = TARGETS.find((t) => t.id === targetId) || TARGETS[0];

  const validation = useMemo(() => {
    if (!parsed) return { valid: [], invalid: [] };
    const valid = [];
    const invalid = [];
    parsed.rows.forEach((row, index) => {
      const problem = target.validate?.(row);
      if (problem) invalid.push({ line: index + 2, problem, row });
      else valid.push(row);
    });
    return { valid, invalid };
  }, [parsed, target]);

  const pickFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setResult(null);
    try {
      const text = await readFileText(file);
      const data = parseCsv(text);
      if (data.rows.length === 0) {
        toast.warning('That file has a header but no data rows.');
      }
      setParsed(data);
      setFileName(file.name);
    } catch (err) {
      toast.error(err.message || 'Could not read the file');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const run = async () => {
    if (target.requiresEntity && !slug) {
      toast.warning('Pick a business first — this import attaches rows to one listing.');
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      if (target.perRow) {
        // One request per row, so a single bad row does not lose the batch.
        let ok = 0;
        const failures = [];
        for (const [index, row] of validation.valid.entries()) {
          try {
            await api.post(target.path(), target.build(row, slug));
            ok += 1;
          } catch (err) {
            failures.push({ line: index + 2, message: err.message });
          }
        }
        setResult({ imported: ok, failures });
        if (failures.length === 0) toast.success(`Imported ${ok} rows.`);
        else toast.warning(`Imported ${ok} rows, ${failures.length} failed.`);
      } else {
        const payload = target.buildBatch(validation.valid, slug);
        const response = await api.post(target.path(), payload);
        setResult({ imported: response?.count ?? validation.valid.length, failures: [], response });
        toast.success(`Imported ${response?.count ?? validation.valid.length} rows.`);
      }
    } catch (err) {
      toast.error(err);
      setResult({ imported: 0, failures: [{ line: '—', message: err.message }] });
    } finally {
      setRunning(false);
    }
  };

  const previewColumns = (parsed?.headers || []).slice(0, 8).map((header) => ({
    key: header,
    header,
  }));

  return (
    <>
      <PageHeader
        title="Bulk upload"
        description="Import businesses, menus, events, specials, and photos from a CSV."
      />

      <div className="stack">
        <Card title="1 · What are you importing?">
          <div className="stack">
            <div className="row-wrap">
              {TARGETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ui-multi__chip ${item.id === targetId ? 'is-active' : ''}`}
                  onClick={() => {
                    setTargetId(item.id);
                    setResult(null);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <Notice tone="info" title="Expected columns">
              <code className="mono">{target.columnsHint}</code>
              <p style={{ marginTop: 6 }}>
                Extra columns are passed through. Empty cells are skipped so they do not overwrite
                existing values.
              </p>
            </Notice>

            {target.requiresEntity && (
              <EntityPicker
                value={slug}
                onChange={setSlug}
                label="Attach to business"
              />
            )}
          </div>
        </Card>

        <Card
          title="2 · Choose a file"
          actions={
            <>
              <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={pickFile} />
              <Button size="sm" variant="primary" onClick={() => fileInput.current?.click()}>
                Select CSV
              </Button>
              {parsed && (
                <Button size="sm" onClick={() => { setParsed(null); setFileName(''); setResult(null); }}>
                  Clear
                </Button>
              )}
            </>
          }
        >
          {!parsed ? (
            <p className="muted">No file selected.</p>
          ) : (
            <div className="stack">
              <div className="row-wrap">
                <Badge tone="info">{fileName}</Badge>
                <Badge>{parsed.rows.length} rows</Badge>
                <Badge>{parsed.headers.length} columns</Badge>
              </div>

              <div className="grid-auto">
                <Stat label="Ready to import" value={validation.valid.length} tone="success" />
                <Stat
                  label="Will be skipped"
                  value={validation.invalid.length}
                  tone={validation.invalid.length ? 'danger' : 'neutral'}
                />
              </div>

              {validation.invalid.length > 0 && (
                <Notice tone="warning" title={`${validation.invalid.length} rows will be skipped`}>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {validation.invalid.slice(0, 8).map((item) => (
                      <li key={item.line}>Line {item.line}: {item.problem}</li>
                    ))}
                  </ul>
                  {validation.invalid.length > 8 && <p>…and {validation.invalid.length - 8} more.</p>}
                </Notice>
              )}

              <DataTable
                columns={previewColumns}
                rows={parsed.rows.slice(0, 200)}
                rowKey={(_, index) => index}
                searchable={false}
                paginate={false}
                dense
                emptyTitle="No rows"
              />
              {parsed.rows.length > 200 && (
                <p className="faint">Previewing the first 200 of {parsed.rows.length} rows. All rows will be imported.</p>
              )}
            </div>
          )}
        </Card>

        <Card
          title="3 · Import"
          actions={
            <Button
              variant="primary"
              loading={running}
              disabled={!parsed || validation.valid.length === 0}
              onClick={run}
            >
              Import {validation.valid.length || ''} rows
            </Button>
          }
        >
          {!result ? (
            <p className="muted">Nothing imported yet.</p>
          ) : (
            <div className="stack">
              <Notice tone={result.failures.length ? 'warning' : 'success'} title="Import finished">
                {result.imported} rows imported
                {result.failures.length ? `, ${result.failures.length} failed.` : '.'}
              </Notice>
              {result.failures.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18 }} className="muted">
                  {result.failures.slice(0, 12).map((failure, index) => (
                    <li key={index}>Line {failure.line}: {failure.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
