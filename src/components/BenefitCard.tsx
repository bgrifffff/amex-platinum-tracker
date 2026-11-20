import { useState } from 'react'
import { Badge, Box, Button, Card, Flex, Separator, Text, TextField } from '@radix-ui/themes'
import { CADENCE_LABEL, fmtMoney, type PeriodRef } from '../periods'
import type { LiveBenefit } from '../store'

/** Days-remaining thresholds at which a period starts to look worrying. */
const URGENCY: Record<string, { urgent: number; critical: number }> = {
  monthly: { urgent: 8, critical: 3 },
  quarterly: { urgent: 21, critical: 7 },
  semiannual: { urgent: 45, critical: 14 },
  annual: { urgent: 60, critical: 21 },
}

export type Status = 'done' | 'partial' | 'critical' | 'urgent' | 'open'

export function statusOf(amount: number, used: number, daysLeft: number, cadence: string): Status {
  if (used >= amount) return 'done'
  const t = URGENCY[cadence] ?? URGENCY.annual
  if (daysLeft <= t.critical) return 'critical'
  if (daysLeft <= t.urgent) return 'urgent'
  if (used > 0) return 'partial'
  return 'open'
}

function daysPhrase(daysLeft: number): string {
  if (daysLeft === 0) return 'Ends today'
  if (daysLeft === 1) return '1 day left'
  return `${daysLeft} days left`
}

const EDGE: Record<Status, string> = {
  done: 'var(--green-9)',
  critical: 'var(--red-9)',
  urgent: 'var(--amber-9)',
  partial: 'var(--gray-a6)',
  open: 'var(--gray-a6)',
}

interface Props {
  benefit: LiveBenefit
  period: PeriodRef
  amount: number
  used: number
  daysLeft: number
  onSetUsed: (used: number) => void
  /** A posted statement credit confirmed this, rather than a manual tick. */
  auto?: boolean
  /** A qualifying purchase posted but Amex has not credited it back yet. */
  awaiting?: boolean
  /** No statement credit can ever confirm this benefit. */
  manualOnly?: string
}

export function BenefitCard({
  benefit, period, amount, used, daysLeft, onSetUsed, auto, awaiting, manualOnly,
}: Props) {
  const [showNote, setShowNote] = useState(false)
  const [partial, setPartial] = useState('')

  const status = statusOf(amount, used, daysLeft, benefit.cadence)
  const remaining = Math.max(0, amount - used)

  function applyPartial() {
    const n = Number(partial)
    if (!Number.isFinite(n) || n <= 0) return
    onSetUsed(Math.min(amount, used + n))
    setPartial('')
  }

  return (
    <Card size="2" style={{ borderLeft: `3px solid ${EDGE[status]}` }}>
      <Flex justify="between" gap="4" align="start" wrap="wrap">
        <Box style={{ flex: '1 1 260px' }}>
          <Text as="div" weight="medium" size="3">{benefit.name}</Text>
          <Flex gap="2" mt="2" wrap="wrap" align="center">
            <Badge color="gray" variant="soft">{CADENCE_LABEL[benefit.cadence]}</Badge>
            <Badge
              variant="soft"
              color={status === 'done' ? 'green' : status === 'critical' ? 'red' : status === 'urgent' ? 'amber' : 'gray'}
            >
              {status === 'done' ? 'Used' : daysPhrase(daysLeft)}
            </Badge>
            {auto && <Badge color="green" variant="surface">Credit posted</Badge>}
            {awaiting && !auto && <Badge color="amber" variant="surface">Spent, awaiting credit</Badge>}
            {benefit.enroll && <Badge color="indigo" variant="surface">Enrollment needed</Badge>}
            {benefit.confidence === 'check' && <Badge color="amber" variant="outline">Verify amount</Badge>}
          </Flex>
        </Box>

        <Box style={{ textAlign: 'right' }}>
          <Text as="div" size="5" weight="bold" color={used > 0 ? 'green' : undefined}>
            {used > 0 ? `${fmtMoney(used)} / ${fmtMoney(amount)}` : fmtMoney(amount)}
          </Text>
          <Text as="div" size="1" color="gray">{period.label}</Text>
        </Box>
      </Flex>

      <Flex gap="2" mt="3" align="center" wrap="wrap">
        {status === 'done' ? (
          <Button size="1" variant="soft" onClick={() => onSetUsed(0)}>Undo</Button>
        ) : (
          <>
            <Button size="1" onClick={() => onSetUsed(amount)}>
              Mark {fmtMoney(remaining)} used
            </Button>
            <TextField.Root
              size="1"
              type="number"
              min="0"
              step="0.01"
              placeholder="Partial"
              style={{ width: 92 }}
              value={partial}
              aria-label={`Partial amount used for ${benefit.name}`}
              onChange={(e) => setPartial(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyPartial() }}
            />
            {partial !== '' && <Button size="1" variant="soft" onClick={applyPartial}>Add</Button>}
            {used > 0 && <Button size="1" variant="ghost" color="gray" onClick={() => onSetUsed(0)}>Reset</Button>}
          </>
        )}
        <Box style={{ flex: 1 }} />
        <Button size="1" variant="ghost" color="gray" onClick={() => setShowNote((v) => !v)} aria-expanded={showNote}>
          {showNote ? 'Hide details' : 'Details'}
        </Button>
      </Flex>

      {showNote && (
        <>
          <Separator size="4" my="3" />
          <Text as="p" size="2" color="gray">{benefit.note}</Text>
          {manualOnly && (
            <Text as="p" size="2" color="amber" mt="2">{manualOnly}</Text>
          )}
        </>
      )}
    </Card>
  )
}
