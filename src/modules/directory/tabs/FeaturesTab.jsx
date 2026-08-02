/**
 * Entity Editor → Features.
 *
 * The boolean columns on `entity`, grouped. Rendered from FEATURE_FLAGS in
 * entitySchema.js, so adding a flag to the schema adds it to this screen.
 */

import { useEffect, useState } from 'react';
import { Button, Card } from '../../../ui/primitives.jsx';
import { FEATURE_FLAGS, FEATURE_FLAG_NAMES } from '../entitySchema.js';
import './FeaturesTab.css';

export default function FeaturesTab({ entity, patch, saving }) {
  const [flags, setFlags] = useState({});

  useEffect(() => {
    const next = {};
    for (const name of FEATURE_FLAG_NAMES) next[name] = Boolean(entity?.[name]);
    setFlags(next);
  }, [entity]);

  const toggle = (name) => setFlags((prev) => ({ ...prev, [name]: !prev[name] }));

  const dirty = FEATURE_FLAG_NAMES.some((name) => flags[name] !== Boolean(entity?.[name]));

  return (
    <Card
      title="Features"
      subtitle="Boolean flags on the entity row. These drive filters on the public site."
      actions={
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty}
          loading={saving}
          onClick={() => patch({ entity: flags })}
        >
          Save features
        </Button>
      }
    >
      <div className="features">
        {FEATURE_FLAGS.map((group) => (
          <div className="features__group" key={group.title}>
            <div className="features__title">{group.title}</div>
            <div className="features__list">
              {group.flags.map(([name, label]) => (
                <button
                  type="button"
                  key={name}
                  className={`features__chip ${flags[name] ? 'is-on' : ''}`}
                  onClick={() => toggle(name)}
                  aria-pressed={Boolean(flags[name])}
                >
                  <span className="features__dot" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
