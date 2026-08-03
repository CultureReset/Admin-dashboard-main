/**
 * Structured listing data for one business — the fields a guest searches on.
 *
 * `entity` holds the things every business has: name, phone, hours, hero
 * image. It does not hold "3 bedrooms, 3 baths, gulf front" or "48ft with a
 * head and AC", because those are specific to an industry and to a specific
 * unit or boat. That is what this edits.
 *
 * The form is not written here. It is built from the blueprint the API serves
 * for this business's industry, so adding a field to
 * `routes/industry-blueprints.js` makes it appear in the form — there is no
 * second list to keep in step, and no way for the form to ask for a field the
 * API would reject.
 *
 * Units get their own form each, because that is where the searchable facts
 * actually live: "two bedroom two bath" is a fact about unit 708, not about
 * the Phoenix West building.
 *
 * GET/PUT /api/admin/platform/attributes/:slug
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, Stat } from '../../ui/primitives.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { TabBar } from '../../ui/Tabs.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { fields as f } from '../../lib/fields.jsx';

/** Blueprint field descriptor → SchemaForm field descriptor. */
function toFormField(field) {
    const extra = {
        help: [
            field.unit ? `In ${field.unit}.` : null,
            field.search === 'min' ? 'Guests filter on “at least this”.'
                : field.search === 'max' ? 'Guests filter on “at most this”.'
                    : field.search === 'has' ? 'Guests filter on this being true.'
                        : field.search === 'any' ? 'Guests filter on any of these.'
                            : field.search === 'eq' ? 'Guests filter on an exact match.'
                                : null,
        ].filter(Boolean).join(' ') || undefined,
        required: field.required || undefined,
    };

    switch (field.type) {
        case 'number':
            return f.number(field.key, field.label, { min: 0, step: field.step || 1, ...extra });
        case 'bool':
            return f.bool(field.key, field.label, extra);
        case 'time':
            return f.time(field.key, field.label, extra);
        case 'select':
            return f.select(
                field.key,
                field.label,
                [{ value: '', label: '—' }, ...(field.options || []).map((o) => ({ value: o, label: prettify(o) }))],
                extra,
            );
        case 'multi':
            // Rendered as tags rather than a multi-select: the option lists run
            // to twenty amenities and a tag input is the only control that
            // stays usable on a phone.
            return f.tags(field.key, field.label, {
                ...extra,
                help: `${extra.help || ''} Options: ${(field.options || []).map(prettify).join(', ')}`.trim(),
            });
        default:
            return f.text(field.key, field.label, extra);
    }
}

function prettify(value) {
    return String(value).replace(/_/g, ' ');
}

/** Blueprint fields → SchemaForm groups, preserving the blueprint's grouping. */
function toSchema(fieldList) {
    const groups = [];
    for (const field of fieldList) {
        const title = field.group || 'Details';
        let group = groups.find((g) => g.title === title);
        if (!group) {
            group = { title, fields: [] };
            groups.push(group);
        }
        group.fields.push(toFormField(field));
    }
    return { groups };
}

/** Stored value → form value. Multi comes back as an array, tags wants one. */
function toFormValues(fieldList, stored) {
    const out = {};
    for (const field of fieldList) {
        const value = stored ? stored[field.key] : undefined;
        if (value === undefined || value === null) {
            out[field.key] = field.type === 'multi' ? [] : field.type === 'bool' ? false : '';
        } else {
            out[field.key] = value;
        }
    }
    return out;
}

