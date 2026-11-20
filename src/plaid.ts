import { useCallback, useEffect, useState } from 'react'
import type { Txn } from './matching'
import type { LearnedRule } from './matching'

export interface BridgeStatus {
  linked: boolean
  institutionName: string | null
  lastSyncedAt: string | null
  transactionCount: number
  env: string
}

const LEARNED_KEY = 'amex-platinum-tracker.learned'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `${path} failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export function useBridge() {
  const [status, setStatus] = useState<BridgeStatus | null>(null)
  const [txns, setTxns] = useState<Txn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** null until we know; false means the Plaid server is not running. */
  const [online, setOnline] = useState<boolean | null>(null)

  const [learned, setLearned] = useState<LearnedRule[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LEARNED_KEY) ?? '[]') as LearnedRule[]
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LEARNED_KEY, JSON.stringify(learned))
    } catch { /* storage blocked */ }
  }, [learned])

  const refresh = useCallback(async () => {
    try {
      const s = await api<BridgeStatus>('/api/status')
      setStatus(s)
      setOnline(true)
      if (s.linked) {
        const { transactions } = await api<{ transactions: Txn[] }>('/api/transactions')
        setTxns(transactions)
      } else {
        setTxns([])
      }
      setError(null)
    } catch (e) {
      setOnline(false)
      setStatus(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const sync = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await api('/api/sync', { method: 'POST' })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const unlink = useCallback(async () => {
    setBusy(true)
    try {
      await api('/api/unlink', { method: 'POST' })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const teach = useCallback((pattern: string, benefitId: string) => {
    setLearned((prev) => [...prev.filter((l) => l.pattern !== pattern), { pattern, benefitId }])
  }, [])

  const forget = useCallback((pattern: string) => {
    setLearned((prev) => prev.filter((l) => l.pattern !== pattern))
  }, [])

  return { status, txns, error, busy, online, learned, refresh, sync, unlink, teach, forget, setError }
}

export async function createLinkToken(): Promise<string> {
  const { linkToken } = await api<{ linkToken: string }>('/api/link-token', { method: 'POST' })
  return linkToken
}

export async function exchangePublicToken(publicToken: string, institutionName?: string): Promise<void> {
  await api('/api/exchange', {
    method: 'POST',
    body: JSON.stringify({ publicToken, institutionName }),
  })
}
