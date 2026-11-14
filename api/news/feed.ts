/**
 * Live financial news feed (Google News + Cointelegraph RSS).
 *
 * One file, two homes:
 *  - Vercel serverless function:  GET /api/news/feed   (default export below)
 *  - Local Express server:        server.ts imports buildNewsFeedResponse() / warmNewsCache()
 *
 * Kept free of relative imports so Vercel can bundle it on its own.
 */

let cachedLiveNewsCatalysts: any[] = [];
let lastNewsFetchTimestamp = 0;
const NEWS_CACHE_TTL_MS = 45000; // 45s cache to ensure freshness and high performance

function unescapeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '--');
}

export function calculateRelativeTime(dateStr: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diffMs / (60 * 1000));
  if (mins < 1) return 'Just now';
  if (mins === 1) return '1m ago';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1h ago';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Stable short hash so the same headline keeps the same id between refreshes
// (the UI uses ids to detect "new" headlines and to keep cards expanded).
function stableHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export async function fetchRealTimeLiveNews(): Promise<any[]> {
  const feeds = [
    {
      url: 'https://news.google.com/rss/search?q=crypto+OR+bitcoin+OR+ethereum+OR+binance+when:2d&hl=en-US&gl=US&ceid=US:en',
      defaultCategory: 'crypto',
    },
    {
      url: 'https://news.google.com/rss/search?q=%22stock+market%22+OR+Nasdaq+OR+%22S%26P+500%22+OR+%22Wall+Street%22+when:2d&hl=en-US&gl=US&ceid=US:en',
      defaultCategory: 'equities',
    },
    {
      url: 'https://news.google.com/rss/search?q=%22Federal+Reserve%22+OR+inflation+OR+%22interest+rates%22+OR+CPI+when:3d&hl=en-US&gl=US&ceid=US:en',
      defaultCategory: 'macro',
    },
    {
      url: 'https://cointelegraph.com/rss',
      defaultCategory: 'crypto',
    },
  ];

  try {
    const feedResults = await Promise.allSettled(
      feeds.map((f) =>
        fetch(f.url, {
          signal: AbortSignal.timeout(4500),
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }).then((r) => r.text())
      )
    );

    const parsedArticles: any[] = [];
    const seenHeadlines = new Set<string>();

    feedResults.forEach((res, feedIdx) => {
      if (res.status !== 'fulfilled' || !res.value) return;
      const xml = res.value;
      const defaultCategory = feeds[feedIdx].defaultCategory;

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      let countFromFeed = 0;

      while ((match = itemRegex.exec(xml)) !== null && countFromFeed < 12) {
        const itemContent = match[1];
        const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(itemContent);
        const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/.exec(itemContent);
        const pubDateMatch = /<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/.exec(itemContent);
        const sourceMatch = /<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/.exec(itemContent);
        const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/.exec(itemContent);

        if (!titleMatch) continue;

        let rawTitle = unescapeHtmlEntities(titleMatch[1].trim());
        let sourceName = sourceMatch ? unescapeHtmlEntities(sourceMatch[1].trim()) : '';

        if (!sourceName && rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          sourceName = parts[parts.length - 1].trim();
          rawTitle = parts.slice(0, -1).join(' - ').trim();
        } else if (rawTitle.includes(' - ') && sourceName) {
          rawTitle = rawTitle.substring(0, rawTitle.lastIndexOf(' - ')).trim();
        }

        if (!sourceName) sourceName = defaultCategory === 'crypto' ? 'Crypto Wire' : 'Financial Markets Wire';

        // Filter out empty or placeholder/meta strings
        if (!rawTitle || rawTitle.includes('META_TITLE') || rawTitle.length < 15) continue;

        const normalizedHeadline = rawTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (seenHeadlines.has(normalizedHeadline)) continue;
        seenHeadlines.add(normalizedHeadline);

        const pubDateStr = pubDateMatch ? pubDateMatch[1].trim() : new Date().toUTCString();
        const articleDate = new Date(pubDateStr);
        const timestamp = isNaN(articleDate.getTime()) ? new Date().toISOString() : articleDate.toISOString();

        // Categorize
        const lower = rawTitle.toLowerCase();
        let category: 'crypto' | 'macro' | 'equities' | 'forex' = defaultCategory as any;
        // Whole-word matching only: substring matching wrongly tagged e.g. "whether" as ETH,
        // "said" as AI and "second" as SEC.
        if (/\b(bitcoin|btc|eth|ethereum|crypto|binance|solana|altcoin|blockchain|tokens?|stablecoins?|coindesk|cointelegraph)\b/.test(lower)) {
          category = 'crypto';
        } else if (/\b(fed|federal reserve|powell|inflation|cpi|ppi|interest rates?|rate (cuts?|hikes?)|gdp|central bank|treasury|yields?)\b/.test(lower)) {
          category = 'macro';
        } else if (/\b(dollar|dxy|eurusd|usdjpy|gbpusd|forex|currency|currencies)\b/.test(lower)) {
          category = 'forex';
        } else if (/\b(stocks?|nasdaq|s&p|dow|shares|earnings|ai|chips?|tech|wall street|nvidia|nvda|tesla|tsla|apple|aapl)\b/.test(lower)) {
          category = 'equities';
        }

        // Affected Symbols
        const symbols: string[] = [];
        if (/\b(bitcoin|btc)\b/.test(lower)) symbols.push('BTCUSDT.P');
        if (/\b(ethereum|eth)\b/.test(lower)) symbols.push('ETHUSDT.P');
        if (/\b(solana|sol)\b/.test(lower)) symbols.push('SOLUSDT.P');
        if (/\b(binance|bnb)\b/.test(lower)) symbols.push('BNBUSDT.P');
        if (/\b(nvidia|nvda|chips?|gpus?|semiconductors?)\b/.test(lower)) symbols.push('NVDA');
        if (/\b(tesla|tsla|evs?)\b/.test(lower)) symbols.push('TSLA');
        if (/\b(apple|aapl)\b/.test(lower)) symbols.push('AAPL');
        if (/\b(microsoft|msft)\b/.test(lower)) symbols.push('MSFT');
        if (/\bamd\b/.test(lower)) symbols.push('AMD');
        if (/\b(nasdaq|tech)\b/.test(lower)) symbols.push('QQQ');
        if (/\b(s&p|stock market|wall street)\b/.test(lower)) symbols.push('SPY');
        if (/\b(dollar|yields?|rates?|fed)\b/.test(lower)) symbols.push('DXY');
        if (/\b(euro|eur)\b/.test(lower)) symbols.push('EURUSD');

        if (symbols.length === 0) {
          if (category === 'crypto') symbols.push('BTCUSDT.P', 'ETHUSDT.P');
          else if (category === 'macro') symbols.push('SPY', 'QQQ', 'DXY');
          else if (category === 'forex') symbols.push('DXY', 'EURUSD');
          else symbols.push('SPY', 'QQQ', 'NVDA');
        }

        // Sentiment
        let sentiment: 'BULLISH' | 'BEARISH' | 'VOLATILE_CHOP' | 'NEUTRAL' = 'NEUTRAL';
        // Generic words like "high", "cut" and "support" were removed: "inflation stays high" and
        // "job cuts" are bearish, so they made the tag wrong as often as right.
        const isBullish = /\b(rall(y|ies|ied)|surg(e|es|ed)|soar(s|ed)?|jump(s|ed)?|gain(s|ed)?|bounc(e|es|ed)|climb(s|ed)?|bullish|rises?|risen|rose|record high|recover(y|s|ed)?|stabili[sz](e|es|ed))\b/.test(lower);
        const isBearish = /\b(plung(e|es|ed)|drop(s|ped)?|slump(s|ed)?|fall(s|en)?|fell|sink(s)?|sank|slid(e|es)|rout|bloodbath|crash(es|ed)?|sell-?off|fear|bearish|loss(es)?|hack(s|ed)?|lawsuit|probe|down|crackdown|panic|tumbl(e|es|ed))\b/.test(lower);
        const isVolatile = /\b(whipsaw(s|ed)?|paus(e|es|ed)|mixed|wobbl(e|es|ed)|volatile|volatility|uncertain(ty)?|swings?|divided?|rebound(s|ed)?|tensions?)\b/.test(lower);

        if (isBullish && !isBearish) sentiment = 'BULLISH';
        else if (isBearish && !isBullish) sentiment = 'BEARISH';
        else if (isVolatile || (isBullish && isBearish)) sentiment = 'VOLATILE_CHOP';
        else sentiment = 'NEUTRAL';

        // Impact level
        let impactLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
        if (/\b(hack(s|ed)?|crash(es|ed)?|plung(e|es|ed)|fed|federal reserve|inflation|cpi|rate (cuts?|hikes?)|rout|bloodbath|bans?|banned|sec|investigation)\b/.test(lower)) {
          impactLevel = 'HIGH';
        } else if (/\b(shares|earnings|meeting|analysts?|forecasts?|review)\b/.test(lower)) {
          impactLevel = 'LOW';
        }

        // Dynamic Tactical Advice & Actionable Trading Plan
        let recommendedAction = '';
        let stopLossGuidance = '';
        let bestSetup = '';
        let volatilityWarning = '';
        let tradingTakeaway = '';

        if (sentiment === 'BULLISH') {
          tradingTakeaway = `Headline from ${sourceName} reads bullish (keyword-based tag). If price confirms, dip buyers typically defend VWAP and nearby support.`;
          recommendedAction = `Look for long continuation setups on 5m/15m retests of structural support or VWAP. Avoid chasing extended green candles.`;
          stopLossGuidance = `Place stop loss strictly behind the session breakout anchor or lower 15-minute swing low.`;
          bestSetup = `Opening Range Breakout (ORB) retest or high-volume pullback to VWAP.`;
          volatilityWarning = `Monitor funding rates and open interest spikes; watch out for mean-reversion pullbacks at major daily resistance.`;
        } else if (sentiment === 'BEARISH') {
          tradingTakeaway = `Headline from ${sourceName} reads bearish (keyword-based tag). If price confirms, expect risk-off flows and weaker bounces.`;
          recommendedAction = `Protect open profits by tightening trailing stops. Avoid front-running knife catches until a clear bullish market structure shift (MSS) occurs.`;
          stopLossGuidance = `Keep stop loss tight above intraday lower-high rejections; do not widen stops during adverse volatility.`;
          bestSetup = `Bearish breakdown retest of broken support flipped into resistance, or fade of weak relief bounces.`;
          volatilityWarning = `Cascade liquidation and slippage risk elevated during active flush cycles. Cut position leverage.`;
        } else if (sentiment === 'VOLATILE_CHOP') {
          tradingTakeaway = `Headline from ${sourceName} signals mixed or uncertain conditions (keyword-based tag). Two-sided, choppy price action is possible.`;
          recommendedAction = `Reduce position sizing by 50% or wait on sidelines for directional resolution above or below the opening range.`;
          stopLossGuidance = `Widen stop loss beyond local swing extremes or wait for confirmation closes outside the chop zone.`;
          bestSetup = `Range-bound liquidity sweep fade: buy the false breakdown at range low, sell the false breakout at range high.`;
          volatilityWarning = `False breakouts and stop hunts are frequent in chop environments. Never chase breakouts without high relative volume (RVOL).`;
        } else {
          tradingTakeaway = `No clear directional signal in this ${sourceName} headline (keyword-based tag). Treat it as background context.`;
          recommendedAction = `Trade standard technical setups (Order Blocks, FVG, VWAP) adhering strictly to defined risk parameters.`;
          stopLossGuidance = `Standard 1% to 1.5% fixed trade risk stop loss.`;
          bestSetup = `Standard trend-following pullback entry on confirmed momentum.`;
          volatilityWarning = `Watch for unexpected breaking headlines into session close or killzone transitions.`;
        }

        let summaryText = '';
        if (descMatch && descMatch[1]) {
          summaryText = unescapeHtmlEntities(descMatch[1].replace(/<[^>]*>/g, '').trim());
          if (summaryText.length > 250) summaryText = summaryText.substring(0, 247) + '...';
        }
        if (!summaryText || summaryText.length < 20) {
          summaryText = `${sourceName} reports: ${rawTitle}.`;
        }

        parsedArticles.push({
          id: `live-${stableHash(normalizedHeadline)}`,
          headline: rawTitle,
          source: sourceName,
          link: linkMatch ? linkMatch[1].trim() : '',
          timestamp,
          timeAgo: calculateRelativeTime(timestamp),
          category,
          impactLevel,
          sentiment,
          affectedSymbols: symbols,
          summary: summaryText,
          tradingTakeaway,
          tacticalAdvice: {
            recommendedAction,
            stopLossGuidance,
            bestSetup,
            volatilityWarning,
          },
        });

        countFromFeed++;
      }
    });

    if (parsedArticles.length > 0) {
      // Sort newest first
      parsedArticles.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return parsedArticles;
    }
  } catch (err) {
    console.warn('Real-time live news fetch error, using resilient cache/backup:', err);
  }

  return [];
}

