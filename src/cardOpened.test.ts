import { describe, expect, it } from 'vitest'
import { BENEFITS } from './benefits'
import { periodFor } from './periods'
import { periodWasAvailable, yearTotals, type Claim, type LiveBenefit } from './store'

const benefits: LiveBenefit[] = BENEFITS.map((b) => ({
  ...b,
  enabled: !b.retired,
  edited: false,
}))

const OPENED = '2026-11-17'
const NOW = new Date('2026-11-20T12:00:00')
const noClaims = (): Claim | undefined => undefined

describe('periodWasAvailable', () => {
  it('excludes a period that closed before the card opened', () => {
    const q1 = periodFor('quarterly', new Date('2026-02-15T12:00:00'))
    expect(periodWasAvailable(q1, OPENED)).toBe(false)
  })

  it('includes a period that was still open on the opening date', () => {
    // Opened in November, so the Jul-Dec hotel credit is still claimable.
    const h2 = periodFor('semiannual', new Date('2026-11-20T12:00:00'))
    expect(periodWasAvailable(h2, OPENED)).toBe(true)
  })

  it('includes the period that ends on the opening date itself', () => {
    const oct = periodFor('monthly', new Date('2026-10-15T12:00:00'))
    expect(periodWasAvailable(oct, '2026-10-31')).toBe(true)
  })

  it('includes everything when no opening date is set', () => {
    const q1 = periodFor('quarterly', new Date('2026-02-15T12:00:00'))
    expect(periodWasAvailable(q1, null)).toBe(true)
  })

  it('ignores an unparseable date rather than hiding every period', () => {
    const q1 = periodFor('quarterly', new Date('2026-02-15T12:00:00'))
    expect(periodWasAvailable(q1, 'not-a-date')).toBe(true)
  })
})

describe('yearTotals with an opening date', () => {
  it('counts nothing as missed for a card opened days ago', () => {
    const totals = yearTotals(benefits, noClaims, 2026, NOW, OPENED)
    expect(totals.forfeited).toBe(0)
  })

  it('reports a large forfeited figure without an opening date', () => {
    const totals = yearTotals(benefits, noClaims, 2026, NOW, null)
    expect(totals.forfeited).toBeGreaterThan(1000)
  })

  it('counts only the credits a November cardholder can still reach', () => {
    const totals = yearTotals(benefits, noClaims, 2026, NOW, OPENED)

    // Nov + Dec monthly, Q4 quarterly, Jul-Dec semi-annual and the annual credits.
    const expected =
      25 * 2      // digital entertainment
      + 15 + 35   // Uber Cash, December pays the bonus
      + 25 * 2    // Equinox
      + 100       // Resy, Q4
      + 75        // lululemon, Q4
      + 300       // hotel, Jul-Dec
      + 200       // airline, annual
      + 209       // CLEAR, annual
      + 120       // Uber One, annual

    expect(totals.available).toBe(expected)
  })

  it('leaves the full-year figure alone when no date is set', () => {
    const withDate = yearTotals(benefits, noClaims, 2026, NOW, OPENED)
    const without = yearTotals(benefits, noClaims, 2026, NOW, null)
    expect(without.available).toBeGreaterThan(withDate.available)
  })
})
