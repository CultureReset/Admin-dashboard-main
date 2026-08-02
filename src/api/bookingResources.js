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
