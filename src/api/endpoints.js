/**
 * Endpoint registry — the single source of truth for every API path the
 * dashboard uses.
 *
 * No component builds a URL by hand. Each entry is a function of its
 * parameters, so a route change in gcr-api-clean is a one-line edit here
 * rather than a search across sixty section modules.
 *
 * Paths are relative to the configured API base (src/config/env.js) and
 * mirror the routers mounted in gcr-api-clean/server.js:
 *
 *   /api/admin        → routes/admin.js
 *   /api/admin/tourists      → routes/admin-tourists.js
 *   /api/admin/setup-questions → routes/setup-questions.js
 *   /api/gcr          → routes/gcr.js
 *   /api/qr           → routes/qr.js
 *   /api/sms          → routes/sms.js
 *   /api/ar-hunts     → routes/ar-hunts.js
 *   /api/artists      → routes/artists.js
 *   /api/apps         → routes/apps.js
 *   /api/bookings     → routes/bookings.js
 *   /api/reviews      → routes/reviews.js
 *   /api/analytics    → routes/analytics.js
 *   /api/menu-editor  → routes/menu-editor.js
 *   /api/ai-provider  → routes/ai-provider.js
 *   /api/update       → routes/update-link.js
 *   /api/platform     → routes/platform.js
 *   /api/cooperatives → routes/cooperatives.js
 *
 * `UNVERIFIED` marks paths the legacy admin.html calls that have no matching
 * route in the gcr-api-clean checkout. They are wired exactly as the legacy
 * dashboard called them so they start working the moment the API grows them,
 * and the modules that use them surface an honest "endpoint unavailable"
 * state instead of failing silently. See docs/ENDPOINT-STATUS.md.
 */

const ADMIN = '/api/admin';
const GCR = '/api/gcr';

/** Encode a path segment so slugs/ids with odd characters stay valid. */
const seg = (value) => encodeURIComponent(String(value ?? ''));

