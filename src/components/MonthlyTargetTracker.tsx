import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trade } from '../types/trade';
import { formatPnL, formatPrice } from '../utils/formatters';
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
    <div className="bg-white border border-[#e8dfd5] rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3.5 sm:space-y-4">
      {/* Header Bar: Title, Month Selector, and Target Configuration */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#ede6dc] pb-3.5">
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
          <div className="p-2 sm:p-2.5 bg-[#f5ede4] text-[#78350f] rounded-xl border border-[#debfa8] shrink-0">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-[#78350f]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-[#281d16] uppercase tracking-wider">
                Monthly P&amp;L Target
              </h3>
              {isTargetAchieved ? (
                <span className="px-2 py-0.5 rounded-full bg-[#edf7ed] text-[#1e6b37] text-[10px] font-mono font-bold border border-[#c3e6cb] flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-[#1e6b37]" />
                  <span>ACHIEVED</span>
                </span>
              ) : monthNetPnL < 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-[#fef2f2] text-[#b93829] text-[10px] font-mono font-bold border border-[#fecaca] shrink-0">
                  DRAWDOWN
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-[#fcfaf7] text-[#78350f] text-[10px] font-mono font-bold border border-[#e8dfd5] shrink-0">
                  IN PROGRESS
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-[#7d695b] mt-0.5 line-clamp-1">
              Goal tracking, monthly run-rate pacing, and execution discipline.
            </p>
          </div>
        </div>

        {/* Month Navigation & Edit Target Action */}
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap w-full sm:w-auto pt-1 sm:pt-0">
          {/* Month Switcher */}
          <div className="flex items-center bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl p-0.5 text-xs font-mono flex-1 sm:flex-initial justify-between sm:justify-start">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-[#7d695b] hover:text-[#281d16] hover:bg-[#ede6dc] rounded-lg transition cursor-pointer"
              title="Previous Month"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 py-1 text-xs font-semibold text-[#281d16] text-center truncate">
              {monthDisplayLabel}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-[#7d695b] hover:text-[#281d16] hover:bg-[#ede6dc] rounded-lg transition cursor-pointer"
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
                className="px-2.5 py-1.5 text-[11px] font-mono text-[#78350f] bg-[#f5ede4] hover:bg-[#ede1d3] border border-[#debfa8] rounded-xl transition cursor-pointer shrink-0"
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
                className="px-3 py-1.5 bg-[#fcfaf7] hover:bg-[#f5ede4] text-[#78350f] border border-[#debfa8] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Edit2 className="w-3 h-3 text-[#78350f]" />
                <span>Set Target</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="p-1.5 text-[#7d695b] hover:text-[#281d16] bg-[#fcfaf7] rounded-xl border border-[#e8dfd5] transition cursor-pointer shrink-0"
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
        <div className="p-3.5 bg-[#faf7f2] border border-[#debfa8] rounded-xl space-y-3 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-[#634832] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#78350f]" />
              <span>Define Monthly Target Benchmark</span>
            </span>
            <span className="text-[#8c7462] font-mono text-[11px]">
              Base Balance: ${startingBalance.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Mode Selector */}
            <div className="sm:col-span-4 grid grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-[#e2d8cb]">
              <button
                type="button"
                onClick={() => {
                  setTempType('dollar');
                  if (tempType === 'percent') {
                    setTempValue(String(Math.round((startingBalance * parseFloat(tempValue || '10')) / 100)));
                  }
                }}
                className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                  tempType === 'dollar'
                    ? 'bg-[#78350f] text-white shadow-xs'
                    : 'text-[#7d695b] hover:text-[#281d16]'
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
                    setTempValue(String(Math.max(1, Math.round(((parseFloat(tempValue || '2500')) / startingBalance) * 100))));
                  }
                }}
                className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                  tempType === 'percent'
                    ? 'bg-[#78350f] text-white shadow-xs'
                    : 'text-[#7d695b] hover:text-[#281d16]'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Return (%)</span>
              </button>
            </div>

            {/* Input Value */}
            <div className="sm:col-span-5 relative">
              <span className="absolute left-3 top-2 text-[#8c7462] font-mono text-sm">
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
                className="w-full bg-white border border-[#debfa8] rounded-xl pl-8 pr-3 py-1.5 text-sm font-mono text-[#281d16] focus:outline-none focus:border-[#78350f]"
                autoFocus
              />
            </div>

            {/* Save Button */}
            <div className="sm:col-span-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveTarget}
                className="w-full py-1.5 px-3 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs flex items-center justify-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Target</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] font-mono">
            <span className="text-[#8c7462] text-[10px] uppercase font-sans font-medium">Quick Presets:</span>
            {[
              { type: 'percent' as const, val: 5, label: '5% ($' + Math.round(startingBalance * 0.05).toLocaleString() + ')' },
              { type: 'percent' as const, val: 10, label: '10% ($' + Math.round(startingBalance * 0.10).toLocaleString() + ')' },
              { type: 'percent' as const, val: 15, label: '15% ($' + Math.round(startingBalance * 0.15).toLocaleString() + ')' },
              { type: 'dollar' as const, val: 1000, label: '$1,000' },
              { type: 'dollar' as const, val: 2500, label: '$2,500' },
              { type: 'dollar' as const, val: 5000, label: '$5,000' },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleSelectPreset(p.type, p.val)}
                className="px-2 py-0.5 bg-white text-[#634832] hover:text-[#281d16] hover:bg-[#f2ece2] border border-[#e2d8cb] rounded-md transition cursor-pointer"
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
            <span className="text-xs text-[#7d695b] font-medium">Realized Net Profit:</span>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-xl sm:text-2xl font-extrabold font-mono tracking-tight ${
                  monthNetPnL >= 0 ? 'text-[#1e6b37]' : 'text-[#b93829]'
                }`}
              >
                {monthNetPnL >= 0 ? '+' : ''}${monthNetPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] sm:text-xs font-mono text-[#8c7462]">
                / <strong>${effectiveTargetDollar.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 self-end sm:self-auto">
            <span className="text-xs font-mono font-bold text-[#78350f]">
              {progressPercent.toFixed(1)}%
            </span>
            <span className="text-xs text-[#8c7462] font-sans">achieved</span>
          </div>
        </div>

        {/* Visual Progress Bar with Threshold Milestones */}
        <div className="relative w-full bg-[#f2ece2] rounded-full h-3.5 overflow-hidden border border-[#e2d8cb]">
          <div
            className={`h-full transition-all duration-700 ease-out rounded-full ${
              isTargetAchieved
                ? 'bg-gradient-to-r from-[#2e7d32] to-[#1e6b37]'
                : monthNetPnL < 0
                ? 'bg-[#b93829]'
                : 'bg-gradient-to-r from-[#a06235] to-[#78350f]'
            }`}
            style={{ width: `${monthNetPnL < 0 ? Math.min(100, Math.abs(progressPercent)) : progressCapped}%` }}
          />
        </div>

        {/* Milestone Threshold Indicators */}
        <div className="flex justify-between text-[10px] font-mono text-[#8c7462] px-1">
          <span>$0 (0%)</span>
          <span className="hidden sm:inline">25% (${(effectiveTargetDollar * 0.25).toFixed(0)})</span>
          <span>50% (${(effectiveTargetDollar * 0.5).toFixed(0)})</span>
          <span className="hidden sm:inline">75% (${(effectiveTargetDollar * 0.75).toFixed(0)})</span>
          <span className="font-bold text-[#78350f]">100% (${effectiveTargetDollar.toFixed(0)})</span>
        </div>
      </div>

      {/* Target Breakdown Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-1 sm:pt-2 text-xs font-mono">
        {/* Metric 1: Remaining to Goal */}
        <div className="p-2.5 sm:p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
          <span className="text-[#8c7462] block text-[10px] uppercase font-sans font-medium truncate">
            {isTargetAchieved ? 'Surplus' : 'Remaining'}
          </span>
          <span className={`font-bold text-sm sm:text-base block truncate ${isTargetAchieved ? 'text-[#1e6b37]' : 'text-[#78350f]'}`}>
            {isTargetAchieved
              ? `+$${(monthNetPnL - effectiveTargetDollar).toFixed(2)}`
              : `$${remainingDollar.toFixed(2)}`}
          </span>
          <span className="text-[10px] text-[#8c7462] block mt-0.5 font-sans truncate">
            {isTargetAchieved ? 'Target passed' : `${(100 - progressCapped).toFixed(1)}% to go`}
          </span>
        </div>

        {/* Metric 2: Daily Run Rate Required */}
        <div className="p-2.5 sm:p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
          <span className="text-[#8c7462] block text-[10px] uppercase font-sans font-medium truncate">
            Daily Run Rate
          </span>
          <span className="font-bold text-sm sm:text-base text-[#281d16] block truncate">
            {isTargetAchieved ? '$0.00 / day' : daysRemaining > 0 ? `$${dailyNeeded.toFixed(2)}/d` : 'Ended'}
          </span>
          <span className="text-[10px] text-[#8c7462] block mt-0.5 font-sans truncate">
            {isCurrentMonth ? `${daysRemaining} days left` : 'Past month'}
          </span>
        </div>

        {/* Metric 3: Month Executions */}
        <div className="p-2.5 sm:p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
          <span className="text-[#8c7462] block text-[10px] uppercase font-sans font-medium truncate">
            Win Rate
          </span>
          <span className="font-bold text-sm sm:text-base text-[#281d16] block truncate">
            {winRate}%
          </span>
          <span className="text-[10px] text-[#8c7462] block mt-0.5 font-sans truncate">
            {winningTrades}W • {losingTrades}L ({closedTrades.length})
          </span>
        </div>

        {/* Metric 4: Target Return % of Capital */}
        <div className="p-2.5 sm:p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
          <span className="text-[#8c7462] block text-[10px] uppercase font-sans font-medium truncate">
            Target %
          </span>
          <span className="font-bold text-sm sm:text-base text-[#78350f] block truncate">
            {effectiveTargetPct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-[#8c7462] block mt-0.5 font-sans truncate">
            {targetType === 'percent' ? 'Return target' : 'Dollar target'}
          </span>
        </div>
      </div>
    </div>
  );
};
