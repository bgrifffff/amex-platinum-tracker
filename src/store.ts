import { useCallback, useEffect, useMemo, useState } from 'react'
import { BENEFITS, ONE_OFFS, DEFAULT_ANNUAL_FEE, type Benefit } from './benefits'
import { type Cadence, type PeriodRef, periodCount, periodsInYear } from './periods'

const STORAGE_KEY = 'amex-platinum-tracker.v1'

export interface Claim {
  /** Dollars of the credit used in this period. */
  used: number
  /** ISO timestamp of the last edit. */
  at: string
}

export interface Override {
  amount?: number
  cadence?: Cadence
  enabled?: boolean
}

export interface AppState {
  version: 1
  annualFee: number
  /**
   * ISO date (YYYY-MM-DD) the card was opened, or null if not set. Periods that
   * closed before this date were never available, so they are not counted as missed.
   */
  cardOpened: string | null
  /** benefitId -> periodKey -> claim */
  claims: Record<string, Record<string, Claim>>
  overrides: Record<string, Override>
  oneOffs: Record<string, { usedYear: number | null }>
  /**
   * benefitId -> true once enrolled in the Amex app. Most credits pay nothing
   * until enrolled, and nothing in the transaction data reveals enrollment, so
   * this is the one thing only the cardholder can tell us.
   */
  enrolled: Record<string, boolean>
  /**
   * benefitId -> periodKey -> true for a period the cardholder cannot use at all,
   * typically because they were already billed for the service outside the window.
   * Distinct from unused: skipped money was never reachable, so counting it as
   * missed would blame them for something they could not have done.
   */
  skipped: Record<string, Record<string, boolean>>
}

function emptyState(): AppState {
  return {
    version: 1,
    annualFee: DEFAULT_ANNUAL_FEE,
    cardOpened: null,
    claims: {},
    overrides: {},
    oneOffs: {},
    enrolled: {},
    skipped: {},
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      version: 1,
      annualFee: typeof parsed.annualFee === 'number' ? parsed.annualFee : DEFAULT_ANNUAL_FEE,
      cardOpened: typeof parsed.cardOpened === 'string' ? parsed.cardOpened : null,
      claims: parsed.claims ?? {},
      overrides: parsed.overrides ?? {},
      oneOffs: parsed.oneOffs ?? {},
      enrolled: parsed.enrolled ?? {},
      skipped: parsed.skipped ?? {},
    }
  } catch {
    return emptyState()
  }
}

/** A benefit with the user's edits applied. */
export interface LiveBenefit extends Benefit {
  enabled: boolean
  /** True when no enrollment is required, or the cardholder has confirmed it. */
  enrolled: boolean
  /** True when the user has changed the amount or cadence away from the shipped default. */
  edited: boolean
}

export function amountForPeriod(b: LiveBenefit, period: PeriodRef): number {
  if (b.cadence === 'monthly' && b.monthOverrides) {
    const override = b.monthOverrides[period.index]
    if (typeof override === 'number') return override
  }
  return b.amount
}

/** What this benefit is worth across a full calendar year. */
export function annualValue(b: LiveBenefit): number {
  if (b.cadence === 'monthly' && b.monthOverrides) {
    let total = 0
    for (let m = 0; m < 12; m++) total += b.monthOverrides[m] ?? b.amount
    return total
  }
  return b.amount * periodCount(b.cadence)
}

