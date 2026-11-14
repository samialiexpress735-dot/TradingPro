import React from 'react';
import { Trade, PerformanceStats, EquityPoint } from '../types/trade';
import { EquityChart } from './EquityChart';
import { CalendarHeatmap } from './CalendarHeatmap';
import { MonthlyTargetTracker } from './MonthlyTargetTracker';
import { DisciplineLeakCard } from './DisciplineLeakCard';
import { DailyLossLimitCard } from './DailyLossLimitCard';
import { DailyLossLimitState } from '../hooks/useDailyLossLimit';
import { formatPnL, formatSmartAmount } from '../utils/formatters';
import { AdSenseBanner } from './AdSenseBanner';
import { StatCard } from './StatCard';
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
  Wallet,
  Globe,
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
  dailyLimit?: DailyLossLimitState;
  onAddTrade: () => void;
  onOpenChecklist: () => void;
  onNavigateToTab: (tab: 'dashboard' | 'journal' | 'review' | 'calculator' | 'playbook' | 'analytics' | 'news') => void;
  onNavigateToJournalWithFilter?: (filterMistake: string) => void;
  onSelectDate: (date: string) => void;
  onLoadDemoTrades?: () => void;
  onOpenBinanceSync?: () => void;
  onOpenDepositModal?: () => void;
  adSensePublisherId?: string;
  adSenseSlotId?: string;
  adSenseEnabled?: boolean;
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
  dailyLimit,
  onAddTrade,
  onOpenChecklist,
  onNavigateToTab,
  onNavigateToJournalWithFilter,
  onSelectDate,
  onLoadDemoTrades,
  onOpenBinanceSync,
  onOpenDepositModal,
  adSensePublisherId,
  adSenseSlotId,
  adSenseEnabled,
}) => {
  const isNetPositive = stats.netProfit >= 0;
  const recentTrades = trades.slice(0, 5);
  const hasClosed = trades.some((t) => t.status === 'closed');

  return (
    <div className="space-y-5 sm:space-y-7">
      {/* Page header: title on the left, only the actions that are NOT in the main nav on the right */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">Dashboard</h1>
            <span className="px-2 py-0.5 rounded-full bg-profit-bg text-profit text-[10px] font-mono border border-profit-line font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-profit-solid animate-pulse" />
              LIVE
            </span>
          </div>
          <p className="text-xs sm:text-[13px] text-muted mt-1">
            Realized performance across all accounts and strategies.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenDepositModal && (
            <button
              onClick={onOpenDepositModal}
              className="h-9 px-3 bg-surface hover:bg-sunken text-ink-soft text-xs font-semibold rounded-lg border border-line-strong flex items-center gap-1.5 transition cursor-pointer"
              title="Deposit or withdraw simulated paper funds"
            >
              <Wallet className="w-3.5 h-3.5 text-faint shrink-0" />
              <span>Deposit / Withdraw</span>
            </button>
          )}
          <button
            onClick={onOpenChecklist}
            className="h-9 px-3 bg-surface hover:bg-sunken text-ink-soft text-xs font-semibold rounded-lg border border-line-strong flex items-center gap-1.5 transition cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-profit shrink-0" />
            <span>Checklist</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3.5">
        <StatCard
          label="Net Realized P&L"
          icon={isNetPositive ? <TrendingUp className="text-profit" /> : <TrendingDown className="text-loss" />}
          value={`${isNetPositive ? '+' : '-'}$${Math.abs(stats.netProfit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          valueClassName={isNetPositive ? 'text-profit' : 'text-loss'}
          sub={`Gross: $${formatSmartAmount(stats.grossProfit)} / -$${formatSmartAmount(stats.grossLoss)}`}
        />
        <StatCard
          label="Win Rate"
          icon={<Award className="text-brand" />}
          value={`${stats.winRate}%`}
          sub={
            <>
              <span className="text-profit font-semibold">{stats.winningTrades}W</span> •{' '}
              <span className="text-loss font-semibold">{stats.losingTrades}L</span> •{' '}
              <span className="text-muted">{stats.breakEvenTrades}BE</span>
            </>
          }
        />
        <StatCard
          label="Profit Factor"
          icon={<Target className="text-brand" />}
          value={stats.profitFactor}
          valueClassName="text-brand"
          sub="Target: > 1.80"
        />
        <StatCard
          label="Avg Expectancy"
          icon={<Zap className="text-accent" />}
          value={`${stats.expectancy >= 0 ? '+' : '-'}$${Math.abs(stats.expectancy).toFixed(2)}`}
          valueClassName={stats.expectancy >= 0 ? 'text-profit' : 'text-loss'}
          sub="Per Trade Edge"
        />
        <StatCard
          label="Max Drawdown"
          icon={<AlertTriangle className="text-loss" />}
          value={`-$${stats.maxDrawdown.toFixed(2)}`}
          valueClassName="text-loss"
          sub={`Peak Drop: ${stats.maxDrawdownPct}%`}
        />
        <StatCard
          label="Streak Record"
          icon={<Sparkles className="text-brand" />}
          value={
            <>
              {stats.currentStreak.count}{' '}
              <span className={stats.currentStreak.type === 'win' ? 'text-profit' : 'text-loss'}>
                {stats.currentStreak.type.toUpperCase()}
              </span>
            </>
          }
          sub={`Best Win: ${stats.largestWinStreak}W`}
        />
      </div>

      {/* Daily loss limit: slim full-width guard rail */}
      {dailyLimit && <DailyLossLimitCard limit={dailyLimit} />}

      {/* Main area: equity curve (wide) beside today's risk + latest executions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
        <div className="lg:col-span-8 min-w-0 flex flex-col">
      {/* Main Row: Equity Curve Chart */}
      <EquityChart data={equityData} startingBalance={startingBalance} />
        </div>

        <div className="lg:col-span-4 min-w-0 flex flex-col gap-4 sm:gap-6">
        {/* Latest executions */}
        <div className="flex-1 bg-surface border border-line rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line-soft pb-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                Recent Executions
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {onOpenBinanceSync && (
                  <button
                    onClick={onOpenBinanceSync}
                    className="px-2 py-0.5 text-xs font-bold bg-warn-bg hover:bg-warn-bg text-brand border border-warn-line rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs shrink-0"
                    title="Import or sync from Binance"
                  >
                    <Zap className="w-3 h-3 fill-accent" />
                    <span>Sync Binance</span>
                  </button>
                )}
                <button
                  onClick={() => onNavigateToTab('journal')}
                  className="text-xs text-brand hover:text-ink flex items-center gap-1 font-semibold transition cursor-pointer shrink-0"
                >
                  <span>
                    <span className="hidden sm:inline">View Full </span>Journal
                  </span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {recentTrades.length === 0 ? (
                <div className="p-6 bg-surface-alt rounded-xl border border-dashed border-line-strong text-center">
                  <div className="w-10 h-10 rounded-full bg-sunken flex items-center justify-center mx-auto mb-2 text-brand">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-ink text-xs">Your journal is ready</h4>
                  <p className="text-[11px] text-muted mt-1 max-w-xs mx-auto">
                    Log your first trade or import broker statements to activate performance metrics.
                  </p>
                  <div className="mt-3.5 flex items-center justify-center gap-2 flex-wrap">
                    <button
                      onClick={onAddTrade}
                      className="px-3 py-1.5 bg-brand-solid hover:bg-brand-solid-hover text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Trade</span>
                    </button>
                    {onOpenBinanceSync && (
                      <button
                        onClick={onOpenBinanceSync}
                        className="px-3 py-1.5 bg-warn-bg hover:bg-warn-bg text-brand text-xs font-bold rounded-lg border border-warn-line transition shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <Zap className="w-3.5 h-3.5 fill-accent" />
                        <span>Sync Binance</span>
                      </button>
                    )}
                    {onLoadDemoTrades && (
                      <button
                        onClick={onLoadDemoTrades}
                        className="px-3 py-1.5 bg-sunken hover:bg-line text-brand text-xs font-semibold rounded-lg border border-line-brand transition cursor-pointer"
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
                      className="p-3 bg-surface-alt rounded-xl border border-line-soft hover:border-line-strong transition flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-ink text-sm">{trade.symbol}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              trade.direction === 'long'
                                ? 'bg-profit-bg text-profit border border-profit-line'
                                : 'bg-loss-bg text-loss border border-loss-line'
                            }`}
                          >
                            {trade.direction}
                          </span>
                          <span className="text-faint font-mono text-[11px]">{trade.date}</span>
                        </div>
                        <div className="text-[11px] text-muted mt-0.5 truncate max-w-[200px]">
                          {trade.strategy}
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div
                          className={`font-bold text-sm ${
                            isWin ? 'text-profit' : isLoss ? 'text-loss' : 'text-muted'
                          }`}
                        >
                          {formatPnL(trade.netPnl)}
                        </div>
                        <div className="text-[10px] text-faint">
                          {trade.realizedRR >= 0 ? '+' : ''}{trade.realizedRR}R
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Market Catalyst Intelligence Callout */}
          <div className="mt-4 pt-4 border-t border-line-soft flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Zap className="w-4 h-4 text-accent" />
              <span>High-impact catalysts can spike volatility</span>
            </div>
            <button
              onClick={() => onNavigateToTab('news')}
              className="px-3 py-1 bg-sunken hover:bg-line text-brand text-xs font-semibold rounded-lg border border-line-brand transition cursor-pointer"
            >
              Analyze News Catalysts
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Second row: when you trade (calendar) beside what it costs you (execution leaks) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
        <div className={`${hasClosed ? 'lg:col-span-7' : 'lg:col-span-12'} min-w-0`}>
          <CalendarHeatmap trades={trades} onSelectDate={onSelectDate} />
        </div>
        {hasClosed && (
          <div className="lg:col-span-5 min-w-0 flex flex-col [&>*]:flex-1">
            <DisciplineLeakCard
        trades={trades}
        onNavigateToTab={onNavigateToTab}
        onNavigateToJournalWithFilter={onNavigateToJournalWithFilter}
      />
          </div>
        )}
      </div>

      {/* Goal tracker */}
      <MonthlyTargetTracker
        trades={trades}
        startingBalance={startingBalance}
        userId={userId}
        initialTargetAmount={monthlyTargetAmount}
        initialTargetType={monthlyTargetType}
        onTargetChange={onTargetChange}
      />

      {/* Google AdSense Responsive Leaderboard Display Unit */}
      <AdSenseBanner
        publisherId={adSensePublisherId || 'pub-1549023438906458'}
        slotId={adSenseSlotId}
        enabled={adSenseEnabled ?? true}
      />
    </div>
  );
};
