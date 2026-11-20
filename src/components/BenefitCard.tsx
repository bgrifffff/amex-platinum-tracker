import { useState } from 'react'
import { Badge, Box, Button, Card, Flex, Separator, Text, TextField } from '@radix-ui/themes'
import { CADENCE_LABEL, fmtMoney, type PeriodRef } from '../periods'
import type { LiveBenefit } from '../store'

/**
 * Urgency is absolute calendar distance, not a fraction of the period.
 * Money that disappears in a week is equally urgent whether its credit was
 * monthly or annual, and grading per cadence made a $25 credit with 10 days
 * left look calmer than a $300 one with 41.
 */
export const CRITICAL_DAYS = 7
export const URGENT_DAYS = 30
/** The window "Closing soon" sums over. */
export const AT_RISK_DAYS = 45

export type Status = 'done' | 'partial' | 'critical' | 'urgent' | 'open'

export function statusOf(amount: number, used: number, daysLeft: number): Status {
  if (used >= amount) return 'done'
  if (daysLeft <= CRITICAL_DAYS) return 'critical'
  if (daysLeft <= URGENT_DAYS) return 'urgent'
  if (used > 0) return 'partial'
  return 'open'
}

function daysPhrase(daysLeft: number): string {
  if (daysLeft === 0) return 'Ends today'
  if (daysLeft === 1) return '1 day left'
  return `${daysLeft} days left`
}

export const CADENCE_NOUN: Record<string, string> = {
  monthly: 'month',
  quarterly: 'quarter',
  semiannual: 'half',
  annual: 'year',
}

const EDGE: Record<Status, string> = {
  done: 'var(--green-9)',
  critical: 'var(--red-9)',
  urgent: 'var(--amber-9)',
  partial: 'var(--green-a7)',
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
  onSetEnrolled: (enrolled: boolean) => void
  /** True when this period cannot be used at all, e.g. already billed elsewhere. */
  skipped?: boolean
  onSetSkipped: (skipped: boolean) => void
}

