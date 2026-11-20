# Setup

The tracker is two processes: a Vite web app on port 5273 and a small Plaid bridge on
port 5274. The bridge exists because Plaid secrets cannot live in a browser.

```bash
npm install
```

## 1. Get Plaid keys

1. Sign up at [dashboard.plaid.com](https://dashboard.plaid.com). Sandbox access is free and
   immediate.
2. Copy your **client_id** and **sandbox secret** from Developers → Keys.
3. `cp .env.example .env` and paste them in. Leave `PLAID_ENV=sandbox` for now.

`.env` and `data/` are gitignored. The access token is written to `data/store.json` with
file mode 600 and never sent to the browser.

## 2. Run it

```bash
npm run dev:all
```

That starts both halves. Open http://localhost:5273 and go to the **Sync** tab.

To run them separately: `npm run dev` for the web app, `npm run server` for the bridge.

## 3. Try it in sandbox first

Click **Connect American Express**. In sandbox, Plaid ignores the real bank and accepts the
test credentials `user_good` / `pass_good`. You will get fake transactions, which is enough
to confirm the plumbing works end to end.

## 4. Switch to your real card

1. In the Plaid dashboard, request production access. This is a short form; approval for a
   personal project is usually quick but is not instant.
2. Put your **production** secret in `.env` (it is a different value from the sandbox one)
   and set `PLAID_ENV=production`.
3. Restart the bridge, click **Disconnect** if a sandbox item is still linked, then connect
   again and pick American Express.

You will authenticate on americanexpress.com through Plaid's OAuth flow. No password passes
through this app. Amex requires periodic consent refresh, so expect to reconnect every few
months.

Plaid's Trial plan covers up to 10 connected items at no cost, which is ample for one card.

## 5. Teach it your statement wording

Amex does not publish the descriptors it uses on benefit credits, so the built-in rules in
`src/matching.ts` are informed guesses. After your first real sync, the Sync tab lists any
money-in lines it could not place under **Credits the app did not recognise**. Assign each one
to a benefit and it will recognise that wording from then on. Those lessons are stored in your
browser.

## What it cannot do

- **Uber Cash is invisible.** Amex loads it into your Uber account rather than posting a
  statement credit, so nothing on the card can confirm it. That benefit stays manual.
- **Credits lag the purchase** by days to weeks. A benefit marked "Spent, awaiting credit"
  means the spend posted but Amex has not paid it back yet.
- **Enrollment is not visible.** If you never enrolled in a benefit, no credit will ever
  post, and the app can only show you that nothing arrived.

## Tests

```bash
npm test
```

Covers the matcher: period assignment, card payments being excluded, over-sized credits being
flagged rather than accepted, learned rules, and Uber Cash never being auto-confirmed.
