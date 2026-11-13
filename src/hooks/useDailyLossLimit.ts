import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trade } from '../types/trade';

export type LossLimitType = 'dollar' | 'percent';
export type LossLimitStatus = 'off' | 'ok' | 'caution' | 'warning' | 'breached';

interface StoredLimit {
  type: LossLimitType;
  value: number;
}

export interface DailyLossLimitState {
  /** Local calendar day being tracked, YYYY-MM-DD */
  todayKey: string;
  limitType: LossLimitType;
  limitValue: number;
  /** Limit in dollars for today (0 when no limit is set) */
  limitAmount: number;
  /** Net realized P&L of trades closed today */
  todayPnl: number;
  /** Loss so far today as a positive number (0 when today is flat or green) */
  lossToday: number;
  remaining: number;
  usedPct: number;
  status: LossLimitStatus;
  setLimit: (type: LossLimitType, value: number) => void;
  clearLimit: () => void;
}

const storageKey = (userId?: string) => `tradepulse.dailyLossLimit.${userId || 'guest'}`;

function readStored(userId?: string): StoredLimit {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        (parsed.type === 'dollar' || parsed.type === 'percent') &&
        typeof parsed.value === 'number' &&
        parsed.value >= 0
      ) {
        return { type: parsed.type, value: parsed.value };
      }
    }
  } catch {
    // storage unavailable or corrupted: fall through to default
  }
  return { type: 'dollar', value: 0 };
}

export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Tracks today's realized loss against a user-defined daily loss limit.
 * `accountBalance` is the current balance including today's P&L; for percent
 * limits the percentage is applied to the balance at the start of the day so the
 * limit does not shrink as losses accumulate.
 */
export function useDailyLossLimit(
  trades: Trade[],
  accountBalance: number,
  userId?: string
): DailyLossLimitState {
  const [stored, setStored] = useState<StoredLimit>(() => readStored(userId));
  const [todayKey, setTodayKey] = useState<string>(() => localDateKey());

  // Reload the saved limit when the signed-in user changes
  useEffect(() => {
    setStored(readStored(userId));
  }, [userId]);

  // Roll over to the new day without needing a page refresh
  useEffect(() => {
    const id = setInterval(() => {
      const next = localDateKey();
      setTodayKey((prev) => (prev === next ? prev : next));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const persist = useCallback(
    (next: StoredLimit) => {
      setStored(next);
      try {
        localStorage.setItem(storageKey(userId), JSON.stringify(next));
      } catch {
        // ignore storage errors; the limit still applies for this session
      }
    },
    [userId]
  );

  const setLimit = useCallback(
    (type: LossLimitType, value: number) => {
      const safe = Number.isFinite(value) && value > 0 ? value : 0;
      persist({ type, value: safe });
    },
    [persist]
  );

  const clearLimit = useCallback(() => {
    persist({ type: stored.type, value: 0 });
  }, [persist, stored.type]);

  const todayPnl = useMemo(
    () =>
      Number(
        trades
          .filter((t) => t.status === 'closed' && (t.exitDate || t.date) === todayKey)
          .reduce((sum, t) => sum + (t.netPnl || 0), 0)
          .toFixed(2)
      ),
    [trades, todayKey]
  );

  const startOfDayBalance = accountBalance - todayPnl;
  const limitAmount =
    stored.value <= 0
      ? 0
      : stored.type === 'dollar'
        ? stored.value
        : Number((Math.max(startOfDayBalance, 0) * (stored.value / 100)).toFixed(2));

  const lossToday = Math.max(0, -todayPnl);
  const usedPct = limitAmount > 0 ? (lossToday / limitAmount) * 100 : 0;
  const remaining = limitAmount > 0 ? Math.max(0, Number((limitAmount - lossToday).toFixed(2))) : 0;

  let status: LossLimitStatus = 'off';
  if (limitAmount > 0) {
    if (lossToday >= limitAmount) status = 'breached';
    else if (usedPct >= 80) status = 'warning';
    else if (usedPct >= 50) status = 'caution';
    else status = 'ok';
  }

  return {
    todayKey,
    limitType: stored.type,
    limitValue: stored.value,
    limitAmount,
    todayPnl,
    lossToday,
    remaining,
    usedPct,
    status,
    setLimit,
    clearLimit,
  };
}
