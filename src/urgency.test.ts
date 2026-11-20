import { describe, expect, it } from 'vitest'
import { CRITICAL_DAYS, URGENT_DAYS, statusOf } from './components/BenefitCard'

describe('statusOf', () => {
  it('grades on days left, not on the share of the period remaining', () => {
    // The bug this replaces: a $25 monthly credit with 10 days left scored "open"
    // while a $300 semi-annual credit with 41 days left scored "urgent", so the
    // money dying first looked the calmest.
    const monthlyTenDays = statusOf(25, 0, 10)
    const semiAnnualFortyOne = statusOf(300, 0, 41)

    expect(monthlyTenDays).toBe('urgent')
    expect(semiAnnualFortyOne).toBe('open')
  })

  it('treats the same days left identically whatever the credit', () => {
    expect(statusOf(25, 0, 10)).toBe(statusOf(300, 0, 10))
  })

  it('calls the last week critical', () => {
    expect(statusOf(100, 0, CRITICAL_DAYS)).toBe('critical')
    expect(statusOf(100, 0, CRITICAL_DAYS + 1)).toBe('urgent')
  })

  it('stops being urgent past the urgent window', () => {
    expect(statusOf(100, 0, URGENT_DAYS)).toBe('urgent')
    expect(statusOf(100, 0, URGENT_DAYS + 1)).toBe('open')
  })

  it('reports done regardless of how little time is left', () => {
    expect(statusOf(100, 100, 0)).toBe('done')
    expect(statusOf(100, 120, 0)).toBe('done')
  })

  it('reports partial only when time is not pressing', () => {
    expect(statusOf(100, 40, 200)).toBe('partial')
    // A part-used credit about to expire is urgent, not merely partial.
    expect(statusOf(100, 40, 3)).toBe('critical')
  })
})
