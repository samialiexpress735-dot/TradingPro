# TradePulse – updates

Unzip over the repo root (same folder structure).

## Fix: "The news API is not available on this deployment"
New:      api/news/feed.ts   (Vercel serverless function for GET /api/news/feed)
Changed:  server.ts          (now reuses api/news/feed.ts instead of its own copy)
Changed:  vercel.json        (/api/* is no longer rewritten to index.html)
After deploying, open https://YOUR-SITE/api/news/feed - it should return JSON.

## Earlier changes
Changed:  src/App.tsx, src/lib/supabase.ts, src/components/TradeJournal.tsx, src/components/Navbar.tsx
New:      src/utils/tradeStore.ts, src/components/ConfirmDialog.tsx, src/components/Toast.tsx, src/hooks/useNewsBadge.ts

No database changes are needed.
