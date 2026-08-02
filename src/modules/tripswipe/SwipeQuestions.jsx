/**
 * Trip Swipe onboarding questions.
 *
 * GET/POST /api/admin/setup-questions
 * PUT/DELETE /api/admin/setup-questions/:id
 * PUT /api/admin/setup-questions/reorder
 */

import { useState } from 'react';
import { Button } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { setupQuestionsResource } from '../../api/resources.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields } from '../../lib/fields.jsx';

const schema = {
  groups: [
    {
      title: 'Question',
      fields: [
        fields.textarea('question', 'Question text', { required: true, rows: 2 }),
        fields.select('question_type', 'Answer type', [
          { value: 'single', label: 'Pick one' },
          { value: 'multi', label: 'Pick several' },
          { value: 'text', label: 'Free text' },
          { value: 'scale', label: 'Scale' },
        ]),
        fields.tags('options', 'Options', {
          span: 'full',
          help: 'Comma-separated. Ignored for free-text questions.',
          visible: (values) => values.question_type !== 'text',
        }),
      ],
    },
    {
      title: 'Behaviour',
      fields: [
        fields.text('category', 'Category'),
        fields.sortOrder(),
        fields.bool('is_active', 'Active', { defaultValue: true }),
        fields.bool('is_required', 'Required'),
      ],
    },
  ],
};

export default function SwipeQuestions() {
  const toast = useToast();
  const [reordering, setReordering] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * Renumber sort_order to a clean 0..n-1 sequence. Useful after questions
   * have been added and deleted enough times that the numbers have gaps.
   */
  const normalizeOrder = async () => {
    setReordering(true);
    try {
      const rows = await setupQuestionsResource.list();
      const ordered = [...rows]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((row, index) => ({ id: row.id, sort_order: index }));
      await api.put(endpoints.setupQuestions.reorder(), { questions: ordered });
      toast.success('Question order renumbered.');
      setReloadKey((n) => n + 1);
    } catch (err) {
      toast.error(err);
    } finally {
      setReordering(false);
    }
  };

  return (
    <CrudSection
      key={reloadKey}
      title="Swipe questions"
      description="What new tourists are asked during onboarding. Answers drive their recommendations."
      resource={setupQuestionsResource}
      labelFor={(row) => row.question}
      createLabel="Add question"
      modalSize="lg"
      emptyTitle="No questions"
      emptyDescription="Add the questions shown when someone first opens Trip Swipe."
      searchPlaceholder="Search questions…"
      headerActions={
        <Button onClick={normalizeOrder} loading={reordering}>
          Renumber order
        </Button>
      }
      columns={[
        columns.number('sort_order', '#'),
        columns.primary('question', 'Question', 'category'),
        columns.text('question_type', 'Type'),
        columns.tags('options', 'Options'),
        columns.bool('is_active', 'Active'),
      ]}
      formSchema={schema}
      initialSort={{ key: 'sort_order', direction: 'asc' }}
    />
  );
}
