import type { Cadence } from './periods'

export type Category = 'Travel' | 'Dining' | 'Shopping' | 'Entertainment' | 'Wellness' | 'Transport'

/**
 * Confidence in the amount below:
 *  'verified' - multiple 2026 sources agree
 *  'check'    - sources disagree, or the benefit may have changed. Confirm in the Amex app.
 */
export type Confidence = 'verified' | 'check'

export interface Benefit {
  id: string
  name: string
  /** Credit available per period, in dollars. */
  amount: number
  cadence: Cadence
  category: Category
  /** Needs one-time enrollment in the Amex app before it pays out. */
  enroll: boolean
  note: string
  confidence: Confidence
  /** Off by default - benefit ended or may no longer be offered. */
  retired?: boolean
  /** Month-specific amount overrides, keyed by 0-based month. */
  monthOverrides?: Record<number, number>
}

/**
 * US Consumer Platinum, post-2025-refresh ($895 fee). Figures gathered Nov 2026 from
 * The Points Guy, CNBC Select, Upgraded Points and others. Where they disagreed the
 * amount is marked 'check' and the disagreement is named in the note. Every amount is
 * editable in the app, so correct anything that does not match your own statement.
 */
export const BENEFITS: Benefit[] = [
  {
    id: 'hotel',
    name: 'Hotel credit (Fine Hotels + Resorts / The Hotel Collection)',
    amount: 300,
    cadence: 'semiannual',
    category: 'Travel',
    enroll: false,
    confidence: 'verified',
    note: 'Prepaid booking through Amex Travel. Fine Hotels + Resorts requires a two-night minimum; The Hotel Collection does too. Book by Jun 30 and Dec 31. The halves don\u2019t roll over.',
  },
  {
    id: 'airline',
    name: 'Airline incidental fee credit',
    amount: 200,
    cadence: 'annual',
    category: 'Travel',
    enroll: true,
    confidence: 'verified',
    note: 'Pick one qualifying airline each January in your Amex account. Covers checked bags, seat assignments and lounge day passes, not the ticket itself. Buying a small gift card on some airlines is a known workaround.',
  },
  {
    id: 'resy',
    name: 'Resy dining credit',
    amount: 100,
    cadence: 'quarterly',
    category: 'Dining',
    enroll: true,
    confidence: 'check',
    note: 'Most 2026 sources say $100 per quarter ($400/yr); a few list $75 per quarter ($300/yr). Confirm your amount in the Amex app. US Resy-booked restaurants only.',
  },
  {
    id: 'lululemon',
    name: 'Lululemon credit',
    amount: 75,
    cadence: 'quarterly',
    category: 'Shopping',
    enroll: true,
    confidence: 'verified',
    note: 'US stores and lululemon.com. Outlet locations excluded.',
  },
  {
    id: 'digital-entertainment',
    name: 'Digital entertainment credit (YouTube TV)',
    amount: 25,
    cadence: 'monthly',
    category: 'Entertainment',
    enroll: true,
    confidence: 'verified',
    note: 'Eligible: Disney+ (and the Disney+ bundle), ESPN, Hulu, Paramount+, Peacock, YouTube Premium, YouTube TV, The New York Times and The Wall Street Journal. Netflix, Spotify and Max do not count. You must subscribe directly with the service: charges through an app store, a cable bundle or any reseller are excluded, as are gift cards. The $25 is a monthly pool across all eligible charges combined, so two $12 services use it up.',
  },
  {
    id: 'uber-cash',
    name: 'Uber Cash',
    amount: 15,
    cadence: 'monthly',
    category: 'Transport',
    enroll: false,
    confidence: 'verified',
    monthOverrides: { 11: 35 },
    note: 'Add the Platinum as a payment method in your Uber account to receive it. $15 a month plus a $20 bonus in December. Unused Uber Cash is forfeited at month end. It doesn\u2019t accumulate.',
  },
  {
    id: 'uber-one',
    name: 'Uber One membership credit',
    amount: 120,
    cadence: 'annual',
    category: 'Transport',
    enroll: true,
    confidence: 'check',
    note: 'Separate from Uber Cash. Requires an auto-renewing Uber One membership charged to the card. Confirm the amount and whether it pays monthly or annually on your statement.',
  },
  {
    id: 'clear',
    name: 'CLEAR Plus membership credit',
    amount: 209,
    cadence: 'annual',
    category: 'Travel',
    enroll: true,
    confidence: 'check',
    note: 'Sources list both $209 and $219, tracking CLEAR’s own price changes. Set this to whatever CLEAR actually bills you.',
  },
  {
    id: 'equinox',
    name: 'Equinox credit',
    amount: 25,
    cadence: 'monthly',
    category: 'Wellness',
    enroll: true,
    confidence: 'check',
    note: 'Up to $300 a year on Equinox club memberships or Equinox+. Reported as both a monthly $25 and an annual $300. Adjust the cadence if your statement differs.',
  },
  {
    id: 'walmart-plus',
    name: 'Walmart+ membership credit',
    amount: 12.95,
    cadence: 'monthly',
    category: 'Shopping',
    enroll: false,
    confidence: 'check',
    retired: true,
    note: 'Covers a monthly Walmart+ membership (not the annual plan). Only one 2026 source still lists this; others have dropped it. Off by default. Turn it on if it\u2019s still on your card.',
  },
  {
    id: 'saks',
    name: 'Saks Fifth Avenue credit',
    amount: 50,
    cadence: 'semiannual',
    category: 'Shopping',
    enroll: true,
    confidence: 'verified',
    retired: true,
    note: 'Ended June 30, 2026. Off by default, kept here so your earlier-2026 history still adds up.',
  },
]

export interface OneOffBenefit {
  id: string
  name: string
  amount: number
  everyYears: number
  note: string
}

export const ONE_OFFS: OneOffBenefit[] = [
  {
    id: 'global-entry',
    name: 'Global Entry / TSA PreCheck / NEXUS application fee',
    amount: 120,
    everyYears: 4,
    note: 'Reimbursed once every four years for Global Entry ($120) or once every 4.5 years for TSA PreCheck. Charge the application fee directly to the card.',
  },
]

export const CATEGORY_ORDER: Category[] = [
  'Travel', 'Dining', 'Shopping', 'Entertainment', 'Wellness', 'Transport',
]

export const DEFAULT_ANNUAL_FEE = 895
