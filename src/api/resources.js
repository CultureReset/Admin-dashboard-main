/**
 * Resource definitions.
 *
 * Each entry binds an endpoint group to the generic CRUD behaviour in
 * createResource.js, including the response key the API wraps its payload in.
 * Section modules import from here and never touch paths themselves.
 */

import { createResource } from './createResource.js';
import { endpoints as ep } from './endpoints.js';

/* --------------------------------------------------------------- entities -- */

export const entitiesResource = createResource({
  name: 'Entity',
  idField: 'slug',
  listPath: () => ep.entities.list(),
  createPath: () => ep.entities.create(),
  itemPath: (slug) => ep.entities.detail(slug),
  listKeys: ['entities'],
  itemKeys: ['entity'],
});

/* ------------------------------------------------------------------ menus -- */

export const menuSectionsResource = createResource({
  name: 'Menu section',
  createPath: ({ slug }) => ep.menu.sections(slug),
  itemPath: (id) => ep.menu.section(id),
  listKeys: ['sections', 'menu_sections'],
});

export const menuItemsResource = createResource({
  name: 'Menu item',
  createPath: ({ slug }) => ep.menu.items(slug),
  itemPath: (id) => ep.menu.item(id),
  listKeys: ['items', 'menu_items'],
});

export const drinkSectionsResource = createResource({
  name: 'Drink section',
  createPath: ({ slug }) => ep.drinks.sections(slug),
  listKeys: ['sections', 'drink_sections'],
});

export const drinkItemsResource = createResource({
  name: 'Drink',
  createPath: ({ slug }) => ep.drinks.items(slug),
  itemPath: (id) => ep.drinks.item(id),
  listKeys: ['items', 'drink_items'],
});

export const happyHourSectionsResource = createResource({
  name: 'Happy hour section',
  createPath: ({ slug }) => ep.happyHour.sections(slug),
  listKeys: ['sections', 'hh_sections'],
});

export const happyHourItemsResource = createResource({
  name: 'Happy hour item',
  createPath: ({ slug }) => ep.happyHour.items(slug),
  itemPath: (id) => ep.happyHour.item(id),
  listKeys: ['items', 'hh_items'],
});

/* ---------------------------------------------------------------- content -- */

export const eventsResource = createResource({
  name: 'Event',
  listPath: () => ep.events.list(),
  createPath: () => ep.events.create(),
  itemPath: (id) => ep.events.update(id),
  listKeys: ['events'],
  itemKeys: ['event'],
});

export const specialsResource = createResource({
  name: 'Special',
  listPath: () => ep.specials.list(),
  createPath: () => ep.specials.create(),
  itemPath: (id) => ep.specials.update(id),
  listKeys: ['specials'],
  itemKeys: ['special'],
});

export const adsResource = createResource({
  name: 'Ad',
  listPath: () => ep.ads.list(),
  createPath: () => ep.ads.create(),
  itemPath: (id) => ep.ads.update(id),
  listKeys: ['ads'],
  itemKeys: ['ad'],
});

export const railsResource = createResource({
  name: 'Rail',
  listPath: () => ep.rails.list(),
  createPath: () => ep.rails.create(),
  itemPath: (id) => ep.rails.update(id),
  listKeys: ['rails'],
  itemKeys: ['rail'],
});

export const railItemsResource = createResource({
  name: 'Rail slot',
  listPath: ({ railId }) => ep.rails.items(railId),
  createPath: ({ railId }) => ep.rails.items(railId),
  itemPath: (id) => ep.rails.item(id),
  listKeys: ['items'],
  itemKeys: ['item'],
});

export const couponsResource = createResource({
  name: 'Coupon',
  listPath: () => ep.coupons.list(),
  createPath: () => ep.coupons.create(),
  itemPath: (id) => ep.coupons.remove(id),
  listKeys: ['coupons'],
  itemKeys: ['coupon'],
});

export const claimsResource = createResource({
  name: 'Claim',
  listPath: () => ep.claims.list(),
  itemPath: (id) => ep.claims.update(id),
  listKeys: ['claims'],
  updateMethod: 'PATCH',
});

export const artistsResource = createResource({
  name: 'Artist',
  listPath: () => ep.artists.list(),
  createPath: () => ep.artists.create(),
  itemPath: (id) => ep.artists.update(id),
  listKeys: ['artists'],
  itemKeys: ['artist'],
});

export const photosResource = createResource({
  name: 'Photo',
  createPath: ({ slug }) => ep.entities.photos(slug),
  itemPath: (id) => ep.entities.photo(id),
  listKeys: ['photos'],
});

/* ------------------------------------------------------------ trip swipe -- */

export const sponsoredResource = createResource({
  name: 'Sponsored placement',
  listPath: () => ep.tripswipe.sponsored(),
  createPath: () => ep.tripswipe.sponsored(),
  itemPath: (id) => ep.tripswipe.sponsoredItem(id),
  listKeys: ['sponsored'],
});

export const promoCardsResource = createResource({
  name: 'Promo card',
  listPath: () => ep.tripswipe.promoCards(),
  createPath: () => ep.tripswipe.promoCards(),
  itemPath: (id) => ep.tripswipe.promoCard(id),
  listKeys: ['cards'],
});

export const touristsResource = createResource({
  name: 'Tourist',
  listPath: () => ep.tourists.list(),
  itemPath: (id) => ep.tourists.detail(id),
  listKeys: ['tourists'],
  idField: 'user_id',
});

