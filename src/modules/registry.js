/**
 * Module registry.
 *
 * The dashboard's structure is data. This file lists every section once; the
 * sidebar, the router, and the command palette all read from it. Adding a
 * section means adding a module file and one entry here — there is no second
 * place to update, and no hand-written <Route> or nav <li> anywhere.
 *
 * A module descriptor:
 *   {
 *     id:      'gcr-events',        // stable id, also the URL segment
 *     label:   'Events',            // sidebar text
 *     icon:    '📅',
 *     group:   'content',           // key into NAV_GROUPS
 *     path:    '/content/events',   // route path
 *     load:    () => import(...),   // lazy component module (default export)
 *     description: '…',             // shown in the page header / palette
 *     hidden:  false,               // routable but absent from the sidebar
 *     status:  'live' | 'partial',  // 'partial' = depends on a route the API
 *                                   //   does not currently serve
 *   }
 */

import { lazy } from 'react';

export const NAV_GROUPS = [
  { key: 'home', label: '' },
  { key: 'menu', label: '🍽️ Menu & QR' },
  { key: 'directory', label: '🗺️ GCR Directory' },
  { key: 'booking', label: '🛥️ Booking Platform' },
  { key: 'content', label: '📋 Content' },
  { key: 'ai', label: '🤖 AI Tools' },
  { key: 'engagement', label: '📊 Engagement' },
  { key: 'tripswipe', label: '❤️ Trip Swipe' },
  { key: 'appstore', label: '🛍️ App Store' },
  { key: 'platform', label: '⚙️ Platform' },
];

/**
 * Every section, in sidebar order. Mirrors the nav of the legacy admin.html
 * so nothing that existed there is lost.
 */
