import { useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import {
  Badge, Box, Button, Callout, Card, Code, Flex, Heading, Select, Separator, Text,
} from '@radix-ui/themes'
import { createLinkToken, exchangePublicToken, type BridgeStatus } from '../plaid'
import { UNDETECTABLE, type LearnedRule, type MatchResult, type Txn } from '../matching'
import { fmtMoney } from '../periods'
import type { LiveBenefit } from '../store'

function LinkButton({ onLinked, onError, label }: {
  onLinked: () => void
  onError: (m: string) => void
  label: string
}) {
  const [token, setToken] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const { open, ready } = usePlaidLink({
    token,
    onSuccess: async (publicToken, metadata) => {
      if (!publicToken) {
        onError('Plaid returned no public token, so nothing was linked.')
        return
      }
      try {
        await exchangePublicToken(publicToken, metadata.institution?.name ?? undefined)
        setToken(null)
        onLinked()
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e))
      }
    },
    onExit: (err) => {
      setToken(null)
      setStarting(false)
      if (err) onError(err.display_message || err.error_message || 'Link cancelled')
    },
  })

  useEffect(() => {
    if (token && ready) {
      open()
      setStarting(false)
    }
  }, [token, ready, open])

  async function begin() {
    setStarting(true)
    try {
      setToken(await createLinkToken())
    } catch (e) {
      setStarting(false)
      onError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Button onClick={begin} disabled={starting}>
      {starting ? 'Opening…' : label}
    </Button>
  )
}

interface Props {
  status: BridgeStatus | null
  online: boolean | null
  error: string | null
  busy: boolean
  txns: Txn[]
  match: MatchResult
  benefits: LiveBenefit[]
  learned: LearnedRule[]
  onRefresh: () => void
  onSync: () => void
  onUnlink: () => void
  onError: (m: string) => void
  teach: (pattern: string, benefitId: string) => void
  forget: (pattern: string) => void
}

