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

## UI redesign: "Slate & Indigo"
Look:     src/index.css (new design tokens + Geist / Geist Mono fonts), index.html, vite.config.ts, src/hooks/useTheme.ts
Nav:      src/components/Navbar.tsx - one slim bar, 7 tabs grouped into Dashboard / Journal / Insights / Tools dropdowns;
          balance chip, Log Trade, theme, account, and a "More" menu (demo data / clear trades). Mobile uses a slide-down menu.
Layout:   src/App.tsx + MarketPulseBar (container widened to 1440px), src/components/Dashboard.tsx (grid layout, nav-duplicate buttons removed),
          EquityChart.tsx (chart fills its card), DisciplineLeakCard.tsx (container queries)
Polish:   UserMenu, PWAInstallButton, ThemeToggle (unified 36px controls); StrategyPlaybook / SocialTradeCardModal / MarketNewsView / MarketPulseBar (old brown colors replaced)
No database or API changes.
