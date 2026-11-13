import { Trade } from '../types/trade';
import { BinanceTimezone, parseBinanceExport } from './binanceCsv';
import { buildDuplicateChecker } from './tradeDedupe';

export interface BinanceParsedResult {
  trades: Trade[];
  duplicatesCount: number;
  totalParsed: number;
  formatDetected: 'binance_spot' | 'binance_futures' | 'generic_crypto' | 'unknown';
  /** Exact export type, e.g. "Binance Spot - Trade History". */
  formatLabel: string;
  warnings: string[];
  /** Set when the file can't be imported, with what to do about it. */
  error?: string;
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

/** Deterministic fingerprint of a trade (kept for backwards compatibility). */
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
 * Parses a Binance CSV export (Spot Trade/Order History, USDⓈ-M Futures Trade History).
 * Fills are paired into round-trip trades: see utils/binanceCsv.ts.
 */
export function parseBinanceCsv(
  csvContent: string,
  existingTrades: Trade[] = [],
  defaultStrategy: string = 'Binance Execution',
  timezone: BinanceTimezone = 'local'
): BinanceParsedResult {
  const res = parseBinanceExport(csvContent, { timezone, strategy: defaultStrategy });
  const isDup = buildDuplicateChecker(existingTrades);
  const fresh = res.trades.filter((t) => !isDup(t));

  return {
    trades: fresh,
    duplicatesCount: res.trades.length - fresh.length,
    totalParsed: res.trades.length,
    formatDetected: !res.recognized ? 'unknown' : res.market === 'futures' ? 'binance_futures' : res.market === 'spot' ? 'binance_spot' : 'unknown',
    formatLabel: res.formatLabel,
    warnings: res.warnings,
    error: res.error,
    summary: {
      totalVolumeUSDT: res.summary.totalVolume,
      totalCommissionUSDT: res.summary.totalFees,
      netRealizedPnL: res.summary.netPnl,
      pairs: res.summary.pairs,
    },
  };
}

/** Sample Binance Spot "Trade History" export (newest first, like the real file). */
export const SAMPLE_BINANCE_SPOT_CSV = `Date(UTC),Pair,Side,Price,Executed,Amount,Fee
2026-11-03 16:30:44,ETHUSDT,SELL,3180.00,0.99900000ETH,3176.82000000USDT,3.17682000USDT
2026-11-03 10:00:00,ETHUSDT,BUY,3000.00,1.00000000ETH,3000.00000000USDT,0.00100000ETH
2026-11-02 15:40:31,BTCUSDT,SELL,62000.00,0.00999000BTC,619.38000000USDT,0.61938000USDT
2026-11-02 09:10:05,BTCUSDT,BUY,60000.00,0.00600000BTC,360.00000000USDT,0.00000600BTC
2026-11-02 09:10:05,BTCUSDT,BUY,60000.00,0.00400000BTC,240.00000000USDT,0.00000400BTC
2026-11-01 20:45:10,PEPEUSDT,SELL,0.00001140,"49,950,000PEPE",569.43000000USDT,0.56943000USDT
2026-11-01 09:10:45,PEPEUSDT,BUY,0.00000985,"50,000,000PEPE",492.50000000USDT,"50,000PEPE"`;

/** Sample Binance USDⓈ-M Futures "Trade History" export (newest first). */
export const SAMPLE_BINANCE_FUTURES_CSV = `Date(UTC),Symbol,Side,Price,Quantity,Amount,Fee,Realized Profit
2026-11-03 11:30:00,ETHUSDT,BUY,2950.0,1.0,2950.0,1.47500000 USDT,50.00000000 USDT
2026-11-03 09:00:00,ETHUSDT,SELL,3000.0,1.0,3000.0,1.50000000 USDT,0
2026-11-02 14:00:45,BTCUSDT,SELL,61000.0,0.1,6100.0,3.05000000 USDT,90.00000000 USDT
2026-11-02 10:30:12,BTCUSDT,BUY,60200.0,0.05,3010.0,1.50500000 USDT,0
2026-11-02 10:00:00,BTCUSDT,BUY,60000.0,0.05,3000.0,1.50000000 USDT,0
2026-11-01 13:20:00,SOLUSDT,SELL,184.20,25,4605.0,2.30250000 USDT,-35.50000000 USDT`;
