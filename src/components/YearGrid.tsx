import { Box, Card, Flex, Text } from '@radix-ui/themes'
import { fmtMoney, monthsIn, periodsInYear } from '../periods'
import { amountForPeriod, annualValue, type Claim, type LiveBenefit } from '../store'

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

interface Props {
  benefits: LiveBenefit[]
  year: number
  now: Date
  claimFor: (benefitId: string, periodKey: string) => Claim | undefined
  setUsed: (benefitId: string, periodKey: string, used: number) => void
}

function Swatch({ background, borderColor, opacity }: {
  background: string
  borderColor?: string
  opacity?: number
}) {
  return <span className="legend-swatch" style={{ background, borderColor, opacity }} />
}

export function YearGrid({ benefits, year, now, claimFor, setUsed }: Props) {
  const active = benefits.filter((b) => b.enabled)

  return (
    <>
      <Card size="1">
        <Box style={{ overflowX: 'auto' }}>
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Benefit</th>
                {MONTH_INITIALS.map((m, i) => <th key={i} scope="col">{m}</th>)}
                <th scope="col">Used</th>
              </tr>
            </thead>
            <tbody>
              {active.map((b) => {
                const periods = periodsInYear(b.cadence, year)
                const span = monthsIn(b.cadence)
                let usedTotal = 0

                const cells = periods.map((period) => {
                  const amount = amountForPeriod(b, period)
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

                  const title = `${b.name} — ${period.label}: ${fmtMoney(used)} of ${fmtMoney(amount)} used`
                    + (future ? ' (not open yet)' : closed && used < amount ? ' (period closed)' : '')

                  return (
                    <td key={period.key} colSpan={span}>
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
                        {fmtMoney(b.amount)} &middot; {b.cadence}
                      </Text>
                    </th>
                    {cells}
                    <td>
                      <Text size="2">{fmtMoney(usedTotal)}</Text>
                      <Text size="2" color="gray"> / {fmtMoney(annualValue(b))}</Text>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Box>
      </Card>

      <Flex gap="4" mt="3" wrap="wrap">
        {[
          { label: 'Used in full', background: 'var(--green-9)', borderColor: 'var(--green-9)' },
          { label: 'Partly used', background: 'var(--green-a5)', borderColor: 'var(--green-8)' },
          { label: 'Period closed unused', background: 'var(--red-a3)', borderColor: 'var(--red-a6)' },
          { label: 'Open now', background: 'var(--gray-a2)' },
          { label: 'Not open yet', background: 'var(--gray-a2)', opacity: .35 },
        ].map((l) => (
          <Flex key={l.label} align="center" gap="2">
            <Swatch background={l.background} borderColor={l.borderColor} opacity={l.opacity} />
            <Text size="1" color="gray">{l.label}</Text>
          </Flex>
        ))}
      </Flex>

      <Text as="p" size="2" color="gray" mt="3">
        Click any open square to toggle that period between used and unused. Use the Now tab to log
        partial amounts.
      </Text>
    </>
  )
}
