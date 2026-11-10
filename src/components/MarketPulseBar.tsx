import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Globe,
  Clock,
  ChevronDown,
  ChevronUp,
  Target,
  Radio,
  BookOpen,
  Zap,
  Info,
} from 'lucide-react';
import { getDetailedSessionClock, DetailedSessionClock } from '../utils/sessionHelper';

export interface BinanceTicker {
  symbol: string;
  baseSymbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume24hUsdt: number;
  fundingRatePct: number;
  isHighFunding: boolean;
  bias: 'BULLISH' | 'BEARISH';
}

export interface SessionClock {
  utcTime: string;
  activeSession: string;
  activeKillZone: string;
  sessionStateNote: string;
  isOverlap: boolean;
}

interface MarketPulseBarProps {
  onNavigateToTab: (tab: 'dashboard' | 'journal' | 'review' | 'calculator' | 'playbook' | 'analytics' | 'news') => void;
  onSelectCoin?: (symbol: string) => void;
}

export const MarketPulseBar: React.FC<MarketPulseBarProps> = ({
  onNavigateToTab,
  onSelectCoin,
}) => {
  const [pulseData, setPulseData] = useState<{
    tickers: BinanceTicker[];
    sessionClock: SessionClock;
    updatedAt: string;
  } | null>(null);
  const [clientClock, setClientClock] = useState<DetailedSessionClock>(() => getDetailedSessionClock());
  const [timeMode, setTimeMode] = useState<'local' | 'utc' | 'ny'>('local');
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<BinanceTicker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Live 1-second client-side clock (guaranteed zero latency, never falls back to static string)
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setClientClock(getDetailedSessionClock());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const fetchPulse = async () => {
    try {
      const res = await fetch('/api/binance/market-pulse');
      if (res.ok) {
        const data = await res.json();
        setPulseData(data);
      }
    } catch (e) {
      console.warn('Market pulse fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPulse();
    const interval = setInterval(fetchPulse, 20000);
    return () => clearInterval(interval);
  }, []);

  const tickers = pulseData?.tickers || [];

  // Active session and killzone: clientClock ensures instantaneous, 100% accurate, continuous real-time calculation
  const activeKillZone = clientClock.activeKillZone;
  const isOverlap = clientClock.isOverlap;

  const renderActiveTime = () => {
    if (timeMode === 'local') {
      return (
        <span title={`Local timezone: ${clientClock.localTimezone} (Click to switch to UTC)`} className="cursor-pointer hover:text-white flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>{clientClock.localTime}</span>
          <span className="text-[9px] uppercase tracking-wider text-faint bg-inverse px-1 py-0.5 rounded">Local</span>
        </span>
      );
    }
    if (timeMode === 'ny') {
      return (
        <span title="New York Market Time (Click to switch to Local)" className="cursor-pointer hover:text-white flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>{clientClock.nyTime}</span>
          <span className="text-[9px] uppercase tracking-wider text-faint bg-inverse px-1 py-0.5 rounded">NY</span>
        </span>
      );
    }
    return (
      <span title="UTC Time (Click to switch to NY)" className="cursor-pointer hover:text-white flex items-center gap-1">
        <Clock className="w-3 h-3 text-amber-400" />
        <span>{clientClock.utcTime}</span>
        <span className="text-[9px] uppercase tracking-wider text-faint bg-inverse px-1 py-0.5 rounded">UTC</span>
      </span>
    );
  };

  const cycleTimeMode = () => {
    setTimeMode((prev) => (prev === 'local' ? 'utc' : prev === 'utc' ? 'ny' : 'local'));
  };

  return (
    <div className="bg-inverse text-[#ded3c8] border-b border-[#35261c] text-xs transition select-none">
      {/* Ticker Row */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3 overflow-hidden">
        {/* Left: Global Session Clock Indicator */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 hover:opacity-90 transition cursor-pointer"
            title="Click to view all 4 Global Financial Hubs & Sessions"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOverlap ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className="font-bold text-white text-[11px] sm:text-xs tracking-tight">
              {activeKillZone}
            </span>
          </button>
          <span className="text-faint hidden sm:inline" aria-hidden="true">·</span>
          <button
            onClick={cycleTimeMode}
            className="font-mono text-[11px] text-[#bda798] hidden sm:inline-flex items-center gap-1 bg-inverse hover:bg-inverse px-1.5 py-0.5 rounded transition cursor-pointer"
          >
            {renderActiveTime()}
          </button>
        </div>

        {/* Center: Live Binance Perpetuals Carousel */}
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-none py-0.5">
          {tickers.map((t) => {
            const isPos = t.priceChangePercent >= 0;
            return (
              <button
                key={t.symbol}
                onClick={() => setSelectedTicker(selectedTicker?.symbol === t.symbol ? null : t)}
                className={`flex items-center gap-1.5 shrink-0 text-left cursor-pointer transition px-1.5 py-0.5 rounded-md hover:bg-white/5 ${
                  selectedTicker?.symbol === t.symbol ? 'bg-white/10 ring-1 ring-amber-400/50' : ''
                }`}
              >
                <span className="font-mono font-bold text-white text-[11px] sm:text-xs">
                  {t.symbol}
                </span>
                <span className="font-mono text-[11px] sm:text-xs text-[#f5ede4]">
                  ${t.lastPrice > 10 ? t.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : t.lastPrice.toFixed(4)}
                </span>
                <span
                  className={`font-mono text-[10px] sm:text-[11px] font-semibold flex items-center ${
                    isPos ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isPos ? '+' : ''}{t.priceChangePercent.toFixed(2)}%
                </span>
                {t.fundingRatePct !== undefined && (
                  <span
                    className={`font-mono text-[9px] px-1 rounded-sm ${
                      t.isHighFunding
                        ? 'bg-amber-500/20 text-amber-300 font-bold'
                        : 'text-faint'
                    }`}
                    title="8-Hour Perpetual Funding Rate"
                  >
                    FR:{t.fundingRatePct > 0 ? '+' : ''}{t.fundingRatePct.toFixed(3)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Expand / Info Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[11px] text-[#b8a292] hover:text-white flex items-center gap-1 transition px-1.5 py-0.5 rounded-sm hover:bg-white/5 cursor-pointer"
          >
            <span className="hidden md:inline font-mono text-[10px]">Session Intel</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Quick Action / Session Intel Drawer */}
      {(isExpanded || selectedTicker) && (
        <div className="border-t border-[#35261c] bg-inverse px-3 sm:px-6 lg:px-8 py-3 animate-in fade-in duration-150 space-y-3">
          {/* Global Financial Hubs Status Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {clientClock.hubs.map((hub) => (
              <div
                key={hub.city}
                className={`p-2 rounded border transition text-left ${
                  hub.isOpen
                    ? 'bg-inverse border-amber-500/40 shadow-sm'
                    : 'bg-inverse border-[#2e2017] opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                    <span>{hub.flag}</span>
                    <span>{hub.city}</span>
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                      hub.isOpen
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {hub.statusText}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-[11px] font-mono text-faint">
                  <span>Local:</span>
                  <span className="text-white font-medium">{hub.localTimeFormatted}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-t border-[#2a1d15]">
            {/* Session Context */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  {clientClock.activeSession}
                </span>
                <span className="text-faint">·</span>
                <span className="text-[#d5c3b4] text-[11px]">{clientClock.sessionStateNote}</span>
              </div>
              <div className="text-[10px] text-faint flex items-center gap-2 font-mono">
                <span>Local Timezone: {clientClock.localTimezone}</span>
                <span>•</span>
                <span>NY Market Time: {clientClock.nyTime}</span>
              </div>
            </div>

            {/* Quick Actions if ticker is clicked */}
            {selectedTicker ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-white font-mono font-bold mr-1">
                  Selected: {selectedTicker.symbol} (${selectedTicker.lastPrice > 10 ? selectedTicker.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : selectedTicker.lastPrice.toFixed(4)})
                </span>
                <button
                  onClick={() => {
                    if (onSelectCoin) onSelectCoin(selectedTicker.symbol);
                    onNavigateToTab('calculator');
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Target className="w-3 h-3" />
                  Size In Risk Calc
                </button>
                <button
                  onClick={() => {
                    onNavigateToTab('news');
                  }}
                  className="px-2.5 py-1 bg-inverse hover:bg-inverse-2 text-amber-200 border border-brand rounded-md text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <Radio className="w-3 h-3 text-amber-400" />
                  News Catalysts
                </button>
                <button
                  onClick={() => {
                    onNavigateToTab('journal');
                  }}
                  className="px-2.5 py-1 bg-inverse hover:bg-inverse-2 text-[#ded3c8] border border-brand rounded-md text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <BookOpen className="w-3 h-3 text-[#b8a292]" />
                  View Logged Trades
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-faint flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-500" />
                <span>Click any Binance perpetual ticker in the bar above for instant Risk Sizing or Catalyst checks.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
