// All layout constants and animation timings live here so they can be retuned
// after testing on a phone. Units are CSS px == iOS pt.
// Measured from docs/reference/wallet-pass.png (1206x2622 @3x = 402x874 pt).

export const LAYOUT = {
  sideInset: 20,          // card x 20 -> (viewport - 20)
  gap: 8,                 // gap between cards (peek = 20 - 8 = 12pt)
  cardTop: 128,
  cardHeight: 381,        // 128 -> 509
  cardRadius: 3,
  headerHeight: 65,       // 128 -> 193
  bandHeight: 95,         // 193 -> 288
  notch: { radius: 40, centerAbove: 24 }, // circle r40 whose center sits 24pt above the top edge

  buttons: { top: 62, size: 44, leftCenter: 38, rightInset: 38 }, // centers at (38,84) and (W-38,84)

  dotsCenterY: 526,
  dotSize: 7,
  dotPitch: 17.7,
  dotsShrinkAfter: 10,

  nfc: {
    centerY: 587.67,
    ringOuter: 63,        // odd width keeps ring & phone on one pixel center
    ringStroke: 3.67,
    phoneW: 35,           // odd width (incl. 1.67 outline)
    phoneH: 60,
    phoneTopAboveCenter: 16.33,
    phoneRadius: 6,
    phoneOutline: 1.67,
    knockout: 1.3,        // black outline that cuts the thin line through the ring
    clipInset: 3,         // clip circle = ring outer - 2*3
    perspective: 160 * 1.018,
    originY: 75,
    textCenterY: 643,
    textSize: 22,
  },
};

// Card-relative positions. Text is positioned by BASELINE so fallback fonts line up
// vertically with SF Pro (see placeText in card.js).
export const CARD = {
  headerLogo: { x: 13, baseline: 37.67 },
  headerCol: { right: 16 },                 // time over date, column pinned right, text left-aligned
  time: { baseline: 20.33 },
  date: { baseline: 40.67 },
  band: { logoSize: 66 },
  body: { left: 15.5, right: 15.7 },
  venueLabel: { baseline: 177.67 },
  eventTitle: { baseline: 195.33, minSize: 14 },
  row1: { labelBaseline: 225.85, valueBaseline: 247.33 },
  row2: { labelBaseline: 273.67, valueBaseline: 294.0 },
  rowX: 178.3,           // ROW column left
  ticketTypeRight: 16,   // TICKET TYPE column pinned right, text left-aligned (matches both refs)
  labelSize: 10,
  appIcon: { left: 7, bottom: 6, size: 20, radius: 5 },
  nfcSymbol: { right: 8.3, bottom: 6.7, w: 18.4, h: 22.7 },
  footerText: { right: 8, baselineFromBottom: 10.5 },
};

export const COLORS = {
  buttonFill: '#181818',
  buttonStroke: '#3A3A3A',
  dotActive: '#FFFFFF',
  dotInactive: '#4B4C4D',
  ring: '#3F8EF7',
  phoneDark: '#0C284D',
  phoneLight: '#063A76',
  holdText: '#8D8D92',
};

export const TIMING = {
  longPressMs: 600,
  // NFC entrance (launch + after every swipe), seconds from swipe start
  fadeOutStart: 0.0,      // relative to the moment the swipe is committed (~0.15s after touch)
  fadeOutDur: 0.22,
  hiddenHold: 0.13,
  fadeInDur: 0.2,
  phoneEnterDelay: 0.0,   // after fade-in ends
  phoneEnterDur: 0.38,
  phoneEnterTravel: 42,
  flatHold: 0.32,
  loopDur: 3.2,           // open question §13.1 — rest time unknown
  launchDelay: 0.15,
  swipeCommitFraction: 0.25, // fade starts once the card has moved this fraction of a page
};

export const STORAGE_KEY = 'walletProp.v2';
export const STORAGE_KEY_V1 = 'walletProp.v1';
export const IMAGE_DB = 'walletProp.images';

export const ELEMENTS = [
  { id: 'headerLogo', name: 'Header logo', kind: 'image' },
  { id: 'time', name: 'Time', kind: 'text', role: 'label' },
  { id: 'date', name: 'Date', kind: 'text', role: 'value' },
  { id: 'band', name: 'Band', kind: 'band' },
  { id: 'venueLabel', name: 'Venue', kind: 'text', role: 'label' },
  { id: 'eventTitle', name: 'Event title', kind: 'text', role: 'value' },
  { id: 'section', name: 'Section', kind: 'field' },
  { id: 'row', name: 'Row', kind: 'field' },
  { id: 'seat', name: 'Seat', kind: 'field' },
  { id: 'entryInfo', name: 'Entry info', kind: 'field' },
  { id: 'ticketType', name: 'Ticket type', kind: 'field' },
  { id: 'appIcon', name: 'App icon', kind: 'icon' },
  { id: 'footer', name: 'Footer', kind: 'footer' },
];

export const FIELD_IDS = ['section', 'row', 'seat', 'entryInfo', 'ticketType'];
export const TEXT_IDS = ['time', 'date', 'venueLabel', 'eventTitle'];

export const SWATCHES = ['#FFFFFF', '#000000', '#1C1C1E', '#22262D', '#8E8E93', '#C7C7CC',
  '#4C8DF6', '#2D6BE0', '#0A84FF', '#30D158', '#FF9F0A', '#FF453A', '#BF5AF2', '#E9CBFB', '#F2A33A'];