export const endpoints = {
  // ---------------------------------------------------------------- auth ---
  auth: {
    login: () => `${ADMIN}/login`,
    /** Cheap authenticated GET used to prove a token is real and admin-role. */
    verify: () => `${ADMIN}/gcr/claims?limit=1`,
    users: () => `${ADMIN}/users`,
  },

  // ------------------------------------------------------------ entities ---
  entities: {
    list: () => `${ADMIN}/gcr/entities`,
    detail: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}`,
    create: () => `${ADMIN}/gcr/entities`,
    update: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}`,
    patch: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}`,
    remove: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}`,
    hours: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/hours`,
    happyHour: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/happy-hour`,
    availability: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/availability`,
    photos: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/photos`,
    photo: (id) => `${ADMIN}/gcr/photos/${seg(id)}`,
    uploadImage: () => `${ADMIN}/gcr/upload-image`,
    reindex: (slug) => `${ADMIN}/gcr/reindex/${seg(slug)}`,
    /** Public read model — richer than the admin detail payload. */
    publicDetail: (slug) => `${GCR}/entity/${seg(slug)}`,
    publicList: () => `${GCR}/entities`,
    children: (parentSlug) => `${GCR}/entities/${seg(parentSlug)}/children`,
    taxonomy: () => `${GCR}/taxonomy`,
  },

  // -------------------------------------------------------------- menus ---
  menu: {
    sections: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/menu-sections`,
    section: (id) => `${ADMIN}/gcr/menu-sections/${seg(id)}`,
    items: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/menu-items`,
    item: (id) => `${ADMIN}/gcr/menu-items/${seg(id)}`,
    itemOptions: (id) => `${ADMIN}/gcr/menu-items/${seg(id)}/options`,
    itemOption: (id) => `${ADMIN}/gcr/menu-item-options/${seg(id)}`,
    itemVariations: (id) => `${ADMIN}/gcr/menu-items/${seg(id)}/variations`,
    itemVariation: (id) => `${ADMIN}/gcr/menu-item-variations/${seg(id)}`,
    sides: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/sides`,
    side: (id) => `${ADMIN}/gcr/sides/${seg(id)}`,
    dailyFeatures: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/daily-features`,
    dailyFeature: (id) => `${ADMIN}/gcr/daily-features/${seg(id)}`,
    /** Slug-scoped standalone editor (routes/menu-editor.js). */
    editorData: (slug) => `/api/menu-editor/${seg(slug)}/data`,
    editorSave: (slug) => `/api/menu-editor/${seg(slug)}/save`,
    editorQrMenu: (slug) => `/api/menu-editor/${seg(slug)}/qr-menu`,
  },

  drinks: {
    sections: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/drink-sections`,
    items: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/drink-items`,
    item: (id) => `${ADMIN}/gcr/drink-items/${seg(id)}`,
  },

  happyHour: {
    sections: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/hh-sections`,
    items: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/hh-items`,
    item: (id) => `${ADMIN}/gcr/hh-items/${seg(id)}`,
  },

  // ------------------------------------------------------------ content ---
  events: {
    create: () => `${ADMIN}/gcr/events`,
    update: (id) => `${ADMIN}/gcr/events/${seg(id)}`,
    remove: (id) => `${ADMIN}/gcr/events/${seg(id)}`,
    backfillTypes: () => `${ADMIN}/gcr/events/backfill-types`,
    /** Events are read from the public router — admin.js has no list route. */
    list: () => `${GCR}/events`,
    importBulk: () => `${ADMIN}/gcr/import-events`,
  },

  specials: {
    create: () => `${ADMIN}/gcr/specials`,
    update: (id) => `${ADMIN}/gcr/specials/${seg(id)}`,
    remove: (id) => `${ADMIN}/gcr/specials/${seg(id)}`,
    list: () => `${GCR}/specials`,
    importBulk: () => `${ADMIN}/gcr/import-specials`,
  },

  sections: {
    /** Content sections live under /api/admin/entities (no /gcr segment). */
    list: (slug) => `${ADMIN}/entities/${seg(slug)}/sections`,
    replace: (slug) => `${ADMIN}/entities/${seg(slug)}/sections`,
    clear: (slug) => `${ADMIN}/entities/${seg(slug)}/sections`,
    image: (id) => `${ADMIN}/gcr/sections/${seg(id)}/image`,
    itemImage: (id) => `${ADMIN}/gcr/section-items/${seg(id)}/image`,
    publicList: () => `${GCR}/sections`,
  },

  /**
   * Profile detail collections. Each `kind` is a distinct table in the GCR
   * schema but they share one route shape, so one descriptor covers them all.
   */
  profile: {
    rows: (slug, kind) => `${ADMIN}/gcr/entities/${seg(slug)}/profile-rows/${seg(kind)}`,
    row: (kind, id) => `${ADMIN}/gcr/profile-rows/${seg(kind)}/${seg(id)}`,
    singleton: (slug, kind) => `${ADMIN}/gcr/entities/${seg(slug)}/profile-singleton/${seg(kind)}`,
  },

  /** Collections that each have their own dedicated route pair. */
  collections: {
    pricingItems: {
      list: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/pricing-items`,
      create: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/pricing-items`,
      item: (id) => `${ADMIN}/gcr/pricing-items/${seg(id)}`,
    },
    whatsIncluded: {
      list: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/whats-included`,
      create: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/whats-included`,
      item: (id) => `${ADMIN}/gcr/whats-included/${seg(id)}`,
    },
    requirements: {
      list: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/requirements`,
      create: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/requirements`,
      item: (id) => `${ADMIN}/gcr/requirements/${seg(id)}`,
    },
    faqs: {
      list: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/faqs`,
      create: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/faqs`,
      item: (id) => `${ADMIN}/gcr/faqs/${seg(id)}`,
    },
    schedules: {
      list: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/schedules`,
      create: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/schedules`,
      item: (id) => `${ADMIN}/gcr/schedules/${seg(id)}`,
    },
    secondaryHours: {
      list: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/secondary-hours`,
      create: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/secondary-hours`,
      item: (id) => `${ADMIN}/gcr/secondary-hours/${seg(id)}`,
    },
    team: {
      list: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/team`,
      create: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/team`,
      item: (id) => `${ADMIN}/gcr/team/${seg(id)}`,
    },
    reviews: {
      list: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/reviews`,
      create: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/reviews`,
      item: (id) => `${ADMIN}/gcr/reviews/${seg(id)}`,
    },
    policies: {
      list: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/policies`,
      create: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/policies`,
      item: (id) => `${ADMIN}/gcr/policies/${seg(id)}`,
    },
    blog: {
      list: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/blog`,
      create: (slug) => `${ADMIN}/gcr/entities/${seg(slug)}/blog`,
      item: (id) => `${ADMIN}/gcr/blog/${seg(id)}`,
    },
  },

  // ------------------------------------------------------------- claims ---
  claims: {
    list: () => `${ADMIN}/gcr/claims`,
    update: (id) => `${ADMIN}/gcr/claims/${seg(id)}`,
    submit: () => `${GCR}/claim`,
  },

  // ---------------------------------------------------------- ads/rails ---
  ads: {
    list: () => `${ADMIN}/gcr/ads`,
    create: () => `${ADMIN}/gcr/ads`,
    update: (id) => `${ADMIN}/gcr/ads/${seg(id)}`,
    remove: (id) => `${ADMIN}/gcr/ads/${seg(id)}`,
  },

  rails: {
    list: () => `${ADMIN}/gcr/page-rails`,
    create: () => `${ADMIN}/gcr/page-rails`,
    update: (id) => `${ADMIN}/gcr/page-rails/${seg(id)}`,
    remove: (id) => `${ADMIN}/gcr/page-rails/${seg(id)}`,
    items: (id) => `${ADMIN}/gcr/page-rails/${seg(id)}/items`,
    item: (id) => `${ADMIN}/gcr/page-rail-items/${seg(id)}`,
    publicByPage: (page) => `${GCR}/page-rails/${seg(page)}`,
  },

  coupons: {
    list: () => `${ADMIN}/gcr/coupons`,
    create: () => `${ADMIN}/gcr/coupons`,
    remove: (id) => `${ADMIN}/gcr/coupons/${seg(id)}`,
  },

  // --------------------------------------------------------------- bulk ---
  imports: {
    entity: () => `${ADMIN}/gcr/import-entity`,
    master: () => `${ADMIN}/gcr/import-master`,
    menu: () => `${ADMIN}/gcr/import-menu`,
    drinks: () => `${ADMIN}/gcr/import-drinks`,
    happyHour: () => `${ADMIN}/gcr/import-happyhour`,
    events: () => `${ADMIN}/gcr/import-events`,
    specials: () => `${ADMIN}/gcr/import-specials`,
    photos: () => `${ADMIN}/gcr/import-photos`,
    sectionBased: () => `${ADMIN}/gcr/import-section-based`,
    gcrItems: () => `${ADMIN}/gcr/import-gcr-items`,
  },

  // ----------------------------------------------------------- ai tools ---
  ai: {
    config: () => `${ADMIN}/ai-config`,
    configTask: (task) => `${ADMIN}/ai-config/${seg(task)}`,
    organize: () => `${ADMIN}/ai-organize`,
    ask: () => `${ADMIN}/gcr/ask`,
    parseRawData: () => `${ADMIN}/gcr/parse-raw-data`,
    saveParsedItems: () => `${ADMIN}/gcr/save-parsed-items`,
    ragStatus: () => `${ADMIN}/rag-status`,
    backfillPhotoAnalysis: () => `${ADMIN}/gcr/backfill-photo-analysis`,
    /**
     * The provider registry comes back on the ai-config response as
     * `providers`. `/api/ai-provider` is NOT a registry endpoint — it exposes
     * only `POST /call`, so a GET there 404s. Read providers from here.
     */
    providers: () => `${ADMIN}/ai-config`,
  },

  // -------------------------------------------------------- engagement ---
  analytics: {
    gcr: () => `${ADMIN}/gcr/analytics`,
    platform: () => `${ADMIN}/platform-analytics`,
    tripswipe: () => `${ADMIN}/tripswipe-analytics`,
    stats: () => '/api/analytics/stats',
  },

  customers: {
    list: () => `${ADMIN}/gcr/customers`,
  },

  socialPosts: {
    list: () => `${ADMIN}/social-posts`,
    create: () => `${ADMIN}/social-posts`,
    update: (id) => `${ADMIN}/social-posts/${seg(id)}`,
    remove: (id) => `${ADMIN}/social-posts/${seg(id)}`,
    scrape: () => `${ADMIN}/social-posts/scrape`,
    feed: () => `${GCR}/social-posts/feed`,
  },

  // -------------------------------------------------------- trip swipe ---
  tripswipe: {
    sponsored: () => `${ADMIN}/tripswipe/sponsored`,
    sponsoredItem: (id) => `${ADMIN}/tripswipe/sponsored/${seg(id)}`,
    promoCards: () => `${ADMIN}/tripswipe/promo-cards`,
    promoCard: (id) => `${ADMIN}/tripswipe/promo-cards/${seg(id)}`,
    settings: () => `${ADMIN}/tripswipe/settings`,
    settingsForSlug: (slug) => `${ADMIN}/tripswipe/settings/${seg(slug)}`,
    buttonConfig: () => `${ADMIN}/trip-swipe-button`,
    /** Tourist-facing concierge. `as_tourist` impersonates a user. */
    conciergeChat: () => '/api/tourist/ai-chat',
  },

  tourists: {
    list: () => `${ADMIN}/tourists`,
    detail: (userId) => `${ADMIN}/tourists/${seg(userId)}`,
    remove: (userId) => `${ADMIN}/tourists/${seg(userId)}`,
    preferences: (userId) => `${ADMIN}/tourists/${seg(userId)}/preferences`,
    recomputePreferences: (userId) => `${ADMIN}/tourists/${seg(userId)}/recompute-preferences`,
    removeSave: (userId, saveId) => `${ADMIN}/tourists/${seg(userId)}/saves/${seg(saveId)}`,
    removeItinerary: (userId, itinId) => `${ADMIN}/tourists/${seg(userId)}/itinerary/${seg(itinId)}`,
  },

  setupQuestions: {
    list: () => `${ADMIN}/setup-questions`,
    create: () => `${ADMIN}/setup-questions`,
    update: (id) => `${ADMIN}/setup-questions/${seg(id)}`,
    remove: (id) => `${ADMIN}/setup-questions/${seg(id)}`,
    reorder: () => `${ADMIN}/setup-questions/reorder`,
  },

  // -------------------------------------------------------------- sms ---
  sms: {
    blast: () => `${ADMIN}/sms-blast`,
    blastPreview: () => `${ADMIN}/sms-blast/preview`,
    blasts: () => `${ADMIN}/sms-blasts`,
    send: () => '/api/sms/send',
    qrCodes: () => '/api/sms/qr-codes',
    qrCode: (id) => `/api/sms/qr-codes/${seg(id)}`,
    qrCodeScans: (id) => `/api/sms/qr-codes/${seg(id)}/scans`,
  },

  // ------------------------------------------------------------ qr/ar ---
  qr: {
    list: () => '/api/qr',
    create: () => '/api/qr',
    batch: () => '/api/qr/batch',
    detail: (id) => `/api/qr/${seg(id)}`,
    update: (id) => `/api/qr/${seg(id)}`,
    remove: (id) => `/api/qr/${seg(id)}`,
    scans: (id) => `/api/qr/${seg(id)}/scans`,
    events: (id) => `/api/qr/${seg(id)}/events`,
    alert: (id) => `/api/qr/${seg(id)}/alert`,
    statsSummary: () => '/api/qr/stats/summary',
    locations: () => '/api/qr/locations',
    location: (id) => `/api/qr/locations/${seg(id)}`,
    partners: () => '/api/qr/partners',
    partner: (id) => `/api/qr/partners/${seg(id)}`,
    partnerStats: (id) => `/api/qr/partners/${seg(id)}/stats`,
    partnerPortal: (code) => `/api/qr/partner-portal/${seg(code)}`,
    digestDaily: () => '/api/qr/digest/daily',
    digestWeekly: () => '/api/qr/digest/weekly',
    alertSettings: () => '/api/qr/alert-settings/global',
  },

  arHunts: {
    list: () => '/api/ar-hunts',
    create: () => '/api/ar-hunts',
    update: (id) => `/api/ar-hunts/${seg(id)}`,
    remove: (id) => `/api/ar-hunts/${seg(id)}`,
    captures: (id) => `/api/ar-hunts/${seg(id)}/captures`,
    redeem: () => '/api/ar-hunts/redeem',
  },

  // ---------------------------------------------------------- artists ---
  artists: {
    list: () => `${ADMIN}/artists`,
    detail: (id) => `${ADMIN}/artists/${seg(id)}`,
    create: () => `${ADMIN}/artists`,
    update: (id) => `${ADMIN}/artists/${seg(id)}`,
    remove: (id) => `${ADMIN}/artists/${seg(id)}`,
    photo: (id) => `${ADMIN}/artists/${seg(id)}/photo`,
    publicList: () => '/api/artists',
    publicDetail: (slug) => `/api/artists/${seg(slug)}`,
    queue: (slug) => `/api/artists/${seg(slug)}/queue`,
    queueItem: (slug, id) => `/api/artists/${seg(slug)}/queue/${seg(id)}`,
    liveStatus: (slug) => `${GCR}/artist/${seg(slug)}/live`,
  },

  // -------------------------------------------------------- platform ---
  businesses: {
    list: () => `${ADMIN}/businesses`,
    linkUser: () => `${ADMIN}/link-user`,
    invite: () => `${ADMIN}/invite-business`,
  },

  apps: {
    list: () => `${ADMIN}/apps`,
    create: () => `${ADMIN}/apps`,
    update: (appId) => `${ADMIN}/apps/${seg(appId)}`,
    remove: (appId) => `${ADMIN}/apps/${seg(appId)}`,
    siteApps: () => `${ADMIN}/site-apps`,
    catalog: () => '/api/apps',
    install: () => '/api/apps/install',
    uninstall: (appId) => `/api/apps/uninstall/${seg(appId)}`,
  },

  leads: {
    salesLeads: () => `${ADMIN}/sales-leads`,
    salesLead: (id) => `${ADMIN}/sales-leads/${seg(id)}`,
    /** Admin side of the public sign-up form's business_leads table. */
    businessLeads: () => `${ADMIN}/business-leads`,
    businessLead: (id) => `${ADMIN}/business-leads/${seg(id)}`,
  },

  /**
   * Bookings. There is no cross-business list route anywhere in the API —
   * `routes/bookings.js` is entirely slug-scoped and is really about
   * `entity_availability`, not a booking ledger.
   *
   * Three parallel booking models exist in gcr-api-clean:
   *   1. entity_availability          — routes/bookings.js
   *   2. bookable_resources/booking_events — routes/rentals.js, routes/services.js
   *   3. offerings/bookings/booking_calendar — routes/platform.js, whose header
   *      declares itself canonical ("ONE universal booking")
   * Only (3) is owner-scoped and therefore unreachable with an admin token.
   */
  bookings: {
    /** Availability for one date. */
    availability: (slug) => `/api/bookings/${seg(slug)}/availability`,
    /** Availability across a date range — the closest thing to a calendar. */
    dateRange: (slug) => `/api/bookings/${seg(slug)}/date-range`,
    /** One booking, by id, for a business. */
    detail: (slug, id) => `/api/bookings/${seg(slug)}/${seg(id)}`,
    create: (slug) => `/api/bookings/${seg(slug)}`,
    /** Resource-based models, used by the rentals and services apps. */
    rentals: () => '/api/rentals',
    rentalBookings: (slug) => `/api/rentals/${seg(slug)}/bookings`,
    services: () => '/api/services',
    serviceBookings: (slug) => `/api/services/${seg(slug)}/bookings`,
  },

  /**
   * Public review routes. Every one is slug-scoped — `routes/reviews.js` has
   * no collection route at all.
   *
   * This matters more than it looks: `/api/reviews/stats` and
   * `/api/reviews/requests` do not 404, they match `GET /:slug` and quietly
   * return an empty result for a business that does not exist, and
   * `POST /api/reviews/request` would match `POST /:slug` and *create a
   * review* against a business named "request". The legacy dashboard called
   * all three. They are gone from here rather than left to fail silently.
   *
   * For full admin review management (including unapproved rows) use
   * `collections.reviews`, which is backed by the admin router.
   */
  reviews: {
    /** Approved reviews for one business, paginated. */
    bySlug: (slug) => `/api/reviews/${seg(slug)}`,
    /** Rating breakdown for one business. */
    statsBySlug: (slug) => `/api/reviews/${seg(slug)}/stats`,
    create: (slug) => `/api/reviews/${seg(slug)}`,
    item: (slug, id) => `/api/reviews/${seg(slug)}/${seg(id)}`,
  },

  updateLinks: {
    generate: () => '/api/update/generate',
    sendSms: () => '/api/update/send-sms',
    status: (token) => `/api/update/status/${seg(token)}`,
    today: () => '/api/update/today',
  },

  photos: {
    repairStatus: () => `${ADMIN}/repair-photos/status`,
    repair: () => `${ADMIN}/repair-photos`,
    rehost: () => `${ADMIN}/gcr/rehost-photos`,
    /** Guest photo moderation queue. */
    community: () => `${ADMIN}/community-photos`,
    communityItem: (id) => `${ADMIN}/community-photos/${seg(id)}`,
  },

  /**
   * Admin view over the universal booking engine — /api/admin/platform.
   *
   * routes/platform.js owns the same tables but resolves the business from
   * entity_owners using the signed-in user, so an admin token cannot reach it.
   * These routes filter by slug instead of being scoped to one, which is what
   * makes an operator view possible.
   *
   * The model, per routes/platform.js: `offerings` is the catalog (a charter,
   * a cruise, a pontoon, a room, an add-on), `bookings` is ONE table for every
   * booking-type app with the unit as data, and `booking_calendar` holds every
   * date claim from every source.
   */
  bookingPlatform: {
    summary: () => `${ADMIN}/platform/summary`,

    bookings: () => `${ADMIN}/platform/bookings`,
    booking: (id) => `${ADMIN}/platform/bookings/${seg(id)}`,

    offerings: () => `${ADMIN}/platform/offerings`,
    offering: (id) => `${ADMIN}/platform/offerings/${seg(id)}`,
    offeringMeta: () => `${ADMIN}/platform/offering-meta`,
    offeringPrices: (id) => `${ADMIN}/platform/offerings/${seg(id)}/prices`,
    offeringPrice: (id) => `${ADMIN}/platform/offering-prices/${seg(id)}`,

    calendar: () => `${ADMIN}/platform/calendar`,
    calendarEntry: (id) => `${ADMIN}/platform/calendar/${seg(id)}`,

    promos: () => `${ADMIN}/platform/promos`,
    promo: (id) => `${ADMIN}/platform/promos/${seg(id)}`,

    waivers: () => `${ADMIN}/platform/waivers`,

    /**
     * Booking sources — where bookings actually come from.
     *
     * There are no live API connections to Peek Pro, FareHarbor and the rest.
     * Their confirmation emails arrive at gcr-<slug>@parse.gulfcoastradar.com
     * and routes/email-parser.js parses them, recognising 24 platforms and
     * logging every attempt. So "what is this business attached to?" is
     * answered by what has actually arrived, not by a field someone set.
     *
     * These are the admin-scoped views. The public /api/email-parser/log has
     * no auth and returns raw email bodies, so the dashboard never calls it.
     */
    parserSources: () => `${ADMIN}/platform/parser/sources`,
    parserLog: () => `${ADMIN}/platform/parser/log`,
    parserPlatforms: () => `${ADMIN}/platform/parser/platforms`,
    /** Third-party connections per business (FareHarbor and anything else). */
    integrations: () => `${ADMIN}/platform/integrations`,

    /**
     * Inventory and capacity — what a business actually has.
     *
     * The parser can log a confirmation without knowing how many spots are
     * left; it can only subtract once entity.daily_capacity is set. `capacity`
     * lists every business against that number plus its offerings catalog, so
     * the businesses that can never report availability are visible.
     */
    capacity: () => `${ADMIN}/platform/capacity`,
    businessCapacity: (slug) => `${ADMIN}/platform/capacity/${seg(slug)}`,

    /** business_availability across every business, not one at a time. */
    availability: () => `${ADMIN}/platform/availability`,
    availabilityRow: (id) => `${ADMIN}/platform/availability/${seg(id)}`,

    /** Near-term dates with spots left — the outreach worklist. */
    openings: () => `${ADMIN}/platform/openings`,

    /**
     * External iCal feeds — the second ingestion path beside the parser.
     * Note this is `calendars` (the feeds), not `calendar` (the date claims
     * they write into). Both exist and they are different things.
     */
    icalFeeds: () => `${ADMIN}/platform/calendars`,
    icalFeed: (id) => `${ADMIN}/platform/calendars/${seg(id)}`,
    icalFeedSync: (id) => `${ADMIN}/platform/calendars/${seg(id)}/sync`,

    /** gcr_deals — the outbound side of an opening. */
    deals: () => `${ADMIN}/platform/deals`,
    deal: (id) => `${ADMIN}/platform/deals/${seg(id)}`,
  },

  /** Composio connections — /api/admin/connections. */
  connections: {
    list: () => `${ADMIN}/connections`,
    status: () => `${ADMIN}/connections/status`,
    catalog: () => `${ADMIN}/connections/catalog`,
    catalogItem: (toolId) => `${ADMIN}/connections/catalog/${seg(toolId)}`,
    /** What Composio itself offers, for building the catalog from. */
    available: () => `${ADMIN}/connections/available`,
    connect: (slug, toolId) => `${ADMIN}/connections/${seg(slug)}/${seg(toolId)}/connect`,
    refresh: (slug, toolId) => `${ADMIN}/connections/${seg(slug)}/${seg(toolId)}/refresh`,
    disconnect: (slug, toolId) => `${ADMIN}/connections/${seg(slug)}/${seg(toolId)}`,
  },

  /**
   * Generic key/value settings over the `platform_settings` table.
   *
   * The legacy dashboard had a bespoke endpoint per settings screen —
   * site-config, sms-config, auth-config — and none of them existed. They are
   * one route now, so another settings screen needs no new endpoint at all.
   */
  settings: {
    all: () => `${ADMIN}/settings`,
    get: (key) => `${ADMIN}/settings/${seg(key)}`,
    /** Which provider keys the server has. Booleans only — never the keys. */
    providerStatus: () => `${ADMIN}/provider-status`,
  },

  /** Settings keys the dashboard reads. Names, not paths, so they stay honest. */
  settingsKeys: {
    siteHero: 'site_hero',
    smsConfig: 'sms_config',
    authConfig: 'auth_config',
    pointsConfig: 'points_config',
  },

  categoryCards: {
    list: () => `${ADMIN}/gcr/category-cards`,
    create: () => `${ADMIN}/gcr/category-cards`,
    item: (id) => `${ADMIN}/gcr/category-cards/${seg(id)}`,
  },

  // ------------------------------------ paths with no route in the API ---
  // Wired as the legacy dashboard calls them. Modules using these render an
  // "endpoint unavailable" notice rather than pretending the save worked.
  unverified: {
    categoryPageConfig: (category) => `${ADMIN}/gcr/category-page-config/${seg(category)}`,
    entityPages: (slug) => `${ADMIN}/gcr/entity-pages/${seg(slug)}`,
    pageAssignments: (slug) => `${ADMIN}/gcr/page-assignments/${seg(slug)}`,
    businessData: (slug) => `${ADMIN}/gcr/business-data/${seg(slug)}`,
    messaging: (slug) => `${ADMIN}/gcr/messaging/${seg(slug)}`,
    grokChat: () => `${ADMIN}/gcr/grok-chat`,
    autoActivateTop5: () => `${ADMIN}/gcr/auto-activate-top5`,
    dailyRotationOptions: (slug) => `${ADMIN}/daily-rotation/options/${seg(slug)}`,
    dailyRotationSections: (slug) => `${ADMIN}/daily-rotation/sections/${seg(slug)}`,
    linkGcrAll: () => `${ADMIN}/businesses/link-gcr-all`,
    smsCampaignPreview: () => `${ADMIN}/sms-campaign-preview`,
  },
};

export default endpoints;