export function useTracker() {
  const [state, setState] = useState<AppState>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* private window or blocked storage: the app still works for this session */
    }
  }, [state])

  const benefits = useMemo<LiveBenefit[]>(() => BENEFITS.map((b) => {
    const o = state.overrides[b.id] ?? {}
    return {
      ...b,
      amount: o.amount ?? b.amount,
      cadence: o.cadence ?? b.cadence,
      enabled: o.enabled ?? !b.retired,
      enrolled: !b.enroll || Boolean(state.enrolled[b.id]),
      edited: o.amount !== undefined || o.cadence !== undefined,
    }
  }), [state.overrides, state.enrolled])

  const claimFor = useCallback(
    (benefitId: string, periodKey: string): Claim | undefined => state.claims[benefitId]?.[periodKey],
    [state.claims],
  )

  const setUsed = useCallback((benefitId: string, periodKey: string, used: number) => {
    setState((s) => {
      const forBenefit = { ...(s.claims[benefitId] ?? {}) }
      if (used <= 0) {
        delete forBenefit[periodKey]
      } else {
        forBenefit[periodKey] = { used, at: new Date().toISOString() }
      }
      return { ...s, claims: { ...s.claims, [benefitId]: forBenefit } }
    })
  }, [])

  const setOverride = useCallback((benefitId: string, patch: Override) => {
    setState((s) => ({
      ...s,
      overrides: { ...s.overrides, [benefitId]: { ...(s.overrides[benefitId] ?? {}), ...patch } },
    }))
  }, [])

  const resetOverride = useCallback((benefitId: string) => {
    setState((s) => {
      const next = { ...s.overrides }
      delete next[benefitId]
      return { ...s, overrides: next }
    })
  }, [])

  const setAnnualFee = useCallback((annualFee: number) => {
    setState((s) => ({ ...s, annualFee }))
  }, [])

  const setCardOpened = useCallback((cardOpened: string | null) => {
    setState((s) => ({ ...s, cardOpened }))
  }, [])

  const setEnrolled = useCallback((benefitId: string, enrolled: boolean) => {
    setState((s) => ({ ...s, enrolled: { ...s.enrolled, [benefitId]: enrolled } }))
  }, [])

  const setSkipped = useCallback((benefitId: string, periodKey: string, skipped: boolean) => {
    setState((s) => {
      const forBenefit = { ...(s.skipped[benefitId] ?? {}) }
      if (skipped) forBenefit[periodKey] = true
      else delete forBenefit[periodKey]
      return { ...s, skipped: { ...s.skipped, [benefitId]: forBenefit } }
    })
  }, [])

  const isSkipped = useCallback(
    (benefitId: string, periodKey: string) => Boolean(s_skipped(state, benefitId, periodKey)),
    [state],
  )

  const setOneOffYear = useCallback((id: string, usedYear: number | null) => {
    setState((s) => ({ ...s, oneOffs: { ...s.oneOffs, [id]: { usedYear } } }))
  }, [])

  const clearYear = useCallback((year: number) => {
    setState((s) => {
      const claims: AppState['claims'] = {}
      for (const [benefitId, byPeriod] of Object.entries(s.claims)) {
        const kept: Record<string, Claim> = {}
        for (const [key, claim] of Object.entries(byPeriod)) {
          if (!key.startsWith(String(year))) kept[key] = claim
        }
        if (Object.keys(kept).length) claims[benefitId] = kept
      }
      return { ...s, claims }
    })
  }, [])

  const importState = useCallback((incoming: AppState) => setState(incoming), [])

  return {
    state, benefits, claimFor, setUsed, setOverride, resetOverride,
    setAnnualFee, setCardOpened, setEnrolled, setSkipped, isSkipped, setOneOffYear,
    clearYear, importState,
    oneOffs: ONE_OFFS,
  }
}

function s_skipped(state: AppState, benefitId: string, periodKey: string): boolean {
  return Boolean(state.skipped[benefitId]?.[periodKey])
}

/**
 * A period belongs to the cardholder if it was still open when the card was.
 * A period that had already closed before the card opened was never theirs to use,
 * so it must not count as missed. A period that straddles the open date does count:
 * the Jul-Dec hotel credit is available to someone who opened the card in November.
 */
export function periodWasAvailable(period: PeriodRef, cardOpened: string | null): boolean {
  if (!cardOpened) return true
  const opened = new Date(cardOpened + 'T00:00:00')
  if (Number.isNaN(opened.getTime())) return true
  return period.end.getTime() >= opened.getTime()
}

export interface YearTotals {
  /** Credit value available across the whole year, enabled benefits only. */
  available: number
  /** Credit value available in periods that have already started. */
  availableToDate: number
  /** Credit the user has marked as used. */
  used: number
  /** Value in periods that have closed with the credit unused. */
  forfeited: number
}

export function yearTotals(
  benefits: LiveBenefit[],
  claimFor: (b: string, p: string) => Claim | undefined,
  year: number,
  now: Date,
  cardOpened: string | null = null,
  isSkipped: (benefitId: string, periodKey: string) => boolean = () => false,
): YearTotals {
  let available = 0
  let availableToDate = 0
  let used = 0
  let forfeited = 0

  for (const b of benefits) {
    if (!b.enabled) continue
    for (const period of periodsInYear(b.cadence, year)) {
      if (!periodWasAvailable(period, cardOpened)) continue
      if (isSkipped(b.id, period.key)) continue
      const amount = amountForPeriod(b, period)
      available += amount
      const started = period.start.getTime() <= now.getTime()
      const closed = period.end.getTime() < now.getTime()
      if (started) availableToDate += amount
      const claimed = Math.min(claimFor(b.id, period.key)?.used ?? 0, amount)
      used += claimed
      if (closed) forfeited += amount - claimed
    }
  }
  return { available, availableToDate, used, forfeited }
}
