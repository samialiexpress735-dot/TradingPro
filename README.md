# TradePulse — Professional Quantitative Trading Journal

TradePulse is a high-performance trading journal, risk management, and execution analytics platform built with **React 19**, **TypeScript**, **Tailwind CSS**, and **Supabase**.

## Key Features

- **Pristine Journaling**: Clean, empty production state ready for your live executions across Stocks, Crypto, Forex, Futures, and Options.
- **Supabase Cloud Sync**: Real-time authentication, user profiles, and PostgreSQL database persistence secured with Row Level Security (RLS).
- **Broker CSV Importer**: Auto-detects and parses statements from ThinkorSwim, Interactive Brokers (Flex Query & Activity), TradingView, MetaTrader 4/5, and NinjaTrader.
- **Disciplined Equity Curve**: Compares actual P&L against a theoretical "What-If" curve that removes rule-break losses, quantifying the exact cost of psychological leaks.
- **Daily Prep & EOD Review**: Daily grading (A-F), emotional tracking, sleep & focus metrics, and structured market debriefs.
- **Strategy Playbook**: Build and track setup playbooks with custom rules, win rates, and profit factors.
- **Offline PWA Support**: Installable on desktop & mobile with service worker caching.
- **Vercel Ready**: Preconfigured with `vercel.json` SPA rewrites and caching headers.

## Getting Started Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env.local
   ```
   Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

3. Run the development server:
   ```bash
   npm run dev
   ```

## Deploying to Vercel & Supabase

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for step-by-step instructions on:
1. Exporting to GitHub
2. Running `supabase-schema.sql` in Supabase SQL editor
3. Setting environment variables on Vercel
4. Going live with continuous deployment!

## Importing trades from CSV

**Journal → Import CSV** (or **Sync Binance**) auto-detects the file format.

| Source | Export to use |
|---|---|
| Binance Spot | Orders → Spot Order → **Trade History** → Export (Order History also works) |
| Binance USDⓈ-M Futures | Orders → **Trade History** → Export (needs the *Realized Profit* column) |
| ThinkorSwim, TradingView | Executions / strategy trades are paired into round trips |
| Interactive Brokers, MetaTrader, NinjaTrader, anything else | One closed trade per row; use *Adjust Columns* if headers differ |

Binance exports list individual **fills**, not trades. The importer pairs them (`src/utils/executionPairing.ts`) with
average-cost accounting: scale-ins/outs become one trade, partial fills at the same second are merged, fees paid in the
traded coin reduce the quantity received, and positions opened before the file's date range are handled (spot sells
with no matching buy are skipped with a warning; futures entries are derived from *Realized Profit*).
Binance timestamps are UTC; the wizard lets you show them in your local time (default) or UTC. Re-importing the same
file is safe: Binance trades get deterministic ids and are flagged as duplicates.

Imported trades contain no invented journal data: stop/target equal the entry price (= none recorded, 0R) and there is
no mistake tag, so add your setup, emotion and stop afterwards to unlock R-multiple analytics.

### Tests

```bash
npm test        # importer + pairing engine tests (fixtures in tests/fixtures)
```
