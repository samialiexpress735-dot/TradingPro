# Implementation Plan: Binance & Crypto Exchange Sync Suite

Automate trade journaling for crypto traders by adding direct **Binance CSV import** (Spot & USDT-M Futures), **Read-Only API Sync**, automated fee/PnL calculation with **8-decimal Satoshi precision**, and multi-device persistence via **Supabase**.

---

## 1. User Intent & Product Strategy

Traders on Binance execute frequent trades across Spot and Futures (USDT-M), often with high fractional precision (e.g. `0.00045231 BTC`, `1,250.50 DOGE`) and multi-fill orders. Manually logging every execution is tedious and prone to error.

### Core Value Proposition:
- **One-Click Binance Import**: Support native Binance exports (Spot Trade History CSV, USDT-M Futures Order & Transaction CSVs) without requiring manual column mapping.
- **Order Aggregation & Fill Stitching**: Automatically combine multiple partial fills for the same order into a single clean journal entry with accurate weighted average price and total fees.
- **8-Decimal Precision & Funding Fee Tracking**: Maintain native 8-decimal precision for crypto quantities and prices, while deducting trading fees and funding rates from net PnL.
- **Cross-Device Cloud Sync**: Instantly save all imported trades to the user's Supabase PostgreSQL account (`public.trades`) so mobile and desktop views stay synchronized.

---

## 2. Visual Architecture & UI Design

Grounded in **SaaS & Financial Dashboard** guidelines (`3_saas_dashboard.md`):
- **High-Density Data Grid**: Clean import preview table with monospace tabular numbers (`font-mono`, `tabular-nums`) aligning decimal points vertically.
- **Zero-Pill Restraint**: Trade directions, timestamps, and fees rendered with quiet typographic dividers (`BTC/USDT · LONG · 0.0452 BTC · Fee: $0.12`).
- **Interactive Staging & Deduplication Drawer**:
  - Displays detected trades before writing to database.
  - Highlights duplicates (trades matching existing timestamp + symbol + price).
  - Select all / Deselect toggle and bulk edit setup tags (e.g. assign strategy to batch).
- **Exchange Connection Panel**:
  - Dual tabs: **"CSV / File Upload"** (instant dropzone for `.csv` and `.xlsx`) and **"Binance API Sync"** (Read-Only API Key & Secret for automated background sync).
  - Clear security indicator reminding users to use **Read-Only** permissions (no withdrawal or trading permissions enabled).

---

## 3. Technical Execution Steps

### Phase 1: Binance Data Engine & Parser (`src/utils/binanceParser.ts`)
1. **Binance Spot CSV Parser**:
   - Headers: `Date(UTC), Market/Pair, Type, Price, Amount, Total, Fee, Fee Coin`.
   - Normalizes pairs (e.g., `BTCUSDT` $\rightarrow$ `BTC/USDT`), converts direction (`BUY` $\rightarrow$ `long`, `SELL` $\rightarrow$ `short`), extracts fees in USD equivalent.
2. **Binance USDT-M Futures CSV Parser**:
   - Headers: `Time(UTC), Symbol, Side, Price, Executed Qty, Realized PnL, Commission`.
   - Stitches multi-fill executions by order ID or timestamp window.
   - Calculates exact Gross PnL, Commission, and Net PnL.
3. **Deduplication Engine**:
   - Computes unique fingerprint `hash(date + symbol + entryPrice + quantity)` to prevent re-importing trades already stored in Supabase.

### Phase 2: Exchange Sync UI Component (`src/components/BinanceSyncModal.tsx`)
1. **Dropzone Interface**:
   - Drag & drop zone with instant format detection (Spot vs. Futures).
   - Sample downloadable Binance export template for first-time traders.
2. **Review & Batch Tagging Table**:
   - Table showing Symbol, Direction, Entry/Exit Price, Quantity (8 decimals), Net PnL, Fees, and Strategy tag dropdown.
   - Counter showing: `X new trades found · Y duplicates skipped`.
3. **Commit & Supabase Batch Upsert**:
   - On confirm, calls `batchSyncUserTrades(userId, importedTrades)` directly into Supabase.
   - Shows progress toast with celebratory sound / confetti on completion.

### Phase 3: Trade Journal & Dashboard Integration
1. Add **"Import Binance"** button alongside "Log Trade" and "Import CSV" in:
   - `TradeJournal.tsx`
   - `Dashboard.tsx`
2. Update filter bar with quick toggle: `Asset: Crypto` $\rightarrow$ filter by quote asset (`USDT`, `USDC`, `BTC`).

---

## 4. Testing & Verification Plan

### Automated & Unit Tests:
- Parse mock Binance Spot CSV and verify quantity precision matches `0.00000001` format.
- Parse mock Binance Futures CSV with multi-fill executions and confirm weighted entry price formula:
  $$\text{Weighted Price} = \frac{\sum (\text{Price}_i \times \text{Qty}_i)}{\sum \text{Qty}_i}$$
- Verify duplicate detection skips existing trades cleanly.

### Manual Verification Flow:
1. Open TradePulse dashboard $\rightarrow$ click **"Import Binance"**.
2. Upload test Binance trade history file.
3. Verify all quantities display with 8-decimal accuracy.
4. Click **"Import Trades"** $\rightarrow$ confirm trades appear in `public.trades` in Supabase.
5. Check mobile phone view: verify trades are visible with matching PnL and current month heatmap.
