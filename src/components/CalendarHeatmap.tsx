import React, { useState, useMemo, useEffect } from 'react';
import { Trade, DailyPnL } from '../types/trade';
import { groupTradesByDate } from '../utils/calculations';
import { formatPrice, formatPnL, formatSmartAmount } from '../utils/formatters';

// Cell label: cents for small days, whole dollars for big ones, "k" above 1,000.
const formatCellPnl = (pnl: number): string => {
  const sign = pnl > 0 ? '+' : pnl < 0 ? '-' : '';
  const abs = Math.abs(pnl);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${formatSmartAmount(abs)}`;
};
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, XCircle } from 'lucide-react';

interface CalendarHeatmapProps {
  trades: Trade[];
  onSelectDate?: (date: string) => void;
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ trades, onSelectDate }) => {
  // Initialize to latest trade's date or current date (e.g. November 2026)
  const [currentYear, setCurrentYear] = useState<number>(() => {
    if (trades && trades.length > 0) {
      const sorted = [...trades].sort((a, b) => b.date.localeCompare(a.date));
      const parts = sorted[0].date.split('-');
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10);
        if (!isNaN(y)) return y;
      }
    }
    return new Date().getFullYear();
  });

  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    if (trades && trades.length > 0) {
      const sorted = [...trades].sort((a, b) => b.date.localeCompare(a.date));
      const parts = sorted[0].date.split('-');
      if (parts.length >= 2) {
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(m) && m >= 0 && m <= 11) return m;
      }
    }
    return new Date().getMonth();
  });

  const [selectedDayTrades, setSelectedDayTrades] = useState<DailyPnL | null>(null);

  // Auto-focus calendar on latest trade date when new trades are added
  useEffect(() => {
    if (trades && trades.length > 0) {
      const sorted = [...trades].sort((a, b) => b.date.localeCompare(a.date));
      const parts = sorted[0].date.split('-');
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
          setCurrentYear(y);
          setCurrentMonth(m);
        }
      }
    } else {
      const now = new Date();
      setCurrentYear(now.getFullYear());
      setCurrentMonth(now.getMonth());
    }
  }, [trades.length]);

  const dailyMap = useMemo(() => groupTradesByDate(trades), [trades]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToCurrentMonth = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // Generate calendar days
  const { calendarDays, monthTotalPnl, winningDays, losingDays, maxAbsDayPnl } = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    let mPnl = 0;
    let wDays = 0;
    let lDays = 0;
    let maxAbs = 0;

    const days: Array<{
      dayNum: number;
      dateStr: string;
      isCurrentMonth: boolean;
      data?: DailyPnL;
    }> = [];

    // Fill leading empty days from previous month
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        dayNum: prevMonthDays - i,
        dateStr: '',
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const monthPadded = String(currentMonth + 1).padStart(2, '0');
      const dayPadded = String(d).padStart(2, '0');
      const dateStr = `${currentYear}-${monthPadded}-${dayPadded}`;
      const dayData = dailyMap.get(dateStr);

      if (dayData) {
        // Round to cents so float noise (e.g. 0.30000000000000004) never flips a day's colour
        const dayPnl = Number(dayData.pnl.toFixed(2));
        mPnl += dayPnl;
        maxAbs = Math.max(maxAbs, Math.abs(dayPnl));
        if (dayPnl > 0) wDays++;
        else if (dayPnl < 0) lDays++;
      }

      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        data: dayData,
      });
    }

    // Fill remaining days of the last week
    const totalCells = Math.ceil(days.length / 7) * 7;
    let nextMonthDay = 1;
    while (days.length < totalCells) {
      days.push({
        dayNum: nextMonthDay++,
        dateStr: '',
        isCurrentMonth: false,
      });
    }

    return {
      calendarDays: days,
      monthTotalPnl: Number(mPnl.toFixed(2)),
      winningDays: wDays,
      losingDays: lDays,
      maxAbsDayPnl: maxAbs,
    };
  }, [currentYear, currentMonth, dailyMap]);

  return (
    <div className="bg-surface border border-line rounded-2xl p-5 shadow-xs">
      {/* Month Navigator & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-line-soft pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sunken text-brand rounded-xl border border-line-brand">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <span>{monthNames[currentMonth]} {currentYear}</span>
            </h3>
            <p className="text-xs text-muted">Daily Trading Performance &amp; Heatmap</p>
          </div>
        </div>

        {/* Month metrics */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="bg-surface-alt px-3 py-1.5 rounded-xl border border-line-soft">
            <span className="text-faint block text-[10px] uppercase font-sans">Month P&amp;L</span>
            <span className={`font-bold text-sm ${monthTotalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              {monthTotalPnl >= 0 ? '+' : '-'}${Math.abs(monthTotalPnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-surface-alt px-3 py-1.5 rounded-xl border border-line-soft hidden sm:block">
            <span className="text-faint block text-[10px] uppercase font-sans">Green / Red Days</span>
            <span className="font-bold text-sm text-ink">
              <span className="text-profit">{winningDays}W</span> / <span className="text-loss">{losingDays}L</span>
            </span>
          </div>

          {/* Month buttons */}
          <div className="flex items-center gap-1 bg-canvas p-1 rounded-xl border border-line">
            <button
              onClick={handlePrevMonth}
              className="p-1 text-muted hover:text-ink hover:bg-sunken-strong rounded-lg transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleJumpToCurrentMonth}
              className="px-2 py-0.5 text-[11px] font-bold text-brand hover:bg-sunken-strong rounded-md transition cursor-pointer font-sans"
              title="Jump to current month"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 text-muted hover:text-ink hover:bg-sunken-strong rounded-lg transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[10px] sm:text-xs font-semibold text-faint uppercase tracking-wider">
        <span><span className="sm:hidden">S</span><span className="hidden sm:inline">Sun</span></span>
        <span><span className="sm:hidden">M</span><span className="hidden sm:inline">Mon</span></span>
        <span><span className="sm:hidden">T</span><span className="hidden sm:inline">Tue</span></span>
        <span><span className="sm:hidden">W</span><span className="hidden sm:inline">Wed</span></span>
        <span><span className="sm:hidden">T</span><span className="hidden sm:inline">Thu</span></span>
        <span><span className="sm:hidden">F</span><span className="hidden sm:inline">Fri</span></span>
        <span><span className="sm:hidden">S</span><span className="hidden sm:inline">Sat</span></span>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {calendarDays.map((cell, idx) => {
          if (!cell.isCurrentMonth) {
            return (
              <div
                key={`empty-${idx}`}
                className="h-14 sm:h-20 rounded-lg sm:rounded-xl border border-line-soft/60 bg-surface-alt p-1 sm:p-2 opacity-40 select-none"
              >
                <span className="text-[10px] sm:text-xs text-faint font-mono">{cell.dayNum}</span>
              </div>
            );
          }

          const hasTrades = cell.data && cell.data.tradeCount > 0;
          const pnl = Number((cell.data?.pnl ?? 0).toFixed(2));
          const isWin = pnl > 0;
          const isLoss = pnl < 0;
          // Colour strength is relative to this month's biggest day, so small accounts
          // get the same visual range as large ones (the old cut-offs were +$500 / -$200).
          const isStrongDay = maxAbsDayPnl > 0 && Math.abs(pnl) >= maxAbsDayPnl * 0.5;

          // Compute color intensity in white & brown aesthetic
          let bgClass = 'bg-surface border-line-soft hover:border-line-brand';
          let textPnlClass = 'text-muted';

          if (hasTrades) {
            if (isWin) {
              if (isStrongDay) {
                bgClass = 'bg-profit-bg border-profit-line hover:border-[#67b579] shadow-xs';
              } else {
                bgClass = 'bg-profit-bg-soft border-profit-line hover:border-profit-solid/40';
              }
              textPnlClass = 'text-profit font-bold';
            } else if (isLoss) {
              if (isStrongDay) {
                bgClass = 'bg-loss-bg border-loss-line hover:border-[#f87171] shadow-xs';
              } else {
                bgClass = 'bg-loss-bg-soft border-loss-line hover:border-loss-solid/40';
              }
              textPnlClass = 'text-loss font-bold';
            } else {
              bgClass = 'bg-sunken border-line-brand';
              textPnlClass = 'text-brand font-bold';
            }
          }

          return (
            <div
              key={cell.dateStr}
              onClick={() => {
                if (cell.data && cell.data.tradeCount > 0) {
                  setSelectedDayTrades(cell.data);
                  if (onSelectDate) onSelectDate(cell.dateStr);
                }
              }}
              className={`h-14 sm:h-20 rounded-lg sm:rounded-xl border p-1 sm:p-2 flex flex-col justify-between transition-all cursor-pointer relative group ${bgClass}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-mono font-semibold text-ink-soft group-hover:text-ink">
                  {cell.dayNum}
                </span>
                {hasTrades && (
                  <span className="text-[9px] sm:text-[10px] font-mono px-1 py-0.2 rounded bg-sunken text-brand border border-line-brand">
                    {cell.data!.tradeCount}t
                  </span>
                )}
              </div>

              {hasTrades ? (
                <div className="mt-0.5 sm:mt-1">
                  <div className={`text-[10px] sm:text-xs font-mono tracking-tight truncate ${textPnlClass}`}>
                    {formatCellPnl(pnl)}
                  </div>
                  <div className="hidden sm:flex text-[10px] text-faint font-mono mt-0.5 items-center gap-1">
                    <span className="text-profit">{cell.data!.winCount}W</span>
                    <span>-</span>
                    <span className="text-loss">{cell.data!.lossCount}L</span>
                  </div>
                </div>
              ) : (
                <div className="hidden sm:block text-[10px] text-faint italic">No trades</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Day details modal if clicked */}
      {selectedDayTrades && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse/50 backdrop-blur-xs">
          <div className="bg-surface border border-line rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-left">
            <div className="flex items-center justify-between border-b border-line-soft pb-3 mb-4">
              <div>
                <h4 className="text-lg font-bold text-ink flex items-center gap-2">
                  <span>Trades for {selectedDayTrades.date}</span>
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                      selectedDayTrades.pnl >= 0
                        ? 'bg-profit-bg text-profit border border-profit-line'
                        : 'bg-loss-bg text-loss border border-loss-line'
                    }`}
                  >
                    {selectedDayTrades.pnl >= 0 ? '+' : '-'}${Math.abs(selectedDayTrades.pnl).toFixed(2)}
                  </span>
                </h4>
                <p className="text-xs text-muted">
                  {selectedDayTrades.tradeCount} trade{selectedDayTrades.tradeCount > 1 ? 's' : ''} logged •{' '}
                  <span className="text-profit font-semibold">{selectedDayTrades.winCount} Wins</span>,{' '}
                  <span className="text-loss font-semibold">{selectedDayTrades.lossCount} Losses</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedDayTrades(null)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-sunken transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {selectedDayTrades.trades.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-surface-alt border border-line-soft flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink font-mono text-sm">{t.symbol}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.direction === 'long'
                            ? 'bg-profit-bg text-profit border border-profit-line'
                            : 'bg-loss-bg text-loss border border-loss-line'
                        }`}
                      >
                        {t.direction}
                      </span>
                      <span className="text-faint font-mono text-[11px]">{t.time}</span>
                    </div>
                    <div className="text-muted text-[11px]">
                      {t.strategy} • In: {formatPrice(t.entryPrice)} → Out: {formatPrice(t.exitPrice)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-mono font-bold text-sm ${
                        t.netPnl >= 0 ? 'text-profit' : 'text-loss'
                      }`}
                    >
                      {formatPnL(t.netPnl)}
                    </div>
                    <div className="text-[10px] text-faint font-mono">
                      {t.roi >= 0 ? '+' : ''}{t.roi}% ROI ({t.realizedRR}R)
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-line-soft flex justify-end">
              <button
                onClick={() => setSelectedDayTrades(null)}
                className="px-4 py-2 bg-brand-solid hover:bg-brand-solid-hover text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