export const setupQuestionsResource = createResource({
  name: 'Question',
  listPath: () => ep.setupQuestions.list(),
  createPath: () => ep.setupQuestions.create(),
  itemPath: (id) => ep.setupQuestions.update(id),
  listKeys: ['questions', 'setup_questions'],
});

export const smsQrResource = createResource({
  name: 'QR code',
  listPath: () => ep.sms.qrCodes(),
  createPath: () => ep.sms.qrCodes(),
  itemPath: (id) => ep.sms.qrCode(id),
  listKeys: ['qr_codes', 'codes'],
});

export const businessLeadsResource = createResource({
  name: 'Business lead',
  listPath: () => ep.leads.businessLeads(),
  itemPath: (id) => ep.leads.businessLead(id),
  listKeys: ['leads'],
  updateMethod: 'PATCH',
});

export const communityPhotosResource = createResource({
  name: 'Guest photo',
  listPath: () => ep.photos.community(),
  itemPath: (id) => ep.photos.communityItem(id),
  listKeys: ['photos'],
  updateMethod: 'PATCH',
});

/* ------------------------------------------------------------- platform -- */

export const appsResource = createResource({
  name: 'App',
  idField: 'app_id',
  listPath: () => ep.apps.list(),
  createPath: () => ep.apps.create(),
  itemPath: (appId) => ep.apps.update(appId),
  listKeys: ['apps'],
  itemKeys: ['app'],
});

export const businessesResource = createResource({
  name: 'Business',
  listPath: () => ep.businesses.list(),
  listKeys: ['businesses'],
});

export const usersResource = createResource({
  name: 'User',
  listPath: () => ep.auth.users(),
  listKeys: ['users'],
});

export const salesLeadsResource = createResource({
  name: 'Lead',
  listPath: () => ep.leads.salesLeads(),
  itemPath: (id) => ep.leads.salesLead(id),
  listKeys: ['leads', 'sales_leads'],
  updateMethod: 'PATCH',
});

export const bookingsResource = createResource({
  name: 'Booking',
  listPath: () => ep.bookings.list(),
  itemPath: (id) => ep.bookings.detail(id),
  listKeys: ['bookings'],
});

export const arHuntsResource = createResource({
  name: 'AR hunt',
  listPath: () => ep.arHunts.list(),
  createPath: () => ep.arHunts.create(),
  itemPath: (id) => ep.arHunts.update(id),
  listKeys: ['hunts', 'ar_hunts'],
  updateMethod: 'PATCH',
});

export const qrCodesResource = createResource({
  name: 'QR code',
  listPath: () => ep.qr.list(),
  createPath: () => ep.qr.create(),
  itemPath: (id) => ep.qr.detail(id),
  listKeys: ['qr_codes', 'codes'],
  updateMethod: 'PATCH',
});

export const qrPartnersResource = createResource({
  name: 'Partner',
  listPath: () => ep.qr.partners(),
  createPath: () => ep.qr.partners(),
  itemPath: (id) => ep.qr.partner(id),
  listKeys: ['partners'],
});

export const qrLocationsResource = createResource({
  name: 'Location',
  listPath: () => ep.qr.locations(),
  createPath: () => ep.qr.locations(),
  itemPath: (id) => ep.qr.location(id),
  listKeys: ['locations'],
});

export const socialPostsResource = createResource({
  name: 'Social post',
  listPath: () => ep.socialPosts.list(),
  createPath: () => ep.socialPosts.create(),
  itemPath: (id) => ep.socialPosts.update(id),
  listKeys: ['posts', 'social_posts'],
});

export const customersResource = createResource({
  name: 'Customer',
  listPath: () => ep.customers.list(),
  listKeys: ['customers'],
});

// Note: there is no platform-wide review resource. `routes/reviews.js` is
// slug-scoped with no collection route, so reviews are read per business —
// see `entityReviewsResource` below for the admin-side CRUD.

/* --------------------------------------------- per-entity collections -- */

/**
 * The GCR schema exposes many "list attached to an entity" tables that share
 * one route shape. One factory covers all of them, so adding another is a
 * single line rather than another resource file.
 */
export function entityCollectionResource(name, group, listKey) {
  return createResource({
    name,
    listPath: ({ slug }) => group.list(slug),
    createPath: ({ slug }) => group.create(slug),
    itemPath: (id) => group.item(id),
    listKeys: [listKey, 'items', 'rows'],
  });
}

export const pricingItemsResource = entityCollectionResource('Pricing item', ep.collections.pricingItems, 'pricing_items');
export const whatsIncludedResource = entityCollectionResource("What's included", ep.collections.whatsIncluded, 'whats_included');
export const requirementsResource = entityCollectionResource('Requirement', ep.collections.requirements, 'requirements');
export const faqsResource = entityCollectionResource('FAQ', ep.collections.faqs, 'faqs');
export const schedulesResource = entityCollectionResource('Schedule', ep.collections.schedules, 'schedules');
export const secondaryHoursResource = entityCollectionResource('Secondary hours', ep.collections.secondaryHours, 'secondary_hours');
export const teamResource = entityCollectionResource('Team member', ep.collections.team, 'team');
export const entityReviewsResource = entityCollectionResource('Review', ep.collections.reviews, 'reviews');
export const policiesResource = entityCollectionResource('Policy', ep.collections.policies, 'policies');
export const blogResource = entityCollectionResource('Post', ep.collections.blog, 'posts');
