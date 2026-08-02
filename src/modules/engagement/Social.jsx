/**
 * Social posts and the home-feed cards built from them.
 *
 * GET/POST /api/admin/social-posts, PUT/DELETE /api/admin/social-posts/:id
 * POST /api/admin/social-posts/scrape { urls, entity_slug, card_type, show_on_home }
 */

import { useState } from 'react';
import { Badge, Button, Notice, PageHeader } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { socialPostsResource } from '../../api/resources.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields } from '../../lib/fields.jsx';

const CARD_TYPES = [
  { value: 'post', label: 'Post' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
];

const postSchema = {
  groups: [
    {
      title: 'Post',
      fields: [
        fields.text('entity_slug', 'Business slug', {
          required: true,
          help: 'Use the scraper below to fill this in automatically.',
        }),
        fields.select('card_type', 'Card type', CARD_TYPES),
        fields.url('post_url', 'Post URL', { span: 2 }),
        fields.image('image_url', 'Image URL'),
        fields.textarea('caption', 'Caption', { rows: 3 }),
      ],
    },
    {
      title: 'Placement',
      fields: [
        fields.bool('show_on_home', 'Show on home feed', { defaultValue: true }),
        fields.sortOrder(),
        fields.datetime('posted_at', 'Posted at'),
      ],
    },
  ],
};

export default function Social() {
  const toast = useToast();
  const [scraping, setScraping] = useState(false);
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [slug, setSlug] = useState(null);
  const [urls, setUrls] = useState('');
  const [cardType, setCardType] = useState('post');
  const [showOnHome, setShowOnHome] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [scrapeResult, setScrapeResult] = useState(null);

  const runScrape = async () => {
    const list = urls
      .split(/[\n,]/)
      .map((url) => url.trim())
      .filter(Boolean);
    if (list.length === 0) {
      toast.warning('Paste at least one post URL.');
      return;
    }
    setScraping(true);
    setScrapeResult(null);
    try {
      const response = await api.post(endpoints.socialPosts.scrape(), {
        urls: list,
        entity_slug: slug || undefined,
        card_type: cardType,
        show_on_home: showOnHome,
      });
      setScrapeResult(response);
      toast.success(`Processed ${response?.processed ?? list.length} URLs.`);
      setReloadKey((n) => n + 1);
    } catch (err) {
      toast.error(err);
    } finally {
      setScraping(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Social & connections"
        description="Posts pulled from social accounts and surfaced on the GCR home feed."
        actions={
          <Button variant="primary" onClick={() => setScrapeOpen(true)}>
            Scrape post URLs
          </Button>
        }
      />

      <CrudSection
        key={reloadKey}
        title="Social posts"
        resource={socialPostsResource}
        labelFor={(row) => row.caption?.slice(0, 40) || row.post_url || 'Post'}
        createLabel="Add post"
        modalSize="lg"
        emptyTitle="No social posts"
        emptyDescription="Scrape some post URLs to populate the feed."
        searchPlaceholder="Search posts…"
        columns={[
          columns.thumb('image_url'),
          {
            key: 'caption',
            header: 'Post',
            render: (row) => (
              <div>
                <div className="ui-cell-primary truncate" style={{ maxWidth: 340 }}>
                  {row.caption || <span className="faint">No caption</span>}
                </div>
                <div className="ui-cell-sub mono">{row.entity_slug}</div>
              </div>
            ),
          },
          columns.text('card_type', 'Type'),
          columns.link('post_url', 'Source', { label: 'View' }),
          {
            key: 'show_on_home',
            header: 'Home feed',
            render: (row) =>
              row.show_on_home ? <Badge tone="success">Shown</Badge> : <Badge>Hidden</Badge>,
          },
          columns.dateTime('posted_at', 'Posted'),
        ]}
        formSchema={postSchema}
        initialSort={{ key: 'posted_at', direction: 'desc' }}
      />

      <Modal
        open={scrapeOpen}
        onClose={() => setScrapeOpen(false)}
        size="lg"
        title="Scrape social posts"
        description="Fetches each URL and stores the post with its image and caption."
        footer={
          <>
            <div className="spacer" />
            <Button variant="ghost" onClick={() => setScrapeOpen(false)}>Close</Button>
            <Button variant="primary" loading={scraping} onClick={runScrape}>
              Scrape
            </Button>
          </>
        }
      >
        <div className="stack">
          <EntityPicker value={slug} onChange={setSlug} label="Attach to business (optional)" />

          <div>
            <label className="ui-field__label" htmlFor="social-urls">Post URLs</label>
            <textarea
              id="social-urls"
              className="ui-input ui-input--area mono"
              rows={7}
              value={urls}
              placeholder={'https://instagram.com/p/…\nhttps://facebook.com/…'}
              onChange={(e) => setUrls(e.target.value)}
            />
            <p className="ui-field__help">One per line, or comma-separated.</p>
          </div>

          <div className="row-wrap">
            <div>
              <label className="ui-field__label" htmlFor="social-card-type">Card type</label>
              <select
                id="social-card-type"
                className="ui-input ui-input--select"
                value={cardType}
                onChange={(e) => setCardType(e.target.value)}
              >
                {CARD_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <label className="row" style={{ gap: 6, fontSize: 13, alignSelf: 'flex-end', paddingBottom: 8 }}>
              <input
                type="checkbox"
                checked={showOnHome}
                onChange={(e) => setShowOnHome(e.target.checked)}
              />
              <span>Show on home feed</span>
            </label>
          </div>

          {scrapeResult && (
            <Notice tone="success" title={`Processed ${scrapeResult.processed ?? 0} URLs`}>
              <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0', maxHeight: 220, overflow: 'auto' }}>
                {JSON.stringify(scrapeResult.results ?? scrapeResult, null, 2)}
              </pre>
            </Notice>
          )}
        </div>
      </Modal>
    </>
  );
}
