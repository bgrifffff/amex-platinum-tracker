import { Badge, Box, Card, Flex, Heading, Text } from '@radix-ui/themes'
import {
  CADENCE_LABEL, fmtMoney, periodsInYear, type Cadence, type PeriodRef,
} from '../periods'
import { amountForPeriod, periodWasAvailable, type Claim, type LiveBenefit } from '../store'

const CADENCE_ORDER: Cadence[] = ['monthly', 'quarterly', 'semiannual', 'annual']

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Column heading for one period: short enough to fit, specific enough to be unambiguous. */
function columnLabel(cadence: Cadence, index: number): string {
  switch (cadence) {
    case 'monthly': return MONTH_SHORT[index]
    case 'quarterly': return `Q${index + 1}`
    case 'semiannual': return index === 0 ? 'Jan–Jun' : 'Jul–Dec'
    case 'annual': return 'Full year'
  }
}

/** The date by which the credit has to be used. */
function deadline(period: PeriodRef): string {
  return period.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface Props {
  benefits: LiveBenefit[]
  year: number
  now: Date
  claimFor: (benefitId: string, periodKey: string) => Claim | undefined
  setUsed: (benefitId: string, periodKey: string, used: number) => void
  cardOpened: string | null
}

export function YearGrid({ benefits, year, now, claimFor, setUsed, cardOpened }: Props) {
  const active = benefits.filter((b) => b.enabled)

  return (
    <Flex direction="column" gap="4">
      {CADENCE_ORDER.map((cadence) => {
        const rows = active.filter((b) => b.cadence === cadence)
        if (rows.length === 0) return null

        const periods = periodsInYear(cadence, year)
        const currentIndex = periods.findIndex(
          (p) => p.start.getTime() <= now.getTime() && p.end.getTime() >= now.getTime(),
        )

        return (
          <Card size="2" key={cadence}>
            <Flex justify="between" align="baseline" mb="3" wrap="wrap" gap="2">
              <Heading size="3">{CADENCE_LABEL[cadence]}</Heading>
              {currentIndex >= 0 && (
                <Text size="1" color="gray">
                  Now in {columnLabel(cadence, currentIndex)}, closes {deadline(periods[currentIndex])}
                </Text>
              )}
            </Flex>

            <Box style={{ overflowX: 'auto' }}>
              <table className="grid">
                <thead>
                  <tr>
                    <th scope="col">Benefit</th>
                    {periods.map((p, i) => (
                      <th key={p.key} scope="col" className={i === currentIndex ? 'current' : undefined}>
                        {columnLabel(cadence, i)}
                        {i === currentIndex && <span className="now-dot" aria-label="current period" />}
                      </th>
                    ))}
                    <th scope="col">Used</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => {
                    let usedTotal = 0
                    let reachable = 0

                    const cells = periods.map((period, i) => {
                      const amount = amountForPeriod(b, period)
                      const isCurrent = i === currentIndex

                      if (!periodWasAvailable(period, cardOpened)) {
                        const label = `${b.name}, ${period.label}: before you opened the card`
                        return (
                          <td key={period.key}>
                            <Text size="2" color="gray" title={label} aria-label={label}
                              style={{ opacity: .4 }}>&ndash;</Text>
                          </td>
                        )
                      }

                      reachable += amount
                      const used = Math.min(claimFor(b.id, period.key)?.used ?? 0, amount)
                      usedTotal += used
                      const future = period.start.getTime() > now.getTime()
                      const closed = period.end.getTime() < now.getTime()

                      const cls = used >= amount ? 'used'
                        : used > 0 ? 'partial'
                        : closed ? 'missed'
                        : ''

                      const glyph = used >= amount ? '✓'
                        : used > 0 ? '½'
                        : closed ? '✕'
                        : ''

                      const title = `${b.name}, ${period.label}: ${fmtMoney(used)} of ${fmtMoney(amount)} used`
                        + (future ? ` (opens ${period.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
                          : closed && used < amount ? ' (closed unused)'
                          : ` (use by ${deadline(period)})`)

                      return (
                        <td key={period.key} className={isCurrent ? 'current' : undefined}>
                          <button
                            className={`pip ${cls}`}
                            title={title}
                            aria-label={title}
                            disabled={future}
                            onClick={() => setUsed(b.id, period.key, used >= amount ? 0 : amount)}
                          >
                            {glyph}
                          </button>
                        </td>
                      )
                    })

                    return (
                      <tr key={b.id}>
                        <th scope="row">
                          <Text as="div" size="2">{b.name}</Text>
                          <Text as="div" size="1" color="gray">
                            {fmtMoney(b.amount)} each {cadence === 'annual' ? 'year' : 'period'}
                          </Text>
                        </th>
                        {cells}
                        <td>
                          <Text size="2">{fmtMoney(usedTotal)}</Text>
                          <Text size="2" color="gray"> / {fmtMoney(reachable)}</Text>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Box>
          </Card>
        )
      })}

      <Card size="2">
        <Flex gap="4" wrap="wrap" mb="2">
          {[
            { label: 'Used in full', background: 'var(--green-9)', borderColor: 'var(--green-9)' },
            { label: 'Partly used', background: 'var(--green-a5)', borderColor: 'var(--green-8)' },
            { label: 'Closed unused', background: 'var(--red-a3)', borderColor: 'var(--red-a6)' },
            { label: 'Open now', background: 'var(--gray-a2)' },
            { label: 'Not open yet', background: 'var(--gray-a2)', opacity: .35 },
          ].map((l) => (
            <Flex key={l.label} align="center" gap="2">
              <span className="legend-swatch"
                style={{ background: l.background, borderColor: l.borderColor, opacity: l.opacity }} />
              <Text size="1" color="gray">{l.label}</Text>
            </Flex>
          ))}
          <Flex align="center" gap="2">
            <Text size="1" color="gray" style={{ opacity: .4 }}>&ndash;</Text>
            <Text size="1" color="gray">Before your card</Text>
          </Flex>
        </Flex>
        <Text as="p" size="1" color="gray">
          The highlighted column is the period you are in now. Click any open square to toggle it;
          hover for the exact deadline. Partial amounts go in on the Now tab.
        </Text>
      </Card>

      <Flex align="center" gap="2">
        <Badge color="amber" variant="soft">Tip</Badge>
        <Text size="2" color="gray">
          Quarterly credits do not roll over. Each unused square is money gone on the last day of
          that quarter.
        </Text>
      </Flex>
    </Flex>
  )
}
