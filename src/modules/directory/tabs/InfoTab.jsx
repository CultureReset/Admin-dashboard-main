/**
 * Entity Editor → Info.
 *
 * Renders the entity field schema and PATCHes only the `entity` block.
 */

import { SchemaForm } from '../../../ui/SchemaForm.jsx';
import { Card } from '../../../ui/primitives.jsx';
import { entityInfoSchema, pickEntityFields } from '../entitySchema.js';

export default function InfoTab({ entity, patch }) {
  return (
    <Card
      title="Business information"
      subtitle="Written to the entity row. Fields left blank are stored as empty."
    >
      <SchemaForm
        schema={entityInfoSchema}
        initialValues={entity}
        onSubmit={(values) => patch({ entity: pickEntityFields(values) })}
        submitLabel="Save information"
      />
    </Card>
  );
}
