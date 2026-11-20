import { describe, expect, it } from 'vitest'
import { BENEFITS } from './benefits'
import type { LiveBenefit } from './store'

/** Mirrors the derivation in useTracker: no enrollment needed, or confirmed. */
function live(enrolledState: Record<string, boolean>): LiveBenefit[] {
  return BENEFITS.map((b) => ({
    ...b,
    enabled: !b.retired,
    enrolled: !b.enroll || Boolean(enrolledState[b.id]),
    edited: false,
  }))
}

describe('enrollment', () => {
  it('starts unenrolled for every credit that requires it', () => {
    const needsEnrollment = live({}).filter((b) => b.enabled && !b.enrolled)
    // Seven of the nine active credits need a click in the Amex app first.
    expect(needsEnrollment.map((b) => b.id).sort()).toEqual([
      'airline', 'clear', 'digital-entertainment', 'equinox', 'lululemon', 'resy', 'uber-one',
    ])
  })

  it('treats credits needing no enrollment as enrolled from the start', () => {
    const always = live({}).filter((b) => b.enrolled && b.enabled)
    // Hotel and Uber Cash pay without any activation step.
    expect(always.map((b) => b.id).sort()).toEqual(['hotel', 'uber-cash'])
  })

  it('clears the flag once the cardholder confirms', () => {
    const after = live({ resy: true })
    expect(after.find((b) => b.id === 'resy')?.enrolled).toBe(true)
    expect(after.find((b) => b.id === 'lululemon')?.enrolled).toBe(false)
  })

  it('can be taken back', () => {
    expect(live({ resy: false }).find((b) => b.id === 'resy')?.enrolled).toBe(false)
  })

  it('counts the money that will not pay out until enrollment happens', () => {
    const stuck = live({}).filter((b) => b.enabled && !b.enrolled)
    const perPeriod = stuck.reduce((sum, b) => sum + b.amount, 0)
    // airline 200 + resy 100 + lululemon 75 + digital 25 + uber-one 120 + clear 209 + equinox 25
    expect(perPeriod).toBe(754)
  })
})
