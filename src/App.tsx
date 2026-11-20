import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge, Box, Button, Card, Container, Flex, Heading, Progress, Select, Separator, Tabs, Text, Theme,
} from '@radix-ui/themes'
import { BenefitCard, statusOf } from './components/BenefitCard'
import { YearGrid } from './components/YearGrid'
import { Settings } from './components/Settings'
import { Connection } from './components/Connection'
import { CATEGORY_ORDER, type Category } from './benefits'
import { daysLeft, fmtMoney, periodFor } from './periods'
import { amountForPeriod, annualValue, useTracker, yearTotals, type Claim, type LiveBenefit } from './store'
import { useBridge } from './plaid'
import { UNDETECTABLE, awaitingCredit, creditTotals, matchTransactions } from './matching'

type Tab = 'now' | 'all' | 'year' | 'sync' | 'settings'

interface Row {
  benefit: LiveBenefit
  period: ReturnType<typeof periodFor>
  amount: number
  used: number
  left: number
}

function useAppearance() {
  const [appearance, setAppearance] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('amex-platinum-tracker.theme')
      if (saved === 'light' || saved === 'dark') return saved
    } catch { /* storage blocked */ }
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    try {
      localStorage.setItem('amex-platinum-tracker.theme', appearance)
    } catch { /* storage blocked */ }
  }, [appearance])

  return { appearance, toggle: () => setAppearance((a) => (a === 'dark' ? 'light' : 'dark')) }
}

function Stat({ label, value, color }: { label: string; value: string; color?: 'amber' | 'red' }) {
  return (
    <Box>
      <Text as="div" size="1" color="gray">{label}</Text>
      <Text as="div" size="4" weight="bold" color={color} mt="1">{value}</Text>
    </Box>
  )
}

