import { Trade, AssetClass, TradeDirection, TradeOutcome } from '../types/trade';
import { parseCsv, parseLooseNumber } from './csvCore';
import { BinanceCsvResult, BinanceTimezone, detectBinanceFormat, parseBinanceExport } from './binanceCsv';
import { Fill, pairFills } from './executionPairing';
import { pairedToTrade } from './tradeFactory';
import { buildDuplicateChecker } from './tradeDedupe';
import { utcDateString, utcTimeString } from './dateHelpers';

export interface ColumnMapping {
  dateCol: string;
  timeCol?: string;
  symbolCol: string;
  directionCol?: string;
  entryPriceCol: string;
  exitPriceCol?: string;
  quantityCol: string;
  netPnlCol?: string;
  feesCol?: string;
  strategyCol?: string;
  notesCol?: string;
}

export type DetectedPlatform =
  | 'generic'
  | 'thinkorswim'
  | 'ibkr'
  | 'tradingview'
  | 'metatrader'
  | 'ninjatrader'
  | 'binance'
  | 'unknown';

export interface ParsedCsvResult {
  detectedPlatform: DetectedPlatform;
  /** Human readable format name, e.g. "Binance Spot - Trade History". */
  formatLabel?: string;
  headers: string[];
  rawRows: Record<string, string>[];
  trades: Trade[];
  warnings: string[];
  duplicatesCount: number;
  /** Set when nothing could be imported; explains why and what to do. */
  error?: string;
  /** Only for Binance files. */
  binance?: BinanceCsvResult;
}

export interface ParseOptions {
  binanceTimezone?: BinanceTimezone;
  strategy?: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Raw CSV -> headers + rows
// ---------------------------------------------------------------------------------------------------------------
const HEADER_KEYWORDS = [
  'symbol', 'ticker', 'instrument', 'item', 'pair', 'contract', 'date', 'exec time', 'open time', 'time',
  'price', 'entry price', 'p/l', 'profit', 'netpnl', 'side', 'quantity', 'qty', 'trade #',
];

/** Parses CSV text into headers + row objects. Skips leading junk lines (title rows, blank lines). */
export function parseRawCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { headers: [], rows: [] };

  let headerIndex = 0;
  for (let i = 0; i < Math.min(10, table.length); i++) {
    const lower = table[i].map((c) => c.toLowerCase());
    if (lower.length >= 3 && lower.some((c) => HEADER_KEYWORDS.some((k) => c.includes(k)))) {
      headerIndex = i;
      break;
    }
  }

  const headers = table[headerIndex].map((h, i) => h.replace(/^["']|["']$/g, '').trim() || `Column_${i + 1}`);
  const rows: Record<string, string>[] = [];
  for (let i = headerIndex + 1; i < table.length; i++) {
    const cols = table[i];
    if (cols.every((c) => c === '')) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? '').replace(/^["']|["']$/g, '').trim();
    });
    rows.push(obj);
  }
  return { headers, rows };
}

// Auto-detect broker format based on headers
export function detectBrokerPlatform(headers: string[]): DetectedPlatform {
  const lower = headers.map((h) => h.toLowerCase());
  const has = (keyword: string) => lower.some((h) => h.includes(keyword.toLowerCase()));

  if (detectBinanceFormat(headers) !== 'unknown') return 'binance';
  if (has('exec time') && has('spread') && has('pos effect')) return 'thinkorswim';
  if (has('datagroup') || (has('t. price') && has('realized p/l')) || has('datadiscriminator')) return 'ibkr';
  if (has('trade #') && (has('cum. profit') || has('run-up'))) return 'tradingview';
  if (has('ticket') && has('open time') && (has('s / l') || has('swap'))) return 'metatrader';
  if (has('market pos.') && has('entry time') && has('exit time')) return 'ninjatrader';
  if (has('symbol') && (has('netpnl') || has('entryprice') || has('direction'))) return 'generic';

  return 'unknown';
}

// ---------------------------------------------------------------------------------------------------------------
// Dates & numbers
// ---------------------------------------------------------------------------------------------------------------
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const monthNum = (name: string) => MONTHS[name.slice(0, 3).toLowerCase()] || 0;

const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));
const validYMD = (y: number, m: number, d: number) => y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

