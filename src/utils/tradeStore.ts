import { Trade } from '../types/trade';

/**
 * Local persistence for trades.
 *
 * - Every change is written here immediately, so a refresh always shows the latest state,
 *   even for guests (no account) or when the cloud is unreachable.
 * - `unsynced` = trade ids whose cloud save has not been confirmed yet (re-pushed on next load).
 * - `deleted`  = trade ids whose cloud delete has not been confirmed yet (hidden + retried on next load).
 */

const tradesKey = (userKey: string) => `tradepulse_trades_v1_${userKey}`;
const pendingKey = (userKey: string) => `tradepulse_trades_pending_v1_${userKey}`;

interface PendingState {
  unsynced: string[];
  deleted: string[];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Could not write to localStorage:', err);
  }
}

export function loadCachedTrades(userKey: string): Trade[] {
  const data = readJson<unknown>(tradesKey(userKey), []);
  return Array.isArray(data) ? (data as Trade[]) : [];
}

export function saveCachedTrades(userKey: string, trades: Trade[]) {
  writeJson(tradesKey(userKey), trades);
}

function readPending(userKey: string): PendingState {
  const p = readJson<Partial<PendingState>>(pendingKey(userKey), {});
  return {
    unsynced: Array.isArray(p.unsynced) ? p.unsynced : [],
    deleted: Array.isArray(p.deleted) ? p.deleted : [],
  };
}

export function getPending(userKey: string): { unsynced: Set<string>; deleted: Set<string> } {
  const p = readPending(userKey);
  return { unsynced: new Set(p.unsynced), deleted: new Set(p.deleted) };
}

export function markUnsynced(userKey: string, ids: string[]) {
  const p = readPending(userKey);
  const unsynced = new Set(p.unsynced);
  const deleted = new Set(p.deleted);
  ids.forEach((id) => {
    unsynced.add(id);
    deleted.delete(id); // re-saving a trade cancels a pending delete
  });
  writeJson(pendingKey(userKey), { unsynced: [...unsynced], deleted: [...deleted] });
}

export function markSynced(userKey: string, ids: string[]) {
  const p = readPending(userKey);
  const drop = new Set(ids);
  writeJson(pendingKey(userKey), {
    unsynced: p.unsynced.filter((id) => !drop.has(id)),
    deleted: p.deleted,
  });
}

export function markDeleted(userKey: string, ids: string[]) {
  const p = readPending(userKey);
  const unsynced = new Set(p.unsynced);
  const deleted = new Set(p.deleted);
  ids.forEach((id) => {
    deleted.add(id);
    unsynced.delete(id);
  });
  writeJson(pendingKey(userKey), { unsynced: [...unsynced], deleted: [...deleted] });
}

export function clearDeleted(userKey: string, ids: string[]) {
  const p = readPending(userKey);
  const drop = new Set(ids);
  writeJson(pendingKey(userKey), {
    unsynced: p.unsynced,
    deleted: p.deleted.filter((id) => !drop.has(id)),
  });
}

/** Unique id for a new / cloned trade. */
export function newTradeId(): string {
  return `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** True when this user/guest has ever had a trade cache written (even an empty one). */
export function hasCachedTrades(userKey: string): boolean {
  try {
    return localStorage.getItem(tradesKey(userKey)) !== null;
  } catch {
    return false;
  }
}
