import { Trade, AssetClass, TradeDirection, TradeOutcome, EmotionalState, TradeMistake } from '../types/trade';
import { classifyOutcome } from './calculations';

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

export interface ParsedCsvResult {
  detectedPlatform: 'generic' | 'thinkorswim' | 'ibkr' | 'tradingview' | 'metatrader' | 'ninjatrader' | 'unknown';
  headers: string[];
  rawRows: Record<string, string>[];
  trades: Trade[];
  warnings: string[];
  duplicatesCount: number;
}

// Parses raw CSV text respecting quotes and commas
export function parseRawCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  // Helper to split a CSV line respecting quotes
  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Find the header line (first line that has recognizable words)
  let headerIndex = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const rawCols = splitLine(lines[i]);
    const cleanLower = rawCols.map((c) => c.toLowerCase());
    if (
      cleanLower.some((c) =>
        ['symbol', 'ticker', 'instrument', 'item', 'date', 'exec time', 'open time', 'price', 'entry price', 'p/l', 'profit', 'netpnl'].some(
          (k) => c.includes(k)
        )
      )
    ) {
      headerIndex = i;
      break;
    }
  }

  const rawHeaders = splitLine(lines[headerIndex]);
  const headers = rawHeaders.map((h, i) => h.replace(/^["']|["']$/g, '').trim() || `Column_${i + 1}`);

  const rows: Record<string, string>[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length === 0 || cols.every((c) => c === '')) continue;
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = (cols[idx] || '').replace(/^["']|["']$/g, '').trim();
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

// Auto-detect broker format based on headers
export function detectBrokerPlatform(headers: string[]): 'generic' | 'thinkorswim' | 'ibkr' | 'tradingview' | 'metatrader' | 'ninjatrader' | 'unknown' {
  const lower = headers.map((h) => h.toLowerCase());
  const has = (keyword: string) => lower.some((h) => h.includes(keyword.toLowerCase()));

  if (has('exec time') && has('spread') && has('pos effect')) return 'thinkorswim';
  if (has('datagroup') || (has('t. price') && has('realized p/l')) || has('datadiscriminator')) return 'ibkr';
  if (has('trade #') && (has('cum. profit') || has('run-up'))) return 'tradingview';
  if (has('ticket') && has('open time') && (has('s / l') || has('swap'))) return 'metatrader';
  if (has('market pos.') && has('entry time') && has('exit time')) return 'ninjatrader';
  if (has('symbol') && (has('netpnl') || has('entryprice') || has('direction'))) return 'generic';

  return 'unknown';
}

// Convert arbitrary date strings to YYYY-MM-DD
export function normalizeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const cleaned = dateStr.replace(/,/g, '').trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.substring(0, 10);
  }

  // MM/DD/YYYY or M/D/YYYY
  const mdyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (mdyMatch) {
    const month = mdyMatch[1].padStart(2, '0');
    const day = mdyMatch[2].padStart(2, '0');
    const year = mdyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // DD.MM.YYYY (MetaTrader format)
  const dmyMatch = cleaned.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (dmyMatch) {
    return `${dmyMatch[1]}-${dmyMatch[2]}-${dmyMatch[3]}`;
  }

  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

// Convert time to HH:MM
export function normalizeTime(timeStr: string): string {
  if (!timeStr) return '09:30';
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return '09:30';
}

// Clean number
export function cleanNum(val: string | number | undefined, fallback = 0): number {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const cleaned = String(val)
    .replace(/[$,()]/g, '')
    .trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return fallback;
  // If original had parentheses, it represents negative e.g. (150.00) => -150.00
  if (String(val).includes('(') && String(val).includes(')')) {
    return -Math.abs(num);
  }
  return num;
}

// Main parser with automatic or custom column mapping
export function parseBrokerCsv(
  csvText: string,
  existingTrades: Trade[],
  customMapping?: Partial<ColumnMapping>
): ParsedCsvResult {
  const { headers, rows } = parseRawCsvText(csvText);
  const platform = detectBrokerPlatform(headers);
  const warnings: string[] = [];
  const parsedTrades: Trade[] = [];

  // Helper for column search
  const findCol = (candidates: string[]): string | undefined => {
    for (const cand of candidates) {
      const match = headers.find((h) => h.toLowerCase() === cand.toLowerCase() || h.toLowerCase().includes(cand.toLowerCase()));
      if (match) return match;
    }
    return undefined;
  };

  const colDate = customMapping?.dateCol || findCol(['date', 'exit date', 'open time', 'exec time', 'time', 'entry time']) || headers[0];
  const colTime = customMapping?.timeCol || findCol(['time', 'exec time', 'open time']);
  const colSymbol = customMapping?.symbolCol || findCol(['symbol', 'ticker', 'instrument', 'item', 'contract']) || headers[1];
  const colDirection = customMapping?.directionCol || findCol(['direction', 'side', 'type', 'market pos.', 'action']);
  const colEntryPrice = customMapping?.entryPriceCol || findCol(['entryprice', 'entry price', 'open price', 't. price', 'price', 'exec price']);
  const colExitPrice = customMapping?.exitPriceCol || findCol(['exitprice', 'exit price', 'close price', 'c. price']);
  const colQuantity = customMapping?.quantityCol || findCol(['quantity', 'qty', 'contracts', 'shares', 'size', 'pos']);
  const colPnl = customMapping?.netPnlCol || findCol(['netpnl', 'profit', 'realized p/l', 'net p/l', 'pnl', 'p/l', 'proceeds']);
  const colFees = customMapping?.feesCol || findCol(['fees', 'comm/fee', 'commission', 'comm']);
  const colStrategy = customMapping?.strategyCol || findCol(['strategy', 'setup', 'system']);
  const colNotes = customMapping?.notesCol || findCol(['notes', 'comment', 'description']);

  rows.forEach((row, idx) => {
    const rawSymbol = row[colSymbol || ''] || 'TRADE';
    const cleanSymbol = rawSymbol.toUpperCase().replace(/[^A-Z0-9\/\-\.]/g, '') || `SYM${idx + 1}`;
    
    // Ignore summary or balance rows
    if (['TOTAL', 'SUMMARY', 'DEPOSIT', 'WITHDRAWAL', 'BALANCE'].some((k) => cleanSymbol.includes(k))) {
      return;
    }

    const rawDate = row[colDate || ''] || '';
    const date = normalizeDate(rawDate);
    const time = colTime && row[colTime] ? normalizeTime(row[colTime]) : '09:45';

    // Parse direction
    let direction: TradeDirection = 'long';
    if (colDirection && row[colDirection]) {
      const dirVal = row[colDirection].toLowerCase();
      if (dirVal.includes('short') || dirVal.includes('sell') || dirVal.startsWith('s')) {
        direction = 'short';
      }
    }

    const entryPrice = cleanNum(colEntryPrice ? row[colEntryPrice] : 100);
    const exitPrice = cleanNum(colExitPrice ? row[colExitPrice] : entryPrice);
    const quantity = Math.abs(cleanNum(colQuantity ? row[colQuantity] : 10));
    const fees = Math.abs(cleanNum(colFees ? row[colFees] : 0));

    let netPnl = 0;
    if (colPnl && row[colPnl] !== undefined && row[colPnl] !== '') {
      netPnl = cleanNum(row[colPnl]);
    } else if (exitPrice && entryPrice && quantity) {
      const mult = direction === 'long' ? 1 : -1;
      netPnl = (exitPrice - entryPrice) * quantity * mult - fees;
    }

    // Determine asset class heuristically
    let assetClass: AssetClass = 'stocks';
    if (cleanSymbol.includes('USD') || cleanSymbol.includes('EUR') || cleanSymbol.includes('GBP')) {
      assetClass = cleanSymbol.includes('BTC') || cleanSymbol.includes('ETH') ? 'crypto' : 'forex';
    } else if (cleanSymbol.startsWith('/') || cleanSymbol.includes('ES') || cleanSymbol.includes('NQ') || cleanSymbol.includes('CL')) {
      assetClass = 'futures';
    } else if (cleanSymbol.length > 8 && (cleanSymbol.includes('C') || cleanSymbol.includes('P'))) {
      assetClass = 'options';
    }

    // Previously anything within +/-$2 was forced to breakeven, which silently dropped small wins/losses
    const outcome: TradeOutcome = classifyOutcome(netPnl);

    const invested = entryPrice * quantity;
    const roi = invested > 0 ? Number(((netPnl / invested) * 100).toFixed(2)) : 0;

    const stopLoss = direction === 'long' ? Number((entryPrice * 0.98).toFixed(2)) : Number((entryPrice * 1.02).toFixed(2));
    const takeProfit = direction === 'long' ? Number((entryPrice * 1.04).toFixed(2)) : Number((entryPrice * 0.96).toFixed(2));

    const id = `imp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;

    parsedTrades.push({
      id,
      date,
      time,
      exitDate: date,
      exitTime: time,
      symbol: cleanSymbol,
      assetClass,
      direction,
      status: 'closed',
      outcome,
      entryPrice: entryPrice > 0 ? entryPrice : 100,
      exitPrice: exitPrice > 0 ? exitPrice : entryPrice,
      quantity: quantity > 0 ? quantity : 1,
      stopLoss,
      takeProfit,
      fees,
      grossPnl: Number((netPnl + fees).toFixed(2)),
      netPnl: Number(netPnl.toFixed(2)),
      roi,
      plannedRR: 2.0,
      realizedRR: outcome === 'win' ? 2.1 : outcome === 'loss' ? -1.0 : 0,
      strategy: (colStrategy && row[colStrategy]) || 'Imported Execution',
      rating: outcome === 'win' ? 4 : 3,
      emotion: 'Disciplined' as EmotionalState,
      mistake: outcome === 'loss' ? 'Followed Plan' : undefined,
      notes: (colNotes && row[colNotes]) || `Imported from ${platform.toUpperCase()} statement.`,
      marketSession: 'Market Open (NY)',
    });
  });

  // Duplicate detection against existing trades
  let duplicatesCount = 0;
  parsedTrades.forEach((newTrade) => {
    const isDup = existingTrades.some(
      (ex) =>
        ex.date === newTrade.date &&
        ex.symbol.toUpperCase() === newTrade.symbol.toUpperCase() &&
        Math.abs(ex.entryPrice - newTrade.entryPrice) < 0.05 &&
        ex.direction === newTrade.direction
    );
    if (isDup) duplicatesCount++;
  });

  return {
    detectedPlatform: platform,
    headers,
    rawRows: rows,
    trades: parsedTrades,
    warnings,
    duplicatesCount,
  };
}

// Pre-built sample templates for testing immediately
export function getSampleCsv(broker: 'generic' | 'tos' | 'ibkr' | 'tradingview'): string {
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
    return `DataDiscriminator,Asset Class,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Realized P/L
Order,STK,USD,MSFT,2026-10-24, 09:30:00,50,420.00,428.50,-21000.00,1.00,424.00
Order,STK,USD,AMZN,2026-10-25, 10:15:22,80,185.00,182.25,-14800.00,1.20,-221.20
Order,STK,USD,META,2026-10-26, 09:45:10,40,580.00,594.00,-23200.00,1.00,559.00`;
  }

  return `Trade #,Type,Signal,Date/Time,Price,Contracts,Profit,Cum. Profit
1,Entry Long,Buy,2026-10-24 09:30,138.50,100,,
1,Exit Long,Sell,2026-10-24 10:15,143.20,100,470.00,470.00
2,Entry Long,Buy,2026-10-25 09:40,228.00,120,,
2,Exit Long,Sell,2026-10-25 10:05,225.50,120,-300.00,170.00`;
}
