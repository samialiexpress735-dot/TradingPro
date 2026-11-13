/**
 * Binance CSV export importer.
 *
 * Supported files (all UTC timestamps):
 *  - Spot  > Trade History            Date(UTC),Pair,Side,Price,Executed,Amount,Fee
 *  - Spot  > Order History            Date(UTC),OrderNo,Pair,Type,Side,Order Price,Order Amount,Time,Executed,Average Price,Trading total,Status
 *  - USDⓈ-M Futures > Trade History   Date(UTC),Symbol,Side,Price,Quantity,Amount,Fee,Realized Profit
 *
 * Every row in those files is a single FILL, not a trade. We read the fills and pair them into round trips with
 * `pairFills`, so a BUY followed by a SELL becomes one trade with a real P&L (instead of two trades worth -fee).
 */
import { Trade, AssetClass } from '../types/trade';
import { parseCsv, parseLooseNumber } from './csvCore';
import { Fill, PairedTrade, pairFills } from './executionPairing';
import { pairedToTrade } from './tradeFactory';

export type BinanceFormat =
  | 'spot_trade_history'
  | 'spot_order_history'
  | 'futures_trade_history'
  | 'futures_no_realized'
  | 'wallet_statement'
  | 'unknown';

export type BinanceTimezone = 'local' | 'utc';

export interface BinanceCsvOptions {
  /** Binance timestamps are UTC. 'local' (default) converts them to the browser's timezone so trade days match your own calendar. */
  timezone?: BinanceTimezone;
  strategy?: string;
}

export interface BinanceCsvResult {
  recognized: boolean;
  format: BinanceFormat;
  formatLabel: string;
  market: 'spot' | 'futures' | null;
  trades: Trade[];
  warnings: string[];
  /** Set when the file is recognizable but cannot be imported, with what to do about it. */
  error?: string;
  fillCount: number;
  skippedRows: number;
  openCount: number;
  orphanCount: number;
  summary: { totalVolume: number; totalFees: number; netPnl: number; pairs: string[] };
}

const FORMAT_LABELS: Record<BinanceFormat, string> = {
  spot_trade_history: 'Binance Spot - Trade History',
  spot_order_history: 'Binance Spot - Order History',
  futures_trade_history: 'Binance USDⓈ-M Futures - Trade History',
  futures_no_realized: 'Binance Futures - fills (no Realized Profit column)',
  wallet_statement: 'Binance Wallet Statement (not a trade export)',
  unknown: 'Unrecognized',
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

const SYMBOL_COLS = ['pair', 'symbol', 'market', 'contract'];
const PRICE_COLS = ['price', 'averageprice', 'avgprice', 'average'];
const QTY_COLS = ['executed', 'executedqty', 'executedquantity', 'quantity', 'qty', 'filled', 'filledqty'];
const AMOUNT_COLS = ['amount', 'total', 'tradingtotal', 'quoteqty'];
const FEE_COLS = ['fee', 'commission', 'feeamount'];
const FEE_COIN_COLS = ['feecoin', 'commissionasset', 'feecurrency', 'feeasset'];
const REALIZED_COLS = ['realizedprofit', 'realizedpnl', 'realizedpl'];

interface Columns {
  time: number; fillTime: number; symbol: number; side: number; price: number; qty: number; amount: number;
  fee: number; feeCoin: number; realized: number; status: number; symbolHeader: string;
}

function findIdx(normHeaders: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = normHeaders.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

function resolveColumns(headers: string[]): Columns {
  const n = headers.map(norm);
  const time = findIdx(n, ['dateutc', 'timeutc', 'utctime', 'createtime', 'createdat', 'datetime', 'date', 'time']);
  const symbol = findIdx(n, SYMBOL_COLS);
  let side = findIdx(n, ['side', 'direction']);
  if (side < 0) side = findIdx(n, ['type']);
  // Order History has both "Date(UTC)" (placed) and "Time" (last update = fill time)
  const hasOrderNo = n.includes('orderno');
  const fillTime = hasOrderNo && n.includes('time') ? n.indexOf('time') : time;
  return {
    time, fillTime, symbol, side,
    price: n.includes('averageprice') ? n.indexOf('averageprice') : findIdx(n, PRICE_COLS),
    qty: findIdx(n, QTY_COLS),
    amount: findIdx(n, AMOUNT_COLS),
    fee: findIdx(n, FEE_COLS),
    feeCoin: findIdx(n, FEE_COIN_COLS),
    realized: findIdx(n, REALIZED_COLS),
    status: findIdx(n, ['status']),
    symbolHeader: symbol >= 0 ? n[symbol] : '',
  };
}

/** Cheap check used by the generic CSV wizard to hand a file over to this module. */
export function detectBinanceFormat(headers: string[]): BinanceFormat {
  const n = headers.map(norm);
  if (n.includes('operation') && n.includes('coin') && n.includes('change')) return 'wallet_statement';
  const c = resolveColumns(headers);
  const hasUtcTime = n.some((h) => ['dateutc', 'timeutc', 'utctime'].includes(h));
  if (!hasUtcTime || c.symbol < 0 || c.side < 0 || c.price < 0 || (c.qty < 0 && c.amount < 0)) return 'unknown';
  if (c.realized >= 0) return 'futures_trade_history';
  if (n.includes('orderno')) return 'spot_order_history';
  if (c.symbolHeader === 'symbol' && c.qty >= 0 && c.fee >= 0 && !n.includes('total')) return 'futures_no_realized';
  return 'spot_trade_history';
}

/** Parse Binance's UTC timestamp formats into epoch ms. */
export function parseBinanceTime(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{13}$/.test(s)) return Number(s);
  if (/^\d{10}$/.test(s)) return Number(s) * 1000;
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*Z?$/i);
  if (!m) {
    const m2 = s.match(/^(\d{2})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/); // yy-mm-dd
    if (m2) m = [m2[0], String(2000 + Number(m2[1])), m2[2], m2[3], m2[4], m2[5], m2[6]] as unknown as RegExpMatchArray;
  }
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
  return Number.isFinite(ms) ? ms : null;
}

