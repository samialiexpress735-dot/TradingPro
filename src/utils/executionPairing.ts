/**
 * Execution pairing: turns a stream of raw fills (what exchange/broker "trade history" exports contain)
 * into round-trip trades (what a journal needs).
 *
 *  - Average-cost accounting per symbol, one-way position (long, flat, short).
 *  - Scale-in / scale-out: a "cycle" runs from flat to flat and becomes ONE trade.
 *  - Spot mode: long only. Selling more than is held is reported as an orphan (bought before the file's range).
 *  - Derivatives mode: shorts and position flips allowed. If the source gives realized P&L per closing fill
 *    (Binance Futures "Realized Profit") it is used as the source of truth and the entry price is derived from it,
 *    so a position opened before the file's date range is still imported correctly.
 *  - Positions still open at the end of the file are returned as open trades (plus a closed trade for any part
 *    that was already scaled out).
 */

export interface Fill {
  /** Epoch milliseconds (UTC). */
  time: number;
  symbol: string;
  side: 'buy' | 'sell';
  /** Gross quantity executed, in base units (shares / coins / contracts). */
  qty: number;
  price: number;
  /** Fee already converted to the quote currency (>= 0). */
  fee: number;
  /** Fee paid in the base asset (spot): reduces the quantity actually received on a buy. */
  feeBaseQty?: number;
  /** Gross realized P&L reported by the source on closing fills (derivatives). Opening fills report 0. */
  realized?: number;
  /** Tie-breaker for equal timestamps; must increase in chronological order. */
  seq: number;
}

export interface PairedTrade {
  symbol: string;
  direction: 'long' | 'short';
  status: 'closed' | 'open';
  openTime: number;
  closeTime: number;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  /** Total fees in quote currency (including value of fees paid in the base asset). */
  fees: number;
  grossPnl: number;
  netPnl: number;
  /** Entry price was reconstructed from realized P&L because the opening fills are not in the file. */
  entryDerived: boolean;
  /** Closed portion of a position that is still open. */
  partial: boolean;
  fillCount: number;
}

export interface Orphan {
  symbol: string;
  qty: number;
  time: number;
  price: number;
}

export interface PairResult {
  trades: PairedTrade[];
  /** Spot sells with no matching buy in the file. */
  orphans: Orphan[];
}

export interface PairOptions {
  /** true for futures/margin/stocks: allows shorting and flipping. false for spot. */
  allowShort: boolean;
}

const EPS = 1e-12;

interface Cycle {
  dir: 1 | -1;
  openTime: number;
  closeTime: number;
  entryQty: number;
  entryValue: number;
  entryFees: number;
  exitQty: number;
  exitValue: number;
  costClosed: number;
  exitFees: number;
  realized: number;
  hasRealized: boolean;
  peakHeld: number;
  fills: number;
}

const newCycle = (dir: 1 | -1, time: number): Cycle => ({
  dir, openTime: time, closeTime: time,
  entryQty: 0, entryValue: 0, entryFees: 0,
  exitQty: 0, exitValue: 0, costClosed: 0, exitFees: 0,
  realized: 0, hasRealized: false, peakHeld: 0, fills: 0,
});

/** Merge fills of the same symbol/side that share a timestamp (one order matched in several pieces). */
export function mergeSimultaneousFills(fills: Fill[]): Fill[] {
  const sorted = [...fills].sort((a, b) => a.time - b.time || a.seq - b.seq);
  const out: Fill[] = [];
  for (const f of sorted) {
    const last = out[out.length - 1];
    if (last && last.symbol === f.symbol && last.side === f.side && last.time === f.time) {
      const q = last.qty + f.qty;
      last.price = (last.price * last.qty + f.price * f.qty) / q;
      last.qty = q;
      last.fee += f.fee;
      if (f.feeBaseQty !== undefined || last.feeBaseQty !== undefined) last.feeBaseQty = (last.feeBaseQty || 0) + (f.feeBaseQty || 0);
      if (f.realized !== undefined || last.realized !== undefined) last.realized = (last.realized || 0) + (f.realized || 0);
    } else {
      out.push({ ...f });
    }
  }
  return out;
}

function finalizeClosed(c: Cycle, opts: { entryFeeShare: number; partial: boolean; derived: boolean }): PairedTrade | null {
  const Q = c.exitQty;
  if (Q <= EPS) return null;
  const exitPrice = c.exitValue / Q;
  const quoteFees = opts.entryFeeShare + c.exitFees;
  let entryPrice: number;
  let netPnl: number;
  let grossPnl: number;

  if (c.hasRealized) {
    grossPnl = c.realized;
    entryPrice = c.dir > 0 ? exitPrice - grossPnl / Q : exitPrice + grossPnl / Q;
    netPnl = grossPnl - quoteFees;
  } else {
    entryPrice = c.entryQty > EPS ? c.entryValue / c.entryQty : exitPrice;
    const core = c.dir > 0 ? c.exitValue - c.costClosed : c.costClosed - c.exitValue;
    netPnl = core - quoteFees;
    grossPnl = c.dir * (exitPrice - entryPrice) * Q;
  }

  return {
    symbol: '',
    direction: c.dir > 0 ? 'long' : 'short',
    status: 'closed',
    openTime: c.openTime,
    closeTime: c.closeTime,
    quantity: Q,
    entryPrice,
    exitPrice,
    // fees shown = everything that separates gross from net (quote fees + value of fees paid in the base asset)
    fees: Math.max(0, grossPnl - netPnl),
    grossPnl,
    netPnl,
    entryDerived: opts.derived,
    partial: opts.partial,
    fillCount: c.fills,
  };
}

