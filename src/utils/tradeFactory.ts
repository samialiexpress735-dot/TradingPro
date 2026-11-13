import { AssetClass, MarketSession, Trade } from '../types/trade';
import { PairedTrade } from './executionPairing';
import { localDateString, localTimeString, utcDateString, utcTimeString } from './dateHelpers';

export const roundSig = (x: number, sig = 12) => (x === 0 ? 0 : Number(x.toPrecision(sig)));

export interface PairedToTradeOptions {
  /** Final symbol to store (e.g. "BTCUSDT.P"). */
  symbol: string;
  assetClass: AssetClass;
  /** 'utc': format timestamps with UTC getters (also right for broker wall-clock times parsed as UTC). 'local': browser timezone. */
  timezone: 'utc' | 'local';
  idPrefix: string;
  strategy: string;
  marketSession?: MarketSession;
  /** Sentences appended to the notes. */
  notes: string[];
}

/**
 * Convert one paired round trip into a Trade, WITHOUT inventing journal data: stop/target are set to the entry price
 * ("none recorded" => 0R, 0 planned R:R) and no mistake tag is set. Stats that depend on the user's own tagging
 * therefore aren't polluted by imports.
 */
export function pairedToTrade(p: PairedTrade, o: PairedToTradeOptions): Trade {
  const fmtDate = (ms: number) => (o.timezone === 'utc' ? utcDateString(new Date(ms)) : localDateString(new Date(ms)));
  const fmtTime = (ms: number) => (o.timezone === 'utc' ? utcTimeString(new Date(ms)) : localTimeString(new Date(ms)));
  const isOpen = p.status === 'open';
  const entryMs = p.entryDerived ? p.closeTime : p.openTime;
  const net = isOpen ? 0 : p.netPnl;
  const outcome: Trade['outcome'] = isOpen ? 'open' : net > 0.001 ? 'win' : net < -0.001 ? 'loss' : 'breakeven';
  const entry = roundSig(p.entryPrice);
  const invested = p.entryPrice * p.quantity;

  return {
    id: `${o.idPrefix}-${p.symbol}-${Math.round(p.openTime / 1000)}-${Math.round(p.closeTime / 1000)}${p.partial ? '-p' : ''}${isOpen ? '-o' : ''}`,
    date: fmtDate(entryMs),
    time: fmtTime(entryMs),
    exitDate: isOpen ? undefined : fmtDate(p.closeTime),
    exitTime: isOpen ? undefined : fmtTime(p.closeTime),
    symbol: o.symbol,
    assetClass: o.assetClass,
    direction: p.direction,
    status: p.status,
    outcome,
    entryPrice: entry,
    exitPrice: isOpen ? entry : roundSig(p.exitPrice),
    quantity: roundSig(p.quantity, 10),
    stopLoss: entry,
    takeProfit: entry,
    fees: Number(p.fees.toFixed(6)),
    grossPnl: isOpen ? 0 : Number(p.grossPnl.toFixed(4)),
    netPnl: Number(net.toFixed(4)),
    roi: !isOpen && invested > 0 ? Number(((net / invested) * 100).toFixed(2)) : 0,
    plannedRR: 0,
    realizedRR: 0,
    strategy: o.strategy,
    rating: 3,
    emotion: 'Disciplined',
    notes: o.notes.join(' '),
    marketSession: o.marketSession,
  };
}
