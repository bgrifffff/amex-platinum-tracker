import { describe, expect, it } from 'vitest'
import { BENEFITS } from './benefits'
import { yearTotals, type Claim, type LiveBenefit } from './store'

const benefits: LiveBenefit[] = BENEFITS.map((b) => ({
  ...b,
  enabled: !b.retired,
  enrolled: true,
  edited: false,
}))

const OPENED = '2026-11-17'
const NOW = new Date('2026-11-20T12:00:00')
const noClaims = (): Claim | undefined => undefined

function skipping(...keys: string[]) {
  const set = new Set(keys)
  return (benefitId: string, periodKey: string) => set.has(`${benefitId}|${periodKey}`)
}

describe('periods the cardholder cannot use', () => {
  it('drops a skipped annual credit out of what is on offer', () => {
    const before = yearTotals(benefits, noClaims, 2026, NOW, OPENED)
    // CLEAR was billed for 2026 before the card existed, so its $209 was never reachable.
    const after = yearTotals(benefits, noClaims, 2026, NOW, OPENED, skipping('clear|2026'))

    expect(before.available - after.available).toBe(209)
  })

  it('drops only the named period of a monthly credit', () => {
    const before = yearTotals(benefits, noClaims, 2026, NOW, OPENED)
    // YouTube TV was already billed this month, so November is out but December stands.
    const after = yearTotals(
      benefits, noClaims, 2026, NOW, OPENED, skipping('digital-entertainment|2026-11'),
    )

    expect(before.available - after.available).toBe(25)
  })

  it('does not count a skipped period as expired once it closes', () => {
    const december = new Date('2026-12-15T12:00:00')
    const skipped = skipping('digital-entertainment|2026-11')

    const blamed = yearTotals(benefits, noClaims, 2026, december, OPENED)
    const fair = yearTotals(benefits, noClaims, 2026, december, OPENED, skipped)

    // November closed unused either way, but only one of these calls it a loss.
    expect(blamed.forfeited - fair.forfeited).toBe(25)
  })

  it('leaves everything else untouched', () => {
    const after = yearTotals(benefits, noClaims, 2026, NOW, OPENED, skipping('clear|2026'))
    const expectedWithoutClear = 1154 - 209
    expect(after.available).toBe(expectedWithoutClear)
  })

  it('ignores a skip for a period that was already outside the card', () => {
    const after = yearTotals(
      benefits, noClaims, 2026, NOW, OPENED, skipping('digital-entertainment|2026-03'),
    )
    const untouched = yearTotals(benefits, noClaims, 2026, NOW, OPENED)
    expect(after.available).toBe(untouched.available)
  })
})