export function Connection({
  status, online, error, busy, txns, match, benefits, learned,
  onRefresh, onSync, onUnlink, onError, teach, forget,
}: Props) {
  const enabled = benefits.filter((b) => b.enabled)

  return (
    <Flex direction="column" gap="4">
      {error && online !== false && (
        <Callout.Root color="red">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      <Card size="3">
        <Heading size="3" mb="1">Amex connection</Heading>
        {online === false ? (
          <>
            <Text as="p" size="2" color="gray" mb="3">
              The Plaid bridge is not running. Start it with <Code>npm run server</Code>, or run both
              halves at once with <Code>npm run dev:all</Code>. It needs your Plaid keys in a{' '}
              <Code>.env</Code> file first, which <Code>SETUP.md</Code> walks through.
            </Text>
            <Button variant="soft" onClick={onRefresh}>Check again</Button>
          </>
        ) : !status ? (
          <Text as="p" size="2" color="gray">Checking&hellip;</Text>
        ) : !status.linked ? (
          <>
            <Text as="p" size="2" color="gray" mb="3">
              Connect the card and the app reads your statement credits directly. You sign in on
              American Express&rsquo;s own page through Plaid, so no password reaches this app, and the
              access token it stores never leaves your machine. Running against Plaid{' '}
              <Badge color="amber" variant="soft">{status.env}</Badge>.
            </Text>
            <LinkButton label="Connect American Express" onLinked={onRefresh} onError={onError} />
          </>
        ) : (
          <>
            <Text as="p" size="2" color="gray" mb="3">
              Connected to <Text weight="medium">{status.institutionName ?? 'your card'}</Text>{' '}
              &middot; {status.transactionCount} transactions &middot;{' '}
              {status.lastSyncedAt
                ? `last synced ${new Date(status.lastSyncedAt).toLocaleString('en-US')}`
                : 'never synced'}{' '}
              &middot; Plaid {status.env}
            </Text>
            <Flex gap="2" wrap="wrap">
              <Button onClick={onSync} loading={busy}>Sync now</Button>
              <Button variant="soft" color="gray" onClick={onUnlink} disabled={busy}>Disconnect</Button>
            </Flex>
          </>
        )}
      </Card>

      {status?.linked && (
        <Card size="3">
          <Heading size="3" mb="1">What the sync found</Heading>
          <Text as="p" size="2" color="gray">
            {match.credits.length} statement {match.credits.length === 1 ? 'credit' : 'credits'} matched
            to a benefit, {match.pending.length} qualifying{' '}
            {match.pending.length === 1 ? 'purchase' : 'purchases'} still waiting on a credit,{' '}
            {match.unclaimed.length} unrecognised{' '}
            {match.unclaimed.length === 1 ? 'credit' : 'credits'} out of {txns.length} transactions.
          </Text>
          {match.credits.length > 0 && (
            <Flex direction="column" gap="1" mt="3">
              {match.credits.slice(0, 8).map((c) => (
                <Flex key={c.transactionId} gap="2" align="center" wrap="wrap">
                  <Text size="2" color="gray">{c.date}</Text>
                  <Text size="2" weight="medium">{fmtMoney(c.amount)}</Text>
                  <Text size="2" color="gray">{c.name}</Text>
                  {c.confidence === 'medium' && (
                    <Badge size="1" color="amber" variant="outline">amount differs</Badge>
                  )}
                </Flex>
              ))}
            </Flex>
          )}
        </Card>
      )}

      {match.unclaimed.length > 0 && (
        <Card size="3">
          <Heading size="3" mb="1">Credits the app did not recognise</Heading>
          <Text as="p" size="2" color="gray" mb="3">
            Amex does not publish the wording it uses on benefit credits, so some will not match the
            built-in rules. Tell the app which benefit each one belongs to and it will recognise that
            wording from now on.
          </Text>
          {match.unclaimed.slice(0, 12).map((t, i) => (
            <Box key={t.id}>
              {i > 0 && <Separator size="4" my="3" />}
              <Flex align="center" gap="3" wrap="wrap">
                <Box style={{ flex: '1 1 220px' }}>
                  <Text as="div" size="2" weight="medium">{t.name}</Text>
                  <Text as="div" size="1" color="gray">
                    {t.date} &middot; {fmtMoney(Math.abs(t.amount))} credited
                  </Text>
                </Box>
                <Select.Root onValueChange={(v) => teach(t.name, v)}>
                  <Select.Trigger placeholder="Assign to&hellip;" aria-label={`Assign ${t.name} to a benefit`} />
                  <Select.Content>
                    {enabled.map((b) => <Select.Item key={b.id} value={b.id}>{b.name}</Select.Item>)}
                  </Select.Content>
                </Select.Root>
              </Flex>
            </Box>
          ))}
        </Card>
      )}

      {learned.length > 0 && (
        <Card size="3">
          <Heading size="3" mb="3">Wording you have taught it</Heading>
          {learned.map((l, i) => {
            const b = benefits.find((x) => x.id === l.benefitId)
            return (
              <Box key={l.pattern}>
                {i > 0 && <Separator size="4" my="3" />}
                <Flex align="center" gap="3" wrap="wrap">
                  <Box style={{ flex: '1 1 220px' }}>
                    <Text as="div" size="2" weight="medium">{l.pattern}</Text>
                    <Text as="div" size="1" color="gray">counts as {b?.name ?? l.benefitId}</Text>
                  </Box>
                  <Button size="1" variant="ghost" color="gray" onClick={() => forget(l.pattern)}>
                    Forget
                  </Button>
                </Flex>
              </Box>
            )
          })}
        </Card>
      )}

      <Card size="3">
        <Heading size="3" mb="2">What syncing cannot tell you</Heading>
        {Object.entries(UNDETECTABLE).map(([id, why]) => (
          <Text as="p" size="2" color="gray" key={id} mb="2">{why}</Text>
        ))}
        <Text as="p" size="2" color="gray">
          Credits also post days to weeks after the purchase. A benefit showing
          &ldquo;awaiting credit&rdquo; means the spend landed but Amex has not paid it back yet, so do
          not spend against that credit twice.
        </Text>
      </Card>
    </Flex>
  )
}
