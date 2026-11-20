import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(here, '..', 'data')
const FILE = join(DATA_DIR, 'store.json')

const EMPTY = {
  /** Plaid access token for the linked Amex item. Never sent to the browser. */
  accessToken: null,
  itemId: null,
  institutionName: null,
  /** Plaid /transactions/sync cursor. */
  cursor: null,
  lastSyncedAt: null,
  /** Raw transactions we have seen, keyed by transaction_id. */
  transactions: {},
}

export function load() {
  if (!existsSync(FILE)) return structuredClone(EMPTY)
  try {
    return { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(FILE, 'utf8')) }
  } catch {
    return structuredClone(EMPTY)
  }
}

export function save(state) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(state, null, 2), { mode: 0o600 })
}

export function update(fn) {
  const state = load()
  const next = fn(state) ?? state
  save(next)
  return next
}