const QUOTES = ['FDUSD', 'USDT', 'USDC', 'BUSD', 'TUSD', 'USDP', 'DAI', 'USD', 'BTC', 'ETH', 'BNB', 'TRY', 'EUR', 'GBP', 'BRL', 'AUD', 'ARS', 'RUB', 'ZAR', 'UAH', 'PLN', 'RON', 'CZK', 'JPY', 'MXN', 'COP', 'IDR', 'NGN'];
const STABLES = new Set(['USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'USDP', 'DAI', 'USD']);

export function splitPair(symbol: string): { base: string; quote: string } {
  for (const q of QUOTES) {
    if (symbol.length > q.length && symbol.endsWith(q)) return { base: symbol.slice(0, -q.length), quote: q };
  }
  return { base: symbol, quote: '' };
}

const cleanSymbol = (raw: string) => raw.toUpperCase().replace(/[\s/_-]/g, '').replace(/\.P$/, '');

const emptyResult = (format: BinanceFormat, recognized: boolean, error?: string): BinanceCsvResult => ({
  recognized, format, formatLabel: FORMAT_LABELS[format], market: null, trades: [], warnings: [], error,
  fillCount: 0, skippedRows: 0, openCount: 0, orphanCount: 0,
  summary: { totalVolume: 0, totalFees: 0, netPnl: 0, pairs: [] },
});

export function parseBinanceExport(csvText: string, opts: BinanceCsvOptions = {}): BinanceCsvResult {
  const tz = opts.timezone ?? 'local';
  const strategy = opts.strategy ?? 'Binance Execution';
  const rows = parseCsv(csvText);
  if (rows.length < 1) return emptyResult('unknown', false);

  // Header row = first row that resolves to a Binance-looking layout (some exports start with a title line)
  let headerIdx = -1;
  let format: BinanceFormat = 'unknown';
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const f = detectBinanceFormat(rows[i]);
    if (f !== 'unknown') { headerIdx = i; format = f; break; }
  }
  if (headerIdx < 0) return emptyResult('unknown', false);

  if (format === 'wallet_statement') {
    return emptyResult(format, true,
      'This is a Binance wallet statement (Transaction History), which lists balance changes, not trades. ' +
      'Export your trades instead: Spot → Orders → Trade History → Export, or Derivatives → USDⓈ-M Futures → Orders → Trade History → Export.');
  }

  const headers = rows[headerIdx];
  const col = resolveColumns(headers);
  const market: 'spot' | 'futures' = format.startsWith('futures') ? 'futures' : 'spot';
  const warnings: string[] = [];
  let skippedRows = 0;
  const skipReasons = new Map<string, number>();
  const skip = (why: string) => { skippedRows++; skipReasons.set(why, (skipReasons.get(why) || 0) + 1); };

  const foreignFees = new Map<string, { total: number; fills: number }>();
  const foreignFeeSymbols = new Set<string>();
  const fills: Fill[] = [];
  const data = rows.slice(headerIdx + 1);

  data.forEach((r, idx) => {
    const get = (i: number) => (i >= 0 && i < r.length ? r[i] : '');
    const tRaw = get(col.fillTime) || get(col.time);
    const time = parseBinanceTime(tRaw) ?? parseBinanceTime(get(col.time));
    if (time === null) { skip('unreadable date'); return; }

    const symbol = cleanSymbol(get(col.symbol));
    if (!symbol) { skip('missing symbol'); return; }
    if (/_PERP$|_\d{6}$/.test(symbol)) { skip('COIN-M / delivery contract (not supported)'); return; }

    const sideRaw = get(col.side).toLowerCase();
    const side: 'buy' | 'sell' | null = /^(buy|long)/.test(sideRaw) ? 'buy' : /^(sell|short)/.test(sideRaw) ? 'sell' : null;
    if (!side) { skip('row is not a buy/sell'); return; }

    const price = parseLooseNumber(get(col.price))?.value ?? 0;
    const { base, quote } = splitPair(symbol);

    let qty = parseLooseNumber(get(col.qty))?.value ?? 0;
    if (!(qty > 0) && col.amount >= 0) {
      // No explicit quantity column: derive it from the quote amount, or take Amount directly when it is in base units
      const a = parseLooseNumber(get(col.amount));
      if (a) qty = a.unit && base.endsWith(a.unit) ? a.value : price > 0 ? a.value / price : 0;
    }
    if (!(qty > 0) || !(price > 0)) { skip('nothing executed (cancelled / unfilled order)'); return; }

    // ---- fee -> quote currency ----------------------------------------------------------------------------
    let fee = 0;
    let feeBaseQty: number | undefined;
    const feeNum = parseLooseNumber(get(col.fee));
    if (feeNum && feeNum.value !== 0) {
      const unit = (get(col.feeCoin).toUpperCase() || feeNum.unit).replace(/[^A-Z0-9]/g, '');
      const v = Math.abs(feeNum.value);
      if (!unit || unit === quote || (STABLES.has(unit) && STABLES.has(quote))) fee = v;
      else if (base && (unit === base || base.endsWith(unit))) {
        // Spot: a fee in the base coin just means you received fewer coins (handled via feeBaseQty). Counting it
        // in `fee` as well would subtract it twice. Derivatives have no such effect, so convert it to quote.
        if (market === 'spot') feeBaseQty = v;
        else fee = v * price;
      } else {
        const cur = foreignFees.get(unit) || { total: 0, fills: 0 };
        cur.total += v; cur.fills++;
        foreignFees.set(unit, cur);
        foreignFeeSymbols.add(symbol);
      }
    }

    const realized = col.realized >= 0 ? parseLooseNumber(get(col.realized))?.value ?? 0 : undefined;
    fills.push({ time, symbol, side, qty, price, fee, feeBaseQty, realized, seq: idx });
  });

  if (fills.length === 0) {
    const r = emptyResult(format, true,
      'The file was recognized as a Binance export but contains no executed trades. If you exported Order History, make sure the date range includes filled orders.');
    r.skippedRows = skippedRows;
    return r;
  }

  // Exports are usually newest-first; make `seq` chronological so equal timestamps keep their true order.
  if (fills.length > 1 && fills[0].time > fills[fills.length - 1].time) {
    fills.forEach((f, i) => { f.seq = fills.length - i; });
  }

  const paired = pairFills(fills, { allowShort: market === 'futures' });

  // ---- build Trade objects ---------------------------------------------------------------------------------
  const assetClass: AssetClass = market === 'futures' ? 'futures' : 'crypto';
  const marketName = market === 'futures' ? 'USDⓈ-M Futures' : 'Spot';
  const tzNote = tz === 'utc' ? 'Times shown in UTC.' : 'Times converted from UTC to your local timezone.';

  const toTrade = (p: PairedTrade): Trade => {
    const notes: string[] = [`Imported from Binance ${marketName} (${p.fillCount} fill${p.fillCount === 1 ? '' : 's'}). ${tzNote}`];
    if (p.entryDerived) notes.push('Position was opened before this file’s date range: entry price derived from Realized Profit; entry time shows the exit time.');
    if (p.partial) notes.push('Closed portion of a position that is still open.');
    if (p.status === 'open') notes.push('Still open at the end of the export. Update it once closed.');
    if (foreignFeeSymbols.has(p.symbol)) notes.push('Some fills paid fees in a non-quote coin (e.g. BNB); those fees are not included in P&L.');
    notes.push('Stop/target were not in the export; add them (and your setup/emotion tags) to get R-multiples.');
    return pairedToTrade(p, {
      symbol: market === 'futures' ? `${p.symbol}.P` : p.symbol,
      assetClass,
      timezone: tz,
      idPrefix: `bn-${market}`,
      strategy,
      marketSession: '24/7 Crypto',
      notes,
    });
  };

  const trades = paired.trades.map(toTrade).sort((a, b) => (b.exitDate || b.date).localeCompare(a.exitDate || a.date) || (b.exitTime || b.time).localeCompare(a.exitTime || a.time));

  // ---- warnings ------------------------------------------------------------------------------------------------
  if (paired.orphans.length > 0) {
    const bySym = new Map<string, number>();
    paired.orphans.forEach((o) => bySym.set(o.symbol, (bySym.get(o.symbol) || 0) + 1));
    const list = [...bySym.entries()].map(([s, n]) => `${s} (${n})`).join(', ');
    warnings.push(`${paired.orphans.length} sell${paired.orphans.length === 1 ? '' : 's'} had no matching buy in this file: ${list}. They were bought before the export's date range, so their profit can't be calculated and they were skipped. Export a longer date range to include the buys.`);
  }
  const derived = paired.trades.filter((t) => t.entryDerived).length;
  if (derived > 0) warnings.push(`${derived} position${derived === 1 ? ' was' : 's were'} opened before this file's date range. Entry prices were reconstructed from the Realized Profit column.`);
  const openCount = paired.trades.filter((t) => t.status === 'open').length;
  if (openCount > 0) warnings.push(`${openCount} position${openCount === 1 ? ' is' : 's are'} still open at the end of the file. They're listed as Open trades and left unselected.`);
  if (foreignFees.size > 0) {
    const parts = [...foreignFees.entries()].map(([u, v]) => `${Number(v.total.toPrecision(6))} ${u} (${v.fills} fill${v.fills === 1 ? '' : 's'})`);
    warnings.push(`Fees paid in ${parts.join(', ')} can't be converted to ${market === 'futures' ? 'USDT' : 'the quote currency'} from the file alone, so they are not included in net P&L (it may be slightly overstated).`);
  }
  if (format === 'futures_no_realized') warnings.push('This futures file has no "Realized Profit" column, so P&L was computed from the fills. It can be inaccurate if positions were opened before the file starts. Prefer Futures → Orders → Trade History.');
  if (skippedRows > 0) warnings.push(`Skipped ${skippedRows} row${skippedRows === 1 ? '' : 's'}: ${[...skipReasons.entries()].map(([w, n]) => `${n}× ${w}`).join(', ')}.`);

  const closed = trades.filter((t) => t.status === 'closed');
  return {
    recognized: true,
    format,
    formatLabel: FORMAT_LABELS[format],
    market,
    trades,
    warnings,
    fillCount: fills.length,
    skippedRows,
    openCount,
    orphanCount: paired.orphans.length,
    summary: {
      totalVolume: Number(fills.reduce((a, f) => a + f.price * f.qty, 0).toFixed(2)),
      totalFees: Number(closed.reduce((a, t) => a + t.fees, 0).toFixed(4)),
      netPnl: Number(closed.reduce((a, t) => a + t.netPnl, 0).toFixed(2)),
      pairs: [...new Set(trades.map((t) => t.symbol))],
    },
  };
}