const definitions = [
  // ---------------------------------------------------------------- home --
  {
    id: 'overview',
    label: 'Overview',
    icon: '📊',
    group: 'home',
    path: '/',
    description: 'Platform totals and quick links across GCR, Trip Swipe, and CyberCheck.',
    load: () => import('./home/Overview.jsx'),
  },
  {
    id: 'sections',
    label: 'All Sections',
    icon: '🗂️',
    group: 'home',
    path: '/sections',
    description:
      'Every screen in this dashboard, what it does, and the API routes behind it — with a live probe.',
    load: () => import('./home/Sections.jsx'),
  },

  // ------------------------------------------------------------ menu & qr --
  {
    id: 'menu-builder',
    label: 'Menu Builder',
    icon: '🧾',
    group: 'menu',
    path: '/menu/builder',
    description: 'Build and edit menus, drinks, and happy hour for any GCR entity.',
    load: () => import('./menu/MenuBuilder.jsx'),
  },
  {
    id: 'qr-menus',
    label: 'QR Menus',
    icon: '📱',
    group: 'menu',
    path: '/menu/qr-menus',
    description: 'Public QR menu links for each entity.',
    load: () => import('./menu/QrMenus.jsx'),
  },
  {
    id: 'qr-tracker',
    label: 'QR Tracker',
    icon: '🔳',
    group: 'menu',
    path: '/menu/qr-tracker',
    description: 'QR code inventory, scan counts, and placement locations.',
    load: () => import('./menu/QrTracker.jsx'),
  },
  {
    id: 'reviews',
    label: 'Reviews',
    icon: '⭐',
    group: 'menu',
    path: '/menu/reviews',
    description: 'Review requests, responses, and POS-triggered review flows.',
    load: () => import('./menu/Reviews.jsx'),
  },
  {
    id: 'referral-partners',
    label: 'Referral Partners',
    icon: '💰',
    group: 'menu',
    path: '/menu/referral-partners',
    description: 'Partners who distribute QR codes, and what they have earned.',
    load: () => import('./menu/ReferralPartners.jsx'),
  },
  {
    id: 'daily-update-links',
    label: 'Daily SMS Links',
    icon: '✉️',
    group: 'menu',
    path: '/menu/daily-update-links',
    description: 'Generate and text the daily menu/specials update link to owners.',
    load: () => import('./menu/DailyUpdateLinks.jsx'),
  },
  {
    id: 'menu-editors-hub',
    label: 'Menu Editors Hub',
    icon: '🎯',
    group: 'menu',
    path: '/menu/editors-hub',
    description: 'Direct links into the standalone slug-based menu editor per entity.',
    load: () => import('./menu/MenuEditorsHub.jsx'),
  },

  // ---------------------------------------------------------- directory --
  {
    id: 'gcr-businesses',
    label: 'GCR Businesses',
    icon: '🏢',
    group: 'directory',
    path: '/directory/businesses',
    description: 'Every entity in the GCR directory. Search, filter, and open the editor.',
    load: () => import('./directory/Businesses.jsx'),
  },
  {
    id: 'gcr-entity-editor',
    label: 'Entity Editor',
    icon: '✏️',
    group: 'directory',
    path: '/directory/entity',
    description: 'Full entity editor — info, hours, photos, tags, content, and sections.',
    load: () => import('./directory/EntityEditor.jsx'),
  },
  {
    id: 'gcr-entity-editor-slug',
    label: 'Entity Editor',
    group: 'directory',
    path: '/directory/entity/:slug',
    hidden: true,
    load: () => import('./directory/EntityEditor.jsx'),
  },
  {
    id: 'gcr-business-profile',
    label: 'Business Profiles',
    icon: '🗂️',
    group: 'directory',
    path: '/directory/profile',
    description:
      "Open any business and see its own dashboard — every table holding its data, discovered from the schema rather than listed in code.",
    load: () => import('./directory/BusinessProfile.jsx'),
  },
  {
    id: 'gcr-business-profile-slug',
    label: 'Business Profiles',
    group: 'directory',
    path: '/directory/profile/:slug',
    hidden: true,
    load: () => import('./directory/BusinessProfile.jsx'),
  },
  {
    id: 'gcr-site-editor',
    label: 'Site Editor',
    icon: '🎨',
    group: 'directory',
    path: '/directory/site-editor',
    status: 'partial',
    description: 'Category tiles and hero configuration for the public GCR site.',
    load: () => import('./directory/SiteEditor.jsx'),
  },
  {
    id: 'gcr-claims',
    label: 'Claims',
    icon: '🔑',
    group: 'directory',
    path: '/directory/claims',
    description: 'Approve or reject business claim requests.',
    load: () => import('./directory/Claims.jsx'),
  },

  // ----------------------------------------------------- booking platform --
  // The universal booking engine: boat rentals, fishing charters, dolphin
  // cruises, stays. One `bookings` table, one `booking_calendar`, with the
  // unit as data. Backed by /api/admin/platform.
  {
    id: 'booking-overview',
    label: 'Overview',
    icon: '🛥️',
    group: 'booking',
    path: '/booking',
    description: 'Booking totals across every business, and what each is connected to.',
    load: () => import('./booking/Overview.jsx'),
  },
  {
    id: 'booking-offerings',
    label: 'Offerings',
    icon: '🎣',
    group: 'booking',
    path: '/booking/offerings',
    description: 'The catalog — charters, cruises, rentals, rooms, and add-ons, with tiered pricing.',
    load: () => import('./booking/Offerings.jsx'),
  },
  {
    id: 'booking-bookings',
    label: 'Bookings',
    icon: '📖',
    group: 'booking',
    path: '/booking/bookings',
    description: 'Every booking across every business, with guest, party, money, and status.',
    load: () => import('./booking/BookingsLedger.jsx'),
  },
  {
    id: 'booking-date-claims',
    label: 'Date Claims',
    icon: '📅',
    group: 'booking',
    path: '/booking/date-claims',
    description:
      'The raw booking_calendar ledger — every date claim from every source, and manual blocks.',
    load: () => import('./booking/Calendar.jsx'),
  },
  {
    id: 'booking-promos',
    label: 'Promos',
    icon: '🎟️',
    group: 'booking',
    path: '/booking/promos',
    description: 'Discount codes redeemed at booking time.',
    load: () => import('./booking/Promos.jsx'),
  },
  {
    id: 'booking-sources',
    label: 'Booking Sources',
    icon: '📨',
    group: 'booking',
    path: '/booking/sources',
    description:
      'Which booking system each business actually uses — Peek Pro, FareHarbor and the rest — derived from the emails that arrive and get parsed.',
    load: () => import('./booking/Sources.jsx'),
  },
  {
    id: 'booking-feeds',
    label: 'Calendar Feeds',
    icon: '🔄',
    group: 'booking',
    path: '/booking/feeds',
    description:
      'External iCal links from Airbnb, VRBO and the rest — the second way dates get claimed, polled hourly.',
    load: () => import('./booking/CalendarFeeds.jsx'),
  },
  {
    id: 'booking-inventory',
    label: 'Inventory & Capacity',
    icon: '🚤',
    group: 'booking',
    path: '/booking/inventory',
    description:
      'What each business actually has — the daily capacity the parser counts down from, and the offerings catalog beside it.',
    load: () => import('./booking/Inventory.jsx'),
  },
  {
    id: 'booking-availability',
    label: 'Availability',
    icon: '📊',
    group: 'booking',
    path: '/booking/availability',
    description:
      'Capacity minus what has been booked, per business per date, from the parser, the iCal import and hand edits.',
    load: () => import('./booking/Availability.jsx'),
  },
  {
    id: 'booking-business-calendar',
    label: 'Business Calendar',
    icon: '🗓️',
    group: 'booking',
    path: '/booking/calendar',
    description:
      'One business, one month — what is open, what claimed each date, and its units. Also a tab on every business profile.',
    load: () => import('./booking/BusinessCalendar.jsx'),
  },
  {
    // Same component, addressed by slug so a calendar can be linked to.
    id: 'booking-business-calendar-slug',
    label: 'Business Calendar',
    group: 'booking',
    path: '/booking/calendar/:slug',
    hidden: true,
    load: () => import('./booking/BusinessCalendar.jsx'),
  },
  {
    id: 'booking-industries',
    label: 'Industry Calendars',
    icon: '🏷️',
    group: 'booking',
    path: '/booking/industries',
    description:
      'A calendar page per industry — fishing charters, dolphin cruises, condos, hotels, parasailing, photographers.',
    load: () => import('./booking/Industries.jsx'),
  },
  {
    // One route serves every industry; the sidebar links straight into it.
    id: 'booking-industry',
    label: 'Industry Calendar',
    group: 'booking',
    path: '/booking/industries/:vertical',
    hidden: true,
    load: () => import('./booking/IndustryCalendar.jsx'),
  },
  {
    id: 'booking-match',
    label: 'Find a Match',
    icon: '🔍',
    group: 'booking',
    path: '/booking/match',
    description:
      'A description and some dates in one question — "two bed two bath at Phoenix West on these nights", "a charter for eight, eight hours, 45ft with AC".',
    load: () => import('./booking/Match.jsx'),
  },
  {
    id: 'booking-search',
    label: 'Availability Search',
    icon: '🔎',
    group: 'booking',
    path: '/booking/search',
    description:
      'Pick any date and see what is open across every industry at once — condos and their units, charters, cruises, parasailing, photographers.',
    load: () => import('./booking/AvailabilitySearch.jsx'),
  },
  {
    id: 'booking-website-calendar',
    label: 'Website Calendar',
    icon: '🗓️',
    group: 'booking',
    path: '/booking/website-calendar',
    description:
      'The embeddable availability calendar a business drops into its own site — one view across every platform it books through.',
    load: () => import('./booking/WebsiteCalendar.jsx'),
  },
  {
    id: 'booking-openings',
    label: 'Openings',
    icon: '⚡',
    group: 'booking',
    path: '/booking/openings',
    description:
      'Near-term dates that still have spots — post a last-minute deal, or text the guests who already saved that business.',
    load: () => import('./booking/Openings.jsx'),
  },
  {
    id: 'booking-connections',
    label: 'Connections',
    icon: '🔌',
    group: 'booking',
    path: '/booking/connections',
    description: 'Third-party accounts a business connects through Composio, and the tool catalog.',
    load: () => import('./booking/Connections.jsx'),
  },

  // ------------------------------------------------------------- content --
  {
    id: 'gcr-events',
    label: 'Events',
    icon: '📅',
    group: 'content',
    path: '/content/events',
    description: 'Events across every entity — create, edit, and remove.',
    load: () => import('./content/Events.jsx'),
  },
  {
    id: 'gcr-artists',
    label: 'Artists',
    icon: '🎸',
    group: 'content',
    path: '/content/artists',
    description: 'Live music artist roster with photos and social links.',
    load: () => import('./content/Artists.jsx'),
  },
  {
    id: 'artist-profiles',
    label: 'Song Requests & Tips',
    icon: '🎤',
    group: 'content',
    path: '/content/artist-profiles',
    description: 'Per-artist live request queue and tip activity.',
    load: () => import('./content/ArtistProfiles.jsx'),
  },
  {
    id: 'gcr-specials',
    label: 'Specials',
    icon: '🏷️',
    group: 'content',
    path: '/content/specials',
    description: 'Specials across every entity.',
    load: () => import('./content/Specials.jsx'),
  },
  {
    id: 'gcr-ads',
    label: 'Ad Network',
    icon: '📢',
    group: 'content',
    path: '/content/ads',
    description: 'Sponsored ad slots served across the GCR site.',
    load: () => import('./content/Ads.jsx'),
  },
  {
    id: 'gcr-rails',
    label: 'Page Rails',
    icon: '🚃',
    group: 'content',
    path: '/content/rails',
    description: 'Curated rails on each public page, and the entities pinned into them.',
    load: () => import('./content/Rails.jsx'),
  },
  {
    id: 'ai-config',
    label: 'AI Config',
    icon: '🧠',
    group: 'content',
    path: '/content/ai-config',
    description: 'Which provider and model handles each AI task.',
    load: () => import('./ai/AiConfig.jsx'),
  },
  {
    id: 'gcr-coupons',
    label: 'Coupons',
    icon: '🎟️',
    group: 'content',
    path: '/content/coupons',
    description: 'Discount codes, limits, and expiry.',
    load: () => import('./content/Coupons.jsx'),
  },
  {
    id: 'gcr-seo',
    label: 'Tags & SEO',
    icon: '🔍',
    group: 'content',
    path: '/content/seo',
    description: 'Per-entity SEO fields and taxonomy tags.',
    load: () => import('./content/Seo.jsx'),
  },
  {
    id: 'bulk-upload',
    label: 'Bulk Upload',
    icon: '📤',
    group: 'content',
    path: '/content/bulk-upload',
    description: 'Import entities, menus, photos, and full records in bulk.',
    load: () => import('./content/BulkUpload.jsx'),
  },
  {
    id: 'bulk-events',
    label: 'Bulk Events',
    icon: '🗓️',
    group: 'content',
    path: '/content/bulk-events',
    description: 'Paste or upload many events for one entity at once.',
    load: () => import('./content/BulkEvents.jsx'),
  },

  // ------------------------------------------------------------ ai tools --
  {
    id: 'ai-chat',
    label: 'AI Chat',
    icon: '✨',
    group: 'ai',
    path: '/ai/chat',
    description: 'Ask the GCR knowledge base a question.',
    load: () => import('./ai/AiChat.jsx'),
  },
  {
    id: 'ai-organize',
    label: 'AI Data Organizer',
    icon: '🗂️',
    group: 'ai',
    path: '/ai/organize',
    description: 'Turn unstructured business notes into structured entity data.',
    load: () => import('./ai/AiOrganize.jsx'),
  },
  {
    id: 'rag-index',
    label: 'AI Index / RAG',
    icon: '📚',
    group: 'ai',
    path: '/ai/rag-index',
    description: 'Reindex an entity into the retrieval store and check index status.',
    load: () => import('./ai/RagIndex.jsx'),
  },
  {
    id: 'ai-settings',
    label: 'AI Settings',
    icon: '⚙️',
    group: 'ai',
    path: '/ai/settings',
    description: 'Provider registry and photo-analysis backfill.',
    load: () => import('./ai/AiSettings.jsx'),
  },

  // --------------------------------------------------------- engagement --
  {
    id: 'gcr-analytics',
    label: 'Analytics',
    icon: '📈',
    group: 'engagement',
    path: '/engagement/analytics',
    description: 'GCR and platform-wide traffic and engagement counters.',
    load: () => import('./engagement/Analytics.jsx'),
  },
  {
    id: 'gcr-reviews',
    label: 'Reviews',
    icon: '💬',
    group: 'engagement',
    path: '/engagement/reviews',
    description: 'Reviews attached to GCR entities.',
    load: () => import('./engagement/GcrReviews.jsx'),
  },
  {
    id: 'gcr-customers',
    label: 'Customers',
    icon: '👥',
    group: 'engagement',
    path: '/engagement/customers',
    description: 'Customer records collected across GCR.',
    load: () => import('./engagement/Customers.jsx'),
  },
  {
    id: 'gcr-messaging',
    label: 'SMS / Messaging',
    icon: '📨',
    group: 'engagement',
    path: '/engagement/messaging',
    status: 'partial',
    description: 'Per-entity message threads.',
    load: () => import('./engagement/Messaging.jsx'),
  },
  {
    id: 'gcr-social',
    label: 'Social & Connections',
    icon: '🔗',
    group: 'engagement',
    path: '/engagement/social',
    description: 'Scraped social posts and the home-feed cards built from them.',
    load: () => import('./engagement/Social.jsx'),
  },

  // --------------------------------------------------------- trip swipe --
  {
    id: 'tripswipe-overview',
    label: 'Overview',
    icon: '🏝️',
    group: 'tripswipe',
    path: '/tripswipe',
    description: 'Trip Swipe headline numbers and shortcuts.',
    load: () => import('./tripswipe/Overview.jsx'),
  },
  {
    id: 'tripswipe-businesses',
    label: 'Businesses',
    icon: '🏬',
    group: 'tripswipe',
    path: '/tripswipe/businesses',
    description: 'Per-entity Trip Swipe settings and visibility.',
    load: () => import('./tripswipe/Businesses.jsx'),
  },
  {
    id: 'tripswipe-tourists',
    label: 'Tourists',
    icon: '🧳',
    group: 'tripswipe',
    path: '/tripswipe/tourists',
    description: 'Trip Swipe user accounts, saves, and itineraries.',
    load: () => import('./tripswipe/Tourists.jsx'),
  },
  {
    id: 'tripswipe-analytics',
    label: 'Swipe Analytics',
    icon: '📉',
    group: 'tripswipe',
    path: '/tripswipe/analytics',
    description: 'Swipe volume and conversion over a chosen period.',
    load: () => import('./tripswipe/Analytics.jsx'),
  },
  {
    id: 'tripswipe-ai',
    label: 'AI Feedback',
    icon: '🤖',
    group: 'tripswipe',
    path: '/tripswipe/ai',
    description: 'What the concierge is being asked, and how it answered.',
    load: () => import('./tripswipe/AiFeedback.jsx'),
  },
  {
    id: 'tripswipe-concierge-test',
    label: 'Concierge Test',
    icon: '🧪',
    group: 'tripswipe',
    path: '/tripswipe/concierge-test',
    description: 'Send a question to the concierge as a specific tourist.',
    load: () => import('./tripswipe/ConciergeTest.jsx'),
  },
  {
    id: 'trip-swipe-questions',
    label: 'Swipe Questions',
    icon: '❓',
    group: 'tripswipe',
    path: '/tripswipe/questions',
    description: 'The onboarding questions shown to new tourists.',
    load: () => import('./tripswipe/SwipeQuestions.jsx'),
  },
  {
    id: 'tripswipe-sponsored',
    label: 'Sponsored',
    icon: '⭐',
    group: 'tripswipe',
    path: '/tripswipe/sponsored',
    description: 'Paid placements injected into the swipe deck.',
    load: () => import('./tripswipe/Sponsored.jsx'),
  },
  {
    id: 'tripswipe-tonight',
    label: 'Tonight Cards',
    icon: '🌙',
    group: 'tripswipe',
    path: '/tripswipe/tonight',
    description: 'Date-scoped promo cards for the Tonight deck.',
    load: () => import('./tripswipe/TonightCards.jsx'),
  },
  {
    id: 'tripswipe-points',
    label: 'Points & Rewards',
    icon: '👑',
    group: 'tripswipe',
    path: '/tripswipe/points',
    status: 'partial',
    description: 'Point values and reward thresholds.',
    load: () => import('./tripswipe/Points.jsx'),
  },
  {
    id: 'tripswipe-sms-qr',
    label: 'Text Sign-Up QR Codes',
    icon: '🔲',
    group: 'tripswipe',
    path: '/tripswipe/sms-qr',
    description: 'QR codes that start an SMS sign-up, and their scan counts.',
    load: () => import('./tripswipe/SmsQr.jsx'),
  },
  {
    id: 'platform-auth',
    label: 'Auth Settings',
    icon: '🔐',
    group: 'tripswipe',
    path: '/tripswipe/auth-settings',
    status: 'partial',
    description: 'Which sign-in methods the tourist app offers.',
    load: () => import('./tripswipe/AuthSettings.jsx'),
  },
  {
    id: 'trip-swipe-button',
    label: 'Button Config',
    icon: '🔘',
    group: 'tripswipe',
    path: '/tripswipe/button',
    description: 'How the Trip Swipe entry point renders and where it points.',
    load: () => import('./tripswipe/ButtonConfig.jsx'),
  },
  {
    id: 'sms-settings',
    label: 'SMS Settings',
    icon: '📱',
    group: 'tripswipe',
    path: '/tripswipe/sms-settings',
    status: 'partial',
    description: 'SMS provider credentials and sending defaults.',
    load: () => import('./tripswipe/SmsSettings.jsx'),
  },
  {
    id: 'sms-blasts',
    label: 'SMS Blasts',
    icon: '🚀',
    group: 'tripswipe',
    path: '/tripswipe/sms-blasts',
    description: 'Compose a filtered blast, preview the audience, and review history.',
    load: () => import('./tripswipe/SmsBlasts.jsx'),
  },
  {
    id: 'business-leads',
    label: 'Business Leads',
    icon: '🏆',
    group: 'tripswipe',
    path: '/tripswipe/business-leads',
    status: 'partial',
    description: 'Businesses surfaced as leads by Trip Swipe activity.',
    load: () => import('./tripswipe/BusinessLeads.jsx'),
  },
  {
    id: 'community-photos',
    label: 'Guest Photos',
    icon: '📸',
    group: 'tripswipe',
    path: '/tripswipe/community-photos',
    status: 'partial',
    description: 'Moderate guest-submitted photos before they go live.',
    load: () => import('./tripswipe/CommunityPhotos.jsx'),
  },

  // ---------------------------------------------------------- app store --
  {
    id: 'app-manager',
    label: 'App Manager',
    icon: '🧩',
    group: 'appstore',
    path: '/apps/manager',
    description: 'The app catalogue: pricing, category, and availability.',
    load: () => import('./appstore/AppManager.jsx'),
  },
  {
    id: 'biz-apps',
    label: 'Business Apps',
    icon: '🔌',
    group: 'appstore',
    path: '/apps/business-apps',
    description: 'Which apps each business has installed.',
    load: () => import('./appstore/BusinessApps.jsx'),
  },

  // ----------------------------------------------------------- platform --
  {
    id: 'businesses',
    label: 'Businesses',
    icon: '🏛️',
    group: 'platform',
    path: '/platform/businesses',
    description: 'CyberCheck business accounts and their linked GCR entities.',
    load: () => import('./platform/Businesses.jsx'),
  },
  {
    id: 'leads',
    label: 'Leads',
    icon: '📇',
    group: 'platform',
    path: '/platform/leads',
    description: 'Sales pipeline for prospective businesses.',
    load: () => import('./platform/Leads.jsx'),
  },
  {
    id: 'bookings',
    label: 'Bookings',
    icon: '📖',
    group: 'platform',
    path: '/platform/bookings',
    description: 'Bookings taken across the platform.',
    load: () => import('./platform/Bookings.jsx'),
  },
  {
    id: 'sales-pages',
    label: 'Sales Pages',
    icon: '📄',
    group: 'platform',
    path: '/platform/sales-pages',
    description: 'Per-entity sales and onboarding links.',
    load: () => import('./platform/SalesPages.jsx'),
  },
  {
    id: 'ar-hunts',
    label: 'AR Hunts',
    icon: '🗺️',
    group: 'platform',
    path: '/platform/ar-hunts',
    description: 'Augmented-reality scavenger hunts and their captures.',
    load: () => import('./platform/ArHunts.jsx'),
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: '🔗',
    group: 'platform',
    path: '/platform/integrations',
    status: 'partial',
    description: 'Third-party connections and the keys behind them.',
    load: () => import('./platform/Integrations.jsx'),
  },
  {
    id: 'people',
    label: 'People',
    icon: '🧑‍🤝‍🧑',
    group: 'platform',
    path: '/platform/people',
    description:
      'Everyone across the platform — admins, business accounts, customers, tourists, and claimants — in one list.',
    load: () => import('./platform/People.jsx'),
  },
  {
    id: 'users',
    label: 'Users',
    icon: '👤',
    group: 'platform',
    path: '/platform/users',
    description: 'Admin and owner accounts, and entity ownership links.',
    load: () => import('./platform/Users.jsx'),
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: '🔑',
    group: 'platform',
    path: '/platform/api-keys',
    status: 'partial',
    description: 'Provider API keys held by the platform.',
    load: () => import('./platform/ApiKeys.jsx'),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: '⚙️',
    group: 'platform',
    path: '/platform/settings',
    description: 'Dashboard configuration, theme, and session.',
    load: () => import('./platform/Settings.jsx'),
  },
];

/**
 * Two sections on the same path is not a warning, it is a section that can
 * never be reached: the router matches the first and the second is dead. It
 * also survives every check we have — the endpoint audit looks at API paths,
 * and the route walk navigates each path and finds *something* rendering. So
 * it is asserted here, at module load, where it fails immediately and names
 * both offenders.
 */
{
  const byPath = new Map();
  for (const definition of definitions) {
    if (byPath.has(definition.path)) {
      throw new Error(
        `Duplicate route "${definition.path}": "${byPath.get(definition.path)}" and "${definition.id}". ` +
        'The second is unreachable — give one of them a different path.',
      );
    }
    byPath.set(definition.path, definition.id);
  }
}

/** Attach the lazy component to each descriptor. */
export const modules = definitions.map((definition) => ({
  ...definition,
  Component: lazy(definition.load),
}));

export const moduleById = Object.fromEntries(modules.map((m) => [m.id, m]));

/** Sidebar structure: groups in order, each with its visible modules. */
export const navigation = NAV_GROUPS.map((group) => ({
  ...group,
  items: modules.filter((m) => m.group === group.key && !m.hidden),
})).filter((group) => group.items.length > 0);

export default modules;
