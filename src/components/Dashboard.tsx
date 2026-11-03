import React from 'react';
import { Trade, PerformanceStats, EquityPoint } from '../types/trade';
import { EquityChart } from './EquityChart';
import { CalendarHeatmap } from './CalendarHeatmap';
import { MonthlyTargetTracker } from './MonthlyTargetTracker';
import { formatPnL } from '../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Award,
  AlertTriangle,
  Target,
  ArrowRight,
  Plus,
  ShieldCheck,
  Zap,
  Sparkles,
  CalendarCheck,
} from 'lucide-react';

interface DashboardProps {
  stats: PerformanceStats;
  trades: Trade[];
  equityData: EquityPoint[];
  startingBalance: number;
  userId?: string;
  monthlyTargetAmount?: number;
  monthlyTargetType?: 'dollar' | 'percent';
  onTargetChange?: (type: 'dollar' | 'percent', val: number) => void;
  onAddTrade: () => void;
  onOpenChecklist: () => void;
  onNavigateToTab: (tab: 'journal' | 'review' | 'calculator' | 'playbook' | 'analytics' | 'support') => void;
  onSelectDate: (date: string) => void;
  onLoadDemoTrades?: () => void;
  onOpenBinanceSync?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  trades,
  equityData,
  startingBalance,
  userId,
  monthlyTargetAmount,
  monthlyTargetType,
  onTargetChange,
  onAddTrade,
  onOpenChecklist,
  onNavigateToTab,
  onSelectDate,
  onLoadDemoTrades,
  onOpenBinanceSync,
}) => {
  const isNetPositive = stats.netProfit >= 0;
  const recentTrades = trades.slice(0, 5);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="bg-white border border-[#e8dfd5] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-[#281d16] tracking-tight">Trading Dashboard &amp; P&amp;L</h1>
            <span className="px-2 py-0.5 rounded-full bg-[#edf7ed] text-[#1e6b37] text-[10px] font-mono border border-[#c3e6cb] font-bold">
              LIVE
            </span>
          </div>
          <p className="text-xs text-[#7d695b] mt-0.5 sm:mt-1">
            Realized performance across all accounts and execution strategies.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={() => onNavigateToTab('review')}
            className="px-3 py-1.5 sm:py-2 bg-[#fcfaf7] hover:bg-[#f6efe6] text-[#78350f] text-xs font-semibold rounded-xl border border-[#debfa8] flex items-center gap-1.5 transition cursor-pointer"
          >
            <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#78350f]" />
            <span>Daily Debrief</span>
          </button>

          <button
            onClick={onOpenChecklist}
            className="px-3 py-1.5 sm:py-2 bg-[#faf7f2] hover:bg-[#f2ece2] text-[#4a3b32] text-xs font-semibold rounded-xl border border-[#e2d8cb] flex items-center gap-1.5 transition cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1e6b37]" />
            <span className="hidden sm:inline">Pre-Trade </span><span>Checklist</span>
          </button>

          <button
            onClick={() => onNavigateToTab('calculator')}
            className="px-3 py-1.5 sm:py-2 bg-[#f5ede4] hover:bg-[#ede1d3] text-[#78350f] text-xs font-semibold rounded-xl border border-[#debfa8] flex items-center gap-1.5 transition cursor-pointer"
          >
            <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Risk Sizer</span>
          </button>

          <button
            onClick={onAddTrade}
            className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Log Trade</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3.5">
        {/* Card 1: Net P&L */}
        <div className="bg-white border border-[#e8dfd5] rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#7d695b] text-[10px] sm:text-[11px] mb-1">
            <span className="truncate">Net Realized P&amp;L</span>
            {isNetPositive ? (
              <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#1e6b37] shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#b93829] shrink-0" />
            )}
          </div>
          <div
            className={`text-lg sm:text-xl font-extrabold font-mono tracking-tight truncate ${
              isNetPositive ? 'text-[#1e6b37]' : 'text-[#b93829]'
            }`}
          >
            {isNetPositive ? '+' : ''}${stats.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[9px] sm:text-[10px] text-[#8c7462] font-mono mt-1 truncate">
            Gross: ${stats.grossProfit.toFixed(0)} / -${stats.grossLoss.toFixed(0)}
          </div>
        </div>

        {/* Card 2: Win Rate */}
        <div className="bg-white border border-[#e8dfd5] rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#7d695b] text-[10px] sm:text-[11px] mb-1">
            <span>Win Rate</span>
            <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#78350f] shrink-0" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-mono text-[#281d16] tracking-tight">
            {stats.winRate}%
          </div>
          <div className="text-[9px] sm:text-[10px] text-[#8c7462] font-mono mt-1">
            <span className="text-[#1e6b37] font-semibold">{stats.winningTrades}W</span> •{' '}
            <span className="text-[#b93829] font-semibold">{stats.losingTrades}L</span> •{' '}
            <span className="text-[#7d695b]">{stats.breakEvenTrades}BE</span>
          </div>
        </div>

        {/* Card 3: Profit Factor */}
        <div className="bg-white border border-[#e8dfd5] rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#7d695b] text-[10px] sm:text-[11px] mb-1">
            <span>Profit Factor</span>
            <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#92400e] shrink-0" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-mono text-[#78350f] tracking-tight">
            {stats.profitFactor}
          </div>
          <div className="text-[9px] sm:text-[10px] text-[#8c7462] font-mono mt-1">
            Target: &gt; 1.80
          </div>
        </div>

        {/* Card 4: Expectancy */}
        <div className="bg-white border border-[#e8dfd5] rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#7d695b] text-[10px] sm:text-[11px] mb-1">
            <span>Avg Expectancy</span>
            <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#b45309]" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-mono text-[#1e6b37] tracking-tight">
            +${stats.expectancy.toFixed(2)}
          </div>
          <div className="text-[9px] sm:text-[10px] text-[#8c7462] font-mono mt-1">
            Per Trade Edge
          </div>
        </div>

        {/* Card 5: Max Drawdown */}
        <div className="bg-white border border-[#e8dfd5] rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#7d695b] text-[10px] sm:text-[11px] mb-1">
            <span>Max Drawdown</span>
            <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#b93829]" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-mono text-[#b93829] tracking-tight">
            -${stats.maxDrawdown.toFixed(2)}
          </div>
          <div className="text-[9px] sm:text-[10px] text-[#8c7462] font-mono mt-1">
            Peak Drop: {stats.maxDrawdownPct}%
          </div>
        </div>

        {/* Card 6: Streak */}
        <div className="bg-white border border-[#e8dfd5] rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#7d695b] text-[10px] sm:text-[11px] mb-1">
            <span>Streak Record</span>
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#78350f]" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-mono text-[#281d16] tracking-tight">
            {stats.currentStreak.count}{' '}
            <span className={stats.currentStreak.type === 'win' ? 'text-[#1e6b37]' : 'text-[#b93829]'}>
              {stats.currentStreak.type.toUpperCase()}
            </span>
          </div>
          <div className="text-[9px] sm:text-[10px] text-[#8c7462] font-mono mt-1">
            Best Win: {stats.largestWinStreak}W
          </div>
        </div>
      </div>

      {/* Monthly P&L Target Tracker */}
      <MonthlyTargetTracker
        trades={trades}
        startingBalance={startingBalance}
        userId={userId}
        initialTargetAmount={monthlyTargetAmount}
        initialTargetType={monthlyTargetType}
        onTargetChange={onTargetChange}
      />

      {/* Main Row: Equity Curve Chart */}
      <EquityChart data={equityData} startingBalance={startingBalance} />

      {/* Row: Calendar Heatmap and Recent Trades side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Calendar Heatmap */}
        <div className="lg:col-span-7">
          <CalendarHeatmap trades={trades} onSelectDate={onSelectDate} />
        </div>

        {/* Right: Recent Trades Quick Stream */}
        <div className="lg:col-span-5 bg-white border border-[#e8dfd5] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#ede6dc] pb-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#634832]">
                Recent Executions
              </h3>
              <div className="flex items-center gap-2">
                {onOpenBinanceSync && (
                  <button
                    onClick={onOpenBinanceSync}
                    className="px-2 py-0.5 text-xs font-bold bg-[#fef3c7] hover:bg-[#fde68a] text-[#92400e] border border-[#fde68a] rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                    title="Import or sync from Binance"
                  >
                    <Zap className="w-3 h-3 fill-[#d97706]" />
                    <span>Sync Binance</span>
                  </button>
                )}
                <button
                  onClick={() => onNavigateToTab('journal')}
                  className="text-xs text-[#78350f] hover:text-[#50230a] flex items-center gap-1 font-semibold transition cursor-pointer"
                >
                  <span>View Full Journal</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {recentTrades.length === 0 ? (
                <div className="p-6 bg-[#fcfaf7] rounded-xl border border-dashed border-[#ddcfbf] text-center">
                  <div className="w-10 h-10 rounded-full bg-[#f4ebe1] flex items-center justify-center mx-auto mb-2 text-[#78350f]">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-[#281d16] text-xs">Your journal is ready</h4>
                  <p className="text-[11px] text-[#7d695b] mt-1 max-w-xs mx-auto">
                    Log your first trade or import broker statements to activate performance metrics.
                  </p>
                  <div className="mt-3.5 flex items-center justify-center gap-2 flex-wrap">
                    <button
                      onClick={onAddTrade}
                      className="px-3 py-1.5 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Trade</span>
                    </button>
                    {onOpenBinanceSync && (
                      <button
                        onClick={onOpenBinanceSync}
                        className="px-3 py-1.5 bg-[#fef3c7] hover:bg-[#fde68a] text-[#92400e] text-xs font-bold rounded-lg border border-[#fde68a] transition shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <Zap className="w-3.5 h-3.5 fill-[#d97706]" />
                        <span>Sync Binance</span>
                      </button>
                    )}
                    {onLoadDemoTrades && (
                      <button
                        onClick={onLoadDemoTrades}
                        className="px-3 py-1.5 bg-[#f4ebe1] hover:bg-[#e8dbcc] text-[#78350f] text-xs font-semibold rounded-lg border border-[#d2bfad] transition cursor-pointer"
                      >
                        Load Sample Data
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                recentTrades.map((trade) => {
                  const isWin = trade.outcome === 'win';
                  const isLoss = trade.outcome === 'loss';
                  return (
                    <div
                      key={trade.id}
                      className="p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc] hover:border-[#dfd3c5] transition flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#281d16] text-sm">{trade.symbol}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              trade.direction === 'long'
                                ? 'bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb]'
                                : 'bg-[#fef2f2] text-[#b93829] border border-[#fecaca]'
                            }`}
                          >
                            {trade.direction}
                          </span>
                          <span className="text-[#8c7462] font-mono text-[11px]">{trade.date}</span>
                        </div>
                        <div className="text-[11px] text-[#7d695b] mt-0.5 truncate max-w-[200px]">
                          {trade.strategy}
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div
                          className={`font-bold text-sm ${
                            isWin ? 'text-[#1e6b37]' : isLoss ? 'text-[#b93829]' : 'text-[#7d695b]'
                          }`}
                        >
                          {formatPnL(trade.netPnl)}
                        </div>
                        <div className="text-[10px] text-[#8c7462]">
                          {trade.realizedRR >= 0 ? '+' : ''}{trade.realizedRR}R
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick AI Coaching Callout */}
          <div className="mt-4 pt-4 border-t border-[#ede6dc] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#7d695b]">
              <Sparkles className="w-4 h-4 text-[#78350f]" />
              <span>Ask AI Coach to review this week</span>
            </div>
            <button
              onClick={() => onNavigateToTab('support')}
              className="px-3 py-1 bg-[#f5ede4] hover:bg-[#ede1d3] text-[#78350f] text-xs font-semibold rounded-lg border border-[#dac6b3] transition cursor-pointer"
            >
              Audit Journal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