/**
 * Parse a broker date (+ optional time) as WALL-CLOCK time and return epoch ms where the wall clock is read as UTC.
 * Format with the UTC getters to get the original numbers back. No timezone shifting ever happens.
 * Returns null when the text isn't a recognizable date.
 */
export function parseWallClock(dateStr: string, timeStr?: string): number | null {
  const raw = `${dateStr || ''} ${timeStr || ''}`.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  let y: number, mo: number, d: number;
  let m: RegExpMatchArray | null;

  if ((m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?!\d)/))) {
    // Ambiguous D/M vs M/D: US order unless the first number can't be a month
    const a = +m[1], b = +m[2];
    y = fullYear(m[3]);
    if (a > 12 && b <= 12) { d = a; mo = b; } else { mo = a; d = b; }
  } else if ((m = raw.match(/^(\d{1,2})[ -]([A-Za-z]{3,9})[ -](\d{2,4})/))) { d = +m[1]; mo = monthNum(m[2]); y = fullYear(m[3]); }
  else if ((m = raw.match(/^([A-Za-z]{3,9})\.? (\d{1,2}) (\d{4})/))) { mo = monthNum(m[1]); d = +m[2]; y = +m[3]; }
  else return null;

  if (!mo || !validYMD(y, mo, d)) return null;

  let hh = 0, mm = 0, ss = 0;
  const tm = raw.slice(m[0].length).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  if (tm) {
    hh = +tm[1]; mm = +tm[2]; ss = tm[3] ? +tm[3] : 0;
    if (tm[4]) {
      const pm = tm[4].toLowerCase() === 'pm';
      if (pm && hh < 12) hh += 12;
      if (!pm && hh === 12) hh = 0;
    }
  }
  return Date.UTC(y, mo - 1, d, hh, mm, ss);
}

/** Convert arbitrary date strings to YYYY-MM-DD. Returns '' when the date can't be understood (never "today"). */
export function normalizeDate(dateStr: string): string {
  const ms = parseWallClock(dateStr);
  return ms === null ? '' : utcDateString(new Date(ms));
}

/** Extract HH:MM from a time or date-time string; '' if there is none. */
export function extractTime(timeStr: string): string {
  if (!/\d{1,2}:\d{2}/.test(timeStr || '')) return '';
  const ms = parseWallClock('2000-01-01', timeStr.replace(/^.*?(\d{1,2}:\d{2})/, '$1'));
  return ms === null ? '' : utcTimeString(new Date(ms));
}

/** Convert time to HH:MM (defaults to market open when absent). */
export function normalizeTime(timeStr: string): string {
  return extractTime(timeStr) || '09:30';
}

/** Parse a number the way brokers print it. Parentheses / leading minus = negative. */
export function cleanNum(val: string | number | undefined, fallback = 0): number {
  const n = parseLooseNumber(val);
  return n ? n.value : fallback;
}

// ---------------------------------------------------------------------------------------------------------------
// Asset class
// ---------------------------------------------------------------------------------------------------------------
const FUTURES_ROOTS = /^\/?(ES|NQ|YM|RTY|CL|NG|GC|SI|HG|ZB|ZN|ZF|ZC|ZS|ZW|6E|6B|6J|MES|MNQ|MYM|M2K|MCL|MGC)([FGHJKMNQUVXZ]\d{1,2})?$/;
const CCY = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK', 'MXN', 'ZAR', 'TRY', 'SGD', 'HKD', 'CNH']);
const CRYPTO_QUOTES = /(USDT|USDC|BUSD|FDUSD|TUSD|PERP)$/;
const CRYPTO_BASES = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK', 'MATIC', 'LTC', 'SHIB', 'PEPE', 'SUI', 'TON', 'TRX', 'ARB', 'OP', 'APT', 'NEAR', 'ATOM', 'UNI']);

