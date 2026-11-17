/**
 * Trip Swipe onboarding questions.
 *
 * GET/POST /api/admin/setup-questions
 * PUT/DELETE /api/admin/setup-questions/:id
 * PUT /api/admin/setup-questions/reorder
 *
 * Read-only apart from ordering and delete. `tourist_setup_questions` on the
 * live database has question_text / question_type / options / sort_order /
 * is_active, but the API's POST and PUT write key / label / input_type /
 * required / active — columns that do not exist — so a create or a text edit
 * from here cannot succeed until routes/setup-questions.js is fixed. A PUT
 * carrying only `sort_order` touches a real column, which is what Renumber
 * sends.
 */

import { useState } from 'react';
import { Button, Notice } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { setupQuestionsResource } from '../../api/resources.js';
import { columns } from '../../lib/fields.jsx';

export default function SwipeQuestions() {
  const toast = useToast();
  const [reordering, setReordering] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * Renumber sort_order to a clean 0..n-1 sequence, one row at a time.
   *
   * The API has a bulk `PUT /api/admin/setup-questions/reorder`, but it is
   * registered *after* `PUT /:id` in routes/setup-questions.js. Express matches
   * in registration order, so a call to /reorder lands in the `:id` handler
   * with id="reorder" and silently updates nothing. Until that ordering is
   * fixed in the API, updating each row individually is the path that actually
   * works.
   */
  const normalizeOrder = async () => {
    setReordering(true);
    try {
      const rows = await setupQuestionsResource.list();
      const ordered = [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      let changed = 0;
      for (const [index, row] of ordered.entries()) {
        if (row.sort_order === index) continue;
        await setupQuestionsResource.update(row.id, { sort_order: index });
        changed += 1;
      }

      toast.success(
        changed === 0 ? 'Order was already sequential.' : `Renumbered ${changed} questions.`,
      );
      setReloadKey((n) => n + 1);
    } catch (err) {
      toast.error(err);
    } finally {
      setReordering(false);
    }
  };

  return (
    <CrudSection
      canCreate={false}
      canEdit={false}
      key={reloadKey}
      title="Swipe questions"
      description="What new tourists are asked during onboarding. Answers drive their recommendations."
      resource={setupQuestionsResource}
      labelFor={(row) => row.question_text || 'this question'}
      emptyTitle="No questions"
      emptyDescription="No onboarding questions are stored yet."
      searchPlaceholder="Search questions…"
      headerActions={
        <Button onClick={normalizeOrder} loading={reordering}>
          Renumber order
        </Button>
      }
      columns={[
        columns.number('sort_order', '#'),
        columns.primary('question_text', 'Question'),
        columns.text('question_type', 'Type'),
        columns.tags('options', 'Options'),
        columns.bool('is_active', 'Active'),
      ]}
      initialSort={{ key: 'sort_order', direction: 'asc' }}
    >
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Notice tone="warning" title="Adding and editing questions is unavailable">
          The API's create and update handlers for <code className="mono">/api/admin/setup-questions</code>{' '}
          write fields (<code>key</code>, <code>label</code>, <code>input_type</code>) that the questions
          table does not have, so they cannot save. Ordering and delete work.
        </Notice>
      </div>
    </CrudSection>
  );
}
