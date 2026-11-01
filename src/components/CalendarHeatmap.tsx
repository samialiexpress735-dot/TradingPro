import React, { useState, useMemo } from 'react';
import { Trade, DailyPnL } from '../types/trade';
import { groupTradesByDate } from '../utils/calculations';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, XCircle } from 'lucide-react';

interface CalendarHeatmapProps {
  trades: Trade[];
  onSelectDate?: (date: string) => void;
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ trades, onSelectDate }) => {
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(9); // 0-indexed: 9 = October
  const [selectedDayTrades, setSelectedDayTrades] = useState<DailyPnL | null>(null);

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

  // Generate calendar days
  const { calendarDays, monthTotalPnl, winningDays, losingDays } = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    let mPnl = 0;
    let wDays = 0;
    let lDays = 0;

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
        mPnl += dayData.pnl;
        if (dayData.pnl > 0) wDays++;
        else if (dayData.pnl < 0) lDays++;
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
    };
  }, [currentYear, currentMonth, dailyMap]);

  return (
    <div className="bg-white border border-[#e8dfd5] rounded-2xl p-5 shadow-xs">
      {/* Month Navigator & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-[#ede6dc] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#f5ede4] text-[#78350f] rounded-xl border border-[#debfa8]">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#281d16] flex items-center gap-2">
              <span>{monthNames[currentMonth]} {currentYear}</span>
            </h3>
            <p className="text-xs text-[#7d695b]">Daily Trading Performance &amp; Heatmap</p>
          </div>
        </div>

        {/* Month metrics */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="bg-[#fcfaf7] px-3 py-1.5 rounded-xl border border-[#ede6dc]">
            <span className="text-[#8c7462] block text-[10px] uppercase font-sans">Month P&amp;L</span>
            <span className={`font-bold text-sm ${monthTotalPnl >= 0 ? 'text-[#1e6b37]' : 'text-[#b93829]'}`}>
              {monthTotalPnl >= 0 ? '+' : ''}${monthTotalPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-[#fcfaf7] px-3 py-1.5 rounded-xl border border-[#ede6dc] hidden sm:block">
            <span className="text-[#8c7462] block text-[10px] uppercase font-sans">Green / Red Days</span>
            <span className="font-bold text-sm text-[#281d16]">
              <span className="text-[#1e6b37]">{winningDays}W</span> / <span className="text-[#b93829]">{losingDays}L</span>
            </span>
          </div>

          {/* Month buttons */}
          <div className="flex items-center gap-1 bg-[#faf7f2] p-1 rounded-xl border border-[#e2d8cb]">
            <button
              onClick={handlePrevMonth}
              className="p-1 text-[#7d695b] hover:text-[#281d16] hover:bg-[#ede6dc] rounded-lg transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 text-[#7d695b] hover:text-[#281d16] hover:bg-[#ede6dc] rounded-lg transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[10px] sm:text-xs font-semibold text-[#8c7462] uppercase tracking-wider">
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
                className="h-14 sm:h-20 rounded-lg sm:rounded-xl border border-[#ede6dc]/60 bg-[#faf8f5] p-1 sm:p-2 opacity-40 select-none"
              >
                <span className="text-[10px] sm:text-xs text-[#bdae9f] font-mono">{cell.dayNum}</span>
              </div>
            );
          }

          const hasTrades = cell.data && cell.data.tradeCount > 0;
          const pnl = cell.data?.pnl ?? 0;
          const isWin = pnl > 0;
          const isLoss = pnl < 0;

          // Compute color intensity in white & brown aesthetic
          let bgClass = 'bg-white border-[#ede6dc] hover:border-[#cbbaaa]';
          let textPnlClass = 'text-[#7d695b]';

          if (hasTrades) {
            if (isWin) {
              if (pnl > 500) {
                bgClass = 'bg-[#edf7ed] border-[#a3d9af] hover:border-[#67b579] shadow-xs';
              } else {
                bgClass = 'bg-[#f4faf4] border-[#c3e6cb] hover:border-[#a3d9af]';
              }
              textPnlClass = 'text-[#1e6b37] font-bold';
            } else if (isLoss) {
              if (pnl < -200) {
                bgClass = 'bg-[#fdf2f2] border-[#fca5a5] hover:border-[#f87171] shadow-xs';
              } else {
                bgClass = 'bg-[#fff8f8] border-[#fecaca] hover:border-[#fca5a5]';
              }
              textPnlClass = 'text-[#b93829] font-bold';
            } else {
              bgClass = 'bg-[#f5ede4] border-[#debfa8]';
              textPnlClass = 'text-[#78350f] font-bold';
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
                <span className="text-[10px] sm:text-xs font-mono font-semibold text-[#5c4a3e] group-hover:text-[#281d16]">
                  {cell.dayNum}
                </span>
                {hasTrades && (
                  <span className="text-[9px] sm:text-[10px] font-mono px-1 py-0.2 rounded bg-[#f5ede4] text-[#78350f] border border-[#debfa8]">
                    {cell.data!.tradeCount}t
                  </span>
                )}
              </div>

              {hasTrades ? (
                <div className="mt-0.5 sm:mt-1">
                  <div className={`text-[10px] sm:text-xs font-mono tracking-tight truncate ${textPnlClass}`}>
                    {isWin ? '+' : ''}${Math.abs(pnl) >= 1000 ? `${(pnl / 1000).toFixed(1)}k` : pnl.toFixed(0)}
                  </div>
                  <div className="hidden sm:flex text-[10px] text-[#8c7462] font-mono mt-0.5 items-center gap-1">
                    <span className="text-[#1e6b37]">{cell.data!.winCount}W</span>
                    <span>-</span>
                    <span className="text-[#b93829]">{cell.data!.lossCount}L</span>
                  </div>
                </div>
              ) : (
                <div className="hidden sm:block text-[10px] text-[#bdae9f] italic">No trades</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Day details modal if clicked */}
      {selectedDayTrades && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#281d16]/50 backdrop-blur-xs">
          <div className="bg-white border border-[#e8dfd5] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-left">
            <div className="flex items-center justify-between border-b border-[#ede6dc] pb-3 mb-4">
              <div>
                <h4 className="text-lg font-bold text-[#281d16] flex items-center gap-2">
                  <span>Trades for {selectedDayTrades.date}</span>
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                      selectedDayTrades.pnl >= 0
                        ? 'bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb]'
                        : 'bg-[#fef2f2] text-[#b93829] border border-[#fecaca]'
                    }`}
                  >
                    {selectedDayTrades.pnl >= 0 ? '+' : ''}${selectedDayTrades.pnl.toFixed(2)}
                  </span>
                </h4>
                <p className="text-xs text-[#7d695b]">
                  {selectedDayTrades.tradeCount} trade{selectedDayTrades.tradeCount > 1 ? 's' : ''} logged •{' '}
                  <span className="text-[#1e6b37] font-semibold">{selectedDayTrades.winCount} Wins</span>,{' '}
                  <span className="text-[#b93829] font-semibold">{selectedDayTrades.lossCount} Losses</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedDayTrades(null)}
                className="text-[#7d695b] hover:text-[#281d16] p-1 rounded-lg hover:bg-[#f5ede4] transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {selectedDayTrades.trades.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-[#fcfaf7] border border-[#ede6dc] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#281d16] font-mono text-sm">{t.symbol}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.direction === 'long'
                            ? 'bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb]'
                            : 'bg-[#fef2f2] text-[#b93829] border border-[#fecaca]'
                        }`}
                      >
                        {t.direction}
                      </span>
                      <span className="text-[#8c7462] font-mono text-[11px]">{t.time}</span>
                    </div>
                    <div className="text-[#7d695b] text-[11px]">
                      {t.strategy} • In: ${t.entryPrice} → Out: ${t.exitPrice}
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-mono font-bold text-sm ${
                        t.netPnl >= 0 ? 'text-[#1e6b37]' : 'text-[#b93829]'
                      }`}
                    >
                      {t.netPnl >= 0 ? '+' : ''}${t.netPnl.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-[#8c7462] font-mono">
                      {t.roi >= 0 ? '+' : ''}{t.roi}% ROI ({t.realizedRR}R)
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-[#ede6dc] flex justify-end">
              <button
                onClick={() => setSelectedDayTrades(null)}
                className="px-4 py-2 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
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
