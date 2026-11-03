import { Trade, AssetClass } from '../types/trade';

export interface BinanceParsedResult {
  trades: Trade[];
  duplicatesCount: number;
  totalParsed: number;
  formatDetected: 'binance_spot' | 'binance_futures' | 'generic_crypto' | 'unknown';
  summary: {
    totalVolumeUSDT: number;
    totalCommissionUSDT: number;
    netRealizedPnL: number;
    pairs: string[];
  };
}

/**
 * Normalizes trading pairs:
 * - For Futures: BTCUSDT.P, ETHUSDT.P
 * - For Spot: BTCUSDT, ETHUSDT
 */
export function normalizeCryptoPair(pairStr: string, isFutures: boolean = false): string {
  if (!pairStr) return isFutures ? 'BTCUSDT.P' : 'BTCUSDT';
  let clean = pairStr.trim().toUpperCase().replace(/[\s\-_/]/g, '');

  if (isFutures) {
    clean = clean.replace(/\.P$/i, '');
    return `${clean}.P`;
  }

  return clean.replace(/\.P$/i, '');
}

/**
 * Generate a deterministic fingerprint to detect duplicated imports
 */
export function getTradeFingerprint(trade: Partial<Trade>): string {
  const date = trade.date || '';
  const time = trade.time || '';
  const symbol = (trade.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const entry = Number(trade.entryPrice || 0).toFixed(6);
  const qty = Number(trade.quantity || 0).toFixed(8);
  const dir = trade.direction || 'long';
  return `${date}_${time}_${symbol}_${dir}_${entry}_${qty}`;
}

/**
 * Parses raw text from a Binance CSV export (Spot or USDT-M Futures)
 */
export function parseBinanceCsv(
  csvContent: string,
  existingTrades: Trade[] = [],
  defaultStrategy: string = 'Binance Execution'
): BinanceParsedResult {
  const existingFingerprints = new Set(existingTrades.map((t) => getTradeFingerprint(t)));

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      trades: [],
      duplicatesCount: 0,
      totalParsed: 0,
      formatDetected: 'unknown',
      summary: { totalVolumeUSDT: 0, totalCommissionUSDT: 0, netRealizedPnL: 0, pairs: [] },
    };
  }

  // Detect delimiter (comma, tab, or semicolon)
  const headerLine = lines[0];
  let delimiter = ',';
  if (headerLine.includes('\t')) delimiter = '\t';
  else if (headerLine.includes(';') && !headerLine.includes(',')) delimiter = ';';

  const rawHeaders = headerLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

  // Detect format
  const isSpot =
    (rawHeaders.includes('date(utc)') || rawHeaders.includes('utc_time') || rawHeaders.includes('date')) &&
    (rawHeaders.includes('market') || rawHeaders.includes('pair')) &&
    (rawHeaders.includes('type') || rawHeaders.includes('side'));

  const isFutures =
    (rawHeaders.includes('time(utc)') || rawHeaders.includes('time') || rawHeaders.includes('date(utc)')) &&
    (rawHeaders.includes('symbol') || rawHeaders.includes('contract')) &&
    (rawHeaders.includes('realized pnl') || rawHeaders.includes('realized profit') || rawHeaders.includes('commission'));

  const formatDetected = isFutures ? 'binance_futures' : isSpot ? 'binance_spot' : 'generic_crypto';

  const parsedTrades: Trade[] = [];
  let duplicatesCount = 0;
  let totalVolume = 0;
  let totalCommission = 0;
  let totalRealizedPnL = 0;
  const uniquePairs = new Set<string>();

  // Process rows
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map((val) => val.trim().replace(/^["']|["']$/g, ''));
    if (row.length < 4) continue;

    const rowObj: Record<string, string> = {};
    rawHeaders.forEach((h, idx) => {
      rowObj[h] = row[idx] || '';
    });

    let tradeDate = '';
    let tradeTime = '00:00';
    let symbol = 'BTC/USDT';
    let direction: 'long' | 'short' = 'long';
    let entryPrice = 0;
    let exitPrice = 0;
    let quantity = 0;
    let fees = 0;
    let netPnl = 0;
    let grossPnl = 0;
    let outcome: 'win' | 'loss' | 'breakeven' = 'breakeven';

    if (isFutures) {
      // Binance Futures Row
      const rawTime = rowObj['time(utc)'] || rowObj['time'] || rowObj['date(utc)'] || rowObj['created_at'] || '';
      const parts = rawTime.split(' ');
      tradeDate = parts[0] || new Date().toISOString().split('T')[0];
      tradeTime = parts[1] ? parts[1].substring(0, 5) : '12:00';

      const rawSym = rowObj['symbol'] || rowObj['contract'] || 'BTCUSDT';
      symbol = normalizeCryptoPair(rawSym, true);
      uniquePairs.add(symbol);

      const side = (rowObj['side'] || rowObj['direction'] || '').toLowerCase();
      direction = side.includes('buy') || side.includes('long') ? 'long' : 'short';

      entryPrice = parseFloat(rowObj['price'] || rowObj['avg price'] || '0') || 0;
      quantity = parseFloat(rowObj['executed qty'] || rowObj['amount'] || rowObj['quantity'] || '0') || 0;
      fees = Math.abs(parseFloat(rowObj['commission'] || rowObj['fee'] || '0')) || 0;
      
      const pnlRaw = parseFloat(rowObj['realized pnl'] || rowObj['realized profit'] || '0');
      if (!isNaN(pnlRaw) && pnlRaw !== 0) {
        netPnl = Number((pnlRaw - fees).toFixed(2));
        grossPnl = Number(pnlRaw.toFixed(2));
      } else {
        grossPnl = 0;
        netPnl = -fees;
      }

      exitPrice = entryPrice; // For futures contract executions
    } else {
      // Binance Spot Row
      const rawDate = rowObj['date(utc)'] || rowObj['utc_time'] || rowObj['date'] || '';
      const parts = rawDate.split(' ');
      tradeDate = parts[0] || new Date().toISOString().split('T')[0];
      tradeTime = parts[1] ? parts[1].substring(0, 5) : '09:30';

      const rawMarket = rowObj['market'] || rowObj['pair'] || rowObj['symbol'] || 'BTCUSDT';
      symbol = normalizeCryptoPair(rawMarket, false);
      uniquePairs.add(symbol);

      const type = (rowObj['type'] || rowObj['side'] || '').toLowerCase();
      direction = type.includes('buy') ? 'long' : 'short';

      entryPrice = parseFloat(rowObj['price'] || '0') || 0;
      quantity = parseFloat(rowObj['amount'] || rowObj['executed'] || rowObj['quantity'] || '0') || 0;
      fees = parseFloat(rowObj['fee'] || '0') || 0;

      // In spot, estimate exit or set current price
      exitPrice = entryPrice;
      grossPnl = 0;
      netPnl = Number((-fees).toFixed(2));
    }

    if (quantity <= 0 || entryPrice <= 0) continue;

    totalVolume += entryPrice * quantity;
    totalCommission += fees;
    totalRealizedPnL += netPnl;

    if (netPnl > 0.001) outcome = 'win';
    else if (netPnl < -0.001) outcome = 'loss';
    else outcome = 'breakeven';

    const candidateTrade: Trade = {
      id: `binance_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      date: tradeDate,
      time: tradeTime,
      symbol,
      assetClass: 'crypto' as AssetClass,
      direction,
      status: 'closed',
      outcome,
      entryPrice,
      exitPrice,
      quantity,
      stopLoss: Number((direction === 'long' ? entryPrice * 0.98 : entryPrice * 1.02).toFixed(6)),
      takeProfit: Number((direction === 'long' ? entryPrice * 1.05 : entryPrice * 0.95).toFixed(6)),
      fees: Number(fees.toFixed(4)),
      grossPnl,
      netPnl,
      roi: entryPrice * quantity > 0 ? Number(((netPnl / (entryPrice * quantity)) * 100).toFixed(2)) : 0,
      plannedRR: 2.5,
      realizedRR: outcome === 'win' ? 2.0 : outcome === 'loss' ? -1.0 : 0,
      strategy: defaultStrategy,
      rating: outcome === 'win' ? 5 : 3,
      emotion: 'Disciplined',
      mistake: outcome === 'loss' ? 'Followed Plan' : undefined,
      notes: `Imported via Binance ${isFutures ? 'USDT-M Futures' : 'Spot'} sync. Executed on ${tradeDate} at ${tradeTime}.`,
      marketSession: '24/7 Crypto',
    };

    const fingerprint = getTradeFingerprint(candidateTrade);
    if (existingFingerprints.has(fingerprint)) {
      duplicatesCount++;
    } else {
      existingFingerprints.add(fingerprint);
      parsedTrades.push(candidateTrade);
    }
  }

  // Sort by date descending (newest first)
  parsedTrades.sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return (b.time || '').localeCompare(a.time || '');
  });

  return {
    trades: parsedTrades,
    duplicatesCount,
    totalParsed: parsedTrades.length + duplicatesCount,
    formatDetected,
    summary: {
      totalVolumeUSDT: Number(totalVolume.toFixed(2)),
      totalCommissionUSDT: Number(totalCommission.toFixed(4)),
      netRealizedPnL: Number(totalRealizedPnL.toFixed(2)),
      pairs: Array.from(uniquePairs),
    },
  };
}

/**
 * Sample Binance Spot CSV data for instant user testing
 */
export const SAMPLE_BINANCE_SPOT_CSV = `Date(UTC),Market,Type,Price,Amount,Total,Fee,Fee Coin
2026-11-02 14:22:15,BTCUSDT,BUY,68450.50,0.02450000,1677.037,1.677,USDT
2026-11-02 16:45:00,BTCUSDT,SELL,69820.00,0.02450000,1710.590,1.710,USDT
2026-11-01 10:15:30,ETHUSDT,BUY,2485.20,0.50000000,1242.600,1.242,USDT
2026-11-01 18:30:12,ETHUSDT,SELL,2560.80,0.50000000,1280.400,1.280,USDT
2026-10-31 09:10:45,SOLUSDT,BUY,182.40,15.00000000,2736.000,2.736,USDT
2026-10-31 15:20:00,SOLUSDT,SELL,178.50,15.00000000,2677.500,2.677,USDT
2026-10-30 11:05:00,PEPEUSDT,BUY,0.00000985,50000000.00000000,492.500,0.492,USDT
2026-10-30 20:45:10,PEPEUSDT,SELL,0.00001140,50000000.00000000,570.000,0.570,USDT`;

/**
 * Sample Binance USDT-M Futures CSV data for instant testing
 */
export const SAMPLE_BINANCE_FUTURES_CSV = `Time(UTC),Symbol,Side,Price,Executed Qty,Realized PnL,Commission
2026-11-02 15:30:00,BTCUSDT,BUY,68200.00,0.05000000,145.20,1.364
2026-11-02 18:10:22,ETHUSDT,SELL,2520.40,1.25000000,-48.50,1.575
2026-11-01 12:40:15,SOLUSDT,BUY,184.20,25.00000000,210.80,2.302
2026-10-31 14:15:50,DOGEUSDT,BUY,0.15850,5000.00000000,65.40,0.792`;
