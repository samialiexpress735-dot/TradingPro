import React, { useMemo } from 'react';
import { Trade, PerformanceStats } from '../types/trade';
import { calculateDisciplineMetrics } from '../utils/calculations';
import {
  Brain,
  TrendingUp,
  Clock,
  PieChart,
  BarChart2,
  AlertTriangle,
  Award,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  ShieldAlert,
  Flame,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface AnalyticsViewProps {
  trades: Trade[];
  stats: PerformanceStats;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ trades, stats }) => {
  const closedTrades = useMemo(() => trades.filter((t) => t.status === 'closed'), [trades]);
  const disciplineMetrics = useMemo(() => calculateDisciplineMetrics(trades), [trades]);

  // Breakdown by Emotion
  const emotionStats = useMemo(() => {
    const map = new Map<string, { count: number; wins: number; netPnl: number }>();
    closedTrades.forEach((t) => {
      const e = t.emotion || 'Disciplined';
      const curr = map.get(e) || { count: 0, wins: 0, netPnl: 0 };
      curr.count++;
      if (t.outcome === 'win') curr.wins++;
      curr.netPnl += t.netPnl;
      map.set(e, curr);
    });

    return Array.from(map.entries()).map(([emotion, data]) => ({
      emotion,
      count: data.count,
      netPnl: Number(data.netPnl.toFixed(2)),
      winRate: data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0,
    }));
  }, [closedTrades]);

  // Breakdown by Asset Class
  const assetStats = useMemo(() => {
    const map = new Map<string, { count: number; wins: number; netPnl: number }>();
    closedTrades.forEach((t) => {
      const a = t.assetClass;
      const curr = map.get(a) || { count: 0, wins: 0, netPnl: 0 };
      curr.count++;
      if (t.outcome === 'win') curr.wins++;
      curr.netPnl += t.netPnl;
      map.set(a, curr);
    });

    return Array.from(map.entries()).map(([asset, data]) => ({
      asset,
      count: data.count,
      netPnl: Number(data.netPnl.toFixed(2)),
      winRate: data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0,
    }));
  }, [closedTrades]);

  // Breakdown by Market Session
  const sessionStats = useMemo(() => {
    const map = new Map<string, { count: number; wins: number; netPnl: number }>();
    closedTrades.forEach((t) => {
      const s = t.marketSession || 'Market Open (NY)';
      const curr = map.get(s) || { count: 0, wins: 0, netPnl: 0 };
      curr.count++;
      if (t.outcome === 'win') curr.wins++;
      curr.netPnl += t.netPnl;
      map.set(s, curr);
    });

    return Array.from(map.entries()).map(([session, data]) => ({
      session,
      count: data.count,
      netPnl: Number(data.netPnl.toFixed(2)),
      winRate: data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0,
    }));
  }, [closedTrades]);

  // Leak remedies advice mapping
  const leakRemedies: Record<string, string> = {
    'Moved Stop Loss': 'Use hard bracket orders on order entry. Never touch stop once filled.',
    'Chased Entry': 'Wait for the pull-back to VWAP or EMA. Better to miss a trade than chase extended risk.',
    'Overleveraged': 'Cap position risk at 1-2% of account equity in the Risk Sizer tool.',
    'Held Loser Too Long': 'Respect planned invalidation. First loss is always the cheapest loss.',
    'Exited Too Early': 'Trail stop behind prior 5-minute swing low/high instead of watching 1-minute ticker.',
    'News Gamble': 'Flat all positions 5 minutes prior to FOMC, CPI, and NFP announcements.',
    'No Stop Loss': 'Refuse to pull the trigger without predefined catastrophic stop in market.',
    'Revenge Trade': 'Enforce mandatory 30-minute lockout rule after taking 2 consecutive losses.',
    'Ignored HTF Trend': 'Check the 4-Hour and Daily charts before taking intraday breakout triggers.',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface border border-line rounded-3xl p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sunken text-brand rounded-2xl border border-line-brand">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink tracking-tight">Advanced Quantitative Analytics</h2>
            <p className="text-xs text-muted mt-0.5">
              Identify behavioral leaks, mistake costs, session edges, risk asymmetry, and disciplined alpha.
            </p>
          </div>
        </div>
      </div>

      {/* Row 1: Cost of Mistakes & Disciplined Alpha Engine */}
      <div className="bg-surface border border-line rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-loss-bg text-loss rounded-xl border border-loss-line">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">Cost of Mistakes &amp; Execution Leaks</h3>
              <p className="text-xs text-muted">
                Quantifying the exact dollar toll of emotional undisciplined execution.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold bg-profit-bg text-profit border border-profit-line px-3 py-1 rounded-full flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Followed Plan WR: {disciplineMetrics.followedPlanWinRate}%
          </span>
        </div>

        {/* 3 High-Impact Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-canvas border border-line-soft rounded-2xl p-4">
            <span className="text-xs text-faint font-medium block mb-1">Total Mistake Losses</span>
            <div className="text-2xl font-bold font-mono text-loss">
              -${disciplineMetrics.totalMistakeCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-faint mt-1">
              Direct capital forfeited to rule breaches and emotional trading.
            </p>
          </div>

          <div className="bg-canvas border border-line-soft rounded-2xl p-4">
            <span className="text-xs text-faint font-medium block mb-1">Discipline Win Rate Edge</span>
            <div className="text-2xl font-bold font-mono text-ink flex items-center gap-2">
              <span className="text-profit">{disciplineMetrics.followedPlanWinRate}%</span>
              <span className="text-faint text-sm font-normal">vs</span>
              <span className="text-loss">{disciplineMetrics.deviatedWinRate}%</span>
            </div>
            <p className="text-[11px] text-faint mt-1">
              Win rate when following rules vs when breaking trading rules.
            </p>
          </div>

          <div className="bg-canvas border border-line-soft rounded-2xl p-4">
            <span className="text-xs text-faint font-medium block mb-1">Discipline Alpha (What-If)</span>
            <div className="text-2xl font-bold font-mono text-profit">
              +${disciplineMetrics.potentialDisciplinedGain.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-faint mt-1">
              Additional portfolio value if execution was 100% disciplined.
            </p>
          </div>
        </div>

        {/* Leak Leaderboard */}
        {disciplineMetrics.topLeaks.length > 0 ? (
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-ink block uppercase tracking-wider font-mono">
              Top Behavioral Leaks Ranked by Capital Lost:
            </span>
            <div className="border border-line rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas text-muted border-b border-line font-mono text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Mistake Category</th>
                    <th className="py-2.5 px-3 text-right">Trades</th>
                    <th className="py-2.5 px-3 text-right">Win Rate</th>
                    <th className="py-2.5 px-3 text-right">Total Lost</th>
                    <th className="py-2.5 px-3 text-right">Avg Cost / Event</th>
                    <th className="py-2.5 px-3">Remedy &amp; Rule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft bg-surface">
                  {disciplineMetrics.topLeaks.map((leak) => (
                    <tr key={leak.mistake} className="hover:bg-canvas transition">
                      <td className="py-2.5 px-3 font-bold text-ink flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-loss" />
                        {leak.mistake}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-ink-soft">{leak.count}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-brand">{leak.winRate}%</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-loss">
                        -${leak.totalLost.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-faint">
                        -${Math.abs(leak.avgPnl).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-ink-soft max-w-xs">
                        {leakRemedies[leak.mistake] || 'Stick to pre-defined stop loss and setup rules.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-profit-bg border border-profit-line rounded-2xl text-xs text-profit flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Flawless execution! No rule violations or mistake losses logged in this dataset.</span>
          </div>
        )}
      </div>

      {/* Row 2: Expectancy & Risk Asymmetry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-line rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs mb-2">
            <span>Expectancy per Trade</span>
            <Target className="w-4 h-4 text-profit" />
          </div>
          <div className="text-2xl font-bold font-mono text-profit">
            +${stats.expectancy.toFixed(2)}
          </div>
          <p className="text-[11px] text-faint mt-1">
            Mathematical value expected each time you pull the trigger.
          </p>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs mb-2">
            <span>Avg Win vs Avg Loss</span>
            <TrendingUp className="w-4 h-4 text-brand" />
          </div>
          <div className="text-xl font-bold font-mono text-ink flex items-center gap-2">
            <span className="text-profit">${stats.averageWin}</span>
            <span className="text-faint text-sm font-normal">/</span>
            <span className="text-loss">${stats.averageLoss}</span>
          </div>
          <p className="text-[11px] text-faint mt-1">
            Win/Loss Ratio: <strong className="text-ink font-mono">{stats.winLossRatio} : 1</strong>
          </p>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs mb-2">
            <span>Max Drawdown</span>
            <AlertTriangle className="w-4 h-4 text-loss" />
          </div>
          <div className="text-2xl font-bold font-mono text-loss">
            -${stats.maxDrawdown.toFixed(2)}
          </div>
          <p className="text-[11px] text-faint mt-1">
            Max equity drop from high watermark ({stats.maxDrawdownPct}%).
          </p>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs mb-2">
            <span>Streaks</span>
            <Zap className="w-4 h-4 text-accent" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-ink flex items-center flex-wrap gap-x-1.5 sm:gap-x-2">
            <span className="text-profit">{stats.largestWinStreak}W Max</span>
            <span className="text-faint">•</span>
            <span className="text-loss">{stats.largestLossStreak}L Max</span>
          </div>
          <p className="text-[11px] text-faint mt-1">
            Current Streak:{' '}
            <strong
              className={
                stats.currentStreak.type === 'win'
                  ? 'text-profit'
                  : stats.currentStreak.type === 'loss'
                  ? 'text-loss'
                  : 'text-muted'
              }
            >
              {stats.currentStreak.count} {stats.currentStreak.type.toUpperCase()}
            </strong>
          </p>
        </div>
      </div>

      {/* Row 3: Psychology & Emotional Matrix */}
      <div className="bg-surface border border-line rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-sunken text-brand rounded-xl border border-line-brand">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink">Trading Psychology &amp; Mindset Leaks</h3>
            <p className="text-xs text-muted">
              Correlating emotional states with real monetary P&amp;L and win rate.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {emotionStats.map((item) => {
            const isGood = item.netPnl >= 0;
            return (
              <div
                key={item.emotion}
                className="p-4 rounded-xl bg-surface-alt border border-line-soft flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-ink block mb-0.5">{item.emotion}</span>
                  <span className="text-[11px] text-faint font-mono">
                    {item.count} trade{item.count > 1 ? 's' : ''} ({item.winRate}% Win)
                  </span>
                </div>
                <div className="text-right">
                  <div
                    className={`font-mono font-bold text-sm ${
                      isGood ? 'text-profit' : 'text-loss'
                    }`}
                  >
                    {isGood ? '+' : ''}${item.netPnl.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 4: Asset Class & Session Edge */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Class Matrix */}
        <div className="bg-surface border border-line rounded-2xl p-6 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-brand" />
            <span>Performance by Asset Class</span>
          </h3>
          <div className="space-y-3">
            {assetStats.map((item) => (
              <div
                key={item.asset}
                className="p-3 bg-surface-alt rounded-xl border border-line-soft flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-ink uppercase font-mono">{item.asset}</span>
                  <span className="text-faint ml-2 font-mono">({item.count} trades)</span>
                </div>
                <div className="flex items-center gap-4 font-mono">
                  <span className="text-muted">{item.winRate}% WR</span>
                  <span
                    className={`font-bold ${
                      item.netPnl >= 0 ? 'text-profit' : 'text-loss'
                    }`}
                  >
                    {item.netPnl >= 0 ? '+' : '-'}${Math.abs(item.netPnl).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Market Session Matrix */}
        <div className="bg-surface border border-line rounded-2xl p-6 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand" />
            <span>Performance by Market Session</span>
          </h3>
          <div className="space-y-3">
            {sessionStats.map((item) => (
              <div
                key={item.session}
                className="p-3 bg-surface-alt rounded-xl border border-line-soft flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-ink">{item.session}</span>
                  <span className="text-faint ml-2 font-mono">({item.count} trades)</span>
                </div>
                <div className="flex items-center gap-4 font-mono">
                  <span className="text-muted">{item.winRate}% WR</span>
                  <span
                    className={`font-bold ${
                      item.netPnl >= 0 ? 'text-profit' : 'text-loss'
                    }`}
                  >
                    {item.netPnl >= 0 ? '+' : '-'}${Math.abs(item.netPnl).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
