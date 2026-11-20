import { useRef } from 'react'
import {
  Badge, Box, Button, Card, Flex, Heading, Select, Separator, Switch, Text, TextField,
} from '@radix-ui/themes'
import { CADENCE_LABEL, fmtMoney, type Cadence } from '../periods'
import { annualValue, type AppState, type LiveBenefit, type Override } from '../store'
import type { OneOffBenefit } from '../benefits'

const CADENCES: Cadence[] = ['monthly', 'quarterly', 'semiannual', 'annual']

interface Props {
  state: AppState
  benefits: LiveBenefit[]
  oneOffs: OneOffBenefit[]
  year: number
  setAnnualFee: (n: number) => void
  setOverride: (id: string, patch: Override) => void
  resetOverride: (id: string) => void
  setOneOffYear: (id: string, year: number | null) => void
  clearYear: (year: number) => void
  importState: (s: AppState) => void
}

export function Settings({
  state, benefits, oneOffs, year,
  setAnnualFee, setOverride, resetOverride, setOneOffYear, clearYear, importState,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `platinum-tracker-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJson(file: File) {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as AppState
        if (typeof parsed !== 'object' || parsed === null || !('claims' in parsed)) {
          throw new Error('not a tracker file')
        }
        importState({
          version: 1,
          annualFee: typeof parsed.annualFee === 'number' ? parsed.annualFee : state.annualFee,
          claims: parsed.claims ?? {},
          overrides: parsed.overrides ?? {},
          oneOffs: parsed.oneOffs ?? {},
        })
      } catch {
        alert('That file does not look like a tracker export.')
      }
    })
  }

  return (
    <Flex direction="column" gap="4">
      <Card size="3">
        <Heading size="3" mb="1">Annual fee</Heading>
        <Text as="p" size="2" color="gray" mb="3">
          The number the credits are measured against. Change it if your fee differs or Amex adjusts it.
        </Text>
        <TextField.Root
          type="number"
          min="0"
          step="1"
          style={{ maxWidth: 140 }}
          value={state.annualFee}
          aria-label="Annual fee in dollars"
          onChange={(e) => setAnnualFee(Math.max(0, Number(e.target.value) || 0))}
        />
      </Card>

      <Card size="3">
        <Heading size="3" mb="1">Benefits and amounts</Heading>
        <Text as="p" size="2" color="gray" mb="3">
          Amounts came from public 2026 write-ups, and a few of them disagreed with each other. Your
          statement is the authority: correct anything that is wrong here and the totals follow.
          Turning a benefit off hides it everywhere and drops it from the math.
        </Text>
        {benefits.map((b, i) => (
          <Box key={b.id}>
            {i > 0 && <Separator size="4" my="3" />}
            <Flex align="center" gap="3" wrap="wrap">
              <Switch
                checked={b.enabled}
                aria-label={`Track ${b.name}`}
                onCheckedChange={(checked) => setOverride(b.id, { enabled: checked })}
              />
              <Box style={{ flex: '1 1 220px' }}>
                <Text as="div" size="2" weight="medium">{b.name}</Text>
                <Flex gap="2" align="center" mt="1" wrap="wrap">
                  <Text size="1" color="gray">{fmtMoney(annualValue(b))} a year</Text>
                  {b.confidence === 'check' && <Badge size="1" color="amber" variant="outline">verify</Badge>}
                  {b.retired && <Badge size="1" color="gray" variant="outline">retired</Badge>}
                  {b.edited && <Badge size="1" color="indigo" variant="outline">edited</Badge>}
                </Flex>
              </Box>
              <TextField.Root
                type="number"
                min="0"
                step="0.01"
                size="2"
                style={{ width: 104 }}
                value={b.amount}
                aria-label={`Amount per period for ${b.name}`}
                onChange={(e) => setOverride(b.id, { amount: Math.max(0, Number(e.target.value) || 0) })}
              />
              <Select.Root
                value={b.cadence}
                onValueChange={(v) => setOverride(b.id, { cadence: v as Cadence })}
              >
                <Select.Trigger aria-label={`Cadence for ${b.name}`} />
                <Select.Content>
                  {CADENCES.map((c) => (
                    <Select.Item key={c} value={c}>{CADENCE_LABEL[c]}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              {(b.edited || state.overrides[b.id]) && (
                <Button size="1" variant="ghost" color="gray" onClick={() => resetOverride(b.id)}>
                  Default
                </Button>
              )}
            </Flex>
          </Box>
        ))}
      </Card>

      <Card size="3">
        <Heading size="3" mb="1">Multi-year credits</Heading>
        <Text as="p" size="2" color="gray" mb="3">
          These do not reset every year, so they sit outside the totals above. Record the year you
          last claimed one.
        </Text>
        {oneOffs.map((o) => {
          const usedYear = state.oneOffs[o.id]?.usedYear ?? null
          const nextYear = usedYear === null ? null : usedYear + o.everyYears
          const eligible = nextYear === null || nextYear <= year
          return (
            <Flex key={o.id} align="center" gap="3" wrap="wrap">
              <Box style={{ flex: '1 1 220px' }}>
                <Text as="div" size="2" weight="medium">{o.name}</Text>
                <Text as="div" size="1" color="gray" mt="1">
                  {fmtMoney(o.amount)} every {o.everyYears} years
                  {usedYear === null
                    ? ' · never claimed'
                    : ` · claimed ${usedYear}, next eligible ${nextYear}`}
                  {eligible && usedYear !== null && ' · eligible now'}
                </Text>
              </Box>
              <TextField.Root
                type="number"
                min="2000"
                max={year + 1}
                step="1"
                style={{ width: 120 }}
                placeholder="Year used"
                value={usedYear ?? ''}
                aria-label={`Year last claimed for ${o.name}`}
                onChange={(e) => setOneOffYear(o.id, e.target.value === '' ? null : Number(e.target.value))}
              />
              {usedYear !== null && (
                <Button size="1" variant="ghost" color="gray" onClick={() => setOneOffYear(o.id, null)}>
                  Clear
                </Button>
              )}
            </Flex>
          )
        })}
      </Card>

      <Card size="3">
        <Heading size="3" mb="1">Your data</Heading>
        <Text as="p" size="2" color="gray" mb="3">
          Everything lives in this browser&rsquo;s local storage and never leaves your machine. Clearing
          site data wipes it, so export a copy if you care about the history.
        </Text>
        <Flex gap="2" wrap="wrap">
          <Button variant="soft" onClick={exportJson}>Export JSON</Button>
          <Button variant="soft" onClick={() => fileRef.current?.click()}>Import JSON</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importJson(f)
              e.target.value = ''
            }}
          />
          <Button
            variant="soft"
            color="red"
            onClick={() => {
              if (confirm(`Clear every logged credit for ${year}? Amounts and settings stay. This cannot be undone.`)) {
                clearYear(year)
              }
            }}
          >
            Clear {year} history
          </Button>
        </Flex>
      </Card>
    </Flex>
  )
}
