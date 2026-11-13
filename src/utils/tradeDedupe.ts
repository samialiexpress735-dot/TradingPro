import { Trade } from '../types/trade';

const symKey = (s: string) => (s || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');

const relClose = (a: number, b: number, tol: number) => {
  if (a === b) return true;
  const m = Math.max(Math.abs(a), Math.abs(b));
  return m > 0 && Math.abs(a - b) / m <= tol;
};

/**
 * Duplicate detection shared by every importer.
 *  - Same id => duplicate (Binance imports use deterministic ids, so re-importing a file is caught exactly,
 *    even if the timezone setting changed in between).
 *  - Otherwise: same symbol + day + direction, entry within 0.1% and quantity within 1%.
 *    Tolerances are RELATIVE: the old absolute `< 0.05` made every trade of a sub-cent coin (PEPE, SHIB)
 *    look like a duplicate of every other trade of that coin on the same day.
 */
export function buildDuplicateChecker(existing: Trade[]): (candidate: Trade) => boolean {
  const ids = new Set(existing.map((t) => t.id));
  const byKey = new Map<string, Trade[]>();
  for (const t of existing) {
    const k = `${symKey(t.symbol)}|${t.date}|${t.direction}`;
    const list = byKey.get(k);
    if (list) list.push(t); else byKey.set(k, [t]);
  }
  return (c: Trade) => {
    if (ids.has(c.id)) return true;
    const list = byKey.get(`${symKey(c.symbol)}|${c.date}|${c.direction}`);
    if (!list) return false;
    return list.some((t) => relClose(t.entryPrice, c.entryPrice, 0.001) && relClose(t.quantity, c.quantity, 0.01));
  };
}

export function isDuplicateTrade(existing: Trade[], candidate: Trade): boolean {
  return buildDuplicateChecker(existing)(candidate);
}
