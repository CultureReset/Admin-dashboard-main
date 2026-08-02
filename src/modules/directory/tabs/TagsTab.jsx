/**
 * Entity Editor → Tags.
 *
 * entity_tags rows are replaced wholesale by the PATCH body's `tags` array.
 *
 * The API only replaces tags when the array is non-empty, so clearing every
 * tag is not something PATCH can express. That is stated in the UI rather
 * than papered over — a "save" that silently kept old tags would be worse.
 */

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Notice } from '../../../ui/primitives.jsx';
import './TagsTab.css';

/** tag_category values already present across the directory. */
const DEFAULT_CATEGORIES = ['amenity', 'cuisine', 'vibe', 'perfect-for', 'feature'];

export default function TagsTab({ record, patch, saving }) {
  const existing = useMemo(() => record?.tags || [], [record]);
  const [tags, setTags] = useState([]);
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);

  useEffect(() => {
    setTags(
      existing.map((tag) => ({
        tag_name: tag.tag_name ?? String(tag),
        tag_category: tag.tag_category ?? null,
      })),
    );
  }, [existing]);

  // Offer every category already in use, plus the common defaults.
  const categories = useMemo(() => {
    const seen = new Set(DEFAULT_CATEGORIES);
    for (const tag of existing) if (tag.tag_category) seen.add(tag.tag_category);
    return [...seen];
  }, [existing]);

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (tags.some((t) => t.tag_name.toLowerCase() === name.toLowerCase() && t.tag_category === category)) {
      setDraft('');
      return;
    }
    setTags((prev) => [...prev, { tag_name: name, tag_category: category }]);
    setDraft('');
  };

  const removeTag = (index) => setTags((prev) => prev.filter((_, i) => i !== index));

  const grouped = useMemo(() => {
    const map = new Map();
    tags.forEach((tag, index) => {
      const key = tag.tag_category || 'uncategorised';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ ...tag, index });
    });
    return [...map.entries()];
  }, [tags]);

  const dirty = JSON.stringify(tags) !== JSON.stringify(
    existing.map((t) => ({ tag_name: t.tag_name ?? String(t), tag_category: t.tag_category ?? null })),
  );

  return (
    <Card
      title="Tags"
      subtitle="Amenities, cuisines, and vibes used for filtering and search."
      actions={
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty || tags.length === 0}
          loading={saving}
          onClick={() => patch({ tags })}
        >
          Save tags
        </Button>
      }
    >
      <div className="stack">
        <div className="tags-add">
          <input
            className="ui-input"
            value={draft}
            placeholder="Tag name"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <select
            className="ui-input ui-input--select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <Button onClick={add} disabled={!draft.trim()}>Add tag</Button>
        </div>

        {tags.length === 0 ? (
          <Notice tone="warning" title="No tags">
            This entity has no tags. Note that the API replaces tags only when at least one is sent —
            saving an empty list will not clear existing tags on the server.
          </Notice>
        ) : (
          grouped.map(([groupName, groupTags]) => (
            <div key={groupName} className="tags-group">
              <div className="tags-group__label">{groupName}</div>
              <div className="tags-group__list">
                {groupTags.map((tag) => (
                  <span className="tag-chip" key={`${tag.tag_category}-${tag.tag_name}-${tag.index}`}>
                    {tag.tag_name}
                    <button type="button" onClick={() => removeTag(tag.index)} aria-label={`Remove ${tag.tag_name}`}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}

        {dirty && (
          <p className="muted">
            <Badge tone="warning">Unsaved</Badge> {tags.length} tag{tags.length === 1 ? '' : 's'} pending.
          </p>
        )}
      </div>
    </Card>
  );
}
