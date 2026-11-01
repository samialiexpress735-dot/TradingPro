import React, { useState, useMemo } from 'react';
import { Strategy, Trade } from '../types/trade';
import {
  Layers,
  Plus,
  CheckCircle2,
  TrendingUp,
  Percent,
  BarChart3,
  ListChecks,
  Edit3,
  Trash2,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

interface StrategyPlaybookProps {
  strategies: Strategy[];
  trades: Trade[];
  onAddStrategy: (strategy: Strategy) => void;
  onUpdateStrategy: (strategy: Strategy) => void;
  onDeleteStrategy: (id: string) => void;
}

export const StrategyPlaybook: React.FC<StrategyPlaybookProps> = ({
  strategies,
  trades,
  onAddStrategy,
  onUpdateStrategy,
  onDeleteStrategy,
}) => {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(strategies[0]?.id || '');
  const [isCreating, setIsCreating] = useState(false);
  const [newStratName, setNewStratName] = useState('');
  const [newStratDesc, setNewStratDesc] = useState('');
  const [newStratRules, setNewStratRules] = useState('');
  const [newStratColor, setNewStratColor] = useState('#10b981');

  // Compute performance metrics for each strategy
  const strategyStats = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        wins: number;
        losses: number;
        netPnl: number;
        winRate: number;
        profitFactor: number;
        avgRR: number;
        bestTrade: number;
      }
    >();

    strategies.forEach((s) => {
      const stratTrades = trades.filter((t) => t.strategy === s.name && t.status === 'closed');
      const total = stratTrades.length;
      const wins = stratTrades.filter((t) => t.outcome === 'win').length;
      const losses = stratTrades.filter((t) => t.outcome === 'loss').length;
      const netPnl = stratTrades.reduce((acc, t) => acc + t.netPnl, 0);
      const grossWins = stratTrades.filter((t) => t.netPnl > 0).reduce((acc, t) => acc + t.netPnl, 0);
      const grossLosses = stratTrades.filter((t) => t.netPnl < 0).reduce((acc, t) => acc + Math.abs(t.netPnl), 0);
      const winRate = total > 0 ? (wins / total) * 100 : 0;
      const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? 99 : 0;
      const avgRR =
        total > 0
          ? stratTrades.reduce((acc, t) => acc + (t.realizedRR || 0), 0) / total
          : 0;
      const bestTrade = stratTrades.length > 0 ? Math.max(...stratTrades.map((t) => t.netPnl)) : 0;

      map.set(s.id, {
        total,
        wins,
        losses,
        netPnl: Number(netPnl.toFixed(2)),
        winRate: Number(winRate.toFixed(1)),
        profitFactor: Number(profitFactor.toFixed(2)),
        avgRR: Number(avgRR.toFixed(2)),
        bestTrade: Number(bestTrade.toFixed(2)),
      });
    });

    return map;
  }, [strategies, trades]);

  const activeStrategy = strategies.find((s) => s.id === selectedStrategyId) || strategies[0];
  const activeStats = activeStrategy ? strategyStats.get(activeStrategy.id) : null;
  const activeTrades = activeStrategy
    ? trades.filter((t) => t.strategy === activeStrategy.name)
    : [];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStratName.trim()) return;

    const rules = newStratRules
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const newStrategy: Strategy = {
      id: `strat-${Date.now()}`,
      name: newStratName.trim(),
      description: newStratDesc.trim(),
      color: newStratColor,
      rules: rules.length > 0 ? rules : ['Follow trading plan strictly', 'Adhere to 1-2% risk limit'],
    };

    onAddStrategy(newStrategy);
    setSelectedStrategyId(newStrategy.id);
    setIsCreating(false);
    setNewStratName('');
    setNewStratDesc('');
    setNewStratRules('');
  };

  return (
    <div className="space-y-6">
      {/* Playbook Header */}
      <div className="bg-white border border-[#e8dfd5] rounded-2xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#f5ede4] text-[#78350f] rounded-2xl border border-[#debfa8]">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#281d16] tracking-tight">Strategy Playbook &amp; Edge Analytics</h2>
            <p className="text-xs text-[#7d695b] mt-0.5">
              Tag setups, enforce high-probability rules checklists, and measure your mathematical edge per strategy.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Strategy Setup</span>
        </button>
      </div>

      {/* Main Grid: Left Strategy List, Right Strategy Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Strategy Cards */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-xs font-bold text-[#634832] uppercase tracking-wider px-1">
            Active Setups ({strategies.length})
          </h3>

          <div className="space-y-2.5">
            {strategies.map((strat) => {
              const stats = strategyStats.get(strat.id);
              const isSelected = strat.id === selectedStrategyId;

              return (
                <div
                  key={strat.id}
                  onClick={() => setSelectedStrategyId(strat.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#f5ede4]/70 border-[#78350f] shadow-xs'
                      : 'bg-white border-[#e8dfd5] hover:border-[#debfa8] hover:bg-[#fcfaf7]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: strat.color || '#78350f' }}
                      />
                      <span className="font-bold text-[#281d16] text-sm">{strat.name}</span>
                    </div>
                    <span className="text-xs font-mono text-[#8c7462]">{stats?.total || 0} trades</span>
                  </div>

                  <p className="text-xs text-[#7d695b] mt-2 line-clamp-2 leading-relaxed">
                    {strat.description}
                  </p>

                  {/* Micro stats ribbon */}
                  {stats && stats.total > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#ede6dc] text-[11px] font-mono">
                      <div>
                        <span className="text-[#8c7462] block text-[9px] uppercase font-sans">Net P&amp;L</span>
                        <span className={`font-bold ${stats.netPnl >= 0 ? 'text-[#1e6b37]' : 'text-[#b93829]'}`}>
                          {stats.netPnl >= 0 ? '+' : ''}${stats.netPnl.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8c7462] block text-[9px] uppercase font-sans">Win Rate</span>
                        <span className="text-[#281d16] font-bold">{stats.winRate}%</span>
                      </div>
                      <div>
                        <span className="text-[#8c7462] block text-[9px] uppercase font-sans">Profit Factor</span>
                        <span className="text-[#78350f] font-bold">{stats.profitFactor}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Strategy Playbook Rules & Deep Breakdown */}
        <div className="lg:col-span-7 space-y-5">
          {activeStrategy && (
            <div className="bg-white border border-[#e8dfd5] rounded-2xl p-6 shadow-xs space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[#ede6dc] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: activeStrategy.color }}
                    />
                    <h3 className="text-lg font-bold text-[#281d16]">{activeStrategy.name}</h3>
                  </div>
                  <p className="text-xs text-[#7d695b] mt-1">{activeStrategy.description}</p>
                </div>

                {strategies.length > 1 && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete strategy "${activeStrategy.name}"?`)) {
                        onDeleteStrategy(activeStrategy.id);
                        setSelectedStrategyId(strategies[0]?.id || '');
                      }
                    }}
                    className="p-1.5 text-[#8c7462] hover:text-[#b93829] hover:bg-[#ede6dc] rounded-lg transition cursor-pointer"
                    title="Delete strategy"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Strategy KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                  <span className="text-[10px] text-[#8c7462] uppercase font-sans block">Total Net P&amp;L</span>
                  <span
                    className={`text-base font-mono font-bold ${
                      (activeStats?.netPnl || 0) >= 0 ? 'text-[#1e6b37]' : 'text-[#b93829]'
                    }`}
                  >
                    {(activeStats?.netPnl || 0) >= 0 ? '+' : ''}${activeStats?.netPnl.toLocaleString() || '0.00'}
                  </span>
                </div>

                <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                  <span className="text-[10px] text-[#8c7462] uppercase font-sans block">Win Rate</span>
                  <span className="text-base font-mono font-bold text-[#281d16]">
                    {activeStats?.winRate || 0}%
                  </span>
                </div>

                <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                  <span className="text-[10px] text-[#8c7462] uppercase font-sans block">Profit Factor</span>
                  <span className="text-base font-mono font-bold text-[#78350f]">
                    {activeStats?.profitFactor || 0}
                  </span>
                </div>

                <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                  <span className="text-[10px] text-[#8c7462] uppercase font-sans block">Avg Realized R</span>
                  <span className="text-base font-mono font-bold text-[#1e6b37]">
                    +{activeStats?.avgRR || 0}R
                  </span>
                </div>
              </div>

              {/* Execution Rules Checklist */}
              <div>
                <h4 className="text-xs font-bold text-[#634832] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-[#78350f]" />
                  <span>Mandatory Pre-Trade Rules</span>
                </h4>
                <div className="space-y-2">
                  {activeStrategy.rules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#faf7f2] rounded-xl border border-[#e2d8cb] flex items-start gap-3 text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#1e6b37] shrink-0 mt-0.5" />
                      <span className="text-[#281d16] font-medium">{rule}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Trades for this setup */}
              <div>
                <h4 className="text-xs font-bold text-[#634832] uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Recent Executions for this setup</span>
                  <span className="text-[11px] font-mono text-[#8c7462]">{activeTrades.length} recorded</span>
                </h4>

                {activeTrades.length === 0 ? (
                  <div className="text-xs text-[#8c7462] italic p-4 bg-[#faf7f2] rounded-xl border border-[#e2d8cb]">
                    No trades logged under this setup yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {activeTrades.slice(0, 5).map((t) => (
                      <div
                        key={t.id}
                        className="p-2.5 bg-[#fcfaf7] rounded-xl border border-[#ede6dc] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#281d16]">{t.symbol}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              t.direction === 'long'
                                ? 'bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb]'
                                : 'bg-[#fef2f2] text-[#b93829] border border-[#fecaca]'
                            }`}
                          >
                            {t.direction}
                          </span>
                          <span className="text-[#8c7462] font-mono text-[11px]">{t.date}</span>
                        </div>
                        <div className="font-mono font-bold">
                          <span className={t.netPnl >= 0 ? 'text-[#1e6b37]' : 'text-[#b93829]'}>
                            {t.netPnl >= 0 ? '+' : ''}${t.netPnl.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Strategy Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#281d16]/50 backdrop-blur-xs">
          <div className="bg-white border border-[#e8dfd5] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-left animate-fade-in">
            <h3 className="text-base font-bold text-[#281d16] mb-1">Create New Trading Strategy</h3>
            <p className="text-xs text-[#7d695b] mb-4">Define setup rules and criteria to track its statistical edge</p>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#7d695b] mb-1">Strategy Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Trendline Bounce, Liquidity Sweep, Asian Range Breakout"
                  value={newStratName}
                  onChange={(e) => setNewStratName(e.target.value)}
                  className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#7d695b] mb-1">Description / Core Concept</label>
                <textarea
                  rows={2}
                  placeholder="Briefly describe the market condition and trigger..."
                  value={newStratDesc}
                  onChange={(e) => setNewStratDesc(e.target.value)}
                  className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#7d695b] mb-1">
                  Mandatory Execution Rules (one per line)
                </label>
                <textarea
                  rows={4}
                  placeholder="Rule 1: Wait for 5m candle close&#10;Rule 2: Minimum 2.0 R:R&#10;Rule 3: Stop behind invalidation swing"
                  value={newStratRules}
                  onChange={(e) => setNewStratRules(e.target.value)}
                  className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#7d695b] mb-1">Color Tag</label>
                <div className="flex gap-2">
                  {['#78350f', '#92400e', '#b45309', '#1e6b37', '#0f766e', '#1d4ed8', '#be123c'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewStratColor(c)}
                      className={`w-7 h-7 rounded-full transition cursor-pointer ${
                        newStratColor === c ? 'ring-2 ring-[#78350f] ring-offset-2 ring-offset-white scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#ede6dc] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 bg-[#faf7f2] hover:bg-[#f2ece2] text-[#4a3b32] text-xs rounded-xl border border-[#e2d8cb] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                >
                  Save Setup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
