import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trade } from '../types/trade';
import { formatPnL, formatPrice, formatSmartAmount } from '../utils/formatters';
import { saveUserSettings } from '../lib/supabase';
import confetti from 'canvas-confetti';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Flame,
  Clock,
  DollarSign,
  Percent,
  Sparkles,
} from 'lucide-react';

interface MonthlyTargetTrackerProps {
  trades: Trade[];
  startingBalance: number;
  userId?: string;
  initialTargetAmount?: number;
  initialTargetType?: 'dollar' | 'percent';
  onTargetChange?: (type: 'dollar' | 'percent', val: number) => void;
}

export const MonthlyTargetTracker: React.FC<MonthlyTargetTrackerProps> = ({
  trades,
  startingBalance,
  userId,
  initialTargetAmount = 2500,
  initialTargetType = 'dollar',
  onTargetChange,
}) => {
  // Current active calendar month format 'YYYY-MM'
  const today = useMemo(() => new Date(), []);
  const defaultMonthStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [today]);

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonthStr);
  const celebratedMonthsRef = useRef<Set<string>>(new Set());

  // Target Configuration: mode ('dollar' or 'percent') and value stored in Supabase
  const [targetType, setTargetType] = useState<'dollar' | 'percent'>(initialTargetType);
  const [targetValue, setTargetValue] = useState<number>(initialTargetAmount);

  // Sync when initial values change from Supabase
  useEffect(() => {
    if (initialTargetType) setTargetType(initialTargetType);
    if (initialTargetAmount) setTargetValue(initialTargetAmount);
  }, [initialTargetType, initialTargetAmount]);

  const [isEditing, setIsEditing] = useState(false);
  const [tempType, setTempType] = useState<'dollar' | 'percent'>(targetType);
  const [tempValue, setTempValue] = useState<string>(String(targetValue));

  // Save changes directly to Supabase
  const handleSaveTarget = () => {
    const num = parseFloat(tempValue);
    if (!isNaN(num) && num > 0) {
      setTargetType(tempType);
      setTargetValue(num);
      setIsEditing(false);
      if (onTargetChange) {
        onTargetChange(tempType, num);
      }
      if (userId) {
        saveUserSettings(userId, {
          monthlyTargetAmount: num,
          monthlyTargetType: tempType,
        });
      }
    }
  };

  // Quick preset target select
  const handleSelectPreset = (type: 'dollar' | 'percent', val: number) => {
    setTempType(type);
    setTempValue(String(val));
    setTargetType(type);
    setTargetValue(val);
    setIsEditing(false);
    if (onTargetChange) {
      onTargetChange(type, val);
    }
    if (userId) {
      saveUserSettings(userId, {
        monthlyTargetAmount: val,
        monthlyTargetType: type,
      });
    }
  };

  // Month navigation
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const newY = prevDate.getFullYear();
    const newM = String(prevDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const newY = nextDate.getFullYear();
    const newM = String(nextDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  const handleResetToCurrentMonth = () => {
    setSelectedMonth(defaultMonthStr);
  };

  // Month Name Display (e.g. "November 2026")
  const monthDisplayLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  const isCurrentMonth = selectedMonth === defaultMonthStr;

  // Filter trades for the selected month
  const monthTrades = useMemo(() => {
    return trades.filter((t) => t.date && t.date.startsWith(selectedMonth));
  }, [trades, selectedMonth]);

  const closedTrades = useMemo(() => {
    return monthTrades.filter((t) => t.status === 'closed');
  }, [monthTrades]);

  // Realized Net P&L for this month
  const monthNetPnL = useMemo(() => {
    return closedTrades.reduce((acc, t) => acc + (t.netPnl || 0), 0);
  }, [closedTrades]);

  // Month stats
  const winningTrades = closedTrades.filter((t) => t.outcome === 'win').length;
  const losingTrades = closedTrades.filter((t) => t.outcome === 'loss').length;
  const winRate = closedTrades.length > 0 ? ((winningTrades / closedTrades.length) * 100).toFixed(1) : '0.0';

  // Effective dollar target
  const effectiveTargetDollar = useMemo(() => {
    if (targetType === 'percent') {
      const base = startingBalance > 0 ? startingBalance : 25000;
      return (base * targetValue) / 100;
    }
    return targetValue;
  }, [targetType, targetValue, startingBalance]);

  // Target percent of starting balance
  const effectiveTargetPct = useMemo(() => {
    if (targetType === 'percent') return targetValue;
    const base = startingBalance > 0 ? startingBalance : 25000;
    return (targetValue / base) * 100;
  }, [targetType, targetValue, startingBalance]);

  // Progress metrics
  const progressPercent = useMemo(() => {
    if (effectiveTargetDollar <= 0) return 0;
    return (monthNetPnL / effectiveTargetDollar) * 100;
  }, [monthNetPnL, effectiveTargetDollar]);

  const progressCapped = Math.min(100, Math.max(0, progressPercent));
  const isTargetAchieved = monthNetPnL >= effectiveTargetDollar && effectiveTargetDollar > 0;
  const remainingDollar = Math.max(0, effectiveTargetDollar - monthNetPnL);

  // Time remaining in month
  const daysInMonth = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [selectedMonth]);

  const daysRemaining = useMemo(() => {
    if (!isCurrentMonth) return 0;
    return Math.max(0, daysInMonth - today.getDate());
  }, [isCurrentMonth, daysInMonth, today]);

  // Daily required run-rate to reach target
  const dailyNeeded = useMemo(() => {
    if (daysRemaining <= 0 || remainingDollar <= 0) return 0;
    return remainingDollar / daysRemaining;
  }, [daysRemaining, remainingDollar]);

  // Trigger celebratory confetti if target achieved for current month
  useEffect(() => {
    if (isTargetAchieved && isCurrentMonth) {
      if (!celebratedMonthsRef.current.has(selectedMonth)) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
        celebratedMonthsRef.current.add(selectedMonth);
      }
    }
  }, [isTargetAchieved, isCurrentMonth, selectedMonth]);

  return (
    <div className="bg-surface border border-line rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3.5 sm:space-y-4">
      {/* Header Bar: Title, Month Selector, and Target Configuration */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line-soft pb-3.5">
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
          <div className="p-2 sm:p-2.5 bg-sunken text-brand rounded-xl border border-line-brand shrink-0">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-ink uppercase tracking-wider">
                Monthly P&amp;L Target
              </h3>
              {isTargetAchieved ? (
                <span className="px-2 py-0.5 rounded-full bg-profit-bg text-profit text-[10px] font-mono font-bold border border-profit-line flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-profit" />
                  <span>ACHIEVED</span>
                </span>
              ) : monthNetPnL < 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-loss-bg text-loss text-[10px] font-mono font-bold border border-loss-line shrink-0">
                  DRAWDOWN
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-surface-alt text-brand text-[10px] font-mono font-bold border border-line shrink-0">
                  IN PROGRESS
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-muted mt-0.5 line-clamp-1">
              Goal tracking, monthly run-rate pacing, and execution discipline.
            </p>
          </div>
        </div>

        {/* Month Navigation & Edit Target Action */}
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap w-full sm:w-auto pt-1 sm:pt-0">
          {/* Month Switcher */}
          <div className="flex items-center bg-surface-alt border border-line rounded-xl p-0.5 text-xs font-mono flex-1 sm:flex-initial justify-between sm:justify-start">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-muted hover:text-ink hover:bg-sunken-strong rounded-lg transition cursor-pointer"
              title="Previous Month"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 py-1 text-xs font-semibold text-ink text-center truncate">
              {monthDisplayLabel}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-muted hover:text-ink hover:bg-sunken-strong rounded-lg transition cursor-pointer"
              title="Next Month"
              aria-label="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {!isCurrentMonth && (
              <button
                onClick={handleResetToCurrentMonth}
                className="px-2.5 py-1.5 text-[11px] font-mono text-brand bg-sunken hover:bg-line border border-line-brand rounded-xl transition cursor-pointer shrink-0"
              >
                Current
              </button>
            )}

            {/* Edit Target Button */}
            {!isEditing ? (
              <button
                onClick={() => {
                  setTempType(targetType);
                  setTempValue(String(targetValue));
                  setIsEditing(true);
                }}
                className="px-3 py-1.5 bg-surface-alt hover:bg-sunken text-brand border border-line-brand rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Edit2 className="w-3 h-3 text-brand" />
                <span>Set Target</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="p-1.5 text-muted hover:text-ink bg-surface-alt rounded-xl border border-line transition cursor-pointer shrink-0"
                title="Cancel Edit"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline Target Configuration Drawer when editing */}
      {isEditing && (
        <div className="p-3.5 bg-canvas border border-line-brand rounded-xl space-y-3 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-ink-soft flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span>Define Monthly Target Benchmark</span>
            </span>
            <span className="text-faint font-mono text-[11px]">
              Base Balance: ${startingBalance.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Mode Selector */}
            <div className="sm:col-span-4 grid grid-cols-2 gap-1.5 bg-surface p-1 rounded-xl border border-line">
              <button
                type="button"
                onClick={() => {
                  setTempType('dollar');
                  if (tempType === 'percent') {
                    setTempValue(String(Number(((startingBalance * parseFloat(tempValue || '10')) / 100).toFixed(2))));
                  }
                }}
                className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                  tempType === 'dollar'
                    ? 'bg-brand-solid text-white shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Monetary ($)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTempType('percent');
                  if (tempType === 'dollar') {
                    setTempValue(String(Math.max(0.1, Number(((parseFloat(tempValue || '2500') / startingBalance) * 100).toFixed(1)))));
                  }
                }}
                className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                  tempType === 'percent'
                    ? 'bg-brand-solid text-white shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Return (%)</span>
              </button>
            </div>

            {/* Input Value */}
            <div className="sm:col-span-5 relative">
              <span className="absolute left-3 top-2 text-faint font-mono text-sm">
                {tempType === 'dollar' ? '$' : '%'}
              </span>
              <input
                type="number"
                step="any"
                min="0.1"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTarget()}
                placeholder={tempType === 'dollar' ? '2500' : '10'}
                className="w-full bg-surface border border-line-brand rounded-xl pl-8 pr-3 py-1.5 text-sm font-mono text-ink focus:outline-none focus:border-brand"
                autoFocus
              />
            </div>

            {/* Save Button */}
            <div className="sm:col-span-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveTarget}
                className="w-full py-1.5 px-3 bg-brand-solid hover:bg-brand-solid-hover text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs flex items-center justify-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Target</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] font-mono">
            <span className="text-faint text-[10px] uppercase font-sans font-medium">Quick Presets:</span>
            {[
              { type: 'percent' as const, val: 5, label: '5% ($' + formatSmartAmount(startingBalance * 0.05) + ')' },
              { type: 'percent' as const, val: 10, label: '10% ($' + formatSmartAmount(startingBalance * 0.10) + ')' },
              { type: 'percent' as const, val: 15, label: '15% ($' + formatSmartAmount(startingBalance * 0.15) + ')' },
              { type: 'dollar' as const, val: 1000, label: '$1,000' },
              { type: 'dollar' as const, val: 2500, label: '$2,500' },
              { type: 'dollar' as const, val: 5000, label: '$5,000' },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleSelectPreset(p.type, p.val)}
                className="px-2 py-0.5 bg-surface text-ink-soft hover:text-ink hover:bg-sunken border border-line rounded-md transition cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progress Bar & Numerical Target Gauge */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1.5 text-xs">
          <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
            <span className="text-xs text-muted font-medium">Realized Net Profit:</span>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-xl sm:text-2xl font-extrabold font-mono tracking-tight ${
                  monthNetPnL >= 0 ? 'text-profit' : 'text-loss'
                }`}
              >
                {monthNetPnL >= 0 ? '+' : '-'}${Math.abs(monthNetPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] sm:text-xs font-mono text-faint">
                / <strong>${effectiveTargetDollar.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 self-end sm:self-auto">
            <span className="text-xs font-mono font-bold text-brand">
              {progressPercent.toFixed(1)}%
            </span>
            <span className="text-xs text-faint font-sans">achieved</span>
          </div>
        </div>

        {/* Visual Progress Bar with Threshold Milestones */}
        <div className="relative w-full bg-sunken rounded-full h-3.5 overflow-hidden border border-line">
          <div
            className={`h-full transition-all duration-700 ease-out rounded-full ${
              isTargetAchieved
                ? 'bg-gradient-to-r from-profit-solid to-profit-solid'
                : monthNetPnL < 0
                ? 'bg-loss-solid'
                : 'bg-gradient-to-r from-accent to-brand-solid'
            }`}
            style={{ width: `${monthNetPnL < 0 ? Math.min(100, Math.abs(progressPercent)) : progressCapped}%` }}
          />
        </div>

        {/* Milestone Threshold Indicators */}
        <div className="flex justify-between text-[10px] font-mono text-faint px-1">
          <span>$0 (0%)</span>
          <span className="hidden sm:inline">25% (${formatSmartAmount(effectiveTargetDollar * 0.25)})</span>
          <span>50% (${formatSmartAmount(effectiveTargetDollar * 0.5)})</span>
          <span className="hidden sm:inline">75% (${formatSmartAmount(effectiveTargetDollar * 0.75)})</span>
          <span className="font-bold text-brand">100% (${formatSmartAmount(effectiveTargetDollar)})</span>
        </div>
      </div>

      {/* Target Breakdown Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-1 sm:pt-2 text-xs font-mono">
        {/* Metric 1: Remaining to Goal */}
        <div className="p-2.5 sm:p-3 bg-surface-alt rounded-xl border border-line-soft">
          <span className="text-faint block text-[10px] uppercase font-sans font-medium truncate">
            {isTargetAchieved ? 'Surplus' : 'Remaining'}
          </span>
          <span className={`font-bold text-sm sm:text-base block truncate ${isTargetAchieved ? 'text-profit' : 'text-brand'}`}>
            {isTargetAchieved
              ? `+$${(monthNetPnL - effectiveTargetDollar).toFixed(2)}`
              : `$${remainingDollar.toFixed(2)}`}
          </span>
          <span className="text-[10px] text-faint block mt-0.5 font-sans truncate">
            {isTargetAchieved ? 'Target passed' : `${(100 - progressCapped).toFixed(1)}% to go`}
          </span>
        </div>

        {/* Metric 2: Daily Run Rate Required */}
        <div className="p-2.5 sm:p-3 bg-surface-alt rounded-xl border border-line-soft">
          <span className="text-faint block text-[10px] uppercase font-sans font-medium truncate">
            Daily Run Rate
          </span>
          <span className="font-bold text-sm sm:text-base text-ink block truncate">
            {isTargetAchieved ? '$0.00 / day' : daysRemaining > 0 ? `$${dailyNeeded.toFixed(2)}/d` : 'Ended'}
          </span>
          <span className="text-[10px] text-faint block mt-0.5 font-sans truncate">
            {isCurrentMonth ? `${daysRemaining} days left` : 'Past month'}
          </span>
        </div>

        {/* Metric 3: Month Executions */}
        <div className="p-2.5 sm:p-3 bg-surface-alt rounded-xl border border-line-soft">
          <span className="text-faint block text-[10px] uppercase font-sans font-medium truncate">
            Win Rate
          </span>
          <span className="font-bold text-sm sm:text-base text-ink block truncate">
            {winRate}%
          </span>
          <span className="text-[10px] text-faint block mt-0.5 font-sans truncate">
            {winningTrades}W • {losingTrades}L ({closedTrades.length})
          </span>
        </div>

        {/* Metric 4: Target Return % of Capital */}
        <div className="p-2.5 sm:p-3 bg-surface-alt rounded-xl border border-line-soft">
          <span className="text-faint block text-[10px] uppercase font-sans font-medium truncate">
            Target %
          </span>
          <span className="font-bold text-sm sm:text-base text-brand block truncate">
            {effectiveTargetPct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-faint block mt-0.5 font-sans truncate">
            {targetType === 'percent' ? 'Return target' : 'Dollar target'}
          </span>
        </div>
      </div>
    </div>
  );
};