/** Best-effort asset class from a ticker. Conservative: defaults to stocks. */
export function inferAssetClass(symbol: string): AssetClass {
  const s = symbol.toUpperCase().replace(/[\s_-]/g, '').replace(/\.P$/, ''); // .P = perpetual suffix
  if (/^[A-Z]{1,6}\d{6}[CP]\d{8}$/.test(s)) return 'options'; // OCC option symbol
  if (CRYPTO_QUOTES.test(s)) return 'crypto';
  const noSlash = s.replace('/', '');
  const base = noSlash.replace(/(USD|EUR)$/, '');
  if (base !== noSlash && CRYPTO_BASES.has(base)) return 'crypto';
  if (/^[A-Z]{6}$/.test(noSlash) && CCY.has(noSlash.slice(0, 3)) && CCY.has(noSlash.slice(3))) return 'forex';
  if (s.startsWith('/') || FUTURES_ROOTS.test(s)) return 'futures';
  return 'stocks';
}

// ---------------------------------------------------------------------------------------------------------------
// Execution-based formats (one row per FILL): ThinkorSwim, TradingView
// ---------------------------------------------------------------------------------------------------------------
function fillsToTrades(
  fills: Fill[],
  symbolFor: (s: string) => string,
  platformLabel: string,
  idPrefix: string,
  strategy: string,
  warnings: string[]
): Trade[] {
  const paired = pairFills(fills, { allowShort: true });
  if (paired.orphans.length) warnings.push(`${paired.orphans.length} closing execution(s) had no matching opening execution in this file and were skipped.`);
  const open = paired.trades.filter((t) => t.status === 'open').length;
  if (open) warnings.push(`${open} position(s) were still open at the end of the file and are imported as Open trades.`);
  return paired.trades.map((p) =>
    pairedToTrade(p, {
      symbol: symbolFor(p.symbol),
      assetClass: inferAssetClass(symbolFor(p.symbol)),
      timezone: 'utc', // wall-clock times: read as-is, never shifted
      idPrefix,
      strategy,
      marketSession: 'Market Open (NY)',
      notes: [`Imported from ${platformLabel} (${p.fillCount} execution${p.fillCount === 1 ? '' : 's'} paired into one trade).`, 'Stop/target were not in the file; add them to get R-multiples.'],
    })
  );
}

function rowGetter(row: Record<string, string>) {
  return (...names: string[]) => {
    for (const n of names) {
      const k = Object.keys(row).find((x) => x.toLowerCase() === n);
      if (k) return row[k];
    }
    return '';
  };
}

function thinkorswimTrades(rows: Record<string, string>[], strategy: string, warnings: string[]): Trade[] {
  const fills: Fill[] = [];
  let optionRows = 0, bad = 0;
  rows.forEach((r, i) => {
    const h = rowGetter(r);
    if (h('exp') || h('strike') || (h('spread') && h('spread').toUpperCase() !== 'STOCK')) { optionRows++; return; }
    const t = parseWallClock(h('exec time'));
    const side = /sell/i.test(h('side')) ? 'sell' : /buy/i.test(h('side')) ? 'buy' : null;
    const qty = Math.abs(cleanNum(h('qty')));
    const price = cleanNum(h('price') || h('net price'));
    const symbol = h('symbol').toUpperCase();
    if (t === null || !side || !(qty > 0) || !(price > 0) || !symbol) { bad++; return; }
    fills.push({ time: t, symbol, side, qty, price, fee: 0, seq: i });
  });
  if (optionRows) warnings.push(`${optionRows} option/spread row(s) were skipped (option P&L needs the 100× multiplier; add those manually).`);
  if (bad) warnings.push(`${bad} row(s) skipped: unreadable date, side, quantity or price.`);
  return fillsToTrades(fills, (s) => s, 'ThinkorSwim', 'tos', strategy, warnings);
}

