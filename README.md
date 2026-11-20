# Platinum Benefits Tracker

A personal tool for one cardholder to track which American Express Platinum statement
credits have actually been used, period by period, against the card's annual fee.

Not affiliated with American Express. Benefit amounts are seeded from public write-ups
and are editable, because published sources disagree with each other.

## Why it exists

The Platinum's credits run on four different clocks. Some reset monthly, some quarterly,
some twice a year, some annually. Unused ones expire silently. The question "have I used
everything I'm paying for?" is tedious to answer by hand and easy to get wrong near a
deadline.

## How it decides a benefit was used

It matches on the **statement credit Amex posts**, not on the qualifying purchase.

A $120 charge at a Resy restaurant does not mean the Resy credit fired. That depends on
enrollment, on whether the restaurant is Resy-enrolled, and on Amex's own decision. The
only reliable evidence is the credit Amex posts afterwards, usually days to weeks later.
So a purchase marks the benefit "spent, awaiting credit", and only a posted credit marks
it used.

Amex does not publish the descriptors it uses on these credits, so the built-in patterns
in `src/matching.ts` are informed guesses. Credits that match nothing are surfaced in the
UI for the user to assign, and those assignments are remembered.

One benefit is deliberately never auto-detected: Uber Cash loads into the Uber app rather
than posting a statement credit, so no card transaction can confirm it. A test asserts
this stays true.

## Architecture

| Part | What it does |
| --- | --- |
| `src/` | React + TypeScript UI, built on Radix Themes. State in `localStorage`. |
| `src/matching.ts` | Maps transactions to benefits and periods. Pure functions, unit tested. |
| `server/` | Express bridge to Plaid. Holds the client secret and access token. |

The bridge exists so the Plaid secret and access token never reach the browser. It stores
one access token in `data/store.json` (gitignored, mode 600) and exposes only sanitised
transaction fields to the client. It uses Plaid's `/transactions/sync` with a stored cursor.

## Plaid usage

Products: **Transactions** only. One Item, one cardholder, running locally on the
cardholder's own machine. No data leaves that machine: there is no hosted backend, no
analytics, and no third party beyond Plaid itself.

## Running it

See [SETUP.md](SETUP.md). Short version:

```bash
npm install
cp .env.example .env   # add your Plaid keys
npm run dev:all
```

```bash
npm test
```