export default function AttributesPanel({ slug }) {
    const toast = useToast();
    const [target, setTarget] = useState('listing');

    const query = useAsync(
        async () => (slug ? api.get(endpoints.bookingPlatform.attributes(slug)) : null),
        [slug],
        { initialData: null },
    );

    const data = query.data;

    const listingFields = useMemo(
        () => (data?.fields || []).filter((x) => x.applies === 'listing'),
        [data],
    );
    const unitFields = useMemo(
        () => (data?.fields || []).filter((x) => x.applies === 'unit'),
        [data],
    );

    const units = data?.units || [];
    const activeUnit = target === 'listing' ? null : units.find((u) => u.entity_slug === target) || null;
    const activeFields = activeUnit ? unitFields : listingFields;
    const activeSlug = activeUnit ? activeUnit.entity_slug : slug;
    const activeStored = activeUnit ? activeUnit.attributes : data?.attributes;

    const save = async (values) => {
        const body = {};
        for (const field of activeFields) {
            const value = values[field.key];
            // '' and [] mean "clear it"; the API deletes the row rather than
            // storing an empty one, which keeps `missing_required` honest.
            if (value === '' || value === undefined || (Array.isArray(value) && value.length === 0)) {
                body[field.key] = null;
            } else {
                body[field.key] = value;
            }
        }
        const result = await api.put(endpoints.bookingPlatform.attributes(activeSlug), { attributes: body });
        toast.success(
            `${result.written} field${result.written === 1 ? '' : 's'} saved` +
            (result.cleared ? `, ${result.cleared} cleared` : '') + '.',
        );
        query.reload();
    };

    if (!slug) {
        return <EmptyState icon="📋" title="No business selected" description="Pick a business to edit its listing data." />;
    }
    if (query.loading && !data) return <LoadingBlock />;
    if (query.error) return <ErrorState error={query.error} onRetry={query.reload} />;
    if (!data) return null;

    if (activeFields.length === 0 && units.length === 0) {
        return (
            <EmptyState
                icon="🏷️"
                title={`No blueprint for “${data.vertical}”`}
                description="This industry has no structured fields defined yet. Add them to routes/industry-blueprints.js and they appear here."
            />
        );
    }

    const filled = Object.keys(activeStored || {}).length;
    const missing = data.missing_required || [];

    return (
        <>
            <Notice tone="info" title="This is what a guest actually searches on">
                <p>
                    &ldquo;A two bedroom two bath on these nights&rdquo; and &ldquo;a charter for
                    eight, eight hours, 45ft with AC&rdquo; are questions about these fields.
                    Nothing else in the database can answer them.
                </p>
                <p style={{ marginTop: 8 }}>
                    Try them in <Link to="/booking/match">Find a Match</Link> once they are filled in.
                </p>
            </Notice>

            <div style={{ height: 'var(--space-4)' }} />

            <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
                <Stat label="Industry" value={data.vertical} />
                <Stat label="Fields on file" value={filled} tone={filled ? 'success' : 'warning'} />
                <Stat
                    label="Required still blank"
                    value={missing.length}
                    tone={missing.length ? 'warning' : 'success'}
                    hint={missing.length ? missing.map((m) => m.label).join(', ') : undefined}
                />
                {units.length > 0 && <Stat label={`${data.unit_label}s`} value={units.length} tone="primary" />}
            </div>

            {units.length > 0 && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <TabBar
                        tabs={[
                            { id: 'listing', label: 'The property', badge: Object.keys(data.attributes || {}).length },
                            ...units.map((u) => ({
                                id: u.entity_slug,
                                label: u.entity_name || u.entity_slug,
                                badge: Object.keys(u.attributes || {}).length,
                            })),
                        ]}
                        activeId={target}
                        onChange={setTarget}
                    />
                </div>
            )}

            {activeFields.length === 0 ? (
                <EmptyState
                    icon="📄"
                    title={activeUnit ? 'No per-unit fields for this industry' : 'No property-level fields'}
                    description="Everything for this industry is recorded at the other level."
                />
            ) : (
                <Card
                    title={activeUnit ? activeUnit.entity_name : data.entity_name}
                    subtitle={
                        activeUnit
                            ? `${data.unit_label} · these are the fields guests filter on`
                            : 'Fields that describe the property as a whole'
                    }
                    actions={
                        <Button size="sm" onClick={query.reload} loading={query.loading}>Reload</Button>
                    }
                >
                    <SchemaForm
                        // Re-key on the target so switching unit re-seeds the
                        // form instead of leaving the previous unit's values in
                        // the inputs.
                        key={activeSlug}
                        schema={toSchema(activeFields)}
                        initialValues={toFormValues(activeFields, activeStored)}
                        submitLabel="Save listing data"
                        onSubmit={save}
                    />
                </Card>
            )}

            {activeFields.some((x) => x.search) && (
                <>
                    <div style={{ height: 'var(--space-4)' }} />
                    <Card title="What guests can filter on" subtitle="Everything else is stored and shown, not searched.">
                        <div className="row-wrap" style={{ gap: 6 }}>
                            {activeFields.filter((x) => x.search).map((x) => (
                                <Badge key={x.key} tone="info" title={`${x.search} · ${x.type}`}>
                                    {x.label}
                                </Badge>
                            ))}
                        </div>
                    </Card>
                </>
            )}
        </>
    );
}
