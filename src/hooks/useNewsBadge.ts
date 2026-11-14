import { useEffect, useRef, useState, useCallback } from 'react';

const SEEN_KEY = 'tradepulse_news_seen_v1';
const POLL_MS = 60_000;
const MAX_SEEN = 400;

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    // keep only the most recent ids so the list cannot grow forever
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-MAX_SEEN)));
  } catch {}
}

/**
 * Number of headlines in the live news feed the user has not looked at yet.
 * - polls /api/news/feed in the background (paused while the browser tab is hidden)
 * - opening the Market News tab marks everything currently in the feed as read
 * - 0 when the feed is unavailable, so no badge is shown
 */
export function useNewsBadge(isNewsTabActive: boolean): number {
  const [unread, setUnread] = useState(0);
  const idsRef = useRef<string[]>([]);
  const seenRef = useRef<Set<string>>(loadSeen());
  const activeRef = useRef(isNewsTabActive);
  activeRef.current = isNewsTabActive;

  const markAllRead = useCallback(() => {
    idsRef.current.forEach((id) => seenRef.current.add(id));
    saveSeen(seenRef.current);
    setUnread(0);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/news/feed');
      if (!(res.headers.get('content-type') || '').includes('application/json')) return;
      const data = await res.json();
      if (!res.ok || data.success === false || !Array.isArray(data.catalysts)) return;
      idsRef.current = data.catalysts.map((c: { id: string }) => c.id).filter(Boolean);
      if (activeRef.current) {
        markAllRead();
      } else {
        setUnread(idsRef.current.filter((id) => !seenRef.current.has(id)).length);
      }
    } catch {
      // feed unreachable: keep the last count
    }
  }, [markAllRead]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Opening the news tab clears the badge
  useEffect(() => {
    if (isNewsTabActive) markAllRead();
  }, [isNewsTabActive, markAllRead]);

  return unread;
}