/** Builds the JSON response for GET /api/news/feed (shared by Express and Vercel). */
export async function buildNewsFeedResponse(
  categoryFilter?: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const now = Date.now();

  // Refresh live feed if cache is expired or empty
  if (now - lastNewsFetchTimestamp > NEWS_CACHE_TTL_MS || cachedLiveNewsCatalysts.length === 0) {
    const liveItems = await fetchRealTimeLiveNews();
    if (liveItems && liveItems.length > 0) {
      cachedLiveNewsCatalysts = liveItems;
      lastNewsFetchTimestamp = now;
    }
  }

  // Nothing cached and every source failed: say so instead of returning an empty "success"
  if (cachedLiveNewsCatalysts.length === 0) {
    return {
      status: 503,
      body: {
        success: false,
        feedStatus: 'UNAVAILABLE',
        error: 'News sources are unreachable right now. Please try again shortly.',
      },
    };
  }

  // Calculate fresh timeAgo for each item relative to current moment
  let catalystsToReturn = cachedLiveNewsCatalysts.map((c) => ({
    ...c,
    timeAgo: calculateRelativeTime(c.timestamp),
  }));

  if (categoryFilter && categoryFilter !== 'all') {
    catalystsToReturn = catalystsToReturn.filter((c) => c.category === categoryFilter);
  }

  return {
    status: 200,
    body: {
      success: true,
      // STALE when refreshes have been failing and we are serving an old cache
      feedStatus: now - lastNewsFetchTimestamp > 5 * 60 * 1000 ? 'STALE' : 'LIVE_STREAMING',
      source: 'google-news-rss-live',
      lastUpdated: new Date(lastNewsFetchTimestamp || now).toISOString(),
      pollIntervalMs: 30000,
      count: catalystsToReturn.length,
      catalysts: catalystsToReturn,
    },
  };
}

/** Pre-loads the cache when the long-running Express server starts. */
export async function warmNewsCache(): Promise<void> {
  const items = await fetchRealTimeLiveNews();
  if (items && items.length > 0) {
    cachedLiveNewsCatalysts = items;
    lastNewsFetchTimestamp = Date.now();
    console.log(`[NewsWire] Pre-warmed ${items.length} real-time live articles.`);
  }
}

/** Vercel serverless entry point. */
export default async function handler(req: any, res: any) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  try {
    const category = Array.isArray(req.query?.category) ? req.query.category[0] : req.query?.category;
    const { status, body } = await buildNewsFeedResponse(category);
    // Let Vercel's CDN share one fetch between all visitors for a short while
    if (status === 200) {
      res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=120');
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }
    return res.status(status).json(body);
  } catch (err) {
    console.error('[NewsWire] Feed error:', err);
    return res.status(500).json({ success: false, feedStatus: 'UNAVAILABLE', error: 'Could not load the news feed.' });
  }
}
