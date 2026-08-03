/**
 * Resources for the admin booking engine.
 *
 * Kept separate from resources.js because these all share one filter shape —
 * `?slug=` narrows to a business, absent means every business — and because
 * the booking model is worth reading as a unit.
 */

import { createResource } from './createResource.js';
import { endpoints as ep } from './endpoints.js';

/** The catalog: charters, cruises, rentals, rooms, add-ons. */
export const offeringsResource = createResource({
  name: 'Offering',
  listPath: () => ep.bookingPlatform.offerings(),
  createPath: () => ep.bookingPlatform.offerings(),
  itemPath: (id) => ep.bookingPlatform.offering(id),
  listKeys: ['offerings'],
  itemKeys: ['offering'],
});

/** Tiered / per-person prices attached to one offering. */
export const offeringPricesResource = createResource({
  name: 'Price',
  listPath: ({ offeringId }) => ep.bookingPlatform.offeringPrices(offeringId),
  createPath: ({ offeringId }) => ep.bookingPlatform.offeringPrices(offeringId),
  itemPath: (id) => ep.bookingPlatform.offeringPrice(id),
  listKeys: ['prices'],
  itemKeys: ['price'],
});

/** The one booking table every booking-type app writes to. */
export const platformBookingsResource = createResource({
  name: 'Booking',
  listPath: () => ep.bookingPlatform.bookings(),
  createPath: () => ep.bookingPlatform.bookings(),
  itemPath: (id) => ep.bookingPlatform.booking(id),
  listKeys: ['bookings'],
  itemKeys: ['booking'],
  updateMethod: 'PATCH',
});

/** Every date claim, whatever made it — direct, manual block, FareHarbor, iCal. */
export const bookingCalendarResource = createResource({
  name: 'Calendar entry',
  listPath: () => ep.bookingPlatform.calendar(),
  createPath: () => ep.bookingPlatform.calendar(),
  itemPath: (id) => ep.bookingPlatform.calendarEntry(id),
  listKeys: ['entries'],
  itemKeys: ['entry'],
});

export const promosResource = createResource({
  name: 'Promo',
  listPath: () => ep.bookingPlatform.promos(),
  createPath: () => ep.bookingPlatform.promos(),
  itemPath: (id) => ep.bookingPlatform.promo(id),
  listKeys: ['promos'],
  itemKeys: ['promo'],
});

export const waiversResource = createResource({
  name: 'Waiver',
  listPath: () => ep.bookingPlatform.waivers(),
  listKeys: ['waivers'],
});

/**
 * External iCal feeds — the second way dates get claimed, alongside the email
 * parser. A business pastes their Airbnb/VRBO/Google .ics export URL and a
 * cron polls it. Note this is the FEED list, not the date claims those feeds
 * write; those are `bookingCalendarResource` above.
 */
export const icalFeedsResource = createResource({
  name: 'Calendar feed',
  listPath: () => ep.bookingPlatform.icalFeeds(),
  createPath: () => ep.bookingPlatform.icalFeeds(),
  itemPath: (id) => ep.bookingPlatform.icalFeed(id),
  listKeys: ['calendars'],
  itemKeys: ['calendar'],
  updateMethod: 'PATCH',
});

/** gcr_deals — what gets published when a date has spots left. */
export const dealsResource = createResource({
  name: 'Deal',
  listPath: () => ep.bookingPlatform.deals(),
  createPath: () => ep.bookingPlatform.deals(),
  itemPath: (id) => ep.bookingPlatform.deal(id),
  listKeys: ['deals'],
  itemKeys: ['deal'],
  updateMethod: 'PATCH',
});

/** Where a feed's dates come from. Free text on the row; these are the ones seen. */
export const ICAL_PROVIDERS = [
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'vrbo', label: 'VRBO' },
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'google', label: 'Google Calendar' },
  { value: 'other', label: 'Other' },
];

/** Deal types the public /deals feed renders. */
export const DEAL_TYPES = [
  { value: 'last_minute', label: 'Last minute' },
  { value: 'charter_opening', label: 'Charter opening' },
  { value: 'rental_gap', label: 'Rental gap' },
  { value: 'happy_hour', label: 'Happy hour' },
  { value: 'special', label: 'Special' },
];

/** business_availability.status, as written by the parser and the iCal import. */
export const AVAILABILITY_STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'limited', label: 'Limited' },
  { value: 'full', label: 'Full' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'unknown', label: 'Unknown' },
];

export const AVAILABILITY_STATUS_TONES = {
  available: 'success',
  limited: 'warning',
  full: 'danger',
  blocked: 'neutral',
  unknown: 'neutral',
};

/* ── shared vocabulary ───────────────────────────────────────────────── */
//
// Mirrors OFFERING_KINDS and the unit list in routes/admin-platform.js. The
// API also serves these on /offering-meta; these are the fallback so a form
// still renders if that call is slow or fails.

export const OFFERING_KINDS = [
  { value: 'service', label: 'Service — charter, cruise, tour' },
  { value: 'fleet', label: 'Fleet — boat, jet ski, kayak' },
  { value: 'room', label: 'Room — condo, suite, rental' },
  { value: 'addon', label: 'Add-on — gear, catering, extras' },
  { value: 'item', label: 'Inventory item' },
  { value: 'gift_card', label: 'Gift card' },
  { value: 'membership', label: 'Membership' },
  { value: 'product', label: 'Product' },
  { value: 'offering', label: 'Other' },
];

export const OFFERING_UNITS = [
  { value: 'flat', label: 'Flat rate' },
  { value: 'person', label: 'Per person' },
  { value: 'hour', label: 'Per hour' },
  { value: 'half_day', label: 'Per half day' },
  { value: 'day', label: 'Per day' },
  { value: 'night', label: 'Per night' },
  { value: 'item', label: 'Per item' },
  { value: 'ticket', label: 'Per ticket' },
];

export const BOOKING_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No show' },
];

export const BOOKING_STATUS_TONES = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'info',
  cancelled: 'danger',
  no_show: 'danger',
};
