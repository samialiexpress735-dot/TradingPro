import React, { useState, useMemo, useEffect } from 'react';
import { Trade, Strategy, AssetClass, TradeOutcome } from '../types/trade';
import { formatQuantity, formatPrice, formatPnL } from '../utils/formatters';
import {
  Search,
  Filter,
  Download,
  Upload,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpDown,
  Tag,
  Smile,
  Frown,
  AlertOctagon,
  Share2,
  FileSpreadsheet,
  BookOpen,
  Zap,
} from 'lucide-react';
import { CsvImportModal } from './CsvImportModal';
import { SocialTradeCardModal } from './SocialTradeCardModal';
import { ConfirmDialog } from './ConfirmDialog';

interface TradeJournalProps {
  trades: Trade[];
  strategies: Strategy[];
  onAddTrade: () => void;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
  onDuplicateTrade: (trade: Trade) => void;
  onImportCsv: (trades: Trade[]) => void;
  onOpenBinanceSync?: () => void;
  initialFilterMistake?: string;
  /** Trade to briefly highlight (just saved / duplicated / restored). */
  highlightTradeId?: string | null;
}

export const TradeJournal: React.FC<TradeJournalProps> = ({
  trades,
  strategies,
  onAddTrade,
  onEditTrade,
  onDeleteTrade,
  onDuplicateTrade,
  onImportCsv,
  onOpenBinanceSync,
  initialFilterMistake,
  highlightTradeId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<string>('all');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('all');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('all');
  const [selectedEmotion, setSelectedEmotion] = useState<string>('all');
  const [selectedMistake, setSelectedMistake] = useState<string>(initialFilterMistake || 'all');
  const [sortField, setSortField] = useState<'date' | 'netPnl' | 'roi' | 'realizedRR'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [cardModalTrade, setCardModalTrade] = useState<Trade | null>(null);
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = [selectedAsset, selectedOutcome, selectedStrategy, selectedEmotion, selectedMistake].filter(
    (v) => v !== 'all'
  ).length;

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedAsset('all');
    setSelectedOutcome('all');
    setSelectedStrategy('all');
    setSelectedEmotion('all');
    setSelectedMistake('all');
  };

  // Scroll a freshly duplicated / saved trade into view so the action is clearly visible
  useEffect(() => {
    if (!highlightTradeId) return;
    const t = setTimeout(() => {
      document
        .querySelector(`[data-trade-row="${CSS.escape(highlightTradeId)}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
    return () => clearTimeout(t);
  }, [highlightTradeId]);

  // Filter & Sort trades
  const filteredTrades = useMemo(() => {
    return trades
      .filter((trade) => {
        const matchesSearch =
          trade.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          trade.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
          trade.strategy.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesAsset = selectedAsset === 'all' || trade.assetClass === selectedAsset;
        const matchesOutcome = selectedOutcome === 'all' || trade.outcome === selectedOutcome;
        const matchesStrategy = selectedStrategy === 'all' || trade.strategy === selectedStrategy;
        const matchesEmotion = selectedEmotion === 'all' || trade.emotion === selectedEmotion;
        const matchesMistake =
          selectedMistake === 'all' ||
          trade.mistake === selectedMistake ||
          (selectedMistake === 'Rule Breakers' && trade.mistake && trade.mistake !== 'Followed Plan');

        return matchesSearch && matchesAsset && matchesOutcome && matchesStrategy && matchesEmotion && matchesMistake;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'date') {
          const tA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
          const tB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
          diff = tA - tB;
        } else if (sortField === 'netPnl') {
          diff = a.netPnl - b.netPnl;
        } else if (sortField === 'roi') {
          diff = a.roi - b.roi;
        } else if (sortField === 'realizedRR') {
          diff = a.realizedRR - b.realizedRR;
        }
        return sortOrder === 'desc' ? -diff : diff;
      });
  }, [trades, searchTerm, selectedAsset, selectedOutcome, selectedStrategy, selectedEmotion, selectedMistake, sortField, sortOrder]);

  // Quick statistics for current filtered view
  const filteredStats = useMemo(() => {
    const closed = filteredTrades.filter((t) => t.status === 'closed');
    const wins = closed.filter((t) => t.outcome === 'win').length;
    const net = closed.reduce((acc, t) => acc + t.netPnl, 0);
    const losses = closed.filter((t) => t.outcome === 'loss').length;
    const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
    const avgR = closed.length > 0 ? closed.reduce((acc, t) => acc + (t.realizedRR || 0), 0) / closed.length : 0;
    return {
      wins,
      losses,
      avgR: Number(avgR.toFixed(2)),
      count: filteredTrades.length,
      closedCount: closed.length,
      net: Number(net.toFixed(2)),
      winRate: Number(winRate.toFixed(1)),
    };
  }, [filteredTrades]);

  // Export CSV handler
  const handleExportCsv = () => {
    if (trades.length === 0) return;
    const headers = [
      'ID',
      'Date',
      'Time',
      'ExitDate',
      'ExitTime',
      'Symbol',
      'AssetClass',
      'Direction',
      'Status',
      'Outcome',
      'EntryPrice',
      'ExitPrice',
      'Quantity',
      'StopLoss',
      'TakeProfit',
      'Fees',
      'NetPnL',
      'ROI_Percent',
      'PlannedRR',
      'RealizedRR',
      'Strategy',
      'Emotion',
      'Mistake',
      'Rating',
      'Notes',
    ];

    const rows = trades.map((t) => [
      t.id,
      t.date,
      t.time,
      t.exitDate || '',
      t.exitTime || '',
      t.symbol,
      t.assetClass,
      t.direction,
      t.status,
      t.outcome,
      t.entryPrice,
      t.exitPrice,
      t.quantity,
      t.stopLoss,
      t.takeProfit,
      t.fees,
      t.netPnl,
      t.roi,
      t.plannedRR,
      t.realizedRR,
      `"${(t.strategy || '').replace(/"/g, '""')}"`,
      t.emotion,
      `"${(t.mistake || '').replace(/"/g, '""')}"`,
      t.rating,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tradepulse_trades_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const emptyState = (
    <>
      trades.length === 0 ? (
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-sunken flex items-center justify-center mx-auto text-brand">
                          <BookOpen className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-ink">No trades logged yet</h3>
                        <p className="text-xs text-muted">
                          Start building your trading track record by logging individual executions or importing historical broker trade statements.
                        </p>
                        <div className="pt-2 flex items-center justify-center gap-2.5 flex-wrap">
                          <button
                            onClick={onAddTrade}
                            className="px-4 py-2 bg-brand-solid hover:bg-brand-solid-hover text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Log Trade</span>
                          </button>
                          {onOpenBinanceSync && (
                            <button
                              onClick={onOpenBinanceSync}
                              className="px-4 py-2 bg-warn-bg hover:bg-warn-bg text-brand text-xs font-bold rounded-xl border border-warn-line transition shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                              <Zap className="w-4 h-4 fill-accent" />
                              <span>Sync Binance</span>
                            </button>
                          )}
                          <button
                            onClick={() => setIsCsvModalOpen(true)}
                            className="px-4 py-2 bg-surface hover:bg-sunken text-brand text-xs font-bold rounded-xl border border-line-brand transition cursor-pointer flex items-center gap-1.5"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Import CSV</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm">No trades matched your filter criteria.</p>
                        <button
                          onClick={resetFilters}
                          className="mt-2 text-xs text-brand hover:underline cursor-pointer"
                        >
                          Clear all filters
                        </button>
                      </div>
                    )
    </>
  );

  const handleToggleSort = (field: 'date' | 'netPnl' | 'roi' | 'realizedRR') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {[
          {
            label: 'Trades',
            value: String(filteredStats.count),
            sub: `${filteredStats.closedCount} closed`,
            tone: 'text-ink',
          },
          {
            label: 'Net P&L',
            value: `${filteredStats.net >= 0 ? '+' : '-'}$${Math.abs(filteredStats.net).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            sub: 'closed trades',
            tone: filteredStats.net >= 0 ? 'text-profit' : 'text-loss',
          },
          {
            label: 'Win rate',
            value: `${filteredStats.winRate}%`,
            sub: `${filteredStats.wins}W · ${filteredStats.losses}L`,
            tone: 'text-brand',
          },
          {
            label: 'Avg R',
            value: `${filteredStats.avgR >= 0 ? '+' : ''}${filteredStats.avgR.toFixed(2)}R`,
            sub: 'per closed trade',
            tone: filteredStats.avgR >= 0 ? 'text-profit' : 'text-loss',
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface border border-line rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-xs">
            <div className="text-[11px] font-medium text-muted">{stat.label}</div>
            <div className={`mt-0.5 text-lg sm:text-2xl font-bold font-mono tracking-tight ${stat.tone}`}>
              {stat.value}
            </div>
            <div className="text-[11px] text-faint font-mono">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-surface border border-line rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search trades…"
              className="w-full h-10 bg-surface-alt border border-line rounded-xl pl-9 pr-3 text-sm text-ink placeholder-faint focus:outline-none focus:border-brand transition"
            />
          </div>

          {/* Filters toggle (phones) */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`md:hidden h-10 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              showFilters || activeFilterCount > 0
                ? 'bg-sunken border-line-brand text-brand'
                : 'bg-surface-alt border-line text-ink-soft'
            }`}
            aria-expanded={showFilters}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-brand-solid text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Secondary actions (desktop) */}
          <div className="hidden md:flex items-center gap-2">
            {onOpenBinanceSync && (
              <button
                onClick={onOpenBinanceSync}
                className="h-10 px-3 bg-warn-bg text-brand text-xs font-bold rounded-xl border border-warn-line flex items-center gap-1.5 hover:opacity-90 transition cursor-pointer"
                title="Automated Binance Spot & Futures import"
              >
                <Zap className="w-4 h-4 fill-accent" />
                <span>Binance</span>
              </button>
            )}
            <button
              onClick={() => setIsCsvModalOpen(true)}
              className="h-10 px-3 bg-surface-alt hover:bg-sunken text-ink-soft text-xs font-semibold rounded-xl border border-line flex items-center gap-1.5 transition cursor-pointer"
              title="Import trades from broker CSV or statements"
            >
              <Upload className="w-4 h-4" />
              <span>Import</span>
            </button>
            <button
              onClick={handleExportCsv}
              disabled={trades.length === 0}
              className="h-10 px-3 bg-surface-alt hover:bg-sunken text-ink-soft text-xs font-semibold rounded-xl border border-line flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export all trades to CSV"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>

          <button
            onClick={onAddTrade}
            className="h-10 px-3 sm:px-4 bg-brand-solid hover:bg-brand-solid-hover text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
            aria-label="Log trade"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Log Trade</span>
          </button>
        </div>

        {/* Secondary actions (phones) */}
        <div className="md:hidden flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
          {onOpenBinanceSync && (
            <button
              onClick={onOpenBinanceSync}
              className="shrink-0 h-9 px-3 bg-warn-bg text-brand text-xs font-bold rounded-full border border-warn-line flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-accent" />
              Binance
            </button>
          )}
          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="shrink-0 h-9 px-3 bg-surface-alt text-ink-soft text-xs font-semibold rounded-full border border-line flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
          <button
            onClick={handleExportCsv}
            disabled={trades.length === 0}
            className="shrink-0 h-9 px-3 bg-surface-alt text-ink-soft text-xs font-semibold rounded-full border border-line flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>

        {/* Filters */}
        <div
          className={`${showFilters ? 'grid' : 'hidden'} grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center pt-3 border-t border-line-soft`}
        >
          {(() => {
            const sel = (active: boolean) =>
              `h-9 w-full md:w-auto rounded-xl border px-2.5 text-xs focus:outline-none focus:border-brand transition cursor-pointer ${
                active
                  ? 'bg-sunken border-line-brand text-brand font-semibold'
                  : 'bg-surface-alt border-line text-ink-soft'
              }`;
            return (
              <>
                <select value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value)} className={`${sel(selectedAsset !== 'all')} capitalize`} aria-label="Asset class">
                  <option value="all">All Assets</option>
                  <option value="stocks">Stocks</option>
                  <option value="crypto">Crypto</option>
                  <option value="forex">Forex</option>
                  <option value="futures">Futures</option>
                  <option value="options">Options</option>
                </select>

                <select value={selectedOutcome} onChange={(e) => setSelectedOutcome(e.target.value)} className={sel(selectedOutcome !== 'all')} aria-label="Outcome">
                  <option value="all">All Outcomes</option>
                  <option value="win">Wins</option>
                  <option value="loss">Losses</option>
                  <option value="breakeven">Breakeven</option>
                  <option value="open">Open</option>
                </select>

                <select value={selectedStrategy} onChange={(e) => setSelectedStrategy(e.target.value)} className={sel(selectedStrategy !== 'all')} aria-label="Setup">
                  <option value="all">All Setups</option>
                  {strategies.map((st) => (
                    <option key={st.id} value={st.name}>
                      {st.name}
                    </option>
                  ))}
                </select>

                <select value={selectedEmotion} onChange={(e) => setSelectedEmotion(e.target.value)} className={sel(selectedEmotion !== 'all')} aria-label="Mindset">
                  <option value="all">All Mindsets</option>
                  <option value="Disciplined">Disciplined</option>
                  <option value="Patient">Patient</option>
                  <option value="FOMO">FOMO</option>
                  <option value="Revenge">Revenge</option>
                  <option value="Hesitant">Hesitant</option>
                  <option value="Greedy">Greedy</option>
                </select>

                <select value={selectedMistake} onChange={(e) => setSelectedMistake(e.target.value)} className={`${sel(selectedMistake !== 'all')} col-span-2 md:col-span-1`} aria-label="Rules and mistakes">
                  <option value="all">All Rules / Mistakes</option>
                  <option value="Rule Breakers">⚠️ Any Rule Violated</option>
                  <option value="Followed Plan">✅ Followed Plan</option>
                  <option value="Chased Entry">Chased Entry</option>
                  <option value="Moved Stop Loss">Moved Stop Loss</option>
                  <option value="Exited Too Early">Exited Too Early</option>
                  <option value="Held Loser Too Long">Held Loser Too Long</option>
                  <option value="Overleveraged">Overleveraged</option>
                  <option value="Ignored HTF Trend">Ignored HTF Trend</option>
                  <option value="News Gamble">News Gamble</option>
                  <option value="No Stop Loss">No Stop Loss</option>
                  <option value="Revenge Trade">Revenge Trade</option>
                  <option value="Flipped Bias">Flipped Bias</option>
                </select>
              </>
            );
          })()}

          {(activeFilterCount > 0 || searchTerm) && (
            <button
              onClick={resetFilters}
              className="col-span-2 md:col-span-1 md:ml-auto h-9 px-3 text-xs font-semibold text-brand hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Trades Table */}
      <div className="hidden md:block bg-surface border border-line rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-canvas text-muted border-b border-line font-mono uppercase text-[11px] tracking-wider select-none whitespace-nowrap">
                <th
                  onClick={() => handleToggleSort('date')}
                  className="py-3.5 px-4 cursor-pointer hover:text-ink transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Date &amp; Time</span>
                    <ArrowUpDown className="w-3 h-3 text-faint" />
                  </div>
                </th>
                <th className="py-3.5 px-3">Symbol / Dir</th>
                <th className="py-3.5 px-3">Setup / Strategy</th>
                <th className="py-3.5 px-3">Entry &amp; Exit</th>
                <th
                  onClick={() => handleToggleSort('netPnl')}
                  className="py-3.5 px-3 cursor-pointer hover:text-ink transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Net P&amp;L</span>
                    <ArrowUpDown className="w-3 h-3 text-faint" />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort('roi')}
                  className="py-3.5 px-3 cursor-pointer hover:text-ink transition"
                >
                  <div className="flex items-center gap-1">
                    <span>ROI %</span>
                    <ArrowUpDown className="w-3 h-3 text-faint" />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort('realizedRR')}
                  className="py-3.5 px-3 cursor-pointer hover:text-ink transition"
                >
                  <div className="flex items-center gap-1">
                    <span>R:R</span>
                    <ArrowUpDown className="w-3 h-3 text-faint" />
                  </div>
                </th>
                <th className="py-3.5 px-3 hidden lg:table-cell">Psychology</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line-soft font-sans">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-faint">
                    {emptyState}
                  </td>
                </tr>
              ) : (
                filteredTrades.map((trade) => {
                  const isExpanded = expandedTradeId === trade.id;
                  const isWin = trade.outcome === 'win';
                  const isLoss = trade.outcome === 'loss';
                  const isOpen = trade.status === 'open';

                  return (
                    <React.Fragment key={trade.id}>
                      <tr
                        data-trade-row={trade.id}
                        className={`hover:bg-canvas transition-colors duration-500 group cursor-pointer ${
                          trade.id === highlightTradeId
                            ? 'bg-warn-bg-soft shadow-[inset_3px_0_0_var(--brand-solid)]'
                            : isExpanded
                            ? 'bg-sunken/40'
                            : ''
                        }`}
                        onClick={() => setExpandedTradeId(isExpanded ? null : trade.id)}
                      >
                        {/* Date & Time */}
                        <td className="py-3 px-4 font-mono whitespace-nowrap">
                          <div className="text-ink font-semibold">{trade.date}</div>
                          <div className="text-faint text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{trade.time}</span>
                          </div>
                        </td>

                        {/* Symbol & Direction */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink font-mono text-sm tracking-tight">
                              {trade.symbol}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                                trade.direction === 'long'
                                  ? 'bg-profit-bg text-profit border border-profit-line'
                                  : 'bg-loss-bg text-loss border border-loss-line'
                              }`}
                            >
                              {trade.direction}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[10px] capitalize text-faint">{trade.assetClass}</div>
                        </td>

                        {/* Strategy */}
                        <td className="py-3 px-3">
                          <span className="text-ink-soft font-medium truncate max-w-[150px] inline-block">
                            {trade.strategy}
                          </span>
                        </td>

                        {/* Entry & Exit */}
                        <td className="py-3 px-3 font-mono text-xs whitespace-nowrap">
                          <div className="text-ink">{formatPrice(trade.entryPrice)}</div>
                          <div className="text-faint text-[11px]">
                            {isOpen ? '→ Live' : `→ ${formatPrice(trade.exitPrice)}`}
                          </div>
                        </td>

                        {/* Net P&L */}
                        <td className="py-3 px-3 font-mono font-bold text-sm whitespace-nowrap">
                          {isOpen ? (
                            <span className="text-brand bg-sunken px-2 py-0.5 rounded border border-line-brand text-xs">
                              OPEN
                            </span>
                          ) : (
                            <span className={isWin ? 'text-profit' : isLoss ? 'text-loss' : 'text-muted'}>
                              {trade.netPnl >= 0 ? '+' : '-'}${Math.abs(trade.netPnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>

                        {/* ROI % */}
                        <td className="py-3 px-3 font-mono text-xs">
                          {isOpen ? (
                            <span className="text-faint">—</span>
                          ) : (
                            <span className={trade.roi >= 0 ? 'text-profit font-semibold' : 'text-loss font-semibold'}>
                              {trade.roi >= 0 ? '+' : ''}{trade.roi}%
                            </span>
                          )}
                        </td>

                        {/* R:R */}
                        <td className="py-3 px-3 font-mono text-xs whitespace-nowrap">
                          {isOpen ? (
                            <span className="text-brand text-[11px]">P: 1:{trade.plannedRR}</span>
                          ) : (
                            <div className="flex flex-col">
                              <span className={trade.realizedRR >= 0 ? 'text-profit font-bold' : 'text-loss font-bold'}>
                                {trade.realizedRR}R
                              </span>
                              <span className="text-[10px] text-faint">Plan 1:{trade.plannedRR}</span>
                            </div>
                          )}
                        </td>

                        {/* Psychology Emotion */}
                        <td className="py-3 px-3 hidden lg:table-cell">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border inline-flex items-center gap-1 ${
                              trade.emotion === 'Disciplined' || trade.emotion === 'Patient'
                                ? 'bg-profit-bg text-profit border-profit-line'
                                : trade.emotion === 'FOMO' || trade.emotion === 'Revenge'
                                ? 'bg-loss-bg text-loss border-loss-line'
                                : 'bg-sunken text-brand border-line-brand'
                            }`}
                          >
                            {trade.emotion}
                          </span>
                        </td>

                        {/* Actions */}
                        <td
                          className="py-3 px-4 text-right"
                          onClick={(e) => e.stopPropagation()} // Don't toggle row expand
                        >
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setCardModalTrade(trade)}
                              className="w-8 h-8 inline-flex items-center justify-center text-muted hover:text-brand hover:bg-sunken-strong rounded-lg transition cursor-pointer"
                              title="Export / Share Trade Card"
                              aria-label="Share trade card"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>

                            {trade.chartUrl && (
                              <button
                                onClick={() => setPreviewImageUrl(trade.chartUrl!)}
                                className="w-8 h-8 inline-flex items-center justify-center text-muted hover:text-ink hover:bg-sunken-strong rounded-lg transition cursor-pointer"
                                title="View chart screenshot"
                                aria-label="View chart screenshot"
                              >
                                <ImageIcon className="w-4 h-4" />
                              </button>
                            )}

                            <span className="w-px h-5 bg-line mx-1" aria-hidden="true" />

                            <button
                              onClick={() => onDuplicateTrade(trade)}
                              className="w-8 h-8 inline-flex items-center justify-center text-muted hover:text-brand hover:bg-sunken-strong rounded-lg transition cursor-pointer"
                              title="Duplicate trade"
                              aria-label="Duplicate trade"
                            >
                              <Copy className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => onEditTrade(trade)}
                              className="w-8 h-8 inline-flex items-center justify-center text-muted hover:text-profit hover:bg-profit-bg rounded-lg transition cursor-pointer"
                              title="Edit trade"
                              aria-label="Edit trade"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setTradeToDelete(trade)}
                              className="w-8 h-8 inline-flex items-center justify-center text-muted hover:text-loss hover:bg-loss-bg rounded-lg transition cursor-pointer"
                              title="Delete trade"
                              aria-label="Delete trade"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Trade Deep Dive */}
                      {isExpanded && (
                        <tr className="bg-canvas border-b border-line-soft">
                          <td colSpan={9} className="p-4 sm:p-5">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                              {/* Left detail column */}
                              <div className="md:col-span-8 space-y-3">
                                <div>
                                  <h4 className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-1">
                                    Trade Thesis &amp; Post-Trade Review
                                  </h4>
                                  <p className="text-ink text-xs leading-relaxed bg-surface p-3 rounded-xl border border-line">
                                    {trade.notes || 'No specific notes recorded for this execution.'}
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                                  <div className="p-2.5 bg-surface rounded-xl border border-line">
                                    <span className="text-[10px] text-faint uppercase block font-sans">Stop Loss</span>
                                    <span className="text-loss font-bold">{formatPrice(trade.stopLoss)}</span>
                                  </div>
                                  <div className="p-2.5 bg-surface rounded-xl border border-line">
                                    <span className="text-[10px] text-faint uppercase block font-sans">Take Profit</span>
                                    <span className="text-profit font-bold">{formatPrice(trade.takeProfit)}</span>
                                  </div>
                                  <div className="p-2.5 bg-surface rounded-xl border border-line">
                                    <span className="text-[10px] text-faint uppercase block font-sans">Position Qty</span>
                                    <span className="text-ink font-semibold">{formatQuantity(trade.quantity, trade.assetClass)}</span>
                                  </div>
                                  <div className="p-2.5 bg-surface rounded-xl border border-line">
                                    <span className="text-[10px] text-faint uppercase block font-sans">Fees / Comm</span>
                                    <span className="text-muted">{formatPrice(trade.fees)}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 text-xs">
                                  <span className="text-muted">
                                    Rule Adherence:{' '}
                                    <strong
                                      className={
                                        trade.mistake === 'Followed Plan' ? 'text-profit' : 'text-accent'
                                      }
                                    >
                                      {trade.mistake || 'Followed Plan'}
                                    </strong>
                                  </span>
                                  <span className="text-muted">
                                    Session: <strong className="text-ink">{trade.marketSession || 'NY Open'}</strong>
                                  </span>
                                  <span className="text-muted">
                                    Rating: <strong className="text-brand">★ {trade.rating} / 5</strong>
                                  </span>
                                </div>
                              </div>

                              {/* Right column: Chart thumbnail */}
                              <div className="md:col-span-4 flex flex-col justify-center">
                                {trade.chartUrl ? (
                                  <div
                                    className="cursor-pointer group relative rounded-xl overflow-hidden border border-line-brand bg-surface aspect-video shadow-xs"
                                    onClick={() => setPreviewImageUrl(trade.chartUrl!)}
                                  >
                                    <img
                                      src={trade.chartUrl}
                                      alt="Trade chart"
                                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                    />
                                    <div className="absolute inset-0 bg-inverse/30 group-hover:bg-inverse/10 transition flex items-center justify-center">
                                      <span className="text-[11px] text-white font-medium bg-inverse/70 px-2 py-1 rounded-md backdrop-blur-xs">
                                        Click to Expand Chart
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-dashed border-line-strong p-6 text-center text-faint text-xs">
                                    No chart screenshot attached.
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trades as cards (phones) */}
      <div className="md:hidden space-y-2.5">
        {filteredTrades.length === 0 ? (
          <div className="bg-surface border border-line rounded-2xl py-10 px-4 text-center text-faint">{emptyState}</div>
        ) : (
          filteredTrades.map((trade) => {
            const isOpen = trade.status === 'open';
            const isWin = trade.outcome === 'win';
            const isLoss = trade.outcome === 'loss';
            const isExpanded = expandedTradeId === trade.id;
            return (
              <div
                key={trade.id}
                data-trade-row={trade.id}
                className={`bg-surface border rounded-2xl overflow-hidden shadow-xs transition-colors duration-500 ${
                  trade.id === highlightTradeId ? 'border-brand-solid bg-warn-bg-soft' : 'border-line'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedTradeId(isExpanded ? null : trade.id)}
                  className="w-full text-left p-3.5 flex items-start justify-between gap-3 cursor-pointer"
                  aria-expanded={isExpanded}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-ink font-mono text-[15px] tracking-tight">{trade.symbol}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                          trade.direction === 'long'
                            ? 'bg-profit-bg text-profit border border-profit-line'
                            : 'bg-loss-bg text-loss border border-loss-line'
                        }`}
                      >
                        {trade.direction}
                      </span>
                      <span className="text-[10px] capitalize text-faint">{trade.assetClass}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-faint font-mono">
                      <Clock className="w-3 h-3" />
                      <span>
                        {trade.date} · {trade.time}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted truncate">{trade.strategy}</div>
                  </div>

                  <div className="text-right shrink-0">
                    {isOpen ? (
                      <span className="text-brand bg-sunken px-2 py-0.5 rounded border border-line-brand text-xs font-bold font-mono">
                        OPEN
                      </span>
                    ) : (
                      <>
                        <div className={`font-mono font-bold text-base ${isWin ? 'text-profit' : isLoss ? 'text-loss' : 'text-muted'}`}>
                          {trade.netPnl >= 0 ? '+' : '-'}$
                          {Math.abs(trade.netPnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-faint">
                          {trade.roi >= 0 ? '+' : ''}
                          {trade.roi}% · {trade.realizedRR}R
                        </div>
                      </>
                    )}
                    <div className="mt-1.5 flex justify-end">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sunken text-brand border border-line-brand">
                        {trade.emotion}
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3.5 pb-3.5 space-y-3 border-t border-line-soft pt-3 bg-canvas">
                    <p className="text-xs leading-relaxed text-ink bg-surface p-3 rounded-xl border border-line">
                      {trade.notes || 'No specific notes recorded for this execution.'}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 bg-surface rounded-xl border border-line">
                        <span className="text-[10px] text-faint uppercase block font-sans">Entry → Exit</span>
                        <span className="text-ink font-semibold">
                          {formatPrice(trade.entryPrice)} → {isOpen ? 'Live' : formatPrice(trade.exitPrice)}
                        </span>
                      </div>
                      <div className="p-2.5 bg-surface rounded-xl border border-line">
                        <span className="text-[10px] text-faint uppercase block font-sans">Quantity</span>
                        <span className="text-ink font-semibold">{formatQuantity(trade.quantity, trade.assetClass)}</span>
                      </div>
                      <div className="p-2.5 bg-surface rounded-xl border border-line">
                        <span className="text-[10px] text-faint uppercase block font-sans">Stop Loss</span>
                        <span className="text-loss font-bold">{formatPrice(trade.stopLoss)}</span>
                      </div>
                      <div className="p-2.5 bg-surface rounded-xl border border-line">
                        <span className="text-[10px] text-faint uppercase block font-sans">Take Profit</span>
                        <span className="text-profit font-bold">{formatPrice(trade.takeProfit)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span>
                        Rules:{' '}
                        <strong className={trade.mistake === 'Followed Plan' || !trade.mistake ? 'text-profit' : 'text-accent'}>
                          {trade.mistake || 'Followed Plan'}
                        </strong>
                      </span>
                      <span>
                        Rating: <strong className="text-brand">★ {trade.rating}/5</strong>
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCardModalTrade(trade)}
                        className="flex-1 h-9 rounded-xl border border-line bg-surface text-xs font-semibold text-ink-soft flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Share card
                      </button>
                      {trade.chartUrl && (
                        <button
                          onClick={() => setPreviewImageUrl(trade.chartUrl!)}
                          className="flex-1 h-9 rounded-xl border border-line bg-surface text-xs font-semibold text-ink-soft flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5" /> View chart
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 divide-x divide-line-soft border-t border-line-soft text-xs font-semibold">
                  <button
                    onClick={() => onDuplicateTrade(trade)}
                    className="h-11 flex items-center justify-center gap-1.5 text-ink-soft hover:bg-sunken active:bg-sunken-strong cursor-pointer"
                  >
                    <Copy className="w-4 h-4" /> Duplicate
                  </button>
                  <button
                    onClick={() => onEditTrade(trade)}
                    className="h-11 flex items-center justify-center gap-1.5 text-ink-soft hover:bg-sunken active:bg-sunken-strong cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => setTradeToDelete(trade)}
                    className="h-11 flex items-center justify-center gap-1.5 text-loss hover:bg-loss-bg active:bg-loss-bg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chart Image Lightbox Modal */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse/80 backdrop-blur-xs"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="max-w-5xl w-full max-h-[90vh] relative animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-[#ede6dc] text-sm font-semibold flex items-center gap-1 cursor-pointer"
            >
              Close ✕
            </button>
            <img
              src={previewImageUrl}
              alt="Trade chart preview"
              className="w-full h-auto max-h-[85vh] object-contain rounded-2xl border border-line-brand shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Broker CSV Import Wizard Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImportTrades={(imported) => {
          onImportCsv(imported);
          setIsCsvModalOpen(false);
        }}
        existingTrades={trades}
      />

      {/* Social Trade Card Generator Modal */}
      <SocialTradeCardModal
        isOpen={cardModalTrade !== null}
        onClose={() => setCardModalTrade(null)}
        trade={cardModalTrade}
      />

      {/* Delete confirmation (in-app, so it works in every browser / PWA / iframe) */}
      <ConfirmDialog
        isOpen={tradeToDelete !== null}
        danger
        title="Delete this trade?"
        message={
          tradeToDelete ? (
            <>
              <span className="font-mono font-semibold text-ink">{tradeToDelete.symbol}</span>{' '}
              {tradeToDelete.direction} on {tradeToDelete.date} will be removed from your journal and stats.
              You can undo right after.
            </>
          ) : null
        }
        confirmLabel="Delete trade"
        onCancel={() => setTradeToDelete(null)}
        onConfirm={() => {
          if (tradeToDelete) onDeleteTrade(tradeToDelete.id);
          setTradeToDelete(null);
        }}
      />
    </div>
  );
};
