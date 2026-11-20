import { periodFor } from './periods'
import type { LiveBenefit } from './store'

export interface Txn {
  id: string
  date: string
  name: string
  merchant: string | null
  /** Plaid convention: positive is money out (a charge), negative is money in (a credit). */
  amount: number
  pending: boolean
  category: string | null
}

export type Confidence = 'high' | 'medium'

export interface DetectedCredit {
  transactionId: string
  benefitId: string
  periodKey: string
  /** Positive dollars credited. */
  amount: number
  date: string
  name: string
  confidence: Confidence
}

export interface PendingSpend {
  transactionId: string
  benefitId: string
  periodKey: string
  amount: number
  date: string
  name: string
}

export interface MatchResult {
  credits: DetectedCredit[]
  pending: PendingSpend[]
  /** Money-in lines that look like benefit credits but matched no rule. */
  unclaimed: Txn[]
}

export interface LearnedRule {
  /** Case-insensitive substring of the transaction descriptor. */
  pattern: string
  benefitId: string
}

interface Rule {
  benefitId: string
  /** Descriptors Amex may use on the statement credit itself. */
  credit: RegExp[]
  /** Descriptors on the qualifying purchase, used to flag "spent, awaiting credit". */
  purchase: RegExp[]
}

/**
 * Amex does not publish its statement-credit descriptors, so these are informed guesses.
 * Anything they miss lands in `unclaimed`, where one click teaches the app the real wording
 * and that lesson is saved as a LearnedRule.
 */
export const RULES: Rule[] = [
  {
    benefitId: 'hotel',
    credit: [/fine hotels/i, /hotel collection/i, /\bFHR\b/i, /hotel credit/i],
    purchase: [/amex travel/i, /american express travel/i, /amextravel/i],
  },
  {
    benefitId: 'airline',
    credit: [/airline fee/i, /airline incidental/i, /airline credit/i],
    purchase: [/\bbaggage\b/i, /seat assignment/i, /in-?flight/i],
  },
  {
    benefitId: 'resy',
    credit: [/\bresy\b/i, /dining credit/i],
    purchase: [/\bresy\b/i],
  },
  {
    benefitId: 'lululemon',
    credit: [/lululemon/i],
    purchase: [/lululemon/i],
  },
  {
    benefitId: 'digital-entertainment',
    credit: [/digital entertainment/i, /entertainment credit/i],
    purchase: [/disney\s*plus/i, /disney\+/i, /\bhulu\b/i, /espn\+/i, /\bpeacock\b/i, /nytimes/i, /new york times/i, /siriusxm/i],
  },
  {
    benefitId: 'uber-one',
    credit: [/uber ?one/i],
    purchase: [/uber ?one/i],
  },
  {
    benefitId: 'clear',
    credit: [/\bclear\b/i, /clearme/i],
    purchase: [/\bclear\b/i, /clearme/i],
  },
  {
    benefitId: 'equinox',
    credit: [/equinox/i],
    purchase: [/equinox/i],
  },
  {
    benefitId: 'walmart-plus',
    credit: [/walmart\s*\+/i, /walmart plus/i],
    purchase: [/walmart\s*\+/i, /walmart plus/i],
  },
  {
    benefitId: 'saks',
    credit: [/\bsaks\b/i],
    purchase: [/\bsaks\b/i],
  },
]

/** Benefits whose credit never appears on the card statement, so we must not guess. */
export const UNDETECTABLE: Record<string, string> = {
  'uber-cash': 'Uber Cash is loaded into your Uber account, not posted as a statement credit. Nothing on the card can confirm it, so this one stays manual.',
}

/** Card payments are also money-in. They are not benefit credits. */
function isCardPayment(t: Txn): boolean {
  if (t.category === 'LOAN_PAYMENTS' || t.category === 'TRANSFER_IN') return true
  return /payment (received|thank)/i.test(t.name) || /autopay/i.test(t.name) || /^payment\b/i.test(t.name.trim())
}

function isMoneyIn(t: Txn): boolean {
  return t.amount < 0
}

function descriptor(t: Txn): string {
  return [t.name, t.merchant].filter(Boolean).join(' ')
}

export function matchTransactions(
  txns: Txn[],
  benefits: LiveBenefit[],
  learned: LearnedRule[] = [],
): MatchResult {
  const byId = new Map(benefits.map((b) => [b.id, b]))
  const credits: DetectedCredit[] = []
  const pending: PendingSpend[] = []
  const unclaimed: Txn[] = []

  for (const t of txns) {
    if (t.pending) continue
    const text = descriptor(t)
    const when = new Date(t.date + 'T12:00:00')
    if (Number.isNaN(when.getTime())) continue

    if (isMoneyIn(t)) {
      if (isCardPayment(t)) continue
      const dollars = Math.abs(t.amount)

      const taught = learned.find((l) => text.toLowerCase().includes(l.pattern.toLowerCase()))
      const rule = taught
        ? RULES.find((r) => r.benefitId === taught.benefitId) ?? { benefitId: taught.benefitId, credit: [], purchase: [] }
        : RULES.find((r) => r.credit.some((re) => re.test(text)))

      const benefit = rule ? byId.get(rule.benefitId) : undefined
      if (!rule || !benefit || !benefit.enabled) {
        unclaimed.push(t)
        continue
      }

      const period = periodFor(benefit.cadence, when)
      // An exact amount match is strong evidence; a descriptor match alone is weaker.
      const exact = Math.abs(dollars - benefit.amount) < 0.01
      if (dollars > benefit.amount * 1.05 && !taught) {
        unclaimed.push(t)
        continue
      }
      credits.push({
        transactionId: t.id,
        benefitId: benefit.id,
        periodKey: period.key,
        amount: dollars,
        date: t.date,
        name: t.name,
        confidence: exact || taught ? 'high' : 'medium',
      })
    } else {
      const rule = RULES.find((r) => r.purchase.length > 0 && r.purchase.some((re) => re.test(text)))
      if (!rule) continue
      const benefit = byId.get(rule.benefitId)
      if (!benefit || !benefit.enabled) continue
      const period = periodFor(benefit.cadence, when)
      pending.push({
        transactionId: t.id,
        benefitId: benefit.id,
        periodKey: period.key,
        amount: t.amount,
        date: t.date,
        name: t.name,
      })
    }
  }

  return { credits, pending, unclaimed }
}

/** Total credited per benefit per period, capped by the benefit amount. */
export function creditTotals(credits: DetectedCredit[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of credits) {
    const key = c.benefitId + '|' + c.periodKey
    out.set(key, (out.get(key) ?? 0) + c.amount)
  }
  return out
}

/** Periods where a qualifying purchase posted but no credit has arrived yet. */
export function awaitingCredit(result: MatchResult): Set<string> {
  const credited = new Set(result.credits.map((c) => c.benefitId + '|' + c.periodKey))
  const out = new Set<string>()
  for (const p of result.pending) {
    const key = p.benefitId + '|' + p.periodKey
    if (!credited.has(key)) out.add(key)
  }
  return out
}