export function BenefitCard({
  benefit, period, amount, used, daysLeft, onSetUsed, onSetEnrolled, skipped, onSetSkipped,
  auto, awaiting, manualOnly,
}: Props) {
  const [showNote, setShowNote] = useState(false)
  const [partial, setPartial] = useState('')

  const status = statusOf(amount, used, daysLeft)
  const remaining = Math.max(0, amount - used)
  // A posted credit is proof. A tick of my own only records that I spent the money.
  const confirmed = Boolean(auto)
  const tickedOnly = status === 'done' && !confirmed

  const partialIsValid = partial !== '' && Number.isFinite(Number(partial)) && Number(partial) > 0

  function applyPartial() {
    if (!partialIsValid) return
    onSetUsed(Math.min(amount, used + Number(partial)))
    setPartial('')
  }

  return (
    // Inset shadow rather than a border, so the rail follows the card's radius.
    <Card size="2" style={{
      boxShadow: `inset 4px 0 0 ${skipped ? 'var(--gray-a6)' : EDGE[status]}`,
      opacity: skipped ? .72 : 1,
    }}>
      <Flex justify="between" gap="4" align="start" wrap="wrap">
        <Box style={{ flex: '1 1 260px' }}>
          <Text as="div" weight="medium" size="3">{benefit.name}</Text>
          <Flex gap="2" mt="2" wrap="wrap" align="center">
            {/* One badge for state, so "Used" and "awaiting" can never contradict each other. */}
            {skipped ? (
              <Badge color="gray" variant="soft">Not using this {CADENCE_NOUN[benefit.cadence]}</Badge>
            ) : confirmed ? (
              <Badge color="green" variant="solid">Credit posted &#10003;</Badge>
            ) : awaiting ? (
              <Badge color="blue" variant="surface">Spent, awaiting credit</Badge>
            ) : tickedOnly ? (
              <Badge color="green" variant="surface">Logged by hand</Badge>
            ) : (
              <Badge
                variant="soft"
                color={status === 'critical' ? 'red' : status === 'urgent' ? 'amber' : 'gray'}
              >
                {daysPhrase(daysLeft)}{status === 'critical' || status === 'urgent' ? '!' : ''}
              </Badge>
            )}

            {/* An unenrolled credit pays nothing, so this is the only badge that
                outranks the deadline. Everything else is a footnote and lives in Details. */}
            {!benefit.enrolled && !skipped && <Badge color="red" variant="soft">Not enrolled</Badge>}
          </Flex>
        </Box>

        <Box style={{ textAlign: 'right' }}>
          {/* Green only once the whole credit is accounted for; a partial is not a win. */}
          <Text as="div" size="5" weight="bold" className="num"
            color={used >= amount ? 'green' : undefined}>
            {used > 0 ? (
              <>
                <Text color={used >= amount ? 'green' : 'gray'}>{fmtMoney(used)}</Text>
                {' / '}{fmtMoney(amount)}
              </>
            ) : fmtMoney(amount)}
          </Text>
          <Text as="div" size="1" color="gray">
            {CADENCE_LABEL[benefit.cadence]} &middot; {period.label}
          </Text>
        </Box>
      </Flex>

      <Flex gap="2" mt="3" align="center" wrap="wrap">
        {skipped ? (
          <Button size="2" variant="soft" onClick={() => onSetSkipped(false)}>
            I can use this after all
          </Button>
        ) : confirmed ? (
          // Clearing a manual claim cannot remove a credit Amex actually posted,
          // so offering the button would be offering an action that does nothing.
          <Text size="1" color="gray">Amex posted this credit, so it can&rsquo;t be cleared by hand.</Text>
        ) : status === 'done' ? (
          <Button size="2" variant="soft" onClick={() => onSetUsed(0)}>Clear</Button>
        ) : (
          <>
            <Button size="2" variant="soft" onClick={() => onSetUsed(amount)}>
              Log {fmtMoney(remaining)} spent
            </Button>
            <TextField.Root
              size="2"
              type="number"
              min="0"
              step="0.01"
              placeholder="Add $"
              style={{ width: 104 }}
              value={partial}
              aria-label={`Amount to add to ${benefit.name}, on top of the ${fmtMoney(used)} already logged`}
              onChange={(e) => setPartial(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyPartial() }}
            >
              <TextField.Slot>$</TextField.Slot>
            </TextField.Root>
            {/* Always mounted, so the commit control never appears out of nowhere. */}
            <Button size="2" variant="soft" disabled={!partialIsValid} onClick={applyPartial}>Add</Button>
            {used > 0 && (
              <>
                <Text size="1" color="gray" className="num">
                  {partialIsValid
                    ? `${fmtMoney(used)} + ${fmtMoney(Number(partial))} = ${fmtMoney(Math.min(amount, used + Number(partial)))}`
                    : `${fmtMoney(used)} logged so far`}
                </Text>
                <Button size="2" variant="ghost" color="gray" onClick={() => onSetUsed(0)}>Clear</Button>
              </>
            )}
          </>
        )}
        <Box style={{ flex: 1 }} />
        {!skipped && used < amount && (
          <Button size="2" variant="ghost" color="gray" onClick={() => onSetSkipped(true)}>
            Can&rsquo;t use this {CADENCE_NOUN[benefit.cadence]}
          </Button>
        )}
        {benefit.enroll && !skipped && (
          <Button size="2" variant="ghost" color="gray"
            onClick={() => onSetEnrolled(!benefit.enrolled)}>
            {benefit.enrolled ? 'Mark not enrolled' : 'I\u2019ve enrolled'}
          </Button>
        )}
        <Button size="2" variant="ghost" color="gray" onClick={() => setShowNote((v) => !v)} aria-expanded={showNote}>
          {showNote ? 'Hide details' : 'Details'}
        </Button>
      </Flex>

      {showNote && (
        <>
          <Separator size="4" my="3" />
          <Text as="p" size="2" color="gray">{benefit.note}</Text>
          {benefit.confidence === 'check' && (
            <Text as="p" size="2" color="gray" mt="2">
              Sources disagreed on this amount, so check it against your statement and correct it
              in Settings if it is wrong.
            </Text>
          )}
          {manualOnly && <Text as="p" size="2" color="gray" mt="2">{manualOnly}</Text>}
          {!benefit.enrolled && (
            <Text as="p" size="2" color="gray" mt="2">
              Amex pays this credit only after you enroll in the Amex app. Spend against it before
              then and you get nothing back.
            </Text>
          )}
        </>
      )}
    </Card>
  )
}
