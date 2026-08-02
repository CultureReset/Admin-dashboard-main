/**
 * AI data organizer — turn unstructured notes into structured entity data.
 *
 * POST /api/admin/ai-organize            { raw_input, business_id, business_name }
 * POST /api/admin/gcr/parse-raw-data     { data_type, raw_data } → { parsed_items }
 * POST /api/admin/gcr/save-parsed-items  { entity_id, data_type, items }
 *
 * Two flows share this screen because they answer the same question: "I have a
 * blob of text, get it into the database."
 */

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, Notice, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { EntityPicker, useEntities } from '../../components/EntityPicker.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';

/** data_type values the parse route understands. */
const DATA_TYPES = [
  { value: 'menu', label: 'Menu items' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'happy_hour', label: 'Happy hour' },
  { value: 'events', label: 'Events' },
  { value: 'specials', label: 'Specials' },
  { value: 'hours', label: 'Hours' },
];

export default function AiOrganize() {
  const toast = useToast();
  const { entities } = useEntities();
  const [slug, setSlug] = useState(null);
  const [dataType, setDataType] = useState(DATA_TYPES[0].value);
  const [raw, setRaw] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState(null);
  const [organized, setOrganized] = useState(null);

  const entity = entities.find((e) => e.slug === slug) || null;

  const parse = async () => {
    if (!raw.trim()) {
      toast.warning('Paste some text to parse first.');
      return;
    }
    setParsing(true);
    setItems(null);
    try {
      const response = await api.post(endpoints.ai.parseRawData(), {
        data_type: dataType,
        raw_data: raw,
      });
      const parsed = response?.parsed_items || [];
      setItems(parsed);
      if (parsed.length === 0) toast.warning('The parser did not find any items in that text.');
      else toast.success(`Parsed ${parsed.length} items. Review them before saving.`);
    } catch (err) {
      toast.error(err);
    } finally {
      setParsing(false);
    }
  };

  const saveItems = async () => {
    if (!entity?.id) {
      toast.warning('Pick a business first — parsed items are saved against an entity id.');
      return;
    }
    setSaving(true);
    try {
      const response = await api.post(endpoints.ai.saveParsedItems(), {
        entity_id: entity.id,
        data_type: dataType,
        items,
      });
      toast.success(`Saved ${response?.saved ?? items.length} items to ${entity.name}.`);
      setItems(null);
      setRaw('');
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  const organize = async () => {
    if (!raw.trim()) {
      toast.warning('Paste some text first.');
      return;
    }
    setParsing(true);
    setOrganized(null);
    try {
      const response = await api.post(endpoints.ai.organize(), {
        raw_input: raw,
        business_id: entity?.id || null,
        business_name: entity?.name || null,
      });
      setOrganized(response);
      toast.success('Organized. Review the structured output below.');
    } catch (err) {
      toast.error(err);
    } finally {
      setParsing(false);
    }
  };

  // Build preview columns from the parsed items themselves.
  const previewColumns = items?.length
    ? Object.keys(items[0])
        .filter((key) => typeof items[0][key] !== 'object')
        .slice(0, 7)
        .map((key) => ({ key, header: key }))
    : [];

  return (
    <>
      <PageHeader
        title="AI data organizer"
        description="Paste unstructured business notes and turn them into rows the database understands."
      />

      <div className="stack">
        <Card title="Target">
          <div className="stack">
            <EntityPicker value={slug} onChange={setSlug} label="Business" />
            <div>
              <label className="ui-field__label" htmlFor="ai-data-type">Data type</label>
              <select
                id="ai-data-type"
                className="ui-input ui-input--select"
                style={{ maxWidth: 280 }}
                value={dataType}
                onChange={(e) => {
                  setDataType(e.target.value);
                  setItems(null);
                }}
              >
                {DATA_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card
          title="Raw text"
          subtitle="A pasted menu, a press release, an email — anything with the details in it."
          actions={
            <>
              <Button size="sm" loading={parsing} onClick={parse} disabled={!raw.trim()}>
                Parse into rows
              </Button>
              <Button size="sm" loading={parsing} onClick={organize} disabled={!raw.trim()}>
                Organize with AI
              </Button>
              {raw && <Button size="sm" onClick={() => { setRaw(''); setItems(null); setOrganized(null); }}>Clear</Button>}
            </>
          }
        >
          <textarea
            className="ui-input ui-input--area"
            rows={12}
            value={raw}
            placeholder="Paste the text here…"
            onChange={(e) => setRaw(e.target.value)}
          />
        </Card>

        {items && (
          <Card
            title="Parsed items"
            subtitle="Check these before writing them to the database."
            actions={
              <>
                <Badge tone="info">{items.length} items</Badge>
                <Button
                  size="sm"
                  variant="primary"
                  loading={saving}
                  disabled={!entity?.id || items.length === 0}
                  onClick={saveItems}
                >
                  Save to {entity?.name || 'business'}
                </Button>
              </>
            }
          >
            {items.length === 0 ? (
              <EmptyState icon="🤖" title="Nothing parsed" description="The text did not yield any rows." />
            ) : (
              <DataTable
                columns={previewColumns}
                rows={items}
                rowKey={(_, index) => index}
                searchable={false}
                paginate={false}
                dense
              />
            )}
            {!entity?.id && items.length > 0 && (
              <>
                <div style={{ height: 'var(--space-3)' }} />
                <Notice tone="warning">
                  Pick a business above before saving — the save route needs its entity id.
                </Notice>
              </>
            )}
          </Card>
        )}

        {organized && (
          <Card title="AI output" subtitle="Structured result from /api/admin/ai-organize.">
            <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, overflowX: 'auto' }}>
              {JSON.stringify(organized, null, 2)}
            </pre>
          </Card>
        )}
      </div>
    </>
  );
}