export default function App() {
  const t = useTracker()
  const { appearance, toggle } = useAppearance()
  const [tab, setTab] = useState<Tab>('now')
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())

  const bridge = useBridge()

  const match = useMemo(
    () => matchTransactions(bridge.txns, t.benefits, bridge.learned),
    [bridge.txns, t.benefits, bridge.learned],
  )
  const autoTotals = useMemo(() => creditTotals(match.credits), [match.credits])
  const awaiting = useMemo(() => awaitingCredit(match), [match])

  /**
   * A posted statement credit is stronger evidence than a manual tick, so the two are
   * merged by taking whichever is larger rather than summing them.
   */
  const claimFor = useCallback((benefitId: string, periodKey: string): Claim | undefined => {
    const manual = t.claimFor(benefitId, periodKey)
    const auto = autoTotals.get(benefitId + '|' + periodKey) ?? 0
    const used = Math.max(manual?.used ?? 0, auto)
    if (used <= 0) return undefined
    return { used, at: manual?.at ?? '' }
  }, [t.claimFor, autoTotals])

  const rows = useMemo<Row[]>(() => t.benefits
    .filter((b) => b.enabled)
    .map((benefit) => {
      const period = periodFor(benefit.cadence, now)
      const amount = amountForPeriod(benefit, period)
      return {
        benefit,
        period,
        amount,
        used: Math.min(claimFor(benefit.id, period.key)?.used ?? 0, amount),
        left: daysLeft(period, now),
      }
    }), [t.benefits, claimFor, now])

  const totals = useMemo(
    () => yearTotals(t.benefits, claimFor, year, now),
    [t.benefits, claimFor, year, now],
  )

  const openRows = rows.filter((r) => r.used < r.amount)
  const doneRows = rows.filter((r) => r.used >= r.amount)
  const openNow = openRows.reduce((sum, r) => sum + (r.amount - r.used), 0)
  const atRisk = openRows
    .filter((r) => ['urgent', 'critical'].includes(statusOf(r.amount, r.used, r.left, r.benefit.cadence)))
    .reduce((sum, r) => sum + (r.amount - r.used), 0)

  const feePct = Math.min(100, (totals.used / Math.max(1, t.state.annualFee)) * 100)
  const covered = totals.used >= t.state.annualFee

  const byCategory = useMemo(() => {
    const map = new Map<Category, Row[]>()
    for (const r of rows) {
      const list = map.get(r.benefit.category) ?? []
      list.push(r)
      map.set(r.benefit.category, list)
    }
    return map
  }, [rows])

  const sortedOpen = [...openRows].sort((a, b) => a.left - b.left || b.amount - a.amount)

  const card = (r: Row) => {
    const key = r.benefit.id + '|' + r.period.key
    return (
      <BenefitCard
        key={r.benefit.id}
        benefit={r.benefit}
        period={r.period}
        amount={r.amount}
        used={r.used}
        daysLeft={r.left}
        auto={(autoTotals.get(key) ?? 0) > 0}
        awaiting={awaiting.has(key)}
        manualOnly={UNDETECTABLE[r.benefit.id]}
        onSetUsed={(used) => t.setUsed(r.benefit.id, r.period.key, used)}
      />
    )
  }

  return (
    <Theme appearance={appearance} accentColor="indigo" grayColor="slate" radius="medium">
      <Container size="3" px="4" py="5" pb="9">
        <Flex justify="between" align="start" gap="4" wrap="wrap" mb="4">
          <Box>
            <Heading size="6">Platinum Benefits Tracker</Heading>
            <Text as="div" size="2" color="gray" mt="1">
              US Consumer Platinum &middot;{' '}
              {now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </Box>
          <Flex gap="2" align="center">
            <Select.Root value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <Select.Trigger aria-label="Year" />
              <Select.Content>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                  <Select.Item key={y} value={String(y)}>{y}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <Button variant="soft" color="gray" onClick={toggle}>
              {appearance === 'dark' ? 'Light' : 'Dark'}
            </Button>
          </Flex>
        </Flex>

        <Card size="3">
          <Flex justify="between" align="baseline" gap="4" wrap="wrap">
            <Box>
              <Text as="div" size="2" color="gray">Credits logged in {year}</Text>
              <Flex align="baseline" gap="2" mt="1">
                <Text size="8" weight="bold">{fmtMoney(totals.used)}</Text>
                <Text size="3" color="gray">of {fmtMoney(t.state.annualFee)} fee</Text>
              </Flex>
            </Box>
            <Badge size="2" color={covered ? 'green' : 'amber'} variant="soft">
              {covered
                ? `Fee covered, ${fmtMoney(totals.used - t.state.annualFee)} past it`
                : `${fmtMoney(t.state.annualFee - totals.used)} to break even`}
            </Badge>
          </Flex>

          <Progress
            value={feePct}
            size="2"
            mt="3"
            color={covered ? 'indigo' : 'green'}
            aria-label={`${Math.round(feePct)} percent of the annual fee recovered`}
          />

          <Separator size="4" my="4" />

          <Flex gap="6" wrap="wrap">
            <Stat label="Open right now" value={fmtMoney(openNow)} />
            <Stat label="Closing soon" value={fmtMoney(atRisk)} color={atRisk > 0 ? 'amber' : undefined} />
            <Stat label={`Missed in ${year}`} value={fmtMoney(totals.forfeited)} color={totals.forfeited > 0 ? 'red' : undefined} />
            <Stat label="Full-year value" value={fmtMoney(totals.available)} />
          </Flex>
        </Card>

        <Tabs.Root value={tab} onValueChange={(v) => setTab(v as Tab)} mt="5">
          <Tabs.List>
            <Tabs.Trigger value="now">
              Now
              {openRows.length > 0 && (
                <Badge ml="2" size="1" variant="soft" color="gray">{openRows.length}</Badge>
              )}
            </Tabs.Trigger>
            <Tabs.Trigger value="all">All benefits</Tabs.Trigger>
            <Tabs.Trigger value="year">{year} grid</Tabs.Trigger>
            <Tabs.Trigger value="sync">
              Sync
              {match.unclaimed.length > 0 && (
                <Badge ml="2" size="1" variant="soft" color="amber">{match.unclaimed.length}</Badge>
              )}
            </Tabs.Trigger>
            <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
          </Tabs.List>

          <Box pt="4">
            <Tabs.Content value="now">
              {sortedOpen.length === 0 ? (
                <Card size="3">
                  <Flex direction="column" align="center" gap="2" py="6">
                    <Text size="4" weight="medium">Every open credit is logged.</Text>
                    <Text size="2" color="gray">
                      Nothing is sitting unused in the current period. Check back when the next one opens.
                    </Text>
                  </Flex>
                </Card>
              ) : (
                <Flex direction="column" gap="4">
                  <Box>
                    <Text as="div" size="1" color="gray" mb="2" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      Unused, soonest deadline first
                    </Text>
                    <Flex direction="column" gap="2">{sortedOpen.map(card)}</Flex>
                  </Box>
                  {doneRows.length > 0 && (
                    <Box>
                      <Text as="div" size="1" color="gray" mb="2" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        Already used this period
                      </Text>
                      <Flex direction="column" gap="2">{doneRows.map(card)}</Flex>
                    </Box>
                  )}
                </Flex>
              )}
            </Tabs.Content>

            <Tabs.Content value="all">
              <Flex direction="column" gap="4">
                {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => (
                  <Box key={category}>
                    <Flex justify="between" align="baseline" mb="2">
                      <Text size="1" color="gray" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        {category}
                      </Text>
                      <Text size="1" color="gray">
                        {fmtMoney((byCategory.get(category) ?? []).reduce((s, r) => s + annualValue(r.benefit), 0))}/yr
                      </Text>
                    </Flex>
                    <Flex direction="column" gap="2">
                      {(byCategory.get(category) ?? []).map(card)}
                    </Flex>
                  </Box>
                ))}
              </Flex>
            </Tabs.Content>

            <Tabs.Content value="year">
              <YearGrid
                benefits={t.benefits}
                year={year}
                now={now}
                claimFor={claimFor}
                setUsed={t.setUsed}
              />
            </Tabs.Content>

            <Tabs.Content value="sync">
              <Connection
                status={bridge.status}
                online={bridge.online}
                error={bridge.error}
                busy={bridge.busy}
                txns={bridge.txns}
                match={match}
                benefits={t.benefits}
                learned={bridge.learned}
                onRefresh={bridge.refresh}
                onSync={bridge.sync}
                onUnlink={bridge.unlink}
                onError={bridge.setError}
                teach={bridge.teach}
                forget={bridge.forget}
              />
            </Tabs.Content>

            <Tabs.Content value="settings">
              <Settings
                state={t.state}
                benefits={t.benefits}
                oneOffs={t.oneOffs}
                year={year}
                setAnnualFee={t.setAnnualFee}
                setOverride={t.setOverride}
                resetOverride={t.resetOverride}
                setOneOffYear={t.setOneOffYear}
                clearYear={t.clearYear}
                importState={t.importState}
              />
            </Tabs.Content>
          </Box>
        </Tabs.Root>

        <Separator size="4" my="6" />
        <Text as="p" size="1" color="gray">
          Benefit amounts are seeded from public 2026 write-ups and are not from American Express.
          Several sources disagreed with each other, so anything marked &ldquo;Verify amount&rdquo; is a
          best guess until you check it against your own statement or the Amex app. Credits also depend
          on enrollment and on your renewal date, neither of which this app can see. Nothing here is
          logged automatically: you are recording what you spent, not what Amex has actually reimbursed.
        </Text>
      </Container>
    </Theme>
  )
}
