import { describe, expect, it } from 'vitest'
import { BENEFITS } from './benefits'
import { awaitingCredit, creditTotals, matchTransactions, type Txn } from './matching'
import type { LiveBenefit } from './store'

const benefits: LiveBenefit[] = BENEFITS.map((b) => ({
  ...b,
  enabled: !b.retired,
  edited: false,
}))

function txn(partial: Partial<Txn> & Pick<Txn, 'name' | 'amount' | 'date'>): Txn {
  return {
    id: Math.random().toString(36).slice(2),
    merchant: null,
    pending: false,
    category: null,
    ...partial,
  }
}

describe('statement credit matching', () => {
  it('matches a Resy credit of the exact amount with high confidence', () => {
    const r = matchTransactions([
      txn({ name: 'RESY CREDIT', amount: -100, date: '2026-11-04' }),
    ], benefits)

    expect(r.credits).toHaveLength(1)
    expect(r.credits[0]).toMatchObject({
      benefitId: 'resy',
      periodKey: '2026-Q4',
      amount: 100,
      confidence: 'high',
    })
    expect(r.unclaimed).toHaveLength(0)
  })

  it('files a credit into the period its date falls in, not the current one', () => {
    const r = matchTransactions([
      txn({ name: 'LULULEMON CREDIT', amount: -75, date: '2026-02-11' }),
    ], benefits)

    expect(r.credits[0].periodKey).toBe('2026-Q1')
  })

  it('ignores card payments, which are also money in', () => {
    const r = matchTransactions([
      txn({ name: 'ONLINE PAYMENT - THANK YOU', amount: -2400, date: '2026-11-02', category: 'LOAN_PAYMENTS' }),
      txn({ name: 'AUTOPAY PAYMENT', amount: -1800, date: '2026-10-02' }),
      txn({ name: 'Payment Received', amount: -900, date: '2026-09-02' }),
    ], benefits)

    expect(r.credits).toHaveLength(0)
    expect(r.unclaimed).toHaveLength(0)
  })

  it('does not treat a purchase as proof the credit arrived', () => {
    const r = matchTransactions([
      txn({ name: 'LULULEMON 442 BROADWAY', amount: 180, date: '2026-11-03' }),
    ], benefits)

    expect(r.credits).toHaveLength(0)
    expect(r.pending).toHaveLength(1)
    expect(awaitingCredit(r).has('lululemon|2026-Q4')).toBe(true)
  })

  it('stops awaiting once the matching credit posts', () => {
    const r = matchTransactions([
      txn({ name: 'LULULEMON 442 BROADWAY', amount: 180, date: '2026-11-03' }),
      txn({ name: 'LULULEMON CREDIT', amount: -75, date: '2026-11-19' }),
    ], benefits)

    expect(awaitingCredit(r).size).toBe(0)
    expect(creditTotals(r.credits).get('lululemon|2026-Q4')).toBe(75)
  })

  it('flags a credit larger than the benefit rather than silently accepting it', () => {
    const r = matchTransactions([
      txn({ name: 'RESY CREDIT', amount: -400, date: '2026-11-04' }),
    ], benefits)

    expect(r.credits).toHaveLength(0)
    expect(r.unclaimed).toHaveLength(1)
  })

  it('surfaces unrecognised credits instead of guessing', () => {
    const r = matchTransactions([
      txn({ name: 'AMEX BENEFIT ADJ 4471', amount: -25, date: '2026-11-10' }),
    ], benefits)

    expect(r.credits).toHaveLength(0)
    expect(r.unclaimed).toHaveLength(1)
  })

  it('applies a descriptor the user has taught it', () => {
    const r = matchTransactions(
      [txn({ name: 'AMEX BENEFIT ADJ 4471', amount: -25, date: '2026-11-10' })],
      benefits,
      [{ pattern: 'AMEX BENEFIT ADJ', benefitId: 'digital-entertainment' }],
    )

    expect(r.unclaimed).toHaveLength(0)
    expect(r.credits[0]).toMatchObject({
      benefitId: 'digital-entertainment',
      periodKey: '2026-11',
      confidence: 'high',
    })
  })

  it('never auto-confirms Uber Cash, which posts no statement credit', () => {
    const r = matchTransactions([
      txn({ name: 'UBER   *EATS', amount: 42.5, date: '2026-11-08' }),
      txn({ name: 'UBER TRIP HELP.UBER.COM', amount: 18.2, date: '2026-11-09' }),
    ], benefits)

    expect(r.credits.some((c) => c.benefitId === 'uber-cash')).toBe(false)
    expect(r.pending.some((p) => p.benefitId === 'uber-cash')).toBe(false)
  })

  it('skips pending transactions until they post', () => {
    const r = matchTransactions([
      txn({ name: 'RESY CREDIT', amount: -100, date: '2026-11-04', pending: true }),
    ], benefits)

    expect(r.credits).toHaveLength(0)
    expect(r.unclaimed).toHaveLength(0)
  })

  it('ignores credits for benefits the user has switched off', () => {
    const off = benefits.map((b) => (b.id === 'resy' ? { ...b, enabled: false } : b))
    const r = matchTransactions([
      txn({ name: 'RESY CREDIT', amount: -100, date: '2026-11-04' }),
    ], off)

    expect(r.credits).toHaveLength(0)
    expect(r.unclaimed).toHaveLength(1)
  })

  it('sums two part-credits in the same period', () => {
    const r = matchTransactions([
      txn({ name: 'RESY CREDIT', amount: -60, date: '2026-11-04' }),
      txn({ name: 'RESY CREDIT', amount: -40, date: '2026-11-18' }),
    ], benefits)

    expect(creditTotals(r.credits).get('resy|2026-Q4')).toBe(100)
    expect(r.credits.every((c) => c.confidence === 'medium')).toBe(true)
  })
})