function tradingViewTrades(rows: Record<string, string>[], strategy: string, warnings: string[]): Trade[] {
  const fills: Fill[] = [];
  let bad = 0;
  rows.forEach((r, i) => {
    const get = (...names: string[]) => {
      for (const n of names) {
        const k = Object.keys(r).find((x) => x.toLowerCase() === n) || Object.keys(r).find((x) => x.toLowerCase().includes(n));
        if (k) return r[k];
      }
      return '';
    };
    const type = get('type').toLowerCase();
    const isEntry = /entry/.test(type);
    const isExit = /exit|close/.test(type);
    const isLong = /long/.test(type), isShort = /short/.test(type);
    const t = parseWallClock(get('date/time', 'date'));
    const qty = Math.abs(cleanNum(get('contracts', 'qty', 'size')));
    const price = cleanNum(get('price'));
    if (t === null || !(isEntry || isExit) || !(isLong || isShort) || !(qty > 0) || !(price > 0)) { bad++; return; }
    const side: 'buy' | 'sell' = isEntry ? (isLong ? 'buy' : 'sell') : isLong ? 'sell' : 'buy';
    const profit = parseLooseNumber(get('profit'));
    fills.push({ time: t, symbol: 'TVSTRAT', side, qty, price, fee: 0, realized: isExit ? (profit ? profit.value : undefined) : 0, seq: i });
  });
  if (bad) warnings.push(`${bad} row(s) skipped: not a recognizable entry/exit row.`);
  warnings.push('TradingView strategy exports contain no symbol: trades are labelled TVSTRAT. Edit the symbol after importing.');
  return fillsToTrades(fills, () => 'TVSTRAT', 'TradingView', 'tv', strategy, warnings);
}