export function pairFills(allFills: Fill[], opts: PairOptions): PairResult {
  const trades: PairedTrade[] = [];
  const orphans: Orphan[] = [];

  const bySymbol = new Map<string, Fill[]>();
  for (const f of allFills) {
    if (!(f.qty > 0) || !(f.price > 0)) continue;
    const list = bySymbol.get(f.symbol) || [];
    list.push(f);
    bySymbol.set(f.symbol, list);
  }

  for (const [symbol, list] of bySymbol) {
    const fills = mergeSimultaneousFills(list);
    let pos = 0; // held quantity, absolute
    let cost = 0; // absolute cost basis of what is held
    let cycle: Cycle | null = null;
    const push = (t: PairedTrade | null) => { if (t) { t.symbol = symbol; trades.push(t); } };
    const dustRel = opts.allowShort ? 1e-9 : 0.005;

    for (const fill of fills) {
      const sgn: 1 | -1 = fill.side === 'buy' ? 1 : -1;
      let remaining = fill.qty;
      const feePerUnit = fill.fee / fill.qty;
      const baseFeePerUnit = (fill.feeBaseQty || 0) / fill.qty;

      // ---- reducing / closing an existing position -------------------------------------------------
      if (cycle && pos > EPS && cycle.dir !== sgn) {
        const q = Math.min(remaining, pos);
        const avg = cost / pos;
        const cc = avg * q;
        cycle.exitQty += q;
        cycle.exitValue += q * fill.price;
        cycle.costClosed += cc;
        cycle.exitFees += feePerUnit * q;
        cycle.closeTime = fill.time;
        cycle.fills++;
        if (fill.realized !== undefined) { cycle.realized += fill.realized; cycle.hasRealized = true; }
        pos -= q;
        cost -= cc;
        remaining -= q;

        if (pos <= Math.max(EPS, cycle.peakHeld * dustRel)) {
          cycle.costClosed += cost; // leftover dust counts as spent
          pos = 0; cost = 0;
          push(finalizeClosed(cycle, { entryFeeShare: cycle.entryFees, partial: false, derived: false }));
          cycle = null;
        }
        if (remaining <= EPS) continue;
        // fall through with the remainder: flip (derivatives) or orphan (spot)
      }

      // ---- nothing to reduce: unseen position being closed (derivatives with realized P&L) -------------
      if (!cycle && remaining > EPS && opts.allowShort && fill.realized !== undefined && Math.abs(fill.realized) > EPS && fill.qty === remaining) {
        const dir: 1 | -1 = sgn > 0 ? -1 : 1; // a SELL closes a long
        const c = newCycle(dir, fill.time);
        c.exitQty = remaining; c.exitValue = remaining * fill.price; c.exitFees = fill.fee;
        c.realized = fill.realized; c.hasRealized = true; c.fills = 1;
        push(finalizeClosed(c, { entryFeeShare: 0, partial: false, derived: true }));
        continue;
      }

      // ---- spot: selling something we never saw bought ---------------------------------------------
      if (!opts.allowShort && sgn < 0) {
        if (remaining > EPS) orphans.push({ symbol, qty: remaining, time: fill.time, price: fill.price });
        continue;
      }

      // ---- opening / adding (and the remainder of a flip) --------------------------------------------
      if (remaining > EPS) {
        if (!cycle) cycle = newCycle(sgn, fill.time);
        const baseFee = baseFeePerUnit * remaining;
        const held = remaining - baseFee;
        cycle.entryQty += remaining;
        cycle.entryValue += remaining * fill.price;
        cycle.entryFees += feePerUnit * remaining;
        cycle.fills++;
        pos += held;
        cost += remaining * fill.price;
        cycle.peakHeld = Math.max(cycle.peakHeld, pos);
      }
    }

    // ---- end of file: whatever is still held ------------------------------------------------------------
    if (cycle && pos > EPS) {
      const frac = cycle.entryQty > EPS ? Math.min(1, cycle.exitQty / cycle.entryQty) : 0;
      if (cycle.exitQty > EPS) {
        push(finalizeClosed(cycle, { entryFeeShare: cycle.entryFees * frac, partial: true, derived: false }));
      }
      const lastTime = fills.length ? fills[fills.length - 1].time : cycle.openTime;
      // No scale-outs yet: show the price the user actually paid, not the fee-adjusted cost per held unit.
      const entry = cycle.exitQty <= EPS && cycle.entryQty > EPS ? cycle.entryValue / cycle.entryQty : cost / pos;
      trades.push({
        symbol,
        direction: cycle.dir > 0 ? 'long' : 'short',
        status: 'open',
        openTime: cycle.openTime,
        closeTime: lastTime,
        quantity: pos,
        entryPrice: entry,
        exitPrice: entry,
        fees: cycle.entryFees * (1 - frac),
        grossPnl: 0,
        netPnl: 0,
        entryDerived: false,
        partial: false,
        fillCount: cycle.fills,
      });
    }
  }

  trades.sort((a, b) => a.closeTime - b.closeTime || a.openTime - b.openTime);
  return { trades, orphans };
}
