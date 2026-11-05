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
import {
  INITIAL_NEWS_CATALYSTS,
  PRESET_ANALYSIS_PROMPTS,
  NewsCatalyst,
} from '../data/marketCatalysts';

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
  const [catalysts, setCatalysts] = useState<NewsCatalyst[]>(INITIAL_NEWS_CATALYSTS);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'crypto' | 'macro' | 'equities' | 'forex'>('all');
  const [selectedImpact, setSelectedImpact] = useState<'all' | 'HIGH' | 'MEDIUM' | 'LOW'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>('news-live-1');

  // Continuous Live Auto-Update Streaming State
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [secondsUntilNextPoll, setSecondsUntilNextPoll] = useState(30);
  const [isFetchingFeed, setIsFetchingFeed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('Live Connected');
  const [breakingNotice, setBreakingNotice] = useState<string | null>(null);

  // Fetch live market feed from server
  const fetchLiveCatalysts = useCallback(async (isManual = false) => {
    setIsFetchingFeed(true);
    try {
      const res = await fetch('/api/news/feed');
      if (res.ok) {
        const data = await res.json();
        if (data.catalysts && Array.isArray(data.catalysts)) {
          setCatalysts((prev) => {
            // Check if top headline is new
            if (prev.length > 0 && data.catalysts.length > 0 && prev[0].id !== data.catalysts[0].id) {
              setBreakingNotice(data.catalysts[0].headline);
            }
            return data.catalysts;
          });
          const timeStr = new Date().toISOString().substring(11, 19) + ' UTC';
          setLastUpdated(`Synced ${timeStr}`);
        }
      }
    } catch (e) {
      console.warn('Could not refresh live news feed:', e);
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#edf7ee] text-[#2e7d32] border border-[#c8e6c9]">
            <TrendingUp className="w-3.5 h-3.5" />
            Bullish Bias
          </span>
        );
      case 'BEARISH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#fdeeee] text-[#c62828] border border-[#ffcdd2]">
            <TrendingDown className="w-3.5 h-3.5" />
            Bearish Bias
          </span>
        );
      case 'VOLATILE_CHOP':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#fff8e1] text-[#b45309] border border-[#ffe082]">
            <Zap className="w-3.5 h-3.5" />
            High Volatility / Chop
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#f5ede4] text-[#78350f] border border-[#dac6b3]">
            Neutral / Consolidating
          </span>
        );
    }
  };

  const getImpactBadge = (level: string) => {
    switch (level) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#c62828] text-white uppercase tracking-wider shadow-xs">
            <Flame className="w-3 h-3" />
            High Impact
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#b45309] text-white uppercase tracking-wider">
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
      <div className="bg-gradient-to-br from-[#281d16] via-[#3d2b20] to-[#1c140e] rounded-2xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-[#b45309]/15 to-transparent pointer-events-none" />
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
      <div className="bg-white border border-[#e8dfd5] rounded-xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#281d16]">
                <span>{isLiveStreaming ? 'Live Market Radar Active' : 'Live Stream Paused'}</span>
                <span className="text-[#8c7462]">·</span>
                <span className="text-[10px] font-mono text-[#78350f] font-semibold">
                  {isLiveStreaming ? `Auto-updating in ${secondsUntilNextPoll}s` : 'Paused'}
                </span>
              </div>
              <div className="text-[10px] text-[#8c7462] font-mono">
                {lastUpdated}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Controls (Pause/Resume, Manual Refresh) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Progress bar pill */}
          {isLiveStreaming && (
            <div className="hidden md:flex items-center gap-1.5 w-24 bg-[#ede6dc] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#1e6b37] h-full transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${((30 - secondsUntilNextPoll) / 30) * 100}%` }}
              />
            </div>
          )}

          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className="px-2.5 py-1.5 bg-[#fcfaf7] hover:bg-[#f5ede4] text-[#6b4e3d] border border-[#dac6b3] text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
            title={isLiveStreaming ? 'Pause continuous auto-updates' : 'Resume continuous auto-updates'}
          >
            {isLiveStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5 text-[#8c7462]" />
                <span className="text-[11px]">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[11px]">Resume</span>
              </>
            )}
          </button>

          <button
            onClick={() => fetchLiveCatalysts(true)}
            disabled={isFetchingFeed}
            className="px-3 py-1.5 bg-[#78350f] hover:bg-[#602908] disabled:opacity-50 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Force immediate check for new headlines"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingFeed ? 'animate-spin' : ''}`} />
            <span>{isFetchingFeed ? 'Polling...' : 'Refresh Now'}</span>
          </button>
        </div>
      </div>

      {/* Breaking News Alert Banner if new top catalyst detected */}
      {breakingNotice && (
        <div className="bg-[#fff8e1] border-2 border-amber-400 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div className="truncate">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                ⚡ Breaking Market Catalyst Detected Just Now
              </span>
              <p className="text-xs font-bold text-[#281d16] truncate">
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
              className="p-1 text-[#8c7462] hover:text-[#281d16] transition cursor-pointer"
            >
              <span className="text-xs font-mono">✕</span>
            </button>
          </div>
        </div>
      )}

      {/* Portfolio Exposure Alert (If trader has trades in affected symbols) */}
      {matchingPortfolioAlerts.length > 0 && (
        <div className="bg-[#fff8e1] border-2 border-[#ffe082] rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#b45309]/15 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-[#b45309]" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-[#451a03] text-sm sm:text-base">
                  Portfolio Exposure Alert: High-Impact Catalysts Detected on Your Watchlist
                </h3>
                <span className="text-xs font-mono font-semibold text-[#92400e] bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                  {matchingPortfolioAlerts.length} Active Catalysts
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#78350f] leading-relaxed">
                You have logged trades in{' '}
                <span className="font-bold font-mono text-[#451a03]">
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
                    className="text-left text-xs bg-white hover:bg-amber-50 border border-amber-300 rounded-lg px-3 py-1.5 transition text-[#78350f] font-medium flex items-center gap-1.5 shadow-2xs"
                  >
                    <Flame className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="truncate max-w-[260px] sm:max-w-md">{alert.headline}</span>
                    <ArrowRight className="w-3 h-3 text-[#b45309] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Custom Catalyst & News Analyzer Card */}
      <div className="bg-[#fcfaf7] border border-[#e8dfd5] rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#78350f] to-[#b45309] flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#281d16]">
                AI News &amp; Catalyst Impact Analyzer
              </h2>
              <p className="text-xs text-[#8c7462]">
                Paste any breaking headline, regulatory tweet, or economic release to calculate its tactical trading impact
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-[#78350f] bg-[#f5ede4] px-2.5 py-1 rounded-md border border-[#dac6b3] self-start sm:self-auto font-semibold">
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
              className="w-full text-xs sm:text-sm p-3.5 pr-28 rounded-xl bg-white border border-[#dac6b3] focus:border-[#78350f] focus:ring-1 focus:ring-[#78350f] outline-hidden text-[#281d16] placeholder:text-[#a89585] resize-none"
            />
            <button
              onClick={() => handleAnalyzeNews()}
              disabled={isAnalyzing || !customHeadline.trim()}
              className="absolute right-2.5 bottom-3.5 px-4 py-2 bg-gradient-to-r from-[#78350f] to-[#b45309] hover:from-[#602908] hover:to-[#92400e] disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
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

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#8c7462] font-semibold mr-1">Trending Test Headlines:</span>
            {PRESET_ANALYSIS_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCustomHeadline(prompt.text);
                  handleAnalyzeNews(prompt.text);
                }}
                className="text-[11px] bg-white hover:bg-[#f5ede4] text-[#6b4e3d] border border-[#e8dfd5] hover:border-[#b45309] px-2.5 py-1 rounded-md transition cursor-pointer font-medium"
              >
                {prompt.label}
              </button>
            ))}
          </div>

          {analyzerError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{analyzerError}</span>
            </div>
          )}

          {/* Live Analysis Result */}
          {analysisResult && (
            <div className="mt-4 p-4 sm:p-5 rounded-xl bg-gradient-to-br from-[#faf6f0] to-[#f4ebe1] border border-[#d8c3af] space-y-4 shadow-sm animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2d0bf] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#78350f]">
                    Catalyst Breakdown Result
                  </span>
                  <span className="text-[10px] font-mono text-[#8c7462]">
                    (Model: {analysisResult.source})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getSentimentBadge(analysisResult.sentiment)}
                  <div className="flex items-center gap-1 bg-[#281d16] text-white px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
                    Impact: {analysisResult.impactScore}/10
                  </div>
                </div>
              </div>

              {/* Analyzed Headline */}
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-[#281d16] leading-snug">
                  "{analysisResult.headline}"
                </h4>
                <p className="text-xs text-[#5c4434] mt-1.5 leading-relaxed">
                  {analysisResult.summary}
                </p>
              </div>

              {/* Mechanism & Affected Symbols */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/80 p-3.5 rounded-lg border border-[#e8dfd5]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c7462] block mb-1">
                    Market Transmission Mechanism
                  </span>
                  <p className="text-xs text-[#3d2b20] leading-relaxed">
                    {analysisResult.marketMechanism}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c7462] block mb-1">
                    Directly Impacted Futures &amp; Assets
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.affectedAssets.map((sym, i) => (
                      <span
                        key={i}
                        className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[#281d16] text-amber-300 border border-[#3d2b20]"
                      >
                        {sym}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tactical Execution Plan Box */}
              <div className="bg-[#281d16] text-white p-4 rounded-xl space-y-3">
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
                    <span className="text-[#a89585] text-[10px] uppercase font-mono">Recommended Action</span>
                    <p className="text-[#f5ede4] font-medium leading-relaxed">
                      {analysisResult.tacticalAdvice.recommendedAction}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[#a89585] text-[10px] uppercase font-mono">Stop Loss &amp; Invalidation</span>
                    <p className="text-[#f5ede4] font-medium leading-relaxed">
                      {analysisResult.tacticalAdvice.stopLossGuidance}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[#a89585] text-[10px] uppercase font-mono">Optimal Setup</span>
                    <p className="text-[#f5ede4] font-medium leading-relaxed">
                      {analysisResult.tacticalAdvice.bestSetup}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[#a89585] text-[10px] uppercase font-mono">Volatility Alert</span>
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
      <div className="bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
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
                  ? 'bg-[#78350f] text-white shadow-xs'
                  : 'bg-[#f5ede4] text-[#6b4e3d] hover:bg-[#ede1d3]'
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
            className="text-xs bg-white border border-[#dac6b3] rounded-lg px-2.5 py-1.5 font-medium text-[#281d16] outline-hidden focus:border-[#78350f]"
          >
            <option value="all">All Volatility</option>
            <option value="HIGH">High Impact Only</option>
            <option value="MEDIUM">Medium Impact</option>
            <option value="LOW">Low Impact</option>
          </select>

          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-[#8c7462] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalysts or tickers..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-white border border-[#dac6b3] focus:border-[#78350f] outline-hidden text-[#281d16] placeholder:text-[#a89585]"
            />
          </div>
        </div>
      </div>

      {/* Catalyst Feed List */}
      <div className="space-y-3.5">
        {filteredCatalysts.length === 0 ? (
          <div className="bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl p-10 text-center space-y-2">
            <Info className="w-8 h-8 text-[#8c7462] mx-auto" />
            <h3 className="text-sm font-bold text-[#281d16]">No catalysts found matching your filters</h3>
            <p className="text-xs text-[#8c7462]">Try clearing your search query or selecting "All Catalysts".</p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedImpact('all');
                setSearchQuery('');
              }}
              className="mt-2 px-3 py-1.5 bg-[#f5ede4] hover:bg-[#ede1d3] text-[#78350f] text-xs font-semibold rounded-lg border border-[#dac6b3] cursor-pointer"
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
                className={`bg-[#fcfaf7] border transition duration-200 rounded-xl overflow-hidden shadow-xs hover:shadow-sm ${
                  hasPortfolioMatch
                    ? 'border-amber-400/80 ring-1 ring-amber-400/30'
                    : 'border-[#e8dfd5] hover:border-[#dac6b3]'
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
                      <span className="text-[11px] text-[#8c7462] flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {catalyst.timeAgo}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#8c7462]">
                      <span className="font-medium truncate max-w-[150px] sm:max-w-none">
                        {catalyst.source}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#78350f]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#78350f]" />
                      )}
                    </div>
                  </div>

                  {/* Headline */}
                  <h3 className="text-sm sm:text-base font-bold text-[#281d16] leading-snug group-hover:text-[#78350f] transition">
                    {catalyst.headline}
                  </h3>

                  {/* Affected Symbols */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c7462] mr-1">
                      Affected:
                    </span>
                    {catalyst.affectedSymbols.map((sym, idx) => (
                      <span
                        key={idx}
                        className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          traderSymbols.includes(sym)
                            ? 'bg-amber-100 text-[#78350f] border border-amber-300'
                            : 'bg-[#f5ede4] text-[#4a3528] border border-[#e8dfd5]'
                        }`}
                      >
                        {sym}
                      </span>
                    ))}
                  </div>

                  {/* Summary Snippet */}
                  <p className="text-xs text-[#6b4e3d] leading-relaxed line-clamp-2">
                    {catalyst.summary}
                  </p>
                </div>

                {/* Expanded Tactical Playbook Drawer */}
                {isExpanded && (
                  <div className="border-t border-[#e8dfd5] bg-[#faf6f0] p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
                    {/* Key Metrics row if available */}
                    {catalyst.keyMetrics && (
                      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-[#e8dfd5]">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c7462]">
                          Report Numbers:
                        </span>
                        {catalyst.keyMetrics.actual && (
                          <div className="text-xs">
                            <span className="text-[#8c7462] mr-1">Actual:</span>
                            <span className="font-mono font-bold text-[#2e7d32]">
                              {catalyst.keyMetrics.actual}
                            </span>
                          </div>
                        )}
                        {catalyst.keyMetrics.expected && (
                          <div className="text-xs">
                            <span className="text-[#8c7462] mr-1">Consensus:</span>
                            <span className="font-mono font-semibold text-[#281d16]">
                              {catalyst.keyMetrics.expected}
                            </span>
                          </div>
                        )}
                        {catalyst.keyMetrics.previous && (
                          <div className="text-xs">
                            <span className="text-[#8c7462] mr-1">Prior:</span>
                            <span className="font-mono text-[#8c7462]">
                              {catalyst.keyMetrics.previous}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* What this means for trades */}
                    <div className="bg-[#fffdf9] p-3.5 rounded-lg border border-[#e2d5c7] space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#78350f] flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" />
                        Trading Takeaway &amp; Bias
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-[#281d16] leading-relaxed">
                        {catalyst.tradingTakeaway}
                      </p>
                    </div>

                    {/* Tactical Breakdown Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-white p-3 rounded-lg border border-[#e8dfd5] space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c7462]">
                          Recommended Action
                        </span>
                        <p className="text-[#3d2b20] font-medium leading-relaxed">
                          {catalyst.tacticalAdvice.recommendedAction}
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-[#e8dfd5] space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c7462]">
                          Stop Loss &amp; Risk Guidance
                        </span>
                        <p className="text-[#3d2b20] font-medium leading-relaxed">
                          {catalyst.tacticalAdvice.stopLossGuidance}
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-[#e8dfd5] space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c7462]">
                          Optimal High-Edge Setup
                        </span>
                        <p className="text-[#3d2b20] font-medium leading-relaxed">
                          {catalyst.tacticalAdvice.bestSetup}
                        </p>
                      </div>

                      <div className="bg-[#fff8e1] p-3 rounded-lg border border-[#ffe082] space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#b45309] flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-[#b45309]" />
                          Volatility &amp; Execution Warning
                        </span>
                        <p className="text-[#78350f] font-medium leading-relaxed">
                          {catalyst.tacticalAdvice.volatilityWarning}
                        </p>
                      </div>
                    </div>

                    {/* Interactive Action Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#ede1d3]">
                      <span className="text-[11px] text-[#8c7462] font-mono">
                        Source: {catalyst.source}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCustomHeadline(catalyst.headline);
                            handleAnalyzeNews(catalyst.headline);
                            window.scrollTo({ top: 120, behavior: 'smooth' });
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-[#f5ede4] text-[#78350f] border border-[#dac6b3] text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Deep Analyze with AI
                        </button>
                        <button
                          onClick={() => onNavigateToTab('calculator')}
                          className="px-3 py-1.5 bg-[#78350f] hover:bg-[#602908] text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
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
