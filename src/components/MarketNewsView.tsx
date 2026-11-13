import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Radio,
  Flame,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Zap,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Info,
  Pause,
  Play,
  Bell,
} from 'lucide-react';
import { Trade } from '../types/trade';
import { NewsCatalyst } from '../data/marketCatalysts';

interface MarketNewsViewProps {
  trades: Trade[];
  onNavigateToTab: (tab: 'dashboard' | 'journal' | 'review' | 'calculator' | 'playbook' | 'analytics' | 'news') => void;
  onPreFillTradeSymbol?: (symbol: string) => void;
}

interface AnalysisResult {
  headline: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'VOLATILE_CHOP' | 'NEUTRAL';
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  impactScore: number;
  affectedAssets: string[];
  summary: string;
  marketMechanism: string;
  tradingTakeaway: string;
  tacticalAdvice: {
    recommendedAction: string;
    stopLossGuidance: string;
    bestSetup: string;
    volatilityWarning: string;
  };
  keyRisks: string[];
  source: string;
  analyzedAt: string;
}

export const MarketNewsView: React.FC<MarketNewsViewProps> = ({
  trades,
  onNavigateToTab,
}) => {
  const [catalysts, setCatalysts] = useState<NewsCatalyst[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'crypto' | 'macro' | 'equities' | 'forex'>('all');
  const [selectedImpact, setSelectedImpact] = useState<'all' | 'HIGH' | 'MEDIUM' | 'LOW'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Continuous Live Auto-Update Streaming State
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [secondsUntilNextPoll, setSecondsUntilNextPoll] = useState(30);
  const [isFetchingFeed, setIsFetchingFeed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('Live Connected');
  const [breakingNotice, setBreakingNotice] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);

  // Fetch live market feed from server
  const fetchLiveCatalysts = useCallback(async (isManual = false) => {
    setIsFetchingFeed(true);
    try {
      const res = await fetch('/api/news/feed');
      const contentType = res.headers.get('content-type') || '';
      // Static hosts (e.g. Vercel with only the Vite build) answer /api/* with index.html
      if (!contentType.includes('application/json')) {
        throw new Error('The news API is not available on this deployment (the Node server is not running).');
      }
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `News feed returned status ${res.status}`);
      }
      if (data.catalysts && Array.isArray(data.catalysts)) {
        setCatalysts((prev) => {
          // Check if top headline is new
          if (prev.length > 0 && data.catalysts.length > 0 && prev[0].id !== data.catalysts[0].id) {
            setBreakingNotice(data.catalysts[0].headline);
          }
          return data.catalysts;
        });
        const syncedAt = data.lastUpdated ? new Date(data.lastUpdated) : new Date();
        const timeStr = syncedAt.toISOString().substring(11, 19) + ' UTC';
        setLastUpdated(
          data.feedStatus === 'STALE' ? `Stale: sources unreachable, last synced ${timeStr}` : `Synced ${timeStr}`
        );
        setFeedError(null);
      }
    } catch (e: any) {
      console.warn('Could not refresh live news feed:', e);
      setFeedError(e?.message || 'Could not load the news feed.');
      setLastUpdated('Refresh failed');
    } finally {
      setIsFetchingFeed(false);
      setSecondsUntilNextPoll(30);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchLiveCatalysts();
  }, [fetchLiveCatalysts]);

  // Continuous 1-second interval countdown for live streaming
  useEffect(() => {
    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      setSecondsUntilNextPoll((prev) => {
        if (prev <= 1) {
          fetchLiveCatalysts();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLiveStreaming, fetchLiveCatalysts]);

  // AI Analyzer State
  const [customHeadline, setCustomHeadline] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analyzerError, setAnalyzerError] = useState<string | null>(null);

  // Extract symbols the trader has traded recently
  const traderSymbols = useMemo(() => {
    const symbolSet = new Set<string>();
    trades.forEach((t) => {
      if (t.symbol) symbolSet.add(t.symbol.toUpperCase());
    });
    return Array.from(symbolSet);
  }, [trades]);

  // Find catalysts matching user's active/recent trade symbols
  const matchingPortfolioAlerts = useMemo(() => {
    if (traderSymbols.length === 0) return [];
    return catalysts.filter((c) =>
      c.impactLevel === 'HIGH' &&
      c.affectedSymbols.some((sym) =>
        traderSymbols.some((ts) => sym.toUpperCase().includes(ts) || ts.includes(sym.toUpperCase()))
      )
    );
  }, [catalysts, traderSymbols]);

  // Filtered catalysts
  const filteredCatalysts = useMemo(() => {
    return catalysts.filter((c) => {
      if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
      if (selectedImpact !== 'all' && c.impactLevel !== selectedImpact) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesHeadline = c.headline.toLowerCase().includes(query);
        const matchesSummary = c.summary.toLowerCase().includes(query);
        const matchesSymbols = c.affectedSymbols.some((s) => s.toLowerCase().includes(query));
        if (!matchesHeadline && !matchesSummary && !matchesSymbols) return false;
      }
      return true;
    });
  }, [catalysts, selectedCategory, selectedImpact, searchQuery]);

  // Analyze Custom News
  const handleAnalyzeNews = async (headlineToAnalyze?: string) => {
    const textToAnalyze = headlineToAnalyze || customHeadline;
    if (!textToAnalyze.trim()) {
      setAnalyzerError('Please enter a headline or market news statement to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setAnalyzerError(null);

    try {
      const response = await fetch('/api/news/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: textToAnalyze.trim(),
          userSymbols: traderSymbols.slice(0, 5),
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.analysis) {
        setAnalysisResult(data.analysis);
      } else {
        throw new Error(data.error || 'Failed to analyze news impact.');
      }
    } catch (err: any) {
      console.error('Error analyzing news:', err);
      setAnalyzerError(err?.message || 'Failed to complete market analysis. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'BULLISH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-profit-bg text-profit border border-profit-line">
            <TrendingUp className="w-3.5 h-3.5" />
            Bullish Bias
          </span>
        );
      case 'BEARISH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-loss-bg text-loss border border-loss-line">
            <TrendingDown className="w-3.5 h-3.5" />
            Bearish Bias
          </span>
        );
      case 'VOLATILE_CHOP':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warn-bg-soft text-accent border border-warn-line">
            <Zap className="w-3.5 h-3.5" />
            High Volatility / Chop
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sunken text-brand border border-line-brand">
            Neutral / Consolidating
          </span>
        );
    }
  };

  const getImpactBadge = (level: string) => {
    switch (level) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-loss-solid text-white uppercase tracking-wider shadow-xs">
            <Flame className="w-3 h-3" />
            High Impact
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-accent text-white uppercase tracking-wider">
            Med Impact
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#8c7462] text-white uppercase tracking-wider">
            Low Impact
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-inverse via-inverse-2 to-inverse rounded-2xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-accent/15 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-medium text-amber-200">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Live Catalyst Intelligence &amp; Trading Impact
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#fdfbf9]">
              Market News &amp; Macro Catalysts
            </h1>
            <p className="text-sm text-[#d4c3b5] max-w-2xl leading-relaxed">
              Curated financial headlines, Binance perpetual futures announcements, and macro releases analyzed
              for directional bias, stop-loss risks, and high-probability execution setups.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 bg-white/5 border border-white/10 p-3 sm:p-4 rounded-xl backdrop-blur-sm self-start md:self-auto">
            <div className="text-center px-1">
              <div className="text-xl sm:text-2xl font-black text-amber-400">
                {catalysts.filter((c) => c.impactLevel === 'HIGH').length}
              </div>
              <div className="text-[10px] sm:text-xs text-[#b8a292] font-medium uppercase tracking-wider">
                High Impact
              </div>
            </div>
            <div className="text-center border-x border-white/10 px-2 sm:px-3">
              <div className="text-xl sm:text-2xl font-black text-emerald-400">
                {catalysts.filter((c) => c.sentiment === 'BULLISH').length}
              </div>
              <div className="text-[10px] sm:text-xs text-[#b8a292] font-medium uppercase tracking-wider">
                Bullish
              </div>
            </div>
            <div className="text-center px-1">
              <div className="text-xl sm:text-2xl font-black text-rose-400">
                {catalysts.filter((c) => c.sentiment === 'BEARISH').length}
              </div>
              <div className="text-[10px] sm:text-xs text-[#b8a292] font-medium uppercase tracking-wider">
                Bearish
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Continuous Live Radar & Auto-Update Control Ribbon */}
      <div className="bg-surface border border-line rounded-xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Streaming Status & Countdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isLiveStreaming ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  isLiveStreaming ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                <span>{isLiveStreaming ? 'Live Market Radar Active' : 'Live Stream Paused'}</span>
                <span className="text-faint">·</span>
                <span className="text-[10px] font-mono text-brand font-semibold">
                  {isLiveStreaming ? `Auto-updating in ${secondsUntilNextPoll}s` : 'Paused'}
                </span>
              </div>
              <div className="text-[10px] text-faint font-mono">
                {lastUpdated}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Controls (Pause/Resume, Manual Refresh) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Progress bar pill */}
          {isLiveStreaming && (
            <div className="hidden md:flex items-center gap-1.5 w-24 bg-sunken-strong h-2 rounded-full overflow-hidden">
              <div
                className="bg-profit-solid h-full transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${((30 - secondsUntilNextPoll) / 30) * 100}%` }}
              />
            </div>
          )}

          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className="px-2.5 py-1.5 bg-surface-alt hover:bg-sunken text-ink-soft border border-line-brand text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
            title={isLiveStreaming ? 'Pause continuous auto-updates' : 'Resume continuous auto-updates'}
          >
            {isLiveStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5 text-faint" />
                <span className="text-[11px]">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-profit" />
                <span className="text-[11px]">Resume</span>
              </>
            )}
          </button>

          <button
            onClick={() => fetchLiveCatalysts(true)}
            disabled={isFetchingFeed}
            className="px-3 py-1.5 bg-brand-solid hover:bg-brand-solid-hover disabled:opacity-50 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Force immediate check for new headlines"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingFeed ? 'animate-spin' : ''}`} />
            <span>{isFetchingFeed ? 'Polling...' : 'Refresh Now'}</span>
          </button>
        </div>
      </div>

      {/* Breaking News Alert Banner if new top catalyst detected */}
      {breakingNotice && (
        <div className="bg-warn-bg-soft border-2 border-amber-400 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div className="truncate">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand block">
                ⚡ Breaking Market Catalyst Detected Just Now
              </span>
              <p className="text-xs font-bold text-ink truncate">
                "{breakingNotice}"
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                setBreakingNotice(null);
                const el = document.getElementById(catalysts[0]?.id);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
            >
              View Catalyst
            </button>
            <button
              onClick={() => setBreakingNotice(null)}
              className="p-1 text-faint hover:text-ink transition cursor-pointer"
            >
              <span className="text-xs font-mono">✕</span>
            </button>
          </div>
        </div>
      )}

      {/* Portfolio Exposure Alert (If trader has trades in affected symbols) */}
      {matchingPortfolioAlerts.length > 0 && (
        <div className="bg-warn-bg-soft border-2 border-warn-line rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-ink text-sm sm:text-base">
                  Portfolio Exposure Alert: High-Impact Catalysts Detected on Your Watchlist
                </h3>
                <span className="text-xs font-mono font-semibold text-brand bg-warn-bg px-2.5 py-0.5 rounded-full border border-amber-300">
                  {matchingPortfolioAlerts.length} Active Catalysts
                </span>
              </div>
              <p className="text-xs sm:text-sm text-brand leading-relaxed">
                You have logged trades in{' '}
                <span className="font-bold font-mono text-ink">
                  {traderSymbols.slice(0, 4).join(', ')}
                </span>
                . The following high-impact news events may generate wider bid-ask spreads, slippage, or stop sweeps:
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                {matchingPortfolioAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => {
                      setExpandedId(alert.id);
                      const el = document.getElementById(alert.id);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="text-left text-xs bg-surface hover:bg-warn-bg-soft border border-amber-300 rounded-lg px-3 py-1.5 transition text-brand font-medium flex items-center gap-1.5 shadow-2xs"
                  >
                    <Flame className="w-3.5 h-3.5 text-loss shrink-0" />
                    <span className="truncate max-w-[260px] sm:max-w-md">{alert.headline}</span>
                    <ArrowRight className="w-3 h-3 text-accent shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Custom Catalyst & News Analyzer Card */}
      <div className="bg-surface-alt border border-line rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-solid to-accent flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink">
                AI News &amp; Catalyst Impact Analyzer
              </h2>
              <p className="text-xs text-faint">
                Paste any breaking headline, regulatory tweet, or economic release to calculate its tactical trading impact
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-brand bg-sunken px-2.5 py-1 rounded-md border border-line-brand self-start sm:self-auto font-semibold">
            Institutional Quantitative Engine
          </span>
        </div>

        {/* Input & Action */}
        <div className="space-y-3">
          <div className="relative">
            <textarea
              rows={2}
              value={customHeadline}
              onChange={(e) => setCustomHeadline(e.target.value)}
              placeholder="e.g. US Core PPI comes in hot at 0.5% MoM, or Binance announces new 50x futures listing for XYZUSDT..."
              className="w-full text-xs sm:text-sm p-3.5 pr-28 rounded-xl bg-surface border border-line-brand focus:border-brand focus:ring-1 focus:ring-brand outline-hidden text-ink placeholder:text-faint resize-none"
            />
            <button
              onClick={() => handleAnalyzeNews()}
              disabled={isAnalyzing || !customHeadline.trim()}
              className="absolute right-2.5 bottom-3.5 px-4 py-2 bg-gradient-to-r from-brand-solid to-accent hover:from-brand-solid-hover hover:to-brand-solid-2 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  Analyze Impact
                </>
              )}
            </button>
          </div>

          {/* Quick Presets from Live Wire */}
          {catalysts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-faint font-semibold mr-1">Quick-Analyze from Live Wire:</span>
              {catalysts.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCustomHeadline(item.headline);
                    handleAnalyzeNews(item.headline);
                  }}
                  className="text-[11px] bg-surface hover:bg-sunken text-ink-soft border border-line hover:border-accent px-2.5 py-1 rounded-md transition cursor-pointer font-medium truncate max-w-[210px]"
                  title={item.headline}
                >
                  {item.affectedSymbols[0] ? `[${item.affectedSymbols[0]}] ` : ''}{item.headline.slice(0, 26)}...
                </button>
              ))}
            </div>
          )}

          {analyzerError && (
            <div className="p-3 bg-loss-bg border border-loss-line rounded-lg text-xs text-loss flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-loss shrink-0" />
              <span>{analyzerError}</span>
            </div>
          )}

          {/* Live Analysis Result */}
          {analysisResult && (
            <div className="mt-4 p-4 sm:p-5 rounded-xl bg-gradient-to-br from-canvas to-sunken border border-line-brand space-y-4 shadow-sm animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-strong pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-brand">
                    Catalyst Breakdown Result
                  </span>
                  <span className="text-[10px] font-mono text-faint">
                    (Model: {analysisResult.source})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getSentimentBadge(analysisResult.sentiment)}
                  <div className="flex items-center gap-1 bg-inverse text-white px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
                    Impact: {analysisResult.impactScore}/10
                  </div>
                </div>
              </div>

              {/* Analyzed Headline */}
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-ink leading-snug">
                  "{analysisResult.headline}"
                </h4>
                <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">
                  {analysisResult.summary}
                </p>
              </div>

              {/* Mechanism & Affected Symbols */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/80 p-3.5 rounded-lg border border-line">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-faint block mb-1">
                    Market Transmission Mechanism
                  </span>
                  <p className="text-xs text-ink leading-relaxed">
                    {analysisResult.marketMechanism}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-faint block mb-1">
                    Directly Impacted Futures &amp; Assets
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.affectedAssets.map((sym, i) => (
                      <span
                        key={i}
                        className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-inverse text-amber-300 border border-brand"
                      >
                        {sym}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tactical Execution Plan Box */}
              <div className="bg-inverse text-white p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wider uppercase text-amber-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Actionable Trader Playbook Directive
                  </span>
                  <button
                    onClick={() => onNavigateToTab('calculator')}
                    className="text-[11px] font-semibold text-amber-300 hover:text-white underline cursor-pointer flex items-center gap-1"
                  >
                    Open Risk Sizer for Safe Sizing
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-faint text-[10px] uppercase font-mono">Recommended Action</span>
                    <p className="text-[#f5ede4] font-medium leading-relaxed">
                      {analysisResult.tacticalAdvice.recommendedAction}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-faint text-[10px] uppercase font-mono">Stop Loss &amp; Invalidation</span>
                    <p className="text-[#f5ede4] font-medium leading-relaxed">
                      {analysisResult.tacticalAdvice.stopLossGuidance}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-faint text-[10px] uppercase font-mono">Optimal Setup</span>
                    <p className="text-[#f5ede4] font-medium leading-relaxed">
                      {analysisResult.tacticalAdvice.bestSetup}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-faint text-[10px] uppercase font-mono">Volatility Alert</span>
                    <p className="text-amber-300 font-medium leading-relaxed">
                      {analysisResult.tacticalAdvice.volatilityWarning}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-alt border border-line rounded-xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Catalysts' },
            { id: 'crypto', label: 'Binance & Crypto' },
            { id: 'macro', label: 'Fed & Macro' },
            { id: 'equities', label: 'Tech & Stocks' },
            { id: 'forex', label: 'Forex' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-brand-solid text-white shadow-xs'
                  : 'bg-sunken text-ink-soft hover:bg-line'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Impact Filter & Search */}
        <div className="flex items-center gap-2">
          <select
            value={selectedImpact}
            onChange={(e) => setSelectedImpact(e.target.value as any)}
            className="text-xs bg-surface border border-line-brand rounded-lg px-2.5 py-1.5 font-medium text-ink outline-hidden focus:border-brand"
          >
            <option value="all">All Volatility</option>
            <option value="HIGH">High Impact Only</option>
            <option value="MEDIUM">Medium Impact</option>
            <option value="LOW">Low Impact</option>
          </select>

          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-faint absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalysts or tickers..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-line-brand focus:border-brand outline-hidden text-ink placeholder:text-faint"
            />
          </div>
        </div>
      </div>

      {/* Catalyst Feed List */}
      <div className="space-y-3.5">
        {catalysts.length === 0 && isFetchingFeed ? (
          <div className="bg-surface-alt border border-line rounded-xl p-12 text-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-amber-600 border-t-transparent animate-spin mx-auto" />
            <h3 className="text-sm font-bold text-ink">Connecting Real-Time Financial Wire Feeds...</h3>
            <p className="text-xs text-faint">Streaming live breaking catalysts from Bloomberg, Reuters, CNBC, CoinDesk &amp; Binance.</p>
          </div>
        ) : catalysts.length === 0 && feedError ? (
          <div className="bg-loss-bg border border-loss-line rounded-xl p-10 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-loss mx-auto" />
            <h3 className="text-sm font-bold text-ink">News feed unavailable</h3>
            <p className="text-xs text-ink-soft max-w-md mx-auto">{feedError}</p>
            <button
              onClick={() => fetchLiveCatalysts(true)}
              className="mt-2 px-3 py-1.5 bg-surface hover:bg-sunken text-brand text-xs font-semibold rounded-lg border border-line-brand cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : filteredCatalysts.length === 0 ? (
          <div className="bg-surface-alt border border-line rounded-xl p-10 text-center space-y-2">
            <Info className="w-8 h-8 text-faint mx-auto" />
            <h3 className="text-sm font-bold text-ink">No catalysts found matching your filters</h3>
            <p className="text-xs text-faint">Try clearing your search query or selecting "All Catalysts".</p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedImpact('all');
                setSearchQuery('');
              }}
              className="mt-2 px-3 py-1.5 bg-sunken hover:bg-line text-brand text-xs font-semibold rounded-lg border border-line-brand cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredCatalysts.map((catalyst) => {
            const isExpanded = expandedId === catalyst.id;
            const hasPortfolioMatch = traderSymbols.some((ts) =>
              catalyst.affectedSymbols.some((as) => as.toUpperCase().includes(ts) || ts.includes(as.toUpperCase()))
            );

            return (
              <div
                id={catalyst.id}
                key={catalyst.id}
                className={`bg-surface-alt border transition duration-200 rounded-xl overflow-hidden shadow-xs hover:shadow-sm ${
                  hasPortfolioMatch
                    ? 'border-amber-400/80 ring-1 ring-amber-400/30'
                    : 'border-line hover:border-line-brand'
                }`}
              >
                {/* News Card Main Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : catalyst.id)}
                  className="p-4 sm:p-5 cursor-pointer select-none space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      {getImpactBadge(catalyst.impactLevel)}
                      {getSentimentBadge(catalyst.sentiment)}
                      {hasPortfolioMatch && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white uppercase tracking-wider">
                          Watchlist Active
                        </span>
                      )}
                      <span className="text-[11px] text-faint flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {catalyst.timeAgo}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-faint">
                      <span className="font-medium truncate max-w-[150px] sm:max-w-none">
                        {catalyst.source}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-brand" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-brand" />
                      )}
                    </div>
                  </div>

                  {/* Headline */}
                  <h3 className="text-sm sm:text-base font-bold text-ink leading-snug group-hover:text-brand transition">
                    {catalyst.headline}
                  </h3>

                  {/* Affected Symbols */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-faint mr-1">
                      Affected:
                    </span>
                    {catalyst.affectedSymbols.map((sym, idx) => (
                      <span
                        key={idx}
                        className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          traderSymbols.includes(sym)
                            ? 'bg-warn-bg text-brand border border-amber-300'
                            : 'bg-sunken text-ink-soft border border-line'
                        }`}
                      >
                        {sym}
                      </span>
                    ))}
                  </div>

                  {/* Summary Snippet */}
                  <p className="text-xs text-ink-soft leading-relaxed line-clamp-2">
                    {catalyst.summary}
                  </p>
                </div>

                {/* Expanded Tactical Playbook Drawer */}
                {isExpanded && (
                  <div className="border-t border-line bg-canvas p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
                    {/* Key Metrics row if available */}
                    {catalyst.keyMetrics && (
                      <div className="flex flex-wrap items-center gap-3 bg-surface p-3 rounded-lg border border-line">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
                          Report Numbers:
                        </span>
                        {catalyst.keyMetrics.actual && (
                          <div className="text-xs">
                            <span className="text-faint mr-1">Actual:</span>
                            <span className="font-mono font-bold text-profit">
                              {catalyst.keyMetrics.actual}
                            </span>
                          </div>
                        )}
                        {catalyst.keyMetrics.expected && (
                          <div className="text-xs">
                            <span className="text-faint mr-1">Consensus:</span>
                            <span className="font-mono font-semibold text-ink">
                              {catalyst.keyMetrics.expected}
                            </span>
                          </div>
                        )}
                        {catalyst.keyMetrics.previous && (
                          <div className="text-xs">
                            <span className="text-faint mr-1">Prior:</span>
                            <span className="font-mono text-faint">
                              {catalyst.keyMetrics.previous}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-[11px] text-faint leading-relaxed">
                      Bias, impact level and the playbook below are auto-tagged from keywords in the headline, not
                      from reading the article. Use &quot;Deep Analyze with AI&quot; for a closer look.
                    </p>

                    {/* What this means for trades */}
                    <div className="bg-surface-alt p-3.5 rounded-lg border border-line-strong space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" />
                        Trading Takeaway &amp; Bias
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-ink leading-relaxed">
                        {catalyst.tradingTakeaway}
                      </p>
                    </div>

                    {/* Tactical Breakdown Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-surface p-3 rounded-lg border border-line space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
                          Recommended Action
                        </span>
                        <p className="text-ink font-medium leading-relaxed">
                          {catalyst.tacticalAdvice.recommendedAction}
                        </p>
                      </div>

                      <div className="bg-surface p-3 rounded-lg border border-line space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
                          Stop Loss &amp; Risk Guidance
                        </span>
                        <p className="text-ink font-medium leading-relaxed">
                          {catalyst.tacticalAdvice.stopLossGuidance}
                        </p>
                      </div>

                      <div className="bg-surface p-3 rounded-lg border border-line space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
                          Optimal High-Edge Setup
                        </span>
                        <p className="text-ink font-medium leading-relaxed">
                          {catalyst.tacticalAdvice.bestSetup}
                        </p>
                      </div>

                      <div className="bg-warn-bg-soft p-3 rounded-lg border border-warn-line space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-accent" />
                          Volatility &amp; Execution Warning
                        </span>
                        <p className="text-brand font-medium leading-relaxed">
                          {catalyst.tacticalAdvice.volatilityWarning}
                        </p>
                      </div>
                    </div>

                    {/* Interactive Action Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-faint font-mono">
                          Source: {catalyst.source}
                        </span>
                        {catalyst.link && (
                          <a
                            href={catalyst.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-brand hover:underline cursor-pointer"
                          >
                            <span>Read Article</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCustomHeadline(catalyst.headline);
                            handleAnalyzeNews(catalyst.headline);
                            window.scrollTo({ top: 120, behavior: 'smooth' });
                          }}
                          className="px-3 py-1.5 bg-surface hover:bg-sunken text-brand border border-line-brand text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Deep Analyze with AI
                        </button>
                        <button
                          onClick={() => onNavigateToTab('calculator')}
                          className="px-3 py-1.5 bg-brand-solid hover:bg-brand-solid-hover text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          Size Trade in Risk Calculator
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