// ---------------------------------------------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------------------------------------------
export function parseBrokerCsv(
  csvText: string,
  existingTrades: Trade[],
  customMapping?: Partial<ColumnMapping>,
  options: ParseOptions = {}
): ParsedCsvResult {
  const { headers, rows } = parseRawCsvText(csvText);
  const empty = (error: string, platform: DetectedPlatform = 'unknown'): ParsedCsvResult => ({
    detectedPlatform: platform, headers, rawRows: rows, trades: [], warnings: [], duplicatesCount: 0, error,
  });

  if (headers.length === 0 || rows.length === 0) {
    return empty('This file has no data rows. Make sure it is a CSV with a header line followed by at least one trade.');
  }

  const platform = detectBrokerPlatform(headers);
  const isDup = buildDuplicateChecker(existingTrades);
  const finish = (res: ParsedCsvResult): ParsedCsvResult => ({
    ...res,
    duplicatesCount: res.trades.filter((t) => isDup(t)).length,
  });

  // ---- Binance --------------------------------------------------------------------------------------------------
  if (platform === 'binance') {
    const bn = parseBinanceExport(csvText, { timezone: options.binanceTimezone, strategy: options.strategy });
    return finish({
      detectedPlatform: 'binance',
      formatLabel: bn.formatLabel,
      headers,
      rawRows: rows,
      trades: bn.trades,
      warnings: bn.warnings,
      duplicatesCount: 0,
      error: bn.error,
      binance: bn,
    });
  }

  const warnings: string[] = [];
  const strategyDefault = options.strategy || 'Imported Execution';
  const customized = !!(customMapping && Object.values(customMapping).some(Boolean));

  // ---- Execution formats (one row per fill) ------------------------------------------------------------------
  if (platform === 'thinkorswim' && !customized) {
    const trades = thinkorswimTrades(rows, strategyDefault, warnings);
    return finish({
      detectedPlatform: platform, formatLabel: 'ThinkorSwim: executions paired into trades',
      headers, rawRows: rows, trades, warnings, duplicatesCount: 0,
      error: trades.length === 0 ? 'No complete stock trades could be built from this file.' : undefined,
    });
  }
  if (platform === 'tradingview' && !customized) {
    const trades = tradingViewTrades(rows, strategyDefault, warnings);
    return finish({
      detectedPlatform: platform, formatLabel: 'TradingView: strategy tester trades',
      headers, rawRows: rows, trades, warnings, duplicatesCount: 0,
      error: trades.length === 0 ? 'No complete trades could be built from this file.' : undefined,
    });
  }

  // ---- Row-per-trade formats (generic, IBKR, MetaTrader, NinjaTrader, ...) ------------------------------------
  // Exact header match wins over "contains" so e.g. "Price" is not confused with "Net Price" / "Order Price".
  const findCol = (candidates: string[]): string | undefined => {
    const lowerHeaders = headers.map((h) => h.toLowerCase());
    for (const cand of candidates) {
      const i = lowerHeaders.indexOf(cand.toLowerCase());
      if (i >= 0) return headers[i];
    }
    for (const cand of candidates) {
      const i = lowerHeaders.findIndex((h) => h.includes(cand.toLowerCase()));
      if (i >= 0) return headers[i];
    }
    return undefined;
  };

  const colDate = customMapping?.dateCol || findCol(['date', 'exit date', 'open time', 'exec time', 'entry time', 'time']);
  const colTime = customMapping?.timeCol || findCol(['time', 'exec time', 'open time']);
  const colSymbol = customMapping?.symbolCol || findCol(['symbol', 'ticker', 'instrument', 'item', 'contract']);
  const colDirection = customMapping?.directionCol || findCol(['direction', 'side', 'market pos.', 'action', 'type']);
  const colEntryPrice = customMapping?.entryPriceCol || findCol(['entryprice', 'entry price', 'open price', 't. price', 'price', 'exec price']);
  const colExitPrice = customMapping?.exitPriceCol || findCol(['exitprice', 'exit price', 'close price', 'c. price']);
  const colQuantity = customMapping?.quantityCol || findCol(['quantity', 'qty', 'contracts', 'shares', 'size']);
  const colPnl = customMapping?.netPnlCol || findCol(['netpnl', 'realized p/l', 'net p/l', 'profit', 'pnl', 'p/l']);
  const colFees = customMapping?.feesCol || findCol(['fees', 'comm/fee', 'commission', 'comm']);
  const colStrategy = customMapping?.strategyCol || findCol(['strategy', 'setup', 'system']);
  const colNotes = customMapping?.notesCol || findCol(['notes', 'comment', 'description']);

  const missing: string[] = [];
  if (!colSymbol) missing.push('Symbol');
  if (!colDate) missing.push('Date');
  if (!colEntryPrice) missing.push('Entry price');
  if (!colQuantity) missing.push('Quantity');
  if (missing.length > 0) {
    return empty(
      `Couldn't find these columns: ${missing.join(', ')}. Click "Adjust Columns" and pick them from your file's headers (${headers.slice(0, 8).join(', ')}${headers.length > 8 ? ', …' : ''}).`,
      platform
    );
  }

  const skipReasons = new Map<string, number>();
  const skip = (why: string) => skipReasons.set(why, (skipReasons.get(why) || 0) + 1);
  const trades: Trade[] = [];
  const batch = Date.now().toString(36);

  rows.forEach((row, idx) => {
    const rawSymbol = (row[colSymbol!] || '').trim();
    if (!rawSymbol || /^(TOTAL|SUMMARY|DEPOSIT|WITHDRAWAL|BALANCE)\b/i.test(rawSymbol)) { skip('summary / blank row'); return; }
    const symbol = rawSymbol.toUpperCase().replace(/[^A-Z0-9/.\-]/g, '');
    if (!symbol || /^\d{4}[-/]?\d{2}[-/]?\d{2}/.test(symbol)) { skip('no ticker in the symbol column'); return; }

    const rawDate = row[colDate!] || '';
    const rawTime = colTime && colTime !== colDate ? row[colTime] || '' : '';
    const stamp = parseWallClock(rawDate, rawTime);
    if (stamp === null) { skip('unreadable date'); return; }
    const date = utcDateString(new Date(stamp));
    const time = extractTime(`${rawDate} ${rawTime}`) || '09:30';

    let direction: TradeDirection = 'long';
    if (colDirection && row[colDirection]) {
      if (/short|sell|^s$/i.test(row[colDirection])) direction = 'short';
    }

    const entryPrice = cleanNum(row[colEntryPrice!], NaN);
    const quantity = Math.abs(cleanNum(row[colQuantity!], NaN));
    if (!(entryPrice > 0)) { skip('missing entry price'); return; }
    if (!(quantity > 0)) { skip('missing quantity'); return; }

    const fees = Math.abs(cleanNum(colFees ? row[colFees] : 0));
    const hasPnl = !!(colPnl && row[colPnl] !== undefined && row[colPnl] !== '');
    const mult = direction === 'long' ? 1 : -1;
    const exitRaw = colExitPrice ? cleanNum(row[colExitPrice], NaN) : NaN;

    let netPnl: number;
    let exitPrice: number;
    if (hasPnl) {
      netPnl = cleanNum(row[colPnl!]);
      // No exit column (or unusable): back it out of the P&L so the numbers stay internally consistent
      exitPrice = exitRaw > 0 ? exitRaw : entryPrice + ((netPnl + fees) / quantity) * mult;
    } else if (exitRaw > 0) {
      exitPrice = exitRaw;
      netPnl = (exitPrice - entryPrice) * quantity * mult - fees;
    } else {
      skip('no P&L and no exit price'); return;
    }
    if (!(exitPrice > 0)) exitPrice = entryPrice;

    const outcome: TradeOutcome = netPnl > 0.001 ? 'win' : netPnl < -0.001 ? 'loss' : 'breakeven';
    const invested = entryPrice * quantity;
    const platformName = platform === 'unknown' ? 'CSV' : platform.toUpperCase();

    trades.push({
      id: `imp-${batch}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      date,
      time,
      exitDate: date,
      exitTime: time,
      symbol,
      assetClass: inferAssetClass(symbol),
      direction,
      status: 'closed',
      outcome,
      entryPrice,
      exitPrice,
      quantity,
      // Not in a statement: record "none" instead of inventing a plan (keeps R-multiple stats honest)
      stopLoss: entryPrice,
      takeProfit: entryPrice,
      fees,
      grossPnl: Number((netPnl + fees).toFixed(2)),
      netPnl: Number(netPnl.toFixed(2)),
      roi: invested > 0 ? Number(((netPnl / invested) * 100).toFixed(2)) : 0,
      plannedRR: 0,
      realizedRR: 0,
      strategy: (colStrategy && row[colStrategy]) || strategyDefault,
      rating: 3,
      emotion: 'Disciplined',
      notes: (colNotes && row[colNotes]) || `Imported from ${platformName} statement.`,
      marketSession: 'Market Open (NY)',
    });
  });

  const skipped = [...skipReasons.values()].reduce((a, b) => a + b, 0);
  if (skipped > 0) {
    warnings.push(`Skipped ${skipped} row${skipped === 1 ? '' : 's'}: ${[...skipReasons.entries()].map(([w, n]) => `${n}× ${w}`).join(', ')}.`);
  }

  return finish({
    detectedPlatform: platform,
    headers,
    rawRows: rows,
    trades,
    warnings,
    duplicatesCount: 0,
    error: trades.length === 0
      ? 'No trades could be read from this file. Check the column mapping ("Adjust Columns") or that the file contains closed trades with a price and quantity.'
      : undefined,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Sample files
// ---------------------------------------------------------------------------------------------------------------
export type SampleBroker = 'generic' | 'tos' | 'ibkr' | 'tradingview' | 'binance_spot' | 'binance_futures';

export function getSampleCsv(broker: SampleBroker): string {
  if (broker === 'generic') {
    return `Date,Time,Symbol,AssetClass,Direction,EntryPrice,ExitPrice,Quantity,Fees,NetPnL,Strategy,Notes
2026-10-24,09:35,NVDA,stocks,long,138.50,143.20,100,1.50,468.50,Breakout & Retest,Clean daily breakout over 138 key level
2026-10-24,10:15,TSLA,stocks,short,248.00,242.50,75,1.25,411.25,VWAP Reversal,Rejected 250 psychological resistance
2026-10-25,09:40,AAPL,stocks,long,228.00,225.50,120,2.00,-302.00,Opening Range Breakout,Failed expansion stopped out at plan
2026-10-26,11:00,QQQ,options,long,488.20,492.80,50,2.50,227.50,Trend Continuation,Strong tech bid into power hour
2026-10-27,09:50,AMD,stocks,long,154.00,158.40,90,1.80,394.20,Liquidity Sweep,Swept pre-market low and reclaimed`;
  }

  if (broker === 'tos') {
    return `Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type
10/24/26 09:35:12,STOCK,BUY,100,TO OPEN,NVDA,,,STOCK,138.50,138.50,LMT
10/24/26 10:12:45,STOCK,SELL,100,TO CLOSE,NVDA,,,STOCK,143.20,143.20,LMT
10/25/26 09:40:02,STOCK,BUY,120,TO OPEN,AAPL,,,STOCK,228.00,228.00,MKT
10/25/26 10:05:19,STOCK,SELL,120,TO CLOSE,AAPL,,,STOCK,225.50,225.50,STP`;
  }

  if (broker === 'ibkr') {
    // Date/Time is quoted like real IBKR exports (it contains a comma)
    return `DataDiscriminator,Asset Class,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Realized P/L
Order,STK,USD,MSFT,"2026-10-24, 09:30:00",50,420.00,428.50,-21000.00,1.00,424.00
Order,STK,USD,AMZN,"2026-10-25, 10:15:22",80,185.00,182.25,-14800.00,1.20,-221.20
Order,STK,USD,META,"2026-10-26, 09:45:10",40,580.00,594.00,-23200.00,1.00,559.00`;
  }

  if (broker === 'binance_spot') {
    return `Date(UTC),Pair,Side,Price,Executed,Amount,Fee
2026-11-02 15:40:31,BTCUSDT,SELL,62000.00,0.00999000BTC,619.38000000USDT,0.61938000USDT
2026-11-02 09:10:05,BTCUSDT,BUY,60000.00,0.00600000BTC,360.00000000USDT,0.00000600BTC
2026-11-02 09:10:05,BTCUSDT,BUY,60000.00,0.00400000BTC,240.00000000USDT,0.00000400BTC
2026-11-03 16:30:44,ETHUSDT,SELL,3180.00,0.99900000ETH,3176.82000000USDT,3.17682000USDT
2026-11-03 10:00:00,ETHUSDT,BUY,3000.00,1.00000000ETH,3000.00000000USDT,0.00100000ETH`;
  }

  if (broker === 'binance_futures') {
    return `Date(UTC),Symbol,Side,Price,Quantity,Amount,Fee,Realized Profit
2026-11-02 14:00:45,BTCUSDT,SELL,61000.0,0.1,6100.0,3.05000000 USDT,90.00000000 USDT
2026-11-02 10:30:12,BTCUSDT,BUY,60200.0,0.05,3010.0,1.50500000 USDT,0
2026-11-02 10:00:00,BTCUSDT,BUY,60000.0,0.05,3000.0,1.50000000 USDT,0
2026-11-03 11:30:00,ETHUSDT,BUY,2950.0,1.0,2950.0,1.47500000 USDT,50.00000000 USDT
2026-11-03 09:00:00,ETHUSDT,SELL,3000.0,1.0,3000.0,1.50000000 USDT,0`;
  }

  return `Trade #,Type,Signal,Date/Time,Price,Contracts,Profit,Cum. Profit
1,Entry Long,Buy,2026-10-24 09:30,138.50,100,,
1,Exit Long,Sell,2026-10-24 10:15,143.20,100,470.00,470.00
2,Entry Long,Buy,2026-10-25 09:40,228.00,120,,
2,Exit Long,Sell,2026-10-25 10:05,225.50,120,-300.00,170.00`;
}
