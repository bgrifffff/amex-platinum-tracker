import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { PlaidClient, PlaidEnvironment, PlaidError } from 'plaid'
import { load, save, update } from './store.js'

const PORT = Number(process.env.PORT || 5274)
const ENV_NAME = (process.env.PLAID_ENV || 'sandbox').toLowerCase()
const CLIENT_ID = process.env.PLAID_CLIENT_ID
const SECRET = process.env.PLAID_SECRET

// The v51 SDK ships Sandbox and Production only; the old "development" env is gone.
const ENVIRONMENTS = {
  sandbox: PlaidEnvironment.Sandbox,
  production: PlaidEnvironment.Production,
}

if (!CLIENT_ID || !SECRET) {
  console.error('\nMissing PLAID_CLIENT_ID or PLAID_SECRET.')
  console.error('Copy .env.example to .env and add your keys from dashboard.plaid.com.')
  console.error('See SETUP.md for the walkthrough.\n')
  process.exit(1)
}

if (!ENVIRONMENTS[ENV_NAME]) {
  console.error(`\nPLAID_ENV must be "sandbox" or "production", not "${ENV_NAME}".\n`)
  process.exit(1)
}

const plaid = new PlaidClient({
  clientId: CLIENT_ID,
  secret: SECRET,
  environment: ENVIRONMENTS[ENV_NAME],
})

const app = express()
app.use(cors({ origin: ['http://localhost:5273', 'http://127.0.0.1:5273'] }))
app.use(express.json())

function fail(res, err, where) {
  const body = err instanceof PlaidError ? err.body : undefined
  const message = body?.error_message || err?.message || 'Plaid request failed'
  console.error(`[${where}]`, body ?? err)
  res.status(500).json({ error: message, code: body?.error_code, where })
}

app.get('/api/status', (_req, res) => {
  const s = load()
  res.json({
    linked: Boolean(s.accessToken),
    institutionName: s.institutionName,
    lastSyncedAt: s.lastSyncedAt,
    transactionCount: Object.keys(s.transactions).length,
    env: ENV_NAME,
  })
})

app.post('/api/link-token', async (_req, res) => {
  try {
    const r = await plaid.link.createToken({
      client_name: 'Platinum Benefits Tracker',
      language: 'en',
      country_codes: ['US'],
      user: { client_user_id: 'local-user' },
      products: ['transactions'],
    })
    res.json({ linkToken: r.link_token })
  } catch (err) {
    fail(res, err, 'link-token')
  }
})

app.post('/api/exchange', async (req, res) => {
  const { publicToken, institutionName } = req.body ?? {}
  if (!publicToken) return res.status(400).json({ error: 'publicToken required' })
  try {
    const r = await plaid.item.exchangePublicToken({ public_token: publicToken })
    update((s) => ({
      ...s,
      accessToken: r.access_token,
      itemId: r.item_id,
      institutionName: institutionName ?? null,
      cursor: null,
      transactions: {},
    }))
    res.json({ ok: true })
  } catch (err) {
    fail(res, err, 'exchange')
  }
})

/** Keep only the fields the matcher needs. */
function slim(t) {
  return {
    id: t.transaction_id,
    date: t.authorized_date || t.date,
    name: t.name,
    merchant: t.merchant_name ?? null,
    amount: t.amount,
    pending: Boolean(t.pending),
    category: t.personal_finance_category?.primary ?? null,
  }
}

app.post('/api/sync', async (_req, res) => {
  const state = load()
  if (!state.accessToken) return res.status(400).json({ error: 'No account linked yet' })

  try {
    let cursor = state.cursor ?? undefined
    const transactions = { ...state.transactions }
    let added = 0
    let modified = 0
    let removed = 0
    let hasMore = true

    while (hasMore) {
      const d = await plaid.transactions.sync({
        access_token: state.accessToken,
        cursor,
        count: 500,
      })
      for (const t of d.added) { transactions[t.transaction_id] = slim(t); added++ }
      for (const t of d.modified) { transactions[t.transaction_id] = slim(t); modified++ }
      for (const t of d.removed) { delete transactions[t.transaction_id]; removed++ }
      cursor = d.next_cursor
      hasMore = d.has_more
    }

    save({ ...state, cursor, transactions, lastSyncedAt: new Date().toISOString() })
    res.json({ added, modified, removed, total: Object.keys(transactions).length })
  } catch (err) {
    fail(res, err, 'sync')
  }
})

app.get('/api/transactions', (_req, res) => {
  const s = load()
  const list = Object.values(s.transactions).sort((a, b) => (a.date < b.date ? 1 : -1))
  res.json({ transactions: list, lastSyncedAt: s.lastSyncedAt })
})

app.post('/api/unlink', async (_req, res) => {
  const s = load()
  try {
    if (s.accessToken) await plaid.item.remove({ access_token: s.accessToken })
  } catch (err) {
    console.warn('[unlink] Plaid refused item.remove; clearing locally anyway.')
  }
  save({
    accessToken: null, itemId: null, institutionName: null,
    cursor: null, lastSyncedAt: null, transactions: {},
  })
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`Plaid bridge on http://localhost:${PORT} (env: ${ENV_NAME})`)
})
