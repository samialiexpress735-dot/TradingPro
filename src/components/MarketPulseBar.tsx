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
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<BinanceTicker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading && !pulseData) {
    return (
      <div className="bg-[#281d16] text-[#b8a292] text-xs py-1.5 px-4 flex items-center justify-between border-b border-[#3d2b20]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="font-mono text-[11px]">Connecting Binance Futures Feed &amp; Market Clock...</span>
        </div>
      </div>
    );
  }

  const session = pulseData?.sessionClock;
  const tickers = pulseData?.tickers || [];

  return (
    <div className="bg-[#1f1610] text-[#ded3c8] border-b border-[#35261c] text-xs transition select-none">
      {/* Ticker Row */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3 overflow-hidden">
        {/* Left: Global Session Clock Indicator */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                session?.isOverlap ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className="font-bold text-white text-[11px] sm:text-xs tracking-tight">
              {session?.activeKillZone || 'Global Market Session'}
            </span>
          </div>
          <span className="text-[#8c7462] hidden sm:inline" aria-hidden="true">·</span>
          <span className="font-mono text-[11px] text-[#bda798] hidden sm:inline flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#8c7462]" />
            {session?.utcTime || 'UTC'}
          </span>
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
                        : 'text-[#8c7462]'
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
        <div className="border-t border-[#35261c] bg-[#17100b] px-3 sm:px-6 lg:px-8 py-3 animate-in fade-in duration-150">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Session Details */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-amber-400 font-bold">{session?.activeSession}</span>
                <span className="text-[#8c7462]">·</span>
                <span className="text-[#bda798]">{session?.sessionStateNote}</span>
              </div>
            </div>

            {/* Quick Actions if ticker is clicked */}
            {selectedTicker ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-white font-mono font-bold mr-1">
                  Selected: {selectedTicker.symbol} (${selectedTicker.lastPrice})
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
                  className="px-2.5 py-1 bg-[#281d16] hover:bg-[#3d2b20] text-amber-200 border border-[#4a3528] rounded-md text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <Radio className="w-3 h-3 text-amber-400" />
                  News Catalysts
                </button>
                <button
                  onClick={() => {
                    onNavigateToTab('journal');
                  }}
                  className="px-2.5 py-1 bg-[#281d16] hover:bg-[#3d2b20] text-[#ded3c8] border border-[#4a3528] rounded-md text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <BookOpen className="w-3 h-3 text-[#b8a292]" />
                  View Logged Trades
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-[#8c7462] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-500" />
                <span>Click any Binance perpetual coin above for one-click Risk Sizing or Catalyst checks.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
