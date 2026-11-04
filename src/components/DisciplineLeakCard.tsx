import React, { useMemo } from 'react';
import { Trade } from '../types/trade';
import {
  ShieldAlert,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Flame,
  CheckCircle2,
  DollarSign,
  Scale,
} from 'lucide-react';
import { formatPnL } from '../utils/formatters';

interface DisciplineLeakCardProps {
  trades: Trade[];
  onNavigateToJournalWithFilter?: (filterMistake: string) => void;
  onNavigateToTab: (tab: 'dashboard' | 'journal' | 'review' | 'calculator' | 'playbook' | 'analytics' | 'news') => void;
}

export const DisciplineLeakCard: React.FC<DisciplineLeakCardProps> = ({
  trades,
  onNavigateToJournalWithFilter,
  onNavigateToTab,
}) => {
  const closedTrades = useMemo(() => trades.filter((t) => t.status === 'closed'), [trades]);

  const {
    disciplinedTrades,
    leakedTrades,
    totalLeakDollarLoss,
    disciplinedWinRate,
    leakedWinRate,
    disciplinedNetPnl,
    leaksBreakdown,
    potentialNetPnl,
  } = useMemo(() => {
    const disciplined: Trade[] = [];
    const leaked: Trade[] = [];

    const leakMap: Record<string, { count: number; totalLoss: number }> = {};

    closedTrades.forEach((t) => {
      const isClean = (!t.mistake || t.mistake === 'Followed Plan') &&
        (t.emotion === 'Disciplined' || t.emotion === 'Patient');

      if (isClean) {
        disciplined.push(t);
      } else {
        leaked.push(t);
        const leakName = t.mistake && t.mistake !== 'Followed Plan'
          ? t.mistake
          : t.emotion;

        if (!leakMap[leakName]) {
          leakMap[leakName] = { count: 0, totalLoss: 0 };
        }
        leakMap[leakName].count += 1;
        if (t.netPnl < 0) {
          leakMap[leakName].totalLoss += Math.abs(t.netPnl);
        }
      }
    });

    const discWins = disciplined.filter((t) => t.netPnl > 0).length;
    const discWinRate = disciplined.length > 0 ? (discWins / disciplined.length) * 100 : 0;
    const discNet = disciplined.reduce((sum, t) => sum + t.netPnl, 0);

    const leakWins = leaked.filter((t) => t.netPnl > 0).length;
    const leakWinRate = leaked.length > 0 ? (leakWins / leaked.length) * 100 : 0;

    const totalLoss = leaked
      .filter((t) => t.netPnl < 0)
      .reduce((sum, t) => sum + Math.abs(t.netPnl), 0);

    const breakdown = Object.entries(leakMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalLoss - a.totalLoss);

    const actualNetPnl = closedTrades.reduce((sum, t) => sum + t.netPnl, 0);
    const potential = actualNetPnl + totalLoss;

    return {
      disciplinedTrades: disciplined,
      leakedTrades: leaked,
      totalLeakDollarLoss: totalLoss,
      disciplinedWinRate: Number(discWinRate.toFixed(1)),
      leakedWinRate: Number(leakWinRate.toFixed(1)),
      disciplinedNetPnl: discNet,
      leaksBreakdown: breakdown,
      potentialNetPnl: potential,
    };
  }, [closedTrades]);

  if (closedTrades.length === 0) return null;

  return (
    <div className="bg-white border border-[#e8dfd5] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f0e8de] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#fff1f0] border border-[#ffccc7] flex items-center justify-center text-[#cf1322]">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#281d16] flex items-center gap-1.5">
              <span>Execution Leaks &amp; Behavioral Cost</span>
            </h2>
            <p className="text-[11px] text-[#8c7462]">
              Direct dollar loss attributed to emotional slips, chasing, and moving stops
            </p>
          </div>
        </div>

        {totalLeakDollarLoss > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] font-mono text-[#8c7462]">Capital Leaked:</span>
            <span className="font-mono text-sm sm:text-base font-extrabold text-[#c62828]">
              -${totalLeakDollarLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {/* Comparison Grid: Disciplined vs Leaked */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Metric 1: Clean Execution Win Rate */}
        <div className="bg-[#f7faf7] border border-[#d4ebd5] rounded-xl p-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#2e7d32] font-semibold">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Followed Plan
            </span>
            <span className="font-mono">{disciplinedTrades.length} trades</span>
          </div>
          <div className="text-xl font-extrabold font-mono text-[#1e6b37]">
            {disciplinedWinRate}% Win Rate
          </div>
          <p className="text-[10px] text-[#4c7850]">
            Net P&amp;L: {formatPnL(disciplinedNetPnl)} when executing without emotional errors.
          </p>
        </div>

        {/* Metric 2: Rule Broken Win Rate */}
        <div className="bg-[#fff8f7] border border-[#ffddd8] rounded-xl p-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#c62828] font-semibold">
            <span className="flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              Plan Violated / Leaked
            </span>
            <span className="font-mono">{leakedTrades.length} trades</span>
          </div>
          <div className="text-xl font-extrabold font-mono text-[#c62828]">
            {leakedWinRate}% Win Rate
          </div>
          <p className="text-[10px] text-[#8c5048]">
            Trades entered on FOMO, revenge, or widened stops carry negative expectancy.
          </p>
        </div>

        {/* Metric 3: Pure Edge Potential */}
        <div className="bg-gradient-to-br from-[#faf6f0] to-[#f4ebe1] border border-[#dac6b3] rounded-xl p-3 space-y-1">
          <div className="text-xs text-[#78350f] font-semibold flex items-center justify-between">
            <span>Potential with Clean Discipline</span>
            <Scale className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold font-mono text-[#78350f]">
            {formatPnL(potentialNetPnl)}
          </div>
          <p className="text-[10px] text-[#7d695b]">
            Your realized P&amp;L if you eliminated emotional mistake trades completely.
          </p>
        </div>
      </div>

      {/* Top Mistake Leaks Breakdown */}
      {leaksBreakdown.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6e5849]">
            <span>Top Mistake Categories by Capital Drain</span>
            <span className="text-[11px] font-mono text-[#8c7462]">Click mistake to audit in journal</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {leaksBreakdown.slice(0, 3).map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (onNavigateToJournalWithFilter) {
                    onNavigateToJournalWithFilter(item.name);
                  } else {
                    onNavigateToTab('journal');
                  }
                }}
                className="text-left bg-[#fcfaf7] hover:bg-[#f6efe6] border border-[#e8dfd5] hover:border-[#b45309] rounded-xl p-2.5 transition flex items-center justify-between gap-2 cursor-pointer group"
              >
                <div className="space-y-0.5 truncate">
                  <div className="text-xs font-bold text-[#281d16] group-hover:text-[#78350f] truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] font-mono text-[#8c7462]">
                    {item.count} {item.count === 1 ? 'incident' : 'incidents'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-[#c62828]">
                    -${item.totalLoss.toFixed(0)}
                  </div>
                  <div className="text-[9px] text-[#78350f] flex items-center gap-0.5 justify-end">
                    <span>Audit</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
