/**
 * Trip Swipe onboarding questions.
 *
 * GET/POST /api/admin/setup-questions
 * PUT/DELETE /api/admin/setup-questions/:id
 * PUT /api/admin/setup-questions/reorder
 *
 * `tourist_setup_questions` on the live database: question_text,
 * question_type, options (jsonb), sort_order, is_active. The API writes only
 * those columns and requires question_text. A blank sort_order on create is
 * stored as 100 by the API (the end of the list).
 */

import { useState } from 'react';
import { Badge, Button } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { setupQuestionsResource } from '../../api/resources.js';
import { blankToNull, columns, fields, notBlank } from '../../lib/fields.jsx';

// Options is jsonb. It is edited as JSON so whatever shape a question already
// has (a list of strings, or {value,label} objects) survives an edit untouched.
const schema = [
  fields.textarea('question_text', 'Question', {
    required: true,
    rows: 2,
    validate: notBlank('Question is required'),
  }),
  fields.text('question_type', 'Type', {
    placeholder: 'text',
    help: 'How the answer is collected, e.g. text, single_choice, multi_select, daterange.',
  }),
  fields.sortOrder(),
  fields.json('options', 'Options', {
    rows: 5,
    placeholder: '["Beach", "Food", "Nightlife"]',
    help: 'Choices for single_choice / multi_select questions, as a JSON list. Leave blank for none.',
    validate: (value) => {
      if (value == null || (typeof value === 'string' && !value.trim())) return null;
      if (typeof value === 'string') {
        try {
          return Array.isArray(JSON.parse(value)) ? null : 'Options must be a JSON list, e.g. ["a", "b"].';
        } catch {
          return null; // reported as "Not valid JSON" by the form
        }
      }
      return Array.isArray(value) ? null : 'Options must be a JSON list, e.g. ["a", "b"].';
    },
  }),
  fields.bool('is_active', 'Active', { defaultValue: true }),
];

export default function SwipeQuestions() {
  const toast = useToast();
  const [reordering, setReordering] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * Renumber sort_order to a clean 0..n-1 sequence, one row at a time.
   *
   * Row by row on purpose: it works whether or not the deployed API has the
   * bulk `PUT /reorder` ahead of `PUT /:id` (it used to be shadowed by it), and
   * it keeps the existing 0..n-1 numbering rather than the bulk route's steps
   * of ten.
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
      createLabel="Add question"
      key={reloadKey}
      title="Swipe questions"
      description="What new tourists are asked during onboarding. Answers drive their recommendations."
      resource={setupQuestionsResource}
      labelFor={(row) => row.question_text || 'this question'}
      emptyTitle="No questions"
      emptyDescription="Add the first onboarding question."
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
        {
          ...columns.tags('options', 'Options'),
          searchable: false,
          render: (row) => {
            const list = Array.isArray(row.options) ? row.options : [];
            if (list.length === 0) return <span className="faint">—</span>;
            const label = (o) => (o && typeof o === 'object' ? o.label ?? o.value ?? '' : String(o));
            return (
              <span className="row-wrap" style={{ gap: 4 }}>
                {list.slice(0, 4).map((o, i) => (
                  <Badge key={i}>{label(o)}</Badge>
                ))}
                {list.length > 4 && <span className="faint">+{list.length - 4}</span>}
              </span>
            );
          },
        },
        columns.bool('is_active', 'Active'),
      ]}
      formSchema={schema}
      fromFormValues={blankToNull}
      initialSort={{ key: 'sort_order', direction: 'asc' }}
    />
  );
}
