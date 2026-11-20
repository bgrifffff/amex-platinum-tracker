export type Cadence = 'monthly' | 'quarterly' | 'semiannual' | 'annual'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function periodCount(cadence: Cadence): number {
  switch (cadence) {
    case 'monthly': return 12
    case 'quarterly': return 4
    case 'semiannual': return 2
    case 'annual': return 1
  }
}

export function monthsIn(cadence: Cadence): number {
  return 12 / periodCount(cadence)
}

/** Index of the period a date falls in, within its calendar year (0-based). */
export function periodIndex(cadence: Cadence, d: Date): number {
  return Math.floor(d.getMonth() / monthsIn(cadence))
}

/** First month of a period, 0-based. */
function firstMonth(cadence: Cadence, index: number): number {
  return index * monthsIn(cadence)
}

export function periodStart(cadence: Cadence, year: number, index: number): Date {
  return new Date(year, firstMonth(cadence, index), 1, 0, 0, 0, 0)
}

/** Last millisecond of the period. */
export function periodEnd(cadence: Cadence, year: number, index: number): Date {
  const nextStart = new Date(year, firstMonth(cadence, index) + monthsIn(cadence), 1, 0, 0, 0, 0)
  return new Date(nextStart.getTime() - 1)
}

export function periodKey(cadence: Cadence, year: number, index: number): string {
  switch (cadence) {
    case 'monthly': return year + '-' + String(index + 1).padStart(2, '0')
    case 'quarterly': return year + '-Q' + (index + 1)
    case 'semiannual': return year + '-H' + (index + 1)
    case 'annual': return String(year)
  }
}

export function periodLabel(cadence: Cadence, year: number, index: number): string {
  const start = firstMonth(cadence, index)
  switch (cadence) {
    case 'monthly': return MONTH_NAMES[start] + ' ' + year
    case 'quarterly': return 'Q' + (index + 1) + ' ' + year
    case 'semiannual': return MONTH_SHORT[start] + '–' + MONTH_SHORT[start + 5] + ' ' + year
    case 'annual': return String(year)
  }
}

export const CADENCE_LABEL: Record<Cadence, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Semi-annual',
  annual: 'Annual',
}

export interface PeriodRef {
  cadence: Cadence
  year: number
  index: number
  key: string
  label: string
  start: Date
  end: Date
}

function makeRef(cadence: Cadence, year: number, index: number): PeriodRef {
  return {
    cadence, year, index,
    key: periodKey(cadence, year, index),
    label: periodLabel(cadence, year, index),
    start: periodStart(cadence, year, index),
    end: periodEnd(cadence, year, index),
  }
}

export function periodFor(cadence: Cadence, d: Date): PeriodRef {
  return makeRef(cadence, d.getFullYear(), periodIndex(cadence, d))
}

export function periodsInYear(cadence: Cadence, year: number): PeriodRef[] {
  return Array.from({ length: periodCount(cadence) }, (_, i) => makeRef(cadence, year, i))
}

/** Whole days from `now` until the period closes. 0 means it closes today. */
export function daysLeft(period: PeriodRef, now: Date): number {
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const ms = period.end.getTime() - endOfToday.getTime()
  return Math.max(0, Math.round(ms / 86400000))
}

export function fmtMoney(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return rounded % 1 === 0
    ? '$' + rounded.toLocaleString('en-US')
    : '$' + rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
